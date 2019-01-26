import TokenType from "./TokenType";

export default class TokenInfo {
    token_type: TokenType
    value: string
    position: number
    constructor(token_type: TokenType, value: string, position: number) {
        this.token_type = token_type
        this.value = value
        this.position = position
    }
    toString() {
        return `${this.token_type} ${this.value}`
    }
}