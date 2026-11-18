/* PortD suite, Phase 6: the measurements (A06). A script run in the page measures every piece of visible text against what
   is behind it, the edge of every control against its surroundings, the focus ring on every stop, and whether everything
   fits on screen. It is run over a set of scenes that between them put every window, menu, dialog and notice on screen. */
module.exports = async ({ check, section, profile, newDir, file, saved }) => {
  /* runs in the page (and in a program's frame). o: { text: ratio for text, edge: ratio for control edges } */
  const MEASURE = o => {
    const num = c => { const m = String(c).match(/-?[\d.]+/g).map(Number); return { c: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
    const lum = c => { const l = c.map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const over = (top, under) => top.c.map((v, i) => v * top.a + under[i] * (1 - top.a));
    const shown = el => { if (!el.getClientRects().length) return false; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) return false; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.visibility === 'hidden' || +s.opacity < 0.5) return false; if (n.inert) return false; } return true; };
    /* The colours that can be behind an element: the stack of its ancestors' fills down to the first opaque one. Where the
       stack ends on a picture or gradient, both white and black are tried, and the worse result counts. */
    const behind = el => {
      const layers = []; let open = true;
      for (let n = el; n && n.nodeType === 1 && open; n = n.parentElement) {
        const s = getComputedStyle(n), b = num(s.backgroundColor);
        if (s.backgroundImage !== 'none' && n !== el) break;
        if (b.a > 0) { layers.push(b); if (b.a === 1) open = false; }
      }
      return (open ? [[255, 255, 255], [0, 0, 0]] : [null]).map(base => layers.reduceRight((under, l) => under ? over(l, under) : l.c, base));
    };
    const worst = (fg, backs) => Math.min(...backs.map(b => ratio(fg.a < 1 ? over(fg, b) : fg.c, b)));
    const name = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')) + ' "' + (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 28) + '"';
    const off = el => !!el.closest(':disabled,[aria-disabled="true"]');
    const out = { text: [], edge: [], n: { text: 0, edge: 0 } }, seen = new Set();
    /* text */
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const el = t.parentElement;
      if (!t.nodeValue.trim() || seen.has(el) || el.closest('svg,script,style,noscript,option,.sr,iframe,.ico') || !shown(el) || off(el)) continue;
      seen.add(el);
      const s = getComputedStyle(el), size = parseFloat(s.fontSize), big = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700), r = worst(num(s.color), behind(el));
      out.n.text++;
      if (r < (big ? Math.min(o.text, 3) : o.text) - 0.005) out.text.push(name(el) + ' ' + r.toFixed(2));
    }
    for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=color]):not([type=file]),textarea,select')) {
      if (!shown(el) || off(el)) continue;
      const r = worst(num(getComputedStyle(el).color), behind(el)); out.n.text++;
      if (r < o.text - 0.005) out.text.push(name(el) + ' (its value) ' + r.toFixed(2));
    }
    /* the edge of each control and surface: its border, or failing that its fill, against what is around it */
    for (const el of document.querySelectorAll('.btn,.field,select,textarea:not(.pad),.seg,.win,.menu,.dlg,#startmenu,.notice,.snappanel,.sw,.gbtn.on,.keys button')) {
      if (!shown(el) || off(el) || !el.parentElement) continue;
      const s = getComputedStyle(el), floats = o.edge > 3 && behind(el.parentElement).length > 1, around = floats ? behind(el) : behind(el.parentElement), bw = parseFloat(s.borderTopWidth), bc = num(s.borderTopColor), fill = num(s.backgroundColor);
      const sh = /(rgba?\([^)]+\))\s+0px\s+0px\s+0px\s+[1-9]/.exec(s.boxShadow), ring = sh ? num(sh[1]) : null;
      const r = Math.max(bw >= 1 && bc.a > 0.5 ? worst(bc, around) : 0, fill.a > 0.5 && !floats && s.backgroundImage === 'none' ? Math.min(...around.map(b => ratio(over(fill, b), b))) : 0, ring ? worst(ring, around) : 0);
      out.n.edge++;
      if (r < o.edge - 0.005) out.edge.push(name(el) + ' ' + r.toFixed(2));
    }
    return out;
  };
  /* the focus ring on every stop: at least 2 px wide and 3:1 against what it is drawn on. Run after a key press, so rings show. */
  const RINGS = () => {
    const num = c => { const m = String(c).match(/-?[\d.]+/g).map(Number); return { c: m.slice(0, 3), a: m.length > 3 ? m[3] : 1 }; };
    const lum = c => { const l = c.map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const over = (top, under) => top.c.map((v, i) => v * top.a + under[i] * (1 - top.a));
    const behind = el => { const layers = []; let open = true; for (let n = el; n && n.nodeType === 1 && open; n = n.parentElement) { const s = getComputedStyle(n), b = num(s.backgroundColor); if (s.backgroundImage !== 'none' && n !== el) break; if (b.a > 0) { layers.push(b); if (b.a === 1) open = false; } } return (open ? [[255, 255, 255], [0, 0, 0]] : [null]).map(base => layers.reduceRight((under, l) => under ? over(l, under) : l.c, base)); };
    const was = document.activeElement, bad = []; let n = 0;
    const top = document.querySelector('.ov:last-of-type') || document.querySelector('.menu') || document.querySelector('#startmenu.open') || document.body;
    for (const el of top.querySelectorAll('button,input,select,textarea,[tabindex="0"]')) {
      if (!el.getClientRects().length || el.disabled || el.closest('[inert]') || el.tabIndex < -1 || el.type === 'file') continue;
      el.focus({ preventScroll: true });
      if (document.activeElement !== el) continue;
      const s = getComputedStyle(el), w = s.outlineStyle === 'none' ? 0 : parseFloat(s.outlineWidth), on = parseFloat(s.outlineOffset) < 0 ? behind(el) : behind(el.parentElement), halo = /(rgba?\([^)]+\))\s+0px\s+0px\s+0px\s+[2-9]/.exec(s.boxShadow);
      /* a ring may be double (a light line with a dark halo): then either part may carry it against a given backdrop */
      const r = w ? Math.min(...on.map(b => Math.max(ratio(num(s.outlineColor).c, b), halo ? ratio(over(num(halo[1]), b), b) : 0))) : 0;
      n++;
      if (w < 2 || r < 3 - 0.005) bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/).join('.')) + ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24) + '" ' + w + 'px ' + r.toFixed(2));
    }
    if (was && was.focus) was.focus({ preventScroll: true });
    return { n, bad };
  };
  /* fit: surfaces inside the screen, no label cut off, dialog buttons reachable, desktop icons not overlapping */
  const FIT = () => {
    const bad = [], W = innerWidth, H = innerHeight, box = el => el.getBoundingClientRect(), nm = el => (el.id ? '#' + el.id : '.' + String(el.className).trim().split(/\s+/).join('.')) + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
    for (const el of document.querySelectorAll('.win:not(.min),.menu,.dlg,#startmenu.open,.toast,.notice,.tip,#taskbar,#robar,.snappanel')) {
      if (!el.getClientRects().length) continue;
      const r = box(el);
      if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) bad.push('off screen: ' + nm(el) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join());
    }
    for (const el of document.querySelectorAll('.btn,.sn,.seg button,.mi,.tbtn,#start,.wbtn,.side button,.keys button,.smi')) {
      if (!el.getClientRects().length || el.closest('[inert]')) continue;
      if (el.scrollWidth > el.clientWidth + 1 && !el.querySelector('.smt')) bad.push('label cut off: ' + nm(el) + ' ' + el.scrollWidth + '>' + el.clientWidth);
      const host = el.closest('.win,.menu,.dlg,#startmenu,#taskbar'), r = box(el), hr = host ? box(host) : null, sc = el.closest('.spane,.lst,.clist,.checklist,.dlg,.snav,.side,.blist');
      if (hr && !sc && (r.left < hr.left - 1 || r.right > hr.right + 1)) bad.push('outside its window: ' + nm(el));
    }
    for (const d of document.querySelectorAll('.dlg')) { const r = box(d); for (const b of d.querySelectorAll('.acts .btn')) { const br = box(b); if (d.scrollHeight <= d.clientHeight + 1 && (br.bottom > r.bottom + 1 || br.right > r.right + 1 || br.left < r.left - 1)) bad.push('dialog button out of reach: ' + nm(b)); } }
    for (const w of document.querySelectorAll('.win:not(.min)')) if (w.getClientRects().length && w.querySelectorAll('.tb .wbtn').length !== 3) bad.push('window buttons missing: ' + nm(w));
    const ic = [...document.querySelectorAll('.dicon')].map(box);
    for (let i = 0; i < ic.length; i++) for (let j = i + 1; j < ic.length; j++) if (ic[i].left < ic[j].right - 1 && ic[j].left < ic[i].right - 1 && ic[i].top < ic[j].bottom - 1 && ic[j].top < ic[i].bottom - 1) bad.push('desktop icons overlap: ' + i + ' and ' + j);
    return bad;
  };

  const ctx = await profile(newDir());
  let page = await ctx.open(file);
  await saved(page);
  const ev = (fn, arg) => page.evaluate(fn, arg), settle = (ms = 110) => page.waitForTimeout(ms);
  const closeAll = async () => { for (let i = 0; i < 4 && await ev(() => !!document.querySelector('.ov')); i++) { await page.keyboard.press('Escape'); await settle(60); } await ev(async () => { for (const w of PortDHost.wm.wins.slice()) await w.close(true); document.querySelector('#notices').replaceChildren(); document.querySelector('#toasts').replaceChildren(); }); await page.keyboard.press('Escape'); await page.mouse.move(640, 5); await settle(60); };
  const set = patch => ev(patch => { const v = PortDHost.vfs, p = 'P:\\User\\Config\\settings.json', s = JSON.parse(v.read(p)); for (const k of Object.keys(patch)) s[k] = patch[k] && typeof patch[k] === 'object' ? Object.assign({}, s[k], patch[k]) : patch[k]; v.write(p, JSON.stringify(s)); }, patch).then(() => settle(120));
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await ev(PNG => {
    const v = PortDHost.vfs, D = 'P:\\User\\Documents';
    v.mkdir(D + '\\Work'); v.write(D + '\\notes.txt', 'alpha beta\nneedle'); v.write(D + '\\Report.md', '# Report'); v.write(D + '\\pic.png', 'data:image/png;base64,' + PNG, { enc: 'dataurl' }); v.write(D + '\\blob.bin', 'data:application/octet-stream;base64,AAAA', { enc: 'dataurl' });
    v.write(D + '\\notes.portdapp', JSON.stringify({ format: 'portd-app', formatVersion: 3, id: 'notes', name: 'Notes', version: '1.2.0', description: 'Markdown notes.', icon: 'emoji:📝', fileTypes: [{ ext: '.md', name: 'Markdown note' }, { ext: '.lnk', name: 'x' }], files: { 'index.html': { enc: 'text', d: '<p>x' } } }));
    v.write('P:\\User\\Config\\taskbar.json', JSON.stringify({ version: 1, pinned: [{ type: 'program', id: 'builtin:calc' }, { type: 'program', id: 'gone-app' }, { type: 'path', path: D }, { type: 'url', url: 'https://example.invalid/', name: 'Example' }] }));
    v.write('P:\\User\\Config\\associations.json', JSON.stringify({ version: 1, assoc: { '.csv': 'gone-app', '.log': 'builtin:notepad' } }));
    v.write('P:\\User\\Desktop\\Broken.lnk', JSON.stringify({ type: 'program', target: 'gone-app' }));
    v.write('P:\\User\\Config\\profile.json', JSON.stringify({ version: 1, displayName: 'Lily Example' }));
  }, PNG);
  const launch = (id, args) => ev(([id, args]) => { PortDHost.launch(id, args); }, [id, args]).then(() => settle(160));
  const row = name => page.locator('.win.active .row').filter({ has: page.locator('.t', { hasText: new RegExp('^' + name.replace(/[.]/g, '\\.') + '$') }) });
  /* each scene puts something on screen; the measurements are then taken, and everything is closed again */
  const SCENES = {
    'the desktop with an icon selected, Files with a selection, and the PortD menu': async () => { await page.locator('.dicon').nth(2).click(); await launch('builtin:files', { path: 'P:\\User\\Documents' }); await row('notes.txt').click(); await page.locator('#start').click(); await settle(); await page.keyboard.type('no'); await settle(); },
    'Files searching, with the filter bar': async () => { await launch('builtin:files', { path: 'P:\\User', query: 'e' }); await settle(250); const f = page.locator('.win.active button', { hasText: /^Filters/ }); if (await f.count()) await f.first().click(); await settle(); },
    'Files in the Recycle Bin and in P:\\OS': async () => { await ev(() => { PortDHost.vfs.write('P:\\User\\Documents\\gone.txt', 'x'); }); await launch('builtin:files', { path: 'P:\\User\\Documents' }); await row('gone.txt').click(); await page.keyboard.press('Delete'); await settle(200); await launch('builtin:files', { path: 'P:\\User\\Config\\Recycle Bin' }); await launch('builtin:files', { path: 'P:\\OS' }); },
    'Notepad with unsaved text, the Calculator and the Image Viewer': async () => { await launch('builtin:notepad', { path: 'P:\\User\\Documents\\notes.txt' }); await page.locator('.win.active textarea').pressSequentially('x'); await launch('builtin:calc'); await page.keyboard.type('12+3='); await launch('builtin:viewer', { path: 'P:\\User\\Documents\\pic.png' }); },
    'To-Do and two more Calculators, with the window list open': async () => { await launch('todo'); await launch('builtin:calc'); await launch('builtin:calc'); await page.locator('#tasks [data-pin="program:builtin:calc"]').focus(); await page.keyboard.press('Enter'); await settle(); },
    'an item menu with its Open with submenu': async () => { await launch('builtin:files', { path: 'P:\\User\\Documents' }); await row('Report.md').click({ button: 'right' }); await page.locator('.menu .mi', { hasText: /^Open with$/ }).hover(); await settle(300); },
    'a folder menu with New, and a toast with Undo': async () => { await launch('builtin:files', { path: 'P:\\User\\Documents' }); await ev(() => { PortDHost.vfs.write('P:\\User\\Documents\\del.txt', 'x'); }); await settle(); await row('del.txt').click(); await page.keyboard.press('Delete'); await settle(200); await ev(() => { document.querySelector('#icons').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: innerWidth - 30, clientY: 40 })); }); await settle(); await page.locator('.menu .mi', { hasText: /^New$/ }).hover(); await settle(300); },
    'the window menu and the snap panel': async () => { await launch('builtin:calc'); await page.locator('.win.active .wbtn.mx').hover(); await settle(750); },
    'Settings > Appearance': async () => { await launch('builtin:settings', { tab: 'appearance' }); },
    'Settings > Appearance with a custom taskbar colour': async () => { await set({ taskbar: { tint: 'custom' } }); await launch('builtin:settings', { tab: 'appearance' }); await page.locator('.spane').evaluate(e => e.scrollTo(0, 9999)); await settle(); },
    'Settings > Profile': async () => { await launch('builtin:settings', { tab: 'profile' }); },
    'Settings > Data': async () => { await launch('builtin:settings', { tab: 'data' }); },
    'Settings > Data, scrolled to the end': async () => { await launch('builtin:settings', { tab: 'data' }); await page.locator('.spane').evaluate(e => e.scrollTo(0, 9999)); await settle(); },
    'Settings > Programs with Default apps': async () => { await launch('builtin:settings', { tab: 'programs' }); await page.locator('.spane').evaluate(e => e.scrollTo(0, 9999)); await settle(); },
    'Settings > Developer': async () => { await launch('builtin:settings', { tab: 'developer' }); },
    'Settings > About': async () => { await launch('builtin:settings', { tab: 'about' }); },
    'a confirmation with a danger button (delete permanently)': async () => { await launch('builtin:files', { path: 'P:\\User\\Documents' }); await row('blob.bin').click(); await page.keyboard.press('Shift+Delete'); await settle(200); },
    'a form with an error (rename to a taken name)': async () => { await launch('builtin:files', { path: 'P:\\User\\Documents' }); await row('notes.txt').click(); await page.keyboard.press('F2'); await settle(200); await page.locator('.dlg input.field').fill('Report.md'); await page.keyboard.press('Enter'); await settle(); },
    'the Save dialog': async () => { await launch('builtin:notepad'); await page.keyboard.press('Control+s'); await settle(250); },
    'Properties and the icon picker': async () => { await ev(() => { PortDHost.vfs.setIcon('P:\\User\\Documents\\notes.txt', 'glyph:calc'); }); await launch('builtin:files', { path: 'P:\\User\\Documents' }); await row('notes.txt').click({ button: 'right' }); await page.locator('.menu .mi', { hasText: /^Properties$/ }).click(); await settle(200); await page.locator('.dlg .btn', { hasText: 'Change icon' }).click(); await settle(200); },
    'the install confirmation': async () => { await ev(() => { PortDHost.openPath('P:\\User\\Documents\\notes.portdapp'); }); await settle(250); },
    'the file-types notice, the backup reminder and Choose another program': async () => { await ev(() => { PortDHost.openPath('P:\\User\\Documents\\notes.portdapp'); }); await settle(250); await page.locator('.dlg .btn', { hasText: /^(Install|Reinstall)$/ }).click(); await settle(250); await ev(() => { const s = JSON.parse(PortDHost.vfs.read('P:\\User\\Config\\settings.json')); s.backup.lastBackupAt = Date.now() - 20 * 86400000; PortDHost.vfs.write('P:\\User\\Config\\settings.json', JSON.stringify(s)); }); await settle(200); await page.locator('#tray [data-tray=backup]').click(); await settle(200); await launch('builtin:files', { path: 'P:\\User\\Documents' }); await row('Report.md').click({ button: 'right' }); await page.locator('.menu .mi', { hasText: /^Open with$/ }).click(); await settle(200); await page.locator('.menu .mi', { hasText: /^Choose another program…$/ }).click(); await settle(250); },
    'Check my data with problems': async () => { await launch('builtin:settings', { tab: 'data' }); await page.locator('.spane .btn', { hasText: /^Check my data$/ }).click(); await settle(250); },
    'the Reset confirmation': async () => { await launch('builtin:settings', { tab: 'data' }); await page.locator('.spane .btn', { hasText: /^Reset…$/ }).click(); await settle(250); },
    'the web-page question and an error message': async () => { await ev(() => { PortDHost.vfs.write('P:\\User\\Documents\\page.html', '<title>P</title>'); PortDHost.openPath('P:\\User\\Documents\\page.html'); }); await settle(250); },
    'the name question': async () => { await launch('builtin:settings', { tab: 'profile' }); await ev(() => { document.querySelector('.spane input').value = 'x'.repeat(41); }); await page.locator('.spane .btn', { hasText: /^Save$/ }).click(); await settle(250); }
  };
  const names = Object.keys(SCENES);
  /* runs fn(page) on every scene and returns { scene: result } */
  const tour = async fn => { const out = {}; for (const n of names) { await closeAll(); await SCENES[n](); out[n] = await fn(n); } await closeAll(); await set({ taskbar: { tint: 'standard' }, backup: { lastBackupAt: Date.now() } }); return out; };
  const report = (label, res, pick) => { const bad = []; let n = 0; for (const s of Object.keys(res)) { const r = pick(res[s]); n += r.n; for (const b of r.bad) bad.push(s + ': ' + b); } const kinds = [...new Set(bad.map(b => b.replace(/^[^:]*: /, '').replace(/ [\d.]+$/, '')))]; check(label + ' (' + n + ' measured over ' + Object.keys(res).length + ' screens)', bad.length === 0 && n > 0, bad.length + ' failures, ' + kinds.length + ' kinds: ' + kinds.slice(0, 40).join(' ;; ') + ' ;; e.g. ' + bad[0]); };
  const measure = o => async () => { const m = await ev(MEASURE, o); for (const f of page.frames()) if (f !== page.mainFrame()) { const x = await f.evaluate(MEASURE, o).catch(() => null); if (x) { m.text.push(...x.text.map(t => 'in the program: ' + t)); m.n.text += x.n.text; } } return m; };

  /* ------------------------------------------------------------------ */
  section('Contrast, measured over every screen (A06)');
  for (const theme of ['light', 'dark']) {
    await set({ theme, accent: '#2f7de1' });
    const res = await tour(measure({ text: 4.5, edge: 3 }));
    report(theme + ' theme: all text is 4.5:1 or better against what is behind it', res, r => ({ n: r.n.text, bad: r.text }));
    report(theme + ' theme: the edge of every button, field, window, menu and dialog is 3:1 or better against its surroundings', res, r => ({ n: r.n.edge, bad: r.edge }));
  }
  const SOME = ['the desktop with an icon selected, Files with a selection, and the PortD menu', 'To-Do and two more Calculators, with the window list open', 'an item menu with its Open with submenu', 'Settings > Appearance', 'Settings > Data', 'a confirmation with a danger button (delete permanently)', 'the file-types notice, the backup reminder and Choose another program'];
  const tourSome = async fn => { const out = {}; for (const n of SOME) { await closeAll(); await SCENES[n](); out[n] = await fn(n); } await closeAll(); await set({ backup: { lastBackupAt: Date.now() } }); return out; };
  for (const theme of ['light', 'dark']) for (const accent of ['#f4f4f0', '#101418', '#ffd400', '#d81b60', '#00c853']) {
    await set({ theme, accent });
    const res = await tourSome(measure({ text: 4.5, edge: 3 }));
    report(theme + ' theme, accent ' + accent + ': text 4.5:1', res, r => ({ n: r.n.text, bad: r.text }));
    report(theme + ' theme, accent ' + accent + ': control edges 3:1', res, r => ({ n: r.n.edge, bad: r.edge }));
  }
  await set({ accent: '#2f7de1' });
  for (const theme of ['light', 'dark']) for (const tint of ['accent', 'background', '#ffffff', '#000000', '#ffd400', '#7a7f85']) {
    await set({ theme, taskbar: tint[0] === '#' ? { tint: 'custom', customColor: tint } : { tint } });
    await closeAll(); await SCENES['To-Do and two more Calculators, with the window list open']();
    const m = await ev(MEASURE, { text: 4.5, edge: 3 }), bar = m.text.filter(t => /^(#start|#clock|button\.task|button\.tbtn|span\.tl|b |div\.dt)/.test(t) || /task|tbtn|clock/.test(t));
    check(theme + ' theme, taskbar ' + tint + ': everything on the taskbar is 4.5:1', m.text.length === 0, m.text.slice(0, 8).concat(bar.slice(0, 2)));
  }
  await set({ theme: 'light', taskbar: { tint: 'standard', customColor: '#2b3440' } }); await closeAll();

  section('Focus rings, measured on every stop (A06)');
  for (const [theme, accent, tint] of [['light', '#2f7de1', 'standard'], ['dark', '#2f7de1', 'standard'], ['light', '#ffd400', 'accent'], ['dark', '#f4f4f0', 'background']]) {
    await set({ theme, accent, taskbar: { tint } });
    await page.keyboard.press('Tab');
    const res = await tour(async () => { await page.keyboard.press('Shift'); return ev(RINGS); });
    report(theme + ' theme, accent ' + accent + ', taskbar ' + tint + ': every stop shows a ring at least 2 px wide and 3:1 against what it is drawn on', res, r => r);
  }
  await set({ theme: 'light', accent: '#2f7de1', taskbar: { tint: 'standard' } });
  /* walking with Tab: the ring is really there after a real key press, no stop repeats, and the cycle comes round */
  await closeAll(); await launch('builtin:files', { path: 'P:\\User\\Documents' }); await launch('builtin:calc');
  const walk = async key => { const seenStops = []; for (let i = 0; seenStops.length < 70 && i < 90; i++) { await page.keyboard.press(key); if (await ev(() => document.activeElement === document.body)) continue;      /* the browser's own stop between the end of the page and its start */
    seenStops.push(await ev(() => { const a = document.activeElement, s = getComputedStyle(a); return (a.id || a.className || a.tagName) + '|' + (a.getAttribute('aria-label') || a.textContent || '').slice(0, 20) + '|' + (a.closest('.win') ? a.closest('.win').id || [...document.querySelectorAll('.win')].indexOf(a.closest('.win')) : '') + '|' + (a.matches(':focus-visible') && s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 ? 'ring' : 'NO RING'); })); } return seenStops; };
  for (const key of ['Tab', 'Shift+Tab']) {
    const stops = await walk(key), cycle = stops.indexOf(stops[0], 1), one = stops.slice(0, cycle);
    check('70 presses of ' + key + ': every stop shows its ring, none repeats within a round of ' + cycle + ', and the round comes back', cycle > 10 && new Set(one).size === one.length && stops.every(s => /\|ring$/.test(s)), stops.filter(s => !/\|ring$/.test(s)).slice(0, 5).concat(['cycle ' + cycle]));
  }

  section('More contrast, and forced colours (A03)');
  await page.emulateMedia({ contrast: 'more' });
  check('(the browser reports prefers-contrast: more)', await ev(() => matchMedia('(prefers-contrast: more)').matches));
  for (const theme of ['light', 'dark']) {
    await set({ theme });
    const res = await tour(measure({ text: 7, edge: 4.5 }));
    report(theme + ' theme with more contrast asked for: text is 7:1 or better', res, r => ({ n: r.n.text, bad: r.text.filter(t => !/^in the program/.test(t)) }));
    report(theme + ' theme with more contrast asked for: control edges are 4.5:1 or better', res, r => ({ n: r.n.edge, bad: r.edge }));
  }
  await page.emulateMedia({ contrast: 'no-preference', forcedColors: 'active' }); await set({ theme: 'light' });
  check('(the browser reports forced colours)', await ev(() => matchMedia('(forced-colors: active)').matches));
  {
    const res = await tour(async () => ev(() => {
      const bad = []; let n = 0;
      const shown = el => el.getClientRects().length && !el.closest('[inert]');
      for (const el of document.querySelectorAll('.win,.menu,.dlg,#startmenu.open,.toast,.notice,#taskbar,.btn,.field,select')) { if (!shown(el)) continue; const s = getComputedStyle(el); n++; if (!(parseFloat(s.borderTopWidth) >= 1 && s.borderTopStyle !== 'none') && !(parseFloat(s.outlineWidth) >= 1 && s.outlineStyle !== 'none')) bad.push('no border: ' + (el.id || el.className) + ' "' + el.textContent.trim().slice(0, 20) + '"'); }
      for (const el of document.querySelectorAll('.row.sel,.dicon.sel,.sn.on,.seg button.on,.task.on,.mi[aria-current]')) { if (!shown(el)) continue; const s = getComputedStyle(el), p = getComputedStyle(el.parentElement); n++; if (s.backgroundColor === p.backgroundColor && s.outlineStyle === 'none' && !/inset/.test(s.boxShadow) && s.borderTopColor === p.borderTopColor) bad.push('selection not shown: ' + el.className); }
      return { n, bad };
    }));
    report('with forced colours every surface and control has a border or outline, and selection is still shown', res, r => r);
    const txt = await tour(measure({ text: 4.5, edge: 0 }));
    report('with forced colours all text is readable against its background', txt, r => ({ n: r.n.text, bad: r.text.filter(t => !/^in the program/.test(t)) }));
  }
  await page.emulateMedia({ forcedColors: 'none' });

  section('Fit at 150 % text size (A06)');
  await set({ textSize: 150 });
  for (const [w, hgt] of [[640, 720], [1280, 800], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: hgt }); await settle(300);
    const res = await tour(async () => ({ n: 1, bad: await ev(FIT) }));
    report('150 % at ' + w + ' × ' + hgt + ': everything is inside the screen, no label is cut off, dialog buttons are reachable, icons do not overlap', res, r => r);
  }
  await set({ textSize: 100 });
  for (const [w, hgt] of [[640, 480], [1024, 600]]) {
    await page.setViewportSize({ width: w, height: hgt }); await settle(300);
    const res = await tour(async () => ({ n: 1, bad: await ev(FIT) }));
    report('100 % at ' + w + ' × ' + hgt + ': the same', res, r => r);
  }
  await page.setViewportSize({ width: 1280, height: 800 }); await settle(300);
  check('no console errors in the whole tour', ctx.errors.filter(e => !/example\.invalid/.test(e)).length === 0, ctx.errors.slice(0, 5));
  await ctx.close();

  /* the read-only bar lives in a second tab */
  section('The read-only bar (A06)');
  {
    const c2 = await profile(newDir()), one = await c2.open(file); await saved(one);
    const two = await c2.open(file); await two.waitForTimeout(400);
    for (const theme of ['light', 'dark']) {
      await one.evaluate(theme => { const v = PortDHost.vfs, p = 'P:\\User\\Config\\settings.json', s = JSON.parse(v.read(p)); s.theme = theme; v.write(p, JSON.stringify(s)); }, theme); await saved(one); await two.reload(); await two.waitForFunction(() => window.PortDHost); await two.waitForTimeout(300);
      const m = await two.evaluate(MEASURE, { text: 4.5, edge: 3 });
      check(theme + ' theme: the read-only bar and its Take over button are readable (' + m.n.text + ' texts)', await two.evaluate(() => !!document.querySelector('#robar')) && m.text.length === 0 && m.edge.length === 0, m.text.concat(m.edge));
      await two.keyboard.press('Tab');
      const r = await two.evaluate(RINGS);
      check(theme + ' theme: focus rings in a read-only tab, the bar\'s button included (' + r.n + ' stops)', r.bad.length === 0 && r.n >= 4, r.bad);
    }
    await c2.close();
  }
};
