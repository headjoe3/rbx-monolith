import SyntaxNode from "src/ast/SyntaxNode";

export default class BooleanLiteralExpression extends SyntaxNode {
	value: boolean
	constructor(value: boolean) {
		super(SyntaxKind.boolean_literal_expression)
		this.value = value
	}
}