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
    function monolith_export_table_identifiers(sourceFile: SourceFile, constructorNode: ParsedLua.TableConstructorExpression):
        [ExtendedLua.IdentifierConversion[], ExtendedLua.ExtendedAssignmentStatement[]] {
        const identifiers: ExtendedLua.IdentifierConversion[] = []
        const assignments: ExtendedLua.ExtendedAssignmentStatement[] = []
        constructorNode.fields.forEach(field => {
            switch (field.type) {
                case "TableKeyString":
                    identifiers.push({
                        type: "IdentifierConversion",
                        from: field.key.name,
                        to: sourceFile.getMonolithicName(field.key.name),
                        range: field.range,
                        inParens: field.inParens
                    })
                    assignments.push({
                        type: "ExtendedAssignmentStatement",
                        variables: [identifiers[identifiers.length - 1]],
                        init: [field.value],
                        range: field.range
                    })
                    break
                case "TableValue":
                    if (ParsedLua.expect("Identifier")(field.value)) {
                        identifiers.push({
                            type: "IdentifierConversion",
                            from: field.value.name,
                            to: sourceFile.getMonolithicName(field.value.name),
                            range: field.range,
                            inParens: field.inParens
                        })
                        assignments.push({
                            type: "ExtendedAssignmentStatement",
                            variables: [identifiers[identifiers.length - 1]],
                            init: [field.value],
                            range: field.range
                        })
                    } else {
                        throw new TranspilerError(
                            "Attempt to export invalid expression (identifier expected, got '" + upperCamelCaseToPhrase(field.value.type) + "')",
                            new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, field.range[0])),
                            TranspilerErrorType.ExportError
                        )
                    }
                    break
                case "TableKey":
                    if (ParsedLua.expect("StringLiteral")(field.key)) {
                        assignments.push({
                            type: "ExtendedAssignmentStatement",
                            variables: [identifiers[identifiers.length - 1]],
                            init: [field.value],
                            range: field.range
                        })
                    } else {
                        throw new TranspilerError(
                            "Attempt to export invalid key expression (string literal expected, got '" + upperCamelCaseToPhrase(field.key.type) + "')",
                            new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, field.range[0])),
                            TranspilerErrorType.ExportError
                        )
                    }
                    break
            }
        })
        return [identifiers, assignments]
    }
    export function monolith_export(sourceFile: SourceFile, callNode: ParsedLua.Call): [ExtendedLua.IdentifierConversion[], ExtendedLua.ExtendedAssignmentStatement[]] {
        const identifiers: ExtendedLua.IdentifierConversion[] = []
        if (ParsedLua.expect("CallExpression")(callNode)) {
            if (callNode.arguments.length > 0) {
                const firstArg = callNode.arguments[0]
                if (firstArg.type === "TableConstructorExpression") {
                    return monolith_export_table_identifiers(sourceFile, firstArg)
                } else {
                    callNode.arguments.forEach(expression => {
                        if (ParsedLua.expect("Identifier")(expression)) {
                            if (expression.isLocal) {
                                throw new TranspilerError(
                                    `Attempt to export local identifier '${expression.name}'; Exports must be global!`,
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
                }
            } else {
                throw new TranspilerError(
                    `Invalid parameters for export (expected at least 1 argument, got 0)`,
                    new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                    TranspilerErrorType.ImportSyntaxError
                )
            }
        } else if (ParsedLua.expect("TableCallExpression")(callNode)) {
            return monolith_export_table_identifiers(sourceFile, callNode.arguments)
        } else {
            throw new TranspilerError(
                "Invalid parameters for export (expected normal call expression, got literal expression)",
                new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                TranspilerErrorType.ImportSyntaxError
            )
        }
        return [identifiers, []]
    }
    export function monolith_namespace(sourceFile: SourceFile, callNode: ParsedLua.Call, stack: ExtendedLua.Node[]): [ParsedLua.Identifier[], ExtendedLua.Expression[]] {
        let argument: ParsedLua.TableConstructorExpression
        if (ParsedLua.expect("CallExpression")(callNode)) {
            if (callNode.arguments.length === 1) {
                const firstArg = callNode.arguments[0]
                if (firstArg.type === "TableConstructorExpression") {
                    argument = firstArg
                } else {
                    throw new TranspilerError(
                        `Invalid argument for namespace (table expected, got ${upperCamelCaseToPhrase(firstArg.type)})`,
                        new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                        TranspilerErrorType.ImportSyntaxError
                    )
                }
            } else {
                throw new TranspilerError(
                    `Invalid parameters for namespace (expected 1 argument, got ${callNode.arguments.length})`,
                    new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                    TranspilerErrorType.ImportSyntaxError
                )
            }
        } else if (ParsedLua.expect("TableCallExpression")(callNode)) {
            argument = callNode.arguments
        } else {
            throw new TranspilerError(
                "Invalid parameters for namespace (expected table call expression, got string literal expression)",
                new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                TranspilerErrorType.ImportSyntaxError
            )
        }
        // Format identifiers in namespace
        const identifiers: ParsedLua.Identifier[] = []
        const init: ExtendedLua.Expression[] = []
        let hasNames = new Set<string>()

        const checkDuplicates = (name: string, debugNode?: ExtendedLua.Node) => {
            if (hasNames.has(name)) {
                throw new TranspilerError(
                    "Duplicated identifier '" + name + "' found when constructing namespace",
                    new ErrorNode(sourceFile, ...posToLineCol(sourceFile, (debugNode || callNode).range[0])),
                    TranspilerErrorType.ImportSyntaxError
                )
            } else {
                hasNames.add(name)
            }
        }

        // Read identifiers/assignments from table constructor
        argument.fields.forEach(field => {
            switch (field.type) {
                case "TableKey":
                    if (ParsedLua.expect("StringLiteral")(field.key)) {
                        // construct identifier from string literal
                        if (!field.key.value.match(/^[0-9a-z_]+$/)) {
                            throw new TranspilerError(
                                `Invalid field in namespace constructor ('${field.key.value}' is not a valid lua identifier!)`,
                                new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                                TranspilerErrorType.NamespaceSyntaxError
                            )
                        } else {
                            checkDuplicates(field.key.value, field.key)
                            identifiers.push({
                                type: "Identifier",
                                name: field.key.value,
                                range: field.key.range,
                                isLocal: false,
                                inParens: false,
                            })
                            init.push(field.value)
                        }
                    } else {
                        throw new TranspilerError(
                            `Invalid field in namespace constructor (string literal expected, got ${field.key.type})`,
                            new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                            TranspilerErrorType.NamespaceSyntaxError
                        )
                    }
                    break
                case "TableKeyString":
                    checkDuplicates(field.key.name, field.key)
                    identifiers.push(field.key)
                    init.push(field.value)
                    break
                case "TableValue":
                    if (ParsedLua.expect("Identifier")(field.value)) {
                        checkDuplicates(field.value.name, field.value)
                        identifiers.push(field.value)
                        init.push(field.value)
                    } else {
                        throw new TranspilerError(
                            `Invalid field in namespace constructor (identifier expected, got ${field.value.type})`,
                            new ErrorNode(sourceFile, ...posToLineCol(sourceFile, callNode.range[0])),
                            TranspilerErrorType.NamespaceSyntaxError
                        )
                    }
                    break
            }
        })
        
        return [identifiers, init]
    }
}