import BaseLexer from "src/compiler/lexical/BaseLexer";
import TokenInfo from "src/compiler/lexical/TokenInfo";
import { is_digit, is_letter } from "src/utils/stringutils";

interface TypeValuePair {
	type: TokenType
	value: string
}

export default class Lexer extends BaseLexer {
	private trivias: TypeValuePair[]
	private operators: TypeValuePair[]
	private keywords: Record<string, TokenType>
	constructor(source: string, file_name?: string) {
		super(source, file_name)
		if (file_name === undefined) { file_name = "src" }
	
		const pair = (type: TokenType, value: string): TypeValuePair => {
			return { type: type, value: value }
		}
	
		// we need to guarantee the order (pitfalls of lua hashmaps, yay...)
		// so we don't end up falsly match \r in \r\n
		// thanks a lot, old macOS, DOS, and linux: not helping the case of https://xkcd.com/927/
		this.trivias = [
			pair(TokenType.end_of_line_trivia, "\r\n"), // CRLF
			pair(TokenType.end_of_line_trivia, "\n"), // LF
			pair(TokenType.end_of_line_trivia, "\r"), // CR
			// now that we have support for spaces AND tabs, we're feeding into the classic spaces vs tabs flame wars.
			pair(TokenType.whitespace_trivia, " "),
			pair(TokenType.whitespace_trivia, "\t")
		]
	
		this.keywords = {
			["and"]: TokenType.and_keyword,
			["break"]: TokenType.break_keyword,
			["do"]: TokenType.do_keyword,
			["else"]: TokenType.else_keyword,
			["elseif"]: TokenType.elseif_keyword,
			["end"]: TokenType.end_keyword,
			["false"]: TokenType.false_keyword,
			["for"]: TokenType.for_keyword,
			["function"]: TokenType.function_keyword,
			["if"]: TokenType.if_keyword,
			["in"]: TokenType.in_keyword,
			["local"]: TokenType.local_keyword,
			["undefined"]: TokenType.undefined_keyword,
			["not"]: TokenType.not_keyword,
			["or"]: TokenType.or_keyword,
			["repeat"]: TokenType.repeat_keyword,
			["return"]: TokenType.return_keyword,
			["then"]: TokenType.then_keyword,
			["true"]: TokenType.true_keyword,
			["until"]: TokenType.until_keyword,
			["while"]: TokenType.while_keyword
		}
	
		this.operators = [
			pair(TokenType.triple_dot, "..."),
	
			pair(TokenType.double_equal, "==="),
			pair(TokenType.tilde_equal, "!=="),
			pair(TokenType.left_angle_equal, "<="),
			pair(TokenType.right_angle_equal, ">="),
			pair(TokenType.double_dot, ".."),
	
			pair(TokenType.left_paren, "("),
			pair(TokenType.right_paren, ")"),
			pair(TokenType.left_brace, "{"),
			pair(TokenType.right_brace, "}"),
			pair(TokenType.left_bracket, "["),
			pair(TokenType.right_bracket, "]"),
			pair(TokenType.plus, "+"),
			pair(TokenType.minus, "-"),
			pair(TokenType.asterisk, "*"),
			pair(TokenType.slash, "/"),
			pair(TokenType.percent, "%"),
			pair(TokenType.caret, "^"),
			pair(TokenType.pound, "#"),
			pair(TokenType.left_angle, "<"),
			pair(TokenType.right_angle, ">"),
			pair(TokenType.equal, "="),
			pair(TokenType.semi_colon, ";"),
			pair(TokenType.colon, "."),
			pair(TokenType.comma, ","),
			pair(TokenType.dot, ".")
		]
	}
	tokenize(): TokenInfo[] {
		const tokens: TokenInfo[] = []
		let token: TokenInfo | undefined

		do {
			token = this.next_token()

			if (token) {
				this.move(token.value.length)
				tokens.push(token)
			}
		}
		while (token);

		// if position has not reached the end of source, then we failed to tokenize something
		if (!this.is_finished()) {
			throw new Error(`lexical analysis failed at ${this.position} ${this.peek()}`)
		}

		return tokens
	}
	next_token(): TokenInfo | undefined {
		let token = this.next_of(this.trivias)
			|| this.next_comment()
			|| this.next_string()
			|| this.next_number()
			|| this.next_keyword()
			|| this.next_of(this.operators)
			|| this.next_identifier()
	
		return token
	}
	next_of(list: TypeValuePair[]): TokenInfo | undefined {
		for (const i in list) {
			const pair = list[i]
			if (this.match(pair.value)) {
				return new TokenInfo(pair.type, pair.value, this.position)
			}
		}
	}
	next_comment(): TokenInfo | undefined {
		const old_pos = this.position
	
		if (this.move_if_match("//")) {
			let buffer = "//"
			const block = this.next_multiline_block()
	
			if (block) {
				this.position = old_pos
				return new TokenInfo(TokenType.comment, buffer + block.value, this.position)
			}
	
			while (!this.is_finished()) {
				const trivia_token = this.next_of(this.trivias)
	
				if (trivia_token && trivia_token.token_type === TokenType.end_of_line_trivia) {
					break
				}
	
				buffer = buffer + this.consume()
			}
	
			this.position = old_pos
			return new TokenInfo(TokenType.comment, buffer, this.position)
		}
	}
	next_string(): TokenInfo | undefined {
		const block = this.next_multiline_block()

		if (block) {
			return new TokenInfo(TokenType.string, block.value, this.position)
		} else if (this.match("\"") || this.match("\'")) {
			const old_pos = this.position
			const delimit = this.consume()
			let buffer = ""
			let escaping

			do {
				const trivia_token = this.next_of(this.trivias)

				if (this.is_finished()) {
					throw new Error("unfinished string near <eof>")
				} else if (trivia_token && trivia_token.token_type === TokenType.end_of_line_trivia) {
					throw new Error(`unfinished string near '${delimit + buffer}'`)
				}

				escaping = this.peek() === "\\"
				buffer = buffer + this.consume()
			}
			while (escaping || this.match(delimit!));

			this.position = old_pos
			return new TokenInfo(TokenType.string, delimit + buffer + delimit, this.position)
		}
	}
	// not quite a fan of this... but it works
	// TODO: refactor to use finite state automata at some point
	next_number() {
		const c = this.peek()

		if (is_digit(c) || (c === "." && is_digit(this.peek(1)))) {
			let old_pos = this.position
			let buffer = ""

			do
				buffer = buffer + this.consume()
			while (is_digit(this.peek()) || this.match("."))

			if (this.match("e") || this.match("E")) {
				buffer = buffer + this.consume()

				if (this.match("+") || this.match("-")) {
					buffer = buffer + this.consume()
				}
			}

			while (!this.is_finished() && (is_digit(this.peek()!) || is_letter(this.peek()!) || this.match("_"))) {
				buffer = buffer + this.consume()
			}

			if (parseFloat(buffer)) {
				this.position = old_pos
				return new TokenInfo(TokenType.number, buffer, this.position)
			} else {
				throw new Error(`malformed number near '${buffer}'`)
			}
		}
	}
	next_keyword() {
		let id = this.next_identifier()

		if (id && this.keywords[id.value]) {
			return new TokenInfo(this.keywords[id.value], id.value, this.position)
		}
	}
	next_identifier() {
		let c = this.peek()

		if (is_letter(c) || c === "_") {
			let old_pos = this.position
			let buffer = ""
			let lookahead: string | undefined

			do {
				buffer = buffer + this.consume()
				lookahead = this.peek()
			}
			while (is_letter(lookahead) || lookahead === "_" || is_digit(lookahead))

			this.position = old_pos
			return new TokenInfo(TokenType.identifier, buffer, this.position)
		}
	}
	next_multiline_block() {
		if (this.peek() === "[") {
			let old_pos = this.position
			let level = this.count("=", 1)

			if (this.peek(level + 1) !== "[") {
				return undefined
			}

			this.move(level + 2)
			let buffer = "[" + ("=").repeat(level) + "["

			do
			{
				if (this.is_finished()) {
					throw new Error("unfinished string near <eof>")
				}

				buffer = buffer + this.consume()
			}
			while (!this.match("]" + ("=").repeat(level) + "]"))

			this.position = old_pos
			buffer = buffer + "]" + ("=").repeat(level) + "]"
			return new TokenInfo(TokenType.block, buffer, this.position)
		}
	}
}