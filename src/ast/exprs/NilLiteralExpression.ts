import SyntaxNode from "../SyntaxNode";
import SyntaxKind from "../SyntaxKind";

export default class NilLiteralExpression extends SyntaxNode {
	constructor() {
		super(SyntaxKind.nil_literal_expression)
	}
}