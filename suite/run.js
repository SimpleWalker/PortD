/* PortD 1.0 test suite. Runs outside portd.html, in headless Edge if present, otherwise headless Chrome, from file://.
   Usage: node suite/run.js [path to portd.html] [path to the 0.x prototype, optional]
   The shipped file is reached only through window.PortDHost and the page itself. Checks marked (instrumented) run
   against a copy the suite makes, which also exposes a few internals; they are for code that has no screen yet. */
const fs = require('fs'), os = require('os'), path = require('path'), { pathToFileURL } = require('url');
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');

const SRC = path.resolve(process.argv[2] || path.join(__dirname, '..', 'portd.html'));
const PROTO = process.argv[3] ? path.resolve(process.argv[3]) : null;
const BROWSER = ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
const html = fs.readFileSync(SRC, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portd-suite-'));
let dirs = 0;
const newDir = () => { const d = path.join(tmp, 'd' + ++dirs); fs.mkdirSync(d); return d; };

let pass = 0, fail = 0, group = '';
const failures = [];
function section(name) { group = name; console.log('\n' + name); }
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ok    ' + name); }
  else { fail++; failures.push(group + ': ' + name); console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600) : '')); }
}

/* a build variant: the shipped text with replacements, each of which must match */
function variant(file, edits) {
  let t = html;
  for (const [a, b] of edits || []) { if (!t.includes(a)) throw new Error('variant: text not found: ' + a); t = t.replace(a, () => b); }
  fs.writeFileSync(file, t);
  return file;
}
const INSTRUMENT = ['window.PortDHost = {', 'window.PortDTest = { serialize, openDocument, checkIntegrity, summarize, newDocument, store, inst, saver, persist }; window.PortDHost = {'];

const WITHOUT = {
  locks: "Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined });",
  bc: "window.BroadcastChannel = undefined;",
  idb: "Object.defineProperty(window, 'indexedDB', { get: () => undefined });",
  ls: "Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('denied'); } });",
  storage: "Object.defineProperty(Navigator.prototype, 'storage', { get: () => undefined });",
  subtle: "Object.defineProperty(Crypto.prototype, 'subtle', { get: () => undefined });"
};
/* one browser profile; o.without lists features to take away before the page's script runs */
async function profile(dir, o = {}) {
  const ctx = await chromium.launchPersistentContext(dir, { executablePath: BROWSER, headless: true, viewport: { width: 1280, height: 800 }, hasTouch: !!o.touch });
  await ctx.addInitScript("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));" + (o.without || []).map(k => WITHOUT[k]).join(''));
  ctx.errors = []; ctx.requests = [];
  /* first: leave the Welcome note and the name question of a new desktop on screen; otherwise they are put away without a trace */
  ctx.open = async (file, first) => {
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') ctx.errors.push(m.text()); });
    page.on('pageerror', e => ctx.errors.push(String(e)));
    page.on('request', r => ctx.requests.push(r.url()));
    await page.goto(pathToFileURL(file).href);
    await page.waitForFunction(() => window.PortDHost || document.querySelector('#refused,#failed'), null, { timeout: 15000 });
    if (!first) await firstRunAway(page);
    if (!o.reminders) await later(page);
    return page;
  };
  return ctx;
}
const firstRunAway = async page => {
  await page.waitForTimeout(80);
  await page.evaluate(async () => {
    const d = [...document.querySelectorAll('.dlg')].find(x => x.querySelector('h2') && x.querySelector('h2').textContent === 'What should PortD call you?');
    if (!d) return;
    [...d.querySelectorAll('.btn')].find(b => b.textContent === 'Skip').click();
    PortDHost.wm.quiet = true; for (const w of PortDHost.wm.wins.slice()) await w.close(true); PortDHost.wm.quiet = false;
    document.activeElement.blur();
  });
  await page.waitForTimeout(60);
};
const saved = page => page.waitForFunction(() => { const i = document.querySelector('#tray [data-tray=save]'); return i && i.dataset.status === 'saved'; }, null, { timeout: 10000 });
const status = page => page.evaluate(() => { const i = document.querySelector('#tray [data-tray=save]'); return i ? i.dataset.status : null; });
/* what Settings > About says, as "label value" lines */
const about = async page => {
  await page.evaluate(() => PortDHost.launch('builtin:settings', { tab: 'about' }));
  const t = await page.evaluate(() => [...document.querySelectorAll('.spane dt')].map(dt => dt.textContent + '  ' + dt.nextElementSibling.textContent).join('\n'));
  await page.evaluate(() => Promise.all(PortDHost.wm.wins.slice().map(w => w.close()))); await page.waitForTimeout(450);
  return t;
};
const fsText = page => page.evaluate(() => JSON.stringify(PortDHost.getState().fs));
const tryIt = (page, code) => page.evaluate(code => { try { return { ok: true, v: new Function('vfs', 'DIR', 'Path', 'return ' + code)(PortDHost.vfs, PortDHost.DIR, PortDHost.Path) }; } catch (e) { return { ok: false, e: e.message }; } }, code);
/* the browser's stored records, read and written directly */
const idb = (page, db, key, value) => page.evaluate(([db, key, value]) => new Promise((res, rej) => {
  const r = indexedDB.open(db);
  r.onupgradeneeded = () => { r.transaction.abort(); };
  r.onerror = () => res('NO-DB');
  r.onsuccess = () => {
    const t = r.result.transaction('kv', value === undefined ? 'readonly' : 'readwrite'), os = t.objectStore('kv');
    const g = value === undefined ? os.get(key) : value === null ? os.delete(key) : os.put(value, key);
    t.oncomplete = () => { r.result.close(); res(value === undefined ? (g.result === undefined ? null : g.result) : true); };
    t.onerror = () => rej(t.error);
  };
}), [db, key, value]);
/* The backup reminder appears at every start of a desktop that has no backup. The parts of the suite that are about
   something else answer it with Later, as a user would; the data suite opens its profiles with { reminders: true }. */
const later = async page => { await page.waitForTimeout(60); await page.evaluate(() => { const b = [...document.querySelectorAll('#notices .notice .btn')].find(b => b.textContent === 'Later'); if (b) b.click(); }); };
const reload = async (page, keep) => { await page.reload(); await page.waitForFunction(() => window.PortDHost || document.querySelector('#refused,#failed')); if (!keep) await later(page); };
const text = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); return e ? e.innerText : null; }, sel);

(async () => {
  console.log('PortD suite\n  file     ' + SRC + '  (' + fs.statSync(SRC).size + ' bytes)\n  browser  ' + BROWSER);
  if (process.env.ONLY) {            /* one part of the suite, for quick runs while building */
    await require('./' + process.env.ONLY + '.js')({ check, section, profile, newDir, variant, file: variant(path.join(newDir(), 'portd.html')), saved, status, idb, reload, text, tryIt, about, html, tmp, firstRunAway });
    console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed' + (fail ? '\n\nFailed:\n' + failures.map(f => '  ' + f).join('\n') : ''));
    process.exit(fail ? 1 : 0);
  }

  /* ------------------------------------------------------------------ */
  section('Foundation: one file, from file://, no network');
  const main = newDir(), file = variant(path.join(main, 'portd.html'));
  let ctx = await profile(newDir());
  let page = await ctx.open(file);
  console.log('  browser version  ' + ctx.browser()?.version?.() + ' / ' + await page.evaluate(() => navigator.userAgent));
  check('boots from file://', await page.evaluate(() => location.protocol === 'file:' && !!window.PortDHost));
  check('version is 1.0.0', await page.evaluate(() => PortDHost.version) === '1.0.0');
  check('hook holds only the agreed members', (await page.evaluate(() => Object.keys(PortDHost).sort().join())) === 'DIR,Path,checkData,getState,launch,openPath,version,vfs,wm');
  check('CSP is exactly the specified policy', /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'">/.test(html));
  check('no service worker, web app manifest or PWA code in the file', !/serviceWorker|rel=["']?manifest|\.webmanifest|beforeinstallprompt|apple-mobile/i.test(html));
  check('no encryption or lock code in the file', !/subtle\.(encrypt|decrypt|deriveKey|importKey|generateKey)|AES-|PBKDF2|passphrase|lock screen|unlock/i.test(html));
  await saved(page);
  check('nothing but the file itself was requested', ctx.requests.every(u => u.startsWith('file:') || u.startsWith('data:')), ctx.requests);
  check('no CSP violations', (await page.evaluate(() => window.__csp)).length === 0, await page.evaluate(() => window.__csp));
  check('no console errors', ctx.errors.length === 0, ctx.errors);
  const found = await about(page); await saved(page);
  console.log('  what this browser gives PortD from file://:\n' + found.split('\n').map(l => '      ' + l).join('\n'));
  check('file:// is a secure context (WebCrypto available)', await page.evaluate(() => isSecureContext && !!crypto.subtle));
  check('working copy is in IndexedDB', /Browser storage  IndexedDB/.test(found));
  check('single instance uses Web Locks', /Single instance  Web Locks/.test(found));
  check('the desktop shows the Dawn background', await page.evaluate(() => getComputedStyle(document.querySelector('#desktop')).backgroundImage.includes('linear-gradient')));

  /* ------------------------------------------------------------------ */
  section('Drive: fixed root and layout (F01)');
  const ls = async p => (await tryIt(page, 'vfs.list(' + JSON.stringify(p) + ').map(e => e.name).join("|")')).v;
  check('root holds OS, Programs, User', await ls('P:\\') === 'OS|Programs|User');
  check('home holds Config, Desktop, Documents, Pictures', await ls('P:\\User') === 'Config|Desktop|Documents|Pictures');
  check('config holds the Recycle Bin and the config files', await ls('P:\\User\\Config') === 'Recycle Bin|associations.json|desktop.json|profile.json|settings.json|taskbar.json');
  check('OS holds Apps, README.txt, system.json', await ls('P:\\OS') === 'Apps|README.txt|system.json');
  check('built-ins are described as builtin:<name>', (await tryIt(page, 'vfs.list("P:\\\\OS\\\\Apps").map(e => JSON.parse(vfs.read(e.path)).id).join()')).v === 'builtin:calc,builtin:files,builtin:notepad,builtin:settings,builtin:viewer');
  check('Programs holds only the sample program on a new desktop', await ls('P:\\Programs') === 'todo');
  const refused = async (code, re) => { const r = await tryIt(page, code); return !r.ok && re.test(r.e) ? true : (console.log('        got: ' + JSON.stringify(r)), false); };
  check('cannot create a file in the root', await refused('vfs.write("P:\\\\x.txt", "x")', /root .* is fixed/));
  check('cannot create a folder in the root', await refused('vfs.mkdir("P:\\\\Stuff")', /root .* is fixed/));
  check('cannot delete a root folder', await refused('vfs.remove("P:\\\\Programs")', /root .* is fixed/));
  check('cannot rename a root folder', await refused('vfs.move("P:\\\\User", "P:\\\\Me")', /root .* is fixed/));
  check('cannot move something into the root', await refused('vfs.move("P:\\\\User\\\\Config\\\\profile.json", "P:\\\\profile.json")', /root .* is fixed/));
  check('OS is read-only: write', await refused('vfs.write("P:\\\\OS\\\\x.txt", "x")', /read-only/));
  check('OS is read-only: overwrite', await refused('vfs.write("P:\\\\OS\\\\README.txt", "x")', /read-only/));
  check('OS is read-only: delete', await refused('vfs.remove("P:\\\\OS\\\\README.txt")', /read-only/));
  check('OS is read-only: move out', await refused('vfs.move("P:\\\\OS\\\\README.txt", "P:\\\\User\\\\README.txt")', /read-only/));
  check('OS is read-only: copy in', await refused('vfs.copy("P:\\\\User\\\\Config\\\\profile.json", "P:\\\\OS\\\\p.json")', /read-only/));
  check('OS can be copied out of', (await tryIt(page, 'vfs.copy("P:\\\\OS\\\\README.txt", "P:\\\\User\\\\Documents\\\\README copy.txt")')).ok);
  for (const d of ['Desktop', 'Documents', 'Pictures', 'Config', 'Config\\Recycle Bin']) {
    check('system folder cannot be deleted: ' + d, await refused('vfs.remove(' + JSON.stringify('P:\\User\\' + d) + ')', /system folder/));
    check('system folder cannot be renamed: ' + d, await refused('vfs.move(' + JSON.stringify('P:\\User\\' + d) + ', "P:\\\\User\\\\Documents\\\\Moved")', /system folder/));
  }
  check('nothing can be created in the Recycle Bin', await refused('vfs.write("P:\\\\User\\\\Config\\\\Recycle Bin\\\\x.txt", "x")', /Recycle Bin/));

  section('Drive: names (F02)');
  for (const bad of ['a\\\\b', 'a:b', 'a*b', 'a?b', 'a\\"b', 'a<b', 'a>b', 'a|b', 'trail.', ' lead', 'x'.repeat(121), '__proto__']) {
    const r = await tryIt(page, 'vfs.into("P:\\\\User\\\\Documents\\\\" + "' + bad + '")');
    /* a backslash is a separator, so that one is checked through the name rule's message on the last part */
    check('name refused: ' + (bad.length > 20 ? '121 characters' : bad.replace(/\\\\/g, '\\').replace(/\\"/g, '"')), bad === 'a\\\\b' ? !r.ok && /Folder not found/.test(r.e) : !r.ok && /not a valid name/.test(r.e), r);
  }
  check('spaces around a path are trimmed, not kept in a name', (await tryIt(page, 'vfs.write("  P:\\\\User\\\\Documents\\\\trim.txt  ", "") ')).v === 'P:\\User\\Documents\\trim.txt');
  check('a slash is a separator, never part of a name', (await tryIt(page, 'vfs.mkdir("P:/User/Documents/Sub") + "|" + vfs.write("P:/User/Documents/Sub/a.txt", "1")')).v === 'P:\\User\\Documents\\Sub|P:\\User\\Documents\\Sub\\a.txt');
  check('.. cannot climb out of the drive', (await tryIt(page, 'Path.norm("P:\\\\User\\\\..\\\\..\\\\..\\\\OS")')).v === 'P:\\OS');
  check('names keep their case', (await tryIt(page, 'vfs.write("P:\\\\User\\\\Documents\\\\Notes.TXT", "one")')).v === 'P:\\User\\Documents\\Notes.TXT');
  check('names are matched without case', (await tryIt(page, 'vfs.read("p:\\\\user\\\\documents\\\\NOTES.txt")')).v === 'one');
  check('writing under another case updates the same file', (await tryIt(page, 'vfs.write("P:\\\\User\\\\Documents\\\\notes.txt", "two") + "|" + vfs.list(DIR.DOCS).filter(e => /notes/i.test(e.name)).length + "|" + vfs.read("P:\\\\User\\\\Documents\\\\Notes.TXT")')).v === 'P:\\User\\Documents\\Notes.TXT|1|two');
  check('a folder cannot take a file\'s name in another case', await refused('vfs.mkdir("P:\\\\User\\\\Documents\\\\NOTES.txt")', /already exists/));
  check('a file cannot overwrite a folder', await refused('vfs.write("P:\\\\User\\\\Documents\\\\sub", "x")', /folder named "Sub" already exists/));
  check('rename can change only the case', (await tryIt(page, 'vfs.move("P:\\\\User\\\\Documents\\\\Notes.TXT", "P:\\\\User\\\\Documents\\\\notes.txt")')).v === 'P:\\User\\Documents\\notes.txt');
  check('move refuses a taken name', await refused('vfs.write(DIR.DOCS + "\\\\b.txt", "b") && vfs.move(DIR.DOCS + "\\\\b.txt", DIR.DOCS + "\\\\NOTES.TXT")', /already exists/));
  check('copy refuses a taken name', await refused('vfs.copy(DIR.DOCS + "\\\\b.txt", DIR.DOCS + "\\\\notes.txt")', /already exists/));
  check('a folder cannot be moved into itself', await refused('vfs.move(DIR.DOCS + "\\\\Sub", DIR.DOCS + "\\\\Sub\\\\Inner")', /into itself/));
  check('a folder cannot be copied into itself', await refused('vfs.copy(DIR.DOCS + "\\\\Sub", DIR.DOCS + "\\\\Sub\\\\Inner")', /into itself/));
  check('copy is deep and independent', (await tryIt(page, 'vfs.copy(DIR.DOCS + "\\\\Sub", DIR.DOCS + "\\\\Sub 2") && vfs.write(DIR.DOCS + "\\\\Sub 2\\\\a.txt", "changed") && vfs.read(DIR.DOCS + "\\\\Sub\\\\a.txt")')).v === '1');
  check('uniqueName numbers a taken name', (await tryIt(page, 'vfs.uniqueName(DIR.DOCS, "notes.txt") + "|" + vfs.uniqueName(DIR.DOCS, "Sub") + "|" + vfs.uniqueName(DIR.DOCS, "free.txt")')).v === 'notes (2).txt|Sub (2)|free.txt');
  check('mkdir deep creates the missing parents', (await tryIt(page, 'vfs.mkdir(DIR.DOCS + "\\\\A\\\\B\\\\C", { deep: true })')).v === 'P:\\User\\Documents\\A\\B\\C');
  check('list puts folders first, then names in natural order', (await tryIt(page, '["f10.txt","f2.txt","F1.txt"].forEach(n => vfs.write(DIR.DOCS + "\\\\A\\\\" + n, "")) || vfs.list(DIR.DOCS + "\\\\A").map(e => e.name).join("|")')).v === 'B|F1.txt|f2.txt|f10.txt');
  check('binary files keep their encoding and report decoded size', (await tryIt(page, 'vfs.write(DIR.PICS + "\\\\dot.png", "data:image/png;base64,AAAAAA==", { enc: "dataurl" }) && vfs.list(DIR.PICS)[0].size + "|" + vfs.node(DIR.PICS + "\\\\dot.png").enc')).v === '4|dataurl');

  section('Drive: dot items go to Config (F03)');
  check('dot file written in the home folder lands in Config', (await tryIt(page, 'vfs.write("P:\\\\User\\\\.env", "A=1")')).v === 'P:\\User\\Config\\.env');
  check('…and is not in the home folder', await ls('P:\\User') === 'Config|Desktop|Documents|Pictures');
  check('…with a notice', /"\.env" is a dot item, so it was placed in P:\\User\\Config/.test(await text(page, '#toasts')));
  check('dot folder made in the home folder lands in Config', (await tryIt(page, 'vfs.mkdir("P:\\\\User\\\\.cache")')).v === 'P:\\User\\Config\\.cache');
  check('dot item moved into the home folder lands in Config', (await tryIt(page, 'vfs.write(DIR.DOCS + "\\\\.rc", "x") && vfs.move(DIR.DOCS + "\\\\.rc", "P:\\\\User\\\\.rc")')).v === 'P:\\User\\Config\\.rc');
  check('dot item copied into the home folder lands in Config', (await tryIt(page, 'vfs.copy("P:\\\\User\\\\Config\\\\.rc", "P:\\\\User\\\\.rc2")')).v === 'P:\\User\\Config\\.rc2');
  check('deep mkdir below a dot folder in home follows it to Config', (await tryIt(page, 'vfs.mkdir("P:\\\\User\\\\.tool\\\\data", { deep: true })')).v === 'P:\\User\\Config\\.tool\\data');
  check('a dot item anywhere else stays where it is put', (await tryIt(page, 'vfs.write(DIR.DOCS + "\\\\.keep", "") + "|" + vfs.write(DIR.DESKTOP + "\\\\.keep", "")')).v === 'P:\\User\\Documents\\.keep|P:\\User\\Desktop\\.keep');
  check('uniqueName looks in Config for a dot item in home', (await tryIt(page, 'vfs.uniqueName(DIR.HOME, ".env")')).v === '.env (2)');
  check('no console errors so far', ctx.errors.length === 0, ctx.errors);

  /* ------------------------------------------------------------------ */
  section('Working copy: save, reload, previous version (R01)');
  await saved(page);
  const before = await fsText(page);
  const rec = await idb(page, 'portd1', 'state');
  check('the record is the document: format, version, fs', rec.format === 'portd-data' && rec.formatVersion === 2 && rec.appVersion === '1.0.0' && rec.savedAt > 0 && JSON.stringify(rec.fs) === before);
  check('a change shows Saving, then Saved', await page.evaluate(async () => { PortDHost.vfs.write('P:\\User\\Documents\\s.txt', 's'); await 0; const st = () => document.querySelector('#tray [data-tray=save]').dataset.status, a = st(); await new Promise(r => setTimeout(r, 1200)); return a + '>' + st(); }) === 'pending>saved');
  const prev = await idb(page, 'portd1', 'prev');
  check('the copy before the last save is kept as the previous version', JSON.stringify(prev.fs) === before);
  await page.evaluate(() => PortDHost.vfs.remove('P:\\User\\Config\\taskbar.json'));
  await saved(page);
  const mid = await fsText(page);
  await reload(page);
  check('the drive is the same after a reload', await fsText(page) === mid);
  check('boot does not put back a default file the user deleted', !(await tryIt(page, 'vfs.exists("P:\\\\User\\\\Config\\\\taskbar.json")')).v);
  check('boot does not move a dot item that is already on the drive', await (async () => {
    const d = await idb(page, 'portd1', 'state'); d.fs.c.User.c['.manual'] = { t: 'f', enc: 'text', d: 'x', ct: 1, mt: 1 };
    await idb(page, 'portd1', 'state', d); await reload(page);
    return (await tryIt(page, 'vfs.exists("P:\\\\User\\\\.manual") && !vfs.exists("P:\\\\User\\\\Config\\\\.manual")')).v;
  })());
  check('a reload with nothing changed does not save again', await (async () => { const a = (await idb(page, 'portd1', 'state')).savedAt; await reload(page); await page.waitForTimeout(900); return (await idb(page, 'portd1', 'state')).savedAt === a; })());
  check('a change made just before closing is still saved', await (async () => {
    await page.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\last.txt', 'late'));
    await page.close(); page = await ctx.open(file);
    return (await tryIt(page, 'vfs.read("P:\\\\User\\\\Documents\\\\last.txt")')).v === 'late';
  })(), 'the save on page hide did not complete');
  const whole = await idb(page, 'portd1', 'state');
  await ctx.close();

  section('Working copy: a fresh browser profile');
  ctx = await profile(newDir()); page = await ctx.open(file); await saved(page);
  check('a fresh profile starts with a new, empty desktop', await ls('P:\\User\\Documents') === '');
  await idb(page, 'portd1', 'state', whole); await reload(page);
  check('the document opens the same in a fresh profile', await fsText(page) === JSON.stringify(whole.fs));
  await reload(page);
  check('…and is still the same after a reload there', await fsText(page) === JSON.stringify(whole.fs) && (await idb(page, 'portd1', 'state')).savedAt === whole.savedAt);
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('Data document: text, checksum, summary (R08, R09) (instrumented)');
  const idir = newDir(), ifile = variant(path.join(idir, 'portd.html'), [INSTRUMENT]);
  ctx = await profile(newDir()); page = await ctx.open(ifile); await saved(page);
  await page.evaluate(() => { const v = PortDHost.vfs; v.mkdir('P:\\Programs\\demo'); v.write('P:\\Programs\\demo\\manifest.json', '{}'); v.mkdir('P:\\Programs\\other'); v.write('P:\\Programs\\loose.txt', 'x'); v.write('P:\\User\\Pictures\\p.png', 'data:image/png;base64,AAAAAA==', { enc: 'dataurl' }); v.write('P:\\User\\Documents\\ü.txt', 'héllo ✓'); });
  await saved(page);
  const T = await page.evaluate(async () => {
    const t = PortDTest, st = PortDHost.getState(), text = await t.serialize(st), doc = JSON.parse(text);
    const tampered = JSON.parse(text); tampered.fs.c.User.c.Documents.c['ü.txt'].d = 'changed';
    const none = JSON.parse(text); delete none.integrity;
    const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(text.indexOf(',"fs":') + 6, -1))))].map(b => b.toString(16).padStart(2, '0')).join('');
    const opened = t.openDocument(JSON.parse(text), 'This file');
    return { keys: Object.keys(doc).join(), doc: { ...doc, fs: null }, sha, ok: await t.checkIntegrity(doc), bad: await t.checkIntegrity(tampered), none: await t.checkIntegrity(none),
      same: JSON.stringify(opened.fs) === JSON.stringify(st.fs), openedKeys: Object.keys(opened).join(), again: await t.serialize(opened) === text, fsText: JSON.stringify(st.fs) };
  });
  check('fields in order: format … integrity, summary, fs', T.keys === 'format,formatVersion,appVersion,createdAt,savedAt,integrity,summary,fs', T.keys);
  check('format is portd-data, version 2', T.doc.format === 'portd-data' && T.doc.formatVersion === 2 && T.doc.appVersion === '1.0.0');
  check('integrity is the SHA-256 of exactly the fs text in the file', T.doc.integrity.alg === 'SHA-256' && T.doc.integrity.value === T.sha, [T.doc.integrity, T.sha]);
  check('checksum verifies', T.ok === 'ok');
  check('a changed file is noticed', T.bad === 'mismatch');
  check('a file without a checksum is not called damaged', T.none === 'none');
  const tree = JSON.parse(T.fsText), mine = { files: 0, folders: -1, bytes: 0 };
  (function walk(n) { if (n.t === 'f') { mine.files++; mine.bytes += n.enc === 'dataurl' ? Buffer.from(n.d.split(',')[1], 'base64').length : n.d.length; } else { mine.folders++; Object.values(n.c).forEach(walk); } })(tree);
  check('summary counts files, folders and bytes as an independent count does', T.doc.summary.files === mine.files && T.doc.summary.folders === mine.folders && T.doc.summary.bytes === mine.bytes, [T.doc.summary, mine]);
  check('summary counts program folders, not loose files in Programs', T.doc.summary.programs === 3, T.doc.summary);
  check('the text opens back to the same drive', T.same && T.openedKeys === 'format,formatVersion,appVersion,createdAt,savedAt,fs');
  check('writing it again gives the same text', T.again);
  const opens = (doc, what) => page.evaluate(([doc, what]) => { try { PortDTest.openDocument(typeof doc === 'string' ? JSON.parse(doc) : doc, what || 'This file'); return 'OPENED'; } catch (e) { return e.message; } }, [doc, what]);
  const good = () => JSON.parse(JSON.stringify({ format: 'portd-data', formatVersion: 2, appVersion: '1.0.0', createdAt: 1, savedAt: 2, fs: tree }));
  const dmg = async (name, edit, re) => { const d = good(); edit(d); const m = await opens(d); check('refused: ' + name, re.test(m), m); };
  check('an untouched document opens', await opens(good()) === 'OPENED');

  section('Formats: what is refused, and how (R09) (instrumented)');
  const PROTO_MSG = "This file was made by the PortD prototype (0.x) and can't be opened by PortD 1.0.";
  check('formatVersion 1 is refused with the prototype message', await opens({ ...good(), formatVersion: 1 }) === PROTO_MSG);
  check('a document with no formatVersion is refused the same way', await opens({ format: 'portd-data', fs: tree }) === PROTO_MSG);
  const newer = await opens({ ...good(), formatVersion: 3, appVersion: '1.4.0' });
  check('a newer file is refused, naming both versions', /uses data format 3 and was written by PortD 1\.4\.0\. This is PortD 1\.0\.0, which reads data format 2 and older/.test(newer), newer);
  for (const [name, doc] of [['null', null], ['an array', []], ['a string', '"x"'], ['another format', { format: 'portd-app', formatVersion: 3 }], ['plain JSON', { hello: 1 }]])
    check('not a PortD data file: ' + name, await opens(doc) === 'This file is not a PortD data file.');
  await dmg('no drive', d => { delete d.fs; }, /is damaged: P: is neither a file nor a folder/);
  await dmg('a node of unknown type', d => { d.fs.c.User.c.Documents.c.odd = { t: 'x' }; }, /damaged: P:\\User\\Documents\\odd is neither a file nor a folder/);
  await dmg('a file without content', d => { delete d.fs.c.User.c.Documents.c['ü.txt'].d; }, /damaged: P:\\User\\Documents\\ü\.txt has no readable content/);
  await dmg('a file with an unknown encoding', d => { d.fs.c.User.c.Documents.c['ü.txt'].enc = 'gzip'; }, /ü\.txt has no readable content/);
  await dmg('a name with a forbidden character', d => { d.fs.c.User.c.Documents.c['a:b'] = { t: 'f', enc: 'text', d: '' }; }, /P:\\User\\Documents holds an item with a name that is not allowed: "a:b"/);
  await dmg('a name ending in a space', d => { d.fs.c.User.c.Documents.c['a '] = { t: 'f', enc: 'text', d: '' }; }, /name that is not allowed: "a "/);
  await dmg('two names differing only in case', d => { d.fs.c.User.c.Documents.c['Ü.TXT'] = { t: 'f', enc: 'text', d: '' }; }, /P:\\User\\Documents holds "Ü\.TXT" twice/);
  await dmg('a missing system folder', d => { delete d.fs.c.User.c.Pictures; }, /damaged: the folder P:\\User\\Pictures is missing/);
  await dmg('a file where a system folder should be', d => { d.fs.c.Programs = { t: 'f', enc: 'text', d: '' }; }, /the folder P:\\Programs is missing/);
  await dmg('something extra in the root', d => { d.fs.c.Extra = { t: 'd', c: {} }; }, /root of the drive holds something other than OS, Programs and User/);
  check('a __proto__ entry is refused, not followed', /name that is not allowed: "__proto__"/.test(await opens('{"format":"portd-data","formatVersion":2,"fs":' + T.fsText.replace('"c":{', '"c":{"__proto__":{"t":"d","c":{}},') + '}')));
  check('a refused document left the running desktop alone', await fsText(page) === T.fsText);

  section('Degrading: no WebCrypto (K06) (instrumented)');
  await ctx.close();
  ctx = await profile(newDir(), { without: ['subtle'] }); page = await ctx.open(ifile); await saved(page);
  const NC = await page.evaluate(async () => { const text = await PortDTest.serialize(PortDHost.getState()), d = JSON.parse(text); return { has: 'integrity' in d, keys: Object.keys(d).join(), check: await PortDTest.checkIntegrity(d), open: !!PortDTest.openDocument(d, 'x') }; });
  check('a data file is still written, without a checksum', !NC.has && NC.keys === 'format,formatVersion,appVersion,createdAt,savedAt,summary,fs' && NC.open);
  check('…and checking it reports "none", not a mismatch', NC.check === 'none');
  check('the page says so', /Checksum\s+Not available/.test(await about(page)));
  check('no console errors', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('Formats at start-up: the stored desktop is refused, never replaced');
  ctx = await profile(newDir()); page = await ctx.open(file); await saved(page);
  await page.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\keep.txt', 'v2 content')); await saved(page);
  await page.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\keep2.txt', 'more')); await saved(page);
  const okDoc = await idb(page, 'portd1', 'state');
  const seedBad = async doc => { await idb(page, 'portd1', 'state', doc); await reload(page); };
  await seedBad({ ...okDoc, formatVersion: 1 });
  check('a prototype-format desktop is refused with the message', (await text(page, '#refused') || '').includes(PROTO_MSG), await text(page, 'body'));
  check('…and says nothing was changed', /Nothing has been changed/.test(await text(page, '#refused')));
  check('…and the hook is not offered', await page.evaluate(() => !window.PortDHost));
  await page.waitForTimeout(900); await reload(page);
  check('…and the stored record is untouched, reload after reload', (await idb(page, 'portd1', 'state')).formatVersion === 1 && JSON.stringify((await idb(page, 'portd1', 'state')).fs) === JSON.stringify(okDoc.fs));
  await seedBad({ ...okDoc, formatVersion: 7, appVersion: '3.0.0' });
  check('a newer desktop is refused, naming both versions', /The desktop stored in this browser uses data format 7 and was written by PortD 3\.0\.0\. This is PortD 1\.0\.0/.test(await text(page, '#refused')));
  const broken = JSON.parse(JSON.stringify(okDoc)); delete broken.fs.c.User.c.Desktop;
  await seedBad(broken);
  check('a damaged desktop is refused, naming what is wrong', /is damaged: the folder P:\\User\\Desktop is missing/.test(await text(page, '#refused')));
  check('boot did not put the missing folder back', !('Desktop' in (await idb(page, 'portd1', 'state')).fs.c.User.c));
  const prevBtn = page.locator('#refused button', { hasText: 'Go back to the previous version' });
  check('the previous version is offered when it can be opened', await prevBtn.count() === 1);
  await Promise.all([page.waitForNavigation(), prevBtn.click()]);
  await page.waitForFunction(() => window.PortDHost);
  check('going back to it brings the desktop back', (await tryIt(page, 'vfs.read("P:\\\\User\\\\Documents\\\\keep.txt") + "|" + vfs.exists("P:\\\\User\\\\Desktop")')).v === 'v2 content|true');
  await seedBad(broken);
  await Promise.all([page.waitForNavigation(), page.locator('#refused button', { hasText: 'Start a new desktop' }).click()]);
  await page.waitForFunction(() => window.PortDHost); await saved(page);
  check('"Start a new desktop" starts one', await ls('P:\\User\\Documents') === '');
  check('…and keeps the copy it could not open', JSON.stringify(await idb(page, 'portd1', 'set-aside')) === JSON.stringify(broken));
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('Migrations (R09): a dummy table in a build variant');
  const mdir = newDir(), mfile = path.join(mdir, 'portd.html'), mprof = newDir();
  const TRACE = n => "d => { const docs = d.fs.c.User.c.Documents.c, f = docs['trace.txt'] || (docs['trace.txt'] = { t: 'f', enc: 'text', d: '', ct: 1, mt: 1 }); f.d += '" + n + "'; return d; }";
  const V4 = [['const FORMAT_VERSION = 2;', 'const FORMAT_VERSION = 4;'], ['const MIGRATIONS = {};', 'const MIGRATIONS = { 3: ' + TRACE(3) + ', 2: ' + TRACE(2) + ' };']];
  variant(mfile);
  ctx = await profile(mprof); page = await ctx.open(mfile); await saved(page);
  await page.evaluate(() => { const v = PortDHost.vfs; v.mkdir('P:\\Programs\\demo'); v.write('P:\\Programs\\demo\\manifest.json', '{"id":"demo"}'); v.write('P:\\User\\Documents\\mine.txt', 'mine'); });
  await saved(page);
  const v2doc = await idb(page, 'portd1', 'state');
  await reload(page); await page.waitForTimeout(700);
  check('a current document is not migrated or re-saved at boot', (await idb(page, 'portd1', 'state')).savedAt === v2doc.savedAt && await fsText(page) === JSON.stringify(v2doc.fs));
  await ctx.close();
  variant(mfile, V4);
  ctx = await profile(mprof); page = await ctx.open(mfile); await saved(page);
  check('format 2 → 4 ran migration 2, then migration 3', (await tryIt(page, 'vfs.read("P:\\\\User\\\\Documents\\\\trace.txt")')).v === '23');
  const v4doc = await idb(page, 'portd1', 'state');
  check('the migrated document is saved as format 4', v4doc.formatVersion === 4 && v4doc.fs.c.User.c.Documents.c['trace.txt'].d === '23');
  check('the document from before the migration is the previous version', (await idb(page, 'portd1', 'prev')).formatVersion === 2 && JSON.stringify((await idb(page, 'portd1', 'prev')).fs) === JSON.stringify(v2doc.fs));
  const strip = t => { const d = JSON.parse(t); delete d.c.User.c.Documents.c['trace.txt']; return JSON.stringify(d); };
  check('nothing else on the drive changed (Programs and user files intact)', strip(await fsText(page)) === JSON.stringify(v2doc.fs));
  await reload(page); await page.waitForTimeout(700);
  check('migrations do not run again on the next boot', (await tryIt(page, 'vfs.read("P:\\\\User\\\\Documents\\\\trace.txt")')).v === '23' && (await idb(page, 'portd1', 'state')).savedAt === v4doc.savedAt);
  await ctx.close();
  variant(mfile);
  ctx = await profile(mprof); page = await ctx.open(mfile);
  check('the 1.0.0 build refuses that format 4 desktop', /uses data format 4 and was written by PortD 1\.0\.0\. This is PortD 1\.0\.0, which reads data format 2 and older/.test(await text(page, '#refused') || ''), await text(page, 'body'));
  check('…and leaves it as it is', (await idb(page, 'portd1', 'state')).formatVersion === 4);
  await ctx.close();
  const gprof = newDir();
  variant(mfile); ctx = await profile(gprof); page = await ctx.open(mfile); await saved(page); await ctx.close();
  variant(mfile, [V4[0], ['const MIGRATIONS = {};', 'const MIGRATIONS = { 3: ' + TRACE(3) + ' };']]);
  ctx = await profile(gprof); page = await ctx.open(mfile);
  check('a gap in the table refuses the document rather than skipping a step', /uses data format 2, and this PortD has no upgrade from it to format 4/.test(await text(page, '#refused') || ''), await text(page, 'body'));
  check('…and leaves it as it is', (await idb(page, 'portd1', 'state')).formatVersion === 2);
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('Single instance (R04): Web Locks');
  ctx = await profile(newDir());
  let a = await ctx.open(file); await saved(a);
  await a.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\from-a.txt', 'A')); await saved(a);
  let b = await ctx.open(file);
  const bar = p => text(p, '#robar');
  check('a second tab is read-only and says so', /open in another tab or window. Changes here won't be saved/.test(await bar(b) || '') && await status(b) === 'readonly');
  check('the first tab is unaffected', await bar(a) === null && await status(a) === 'saved');
  check('the second tab shows what the first saved', (await tryIt(b, 'vfs.read("P:\\\\User\\\\Documents\\\\from-a.txt")')).v === 'A');
  const stamp = (await idb(a, 'portd1', 'state')).savedAt;
  await b.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\from-b.txt', 'B')); await b.waitForTimeout(900);
  check('a change in the read-only tab is not saved', (await idb(a, 'portd1', 'state')).savedAt === stamp && await status(b) === 'readonly');
  check('…and the banner flashes to say so', await b.evaluate(() => document.querySelector('#robar').classList.contains('flash')));
  await a.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\late-a.txt', 'unsaved yet'));     /* pending when the take-over starts */
  await b.locator('#robar button').click();
  await b.waitForFunction(() => !document.querySelector('#robar'), null, { timeout: 8000 });
  await a.waitForFunction(() => document.querySelector('#robar'), null, { timeout: 8000 });
  check('Take over: the second tab becomes the one that saves', await status(b) === 'saved' && /Single instance  Web Locks/.test(await about(b)));
  check('…the first tab becomes read-only', await status(a) === 'readonly');
  check('…the first tab finished saving before it let go', (await tryIt(b, 'vfs.read("P:\\\\User\\\\Documents\\\\late-a.txt")')).v === 'unsaved yet');
  check('…and the taker dropped its own unsaved changes for what was saved', !(await tryIt(b, 'vfs.exists("P:\\\\User\\\\Documents\\\\from-b.txt")')).v);
  await b.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\b2.txt', 'B2')); await saved(b);
  check('the new owner saves', (await idb(b, 'portd1', 'state')).fs.c.User.c.Documents.c['b2.txt'].d === 'B2');
  await a.locator('#robar button').click();
  await a.waitForFunction(() => !document.querySelector('#robar'), null, { timeout: 8000 });
  await b.waitForFunction(() => document.querySelector('#robar'), null, { timeout: 8000 });
  check('taking over back again works, with the other tab\'s work loaded', (await tryIt(a, 'vfs.read("P:\\\\User\\\\Documents\\\\b2.txt")')).v === 'B2' && await status(a) === 'saved');
  await a.close();
  await b.waitForFunction(() => !document.querySelector('#robar'), null, { timeout: 8000 });
  check('closing the owner promotes the waiting tab by itself', await status(b) === 'saved');
  await b.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\b3.txt', 'B3')); await saved(b);
  check('…and it saves', (await idb(b, 'portd1', 'state')).fs.c.User.c.Documents.c['b3.txt'].d === 'B3');
  let c = await ctx.open(file);
  await idb(b, 'portd1', 'state', { ...(await idb(b, 'portd1', 'state')), formatVersion: 9, appVersion: '9.0.0' });
  await c.locator('#robar button').click();
  await c.waitForFunction(() => /cannot take over/.test(document.querySelector('#robar').innerText), null, { timeout: 8000 });
  check('a tab that cannot open what the owner saved stays read-only and says why', /This window cannot take over: .*uses data format 9/.test(await bar(c)) && await status(c) === 'readonly');
  await c.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\c.txt', 'C')); await c.waitForTimeout(900);
  check('…and does not write over it', (await idb(c, 'portd1', 'state')).formatVersion === 9);
  check('no console errors', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  section('Single instance without Web Locks: BroadcastChannel (K06)');
  ctx = await profile(newDir(), { without: ['locks'] });
  a = await ctx.open(file); await saved(a);
  check('falls back to BroadcastChannel, and saves', /Single instance  BroadcastChannel \(no Web Locks\)/.test(await about(a)) && await status(a) !== 'readonly');
  b = await ctx.open(file);
  check('a second tab is read-only', /open in another tab/.test(await bar(b) || '') && await status(b) === 'readonly');
  await a.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\late-a.txt', 'A'));
  await b.locator('#robar button').click();
  await b.waitForFunction(() => !document.querySelector('#robar'), null, { timeout: 8000 });
  await a.waitForFunction(() => document.querySelector('#robar'), null, { timeout: 8000 });
  check('Take over swaps the two, after the owner saved', await status(b) === 'saved' && await status(a) === 'readonly' && (await tryIt(b, 'vfs.read("P:\\\\User\\\\Documents\\\\late-a.txt")')).v === 'A');
  await b.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\b.txt', 'B')); await saved(b);
  await b.close();
  await a.waitForFunction(() => !document.querySelector('#robar'), null, { timeout: 8000 });
  check('closing the owner promotes the other tab, with the owner\'s work', await status(a) === 'saved' && (await tryIt(a, 'vfs.read("P:\\\\User\\\\Documents\\\\b.txt")')).v === 'B');
  check('no console errors', ctx.errors.length === 0, ctx.errors);
  await ctx.close();
  ctx = await profile(newDir(), { without: ['locks', 'bc'] });
  a = await ctx.open(file); await saved(a);
  check('with neither, PortD still runs and saves, and says there is no protection', /Not available: do not open PortD twice/.test(await about(a)) && (await saved(a), true));
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('Degrading: storage (K06)');
  ctx = await profile(newDir(), { without: ['idb'] });
  page = await ctx.open(file); await saved(page);
  check('without IndexedDB the working copy goes to localStorage', /Browser storage\s+localStorage/.test(await about(page)));
  await page.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\ls.txt', 'kept')); await saved(page);
  await page.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\ls2.txt', 'kept2')); await saved(page);
  await reload(page);
  check('…and survives a reload', (await tryIt(page, 'vfs.read("P:\\\\User\\\\Documents\\\\ls.txt") + vfs.read("P:\\\\User\\\\Documents\\\\ls2.txt")')).v === 'keptkept2');
  check('…with a previous version', await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('portd1.prev')); return !!p && 'ls.txt' in p.fs.c.User.c.Documents.c && !('ls2.txt' in p.fs.c.User.c.Documents.c); }));
  await page.evaluate(() => { localStorage.setItem('portd1.state', '{"format":"portd-data","formatVers'); });
  await reload(page);
  check('a stored copy that cannot be read stops the start instead of being replaced', /PortD could not start/.test(await text(page, '#failed') || '') && await page.evaluate(() => localStorage.getItem('portd1.state').length < 50), await text(page, 'body'));
  await ctx.close();
  ctx = await profile(newDir(), { without: ['idb', 'ls'] });
  page = await ctx.open(file);
  await page.waitForFunction(() => document.querySelector('#tray [data-tray=save]').dataset.status === 'error');
  const nostore = await about(page);
  await page.waitForFunction(() => document.querySelector('#tray [data-tray=save]').dataset.status === 'error');
  check('with no storage at all PortD runs, and says nothing is saved', /Not available: nothing is saved/.test(nostore) && /Save failed: This browser gives PortD nowhere to keep data/.test(nostore) && /Save failed/.test(await text(page, '#tray')), nostore);
  check('…and the drive still works for the session', (await tryIt(page, 'vfs.write("P:\\\\User\\\\Documents\\\\x.txt", "x") && vfs.read("P:\\\\User\\\\Documents\\\\x.txt")')).v === 'x');
  await ctx.close();
  ctx = await profile(newDir(), { without: ['storage'] });
  page = await ctx.open(file); await saved(page);
  check('without the storage manager, persistent storage reads "not available" and PortD saves', /Persistent storage\s+Not available in this browser/.test(await about(page)));
  check('no console errors', ctx.errors.length === 0, ctx.errors);
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('The 0.x prototype in the same browser');
  if (!PROTO) console.log('  (skipped: no prototype file given)');
  else {
    const pdir = newDir(), pfile = path.join(pdir, 'prototype.html'), both = newDir();
    fs.copyFileSync(PROTO, pfile);
    ctx = await profile(both);
    const pp = await ctx.newPage(); await pp.goto(pathToFileURL(pfile).href); await pp.waitForFunction(() => window.PortDHost && PortDHost.getState().savedAt > 0, null, { timeout: 15000 });
    await pp.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\old.txt', 'prototype data')); await pp.waitForTimeout(1200);
    const protoDoc = await idb(pp, 'portd', 'state');
    check('(the prototype wrote a format 1 desktop to this profile)', protoDoc && protoDoc.formatVersion === 1 && !!protoDoc.fs.c.Programs.c.todo);
    page = await ctx.open(file); await saved(page);
    const shared = await idb(page, 'portd', 'state') !== 'NO-DB' && await idb(page, 'portd', 'state') !== null;
    console.log('  files in different folders ' + (shared ? 'SHARE' : 'do not share') + ' browser storage from file:// in this browser');
    check('1.0 starts its own new desktop and is not read-only beside a running prototype', await ls('P:\\Programs') === 'todo' && await ls('P:\\User\\Documents') === '' && await bar(page) === null);
    check('the prototype tab is not made read-only by 1.0', await pp.evaluate(() => !document.querySelector('#robar')));
    await page.evaluate(() => PortDHost.vfs.write('P:\\User\\Documents\\new.txt', '1.0 data')); await saved(page);
    if (shared) check('the prototype\'s stored desktop is untouched', JSON.stringify((await idb(page, 'portd', 'state')).fs) === JSON.stringify(protoDoc.fs));
    await pp.reload(); await pp.waitForFunction(() => window.PortDHost);
    check('the prototype still opens its own desktop afterwards', await pp.evaluate(() => PortDHost.vfs.read('P:\\User\\Documents\\old.txt')) === 'prototype data');
    await idb(page, 'portd1', 'state', protoDoc); await reload(page);
    check('a real prototype document is refused with the message', (await text(page, '#refused') || '').includes(PROTO_MSG));
    check('no console errors from 1.0', ctx.errors.filter(e => !/prototype/.test(e)).length === 0, ctx.errors);
    await ctx.close();
  }

  const kit = { check, section, profile, newDir, variant, file, saved, status, idb, reload, text, tryIt, about, html, tmp, firstRunAway };
  if (!process.env.ONLY || process.env.ONLY === 'shell') await require('./shell.js')(kit);
  if (!process.env.ONLY || process.env.ONLY === 'files') await require('./files.js')(kit);
  if (!process.env.ONLY || process.env.ONLY === 'programs') await require('./programs.js')(kit);
  if (!process.env.ONLY || process.env.ONLY === 'data') await require('./data.js')(kit);
  if (!process.env.ONLY || process.env.ONLY === 'polish') await require('./polish.js')(kit);
  if (!process.env.ONLY || process.env.ONLY === 'audit') await require('./audit.js')(kit);

  /* ------------------------------------------------------------------ */
  console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) console.log('\nFailed:\n' + failures.map(f => '  ' + f).join('\n'));
  console.log('portd.html: ' + fs.statSync(SRC).size + ' bytes (' + (fs.statSync(SRC).size / 1024).toFixed(1) + ' KB)');
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\nSUITE CRASHED\n', e); process.exit(2); });
