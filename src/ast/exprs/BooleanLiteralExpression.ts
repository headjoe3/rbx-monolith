import SyntaxNode from "../SyntaxNode";
import SyntaxKind from "../SyntaxKind";

export default class BooleanLiteralExpression extends SyntaxNode {
	value: boolean
	constructor(value: boolean) {
		super(SyntaxKind.boolean_literal_expression)
		this.value = value
	}
}