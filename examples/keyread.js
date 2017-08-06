#!/usr/bin/env node
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joshua M. Clulow
 */

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
		if (mods.alt)
			at.write(' + alt ');
		if (mods.shift)
			at.write(' + shift ');
		if (mods.meta)
			at.write(' + meta ');
		if (mods.control)
			at.write(' + control ');
	}
	at.write('                                       ');
}

at.on('special', update);
at.on('control', function (info) {
	update(info.key);
});

at.on('keypress', function (chr) {
	if (chr === 'q' || chr === 'Q') {
		at.softReset();
		process.exit(0);
	}

	update(chr);
});
