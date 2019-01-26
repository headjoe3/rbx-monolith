import SyntaxNode from "../SyntaxNode";
import SyntaxKind from "../SyntaxKind";

export default class NumberLiteralExpression extends SyntaxNode {
	value: number
	constructor(value: number) {
		super(SyntaxKind.number_literal_expression)
		this.value = value
	}
}