
var util = require('util');
var events = require('events');

var ESC = '\u001b';
var CSI = ESC + '[';

var parsetable = {
  'REST': [
    { c: 0x1b, acts: [ { a: 'STATE', b: 'ESCAPE' } ] },
    { c: 0x03, acts: [ { a: 'EMIT', b: '^C' } ] },
    { c: 0x04, acts: [ { a: 'EMIT', b: '^D' } ] },
    { c: 0x0d, acts: [ { a: 'EMIT', b: 'CR' } ] },
    { c: 0x0a, acts: [ { a: 'EMIT', b: 'LF' } ] },
    { c: 0x08, acts: [ { a: 'EMIT', b: 'BS' } ] },
    { c: 0x7f, acts: [ { a: 'EMIT', b: 'DEL' } ] },
    { c: 0x09, acts: [ { a: 'EMIT', b: 'TAB' } ] },
    { c: 0x15, acts: [ { a: 'EMIT', b: 'NAK' } ] },
    { acts: [ { a: 'EMIT', b: 'keypress', c: true } ] } // default
  ],
  'ESCAPE': [
    { acts: [ { a: 'EMIT', b: 'keypress', c: true }, { a: 'STATE', b: 'REST' } ] }, // default
    { c: '[', acts: [ { a: 'STATE', b: 'CTRLSEQ' } ] }
  ],
  'CTRLSEQ': [
    { c: '0', acts: [ { a: 'STORE' } ] },
    { c: '1', acts: [ { a: 'STORE' } ] },
    { c: '2', acts: [ { a: 'STORE' } ] },
    { c: '3', acts: [ { a: 'STORE' } ] },
    { c: '4', acts: [ { a: 'STORE' } ] },
    { c: '5', acts: [ { a: 'STORE' } ] },
    { c: '6', acts: [ { a: 'STORE' } ] },
    { c: '7', acts: [ { a: 'STORE' } ] },
    { c: '8', acts: [ { a: 'STORE' } ] },
    { c: '9', acts: [ { a: 'STORE' } ] },
    { c: ';', acts: [ { a: 'STORE' } ] },
    { c: 'n', acts: [ { a: 'CALL', b: _devstat }, { a: 'STATE', b: 'REST' } ] },
    { c: 'R', acts: [ { a: 'CALL', b: _curpos }, { a: 'STATE', b: 'REST' } ] },
    { c: 'A', acts: [ { a: 'EMIT', b: 'up' }, { a: 'STATE', b: 'REST' } ] },
    { c: 'B', acts: [ { a: 'EMIT', b: 'down' }, { a: 'STATE', b: 'REST' } ] },
    { c: 'C', acts: [ { a: 'EMIT', b: 'right' }, { a: 'STATE', b: 'REST' } ] },
    { c: 'D', acts: [ { a: 'EMIT', b: 'left' }, { a: 'STATE', b: 'REST' } ] },
  ]
};

function _up(self) { self.debug('UP'); }
function _down(self) { self.debug('DOWN'); }
function _right(self) { self.debug('RIGHT'); }
function _left(self) { self.debug('LEFT'); }

function _curpos(self)
{
  var x = self._store.split(/;/);
  self.debug('CURSOR POSITION: ' + x[0] + ', ' + x[1]);
  self.emit('position', x[0], x[1]);
  self._store = '';
}

function _devstat(self)
{
  self.debug('DEVICE STATUS: ' + self._store);
  self._store = '';
}

function _ptt(parsetable, state, c)
{
  var pte = parsetable[state];
  if (!pte) throw new Error('unknown state');

  var dptt = null;
  for (var i = 0; i < pte.length; i++) {
    var ptt = pte[i];
    if (ptt.hasOwnProperty('c')) {
      if (typeof (ptt.c) === 'string')
        ptt.c = ptt.c.charCodeAt(0);
      if (ptt.c === c)
        return ptt;
    } else {
      dptt = ptt;
    }
  }
  if (dptt === null)
    throw new Error('could not find transition from ' + state +
      ' for ' + c);
  return (dptt);
}

function _procbuf(self)
{
  if (self._pos >= self._buf.length)
    return;

  var c = (self._buf[self._pos]);
  var ptt = _ptt(parsetable, self._state, c);

  self.debug('CHAR: ' + c);

  ptt.acts.forEach(function(act) {
    switch (act.a) {
    case 'STATE':
      self.debug('STATE: ' + self._state + ' -> ' + act.b);
      self._state = act.b;
      break;
    case 'EMIT':
      self.debug('EMIT: ' + act.b);
      if (act.c)
        self.emit(act.b, c);
      else
        self.emit(act.b);
      break;
    case 'STORE':
      var sc = String.fromCharCode(c);
      self.debug('STORE: ' + sc);
      self._store += sc;
      break;
    case 'RESET':
      self.debug('RESET');
      self._store = '';
      break;
    case 'CALL':
      self.debug('CALL: ' + act.b.name);
      act.b(self);
      break;
    default:
      throw new Error('unknown action ' + act.a);
    }
  });
  self._pos++;

  process.nextTick(function() { _procbuf(self); });
}

function ANSITerm()
{
  events.EventEmitter.call(this);
  var self = this;

  self._pos = 0;
  self._state = 'REST';
  self._buf = new Buffer(0);
  self._store = '';
  self._in = process.stdin; // XXX
  self._out = process.stdout; // XXX
  self._err = process.stderr; // XXX

  if (!self._in.isTTY || !self._out.isTTY)
    throw new Error('not a tty');

  if (!process.env.TERM || process.env.TERM === 'dumb')
    throw new Error('not a useful terminal');

  self._in.on('data', function(data) {
    var x = self._buf;
    self._buf = new Buffer(self._buf.length + data.length);
    x.copy(self._buf);
    data.copy(self._buf, x.length);
    process.nextTick(function() { _procbuf(self); });
  });
  self._in.setRawMode(true);
  self._in.resume();

  self.debug = function at_debug(str) {
    return;
    self._err.write(str + '\n');
  };
  self.logerr = function at_logerr(str) {
    self._err.write(str + '\n');
  };
  self.clear = function at_clear() {
    self._out.write('\u001b[2J');
  };
  self.moveto = function at_moveto(x, y) {
    self._out.write(CSI + y + ';' + x + 'f');
  };
  self.write = function at_write(str) {
    self._out.write(str);
  };
  self.cursor = function at_cursor(curs) {
    self._out.write(CSI + '?25' + (curs ? 'h' : 'l'));
  };
  self.reverse = function at_reverse() {
    self._out.write(CSI + '7m');
  };
  self.reset = function at_reset() {
    self._out.write(CSI + 'm');
  };
  self.drawHorizontalLine = function at_drawHorizontalLine(y, xfrom, xto) {
    var s = '';
    for (var p = xfrom; p <= xto; p++)
      s += '-';
    self.moveto(xfrom, y);
    self.write(s);
  }
  self.drawVerticalLine = function at_drawVerticalLine(x, yfrom, yto) {
    for (var p = yfrom; p <= yto; p++) {
      self.moveto(x, p);
      self.write('|');
    }
  }
  self.size = function at_size() {
    return { h: self._out.rows, w: self._out.columns };
  }
  process.on('SIGWINCH', function() { self.emit('resize', self.size()) });
}
util.inherits(ANSITerm, events.EventEmitter);

exports.ANSITerm = ANSITerm;
