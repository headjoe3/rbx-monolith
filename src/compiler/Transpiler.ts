import { Compiler } from "src/compiler/Compiler";
import { SourceFile } from "src/compiler/Combiner";

export default class Transpiler {
	transpileSourceFile(sourceFile: SourceFile): any {
		throw new Error("Method not implemented.");
	}
    constructor(compiler: Compiler) {

    }
}