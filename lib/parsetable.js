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

module.exports = {
  'REST': [
    { c: 0x1b, acts: [ { a: 'STATE', b: 'ESCAPE' },
                       { a: 'TIMEOUT', e: 'ESC' } ] },
    { c: 0x00, acts: [ { a: 'EMIT', b: 'NUL', } ] },
    { c: 0x01, acts: [ { a: 'EMIT', b: '^A', } ] },
    { c: 0x02, acts: [ { a: 'EMIT', b: '^B', } ] },
    { c: 0x03, acts: [ { a: 'EMIT', b: '^C', d: true } ] },
    { c: 0x04, acts: [ { a: 'EMIT', b: '^D' } ] },
    { c: 0x05, acts: [ { a: 'EMIT', b: '^E', } ] },
    { c: 0x06, acts: [ { a: 'EMIT', b: '^F', } ] },
    { c: 0x07, acts: [ { a: 'EMIT', b: 'BEL', } ] },
    { c: 0x08, acts: [ { a: 'EMIT', b: 'BS' } ] },
    { c: 0x09, acts: [ { a: 'EMIT', b: 'TAB' } ] },
    { c: 0x0a, acts: [ { a: 'EMIT', b: 'LF' } ] },
    { c: 0x0d, acts: [ { a: 'EMIT', b: 'CR' } ] },
    { c: 0x15, acts: [ { a: 'EMIT', b: 'NAK' } ] },
    { c: 0x7f, acts: [ { a: 'EMIT', b: 'DEL' } ] },

    /*
     * Default:
     */
    { acts: [ { a: 'EMIT', b: 'keypress', c: true } ] }
  ],
  'ESCAPE': [
    /*
     * Default:
     */
    { acts: [ { a: 'EMIT', b: 'keypress', c: true },
              { a: 'STATE', b: 'REST' } ] },

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
    { c: '~', acts: [ { a: 'CALL', b: '_inkeys' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'n', acts: [ { a: 'CALL', b: '_devstat' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'R', acts: [ { a: 'CALL', b: '_curpos' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'A', acts: [ { a: 'EMIT', b: 'up' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'B', acts: [ { a: 'EMIT', b: 'down' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'C', acts: [ { a: 'EMIT', b: 'right' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'D', acts: [ { a: 'EMIT', b: 'left' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'H', acts: [ { a: 'EMIT', b: 'home' },
                      { a: 'STATE', b: 'REST' } ] },
    { c: 'F', acts: [ { a: 'EMIT', b: 'end' },
                      { a: 'STATE', b: 'REST' } ] },
  ]
};
