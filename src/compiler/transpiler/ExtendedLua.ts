import ParsedLua = require("../ParsedLua");

type NodeCheck<T extends ParsedLua.NodeBase> = (value: unknown) => value is T

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
        identifiers: ParsedLua.Identifier[]
        importAll: boolean
    }
    export interface ExportStatement extends ParsedLua.NodeBase {
        type: 'ExportStatement',
        identifiers: IdentifierConversion[]
        assignments: ExtendedAssignmentStatement[]
    }
    export interface NamespaceStatement extends ParsedLua.NodeBase {
        type: "NamespaceStatement",
        identifiers: IdentifierConversion[]
        assignments: ExtendedAssignmentStatement[]
        qualifier: ParsedLua.Identifier | IdentifierConversion
    }
    export interface NamespaceConstructor extends ParsedLua.NodeBase {
        type: "NamespaceConstructor",
        identifiers: ParsedLua.Identifier[]
        init: ExtendedLua.Expression[]
    }
    export interface ExtendedAssignmentStatement extends ParsedLua.NodeBase {
        type: 'ExtendedAssignmentStatement',
        variables: (ExtendedLua.IdentifierConversion | ParsedLua.AssignmentStatement["variables"][number])[]
        init: Expression[]
    }
    export type ExtendedExpressions = IdentifierConversion
    export type ExtendedStatements = ImportStatement | ExportStatement | ExtendedAssignmentStatement | NamespaceConstructor | NamespaceStatement
    export type ExtendedNodes = ExtendedStatements | ExtendedExpressions

    export type Node = ParsedLua.Node | ExtendedNodes
    export type Statement = ParsedLua.Statement | ExtendedStatements
    export type Expression = ParsedLua.Expression | ExtendedExpressions

    export function expect(nodeType: "IdentifierConversion"): NodeCheck<IdentifierConversion>
    export function expect(nodeType: "ImportStatement"): NodeCheck<ImportStatement>
    export function expect(nodeType: "ExportStatement"): NodeCheck<ExportStatement>
    export function expect(nodeType: "ExtendedAssignmentStatement"): NodeCheck<ExtendedAssignmentStatement>
    export function expect(nodeType: "NamespaceConstructor"): NodeCheck<NamespaceConstructor>
    export function expect<T extends ParsedLua.NodeBase>(nodeType: string): NodeCheck<T> {
        return ((value: unknown) => {
            if (!value || !(typeof value === "object") || value === null || !((value as ParsedLua.NodeBase).type)) return;
            const node = value as ParsedLua.NodeBase
            
            // Default
            return ParsedLua.expect(nodeType as "Node")(node)
        }) as unknown as NodeCheck<T>
    }
}