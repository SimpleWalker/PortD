# PortD 1.0.0

A portable desktop in a single HTML file. Open `portd.html` from disk in Microsoft Edge (or Chrome) and you get your own drive, programs, taskbar and desktop, independent of the computer. Nothing is installed, nothing is fetched, and there is no second file.

**Build status: all six phases built and checked.** What was run, and what was not, is under [How it was checked](#how-it-was-checked); the short version is headless Chrome on Linux from `file://`, not Edge and not Windows, so please go through [Try it on the target machine](#try-it-on-the-target-machine).

No compatibility with the 0.x prototype: its data files and program packages are refused, not converted.

## Quick start

Open `portd.html` in Edge. On the first start the Welcome note opens, with one optional question: what PortD should call you. You get nine icons on the desktop and a taskbar. Double-click **Home** to browse your files, or press the **PortD** button.

## What it does

| Area | What works |
|---|---|
| Desktop | Icons for files, folders and shortcuts; select with click, Ctrl+click, Shift+arrows or by dragging a box; drag to arrange or onto folders; drop files from the computer to copy them in |
| Files | Browse the drive; new folder, text file or web shortcut; rename, cut, copy, paste, delete; drag and drop; properties and custom icons |
| Undo | Ctrl+Z and Ctrl+Y for file actions, 20 deep, with an Undo link in each toast |
| Search | Names and file contents below the open folder, with filters for type, extension, date and size |
| Recycle Bin | Deleted items go there and can be restored to where they came from |
| To and from the computer | Add files, download a file, download a folder or a selection as a .zip |
| Apps | Notepad, Image Viewer, Calculator |
| Programs | Install a `.portdapp` package or a single `.html` file; each runs sandboxed in its own window and sees only its own data and the files you hand it; To-Do is included as a sample |
| Default apps | Choose which program opens each type of file; Open with for a one-off |
| Your data | Download a backup as one `.portd` file and restore it anywhere; one previous version; a linked data file kept up to date on disk; a reminder; Check my data; Reset |
| Windows | Move, resize, minimise, maximise, close; snap to halves and quarters; remembered size and place per program |
| Taskbar | PortD menu with program and file search, window buttons, pinned items, a list of windows for a pinned program that has several, save status, backup warning, clock; colour and window names adjustable |
| Profile | An optional display name and picture. Not an account |
| Appearance | Light and dark theme, accent colour, six built-in backgrounds, a solid colour or your own picture |
| Accessibility | Everything works from the keyboard with a visible focus ring; text size 100 to 150 %; reduced motion, more contrast and Windows contrast themes respected; larger targets on touch screens |

## The drive

One drive, `P:\`, with a fixed layout:

```
P:\
├─ OS\          PortD's own files, read-only: system.json, README.txt, Apps\
├─ Programs\    installed programs, one folder each
└─ User\        your home folder
   ├─ Desktop\  ├─ Documents\  ├─ Pictures\
   └─ Config\   settings.json, desktop.json, profile.json, taskbar.json, associations.json, Recycle Bin\
```

- Nothing can be created, renamed or deleted directly under `P:\`. `P:\OS` is read-only. The folders named above cannot be moved, renamed or deleted.
- Names keep their case and are matched without it. They cannot contain `\ / : * ? " < > |`, start with a space, end with a space or a dot, or be longer than 120 characters.
- A dot file or dot folder created directly in `P:\User` is placed in `P:\User\Config`, with a notice. This applies only to direct children of `P:\User`, and only to things you do: it never runs at start-up or while a data file is opened.
- Built-in apps are named `builtin:files`, `builtin:notepad`, `builtin:calc`, `builtin:viewer` and `builtin:settings`, in shortcuts, pins and remembered window positions.

Default content is written once, when a new desktop is created. Start-up never recreates, moves or repairs anything: what you delete stays deleted.

## The desktop

A new desktop has nine icons in one column from the top left, wrapping to a second column on a short screen: Home, Documents, Settings, Calculator, Notepad, To-Do, MDN Web Docs, Welcome.txt and Recycle Bin. **Home** is a shortcut to `P:\User` and shows a house; a shortcut to exactly that folder shows the house wherever it appears, including when pinned.

- Shortcuts carry a small arrow. A `.lnk` file is JSON: `{ "type": "program", "target": "builtin:calc" }` or `{ "type": "path", "target": "P:\\User" }`. A `.url` file is a web shortcut; it opens in a new tab of the host browser, and only `http`, `https` and `mailto` addresses are accepted.
- **New ▾ > Web shortcut…** asks for a name and an address; an address without a scheme gets `https://`.
- A web shortcut shows a monogram: two letters of the host name on a colour made from it. A shortcut to a program that is not installed is greyed.
- Until you move an icon, icons flow in the stored order. Once you drag one, every icon keeps the place it has. Dropping on an occupied cell swaps the two. **Tidy up icons** on the desktop menu returns to the flowing order.
- `desktop.json` holds `{ "version": 1, "order": [names], "pos": { name: [column, row] } }`.
- Files dropped from the computer are copied to the desktop next to where they were dropped. Files over 64 MB are refused.
- Delete, F2, Ctrl+C, Ctrl+X and Ctrl+V work on selected icons, and the desktop menu has New, Paste, Undo and Redo.

## Files

**Home** on the desktop, or **Home folder** in the PortD menu, opens Files. The app is called Files; only the desktop shortcut is called Home.

- The Programs folder is shown with a program-window icon rather than a folder, in the sidebar and wherever `P:\Programs` itself appears. `P:\OS` is shown with a gear.
- **Getting around:** double-click a folder, use Back, Forward and Up, click a part of the path, or pick a place in the sidebar. Alt+Left, Alt+Right and Alt+Up do the same from the keyboard; Backspace goes up.
- **Selecting:** click, Ctrl+click, Shift+click, Shift+arrows, Ctrl+A. The menu for a selection applies to all of it.
- **Making things:** **New ▾** offers Folder, Text file and Web shortcut…. **Add files…** copies files in from the computer, and so does dropping them on the window.
- **Changing things:** F2 renames, Delete sends to the Recycle Bin, Shift+Delete deletes permanently after asking. Ctrl+C, Ctrl+X and Ctrl+V copy and move. A taken name is never replaced: the newcomer gets a number, as in `notes (2).txt`, and the toast says so.
- **Drag and drop:** drag rows onto a folder, a place in the sidebar, a part of the path, the desktop or a desktop folder. Hold Ctrl to copy. Desktop icons can be dragged onto folders and into Files windows the same way; dropping on the Recycle Bin deletes. A label by the pointer says what will happen. Dragging inside Files does not work by touch.
- **Open with ▸** is a submenu: Notepad for text, Image Viewer for pictures, or a download.
- **Create shortcut** makes a `.lnk` beside the item, or on the desktop where it cannot be written beside it. A shortcut to a folder opens that folder in the same window.
- **Properties** shows type, location, size (with a count of what a folder holds) and dates, and has **Change icon…**: a built-in glyph, an emoji, or a picture from the computer, which is stored as a 64 px PNG. PortD's own files in `P:\OS` keep their icons.
- `P:\OS` is read-only and the drive root is fixed, so the actions that would change them are switched off there.

### Undo and redo

**Ctrl+Z** undoes the last file action, **Ctrl+Y** or **Ctrl+Shift+Z** redoes it, and each toast that reports an action carries an **Undo** link. The folder and desktop menus show what Undo would undo.

- Covered: move, copy, rename, delete to the Recycle Bin, paste, new folder, new file, new shortcut, and a dot item being placed in Config.
- The history is 20 actions deep and lives in memory only: it is never written to the data file, and a reload starts it empty.
- Not undoable: deleting permanently and emptying the Recycle Bin. They end the history, and Undo then shows the reason in its tooltip and when Ctrl+Z is pressed. (Restore from backup, reset, and installing, updating or uninstalling a program do the same.)
- Undoing a delete restores from the Recycle Bin by the same rules as a manual restore.
- If an undo can no longer be applied, for example because the old name has been taken or the item is gone, PortD says what stopped it and changes nothing. That one action is dropped and the rest of the history still works. Undoing **New folder** is refused once the folder holds something.
- Taking over from another tab clears the history.
- Text boxes, including Notepad, keep the browser's own undo.

### Search and filters

The search box looks through the open folder and everything below it, in names and in the text of files up to 2 MB. Results show the folder each item is in, and stop at 300 with a note.

**Filters** opens a bar under the search box. Filters work with or without search text, and the ones that are on show as chips that can be clicked away:

| Filter | Choices |
|---|---|
| Type | All, folders, text files, pictures, other files |
| Extension | One or more, such as `.csv, .md` |
| Modified | Any time, today, last 7 days, last 30 days, this year, or a custom range |
| Size | Any, under 100 KB, 100 KB to 1 MB, over 1 MB, or custom in KB |
| Case sensitive | For names and contents |

Filters last for the session and are shared by every Files window. They are not saved, so a reload clears them. The Recycle Bin is searched only from inside it.

### The Recycle Bin

Deleted items move to `P:\User\Config\Recycle Bin` and remember where they came from. **Restore** puts an item back: if its folder is gone the folder is made again, and if its name has been taken the item is numbered, and the toast says which happened. Deleting inside the bin, and **Empty Recycle Bin**, are permanent and ask first.

### Downloading, and folders as a zip

**Download to this computer** saves one file as it is. A folder, or a selection of several items, downloads as a `.zip` written by PortD itself:

- entries are stored, not compressed, with a CRC32 each, UTF-8 names and the modified times from the drive;
- empty folders are kept;
- the Recycle Bin is left out of any zip, and items in `P:\OS` or the bin are not offered;
- more than 64 MB in total, or more than 65,535 entries, is refused with the reason. PortD does not write ZIP64.

## Notepad, Image Viewer, Calculator

- **Notepad** edits text files. Ctrl+S saves, Ctrl+Shift+S saves under a new name, Ctrl+O opens. A file that used Windows line endings keeps them. The title shows a star while there are unsaved changes, and closing then asks. Opening a file that is already open brings its window forward.
- The **Open** and **Save** dialogs show your home folder without Config and the Recycle Bin. Saving over an existing file asks first, and a name without an extension gets `.txt`.
- **Image Viewer** opens pictures, steps through the pictures in the same folder (arrow keys work), switches between fitted and actual size, and can set the picture as the desktop background.
- **Calculator** is basic and works left to right, like a pocket calculator: `2 + 3 × 4 =` gives 20. Results are rounded to 12 significant digits and are floating point. `200 + 15 % =` gives 230 and `200 × 15 % =` gives 30. The keyboard works: digits, `+ - * /`, Enter, Backspace, Esc.
- A file that nothing opens is offered as a download.
- Settings has six tabs: Appearance, Profile, Data, Programs, Developer and About.

## Programs

A program is a web page that runs in its own window. It is installed into `P:\Programs\<id>\`, one folder each, and listed in the PortD menu and in Settings > Programs.

**What a program can see.** Its own data folder, `P:\User\Config\<id>`, and its own program folder (read-only). Nothing else, until you hand it a file: by choosing one in its Open or Save dialog, or by opening a file with it. That gives it that one file, for reading and writing, in that one window, until the window closes. Nothing about it is saved. It cannot list your folders, and it cannot see `P:\OS`, other programs, or the rest of Config. Every install shows the same sentence: *"This program can see its own data and the files you choose for it. It can't see the rest of your drive."*

**Installing.** Any of these, and all of them show the same confirmation (name, version, description, icon, the file types it declares, file count and size, where it goes):
- double-click a `.portdapp` file on the drive, or right-click it and choose **Install…**;
- double-click an `.html` file: PortD asks whether to open it in Notepad or install it as a program, and can remember the answer;
- drop a `.portdapp` from the computer: **Install…** or **Just copy the file**;
- Settings > Programs > **Install a program…**.

Installing creates the folder and a desktop shortcut. Installing over a program that is already there is an update: *Update Notes 1.0.0 → 1.2.0?*, or *Reinstall Notes 1.2.0 (installed: 1.2.0)?* with a note when the version is the same or older. Its files are replaced, files the new version no longer has are removed, and its data, shortcut, taskbar pin and your default apps are kept. A window that is open keeps running the old page until it is closed.

**Uninstalling** (Settings > Programs) removes the folder, its desktop shortcuts, its pin and any default apps that point at it. Its data folder is kept. Installing, updating and uninstalling cannot be undone with Ctrl+Z, and Undo says so.

**Default apps.** Declaring a file type gives a program nothing. After an install a notice says *"Notes can open .md and .csv files"* with **Set as default**, **Default apps** and **Dismiss**; until you choose, files open as before. **Open with ▸** on a file lists the programs that declare its type, the built-ins that can take it, **Choose another program…** (with *Always use this for .csv files*) and Download. Settings > Programs > Default apps lists every type you have chosen a program for and every type an installed program declares, each with a list to choose from and **Reset**; **Reset all** clears them. A file whose type you gave to a program shows that program's name for the type, and its icon for the type if it declared one. If the chosen program is no longer installed the choice is kept, shown as "not installed", and skipped when opening. `.portd`, `.portdapp`, `.lnk` and `.url` have a fixed meaning and cannot be given to a program. A file outside `P:\User` cannot be opened with an installed program; PortD says why.

**To-Do** is the sample: four files in `P:\Programs\todo` (page, stylesheet, script, SVG icon), 3.7 KB, storing its tasks in `P:\User\Config\todo\todo.json`. It is put there once, when a desktop is created. If you uninstall it, it stays gone; Settings > Developer > **Reinstall sample program** puts it back as shipped, with a desktop shortcut if it has none, and leaves its tasks alone.

**Ctrl+F6 inside a program.** A program's frame has the keyboard while you work in it, so PortD's own keys would be lost. The keys in one list in the file (`FORWARD_KEYS`: Ctrl+F6 and Ctrl+Shift+F6) are passed on from inside a program and act as if pressed outside. The program still receives them.

## Writing a program

A program is a folder of files with an entry page. A single self-contained `.html` file also installs as a program: its name comes from `<title>`, its id from the name.

### The package

A `.portdapp` file is JSON:

```json
{
  "format": "portd-app", "formatVersion": 3,
  "id": "notes", "name": "Notes", "version": "1.2.0", "description": "Markdown notes.",
  "icon": "icon.svg", "entry": "index.html", "width": 640, "height": 440, "singleInstance": false,
  "fileTypes": [{ "ext": ".md", "name": "Markdown note", "icon": "glyph:notepad" }],
  "files": { "index.html": { "enc": "text", "d": "<!DOCTYPE html>…" }, "img/logo.png": { "enc": "dataurl", "d": "data:image/png;base64,…" } }
}
```

- **Format version 3** is the first of this line. Earlier ones are refused: *"This package was made for the PortD prototype."* Newer ones are refused naming both versions.
- **id**: 1 to 40 lowercase letters, digits and hyphens. Upper case is lowered. `:` is refused, because built-in programs are `builtin:<name>` everywhere and the two must never collide; a package with the id `files` is simply another program, in `P:\Programs\files`. Without an id, one is made from the name.
- **icon**: `glyph:<name>` from PortD's set, `emoji:🚀` or a bare emoji, a PNG data URL, or the path of an SVG or picture file in the package. A file type's icon can be a glyph, an emoji or a PNG data URL.
- **fileTypes**: an extension is a dot and 1 to 16 letters or digits. The four fixed types are left out with a message and the rest installs.
- **files**: paths use `/`. Refused: `..`, a leading `/` or `\`, a drive letter, `\` as a separator, characters Windows does not allow in names, the same path twice, and `manifest.json` (PortD writes it). Limits: 256 files, 8 MB a file, 24 MB a package.
- Settings > Developer > **Export as .portdapp…** writes a package from an installed program's folder as it is now (so you can edit files in `P:\Programs\<id>` and export). Right-clicking the program's folder in `P:\Programs` offers the same. Saved data is not part of a package.

### How the page is put together

The frame cannot load anything by URL, so PortD hands it one self-contained document. Starting from the entry page, references to files in the program's own folder are put inline: linked stylesheets and what they `@import`, classic `<script src>`, `<img>`, `<source>`, SVG `<image>`, and `url()` in stylesheets and `<style>` blocks. `<link rel="icon">` is removed. `defer` and `async` scripts are moved to the end of the body. A reference to the network, to outside the folder or to a file that is not there is left as written, does not load, and a missing file is named once in the console. The result is kept until a file in the folder changes.

Everything else in the folder reaches the program through **`PortD.assets`**: `{ "data/info.json": "data:application/json;base64,…" }`. An entry is `null` for a text file that was put inline, a file over 2 MB, and anything after the map reaches 8 MB.

**Not supported:** ES modules (`<script type="module">`, `import()`), `fetch` and `XMLHttpRequest` (also for data URLs), workers, `srcset`, `poster`, `src` on `<video>` and `<audio>`, `url()` in a `style=""` attribute, links to `#anchors` in the page (use `scrollIntoView`), and anything from the network.

### The API

Every call returns a promise. A relative path is inside the program's data folder.

| | |
|---|---|
| `PortD.app` | `{ id, name, version, dir, dataDir, args, portd, user: { displayName } }`. `args` is `null`, or `{ open: { path, name, ext } }` when started with a file |
| `PortD.assets` | see above |
| `PortD.fs.read(path)` | the text, or the data URL of a binary file |
| `PortD.fs.write(path, data, "dataurl"?)` | writes text, or a data URL as a binary file; makes missing folders in the data folder; resolves the path |
| `PortD.fs.list(path)` | `[{ name, path, dir, size, modified }]`; only in the data folder and the program folder |
| `PortD.fs.exists(path)`, `mkdir(path)`, `remove(path)` | |
| `PortD.fs.move(from, to)`, `copy(from, to)`, `rename(path, newName)` | data folder only, both ends in it |
| `PortD.ui.openFile({ title, types: [".txt"] })` | PortD's Open dialog, titled *"<Program> — Open"* or with your title. Resolves `{ path, name, ext }` and grants that file, or `null` |
| `PortD.ui.saveFile({ title, name, types })` | PortD's Save dialog, asking before replacing a file. Grants the path; the program then writes it with `fs.write` |
| `PortD.onOpenFile(cb)` | for `singleInstance` programs: called with `{ path, name, ext }` when another file is opened with the running window |
| `PortD.openUrl(url)` | http, https and mailto only, in a new browser tab |
| `PortD.notify(text)`, `setTitle(text)`, `close()` | |

Anything outside what the program may touch is rejected with `Access denied: <path>`, including `exists`. A granted file can be read and written but not removed, moved or renamed. The dialogs are drawn by PortD's page, show `P:\User` without Config and the Recycle Bin, and only one can be open for a window: a second call while one is open is rejected.

## Windows and the snap panel

Drag a title bar to move a window, an edge or the corner to resize it, double-click the title bar to maximise. PortD remembers each program's size, place, and whether it was maximised or snapped. Settings > Appearance > **Forget window positions** clears that.

Snapping, three ways:

- **Snap panel.** Drag a window to the top of the desktop, in the middle third of its width, and a panel drops down with three layouts: full, halves, quarters. Move onto a zone and drop.
- **Maximise button.** Rest the pointer on it for half a second and the same panel appears under it. Click a zone.
- **Edges.** Drag to the left or right edge for a half, to a corner for a quarter, or to the top edge outside the middle third to maximise. The outline appears after a short rest.

From the keyboard: Shift+F10 or the Menu key on a window's title bar (or right-click it) opens the window menu: Restore, Minimise, Maximise, **Snap ▸** (Left, Right, Top left, Top right, Bottom left, Bottom right), Close. There are no Ctrl+Alt+arrow shortcuts.

Dragging a snapped window away gives it back its earlier size. Below 640 px of width (at the current text size) windows open maximised and snapping is off.

## The taskbar

- **PortD menu:** shows your display name (or "PortD") and lists the programs. Type to filter them; from two letters it also searches file and folder names in your home folder. **Home folder** opens Files and **Download backup** saves one. Right-click a program for **Add a shortcut to the desktop**.
- **Window buttons:** click to bring a window forward, click again to minimise it.
- **Pins:** right-click a desktop icon, a program in the PortD menu or a window's button and choose **Pin to taskbar**. Drag pins to reorder them. Up to 20. `taskbar.json` holds `{ "version": 1, "pinned": [ {"type":"program","id"} | {"type":"path","path"} | {"type":"url","url","name"} ] }`.
- **Window list:** a pinned program with two or more windows shows a list of them above its button: click the button, or rest the pointer on it for half a second. Click a row to bring that window forward, or its ✕ to close it; the window in front is marked. From the keyboard: Enter on the button opens the list, Up and Down move, Enter chooses, Delete closes that window, Esc goes back to the button. With one window the button brings it forward or minimises it, as before.
- **Save status:** Saved, Saving, Save failed or Read-only. Beside it, when they apply: **Reconnect data file**, and a warning sign when a backup is well overdue.

**Colour** (Settings > Appearance > Taskbar)

| Choice | Result |
|---|---|
| Standard | Follows the theme: light (`#eef1f5`) in the light theme, dark (`#121820`) in the dark theme. The default. |
| Accent colour | Your accent colour, mixed two thirds toward the theme's Standard colour. |
| Match the background | The average colour of the bottom 15 % of the desktop background, greyed a little, mixed half-and-half with the theme's Standard colour. |
| Custom colour | Any colour you pick, used as it is. |

Whatever the colour, PortD measures it and switches the taskbar's text between light and dark so it keeps at least 4.5:1, and picks the hover shade and the running-program mark against the same colour.

**Window names** (Settings > Appearance > Taskbar): **Always**; **Automatic** (the default: names are hidden when the buttons get narrower than 100 px each and come back above 120 px, so they do not flicker at the boundary); **Never**. On a narrow screen buttons are always icon-only. A hidden name shows as a tooltip, by pointer and by keyboard.

## Profile

PortD can show a display name and a picture: in the PortD menu and in Settings, with the name also in Settings > About and at the start of backup file names (`Lily-2026-11-17.portd`). The first start asks once, *"What should PortD call you?"*, and you can skip it. Change or clear either in Settings > Profile.

- The picture is an emoji, a picture chosen from this computer, or (the default) your initials on a coloured tile. A picture is cropped to a square and stored at 128 × 128.
- With no name and no picture, PortD shows "PortD" and its logo.
- Programs can read the name as `PortD.app.user.displayName`. They cannot read the picture.

**It is a display name and a picture only.** It is not an account, not a sign-in and not a second user, and `P:\User` keeps its name. It is kept in `P:\User\Config\profile.json` as `{ "version": 1, "displayName": "…", "avatar": null }`, where `avatar` is `null` (initials), `"emoji:🙂"` or a PNG data URL. Any other value is ignored.

## Accessibility

**Keyboard.** Every action works from the keyboard, with a visible focus ring at least 2 px wide. The desktop and the taskbar are each one tab stop; arrow keys move inside them.

- **Ctrl+F6** (Shift to go back) moves between the desktop, the taskbar and the open window, also from inside an installed program. The **Menu key** or **Shift+F10** opens the menu of whatever has focus.
- Menus, the window list and dialogs keep Tab inside, close with Esc, and return focus to where they were opened from. A submenu opens with Right or Enter and closes with Left or Esc.

**Text size** (Settings > Appearance > Text and motion): 100, 112, 125 or 150 %. It scales PortD's own text and everything sized around it: windows, menus, dialogs, the taskbar, icons and their spacing. Layout limits follow it, so at 150 % a 900 px wide screen counts as narrow (maximised windows, icon-only taskbar, no snapping). Installed programs, To-Do included, draw their own content and are not scaled; use the browser's zoom for those.

**Motion.** Nothing animates when the system asks for reduced motion. **Reduce motion** in the same part of Settings does the same by hand, for a computer where you cannot change the system setting.

**Contrast.**
- In both themes text is at least 4.5:1 against what is behind it, and the edges of buttons, fields, windows, menus and dialogs at least 3:1. This is measured, on every screen, by the suite.
- The accent colour is your choice, so PortD adjusts where it is used: a fill is deepened or given dark text so its label stays readable, and an accent too pale to see is not used for selection marks.
- When the system asks for more contrast, text reaches 7:1 and control edges 4.5:1.
- With a Windows contrast theme (forced colours), PortD draws borders instead of relying on fills and uses the system's highlight colours for selection and focus. Icons keep their own colours.

**Screen readers.** The desktop and file lists are multi-select lists, the taskbar a toolbar, windows labelled dialogs, menus and the window list menus. Icon-only buttons have names. Notices are announced politely, errors at once. This was checked by inspecting roles and names, not by listening with a screen reader.

**Touch.** With a touch screen as the main pointer, taskbar buttons, window buttons, menu items, window-list rows, PortD menu rows, tabs and dialog buttons are at least 40 px.

## Your data

Everything on the drive is one JSON document. A working copy lives in the browser (IndexedDB, or localStorage where IndexedDB is unavailable) and is saved half a second after each change. The copy from just before the last save is kept as the one previous version.

**All copies of `portd.html` opened from disk in the same browser profile share one desktop**, whichever folder they are in. Browsers treat every `file://` page as the same site for storage. A different browser profile, or a different browser, is a different desktop.

**One window saves.** If PortD is already open in another tab or window, the second one is read-only and says so, with a **Take over** button. Taking over waits for the other window to finish saving, then loads what it saved.

**A desktop that can't be opened is refused, never replaced.** If the stored copy is from a newer PortD, is damaged, or can't be read, PortD stops and says why, and changes nothing. It offers the previous version if that one opens, or a new desktop (the unreadable copy is then kept aside in browser storage under `set-aside`).

### Backup and restore

Settings > Data > **Download backup** writes the whole desktop (files, programs, settings) as one `.portd` file, named `<display name>-YYYY-MM-DD.portd`, or `portd-YYYY-MM-DD.portd` without a name. The same button is in the PortD menu's footer. Afterwards a toast gives the counts: *"Backup saved: 1,284 files in 3 programs, 24.1 MB."*

**Restore from a backup file…** replaces everything on the desktop with what the file holds. It asks first and shows the backup's counts and date; the question has **Download a backup of this desktop first**, which saves the present desktop and leaves the question open. After restoring, PortD counts the running desktop and the copy stored in the browser again and compares both with the backup. If they match it says so (*"Restored: … the same as the backup."*). If they do not, it says **the restore FAILED**, shows all three counts, and points to Restore previous version.

A file from the prototype, a file from a newer PortD and a damaged file are refused with the reason, and nothing changes. A file whose checksum does not match its contents, or whose stated counts are not what it holds, can still be restored, but the question says *"This file may have been modified or damaged"* and why.

**Restore previous version…** goes one save back, and shows when that version was saved. The desktop it replaces becomes the previous version, so doing it twice swaps back.

**Reset** erases everything and starts a new desktop, with the same download-first choice. A linked data file is unlinked first and left as it is.

Restoring, resetting and loading a data file close open windows, end the undo history (Undo says why), and cannot be done from a read-only tab.

**The reminder.** *Remind me every 1 / 7 / 14 / 30 days* is on by default at 7 days. When a backup is due, a notice appears at start-up with **Download backup**, **Later** and **Settings**; it never appears on the first start of a new desktop, and PortD never starts a download by itself. After twice the interval a warning sign appears on the taskbar next to the save status; clicking it shows the notice again.

### Linked data file

Where the browser offers the File System Access API, Settings > Data can link one real file on the computer: **Create data file…** or **Open existing data file…**. Every save is then also written to that file and read back. A file that does not read back as written is reported as a failed save, never as "Saved". A linked file that is being written and read back correctly counts as a backup, so there is no reminder; the section says so.

- The browser asks for permission again after it restarts. Until you press **Reconnect** (in Settings or on the taskbar), changes are saved in the browser only, and the reminder applies again.
- At start-up, if the file is newer than the browser's copy (edited on another computer, say), PortD offers to load it, showing both dates. Cancel keeps the browser's copy, which is then written to the file.
- If the file is no longer a PortD data file, PortD says so, writes nothing to it, and keeps saving in the browser.
- **Unlink** forgets the file and leaves it as it is.
- To move to another computer: copy the file, open `portd.html` there, and choose **Open existing data file…**.
- Where the API is not available (policy can turn it off), one line says so and points to Download backup. Nothing else changes.

### Check my data

Settings > Data > **Check my data** looks over the running desktop and lists each problem with its path:

- a program folder without a `manifest.json`, with one that cannot be used, with an id that does not match its folder, or without its entry file;
- a default app that points to a program that is not installed or to an unknown `builtin:`;
- a taskbar pin or a desktop shortcut that points nowhere;
- names in `desktop.json` that are not on the desktop;
- a settings file that does not parse;
- a Recycle Bin item with no record of where it came from.

It offers to fix only what is safe: it removes dangling pins, default apps and `desktop.json` entries, and gives a Recycle Bin item a record pointing at `P:\User`. It never deletes a file or a program; broken programs and shortcuts are listed and left for you. The same list is available to tests as `PortDHost.checkData()`.

### Settings file

`P:\User\Config\settings.json`; a missing or unknown value takes the default shown:

```json
{ "theme": "light", "accent": "#2f7de1",
  "wallpaper": { "type": "preset", "value": "Dawn", "fit": "cover" },
  "taskbar": { "tint": "standard", "customColor": "#2b3440", "labels": "auto" },
  "backup": { "remind": true, "everyDays": 7, "lastBackupAt": null },
  "windows": {}, "textSize": 100, "reduceMotion": false }
```

`wallpaper.type` is `preset`, `color` or `image` (a path on the drive). `taskbar.tint` is `standard`, `accent`, `background` or `custom`; `labels` is `always`, `auto` or `never`. `windows` holds one remembered rectangle per program id, built-ins as `builtin:<name>`.

### Data file format, version 2

```
{ "format": "portd-data", "formatVersion": 2, "appVersion": "1.0.0", "createdAt": …, "savedAt": …,
  "integrity": { "alg": "SHA-256", "value": "…" },
  "summary": { "files": …, "folders": …, "programs": …, "bytes": … },
  "fs": { … } }
```

- Folder: `{ "t": "d", "c": { name: node }, "ct", "mt" }`. File: `{ "t": "f", "enc": "text" | "dataurl", "d", "ct", "mt" }`. Any node may carry `icon`: `"emoji:…"`, `"glyph:<name>"` or a PNG data URL.
- `integrity` is the SHA-256 of exactly the `fs` text in the file. It is advisory: a mismatch is a warning, never a refusal.
- `summary` is counted when the file is written. `programs` counts the folders in `P:\Programs`.
- A document is checked when it is opened and refused with the reason and the path if it is not sound: a bad name, two names that differ only in case, a file without content, a missing system folder, anything extra in the root. Nothing is dropped to make a document fit.
- Format 1 is the prototype's and is refused: *"This file was made by the PortD prototype (0.x) and can't be opened by PortD 1.0."* A file newer than the build is refused with a message naming both versions.
- Migrations are a table of functions, one per format step, run in order when an older document is opened and at no other time. The table is empty in 1.0.0.
- A file larger than 64 MB, or a drive too large for the browser to write as one text, makes writing a data file fail with a message naming what is too big. A partial file is never written.

## Why there is no encryption

Deliberately none, and no lock screen. Corporate security tools flag unknown encrypted files, and a user's encrypted files can trigger an IT investigation, so the data file is plain JSON. Keep backups somewhere sensible, and don't store passwords on the drive.

## Limitations

- **A program can use WebRTC, and nothing in the page can stop it.** In the test browser a program opened an `RTCPeerConnection` and sent STUN packets to an address of its choosing. Adding `webrtc 'block'` to the security policy was tried and made no difference in Chrome 153. Every other route that was tried is blocked (see How it was checked). This is accepted for now: treat "no network" for an installed program as "no HTTP, no WebSocket", and install only programs you trust.
- A program is an ordinary web page with scripts. The sandbox keeps it away from your drive and from PortD's page, not from using the processor or showing misleading content inside its own window.
- Programs cannot use ES modules, `fetch`, workers or in-page `#` links; see Writing a program.
- A program's window is white behind a page that sets no background of its own, in the dark theme too: PortD does not pass its theme to programs.
- A program open in a read-only tab (PortD open twice) can still call `fs.write`; like everything else in that tab, the change is not saved.
- Type icons from a program apply to files of a type you have set that program as the default for, not merely to types it declares.
- There is one previous version, and it is the desktop from just before the last save, so it is only seconds old in normal use. It is a way back from a restore or a reset, not a history.
- A backup is as large as the drive, held in memory while it is written. A desktop of 40 MB backed up and restored in the test browser; where the browser's limit lies on the target machine is not known. Past it, the backup is refused with a message and nothing is written.
- The linked data file is rewritten whole on every save, so a very large drive makes each save slow.
- Opening a `.portd` file that is on the drive does nothing but offer it as a download: restoring is done from Settings > Data, with a file from the computer.
- No "replace" option when a name is taken: the newcomer is numbered instead.
- Dragging inside Files does not work by touch.
- Notepad opens text files only, and loads the whole file. Ctrl+N is not used, because the browser keeps it.
- The Image Viewer shows pictures stored as pictures. An `.svg` added from the computer is stored as text and opens in Notepad.
- Renaming or moving something does not update shortcuts and pins that point at it; they show as missing.
- The window list is for pinned programs. A program that is not pinned has one taskbar button per window.
- The taskbar has no translucent option: the build spec does not list one.
- A profile picture comes from an emoji or from this computer. There is no choosing one from the drive, and no dropping one onto the preview.
- "Match the background" measures a picture as a whole, squeezed to a square, so with the Fit, Centre and Tile layouts it is the bottom of the picture rather than of the screen that is matched.
- Text size does not scale what installed programs draw.
- Tabbing forward past the last control leaves the page for the browser's own toolbar before coming round, as on any web page.
- Sizes of text files are counted in characters, not bytes, except inside a zip, where they are real bytes.
- Without WebCrypto, data files are written without a checksum.
- Without Web Locks and BroadcastChannel there is no protection against opening PortD twice; Settings > About says so.
- The files in `P:\OS` are written when a desktop is created and not refreshed by later builds.
- A change made in the last half second before the browser is closed is written in one step as the page goes away. Browsers do not guarantee that such a write completes.

## How it was checked

1,384 automated checks, in `suite/run.js`, `suite/shell.js`, `suite/files.js`, `suite/programs.js`, `suite/data.js`, `suite/polish.js` and `suite/audit.js`, run in **headless Chrome 153 on Linux, from `file://`**, with a fresh browser profile per group. The suite lives outside `portd.html` (and is not part of this repository). It reaches the page through `window.PortDHost` (`version`, `vfs`, `Path`, `DIR`, `wm`, `launch`, `openPath`, `getState`, `checkData`) and through the page itself, with real mouse and keyboard input for everything in the shell.

Covered: the drive rules; save, reload and the previous version; the same document in a fresh profile; the data-file text, checksum and summary; every refusal; a dummy migration table; tabs taking over from each other; start-up without IndexedDB, without any storage, without the storage manager and without WebCrypto; the real 0.4.0 prototype running in the same profile; the nine first-run icons, their order, glyphs and wrapping; selection, arranging and opening on the desktop; menus, submenus and dialogs from mouse and keyboard; window moving, resizing and remembering; every edge, corner and panel zone for snapping, the panel's trigger area, the Maximise hover and the window menu; narrow screens; reduced motion; the taskbar colour and contrast in both themes; pins; the PortD menu; Appearance, including contrast for five awkward accent colours; browsing, selecting and sorting in Files; every undoable action undone and redone, the 20-deep limit, undos that can no longer apply, and the history being cleared by a take-over; the Recycle Bin, including a recreated folder and a taken name; drag and drop between rows, the sidebar, the path, the desktop and desktop folders; every search filter alone and combined, the 300 cap and the 2 MB limit; zip files read back by Python's `zipfile` (names, sizes, CRCs, times, empty folders) and both zip limits refused; Properties and all three kinds of custom icon; shortcuts; Notepad with the Open and Save dialogs; the Image Viewer; and the Calculator.

Program platform (Phase 4): To-Do as shipped, running, saving, surviving a reload, uninstalled, not coming back at start-up, and reinstalled with its data kept; Ctrl+F6 and Ctrl+Shift+F6 pressed inside To-Do, all the way round; every package refusal by message, including a prototype package, the path rules and the three size limits; the confirmation, folder, shortcut and notice of an install; assembly of a nine-file test program (script order, `@import`, `url()`, pictures, a `</script>` inside a script, modules left alone) and `PortD.assets` with its 2 MB and 8 MB limits; the API from inside a real sandboxed frame: the data folder works, and other user files, other programs, the OS folder, Config outside its own folder, `..` paths and the folders themselves are denied with the exact message; move, copy and rename held inside the data folder; the Open and Save dialogs granting exactly one file, a second dialog rejected, the grant ending with the window and not surviving a reload or reaching a second window; `args.open` and `onOpenFile`; type names and icons, Open with, Choose another program, Default apps; updating, older and same versions; the id namespace with a package called `files`; export and reinstall giving back the same folder, with a dot file and mixed-case names.

**A hostile test program against a local web server**, with a control request proving the server was reachable: nothing arrived by image, script, stylesheet, font, media, `fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket`, workers, dynamic import, prefetch, link ping, nested frame, object, embed, navigating its own frame four ways, submitting a form by GET and POST, navigating PortD's page, or opening a window. The same program's `RTCPeerConnection` did send UDP packets to a test port: see Limitations.

Data safety (Phase 5): the backup file's name, text, checksum and summary against an independent count; the round trip with To-Do as shipped, To-Do with tasks, a single-file program, a program folder with a dot file and mixed-case names, a program edited on the drive after installing, pins, default apps and saved data, each restored **into a fresh browser profile**, over an existing desktop, then reloaded, then launched straight away, comparing the drive with the backup file byte for byte and checking To-Do's tasks on screen; a 40 MB desktop; every refusal on restore; a changed file and a wrong summary warned about; a build variant that loses a program while restoring, to prove the failed-restore message appears; the previous version, Reset, the reminder at each interval and the taskbar warning, with the date of the last backup set back; a read-only tab refused; a file over the limit refused with no download and no success message; a damaged desktop caught in every Check my data category, each safe fix applied, and everything else on the drive identical afterwards; the linked data file created, written, read back, reopened in a second profile, found newer at start-up, found broken, failing to read back, losing permission, reconnected and unlinked.

Profile and polish (Phase 6): the first start (Welcome note from its first line, the one question, Skip, Save, the 40-character limit, nothing on the second start); the name in the PortD menu, About, backup names and `PortD.app.user`, and shown as text not markup; the picture as an emoji, as a file from this computer cropped to 128 × 128, and back to initials, with five values PortD does not accept ignored and the picture kept from programs; the Programs folder's window icon in the sidebar, in the drive's list and on a shortcut to it, and the gear on `P:\OS`; each taskbar colour mode in both themes against the formula, with **Match the background checked against a screenshot** of the background's bottom 15 % for three built-in backgrounds, a solid colour and a two-colour test picture; eight awkward custom colours each keeping text at 4.5:1, also on a hovered button; the three window-name modes with the 100 and 120 px thresholds approached from both sides; the window list by click, by resting the pointer and from the keyboard, following windows as they close, and staying on screen on a small, crowded taskbar; each text size, with the layout limit at 150 %; no running animation with the switch or with the system setting; 40 px targets with a touch pointer.

**The measurements (A06).** A script run in the page measures every piece of visible text against the stack of fills behind it (and against both white and black where that stack ends on a picture), the border, fill or ring of every button, field, window, menu and dialog against its surroundings, and the width and contrast of the focus ring on every stop. It is run over 26 screens that between them show every window, every Settings tab, the menus, the window list, the snap panel, the dialogs, a notice and a toast, and inside To-Do's own frame: in both themes; over seven screens for five more accent colours (near-white, near-black, yellow, pink, green) in both themes; on the taskbar in six colours in both themes; and in a read-only tab. With more contrast asked for it is run again at 7:1 and 4.5:1, and with forced colours it checks that every surface and control has a border and that selection still shows. A second script checks fit at 150 % text size at 640, 1280 and 1920 px wide, and at 100 % at 640 × 480 and 1024 × 600: every surface inside the screen, no button label cut off, dialog buttons reachable, title-bar buttons present, desktop icons not overlapping. Tab and Shift+Tab are pressed 70 times each to confirm every stop shows its ring and none repeats within a round.

Those measurements found and fixed: secondary text on a selected or hovered row (3.9:1 in the dark theme), the focus ring on a menu item that is also hovered (1.4:1), muted text on selected rows under forced colours, and several colours that fell short of 7:1 when more contrast is asked for (the danger colour, hover shades, accent fills and the taskbar's hover shade).

How some checks reach the code:
- Checks of the data-file text and of refusals by message run against a copy of `portd.html` that the suite makes and that also exposes a few internals, because no screen reaches that code until Backup and restore is built.
- The migration checks run against copies in which the suite changes the format version and fills the migration table.
- **The linked data file was not tested from `file://`.** A file picker cannot be driven without a real dialog, so that part runs over `http://127.0.0.1` with the two pickers replaced by ones that hand out files in the browser's private file system. The file handles, their permissions, writing and reading back are the browser's own; the picker dialogs and a file in a real folder are not exercised.
- The failed-restore message and the size refusal are reached with build variants the suite makes (one drops a program while restoring, one has a 2,000-byte file limit), because the shipped build gives no way to make them happen.
- More contrast, forced colours, reduced motion and a touch pointer are the test browser's emulation of those settings, with its default forced-colours palette. A row or button is only measured in its hovered state where a screen happens to leave the pointer on it.
- The reminder's timing is tested by setting the stored date of the last backup back by 6, 8 and 15 days, not by waiting.
- Programs are driven inside their real frames: the test tool can run code in a sandboxed frame, so each API call is made as the program would make it.
- Dropping files from the computer is simulated with a synthetic drop event, and the file picker with the test tool's stand-in. Downloads are caught by the test tool and read back from disk.

**Not run:** Microsoft Edge (none on the build machine), so whether Edge treats a sandboxed `srcdoc` frame, its inherited policy and WebRTC exactly as Chrome does is unknown; the File System Access pickers, a linked file in a real folder, and whether Edge policy on the target machine allows them at all; Windows, a real locked-down machine, real Edge policies (downloads may be restricted there), a real drag from Explorer, a real file picker, a zip opened in Windows Explorer, a screen reader, a real Windows contrast theme, a real touch screen, browser zoom combined with the text-size setting. Persistent storage was "not granted" in headless Chrome; what Edge answers on the target machine is unknown. Fonts differ on Linux, so label wrapping on Windows may differ from the test screenshots.

## Try it on the target machine

1. Open `portd.html` from disk in Edge. Nine icons should appear on the dawn-coloured background above a light taskbar, with no error.
2. Open Settings > About. **Browser storage** should say IndexedDB, **Single instance** Web Locks, **Checksum** SHA-256. Note what **Persistent storage** says.
3. Drag the Settings window to the top middle of the screen: the snap panel should drop down. Drop on a half. Then rest the pointer on the Maximise button.
4. Drop a file from Explorer onto the desktop. Open Home, make a folder, drag the file into it, and press Ctrl+Z.
5. Right-click a folder and choose **Download as .zip**. Open the zip in Explorer. If nothing downloads, policy is blocking downloads: note it.
6. Switch to Dark in Settings > Appearance, close Edge, and open the file again: the theme, the icon arrangement and the window position should be as you left them.
7. Double-click **To-Do**, add a few tasks, close the window and open it again: the tasks should be there. Click inside To-Do and press Ctrl+F6: focus should move to the desktop.
8. Settings > Data > **Download backup**. If nothing downloads, policy is blocking downloads: note it, because then a linked data file is the only copy that leaves the browser.
9. Open `portd.html` in a fresh Edge profile (a real second profile, not an InPrivate window), choose Settings > Data > **Restore from a backup file…**, pick the backup, and check that To-Do opens with your tasks.
10. Settings > Data > Linked data file. If it shows **Create data file…**, create one in Documents, change something, and check the file's time changes. Restart Edge: the taskbar should offer **Reconnect data file**. If the section says the browser does not offer it, policy has turned the API off: note it.
11. Settings > Data > **Check my data** should say no problems found.
12. Settings > Developer > **Export as .portdapp…** for To-Do. Then Settings > Programs > Uninstall it, and **Install a program…** with the file you just saved.
13. Settings > Appearance > Text size > **150 %**: everything should grow together and stay on screen. Open Settings, Files and a dialog at that size, then set it back.
14. Open three Notepad windows, pin Notepad from one of its taskbar buttons, and click the pinned button: the list of windows should appear above it.
15. Open the same file in a second tab. It should show the amber read-only bar. Press **Take over**: the bar should move to the first tab.
