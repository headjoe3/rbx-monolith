import SyntaxNode from "../SyntaxNode";
import SyntaxKind from "../SyntaxKind";

export default class ReturnStatement extends SyntaxNode {
  constructor(children: SyntaxNode[]) {
    super(SyntaxKind.return_statement, children)
  }
}