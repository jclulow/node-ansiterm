/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2017, Cody Mello
 */

var assert = require('assert-plus');
var mod_jsprim = require('jsprim');
var mod_stream = require('stream');
var mod_term = require('../');
var mod_util = require('util');
var test = require('tape');

var ESC = '\u001b';
var CSI = ESC + '[';
var SS3 = ESC + 'O';

var NO_MODS = {
	shift: false,
	alt: false,
	control: false,
	meta: false
};

var PRESS_SHIFT = mod_jsprim.mergeObjects({ shift: true }, null, NO_MODS);
var PRESS_META = mod_jsprim.mergeObjects({ meta: true }, null, NO_MODS);
var PRESS_CNTRL = mod_jsprim.mergeObjects({ control: true }, null, NO_MODS);
var PRESS_ALT = mod_jsprim.mergeObjects({ alt: true }, null, NO_MODS);

function MockTTY() {
    mod_stream.PassThrough.call(this);
}
mod_util.inherits(MockTTY, mod_stream.PassThrough);

MockTTY.prototype.isTTY = true;

MockTTY.prototype.setRawMode = function () {
    
};

function expectControl(seq, exp) {
	return function (t) {
		function done() {
			term.removeAllListeners('keypress');
			term.removeAllListeners('control');
			term.removeAllListeners('special');

			t.end();
		}

		term.on('keypress', function (c) {
			t.fail('unexpected "keypress": ' + c);
			done();
		});

		term.on('control', function (ctrl) {
			t.deepEqual(ctrl, exp);
			done();
		});

		term.on('special', function (name) {
			t.fail('unexpected "special": ' + name);
			done();
		});

		stdin.write(seq);
	};
}


function expectKeypress(seq, exp) {
	return function (t) {
		function done() {
			term.removeAllListeners('keypress');
			term.removeAllListeners('control');
			term.removeAllListeners('special');

			t.end();
		}

		term.on('keypress', function (c) {
			t.deepEqual(c, exp);
			done();
		});

		term.on('control', function (ctrl) {
			t.fail('unexpected "control": ' + JSON.stringify(ctrl));
			done();
		});

		term.on('special', function (name) {
			t.fail('unexpected "special": ' + name);
			done();
		});

		stdin.write(seq);
	};
}


function expectSpecial(seq, exp, emods) {
	return function (t) {
		function done() {
			term.removeAllListeners('keypress');
			term.removeAllListeners('control');
			term.removeAllListeners('special');

			t.end();
		}

		term.on('keypress', function (c) {
			t.fail('unexpected "keypress": ' + c);
			done();
		});

		term.on('control', function (ctrl) {
			t.fail('unexpected "control": ' + JSON.stringify(ctrl));
			done();
		});

		term.on('special', function (name, mods) {
			t.deepEqual(name, exp, 'correct special key');
			t.deepEqual(mods, emods, 'correct mods');
			done();
		});

		stdin.write(seq);
	};
}


var stdin = new MockTTY();
var stdout = new MockTTY();
var stderr = new MockTTY();

var term = new mod_term.ANSITerm({
	stdin: stdin,
	stdout: stdout,
	stderr: stderr,
});


test('simple keypresses', function (t) {
	t.test('press "k"', expectKeypress('k', 'k'));
	t.test('press "a"', expectKeypress('a', 'a'));
	t.test('press "Z"', expectKeypress('Z', 'Z'));
	t.test('press "0"', expectKeypress('0', '0'));
	t.test('press "1"', expectKeypress('1', '1'));
	t.test('press "2"', expectKeypress('2', '2'));
	t.test('press "&"', expectKeypress('&', '&'));
	t.test('press "^"', expectKeypress('^', '^'));
	t.test('press "["', expectKeypress('[', '['));
	t.test('press "]"', expectKeypress(']', ']'));
});


test('control characters', function (t) {
	t.test('press ^C',
	    expectControl('\u0003', { key: '^C', ascii: 'ETX' }));
	t.test('press ^D',
	    expectControl('\u0004', { key: '^D', ascii: 'EOT' }));
	t.test('press Tab',
	    expectControl('\u0009', { key: '^I', ascii: 'HT' }));
	t.test('press Enter',
	    expectControl('\u000a', { key: '^J', ascii: 'LF' }));
	t.test('press ^V',
	    expectControl('\u0016', { key: '^V', ascii: 'SYN' }));
});


test('simple arrow keys', function (t) {
	t.test('Using CSI sequence', function (t2) {
		t2.test('Up', expectSpecial(CSI + 'A', 'up', NO_MODS));
		t2.test('Down', expectSpecial(CSI + 'B', 'down', NO_MODS));
		t2.test('Right', expectSpecial(CSI + 'C', 'right', NO_MODS));
		t2.test('Left', expectSpecial(CSI + 'D', 'left', NO_MODS));
	});

	t.test('Using SS3 sequence', function (t2) {
		t2.test('Up', expectSpecial(SS3 + 'A', 'up', NO_MODS));
		t2.test('Down', expectSpecial(SS3 + 'B', 'down', NO_MODS));
		t2.test('Right', expectSpecial(SS3 + 'C', 'right', NO_MODS));
		t2.test('Left', expectSpecial(SS3 + 'D', 'left', NO_MODS));
	});
});

test('arrow keys with modifiers', function (t) {
	t.test('shift', function (t2) {
		t2.test('Up', expectSpecial(CSI + '1;2A', 'up', PRESS_SHIFT));
		t2.test('Down', expectSpecial(CSI + '1;2B', 'down', PRESS_SHIFT));
		t2.test('Right', expectSpecial(CSI + '1;2C', 'right', PRESS_SHIFT));
		t2.test('Left', expectSpecial(CSI + '1;2D', 'left', PRESS_SHIFT));
	});

	t.test('alt', function (t2) {
		t2.test('Up', expectSpecial(CSI + '1;3A', 'up', PRESS_ALT));
		t2.test('Down', expectSpecial(CSI + '1;3B', 'down', PRESS_ALT));
		t2.test('Right', expectSpecial(CSI + '1;3C', 'right', PRESS_ALT));
		t2.test('Left', expectSpecial(CSI + '1;3D', 'left', PRESS_ALT));
	});

	t.test('control', function (t2) {
		t2.test('Up', expectSpecial(CSI + '1;5A', 'up', PRESS_CNTRL));
		t2.test('Down', expectSpecial(CSI + '1;5B', 'down', PRESS_CNTRL));
		t2.test('Right', expectSpecial(CSI + '1;5C', 'right', PRESS_CNTRL));
		t2.test('Left', expectSpecial(CSI + '1;5D', 'left', PRESS_CNTRL));
	});

	t.test('meta', function (t2) {
		t2.test('Up', expectSpecial(CSI + '1;9A', 'up', PRESS_META));
		t2.test('Down', expectSpecial(CSI + '1;9B', 'down', PRESS_META));
		t2.test('Right', expectSpecial(CSI + '1;9C', 'right', PRESS_META));
		t2.test('Left', expectSpecial(CSI + '1;9D', 'left', PRESS_META));
	});

	// Mixed:
	t.test('mixed', function (t2) {
		t2.test('Shift + Alt + Up',
		    expectSpecial(CSI + '1;4A', 'up', {
			shift: true,
			alt: true,
			control: false,
			meta: false
		}));

		t2.test('Shift + Control + Down',
		    expectSpecial(CSI + '1;6B', 'down', {
			shift: true,
			alt: false,
			control: true,
			meta: false
		}));

		t2.test('Alt + Control + Right',
		    expectSpecial(CSI + '1;7C', 'right', {
			shift: false,
			alt: true,
			control: true,
			meta: false
		}));

		t2.test('Shift + Alt + Ctrl + Meta + Left',
		    expectSpecial(CSI + '1;16D', 'left', {
			shift: true,
			alt: true,
			control: true,
			meta: true
		}));
	});
});


test('simple function keys', function (t) {
	t.test('Using CSI sequence', function (t2) {
		t2.test('F1', expectSpecial(CSI + '11~', 'F1', NO_MODS));
		t2.test('F2', expectSpecial(CSI + '12~', 'F2', NO_MODS));
		t2.test('F3', expectSpecial(CSI + '13~', 'F3', NO_MODS));
		t2.test('F4', expectSpecial(CSI + '14~', 'F4', NO_MODS));
		t2.test('F5', expectSpecial(CSI + '15~', 'F5', NO_MODS));
		t2.test('F6', expectSpecial(CSI + '17~', 'F6', NO_MODS));
		t2.test('F7', expectSpecial(CSI + '18~', 'F7', NO_MODS));
		t2.test('F8', expectSpecial(CSI + '19~', 'F8', NO_MODS));
	});

	t.test('Using SS3 sequence', function (t2) {
		t2.test('F1', expectSpecial(SS3 + 'P', 'F1', NO_MODS));
		t2.test('F2', expectSpecial(SS3 + 'Q', 'F2', NO_MODS));
		t2.test('F3', expectSpecial(SS3 + 'R', 'F3', NO_MODS));
		t2.test('F4', expectSpecial(SS3 + 'S', 'F4', NO_MODS));
	});
});

test('page movement', function (t) {
	t.test('normal keys', function (t2) {
		t2.test('home', expectSpecial(CSI + '1~', 'home', NO_MODS));
		t2.test('home', expectSpecial(CSI + 'H', 'home', NO_MODS));
		t2.test('end', expectSpecial(CSI + '4~', 'end', NO_MODS));
		t2.test('end', expectSpecial(CSI + 'F', 'end', NO_MODS));
		t2.test('page down', expectSpecial(CSI + '5~', 'prior', NO_MODS));
		t2.test('page up', expectSpecial(CSI + '6~', 'next', NO_MODS));
	});

	t.test('with modifiers', function (t2) {
		t2.test('shift + home',
		    expectSpecial(CSI + '1;2~', 'home', PRESS_SHIFT));
		t2.test('control + home',
		    expectSpecial(CSI + '1;5H', 'home', PRESS_CNTRL));
		t2.test('meta + end',
		    expectSpecial(CSI + '4;9~', 'end', PRESS_META));
		t2.test('alt + end',
		    expectSpecial(CSI + '1;3F', 'end', PRESS_ALT));
		t2.test('control + page down',
		    expectSpecial(CSI + '5;5~', 'prior', PRESS_CNTRL));
		t2.test('alt + page up',
		    expectSpecial(CSI + '6;3~', 'next', PRESS_ALT));
	});
});
