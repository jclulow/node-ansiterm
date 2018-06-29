/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joshua M. Clulow
 * Copyright (c) 2017, Cody Mello
 */

/*
 * Table of state transitions for parsing data inbound from the terminal.
 *
 * First level keys (e.g. 'REST') are the names of the parse engine states.
 * Each state has a list of objects that describe what to do ('acts') when
 * we receive a particular next character ('c').  An act has a name ('a'),
 * and some set of action-specific parameters ('b', 'c', etc).
 *
 * A state may have a default action (essentially an else clause) by
 * providing an entry _without_ a selecting character ('c').
 */

var NO_MODS = {
	alt: false,
	control: false,
	meta: false,
	shift: false
};

module.exports = {
  'REST': [
    { c: 0x1b, acts: [ { a: 'STATE', b: 'ESCAPE' },
                       { a: 'TIMEOUT', b: 'control', v: { key: '^[', ascii: 'ESC' } } ] },
    { c: 0x00, acts: [ { a: 'EMIT', b: 'control', v: { key: '^@', ascii: 'NUL' } } ] },
    { c: 0x01, acts: [ { a: 'EMIT', b: 'control', v: { key: '^A', ascii: 'SOH' } } ] },
    { c: 0x02, acts: [ { a: 'EMIT', b: 'control', v: { key: '^B', ascii: 'STX' } } ] },
    { c: 0x03, acts: [ { a: 'EMIT', b: 'control', v: { key: '^C', ascii: 'ETX' }, d: true } ] },
    { c: 0x04, acts: [ { a: 'EMIT', b: 'control', v: { key: '^D', ascii: 'EOT' } } ] },
    { c: 0x05, acts: [ { a: 'EMIT', b: 'control', v: { key: '^E', ascii: 'ENQ' }, } ] },
    { c: 0x06, acts: [ { a: 'EMIT', b: 'control', v: { key: '^F', ascii: 'ACK' }, } ] },
    { c: 0x07, acts: [ { a: 'EMIT', b: 'control', v: { key: '^G', ascii: 'BEL' }, } ] },
    { c: 0x08, acts: [ { a: 'EMIT', b: 'control', v: { key: '^H', ascii: 'BS' } } ] },
    { c: 0x09, acts: [ { a: 'EMIT', b: 'control', v: { key: '^I', ascii: 'HT' } } ] },
    { c: 0x0a, acts: [ { a: 'EMIT', b: 'control', v: { key: '^J', ascii: 'LF' } } ] },
    { c: 0x0b, acts: [ { a: 'EMIT', b: 'control', v: { key: '^K', ascii: 'VT' } } ] },
    { c: 0x0c, acts: [ { a: 'EMIT', b: 'control', v: { key: '^L', ascii: 'FF' } } ] },
    { c: 0x0d, acts: [ { a: 'EMIT', b: 'control', v: { key: '^M', ascii: 'CR' } } ] },
    { c: 0x0e, acts: [ { a: 'EMIT', b: 'control', v: { key: '^N', ascii: 'SO' } } ] },
    { c: 0x0f, acts: [ { a: 'EMIT', b: 'control', v: { key: '^O', ascii: 'SI' } } ] },
    { c: 0x10, acts: [ { a: 'EMIT', b: 'control', v: { key: '^P', ascii: 'DLE' } } ] },
    { c: 0x11, acts: [ { a: 'EMIT', b: 'control', v: { key: '^Q', ascii: 'DC1' } } ] },
    { c: 0x12, acts: [ { a: 'EMIT', b: 'control', v: { key: '^R', ascii: 'DC2' } } ] },
    { c: 0x13, acts: [ { a: 'EMIT', b: 'control', v: { key: '^S', ascii: 'DC3' } } ] },
    { c: 0x14, acts: [ { a: 'EMIT', b: 'control', v: { key: '^T', ascii: 'DC4' } } ] },
    { c: 0x15, acts: [ { a: 'EMIT', b: 'control', v: { key: '^U', ascii: 'NAK' } } ] },
    { c: 0x16, acts: [ { a: 'EMIT', b: 'control', v: { key: '^V', ascii: 'SYN' } } ] },
    { c: 0x17, acts: [ { a: 'EMIT', b: 'control', v: { key: '^W', ascii: 'ETB' } } ] },
    { c: 0x18, acts: [ { a: 'EMIT', b: 'control', v: { key: '^X', ascii: 'CAN' } } ] },
    { c: 0x19, acts: [ { a: 'EMIT', b: 'control', v: { key: '^Y', ascii: 'EM' } } ] },
    { c: 0x1a, acts: [ { a: 'EMIT', b: 'control', v: { key: '^Z', ascii: 'SUB' } } ] },
    { c: 0x1c, acts: [ { a: 'EMIT', b: 'control', v: { key: '^\\', ascii: 'FS' } } ] },
    { c: 0x1d, acts: [ { a: 'EMIT', b: 'control', v: { key: '^]', ascii: 'GS' } } ] },
    { c: 0x1e, acts: [ { a: 'EMIT', b: 'control', v: { key: '^^', ascii: 'RS' } } ] },
    { c: 0x1f, acts: [ { a: 'EMIT', b: 'control', v: { key: '^_', ascii: 'US' } } ] },
    { c: 0x7f, acts: [ { a: 'EMIT', b: 'control', v: { key: '^?', ascii: 'DEL' } } ] },

    /*
     * Default:
     */
    { acts: [ { a: 'KEYREAD' } ] }
  ],

  /*
   * The UTF8-REM{1,2,3} states are used to count down the remaining number of
   * bytes to read while processing a UTF-8 character.
   */
  'UTF8-REM3': [
    { acts: [ { a: 'KEYSTEP', b: 'UTF8-REM2', c: false } ] }
  ],
  'UTF8-REM2': [
    { acts: [ { a: 'KEYSTEP', b: 'UTF8-REM1', c: false } ] }
  ],
  'UTF8-REM1': [
    { acts: [ { a: 'KEYSTEP', b: 'REST', c: true } ] }
  ],

  'ESCAPE': [
    /*
     * Default:
     */
    { acts: [ { a: 'EMIT', b: 'control', v: { key: '^[', ascii: 'ESC' } },
              { a: 'EMIT', b: 'keypress', c: true },
              { a: 'STATE', b: 'REST' } ] },

    { c: 'O', acts: [ { a: 'STATE', b: 'CTRLSEQ2' } ] },
    { c: '[', acts: [ { a: 'STATE', b: 'CTRLSEQ' } ] }
  ],

  /*
   * We've received the SS3 sequence
   */
  'CTRLSEQ2': [
    { c: 'A', acts: [ { a: 'EMIT', b: 'special', v: 'up', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'B', acts: [ { a: 'EMIT', b: 'special', v: 'down', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'C', acts: [ { a: 'EMIT', b: 'special', v: 'right', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'D', acts: [ { a: 'EMIT', b: 'special', v: 'left', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'P', acts: [ { a: 'EMIT', b: 'special', v: 'F1', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'Q', acts: [ { a: 'EMIT', b: 'special', v: 'F2', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'R', acts: [ { a: 'EMIT', b: 'special', v: 'F3', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'S', acts: [ { a: 'EMIT', b: 'special', v: 'F4', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'T', acts: [ { a: 'EMIT', b: 'special', v: 'F5', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'U', acts: [ { a: 'EMIT', b: 'special', v: 'F6', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'V', acts: [ { a: 'EMIT', b: 'special', v: 'F7', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'W', acts: [ { a: 'EMIT', b: 'special', v: 'F8', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] }
  ],
  /*
   * We've received the CSI sequence
   */
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
    { c: '~', acts: [ { a: 'CALL', b: '_inkeys' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'n', acts: [ { a: 'CALL', b: '_devstat' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'R', acts: [ { a: 'CALL', b: '_curpos' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'A', acts: [ { a: 'CALL', b: '_fnkeys', v: 'up' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'B', acts: [ { a: 'CALL', b: '_fnkeys', v: 'down' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'C', acts: [ { a: 'CALL', b: '_fnkeys', v: 'right' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'D', acts: [ { a: 'CALL', b: '_fnkeys', v: 'left' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'F', acts: [ { a: 'CALL', b: '_fnkeys', v: 'end' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'H', acts: [ { a: 'CALL', b: '_fnkeys', v: 'home' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'P', acts: [ { a: 'CALL', b: '_fnkeys', v: 'F1' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'Q', acts: [ { a: 'CALL', b: '_fnkeys', v: 'F2' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'R', acts: [ { a: 'CALL', b: '_fnkeys', v: 'F3' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'S', acts: [ { a: 'CALL', b: '_fnkeys', v: 'F4' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'Z', acts: [ { a: 'EMIT', b: 'special', v: 'reverse-tab', m: NO_MODS },
                      { a: 'STATE', b: 'REST' } ] },
  ]
};
