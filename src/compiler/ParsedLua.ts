import * as luaparse from "luaparse"

interface NodeBase {
    /** The type of node */
    type: string
}
interface ExpressionBase extends NodeBase {
    /** True for expressions that are placed inside of parentheses */
    inparens?: boolean
}
/** Generalizes nodes whose strict type has not yet been proven in unit testing */
type ShouldBe<T> = T extends NodeBase ? T | NodeBase : any
type StatementBase = NodeBase
type NodeCheck<T extends NodeBase> = (value: NodeBase) => value is T

export = ParsedLua
namespace ParsedLua {


    /** Parsed Lua Expression types */
    export type Expression = Identifier | CallExpression | FunctionDeclarationExpression | MemberExpression | TableConstructorExpression | TableKeyString | TableKey
        | TableValue | IndexExpression | StringLiteral | NumericLiteral | BooleanLiteral
    export const ExpressionStringTypes = [
        "Identifier", "CallExpression", "FunctionDeclarationExpression", "MemberExpression", "TableConstructorExpression", "TableKeyString", "TableKey",
        "TableValue", "IndexExpression", "StringLiteral", "NumericLiteral", "BooleanLiteral"
    ]


    /** A variable name as a string index within the executing environment */
    export interface Identifier extends ExpressionBase {
        type: "Identifier"
        name: string
    }
    /** An expression that calls a function */
    export interface CallExpression extends ExpressionBase {
        type: "CallExpression"
        /** The function being called */
        base: ShouldBe<Identifier>
    }
    /** A union between function declaration statements and function declaration expressions. */
    export interface FunctionDeclaration extends ExpressionBase {
        type: "FunctionDeclaration"
        /** A variable associated with the function being declared. If the function is anonymous anonymous, the identifier is set to 'null' */
        identifier: ShouldBe<Identifier | MemberExpression | null>
        /** True if the function was declared as a local identifier */
        isLocal: boolean
        /** Identifiers for formal function parameters */
        parameters: ShouldBe<Identifier>[]
        /** The function's statements */
        body: ShouldBe<Statement>[]
    }
    /** A statement that declares a named function */
    export interface FunctionDeclarationStatement extends FunctionDeclaration {
        identifier: ShouldBe<Identifier | MemberExpression>
    }
    /** An expression that evaluates an anonymous function */
    export interface FunctionDeclarationExpression extends FunctionDeclaration {
        identifier: null
    }
    /** A table expression that evaluates a member at a table string index */
    export interface MemberExpression extends ExpressionBase {
        type: "MemberExpression"
        /** Whether the member was accessed as a method (':' call) or a normal variable */
        indexer: "." | ":"
        /** An expression that evaluates the member being accessed (in 'base.member') */
        identifier: ShouldBe<Identifier>
        /** An expression that evaluates the base identifier being accessed (in 'base.member') */
        base: ShouldBe<Expression>
    }
    /** An expression that evaluates to a newly constructed table */
    export interface TableConstructorExpression extends ExpressionBase {
        type: "TableConstructorExpression"
        /** A set of expressions that construct the table's contents */
        fields: ShouldBe<TableKeyString | TableValue>[]
    }
    /** A table constructor expression that sets a key (of any type) in a table using square brackets */
    export interface TableKey extends ExpressionBase {
        type: "TableKey"
        key: ShouldBe<Expression>
        value: ShouldBe<Expression>
    }
    /** A table constructor expression that adds an element to the next available number index of the table (starting at 1) */
    export interface TableValue extends ExpressionBase {
        type: "TableValue"
        value: ShouldBe<Expression>
    }
    /** A table constructor expression that sets a string identifier in a table (without square brackets) */
    export interface TableKeyString extends ExpressionBase {
        type: "TableKeyString"
        key: ShouldBe<Identifier>
        value: ShouldBe<Expression>
    }
    /** An expression that evaluates the value at some table index */
    export interface IndexExpression extends ExpressionBase {
        type: "IndexExpression"
        /** An expression that evaluates the index being accessed (in 'base[index]') */
        index: ShouldBe<Expression>
        /** An expression that evaluates the base identifier being accessed (in 'base[index]') */
        base: ShouldBe<Expression>
    }
    /** An expression that evaluates to a literal string */
    export interface StringLiteral extends ExpressionBase {
        type: "StringLiteral"
        /** The contents of the string */
        value: string
        /** The raw literal (in quotes) that was parsed */
        raw: string
    }
    /** An expression that evaluates to a literal number */
    export interface NumericLiteral extends ExpressionBase {
        type: "NumericLiteral"
        /** The numeric value of the literal */
        value: number
        /** The raw number (as a string) that was parsed */
        raw: string
    }
    /** An expression that evaluates to a literal boolean */
    export interface BooleanLiteral extends ExpressionBase {
        type: "BooleanLiteral"
        /** The boolean value of the literal */
        value: boolean
        /** The raw boolean (as a string) that was parsed */
        raw: string
    }
    /** A binary boolean-valued expression */
    export interface LogicalExpression extends ExpressionBase {
        type: "LogicalExpression",
        operator: 'and' | 'or' | 'not',
        left: ShouldBe<Expression>,
        right: ShouldBe<Expression>,
    }
    /** A binary number-valued (or metamethod-controlled) expression */
    export interface BinaryExpression extends ExpressionBase {
        type: "BinaryExpression",
        operator: '-' | '+' | '/' | "*" | "^" | "%" | ".." | "~=" | "==" | "<=" | ">=" | "<" | ">",
        left: ShouldBe<Expression>,
        right: ShouldBe<Expression>,
    }
    /** An operator expression on a single expression argument */
    export interface UnaryExpression extends ExpressionBase {
        type: "UnaryExpression",
        operator: '-' | '#',
        argument: ShouldBe<Expression>,
    }
    


    /** Parsed Lua Statement types */
    export type Statement = LocalStatement | CallStatement | AssignmentStatement | ReturnStatement | FunctionDeclarationStatement
    export const StatementStringTypes = [
        "LocalStatement", "CallStatement", "AssignmentStatement", "ReturnStatement", "FunctionDeclarationStatement"
    ]


    /** A statement that initializes a variable in a local conxt and assigns it */
    export interface LocalStatement extends StatementBase {
        type: "LocalStatement"
        variables: ShouldBe<Identifier>[]
        /** The expressions that evaluate the value of the localized variable */
        init: ShouldBe<Expression>[]
    }
    /** A statement that includes a single CallExpression and voids return parameters */
    export interface CallStatement extends StatementBase {
        type: "CallStatement"
        /** The expression being called in this statement */
        expression: ShouldBe<CallExpression>
    }
    /** A statement that assigns one or more identifiers to the values initialized in 'init' */
    export interface AssignmentStatement extends StatementBase {
        type: "AssignmentStatement"
        /** An array of expressions that evaluate the variables being assigned */
        variables: ShouldBe<Identifier | MemberExpression | IndexExpression>[]
        /** The expression resolving to the calculated values (as a tuple) */
        init: ShouldBe<Expression>[]
    }
    /** A statement that returns one or more values through expressions */
    export interface ReturnStatement extends StatementBase {
        type: "ReturnStatement"
        arguments: ShouldBe<Expression>[]
        /** A collection of all comments that were placed in the parsed lua chunk, without position information. */
        comments?: Comment[]
    }


    /** Other types */

    
    export interface Chunk extends NodeBase {
        type: "Chunk"
        body: Statement[]
    }
    /** Comments are not attached to any node when parsed, so they are all grouped together in the chunk return statement' comments */
    export interface Comment extends NodeBase {
        type: "Comment"
        /** The string contents of the comment */
        value: string
        /** The raw comment expression */
        raw: string
    }

    export type Node = Chunk | Comment | Statement | Expression
    export type NodeInterfaceType = "Node" | "Statement" | "Expression" | Expression["type"] | Statement["type"] | Chunk["type"] | Comment["type"]

    export function parse(code: string, options?: Object): Chunk {
        return luaparse.parse(code, options) as Chunk
    }

    // Union types
    export function expect(nodeType: "Node"): NodeCheck<Node>
    export function expect(nodeType: "Statement"): NodeCheck<Statement>
    export function expect(nodeType: "Expression"): NodeCheck<Expression>
    export function expect(nodeType: "FunctionDeclaration"): NodeCheck<FunctionDeclaration>

    // Other types
    export function expect(nodeType: "Chunk"): NodeCheck<Chunk>
    export function expect(nodeType: "Comment"): NodeCheck<Comment>

    // Expressions
    export function expect(nodeType: "Identifier"): NodeCheck<Identifier>
    export function expect(nodeType: "CallExpression"): NodeCheck<CallExpression>
    export function expect(nodeType: "FunctionDeclarationExpression"): NodeCheck<FunctionDeclarationExpression>
    export function expect(nodeType: "MemberExpression"): NodeCheck<MemberExpression>
    export function expect(nodeType: "TableConstructorExpression"): NodeCheck<TableConstructorExpression>
    export function expect(nodeType: "TableKeyString"): NodeCheck<TableKeyString>
    export function expect(nodeType: "TableKey"): NodeCheck<TableKey>
    export function expect(nodeType: "TableValue"): NodeCheck<TableValue>

    export function expect(nodeType: "IndexExpression"): NodeCheck<IndexExpression>
    export function expect(nodeType: "LogicalExpression"): NodeCheck<LogicalExpression>
    export function expect(nodeType: "UnaryExpression"): NodeCheck<UnaryExpression>
    export function expect(nodeType: "BinaryExpression"): NodeCheck<BinaryExpression>
    
    export function expect(nodeType: "StringLiteral"): NodeCheck<StringLiteral>
    export function expect(nodeType: "NumericLiteral"): NodeCheck<NumericLiteral>
    export function expect(nodeType: "BooleanLiteral"): NodeCheck<BooleanLiteral>

    // Statement types
    export function expect(nodeType: "FunctionDeclarationStatement"): NodeCheck<FunctionDeclarationStatement>
    export function expect(nodeType: "LocalStatement"): NodeCheck<LocalStatement>
    export function expect(nodeType: "CallStatement"): NodeCheck<CallStatement>
    export function expect(nodeType: "AssignmentStatement"): NodeCheck<AssignmentStatement>
    export function expect(nodeType: "ReturnStatement"): NodeCheck<ReturnStatement>
    /**
     * Runtime type checker for node types based on their string "type" name
     * 
     * e.g. ParsedLua.expect("Expression")(myNode)
     */
    export function expect<T extends NodeBase>(nodeType: string): NodeCheck<T> {
        return ((node: NodeBase) => {
            // Abstract interfaces
            if (nodeType === "Node") return true;
            if (nodeType === "Expression") {
                for (const i in ExpressionStringTypes) {
                    const type = ExpressionStringTypes[i]
                    if (expect(type as "Expression")(node)) return true;
                }
                return false;
            }
            if (nodeType === "Statement") {
                for (const i in StatementStringTypes) {
                    const type = StatementStringTypes[i]
                    if (expect(type as "Statement")(node)) return true;
                }
                return false;
            }
            
            // Distinguish function declaration statements from function declaration expressions
            if (nodeType === "FunctionDeclarationStatement") {
                return node.type === "FunctionDeclaration" && (node as FunctionDeclaration).identifier !== null;
            }
            if (nodeType === "FunctionDeclarationExpression") {
                return node.type === "FunctionDeclaration" && (node as FunctionDeclaration).identifier === null;
            }

            // Default
            return node.type === nodeType
        }) as unknown as NodeCheck<T>
    }
}