# AGENTS.md

Guidance for AI agents (and humans in a hurry) working on PortD. Read this before changing anything.

## What this is

PortD is a portable desktop in **one HTML file**, `portd.html` (version 1.0.0). It runs from `file://` in Edge or Chrome, can be installed as a PWA, and is meant for locked-down corporate computers. Everything lives in that file: markup, CSS, JavaScript, built-in apps and the default program.

100 % of the code was written by Claude (Fable 5.2). It is MIT licensed, copyright 2026 SimpleWalker.

## Repository layout

```
portd.html        the whole product (about 3,560 lines)
README.md         user-friendly guide
AGENTS.md         this file
docs/TECHNICAL.md technical reference (formats, architecture, behaviour)
suite/            the test suite (Playwright); see suite/README.md
LICENSE           MIT
```

## Hard constraints (do not break these)

1. **Single file.** No build step, no second file, no bundler. `portd.html` must keep working when double-clicked.
2. **No network.** The Content-Security-Policy forbids it. Do not loosen the CSP, add `connect-src`, remote fonts, CDNs or analytics.
3. **No encryption, no accounts, no password or lock screen.** Backups are plain JSON by design. Do not add any of these.
4. **Runs from `file://`.** Do not depend on `http(s)`, service workers for core function, or anything blocked on `file://`.
5. **Data format v2.** `FORMAT_VERSION = 2` (around line 380), `MIGRATIONS = {}` (381). Backups are `.portd` plain JSON with a SHA-256 integrity value over the exact text of the `fs` member. Changing the on-disk shape needs a new version plus a migration, never a silent change.
6. **Program package v3.** `.portdapp` files use `formatVersion: 3`. Programs run in sandboxed iframes.
7. **File size limit.** `MAX_FILE` is 64 MB (around line 396).
8. **Forward compatibility.** Unknown keys in stored data are preserved via `FORWARD_KEYS` (around line 1820). `adopt()` (around line 2721) loads a data document into live state.
9. **Failing loudly.** A save, backup or restore that did not come out right must say so. Never report success you did not verify.
10. **Single instance.** Web Locks give one writer; a second tab is read-only until "Take over".
11. **Accessibility is tested.** Text 4.5:1, control edges 3:1, focus rings 2 px and 3:1, touch targets 40 px, text sizes 100 to 150 %, reduced motion, forced colours. The suite measures these.

Line numbers drift; search for the names.

## The test hook

`window.PortDHost` exposes exactly these keys, and the suite asserts it:

`DIR, Path, checkData, getState, launch, openPath, version, vfs, wm`

Do not add or remove keys without updating `suite/data.js` (it checks the list). Tests drive the real UI and use this hook to read and set state.

## Running the tests

```
npm install --save-dev playwright     # once
PLAYWRIGHT=playwright node suite/run.js
```

Or, where Playwright is installed elsewhere, set `PLAYWRIGHT` to its path. `ONLY=shell|files|programs|data|polish|audit` runs one module. The full run takes well over ten minutes, so run it in the background with a long timeout. Details in `suite/README.md`.

Expected result for 1.0.0: **1,377 checks, 0 failed** without the prototype file (1,384 with it). Exit codes: 0 pass, 1 failures, 2 could not run.

## How to change things

1. Edit `portd.html` in small steps.
2. Run the module closest to your change with `ONLY=`.
3. Run the full suite before committing.
4. If behaviour you meant to change is asserted by the suite, update the check and say why. If you did not mean to change it, fix the code.
5. Update `README.md` (user-facing) and `docs/TECHNICAL.md` (technical) when behaviour changes.
6. Keep the wording in the UI plain. The suite checks exact strings, so a copy edit is a test edit too.

## Conventions

- British spelling in user-facing text ("colour", "licence").
- No em dashes in prose you write.
- UI text is plain and direct, with no jargon (it says "backup" and "restore", never "export" and "import").
- Programs and the OS never reach outside the virtual drive `P:\` (folders `OS`, `Programs`, `User`).

## Things that look wrong but are intentional

- No encryption of the data file.
- No network access of any kind, including for programs.
- `MIGRATIONS` is empty: version 2 is the first released format.
- The suite runs the linked-data-file tests over `http://127.0.0.1` with replaced pickers, because a real picker needs a human.
