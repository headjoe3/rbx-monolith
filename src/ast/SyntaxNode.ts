export default class SyntaxNode {
	syntax_kind: SyntaxKind
	children: SyntaxNode[] | undefined
	constructor (syntax_kind: SyntaxKind, children?: SyntaxNode[]) {
		this.syntax_kind = syntax_kind
		// enforces terminals by convention based on the given SyntaxKind
		this.children = syntax_kind >= 500 ? children : undefined
	}
}