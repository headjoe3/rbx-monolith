import { SourceFile } from "./Combiner";
import { Compiler } from "./Compiler";

import * as ParsedLua from "./ParsedLua"
import * as fs from "fs-extra"
import * as util from "util"

import {
	red,
	/*
	yellow,
	suggest
	*/
} from "./utility"

export default class Transpiler {
    constructor(compiler: Compiler) {

    }
	transpileSourceFile(sourceFile: SourceFile): string {
		try {
			const SHOW_TEST_FILE = true
			if (SHOW_TEST_FILE) {
				const parsed = ParsedLua.parse(fs.readFileSync(sourceFile.getFilePath()).toString())
				console.log("Parsed file", sourceFile, util.inspect(parsed, {showHidden: false, depth: null}))
			}
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
		
				console.log(red("Compiler Error:"), `Encountered a syntax error when parsing lua file '${sourceFile.getFilePath()}':`)
				if (line) {
					console.log(`     (line ${line}, column ${col}): ${remaining}`)
				} else {
					console.log(`     ${e.message}`)
				}
			}
		}

		throw new Error("Method not implemented.");
	}
}