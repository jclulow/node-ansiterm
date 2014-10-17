/* vim: set ts=8 sts=8 sw=8 noet: */

var mod_util = require('util');
var mod_events = require('events');

var mod_linedraw = require('./linedraw');

/*
 * Constants:
 */
var ESC = '\u001b';
var CSI = ESC + '[';

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

function
ANSITerm()
{
	mod_events.EventEmitter.call(this);
	var self = this;

	self.at_pos = 0;
	self.at_state = 'REST';
	self.at_buf = new Buffer(0);
	self.at_store = '';

	/*
	 * XXX Should support opening /dev/tty directly to get the controlling
	 * terminal:
	 */
	self.at_in = process.stdin;
	self.at_out = process.stdout;
	self.at_err = process.stderr;

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
		self.at_buf = new Buffer(self.at_buf.length + data.length);
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
_emit_after(to_emit, toms)
{
	var self = this;

	if (self._timeout)
		clearTimeout(self._timeout);
	self._timeout = setTimeout(function __at_on_timeout() {
		self.emit(to_emit);
		self.at_state = 'REST';
	}, toms);
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
		case 'STATE':
			self.debug('STATE: ' + self.at_state + ' -> ' + act.b);
			self.at_state = act.b;
			break;
		case 'TIMEOUT':
			self.debug('TIMEOUT: ' + act.e);
			self._emit_after(act.e, 50);
			break;
		case 'EMIT':
			self.debug('EMIT: ' + act.b);
			if (act.d && self.listeners(act.b).length < 1) {
				self.clear();
				self.moveto(1, 1);
				self.write('terminated (' + act.b + ')\n');
				process.exit(1);
			}
			if (act.c)
				self.emit(act.b, c);
			else
				self.emit(act.b);
			break;
		case 'STORE':
			var sc = String.fromCharCode(c);
			self.debug('STORE: ' + sc);
			self.at_store += sc;
			break;
		case 'RESET':
			self.debug('RESET');
			self.at_store = '';
			break;
		case 'CALL':
			self.debug('CALL: ' + act.b);
			self[act.b]();
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

	var x = self.at_store.split(/;/);
	self.debug('CURSOR POSITION: ' + x[0] + ', ' + x[1]);
	self.emit('position', x[0], x[1]);
	self.at_store = '';
};

ANSITerm.prototype._devstat = function
_devstat()
{
	var self = this;

	self.debug('DEVICE STATUS: ' + self.at_store);
	self.at_store = '';
};

ANSITerm.prototype._inkeys = function
_inkeys()
{
	var self = this;

	var x = self.at_store.split(/;/);
	var mods = {
		shift: false,
		control: false
	};

	for (var i = 1; i < x.length; i++) {
		switch (x[i]) {
		case '2':
			mods.shift = true;
			break;
		case '5':
			mods.control = true;
			break;
		}
	}

	var emit = function (nm) {
		self.emit(nm, mods);
	};

	switch (x[0]) {
	case '1':
		emit('home');
		break;
	case '2':
		emit('insert');
		break;
	case '3':
		emit('delete');
		break;
	case '4':
		emit('end');
		break;
	case '5':
		emit('prior');
		break;
	case '6':
		emit('next');
		break;
	default:
		throw (new Error('unknown input key sequence ' +
		    self.at_store));
	}
	self.at_store = '';
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
	ANSITerm: ANSITerm
};
