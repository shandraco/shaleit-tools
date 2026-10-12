(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (typeof qrcode === 'undefined') {
    $('empty').textContent = 'The QR maker could not load. Refresh the page and try again.';
    return;
  }
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  var kinds = ['url', 'wifi', 'tel', 'text'];
  var current = null; // { svg, label } when a code is showing

  function kind() { return document.querySelector('input[name="kind"]:checked').value; }

  function wifiEsc(s) { return s.replace(/([\\;,:"])/g,'\\$1'); }

  // Returns { data, label, notes[] } or null when there is nothing to encode.
  function buildContent() {
    var k = kind(), notes = [];
    if (k === 'url') {
      var u = $('url').value.trim();
      if (!u) return null;
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^(mailto|tel|sms):/i.test(u)) {
        u = 'https://' + u.replace(/^\/+/, '');
        notes.push('We added https:// to the start so phones know it is a web address.');
      }
      return { data: u, label: 'the web address ' + u, notes: notes };
    }
    if (k === 'wifi') {
      var ssid = $('ssid').value;
      if (!ssid) return null;
      var sec = $('security').value, pass = $('wifipass').value;
      var d = 'WIFI:T:' + (sec === 'nopass' ? 'nopass' : sec) + ';S:' + wifiEsc(ssid) + ';';
      if (sec !== 'nopass') {
        if (!pass) notes.push('Add the Wi-Fi password, or choose "None" if the network has no password.');
        d += 'P:' + wifiEsc(pass) + ';';
      }
      if ($('hidden').checked) d += 'H:true;';
      d += ';';
      return { data: d, label: 'joining the Wi-Fi network ' + ssid, notes: notes, passMissing: sec !== 'nopass' && !pass };
    }
    if (k === 'tel') {
      var raw = $('tel').value.trim();
      var n = raw.replace(/[^\d+]/g, '');
      if (!/\d/.test(n)) return null;
      return { data: 'tel:' + n, label: 'calling the phone number ' + raw, notes: notes };
    }
    var t = $('text').value;
    if (!t.trim()) return null;
    return { data: t, label: 'the text ' + (t.length > 60 ? t.slice(0, 60) + '...' : t), notes: notes };
  }

  function lum(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function makeSvg(qr, dark, light, label) {
    var n = qr.getModuleCount(), q = 4, total = n + q * 2, d = '';
    for (var r = 0; r < n; r++) {
      var c = 0;
      while (c < n) {
        if (qr.isDark(r, c)) {
          var s = c;
          while (c < n && qr.isDark(r, c)) c++;
          d += 'M' + (s + q) + ' ' + (r + q) + 'h' + (c - s) + 'v1h-' + (c - s) + 'z';
        } else c++;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="' + esc('QR code for ' + label) + '">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' +
      '<path fill="' + dark + '" d="' + d + '"/></svg>';
  }

  function render() {
    var svgEl = $('qr'), notesEl = $('notes');
    $('dl-status').textContent = '';
    $('dl-status').className = 'status';
    var c = buildContent();
    var items = [];
    function show(on) {
      svgEl.hidden = !on;
      $('empty').hidden = on;
      $('dl-png').disabled = !on;
      $('dl-svg').disabled = !on;
      if (!on) current = null;
    }
    if (!c) {
      show(false);
      var msgs = { url: 'Your QR code will show up here. Start typing the web address above.', wifi: 'Your QR code will show up here. Type the Wi-Fi name above.', tel: 'Your QR code will show up here. Type the phone number above.', text: 'Your QR code will show up here. Type some text above.' };
      $('empty').textContent = msgs[kind()];
      notesEl.innerHTML = '';
      return;
    }
    var level = $('hi').checked ? 'H' : 'M';
    var qr = qrcode(0, level);
    var bytes = new TextEncoder().encode(c.data).length;
    try {
      qr.addData(c.data);
      qr.make();
    } catch (e) {
      show(false);
      $('empty').textContent = 'That is too much for one QR code. Shorten it and the code will appear.';
      notesEl.innerHTML = '<li class="bad">There is too much to fit. Try a shorter web address or less text.</li>';
      return;
    }
    var dark = $('dark').value, light = $('light').value;
    var svg = makeSvg(qr, dark, light, c.label);
    svgEl.outerHTML = svg.replace('<svg ', '<svg id="qr" ');
    svgEl = $('qr');
    show(true);
    current = { svg: svg, label: c.label };

    items = c.notes.map(function (t) { return [t, false]; });
    if (bytes > 350 || qr.getModuleCount() > 69) {
      items.push(['This is a lot to put in a code, so it is dense and phones may struggle to scan it. Shorten it if you can, or print the code large.', false]);
    }
    var ld = lum(dark), ll = lum(light);
    var ratio = (Math.max(ld, ll) + 0.05) / (Math.min(ld, ll) + 0.05);
    if (ld > ll) {
      items.push(['The code is lighter than its background. Many phones cannot read that. Make the code colour darker than the background.', true]);
    } else if (ratio < 3) {
      items.push(['The two colours are too close together, so the code will be hard to scan. Pick a darker code colour or a lighter background.', true]);
    }
    notesEl.innerHTML = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.textContent = it[0];
      if (it[1]) li.className = 'bad';
      notesEl.appendChild(li);
    });
  }

  function save(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function say(msg, bad) {
    var s = $('dl-status');
    s.textContent = msg;
    s.className = 'status ' + (bad ? 'err' : 'ok');
  }

  $('dl-svg').addEventListener('click', function () {
    if (!current) return;
    save(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + current.svg], { type: 'image/svg+xml' }), 'qr-code.svg');
    say('Your SVG file is downloading.');
  });

  $('dl-png').addEventListener('click', function () {
    if (!current) return;
    var size = parseInt($('size').value, 10) || 1024;
    var src = current.svg.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ');
    var url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
    var img = new Image();
    say('Getting your PNG ready...');
    img.onload = function () {
      var cv = document.createElement('canvas');
      cv.width = size; cv.height = size;
      var ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        if (!b) { say('Your browser could not make the PNG. Try a smaller size under More options, or use Download SVG.', true); return; }
        save(b, 'qr-code.png');
        say('Your PNG file is downloading.');
      }, 'image/png');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      say('Your browser could not make the PNG. Try Download SVG instead.', true);
    };
    img.src = url;
  });

  function showPane() {
    var k = kind();
    kinds.forEach(function (x) { $('pane-' + x).hidden = x !== k; });
    render();
  }
  Array.prototype.forEach.call(document.querySelectorAll('input[name="kind"]'), function (r) { r.addEventListener('change', showPane); });
  ['url', 'ssid', 'wifipass', 'security', 'hidden', 'tel', 'text', 'hi', 'dark', 'light'].forEach(function (id) {
    $(id).addEventListener('input', render);
    $(id).addEventListener('change', render);
  });
  $('reset-colours').addEventListener('click', function () {
    $('dark').value = '#000000'; $('light').value = '#ffffff'; render();
  });
  showPane();
})();
