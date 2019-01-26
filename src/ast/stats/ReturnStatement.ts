import SyntaxNode from "src/ast/SyntaxNode";

export default class ReturnStatement extends SyntaxNode {
  constructor(children: SyntaxNode[]) {
    super(SyntaxKind.return_statement, children)
  }
}