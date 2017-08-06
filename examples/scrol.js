#!/usr/bin/env node
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2013, Joshua M. Clulow
 */

var exit = process.exit;
var util = require('util');
var ANSITerm = require('../lib/ansiterm').ANSITerm;

var at = new ANSITerm();
at.clear();

var ESC = '\u001b';
var CSI = ESC + '[';

var VT_SAVE_CURSOR = ESC + '7';
var VT_RESTORE_CURSOR = ESC + '8';

function _many(glyph, num)
{
  var s = '';
  while (s.length < num)
    s += glyph;
  return s;
}

var hline = _many('\u0071', process.stdout.columns);

at.reverse();

var FIRST = 3;
var LAST = 12;
var AGAIN = 40;

at.write(CSI + '1;36m'); // bold cyan

at.enableLinedraw();
  at.drawHorizontalLine(FIRST);
  at.drawHorizontalLine(LAST);
  at.drawHorizontalLine(AGAIN);
at.disableLinedraw();

at.moveto(8, FIRST);
at.write('  COMMAND PROMPT  ');
at.moveto(8, LAST);
at.write('  OBJECT LIST  ');
at.moveto(8, AGAIN);
at.write('  INSPECTOR  ');

at.reset();

function _resetscroll() {
  at.write(CSI + (FIRST + 1) + ';' + (LAST - 1) + 'r');
}
_resetscroll();

at.moveto(1, LAST - 1);


function _downthere(str)
{
  at.write(VT_SAVE_CURSOR); // save

  at.write(CSI + (AGAIN + 2) + ';' + (process.stdout.rows - 1) + 'r');
  at.moveto(1, AGAIN + 2);
  at.write(CSI + 'J'); // erase down

  str.split(/[\n\r]/).forEach(function(line) {
    var ll = line.substr(0, process.stdout.columns - 6) +
      (line.length > process.stdout.columns - 6 ? CSI + '1;33m$' + CSI + 'm' : '');
    at.write(CSI + '4G' + ll + ESC + 'D');
  });

  _resetscroll();
  at.write(VT_RESTORE_CURSOR); // restore
}

function _dothings(str)
{
  var m = str.match(/^i (.*)$/);
  if (m) {
    _downthere(util.inspect(global[m[1]], false, null));
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

at.on('control', function (ctrl) {
  switch (ctrl.ascii) {
  case 'STX':
    _inssel();
    break;
  case 'ETX':
    exit(1);
    break;
  case 'CR':
    at.write(ESC + 'D' + CSI + '4G');
    _dothings(s);
    s = '';
    _prompt();
    break;
  case 'BS':
  case 'DEL':
    _bsdel();
    break;
  default:
    break;
  }
});

var s = '';

at.on('keypress', function(k) {
  if (s.length === process.stdout.columns - 6 - _PROMPT.length) {
    return;
  }

  s += k;

  at.write(k);
});

function _bsdel() {
  if (s.length > 0) {
    s = s.substr(0, s.length - 1);
    at.write(CSI + 'D' + ' ' + CSI + 'D');
  }
}


_prompt();


function _clock()
{
  at.write(VT_SAVE_CURSOR);
  at.cursor(false);

  at.moveto(1, 2);
  var s = new Date().toLocaleString();
  var len = process.stdout.columns - 2 - s.length;
  at.write(CSI + '1m' + CSI + '2G SOME KIND OF INSPECTOR!' + CSI + len + 'G' + s);

  at.cursor(true);
  at.write(VT_RESTORE_CURSOR);
  at.reset();
}
setInterval(_clock, 1000);


var KEYS = Object.keys(global).sort();
var topat = 0; // which index into KEYS is the top of the window?
var selected = 0; // which index into KEYS is presently selected?
function _listbox()
{
  at.write(VT_SAVE_CURSOR); // save

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
  at.write(VT_RESTORE_CURSOR); // restore
  at.reset();
}

function _listboxScroll2(down)
{
  if (!down && selected <= 0) return;
  if (down && selected + 1 >= KEYS.length) return;

  at.write(VT_SAVE_CURSOR); // save
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
  at.write(VT_RESTORE_CURSOR); // restore
  at.reset();
  at.cursor(true);
}

function _listboxScroll(down)
{
  if (down && offset === 0)
    return;
  offset += (down ? -1 : 1);

  at.write(VT_SAVE_CURSOR); // save

  at.cursor(false);

  at.write(CSI + (LAST + 2) + ';' + (AGAIN - 2) + 'r');
  //at.write(CSI + 'J'); // erase down
  //

  // scroll one:
  at.moveto(1, (down ? AGAIN - 2 : LAST + 2));
  at.write(ESC + (down ? 'D' : 'M'));


  at.cursor(true);
  _resetscroll();
  at.write(VT_RESTORE_CURSOR); // restore
}


at.on('special', function (name, mods) {
  switch (name) {
  case 'up':
    _listboxScroll2(false);
    break;
  case 'down':
    _listboxScroll2(true);
    break;
  default:
    break;
  }
});

_listbox();

function _inssel()
{
  if (typeof (global[KEYS[selected]]) === 'function')
    _downthere(global[KEYS[selected]].toString());
  else
    _downthere(util.inspect(global[KEYS[selected]], false, null));
}
_output('NB: Use cursor up/down to select an Object from the List');
_output('    Then, use CTRL+B to inspect it.');
_prompt();
