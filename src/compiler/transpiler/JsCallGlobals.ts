import { SourceFile, ErrorNode } from "../Combiner";
import ParsedLua = require("../ParsedLua");
import { TranspilerError, TranspilerErrorType } from "../errors/TranspilerError";
import { posToLineCol, upperCamelCaseToPhrase } from "../utility";
import ExtendedLua = require("./ExtendedLua");
import Combiner = require("../Combiner");

export = JsCallGlobals
/** Name space of global 'js calls' which transpile  */
namespace JsCallGlobals {
    /** Reads an import path from a call expression on import */
    export function monolith_import(sourceFile: SourceFile, callNode: ParsedLua.Call): string {
        let importPath = ""
        if (ParsedLua.expect("CallExpression")(callNode)) {
            if (callNode.arguments.length === 1) {
                const arg1 = callNode.arguments[0]
                if (ParsedLua.expect("StringLiteral")(arg1)) {
                    importPath = arg1.value
                } else {
                    throw new TranspilerError(
                        `Invalid parameters for import (string literal expected, got ${upperCamelCaseToPhrase(arg1.type)})`,
                        new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                        TranspilerErrorType.ImportSyntaxError
                    )
                }
            } else {
                throw new TranspilerError(
                    `Invalid parameters for import (expected 1 argument, not ${callNode.arguments.length})`,
                    new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                    TranspilerErrorType.ImportSyntaxError
                )
            }
        } else if (ParsedLua.expect("StringCallExpression")(callNode)) {
            importPath = callNode.argument.value
        } else {
            throw new TranspilerError(
                "Invalid parameters for import (string expected, got table)",
                new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                TranspilerErrorType.ImportSyntaxError
            )
        }
        return importPath
    }
    export function monolith_export(sourceFile: SourceFile, callNode: ParsedLua.Call): ExtendedLua.IdentifierConversion[] {
        const identifiers: ExtendedLua.IdentifierConversion[] = []
        if (ParsedLua.expect("CallExpression")(callNode)) {
            if (callNode.arguments.length > 0) {
                callNode.arguments.forEach(expression => {
                    if (ParsedLua.expect("Identifier")(expression)) {
                        if (expression.isLocal) {
                            throw new TranspilerError(
                                `Export Error: attempt to export local identifier '${expression.name}'; exports must be global!`,
                                new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, expression.range[0])),
                                TranspilerErrorType.ExportError
                            )
                        }
                        identifiers.push({
                            type: "IdentifierConversion",
                            from: expression.name,
                            to: sourceFile.getMonolithicName(expression.name),
                            range: expression.range,
                            inParens: expression.inParens,
                        })
                    } else {
                        throw new TranspilerError(
                            `Invalid parameters for export (identifier expected, got ${upperCamelCaseToPhrase(expression.type)})`,
                            new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                            TranspilerErrorType.ImportSyntaxError
                        )
                    }
                })
            } else {
                throw new TranspilerError(
                    `Invalid parameters for export (expected at least 1 argument, got 0)`,
                    new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                    TranspilerErrorType.ImportSyntaxError
                )
            }
        } else {
            throw new TranspilerError(
                "Invalid parameters for export (expected normal call expression, got literal expression)",
                new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                TranspilerErrorType.ImportSyntaxError
            )
        }
        return identifiers
    }
}