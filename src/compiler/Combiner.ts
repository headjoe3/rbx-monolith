import { relative, dirname, resolve, basename, join } from "path";
import { CompilerError, CompilerErrorType } from "./errors/CompilerError";
import * as fs from "fs-extra"
import ParsedLua = require("./ParsedLua");

function toSnakeCase(str: string) {
    // see what i did there
    let snake_case = ""
    let nextHasSnake = false

    // Check if first char is alphanumeric; if not, add a snake at the beginning
    const firstChar = str.charAt(0)
    if (!firstChar || !(
        (firstChar >= 'A' && firstChar <= 'Z')
        || (firstChar >= 'a' && firstChar <= 'z')
        || (firstChar >= '0' && firstChar <= '9') 
    )){
        snake_case = "_"
    }


    for (let i = 0; i < str.length; i++) {
        const char = str.charAt(i)
        if (
            (char >= 'A' && char <= 'Z')
            || (char >= 'a' && char <= 'z')
            || (char >= '0' && char <= '9')
        ) {
            if (nextHasSnake) {
                snake_case += "_"
                nextHasSnake = false
            }
            snake_case += char
        } else {
            nextHasSnake = true
        }
    }
    return snake_case
}

const HEX_MAP: {[index: number]: string} = {
    [0]: "0",
    [1]: "1",
    [2]: "2",
    [3]: "3",
    [4]: "4",
    [5]: "5",
    [6]: "6",
    [7]: "7",
    [8]: "8",
    [9]: "9",
    [10]: "a",
    [11]: "b",
    [12]: "c",
    [13]: "d",
    [14]: "e",
    [15]: "f",
}
// https://stackoverflow.com/questions/26501688/a-typescript-guid-class
/** Generates a new GUID */
function getUniqueID(length?: number): string {
    length = length || 32
    let result: string;

    result = "";
    for (let j = 0; j < length; j++) {
        if (j === 8 || j === 12 || j === 16 || j === 20)
            result = result + '_';
        let i = HEX_MAP[Math.floor(Math.random() * 16)].toUpperCase();
        result = result + i;
    }
    return result
}

export = Combiner
namespace Combiner {
    export const SourceFileExtensions = [
        ".lua",
    ]
    export class Diagnostic {
		getMessageText(): any {
			throw new Error("Method not implemented.");
		}
		getLineNumber(): any {
			throw new Error("Method not implemented.");
		}
		getSourceFile(): any {
			throw new Error("Method not implemented.");
		}
		getCode(): any {
			throw new Error("Method not implemented.");
		}
		getCategory(): any {
			throw new Error("Method not implemented.");
		}
}
    export class DiagnosticMessageChain {
		getNext(): Combiner.DiagnosticMessageChain | undefined {
			throw new Error("Method not implemented.");
		}
		getMessageText(): string {
			throw new Error("Method not implemented.");
		}
}
    export enum DiagnosticCategory {
        Error
    }
    export type FileSystemRefreshResult = string
    export class Directory {
		getRelativePathAsModuleSpecifierTo(moduleFile: SourceFile): string {
			throw new Error("Method not implemented.");
		}
		getRelativePathTo(sourceFile: any): string {
			return relative(this.path, sourceFile)
		}
		isAncestorOf(sourceFile: SourceFile): any {
			return !relative(this.path, sourceFile.getFilePath()).startsWith("..")
		}
        constructor(public readonly path: string) {

        }
    }
    export class SourceFile {
        private path: string
        /** A map of referencing source files to a list of exported identifiers referenced */
        private referencingSourceFiles: Map<SourceFile, string[]>
        /** A cached string of transpiled code for this module */
        private transpiledChunkCache?: string
        /** A cached ast representation of code for this module */
        private parsedChunkCache?: ParsedLua.Chunk
        /** Unique prefix for all exported identifiers */
        private moduleMonolithicName: string
        /** Map from exported identifiers to their unique monolithic names */
        private exportedIdentifiersCache: Map<string, string>
        private obfuscated: boolean
        private project: Project

        constructor(project: Project, path: string) {
            this.path = path
            this.project = project

            this.obfuscated = project.getCompilerOptions().obfuscate
            if (this.obfuscated) {
                let id: string
                do {
                    id = "_" + getUniqueID(10)
                }
                while (project.usedIdentifiersCache.has(id))
                project.usedIdentifiersCache.add(id)
                this.moduleMonolithicName = id
            } else {
                let id

                // Check if unqualified name is taken
                const unqualified = toSnakeCase(basename(path, ".lua"))
                if (project.usedIdentifiersCache.has(unqualified)) {
                    // Check if qualified name is taken
                    let modulePath = relative(resolve(project.getCompilerOptions().rootDir), path)
                    if (modulePath.endsWith(".lua")) {
                        modulePath = modulePath.substr(0, modulePath.length - ".lua".length)
                    }
                    const base = toSnakeCase(modulePath)
                    id = id || base
                    let extra = 1
                    while (project.usedIdentifiersCache.has(id)) {
                        id = base + '_' + extra
                        extra++
                    }
                    project.usedIdentifiersCache.add(id)
                    this.moduleMonolithicName = id
                } else {
                    // Set to unqualified name
                    project.usedIdentifiersCache.add(unqualified)
                    this.moduleMonolithicName = unqualified
                }

            }
            this.referencingSourceFiles = new Map()
            this.exportedIdentifiersCache = new Map()
        }
        /** Gets the monolithic name for the source file's module */
        getMonolithicName(): string
        /** Returns the monolithic name for an identifier exported by this source file */
        getMonolithicName(identifier: string): string
        getMonolithicName(identifier?: string): string {
            if (!identifier) {
                return this.moduleMonolithicName
            }
            const cached = this.exportedIdentifiersCache.get(identifier)
            if (cached) {
                return cached
            }
            if (this.obfuscated) {
                let id: string
                do {
                    id = "_" + getUniqueID(10)
                }
                while (this.project.usedIdentifiersCache.has(id))
                this.project.usedIdentifiersCache.add(id)

                return id
            } else {
                const base = this.moduleMonolithicName + (identifier ? ("_" + identifier) : "")
                let id = base
                let extra = 1
                while (this.project.usedIdentifiersCache.has(id)) {
                    id = base + '_' + extra
                    extra++
                }
                this.project.usedIdentifiersCache.add(id)
                return id
            }
        }
		getBaseName(): string {
			return basename(this.path)
		}
		refreshFromFileSystem(): any {
			throw new Error("Method not implemented.");
		}
        getFilePath(): string {
            return this.path
        }
        getReferencingSourceFiles(): Map<SourceFile, string[]> {
            return this.referencingSourceFiles
        }
        getExportedIdentifiers(): Map<string, string> {
            return this.exportedIdentifiersCache
        }
        setMonolithCache(transpiled: string, parsed: ParsedLua.Chunk) {
            this.parsedChunkCache = parsed
            this.transpiledChunkCache = transpiled
        }
        setMonolithicExports(exportToMonolithic: Map<string, string>) {
            this.exportedIdentifiersCache = exportToMonolithic
        }
        getTranspiledCache(): string | undefined {
            return this.transpiledChunkCache
        }
        getParsedCache(): ParsedLua.Chunk | undefined {
            return this.parsedChunkCache
        }
        clearCache() {
            this.transpiledChunkCache = undefined
            this.parsedChunkCache = undefined
        }
        /** Synchronously reads the string contents of the file */
        readSync(): string {
            return fs.readFileSync(this.path).toString()
        }
    }
    export class ErrorNode {
        private sourceFile: SourceFile
        private line: number
        private col: number
        constructor(sourceFile: SourceFile, line: number, col: number) {
            this.sourceFile = sourceFile
            this.line = line
            this.col = col
        }
		getStartLineNumber(): any {
            return this.line
		}
		getStartColumnNumber(): any {
            return this.col
		}
		getSourceFile(): any {
            return this.sourceFile
		}
    }

    // Project

    
    interface ProjectConfigContainer {
        outDir: string
        rootDir: string
        entryPoints: string[]
        include: string[]
        obfuscate: boolean
        uglify: boolean
    }
    export interface ProjectConfig {
        /** File path to the monolithconfig.json file */
        monolithConfigFilePath: string
    }
    export type CompilerOptions = ProjectConfig & ProjectConfigContainer
    export class Project {
        private config: CompilerOptions
        private context: {
            directory: Directory
        }
        private includedSourceFiles: Set<SourceFile>
        private includedSourcePaths: Set<string>
        private entryPoints: SourceFile[]
        public usedIdentifiersCache: Set<string> = new Set()
        constructor(options: ProjectConfig) {
            // Override defaults with config file
            const config = Project.getDefaultOptions()

            // Read config file
            const configObject = fs.readJSONSync(options.monolithConfigFilePath)
            if (!configObject || typeof configObject !== "object") {
                throw new CompilerError("monolithconfig.json did not return a valid object", CompilerErrorType.BadMonolithConfig)
            }
            Object.assign(config, configObject)

            this.config = config as CompilerOptions
            this.context = {
                directory: new Directory(dirname(options.monolithConfigFilePath))
            }
            this.includedSourceFiles = new Set()
            this.includedSourcePaths = new Set()
            this.entryPoints = []
        }
        /** Initially loads the project's source files */
        loadSourceFiles(): void {
            // Clear source cache
            this.includedSourceFiles = new Set()
            this.includedSourcePaths = new Set()
            this.entryPoints = []

            // Search included directories for all source files
            const include = this.config.include
			const search = (absolutePath: string) => {
                if (fs.existsSync(absolutePath)) {
                    const stats = fs.lstatSync(absolutePath)
                    if (stats.isFile()) {
                        let isSource = false
                        SourceFileExtensions.forEach(ext => {
                            if (absolutePath.endsWith(ext)) {
                                isSource = true
                            }
                        })
                        if (isSource) {
                            this.addExistingSourceFile(absolutePath)
                        }
                    } else {
                        fs.readdirSync(absolutePath).forEach(subPath => {
                            search(join(absolutePath, subPath))
                        })
                    }
                }
			};
            include.forEach(relativePath => {
                const absolutePath = resolve(this.context.directory.path, relativePath)
                search(absolutePath)
            })

            // Determine which source files are entry points
            const basePath = this.config.rootDir
            this.config.entryPoints.forEach(entryPointName => {
                const entryPointPath = resolve(this.context.directory.path, basePath, entryPointName)
                let entrySource: SourceFile | undefined
                this.includedSourceFiles.forEach(source => {
                    if (entrySource) return;
                    if (relative(source.getFilePath(), entryPointPath) === "") {
                        entrySource = source
                    }
                })
                if (entrySource) {
                    this.entryPoints.push(entrySource)
                } else {
                    throw new CompilerError("File not found for entry point '" + entryPointName + "'", CompilerErrorType.BadMonolithConfig)
                }
            })
        }
        static getDefaultOptions(): ProjectConfigContainer {
            return {
                "outDir": "out",
                "rootDir": "src",
                "entryPoints": [
                    "server.lua",
                    "client.lua"
                ],
                "include": [
                    "."
                ],
                "obfuscate": false,
                "uglify": false
            }
        }
		getSourceFile(filePath: string): SourceFile | undefined {
            if (!this.includedSourcePaths.has(filePath)) return;
            const sourceFiles = this.getSourceFiles()
			for(const i in sourceFiles) {
                const source = sourceFiles[i]
                if (source.getFilePath() === filePath) {
                    return source
                }
            }
        }
        getRelativeSourceFile(source: SourceFile, filePath: string): SourceFile | undefined {
            // Check relative path
            const folderPath = resolve(resolve(source.getFilePath(), ".."), filePath)
            const relativeResource = this.getSourceFile(folderPath + ".lua") || this.getSourceFile(resolve(folderPath, "./init.lua"))
            if (relativeResource) {
                return relativeResource
            }

            // Check global path
            const globalPath = resolve(resolve(this.config.rootDir), filePath)
            const globalResource = this.getSourceFile(globalPath + ".lua") || this.getSourceFile(resolve(globalPath, "./init.lua"))
            if (globalResource) {
                return globalResource
            }

            return undefined
        }
		addExistingSourceFile(filePath: string): any {
            if (this.includedSourcePaths.has(filePath)) return;
            this.includedSourcePaths.add(filePath)
            this.includedSourceFiles.add(new SourceFile(this, filePath))
		}
		removeSourceFile(sourceFile: SourceFile): any {
            if (!this.includedSourceFiles.has(sourceFile)) return;
            this.includedSourcePaths.delete(sourceFile.getFilePath())
            this.includedSourceFiles.delete(sourceFile)
		}
        getCompilerOptions(): CompilerOptions {
            return this.config
        }
        getDirectory(relativePath: string): Directory | undefined {
            const absolutePath = resolve(this.context.directory.path, relativePath)
            if (fs.pathExistsSync(absolutePath)) {
                return new Directory(absolutePath)
            }
        }

        /**
         * Returns an array of all source files added to the project.
         */
        getSourceFiles(): SourceFile[] {
            return Array.from(this.includedSourceFiles)
        }
        /**
         * Returns an array of source files marked as entry points
         */
        getEntryPoints(): SourceFile[] {
            return this.entryPoints
        }
    }
}