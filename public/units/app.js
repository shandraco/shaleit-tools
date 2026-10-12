(function () {
  'use strict';

  // factor = how many base units in one of this unit. Base: m, kg, L, m2, m/s, byte, s.
  var CATS = {
    length: { label: 'Length', def: ['in', 'cm'], units: [
      ['mm', 'Millimetres (mm)', 0.001], ['cm', 'Centimetres (cm)', 0.01], ['m', 'Metres (m)', 1], ['km', 'Kilometres (km)', 1000],
      ['in', 'Inches (in)', 0.0254], ['ft', 'Feet (ft)', 0.3048], ['yd', 'Yards (yd)', 0.9144], ['mi', 'Miles (mi)', 1609.344]] },
    weight: { label: 'Weight', def: ['lb', 'kg'], units: [
      ['mg', 'Milligrams (mg)', 0.000001], ['g', 'Grams (g)', 0.001], ['kg', 'Kilograms (kg)', 1], ['t', 'Metric tonnes (t)', 1000],
      ['oz', 'Ounces (oz)', 0.028349523125], ['lb', 'Pounds (lb)', 0.45359237], ['st', 'Stone (st)', 6.35029318], ['ston', 'US short tons', 907.18474]] },
    temperature: { label: 'Temperature', def: ['F', 'C'], units: [
      ['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)'], ['K', 'Kelvin (K)']] },
    volume: { label: 'Volume', def: ['cup', 'ml'], units: [
      ['ml', 'Millilitres (mL)', 0.001], ['l', 'Litres (L)', 1],
      ['tsp', 'US teaspoons (tsp)', 0.00492892159375], ['tbsp', 'US tablespoons (tbsp)', 0.01478676478125],
      ['usfloz', 'US fluid ounces (US fl oz)', 0.0295735295625], ['cup', 'US cups', 0.2365882365],
      ['uspt', 'US pints (US pt)', 0.473176473], ['usqt', 'US quarts (US qt)', 0.946352946], ['usgal', 'US gallons (US gal)', 3.785411784],
      ['ukfloz', 'UK fluid ounces (UK fl oz)', 0.0284130625], ['ukpt', 'UK pints (UK pt)', 0.56826125], ['ukgal', 'UK gallons (UK gal)', 4.54609]] },
    area: { label: 'Area', def: ['ft2', 'm2'], units: [
      ['cm2', 'Square centimetres (cm²)', 0.0001], ['m2', 'Square metres (m²)', 1], ['ha', 'Hectares (ha)', 10000], ['km2', 'Square kilometres (km²)', 1000000],
      ['in2', 'Square inches (in²)', 0.00064516], ['ft2', 'Square feet (ft²)', 0.09290304], ['yd2', 'Square yards (yd²)', 0.83612736],
      ['ac', 'Acres', 4046.8564224], ['mi2', 'Square miles (mi²)', 2589988.110336]] },
    speed: { label: 'Speed', def: ['mph', 'kmh'], units: [
      ['ms', 'Metres per second (m/s)', 1], ['kmh', 'Kilometres per hour (km/h)', 1 / 3.6], ['mph', 'Miles per hour (mph)', 0.44704],
      ['kn', 'Knots', 1852 / 3600], ['fts', 'Feet per second (ft/s)', 0.3048]] },
    data: { label: 'Data size', def: ['gb', 'mb'], units: [
      ['b', 'Bytes (B)', 1], ['kb', 'Kilobytes (KB, 1,000 bytes)', 1e3], ['mb', 'Megabytes (MB, 1,000 KB)', 1e6], ['gb', 'Gigabytes (GB, 1,000 MB)', 1e9], ['tb', 'Terabytes (TB, 1,000 GB)', 1e12],
      ['kib', 'Kibibytes (KiB, 1,024 bytes)', 1024], ['mib', 'Mebibytes (MiB, 1,024 KiB)', 1048576], ['gib', 'Gibibytes (GiB, 1,024 MiB)', 1073741824], ['tib', 'Tebibytes (TiB, 1,024 GiB)', 1099511627776]] },
    time: { label: 'Time', def: ['h', 'min'], units: [
      ['ms', 'Milliseconds (ms)', 0.001], ['s', 'Seconds', 1], ['min', 'Minutes', 60], ['h', 'Hours', 3600], ['d', 'Days', 86400],
      ['wk', 'Weeks', 604800], ['yr', 'Years (365 days)', 31536000]] }
  };
  var ORDER = ['length', 'weight', 'temperature', 'volume', 'area', 'speed', 'data', 'time'];
  var HINTS = {
    data: 'KB, MB and GB count in thousands (1 KB = 1,000 bytes). Disk makers and phone plans use these. KiB, MiB and GiB count in 1,024s. Many computers use these when they show file sizes, so a "500 GB" drive can look smaller on screen.',
    volume: 'US and UK (imperial) pints, gallons and fluid ounces are different sizes. A UK pint is about 20% bigger than a US pint. Cups and spoons here are US.',
    temperature: 'Temperatures use a formula, not a single multiplier, so 0°C is 32°F.'
  };
  var TIP = 'Type a number, like 12 or 1 1/2';

  function findUnit(cat, id) {
    var u = CATS[cat].units;
    for (var i = 0; i < u.length; i++) if (u[i][0] === id) return u[i];
    return null;
  }

  function convert(cat, from, to, x) {
    if (cat === 'temperature') {
      var c = from === 'C' ? x : from === 'F' ? (x - 32) * 5 / 9 : x - 273.15;
      return to === 'C' ? c : to === 'F' ? c * 9 / 5 + 32 : c + 273.15;
    }
    return x * findUnit(cat, from)[2] / findUnit(cat, to)[2];
  }

  var FRAC = { '½': ' 1/2', '¼': ' 1/4', '¾': ' 3/4', '⅓': ' 1/3', '⅔': ' 2/3', '⅛': ' 1/8' };

  // Plain number: 12, -3.5, 1,234.5, 1/2, 1 1/2. Returns number or null.
  function parseNumber(s) {
    s = String(s).trim();
    if (!s) return null;
    var neg = false;
    if (s.charAt(0) === '-' || s.charAt(0) === '−') { neg = true; s = s.slice(1).trim(); }
    var m, v;
    function dec(t) {
      if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
      if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return null;
      return parseFloat(t);
    }
    if ((m = /^(\S+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s))) {
      var w = dec(m[1]); if (w === null || +m[3] === 0) return null;
      v = w + (+m[2]) / (+m[3]);
    } else if ((m = /^(\d+)\s*\/\s*(\d+)$/.exec(s))) {
      if (+m[2] === 0) return null;
      v = (+m[1]) / (+m[2]);
    } else {
      v = dec(s);
    }
    if (v === null || !isFinite(v)) return null;
    return neg ? -v : v;
  }

  // Returns {ok, value, inches?} or {ok:false, msg}
  function parseInput(raw, cat) {
    var s = String(raw).replace(/[′’‘]/g, "'").replace(/[″“”]/g, '"');
    Object.keys(FRAC).forEach(function (k) { s = s.split(k).join(FRAC[k]); });
    s = s.trim();
    if (!s) return { ok: false, empty: true };
    if (cat === 'length') {
      var m = /^(.+?)\s*(?:'|ft|feet|foot)\s*(?:(.*?)\s*(?:"|''|in|inch|inches)?)?$/i.exec(s);
      if (m && /[0-9]/.test(m[1]) && !/[a-z"]/i.test(m[1])) {
        var ft = parseNumber(m[1]);
        var inch = m[2] && m[2].trim() ? parseNumber(m[2]) : 0;
        if (ft !== null && inch !== null) return { ok: true, inches: ft * 12 + (ft < 0 ? -inch : inch), value: ft * 12 + inch };
      }
    }
    if (/^[\d\s.]*,\d{1,2}$/.test(s) || /^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
      return { ok: false, msg: 'Commas are read as thousands, like 1,234. For a decimal, use a dot, like 1.5.' };
    }
    var v = parseNumber(s);
    if (v === null) return { ok: false, msg: TIP };
    return { ok: true, value: v };
  }

  function trim(t) { return t.indexOf('.') >= 0 ? t.replace(/0+$/, '').replace(/\.$/, '') : t; }
  function format(x, sep) {
    if (!isFinite(x)) return '';
    if (Math.abs(x) < 1e-12) return '0';
    var a = Math.abs(x), t;
    if (a >= 1e15 || a < 1e-6) return trim(x.toExponential(4).replace(/\.?0+e/, 'e')).replace('e+', 'e');
    if (a < 1) {
      t = trim(x.toPrecision(4));
      if (t === '0' || t === '-0') t = trim(x.toPrecision(2));
      return t;
    }
    t = trim(x.toFixed(4));
    if (sep) { var p = t.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); t = p.join('.'); }
    return t;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CATS: CATS, convert: convert, parseInput: parseInput, parseNumber: parseNumber, format: format };
  }
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };
  var state = { cat: 'length', from: {}, to: {} };
  ORDER.forEach(function (c) { state.from[c] = CATS[c].def[0]; state.to[c] = CATS[c].def[1]; });
  var KEY = 'shaleit-units-v1';
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && CATS[saved.cat]) {
      state.cat = saved.cat;
      ORDER.forEach(function (c) {
        if (saved.from && findUnit(c, saved.from[c])) state.from[c] = saved.from[c];
        if (saved.to && findUnit(c, saved.to[c])) state.to[c] = saved.to[c];
      });
    }
  } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var lastGood = null; // {text, raw}

  function fillSelect(sel, cat, val) {
    sel.innerHTML = '';
    CATS[cat].units.forEach(function (u) {
      var o = document.createElement('option'); o.value = u[0]; o.textContent = u[1]; sel.appendChild(o);
    });
    sel.value = val;
  }

  function buildKinds() {
    var box = $('kinds');
    ORDER.forEach(function (c) {
      var l = document.createElement('label');
      var i = document.createElement('input'); i.type = 'radio'; i.name = 'cat'; i.value = c; i.checked = c === state.cat;
      var s = document.createElement('span'); s.textContent = CATS[c].label;
      l.appendChild(i); l.appendChild(s); box.appendChild(l);
      i.addEventListener('change', function () { state.cat = c; save(); setup(); });
    });
  }

  function setup() {
    fillSelect($('from'), state.cat, state.from[state.cat]);
    fillSelect($('to'), state.cat, state.to[state.cat]);
    var h = $('cat-hint');
    h.hidden = !HINTS[state.cat];
    h.textContent = HINTS[state.cat] || '';
    $('copy-status').textContent = '';
    update();
  }

  function setNote(msg, bad) {
    var ul = $('notes'); ul.innerHTML = '';
    if (!msg) return;
    var li = document.createElement('li'); if (bad) li.className = 'bad'; li.textContent = msg; ul.appendChild(li);
  }

  function update() {
    var cat = state.cat, from = $('from').value, to = $('to').value;
    var out = $('out');
    var r = parseInput($('num').value, cat);
    var note = '', bad = false, x;
    if (r.ok) {
      x = r.value;
      if (r.inches !== undefined) {
        note = 'Read as ' + format(r.inches, true) + ' inches, so the From choice is not used.';
        // convert from inches straight to target
        var res = convert('length', 'in', to, r.inches);
        show(res);
        renderAll(function (u) { return convert('length', 'in', u, r.inches); }, to);
        setNote(note, false);
        return;
      }
      var y = convert(cat, from, to, x);
      show(y);
      renderAll(function (u) { return convert(cat, from, u, x); }, to);
      setNote('', false);
    } else {
      out.classList.add('stale');
      if (!lastGood) out.textContent = '–';
      setNote(r.empty ? TIP : r.msg, !r.empty);
      $('copy').disabled = !lastGood;
    }
  }

  function show(y) {
    var out = $('out');
    out.classList.remove('stale');
    var t = format(y, true);
    out.textContent = t;
    lastGood = { text: t, raw: format(y, false) };
    $('copy').disabled = false;
  }

  function renderAll(fn, to) {
    var ul = $('all'); ul.innerHTML = '';
    CATS[state.cat].units.forEach(function (u) {
      var li = document.createElement('li'); if (u[0] === to) li.className = 'to';
      var a = document.createElement('span'); a.textContent = u[1];
      var b = document.createElement('span'); b.className = 'v'; b.textContent = format(fn(u[0]), true);
      li.appendChild(a); li.appendChild(b); ul.appendChild(li);
    });
  }

  function copy() {
    if (!lastGood) return;
    var st = $('copy-status'); st.className = 'status';
    function ok() { st.className = 'status ok'; st.textContent = 'Copied: ' + lastGood.raw; }
    function fail() { st.className = 'status err'; st.textContent = 'Could not copy. Select the result and copy it by hand.'; }
    function legacy() {
      try {
        var t = document.createElement('textarea'); t.value = lastGood.raw; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        var done = document.execCommand('copy'); document.body.removeChild(t);
        done ? ok() : fail();
      } catch (e) { fail(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lastGood.raw).then(ok, legacy);
    else legacy();
  }

  buildKinds();
  $('num').addEventListener('input', update);
  $('from').addEventListener('change', function () { state.from[state.cat] = this.value; save(); update(); });
  $('to').addEventListener('change', function () { state.to[state.cat] = this.value; save(); update(); });
  $('swap').addEventListener('click', function () {
    var f = $('from').value, t = $('to').value;
    // Put the current answer into the box so Swap feels like going back.
    if (lastGood && !$('out').classList.contains('stale')) $('num').value = lastGood.raw;
    $('from').value = t; $('to').value = f;
    state.from[state.cat] = t; state.to[state.cat] = f;
    save(); update();
  });
  $('copy').addEventListener('click', copy);
  setup();
})();
