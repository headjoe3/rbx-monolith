import * as ParsedLua from "../ParsedLua"

function formatExpression(ast: ParsedLua.Expression): string {
    switch(ast.type) {
        case "BinaryExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "BooleanLiteral":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "CallExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "ElseClause":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "ElseifClause":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "FunctionDeclaration":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "Identifier":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "IfClause":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "IndexExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "LogicalExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "MemberExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "NilLiteral":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "NumericLiteral":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "StringCallExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "StringLiteral":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "TableCallExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "TableConstructorExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "TableKey":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "TableKeyString":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "TableValue":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        case "UnaryExpression":
            throw new Error(`Expression type '${ast.type}' not implemented!`)
            return ""
        default:
            throw new Error(`Expression type '${(ast as ParsedLua.Expression).type}' not implemented!`)
    }
}

function formatStatement(ast: ParsedLua.Statement): string {
    throw new Error(`Statement type '${ast.type}' not implemented!`)
    return ""
}

function formatStatementsInBody(ast: ParsedLua.Statement[]): string {
    return ast.map(statement => formatStatement(statement)).join("\n")
}

export default function astToLua(ast: ParsedLua.HasBody): string {
    return formatStatementsInBody(ast.body)
}