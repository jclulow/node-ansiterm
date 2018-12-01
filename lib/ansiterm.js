/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joshua M. Clulow
 * Copyright (c) 2017, Cody Mello
 */

/* vim: set ts=8 sts=8 sw=8 noet: */

var assert = require('assert-plus');
var mod_buffer = require('safer-buffer');
var mod_jsprim = require('jsprim');
var mod_util = require('util');
var mod_events = require('events');

var mod_grapheme = require('./grapheme');
var mod_linedraw = require('./linedraw');

var Buffer = mod_buffer.Buffer;

/*
 * Constants:
 */
var ESC = '\u001b';
var CSI = ESC + '[';

var META_VALUES = {
	'1': 'home',
	'2': 'insert',
	'3': 'delete',
	'4': 'end',
	'5': 'prior',
	'6': 'next',
	'11': 'F1',
	'12': 'F2',
	'13': 'F3',
	'14': 'F4',
	'15': 'F5',
	'17': 'F6',
	'18': 'F7',
	'19': 'F8',
	'20': 'F9',
	'21': 'F10',
	'23': 'F11',
	'24': 'F12',
	'25': 'F13',
	'26': 'F14',
	'28': 'F15',
	'29': 'F16',
	'31': 'F17',
	'32': 'F18',
	'33': 'F19',
	'34': 'F20',
};

var DEFAULT_OPTS = {
	stdin: process.stdin,
	stdout: process.stdout,
	stderr: process.stderr
};

var OPTIONS_SCHEMA = {
	type: 'object',
	properties: {
		stdin: {
			type: 'object'
		},
		stdout: {
			type: 'object'
		},
		stderr: {
			type: 'object'
		}
	}
};

var PARSETABLE = require('./parsetable');

function
_ptt(parsetable, state, c)
{
	var pte = parsetable[state];
	if (!pte) {
		throw (new Error('unknown state: ' + state));
	}

	var dptt = null;
	for (var i = 0; i < pte.length; i++) {
		var ptt = pte[i];
		if (ptt.hasOwnProperty('c')) {
			if (typeof (ptt.c) === 'string')
				ptt.c = ptt.c.charCodeAt(0);
			if (ptt.c === c)
				return (ptt);
		} else {
			dptt = ptt;
		}
	}
	if (dptt === null) {
		throw (new Error('could not find transition from ' + state +
		    ' for ' + c));
	}
	return (dptt);
}

/*
 * For some inputs, the CSI sequence is followed by a number indicating
 * the modifiers that were held during the keypress. These are:
 *
 *      Code     Modifiers
 *  ---------+---------------------------
 *     2     | Shift
 *     3     | Alt
 *     4     | Shift + Alt
 *     5     | Control
 *     6     | Shift + Control
 *     7     | Alt + Control
 *     8     | Shift + Alt + Control
 *     9     | Meta
 *     10    | Meta + Shift
 *     11    | Meta + Alt
 *     12    | Meta + Alt + Shift
 *     13    | Meta + Ctrl
 *     14    | Meta + Ctrl + Shift
 *     15    | Meta + Ctrl + Alt
 *     16    | Meta + Ctrl + Alt + Shift
 *  ---------+---------------------------
 *
 *  By substracting 1 from these values, we can treat them as a bitmask.
 */
function
processModifiers(mods, val)
{
	var n = mod_jsprim.parseInteger(val);
	if (n instanceof Error || n < 2 || n > 16) {
		return;
	}

	n -= 1;

	if ((n & 1) == 1) {
		mods.shift = true;
	}

	if ((n & 2) == 2) {
		mods.alt = true;
	}

	if ((n & 4) == 4) {
		mods.control = true;
	}

	if ((n & 8) == 8) {
		mods.meta = true;
	}
}

function
ANSITerm(opts)
{
	if (opts !== undefined) {
		assert.object(opts, 'opts');
		assert.optionalObject(opts.stdin, 'opts.stdin');
		assert.optionalObject(opts.stdout, 'opts.stdout');
		assert.optionalObject(opts.stderr, 'opts.stderr');
		opts = mod_jsprim.mergeObjects(opts, null, DEFAULT_OPTS);
	} else {
		opts = DEFAULT_OPTS;
	}

	mod_events.EventEmitter.call(this);
	var self = this;

	self.at_pos = 0;
	self.at_state = 'REST';
	self.at_buf = Buffer.alloc(0);
	self.at_store = Buffer.alloc(64);
	self.at_storepos = 0;

	/*
	 * XXX Should support opening /dev/tty directly to get the controlling
	 * terminal:
	 */
	self.at_in = opts.stdin;
	self.at_out = opts.stdout;
	self.at_err = opts.stderr;

	self.at_ldcount = 0;
	self.at_linedraw = mod_linedraw.vt100;
	//if (process.env.LANG && process.env.LANG.match(/[uU][tT][fF]-?8$/))
	//	self.linedraw = mod_linedraw.utf8;

	if (!self.at_in.isTTY || !self.at_out.isTTY)
		throw new Error('not a tty');

	if (!process.env.TERM || process.env.TERM === 'dumb')
		throw new Error('not a useful terminal');

	self.at_in.on('data', function __at_on_data(data) {
		var x = self.at_buf;
		self.at_buf = Buffer.alloc(self.at_buf.length + data.length);
		x.copy(self.at_buf);
		data.copy(self.at_buf, x.length);
		setImmediate(function () {
			self._procbuf();
		});
	});
	self.at_in.setRawMode(true);
	self.at_in.resume();

	process.on('SIGWINCH', function __at_on_sigwinch() {
		self.emit('resize', self.size());
	});
	process.on('exit', function __at_on_exit(err) {
		self.softReset();
	});
}
mod_util.inherits(ANSITerm, mod_events.EventEmitter);

ANSITerm.prototype._emit_after = function
_emit_after(toms, to_emit, v)
{
	var self = this;

	if (self._timeout)
		clearTimeout(self._timeout);
	self._timeout = setTimeout(function __at_on_timeout() {
		self.emit(to_emit, v);
		self.at_state = 'REST';
	}, toms);
};

ANSITerm.prototype._push_store = function
_push_store(b)
{
	this.at_store.writeUInt8(b, this.at_storepos++);
};

ANSITerm.prototype._fetch_store = function
_fetch_store(b)
{
	var s = this.at_store.toString('utf8', 0, this.at_storepos);

	this.at_storepos = 0;

	return (s);
};

ANSITerm.prototype._dump_invalid = function
_dump_invalid()
{
	for (var i = 0; i < this.at_storepos; ++i) {
		var k = String.fromCharCode(this.at_store[i]);

		this.emit('keypress', k);
	}

	this.at_pos--;
	this.at_storepos = 0;
	this.at_state = 'REST';
};

ANSITerm.prototype._procbuf = function
_procbuf()
{
	var self = this;

	if (self.at_pos >= self.at_buf.length)
		return;

	if (self._timeout)
		clearTimeout(self._timeout);
	self._timeout = null;

	var c = self.at_buf[self.at_pos];
	var ptt = _ptt(PARSETABLE, self.at_state, c);

	self.debug('CHAR: ' + c);

	for (var i = 0; i < ptt.acts.length; i++) {
		var act = ptt.acts[i];

		switch (act.a) {
		case 'KEYREAD':
			if ((c & 248) === 240) {
				// 0b11110xxx
				self.at_state = 'UTF8-REM3';
			} else if ((c & 240) === 224) {
				// 0b1110xxxx
				self.at_state = 'UTF8-REM2';
			} else if ((c & 224) === 192) {
				// 0b110xxxxx
				self.at_state = 'UTF8-REM1';
			} else {
				self.emit('keypress', String.fromCharCode(c));
				break;
			}

			self._push_store(c);
			break;
		case 'KEYSTEP':
			if ((c & 192) !== 128) {
				// Not 0b10xxxxxx
				self._dump_invalid();
				break;
			}

			self._push_store(c);

			if (act.c) {
				self.emit('keypress', self._fetch_store());
			}

			self.at_state = act.b;
			break;
		case 'STATE':
			self.debug('STATE: ' + self.at_state + ' -> ' + act.b);
			self.at_state = act.b;
			break;
		case 'TIMEOUT':
			self.debug('TIMEOUT: ' + act.e);
			self._emit_after(10, act.b, act.v);
			break;
		case 'EMIT':
			self.debug('EMIT: ' + act.b);
			if (act.d && self.listeners(act.b).length < 1) {
				self.clear();
				self.moveto(1, 1);
				self.write('terminated (' + act.b + ')\n');
				process.exit(1);
			}
			if (act.c) {
				self.emit(act.b, String.fromCharCode(c));
			} else if (act.v) {
				self.emit(act.b, act.v, act.m);
			} else {
				self.emit(act.b);
			}
			break;
		case 'STORE':
			self.debug('STORE: ' + c);
			self._push_store(c);
			break;
		case 'RESET':
			self.debug('RESET');
			self._fetch_store();
			break;
		case 'CALL':
			self.debug('CALL: ' + act.b);
			self[act.b](act.v);
			break;
		default:
			throw new Error('unknown action ' + act.a);
		}
	}

	self.at_pos++;
	setImmediate(function () {
		self._procbuf();
	});
};

ANSITerm.prototype.write = function
write(str)
{
	this.at_out.write(str);
};

ANSITerm.prototype._curpos = function
_curpos()
{
	var self = this;

	var x = self._fetch_store().split(/;/);
	self.debug('CURSOR POSITION: ' + x[0] + ', ' + x[1]);
	self.emit('position', x[0], x[1]);
};

ANSITerm.prototype._devstat = function
_devstat()
{
	var self = this;
	var status = self._fetch_store();

	self.debug('DEVICE STATUS: ' + status);
};

ANSITerm.prototype._fnkeys = function
_fnkeys(name)
{
	assert.string(name, 'name');

	var self = this;

	var modchars = self._fetch_store().split(/;/);

	var mods = {
		alt: false,
		control: false,
		meta: false,
		shift: false
	};

	for (var i = 1; i < modchars.length; i++) {
		processModifiers(mods, modchars[i]);
	}

	self.emit('special', name, mods);
};

ANSITerm.prototype._inkeys = function
_inkeys()
{
	var self = this;

	var s = self._fetch_store();
	var x = s.split(/;/);
	var mods = {
		alt: false,
		control: false,
		meta: false,
		shift: false
	};

	for (var i = 1; i < x.length; i++) {
		processModifiers(mods, x[i]);
	}

	if (META_VALUES.hasOwnProperty(x[0])) {
		self.emit('special', META_VALUES[x[0]], mods);
	} else {
		throw (new Error('unknown input key sequence ' + s));
	}
};

ANSITerm.prototype.debug = function
debug(str)
{
	var self = this;

	return;

	self.at_err.write(str + '\n');
};

ANSITerm.prototype.logerr = function
logerr(str)
{
	var self = this;

	self.at_err.write(str + '\n');
};

ANSITerm.prototype.clear = function
clear()
{
	var self = this;

	self.at_out.write(CSI + '2J');
};

ANSITerm.prototype.moveto = function
moveto(x, y)
{
	var self = this;

	if (x < 0)
		x = self.at_out.columns + x + 1;
	if (y < 0)
		y = self.at_out.rows + y + 1;
	self.at_out.write(CSI + y + ';' + x + 'f');
};

ANSITerm.prototype.cursor = function
cursor(show)
{
	var self = this;

	self.at_out.write(CSI + '?25' + (show ? 'h' : 'l'));
};

ANSITerm.prototype.bold = function
bold()
{
	var self = this;

	self.at_out.write(CSI + '1m');
};

ANSITerm.prototype.reverse = function
reverse()
{
	var self = this;

	self.at_out.write(CSI + '7m');
};

ANSITerm.prototype.colour256 = function
colour256(num, bg)
{
	var self = this;

	self.at_out.write(CSI + (bg ? '48' : '38') + ';5;' + num + 'm');
};
ANSITerm.prototype.color256 = ANSITerm.prototype.colour256;

ANSITerm.prototype.reset = function
reset()
{
	var self = this;

	self.at_out.write(CSI + 'm');
};

ANSITerm.prototype.eraseLine = function
eraseLine()
{
	var self = this;

	self.at_out.write(CSI + '2K');
};

ANSITerm.prototype.eraseStartOfLine = function
eraseStartOfLine()
{
	var self = this;

	self.at_out.write(CSI + '1K');
};

ANSITerm.prototype.eraseEndOfLine = function
eraseEndOfLine()
{
	var self = this;

	self.at_out.write(CSI + 'K');
};

ANSITerm.prototype.insertMode = function
insertMode()
{
	var self = this;

	self.at_out.write(CSI + '4h');
};

ANSITerm.prototype.replaceMode = function
replaceMode()
{
	var self = this;

	self.at_out.write(CSI + '4l');
};

ANSITerm.prototype.drawHorizontalLine = function
drawHorizontalLine(y, xfrom, xto)
{
	var self = this;

	if (typeof (xfrom) !== 'number')
		xfrom = 1;
	if (typeof (xto) !== 'number')
		xto = self.at_out.columns;

	self.moveto(xfrom, y);
	self.enableLinedraw();

	if (false) {
		/*
		 * XXX Dubious auto-repeat control sequence...
		 */
		self.write(self.at_linedraw.horiz + CSI + (xto - xfrom) + 'b');
	} else {
		var s = '';
		for (var i = 0; i <= (xto - xfrom); i++) {
			s += self.at_linedraw.horiz;
		}
		self.write(s);
	}

	self.disableLinedraw();
};

ANSITerm.prototype.drawVerticalLine = function
drawVerticalLine(x, yfrom, yto)
{
	var self = this;

	if (typeof (yfrom) !== 'number')
		yfrom = 1;
	if (typeof (yto) !== 'number')
		yto = self.at_out.rows;

	self.moveto(x, yfrom);
	self.enableLinedraw();

	for (var p = yfrom; p <= yto; p++) {
		/*
		 * Draw vertical, move down:
		 */
		self.write(self.at_linedraw.verti + CSI + 'B' + CSI + x + 'G');
	}

	self.disableLinedraw();
};

ANSITerm.prototype.drawBox = function
drawBox(x1, y1, x2, y2)
{
	var self = this;

	if (typeof (x1) !== 'number')
		x1 = 1;
	if (typeof (y1) !== 'number')
		y1 = 1;
	if (typeof (x2) !== 'number')
		x2 = self.at_out.columns;
	if (typeof (y2) !== 'number')
		y2 = self.at_out.rows;

	var horizl = '';
	for (var p = x1 + 1; p <= x2 - 1; p++)
		horizl += self.at_linedraw.horiz;

	self.enableLinedraw();

	self.moveto(x1, y1);
	self.write(self.at_linedraw.topleft + horizl +
	    self.at_linedraw.topright);

	self.moveto(x1, y2);
	self.write(self.at_linedraw.bottomleft + horizl +
	    self.at_linedraw.bottomright);

	self.drawVerticalLine(x1, y1 + 1, y2 - 1);
	self.drawVerticalLine(x2, y1 + 1, y2 - 1);

	self.disableLinedraw();
};

ANSITerm.prototype.doubleHeight = function
doubleHeight(x, y, str)
{
	var self = this;

	self.moveto(x, y);
	self.write(ESC + '#3' + str);
	self.moveto(x, y + 1);
	self.write(ESC + '#4' + str);
};

ANSITerm.prototype.disableLinedraw = function
disableLinedraw()
{
	var self = this;

	if (self.at_ldcount === 0)
		return;
	self.at_ldcount--;
	if (self.at_ldcount === 0) {
		self.at_out.write(self.at_linedraw.off);
	}
};

ANSITerm.prototype.enableLinedraw = function
enableLinedraw()
{
	var self = this;

	if (self.at_ldcount === 0) {
		self.at_out.write(self.at_linedraw.on);
	}
	self.at_ldcount++;
};

ANSITerm.prototype.size = function
size()
{
	var self = this;

	return ({
		h: self.at_out.rows,
		w: self.at_out.columns
	});
};

ANSITerm.prototype.softReset = function
softReset()
{
	var self = this;

	self.cursor(true);
	self.replaceMode();
	self.reset();
};

module.exports = {
	ANSITerm: ANSITerm,
	wcwidth: mod_grapheme.wcwidth,
	wcswidth: mod_grapheme.wcswidth,
	forEachGrapheme: mod_grapheme.forEachGrapheme
};
