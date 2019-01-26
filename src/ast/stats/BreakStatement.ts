import SyntaxNode from "../SyntaxNode";
import SyntaxKind from "../SyntaxKind";

export default class BreakStatement extends SyntaxNode {
  constructor() {
    super(SyntaxKind.break_statement)
  }
}