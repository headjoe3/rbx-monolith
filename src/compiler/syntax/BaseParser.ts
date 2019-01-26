import TokenInfo from "src/compiler/lexical/TokenInfo";

export default class BaseParser {
    private tokens: TokenInfo[]
    private position: number
    constructor(tokens: TokenInfo[]) {
        this.tokens = tokens
        this.position = 0
    }
    is_finished(): boolean {
        return this.position > this.tokens.length
    }
    move(by?: number): void {
        if (by === undefined) { by = 1 }
    
        if (!this.is_finished()) {
            this.position = this.position + by
        }
    }
    /** Peeks at the current token where the parser is currently at */
    peek(offset?: number): TokenInfo {
        if (offset === undefined) { offset = 0 }
    
        return this.tokens[this.position + offset]
    }
    previous(): TokenInfo {
        return this.peek(-1)
    }
    next(): TokenInfo {
        return this.peek(1)
    }
    skip_tokens(): void {
        do {
            let token = this.peek()
            let trivial_token = token.token_type === TokenType.whitespace_trivia
                || token.token_type === TokenType.end_of_line_trivia
                || token.token_type === TokenType.comment
    
            // we're done skipping trivial tokens, so break
            if (!trivial_token) {
                break
            }
    
            this.move(1)
        }
        while (!this.is_finished());
    }
    /** Asserts whether the current token equals to one of the given TokenTypes */
    assert(...args: TokenType[]): boolean {
        if (!this.is_finished()) {
            args.forEach(token_type => {
                this.skip_tokens()
    
                if (this.peek().token_type === token_type) {
                    return true
                }
            })
        }
    
        return false
    }
    /** Expects the current token to be the same as the given token_type, otherwise throws reason */
    expect(token_type: TokenType, reason: string): TokenInfo | undefined {
        if (!this.is_finished()) {
            this.skip_tokens()
    
            if (this.assert(token_type)) {
                const token = this.peek()
                this.move(1)
                return token
            }
    
            throw new Error(reason)
        }
    }
    /** If current token is one of these expected TokenType, moves the position by one */
    match_any(...args: TokenType[]): boolean {
        if (!this.is_finished()) {
            this.skip_tokens()
    
            if (this.assert(...args)) {
                this.move(1)
                return true
            }
        }
    
        return false
    }
}