import Combiner = require("../Combiner");

export enum TranspilerErrorType {
	SyntaxError,
	ImportSyntaxError,
	ImportError,
	ExportSyntaxError,
	ExportError
}

export class TranspilerError extends Error {
	constructor(message: string, public readonly node: Combiner.ErrorNode, public readonly type: TranspilerErrorType) {
		super(message);
	}
}