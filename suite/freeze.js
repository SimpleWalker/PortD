/* PortD suite, 1.1.0: programs that stop responding. A real program stuck in an endless loop, with real input: the red
   bar, the red title bars marked "(Not responding)", Close all programs, recovery, a program that recovers by itself,
   built-in apps left alone, the keyboard, the read-only bar together with it, and that the check only runs while a
   program is open. Also the limit, measured: with the browser's process isolation for sandboxed frames turned off, a
   stuck program freezes PortD itself. And the other 1.1.0 change: P:\OS\Apps put back at start-up. */
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
module.exports = async ({ check, section, profile, newDir, file, saved, reload, text, idb, firstRunAway }) => {
  const COUNT = `(() => {
    const iv = new Set(), si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function (f, ms, ...a) { const id = si.call(window, f, ms, ...a); iv.add(id); return id; };
    window.clearInterval = function (id) { iv.delete(id); return ci.call(window, id); };
    window.__intervals = () => iv.size;
  })();`;
  const ctx = await profile(newDir());
  await ctx.addInitScript(COUNT);
  const page = await ctx.open(file);
  await saved(page);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms = 90) => page.waitForTimeout(ms);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const closeAll = async () => { await ev(async () => { for (const w of PortDHost.wm.wins.slice()) await w.close(true); }); await settle(); };
  const launch = id => ev(id => { PortDHost.launch(id); }, id).then(() => settle(200));
  const press = label => page.locator('.ov:last-of-type .dlg .btn', { hasText: new RegExp('^' + esc(label) + '$') }).click().then(() => settle(140));
  const frameOf = async title => { const f = await (await page.waitForSelector('.win iframe[title="' + title + '"]')).contentFrame(); await f.waitForFunction(() => window.PortD && document.readyState === 'complete'); return f; };
  /* whether a frame really answers: code run in it, with a time limit */
  const answers = fr => Promise.race([fr.evaluate(() => 1).then(() => true, () => false), new Promise(r => setTimeout(() => r(false), 1500))]);
  const marked = () => ev(() => [...document.querySelectorAll('.win.hung .tb .ttl')].map(t => t.textContent).sort().join('|'));
  const bar = () => ev(() => !!document.querySelector('#frbar'));
  const LOOP = '<!DOCTYPE html><title>Busy</title><button id="b">Freeze</button><script>document.getElementById("b").onclick = function () { for (;;) {} };'
    + 'window.freeze = function () { setTimeout(function () { for (;;) {} }, 50); };'
    + 'window.busyFor = function (ms) { setTimeout(function () { var t = Date.now() + ms; while (Date.now() < t) {} }, 50); };</script>';
  const PKG = JSON.stringify({ format: 'portd-app', formatVersion: 3, id: 'busy', name: 'Busy', version: '1.0.0', entry: 'index.html', files: { 'index.html': { enc: 'text', d: LOOP } } });
  await ev(pkg => { PortDHost.vfs.write('P:\\User\\Documents\\busy.portdapp', pkg); Promise.resolve().then(() => PortDHost.openPath('P:\\User\\Documents\\busy.portdapp')); }, PKG); await settle(250);
  await press('Install'); await closeAll();

  section('Programs that stop responding: the check runs only while a program is open (F01)');
  const base = await ev(() => window.__intervals());
  await launch('builtin:notepad'); await launch('builtin:files'); await settle(300);
  check('built-in apps alone: nothing is checked, no timer runs', await ev(() => window.__intervals()) === base);
  await launch('todo'); await settle(300);
  check('a program open: one timer runs', await ev(() => window.__intervals()) === base + 1);
  await launch('busy'); await settle(300);
  check('two programs: still one timer', await ev(() => window.__intervals()) === base + 1);
  await closeAll();
  check('all closed: the timer stops', await ev(() => window.__intervals()) === base);

  section('Programs that stop responding: the bar and the red title bars (F01)');
  await launch('builtin:notepad');
  await page.locator('.win.active textarea').click(); await page.keyboard.type('unsaved words');
  await launch('todo'); await launch('busy');
  const todo = await frameOf('To-Do'), busy = await frameOf('Busy');
  await settle(7500);
  check('programs that answer: no bar and no red title bar, even after 7 s', !await bar() && await marked() === '');
  await busy.evaluate(() => window.freeze()).catch(() => {});
  const t0 = Date.now();
  await page.waitForSelector('#frbar', { timeout: 12000 }).catch(() => {});
  const took = Date.now() - t0;
  check('a program stuck in an endless loop brings up the red bar (after ' + (took / 1000).toFixed(1) + ' s; 6 to 7 s expected)', await bar() && took >= 5000 && took < 8500, took);
  check('the bar says what happened and what to do', await text(page, '#frbar span') === 'One or more programs have stopped responding. Close all programs to recover; anything unsaved in them will be lost.');
  check('it is announced (role alert) and has one button, Close all programs', await ev(() => document.querySelector('#frbar').getAttribute('role') === 'alert' && [...document.querySelectorAll('#frbar button')].map(b => b.textContent).join() === 'Close all programs'));
  check('it is red with white text, at the top, and the desktop moves down to make room', await ev(() => { const b = document.querySelector('#frbar'), cs = getComputedStyle(b), d = document.querySelector('#desktop').getBoundingClientRect(), r = b.getBoundingClientRect(); return cs.backgroundColor === 'rgb(179, 38, 30)' && cs.color === 'rgb(255, 255, 255)' && r.top === 0 && Math.abs(d.top - r.bottom) < 1; }));
  const todoAnswers = await answers(todo), busyAnswers = await answers(busy);
  console.log('  while Busy loops, To-Do ' + (todoAnswers ? 'still answers: programs have separate processes here' : 'does not answer either: the programs share one process here'));
  check('Busy, the stuck program, does not answer and its title bar is red: "Busy (Not responding)"', !busyAnswers && /(^|\|)Busy(\||$)/.test(await marked()) && await ev(() => { const w = [...document.querySelectorAll('.win.hung')].find(w => w.querySelector('.ttl').textContent === 'Busy'); return w.querySelector('.nr').textContent === '(Not responding)' && getComputedStyle(w.querySelector('.tb')).backgroundColor === 'rgb(179, 38, 30)'; }));
  check('To-Do is marked exactly as it really is (' + (todoAnswers ? 'answering, so not marked' : 'not answering, so marked') + ')', /To-Do/.test(await marked()) === !todoAnswers, await marked());
  check('the window\'s name for screen readers includes "(Not responding)"', await ev(() => { const w = [...document.querySelectorAll('.win.hung')].find(w => w.querySelector('.ttl').textContent === 'Busy'); return w.getAttribute('aria-labelledby').split(' ').map(id => document.getElementById(id).textContent).join(' ') === 'Busy (Not responding)'; }));
  check('the taskbar keeps the plain titles', await ev(() => [...document.querySelectorAll('#tasks .task')].every(b => !/Not responding/.test(b.textContent))));
  check('Notepad, a built-in, is not marked and still takes typing', await ev(() => !document.querySelector('.win.hung textarea')) && await (async () => { await page.locator('#tasks .task', { hasText: 'Notepad' }).click(); await settle(); await page.locator('.win textarea').click(); await page.keyboard.type('!'); return await ev(() => document.querySelector('.win textarea').value) === 'unsaved words!'; })());
  await page.locator('#start').click(); await settle();
  check('PortD itself keeps working: the PortD menu opens', await ev(() => document.querySelector('#startmenu').classList.contains('open')));
  await page.keyboard.press('Escape'); await settle();
  /* closing only the stuck program, with its own close button */
  await page.locator('.win.hung', { has: page.locator('.ttl', { hasText: /^Busy$/ }) }).locator('.wbtn.x').click(); await settle(1300);
  const still = await answers(todo);
  console.log('  after Busy alone was closed, To-Do ' + (still ? 'answers' : 'still does not answer (its process is still busy)'));
  check('closing only the stuck program removes it; To-Do stays marked as it really is', await ev(() => !document.querySelector('iframe[title=Busy]')) && /To-Do/.test(await marked()) === !still && await bar() === !still);
  if (still) { await launch('busy'); (await frameOf('Busy')).evaluate(() => window.freeze()).catch(() => {}); await page.waitForSelector('#frbar', { timeout: 12000 }); }
  /* Close all programs, from the keyboard: Shift+Tab from the desktop reaches the bar */
  await page.locator('#desktop').click({ position: { x: 900, y: 600 } }); await settle();
  await page.keyboard.press('Shift+Tab'); await settle();
  check('the bar\'s button is reached with Shift+Tab from the desktop', await ev(() => document.activeElement.closest('#frbar') !== null && document.activeElement.textContent === 'Close all programs'));
  await page.keyboard.press('Enter'); await settle(400);
  check('Close all programs closes every program at once and the bar goes', !await bar() && await ev(() => !PortDHost.wm.wins.some(w => w.frame) && !document.querySelector('.win iframe')));
  check('Notepad stays open with its unsaved text', await ev(() => PortDHost.wm.wins.length === 1 && document.querySelector('.win textarea').value === 'unsaved words!'));
  check('a message says how many closed and how to open them again', /^Closed [12] programs?\. You can open them again from the PortD menu\.$/.test(await text(page, '#toasts .toast')), await text(page, '#toasts .toast'));
  check('the focus did not fall out of the page', await ev(() => document.activeElement !== document.body && document.activeElement !== null));
  await launch('todo'); await launch('busy');
  const todo2 = await frameOf('To-Do'), busy2 = await frameOf('Busy'); await settle(7000);
  check('programs opened again answer, and nothing is red', await answers(todo2) && await answers(busy2) && !await bar() && await marked() === '');

  section('Programs that stop responding: a program that recovers by itself (F01)');
  await busy2.evaluate(() => window.busyFor(9000)).catch(() => {});
  await page.waitForSelector('#frbar', { timeout: 12000 }).catch(() => {});
  check('busy for 9 s: the bar comes up while it does not answer', await bar());
  await page.waitForFunction(() => !document.querySelector('#frbar'), null, { timeout: 10000 }).catch(() => {});
  check('when it answers again, the bar and the red title bars go by themselves', !await bar() && await marked() === '');
  check('and the programs were left open', await ev(() => PortDHost.wm.wins.filter(w => w.frame).length) === 2);
  await closeAll();

  section('Programs that stop responding: with the read-only bar (F01)');
  const two = await ctx.open(file);
  await two.waitForSelector('#robar', { timeout: 8000 });
  await two.evaluate(() => { PortDHost.launch('busy'); }); await two.waitForTimeout(800);
  const b3 = await (await two.waitForSelector('.win iframe[title=Busy]')).contentFrame();
  await b3.evaluate(() => window.freeze()).catch(() => {});
  await two.waitForSelector('#frbar', { timeout: 12000 }).catch(() => {});
  const lay = await two.evaluate(() => { const a = document.querySelector('#robar').getBoundingClientRect(), b = document.querySelector('#frbar').getBoundingClientRect(), d = document.querySelector('#desktop').getBoundingClientRect(); return { a: [a.top, a.bottom], b: [b.top, b.bottom], d: d.top }; });
  check('in a read-only tab both bars show, read-only first, without overlapping, and the desktop starts below both', lay.a[0] === 0 && Math.abs(lay.b[0] - lay.a[1]) < 1 && Math.abs(lay.d - lay.b[1]) < 1, lay);
  await two.locator('#frbar button').click(); await two.waitForTimeout(300);
  check('after Close all programs only the read-only bar is left, and the desktop moves back up', await two.evaluate(() => !document.querySelector('#frbar') && Math.abs(document.querySelector('#desktop').getBoundingClientRect().top - document.querySelector('#robar').getBoundingClientRect().bottom) < 1));
  await two.close();

  section('Programs that stop responding: the limit, measured (F01)');
  {
    const BROWSER = ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(x => require('fs').existsSync(x));
    const c2 = await chromium.launchPersistentContext(newDir(), { executablePath: BROWSER, headless: true, viewport: { width: 1280, height: 800 }, args: ['--disable-features=IsolateSandboxedIframes'] });
    const p2 = await c2.newPage();
    await p2.goto(page.url()); await p2.waitForFunction(() => window.PortDHost, null, { timeout: 15000 });
    await firstRunAway(p2);
    await p2.evaluate(pkg => { PortDHost.vfs.write('P:\\User\\Documents\\busy.portdapp', pkg); PortDHost.openPath('P:\\User\\Documents\\busy.portdapp'); }, PKG); await p2.waitForTimeout(300);
    await p2.locator('.dlg .btn', { hasText: /^Install$/ }).click(); await p2.waitForTimeout(300);
    await p2.evaluate(() => PortDHost.launch('busy')); await p2.waitForTimeout(800);
    const fr = await (await p2.waitForSelector('iframe[title=Busy]')).contentFrame();
    await fr.evaluate(() => window.freeze()).catch(() => {});
    await new Promise(r => setTimeout(r, 400));
    const answer = await Promise.race([p2.evaluate(() => 'answered'), new Promise(r => setTimeout(() => r('frozen'), 4000))]);
    console.log('  with IsolateSandboxedIframes off, PortD ' + (answer === 'frozen' ? 'froze' : 'kept running') + ' while a program looped');
    check('where the browser runs program frames in PortD\'s own process, a stuck program freezes PortD and no bar can show: the documented limit', answer === 'frozen');
    await c2.close().catch(() => {});
  }
  section('P:\\OS\\Apps is put back at start-up (1.1.0)');
  {
    const apps = () => page.evaluate(() => PortDHost.vfs.list('P:\\OS\\Apps').map(e => e.name).join('|'));
    const all = await apps();
    check('a new desktop describes the five built-ins', all === 'calc.json|files.json|notepad.json|settings.json|viewer.json', all);
    const stored = await idb(page, 'portd1', 'state'), readme = stored.fs.c.OS.c['README.txt'].d, sys = stored.fs.c.OS.c['system.json'].d;
    const bad = JSON.parse(JSON.stringify(stored));
    delete bad.fs.c.OS.c.Apps.c['files.json']; bad.fs.c.OS.c.Apps.c['calc.json'].d = '{ not json';
    await idb(page, 'portd1', 'state', bad); await reload(page); await saved(page);
    const r = await page.evaluate(() => { const v = PortDHost.vfs; return { files: JSON.parse(v.read('P:\\OS\\Apps\\files.json')).id, calc: JSON.parse(v.read('P:\\OS\\Apps\\calc.json')).id, readme: v.read('P:\\OS\\README.txt'), sys: v.read('P:\\OS\\system.json') }; });
    check('a missing description and an unreadable one are put back', r.files === 'builtin:files' && r.calc === 'builtin:calc' && await apps() === all, r);
    check('nothing else in P:\\OS changes', r.readme === readme && r.sys === sys);
    const kept = await idb(page, 'portd1', 'state');
    check('the repair is saved straight away', JSON.parse(kept.fs.c.OS.c.Apps.c['files.json'].d).id === 'builtin:files');
    const none = JSON.parse(JSON.stringify(kept)); delete none.fs.c.OS.c.Apps;
    await idb(page, 'portd1', 'state', none); await reload(page); await saved(page);
    check('a missing P:\\OS\\Apps folder is made again with all five', await apps() === all);
    const was = (await idb(page, 'portd1', 'state')).savedAt;
    await reload(page); await saved(page); await settle(800);
    check('a desktop that needs nothing is left as it was (not saved again at start-up)', (await idb(page, 'portd1', 'state')).savedAt === was && await apps() === all);
  }
  check('no console errors', ctx.errors.length === 0, ctx.errors);
  await ctx.close();
};
