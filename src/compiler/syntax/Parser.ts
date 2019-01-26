import BaseParser from "./BaseParser";
import TokenInfo from "../lexical/TokenInfo";
import SyntaxNode from "../../ast/SyntaxNode";
import TokenType from "../lexical/TokenType";
import DoStatement from "../../ast/stats/DoStatement";
import BreakStatement from "../../ast/stats/BreakStatement";
import ReturnStatement from "../../ast/stats/ReturnStatement";
import NilLiteralExpression from "../../ast/exprs/NilLiteralExpression";
import BooleanLiteralExpression from "../../ast/exprs/BooleanLiteralExpression";
import NumberLiteralExpression from "../../ast/exprs/NumberLiteralExpression";

/** Parses a list of tokens into an AST with the parse() function */
export default class Parser extends BaseParser {
	constructor(tokens: TokenInfo[]) {
        super(tokens)
    }
    parse(): SyntaxNode[] {
        return this.parse_block()
    }
    parse_block(): SyntaxNode[] {
        const stats: SyntaxNode[] = []

        while (!this.is_finished()) {
            let stat = this.parse_statement()
            if (stat !== undefined) {
                stats.push(stat)
                this.match_any(TokenType.semi_colon)
            }

            let last = this.parse_last_statement()
            if (last !== undefined) {
                stats.push(last)
                this.match_any(TokenType.semi_colon)
                break
            }

            if ((stat || last) === undefined) {
                break
            }
        }

        return stats
    }
    parse_statement() {
        if (this.match_any(TokenType.do_keyword)) {
            let block = this.parse_block()
            this.expect(TokenType.end_keyword, "Expected 'end' to close 'do'")
            return new DoStatement(block)
        }
    }
    parse_last_statement() {
        if (this.match_any(TokenType.break_keyword)) {
            return new BreakStatement()
        } else if (this.match_any(TokenType.return_keyword)) {
            return new ReturnStatement(this.parse_expression_list())
        }
    }
    parse_expression() {
        if (this.match_any(TokenType.undefined_keyword)) {
            return new NilLiteralExpression()
        } else if (this.assert(TokenType.true_keyword, TokenType.false_keyword)) {
            let token = this.peek()
            this.move(1)
            return new BooleanLiteralExpression(token.token_type === TokenType.true_keyword)
        } else if (this.assert(TokenType.number)) {
            let token = this.peek()
            this.move(1)
            return new NumberLiteralExpression(parseFloat(token.value))
        }
    }
    parse_expression_list(): SyntaxNode[] {
        const explist: SyntaxNode[] = []

        do {
            let expr = this.parse_expression()

            if (expr) {
                explist.push(expr)
            }
        }
        while(this.match_any(TokenType.comma))

        return explist
    }
}