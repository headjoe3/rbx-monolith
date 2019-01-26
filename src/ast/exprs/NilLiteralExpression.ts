import SyntaxNode from "src/ast/SyntaxNode";

export default class NilLiteralExpression extends SyntaxNode {
	constructor() {
		super(SyntaxKind.nil_literal_expression)
	}
}