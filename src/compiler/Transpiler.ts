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
const DEBUG_REPLACEMENTS = false

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

export function getIdentifierQualifiers(identifier: ParsedLua.Identifier, stack: ExtendedLua.Node[]): [string, boolean] {
	const parent = stack[stack.length - 1]
	if (parent.type === "MemberExpression") {
		if (parent.base.type === "MemberExpression") {
			// Nested member expression
			const [parentFullName, parentIsAnonymous] = getIdentifierQualifiers(parent.base.identifier, stack.slice(0, stack.length - 1))
			return [parentFullName + "." + identifier.name, parentIsAnonymous]
		} else if (parent.base.type === "Identifier") {
			if (parent.base === identifier) {
				return [identifier.name, false]// getIdentifierQualifiers(identifier, stack.slice(0, stack.length - 2))
			} else {
				// Terminating identifier
				return [parent.base.name + "." + identifier.name, false]
			}
		} else {
			// Member expression of anonymous value
			return [identifier.name, true]
		}
	} else if (parent.type === "TableKeyString") {
		if (parent.key === identifier) {
			return [identifier.name, true]
		} else {
			return [identifier.name, false]
		}
	} else {
		return [identifier.name, false]
	}
}

export function getRootMemberExpression(identifier: ParsedLua.Identifier, stack: ExtendedLua.Node[]): ParsedLua.MemberExpression | undefined {
	const parent = stack[stack.length - 1]
	if (parent.type === "MemberExpression") {
		if (parent.base.type === "MemberExpression") {
			// Nested member expression
			const ancestorMemberExpression = getRootMemberExpression(parent.base.identifier, stack.slice(0, stack.length - 1))
			return ancestorMemberExpression || parent.base
		} else if (parent.base.type === "Identifier") {
			if (parent.base === identifier) {
				return undefined
			} else {
				return parent
			}
		} else {
			return parent
		}
	}
	return undefined
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
		let transpiledStack: SourceFile[] = []
		this.transpileSourceFile(entryPointSource, transpiledHash, transpiledStack)

		// Put the files together
		let header = ""
		let body = ""
		transpiledStack.forEach(module => {
			// Add exported identifiers to header
			//header = header + "local " + module.getMonolithicName() + (ugly ? ';' : '\n')
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

		const isEntryPoint = transpiledHash.size === 0
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
			const [importStatements, exportStatements, namespaceStatements] = this.parseExtendedNodes(ast, sourceFile)
			
			// Get monolithic names for exports
			const exportsMap = new Map()
            exportStatements.forEach(exportStatement => {
                exportStatement.identifiers.forEach(identifier => {
					// Check if it is a namespace
					let matchesNamespace: ExtendedLua.NamespaceStatement | undefined
					namespaceStatements.forEach(namespace => {
						if (matchesNamespace) return;
						let qualifier: string
						if (ExtendedLua.expect("IdentifierConversion")(namespace.qualifier)) {
							qualifier = namespace.qualifier.from
						} else {
							qualifier = namespace.qualifier.name
						}
						if (qualifier === identifier.from) {
							matchesNamespace = namespace
						}
					})

					if (matchesNamespace) {
						// Export namespace identifiers individually
						matchesNamespace.identifiers.forEach(conversion => {
							exportsMap.set(conversion.from, conversion.to)
						})
					} else {
						exportsMap.set(identifier.from, identifier.to)
					}
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

					// Tell the dependency that this file is referencing it
					dependency.addReference(sourceFile, importStatement.identifiers.map(identifierToReplace => identifierToReplace.name))

					const matchedImports = new Set<ParsedLua.Identifier>()
					dependency.getExportedIdentifiers().forEach((monolithicName, exportName) => {
						// Check if the import statement has this name
						let importHasIdentifier = false
						if (importStatement.importAll) {
							importHasIdentifier = true
						} else {
							for (const importedIdentifier of importStatement.identifiers) {
								// Check if this name is directly imported
								if (importedIdentifier.name === exportName) {
									importHasIdentifier = true
									matchedImports.add(importedIdentifier)
									break
								}
								// Check if this name is part of an imported namespace
								const exportedNamespace = exportName.match(/[^\.]*/)
								if (exportedNamespace && exportedNamespace[0] && exportedNamespace[0] === importedIdentifier.name) {
									importHasIdentifier = true
									matchedImports.add(importedIdentifier)
									break
								}
							}
						}

						if (importHasIdentifier) {
							// Replace matching identifiers
							identifierData.forEach(pair => {
								const [identifier, stack] = pair
								// Do not override identifiers that have already been converted
								if (ParsedLua.expect("Identifier")(identifier)) {
									// Do not override anonymous identifier expressions
									const [fullName, isAnonymous] = getIdentifierQualifiers(identifier, stack)
									if (isAnonymous) {
										return
									}
									if (fullName === exportName) {
										if (!identifier.isLocal && !isAnonymous) {
											if (DEBUG_REPLACEMENTS) {
												console.log("Replacing imported identifier at '"
													+ sourceFile.getBaseName()
													+ `"' line ${posToLineCol(sourceFile, identifier.range[0])[0]}': '${exportName}' => ${monolithicName}"`
												)
											}
											const nodeToMorph = getRootMemberExpression(identifier, stack) || identifier
											const wasInParens = nodeToMorph.inParens
											morphObject(nodeToMorph, {
												type: "IdentifierConversion",
												from: identifier.name,
												to: monolithicName,
												inParens: wasInParens,
												range: nodeToMorph.range
											} as ExtendedLua.IdentifierConversion)
										}
									}
								}
							})
						}
					})

					// Determine if any identifiers not found
					importStatement.identifiers.forEach(identifier => {
						if (!matchedImports.has(identifier)) {
							throw new TranspilerError(
								"Attempt to import unknown identifier '" + identifier.name + "' from '" + importStatement.path + "'",
								new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, identifier.range[0])),
								TranspilerErrorType.ImportError
							)
						}
					})
				}
			})

			// Replace exported identifiers in monolithic format
			exportStatements.forEach(exportStatement => {
				exportStatement.identifiers.forEach(identifierToReplace => {
					identifierData.forEach(pair => {
						const [identifier, stack] = pair
						if (ParsedLua.expect("Identifier")(identifier)) {
							const [fullName, isAnonymous] = getIdentifierQualifiers(identifier, stack)
							if (fullName === identifierToReplace.from) {
								if (!identifier.isLocal && !isAnonymous) {
									if (DEBUG_REPLACEMENTS) {
										console.log("Replacing exported identifier at '"
											+ sourceFile.getBaseName()
											+ `"' line ${posToLineCol(sourceFile, identifier.range[0])[0]}': '${identifierToReplace.from}' => ${identifierToReplace.to}"`
										)
									}
									const nodeToMorph = getRootMemberExpression(identifier, stack) || identifier
									const wasInParens = nodeToMorph.inParens
									morphObject(nodeToMorph, {
										type: "IdentifierConversion",
										from: identifier.name,
										to: identifierToReplace.to,
										inParens: wasInParens,
										range: nodeToMorph.range
									} as ExtendedLua.IdentifierConversion)
								}
							}
						}
					})
				})
			})

			// Replace namespace identifiers
			namespaceStatements.forEach(namespaceStatement => {
				namespaceStatement.identifiers.forEach(identifierToReplace => {
					identifierData.forEach(pair => {
						const [identifier, stack] = pair
						if (ParsedLua.expect("Identifier")(identifier)) {
							const [fullName, isAnonymous] = getIdentifierQualifiers(identifier, stack)
							if (fullName === identifierToReplace.from) {
								if (!identifier.isLocal && !isAnonymous) {
									if (DEBUG_REPLACEMENTS) {
										console.log("Replacing namespace identifier at '"
											+ sourceFile.getBaseName()
											+ `"' line ${posToLineCol(sourceFile, identifier.range[0])[0]}': '${identifierToReplace.from}' => ${identifierToReplace.to}"`
										)
									}
									const nodeToMorph = getRootMemberExpression(identifier, stack) || identifier
									const wasInParens = nodeToMorph.inParens
									morphObject(nodeToMorph, {
										type: "IdentifierConversion",
										from: identifier.name,
										to: identifierToReplace.to,
										inParens: wasInParens,
										range: nodeToMorph.range
									} as ExtendedLua.IdentifierConversion)
								}
							}
						}
					})
				})
			})

			let transpiled: string

			// Transpile chunk
			if (isEntryPoint) {
				// Do not indent entry point
				transpiled = astToLua(ast, 0, ugly)
			} else {
				// Wrap imported modules in a 'do' block
				transpiled = "do" + (ugly ? ' ' : '\n') + astToLua(ast, 1, ugly) + (ugly ? ' ' : '\n') + "end"
			}

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
				throw new TranspilerError(
					remaining || e.message,
					new Combiner.ErrorNode(sourceFile, parseInt(line || "1"), parseInt(col || "1")),
					TranspilerErrorType.SyntaxError
				)
			} else {
				throw e
			}
		}
	}
	parseExtendedNodes(ast: ParsedLua.Chunk, sourceFile: SourceFile): [ExtendedLua.ImportStatement[], ExtendedLua.ExportStatement[], ExtendedLua.NamespaceStatement[]] {
		const identifiers = getNestedIdentifiers(ast)

		// Parse import/export statements
		const importStatements: ExtendedLua.ImportStatement[] = []
		const exportStatements: ExtendedLua.ExportStatement[] = []
		const namespaceStatements: ExtendedLua.NamespaceStatement[] = []
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
					if (ParsedLua.expect("AssignmentStatement")(grandparent)) {
						const variables = grandparent.variables
						const identifiers: ParsedLua.Identifier[] = []
						variables.forEach(variable => {
							if (ParsedLua.expect("Identifier")(variable)) {
								identifiers.push(variable)
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
							importAll: false,
						}
						replaceInArray((stack[stack.length - 3] as ParsedLua.HasBody).body, grandparent, statement)
						importStatements.push(statement)
					} else if (ParsedLua.expect("CallStatement")(grandparent)) {
						// Import all
						const statement: ExtendedLua.ImportStatement = {
							type: "ImportStatement",
							identifiers: [],
							path: importPath,
							range: grandparent.range,
							importAll: true,
						}
						replaceInArray((stack[stack.length - 3] as ParsedLua.HasBody).body, grandparent, statement)
						importStatements.push(statement)
					} else if (ParsedLua.expect("LocalStatement")(grandparent)) {
						throw new TranspilerError(
							`Imports must be global!`,
							new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, grandparent.range[0])),
							TranspilerErrorType.ImportSyntaxError
						)
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
				if (ParsedLua.expect("CallExpression")(parent) || ParsedLua.expect("TableCallExpression")(parent)) {
					const [identifiers, assignments] = JsCallGlobals.monolith_export(sourceFile, parent)
					const grandparent = stack[stack.length - 2]
					if (ParsedLua.expect("CallStatement")(grandparent)) {
						// Replace grandparent with export statement node
						const statement: ExtendedLua.ExportStatement = {
							type: "ExportStatement",
							identifiers: identifiers,
							assignments: assignments,
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


			// Parse namespace statements
			if (identifier.name === "namespace") {
				const parent = stack[stack.length - 1]
				if (ParsedLua.expect("CallExpression")(parent) || ParsedLua.expect("TableCallExpression")(parent)) {
					const [identifiers, init] = JsCallGlobals.monolith_namespace(sourceFile, parent, stack.slice(0, stack.length - 1))
					const grandparent = stack[stack.length - 2]
					if (ParsedLua.expect("AssignmentStatement")(grandparent) || ParsedLua.expect("LocalStatement")(grandparent)) {
						if (grandparent.variables.length !== 1 || grandparent.init.length !== 1) {
							throw new TranspilerError(
								`Invalid namespace statement (expected single assignment, got tuple assignment)`,
								new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, parent.range[0])),
								TranspilerErrorType.ImportSyntaxError
							)
						}
						let qualifierVariable = grandparent.variables[0]
						let qualifier: string | undefined
						if (ParsedLua.expect("Identifier")(qualifierVariable) && !qualifierVariable.isLocal) {
							qualifier = qualifierVariable.name
						} else if (ExtendedLua.expect("IdentifierConversion")(qualifierVariable)){
							qualifier = qualifierVariable.from
						}
						if (qualifier) {
							const conversions: ExtendedLua.IdentifierConversion[] = []
							const assignments: ExtendedLua.ExtendedAssignmentStatement[] = []
							for (const i in identifiers) {
								const identifier = identifiers[i]
								const value = init[i]
								const conversion: ExtendedLua.IdentifierConversion = {
									type: "IdentifierConversion",
									from: qualifier + "." + identifier.name,
									to: sourceFile.getMonolithicName(qualifier + "_" + identifier.name),
									range: identifier.range,
									inParens: identifier.inParens
								}
								conversions.push(conversion)
								assignments.push({
									type: "ExtendedAssignmentStatement",
									variables: [conversion],
									init: [value],
									range: [identifier.range[0], value.range[1]]
								})
							}

							// Add final statement to create empty namespace table
							assignments.push({
								type: "ExtendedAssignmentStatement",
								variables: [{
									type: "Identifier",
									name: qualifier,
									range: identifier.range
								} as ParsedLua.Identifier],
								init: [
									{
										type: "TableConstructorExpression",
										fields: [],
										range: identifier.range,
										inParens: false,
									} as ParsedLua.TableConstructorExpression
								],
								range: identifier.range
							})
							

							// Replace grandparent with export statement node
							const statement: ExtendedLua.NamespaceStatement = {
								type: "NamespaceStatement",
								identifiers: conversions,
								assignments: assignments,
								range: grandparent.range,
								qualifier: qualifierVariable as ParsedLua.Identifier | ExtendedLua.IdentifierConversion
							}
							replaceInArray((stack[stack.length - 3] as ParsedLua.HasBody).body, grandparent, statement)
							namespaceStatements.push(statement)
						} else {
							throw new TranspilerError(
								`Invalid namespace statement (expected global identifier assignemnt, got ${upperCamelCaseToPhrase(grandparent && grandparent.type)})`,
								new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, parent.range[0])),
								TranspilerErrorType.ImportSyntaxError
							)
						}
					} else {
						throw new TranspilerError(
							`Invalid namespace statement (expected assignment statement, got ${upperCamelCaseToPhrase(grandparent && grandparent.type)})`,
							new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, parent.range[0])),
							TranspilerErrorType.ImportSyntaxError
						)
					}
				} else {
					throw new TranspilerError(
						`Invalid namespace expression (expected function call expression, got ${upperCamelCaseToPhrase(parent && parent.type)})`,
						new Combiner.ErrorNode(sourceFile, ...posToLineCol(sourceFile, parent.range[0])),
						TranspilerErrorType.ImportSyntaxError
					)
				}
			}
		})
		return [importStatements, exportStatements, namespaceStatements]
	}
}