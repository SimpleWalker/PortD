# PortD test suite

End-to-end tests for `portd.html`. They drive a real browser with real mouse and keyboard input, read back downloaded backups from disk, and measure contrast, focus rings and layout. 1.1.0 passes all of them: **1,412 checks** without the prototype file (1,419 expected with it; not run for 1.1.0).

## Layout

```
suite/
  run.js        runner, foundation checks, shared helpers (the "kit")
  shell.js      desktop, windows, taskbar, menus
  files.js      the Files app and the virtual drive
  programs.js   installing, running and sandboxing programs
  data.js       backup, restore, Check my data, linked data file
  polish.js     profile, first start, taskbar options, text size, motion, touch
  freeze.js     programs that stop responding: the red bar, Close all programs, the limit; P:\OS\Apps repair
  audit.js      measured contrast, focus rings, fit, forced colours
```

Run from the repository root; `portd.html` is expected beside `suite/`.

## Running

```
node suite/run.js [portd.html] [prototype.html]
```

- `portd.html` defaults to `../portd.html` relative to the suite.
- The prototype (0.x) file is optional. Without it, the checks that need it are skipped.
- `ONLY=shell|files|programs|data|polish|freeze|audit` runs one module.
- A full run takes well over ten minutes. Run it in the background if your shell has a time limit.
- Exit codes: `0` all passed, `1` some failed, `2` the suite could not run.

## Requirements

- **Node.js** and **Playwright** (chromium driver). `run.js` loads it from `$PLAYWRIGHT` if set, else `/opt/npm-tools/node_modules/playwright`. In a normal repo:
  ```
  npm install --save-dev playwright
  PLAYWRIGHT=playwright node suite/run.js
  ```
  or change the single `require` line at the top of `run.js` to `require('playwright')`.
- **A browser**, tried in this order: Edge, Chrome, Chromium (standard install paths on Linux and Windows).
- **python3 with Pillow**, used to measure screenshots. Python's `zipfile` is used to read back downloaded zips.

## Last verified

Headless Chrome 153 on Linux, 1,412 checks (no prototype file), 0 failed.

## Writing a module

Each module is CommonJS: `module.exports = async (kit) => { ... }`. The kit provides `check`, `section`, `profile`, `newDir`, `variant`, `file`, `saved`, `status`, `idb`, `reload`, `text`, `tryIt`, `about`, `html`, `tmp` and `firstRunAway`. Read `run.js` for what each does. Use `check(name, ok, detail)`; put the evidence in `detail` so a failure explains itself.

`window.PortDHost` (keys `DIR, Path, checkData, getState, launch, openPath, version, vfs, wm`) is the page's test hook.
