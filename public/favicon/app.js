(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var SNIPPET = [
    '<link rel="icon" href="/favicon.ico" sizes="48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">'
  ].join('\n');
  $('snippet').value = SNIPPET;

  var state = { img: null, imgW: 0, imgH: 0, detail: false };
  var FONT = '"Familjen Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif';

  function mode() { return document.querySelector('input[name="mode"]:checked').value; }
  function fitMode() { return document.querySelector('input[name="fit"]:checked').value; }

  function mk(size) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function roundRect(ctx, s, r) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(s, 0, s, s, r);
    ctx.arcTo(s, s, 0, s, r);
    ctx.arcTo(0, s, 0, 0, r);
    ctx.arcTo(0, 0, s, 0, r);
    ctx.closePath();
  }

  // Draw source onto a size x size canvas, stepping down in halves.
  function scaled(src, sw, sh, dx, dy, dw, dh, size) {
    var cur = src, cw = sw, ch = sh;
    dw = Math.max(1, Math.round(dw)); dh = Math.max(1, Math.round(dh));
    while (cw / 2 >= dw && ch / 2 >= dh) {
      var nw = Math.max(dw, Math.floor(cw / 2)), nh = Math.max(dh, Math.floor(ch / 2));
      var t = document.createElement('canvas');
      t.width = nw; t.height = nh;
      var tc = t.getContext('2d');
      tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
      tc.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
      cur = t; cw = nw; ch = nh;
    }
    return { cur: cur, cw: cw, ch: ch };
  }

  // Build the icon at a size. forApple: full square, no transparency.
  function render(size, forApple) {
    var c = mk(size), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (mode() === 'letter') {
      var rounded = $('shape').value === 'rounded' && !forApple;
      ctx.fillStyle = $('bg').value;
      if (rounded) { roundRect(ctx, size, size * 0.22); ctx.fill(); } else { ctx.fillRect(0, 0, size, size); }
      var txt = $('letter').value.trim();
      if (txt) {
        var fs = size * (txt.length > 1 ? 0.52 : 0.68);
        ctx.font = '700 ' + fs + 'px ' + FONT;
        ctx.fillStyle = $('fg').value;
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        var m = ctx.measureText(txt);
        var top = m.actualBoundingBoxAscent || fs * 0.72, bot = m.actualBoundingBoxDescent || 0;
        ctx.fillText(txt, size / 2, size / 2 + (top - bot) / 2);
      }
    } else if (state.img) {
      var w = state.imgW, h = state.imgH, fit = fitMode() === 'fit';
      if (fit || forApple) {
        ctx.fillStyle = fit ? $('fitbg').value : '#ffffff';
        ctx.fillRect(0, 0, size, size);
      }
      var k = fit ? Math.min(size / w, size / h) : Math.max(size / w, size / h);
      var dw = w * k, dh = h * k, dx = (size - dw) / 2, dy = (size - dh) / 2;
      var s = scaled(state.img, w, h, 0, 0, dw, dh, size);
      ctx.drawImage(s.cur, 0, 0, s.cw, s.ch, dx, dy, dw, dh);
    }
    return c;
  }

  function paint(id, size) {
    var cv = $(id), ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(render(size, false), 0, 0);
  }

  function update() {
    var imgMode = mode() === 'image';
    $('pane-letter').hidden = imgMode;
    $('pane-image').hidden = !imgMode;
    $('fit-bg-field').hidden = fitMode() !== 'fit';
    var ready = !imgMode || !!state.img;
    paint('c16', 16); paint('c32', 32); paint('c180', 180);
    var tabIcon = ready ? render(32, false).toDataURL('image/png') : '';
    $('t1').src = tabIcon; $('t2').src = tabIcon;
    $('t1').style.visibility = $('t2').style.visibility = ready ? 'visible' : 'hidden';
    $('dl').disabled = !ready;

    var notes = [];
    if (imgMode && !state.img) notes.push(['bad', 'Choose an image above to see your icon.']);
    if (imgMode && state.img && Math.min(state.imgW, state.imgH) < 180 && !state.isSvg) {
      notes.push(['', 'This image is smaller than 180 pixels, so the large icon may look soft. A bigger image gives a sharper result.']);
    }
    if (imgMode && state.img && state.detail) {
      notes.push(['', 'Fine detail disappears at small sizes. A simple shape or letter works best.']);
    }
    if (!imgMode && !$('letter').value.trim()) notes.push(['bad', 'Type a letter or two to make an icon.']);
    var ul = $('notes');
    ul.textContent = '';
    notes.forEach(function (n) {
      var li = document.createElement('li');
      if (n[0]) li.className = n[0];
      li.textContent = n[1];
      ul.appendChild(li);
    });
  }

  function measureDetail() {
    var c = mk(64), ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 64, 64);
    var k = Math.min(64 / state.imgW, 64 / state.imgH);
    ctx.drawImage(state.img, (64 - state.imgW * k) / 2, (64 - state.imgH * k) / 2, state.imgW * k, state.imgH * k);
    var d = ctx.getImageData(0, 0, 64, 64).data, edges = 0, n = 0;
    function lum(i) { return 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; }
    for (var y = 0; y < 63; y++) for (var x = 0; x < 63; x++) {
      var i = (y * 64 + x) * 4;
      if (Math.abs(lum(i) - lum(i + 4)) > 40 || Math.abs(lum(i) - lum(i + 256)) > 40) edges++;
      n++;
    }
    return edges / n > 0.2;
  }

  function loadFile(f) {
    if (!f) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type)) {
      $('file-name').textContent = 'That file is not a picture we can use. Choose a PNG, JPG, SVG or WebP.';
      return;
    }
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      state.isSvg = f.type === 'image/svg+xml';
      state.imgW = im.naturalWidth || 512; state.imgH = im.naturalHeight || 512;
      state.img = im;
      try { state.detail = measureDetail(); } catch (e) { state.detail = false; }
      $('file-name').textContent = 'Using ' + f.name + '. Choose or drop another to swap it.';
      update();
    };
    im.onerror = function () {
      $('file-name').textContent = 'We could not open that file. Try a different image.';
    };
    im.src = url;
  }

  function toBytes(canvas) {
    return new Promise(function (res, rej) {
      canvas.toBlob(function (b) {
        if (!b) return rej(new Error('encode'));
        b.arrayBuffer().then(function (ab) { res(new Uint8Array(ab)); }, rej);
      }, 'image/png');
    });
  }

  function makeIco(entries) { // entries: [{size, bytes}]
    var n = entries.length, head = 6 + 16 * n, total = head;
    entries.forEach(function (e) { total += e.bytes.length; });
    var out = new Uint8Array(total), dv = new DataView(out.buffer), off = head;
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, n, true);
    entries.forEach(function (e, i) {
      var p = 6 + 16 * i;
      out[p] = e.size >= 256 ? 0 : e.size;
      out[p + 1] = e.size >= 256 ? 0 : e.size;
      out[p + 2] = 0; out[p + 3] = 0;
      dv.setUint16(p + 4, 1, true);
      dv.setUint16(p + 6, 32, true);
      dv.setUint32(p + 8, e.bytes.length, true);
      dv.setUint32(p + 12, off, true);
      out.set(e.bytes, off);
      off += e.bytes.length;
    });
    return out;
  }

  function text(s) { return new TextEncoder().encode(s); }

  async function download() {
    var st = $('dl-status');
    st.textContent = 'Making your pack...';
    try {
      var sizes = { 16: 0, 32: 0, 48: 0, 192: 0, 512: 0 }, png = {};
      for (var s in sizes) png[s] = await toBytes(render(+s, false));
      var apple = await toBytes(render(180, true));
      var name = $('sitename').value.trim();
      var manifest = JSON.stringify({
        name: name, short_name: name,
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
        ],
        theme_color: '#ffffff', background_color: '#ffffff', display: 'standalone'
      }, null, 2);
      var readme = 'Your favicon pack\n\n' +
        '1. Upload every file except this one to the top folder of your website, next to your home page.\n' +
        '2. Paste this code between the <head> and </head> tags of each page:\n\n' + SNIPPET + '\n\n' +
        '3. Reload your site. Browsers keep old icons for a while, so a hard refresh or a private window can help.\n\n' +
        'Made with the ShaleIT favicon maker. Your image never left your device.\n';
      var files = {
        'favicon.ico': makeIco([{ size: 16, bytes: png[16] }, { size: 32, bytes: png[32] }, { size: 48, bytes: png[48] }]),
        'favicon-16x16.png': png[16],
        'favicon-32x32.png': png[32],
        'apple-touch-icon.png': apple,
        'android-chrome-192x192.png': png[192],
        'android-chrome-512x512.png': png[512],
        'site.webmanifest': text(manifest),
        'README.txt': text(readme)
      };
      var zip = fflate.zipSync(files, { level: 6 });
      var blob = new Blob([zip], { type: 'application/zip' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'favicon-pack.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      st.textContent = 'Done. Your zip file is in your downloads.';
    } catch (e) {
      st.textContent = 'Something went wrong making the pack. Reload the page and try again.';
    }
  }

  function copy() {
    var ta = $('snippet'), st = $('copy-status');
    function ok() { st.textContent = 'Copied.'; }
    function fail() { ta.focus(); ta.select(); st.textContent = 'Select the code above and copy it with Ctrl+C (Cmd+C on a Mac).'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(ok, fail);
    } else fail();
  }

  document.addEventListener('input', update);
  document.addEventListener('change', update);
  $('file').addEventListener('change', function (e) { loadFile(e.target.files[0]); });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) { loadFile(e.dataTransfer.files[0]); });
  $('dl').addEventListener('click', download);
  $('copy').addEventListener('click', copy);

  update();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 100px "Familjen Grotesk"').then(update, function () {});
  }
})();
