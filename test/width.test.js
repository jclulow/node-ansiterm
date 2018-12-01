/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2018, Cody Mello
 */

var assert = require('assert-plus');
var mod_jsprim = require('jsprim');
var mod_stream = require('stream');
var mod_term = require('../');
var mod_util = require('util');
var test = require('tape');

var wcswidth = mod_term.wcswidth;
var forEachGrapheme = mod_term.forEachGrapheme;

function decompose(s, f) {
	var graphs = [];
	forEachGrapheme(s, function (g, w) {
		graphs.push([ g, w ]);
	});
	f(graphs, wcswidth(s));
}

function simple(t, s, expected) {
	decompose(s, function (graphs, w) {
		t.equal(w, expected, 'wcswidth(' + JSON.stringify(s) + ')');
		t.deepEqual(graphs, [ [ s, w ] ], 'correctly split');
	});
}

test('Empty string', function (t) {
	decompose('', function (graphs, w) {
		t.deepEqual(w, 0, 'no length');
		t.deepEqual(graphs, [], 'no parts');
	});
	t.end();
});

test('Printing ASCII characters', function (t) {
	/*
	 * Space and all printing ASCII characters are
	 * 1 column wide.
	 */
	for (var cp = 0x20; cp < 0x7F; cp++) {
		simple(t, String.fromCharCode(cp), 1);
	}
	t.end();
});

test('ASCII control characters', function (t) {
	simple(t, '\u0000', 0);
	simple(t, '\u0001', -1);
	simple(t, '\u0011', -1);
	simple(t, '\u007F', -1);
	t.end();
});

test('Non-BMP Surrogate Pairs', function (t) {
	simple(t, '\uD84D\uDE00', 2);
	simple(t, '\uD83D\uDE00', 2);
	simple(t, '\uD83E\uDDD0', 2);
	t.end();
});

test('Spacing diacritics', function (t) {
	/*
	 * These are diacritics that don't combine with the previous
	 * character, but instead display on their own.
	 */
	simple(t, '\u00B4', 1);
	simple(t, '\u02CA', 1);
	t.end();
});

test('Combining characters', function (t) {
	simple(t, '\u0061\u030A', 1);
	simple(t, '\u0B15\u0B44', 1);
	t.end();
});

test('Emoji presentation forms', function (t) {
	/*
	 * Unicode defines a block called "Variation Selectors", which are
	 * combining characters that pick a different look for the preceding
	 * character. For example the "#" character (U+0023), can be given a
	 * different look by following it with U+FE0E or U+FE0F, or give serifs
	 * to mathematical operators. You can see some other examples here:
	 *
	 *     http://unicode.org/emoji/charts/emoji-variants.html
	 *
	 * Doing this does *not* change the East Asian Width, so, while they
	 * might have an emoji presentation and may display overlapping (if
	 * the terminal even displays it differently), they do not advance
	 * the cursor.
	 */
	simple(t, '\u0023\uFE0E', 1);
	simple(t, '\u0023\uFE0F', 1);
	t.end();
});

test('Wide, single-column characters', function (t) {
	/*
	 * While these display across multiple columns, they are not defined
	 * with a "Wide" or "Fullwidth" value for their East Asian Width. That
	 * means that most (all?) terminals will treat them as occupying one
	 * column. They are shown here so that if that ever changes, it'll be
	 * obvious in a terminal editor or in the test output.
	 *
	 * These tend to be ligatures, but they are also sometimes characters
	 * from non-East Asian scripts.
	 */
	simple(t, 'ﷲ', 1);
	simple(t, '﷽', 1);
	simple(t, '﷼', 1);
	simple(t, '𐎮', 1);
	simple(t, '𝁅', 1);
	simple(t, 'ﱑ', 1);
	simple(t, 'Ꜳ', 1);
	t.end();
});

test('Multicolumn characters', function (t) {
	simple(t, 'Ｃ', 2);
	simple(t, 'Ｉ', 2);
	simple(t, '한', 2);
	t.end();
});

test('forEachGrapheme', function (t) {
	function check(s, parts, expected) {
		var p = JSON.stringify(s) + ': ';
		decompose(s, function (graphs, w) {
			t.deepEqual(w, expected, p + 'correct parts');
			t.deepEqual(graphs, parts, p + 'correct length');
		});
	}

	check('', [ ], 0);

	check('ＣＨＩＣＫＥＮ', [
		[ 'Ｃ', 2 ], [ 'Ｈ', 2 ], [ 'Ｉ', 2 ],
		[ 'Ｃ', 2 ], [ 'Ｋ', 2 ], [ 'Ｅ', 2 ],
		[ 'Ｎ', 2]
	], 14);

	check('ＣHＩCＫEＮ', [
		[ 'Ｃ', 2 ], [ 'H', 1 ], [ 'Ｉ', 2 ],
		[ 'C', 1 ], [ 'Ｋ', 2 ], [ 'E', 1 ],
		[ 'Ｎ', 2]
	], 11);

	check('新疆 (Xinjiang)', [
		[ '新', 2 ], [ '疆', 2 ], [' ', 1 ], [ '(', 1 ],
		[ 'X', 1 ], [ 'i', 1 ], [ 'n', 1 ], [ 'j', 1 ],
		[ 'i', 1 ], [ 'a', 1 ], [ 'n', 1 ], [ 'g', 1 ],
		[ ')', 1 ]
	], 15);

	check('東京 (Tokyo)', [
		[ '東', 2 ], [ '京', 2 ], [ ' ', 1 ], [ '(', 1 ],
		[ 'T', 1 ], [ 'o', 1 ], [ 'k', 1 ],
		[ 'y', 1 ], [ 'o', 1 ], [ ')', 1 ]
	], 12);

	check('\u0001\u0000\u0011Q\u001B ', [
		[ '\u0001', -1], [ '\u0000', 0 ], [ '\u0011', -1 ],
		[ 'Q', 1 ], [ '\u001B', -1 ], [ ' ', 1 ]
	], -1);

	check('\u0001\u0011Q\u0000\u001B ', [
		[ '\u0001', -1], [ '\u0011', -1 ], [ 'Q\u0000', 1 ],
		[ '\u001B', -1 ], [ ' ', 1 ]
	], -1);

	check('i\u030A\u0327', [ [ 'i\u030A\u0327', 1 ] ], 1);
	check('\u030A\u0327i', [ [ '\u030A\u0327', 0 ], [ 'i', 1 ] ], 1);

	t.end();
});
