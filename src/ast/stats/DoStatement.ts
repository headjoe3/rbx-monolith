import SyntaxNode from "../SyntaxNode";
import SyntaxKind from "../SyntaxKind";

export default class DoStatement extends SyntaxNode {
  constructor(children: SyntaxNode[]) {
    super(SyntaxKind.do_statement, children)
  }
}