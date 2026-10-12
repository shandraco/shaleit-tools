(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var status = $('status'), listEl = $('files');
  if (typeof PDFLib === 'undefined') {
    status.textContent = 'The PDF merger could not load. Refresh the page and try again.';
    status.className = 'status err';
    return;
  }
  var items = [], nextId = 1, removed = null, undoTimer = null, busy = false;

  function say(msg, cls) { status.textContent = msg; status.className = 'status' + (cls ? ' ' + cls : ''); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function size(b) {
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  // Returns sorted zero-based page indices, or {error}.
  function parseRange(text, total) {
    var out = [], parts = text.split(',');
    var tip = 'This file has ' + plural(total, 'page') + '. Try 1-' + total + '.';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].replace(/\s+/g, '');
      if (!p) continue;
      var m = /^(\d+)(?:[-–](\d+))?$/.exec(p);
      if (!m) return { error: tip };
      var a = +m[1], b = m[2] ? +m[2] : a;
      if (a < 1 || b < a || b > total) return { error: tip };
      for (var n = a; n <= b; n++) out.push(n - 1);
    }
    if (!out.length) return { error: tip };
    return { pages: out };
  }

  function rangeFor(it) {
    if (!it.only) return { pages: null };
    var t = it.range.trim();
    if (!t) return { error: 'Type the pages you want, like 1-3, 5. Or turn off "Only some pages".' };
    return parseRange(t, it.pages);
  }

  async function addFile(file) {
    var id = nextId++;
    var it = { id: id, name: file.name, size: file.size, pages: 0, bytes: null, only: false, range: '', error: '' };
    try {
      var buf = await file.arrayBuffer();
      var u8 = new Uint8Array(buf);
      var head = String.fromCharCode.apply(null, u8.subarray(0, Math.min(1024, u8.length)));
      if (head.indexOf('%PDF-') === -1) {
        it.error = 'This is not a PDF, so it will be skipped. Choose a file that ends in .pdf.';
      } else {
        try {
          var doc = await PDFLib.PDFDocument.load(u8, { ignoreEncryption: false });
          it.pages = doc.getPageCount();
          it.bytes = u8;
        } catch (e) {
          var msg = String((e && (e.name + ' ' + e.message)) || '');
          it.error = /encrypt/i.test(msg)
            ? 'This PDF is locked with a password. Open it, save a copy without the password, then add it again.'
            : 'This PDF looks damaged and could not be read. Try opening and re-saving it, then add it again.';
        }
      }
    } catch (e) {
      it.error = 'This file could not be read. Try adding it again.';
    }
    items.push(it);
  }

  async function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    if (!files.length) return;
    say('Reading ' + plural(files.length, 'file') + '...');
    for (var i = 0; i < files.length; i++) await addFile(files[i]);
    var bad = items.filter(function (x) { return x.error; }).length;
    say(bad ? 'Added. ' + plural(bad, 'file') + ' cannot be used. See the red message' + (bad === 1 ? '' : 's') + ' below.' : 'Added ' + plural(files.length, 'file') + '.', bad ? 'err' : '');
    render();
  }

  function usable() { return items.filter(function (x) { return !x.error; }); }

  function updateGo() {
    var u = usable(), hint = $('go-hint'), go = $('go');
    var anyRange = u.some(function (x) { return x.only; });
    var ok = !busy && (u.length >= 2 || (u.length === 1 && anyRange));
    go.disabled = !ok;
    go.textContent = (u.length === 1 && anyRange) ? 'Extract pages and download' : 'Merge and download';
    if (u.length === 0) hint.textContent = 'Add at least two PDFs to get started.';
    else if (u.length === 1 && !anyRange) hint.textContent = 'Add one more PDF. Or choose "Only some pages" to pull pages out of this one.';
    else hint.textContent = 'Ready. Your new file downloads straight to your device.';
  }

  function btn(label, cls, fn, disabled) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label;
    if (disabled) b.disabled = true;
    b.addEventListener('click', fn);
    return b;
  }

  function move(id, d) {
    var i = items.findIndex(function (x) { return x.id === id; }), j = i + d;
    if (j < 0 || j >= items.length) return;
    var t = items[i]; items[i] = items[j]; items[j] = t;
    render();
    var li = listEl.querySelector('[data-id="' + id + '"]');
    var want = li && li.querySelector(d < 0 ? '.up' : '.down');
    if (want && !want.disabled) want.focus(); else if (li) li.querySelector('.fbtns button:not([disabled])').focus();
    say('Moved ' + items[j].name + ' to position ' + (j + 1) + ' of ' + items.length + '.');
  }

  function remove(id) {
    var i = items.findIndex(function (x) { return x.id === id; });
    if (i < 0) return;
    removed = { item: items[i], index: i };
    items.splice(i, 1);
    $('undo-msg').textContent = 'Removed ' + removed.item.name + '.';
    $('undo').hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(function () { $('undo').hidden = true; removed = null; }, 8000);
    render();
    $('pick').focus();
  }

  $('undo-btn').addEventListener('click', function () {
    if (!removed) return;
    items.splice(Math.min(removed.index, items.length), 0, removed.item);
    say('Put back ' + removed.item.name + '.');
    removed = null; clearTimeout(undoTimer); $('undo').hidden = true;
    render();
  });

  function render() {
    listEl.textContent = '';
    items.forEach(function (it, i) {
      var li = document.createElement('li');
      li.dataset.id = it.id;
      if (it.error) li.className = 'bad';
      var n = document.createElement('p'); n.className = 'fname'; n.textContent = (i + 1) + '. ' + it.name;
      var m = document.createElement('p'); m.className = 'fmeta';
      m.textContent = it.error ? size(it.size) : plural(it.pages, 'page') + ', ' + size(it.size);
      li.appendChild(n); li.appendChild(m);
      if (it.error) {
        var e = document.createElement('p'); e.className = 'ferr'; e.textContent = it.error; li.appendChild(e);
      } else {
        var lab = document.createElement('label'); lab.className = 'check';
        var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = it.only;
        cb.addEventListener('change', function () { it.only = cb.checked; render(); var x = listEl.querySelector('[data-id="' + it.id + '"] input[type=text]'); if (x) x.focus(); });
        lab.appendChild(cb); lab.appendChild(document.createTextNode('Only some pages'));
        li.appendChild(lab);
        if (it.only) {
          var r = document.createElement('div'); r.className = 'range';
          var rl = document.createElement('label'); rl.textContent = 'Pages to keep'; rl.htmlFor = 'r' + it.id;
          var h = document.createElement('span'); h.className = 'hint'; h.id = 'rh' + it.id; h.textContent = 'For example: 1-3, 5 (this file has ' + plural(it.pages, 'page') + ')';
          var inp = document.createElement('input'); inp.type = 'text'; inp.id = 'r' + it.id; inp.value = it.range;
          inp.setAttribute('aria-describedby', 'rh' + it.id); inp.autocomplete = 'off'; inp.spellcheck = false;
          var er = document.createElement('p'); er.className = 'ferr'; er.id = 're' + it.id;
          function check() {
            var res = it.range.trim() ? parseRange(it.range, it.pages) : {};
            er.textContent = res.error || '';
            inp.setAttribute('aria-invalid', res.error ? 'true' : 'false');
          }
          inp.addEventListener('input', function () { it.range = inp.value; check(); });
          r.appendChild(rl); r.appendChild(h); r.appendChild(inp); r.appendChild(er); li.appendChild(r);
          check();
        }
      }
      var bs = document.createElement('div'); bs.className = 'fbtns';
      if (!it.error) {
        var up = btn('Move up', 'quiet up', function () { move(it.id, -1); }, i === 0);
        var dn = btn('Move down', 'quiet down', function () { move(it.id, 1); }, i === items.length - 1);
        up.setAttribute('aria-label', 'Move ' + it.name + ' up'); dn.setAttribute('aria-label', 'Move ' + it.name + ' down');
        bs.appendChild(up); bs.appendChild(dn);
      }
      var rm = btn('Remove', 'quiet', function () { remove(it.id); });
      rm.setAttribute('aria-label', 'Remove ' + it.name);
      bs.appendChild(rm);
      li.appendChild(bs);
      listEl.appendChild(li);
    });
    $('order-hint').hidden = usable().length < 2;
    updateGo();
  }

  function outName() {
    var n = $('outname').value.trim().replace(/[\\\/:*?"<>|]+/g, '-') || 'merged.pdf';
    return /\.pdf$/i.test(n) ? n : n + '.pdf';
  }

  $('go').addEventListener('click', async function () {
    var u = usable();
    // Check every range first so we can say exactly what to fix.
    for (var k = 0; k < u.length; k++) {
      var chk = rangeFor(u[k]);
      if (chk.error) { say(u[k].name + ': ' + chk.error, 'err'); return; }
    }
    busy = true; updateGo();
    try {
      var out = await PDFLib.PDFDocument.create();
      for (var i = 0; i < u.length; i++) {
        say('Adding file ' + (i + 1) + ' of ' + u.length + ': ' + u[i].name + '...');
        var src = await PDFLib.PDFDocument.load(u[i].bytes, { ignoreEncryption: false });
        var r = rangeFor(u[i]);
        var idx = r.pages || src.getPageIndices();
        var pages = await out.copyPages(src, idx);
        pages.forEach(function (p) { out.addPage(p); });
      }
      say('Saving your new file...');
      var bytes = await out.save();
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      var a = document.createElement('a');
      a.href = url; a.download = outName(); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      say('Done. ' + a.download + ' has ' + plural(out.getPageCount(), 'page') + ' and is in your downloads.', 'ok');
    } catch (e) {
      say('Something went wrong while joining the files. Remove the last file you added and try again.', 'err');
    }
    busy = false; updateGo();
  });

  var drop = $('drop');
  $('pick').addEventListener('change', function (e) { var f = e.target.files; addFiles(f).then(function () { e.target.value = ''; }); });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  render();
})();
