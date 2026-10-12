(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var pwEl = $('pw'), strengthEl = $('strength'), statusEl = $('status'), bitsEl = $('bits');
  var copyBtn = $('copy'), againBtn = $('again');
  var words = null;
  var current = '';

  /* ---------- randomness: crypto only, rejection sampling ---------- */
  function randInt(max) { // uniform integer in [0, max)
    var limit = Math.floor(4294967296 / max) * max;
    var buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }
  function pick(list) { return list[randInt(list.length)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- generators ---------- */
  function clamp(el, lo, hi, dflt) {
    var n = parseInt(el.value, 10);
    if (isNaN(n)) n = dflt;
    return Math.min(hi, Math.max(lo, n));
  }

  function makePassphrase() {
    var n = clamp($('wcount'), 3, 10, 5);
    var parts = [];
    for (var i = 0; i < n; i++) {
      var w = pick(words);
      if ($('wcap').checked) w = w.charAt(0).toUpperCase() + w.slice(1);
      parts.push(w);
    }
    var text = parts.join('-');
    var bits = n * Math.log2(words.length);
    if ($('wnum').checked) {
      text += '-' + (10 + randInt(90)); // two digits, 10 to 99
      bits += Math.log2(90);
    }
    return { text: text, bits: bits, kind: 'words', count: n };
  }

  function makeChars() {
    var len = clamp($('clen'), 8, 64, 20);
    var avoid = $('cavoid').checked;
    var lower = 'abcdefghijklmnopqrstuvwxyz', upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        digits = '0123456789', syms = '!@#$%^&*-_+=?';
    if (avoid) {
      lower = lower.replace(/[l]/g, '');
      upper = upper.replace(/[OI]/g, '');
      digits = digits.replace(/[01]/g, '');
    }
    var classes = [lower];
    if ($('ccap').checked) classes.push(upper);
    if ($('cnum').checked) classes.push(digits);
    if ($('csym').checked) classes.push(syms);
    var pool = classes.join('');
    var chars = classes.map(function (c) { return c.charAt(randInt(c.length)); });
    while (chars.length < len) chars.push(pool.charAt(randInt(pool.length)));
    chars = shuffle(chars).slice(0, Math.max(len, 1));
    return { text: chars.join(''), bits: len * Math.log2(pool.length), kind: 'chars', pool: pool.length, count: len };
  }

  /* ---------- strength in plain words ---------- */
  function describe(bits) {
    if (bits < 40) return 'Weak: could be guessed quickly. Add more words or characters.';
    if (bits < 60) return 'Fair: fine for something unimportant, but make it longer for anything that matters.';
    if (bits < 80) return 'Strong: very hard to guess.';
    if (bits < 100) return 'Very strong: would take centuries to guess.';
    return 'Excellent: out of reach, even for a powerful computer.';
  }

  /* ---------- display ---------- */
  function show(r) {
    current = r.text;
    pwEl.textContent = '';
    for (var i = 0; i < r.text.length; i++) {
      var ch = r.text.charAt(i), span = document.createElement('span');
      if (/[0-9]/.test(ch)) span.className = 'd';
      else if (!/[A-Za-z]/.test(ch) && !(r.kind === 'words' && ch === '-')) span.className = 's';
      span.textContent = ch;
      pwEl.appendChild(span);
    }
    strengthEl.textContent = describe(r.bits);
    var detail = r.kind === 'words'
      ? 'About ' + Math.round(r.bits) + ' bits. ' + r.count + ' words picked at random from a list of 7,776'
        + ($('wnum').checked ? ', plus a two-digit number' : '') + '.'
      : 'About ' + Math.round(r.bits) + ' bits. ' + r.count + ' characters picked at random from ' + r.pool + ' possible characters.';
    bitsEl.textContent = detail + ' Each extra bit doubles the guesses an attacker needs. 80 bits or more is very strong.';
    statusEl.textContent = '';
    statusEl.className = 'status';
  }

  function generate() {
    var mode = document.querySelector('input[name="mode"]:checked').value;
    if (mode === 'words') {
      if (!words) return;
      show(makePassphrase());
    } else {
      show(makeChars());
    }
  }

  function setStatus(msg, cls) {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + (cls || '');
  }

  /* ---------- copy ---------- */
  function selectText() {
    var range = document.createRange();
    range.selectNodeContents(pwEl);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function copy() {
    if (!current) return;
    var fail = function () {
      selectText();
      setStatus('Could not copy automatically. The password is selected: press Ctrl+C (or Cmd+C on a Mac).', 'err');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(current).then(function () {
        setStatus('Copied', 'ok');
      }, fail);
    } else {
      fail();
    }
  }

  /* ---------- wiring ---------- */
  function switchMode() {
    var words_ = document.querySelector('input[name="mode"]:checked').value === 'words';
    $('opts-words').hidden = !words_;
    $('opts-chars').hidden = words_;
    generate();
  }

  function enable() { copyBtn.disabled = false; againBtn.disabled = false; }

  function wire() {
    copyBtn.addEventListener('click', copy);
    againBtn.addEventListener('click', generate);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="mode"]'), function (r) {
      r.addEventListener('change', switchMode);
    });
    ['wcount', 'wcap', 'wnum', 'clen', 'ccap', 'cnum', 'csym', 'cavoid'].forEach(function (id) {
      $(id).addEventListener('change', generate);
    });
  }

  wire();
  fetch('/vendor/eff_large_wordlist.txt')
    .then(function (r) { if (!r.ok) throw new Error('bad status'); return r.text(); })
    .then(function (t) {
      words = t.split('\n').map(function (l) { return l.split('\t')[1]; })
        .filter(function (w) { return w; }).map(function (w) { return w.trim(); });
      if (words.length !== 7776) throw new Error('bad list');
      enable();
      generate();
    })
    .catch(function () {
      // Word list unavailable: fall back to random characters so the page still works.
      document.querySelector('input[value="chars"]').checked = true;
      document.querySelector('input[value="words"]').disabled = true;
      enable();
      switchMode();
      setStatus('The word list could not load, so this is a random-character password instead. Reload the page to try again.', 'err');
    });
})();
