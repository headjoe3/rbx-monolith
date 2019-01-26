declare enum TokenType {
	none = 0,

	whitespace_trivia = 1,
	end_of_line_trivia = 2,

	// tokens with any values (1xx)
	identifier = 100,
	string = 101,
	block = 102,
	comment = 103,
	number = 104,

	// keywords (2xx)
	and_keyword = 200,
	break_keyword = 201,
	do_keyword = 202,
	else_keyword = 203,
	elseif_keyword = 204,
	end_keyword = 205,
	false_keyword = 206,
	for_keyword = 207,
	function_keyword = 208,
	if_keyword = 209,
	in_keyword = 210,
	local_keyword = 211,
	nil_keyword = 212,
	not_keyword = 213,
	or_keyword = 214,
	repeat_keyword = 215,
	return_keyword = 216,
	then_keyword = 217,
	true_keyword = 218,
	undefined_keyword = 219,
	until_keyword = 220,
	while_keyword = 221,

	// operators (4xx)
	plus = 400,
	minus = 401,
	asterisk = 402,
	slash = 403,
	percent = 404,
	caret = 405,
	pound = 406,
	double_equal = 407,
	tilde_equal = 408,
	left_angle_equal = 409,
	right_angle_equal = 410,
	left_angle = 411,
	right_angle = 412,
	equal = 413,
	semi_colon = 414,
	colon = 415,
	comma = 416,
	dot = 417,
	double_dot = 418,
	triple_dot = 419,
	left_paren = 420,
	right_paren = 421,
	left_brace = 422,
	right_brace = 423,
	left_bracket = 424,
	right_bracket = 425,
}
