#!/usr/bin/env node
/* vim: set ts=8 sts=8 sw=8 noet: */

var exit = process.exit;
var util = require('util');
var ANSITerm = require('../lib/ansiterm').ANSITerm;

var at = new ANSITerm();
at.clear();
at.moveto(1, 1);
at.write('KEY READER (PRESS Q TO QUIT)');

function
update(x, mods)
{
	at.moveto(10, 3);
	at.write(x);
	if (mods) {
		if (mods.shift)
			at.write(' + shift ');
		if (mods.control)
			at.write(' + control ');
	}
	at.write('                                       ');
}

function
attach_listener(thing)
{
	at.on(thing, function (mods) {
		update(thing, mods);
	});
}

var THINGS = [
	'up',
	'down',
	'left',
	'right',
	'next',
	'prior',
	'home',
	'end',
	'insert',
	'delete'
];

for (var i = 0; i < THINGS.length; i++) {
	attach_listener(THINGS[i]);
}

at.on('keypress', function (chr) {
	if (chr === 0x71 || chr === 0x51) {
		at.softReset();
		process.exit(0);
	}
});
