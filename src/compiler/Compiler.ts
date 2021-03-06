import * as fs from "fs-extra"
import * as path from "path";
import * as util from "util";
import {
	getScriptContext,
	getScriptType,
	isValidLuaIdentifier,
	red,
	ScriptContext,
	ScriptType,
	stripExts,
	yellow,
} from "./utility";
import { CompilerError, CompilerErrorType } from "./errors/CompilerError";
import * as Combiner from "./Combiner";
import { Project } from "./Combiner";
import Transpiler from "./Transpiler";
import { TranspilerError } from "./errors/TranspilerError";

interface Partition {
	dir: Combiner.Directory;
	target: string;
}

const LUA_EXT = ".lua";
async function copyLuaFiles(sourceFolder: string, destinationFolder: string) {
	const hasLuaFilesMap = new Map<string, boolean>();
	const searchForLuaFiles = async (dir: string) => {
		let hasLuaFiles = false;
		for (const fileName of await fs.readdir(dir)) {
			const filePath = path.join(dir, fileName);
			const stats = await fs.stat(filePath);
			if (stats.isFile() && path.extname(fileName) === LUA_EXT) {
				hasLuaFiles = true;
			} else if (stats.isDirectory()) {
				if (await searchForLuaFiles(filePath)) {
					hasLuaFiles = true;
				}
			}
		}
		hasLuaFilesMap.set(dir, hasLuaFiles);
		return hasLuaFiles;
	};
	await searchForLuaFiles(sourceFolder);

	await fs.copy(sourceFolder, destinationFolder, {
		filter: async (oldPath, newPath) => {
			const stats = await fs.stat(oldPath);
			if (stats.isDirectory() && hasLuaFilesMap.get(oldPath) === true) {
				return true;
			} else if (stats.isFile() && path.extname(oldPath) === LUA_EXT) {
				if (await fs.pathExists(newPath)) {
					const oldContents = await fs.readFile(oldPath);
					const newContents = await fs.readFile(newPath);
					return !oldContents.equals(newContents);
				} else {
					return true;
				}
			}
			return false;
		},
		recursive: true,
	});
}

async function cleanDeadLuaFiles(sourceFolder: string, destinationFolder: string) {
	const searchForDeadFiles = async (dir: string) => {
		if (await fs.pathExists(dir)) {
			for (const fileName of await fs.readdir(dir)) {
				const filePath = path.join(dir, fileName);
				const stats = await fs.stat(filePath);
				if (stats.isDirectory()) {
					searchForDeadFiles(filePath);
					if ((await fs.readdir(dir)).length === 0) {
						fs.remove(filePath);
						console.log("delete", "dir", filePath);
					}
				} else if (stats.isFile()) {
					const relativeToDestFolder = path.relative(destinationFolder, filePath);
					if (!(await fs.existsSync(path.join(sourceFolder, relativeToDestFolder)))) {
						fs.remove(filePath);
						console.log("delete", "file", filePath);
					}
				}
			}
		}
	};
	await searchForDeadFiles(destinationFolder);
}

export async function copyAndCleanDeadLuaFiles(sourceFolder: string, destinationFolder: string) {
	await copyLuaFiles(sourceFolder, destinationFolder);
	await cleanDeadLuaFiles(sourceFolder, destinationFolder);
}

export class Compiler {
	private readonly project: Project;
	private readonly projectPath: string;
	private readonly rootDirPath: string;
	private readonly outDirPath: string;
	private readonly compilerOptions: Combiner.CompilerOptions;
	private readonly syncInfo = new Array<Partition>();

	public readonly noStrict: boolean;
	public readonly noHeuristics: boolean;
	public readonly ci: boolean;

	constructor(configFilePath: string, args: { [argName: string]: any }) {
		this.projectPath = path.resolve(configFilePath, "..");
		this.project = new Project({
			monolithConfigFilePath: configFilePath,
		});
		this.noStrict = args.noStrict;
		this.noHeuristics = args.noHeuristics;
		this.ci = args.ci;

		this.compilerOptions = this.project.getCompilerOptions();
		try {
			this.validateCompilerOptions();
			this.project.loadSourceFiles()
		} catch (e) {
			if (e instanceof CompilerError) {
				console.log(red("Compiler Error:"), e.message);
				process.exit(1);
			} else {
				throw e;
			}
		}

		const rootDirPath = this.compilerOptions.rootDir;
		if (!rootDirPath) {
			throw new CompilerError("Expected 'rootDir' option in monolithconfig.json!", CompilerErrorType.MissingRootDir);
		}
		this.rootDirPath = rootDirPath;

		const outDirPath = this.compilerOptions.outDir;
		if (!outDirPath) {
			throw new CompilerError("Expected 'outDir' option in monolithconfig.json!", CompilerErrorType.MissingOutDir);
		}
		this.outDirPath = outDirPath;

		// filter out outDir files
		const outDir = this.project.getDirectory(outDirPath);
		if (outDir) {
			this.project.getSourceFiles().forEach(sourceFile => {
				if (outDir.isAncestorOf(sourceFile)) {
					this.project.removeSourceFile(sourceFile);
				}
			});
		}
	}
	public getProject(): Combiner.Project {
		return this.project
	}

	private validateCompilerOptions() {
		const opts = this.compilerOptions;

		const errors = new Array<string>();

		// configurable compiler options
		if (opts.rootDir === undefined) {
			errors.push(`${yellow(`"rootDir"`)} must be defined`);
		}
		if (opts.outDir === undefined) {
			errors.push(`${yellow(`"outDir"`)} must be defined`);
		}

		// throw if errors
		if (errors.length > 0) {
			throw new CompilerError(
				`Invalid "monolithconfig.json" configuration!\n` +
					"https://github.io/headjoe3/rbx-monolith" +
					"\n" +
					errors.map(e => "- " + e).join("\n"),
				CompilerErrorType.BadMonolithConfig,
			);
		}
	}

	private transformPathToOut(filePath: string) {
		const relativeToRoot = path.dirname(path.relative(this.rootDirPath, filePath));
		let name = path.basename(filePath, path.extname(filePath));
		const exts = new Array<string>();
		while (true) {
			const ext = path.extname(name);
			if (ext.length > 0) {
				exts.unshift(ext);
				name = path.basename(name, ext);
			} else {
				break;
			}
		}
		if (name === "index") {
			name = "init";
		}
		const luaName = name + exts.join("") + ".lua";
		return path.join(this.outDirPath, relativeToRoot, luaName);
	}

	private transformPathFromOut(filePath: string) {
		const relativeToOut = path.dirname(path.relative(this.outDirPath, filePath));
		let name = path.basename(filePath, path.extname(filePath));
		if (name === "init") {
			name = "index";
		}
		return path.join(this.rootDirPath, relativeToOut, name);
	}

	public addFile(filePath: string) {
		this.project.addExistingSourceFile(filePath);
	}

	public removeFile(filePath: string) {
		const sourceFile = this.project.getSourceFile(filePath);
		if (sourceFile) {
			this.project.removeSourceFile(sourceFile);
		}
	}

	public refresh(): Promise<Array<Combiner.FileSystemRefreshResult>> {
		return Promise.all(this.project.getSourceFiles().map(sourceFile => sourceFile.refreshFromFileSystem()));
	}

	public async cleanDirRecursive(dir: string) {
		if (fs.existsSync(dir)) {
			const contents = fs.readdirSync(dir);
			for (const name of contents) {
				const filePath = path.join(dir, name);
				if (fs.statSync(filePath).isDirectory()) {
					await this.cleanDirRecursive(filePath);
					if (fs.readdirSync(filePath).length === 0) {
						fs.rmdirSync(filePath);
					}
				} else {
					const ext = path.extname(filePath);
					if (ext === ".lua") {
						const rootPath = this.transformPathFromOut(filePath);
						if (
							!(await fs.pathExists(rootPath + ".lua"))
						) {
							fs.removeSync(filePath);
						}
					}
				}
			}
		}
	}

	public getRootDirOrThrow() {
		if (!this.rootDirPath) {
			throw new CompilerError("Could not find rootDir!", CompilerErrorType.MissingRootDir);
		}
		return this.rootDirPath;
	}

	public async compileAll(noInclude: boolean) {
		await this.compileFiles(this.project.getEntryPoints());
	}

	public async compileFileByPath(filePath: string) {
		const ext = path.extname(filePath);
		if (ext === ".lua") {
			const sourceFile = this.project.getSourceFile(filePath);
			if (!sourceFile) {
				throw new CompilerError(
					`No source file for Compiler.compileFileByPath() (filePath = ${filePath})`,
					CompilerErrorType.MissingSourceFile,
				);
			}

			const seen = new Set<string>();
			const files = new Array<Combiner.SourceFile>();

			const search = (file: Combiner.SourceFile) => {
				files.push(file);
				file.getReferencingSourceFiles().forEach((identifiers, ref) => {
					const refPath = ref.getFilePath();
					if (!seen.has(refPath)) {
						seen.add(refPath);
						search(ref);
					}
				});
			};
			search(sourceFile);

			return this.compileFiles(files);
		}
	}

	public async compileFiles(files: Array<Combiner.SourceFile>) {
		await this.cleanDirRecursive(this.outDirPath);
		try {
			const sources = files
				.map(sourceFile => {
					const transpiler = new Transpiler(this);
					return [
						this.transformPathToOut(sourceFile.getFilePath()),
						transpiler.transpileEntryPoint(sourceFile),
					];
				});

			for (const [filePath, contents] of sources) {
				if (await fs.pathExists(filePath)) {
					const oldContents = (await fs.readFile(filePath)).toString();
					if (oldContents === contents) {
						continue;
					}
				}
				await fs.ensureFile(filePath);
				await fs.writeFile(filePath, contents);
			}
		} catch (e) {
			// do not silence errors for CI tests
			if (this.ci) {
				throw e;
			}
			if (e instanceof TranspilerError) {
				console.log(
					"%s:%d:%d - %s %s",
					path.relative(this.projectPath, e.node.getSourceFile().getFilePath()),
					e.node.getStartLineNumber(),
					e.node.getStartColumnNumber(),
					red("Transpiler Error:"),
					e.message,
				);
			} else if (e instanceof CompilerError) {
				console.log(red("Compiler Error:"), e.message);
			} else {
				throw e;
			}
			process.exitCode = 1;
		}
	}

	public getRobloxPathString(rbxPath: Array<string>) {
		rbxPath = rbxPath.map(v => (isValidLuaIdentifier(v) ? "." + v : `["${v}"]`));
		return "game" + rbxPath.join("");
	}

	public getRbxPath(sourceFile: Combiner.SourceFile) {
		const partition = this.syncInfo.find(part => part.dir.isAncestorOf(sourceFile));
		if (partition) {
			const rbxPath = partition.dir
				.getRelativePathTo(sourceFile)
				.split("/")
				.filter(part => part !== ".");

			let last = rbxPath.pop()!;
			let ext = path.extname(last);
			while (ext !== "") {
				last = path.basename(last, ext);
				ext = path.extname(last);
			}
			rbxPath.push(last);

			return rbxPath;
		}
	}

	public validateImport(sourceFile: Combiner.SourceFile, moduleFile: Combiner.SourceFile) {
		if (this.noHeuristics) {
			return;
		}

		const sourceContext = getScriptContext(sourceFile);
		const sourceRbxPath = this.getRbxPath(sourceFile);
		const moduleRbxPath = this.getRbxPath(moduleFile);
		if (sourceRbxPath !== undefined && moduleRbxPath !== undefined) {
			if (getScriptType(moduleFile) !== ScriptType.Module) {
				throw new CompilerError(
					util.format("Attempted to import non-ModuleScript! %s", moduleFile.getFilePath()),
					CompilerErrorType.ImportNonModuleScript,
				);
			}

			if (sourceContext === ScriptContext.Client) {
				if (moduleRbxPath[0] === "ServerScriptService" || moduleRbxPath[0] === "ServerStorage") {
					throw new CompilerError(
						util.format(
							"%s is not allowed to import %s",
							this.getRobloxPathString(sourceRbxPath),
							this.getRobloxPathString(moduleRbxPath),
						),
						CompilerErrorType.InvalidImportAccess,
					);
				}
			}
		}
	}

	public getRelativeImportPath(sourceFile: Combiner.SourceFile, moduleFile: Combiner.SourceFile | undefined, specifier: string) {
		if (moduleFile) {
			this.validateImport(sourceFile, moduleFile);
		}

		const currentPartition = this.syncInfo.find(part => part.dir.isAncestorOf(sourceFile));
		const modulePartition = moduleFile && this.syncInfo.find(part => part.dir.isAncestorOf(moduleFile));

		if (moduleFile && currentPartition && currentPartition.target !== (modulePartition && modulePartition.target)) {
			return this.getImportPathFromFile(sourceFile, moduleFile);
		}

		const parts = path.posix
			.normalize(specifier)
			.split("/")
			.filter(part => part !== ".")
			.map(part => (part === ".." ? ".Parent" : part));
		if (parts[parts.length - 1] === ".index") {
			parts.pop();
		}
		let prefix = "script";
		if (
			stripExts(sourceFile.getBaseName()) !== "index"
		) {
			prefix += ".Parent";
		}

		const importRoot = prefix + parts.filter(p => p === ".Parent").join("");
		const importParts = parts.filter(p => p !== ".Parent");
		const params = importRoot + (importParts.length > 0 ? `, "${importParts.join(`", "`)}"` : "");

		return `TS.import(${params})`;
	}

	public getImportPathFromFile(sourceFile: Combiner.SourceFile, moduleFile: Combiner.SourceFile) {
		this.validateImport(sourceFile, moduleFile);
		const partition = this.syncInfo.find(part => part.dir.isAncestorOf(moduleFile));
		if (!partition) {
			throw new CompilerError(
				"Could not compile non-relative import, no data from rojo.json",
				CompilerErrorType.NoRojoData,
			);
		}

		const parts = partition.dir
			.getRelativePathAsModuleSpecifierTo(moduleFile)
			.split("/")
			.filter(part => part !== ".");

		const last = parts.pop();
		if (!last) {
			throw new CompilerError("Compiler.getImportPath() failed! #3", CompilerErrorType.GetImportPathFail3);
		}

		if (last !== "index") {
			parts.push(last);
		}

		const params = partition.target
			.split(".")
			.concat(parts)
			.filter(v => v.length > 0)
			.map(v => `"${v}"`)
			.join(", ");

		return `TS.import(${params})`;
	}
}