enum SyntaxKind {
	// terminal trees (< 500)
	break_statement = 1,
	nil_literal_expression = 2,
	boolean_literal_expression = 3,
	number_literal_expression = 4,

	// non-terminal trees (>= 500)
	do_statement = 500,
	return_statement = 501,
}
export default SyntaxKind