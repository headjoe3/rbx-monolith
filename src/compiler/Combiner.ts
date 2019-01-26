import { join, relative, dirname } from "path";
import { CompilerError, CompilerErrorType } from "./errors/CompilerError";
import * as fs from "fs-extra"

export = Combiner
namespace Combiner {
    export const SourceFileExtensions = [
        ".lua",
        ".monolith"
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
		getPath(): string {
			throw new Error("Method not implemented.");
		}
		isAncestorOf(sourceFile: SourceFile): any {
			return !relative(this.path, sourceFile.getFilePath()).startsWith("..")
		}
        constructor(public readonly path: string) {

        }
    }
    export type CompilerOptions = {
        baseUrl: string
        rootDir: string
        outDir: string
    }
    export class SourceFile {
        private path: string
        constructor(path: string) {
            this.path = path 
        }
		getBaseName(): string {
			throw new Error("Method not implemented.");
		}
		getPreEmitDiagnostics(): Diagnostic[] {
			throw new Error("Method not implemented.");
		}
		refreshFromFileSystem(): any {
			throw new Error("Method not implemented.");
		}
        getFilePath(): string {
            return this.path
        }
        getReferencingSourceFiles(): SourceFile[] {
            throw "Not implemented"
        }
    }
    export class Node {
		getStartLinePos(): any {
			throw new Error("Method not implemented.");
		}
		getNonWhitespaceStart(): any {
			throw new Error("Method not implemented.");
		}
		getStartLineNumber(): any {
			throw new Error("Method not implemented.");
		}
		getSourceFile(): any {
			throw new Error("Method not implemented.");
		}
    }

    // Project

    
    interface ProjectConfigContainer {
        compilerOptions: CompilerOptions
        include: string[]
    }
    export interface ProjectConfig {
        /** File path to the monolithconfig.json file */
        monolithConfigFilePath: string
    }
    export class Project {
        private config: ProjectConfigContainer
        private context: {
            directory: Directory
        }
        private includedSourceFiles: Set<SourceFile>
        private includedSourcePaths: Set<string>
        constructor(options: ProjectConfig) {
            // Override defaults with config file
            const config = Project.getDefaultOptions()

            // Read config file
            const configObject = fs.readJSONSync(options.monolithConfigFilePath)
            if (!configObject || typeof configObject !== "object") {
                throw new CompilerError("monolithconfig.json did not return a valid object", CompilerErrorType.BadMonolithConfig)
            }
            Object.assign(config, configObject)

            // Override nested options
            if (configObject.compilerOptions) Object.assign(config.compilerOptions, configObject.compilerOptions);
            if (configObject.include) Object.assign(config.include, configObject.include);

            this.config = config as ProjectConfigContainer
            this.context = {
                directory: new Directory(dirname(options.monolithConfigFilePath))
            }

            // Search for source files
            this.includedSourceFiles = new Set()
            this.includedSourcePaths = new Set()
            const include = this.config.include
			const search = (absolutePath: string) => {
                if (fs.existsSync(absolutePath)) {
                    const stats = fs.lstatSync(absolutePath)
                    if (stats.isFile()) {
                        SourceFileExtensions.forEach(ext => {
                            if (absolutePath.endsWith(ext)) {
                                this.addExistingSourceFile(absolutePath)
                            }
                        })
                    } else {
                        fs.readdirSync(absolutePath).forEach(subPath => {
                            search(subPath)
                        })
                    }
                }
			};
            include.forEach(relativePath => {
                const absolutePath = join(this.context.directory.path, relativePath)
                search(absolutePath)
            })
        }
        static getDefaultOptions(): ProjectConfigContainer {
            return {
                compilerOptions: {
                    baseUrl: "/src",
                    rootDir: "/src",
                    outDir: "/out",
                },
                include: [
                    "."
                ]
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
		addExistingSourceFile(filePath: string): any {
            if (this.includedSourcePaths.has(filePath)) return;
            this.includedSourcePaths.add(filePath)
            this.includedSourceFiles.add(new SourceFile(filePath))
		}
		removeSourceFile(sourceFile: SourceFile): any {
            if (!this.includedSourceFiles.has(sourceFile)) return;
            this.includedSourcePaths.delete(sourceFile.getFilePath())
            this.includedSourceFiles.delete(sourceFile)
		}
        getCompilerOptions(): CompilerOptions {
            return this.config.compilerOptions
        }
        getDirectory(relativePath: string): Directory | undefined {
            const absolutePath = join(this.context.directory.path + relativePath)
            console.log(this.context.directory, absolutePath)
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
    }
}