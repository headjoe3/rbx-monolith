import SyntaxNode from "src/ast/SyntaxNode";

export default class NumberLiteralExpression extends SyntaxNode {
	value: number
	constructor(value: number) {
		super(SyntaxKind.number_literal_expression)
		this.value = value
	}
}