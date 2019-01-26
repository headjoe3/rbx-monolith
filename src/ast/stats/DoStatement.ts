import SyntaxNode from "src/ast/SyntaxNode";

export default class DoStatement extends SyntaxNode {
  constructor(children: SyntaxNode[]) {
    super(SyntaxKind.do_statement, children)
  }
}