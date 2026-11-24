/* PortD suite, Phase 5: data safety. Backup and restore with their summaries, the round trip of programs and their
   data (R10), the previous version, Reset, the backup reminder and taskbar warning, Check my data and its fixes (R12),
   failing loudly, and the linked data file (R03). Backups are real downloads read back from disk and restored through
   the file picker into other browser profiles. */
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto');
module.exports = async ({ check, section, profile, newDir, variant, file, saved, reload, text, tmp, html, firstRunAway }) => {
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const DOCS = 'P:\\User\\Documents', DESK = 'P:\\User\\Desktop', CONFIG = 'P:\\User\\Config', PROGS = 'P:\\Programs', BIN = CONFIG + '\\Recycle Bin';
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fmtSize = n => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1073741824).toFixed(1) + ' GB';
  const count = (n, one) => n.toLocaleString('en') + ' ' + one + (n === 1 ? '' : 's');
  /* an independent count of what a backup file holds */
  const tally = tree => { const s = { files: 0, folders: -1, programs: 0, bytes: 0 }; (function walk(n) { if (n.t === 'f') { s.files++; s.bytes += n.enc === 'dataurl' ? Buffer.from(n.d.slice(n.d.indexOf(',') + 1), 'base64').length : n.d.length; } else { s.folders++; Object.values(n.c).forEach(walk); } })(tree);
    s.programs = Object.values(tree.c.Programs.c).filter(n => n.t === 'd').length; return s; };
  const words = s => count(s.files, 'file') + ' in ' + count(s.programs, 'program') + ', ' + fmtSize(s.bytes);
  const fsTextOf = t => t.slice(t.indexOf(',"fs":') + 6, -1);
  /* everything a test needs to drive one page */
  const drive = page => {
    const ev = (fn, arg) => page.evaluate(fn, arg), settle = (ms = 100) => page.waitForTimeout(ms);
    const o = { page, ev, settle,
      ls: p => ev(p => PortDHost.vfs.exists(p) ? PortDHost.vfs.list(p).map(e => e.name).join('|') : 'MISSING', p),
      has: p => ev(p => PortDHost.vfs.exists(p), p), read: p => ev(p => PortDHost.vfs.read(p), p),
      write: (p, d, enc) => ev(([p, d, enc]) => { PortDHost.vfs.write(p, d, { enc }); }, [p, d, enc]),
      fsText: () => ev(() => JSON.stringify(PortDHost.getState().fs)),
      toast: () => ev(() => { const t = document.querySelector('#toasts .toast:last-child'); return t ? t.firstChild.textContent : ''; }),
      toasts: () => ev(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.firstChild.textContent).join(' | ')),
      dlg: () => text(page, '.ov:last-of-type .dlg'),
      buttons: () => ev(() => { const d = [...document.querySelectorAll('.ov .dlg')].pop(); return d ? [...d.querySelectorAll('.acts .btn')].map(b => b.textContent).join('|') : null; }),
      press: async label => { await page.locator('.ov:last-of-type .dlg .btn', { hasText: new RegExp('^' + esc(label) + '$') }).click(); await settle(180); },
      notices: () => ev(() => [...document.querySelectorAll('#notices .notice')].map(n => n.querySelector('b').textContent + ' [' + [...n.querySelectorAll('.btn')].map(b => b.textContent).join('|') + ']').join(' || ')),
      noticeText: () => ev(() => { const n = document.querySelector('#notices .notice'); return n ? n.innerText : ''; }),
      titles: () => ev(() => PortDHost.wm.wins.map(w => w.title).join('|')),
      closeAll: async () => { await ev(async () => { for (const w of PortDHost.wm.wins.slice()) await w.close(true); }); await settle(); },
      data: async () => { await ev(() => { PortDHost.launch('builtin:settings', { tab: 'data' }); }); await settle(200); },
      pane: () => text(page, '.spane'),
      sbtn: label => page.locator('.spane .btn', { hasText: new RegExp('^' + esc(label) + '$') }),
      tray: () => ev(() => [...document.querySelectorAll('#tray [data-tray]')].map(b => b.dataset.tray).join('|')),
      frame: async (sel = '.win.active iframe') => { const el = await page.waitForSelector(sel, { timeout: 5000 }); const f = await el.contentFrame(); await f.waitForFunction(() => window.PortD && document.readyState === 'complete'); return f; },
      download: async trigger => { const [dl] = await Promise.all([page.waitForEvent('download'), trigger()]); const p = path.join(tmp, 'dl-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + dl.suggestedFilename()); await dl.saveAs(p); await settle(150); return { name: dl.suggestedFilename(), path: p, text: fs.readFileSync(p, 'utf8') }; },
      noDownload: async trigger => { let got = false; const on = () => { got = true; }; page.on('download', on); await trigger(); await settle(700); page.off('download', on); return !got; },
      backup: async () => { await o.data(); return o.download(() => o.sbtn('Download backup').click()); },
      /* Settings > Data > Restore from a backup file…, with the file chosen in the picker; the confirmation is left open */
      choose: async p => { await o.data(); const [ch] = await Promise.all([page.waitForEvent('filechooser'), o.sbtn('Restore from a backup file…').click()]); await ch.setFiles(p); await settle(350); },
      restore: async p => { await o.choose(p); await o.press('Restore'); await saved(page); await settle(150); }
    };
    return o;
  };
  const open = async (o = {}) => { const ctx = await profile(newDir(), Object.assign({ reminders: true }, o)); const page = await ctx.open(o.file || file); await saved(page); return Object.assign(drive(page), { ctx }); };
  const t = d => ({ enc: 'text', d });
  const KIT = { format: 'portd-app', formatVersion: 3, id: 'kit', name: 'Kit', version: '1.0.0', description: 'Test program.', icon: 'glyph:table', entry: 'index.html', width: 420, height: 320, fileTypes: [{ ext: '.md', name: 'Markdown note' }],
    files: { 'index.html': t('<!DOCTYPE html><html><head><title>Kit</title><link rel="stylesheet" href="css/main.css"><script src="Js/Extra.JS"></script></head><body><p id="p">kit</p></body></html>'), 'css/main.css': t('#p{color:rgb(1, 2, 3)}'), 'Js/Extra.JS': t('window.extra = 1;'), '.env': t('dot file'), 'img/dot.png': { enc: 'dataurl', d: 'data:image/png;base64,' + PNG } } };
  /* a desktop with a bit of everything that has ever gone missing */
  const enrich = async a => {
    await a.write(DOCS + '\\kit.portdapp', JSON.stringify(KIT));
    await a.ev(() => { PortDHost.openPath('P:\\User\\Documents\\kit.portdapp'); }); await a.settle(200); await a.press('Install');
    await a.page.locator('.notice .btn', { hasText: /^Set as default$/ }).click(); await a.settle();
    await a.write(DOCS + '\\Clock.html', '<!DOCTYPE html><html><head><title>My Clock!</title></head><body><p id="p">tick</p></body></html>');
    await a.ev(() => { PortDHost.openPath('P:\\User\\Documents\\Clock.html'); }); await a.settle(200); await a.press('Install as a program…'); await a.press('Install');
    await a.ev(PNG => { const v = PortDHost.vfs;
      v.write('P:\\Programs\\kit\\css\\main.css', '#p{color:rgb(9, 8, 7)}', { sys: true });      /* edited on the drive after installing */
      v.write('P:\\User\\Documents\\Report.md', '# Report\r\nwith ünïcode'); v.mkdir('P:\\User\\Documents\\Work'); v.write('P:\\User\\Documents\\Work\\plan.txt', 'the plan');
      v.write('P:\\User\\Pictures\\dot.png', 'data:image/png;base64,' + PNG, { enc: 'dataurl' }); v.setIcon('P:\\User\\Documents\\Work', 'emoji:🗂');
      v.write('P:\\User\\Documents\\gone.txt', 'deleted'); const b = v.move('P:\\User\\Documents\\gone.txt', 'P:\\User\\Config\\Recycle Bin\\gone.txt', { sys: true }); v.node(b).del = { name: 'gone.txt', from: 'P:\\User\\Documents', at: 1700000000000 };
      v.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [{ type: 'program', id: 'kit' }, { type: 'path', path: 'P:\\User\\Documents\\Work' }] }));
      v.write('P:\\User\\Config\\profile.json', JSON.stringify({ version: 1, displayName: 'Lily' }));
      const s = JSON.parse(v.read('P:\\User\\Config\\settings.json')); s.theme = 'dark'; v.write('P:\\User\\Config\\settings.json', JSON.stringify(s)); }, PNG);
    await a.ev(() => { PortDHost.launch('todo'); }); await a.settle(250);
    const f = await a.frame(); await f.locator('#t').fill('Buy milk'); await f.locator('#t').press('Enter'); await f.locator('#t').fill('Call Sam'); await f.locator('#t').press('Enter'); await f.locator('li input').first().check(); await a.settle(200);
    await a.closeAll(); await saved(a.page);
  };
  /* the R10 list, on a page that should now hold the enriched desktop */
  const verify = async (p, label, backupText) => {
    const c = (name, ok, detail) => check(label + ': ' + name, ok, detail);
    if (backupText) c('the drive is exactly what the backup file holds, to the byte', await p.fsText() === fsTextOf(backupText));
    c('program folders', await p.ls(PROGS) === 'kit|my-clock|todo', await p.ls(PROGS));
    c('manifests', await p.ev(() => ['kit', 'my-clock', 'todo'].map(id => { const m = JSON.parse(PortDHost.vfs.read('P:\\Programs\\' + id + '\\manifest.json')); return m.id + ':' + m.name + ':' + m.entry; }).join('|')) === 'kit:Kit:index.html|my-clock:My Clock!:index.html|todo:To-Do:index.html');
    await p.page.locator('#start').click(); await p.settle(150);
    c('the PortD menu lists them', await p.ev(() => [...document.querySelectorAll('#startmenu .smi')].map(b => b.textContent).join('|')) === 'Files|Notepad|Calculator|Settings|Kit|My Clock!|To-Do', await p.ev(() => [...document.querySelectorAll('#startmenu .smi')].map(b => b.textContent).join('|')));
    await p.page.keyboard.press('Escape'); await p.settle();
    c('their desktop shortcuts resolve', await p.ev(() => ['Kit', 'My Clock!', 'To-Do'].every(n => { const d = [...document.querySelectorAll('.dicon')].find(e => e.querySelector('.lbl').textContent === n); return d && !d.querySelector('.ico.missing'); })));
    c('pins', await p.ev(() => [...document.querySelectorAll('.task.pin')].map(b => b.getAttribute('aria-label')).join('|')) === 'Kit|Work', await p.ev(() => [...document.querySelectorAll('.task.pin')].map(b => b.getAttribute('aria-label')).join('|')));
    c('a dot file and mixed-case names in a program folder', await p.read(PROGS + '\\kit\\.env') === 'dot file' && await p.ls(PROGS + '\\kit') === 'css|img|Js|.env|index.html|manifest.json' && await p.ls(PROGS + '\\kit\\Js') === 'Extra.JS', await p.ls(PROGS + '\\kit'));
    c('a program edited after installing keeps the edit', await p.read(PROGS + '\\kit\\css\\main.css') === '#p{color:rgb(9, 8, 7)}');
    await p.ev(() => { PortDHost.openPath('P:\\User\\Documents\\Report.md'); }); await p.settle(300);
    let f = await p.frame();
    c('the association still opens .md in Kit, which runs as edited', await p.titles() === 'Kit' && await f.evaluate(() => PortD.app.args.open.name + ':' + getComputedStyle(document.getElementById('p')).color + ':' + window.extra) === 'Report.md:rgb(9, 8, 7):1', await p.titles());
    await p.closeAll();
    await p.ev(() => { PortDHost.launch('my-clock'); }); await p.settle(300); f = await p.frame();
    c('the single-file program launches', await f.evaluate(() => document.getElementById('p').textContent) === 'tick');
    await p.closeAll();
    c('To-Do\'s saved data in Config\\todo', await p.read(CONFIG + '\\todo\\todo.json') === JSON.stringify([{ text: 'Buy milk', done: true }, { text: 'Call Sam', done: false }], null, 2));
    await p.ev(() => { PortDHost.launch('todo'); }); await p.settle(300); f = await p.frame();
    c('To-Do launches, renders correctly and shows its tasks', await f.evaluate(() => [...document.querySelectorAll('li')].map(l => l.className + ':' + l.querySelector('span').textContent).join('|') + ' ' + getComputedStyle(document.body).backgroundColor + ' ' + (document.getElementById('logo').naturalWidth > 0)) === 'done:Buy milk|:Call Sam rgb(251, 250, 247) true' && await p.titles() === 'To-Do (1 open)');
    await p.closeAll();
    c('files, a picture, an item icon, the Recycle Bin record, the theme', await p.read(DOCS + '\\Report.md') === '# Report\r\nwith ünïcode' && await p.read('P:\\User\\Pictures\\dot.png') === 'data:image/png;base64,' + PNG &&
      await p.ev(() => { const v = PortDHost.vfs; return v.node('P:\\User\\Documents\\Work').icon === 'emoji:🗂' && v.node('P:\\User\\Config\\Recycle Bin\\gone.txt').del.from === 'P:\\User\\Documents' && document.documentElement.dataset.theme === 'dark'; }));
    c('Check my data finds nothing wrong', JSON.stringify(await p.ev(() => PortDHost.checkData())) === '[]', await p.ev(() => PortDHost.checkData()));
  };

  /* ------------------------------------------------------------------ */
  section('Settings > Data: layout and wording');
  let a = await open();
  check('no reminder on the first start of a new desktop', await a.notices() === '' && await a.tray() === 'save', [await a.notices(), await a.tray()]);
  check('a new desktop passes Check my data, and the hook exposes it', JSON.stringify(await a.ev(() => PortDHost.checkData())) === '[]' && await a.ev(() => Object.keys(PortDHost).sort().join()) === 'DIR,Path,checkData,getState,launch,openPath,version,vfs,wm');
  await a.data();
  check('Settings has the six tabs', await a.ev(() => [...document.querySelectorAll('.snav .sn')].map(b => b.textContent).join('|')) === 'Appearance|Profile|Data|Programs|Developer|About');
  check('Data has its six parts in the specified order', await a.ev(() => [...document.querySelectorAll('.spane h3')].map(h => h.textContent).join('|')) === 'Where your data lives|Linked data file|Backup and restore|Check my data|Recycle Bin|Reset');
  check('Where your data lives: drive size, last saved, save status, persistent storage, browser storage used', await a.ev(() => [...document.querySelectorAll('.spane dt')].map(d => d.textContent).join('|')) === 'Drive|Last saved|Save status|Persistent storage|Browser storage used' && /Drive\s+\d+ files in 1 program, [\d.]+ KB \(\d+ folders\)/.test(await a.pane()) && /All changes saved/.test(await a.pane()), await a.pane());
  check('the words export and import do not appear anywhere on the tab', !/export|import/i.test(await a.pane()));
  check('Backup and restore: Download backup is the primary button, then Restore from a backup file…, Restore previous version…', await a.ev(() => { const h3 = [...document.querySelectorAll('.spane h3')].find(h => h.textContent === 'Backup and restore'), out = []; for (let n = h3.nextElementSibling; n && n.tagName !== 'H3'; n = n.nextElementSibling) out.push(...[...n.querySelectorAll('.btn')].map(b => b.textContent + (b.classList.contains('primary') ? '*' : ''))); return out.join('|'); }) === 'Download backup*|Restore from a backup file…|Restore previous version…');
  check('the reminder is on by default, every 7 days, with 1, 7, 14 and 30 days offered', await a.ev(() => { const s = document.querySelector('.spane select'), c = document.querySelector('.spane input[type=checkbox]'); return c.checked + ':' + s.value + ':' + [...s.options].map(o => o.textContent).join(); }) === 'true:7:1 day,7 days,14 days,30 days' && /Remind me every/.test(await a.pane()));
  check('it says a healthy linked data file counts as a backup', /A linked data file that is written and read back correctly counts as a backup/.test(await a.pane()));
  check('it says nothing has been backed up yet, and that a backup is not encrypted', /No backup has been downloaded yet\./.test(await a.pane()) && /plain JSON and is not encrypted/.test(await a.pane()));
  check('from file:// this browser offers the linked data file: Create and Open existing', await a.sbtn('Create data file…').count() === 1 && await a.sbtn('Open existing data file…').count() === 1 && /Not linked/.test(await a.pane()));
  check('Recycle Bin: count, size, Open, and Empty disabled while it is empty', await a.ev(() => document.querySelector('.spane [data-bin]').textContent) === '0 items, 0 B' && await a.sbtn('Open').count() === 1 && await a.sbtn('Empty').isDisabled());
  check('Reset is there, marked as dangerous', await a.ev(() => document.querySelector('.spane .btn.danger').textContent) === 'Reset…');
  check('there is no lock, PIN or password anywhere in Data', !/password|passphrase|\bPIN\b|lock screen|unlock/i.test(await a.pane()));

  section('Download backup: the file and its summary (R02, R08, R11)');
  const first = await a.download(() => a.sbtn('Download backup').click());
  const day = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  check('without a display name the file is portd-YYYY-MM-DD.portd', first.name === 'portd-' + day + '.portd', first.name);
  const doc1 = JSON.parse(first.text), t1 = tally(doc1.fs);
  check('it is a format 2 data document with its fields in order', Object.keys(doc1).join() === 'format,formatVersion,appVersion,createdAt,savedAt,integrity,summary,fs' && doc1.format === 'portd-data' && doc1.formatVersion === 2 && doc1.appVersion === '1.1.0');
  check('its checksum is the SHA-256 of exactly the fs text in the file', doc1.integrity.alg === 'SHA-256' && doc1.integrity.value === crypto.createHash('sha256').update(fsTextOf(first.text), 'utf8').digest('hex'));
  check('its summary matches an independent count of the file', JSON.stringify(doc1.summary) === JSON.stringify(t1), [doc1.summary, t1]);
  check('the toast gives the same summary: "Backup saved: ' + words(t1) + '."', await a.toast() === 'Backup saved: ' + words(t1) + '.', await a.toast());
  check('it is plain JSON: file names and contents are readable in it', first.text.includes('"Welcome.txt"') && first.text.includes('Welcome to PortD') && !/"enc":"(?!text|dataurl)/.test(first.text));
  check('the tab now shows when the last backup was made', /Last backup: /.test(await a.pane()) && typeof JSON.parse(await a.read(CONFIG + '\\settings.json')).backup.lastBackupAt === 'number');
  await a.page.locator('#start').click(); await a.settle(150);
  check('the PortD menu footer has Home folder and Download backup', await a.ev(() => [...document.querySelectorAll('#startmenu .foot .btn')].map(b => b.textContent).join('|')) === 'Home folder|Download backup');
  const viaMenu = await a.download(() => a.page.locator('#startmenu .foot .btn', { hasText: 'Download backup' }).click());
  check('…which downloads a backup', viaMenu.name === first.name && JSON.parse(viaMenu.text).format === 'portd-data' && /^Backup saved: /.test(await a.toast()));
  await a.closeAll();

  section('Round trip: To-Do as shipped, into a fresh profile (R10)');
  let b = await open();
  await b.ev(() => { PortDHost.vfs.write('P:\\User\\Documents\\only-here.txt', 'this desktop is replaced'); }); await saved(b.page);
  await b.choose(first.path);
  let d = await b.dlg();
  check('Restore asks first, showing the backup\'s summary and date', /^Restore from a backup file/.test(d) && d.includes('Restore the desktop saved in "' + path.basename(first.path) + '"?') && d.includes(words(t1)) && /Saved\s+\d/.test(d), d);
  check('…and says everything here is replaced', /The desktop you have now is replaced, with all its files and programs\./.test(d));
  check('…with Cancel, Download a backup of this desktop first, Restore', await b.buttons() === 'Cancel|Download a backup of this desktop first|Restore');
  const safety = await b.download(() => b.page.locator('.ov:last-of-type .dlg .btn', { hasText: 'Download a backup of this desktop first' }).click());
  check('Download a backup of this desktop first saves the present desktop and keeps the question open', safety.text.includes('only-here.txt') && /^Restore from a backup file/.test(await b.dlg() || ''));
  await b.press('Cancel');
  check('Cancel changes nothing', await b.has(DOCS + '\\only-here.txt'));
  await b.restore(first.path);
  check('after restoring, the toast gives the live counts and says they match', await b.toast() === 'Restored: ' + words(t1) + ', the same as the backup.', await b.toasts());
  check('the drive is exactly what the backup holds, and what was here is gone', await b.fsText() === fsTextOf(first.text) && !(await b.has(DOCS + '\\only-here.txt')));
  await b.ev(() => { PortDHost.launch('todo'); }); await b.settle(300);
  check('To-Do as shipped launches straight after the restore, with no tasks', await (await b.frame()).evaluate(() => document.querySelectorAll('li').length + ':' + getComputedStyle(document.body).backgroundColor) === '0:rgb(251, 250, 247)' && await b.ls(PROGS + '\\todo') === 'app.js|icon.svg|index.html|manifest.json|style.css');
  await b.closeAll();
  await b.page.keyboard.press('Control+z'); await b.settle();
  check('restoring is not undoable, and Undo says why', await b.toast() === 'Restoring a backup cannot be undone.', await b.toast());
  check('no console errors', a.ctx.errors.length === 0 && b.ctx.errors.length === 0, [a.ctx.errors, b.ctx.errors]);

  section('Round trip: a desktop with programs, data, pins and associations (R10)');
  await enrich(a);
  await verify(a, 'before the backup');
  const rich = await a.backup();
  const docR = JSON.parse(rich.text), tR = tally(docR.fs);
  check('with a display name the file is <name>-YYYY-MM-DD.portd', rich.name === 'Lily-' + day + '.portd', rich.name);
  check('the summary counts three programs and matches an independent count', docR.summary.programs === 3 && JSON.stringify(docR.summary) === JSON.stringify(tR) && await a.toast() === 'Backup saved: ' + words(tR) + '.', await a.toast());
  await a.closeAll();
  const c = await open();
  await c.restore(rich.path);
  check('restored into a fresh profile: the counts match', await c.toast() === 'Restored: ' + words(tR) + ', the same as the backup.', await c.toasts());
  check('…and the drive is exactly what the backup file holds, to the byte', await c.fsText() === fsTextOf(rich.text));
  await saved(c.page); await reload(c.page, true); await saved(c.page);
  check('restore, then reload: still exactly the backup', await c.fsText() === fsTextOf(rich.text));
  check('no backup reminder after the reload: the restored settings carry the date of the last backup', await c.notices() === '');
  await verify(c, 'fresh profile, after a reload');
  check('the working copy in the browser holds the same drive', JSON.stringify((await c.ev(() => new Promise(res => { const r = indexedDB.open('portd1'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => res(JSON.stringify(g.result.fs)); }; })))) === JSON.stringify(await c.fsText()));
  await b.ev(PNG => { const v = PortDHost.vfs; v.write('P:\\User\\Documents\\b-only.txt', 'x'); v.mkdir('P:\\Programs\\stray', { sys: true }); v.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [{ type: 'program', id: 'builtin:calc' }] })); PortDHost.launch('builtin:calc'); PortDHost.launch('todo'); }, PNG); await saved(b.page);
  await b.restore(rich.path);
  check('restored over an existing desktop: open windows are closed and nothing of the old one is left', await b.titles() === '' && !(await b.has(DOCS + '\\b-only.txt')) && !(await b.has(PROGS + '\\stray')) && await b.toast() === 'Restored: ' + words(tR) + ', the same as the backup.', [await b.titles(), await b.toasts()]);
  await verify(b, 'over an existing desktop, launched straight away', rich.text);
  check('no console errors in the round trips', a.ctx.errors.length === 0 && b.ctx.errors.length === 0 && c.ctx.errors.length === 0, [a.ctx.errors, b.ctx.errors, c.ctx.errors]);
  await c.ctx.close();

  section('Restore: files that are refused, and files that look wrong (R09, R08)');
  const put = (name, body) => { const p = path.join(tmp, name); fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body)); return p; };
  const before = await b.fsText();
  const refusedWith = async (name, body) => { await b.choose(put(name, body)); const m = await b.dlg(); await b.press('OK'); return m || ''; };
  check('a prototype data file is refused with the message', (await refusedWith('proto.portd', Object.assign({}, docR, { formatVersion: 1 }))).includes('This file was made by the PortD prototype (0.x) and can\'t be opened by PortD 1.0.'));
  check('a newer file is refused, naming both versions', /"newer\.portd" uses data format 3 and was written by PortD 9\.9\.9\. This is PortD 1\.1\.0, which reads data format 2 and older\./.test(await refusedWith('newer.portd', Object.assign({}, docR, { formatVersion: 3, appVersion: '9.9.9' }))));
  check('a file that is not a data file', /"notes\.portd" is not a PortD data file\./.test(await refusedWith('notes.portd', 'just some text')) && /is not a PortD data file/.test(await refusedWith('pkg.portd', KIT)));
  const noDesk = JSON.parse(rich.text); delete noDesk.fs.c.User.c.Desktop;
  check('a damaged file is refused, saying what is wrong', /"damaged\.portd" is damaged: the folder P:\\User\\Desktop is missing\./.test(await refusedWith('damaged.portd', noDesk)));
  check('none of those changed the desktop', await b.fsText() === before);
  const tampered = rich.text.replace('# Report', '# Rep0rt');
  await b.choose(put('tampered.portd', tampered)); d = await b.dlg();
  check('a file whose contents do not match its checksum is opened with a warning, not refused', /This file may have been modified or damaged\. Its checksum does not match its contents\./.test(d) && await b.buttons() === 'Cancel|Download a backup of this desktop first|Restore', d);
  await b.press('Restore'); await saved(b.page);
  check('…and can still be restored', (await b.read(DOCS + '\\Report.md')).startsWith('# Rep0rt') && /^Restored: /.test(await b.toast()));
  const lying = JSON.parse(rich.text); lying.summary.programs = 7; delete lying.integrity;
  await b.choose(put('lying.portd', lying)); d = await b.dlg();
  check('a file whose stated summary is not what it holds says so, with both counts', d.includes('It says it holds ' + words(Object.assign({}, tR, { programs: 7 })) + ', but it holds ' + words(tR) + '.'), d);
  await b.press('Cancel');
  const noSum = JSON.parse(rich.text); delete noSum.integrity; delete noSum.summary;
  await b.choose(put('plain.portd', noSum)); d = await b.dlg();
  check('a file with no checksum and no summary is not called damaged', !/modified or damaged/.test(d) && d.includes(words(tR)));
  await b.press('Cancel'); await b.closeAll();

  section('A restore that does not come out right says so (R11)');
  {
    const bad = await open({ file: variant(path.join(newDir(), 'portd.html'), [['function adopt(doc) { state = doc;', 'function adopt(doc) { delete doc.fs.c.Programs.c.todo; state = doc;']]) });
    await bad.choose(rich.path); await bad.press('Restore'); await bad.settle(400);
    const m = await bad.dlg() || '';
    check('(a build variant that loses To-Do while restoring)', !(await bad.has(PROGS + '\\todo')));
    check('the difference is called a failed restore, plainly', m.includes('The restore FAILED: what is here now is not what the backup holds.'), m);
    check('…with the backup\'s counts and the desktop\'s', m.includes('Backup: ' + words(tR)) && /This desktop now: \d+ files in 2 programs/.test(m) && /Stored in this browser: \d+ files in 2 programs/.test(m), m);
    check('…and how to get back', /Restore previous version/.test(m) && !/Restored:/.test(await bad.toasts()));
    await bad.ctx.close();
  }

  section('Restore previous version (R07)');
  await b.settle(1500); await saved(b.page);      /* let remembered window positions settle, so the saves below are the only ones */
  await b.ev(() => { PortDHost.vfs.write('P:\\User\\Documents\\step1.txt', 'one'); }); await saved(b.page);
  await b.ev(() => { PortDHost.vfs.write('P:\\User\\Documents\\step2.txt', 'two'); }); await saved(b.page);
  await b.data(); await b.settle(200);
  check('the button shows when the previous version was saved', await b.sbtn('Restore previous version…').isEnabled() && /Restore previous version…\s*Saved \d/.test(await b.pane()), await b.pane());
  await b.sbtn('Restore previous version…').click(); await b.settle(250); d = await b.dlg();
  check('it asks first, with the previous version\'s summary and date and the download-first choice', /^Restore previous version/.test(d) && /Go back to the desktop as it was one save ago\?/.test(d) && /Previous version holds\s+\d+ files in 3 programs/.test(d) && /Saved\s+\d/.test(d) && await b.buttons() === 'Cancel|Download a backup of this desktop first|Restore', d);
  await b.press('Restore'); await saved(b.page);
  check('it goes one save back', await b.has(DOCS + '\\step1.txt') && !(await b.has(DOCS + '\\step2.txt')), await b.ls(DOCS));
  await b.page.keyboard.press('Control+z'); await b.settle();
  check('it is not undoable, and Undo says why', await b.toast() === 'Restoring the previous version cannot be undone.', await b.toast());
  await b.data(); await b.sbtn('Restore previous version…').click(); await b.settle(250); await b.press('Restore'); await saved(b.page);
  check('the desktop it replaced became the previous version, so doing it again swaps back', await b.has(DOCS + '\\step2.txt'));
  await b.closeAll();
  {
    const n = await open(); await n.data(); await n.settle(250);
    const freshPrev = await n.ev(() => new Promise(res => { const r = indexedDB.open('portd1'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('prev'); g.onsuccess = () => res(g.result === undefined ? 'none' : 'some'); }; }));
    check('a desktop with no previous version has the button disabled and says so', freshPrev === 'none' ? await n.sbtn('Restore previous version…').isDisabled() && /There is none yet\./.test(await n.pane()) : await n.sbtn('Restore previous version…').isEnabled(), [freshPrev, await n.pane()]);
    await n.ctx.close();
  }

  section('Reset');
  await b.data(); await b.sbtn('Reset…').click(); await b.settle(250); d = await b.dlg();
  check('Reset asks first, with the same download-first choice', /^Reset/.test(d) && /Erase everything and start with a new, empty desktop\?/.test(d) && await b.buttons() === 'Cancel|Download a backup of this desktop first|Erase everything', d);
  const preReset = await b.download(() => b.page.locator('.ov:last-of-type .dlg .btn', { hasText: 'Download a backup of this desktop first' }).click());
  check('…which saves the desktop that is about to go', preReset.text.includes('step2.txt') && /^Reset/.test(await b.dlg() || ''));
  await b.press('Cancel');
  check('Cancel changes nothing', await b.has(DOCS + '\\step2.txt') && await b.ls(PROGS) === 'kit|my-clock|todo');
  await b.data(); await b.sbtn('Reset…').click(); await b.settle(250); await b.press('Erase everything'); await saved(b.page); await b.settle(200);
  check('Erase everything gives a new desktop: nine icons, To-Do as shipped, nothing else', await b.ev(() => document.querySelectorAll('.dicon').length) === 9 && await b.ls(PROGS) === 'todo' && await b.ls(DOCS) === '' && !(await b.has(CONFIG + '\\todo')) && await b.ev(() => document.documentElement.dataset.theme) === 'light' && await b.titles() === '');
  check('…with no pins and a passing check', await b.ev(() => document.querySelectorAll('.task.pin').length) === 0 && JSON.stringify(await b.ev(() => PortDHost.checkData())) === '[]');
  await b.page.keyboard.press('Control+z'); await b.settle();
  check('Reset is not undoable, and Undo says why', await b.toast() === 'Resetting cannot be undone.', await b.toast());
  await b.data(); await b.sbtn('Restore previous version…').click(); await b.settle(250); await b.press('Restore'); await saved(b.page);
  check('the desktop that was erased is still the previous version until the next change', await b.has(DOCS + '\\step2.txt') && await b.ls(PROGS) === 'kit|my-clock|todo');
  await b.closeAll(); await b.ctx.close();

  /* ------------------------------------------------------------------ */
  section('Backup reminder and the taskbar warning (R06, T08)');
  const DAY = 86400000;
  const setBackup = (p, patch) => p.ev(patch => { const v = PortDHost.vfs, s = JSON.parse(v.read('P:\\User\\Config\\settings.json')); Object.assign(s.backup, patch); v.write('P:\\User\\Config\\settings.json', JSON.stringify(s)); }, patch);
  let r = await open();
  await reload(r.page, true); await r.settle(200);
  check('on the second start of a desktop that has never been backed up: "Back up your desktop?"', await r.notices() === 'Back up your desktop? [Download backup|Later|Settings]', await r.notices());
  check('…saying that none has been downloaded and where everything is kept', /No backup has been downloaded yet\. Everything is kept in this browser only\./.test(await r.noticeText()));
  check('the notice is a card at the top right, not a dialog: the desktop stays usable', await r.ev(() => !document.querySelector('.ov') && !document.querySelector('#desktop').inert && getComputedStyle(document.querySelector('.notice')).borderRadius === '10px'));
  check('no taskbar warning yet: the desktop is new', await r.tray() === 'save' && /^Saved\s*\d/.test(await r.ev(() => document.querySelector('#tray').innerText.trim())), await r.ev(() => document.querySelector('#tray').innerText));
  await r.page.locator('.notice .btn', { hasText: /^Later$/ }).click(); await r.settle();
  check('Later closes it and downloads nothing', await r.notices() === '' && JSON.parse(await r.read(CONFIG + '\\settings.json')).backup.lastBackupAt === null);
  await reload(r.page, true); await r.settle(200);
  check('…and it is back at the next start', /^Back up your desktop\?/.test(await r.notices()));
  await r.page.locator('.notice .btn', { hasText: /^Settings$/ }).click(); await r.settle(250);
  check('Settings opens Settings > Data', await r.titles() === 'Settings' && await r.ev(() => document.querySelector('.spane').dataset.tab) === 'data' && await r.notices() === '');
  await r.closeAll(); await reload(r.page, true); await r.settle(200);
  const viaNotice = await r.download(() => r.page.locator('.notice .btn', { hasText: /^Download backup$/ }).click());
  check('Download backup in the notice downloads one, on that click', JSON.parse(viaNotice.text).format === 'portd-data' && await r.notices() === '' && /^Backup saved: /.test(await r.toast()));
  await saved(r.page); await reload(r.page, true); await r.settle(200);
  check('after a backup there is no reminder at the next start', await r.notices() === '' && await r.tray() === 'save');
  await setBackup(r, { lastBackupAt: Date.now() - 6 * DAY }); await saved(r.page); await reload(r.page, true); await r.settle(200);
  check('six days after a backup: still none', await r.notices() === '');
  await setBackup(r, { lastBackupAt: Date.now() - 8 * DAY }); await saved(r.page);
  check('PortD never starts a download by itself: a start with a backup due downloads nothing', await r.noDownload(() => reload(r.page, true)));
  check('eight days after: the reminder, with the date of the last backup', /^Back up your desktop\?/.test(await r.notices()) && /The last backup was downloaded on \d/.test(await r.noticeText()) && await r.tray() === 'save', await r.noticeText());
  await setBackup(r, { lastBackupAt: Date.now() - 15 * DAY }); await saved(r.page); await reload(r.page, true); await r.settle(200);
  check('fifteen days after (twice the interval): a warning on the taskbar as well', await r.tray() === 'backup|save' && await r.ev(() => { const w = document.querySelector('#tray [data-tray=backup]'); return w.getAttribute('aria-label') === 'Backup overdue. Open the backup reminder.' && !!w.querySelector('.ico[data-glyph=warn]') && w.dataset.tip === 'No backup for more than 14 days'; }), await r.tray());
  await r.page.locator('.notice .btn', { hasText: /^Later$/ }).click(); await r.settle();
  await r.page.locator('#tray [data-tray=backup]').click(); await r.settle();
  check('clicking the warning shows the reminder again, once', await r.notices() === 'Back up your desktop? [Download backup|Later|Settings]' && (await r.page.locator('#tray [data-tray=backup]').click(), await r.settle(), await r.ev(() => document.querySelectorAll('.notice').length)) === 1);
  check('the warning is reachable in the taskbar by arrow keys', await r.ev(() => { document.querySelector('#tray [data-tray=save]').focus(); return true; }) && (await r.page.keyboard.press('ArrowLeft'), await r.ev(() => document.activeElement.dataset.tray)) === 'backup');
  await r.page.locator('.notice .btn', { hasText: /^Later$/ }).click(); await r.data();
  await r.page.locator('.spane select').selectOption('30'); await r.settle(200);
  check('choosing every 30 days is stored, and the warning goes', JSON.parse(await r.read(CONFIG + '\\settings.json')).backup.everyDays === 30 && await r.tray() === 'save');
  await r.closeAll(); await saved(r.page); await reload(r.page, true); await r.settle(200);
  check('…and there is no reminder at 15 days', await r.notices() === '');
  await setBackup(r, { everyDays: 1, lastBackupAt: Date.now() - 1.5 * DAY }); await saved(r.page); await reload(r.page, true); await r.settle(200);
  check('every 1 day: reminded after a day and a half', /^Back up your desktop\?/.test(await r.notices()));
  await r.page.locator('.notice .btn', { hasText: /^Later$/ }).click(); await r.data();
  await r.page.locator('.spane input[type=checkbox]').uncheck(); await r.settle(200);
  check('turning the reminder off is stored, and greys the interval', JSON.parse(await r.read(CONFIG + '\\settings.json')).backup.remind === false && await r.page.locator('.spane select').isDisabled());
  await r.closeAll(); await setBackup(r, { lastBackupAt: Date.now() - 400 * DAY }); await saved(r.page); await reload(r.page, true); await r.settle(200);
  check('with the reminder off there is no notice and no warning, however old the backup', await r.notices() === '' && await r.tray() === 'save');
  check('no console errors', r.ctx.errors.length === 0, r.ctx.errors);

  section('A read-only tab cannot replace the desktop (R04)');
  {
    const two = await r.ctx.open(file); const t2 = drive(two); await t2.settle(300);
    check('(a second tab is read-only)', await two.evaluate(() => !!document.querySelector('#robar')));
    await t2.data(); await t2.sbtn('Reset…').click(); await t2.settle(250);
    check('Reset is refused there, with the reason', /PortD is open in another tab or window, so this one cannot change the desktop\. Use Take over first\./.test(await t2.dlg() || ''), await t2.dlg());
    await t2.press('OK');
    const dl = await t2.download(() => t2.sbtn('Download backup').click());
    check('a backup can still be downloaded from it', JSON.parse(dl.text).format === 'portd-data');
    await two.close();
  }
  await r.ctx.close();

  /* ------------------------------------------------------------------ */
  section('Failing loudly: a document that cannot be written whole (R11)');
  {
    const small = await open({ file: variant(path.join(newDir(), 'portd.html'), [['const MAX_FILE = 64 * 1048576;', 'const MAX_FILE = 2000;']]) });
    await small.write(DOCS + '\\huge.txt', 'x'.repeat(3000)); await saved(small.page); await small.data();
    const none = await small.noDownload(() => small.sbtn('Download backup').click());
    const m = await small.dlg() || '';
    check('(a build variant with a 2,000-byte file limit, holding a 3,000-byte file)', await small.ev(() => PortDHost.vfs.read('P:\\User\\Documents\\huge.txt').length) === 3000);
    check('the backup is refused, naming the file that is too big', m.includes('"P:\\User\\Documents\\huge.txt" is 2.9 KB. A file larger than 2.0 KB cannot be written to a data file. Nothing was written.'), m);
    check('no file was downloaded, not even a partial one', none);
    check('success is not reported: no toast, no backup date', !/Backup saved/.test(await small.toasts()) && JSON.parse(await small.read(CONFIG + '\\settings.json')).backup.lastBackupAt === null);
    await small.press('OK'); await small.ctx.close();
  }
  {
    const big = await open();
    await big.ev(PNG => { const v = PortDHost.vfs; for (let i = 0; i < 4; i++) v.write('P:\\User\\Documents\\big' + i + '.txt', String.fromCharCode(97 + i).repeat(9 * 1048576)); v.write('P:\\User\\Pictures\\big.bin', 'data:application/octet-stream;base64,' + 'QUJD'.repeat(1400000), { enc: 'dataurl' }); }, PNG);
    await saved(big.page);
    const bk = await big.backup(), tb = tally(JSON.parse(bk.text).fs);
    check('a large desktop (' + fmtSize(tb.bytes) + ', backup file ' + fmtSize(bk.text.length) + ') backs up, with a summary that matches the file', tb.bytes > 40 * 1048576 && JSON.stringify(JSON.parse(bk.text).summary) === JSON.stringify(tb) && await big.toast() === 'Backup saved: ' + words(tb) + '.', await big.toast());
    check('its checksum verifies', JSON.parse(bk.text).integrity.value === crypto.createHash('sha256').update(fsTextOf(bk.text), 'utf8').digest('hex'));
    const into = await open();
    await into.restore(bk.path);
    check('…and restores into a fresh profile, byte for byte', await into.toast() === 'Restored: ' + words(tb) + ', the same as the backup.' && await into.fsText() === fsTextOf(bk.text), await into.toasts());
    await reload(into.page, true); await saved(into.page);
    check('…and is still whole after a reload', await into.fsText() === fsTextOf(bk.text));
    check('no console errors', big.ctx.errors.length === 0 && into.ctx.errors.length === 0, [big.ctx.errors, into.ctx.errors]);
    await big.ctx.close(); await into.ctx.close();
  }

  /* ------------------------------------------------------------------ */
  section('Check my data: every kind of problem is caught (R12)');
  const k = await open();
  await enrich(k);
  await k.ev(() => { const v = PortDHost.vfs, P = 'P:\\Programs\\';
    v.mkdir(P + 'nomanifest', { sys: true }); v.write(P + 'nomanifest\\index.html', 'x', { sys: true });
    v.mkdir(P + 'badjson', { sys: true }); v.write(P + 'badjson\\manifest.json', '{not json', { sys: true });
    v.mkdir(P + 'badfields', { sys: true }); v.write(P + 'badfields\\manifest.json', JSON.stringify({ id: 'badfields', name: '' }), { sys: true });
    v.mkdir(P + 'wrongid', { sys: true }); v.write(P + 'wrongid\\manifest.json', JSON.stringify({ id: 'other', name: 'Wrong', entry: 'index.html' }), { sys: true }); v.write(P + 'wrongid\\index.html', 'x', { sys: true });
    v.mkdir(P + 'noentry', { sys: true }); v.write(P + 'noentry\\manifest.json', JSON.stringify({ id: 'noentry', name: 'No entry', entry: 'main.html' }), { sys: true });
    v.write('P:\\User\\Config\\associations.json', JSON.stringify({ version: 1, assoc: { '.md': 'kit', '.txt': 'builtin:notepad', '.csv': 'gone-app', '.log': 'builtin:nope' } }));
    v.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [{ type: 'program', id: 'kit' }, { type: 'program', id: 'gone-app' }, { type: 'path', path: 'P:\\User\\Documents\\Work' }, { type: 'path', path: 'P:\\User\\Documents\\nowhere.txt' }, { type: 'url', url: 'https://example.invalid/' }, { nonsense: true }, { type: 'program', id: 'builtin:calc' }] }));
    v.write('P:\\User\\Desktop\\Gone app.lnk', JSON.stringify({ type: 'program', target: 'gone-app' })); v.write('P:\\User\\Desktop\\Gone file.lnk', JSON.stringify({ type: 'path', target: 'P:\\User\\Documents\\nowhere.txt' })); v.write('P:\\User\\Desktop\\Broken.lnk', 'not a shortcut');
    const dj = JSON.parse(v.read('P:\\User\\Config\\desktop.json')); dj.order.push('Ghost.lnk'); dj.pos['Phantom.txt'] = [3, 3]; dj.pos['Home.lnk'] = [5, 0]; v.write('P:\\User\\Config\\desktop.json', JSON.stringify(dj));
    v.write('P:\\User\\Config\\profile.json', '{broken');
    v.write('P:\\User\\Documents\\lost.txt', 'no record'); v.move('P:\\User\\Documents\\lost.txt', 'P:\\User\\Config\\Recycle Bin\\lost.txt', { sys: true });
    v.mkdir('P:\\User\\Documents\\lostdir'); v.move('P:\\User\\Documents\\lostdir', 'P:\\User\\Config\\Recycle Bin\\lostdir', { sys: true }); v.node('P:\\User\\Config\\Recycle Bin\\lostdir').del = { name: 5 };
  }); await saved(k.page); await k.settle(200);
  const found = await k.ev(() => PortDHost.checkData());
  const hit = (kind, p, re) => found.some(x => x.kind === kind && x.path === p && re.test(x.text));
  check('the hook returns plain data: kind, path, text, fixable', found.every(x => Object.keys(x).join() === 'kind,path,text,fixable' && typeof x.text === 'string' && typeof x.fixable === 'boolean'), found[0]);
  check('programs: a folder with no manifest', hit('program', PROGS + '\\nomanifest', /has no manifest\.json/));
  check('programs: a manifest that is not JSON, and one with unusable fields', hit('program', PROGS + '\\badjson\\manifest.json', /cannot be used: it is not JSON/) && hit('program', PROGS + '\\badfields\\manifest.json', /cannot be used: The program has no name/));
  check('programs: an id that does not match the folder', hit('program', PROGS + '\\wrongid\\manifest.json', /gives the id "other", which does not match its folder "wrongid"/));
  check('programs: an entry file that is missing', hit('program', PROGS + '\\noentry\\main.html', /entry file named in the manifest is missing/));
  check('associations: a program that is not installed, and an unknown builtin:', hit('association', CONFIG + '\\associations.json', /^\.csv files are set to open with "gone-app"/) && hit('association', CONFIG + '\\associations.json', /^\.log files are set to open with "builtin:nope"/));
  check('pins: a missing program, a missing path, and a malformed pin', hit('pin', CONFIG + '\\taskbar.json', /points to the program "gone-app", which is not installed/) && hit('pin', CONFIG + '\\taskbar.json', /points to P:\\User\\Documents\\nowhere\.txt, which does not exist/) && hit('pin', CONFIG + '\\taskbar.json', /is not a pin PortD understands/));
  check('desktop shortcuts: a missing program, a missing path, and an unreadable shortcut', hit('shortcut', DESK + '\\Gone app.lnk', /program "gone-app", which is not installed/) && hit('shortcut', DESK + '\\Gone file.lnk', /nowhere\.txt, which does not exist/) && hit('shortcut', DESK + '\\Broken.lnk', /cannot be read/));
  check('desktop.json: names in the order and in the positions that are not on the desktop', hit('desktop', CONFIG + '\\desktop.json', /names "Ghost\.lnk"/) && hit('desktop', CONFIG + '\\desktop.json', /names "Phantom\.txt"/));
  check('config: a settings file that does not parse', hit('config', CONFIG + '\\profile.json', /cannot be read as JSON/));
  check('Recycle Bin: an item with no record, and one with a broken record', hit('bin', BIN + '\\lost.txt', /no record of where it was deleted from/) && hit('bin', BIN + '\\lostdir', /no record/));
  check('nothing that is in order is reported: ' + found.length + ' problems, 9 of them fixable', found.length === 18 && found.filter(x => x.fixable).length === 9 && found.filter(x => x.fixable).every(x => /^(association|pin|desktop|bin)$/.test(x.kind)) && found.filter(x => !x.fixable).every(x => /^(program|shortcut|config)$/.test(x.kind)), found.map(x => x.kind + (x.fixable ? '*' : '') + ' ' + x.path));

  section('Check my data: the safe fixes, and nothing else (R12)');
  const strip = () => k.ev(() => { const out = {}; (function walk(n, p) { if (/\\Config\\(associations|taskbar|desktop)\.json$/.test(p)) return; if (n.t === 'f') out[p] = n.enc + ':' + n.d + ':' + (n.icon || ''); else { out[p + '\\'] = n.icon || ''; for (const key of Object.keys(n.c)) walk(n.c[key], p + '\\' + key); } })(PortDHost.getState().fs, 'P:'); return JSON.stringify(out); });
  await k.settle(1500); await saved(k.page);
  const untouched = await strip();
  await k.data(); await k.sbtn('Check my data').click(); await k.settle(250); d = await k.dlg();
  check('the dialog lists every problem with its path', /^Check my data/.test(d) && /18 problems found:/.test(d) && d.includes(PROGS + '\\wrongid\\manifest.json') && d.includes(DESK + '\\Gone app.lnk') && d.includes(BIN + '\\lost.txt') && await k.ev(() => document.querySelectorAll('.dlg .checklist .prow').length) === 18, d);
  check('it says which ones a fix leaves alone', (d.match(/not changed by a fix/g) || []).length === 9);
  check('it offers to fix the nine that are safe, and says what a fix never does', await k.buttons() === 'Close|Fix 9 problems' && /It never deletes a file or a program\./.test(d));
  await k.press('Close');
  check('Close changes nothing', JSON.stringify(await k.ev(() => PortDHost.checkData())) === JSON.stringify(found));
  await k.sbtn('Check my data').click(); await k.settle(250); await k.press('Fix 9 problems'); await k.settle(250); d = await k.dlg();
  check('after fixing it says what was fixed', /Fixed:/.test(d) && /Removed the choice for \.csv files\./.test(d) && /Removed the choice for \.log files\./.test(d) && /Removed a taskbar pin\./.test(d) && /Removed "Ghost\.lnk" from the desktop layout\./.test(d) && /Gave "lost\.txt" a record: it will be restored to P:\\User\./.test(d), d);
  check('…and lists what is left, which PortD will not change by itself', /9 problems found that PortD will not change by itself:/.test(d) && await k.buttons() === 'Close', d);
  await k.press('Close'); await saved(k.page);
  check('associations: only the dangling ones were removed', JSON.stringify(JSON.parse(await k.read(CONFIG + '\\associations.json')).assoc) === '{".md":"kit",".txt":"builtin:notepad"}', await k.read(CONFIG + '\\associations.json'));
  check('pins: only the dangling and malformed ones were removed', JSON.stringify(JSON.parse(await k.read(CONFIG + '\\taskbar.json')).pinned) === '[{"type":"program","id":"kit"},{"type":"path","path":"P:\\\\User\\\\Documents\\\\Work"},{"type":"url","url":"https://example.invalid/"},{"type":"program","id":"builtin:calc"}]', await k.read(CONFIG + '\\taskbar.json'));
  const dj = JSON.parse(await k.read(CONFIG + '\\desktop.json'));
  check('desktop.json: the two stale names are gone and a real position is kept', !dj.order.includes('Ghost.lnk') && !('Phantom.txt' in dj.pos) && JSON.stringify(dj.pos['Home.lnk']) === '[5,0]' && dj.order.includes('To-Do.lnk'), dj);
  check('Recycle Bin: both items now have a record pointing at Home, under their own names', await k.ev(() => { const v = PortDHost.vfs, a = v.node('P:\\User\\Config\\Recycle Bin\\lost.txt').del, b = v.node('P:\\User\\Config\\Recycle Bin\\lostdir').del; return a.name === 'lost.txt' && a.from === 'P:\\User' && b.name === 'lostdir' && b.from === 'P:\\User'; }));
  check('…and the record that was already there is untouched', await k.ev(() => PortDHost.vfs.node('P:\\User\\Config\\Recycle Bin\\gone.txt').del.from) === 'P:\\User\\Documents');
  check('no file, folder or program was deleted or changed: everything else on the drive is identical', await strip() === untouched);
  check('the broken programs and shortcuts are still there for you to deal with', await k.ls(PROGS) === 'badfields|badjson|kit|my-clock|noentry|nomanifest|todo|wrongid' && await k.has(DESK + '\\Gone app.lnk') && await k.has(DESK + '\\Broken.lnk'));
  const left = await k.ev(() => PortDHost.checkData());
  check('a second check finds only what cannot be fixed safely', left.length === 9 && left.every(x => !x.fixable), left.map(x => x.kind));
  await k.ev(() => { PortDHost.launch('builtin:files', { path: 'P:\\User\\Config\\Recycle Bin' }); }); await k.settle(250);
  await k.page.locator('.win.active .row').filter({ hasText: 'lost.txt' }).click({ button: 'right' }); await k.page.locator('.menu .mi', { hasText: /^Restore$/ }).click(); await k.settle(200);
  check('an item given a record restores to Home', await k.read('P:\\User\\lost.txt') === 'no record');
  await k.page.keyboard.press('Control+z'); await k.settle();
  await k.closeAll();
  check('Check my data on a healthy desktop says so', (await k.ev(() => { for (const id of ['nomanifest', 'badjson', 'badfields', 'wrongid', 'noentry']) PortDHost.vfs.remove('P:\\Programs\\' + id, { sys: true }); for (const n of ['Gone app.lnk', 'Gone file.lnk', 'Broken.lnk']) PortDHost.vfs.remove('P:\\User\\Desktop\\' + n); PortDHost.vfs.write('P:\\User\\Config\\profile.json', '{"version":1,"displayName":""}'); return PortDHost.checkData().length; })) === 0 &&
    (await k.data(), await k.sbtn('Check my data').click(), await k.settle(250), /No problems found\. Checked \d+ files in 3 programs/.test(await k.dlg())) && await k.buttons() === 'Close', await k.dlg());
  await k.press('Close');
  check('no console errors', k.ctx.errors.length === 0, k.ctx.errors);
  await k.ctx.close();

  /* ------------------------------------------------------------------ */
  section('Linked data file where the browser does not offer it (K06)');
  {
    const ctx = await profile(newDir(), { reminders: true });
    await ctx.addInitScript('window.showSaveFilePicker = undefined; window.showOpenFilePicker = undefined;');
    const p = drive(await ctx.open(file)); await saved(p.page); await p.data();
    check('one line explains it and points to Download backup', await p.ev(() => document.querySelector('.spane [data-link]').dataset.link) === 'unsupported' && /the File System Access API is not available here\), so there is no linked data file\. Use Download backup below\./.test(await p.pane()));
    check('…and there are no linked-file buttons', await p.sbtn('Create data file…').count() === 0 && await p.sbtn('Open existing data file…').count() === 0);
    const bk = await p.download(() => p.sbtn('Download backup').click());
    check('Backup still works', JSON.parse(bk.text).format === 'portd-data');
    check('no console errors', ctx.errors.length === 0, ctx.errors);
    await ctx.close();
  }

  section('Linked data file (R03): over http://localhost, picker replaced, real file handles');
  console.log('  From file:// this browser gives a page no file it can pick without a real dialog, so this part runs over\n  http://127.0.0.1 with the two pickers replaced by ones that hand out files in the browser\'s private file system.\n  The handles, their permissions, writing and reading back are the browser\'s own.');
  const srv = http.createServer((q, s) => { if (q.url === '/portd.html') { s.setHeader('Content-Type', 'text/html; charset=utf-8'); s.end(html); } else { s.statusCode = q.url === '/blank' ? 200 : 404; s.setHeader('Content-Type', 'text/html'); s.end('<title>blank</title>'); } }).listen(0, '127.0.0.1');
  await new Promise(res => srv.on('listening', res));
  const URL0 = 'http://127.0.0.1:' + srv.address().port;
  const PICK = "window.showSaveFilePicker = async o => (await navigator.storage.getDirectory()).getFileHandle(localStorage.getItem('pick') || o.suggestedName, { create: true }); window.showOpenFilePicker = async () => [await (await navigator.storage.getDirectory()).getFileHandle(localStorage.getItem('pick'))];";
  const web = async (dir, extra = '') => {
    const ctx = await profile(dir, { reminders: true }); await ctx.addInitScript(PICK + extra);
    const openWeb = async () => { const page = await ctx.newPage(); page.on('console', m => { if (m.type() === 'error') ctx.errors.push(m.text()); }); page.on('pageerror', e => ctx.errors.push(String(e))); await page.goto(URL0 + '/portd.html'); await page.waitForFunction(() => window.PortDHost || document.querySelector('#refused,#failed')); await firstRunAway(page); await page.waitForTimeout(250); return page; };
    return { ctx, openWeb };
  };
  const opfsRead = (page, name) => page.evaluate(async name => { try { return await (await (await (await navigator.storage.getDirectory()).getFileHandle(name)).getFile()).text(); } catch (e) { return 'MISSING'; } }, name);
  const opfsWrite = (page, name, body) => page.evaluate(async ([name, body]) => { const hd = await (await navigator.storage.getDirectory()).getFileHandle(name, { create: true }), w = await hd.createWritable(); await w.write(body); await w.close(); }, [name, body]);
  const linkState = p => p.ev(() => document.querySelector('.spane [data-link]').dataset.link + ': ' + document.querySelector('.spane [data-link]').textContent);
  const dirA = newDir();
  let wa = await web(dirA), la = drive(await wa.openWeb());
  await saved(la.page); await enrich(la); await la.data();
  check('(over http the page starts and saves as it does from a file)', await la.ev(() => location.protocol) === 'http:' && await la.ls(PROGS) === 'kit|my-clock|todo');
  await la.sbtn('Create data file…').click(); await saved(la.page); await la.settle(300);
  check('Create data file… links it and says so', await la.toast() === 'Linked. Every change is now also written to portd-data.portd' && await linkState(la) === 'healthy: Linked to "portd-data.portd". Every change is written to it and read back.', [await la.toast(), await linkState(la)]);
  check('the buttons are now Unlink only, and the section says it counts as a backup', await la.sbtn('Unlink').count() === 1 && await la.sbtn('Create data file…').count() === 0 && await la.sbtn('Reconnect').count() === 0 && /so it counts as a backup and there is no reminder/.test(await la.pane()));
  let linked = await opfsRead(la.page, 'portd-data.portd');
  check('the file is a complete data document: same text as a backup, with checksum and summary', JSON.parse(linked).format === 'portd-data' && Object.keys(JSON.parse(linked)).join() === 'format,formatVersion,appVersion,createdAt,savedAt,integrity,summary,fs' && JSON.parse(linked).integrity.value === crypto.createHash('sha256').update(fsTextOf(linked), 'utf8').digest('hex') && fsTextOf(linked) === await la.fsText());
  await la.write(DOCS + '\\after-link.txt', 'written through'); await saved(la.page); await la.settle(200);
  linked = await opfsRead(la.page, 'portd-data.portd');
  check('every change is written to the file', fsTextOf(linked) === await la.fsText() && linked.includes('after-link.txt') && JSON.stringify(JSON.parse(linked).summary) === JSON.stringify(tally(JSON.parse(linked).fs)));
  await la.closeAll(); await saved(la.page); await la.page.reload(); await la.page.waitForFunction(() => window.PortDHost); await la.settle(400);
  check('after a reload it is still linked, and a desktop with a healthy linked file gets no backup reminder', await la.notices() === '' && await la.tray() === 'save' && (await la.data(), /^healthy: /.test(await linkState(la))), [await la.notices(), await la.tray()]);
  check('…though no backup was ever downloaded', JSON.parse(await la.read(CONFIG + '\\settings.json')).backup.lastBackupAt === null);
  await la.closeAll();

  section('Linked data file: written in one profile, opened in another (R10)');
  linked = await opfsRead(la.page, 'portd-data.portd');
  const wb = await web(newDir()), lb = drive(await wb.openWeb());
  await saved(lb.page);
  await opfsWrite(lb.page, 'carried.portd', linked); await lb.ev(() => localStorage.setItem('pick', 'carried.portd'));
  await lb.data(); await lb.sbtn('Open existing data file…').click(); await lb.settle(350); d = await lb.dlg();
  const tL = tally(JSON.parse(linked).fs);
  check('Open existing data file… asks first, with the file\'s summary and date', /^Open existing data file/.test(d) && d.includes('Load "carried.portd" and link it, so that every change is written to it?') && d.includes(words(tL)) && await lb.buttons() === 'Cancel|Download a backup of this desktop first|Load and link', d);
  await lb.press('Load and link'); await saved(lb.page); await lb.settle(300);
  check('it loads the desktop and links the file', await lb.toast() === 'Loaded and linked: carried.portd' && await lb.fsText() === fsTextOf(linked), await lb.toasts());
  await verify(lb, 'the other profile, from the linked file');
  check('the file written by one profile is the one the other now keeps up to date', (await lb.write(DOCS + '\\from-b.txt', 'b'), await saved(lb.page), await lb.settle(200), (await opfsRead(lb.page, 'carried.portd')).includes('from-b.txt')));
  await lb.page.keyboard.press('Control+z'); await lb.settle();
  check('no console errors in either profile', wa.ctx.errors.length === 0 && wb.ctx.errors.length === 0, [wa.ctx.errors, wb.ctx.errors]);
  await wb.ctx.close();

  section('Linked data file: newer on disk, permission lost, read-back failing, unlink (R03)');
  const blank = await wa.ctx.newPage(); await blank.goto(URL0 + '/blank');
  await la.page.close();
  const newer = JSON.parse(await opfsRead(blank, 'portd-data.portd')); newer.savedAt += 600000; newer.fs.c.User.c.Documents.c['from-usb.txt'] = { t: 'f', enc: 'text', d: 'edited elsewhere', ct: 1, mt: 1 }; delete newer.integrity; delete newer.summary;
  await opfsWrite(blank, 'portd-data.portd', JSON.stringify(newer));
  la = drive(await wa.openWeb()); await la.settle(300); d = await la.dlg() || '';
  check('at start, a linked file newer than the browser\'s copy is offered, with both dates', /^Linked data file/.test(d) && d.includes('The linked data file "portd-data.portd" is newer than the copy stored in this browser. Load the file?') && /File holds\s+\d+ files in 3 programs/.test(d) && /This browser's copy\s+\d/.test(d) && await la.buttons() === 'Cancel|Download a backup of this desktop first|Load the file', d);
  await la.press('Cancel'); await saved(la.page); await la.settle(300);
  check('Cancel keeps the browser\'s copy, which is then written to the file', !(await la.has(DOCS + '\\from-usb.txt')) && !(await opfsRead(blank, 'portd-data.portd')).includes('from-usb.txt') && fsTextOf(await opfsRead(blank, 'portd-data.portd')) === await la.fsText());
  await la.page.close();
  newer.savedAt = Date.now() + 600000; await opfsWrite(blank, 'portd-data.portd', JSON.stringify(newer));
  la = drive(await wa.openWeb()); await la.settle(300);
  await la.press('Load the file'); await saved(la.page); await la.settle(300);
  check('Load the file takes the file\'s desktop', await la.read(DOCS + '\\from-usb.txt') === 'edited elsewhere' && await la.ls(PROGS) === 'kit|my-clock|todo');
  await la.page.close();
  await opfsWrite(blank, 'portd-data.portd', 'this is not a data file any more');
  la = drive(await wa.openWeb()); await la.settle(300); d = await la.dlg() || '';
  check('a linked file that is no longer a data file is reported, not overwritten', /The linked data file "portd-data\.portd" is not a PortD data file\.\s+Nothing has been changed, and nothing is written to that file\./.test(d), d);
  await la.press('OK'); await la.write(DOCS + '\\while-bad.txt', 'x'); await saved(la.page); await la.settle(200);
  check('…changes are saved in the browser and the file is left alone', await opfsRead(blank, 'portd-data.portd') === 'this is not a data file any more' && (await la.data(), /^problem: "portd-data\.portd" has a problem: /.test(await linkState(la))), await linkState(la));
  check('…and it no longer counts as a backup: the reminder is due', await la.ev(() => !/counts as a backup and there is no reminder/.test(document.querySelector('.spane').innerText)));
  await la.sbtn('Unlink').click(); await la.settle(250);
  check('Unlink forgets the file and leaves it as it is', /^none: Not linked/.test(await linkState(la)) && await la.sbtn('Create data file…').count() === 1 && await opfsRead(blank, 'portd-data.portd') === 'this is not a data file any more' && await la.ev(() => new Promise(res => { const r = indexedDB.open('portd1'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('fileHandle'); g.onsuccess = () => res(g.result === undefined); }; })));
  await la.ev(() => localStorage.setItem('pick', 'second.portd')); await la.sbtn('Create data file…').click(); await saved(la.page); await la.settle(300);
  check('(linked again, to a new file)', /^healthy: Linked to "second\.portd"/.test(await linkState(la)) && fsTextOf(await opfsRead(blank, 'second.portd')) === await la.fsText());
  await la.ev(() => { window.__getFile = FileSystemFileHandle.prototype.getFile; FileSystemFileHandle.prototype.getFile = async function () { return new File(['not what was written'], this.name); }; });
  await la.write(DOCS + '\\unverified.txt', 'x'); await la.settle(1200);
  check('a file that does not read back as written is a failed save, never "Saved"', await la.ev(() => document.querySelector('#tray [data-tray=save]').dataset.status) === 'error' && /The linked data file "second\.portd" could not be written: it did not read back the way it was written\. Your changes are safe in this browser\. Download a backup now\./.test(await la.ev(() => document.querySelector('#tray [data-tray=save]').dataset.tip)), await la.ev(() => document.querySelector('#tray [data-tray=save]').dataset.tip));
  check('…Settings says the file has a problem, and the change is safe in the browser', /^problem: /.test(await linkState(la)) && await la.ev(() => new Promise(res => { const r = indexedDB.open('portd1'); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => res('unverified.txt' in g.result.fs.c.User.c.Documents.c); }; })));
  await la.ev(() => { FileSystemFileHandle.prototype.getFile = window.__getFile; });
  await la.write(DOCS + '\\verified.txt', 'x'); await saved(la.page); await la.settle(200);
  check('once the file reads back correctly again, saving recovers', await la.ev(() => document.querySelector('#tray [data-tray=save]').dataset.status) === 'saved' && /^healthy: /.test(await linkState(la)) && (await opfsRead(blank, 'second.portd')).includes('verified.txt'));
  await la.closeAll(); await saved(la.page); await la.page.close(); await wa.ctx.close();
  /* the same profile again, with the browser answering "ask" for the stored handle, as it does after a restart */
  wa = await web(dirA, "FileSystemFileHandle.prototype.queryPermission = async function () { return 'prompt'; }; FileSystemFileHandle.prototype.requestPermission = async function () { return localStorage.getItem('grant') || 'denied'; };");
  la = drive(await wa.openWeb()); await la.settle(300);
  const blank2 = await wa.ctx.newPage(); await blank2.goto(URL0 + '/blank');
  const atRest = await opfsRead(blank2, 'second.portd');
  check('when the browser wants permission again, the taskbar offers Reconnect data file', await la.tray() === 'reconnect|save' && await la.ev(() => document.querySelector('#tray [data-tray=reconnect]').textContent) === 'Reconnect data file', await la.tray());
  check('…a file that is not being written does not count as a backup: the reminder appears', /^Back up your desktop\?/.test(await la.notices()));
  await la.page.locator('.notice .btn', { hasText: /^Later$/ }).click(); await la.data();
  check('…Settings says so and offers Reconnect and Unlink', /^problem: "second\.portd" needs permission again\. The browser asks once after each restart\./.test(await linkState(la)) && await la.sbtn('Reconnect').count() === 1 && await la.sbtn('Unlink').count() === 1, await linkState(la));
  await la.write(DOCS + '\\unlinked-change.txt', 'x'); await saved(la.page); await la.settle(200);
  check('…and changes are saved in the browser while nothing is written to the file', await opfsRead(blank2, 'second.portd') === atRest && await la.ev(() => document.querySelector('#tray [data-tray=save]').dataset.status) === 'saved');
  await la.sbtn('Reconnect').click(); await la.settle(300);
  check('if the browser says no, it stays disconnected', await la.tray() === 'reconnect|save' && await opfsRead(blank2, 'second.portd') === atRest);
  await la.ev(() => localStorage.setItem('grant', 'granted')); await la.page.locator('#tray [data-tray=reconnect]').click(); await saved(la.page); await la.settle(400);
  check('Reconnect, once allowed, links again and writes the browser\'s newer copy to the file', await la.tray() === 'save' && (await la.data(), /^healthy: /.test(await linkState(la))) && (await opfsRead(blank2, 'second.portd')).includes('unlinked-change.txt'), [await la.tray(), await la.dlg()]);
  await la.sbtn('Reset…').click(); await la.settle(250); d = await la.dlg();
  check('Reset with a linked file says the file is unlinked first and left as it is', d.includes('The linked data file "second.portd" is unlinked first and left as it is.'), d);
  const keep = await opfsRead(blank2, 'second.portd');
  await la.press('Erase everything'); await saved(la.page); await la.settle(300);
  check('…and does exactly that: a new desktop, not linked, the file untouched', await la.ls(PROGS) === 'todo' && await opfsRead(blank2, 'second.portd') === keep && (await la.data(), /^none: /.test(await linkState(la))));
  check('no console errors', wa.ctx.errors.length === 0, wa.ctx.errors);
  await wa.ctx.close(); srv.close();
  await a.ctx.close();
};
