import ParsedLua = require("../ParsedLua");

export = ExtendedLua
namespace ExtendedLua {
    export interface IdentifierConversion extends ParsedLua.NodeBase {
        type: "IdentifierConversion"
        from: string
        to: string
        inParens: boolean | null
    }
    export interface ImportStatement extends ParsedLua.NodeBase {
        type: 'ImportStatement'
        path: string
        identifiers: IdentifierConversion[]
    }
    export interface ExportStatement extends ParsedLua.NodeBase {
        type: 'ExportStatement',
        identifiers: IdentifierConversion[]
    }
    export type ExtendedExpressions = IdentifierConversion
    export type ExtendedStatements = ImportStatement | ExportStatement
    export type ExtendedNodes = ExtendedStatements | ExtendedExpressions

    export type Node = ParsedLua.Node | ExtendedNodes
    export type Statement = ParsedLua.Statement | ExtendedStatements
    export type Expression = ParsedLua.Expression | ExtendedExpressions
}