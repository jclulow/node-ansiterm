<!--
   This Source Code Form is subject to the terms of the Mozilla Public
   License, v. 2.0. If a copy of the MPL was not distributed with this
   file, You can obtain one at http://mozilla.org/MPL/2.0/.
-->

<!--
   Copyright (c) 2017, Cody Mello
-->

# ansiterm

## About

`ansiterm` is a library for manipulating terminal input and output.

## Installation

    npm install ansiterm

## `ANSITerm`

This library provides a main object for interacting with the terminal. Besides
the methods on it, instances of the object also function as an `EventEmitter` to
inform the consumer when keys are pressed or the window gets resized.

### `ANSITerm#clear()`

Clear the screen.

### `ANSITerm#cursor(show)`

Enable or disable the cursor by passing true or false respectively.

### `ANSITerm#size()`

Returns an object indicating the terminal size:

- `h`, the number of rows of the terminal
- `w`, the number of columns of the terminal

### `ANSITerm#softReset()`

Resets the terminal state.

### `ANSITerm#moveto(x, y)`

Move the cursor to a new location.

### Event: `"resize"`

Indicates that the terminal has been resized. Emits the new size, as
represented by `ANSITerm#size()`.

### Event: `"keypress"`

Emitted when a normal key has been pressed. Passes the string representation of
the character pressed (e.g., `"c"`, `"C"`, `"!"`, etc.).

### Event: `"control"`

Emitted when a control character has been pressed, e.g. `^C`. An object
is passed with the event, containing the following fields:

- `key`, a representation of the keys pressed, e.g. `^[` for escape, `^C` for
  control-C, `^H` for backspace, `^I` for tab, etc.
- `ascii`, the ASCII name of the control character (e.g. `NUL`, `SOH`, etc.)

### Event: `"special"`

Emitted for special keys on the keyboard. An string is passed with the
event, indicating which key was pressed:

- Home (`"home"`)
- Insert (`"insert"`)
- Delete (`"delete"`)
- End (`"end"`)
- Page Up (`"prior"`)
- Page Down (`"next"`)
- Arrow key (`"up"`, `"down"`, `"right"`, or `"left"`)
- Reverse Tab, usually Shift+Tab (`"reverse-tab"`)

Additionally, an object is passed with the following fields:

- `alt`, indicating if alt was held while pressing the key
- `shift`, indicating if shift was held while pressing the key
- `control`, indicating if control was held while pressing the key
- `meta`, indicating if meta (super) was held while pressing the key

Note that terminals don't support the full matrix of possible combinations,
and will ignore shift or control in some cases.

## `wcwidth(codepoint)`

When given a numeric
[UCS](https://en.wikipedia.org/wiki/Universal_Coded_Character_Set) codepoint,
this function will return how many columns are needed to display it in the
terminal. This function is compatible with
[wcwidth(3C)](https://illumos.org/man/3C/wcwidth) in C.

## `wcswidth(str)`

When given a string, this function will return how many columns are needed to
display it when printed to the terminal. If the string contains any
nonprintable characters, then this returns -1. This function is compatible with
[wcswidth(3C)](https://illumos.org/man/3C/wcswidth) in C.

## `forEachGrapheme(str, f)`

This function will call `f(grapheme, width)` for each individual grapheme.
Combining characters are grouped with their preceding, printing character, and
nonprintable characters (width of -1) are emitted independently.

## License

MIT
