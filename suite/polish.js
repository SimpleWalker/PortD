/* PortD suite, Phase 6: the profile, the first start of a new desktop, the window list, taskbar colour and label modes,
   text size, motion, touch targets. Driven with real mouse and keyboard input. */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
module.exports = async ({ check, section, profile, newDir, file, saved, reload, text, tmp }) => {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const CONFIG = 'P:\\User\\Config', DOCS = 'P:\\User\\Documents';
  /* helpers bound to one page */
  const drive = page => {
    const ev = (fn, arg) => page.evaluate(fn, arg), settle = (ms = 90) => page.waitForTimeout(ms);
    return { page, ev, settle,
      read: p => ev(p => PortDHost.vfs.read(p), p),
      dlg: () => text(page, '.ov:last-of-type .dlg'),
      press: label => page.locator('.ov:last-of-type .dlg .btn', { hasText: new RegExp('^' + esc(label) + '$') }).click().then(() => settle(140)),
      titles: () => ev(() => PortDHost.wm.wins.map(w => w.title).join('|')),
      toast: () => ev(() => { const t = document.querySelector('#toasts .toast:last-child'); return t ? t.firstChild.textContent : ''; }),
      closeAll: async () => { await ev(async () => { for (const w of PortDHost.wm.wins.slice()) await w.close(true); }); await settle(); },
      settings: async tab => { await ev(tab => { PortDHost.launch('builtin:settings', { tab }); }, tab); await settle(150); },
      seg: (attr, v) => page.locator('.spane [data-' + attr + '="' + v + '"]').click().then(() => settle(150)),
      set: patch => ev(patch => { const v = PortDHost.vfs, p = 'P:\\User\\Config\\settings.json', s = JSON.parse(v.read(p)); for (const k of Object.keys(patch)) s[k] = patch[k] && typeof patch[k] === 'object' && !Array.isArray(patch[k]) ? Object.assign({}, s[k], patch[k]) : patch[k]; v.write(p, JSON.stringify(s)); }, patch).then(() => settle(120)),
      focused: () => ev(() => { const a = document.activeElement; return a.dataset.pin ? 'pin' : a.classList.contains('mi') ? 'row:' + a.textContent : a.closest('.win') ? 'window' : a.tagName; }),
      menuRows: () => ev(() => { const m = document.querySelector('.menu.winlist'); return m ? [...m.querySelectorAll('.mi')].map(b => b.textContent + (b.getAttribute('aria-current') ? '*' : '')).join('|') : null; }),
      tb: () => ev(() => { const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim(); return { bg: g('--taskbar-bg'), fg: g('--taskbar-fg'), ov2: g('--tb-ov2'), ind: g('--tb-ind'), shown: getComputedStyle(document.querySelector('#taskbar')).backgroundColor }; })
    };
  };
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const lum = c => { const l = c.map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), near = (a, b, d = 2) => a.every((v, i) => Math.abs(v - b[i]) <= d);
  const STD = { light: rgb('#eef1f5'), dark: rgb('#121820') };

  /* ------------------------------------------------------------------ */
  section('First start of a new desktop (D09)');
  let ctx = await profile(newDir()), page = await ctx.open(file, true), d = drive(page);
  await d.settle(250);
  check('the Welcome note opens in Notepad', await d.titles() === 'Welcome.txt - Notepad', await d.titles());
  check('the note is shown from its first line', await d.ev(() => { const ta = document.querySelector('.win textarea'); return ta.scrollTop === 0 && ta.selectionStart === 0 && ta.value.startsWith('Welcome to PortD'); }));
  check('…followed by one question: "What should PortD call you?"', await d.ev(() => { const x = document.querySelector('.ov .dlg'); return !!x && x.querySelector('h2').textContent === 'What should PortD call you?' && x.getAttribute('aria-modal') === 'true'; }));
  check('it says this is optional, only a display name and picture, and not an account', /^Optional\. This is only a display name and picture for this desktop\. It is not an account, and PortD stays single user\. You can change it later in Settings\./.test((await d.dlg()).split('\n').slice(1).join(' ').trim()), await d.dlg());
  check('the picture can be an emoji, a picture from this computer, or initials; there is no choosing from the drive', /Picture: an emoji, a picture, or your initials/.test(await d.dlg()) && await d.ev(() => [...document.querySelectorAll('.dlg .pedit .btn')].map(b => b.textContent).join('|')) === 'From this computer…|Use initials' && !/from drive/i.test(await d.dlg()));
  check('it is optional: Skip and Save, with the field focused', await d.ev(() => [...document.querySelectorAll('.dlg .acts .btn')].map(b => b.textContent).join('|')) === 'Skip|Save' && await d.ev(() => document.activeElement.tagName + ':' + document.activeElement.closest('label').textContent) === 'INPUT:Display name');
  check('nothing about a password, a PIN or a lock is asked', !/password|\bpin\b|lock|sign in/i.test(await d.dlg()));
  await d.press('Skip');
  check('Skip leaves the name empty and the Welcome note open', JSON.stringify(JSON.parse(await d.read(CONFIG + '\\profile.json'))) === '{"version":1,"displayName":"","avatar":null}' && await d.titles() === 'Welcome.txt - Notepad' && !(await d.dlg()));
  check('focus is in the Welcome note afterwards, not lost', await d.focused() === 'window');
  await page.locator('#start').click(); await d.settle();
  check('with no name the PortD menu says "PortD" beside the logo', await d.ev(() => { const hd = document.querySelector('#startmenu .smh'); return hd.textContent + '|' + hd.querySelector('.ico').dataset.glyph; }) === 'PortD|logo');
  await page.keyboard.press('Escape'); await d.closeAll();
  await saved(page); await reload(page); await d.settle(250);
  check('the second start asks nothing and opens nothing', await d.titles() === '' && !(await d.dlg()));
  await ctx.close();

  ctx = await profile(newDir()); page = await ctx.open(file, true); d = drive(page); await d.settle(250);
  await page.keyboard.type('x'.repeat(41)); await d.settle();
  check('the name field stops at 40 characters', await d.ev(() => document.activeElement.value.length) === 40);
  check('the preview follows the name as it is typed', await d.ev(() => document.querySelector('.dlg .ptile .ico.mono').textContent) === 'XX');
  await page.locator('.dlg input[aria-label="Display name"]').fill('  Lily Example  '); await page.keyboard.press('Enter'); await d.settle(150);
  check('Enter saves the name, trimmed, in profile.json', JSON.stringify(JSON.parse(await d.read(CONFIG + '\\profile.json'))) === '{"version":1,"displayName":"Lily Example","avatar":null}', await d.read(CONFIG + '\\profile.json'));
  await d.closeAll();

  section('Profile (D08)');
  await page.locator('#start').click(); await d.settle();
  check('the PortD menu shows the name with a monogram of its initials', await d.ev(() => { const hd = document.querySelector('#startmenu .smh'), i = hd.querySelector('.ico'); return hd.querySelector('span:last-child').textContent + '|' + (i.classList.contains('mono') ? i.textContent : 'no monogram'); }) === 'Lily Example|LE');
  check('the monogram\'s letters reach 4.5:1 on its tile', await d.ev(() => { const r = document.querySelector('#startmenu .smh .ico.mono rect'), c = getComputedStyle(r).fill.match(/[\d.]+/g).map(Number), l = c.map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 1.05 / (0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] + 0.05) >= 4.5; }));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#startmenu .foot .btn', { hasText: 'Download backup' }).click()]);
  const day = await d.ev(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  check('a backup is named after the display name', dl.suggestedFilename() === 'Lily Example-' + day + '.portd', dl.suggestedFilename());
  await d.settings('about');
  check('Settings > About shows the display name', /Display name\s+Lily Example/.test(await text(page, '.spane')));
  await d.closeAll(); await d.settings('profile');
  check('Settings > Profile has the name, the picture controls and Save, and says it is not an account', await d.ev(() => document.querySelector('.spane input[aria-label="Display name"]').value) === 'Lily Example' && /only a display name and picture for this desktop\. It is not an account, and PortD stays single user/.test(await text(page, '.spane')) && await d.ev(() => [...document.querySelectorAll('.spane .btn')].map(b => b.textContent).join('|')) === 'From this computer…|Use initials|Save');
  check('the tab offers no password or lock, and no picture from the drive', !/password|\bpin\b|lock|from drive/i.test(await text(page, '.spane')));
  await page.locator('.spane input[aria-label="Display name"]').fill('Sam'); await page.locator('.spane .btn', { hasText: /^Save$/ }).click(); await d.settle(150);
  check('Save changes the name and says so', JSON.parse(await d.read(CONFIG + '\\profile.json')).displayName === 'Sam' && await d.toast() === 'PortD will call you Sam');
  check('the tile follows: one word gives its first two letters', await d.ev(() => document.querySelector('.spane .ptile .ico.mono').textContent) === 'SA');
  await page.locator('.spane input[aria-label="Display name"]').fill('Ångström Ødegård'); await page.locator('.spane input[aria-label="Display name"]').press('Enter'); await d.settle(150);
  check('Enter in the field saves; letters outside ASCII work', JSON.parse(await d.read(CONFIG + '\\profile.json')).displayName === 'Ångström Ødegård' && await d.ev(() => document.querySelector('.spane .ico.mono').textContent) === 'ÅØ');
  check('the field stops at 40 characters', await d.ev(() => document.querySelector('.spane input[aria-label="Display name"]').maxLength) === 40);
  /* the picture */
  const name = page.locator('.spane input[aria-label="Display name"]'), emo = page.locator('.spane input[aria-label="Emoji for the picture"]'), save = page.locator('.spane .btn', { hasText: /^Save$/ });
  const prof = async () => JSON.parse(await d.read(CONFIG + '\\profile.json'));
  await name.fill('Lily Example'); await emo.fill('🦊'); await d.settle();
  check('typing an emoji shows it in the preview at once, before saving', await d.ev(() => document.querySelector('.spane .ptile .ico.emoji').textContent) === '🦊' && (await prof()).avatar === null);
  await save.click(); await d.settle(150);
  check('Save stores it as "emoji:…"', (await prof()).avatar === 'emoji:🦊' && (await prof()).displayName === 'Lily Example');
  await page.locator('#start').click(); await d.settle();
  check('the PortD menu shows the emoji beside the name', await d.ev(() => { const hd = document.querySelector('#startmenu .smh'); return hd.querySelector('.ico.emoji').textContent + '|' + hd.querySelector('span:last-child').textContent; }) === '🦊|Lily Example');
  await page.keyboard.press('Escape'); await d.settle();
  const wide = path.join(tmp, 'wide.png');
  execFileSync('python3', ['-I', '-c', 'import sys\nfrom PIL import Image\nim=Image.new("RGB",(300,100),(200,30,30))\nim.paste((30,60,200),(100,0,200,100))\nim.save(sys.argv[1])', wide]);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.spane .btn', { hasText: /^From this computer…$/ }).click()]);
  check('From this computer… asks for a picture file', (await chooser.element().getAttribute('accept')) === 'image/*');
  await chooser.setFiles(wide); await d.settle(300);
  check('the chosen picture shows in the preview and clears the emoji', await d.ev(() => { const i = document.querySelector('.spane .ptile .ico.face img'); return !!i && /^data:image\/png;base64,/.test(i.src); }) && await emo.inputValue() === '');
  await save.click(); await d.settle(150);
  const pic = (await prof()).avatar;
  const dims = await d.ev(src => new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); res([i.width, i.height, [...g.getImageData(64, 64, 1, 1).data].slice(0, 3).join(), [...g.getImageData(2, 64, 1, 1).data].slice(0, 3).join()]); }; i.src = src; }), pic);
  check('it is stored as a 128 × 128 PNG, cropped to the middle of the picture', /^data:image\/png;base64,/.test(pic) && dims[0] === 128 && dims[1] === 128 && dims[2] === '30,60,200' && dims[3] === '30,60,200', dims);
  await page.locator('#start').click(); await d.settle();
  check('the PortD menu shows the picture, round', await d.ev(pic => { const i = document.querySelector('#startmenu .smh .ico.face img'); return !!i && i.src === pic && getComputedStyle(i).borderRadius === '50%'; }, pic));
  await page.keyboard.press('Escape'); await d.closeAll();
  await d.ev(() => { PortDHost.launch('todo'); }); await d.settle(300);
  const fr = await (await page.waitForSelector('.win.active iframe')).contentFrame(); await fr.waitForFunction(() => window.PortD);
  check('a program can read the name as PortD.app.user.displayName, and not the picture', JSON.stringify(await fr.evaluate(() => PortD.app.user)) === '{"displayName":"Lily Example"}' && !JSON.stringify(await fr.evaluate(() => PortD.app)).includes('base64'));
  await d.closeAll(); await saved(page); await reload(page); d = drive(page); await d.settle(200);
  check('the picture survives a reload', (await prof()).avatar === pic);
  await d.settings('profile');
  await page.locator('.spane .btn', { hasText: /^Use initials$/ }).click(); await d.settle();
  check('Use initials goes back to the monogram in the preview', await d.ev(() => document.querySelector('.spane .ptile .ico.mono').textContent) === 'LE' && (await prof()).avatar === pic);
  await page.locator('.spane .btn', { hasText: /^Save$/ }).click(); await d.settle(150);
  check('…and Save stores no picture', (await prof()).avatar === null);
  for (const bad of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'javascript:alert(1)', 'https://example.invalid/me.png', 'emoji:' + 'x'.repeat(17), 42]) await d.ev(bad => { PortDHost.vfs.write('P:\\User\\Config\\profile.json', JSON.stringify({ version: 1, displayName: 'Lily Example', avatar: bad })); }, bad).then(async () => { await d.settle(120); check('a picture value PortD does not accept (' + String(bad).slice(0, 22) + ') is ignored: initials are shown', await d.ev(() => { const t = document.querySelector('.spane .ptile'); return !!t.querySelector('.ico.mono') && !t.querySelector('img'); })); });
  await d.ev(() => { PortDHost.vfs.write('P:\\User\\Config\\profile.json', JSON.stringify({ version: 1, displayName: 'Lily Example', avatar: null })); }); await d.settle(120);
  await page.locator('.spane input[aria-label="Display name"]').fill(''); await page.locator('.spane .btn', { hasText: /^Save$/ }).click(); await d.settle(150);
  check('an empty name clears it: "PortD" and the logo come back', (await prof()).displayName === '' && await d.toast() === 'Display name cleared' && await d.ev(() => document.querySelector('.spane .ptile .ico').dataset.glyph) === 'logo');
  check('the home folder is still P:\\User and the drive root is unchanged', await d.ev(() => PortDHost.vfs.list('P:\\').map(e => e.name).join('|')) === 'OS|Programs|User');
  await d.ev(() => { PortDHost.vfs.write('P:\\User\\Config\\profile.json', '{"version":1,"displayName":' + JSON.stringify('<img src=x onerror=alert(1)>') + '}'); }); await d.settle(150);
  await page.locator('#start').click(); await d.settle();
  check('a name is shown as text, never as markup', await d.ev(() => document.querySelector('#startmenu .smh span:last-child').textContent === '<img src=x onerror=alert(1)>' && !document.querySelector('#startmenu .smh img')));
  await page.keyboard.press('Escape'); await d.ev(() => { PortDHost.vfs.write('P:\\User\\Config\\profile.json', '{"version":1,"displayName":""}'); }); await d.closeAll();

  section('The Programs folder shows a program window, not a folder');
  await d.ev(() => { PortDHost.launch('builtin:files', { path: 'P:\\' }); }); await d.settle(200);
  const glyphOf = (sel, label) => d.ev(([sel, label]) => { const e = [...document.querySelectorAll(sel)].find(x => x.textContent.trim().startsWith(label)); return e ? e.querySelector('.ico').dataset.glyph : null; }, [sel, label]);
  check('in the Files sidebar, Programs has the window icon', await glyphOf('.win .side button', 'Programs') === 'app' && await glyphOf('.win .side button', 'Documents') === 'folder' && await glyphOf('.win .side button', 'Home') === 'home');
  check('in the drive\'s own list, P:\\Programs has it too, P:\\OS has the gear, and User stays a folder', await glyphOf('.win .row', 'Programs') === 'app' && await glyphOf('.win .row', 'OS') === 'settings' && await glyphOf('.win .row', 'User') === 'folder');
  await d.ev(() => { PortDHost.launch('builtin:files', { path: 'P:\\OS' }); }); await d.settle(200);
  check('folders inside P:\\OS stay ordinary folders', await glyphOf('.win.active .row', 'Apps') === 'folder');
  await d.ev(() => { PortDHost.vfs.mkdir('P:\\User\\Documents\\Programs'); PortDHost.vfs.write('P:\\User\\Desktop\\Progs.lnk', JSON.stringify({ type: 'path', target: 'P:\\Programs' })); PortDHost.launch('builtin:files', { path: 'P:\\User\\Documents' }); }); await d.settle(200);
  check('a folder that is merely called Programs is an ordinary folder', await glyphOf('.win.active .row', 'Programs') === 'folder');
  check('a shortcut to P:\\Programs shows the window icon with the shortcut arrow', await d.ev(() => { const i = [...document.querySelectorAll('.dicon')].find(e => e.querySelector('.lbl').textContent === 'Progs').querySelector('.ico'); return i.dataset.glyph + (i.classList.contains('short') ? ' short' : ''); }) === 'app short');
  await d.ev(() => { PortDHost.vfs.remove('P:\\User\\Documents\\Programs'); PortDHost.vfs.remove('P:\\User\\Desktop\\Progs.lnk'); }); await d.closeAll();

  /* ------------------------------------------------------------------ */
  section('Taskbar colour modes (T06)');
  await d.settings('appearance');
  check('Appearance offers Standard, Accent colour, Match the background, Custom colour', await d.ev(() => [...document.querySelectorAll('.spane [data-tint]')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('|')) === 'Standard*|Accent colour|Match the background|Custom colour');
  const shot = async () => {            /* the average colour of the bottom 15 % of the desktop background, measured from a screenshot with everything else hidden */
    await d.ev(() => { for (const s of ['#taskbar', '#icons', '#windows', '#toasts', '#notices']) document.querySelector(s).style.visibility = 'hidden'; });
    const p = path.join(tmp, 'wall-' + Date.now() + '.png'); await page.locator('#desktop').screenshot({ path: p });
    await d.ev(() => { for (const s of ['#taskbar', '#icons', '#windows', '#toasts', '#notices']) document.querySelector(s).style.visibility = ''; });
    return JSON.parse(execFileSync('python3', ['-I', '-c', 'import sys,json\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert("RGB")\nw,h=im.size\nc=im.crop((0,int(h*0.85),w,h))\npx=list(c.get_flattened_data())\nprint(json.dumps([sum(p[i] for p in px)/len(px) for i in range(3)]))', p]).toString());
  };
  const expectFor = (tone, theme) => { const g = (tone[0] + tone[1] + tone[2]) / 3; return mix(mix(tone, [g, g, g], 0.4), STD[theme], 0.5); };
  for (const theme of ['light', 'dark']) {
    await d.set({ theme, accent: '#2f7de1', wallpaper: { type: 'preset', value: 'Dawn', fit: 'cover' }, taskbar: { tint: 'standard' } });
    let tb = await d.tb();
    check(theme + ': Standard is the theme\'s own colour', near(rgb(tb.bg), STD[theme], 0) && ratio(rgb(tb.fg), rgb(tb.bg)) >= 4.5, tb);
    await d.seg('tint', 'accent'); tb = await d.tb();
    check(theme + ': Accent colour is the accent mixed two thirds toward the theme\'s Standard colour', near(rgb(tb.bg), mix(rgb('#2f7de1'), STD[theme], 2 / 3)) && ratio(rgb(tb.fg), rgb(tb.bg)) >= 4.5, [tb, hex(mix(rgb('#2f7de1'), STD[theme], 2 / 3))]);
    check(theme + ': the taskbar is really drawn in that colour', tb.shown.replace(/\s/g, '') === 'rgb(' + rgb(tb.bg).join(',') + ')', tb);
    await d.seg('tint', 'background');
    for (const preset of ['Dawn', 'Lagoon', 'Night']) {
      await d.set({ wallpaper: { type: 'preset', value: preset, fit: 'cover' } }); tb = await d.tb();
      const seen = await shot(), want = expectFor(seen, theme);
      check(theme + ': Match the background, ' + preset + ': the measured colour of the bottom of the picture, greyed a little, mixed half with Standard', near(rgb(tb.bg), want, 6) && ratio(rgb(tb.fg), rgb(tb.bg)) >= 4.5, [tb.bg, hex(want), 'bottom of background ' + hex(seen)]);
    }
    await d.set({ wallpaper: { type: 'color', value: '#c02020', fit: 'cover' } }); tb = await d.tb();
    check(theme + ': Match the background with a solid colour', near(rgb(tb.bg), expectFor(rgb('#c02020'), theme)) && ratio(rgb(tb.fg), rgb(tb.bg)) >= 4.5, tb);
    await d.set({ taskbar: { customColor: '#2b3440' } }); await d.seg('tint', 'custom');
    check(theme + ': Custom colour shows a colour picker and uses the colour as chosen', await page.locator('.spane input[aria-label="Custom taskbar colour"]').count() === 1 && near(rgb((await d.tb()).bg), rgb('#2b3440'), 0));
    for (const c of ['#ffffff', '#000000', '#ffd400', '#808080', '#767676', '#7a7f85', '#e53935', '#00e5ff']) {
      await d.set({ taskbar: { customColor: c } }); tb = await d.tb();
      const ov = tb.ov2.match(/[\d.]+/g).map(Number), hover = mix(rgb(tb.bg), ov.slice(0, 3), ov[3]);
      check(theme + ': custom ' + c + ': text ' + tb.fg + ' at ' + ratio(rgb(tb.fg), rgb(tb.bg)).toFixed(1) + ':1, still 4.5:1 on a hovered button, indicator 3:1', tb.bg === c && ratio(rgb(tb.fg), rgb(tb.bg)) >= 4.5 && ratio(rgb(tb.fg), hover) >= 4.5 && ratio(rgb(tb.ind), rgb(tb.bg)) >= 3, tb);
    }
  }
  /* a picture: red above, blue in the bottom fifth */
  const wall = await d.ev(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const g = c.getContext('2d'); g.fillStyle = '#d02020'; g.fillRect(0, 0, 200, 100); g.fillStyle = '#2040d0'; g.fillRect(0, 80, 200, 20); PortDHost.vfs.write('P:\\User\\Pictures\\two.png', c.toDataURL('image/png'), { enc: 'dataurl' }); return true; });
  await d.set({ theme: 'light', wallpaper: { type: 'image', value: 'P:\\User\\Pictures\\two.png', fit: 'cover' }, taskbar: { tint: 'background' } }); await d.settle(400);
  let tb = await d.tb();
  check('Match the background with your own picture takes the colour of its bottom edge', wall && near(rgb(tb.bg), expectFor(rgb('#2040d0'), 'light'), 8), [tb.bg, hex(expectFor(rgb('#2040d0'), 'light'))]);
  await saved(page); await reload(page); d = drive(page); await d.settle(400);
  check('the colour mode survives a reload, picture and all', JSON.parse(await d.read(CONFIG + '\\settings.json')).taskbar.tint === 'background' && (await d.tb()).bg === tb.bg, await d.tb());
  check('settings.json keeps only tint, customColor and labels for the taskbar', Object.keys(JSON.parse(await d.read(CONFIG + '\\settings.json')).taskbar).sort().join() === 'customColor,labels,tint');
  await d.set({ taskbar: { tint: 'nonsense', customColor: 'red', labels: 'sometimes' } });
  check('values PortD does not know fall back to Standard and Automatic', near(rgb((await d.tb()).bg), STD.light, 0));
  await d.set({ wallpaper: { type: 'preset', value: 'Dawn', fit: 'cover' }, taskbar: { tint: 'standard', customColor: '#2b3440', labels: 'auto' } });

  /* ------------------------------------------------------------------ */
  section('Window names on the taskbar (T07)');
  const compact = () => d.ev(() => document.querySelector('#tasks').classList.contains('compact'));
  const shownNames = () => d.ev(() => [...document.querySelectorAll('#tasks .task .tl')].filter(t => t.getClientRects().length).length);
  await d.closeAll();
  await d.ev(() => { for (let i = 0; i < 3; i++) PortDHost.vfs.write('P:\\User\\Documents\\n' + i + '.txt', 'x'); for (let i = 0; i < 3; i++) PortDHost.launch('builtin:notepad', { path: 'P:\\User\\Documents\\n' + i + '.txt' }); }); await d.settle(200);
  check('Automatic (the default): with room, every button shows its name', !(await compact()) && await shownNames() === 3);
  await d.set({ taskbar: { labels: 'never' } });
  check('Never: icons only', await compact() && await shownNames() === 0);
  await page.locator('#tasks .task').first().hover(); await page.waitForTimeout(900);
  check('a hidden name shows as a tooltip', (await text(page, '.tip') || '') === 'n0.txt - Notepad', await text(page, '.tip'));
  await page.mouse.move(600, 300); await d.settle();
  await page.locator('#tasks .task').first().focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(900);
  check('…and when the button is reached by keyboard', (await text(page, '.tip') || '') === 'n1.txt - Notepad', await text(page, '.tip'));
  await page.keyboard.press('Escape'); await d.set({ taskbar: { labels: 'always' } });
  const many = async n => { await d.ev(n => { const have = PortDHost.wm.wins.length; for (let i = have; i < n; i++) PortDHost.launch('builtin:calc'); }, n); await d.settle(200); };
  const per = () => d.ev(() => { const b = document.querySelector('#tasks'); return Math.round(b.clientWidth / b.children.length); });
  await many(14);
  check('Always: names stay however narrow the buttons get (' + await per() + ' px each)', !(await compact()) && await per() < 100);
  await d.set({ taskbar: { labels: 'auto' } });
  check('Automatic: names are hidden once the buttons are under 100 px each', await compact() && await shownNames() === 0);
  const closeOne = async () => { await d.ev(async () => { await PortDHost.wm.wins[PortDHost.wm.wins.length - 1].close(true); }); await d.settle(120); };
  let p = await per(); while (p < 104) { await closeOne(); p = await per(); }
  check('between 100 and 120 px (' + p + ' px) they stay hidden: no flicker at the boundary', p >= 100 && p < 120 && await compact());
  while (p <= 120) { await closeOne(); p = await per(); }
  check('above 120 px (' + p + ' px) they come back', p > 120 && !(await compact()) && await shownNames() > 0);
  await many(await d.ev(() => PortDHost.wm.wins.length) + 1); p = await per();
  check('…and coming down again they stay shown until under 100 px (' + p + ' px)', p >= 100 && p <= 120 && !(await compact()), p);
  await d.set({ taskbar: { labels: 'always' } });
  await page.setViewportSize({ width: 600, height: 800 }); await d.settle(300);
  check('on a narrow screen buttons are always icon-only, whatever the setting', await compact());
  await page.setViewportSize({ width: 1280, height: 800 }); await d.settle(300);
  await d.set({ taskbar: { labels: 'auto' } }); await d.closeAll();
  await d.settings('appearance');
  await d.seg('labels', 'never');
  check('the setting is in Appearance > Taskbar: Always, Automatic, Never', await d.ev(() => [...document.querySelectorAll('.spane [data-labels]')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('|')) === 'Always|Automatic|Never*' && JSON.parse(await d.read(CONFIG + '\\settings.json')).taskbar.labels === 'never');
  await d.seg('labels', 'auto'); await d.closeAll();

  /* ------------------------------------------------------------------ */
  section('Window list (T05)');
  await d.ev(() => { PortDHost.vfs.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [{ type: 'program', id: 'builtin:notepad' }, { type: 'program', id: 'builtin:calc' }] })); PortDHost.launch('builtin:notepad', { path: 'P:\\User\\Documents\\n0.txt' }); }); await d.settle(200);
  const pinBtn = page.locator('#tasks [data-pin="program:builtin:notepad"]');
  await pinBtn.click(); await d.settle(150);
  check('with one window the pinned button still minimises and restores it', await d.menuRows() === null && await d.ev(() => PortDHost.wm.wins[0].min) === true);
  await pinBtn.click(); await d.settle(150);
  check('…and brings it back', await d.ev(() => PortDHost.wm.wins[0].min) === false && await d.ev(() => PortDHost.wm.active.title) === 'n0.txt - Notepad');
  await d.ev(() => { PortDHost.launch('builtin:notepad', { path: 'P:\\User\\Documents\\n1.txt' }); PortDHost.launch('builtin:notepad', { path: 'P:\\User\\Documents\\n2.txt' }); }); await d.settle(200);
  check('the button says how many windows it stands for', (await pinBtn.getAttribute('aria-label')) === 'Notepad (3 windows)');
  await pinBtn.click(); await d.settle(150);
  check('clicking a pinned program with several windows lists them, the one in front marked', await d.menuRows() === 'n0.txt - Notepad|n1.txt - Notepad|n2.txt - Notepad*', await d.menuRows());
  const geo = await d.ev(() => { const m = document.querySelector('.menu.winlist').getBoundingClientRect(), b = document.querySelector('#tasks [data-pin="program:builtin:notepad"]').getBoundingClientRect(), s = getComputedStyle(document.querySelector('.menu.winlist')); return { above: m.bottom <= b.top, left: Math.abs(m.left - b.left) < 3, radius: s.borderRadius, inside: m.top >= 0 && m.right <= innerWidth, role: document.querySelector('.menu.winlist').getAttribute('role'), icons: document.querySelectorAll('.menu.winlist .mi .ico').length }; });
  check('the list sits above its button, with radius 10, as a menu, each row with the window\'s icon', geo.above && geo.left && geo.radius === '10px' && geo.inside && geo.role === 'menu' && geo.icons === 3, geo);
  check('the mark for the window in front is more than a tint', await d.ev(() => { const s = getComputedStyle(document.querySelector('.menu.winlist .mi[aria-current]')); return s.fontWeight >= 600 && s.boxShadow.includes('inset'); }));
  check('each row has a named Close button', await d.ev(() => [...document.querySelectorAll('.menu.winlist .wbtn')].map(b => b.getAttribute('aria-label')).join('|')) === 'Close n0.txt - Notepad|Close n1.txt - Notepad|Close n2.txt - Notepad');
  await page.locator('.menu.winlist .mi', { hasText: 'n0.txt' }).click(); await d.settle(150);
  check('clicking a row brings that window to the front and closes the list', await d.ev(() => PortDHost.wm.active.title) === 'n0.txt - Notepad' && await d.menuRows() === null);
  await pinBtn.click(); await d.settle(150);
  await page.locator('.menu.winlist .mrow', { hasText: 'n1.txt' }).locator('.wbtn').click(); await d.settle(200);
  check('a row\'s X closes that window, and the list follows', await d.titles() === 'n0.txt - Notepad|n2.txt - Notepad' && await d.menuRows() === 'n0.txt - Notepad*|n2.txt - Notepad', [await d.titles(), await d.menuRows()]);
  await page.locator('.menu.winlist .mrow', { hasText: 'n2.txt' }).locator('.wbtn').click(); await d.settle(200);
  check('below two windows the list goes away', await d.menuRows() === null && await d.titles() === 'n0.txt - Notepad');
  await d.ev(() => { PortDHost.launch('builtin:notepad', { path: 'P:\\User\\Documents\\n1.txt' }); PortDHost.launch('builtin:notepad', { path: 'P:\\User\\Documents\\n2.txt' }); }); await d.settle(200);
  await pinBtn.focus(); await page.keyboard.press('Enter'); await d.settle(150);
  check('Enter on the button opens the list with focus on the window in front', await d.focused() === 'row:n2.txt - Notepad', await d.focused());
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp');
  check('Up and Down move through it', await d.focused() === 'row:n0.txt - Notepad');
  await page.keyboard.press('ArrowUp');
  check('…wrapping round', await d.focused() === 'row:n2.txt - Notepad');
  await page.keyboard.press('Tab');
  check('Tab stays inside', await d.focused() === 'row:n0.txt - Notepad');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Delete'); await d.settle(200);
  check('Delete closes the window on that row; the list stays, with focus still in it', await d.titles() === 'n0.txt - Notepad|n2.txt - Notepad' && await d.menuRows() === 'n0.txt - Notepad|n2.txt - Notepad*' && /^row:/.test(await d.focused()), [await d.titles(), await d.menuRows(), await d.focused()]);
  await page.keyboard.press('Escape'); await d.settle();
  check('Esc closes the list and returns focus to the button', await d.menuRows() === null && await d.focused() === 'pin');
  await page.keyboard.press('Enter'); await d.settle(150); await page.keyboard.press('Home'); await page.keyboard.press('Enter'); await d.settle(150);
  check('Enter on a row chooses that window', await d.ev(() => PortDHost.wm.active.title) === 'n0.txt - Notepad' && await d.menuRows() === null && await d.focused() === 'window');
  await pinBtn.focus(); await page.keyboard.press('Enter'); await d.settle(150); await page.keyboard.press('Delete'); await d.settle(200);
  check('closing down to one window from the keyboard puts focus back on the button, not nowhere', await d.menuRows() === null && await d.titles().then(t => t.split('|').length) === 1 && await d.focused() === 'pin', await d.focused());
  await d.ev(() => { PortDHost.launch('builtin:notepad', { path: 'P:\\User\\Documents\\n1.txt' }); }); await d.settle(200);
  await page.mouse.move(640, 300); await pinBtn.hover(); await page.waitForTimeout(250);
  check('resting the pointer on the button: nothing yet after a quarter of a second', await d.menuRows() === null);
  await page.waitForTimeout(450);
  check('…and the list after half a second, without taking keyboard focus', (await d.menuRows() || '').split('|').length === 2 && !/^row:/.test(await d.focused()), [await d.menuRows(), await d.focused()]);
  await page.mouse.click(640, 300); await d.settle();
  check('clicking elsewhere closes it', await d.menuRows() === null);
  await page.locator('#tasks [data-pin="program:builtin:calc"]').hover(); await page.waitForTimeout(700);
  check('a pinned program with no windows shows no list', await d.menuRows() === null);
  await page.mouse.move(640, 300);
  /* at the right-hand end of a crowded taskbar */
  await d.ev(() => { const pins = [{ type: 'program', id: 'builtin:calc' }, { type: 'program', id: 'builtin:settings' }, { type: 'program', id: 'builtin:files' }, { type: 'program', id: 'todo' }, { type: 'path', path: 'P:\\User\\Documents' }, { type: 'path', path: 'P:\\User\\Pictures' }, { type: 'program', id: 'builtin:notepad' }]; PortDHost.vfs.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: pins })); });
  await page.setViewportSize({ width: 700, height: 500 }); await d.settle(300);
  await pinBtn.click(); await d.settle(150);
  check('at the end of a crowded taskbar on a small screen the list stays on screen', await d.ev(() => { const m = document.querySelector('.menu.winlist').getBoundingClientRect(); return m.left >= 0 && m.right <= innerWidth && m.top >= 0 && m.bottom <= innerHeight; }));
  await page.keyboard.press('Escape'); await page.setViewportSize({ width: 1280, height: 800 }); await d.settle(300);
  await d.ev(() => { PortDHost.vfs.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [] })); }); await d.closeAll();

  /* ------------------------------------------------------------------ */
  section('Text size (A02)');
  await d.settings('appearance');
  check('Appearance > Text and motion offers 100, 112, 125 and 150 %', await d.ev(() => [...document.querySelectorAll('.spane [data-size]')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join('|')) === '100 %*|112 %|125 %|150 %');
  const sizes = () => d.ev(() => ({ root: getComputedStyle(document.documentElement).fontSize, body: getComputedStyle(document.body).fontSize, tb: document.querySelector('#taskbar').offsetHeight, bar: document.querySelector('.win .tb').offsetHeight, icon: document.querySelector('.dicon').offsetWidth, glyph: document.querySelector('.dicon .ico').offsetWidth, cell: document.querySelectorAll('.dicon')[1].offsetTop - document.querySelectorAll('.dicon')[0].offsetTop, narrow: document.documentElement.classList.contains('narrow') }));
  const at100 = await sizes();
  check('at 100 %: 13 px text, 46 px taskbar, 36 px title bar, 96 × 100 grid', at100.body === '13px' && at100.tb === 46 && at100.bar === 36 && at100.icon === 88 && at100.cell === 100, at100);
  for (const [n, k] of [[112, 1.12], [125, 1.25], [150, 1.5]]) {
    await d.seg('size', String(n)); const s = await sizes();
    check(n + ' %: text, taskbar, title bars, icons and their spacing all scale together', s.root === 16 * k + 'px' && Math.abs(parseFloat(s.body) - 13 * k) < 0.01 && Math.abs(s.tb - 46 * k) <= 1 && Math.abs(s.bar - 36 * k) <= 1 && Math.abs(s.icon - 88 * k) <= 1 && Math.abs(s.glyph - 44 * k) <= 1 && Math.abs(s.cell - 100 * k) <= 1, s);
  }
  check('the choice is stored', JSON.parse(await d.read(CONFIG + '\\settings.json')).textSize === 150);
  await page.setViewportSize({ width: 900, height: 800 }); await d.settle(300);
  check('layout limits follow the text size: 900 px wide at 150 % is a narrow screen', (await sizes()).narrow && await d.ev(() => document.querySelector('.win').classList.contains('max')));
  await page.setViewportSize({ width: 1280, height: 800 }); await d.settle(300);
  check('…and 1280 px is not', !(await sizes()).narrow);
  await d.ev(() => { PortDHost.launch('todo'); }); await d.settle(300);
  const tf = await (await page.waitForSelector('.win.active iframe')).contentFrame(); await tf.waitForFunction(() => window.PortD);
  check('installed programs draw their own content and are not scaled', await tf.evaluate(() => getComputedStyle(document.body).fontSize) === '14px');
  await d.closeAll(); await saved(page); await reload(page); d = drive(page); await d.settle(200);
  check('150 % survives a reload', await d.ev(() => getComputedStyle(document.documentElement).fontSize) === '24px');
  await d.set({ textSize: 137 });
  check('a size PortD does not offer falls back to 100 %', await d.ev(() => getComputedStyle(document.documentElement).fontSize) === '16px');
  await d.set({ textSize: 100 });

  section('Motion (A03)');
  const moving = async () => { await d.ev(() => { PortDHost.launch('builtin:calc'); }); await page.waitForTimeout(20); const n = await d.ev(() => document.getAnimations().length); await d.closeAll(); return n; };
  check('by default a window opens with its short pop', await moving() > 0);
  await d.settings('appearance');
  await page.locator('.spane label', { hasText: 'Reduce motion' }).locator('input').check(); await d.settle(150); await d.closeAll();
  check('Reduce motion is stored', JSON.parse(await d.read(CONFIG + '\\settings.json')).reduceMotion === true);
  check('with Reduce motion on, nothing animates when a window opens', await moving() === 0);
  await page.locator('#icons').click({ button: 'right', position: { x: 600, y: 300 } }); await page.waitForTimeout(20);
  check('…or a menu', await d.ev(() => !!document.querySelector('.menu') && document.getAnimations().length === 0));
  await page.keyboard.press('Escape');
  await d.ev(() => { PortDHost.vfs.write('P:\\User\\Documents\\t.txt', 'x'); }); await d.ev(() => { PortDHost.vfs.remove('P:\\User\\Documents\\t.txt'); });
  await d.set({ reduceMotion: false });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check('when the system asks for reduced motion, nothing animates either, without the switch', await moving() === 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await ctx.close();

  /* ------------------------------------------------------------------ */
  section('Touch targets (A05)');
  {
    const tctx = await profile(newDir(), { touch: true }), tp = await tctx.open(file), t = drive(tp);
    await saved(tp);
    check('(the browser reports a coarse pointer)', await t.ev(() => matchMedia('(pointer:coarse)').matches));
    await t.ev(() => { PortDHost.vfs.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [{ type: 'program', id: 'builtin:calc' }] })); PortDHost.vfs.write('P:\\User\\Documents\\a.txt', 'x'); PortDHost.launch('builtin:calc'); PortDHost.launch('builtin:calc'); PortDHost.launch('builtin:files', { path: 'P:\\User\\Documents' }); PortDHost.launch('builtin:settings', { tab: 'appearance' }); }); await t.settle(300);
    const small = sel => t.ev(sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return { what: (e.getAttribute('aria-label') || e.textContent || e.className).slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 40 || x.h < 40), sel);
    const count = sel => t.ev(sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).length, sel);
    check('taskbar buttons are at least 40 × 40 px', (await small('#taskbar button')).length === 0 && await count('#taskbar button') >= 5, await small('#taskbar button'));
    check('window buttons are at least 40 × 40 px', (await small('.win .wbtn')).length === 0 && await count('.win .wbtn') === 12, await small('.win .wbtn'));
    check('buttons, tabs and segmented controls in windows are at least 40 px high', (await t.ev(() => [...document.querySelectorAll('.win :is(.btn,.sn,.seg button,.side button)')].filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 40).map(e => e.textContent))).length === 0);
    await tp.locator('#tasks [data-pin="program:builtin:calc"]').tap(); await t.settle(200);
    check('window-list rows and their Close buttons are at least 40 × 40 px', (await small('.menu.winlist .mi, .menu.winlist .wbtn')).length === 0 && await count('.menu.winlist .mi') === 2, await small('.menu.winlist .mi, .menu.winlist .wbtn'));
    await tp.keyboard.press('Escape');
    await tp.locator('#start').tap(); await t.settle(200);
    check('PortD menu rows and its buttons are at least 40 px high', (await t.ev(() => [...document.querySelectorAll('#startmenu :is(.smi,.btn)')].filter(e => e.getBoundingClientRect().height < 40).map(e => e.textContent))).length === 0 && await count('#startmenu .smi') >= 5);
    await tp.keyboard.press('Escape');
    await t.ev(() => { document.querySelector('#icons').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 300 })); }); await t.settle(150);
    check('menu items are at least 40 px high', (await t.ev(() => [...document.querySelectorAll('.menu .mi')].filter(e => e.getBoundingClientRect().height < 40).map(e => e.textContent))).length === 0 && await count('.menu .mi') >= 4);
    await tp.keyboard.press('Escape');
    await t.ev(() => { PortDHost.launch('builtin:settings', { tab: 'data' }); }); await t.settle(150);
    await tp.locator('.spane .btn', { hasText: /^Reset…$/ }).tap(); await t.settle(200);
    check('dialog buttons are at least 40 px high', (await small('.dlg .btn')).filter(x => x.h < 40).length === 0 && await count('.dlg .btn') === 3, await small('.dlg .btn'));
    check('no console errors', tctx.errors.length === 0, tctx.errors);
    await tctx.close();
  }
};
