import * as ParsedLua from "../ParsedLua"
import ExtendedLua = require("./ExtendedLua");
import { logAST } from "../Transpiler";

// Lulllll tabs vs spaces flame war
const INDENTATION = "     "
/** Length of constructor or call strings before each argument is separated on a new line */
const LENGTH_BEFORE_NEWLINES = 60

/*
function escapeChar(charToEscape: string, str: string): string {
    let output = ""
    for(let i = 0; i < str.length; i++) {
        const char = str[i]
        if (char === charToEscape) {
            output = output + "\\"
        }
        output = output + char
    }
    return output
}
*/

function wrapInParensIf(str: string, isInParens: boolean | null): string {
    return (isInParens === true)
        ? ('(' + str + ')')
        : str
}

function formatExpression(ast: ExtendedLua.Expression, indentation: number, ugly: boolean): string {
    let expression: string

    let prefix = ugly ? '' : INDENTATION.repeat(indentation)
    let parsedVariable: string
    let parsedActualParameters: string
    let parsedFormalParameters: string
    let parsedIndex: string
    let parsedValue: string
    let inOneLine: string
    switch(ast.type) {
        case "LogicalExpression":
        case "BinaryExpression":
            expression = formatExpression(ast.left, indentation, ugly) + " " + ast.operator + " " + formatExpression(ast.right, indentation, ugly)
            break
        case "BooleanLiteral":
            if (ast.value) {
                expression = "true"
            } else {
                expression = "false"
            }
            break
        case "CallExpression":
            parsedVariable = formatExpression(ast.base, indentation, ugly)
            inOneLine = parsedVariable + "(" + ast.arguments.map(argument => formatExpression(argument, indentation, ugly)).join(ugly ? ',' : ', ') + ")"
            const firstNewline = inOneLine.search('\n')
            if (ugly || ast.arguments.length <= 1 || inOneLine.substr(0, (firstNewline === -1) ? inOneLine.length : firstNewline).length < LENGTH_BEFORE_NEWLINES) {
                expression = inOneLine
            } else {
                expression = parsedVariable + "(\n" + prefix + INDENTATION
                    + ast.arguments.map(arg => formatExpression(arg, indentation + 1, ugly)).join(",\n" + prefix + INDENTATION)
                    + "\n" + prefix +")"
            }
            break
        case "FunctionDeclaration":
            const astExpression = ast as ParsedLua.FunctionDeclarationExpression
            parsedFormalParameters = astExpression.parameters.map(formalParameterExpression => formatExpression(formalParameterExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            expression = "function(" + parsedFormalParameters + (ugly ? ")" : ")\n")
            + formatStatementsInBody(astExpression.body, indentation + 1, ugly)
            + (ugly ? ' ' : ("\n" + prefix)) +"end"
            break
        case "Identifier":
            expression = ast.name
            break
        case "IdentifierConversion":
            expression = ast.to
            break
        case "IndexExpression":
            parsedVariable = formatExpression(ast.base, indentation, ugly)
            parsedIndex = formatExpression(ast.index, indentation, ugly)
            expression = parsedVariable + "[" + parsedIndex + "]"
            break
        case "MemberExpression":
            parsedVariable = formatExpression(ast.base, indentation, ugly)
            parsedIndex = formatExpression(ast.identifier, indentation, ugly)
            expression = parsedVariable + ast.indexer + parsedIndex
            break
        case "NilLiteral":
            expression = "nil"
            break
        case "NumericLiteral":
            expression = ast.value.toString()
            break
        case "StringCallExpression":
            parsedVariable = formatExpression(ast.base, indentation, ugly)
            parsedActualParameters = formatExpression(ast.argument, indentation, ugly)
            // Oh no, the flame wars begin again.... print"Hello, World!" or print "Hello, World!" ???
            expression = parsedVariable + (ugly ? " " : "") + parsedActualParameters
            break
        case "StringLiteral":
            expression = ast.raw
            break
            /*
            // Format single-character/empty strings with ''
            if (ast.value.length <= 1) {
                expression = '\'' + escapeSingleQuotes(escapeBackslash(ast.value)) + '\''
                break
            }
            // Format multi-line strings with [[]]
            if (ast.value.includes('\]')) {
                expression = '[['+ escapeCloseBrackets(escapeBackslash(ast.value)) + ']]'
                break
            }
            // Else format with double quotes
            expression = '"' + escapeDoubleQuotes(escapeBackslash(ast.value)) + '"'
            break
            */
        case "VarargLiteral":
            expression = "..."
            break
        case "TableCallExpression":
            parsedVariable = formatExpression(ast.base, indentation, ugly)
            parsedActualParameters = formatExpression(ast.arguments, indentation, ugly)
            expression = parsedVariable + (ugly ? " " : "") + parsedActualParameters
            break
        case "TableConstructorExpression":
            inOneLine = "{" + ast.fields.map(field => formatExpression(field, indentation, ugly)).join(ugly ? ',' : ', ') + "}"
            if (ugly || ast.fields.length <= 1 || inOneLine.length < LENGTH_BEFORE_NEWLINES) {
                expression = inOneLine
            } else {
                expression = "{\n" + prefix + INDENTATION
                    + ast.fields.map(field => formatExpression(field, indentation + 1, ugly)).join(",\n" + prefix + INDENTATION)
                    + "\n" + prefix + "}"
            }
            break
        case "TableKey":
            parsedVariable = formatExpression(ast.key, indentation, ugly)
            parsedValue = formatExpression(ast.value, indentation, ugly)
            expression = '[' + parsedVariable + (ugly ? ']=' : "] = " ) + parsedValue
            break
        case "TableKeyString":
            parsedVariable = formatExpression(ast.key, indentation, ugly)
            parsedValue = formatExpression(ast.value, indentation, ugly)
            expression = parsedVariable + (ugly ? '=' : " = " ) + parsedValue
            break
        case "TableValue":
            expression = formatExpression(ast.value, indentation, ugly)
            break
        case "UnaryExpression":
            expression = ast.operator + (ast.operator === "not" ? " " : "") + formatExpression(ast.argument, indentation, ugly)
            break
        default:
            throw new Error(`Expression type '${(ast as ExtendedLua.Expression).type}' not implemented!`)
    }
    return wrapInParensIf(expression, ast.inParens)
}

function formatStatement(ast: ExtendedLua.Statement, indentation: number, ugly: boolean): string {
    const prefix = ugly ? '' : INDENTATION.repeat(indentation)
    let statement = ""

    let parsedVariables: string
    let parsedValues: string
    let parsedIterators: string
    let parsedVariable: string
    let parsedForRange: string
    let parsedFormalParameters: string
    let parsedCondition: string
    switch(ast.type) {
        case "NamespaceStatement":
        case "ExportStatement":
            return formatStatementsInBody(ast.assignments, indentation, ugly)
        case "ImportStatement":
            statement = ""
            break
        case "ExtendedAssignmentStatement":
            parsedVariables = ast.variables.map(variableExpression => formatExpression(variableExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            parsedValues = ast.init.map(valueExpression => formatExpression(valueExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            statement = parsedVariables + (ugly ? '=' : ' = ') + parsedValues
            break
        case "AssignmentStatement":
            parsedVariables = ast.variables.map(variableExpression => formatExpression(variableExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            parsedValues = ast.init.map(valueExpression => formatExpression(valueExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            statement = parsedVariables + (ugly ? '=' : ' = ') + parsedValues
            break
        case "BreakStatement":
            statement = "break"
            break
        case "CallStatement":
            statement = formatExpression(ast.expression, indentation, ugly)
            break
        case "DoStatement":
            statement = (ugly ? 'do ' : 'do\n')
                + formatStatementsInBody(ast.body, indentation + 1, ugly)
                + (ugly ? ' end' : ("\n" + prefix + "end"))
            break
        case "ForGenericStatement":
            parsedVariables = ast.variables.map(variableExpression => formatExpression(variableExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            parsedIterators = ast.iterators.map(iteratorExpression => formatExpression(iteratorExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            statement = "for " + parsedVariables + " in " + parsedIterators + (ugly ? ' do ' : ' do\n')
                + formatStatementsInBody(ast.body, indentation + 1, ugly)
                + (ugly ? ' end' : ("\n" + prefix + "end"))
            break
        case "ForNumericStatement":
            parsedVariable = formatExpression(ast.variable, indentation, ugly)
            const rangeExpressions = (ast.step !== null)
                ? [formatExpression(ast.start, indentation, ugly), formatExpression(ast.end, indentation, ugly), formatExpression(ast.step, indentation, ugly)]
                : [formatExpression(ast.start, indentation, ugly), formatExpression(ast.end, indentation, ugly)]
            parsedForRange = rangeExpressions.join(ugly ? ',' : ', ')
            statement = "for " + parsedVariable + (ugly ? '=' : ' = ') + parsedForRange + (ugly ? ' do ' : ' do\n')
                + formatStatementsInBody(ast.body, indentation + 1, ugly)
                + (ugly ? ' end' : ("\n" + prefix + "end"))
            break
        case "FunctionDeclaration":
            const astStatement = ast as ParsedLua.FunctionDeclarationStatement
            parsedVariable = formatExpression(astStatement.identifier, indentation, ugly)
            parsedFormalParameters = astStatement.parameters.map(formalParameterExpression => formatExpression(formalParameterExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            statement = "function " + parsedVariable + "(" + parsedFormalParameters + (ugly ? ')' : ')\n')
            + formatStatementsInBody(astStatement.body, indentation + 1, ugly)
            + (ugly ? ' end' : ("\n" + prefix + "end"))
            break
        case "IfStatement":
            statement = ast.clauses.map(clause => {
                switch (clause.type) {
                    case "ElseClause":
                        return (ugly ? ' else ' : 'else\n')
                            + formatStatementsInBody(clause.body, indentation + 1, ugly)
                    case "ElseifClause":
                        return "elseif " + formatExpression(clause.condition, indentation, ugly) + (ugly ? ' then ' : ' then\n')
                            + formatStatementsInBody(clause.body, indentation + 1, ugly)
                    case "IfClause":
                        return "if " + formatExpression(clause.condition, indentation, ugly) + (ugly ? ' then ' : ' then\n')
                            + formatStatementsInBody(clause.body, indentation + 1, ugly)
                }
            }).join("\n" + prefix) + (ugly ? ' ' : ("\n" + prefix)) +"end"
            break
        case "LocalStatement":
            parsedVariables = ast.variables.map(variableExpression => formatExpression(variableExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            parsedValues = ast.init.map(valueExpression => formatExpression(valueExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            statement = "local " + parsedVariables
                + ((parsedValues !== "")
                    ? ((ugly ? '=' : ' = ') + parsedValues)
                    : ""
                )
            break
        case "RepeatStatement":
            parsedCondition = formatExpression(ast.condition, indentation, ugly)
            statement = (ugly ? 'repeat ' : 'repeat\n')
            + formatStatementsInBody(ast.body, indentation + 1, ugly)
            + (ugly ? ' ' : ("\n" + prefix)) +"until " + parsedCondition
            break
        case "ReturnStatement":
            parsedValues = ast.arguments.map(valueExpression => formatExpression(valueExpression, indentation, ugly)).join(ugly ? ',' : ', ')
            statement = "return " + parsedValues
            break
        case "WhileStatement":
            parsedCondition = formatExpression(ast.condition, indentation, ugly)
            statement = "while " + parsedCondition + (ugly ? 'do ' : 'do\n')
                + formatStatementsInBody(ast.body, indentation + 1, ugly)
                + (ugly ? ' ' : ("\n" + prefix)) + "end"
            break
        default:
            logAST(ast)
            throw new Error(`Expression type '${(ast as ExtendedLua.Statement).type}' not implemented!`)
    }
    return prefix + statement
}

function formatStatementsInBody(ast: ExtendedLua.Statement[], indentation: number, ugly: boolean): string {
    return ast
        // Filter out statements that have no actions
        .filter(statement => (
            (statement.type !== "ImportStatement")
            && ((statement.type !== "ExportStatement") || statement.assignments.length !== 0)
        ))
        .map(statement => formatStatement(statement, indentation, ugly)).join(ugly ? ';' : '\n')
}

export default function astToLua(ast: ParsedLua.Chunk, indentation?: number, ugly?: boolean): string {
    indentation = indentation || 0
    ugly = ugly || false
    return formatStatementsInBody(ast.body, indentation, ugly)
}