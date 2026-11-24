/* PortD suite, Phase 4: the program platform. Packages, installing, updating, uninstalling, assembly and PortD.assets,
   the narrow API with its grants and dialogs, file types and associations, shortcut forwarding, the id namespace,
   the To-Do sample and the Developer tab. Programs are driven inside their real sandboxed frames. */
const fs = require('fs'), path = require('path'), http = require('http'), dgram = require('dgram');
module.exports = async ({ check, section, profile, newDir, file, saved, reload, text, tmp }) => {
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const ctx = await profile(newDir());
  let page = await ctx.open(file);
  await saved(page);
  const warns = [];
  page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  const cspBlocked = [];
  page.on('requestfailed', r => { if (r.failure() && r.failure().errorText === 'csp') cspBlocked.push(r.url()); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const settle = (ms = 90) => page.waitForTimeout(ms);
  const icon = name => page.locator('.dicon').filter({ has: page.locator('.lbl', { hasText: new RegExp('^' + esc(name) + '$') }) });
  const ls = p => ev(p => PortDHost.vfs.exists(p) ? PortDHost.vfs.list(p).map(e => e.name).join('|') : 'MISSING', p);
  const has = p => ev(p => PortDHost.vfs.exists(p), p);
  const read = p => ev(p => PortDHost.vfs.read(p), p);
  const write = (p, d) => ev(([p, d]) => { PortDHost.vfs.write(p, d); }, [p, d]);
  const toast = () => ev(() => { const t = document.querySelector('#toasts .toast:last-child'); return t ? t.firstChild.textContent : ''; });
  const dlg = () => text(page, '.ov:last-of-type .dlg');
  const press = label => page.locator('.ov:last-of-type .dlg .btn', { hasText: new RegExp('^' + esc(label) + '$') }).click().then(() => settle(140));
  const menuItems = (n = 0) => ev(n => { const m = document.querySelectorAll('.menu')[n]; return m ? [...m.querySelectorAll('.mi')].map(b => b.textContent).join('|') : null; }, n);
  const mi = (label, n = 0) => page.locator('.menu >> nth=' + n).locator('.mi', { hasText: new RegExp('^' + esc(label) + '$') });
  const titles = () => ev(() => PortDHost.wm.wins.map(w => w.title).join('|'));
  const closeAll = async () => { await ev(async () => { for (const w of PortDHost.wm.wins.slice()) await w.close(true); }); await settle(); };
  const notices = () => ev(() => [...document.querySelectorAll('#notices .notice')].map(n => n.innerText.replace(/\n+/g, ' / ')).join(' || '));
  const settings = async tab => { await ev(tab => { PortDHost.launch('builtin:settings', { tab }); }, tab); await settle(150); };
  const prow = (id, label) => page.locator('.spane .prow[data-id="' + id + '"] .btn', { hasText: new RegExp('^' + esc(label) + '$') });
  /* the frame of the active program window, and code run inside it */
  const frame = async (sel = '.win.active iframe') => { const el = await page.waitForSelector(sel, { timeout: 5000 }); const f = await el.contentFrame(); await f.waitForFunction(() => window.PortD && document.readyState === 'complete'); return f; };
  const inF = (f, code) => f.evaluate(async code => { try { return { ok: true, v: await new Function('return ' + code)() }; } catch (e) { return { ok: false, e: e.message }; } }, code);
  const val = async (f, code) => { const r = await inF(f, code); return r.ok ? r.v : 'ERROR: ' + r.e; };
  const denied = async (f, code, p) => { const r = await inF(f, code); return !r.ok && r.e === 'Access denied: ' + p ? true : (console.log('        got: ' + JSON.stringify(r)), false); };
  const DOCS = 'P:\\User\\Documents', DESK = 'P:\\User\\Desktop', CONFIG = 'P:\\User\\Config', PROGS = 'P:\\Programs';
  /* a package file put on the drive and opened, as a double-click does; the confirmation is left open */
  const offer = async (pkg, name = 'pkg.portdapp') => { await ev(([p, d]) => { PortDHost.vfs.write(p, d); window.__err = null; Promise.resolve().then(() => PortDHost.openPath(p)).catch(e => { window.__err = e.message; }); }, [DOCS + '\\' + name, typeof pkg === 'string' ? pkg : JSON.stringify(pkg)]); await settle(160); };
  const install = async (pkg, button = 'Install') => { await offer(pkg); await press(button); };
  /* what opening a package says when it cannot be installed */
  const refusal = pkg => ev(async ([p, d]) => { PortDHost.vfs.write(p, d); try { await PortDHost.openPath(p); return 'OPENED'; } catch (e) { return e.message; } finally { PortDHost.vfs.remove(p); } }, [DOCS + '\\bad.portdapp', typeof pkg === 'string' ? pkg : JSON.stringify(pkg)]);
  const t = d => ({ enc: 'text', d });
  const KIT_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kit</title>\n<link rel="icon" href="img/dot.png">\n<link rel="stylesheet" href="css/main.css">\n<script src="js/b.js" defer></script>\n<script src="js/a.js"></script>\n' +
    '<script type="module" src="js/mod.js"></script>\n<style>#bg{background:url(img/dot.png)}</style>\n</head><body><p id="p">kit</p><div id="bg"></div><input id="in">\n' +
    '<img id="i1" src="img/dot.png"><img id="i2" src="https://example.invalid/x.png"><img id="i3" src="img/nope.png"><img id="i4" src="../todo/icon.svg">\n<svg width="10" height="10"><image id="si" href="img/dot.png" width="10" height="10"/></svg>\n' +
    '<script>window.order = (window.order || "") + "inline;"; window.opened = []; PortD.onOpenFile(function (f) { window.opened.push(f.path); }); window.keys = []; addEventListener("keydown", function (e) { window.keys.push((e.ctrlKey ? "Ctrl+" : "") + (e.shiftKey ? "Shift+" : "") + e.key); });</script>\n</body></html>';
  const kit = (version = '1.0.0', more = {}) => Object.assign({ format: 'portd-app', formatVersion: 3, id: 'kit', name: 'Kit', version, description: 'Test program in several files.', icon: 'glyph:table', entry: 'index.html', width: 420, height: 320,
    fileTypes: [{ ext: '.md', name: 'Markdown note', icon: 'glyph:notepad' }, { ext: 'CSV', name: 'Table' }, { ext: '.lnk', name: 'Link' }],
    files: Object.assign({ 'index.html': t(KIT_HTML), 'css/main.css': t('@import "base.css";\n#p{color:rgb(1, 2, 3)}\n.dot{background:url("../img/dot.png")}'), 'css/base.css': t('body{margin:7px}'),
      'img/dot.png': { enc: 'dataurl', d: 'data:image/png;base64,' + PNG }, 'js/a.js': t('window.order = (window.order || "") + "a;"; window.tag = "</script><b>";'), 'js/b.js': t('window.order += "b;";'), 'js/mod.js': t('window.mod = 1;'),
      'data/info.json': t('{"hello":"wörld"}') }, version === '1.0.0' ? { 'old.txt': t('dropped in 1.2.0') } : {}) }, more);
  const mini = (id, more = {}) => Object.assign({ format: 'portd-app', formatVersion: 3, id, name: id, version: '1.0.0', entry: 'index.html', files: { 'index.html': t('<!DOCTYPE html><title>x</title><p id="p">' + id + '</p><script>window.opened = []; PortD.onOpenFile(function (f) { window.opened.push(f.path); });</script>') } }, more);

  /* ------------------------------------------------------------------ */
  section('To-Do sample on first run (P10)');
  check('P:\\Programs\\todo holds the entry page, a stylesheet, a script, an SVG icon and the manifest', await ls(PROGS + '\\todo') === 'app.js|icon.svg|index.html|manifest.json|style.css', await ls(PROGS + '\\todo'));
  const todoSize = await ev(() => PortDHost.vfs.list('P:\\Programs\\todo').reduce((s, e) => s + e.size, 0));
  check('the whole sample is under 10 KB (' + todoSize + ' bytes)', todoSize < 10240);
  const man = JSON.parse(await read(PROGS + '\\todo\\manifest.json'));
  check('manifest: id todo, name To-Do, entry index.html, icon icon.svg, no file types', man.id === 'todo' && man.name === 'To-Do' && man.entry === 'index.html' && man.icon === 'icon.svg' && man.fileTypes.length === 0 && man.width === 380 && man.height === 460, man);
  check('the icon is the prototype\'s green tick', /#4f9d69/.test(await read(PROGS + '\\todo\\icon.svg')) && /M10 16\.5l4 4 8-9/.test(await read(PROGS + '\\todo\\icon.svg')));
  check('To-Do is the sixth desktop icon', await ev(() => JSON.parse(PortDHost.vfs.read('P:\\User\\Config\\desktop.json')).order[5]) === 'To-Do.lnk');
  await page.locator('#start').click(); await settle();
  check('To-Do is in the PortD menu with its icon', await ev(() => { const b = [...document.querySelectorAll('#startmenu .smi')].find(b => b.textContent === 'To-Do'); return !!b && /^data:image\/svg\+xml;base64,/.test(b.querySelector('.ico img').src); }));
  check('the PortD menu lists the programs: built-ins and To-Do', await ev(() => [...document.querySelectorAll('#startmenu .smi')].map(b => b.textContent).join('|')) === 'Files|Notepad|Calculator|Settings|To-Do');
  await page.keyboard.press('Escape'); await settle();
  await icon('To-Do').dblclick(); await settle(200);
  let f = await frame();
  check('the To-Do shortcut launches the sample', await titles() === 'To-Do (0 open)', await titles());
  check('the frame is sandboxed with exactly allow-scripts allow-forms allow-modals, on srcdoc', await ev(() => { const i = document.querySelector('.win iframe'); return i.getAttribute('sandbox') === 'allow-scripts allow-forms allow-modals' && i.hasAttribute('srcdoc') && !i.hasAttribute('src'); }));
  check('the program has an origin of its own and cannot reach the page', await f.evaluate(() => { try { return String(parent.document); } catch (e) { return 'blocked'; } }) === 'blocked' && await f.evaluate(() => location.origin === 'null' || self.origin === 'null'));
  check('its stylesheet and script were put inline', await f.evaluate(() => !document.querySelector('link[rel=stylesheet]') && !document.querySelector('script[src]') && getComputedStyle(document.body).backgroundColor === 'rgb(251, 250, 247)'));
  check('it uses PortD.assets for its logo', await f.evaluate(() => document.getElementById('logo').src === PortD.assets['icon.svg'] && /^data:image\/svg\+xml;base64,/.test(PortD.assets['icon.svg']) && document.getElementById('logo').naturalWidth > 0));
  check('PortD.assets holds only what was not put inline', JSON.stringify(await f.evaluate(() => Object.keys(PortD.assets).sort().map(k => k + ':' + (PortD.assets[k] === null ? 'null' : 'url')))) === '["app.js:null","icon.svg:url","style.css:null"]');
  check('it shows where it stores its data', await f.evaluate(() => document.getElementById('w').textContent) === CONFIG + '\\todo\\todo.json');
  await f.locator('#t').fill('Buy milk'); await f.locator('#t').press('Enter'); await f.locator('#t').fill('Call Sam'); await f.locator('#a').click(); await settle(150);
  check('tasks are saved in its data folder as todo.json', JSON.stringify(JSON.parse(await read(CONFIG + '\\todo\\todo.json'))) === '[{"text":"Buy milk","done":false},{"text":"Call Sam","done":false}]');
  await f.locator('li input').first().check(); await settle(150);
  check('the window title follows the program', await titles() === 'To-Do (1 open)' && await ev(() => document.querySelector('.task.on .tl').textContent) === 'To-Do (1 open)');
  check('the taskbar button and title bar show its icon', await ev(() => !!document.querySelector('.win .tb .ico img') && !!document.querySelector('.task.on .ico img')));

  section('Shortcut forwarding (P15)');
  await f.locator('#t').click(); await settle();
  await f.evaluate(() => { window.keys = []; addEventListener('keydown', e => window.keys.push((e.ctrlKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + e.key)); });
  const where = () => ev(() => { const a = document.activeElement; return a.tagName === 'IFRAME' ? 'window' : a.closest('#taskbar') ? 'taskbar' : a.closest('#icons') ? 'desktop' : a.tagName; });
  check('focus starts inside the program', await where() === 'window' && await f.evaluate(() => document.activeElement.id) === 't');
  await page.keyboard.press('Control+F6'); await settle();
  check('Ctrl+F6 pressed inside To-Do moves focus to the next region, the desktop', await where() === 'desktop', await where());
  check('the program still received the key', (await f.evaluate(() => window.keys.join())) === 'Ctrl+Control,Ctrl+F6' || (await f.evaluate(() => window.keys.join())) === 'Ctrl+F6', await f.evaluate(() => window.keys.join()));
  await page.keyboard.press('Control+F6'); await settle();
  check('…then the taskbar', await where() === 'taskbar');
  await page.keyboard.press('Control+F6'); await settle();
  check('…then back into the program\'s window', await where() === 'window');
  await page.keyboard.press('Control+Shift+F6'); await settle();
  check('Ctrl+Shift+F6 inside the program goes the other way', await where() === 'taskbar', await where());
  await page.keyboard.press('Control+Shift+F6'); await page.keyboard.press('Control+Shift+F6'); await settle();
  check('…all the way round', await where() === 'window');
  await f.locator('#t').click(); await page.keyboard.press('F6'); await page.keyboard.press('Control+F5').catch(() => {}); await settle();
  check('other keys are not forwarded', await where() === 'window');
  await ev(() => { PortDHost.launch('builtin:calc'); }); await settle(150);
  check('(another window is now in front)', await ev(() => PortDHost.wm.active.title) === 'Calculator');
  const fb = await (await page.$('.win iframe')).boundingBox();
  await page.mouse.click(fb.x + 12, fb.y + fb.height - 12); await settle(150);
  check('clicking inside a program\'s frame brings its window to the front', /^To-Do/.test(await ev(() => PortDHost.wm.active.title)) && await where() === 'window');
  await closeAll();

  section('To-Do: reload, uninstall, reinstall (P10, D09)');
  await saved(page); await reload(page); await saved(page);
  await icon('To-Do').dblclick(); await settle(200); f = await frame();
  check('after a reload the tasks are still there', await f.evaluate(() => [...document.querySelectorAll('li')].map(l => l.className + ':' + l.querySelector('span').textContent).join('|')) === 'done:Buy milk|:Call Sam');
  await settings('programs');
  check('Settings has the six tabs', await ev(() => [...document.querySelectorAll('.snav .sn')].map(b => b.textContent).join('|')) === 'Appearance|Profile|Data|Programs|Developer|About');
  check('Programs lists To-Do with Run, Desktop shortcut, Uninstall and no export button', await ev(() => [...document.querySelectorAll('.spane .prow[data-id=todo] .btn')].map(b => b.textContent).join('|')) === 'Run|Desktop shortcut|Uninstall' && !/export/i.test(await text(page, '.spane')));
  await prow('todo', 'Uninstall').click(); await settle(150);
  check('uninstalling says what goes and what stays, and that it cannot be undone', /Uninstall To-Do\?/.test(await dlg()) && /P:\\User\\Config\\todo is kept/.test(await dlg()) && /cannot be undone/.test(await dlg()), await dlg());
  await press('Uninstall');
  check('uninstalling To-Do removes its folder and closes its window', !(await has(PROGS + '\\todo')) && !/To-Do/.test(await titles()), await titles());
  check('…and removes its desktop shortcut', !(await has(DESK + '\\To-Do.lnk')) && await icon('To-Do').count() === 0);
  check('…and keeps its data', JSON.parse(await read(CONFIG + '\\todo\\todo.json')).length === 2);
  check('Programs now says none are installed', /No programs are installed\./.test(await text(page, '.spane')));
  await page.keyboard.press('Control+z'); await settle();
  check('uninstalling is not undoable, and Undo says why', await toast() === 'Uninstalling a program cannot be undone.', await toast());
  await ev(() => { PortDHost.vfs.remove('P:\\User\\Desktop\\Welcome.txt'); }); await saved(page); await reload(page); await saved(page);
  check('start-up does not put back To-Do or a deleted desktop item', !(await has(PROGS + '\\todo')) && !(await has(DESK + '\\To-Do.lnk')) && !(await has(DESK + '\\Welcome.txt')) && await ls(PROGS) === '');
  await settings('developer');
  check('Developer offers Reinstall sample program', await page.locator('.spane .btn', { hasText: /^Reinstall sample program$/ }).count() === 1);
  await page.locator('.spane .btn', { hasText: /^Reinstall sample program$/ }).click(); await settle(150);
  check('Reinstall sample program brings back the program and its shortcut', await ls(PROGS + '\\todo') === 'app.js|icon.svg|index.html|manifest.json|style.css' && await has(DESK + '\\To-Do.lnk') && await icon('To-Do').count() === 1);
  await icon('To-Do').dblclick(); await settle(200); f = await frame();
  check('…with its data kept', await f.evaluate(() => document.querySelectorAll('li').length) === 2);
  await closeAll(); await settings('developer');
  await page.locator('.spane .btn', { hasText: /^Reinstall sample program$/ }).click(); await settle(150);
  check('reinstalling while the shortcut exists does not add a second one', (await ls(DESK)).split('|').filter(n => /^To-Do/.test(n)).length === 1);
  await ev(() => { PortDHost.vfs.write('P:\\Programs\\todo\\style.css', 'body{background:rgb(9, 9, 9)}', { sys: true }); }); await settle();
  await page.locator('.spane .btn', { hasText: /^Reinstall sample program$/ }).click(); await settle(150);
  check('…and puts edited files back as shipped', /#fbfaf7/.test(await read(PROGS + '\\todo\\style.css')));
  await closeAll();

  /* ------------------------------------------------------------------ */
  section('Packages: what is refused (P02, P16)');
  const PROTO = 'This package was made for the PortD prototype.';
  check('a prototype package (format 2) is refused with the message', await refusal(Object.assign(mini('a'), { formatVersion: 2 })) === PROTO, await refusal(Object.assign(mini('a'), { formatVersion: 2 })));
  check('…and format 1, and one with no version', await refusal(Object.assign(mini('a'), { formatVersion: 1 })) === PROTO && await refusal(Object.assign(mini('a'), { formatVersion: undefined })) === PROTO);
  check('a newer package format is refused, naming both versions', /uses package format 4\. This is PortD 1\.1\.0, which installs package format 3\./.test(await refusal(Object.assign(mini('a'), { formatVersion: 4 }))));
  check('something that is not a package', /is not a PortD program package/.test(await refusal('{"format":"other"}')) && /is not a PortD program package/.test(await refusal('not json')));
  check('an id with ":" is refused, saying why', /contains ":", which is kept for PortD's built-in programs/.test(await refusal(mini('builtin:files'))), await refusal(mini('builtin:files')));
  check('ids outside a-z 0-9 - , empty or over 40 characters are refused', /is not allowed/.test(await refusal(mini('my app'))) && /is not allowed/.test(await refusal(mini('a_b'))) && /is not allowed/.test(await refusal(mini('x'.repeat(41)))) && /is not allowed/.test(await refusal(mini('a', { id: '' }))) && /is not allowed/.test(await refusal(mini('a', { id: '-' + 'é' }))));
  const badPath = async p => { const m = await refusal(mini('a', { files: { 'index.html': t('x'), [p]: t('y') } })); return /file path that is not allowed/.test(m) ? true : (console.log('        ' + p + ' -> ' + m), false); };
  check('paths with "..", a leading / or \\, a drive letter, a \\ separator or a reserved character are refused', await badPath('../x.txt') && await badPath('a/../../x.txt') && await badPath('/x.txt') && await badPath('\\x.txt') && await badPath('C:/x.txt') && await badPath('c:x.txt') && await badPath('a\\b.txt') && await badPath('a/b?.txt') && await badPath('a/b*.txt') && await badPath('a//b.txt') && await badPath('a/./b.txt') && await badPath('a/b.'));
  check('manifest.json is reserved, in any case', /"manifest\.json", which PortD writes itself/.test(await refusal(mini('a', { files: { 'index.html': t('x'), 'Manifest.JSON': t('{}') } }))));
  check('the same path twice in different case, or a file that is also a folder', /twice, or as both/.test(await refusal(mini('a', { files: { 'index.html': t('x'), 'A.txt': t('1'), 'a.txt': t('2') } }))) && /twice, or as both/.test(await refusal(mini('a', { files: { 'index.html': t('x'), 'lib': t('1'), 'lib/a.js': t('2') } }))));
  check('a missing entry file, and an entry that is not text', /names "index\.html" as its entry file/.test(await refusal(mini('a', { files: { 'other.html': t('x') } }))) && /as its entry file/.test(await refusal(mini('a', { files: { 'index.html': { enc: 'dataurl', d: 'data:text/html;base64,eA==' } } }))));
  check('no files, bad content, no name', /holds no files/.test(await refusal(mini('a', { files: {} }))) && /no readable content/.test(await refusal(mini('a', { files: { 'index.html': { enc: 'text', d: 5 } } }))) && /has no name/.test(await refusal(mini('a', { name: '' }))));
  const many = {}; for (let i = 0; i < 257; i++) many['f' + i + '.txt'] = t('x');
  check('257 files: over the limit of 256', /holds 258 files\. The most a package can hold is 256\./.test(await refusal(mini('a', { files: Object.assign({ 'index.html': t('x') }, many) }))));
  const sizes = await ev(async DOCS => {
    const pkg = files => JSON.stringify({ format: 'portd-app', formatVersion: 3, id: 'big', name: 'Big', files }), tryPkg = async text => { PortDHost.vfs.write(DOCS + '\\big.portdapp', text); try { await PortDHost.openPath(DOCS + '\\big.portdapp'); return 'OPENED'; } catch (e) { return e.message; } finally { PortDHost.vfs.remove(DOCS + '\\big.portdapp'); } };
    const seven = 'x'.repeat(7 * 1048576), f = d => ({ enc: 'text', d });
    return [await tryPkg(pkg({ 'index.html': f('x'), 'big.txt': f('x'.repeat(8 * 1048576 + 1)) })), await tryPkg(pkg({ 'index.html': f('x'), 'a.txt': f(seven), 'b.txt': f(seven), 'c.txt': f(seven), 'd.txt': f(seven) }))];
  }, DOCS);
  check('a file over 8 MB is refused', /"big\.txt" is 8\.0 MB\. A file in a package can be at most 8\.0 MB\./.test(sizes[0]), sizes[0]);
  check('a package over 24 MB is refused', /larger than 24\.0 MB/.test(sizes[1]), sizes[1]);
  check('nothing was installed by any of those', await ls(PROGS) === 'todo' && !(await has(DOCS + '\\bad.portdapp')));

  section('Installing (P02): confirmation, folder, shortcut');
  await offer(kit()); let d = await dlg();
  check('double-clicking a .portdapp asks before installing', /^Install program/.test(d) && /Kit/.test(d));
  check('the confirmation shows version, description, declared types, file count and size, and where it goes', /Version\s+1\.0\.0/.test(d) && /Test program in several files\./.test(d) && /Can open\s+\.md, \.csv/.test(d) && /Files\s+9 files, /.test(d) && /Goes in\s+P:\\Programs\\kit/.test(d), d);
  check('…and the plain permission note', d.includes('This program can see its own data and the files you choose for it. It can\'t see the rest of your drive.'));
  check('…and that a type with a fixed meaning was left out', /\.lnk files have a fixed meaning in PortD, so that type was left out\./.test(d));
  check('the note is not a warning box', await ev(() => { const n = [...document.querySelectorAll('.dlg .note')].pop(), s = getComputedStyle(n); return s.borderTopWidth === '0px' && s.backgroundColor === 'rgba(0, 0, 0, 0)'; }));
  check('the package\'s icon is shown', await ev(() => !!document.querySelector('.dlg .phead .ico[data-glyph=table]')));
  await press('Cancel');
  check('Cancel installs nothing', await ls(PROGS) === 'todo');
  await install(kit());
  check('Install writes the folder with its files and a manifest.json', await ls(PROGS + '\\kit') === 'css|data|img|js|index.html|manifest.json|old.txt' && await ls(PROGS + '\\kit\\css') === 'base.css|main.css', await ls(PROGS + '\\kit'));
  const kman = JSON.parse(await read(PROGS + '\\kit\\manifest.json'));
  check('the manifest holds the cleaned fields and no files', JSON.stringify(Object.keys(kman)) === '["id","name","version","description","icon","entry","width","height","singleInstance","fileTypes"]' && JSON.stringify(kman.fileTypes) === '[{"ext":".md","name":"Markdown note","icon":"glyph:notepad"},{"ext":".csv","name":"Table","icon":null}]', kman);
  check('a desktop shortcut to it was made', JSON.parse(await read(DESK + '\\Kit.lnk')).target === 'kit' && await icon('Kit').count() === 1);
  check('a toast says it was installed', await toast() === 'Kit installed');
  check('it is in the PortD menu and in Settings > Programs', await ev(() => PortDHost.launch('builtin:settings', { tab: 'programs' }) && !!document.querySelector('.spane .prow[data-id=kit]')));
  check('binary files arrive as they were', await read(PROGS + '\\kit\\img\\dot.png') === 'data:image/png;base64,' + PNG);
  await closeAll();

  section('File types never change defaults on their own (P07)');
  check('a notice says what the program can open', /^Kit can open \.md and \.csv files \/ Nothing has changed: files still open as before\. \/ Set as default\s*Default apps\s*Dismiss$/.test((await notices()).replace(/ \/ (?=Default apps|Dismiss)/g, ' ')), await notices());
  check('the notice has radius 10 and sits at the top right', await ev(() => { const n = document.querySelector('.notice'), r = n.getBoundingClientRect(); return getComputedStyle(n).borderRadius === '10px' && r.top < 40 && innerWidth - r.right < 40; }));
  check('associations.json is untouched', JSON.stringify(JSON.parse(await read(CONFIG + '\\associations.json')).assoc) === '{}');
  await write(DOCS + '\\Report.md', '# Report'); await write(DOCS + '\\data.csv', 'a,b'); await write(DOCS + '\\notes.txt', 'plain notes'); await write(DOCS + '\\other.txt', 'other');
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\Report.md'); }); await settle(150);
  check('a .md file still opens in Notepad', await titles() === 'Report.md - Notepad', await titles());
  await closeAll();
  await page.locator('.notice .btn', { hasText: /^Set as default$/ }).click(); await settle();
  check('Set as default writes the user\'s choice', JSON.stringify(JSON.parse(await read(CONFIG + '\\associations.json'))) === '{"version":1,"assoc":{".md":"kit",".csv":"kit"}}' && await notices() === '', await read(CONFIG + '\\associations.json'));

  section('Assembly and PortD.assets (P03, P04)');
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\Report.md'); }); await settle(250);
  f = await frame();
  check('opening a .md file now starts Kit', await titles() === 'Kit');
  check('the window takes the size the program asked for', await ev(() => { const w = document.querySelector('.win'); return w.offsetWidth === 420 && w.offsetHeight === 320; }));
  check('classic scripts run in order, deferred ones last', await val(f, 'window.order') === 'a;inline;b;', await val(f, 'window.order'));
  check('a "</script>" inside an inlined script does not end it', await val(f, 'window.tag') === '</script><b>');
  check('the stylesheet, what it @imports, and <style> blocks apply', await f.evaluate(() => getComputedStyle(document.getElementById('p')).color === 'rgb(1, 2, 3)' && getComputedStyle(document.body).marginTop === '7px' && /^url\("data:image\/png/.test(getComputedStyle(document.getElementById('bg')).backgroundImage)));
  check('url() in a stylesheet is relative to that stylesheet', await f.evaluate(() => [...document.styleSheets].some(s => [...s.cssRules].some(r => r.selectorText === '.dot' && /^url\("data:image\/png/.test(r.style.backgroundImage)))));
  check('<img> and SVG <image> from the folder are put inline', await f.evaluate(() => /^data:image\/png/.test(document.getElementById('i1').src) && document.getElementById('i1').naturalWidth === 1 && /^data:image\/png/.test(document.getElementById('si').getAttribute('href'))));
  check('the page icon link is removed', await f.evaluate(() => !document.querySelector('link[rel=icon]')));
  check('references to the network, to a missing file and outside the folder are left as written', await f.evaluate(() => document.getElementById('i2').getAttribute('src') === 'https://example.invalid/x.png' && document.getElementById('i3').getAttribute('src') === 'img/nope.png' && document.getElementById('i4').getAttribute('src') === '../todo/icon.svg' && document.getElementById('i4').naturalWidth === 0));
  check('an ES module is not put inline and does not run', await f.evaluate(() => window.mod === undefined && document.querySelector('script[type=module]').getAttribute('src') === 'js/mod.js'));
  const assets = await f.evaluate(() => Object.fromEntries(Object.keys(PortD.assets).map(k => [k, PortD.assets[k] === null ? null : PortD.assets[k].slice(0, PortD.assets[k].indexOf(','))])));
  check('PortD.assets: data URLs for the rest, null for inlined text', JSON.stringify(Object.keys(assets).sort()) === '["css/base.css","css/main.css","data/info.json","img/dot.png","js/a.js","js/b.js","js/mod.js","old.txt"]' && assets['css/main.css'] === null && assets['css/base.css'] === null && assets['js/a.js'] === null && assets['js/b.js'] === null &&
    assets['data/info.json'] === 'data:application/json;base64' && assets['img/dot.png'] === 'data:image/png;base64' && assets['js/mod.js'] === 'data:text/javascript;base64' && assets['old.txt'] === 'data:text/plain;base64', assets);
  check('a text asset decodes to the file, as UTF-8', await f.evaluate(() => new TextDecoder().decode(Uint8Array.from(atob(PortD.assets['data/info.json'].split(',')[1]), c => c.charCodeAt(0)))) === '{"hello":"wörld"}');
  check('fetch is not available to a program', await f.evaluate(() => fetch('https://example.invalid/').then(() => 'fetched', () => 'blocked')) === 'blocked' && await f.evaluate(() => fetch(PortD.assets['data/info.json']).then(() => 'fetched', () => 'blocked')) === 'blocked');
  check('a missing file is reported once in the console, and so is a reference outside the folder', warns.filter(w => /Kit refers to "img\/nope\.png", which is not a file in P:\\Programs\\kit/.test(w)).length === 1 && warns.filter(w => /Kit refers to "\.\.\/todo\/icon\.svg"/.test(w)).length === 1, warns);
  await closeAll();
  await ev(() => { PortDHost.vfs.write('P:\\Programs\\kit\\data\\big.txt', 'x'.repeat(2 * 1048576 + 1), { sys: true }); PortDHost.vfs.write('P:\\Programs\\kit\\css\\base.css', 'body{margin:11px}', { sys: true }); PortDHost.launch('kit'); }); await settle(300);
  f = await frame();
  check('a file over 2 MB is null in PortD.assets', await f.evaluate(() => PortD.assets['data/big.txt']) === null && await f.evaluate(() => 'data/big.txt' in PortD.assets));
  check('the assembled page is rebuilt when a file in the folder changes', await f.evaluate(() => getComputedStyle(document.body).marginTop) === '11px');
  await closeAll();
  await ev(() => { const v = PortDHost.vfs; v.remove('P:\\Programs\\kit\\data\\big.txt', { sys: true }); for (let i = 0; i < 5; i++) v.write('P:\\Programs\\kit\\data\\m' + i + '.txt', String(i).repeat(1900000), { sys: true }); PortDHost.launch('kit'); }); await settle(400);
  f = await frame();
  check('PortD.assets stops at 8 MB in total: later files are null', JSON.stringify(await f.evaluate(() => [0, 1, 2, 3, 4].map(i => PortD.assets['data/m' + i + '.txt'] === null))) === '[false,false,false,false,true]', await f.evaluate(() => [0, 1, 2, 3, 4].map(i => PortD.assets['data/m' + i + '.txt'] === null)));
  await closeAll();
  await ev(() => { for (let i = 0; i < 5; i++) PortDHost.vfs.remove('P:\\Programs\\kit\\data\\m' + i + '.txt', { sys: true }); });

  /* ------------------------------------------------------------------ */
  section('Narrow API: own data and own folder (P05, P11)');
  await ev(() => { PortDHost.launch('kit'); }); await settle(250); f = await frame();
  const app = await f.evaluate(() => PortD.app);
  check('PortD.app describes the program', app.id === 'kit' && app.name === 'Kit' && app.version === '1.0.0' && app.dir === PROGS + '\\kit' && app.dataDir === CONFIG + '\\kit' && app.args === null && app.portd === '1.1.0' && app.user.displayName === '', app);
  check('the API is the specified set', await f.evaluate(() => Object.keys(PortD).sort().join() + ' fs:' + Object.keys(PortD.fs).sort().join() + ' ui:' + Object.keys(PortD.ui).sort().join()) === 'app,assets,close,fs,notify,onOpenFile,openUrl,setTitle,ui fs:copy,exists,list,mkdir,move,read,remove,rename,write ui:openFile,saveFile');
  check('listing the data folder before anything is saved gives an empty list', JSON.stringify(await val(f, 'PortD.fs.list("")')) === '[]' && !(await has(CONFIG + '\\kit')));
  check('write with a relative path lands in the data folder, which is made as needed', await val(f, 'PortD.fs.write("a.txt", "one")') === CONFIG + '\\kit\\a.txt' && await read(CONFIG + '\\kit\\a.txt') === 'one');
  check('write makes missing folders below it', await val(f, 'PortD.fs.write("deep/er/b.txt", "two")') === CONFIG + '\\kit\\deep\\er\\b.txt');
  check('read, with a relative and an absolute path', await val(f, 'PortD.fs.read("a.txt")') === 'one' && await val(f, 'PortD.fs.read(PortD.app.dataDir + "\\\\deep\\\\er\\\\b.txt")') === 'two');
  check('exists', await val(f, 'PortD.fs.exists("a.txt")') === true && await val(f, 'PortD.fs.exists("nope.txt")') === false);
  check('mkdir and list', await val(f, 'PortD.fs.mkdir("box")') === CONFIG + '\\kit\\box' && JSON.stringify((await val(f, 'PortD.fs.list("")')).map(e => e.name + (e.dir ? '/' : '') + ':' + e.size)) === '["box/:0","deep/:1","a.txt:3"]' && JSON.stringify(Object.keys((await val(f, 'PortD.fs.list("")'))[0])) === '["name","path","dir","size","modified"]');
  check('a data URL can be written as a binary file', /pic\.png$/.test(await val(f, 'PortD.fs.write("pic.png", "data:image/png;base64,' + PNG + '", "dataurl")')) && await ev(() => PortDHost.vfs.node('P:\\User\\Config\\kit\\pic.png').enc) === 'dataurl');
  check('…and something that is not a data URL is refused for it', /not a data URL/.test((await inF(f, 'PortD.fs.write("x.png", "hello", "dataurl")')).e));
  check('remove', (await inF(f, 'PortD.fs.remove("pic.png")')).ok && !(await has(CONFIG + '\\kit\\pic.png')));
  check('the program can read and list its own program folder', /<title>Kit<\/title>/.test(await val(f, 'PortD.fs.read(PortD.app.dir + "\\\\index.html")')) && (await val(f, 'PortD.fs.list(PortD.app.dir + "\\\\css")')).map(e => e.name).join() === 'base.css,main.css');
  check('…but not write to it or remove from it', await denied(f, 'PortD.fs.write(PortD.app.dir + "\\\\x.txt", "x")', PROGS + '\\kit\\x.txt') && await denied(f, 'PortD.fs.remove(PortD.app.dir + "\\\\old.txt")', PROGS + '\\kit\\old.txt') && await denied(f, 'PortD.fs.mkdir(PortD.app.dir + "\\\\d")', PROGS + '\\kit\\d'));

  section('Narrow API: everything else is denied (P11)');
  await ev(() => { PortDHost.vfs.mkdir('P:\\User\\Config\\todo', { ok: true }); });
  check('other user files', await denied(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\notes.txt")', DOCS + '\\notes.txt') && await denied(f, 'PortD.fs.write("P:\\\\User\\\\Documents\\\\new.txt", "x")', DOCS + '\\new.txt') && await denied(f, 'PortD.fs.remove("P:\\\\User\\\\Documents\\\\notes.txt")', DOCS + '\\notes.txt'));
  check('exists does not leak what is outside', await denied(f, 'PortD.fs.exists("P:\\\\User\\\\Documents\\\\notes.txt")', DOCS + '\\notes.txt') && await denied(f, 'PortD.fs.exists("P:\\\\User\\\\Documents\\\\nope.txt")', DOCS + '\\nope.txt'));
  check('other programs', await denied(f, 'PortD.fs.read("P:\\\\Programs\\\\todo\\\\app.js")', PROGS + '\\todo\\app.js') && await denied(f, 'PortD.fs.list("P:\\\\Programs")', PROGS) && await denied(f, 'PortD.fs.list("P:\\\\Programs\\\\todo")', PROGS + '\\todo'));
  check('the OS folder', await denied(f, 'PortD.fs.read("P:\\\\OS\\\\README.txt")', 'P:\\OS\\README.txt') && await denied(f, 'PortD.fs.list("P:\\\\OS")', 'P:\\OS'));
  check('Config outside its own folder', await denied(f, 'PortD.fs.read("P:\\\\User\\\\Config\\\\settings.json")', CONFIG + '\\settings.json') && await denied(f, 'PortD.fs.write("P:\\\\User\\\\Config\\\\settings.json", "{}")', CONFIG + '\\settings.json') && await denied(f, 'PortD.fs.read("P:\\\\User\\\\Config\\\\todo\\\\todo.json")', CONFIG + '\\todo\\todo.json') && await denied(f, 'PortD.fs.list("P:\\\\User\\\\Config")', CONFIG) && await denied(f, 'PortD.fs.list("P:\\\\User\\\\Config\\\\todo")', CONFIG + '\\todo'));
  check('a folder whose name only starts like its own', await denied(f, 'PortD.fs.write("P:\\\\User\\\\Config\\\\kit2\\\\x.txt", "x")', CONFIG + '\\kit2\\x.txt') && !(await has(CONFIG + '\\kit2')));
  check('".." cannot climb out of the data folder', await denied(f, 'PortD.fs.read("..\\\\settings.json")', CONFIG + '\\settings.json') && await denied(f, 'PortD.fs.write("deep/../../../Desktop/x.txt", "x")', 'P:\\User\\Desktop\\x.txt') && await denied(f, 'PortD.fs.read("/User/Documents/notes.txt")', DOCS + '\\notes.txt'));
  check('the drive root and the home folder', await denied(f, 'PortD.fs.list("P:\\\\")', 'P:\\') && await denied(f, 'PortD.fs.list("P:\\\\User")', 'P:\\User') && await denied(f, 'PortD.fs.list("P:\\\\User\\\\Documents")', DOCS));
  check('the data folder itself cannot be removed, moved or renamed', await denied(f, 'PortD.fs.remove("")', CONFIG + '\\kit') && await denied(f, 'PortD.fs.rename(PortD.app.dataDir, "kit9")', CONFIG + '\\kit') && await denied(f, 'PortD.fs.move("", "box/in")', CONFIG + '\\kit'));
  check('a call that is not in the API is refused', /PortD has no call named/.test(await f.evaluate(() => new Promise(res => { addEventListener('message', e => { if (e.data && e.data.id === 9001) res(e.data.err || 'answered'); }); parent.postMessage({ portd: 1, id: 9001, m: 'vfs.write', a: ['P:\\x', 'y'] }, '*'); }))) &&
    /PortD has no call named/.test(await f.evaluate(() => new Promise(res => { addEventListener('message', e => { if (e.data && e.data.id === 9002) res(e.data.err || 'answered'); }); parent.postMessage({ portd: 1, id: 9002, m: 'constructor', a: [] }, '*'); }))));
  await ev(() => { window.postMessage({ portd: 1, id: 1, m: 'fs.write', a: ['P:\\User\\Documents\\forged.txt', 'x'] }, '*'); }); await settle();
  check('a message that does not come from a program\'s frame is ignored', !(await has(DOCS + '\\forged.txt')));
  check('nothing outside was changed by any of that', await read(DOCS + '\\notes.txt') === 'plain notes' && await ls(DOCS) === 'data.csv|notes.txt|other.txt|pkg.portdapp|Report.md' && /"theme"/.test(await read(CONFIG + '\\settings.json')), await ls(DOCS));

  section('Narrow API: move, copy, rename stay in the data folder (P06)');
  check('copy', await val(f, 'PortD.fs.copy("a.txt", "box/a2.txt")') === CONFIG + '\\kit\\box\\a2.txt' && await read(CONFIG + '\\kit\\box\\a2.txt') === 'one');
  check('move, making the target folder as needed', await val(f, 'PortD.fs.move("box/a2.txt", "moved/a3.txt")') === CONFIG + '\\kit\\moved\\a3.txt' && !(await has(CONFIG + '\\kit\\box\\a2.txt')));
  check('rename', await val(f, 'PortD.fs.rename("moved/a3.txt", "a4.txt")') === CONFIG + '\\kit\\moved\\a4.txt');
  check('rename refuses a name with a path in it', /is not a valid name/.test((await inF(f, 'PortD.fs.rename("a.txt", "..\\\\..\\\\x.txt")')).e) && /is not a valid name/.test((await inF(f, 'PortD.fs.rename("a.txt", "b/c.txt")')).e));
  check('copy out of the data folder is denied', await denied(f, 'PortD.fs.copy("a.txt", "P:\\\\User\\\\Documents\\\\a.txt")', DOCS + '\\a.txt') && !(await has(DOCS + '\\a.txt')));
  check('copy into the data folder from outside is denied', await denied(f, 'PortD.fs.copy("P:\\\\User\\\\Documents\\\\notes.txt", "n.txt")', DOCS + '\\notes.txt') && await denied(f, 'PortD.fs.copy(PortD.app.dir + "\\\\index.html", "i.html")', PROGS + '\\kit\\index.html'));
  check('move out, and move in, are denied', await denied(f, 'PortD.fs.move("a.txt", "P:\\\\User\\\\Desktop\\\\a.txt")', DESK + '\\a.txt') && await denied(f, 'PortD.fs.move("P:\\\\User\\\\Documents\\\\notes.txt", "n.txt")', DOCS + '\\notes.txt') && await has(DOCS + '\\notes.txt') && await has(CONFIG + '\\kit\\a.txt'));
  check('an existing target is not replaced', /already exists/.test((await inF(f, 'PortD.fs.copy("a.txt", "moved/a4.txt")')).e));

  section('Narrow API: the Open dialog grants exactly one file (P12)');
  await f.evaluate(() => { window.r1 = PortD.ui.openFile({ title: 'Pick a note', types: ['.txt'] }).then(v => window.got = v, e => window.got = 'ERR ' + e.message); }); await settle(200);
  check('the dialog is PortD\'s own, drawn by the page, titled "<Program> — <title>"', await ev(() => { const d = document.querySelector('.ov .dlg'); return !!d && d.querySelector('h2').textContent === 'Kit — Pick a note'; }) && await f.evaluate(() => !document.querySelector('.dlg')));
  check('it starts in Documents and lists only the asked-for types', await ev(() => document.querySelector('.dlg .bwhere span').textContent + ' ' + [...document.querySelectorAll('.dlg .brow')].map(r => r.textContent).join('|')) === DOCS + ' notes.txt|other.txt');
  const second = await inF(f, 'PortD.ui.openFile({})');
  check('a second dialog while one is open is rejected', !second.ok && second.e === 'A dialog is already open for this program.', second);
  check('…and so is a Save dialog', (await inF(f, 'PortD.ui.saveFile({})')).e === 'A dialog is already open for this program.');
  await page.locator('.dlg .bwhere button').click(); await settle();
  check('at the home folder it offers no Config, and cannot go higher', await ev(() => [...document.querySelectorAll('.dlg .brow')].map(r => r.textContent).join('|') + ' up:' + document.querySelector('.dlg .bwhere button').disabled) === 'Desktop|Documents|Pictures up:true');
  await page.locator('.dlg .brow', { hasText: 'Documents' }).dblclick(); await settle();
  await page.locator('.dlg .brow', { hasText: 'notes.txt' }).click(); await press('Open');
  check('it resolves { path, name, ext }', JSON.stringify(await f.evaluate(() => window.got)) === JSON.stringify({ path: DOCS + '\\notes.txt', name: 'notes.txt', ext: 'txt' }), await f.evaluate(() => window.got));
  check('the chosen file can now be read and written', await val(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\notes.txt")') === 'plain notes' && (await inF(f, 'PortD.fs.write("P:\\\\User\\\\Documents\\\\notes.txt", "edited by kit")')).ok && await read(DOCS + '\\notes.txt') === 'edited by kit');
  check('…in any spelling of its path', await val(f, 'PortD.fs.read("p:/user/documents/NOTES.TXT")') === 'edited by kit' && await val(f, 'PortD.fs.exists("P:\\\\User\\\\Documents\\\\notes.txt")') === true);
  check('the file next to it is still denied', await denied(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\other.txt")', DOCS + '\\other.txt'));
  check('the grant is for the file, not its folder', await denied(f, 'PortD.fs.list("P:\\\\User\\\\Documents")', DOCS) && await denied(f, 'PortD.fs.write("P:\\\\User\\\\Documents\\\\notes2.txt", "x")', DOCS + '\\notes2.txt'));
  check('a granted file cannot be removed, moved or renamed by the program', await denied(f, 'PortD.fs.remove("P:\\\\User\\\\Documents\\\\notes.txt")', DOCS + '\\notes.txt') && await denied(f, 'PortD.fs.rename("P:\\\\User\\\\Documents\\\\notes.txt", "n.txt")', DOCS + '\\notes.txt') && await denied(f, 'PortD.fs.move("P:\\\\User\\\\Documents\\\\notes.txt", "n.txt")', DOCS + '\\notes.txt'));
  await f.evaluate(() => { PortD.ui.openFile().then(v => window.got2 = v === null ? 'null' : v); }); await settle(200);
  check('with no title the dialog is "<Program> — Open", and with no types it lists everything', await ev(() => document.querySelector('.dlg h2').textContent) === 'Kit — Open' && await ev(() => document.querySelectorAll('.dlg .brow').length) === 5);
  await press('Cancel');
  check('Cancel resolves null and grants nothing', await f.evaluate(() => window.got2) === 'null' && await denied(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\other.txt")', DOCS + '\\other.txt'));
  check('after it closes, a dialog can be opened again', (await f.evaluate(() => { window.r3 = PortD.ui.openFile(); return 1; })) === 1 && (await settle(200), await ev(() => !!document.querySelector('.dlg'))));
  await press('Cancel');

  section('Narrow API: the Save dialog (P12)');
  await f.evaluate(() => { PortD.ui.saveFile({ title: 'Export', name: 'out', types: ['.csv'] }).then(v => window.sv = v, e => window.sv = 'ERR ' + e.message); }); await settle(200);
  check('titled "<Program> — <title>", with the name filled in', await ev(() => document.querySelector('.dlg h2').textContent + '|' + document.querySelector('.dlg input.field').value) === 'Kit — Export|out');
  await press('Save');
  check('it resolves the path, with the type added to a name without one', JSON.stringify(await f.evaluate(() => window.sv)) === JSON.stringify({ path: DOCS + '\\out.csv', name: 'out.csv', ext: 'csv' }), await f.evaluate(() => window.sv));
  check('the dialog writes nothing itself', !(await has(DOCS + '\\out.csv')));
  check('the program can then write the file, and read it back', (await inF(f, 'PortD.fs.write("P:\\\\User\\\\Documents\\\\out.csv", "x,y")')).ok && await read(DOCS + '\\out.csv') === 'x,y' && await val(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\out.csv")') === 'x,y');
  await f.evaluate(() => { window.sv = undefined; PortD.ui.saveFile({ name: 'other.txt' }).then(v => window.sv = v === null ? 'null' : v); }); await settle(200);
  check('with no title it is "<Program> — Save"', await ev(() => document.querySelector('.dlg h2').textContent) === 'Kit — Save');
  await press('Save');
  check('saving over an existing file asks first', /"other\.txt" already exists in P:\\User\\Documents\.\s+Replace it\?/.test(await dlg()), await dlg());
  await press('Cancel');
  check('…and declining keeps the dialog open and grants nothing', await ev(() => document.querySelector('.dlg h2').textContent) === 'Kit — Save' && await f.evaluate(() => window.sv) === undefined);
  await press('Save'); await press('Replace');
  check('…and accepting grants the file, still unchanged until the program writes', (await f.evaluate(() => window.sv)).path === DOCS + '\\other.txt' && await read(DOCS + '\\other.txt') === 'other' && (await inF(f, 'PortD.fs.write("P:\\\\User\\\\Documents\\\\other.txt", "replaced")')).ok && await read(DOCS + '\\other.txt') === 'replaced');
  await f.evaluate(() => { window.sv = undefined; PortD.ui.saveFile({ name: '.hidden' }).then(v => window.sv = v); }); await settle(200);
  await page.locator('.dlg .bwhere button').click(); await settle(); await press('Save');
  const dot = await f.evaluate(() => window.sv);
  check('a dot name saved in the home folder is granted where it will really go', dot.path === CONFIG + '\\.hidden' && (await inF(f, 'PortD.fs.write(' + JSON.stringify(dot.path) + ', "h")')).ok && await has(CONFIG + '\\.hidden') && !(await has('P:\\User\\.hidden')), dot);

  section('Narrow API: grants belong to one window and end with it (P11)');
  await ev(() => { PortDHost.launch('kit'); }); await settle(300);
  const f2 = await frame('.win.active iframe');
  check('(a second window of the same program is open)', await ev(() => PortDHost.wm.wins.filter(w => w.app === 'kit').length) === 2 && f2 !== f);
  check('a second window of the same program does not share the grant', await denied(f2, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\notes.txt")', DOCS + '\\notes.txt'));
  check('…while the first window still has it', await val(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\notes.txt")') === 'edited by kit');
  check('both see the shared data folder', await val(f2, 'PortD.fs.read("a.txt")') === 'one');
  await closeAll();
  await ev(() => { PortDHost.launch('kit'); }); await settle(300); f = await frame();
  check('after the window closes the grant is gone: a new window is denied', await denied(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\notes.txt")', DOCS + '\\notes.txt') && await denied(f, 'PortD.fs.write("P:\\\\User\\\\Documents\\\\out.csv", "z")', DOCS + '\\out.csv'));
  await saved(page); await reload(page); await saved(page);
  check('grants are not saved anywhere', !/notes\.txt/.test(await read(CONFIG + '\\settings.json')) && (await ls(CONFIG)).split('|').every(n => !/grant/i.test(n)));
  await ev(() => { PortDHost.launch('kit'); }); await settle(300); f = await frame();
  check('…so after a reload the file is denied again', await denied(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\notes.txt")', DOCS + '\\notes.txt'));

  section('Narrow API: the rest (P05)');
  check('notify shows a toast naming the program', (await inF(f, 'PortD.notify("hello there")')).ok && await toast() === 'Kit: hello there');
  check('setTitle changes the window title', (await inF(f, 'PortD.setTitle("Kit - doc")')).ok && await titles() === 'Kit - doc');
  check('openUrl refuses anything but http, https and mailto', /Only http, https and mailto links can be opened\./.test((await inF(f, 'PortD.openUrl("javascript:alert(1)")')).e) && /Only http/.test((await inF(f, 'PortD.openUrl("file:///C:/Windows/win.ini")')).e) && /Only http/.test((await inF(f, 'PortD.openUrl("data:text/html,x")')).e));
  const [pop] = await Promise.all([ctx.waitForEvent('page'), f.evaluate(() => { PortD.openUrl('mailto:someone@example.invalid'); })]);
  check('openUrl opens an allowed link in a new host tab', !!pop); await pop.close().catch(() => {});
  check('close closes the window', (await f.evaluate(() => { PortD.close(); return 1; })) === 1 && (await settle(200), await titles() === ''));

  /* ------------------------------------------------------------------ */
  section('Opening files with a program (P11, S03)');
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\Report.md'); }); await settle(300); f = await frame();
  check('a file opened by its association arrives in PortD.app.args.open', JSON.stringify(await f.evaluate(() => PortD.app.args)) === JSON.stringify({ open: { path: DOCS + '\\Report.md', name: 'Report.md', ext: 'md' } }));
  check('…and is granted for reading and writing', await val(f, 'PortD.fs.read(PortD.app.args.open.path)') === '# Report' && (await inF(f, 'PortD.fs.write(PortD.app.args.open.path, "# Edited")')).ok && await read(DOCS + '\\Report.md') === '# Edited');
  check('…and nothing else is', await denied(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\data.csv")', DOCS + '\\data.csv'));
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\data.csv'); }); await settle(300);
  check('Kit is not single-instance: a second file opens a second window', await ev(() => PortDHost.wm.wins.filter(w => w.app === 'kit').length) === 2);
  await closeAll();
  const outside = await ev(() => { try { PortDHost.launch('kit', { open: 'P:\\OS\\README.txt' }); return 'OPENED'; } catch (e) { return e.message; } });
  check('a file outside P:\\User is refused, with the reason', outside === '"README.txt" is not in your home folder. An installed program can only be given files from P:\\User.' && await titles() === '', outside);
  check('…and one in a program folder', /is not in your home folder/.test(await ev(() => { try { PortDHost.launch('kit', { open: 'P:\\Programs\\kit\\old.txt' }); return 'OPENED'; } catch (e) { return e.message; } })));
  await install(mini('solo', { name: 'Solo', singleInstance: true, fileTypes: [{ ext: '.txt', name: 'Solo text' }] }));
  await page.locator('.notice .btn', { hasText: /^Dismiss$/ }).click(); await settle();
  check('Dismiss closes the notice and changes nothing', await notices() === '' && !('.txt' in JSON.parse(await read(CONFIG + '\\associations.json')).assoc));
  await ev(() => { PortDHost.launch('solo', { open: 'P:\\User\\Documents\\notes.txt' }); }); await settle(300); f = await frame();
  await ev(() => { PortDHost.launch('builtin:calc'); PortDHost.launch('solo', { open: 'P:\\User\\Documents\\other.txt' }); }); await settle(250);
  check('a single-instance program keeps one window, which comes to the front', await ev(() => PortDHost.wm.wins.filter(w => w.app === 'solo').length) === 1 && await ev(() => PortDHost.wm.active.app) === 'solo');
  check('onOpenFile receives the next file', JSON.stringify(await f.evaluate(() => window.opened)) === JSON.stringify([DOCS + '\\other.txt']));
  check('…which is granted, and the earlier grant is kept while the window lives', await val(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\other.txt")') === 'replaced' && await val(f, 'PortD.fs.read("P:\\\\User\\\\Documents\\\\notes.txt")') === 'edited by kit');
  await ev(() => { PortDHost.launch('solo'); }); await settle(150);
  check('starting it again without a file just shows it', await ev(() => PortDHost.wm.wins.filter(w => w.app === 'solo').length) === 1 && (await f.evaluate(() => window.opened.length)) === 1);
  await closeAll();

  section('Type names, icons and Open with (P07, S04, S05)');
  await ev(() => { PortDHost.launch('builtin:files', { path: 'P:\\User\\Documents' }); }); await settle(200);
  const row = name => page.locator('.win.active .row').filter({ has: page.locator('.t', { hasText: new RegExp('^' + esc(name) + '$') }) });
  const typeOf = name => ev(name => { const r = [...document.querySelectorAll('.win .row')].find(r => r.querySelector('.t').textContent === name); return r.children[1].textContent + ' [' + (r.querySelector('.ico').dataset.glyph || '') + ']'; }, name);
  check('a file takes its type name and icon from the program chosen for it', await typeOf('Report.md') === 'Markdown note [notepad]', await typeOf('Report.md'));
  check('a declared type without an icon keeps the built-in icon', await typeOf('data.csv') === 'Table [text]', await typeOf('data.csv'));
  check('a type that is declared but not chosen keeps PortD\'s name', await typeOf('notes.txt') === 'Text file [text]');
  await ev(() => { PortDHost.vfs.setIcon('P:\\User\\Documents\\Report.md', 'glyph:calc'); }); await settle(150);
  check('an item\'s own icon wins over the program\'s', await typeOf('Report.md') === 'Markdown note [calc]');
  await ev(() => { PortDHost.vfs.setIcon('P:\\User\\Documents\\Report.md', ''); }); await settle(150);
  await row('Report.md').click({ button: 'right' }); await mi('Open with').hover(); await settle(250);
  check('Open with is a real submenu: declaring programs, built-ins, Choose another program, Download', await menuItems(1) === 'Kit|Notepad|Choose another program…|Download to this computer', await menuItems(1));
  await mi('Notepad', 1).click(); await settle(200);
  check('picking one opens the file with it, this once', await titles() === 'Documents - Files|Report.md - Notepad' && JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.md'] === 'kit', await titles());
  await ev(() => PortDHost.wm.wins.find(w => /Notepad/.test(w.title)).close(true)); await settle();
  await row('notes.txt').click({ button: 'right' }); await mi('Open with').hover(); await settle(250);
  check('for .txt: Solo declares it, Kit does not', await menuItems(1) === 'Solo|Notepad|Choose another program…|Download to this computer', await menuItems(1));
  await mi('Choose another program…', 1).click(); await settle(200);
  check('Choose another program lists every installed program and the built-ins that take the file', await ev(() => [...document.querySelectorAll('.dlg .clist .smi')].map(b => b.textContent).join('|')) === 'Kit|Solo|To-Do|Notepad' && /Always use this for \.txt files/.test(await dlg()), await ev(() => [...document.querySelectorAll('.dlg .clist .smi')].map(b => b.textContent).join('|')));
  await page.locator('.dlg label input[type=checkbox]').check(); await page.locator('.dlg .clist .smi', { hasText: 'Kit' }).click(); await settle(300);
  check('with "Always use this" the choice is stored and the file opens', JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.txt'] === 'kit' && /Kit/.test(await titles()));
  f = await frame();
  check('…in the chosen program, with the file granted', (await f.evaluate(() => PortD.app.args.open.name)) === 'notes.txt');
  await closeAll();
  await ev(() => { PortDHost.launch('builtin:files', { path: 'P:\\Programs' }); }); await settle(200);
  await row('kit').click({ button: 'right' }); await settle();
  check('a program folder in P:\\Programs offers Export as .portdapp…', (await menuItems()).split('|').includes('Export as .portdapp…'), await menuItems());
  await page.keyboard.press('Escape'); await settle();
  await ev(() => { PortDHost.vfs.mkdir('P:\\Programs\\loose', { sys: true }); }); await settle(150);
  await row('loose').click({ button: 'right' }); await settle();
  check('…a folder there that is not a program does not', !(await menuItems()).split('|').includes('Export as .portdapp…'));
  await page.keyboard.press('Escape'); await ev(() => { PortDHost.vfs.remove('P:\\Programs\\loose', { sys: true }); });
  await ev(() => { PortDHost.launch('builtin:files', { path: 'P:\\User\\Documents' }); }); await settle(200);
  await row('pkg.portdapp').click({ button: 'right' }); await settle();
  check('a .portdapp file offers Install…', (await menuItems()).split('|').includes('Install…') && await typeOf('pkg.portdapp') === 'PortD program [app]', await menuItems());
  await page.keyboard.press('Escape'); await closeAll();

  section('Default apps (S03)');
  await settings('programs');
  const defaults = () => ev(() => [...document.querySelectorAll('.spane .prow[data-ext]')].map(r => r.dataset.ext + '=' + r.querySelector('select').selectedOptions[0].textContent + (r.querySelector('.btn').disabled ? '' : ' [Reset]')).join('|'));
  check('Default apps lists every chosen and every declared type', await defaults() === '.csv=Kit [Reset]|.md=Kit [Reset]|.txt=Kit [Reset]', await defaults());
  check('each row offers PortD\'s choice, the programs (declaring ones first) and the built-ins', await ev(() => [...document.querySelector('.spane .prow[data-ext=".txt"] select').options].map(o => o.textContent).join('|')) === 'PortD\'s choice|Solo|Kit|To-Do|Notepad|Image Viewer', await ev(() => [...document.querySelector('.spane .prow[data-ext=".txt"] select').options].map(o => o.textContent).join('|')));
  await page.locator('.spane .prow[data-ext=".txt"] select').selectOption('solo'); await settle(150);
  check('choosing from the list stores it', JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.txt'] === 'solo' && /\.txt=Solo/.test(await defaults()));
  await page.locator('.spane .prow[data-ext=".txt"] select').selectOption('builtin:notepad'); await settle(150);
  check('a built-in is stored as builtin:<name>', JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.txt'] === 'builtin:notepad');
  await page.locator('.spane .prow[data-ext=".txt"] .btn').click(); await settle(150);
  check('Reset on a row removes that choice; the declared type stays listed', !('.txt' in JSON.parse(await read(CONFIG + '\\associations.json')).assoc) && await defaults() === '.csv=Kit [Reset]|.md=Kit [Reset]|.txt=PortD\'s choice', await defaults());
  await ev(() => { PortDHost.vfs.write('P:\\User\\Config\\associations.json', JSON.stringify({ version: 1, assoc: { '.md': 'kit', '.csv': 'gone-app', '.lnk': 'kit', '.url': 'kit', '.portd': 'kit', '.portdapp': 'builtin:notepad', 'bad': 'kit', '.log': 'builtin:notepad' } })); }); await settle(200);
  check('a choice for a program that is not installed is kept, and shown as not installed', /\.csv=gone-app \(not installed\) \[Reset\]/.test(await defaults()), await defaults());
  check('fixed types and malformed entries in the file are ignored', await defaults() === '.csv=gone-app (not installed) [Reset]|.log=Notepad [Reset]|.md=Kit [Reset]|.txt=PortD\'s choice', await defaults());
  await closeAll();
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\data.csv'); }); await settle(200);
  check('…and is skipped when opening: PortD\'s own rule applies', await titles() === 'data.csv - Notepad', await titles());
  await closeAll();
  await write(DOCS + '\\Kit link.lnk', JSON.stringify({ type: 'path', target: DOCS + '\\Report.md' }));
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\Kit link.lnk'); }); await settle(300);
  check('a shortcut is followed first, then the association applies to its target', await titles() === 'Kit' && (await (await frame()).evaluate(() => PortD.app.args.open.name)) === 'Report.md');
  await closeAll(); await settings('programs');
  await page.locator('.spane .btn', { hasText: /^Reset all$/ }).click(); await settle(150);
  check('Reset all clears every choice', JSON.stringify(JSON.parse(await read(CONFIG + '\\associations.json'))) === '{"version":1,"assoc":{}}' && await page.locator('.spane .btn', { hasText: /^Reset all$/ }).isDisabled());
  await closeAll();

  section('A web page: open as text or install (P02)');
  await write(DOCS + '\\Clock.html', '<!DOCTYPE html><html><head><title>My Clock!</title></head><body><p id="p">tick</p></body></html>');
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\Clock.html'); }); await settle(200);
  check('double-clicking an .html file asks: Notepad, or install as a program', /"Clock\.html" is a web page/.test(await dlg()) && await ev(() => [...document.querySelectorAll('.dlg .acts .btn')].map(b => b.textContent).join('|')) === 'Cancel|Install as a program…|Open in Notepad' && /Remember my choice for \.html files/.test(await dlg()), await dlg());
  await press('Install as a program…'); d = await dlg();
  check('installing shows the same confirmation, named from the page title', /^Install program/.test(d) && /My Clock!/.test(d) && /Files\s+1 file, /.test(d) && /Goes in\s+P:\\Programs\\my-clock/.test(d) && d.includes('It can\'t see the rest of your drive.'), d);
  await press('Install');
  check('a plain .html installs as a one-file program with a slug id', await ls(PROGS + '\\my-clock') === 'index.html|manifest.json' && JSON.parse(await read(PROGS + '\\my-clock\\manifest.json')).name === 'My Clock!' && await has(DESK + '\\My Clock!.lnk'), await ls(PROGS + '\\my-clock'));
  check('no file-type notice for a program that declares none', await notices() === '');
  await icon('My Clock!').dblclick(); await settle(300); f = await frame();
  check('…and runs, with the narrow API', (await f.evaluate(() => document.getElementById('p').textContent + PortD.app.id)) === 'tickmy-clock');
  await closeAll();
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\Clock.html'); }); await settle(200);
  await page.locator('.dlg label input[type=checkbox]').check(); await press('Open in Notepad');
  check('Open in Notepad with Remember stores builtin:notepad for .html', await titles() === 'Clock.html - Notepad' && JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.html'] === 'builtin:notepad');
  await closeAll();
  await ev(() => { PortDHost.openPath('P:\\User\\Documents\\Clock.html'); }); await settle(200);
  check('…and the next time it is not asked', await titles() === 'Clock.html - Notepad');
  await closeAll();

  /* ------------------------------------------------------------------ */
  section('Updating (P08)');
  await ev(() => { const v = PortDHost.vfs; v.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [{ type: 'program', id: 'kit' }] })); v.write('P:\\User\\Config\\associations.json', JSON.stringify({ version: 1, assoc: { '.md': 'kit', '.html': 'builtin:notepad' } })); }); await settle(150);
  check('(Kit is pinned and has an association)', await ev(() => !!document.querySelector('.task.pin[aria-label="Kit"]')));
  await ev(() => { PortDHost.launch('kit'); }); await settle(250);
  await offer(kit('1.2.0')); d = await dlg();
  check('a newer package asks "Update Kit 1.0.0 → 1.2.0?"', /^Update program/.test(d) && d.includes('Update Kit 1.0.0 → 1.2.0?') && /Version\s+1\.2\.0 \(installed: 1\.0\.0\)/.test(d), d);
  check('…says what is kept, with no version warning', /Its files are replaced\. What it has saved, its shortcut, its pin and your default apps are kept\./.test(d) && !/already installed|is newer/.test(d));
  await press('Update');
  check('the files are replaced and a dropped file is removed', JSON.parse(await read(PROGS + '\\kit\\manifest.json')).version === '1.2.0' && !(await has(PROGS + '\\kit\\old.txt')) && await ls(PROGS + '\\kit') === 'css|data|img|js|index.html|manifest.json', await ls(PROGS + '\\kit'));
  check('an edit made after installing is replaced too', await read(PROGS + '\\kit\\css\\base.css') === 'body{margin:7px}');
  check('its data is kept', await read(CONFIG + '\\kit\\a.txt') === 'one');
  check('its shortcut is kept, not doubled', (await ls(DESK)).split('|').filter(n => /^Kit/.test(n)).join() === 'Kit.lnk');
  check('its pin and its association are kept', await ev(() => !!document.querySelector('.task.pin[aria-label="Kit"]')) && JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.md'] === 'kit');
  check('the toast says so, and no notice repeats what is already the default', await toast() === 'Kit updated to 1.2.0' && /^Kit can open \.csv files/.test(await notices()), [await toast(), await notices()]);
  await page.locator('.notice .btn', { hasText: /^Dismiss$/ }).click();
  check('a window that was open keeps running the old page', await titles() === 'Kit');
  await closeAll();
  await ev(() => { PortDHost.launch('kit'); }); await settle(250); f = await frame();
  check('the next launch runs the new version', (await f.evaluate(() => PortD.app.version + ':' + ('old.txt' in PortD.assets))) === '1.2.0:false');
  await closeAll();
  await offer(kit('1.2.0')); d = await dlg();
  check('the same version asks "Reinstall Kit 1.2.0 (installed: 1.2.0)?" with a note', /^Reinstall program/.test(d) && d.includes('Reinstall Kit 1.2.0 (installed: 1.2.0)?') && /This is the version that is already installed\./.test(d), d);
  await press('Cancel');
  await offer(kit('1.1.9')); d = await dlg();
  check('an older version says the installed one is newer', d.includes('Reinstall Kit 1.1.9 (installed: 1.2.0)?') && /The installed version is newer than this package\./.test(d), d);
  await press('Reinstall');
  check('…and installs it when confirmed', JSON.parse(await read(PROGS + '\\kit\\manifest.json')).version === '1.1.9' && await toast() === 'Kit reinstalled, version 1.1.9');
  await page.locator('.notice .btn', { hasText: /^Dismiss$/ }).click().catch(() => {});
  await offer(Object.assign(kit('2.0.0'), { id: 'KIT' })); d = await dlg();
  check('an id is matched without regard to case: KIT updates kit', /^Update program/.test(d) && d.includes('Update Kit 1.1.9 → 2.0.0?'), d);
  await press('Cancel');
  await page.keyboard.press('Control+z'); await settle();
  check('installing is not undoable, and Undo says why', await toast() === 'Installing a program cannot be undone.', await toast());

  section('The id namespace (P16)');
  await install(mini('files', { name: 'My Files' }));
  check('a package with the id "files" installs as its own program', await ls(PROGS + '\\files') === 'index.html|manifest.json' && JSON.parse(await read(DESK + '\\My Files.lnk')).target === 'files');
  await ev(() => { PortDHost.launch('builtin:files'); PortDHost.launch('files'); }); await settle(300);
  check('builtin:files is still Files, and "files" is the installed program', await ev(() => PortDHost.wm.wins.map(w => w.app + '=' + (w.frame ? 'frame' : 'built-in')).join('|')) === 'builtin:files=built-in|files=frame');
  check('its data folder is P:\\User\\Config\\files', (await (await frame()).evaluate(() => PortD.app.dataDir)) === CONFIG + '\\files');
  await closeAll();
  await page.locator('#start').click(); await settle();
  check('both are listed in the PortD menu', await ev(() => [...document.querySelectorAll('#startmenu .smi')].map(b => b.textContent).filter(t => /Files/.test(t)).join('|')) === 'Files|My Files');
  await page.keyboard.press('Escape'); await settle();
  check('built-in ids are builtin:<name> wherever they are stored', await ev(() => { const v = PortDHost.vfs, links = v.list('P:\\User\\Desktop').filter(e => /\.lnk$/.test(e.name)).map(e => JSON.parse(v.read(e.path))).filter(l => l.type === 'program').map(l => l.target); return links.filter(t => /^builtin:/.test(t)).sort().join() === 'builtin:calc,builtin:notepad,builtin:settings' && links.filter(t => !/^builtin:/.test(t)).every(t => /^[a-z0-9-]{1,40}$/.test(t)); }) &&
    (await ls('P:\\OS\\Apps')).split('|').length === 5 && JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.html'] === 'builtin:notepad');
  check('"builtin:" cannot be installed over: the id is refused before anything is written', /contains ":"/.test(await refusal(mini('builtin:notepad'))) && (await ls(PROGS)).split('|').every(n => !/:/.test(n)));
  check('a folder in P:\\Programs whose manifest id does not match it is not a program', await ev(() => { const v = PortDHost.vfs; v.mkdir('P:\\Programs\\fake', { sys: true }); v.write('P:\\Programs\\fake\\manifest.json', JSON.stringify({ id: 'kit', name: 'Fake', entry: 'index.html' }), { sys: true }); v.write('P:\\Programs\\fake\\index.html', 'x', { sys: true });
    let out; try { PortDHost.launch('fake'); out = 'LAUNCHED'; } catch (e) { out = e.message; } v.remove('P:\\Programs\\fake', { sys: true }); return out; }) === 'The program "fake" is not installed.');

  /* ------------------------------------------------------------------ */
  section('Developer: export, and installing from this computer (P09)');
  const download = async trigger => { const [dl] = await Promise.all([page.waitForEvent('download'), trigger()]); const p = path.join(tmp, 'dl-' + Date.now() + '-' + dl.suggestedFilename()); await dl.saveAs(p); return { name: dl.suggestedFilename(), path: p }; };
  await settings('developer');
  check('Developer lists each installed program with Export as .portdapp…', await ev(() => [...document.querySelectorAll('.spane .prow')].map(r => r.dataset.id + ':' + [...r.querySelectorAll('.btn')].map(b => b.textContent).join()).join('|')) === 'files:Export as .portdapp…|kit:Export as .portdapp…|my-clock:Export as .portdapp…|solo:Export as .portdapp…|todo:Export as .portdapp…');
  await ev(() => { PortDHost.vfs.write('P:\\Programs\\kit\\.env', 'dot file', { sys: true }); PortDHost.vfs.write('P:\\Programs\\kit\\js\\Extra.JS', 'window.extra = 1;', { sys: true }); }); await settle(150);
  const exp = await download(() => prow('kit', 'Export as .portdapp…').click());
  const pkg = JSON.parse(fs.readFileSync(exp.path, 'utf8'));
  check('the file is named <id>-<version>.portdapp', exp.name === 'kit-1.1.9.portdapp', exp.name);
  check('it is a format 3 package with the manifest fields', pkg.format === 'portd-app' && pkg.formatVersion === 3 && pkg.id === 'kit' && pkg.name === 'Kit' && pkg.version === '1.1.9' && pkg.entry === 'index.html' && pkg.fileTypes.length === 2);
  check('it holds every file in the folder as it is now, without manifest.json', JSON.stringify(Object.keys(pkg.files).sort()) === '[".env","css/base.css","css/main.css","data/info.json","img/dot.png","index.html","js/Extra.JS","js/a.js","js/b.js","js/mod.js"]', Object.keys(pkg.files).sort());
  check('…with text as text and pictures as data URLs', pkg.files['js/Extra.JS'].enc === 'text' && pkg.files['js/Extra.JS'].d === 'window.extra = 1;' && pkg.files['img/dot.png'].enc === 'dataurl' && pkg.files['img/dot.png'].d === 'data:image/png;base64,' + PNG);
  check('…and no saved data', !JSON.stringify(pkg).includes('"a.txt"'));
  const folder = () => ev(() => { const out = []; (function walk(n, p) { if (n.t === 'f') out.push(p + ' ' + n.enc + ' ' + n.d); else { out.push(p + '/'); for (const k of Object.keys(n.c)) walk(n.c[k], p + '/' + k); } })(PortDHost.vfs.node('P:\\Programs\\kit'), ''); return JSON.stringify(out.sort()); });
  const before = await folder();
  await settings('programs'); await prow('kit', 'Uninstall').click(); await settle(150); await press('Uninstall');
  check('uninstalling Kit removes its folder, shortcut, pin and associations, and keeps its data', !(await has(PROGS + '\\kit')) && !(await has(DESK + '\\Kit.lnk')) && await ev(() => !document.querySelector('.task.pin')) && JSON.parse(await read(CONFIG + '\\taskbar.json')).pinned.length === 0 && !('.md' in JSON.parse(await read(CONFIG + '\\associations.json')).assoc) && await read(CONFIG + '\\kit\\a.txt') === 'one');
  check('…and leaves other choices alone', JSON.parse(await read(CONFIG + '\\associations.json')).assoc['.html'] === 'builtin:notepad');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.spane .btn', { hasText: /^Install a program…$/ }).click()]);
  check('Install a program… asks for a .portdapp or .html file', (await chooser.element().getAttribute('accept')) === '.portdapp,.html,.htm');
  await chooser.setFiles(exp.path); await settle(250); d = await dlg();
  check('…and shows the same confirmation', /^Install program/.test(d) && /Kit/.test(d) && /Files\s+10 files, /.test(d), d);
  await press('Install');
  check('export then install gives back the same program folder', await folder() === before && JSON.parse(before).length === 16, JSON.parse(before).length);
  check('…with a dot file and mixed-case names intact', await read(PROGS + '\\kit\\.env') === 'dot file' && (await ls(PROGS + '\\kit\\js')).split('|').includes('Extra.JS'));
  await page.locator('.notice .btn', { hasText: /^Dismiss$/ }).click(); await closeAll();
  const todoPkg = await (async () => { await settings('developer'); const e = await download(() => prow('todo', 'Export as .portdapp…').click()); return JSON.parse(fs.readFileSync(e.path, 'utf8')); })();
  check('To-Do exports like any program', todoPkg.id === 'todo' && Object.keys(todoPkg.files).sort().join() === 'app.js,icon.svg,index.html,style.css' && todoPkg.icon === 'icon.svg');
  await closeAll();
  const dropPkg = async (name, textBody) => { await ev(([name, body]) => { const dt = new DataTransfer(); dt.items.add(new File([body], name, { type: '' })); document.querySelector('#icons').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: 600, clientY: 300 })); }, [name, textBody]); await settle(250); };
  await dropPkg('dropped.portdapp', JSON.stringify(mini('dropped', { name: 'Dropped' })));
  check('dropping a .portdapp from this computer asks: Install or Just copy the file', /"dropped\.portdapp" is a PortD program package\./.test(await dlg()) && await ev(() => [...document.querySelectorAll('.dlg .acts .btn')].map(b => b.textContent).join('|')) === 'Cancel|Just copy the file|Install…', await dlg());
  await press('Just copy the file');
  check('Just copy the file puts it on the drive and installs nothing', await has(DESK + '\\dropped.portdapp') && !(await has(PROGS + '\\dropped')));
  await dropPkg('dropped.portdapp', JSON.stringify(mini('dropped', { name: 'Dropped' })));
  await press('Install…'); d = await dlg();
  check('Install… goes to the same confirmation', /^Install program/.test(d) && /Dropped/.test(d) && d.includes('It can\'t see the rest of your drive.'));
  await press('Install');
  check('…and installs without copying the file a second time', await has(PROGS + '\\dropped') && !(await has(DESK + '\\dropped (2).portdapp')));
  await dropPkg('old.portdapp', JSON.stringify(Object.assign(mini('oldone'), { formatVersion: 2 }))); await press('Install…');
  check('a prototype package dropped in is refused with the message', (await dlg() || '').includes(PROTO), await dlg());
  await press('OK');


  /* ------------------------------------------------------------------ */
  section('Programs and the network (K03): a hostile program against a local server');
  {
    const hits = [], udp = [];
    const srv = http.createServer((q, s) => { if (q.url !== '/favicon.ico') hits.push(q.method + ' ' + q.url); s.end('ok'); }).listen(0, '127.0.0.1');
    await new Promise(r => srv.on('listening', r));
    const sock = dgram.createSocket('udp4'); sock.on('message', m => udp.push(m.length)); await new Promise(r => sock.bind(0, '127.0.0.1', r));
    const B = 'http://127.0.0.1:' + srv.address().port, S = '<' + 'script>', E = '</' + 'script>';
    const control = await ctx.newPage(); await control.goto(B + '/control').catch(() => {}); await control.close();
    check('(control: the test server is reachable from this browser)', hits.join() === 'GET /control', hits);
    const ROUTES = {
      'img, script, stylesheet, font, media': '<img src="B/img"><script src="B/script">' + E + '<link rel="stylesheet" href="B/css"><style>@font-face{font-family:x;src:url(B/font)} body{font-family:x;background:url(B/bg)} @import url(B/import);</style><video src="B/video" autoplay></video><audio src="B/audio"></audio><svg><image href="B/svgimage"/></svg>x',
      'fetch, XMLHttpRequest, sendBeacon, EventSource, WebSocket': S + 'fetch("B/fetch").catch(function(){}); try { var x = new XMLHttpRequest(); x.open("GET", "B/xhr"); x.send(); } catch (e) {} try { navigator.sendBeacon("B/beacon", "x"); } catch (e) {} try { new EventSource("B/es"); } catch (e) {} try { new WebSocket("B/ws".replace("http", "ws")); } catch (e) {}' + E,
      'workers, dynamic import, prefetch, ping': S + 'try { new Worker("B/worker"); } catch (e) {} try { navigator.serviceWorker.register("B/sw").catch(function(){}); } catch (e) {}' + E + '<script type="module">import("B/dynimport").catch(function(){});' + E + '<link rel="prefetch" href="B/prefetch"><link rel="preload" as="image" href="B/preload"><a id="a" href="#" ping="B/ping">x</a>' + S + 'document.getElementById("a").click();' + E,
      'nested frame, object, embed': '<iframe src="B/iframe"></iframe><object data="B/object"></object><embed src="B/embed">',
      'navigating itself by location': S + 'location.href = "B/nav";' + E,
      'navigating itself by location.replace': S + 'location.replace("B/replace");' + E,
      'navigating itself by meta refresh': '<meta http-equiv="refresh" content="0;url=B/meta">',
      'navigating itself by a link': '<a id="a" href="B/anchor">x</a>' + S + 'document.getElementById("a").click();' + E,
      'submitting a form (GET)': '<form id="f" action="B/form" method="get"><input name="a" value="b"></form>' + S + 'document.getElementById("f").submit();' + E,
      'submitting a form (POST)': '<form id="f" action="B/formpost" method="post"><input name="a" value="b"></form>' + S + 'document.getElementById("f").submit();' + E,
      'navigating PortD\'s page, or opening a window': S + 'try { top.location = "B/top"; } catch (e) {} try { parent.location = "B/parent"; } catch (e) {} try { window.open("B/open"); } catch (e) {}' + E + '<a id="a" target="_top" href="B/anchortop">x</a><a id="b" target="_blank" href="B/anchorblank">x</a>' + S + 'document.getElementById("a").click(); document.getElementById("b").click();' + E
    };
    const run = async body => { await ev(html => { const v = PortDHost.vfs, d = 'P:\\Programs\\hostile'; if (v.exists(d)) v.remove(d, { sys: true }); v.mkdir(d, { sys: true }); v.write(d + '\\manifest.json', JSON.stringify({ id: 'hostile', name: 'Hostile', entry: 'index.html' }), { sys: true }); v.write(d + '\\index.html', '<!DOCTYPE html><body>' + html, { sys: true }); for (const w of PortDHost.wm.wins.slice()) w.close(true); PortDHost.launch('hostile'); }, body.split('B/').join(B + '/')); await settle(650); };
    const pages = ctx.pages().length, url = page.url();
    for (const [name, body] of Object.entries(ROUTES)) { const n = hits.length; await run(body); check('nothing reaches the server by ' + name, hits.length === n, hits.slice(n)); }
    check('PortD\'s page was not navigated and no window was opened', page.url() === url && ctx.pages().length === pages && await ev(() => !!window.PortDHost));
    await run(S + 'window.log = []; try { var p = new RTCPeerConnection({ iceServers: [{ urls: "stun:127.0.0.1:' + sock.address().port + '" }] }); p.createDataChannel("x"); p.createOffer().then(function (o) { return p.setLocalDescription(o); }); } catch (e) { window.log.push(e.message); }' + E);
    await settle(3000);
    console.log('  WebRTC: ' + (udp.length ? 'a program\'s RTCPeerConnection SENT ' + udp.length + ' UDP packets to the test STUN port. This browser has no page-level way to stop that (known limitation).' : 'no UDP packet reached the test STUN port.'));
    await closeAll(); await ev(() => { PortDHost.vfs.remove('P:\\Programs\\hostile', { sys: true }); });
    srv.close(); sock.close();
  }

  section('After a reload; no network, no errors');
  await saved(page); await reload(page); await saved(page);
  check('installed programs survive a reload', await ls(PROGS) === 'dropped|files|kit|my-clock|solo|todo', await ls(PROGS));
  check('start-up added nothing to the desktop', !(await has(DESK + '\\Welcome.txt')) && (await ls(DESK)).split('|').filter(n => /^To-Do/.test(n)).length === 1);
  await icon('Kit').dblclick(); await settle(300); f = await frame();
  check('a program installed before the reload runs', (await f.evaluate(() => PortD.app.version)) === '1.1.9' && await val(f, 'PortD.fs.read("a.txt")') === 'one');
  await closeAll();
  const src = fs.readFileSync(file, 'utf8');
  check('the forwarded keys are kept in one list: Ctrl+F6 and Ctrl+Shift+F6', (src.match(/FORWARD_KEYS = \[/g) || []).length === 1 && /FORWARD_KEYS = \[\{ key: 'F6', ctrl: true, shift: false, alt: false \}, \{ key: 'F6', ctrl: true, shift: true, alt: false \}\]/.test(src));
  check('the content security policy is unchanged', src.includes('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; form-action \'none\'; base-uri \'none\'">'));
  const outward = ctx.requests.filter(u => !/^(file|data|about|blob):/.test(u));
  check('every load a program asked for from the network was stopped by the page\'s policy before it left (' + outward.length + ' asked, ' + cspBlocked.length + ' stopped)', outward.length > 0 && outward.length === cspBlocked.length && outward.every(u => cspBlocked.includes(u)), outward);
  const errs = ctx.errors.filter(e => !/example\.invalid|127\.0\.0\.1|Content Security Policy|sandboxed|Not allowed to load local resource|ERR_|Failed to load resource|js\/mod\.js|img\/nope\.png|todo\/icon\.svg/.test(e));
  check('no console errors beyond the blocked loads the test program asks for', errs.length === 0, errs);
  await ctx.close();
};
