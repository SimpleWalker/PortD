# PortD: your own desktop in a single file

PortD is a complete little desktop that lives in **one HTML file**. Open it in your browser and you get your own drive, desktop, taskbar, windows, apps and settings, on any computer, including one that is locked down so tightly you cannot install anything.

- **Nothing to install.** No admin rights, no installer, no setup.
- **Nothing leaves your computer.** PortD never uses the network. No accounts, no cloud, no tracking.
- **It goes where you go.** Everything you make can be saved as one backup file and restored on another computer.

> **100 % vibe coded.** Every line of PortD, and its test suite, was written by Claude Fable 5.2 from plain-English requests. A person described what they wanted; the AI built it. It has been tested a lot (1,384 automated checks), but see [What has and hasn't been tested](#what-has-and-hasnt-been-tested) before you rely on it.

## Getting started in one minute

1. Download [`portd.html`](portd.html) (open it on GitHub and use the download button, or right-click **Raw** and choose *Save link as*).
2. Open the file in **Microsoft Edge** or **Google Chrome**. Double-clicking it is enough.
3. A Welcome note opens and asks, once, what PortD should call you. You can skip that.
4. You now have a desktop with nine icons and a taskbar along the bottom. Double-click **Home** to look at your files, or click the **PortD** button on the taskbar to find programs.

That is all. Next time you open the same file in the same browser, everything is exactly as you left it.

## What you can do with it

| | |
|---|---|
| **Keep files** | Make folders and text files, rename, copy, move, delete (with a Recycle Bin and Undo), search by name or by what is inside a file. |
| **Bring files in and out** | Drag files from your computer onto the desktop to copy them in. Download a single file, or a whole folder as a `.zip`. |
| **Use the built-in apps** | Notepad, Image Viewer, Calculator and Settings. |
| **Add programs** | Install small web-page programs (`.portdapp` packages, or any single `.html` file). They run in their own sandboxed window and can only see their own data and the files you hand them. A To-Do list is included. |
| **Make it yours** | Light or dark theme, any accent colour, six backgrounds or your own picture, resizable windows that snap to halves and quarters, pinned taskbar items, bigger text. |
| **Move house** | Download a backup (one `.portd` file) and restore it on any other computer or browser. |
| **Use it without a mouse** | Everything works from the keyboard, and it respects reduced motion, high contrast and large text. |

## Looking after your data (please read this part)

Your desktop is stored **inside your browser**. That is convenient, but it means:

- **Clearing your browser data erases your desktop.** Closing the browser does not.
- **A different browser, or a different browser profile, is a different desktop.**
- **Copies of `portd.html` in different folders share the same desktop** (browsers treat all local files as one site).

So make a habit of backing up:

- **Settings > Data > Download backup** saves everything (files, programs, settings) as one `.portd` file. Keep it somewhere safe. PortD reminds you every 7 days by default, and never downloads anything by itself.
- **Settings > Data > Restore from a backup file…** puts a backup back, on this computer or any other.
- **Linked data file** (Chrome and Edge, if your computer allows it): PortD can keep one real file on your disk up to date after every change. A healthy linked file counts as a backup.
- **Restore previous version** takes you back one save if a restore or reset goes wrong.
- **Check my data** looks over the desktop for broken things and offers to fix the safe ones. It never deletes your files.

**There is no encryption and no password, on purpose.** Security software on managed computers often flags unknown encrypted files, so the backup is plain readable JSON. Do not store passwords or other secrets in PortD.

## Handy to know

- **Open it twice and the second window is read-only.** PortD can only save from one window at a time. Press **Take over** in the second window to switch.
- **Undo** (`Ctrl+Z`) covers file actions: moves, copies, renames, deletes to the Recycle Bin, new folders and files. It does not cover permanent deletes, restoring backups or installing programs.
- **Snapping windows:** drag a window to the top middle of the screen for a layout panel, or to a side or corner. You can also rest the pointer on the Maximise button.
- **Right-click everything.** Files, desktop icons, taskbar buttons and programs all have menus.
- **Keyboard:** `Ctrl+F6` jumps between the desktop, taskbar and the open window (also from inside a program). `F2` renames, `Delete` sends to the Recycle Bin.
- **Only install programs you trust.** A program cannot see your drive, but it is still a web page running scripts. In particular, a program can use WebRTC to reach the network, and nothing PortD can do will stop that.
- **If a program freezes**, its title bar turns red with *(Not responding)* and a red bar appears at the top. Press **Close all programs** to recover. Built-in apps such as Notepad stay open, and your saved files are untouched; anything unsaved inside the programs is lost.

## Limits

- **One stuck program stops all programs.** In Edge and Chrome every program runs in one shared process, apart from PortD. If one program gets stuck, the others stop with it, so PortD marks all of them and offers **Close all programs**. Closing only the stuck one is not enough.
- **If a browser or company policy runs programs inside PortD's own process**, a stuck program freezes PortD as well. Then no bar can appear, and only reloading the tab helps. Edge and Chrome do not do this by default.
- The full list is under [Limitations](docs/TECHNICAL.md#limitations) in the technical reference.

## What has and hasn't been tested

The 1,412 automated checks were run in **headless Chrome on Linux, opening the file from disk**. That is a good test, but it is not your computer. Not yet tested on real hardware:

- Microsoft Edge (the main target)
- Windows, and a genuinely locked-down corporate machine with its real policies
- Downloads, file pickers and the linked data file under those policies (some can be switched off by IT)
- A screen reader, a real Windows high-contrast theme, a real touch screen

If you are going to depend on PortD at work, follow the 15-step **[Try it on the target machine](docs/TECHNICAL.md#try-it-on-the-target-machine)** checklist first. It takes a few minutes and tells you what your computer allows.

## Is it safe to run on my work computer?

PortD is a plain web page. It installs nothing, asks for no special permissions and makes no network requests (a security policy built into the file enforces that). That said, **check your employer's rules**: some organisations restrict personal tools on work machines no matter how they work.

## Learn more

- **[docs/TECHNICAL.md](docs/TECHNICAL.md)**: the full reference. The drive layout, every feature in detail, how to write your own program, the data format, known limitations, and exactly how it was tested.
- **[AGENTS.md](AGENTS.md)**: instructions for AI agents that read or change this repository.
- **[suite/](suite/)**: the automated test suite and how to run it.

## Licence

See [LICENSE](LICENSE).
