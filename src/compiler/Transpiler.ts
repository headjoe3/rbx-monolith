import { SourceFile } from "./Combiner";
import { Compiler } from "./Compiler";

import * as ParsedLua from "./ParsedLua"

import astToLua from "./transpiler/astToLua";
import Combiner = require("./Combiner");
import { TranspilerError, TranspilerErrorType } from "./errors/TranspilerError";

import * as util from 'util'
import { upperCamelCaseToPhrase, posToLineCol } from "./utility";
import JsCallGlobals = require("./transpiler/JsCallGlobals");
import * as ExtendedLua from "./transpiler/ExtendedLua";

const DEBUG_INPUT = false

function _getNestedIdentifiers(root: {[index: string]: any}, stack: ExtendedLua.Node[], addTo: [ParsedLua.Identifier, ExtendedLua.Node[]][]): [ParsedLua.Identifier, ExtendedLua.Node[]][] {
	// Add root to stack if it is a node object
	if (root.type) {
		// Add root element if it is an identifier
		if (ParsedLua.expect("Identifier")(root)) {
			addTo.push([root, stack.slice(0, stack.length)])
		}
		stack.push(root as ExtendedLua.Node)
	}

    // Search nested objects for nodes
    for (const key in root) {
        const value = root[key]
        if (value && typeof value === "object" && value !== null) {
            _getNestedIdentifiers(value, stack, addTo)
        }
	}
	
	// Remove from stack
	if (root.type) {
		stack.pop()
	}

	return addTo
}
export function getNestedIdentifiers(ast: ExtendedLua.Node): [ParsedLua.Identifier, ExtendedLua.Node[]][] {
	return _getNestedIdentifiers(ast, [], [])
}

/** debugging function for logging a ParsedLua AST  */
export function logAST(ast: Object) {
	console.log(util.inspect(ast, {depth: null}))
}

/** Finds the first occurrence of some value in an array and replaces it with a new value  */
function replaceInArray(array: any[], oldValue: any, newValue: any) {
	for (const i in array) {
		if (array[i] === oldValue) {
			array[i] = newValue
			return
		}
	}
}

/** Morphs an object into a copy of an object template. */
function morphObject(obj: Object, template: Object) {
	// Clear node
	for (const key in obj) {
		;(obj as {[index: string]: any})[key] = undefined
	}
	// Fill with 'identifierToReplace' params
	for (const key in template) {
		;(obj as {[index: string]: any})[key] = (template as {[index: string]: any})[key]
	}
}

export default class Transpiler {
	private compiler: Compiler
    constructor(compiler: Compiler) {
		this.compiler = compiler
	}
	transpileEntryPoint(entryPointSource: SourceFile): string {
		const compilerOptions = this.compiler.getProject().getCompilerOptions()
		const ugly = compilerOptions.uglify

		// Collect and transpile source modules
		const transpiledHash = new Set<SourceFile>()
		const transpiledStack: SourceFile[] = []
		this.transpileSourceFile(entryPointSource, transpiledHash, transpiledStack)

		// Put the files together
		let header = ""
		let body = ""
		transpiledStack.reverse()
		transpiledStack.forEach(module => {
			// Add exported identifiers to header
			header = header + "local " + module.getMonolithicName() + (ugly ? ';' : '\n')
			module.getExportedIdentifiers()!.forEach(monolithicIdentifier => {
				header = header + "local " + monolithicIdentifier + (ugly ? ';' : '\n')
			})

			// Add contents to body
			body = body + module.getTranspiledCache()! + (ugly ? " " : "\n")
		})
		return header + body
	}
	transpileSourceFile(sourceFile: SourceFile, transpiledHash: Set<SourceFile>, transpiledStack: SourceFile[]): void {
		const compilerOptions = this.compiler.getProject().getCompilerOptions()
		const ugly = compilerOptions.uglify

		// Ignore if already transpiled
		if (transpiledHash.has(sourceFile)) {
			return;
		} else {
			transpiledHash.add(sourceFile)
		}
		try {
			// Parse
			const ast = ParsedLua.parse(
				sourceFile.readSync(),
				{
					scope: true,
					ranges: true
				}
			)
			if (DEBUG_INPUT) {
				logAST(ast)
			}

			// Replace extended nodes in the syntax tree
			const [importStatements, exportStatements] = this.parseExtendedNodes(ast, sourceFile)
			
			// Get monolithic names for exports
			const exportsMap = new Map()
            exportStatements.forEach(exportStatement => {
                exportStatement.identifiers.forEach(identifier => {
                    exportsMap.set(identifier.from, identifier.to)
                })
            })
			sourceFile.setMonolithicExports(exportsMap)

			// Replace imported identifiers in monolithic format
			const identifierData = getNestedIdentifiers(ast)
			importStatements.forEach(importStatement => {
				const dependency = this.compiler.getProject().getRelativeSourceFile(sourceFile, importStatement.path)
				if (!dependency) {
					throw new TranspilerError(
						`Import Error: Could not file at the specified path '${importStatement.path}'`,
						new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, importStatement.range[0])),
						TranspilerErrorType.ImportError
					)
				} else {
					if (!transpiledHash.has(dependency)) {
						// Transpile this file before replacing identifiers
						this.transpileSourceFile(dependency, transpiledHash, transpiledStack)
					}
					importStatement.identifiers.forEach(identifierToReplace => {
						// Set 'to' to this reference's exports
						identifierToReplace.to = dependency.getMonolithicName(identifierToReplace.from)

						// Replace identifiers in the file
						identifierData.forEach(pair => {
							const [identifier, stack] = pair
							// Do not override member expressions
							if (stack[stack.length - 1].type === "MemberExpression") {
								return
							}
							if (ParsedLua.expect("Identifier")(identifier)) {
								if (!identifier.isLocal && identifier.name === identifierToReplace.from) {
									console.log("Replacing imported identifier at '" + sourceFile.getBaseName() + `"' line ${posToLineCol(sourceFile, identifier.range[0])[0]}': '${identifierToReplace.from}' => ${identifierToReplace.to}"`)
									morphObject(identifier, identifierToReplace)
								}
							}
						})
					})
				}
			})

			// Replace exported identifiers in monolithic format
			exportStatements.forEach(exportStatement => {
				exportStatement.identifiers.forEach(identifierToReplace => {
					identifierData.forEach(pair => {
						const [identifier, stack] = pair
						// Do not override import or export identifiers
						if (stack[stack.length - 1].type === "ImportStatement"
							|| stack[stack.length - 1].type === "ExportStatement") {
							return
						}
						// Do not override member expressions
						if (stack[stack.length - 1].type === "MemberExpression") {
							return
						}

						if (!identifier.isLocal && identifier.name === identifierToReplace.from) {
							console.log("Replacing exported identifier at '" + sourceFile.getBaseName() + `"' line ${posToLineCol(sourceFile, identifier.range[0])[0]}': '${identifierToReplace.from}' => ${identifierToReplace.to}"`)
							identifier.name = identifierToReplace.to
						}
					})
				})
			})

			// Transpile as code block
			const transpiled = "do" + (ugly ? ' ' : '\n') + astToLua(ast, 1, ugly) + (ugly ? ' ' : '\n') + "end"

			// Cache transpile and add to stack
			sourceFile.setMonolithCache(transpiled, ast)
			transpiledStack.push(sourceFile)
			
			return
		} catch(e) {
			if (e instanceof SyntaxError) {
				let line: string | undefined
				let col: string | undefined
				let remaining: string | undefined
				if (e.message.startsWith("[")) {
					const match = e.message.match("\\\[([0-9]*)\\\:([0-9]*)\\\](.*)")
					if (match && match.length === 4) {
						line = match[1]
						col = match[2]
						remaining = match[3]
					}
				}
				throw new TranspilerError(remaining || e.message, new Combiner.ErrorNode(sourceFile, parseInt(line || "1"), parseInt(col || "1")), TranspilerErrorType.SyntaxError)
			} else {
				throw e
			}
		}
	}
	parseExtendedNodes(ast: ParsedLua.Chunk, sourceFile: SourceFile): [ExtendedLua.ImportStatement[], ExtendedLua.ExportStatement[]] {
		const identifiers = getNestedIdentifiers(ast)

		// Parse import/export statements
		const importStatements: ExtendedLua.ImportStatement[] = []
		const exportStatements: ExtendedLua.ExportStatement[] = []
		identifiers.forEach(pair => {
			const [identifier, stack] = pair

			// If the identifier is not nested in a statement, it must belong to the 'globals' property of the Chunk
			if (stack[stack.length - 1].type === "Chunk") {
				return
			}
			// Parse import statements
			if (identifier.name === "import") {
				const parent = stack[stack.length - 1]
				if (ParsedLua.expect("CallExpression")(parent) || ParsedLua.expect("StringCallExpression")(parent)) {
					const importPath = JsCallGlobals.monolith_import(sourceFile, parent)
					const grandparent = stack[stack.length - 2]
					if (ParsedLua.expect("AssignmentStatement")(grandparent) || ParsedLua.expect("LocalStatement")(grandparent)) {
						const variables = grandparent.variables
						const identifiers: ExtendedLua.IdentifierConversion[] = []
						variables.forEach(variable => {
							if (ParsedLua.expect("Identifier")(variable)) {
								identifiers.push({
									type: "IdentifierConversion",
									from: variable.name,
									to: "INVALID_REFERENCE",
									range: variable.range,
									inParens: variable.inParens,
								})
							} else {
								throw new TranspilerError(
									`Invalid import statement (imported values should be identifiers; got ${upperCamelCaseToPhrase(variable.type)})`,
									new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, variable.range[0])),
									TranspilerErrorType.ImportSyntaxError
								)
							}
						})

						// Replace grandparent with import statement node
						const statement: ExtendedLua.ImportStatement = {
							type: "ImportStatement",
							identifiers: identifiers,
							path: importPath,
							range: grandparent.range,
						}
						replaceInArray((stack[stack.length - 3] as ParsedLua.HasBody).body, grandparent, statement)
						importStatements.push(statement)
					} else {
						throw new TranspilerError(
							`Invalid import statement (expected assignment statement, got ${upperCamelCaseToPhrase(grandparent && grandparent.type)})`,
							new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, parent.range[0])),
							TranspilerErrorType.ImportSyntaxError
						)
					}
				} else {
					throw new TranspilerError(
						`Invalid import statement (expected function call expression, got ${upperCamelCaseToPhrase(parent.type)})`,
						new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, identifier.range[0])),
						TranspilerErrorType.ImportSyntaxError
					)
				}
			}


			// Parse export statements
			if (identifier.name === "export") {
				const parent = stack[stack.length - 1]
				if (parent && ParsedLua.expect("CallExpression")(parent)) {
					const identifiers = JsCallGlobals.monolith_export(sourceFile, parent)
					const grandparent = stack[stack.length - 2]
					if (ParsedLua.expect("CallStatement")(grandparent)) {
						// Replace grandparent with export statement node
						const statement: ExtendedLua.ExportStatement = {
							type: "ExportStatement",
							identifiers: identifiers,
							range: grandparent.range,
						}
						replaceInArray((stack[stack.length - 3] as ParsedLua.HasBody).body, grandparent, statement)
						exportStatements.push(statement)
					} else {
						throw new TranspilerError(
							`Invalid export statement (expected call statement, got ${upperCamelCaseToPhrase(grandparent && grandparent.type)})`,
							new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, parent.range[0])),
							TranspilerErrorType.ImportSyntaxError
						)
					}
				} else {
					throw new TranspilerError(
						`Invalid export statement (expected function call expression, got ${upperCamelCaseToPhrase(parent && parent.type)})`,
						new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, parent.range[0])),
						TranspilerErrorType.ImportSyntaxError
					)
				}
			}
		})
		return [importStatements, exportStatements]
	}
}