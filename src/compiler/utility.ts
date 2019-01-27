import * as path from "path";
import { CompilerError, CompilerErrorType } from "./errors/CompilerError";
import Combiner = require("./Combiner");

const luaIdentifierRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function isValidLuaIdentifier(id: string) {
	return luaIdentifierRegex.test(id);
}

export function safeLuaIndex(parent: string, child: string) {
	if (isValidLuaIdentifier(child)) {
		return `${parent}.${child}`;
	} else {
		return `${parent}["${child}"]`;
	}
}

export function stripExts(fileName: string): string {
	const ext = path.extname(fileName);
	if (ext.length > 0) {
		return stripExts(path.basename(fileName, ext));
	} else {
		return fileName;
	}
}

const scriptContextCache = new Map<string, ScriptContext>();
export function clearContextCache() {
	scriptContextCache.clear();
}

export enum ScriptType {
	Server,
	Client,
	Module,
}

export function getScriptType(file: Combiner.SourceFile): ScriptType {
	const filePath = file.getFilePath();
	const ext = path.extname(filePath);
	if (ext !== ".ts" && ext !== ".tsx") {
		throw new CompilerError(`Unexpected extension type: ${ext}`, CompilerErrorType.UnexpectedExtensionType);
	}

	const subext = path.extname(path.basename(filePath, ext));
	if (subext === ".server") {
		return ScriptType.Server;
	} else if (subext === ".client") {
		return ScriptType.Client;
	} else {
		return ScriptType.Module;
	}
}

export enum ScriptContext {
	None,
	Client,
	Server,
	Both,
}

export function getScriptContext(file: Combiner.SourceFile, seen = new Set<string>()): ScriptContext {
	const filePath = file.getFilePath();
	if (scriptContextCache.has(filePath)) {
		return scriptContextCache.get(filePath)!;
	}

	// prevent infinite recursion
	if (seen.has(filePath)) {
		return ScriptContext.None;
	}
	seen.add(filePath);

	const scriptType = getScriptType(file);
	if (scriptType === ScriptType.Server) {
		return ScriptContext.Server;
	} else if (scriptType === ScriptType.Client) {
		return ScriptContext.Client;
	} else {
		let isServer = false;
		let isClient = false;

		for (const [referencingFile] of file.getReferencingSourceFiles()) {
			const referenceContext = getScriptContext(referencingFile, seen);
			if (referenceContext === ScriptContext.Server) {
				isServer = true;
			} else if (referenceContext === ScriptContext.Client) {
				isClient = true;
			} else if (referenceContext === ScriptContext.Both) {
				isServer = true;
				isClient = true;
			}
		}

		if (isServer && isClient) {
			return ScriptContext.Both;
		} else if (isServer) {
			return ScriptContext.Server;
		} else if (isClient) {
			return ScriptContext.Client;
		} else {
			return ScriptContext.None;
		}
	}
}

export function red(text: string) {
	return `\x1b[31m${text}\x1b[0m`;
}

export function yellow(text: string) {
	return `\x1b[33m${text}\x1b[0m`;
}

export function suggest(text: string) {
	return `...\t${yellow(text)}`;
}


export function upperCamelCaseToPhrase(value: any): string {
	if (typeof value !== "string") return typeof value;

    // see what i did there
    let UpperCamelCase = ""
    let nextHasSpace = false

    for (let i = 0; i < value.length; i++) {
        const char = value.charAt(i)
        if (
            (char >= 'a' && char <= 'z')
        ) {
            UpperCamelCase += char
        } else {
            if (char >= 'A' && char <= 'Z') { 
				if (nextHasSpace) {
					UpperCamelCase += " "
					nextHasSpace = false
				}
				UpperCamelCase += char.toLowerCase()
			}
            nextHasSpace = true
        }
    }
    return UpperCamelCase
}

export function posToLineCol(sourceFile: Combiner.SourceFile, pos: number): [number, number] {
    let lines = 1
    let chars = 1
    const source = sourceFile.readSync()
    for (let i = 0; i < pos; i++) {
        const char = source[i]
        if (char.match(/\n/) !== null) {
            lines++
            chars = 0
        }
        chars++
    }
    return [lines, chars]
}