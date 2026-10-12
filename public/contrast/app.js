(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'shaleit-contrast-last';
  var state = { fg: '#1d2220', bg: '#c7cbc6' };
  var undoFg = null, suggestion = null;

  var probe = document.createElement('span');
  probe.hidden = true;
  document.body.appendChild(probe);

  // Parse anything CSS accepts into [r,g,b] (0-255), or null.
  function parse(input) {
    var v = String(input || '').trim();
    if (!v) return null;
    if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) v = '#' + v;
    if (/^(inherit|initial|unset|revert|currentcolor|transparent)/i.test(v)) return null;
    probe.style.color = '';
    probe.style.color = v;
    if (!probe.style.color) return null;
    var c = getComputedStyle(probe).color;
    var nums = c.match(/-?\d*\.?\d+(?:e-?\d+)?%?/g);
    if (!nums || nums.length < 3) return null;
    var isSrgb = /^color\(/.test(c);
    var rgb = nums.slice(0, 3).map(function (n) {
      var x = parseFloat(n);
      if (isSrgb) x *= 255;
      return Math.max(0, Math.min(255, Math.round(x)));
    });
    if (nums.length > 3 && parseFloat(nums[3]) < 1) return null;
    return rgb;
  }
  function toHex(rgb) {
    return '#' + rgb.map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(rgb) { return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    if (l1 < l2) { var t = l1; l1 = l2; l2 = t; }
    return (l1 + 0.05) / (l2 + 0.05);
  }
  function floor2(x) { return Math.floor(x * 100 + 1e-9) / 100; }

  function rgbToHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    var k = function (n) { return (n + h / 30) % 12; };
    var a = s * Math.min(l, 1 - l);
    var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
    return [f(0), f(8), f(4)].map(function (x) { return Math.round(x * 255); });
  }

  // Nearest text colour (same hue and saturation, different lightness) that reaches 4.5.
  function findFix(fg, bg) {
    var hsl = rgbToHsl(fg), best = null;
    for (var step = 1; step <= 1000; step++) {
      [-1, 1].forEach(function (dir) {
        var l = hsl[2] + dir * step / 1000;
        if (l < 0 || l > 1) return;
        var c = hslToRgb(hsl[0], hsl[1], l);
        if (floor2(ratio(c, bg)) >= 4.5 && (!best || step < best.step)) best = { rgb: c, step: step };
      });
      if (best) return best.rgb;
    }
    var black = [0, 0, 0], white = [255, 255, 255];
    return ratio(black, bg) >= ratio(white, bg) ? black : white;
  }

  function verdictFor(r) {
    if (r >= 4.5) return 'Easy to read';
    if (r >= 3) return 'Fine for big headings only';
    return 'Hard to read';
  }

  function render() {
    var fg = parse(state.fg), bg = parse(state.bg);
    var r = floor2(ratio(fg, bg));
    var p = $('preview');
    p.style.color = state.fg; p.style.backgroundColor = state.bg;
    $('fg-pick').value = state.fg; $('bg-pick').value = state.bg;
    if (document.activeElement !== $('fg-text')) $('fg-text').value = state.fg;
    if (document.activeElement !== $('bg-text')) $('bg-text').value = state.bg;
    $('verdict').textContent = verdictFor(r);
    $('ratio').textContent = 'Contrast: ' + r.toFixed(2).replace(/\.?0+$/, '') + ' to 1';
    var rows = [
      ['Normal text', 'ok enough for most text', 4.5, 'AA, needs 4.5'],
      ['Big text', 'ok for headings and large type', 3, 'AA, needs 3'],
      ['Normal text, best', 'easiest for everyone', 7, 'AAA, needs 7'],
      ['Big text, best', 'easiest for everyone', 4.5, 'AAA, needs 4.5']
    ];
    var ul = $('checks'); ul.textContent = '';
    rows.forEach(function (x) {
      var ok = r >= x[2];
      var li = document.createElement('li'); li.className = ok ? 'pass' : 'fail';
      var m = document.createElement('span'); m.className = 'mark'; m.setAttribute('aria-hidden', 'true'); m.textContent = ok ? '✓' : '✗';
      var t = document.createElement('span');
      var b = document.createElement('b'); b.textContent = (ok ? 'Pass: ' : 'Fail: ') + x[0];
      t.appendChild(b); t.appendChild(document.createTextNode(' (' + x[3] + ')'));
      li.appendChild(m); li.appendChild(t); ul.appendChild(li);
    });
    $('fix').hidden = r >= 4.5;
    $('undo').hidden = !undoFg;
    suggestion = null; $('fixbox').hidden = true;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function commit(which, raw) {
    var rgb = parse(raw), msg = $(which + '-msg');
    if (!rgb) {
      msg.textContent = 'We could not read that colour. Try a code like #1d2220, a name like navy, or rgb(30, 34, 32).';
      return;
    }
    msg.textContent = '';
    state[which] = toHex(rgb);
    undoFg = null; $('note').textContent = ''; $('note').className = 'status';
    render();
  }

  ['fg', 'bg'].forEach(function (w) {
    $(w + '-pick').addEventListener('input', function (e) { commit(w, e.target.value); });
    $(w + '-text').addEventListener('change', function (e) { commit(w, e.target.value); });
    $(w + '-text').addEventListener('input', function (e) {
      if (parse(e.target.value)) commit(w, e.target.value);
    });
    $(w + '-text').addEventListener('blur', function () { $(w + '-text').value = state[w]; });
  });

  $('swap').addEventListener('click', function () {
    var t = state.fg; state.fg = state.bg; state.bg = t;
    undoFg = null; $('fg-msg').textContent = ''; $('bg-msg').textContent = '';
    $('note').textContent = 'Swapped. Press Swap colours again to go back.'; $('note').className = 'status';
    render();
  });

  $('fix').addEventListener('click', function () {
    var c = findFix(parse(state.fg), parse(state.bg));
    suggestion = toHex(c);
    var r = floor2(ratio(c, parse(state.bg)));
    $('fix-sw').style.backgroundColor = suggestion;
    $('fix-text').textContent = 'Try ' + suggestion + ' for the text. It is close to your colour and easy to read (' + r + ' to 1).';
    $('fixbox').hidden = false;
    $('apply').focus();
  });

  $('apply').addEventListener('click', function () {
    if (!suggestion) return;
    var prev = state.fg;
    state.fg = suggestion;
    render();
    undoFg = prev; $('undo').hidden = false;
    $('note').textContent = 'Text colour changed to ' + state.fg + '. You can undo this.';
    $('note').className = 'status ok';
  });

  $('undo').addEventListener('click', function () {
    if (!undoFg) return;
    state.fg = undoFg; undoFg = null;
    render();
    $('note').textContent = 'Put your old text colour back.'; $('note').className = 'status';
  });

  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && parse(saved.fg) && parse(saved.bg)) { state.fg = toHex(parse(saved.fg)); state.bg = toHex(parse(saved.bg)); }
  } catch (e) {}
  render();
})();
