#!/usr/bin/env node

var exit = process.exit;
var util = require('util');
var ANSITerm = require('./ansiterm').ANSITerm;

var at = new ANSITerm();
at.clear();

at.on('^C', function() {
  at.clear();
  at.logerr('OH NO, ^C!');
  at.cursor(true);
  exit(0);
});

var ESC = '\u001b';
var CSI = ESC + '[';


function _many(glyph, num)
{
  var s = '';
  while (s.length < num)
    s += glyph;
  return s;
}

function _ldon() { at.write(ESC + '(0'); }
function _ldoff() { at.write(ESC + '(B'); }
var hline = _many('\u0071', process.stdout.columns);

at.reverse();

var FIRST = 3;
var LAST = 12;
var AGAIN = 40;

_ldon();
  at.write(CSI + '1m');

  at.moveto(1, FIRST);
  at.write(hline + CSI + '8G' + '  COMMAND PROMPT  ');

  at.moveto(1, LAST);
  at.write(hline + CSI + '8G' + '  OBJECT LIST  ');

  at.moveto(1, AGAIN);
  at.write(hline + CSI + '8G' + '  INSPECTOR  ');
_ldoff();

at.reset();

function _resetscroll() {
  at.write(CSI + (FIRST + 1) + ';' + (LAST - 1) + 'r');
}
_resetscroll();

at.moveto(1, LAST - 1);




var CODEAA = 'A'.charCodeAt(0);
var CODEZZ = 'Z'.charCodeAt(0);
var CODEZ = 'z'.charCodeAt(0);
var CODEA = 'a'.charCodeAt(0);
var CODE0 = '0'.charCodeAt(0);
var CODE9 = '9'.charCodeAt(0);
var CODEOTHSTR = ' _-!@#$%^&*()_+-=[]{}\\|;\':",./<>?`~';
var CODEOTH = [];
for (var iii = 0; iii < CODEOTHSTR.length; iii++)
  CODEOTH.push(CODEOTHSTR.charCodeAt(iii));
function _isprint(k) {
  if (k >= CODEAA && k <= CODEZZ) return true;
  if (k >= CODEA && k <= CODEZ) return true;
  if (k >= CODE0 && k <= CODE9) return true;
  if (CODEOTH.indexOf(k) !== -1) return true;
  return false;
}

function _downthere(str)
{
  at.write(ESC + '7'); // save

  at.write(CSI + (AGAIN + 2) + ';' + (process.stdout.rows - 8) + 'r');
  at.moveto(1, AGAIN + 2);
  at.write(CSI + 'J'); // erase down

  str.split(/[\n\r]/).forEach(function(line) {
    var ll = line.substr(0, process.stdout.columns - 2);
    at.write(CSI + '4G' + line + ESC + 'D');
  });

  _resetscroll();
  at.write(ESC + '8'); // restore
}

function _dothings(str)
{
  var m = str.match(/^i (.*)$/);
  if (m) {
    _downthere(util.inspect(global[m[1]], false, null, true));
    return;
  }

  _output('I\'m sorry, I don\'t understand: ' + str);
}

function _output(str)
{
  at.write(CSI + '4G' + ' ** ' + str + ESC + 'D');
}


var _PROMPT = ' :: ';
function _prompt()
{
  at.write(CSI + '4G' + _PROMPT);
}

at.on('up', function() {
});
at.on('CR', function(k) {
  at.write(ESC + 'D' + CSI + '4G');
  _dothings(s);
  s = '';
  _prompt();
});
var s = '';
at.on('keypress', function(k) {
  if (k === 0x02) return _inssel();

  if (!_isprint(k)) return;

  if (s.length === process.stdout.columns - 6 - _PROMPT.length) return;

  var ts = String.fromCharCode(k);
  s += ts;

  at.write(ts);
});
function _bsdel(k) {
  if (s.length > 0) {
    s = s.substr(0, s.length - 1);
    at.write(CSI + 'D' + ' ' + CSI + 'D');
  }
}
at.on('BS', _bsdel);
at.on('DEL', _bsdel);


_prompt();


function _clock()
{
  at.write(ESC + '7');
  at.cursor(false);
  var s = new Date().toLocaleString();
  at.moveto(process.stdout.columns - 2 - s.length, 2);
  at.write(CSI + '1m' + s);
  at.cursor(true);
  at.write(ESC + '8');
}
setInterval(_clock, 1000);


var KEYS = Object.keys(global).sort();
var topat = 0; // which index into KEYS is the top of the window?
var selected = 0; // which index into KEYS is presently selected?
function _listbox()
{
  at.write(ESC + '7'); // save

  at.write(CSI + (LAST + 2) + ';' + (AGAIN - 2) + 'r');
  at.moveto(1, LAST + 2);
  //at.write(CSI + 'J'); // erase down

  KEYS.forEach(function(line, idx) {
    if (selected === idx) at.reverse();
    var ll = line.substr(0, process.stdout.columns - 2);
    at.write(CSI + '4G' + ll + ESC + 'D');
    if (selected === idx) at.reset();
  });

  _resetscroll();
  at.write(ESC + '8'); // restore
}

function _listboxScroll2(down)
{
  if (!down && selected <= 0) return;
  if (down && selected + 1 >= KEYS.length) return;

  at.write(ESC + '7'); // save
  at.cursor(false);

  var ll = KEYS[selected].substr(0, process.stdout.columns - 2);
  at.moveto(1, LAST + 2 + selected);
  at.write(CSI + '4G' + ll);

  selected += (down ? 1 : -1);

  var ll = KEYS[selected].substr(0, process.stdout.columns - 2);
  at.reverse();
  at.moveto(1, LAST + 2 + selected);
  at.write(CSI + '4G' + ll);

  _resetscroll();
  at.write(ESC + '8'); // restore
  at.cursor(true);
}

function _listboxScroll(down)
{
  if (down && offset === 0)
    return;
  offset += (down ? -1 : 1);

  at.write(ESC + '7'); // save

  at.cursor(false);

  at.write(CSI + (LAST + 2) + ';' + (AGAIN - 2) + 'r');
  //at.write(CSI + 'J'); // erase down
  //

  // scroll one:
  at.moveto(1, (down ? AGAIN - 2 : LAST + 2));
  at.write(ESC + (down ? 'D' : 'M'));


  at.cursor(true);
  _resetscroll();
  at.write(ESC + '8'); // restore
}


at.on('up', function() { _listboxScroll2(false); });
at.on('down', function() { _listboxScroll2(true); });

_listbox();

function _inssel()
{
  if (typeof (global[KEYS[selected]]) === 'function')
    _downthere(global[KEYS[selected]].toString());
  else
    _downthere(util.inspect(global[KEYS[selected]], false, null, true));
}
_output('NB: Use cursor up/down to select an Object from the List');
_output('    Then, use CTRL+B to inspect it.');
_prompt();
