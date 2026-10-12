(function () {
  'use strict';
  var PRESETS = {
    web: { max: 1600, type: 'image/webp', q: 80 },
    email: { max: 1200, type: 'image/jpeg', q: 75 },
    large: { max: 0, type: 'image/webp', q: 85 }
  };
  var $ = function (id) { return document.getElementById(id); };
  var fileIn = $('file'), drop = $('drop'), list = $('list'), statusEl = $('status');
  var bulk = $('bulk'), maxw = $('maxw'), fmt = $('fmt'), q = $('q'), qv = $('qv');
  var items = [], busy = false, again = null, lastFiles = [], timer = null;

  function size(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' bytes';
  }
  function say(msg, cls) { statusEl.textContent = msg; statusEl.className = 'status' + (cls ? ' ' + cls : ''); }
  function ext(t) { return t === 'image/png' ? 'png' : t === 'image/jpeg' ? 'jpg' : 'webp'; }

  function applyPreset() {
    var p = PRESETS[document.querySelector('input[name=preset]:checked').value];
    maxw.value = p.max || '';
    fmt.value = p.type; q.value = p.q; qv.textContent = p.q;
  }
  function settings() {
    return { max: parseInt(maxw.value, 10) || 0, type: fmt.value, q: parseInt(q.value, 10) / 100 };
  }

  function resize(bmp, w, h, type) {
    var src = bmp, sw = bmp.width, sh = bmp.height, c;
    while (sw / 2 >= w && sh / 2 >= h) {
      var nw = Math.floor(sw / 2), nh = Math.floor(sh / 2);
      c = document.createElement('canvas'); c.width = nw; c.height = nh;
      var x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(src, 0, 0, nw, nh); src = c; sw = nw; sh = nh;
    }
    c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d');
    if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, w, h);
    return c;
  }
  function toBlob(c, type, qual) {
    return new Promise(function (res) { c.toBlob(res, type, qual); });
  }

  async function shrink(file, s) {
    var bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    var w = bmp.width, h = bmp.height, long = Math.max(w, h);
    if (s.max && long > s.max) { var k = s.max / long; w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k)); }
    var c = resize(bmp, w, h, s.type);
    if (bmp.close) bmp.close();
    var blob = await toBlob(c, s.type, s.q);
    if (!blob || blob.type !== s.type) {
      // Browser could not write this type; fall back to JPEG
      s = { max: s.max, type: 'image/jpeg', q: s.q };
      c = resize(await createImageBitmap(file, { imageOrientation: 'from-image' }), w, h, s.type);
      blob = await toBlob(c, s.type, s.q);
    }
    return { blob: blob, type: s.type };
  }

  function render(it) {
    var el = it.el;
    el.textContent = '';
    el.className = 'item' + (it.error ? ' bad' : '');
    var img = document.createElement('img'); img.alt = '';
    if (it.thumb) img.src = it.thumb;
    var box = document.createElement('div');
    var nm = document.createElement('p'); nm.className = 'name info'; nm.textContent = it.file.name || 'Pasted image';
    var inf = document.createElement('p'); inf.className = 'info';
    box.appendChild(nm); box.appendChild(inf);
    el.appendChild(img); el.appendChild(box);
    if (it.error) { inf.textContent = it.error; return; }
    if (!it.out) { inf.textContent = 'Shrinking...'; return; }
    var before = it.file.size, after = it.out.size;
    if (it.kept) inf.textContent = 'Already small: shrinking would make it bigger (' + size(before) + '), so your original is kept.';
    else inf.textContent = size(before) + ' to ' + size(after) + ', ' + Math.max(0, Math.round((1 - after / before) * 100)) + '% smaller.';
    var act = document.createElement('div'); act.className = 'act';
    var a = document.createElement('a'); a.className = 'btn'; a.href = it.url; a.download = it.dlname;
    a.textContent = 'Download';
    act.appendChild(a); el.appendChild(act);
  }

  function clearItem(it) { if (it.url) URL.revokeObjectURL(it.url); if (it.thumb && it.thumb !== it.url) URL.revokeObjectURL(it.thumb); }
  function clearAll() { items.forEach(clearItem); items = []; list.textContent = ''; bulk.hidden = true; say(''); }

  async function process(files) {
    if (busy) { again = files; say('Still working. Your new photos will start in a moment.'); return; }
    files = Array.prototype.filter.call(files, function (f) { return f; });
    if (!files.length) return;
    busy = true; clearAll(); lastFiles = files;
    var s = settings();
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var it = { file: f, el: document.createElement('div') };
      items.push(it); list.appendChild(it.el); render(it);
      say('Shrinking photo ' + (i + 1) + ' of ' + files.length + '...');
      try {
        if (!/^image\//.test(f.type) && !/\.(heic|heif|jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name)) throw new Error('type');
        var r = await shrink(f, s);
        var keep = r.blob.size >= f.size;
        it.kept = keep;
        it.out = keep ? f : r.blob;
        it.url = URL.createObjectURL(it.out);
        it.thumb = it.url;
        var base = (f.name || 'pasted-image').replace(/\.[^.]*$/, '');
        it.dlname = keep ? (f.name || base + '.' + ext(f.type)) : base + '-small.' + ext(r.type);
      } catch (e) {
        var heic = /heic|heif/i.test(f.type + ' ' + f.name);
        it.error = heic
          ? 'This phone format cannot be opened here. On iPhone, go to Settings, Camera, Formats and choose Most Compatible. Or share the photo as a JPEG and choose it again.'
          : 'This file could not be opened as a picture. Choose a JPEG, PNG or WebP photo instead.';
      }
      render(it);
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    var ok = items.filter(function (x) { return x.out; });
    var bad = items.length - ok.length;
    if (ok.length) {
      var b = 0, a = 0; ok.forEach(function (x) { b += x.file.size; a += x.out.size; });
      say('Done. ' + ok.length + (ok.length === 1 ? ' photo' : ' photos') + ': ' + size(b) + ' to ' + size(a) + '.' + (bad ? ' ' + bad + ' could not be opened.' : ''), 'ok');
    } else say('None of those could be opened. See the messages below.', 'err');
    bulk.hidden = ok.length < 2;
    busy = false;
    if (again) { var n = again; again = null; process(n); }
  }

  async function downloadAll() {
    var ok = items.filter(function (x) { return x.out; });
    for (var i = 0; i < ok.length; i++) {
      var a = document.createElement('a'); a.href = ok[i].url; a.download = ok[i].dlname;
      document.body.appendChild(a); a.click(); a.remove();
      await new Promise(function (r) { setTimeout(r, 400); });
    }
  }

  fileIn.addEventListener('change', function () { var f = Array.from(fileIn.files); fileIn.value = ''; process(f); });
  ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { process(Array.from(e.dataTransfer.files)); });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); if (e.target !== drop && !drop.contains(e.target)) process(Array.from(e.dataTransfer.files)); });
  document.addEventListener('paste', function (e) {
    var fs = Array.from((e.clipboardData && e.clipboardData.files) || []).filter(function (f) { return /^image\//.test(f.type); });
    if (fs.length) { e.preventDefault(); process(fs); }
  });
  document.querySelectorAll('input[name=preset]').forEach(function (r) { r.addEventListener('change', applyPreset); });
  q.addEventListener('input', function () { qv.textContent = q.value; });
  $('dlall').addEventListener('click', downloadAll);
  $('clear').addEventListener('click', function () { clearTimeout(timer); lastFiles = []; clearAll(); });
  window.addEventListener('pagehide', clearAll);
  function redo() {
    clearTimeout(timer);
    if (!lastFiles.length) return;
    timer = setTimeout(function () { process(lastFiles); }, 300);
  }
  document.querySelectorAll('input[name=preset]').forEach(function (r) { r.addEventListener('change', redo); });
  [maxw, fmt, q].forEach(function (el) { el.addEventListener('input', redo); el.addEventListener('change', redo); });
  applyPreset();
})();
