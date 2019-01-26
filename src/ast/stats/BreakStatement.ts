import SyntaxNode from "src/ast/SyntaxNode";

export default class BreakStatement extends SyntaxNode {
  constructor() {
    super(SyntaxKind.break_statement)
  }
}