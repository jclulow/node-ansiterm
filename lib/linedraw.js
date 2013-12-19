/*
 * Box/line-drawing characters for different terminal modes:
 */

var ESC = '\u001b';

module.exports = {
	utf8: {
		on: '',
		off: '',
		horiz: '\u2501',
		verti: '\u2503',
		topleft: '\u250f',
		topright: '\u2513',
		bottomright: '\u251b',
		bottomleft: '\u2517'
	},
	vt100: {
		on: ESC + '(0',
		off: ESC + '(B',
		horiz: '\u0071',
		verti: '\u0078',
		topleft: '\u006c',
		topright: '\u006b',
		bottomright: '\u006a',
		bottomleft: '\u006d'
	},
	ascii: {
		on: '',
		off: '',
		horiz: '-',
		verti: '|',
		topleft: '+',
		topright: '+',
		bottomright: '+',
		bottomleft: '+'
	}
};

/* vim: set ts=8 sts=8 sw=8 noet: */
