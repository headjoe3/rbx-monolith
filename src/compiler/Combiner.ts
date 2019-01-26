import { join } from "path";
import { pathExists } from "fs-extra";

export = Combiner
namespace Combiner {
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
			throw new Error("Method not implemented.");
		}
		getPath(): string {
			throw new Error("Method not implemented.");
		}
		isAncestorOf(sourceFile: SourceFile): any {
			throw new Error("Method not implemented.");
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
            throw "Not implemented"
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
        monolithConfigFilePath: string
    }
    export interface ProjectConfig {
        /** Compiler options */
        compilerOptions?: CompilerOptions
        /** File path to the monolithconfig.json file */
        monolithConfigFilePath: string
    }
    export class Project {
		getSourceFile(filePath: string): any {
			throw new Error("Method not implemented.");
		}
		addExistingSourceFile(filePath: string): any {
			throw new Error("Method not implemented.");
		}
		removeSourceFile(sourceFile: SourceFile): any {
			throw new Error("Method not implemented.");
		}
        private config: ProjectConfigContainer
        private context: {
            directory: Directory
        }
        static getDefaultOptions(): ProjectConfigContainer {
            return {
                monolithConfigFilePath: ".",
                compilerOptions: {
                    baseUrl: "/src",
                    rootDir: "/src",
                    outDir: "/out",
                },
            }
        }
        constructor(options: ProjectConfig) {
            // Override defaults
            const config = Project.getDefaultOptions()
            Object.assign(config, options)
            if (options.compilerOptions) Object.assign(config.compilerOptions, options.compilerOptions);

            this.config = config as ProjectConfigContainer
            this.context = {
                directory: new Directory(options.monolithConfigFilePath)
            }
        }
        addExistingSourceFiles(path: string) {

        }
        getCompilerOptions(): CompilerOptions {
            return this.config.compilerOptions
        }
        getDirectory(relativePath: string): Directory | undefined {
            if (pathExists(this.context.directory + relativePath)) {
                return new Directory(join(this.context.directory.path, relativePath))
            }
        }
        getSourceFiles(): SourceFile[] {
            throw "Not implemented yet"
        }
    }
}