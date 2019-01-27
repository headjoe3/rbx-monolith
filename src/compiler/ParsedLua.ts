import * as luaparse from "luaparse"

/** Optional arguments for the lua parser */
interface ParseOptions {
    /** (false by default) Explicitly tell the parser when the input ends. */
    wait?: boolean
    /** (true by default) Store comments as an array in the chunk object. */
    comments?: boolean
    /** (false by default) Track identifier scopes. */
    scope?: boolean
    /** (false by default) Store location information on each syntax node. */
    locations?: boolean
    /** (false by default) Store the start and end character locations on each syntax node. */
    ranges?: boolean
    /** (null by default) A callback which will be invoked when a syntax node has been completed. The node which has been created will be passed as the only parameter. */
    onCreateNode?: (node: ParsedLua.Node) => void
    /** (null by default) A callback which will be invoked when a new scope is created. */
    onCreateScope?: () => void 
    /** (null by default) A callback which will be invoked when the current scope is destroyed. */
    onDestroyScope?: () => void 
    /** (null by default) A callback which will be invoked when a local variable is declared. The identifier will be passed as the only parameter. */
    onLocalDeclaration?: (identifier: ParsedLua.Identifier) => void
    /** ('5.1' by default) The version of Lua the parser will target; supported values are '5.1', '5.2', '5.3' and 'LuaJIT'. */
    luaVersion?: string
    /** (false by default) Whether to allow code points ≥ U+0080 in identifiers, like LuaJIT does. See 'Note on character encodings' below if you wish to use this option. Note: setting luaVersion: 'LuaJIT' currently does not enable this option; this may change in the future. */
    extendedIdentifiers?: boolean
}

interface NodeBase {
    /** The type of node */
    type: string
}
interface ExpressionBase extends NodeBase {
    /** True for expressions that are placed inside of parentheses */
    inparens?: boolean
}


/** A temporary marker that generalizes nodes whose strict type has not yet been proven in unit testing */
type ShouldBe<T, CouldBe = NodeBase> = T extends NodeBase ? T | CouldBe : any

type StatementBase = NodeBase
/** A type checker for some node type */
type NodeCheck<T extends NodeBase> = (value: unknown) => value is T

export = ParsedLua
namespace ParsedLua {


    /** Parsed Lua Expression types */
    export type Expression = Identifier | FunctionDeclarationExpression | MemberExpression | TableConstructorExpression | TableKeyString | TableKey
        | TableValue | IndexExpression | StringLiteral | NumericLiteral | BooleanLiteral | Clause | LogicalExpression | BinaryExpression | UnaryExpression
        | Call | NilLiteral
    export const ExpressionStringTypes = [
        "Identifier", "FunctionDeclarationExpression", "MemberExpression", "TableConstructorExpression", "TableKeyString", "TableKey",
        "TableValue", "IndexExpression", "StringLiteral", "NumericLiteral", "BooleanLiteral", "Clause", "LogicalExpression",
        "BinaryExpression", "UnaryExpression", "Call", "NilLiteral"
    ]


    /** A variable name as a string index within the executing environment */
    export interface Identifier extends ExpressionBase {
        type: "Identifier"
        name: string
    }
    /** A union between function declaration statements and function declaration expressions. */
    export interface FunctionDeclaration extends ExpressionBase {
        type: "FunctionDeclaration"
        /** A variable associated with the function being declared. If the function is anonymous anonymous, the identifier is set to 'null' */
        identifier: Identifier | MemberExpression | null
        /** True if the function was declared as a local identifier */
        isLocal: boolean
        /** Identifiers for formal function parameters */
        parameters: Identifier[]
        /** The function's statements */
        body: Statement[]
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
        identifier: Identifier
        /** An expression that evaluates the base identifier being accessed (in 'base.member') */
        base: Expression
    }
    /** An expression that evaluates to a newly constructed table */
    export interface TableConstructorExpression extends ExpressionBase {
        type: "TableConstructorExpression"
        /** A set of expressions that construct the table's contents */
        fields?: (TableKeyString | TableValue | TableKey)[]
    }
    /** A table constructor expression that sets a key (of any type) in a table using square brackets */
    export interface TableKey extends ExpressionBase {
        type: "TableKey"
        key: Expression
        value: Expression
    }
    /** A table constructor expression that adds an element to the next available number index of the table (starting at 1) */
    export interface TableValue extends ExpressionBase {
        type: "TableValue"
        value: Expression
    }
    /** A table constructor expression that sets a string identifier in a table (without square brackets) */
    export interface TableKeyString extends ExpressionBase {
        type: "TableKeyString"
        key: Identifier
        value: Expression
    }
    /** An expression that evaluates the value at some table index */
    export interface IndexExpression extends ExpressionBase {
        type: "IndexExpression"
        /** An expression that evaluates the index being accessed (in 'base[index]') */
        index: Expression
        /** An expression that evaluates the base identifier being accessed (in 'base[index]') */
        base: Expression
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
    /** An expression that evaluates to a literal boolean */
    export interface NilLiteral extends ExpressionBase {
        type: "NilLiteral"
        /** The value of the literal (should always be null) */
        value: null
        /** The raw value (as a string) that was parsed */
        raw: string
    }
    /** A binary boolean-valued expression */
    export interface LogicalExpression extends ExpressionBase {
        type: "LogicalExpression",
        operator: 'and' | 'or' | 'not',
        left: Expression,
        right: Expression,
    }
    /** A binary number-valued (or metamethod-controlled) expression */
    export interface BinaryExpression extends ExpressionBase {
        type: "BinaryExpression",
        operator: '-' | '+' | '/' | "*" | "^" | "%" | ".." | "~=" | "==" | "<=" | ">=" | "<" | ">",
        left: Expression,
        right: Expression,
    }
    /** An operator expression on a single expression argument */
    export interface UnaryExpression extends ExpressionBase {
        type: "UnaryExpression",
        operator: '-' | '#',
        argument: Expression,
    }

    

    /** Union of call expression types */
    export type Call = CallExpression | TableCallExpression | StringCallExpression
    export const CallStringTypes = [
        "CallExpression", "TableCallExpression", "StringCallExpression"
    ]


    /** A base type of expression that calls a function */
    export interface CallExpressionBase extends ExpressionBase {
        /** An expression evaluating the function that should being called */
        base: Expression
    }
    /** An expression that calls a function */
    export interface CallExpression extends CallExpressionBase {
        type: "CallExpression"
        /** The actual parameters passed into the function call */
        arguments: Expression[]
    }
    /** An expression that passes a single table literal into a function (' myFunction {} ') */
    export interface TableCallExpression extends CallExpressionBase {
        type: "TableCallExpression"
        arguments: TableConstructorExpression
    }
    /** An expression that passes a single string literal into a function (' print "Hello, World!" ') */
    export interface StringCallExpression extends CallExpressionBase {
        type: "StringCallExpression"
        argument: StringLiteral
    }
    


    /** Parsed Lua Statement types */
    export type Statement = LocalStatement | CallStatement | AssignmentStatement | ReturnStatement | FunctionDeclarationStatement | DoStatement | IfStatement
        | ForGenericStatement | ForNumericStatement | WhileStatement | RepeatStatement
    export const StatementStringTypes = [
        "LocalStatement", "CallStatement", "AssignmentStatement", "ReturnStatement", "FunctionDeclarationStatement", "DoStatement", "IfStatement",
        "ForGenericStatement", "ForNumericStatement", "WhileStatement", "RepeatStatement"
    ]


    /** A statement that initializes a variable in a local conxt and assigns it */
    export interface LocalStatement extends StatementBase {
        type: "LocalStatement"
        variables: Identifier[]
        /** The expressions that evaluate the value of the localized variable */
        init: Expression[]
    }
    /** A statement that includes a single call expression (one of the types extending CallExpressionBase) and voids return parameters */
    export interface CallStatement extends StatementBase {
        type: "CallStatement"
        /** The expression being called in this statement */
        expression: Call
    }
    /** A statement that assigns one or more identifiers to the values initialized in 'init' */
    export interface AssignmentStatement extends StatementBase {
        type: "AssignmentStatement"
        /** An array of expressions that evaluate the variables being assigned */
        variables: (Identifier | MemberExpression | IndexExpression)[]
        /** The expression resolving to the calculated values (as a tuple) */
        init: Expression[]
    }
    /** A statement that returns one or more values through expressions */
    export interface ReturnStatement extends StatementBase {
        type: "ReturnStatement"
        arguments: Expression[]
    }
    /** A statement that declares a named function */
    export interface FunctionDeclarationStatement extends FunctionDeclaration {
        identifier: Identifier | MemberExpression
    }
    /** A statement that scopes the contained body */
    export interface DoStatement extends StatementBase {
        type: "DoStatement"
        body: Statement[]
    }
    /** A conditional statement to execute a clause body if one clause condition is met */
    export interface IfStatement extends StatementBase {
        type: "IfStatement"
        clauses: Clause
    }
    export interface ForGenericStatement extends StatementBase {
        type: "ForGenericStatement"
        variables: ShouldBe<Identifier>[]
        iterators: ShouldBe<CallExpression>[]
        body: Statement[]
    }
    export interface ForNumericStatement extends StatementBase {
        type: "ForNumericStatement"
        variable: ShouldBe<Identifier>
        /** An expression that evaluates to the number at which the for loop should start */
        start: ShouldBe<Expression>
        /** An expression that evaluates to the number at which the for loop should end */
        end: ShouldBe<Expression>
        /** An expression that evaluates to the number for which the loop should increment after each step*/
        step: ShouldBe<Expression>
        body: Statement[]
    }
    export interface WhileStatement extends StatementBase {
        type: "WhileStatement"
        condition: Expression
        body: Statement[]
    }
    export interface RepeatStatement extends StatementBase {
        type: "RepeatStatement"
        condition: Expression
        body: Statement[]
    }



    /** If statement clause  types */
    export type Clause = IfClause | ElseClause | ElseifClause
    export const ClauseStringTypes = [
        "IfClause", "ElseClause", "ElseifClause"
    ]
    /** A clause which begins an If statement, and evaluates a condition, executing its body if the condition is truthy */
    export interface IfClause extends StatementBase {
        type: "IfClause"
        condition: Expression
        body: Statement[]
    }
    /** A clause which continues an If statement, and evaluates a condition, executing its body if the condition is truthy */
    export interface ElseifClause extends StatementBase {
        type: "ElseifClause"
        condition: Expression
        body: Statement[]
    }
    /** The last clause in an if statement, which will execute if the other clause's conditions were not met */
    export interface ElseClause extends StatementBase {
        type: "ElseClause"
        body: Statement[]
    }


    /** Other types */

    
    export interface Chunk extends NodeBase {
        type: "Chunk"
        body: Statement[]
        /** A collection of all comments that were placed in the parsed lua chunk, without position information. */
        comments: Comment[]
    }
    /** Comments are not attached to any node when parsed, so they are all grouped together in the chunk return statement' comments */
    export interface Comment extends NodeBase {
        type: "Comment"
        /** The string contents of the comment */
        value: string
        /** The raw comment expression */
        raw: string
    }

    /** Types of statements/expressions which contain a body of nested statements */
    export type HasBody = Chunk | Clause | RepeatStatement | WhileStatement | ForGenericStatement | ForNumericStatement | DoStatement | FunctionDeclaration
    export const HasBodyStringTypes = [
        "Chunk", "Clause", "RepeatStatement", "WhileStatement", "ForGenericStatement", "ForNumericStatement", "DoStatement", "FunctionDeclaration"
    ]

    export type Node = Chunk | Comment | Statement | Expression | Clause
    export type NodeInterfaceType = "Node" | "Statement" | "Expression" | "Clause" | Expression["type"] | Statement["type"] | Chunk["type"] | Comment["type"]

    export function parse(code: string, options?: ParseOptions): Chunk {
        return luaparse.parse(code, options) as Chunk
    }

    // Union types
    export function expect(nodeType: "Node"): NodeCheck<Node>
    export function expect(nodeType: "Statement"): NodeCheck<Statement>
    export function expect(nodeType: "Expression"): NodeCheck<Expression>
    export function expect(nodeType: "Clause"): NodeCheck<Clause>
    export function expect(nodeType: "FunctionDeclaration"): NodeCheck<FunctionDeclaration>
    export function expect(nodeType: "Call"): NodeCheck<Call>
    export function expect(nodeType: "HasBody"): NodeCheck<HasBody>

    // Other types
    export function expect(nodeType: "Chunk"): NodeCheck<Chunk>
    export function expect(nodeType: "Comment"): NodeCheck<Comment>

    // Expressions
    export function expect(nodeType: "Identifier"): NodeCheck<Identifier>
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
    export function expect(nodeType: "NilLiteral"): NodeCheck<NilLiteral>

    // Statement types
    export function expect(nodeType: "FunctionDeclarationStatement"): NodeCheck<FunctionDeclarationStatement>
    export function expect(nodeType: "LocalStatement"): NodeCheck<LocalStatement>
    export function expect(nodeType: "CallStatement"): NodeCheck<CallStatement>
    export function expect(nodeType: "AssignmentStatement"): NodeCheck<AssignmentStatement>
    export function expect(nodeType: "ReturnStatement"): NodeCheck<ReturnStatement>
    export function expect(nodeType: "DoStatement"): NodeCheck<DoStatement>
    export function expect(nodeType: "IfStatement"): NodeCheck<IfStatement>
    export function expect(nodeType: "ForGenericStatement"): NodeCheck<ForGenericStatement>
    export function expect(nodeType: "ForNumericStatement"): NodeCheck<ForNumericStatement>
    export function expect(nodeType: "WhileStatement"): NodeCheck<WhileStatement>
    export function expect(nodeType: "RepeatStatement"): NodeCheck<RepeatStatement>

    // Clause types
    export function expect(nodeType: "IfClause"): NodeCheck<IfClause>
    export function expect(nodeType: "ElseifClause"): NodeCheck<ElseifClause>
    export function expect(nodeType: "ElseClause"): NodeCheck<ElseClause>
    
    // Call expression types
    export function expect(nodeType: "CallExpression"): NodeCheck<CallExpression>
    export function expect(nodeType: "TableCallExpression"): NodeCheck<TableCallExpression>
    export function expect(nodeType: "StringCallExpression"): NodeCheck<StringCallExpression>
    /**
     * Returns a runtime type checker for a given node type based on its string "type" name or abstract class
     * 
     * e.g. ParsedLua.expect("Expression")(myNode)
     */
    export function expect<T extends NodeBase>(nodeType: string): NodeCheck<T> {
        /** Returns true if an unknown value is of a certain syntax node type */
        return ((value: unknown) => {
            if (!value || !(typeof value === "object") || value === null || !((value as NodeBase).type)) return;
            const node = value as NodeBase

            // Union interfaces
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
            if (nodeType === "Clause") {
                for (const i in ClauseStringTypes) {
                    const type = ClauseStringTypes[i]
                    if (expect(type as "Clause")(node)) return true;
                }
                return false;
            }
            if (nodeType === "Call") {
                for (const i in CallStringTypes) {
                    const type = CallStringTypes[i]
                    if (expect(type as "Call")(node)) return true;
                }
                return false;
            }
            if (nodeType === "HasBody") {
                for (const i in HasBodyStringTypes) {
                    const type = HasBodyStringTypes[i]
                    if (expect(type as "HasBody")(node)) return true;
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