/*
 * Motor de conversão: texto em inglês -> pronúncia escrita "à brasileira".
 *
 * Como funciona:
 *   1. Cada palavra é procurada no CMU Pronouncing Dictionary (fonemas ARPAbet).
 *   2. Os fonemas são divididos em sílabas.
 *   3. Cada fonema vira uma grafia que um brasileiro lê naturalmente.
 *
 * Funciona no navegador (window.PronunciaPT) e no Node (require/import).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PronunciaPT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VOWELS = ['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'];
  const CONSONANTS = ['B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'];
  const VOWEL_SET = new Set(VOWELS);

  // Cada fonema (vogais com tonicidade 0/1/2) ocupa 1 caractere no arquivo do dicionário.
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+*@#$%&';
  const SYMBOLS = [];
  for (const v of VOWELS) SYMBOLS.push(v + '0', v + '1', v + '2');
  for (const c of CONSONANTS) SYMBOLS.push(c);
  const SYM_TO_CHAR = new Map(SYMBOLS.map((s, i) => [s, ALPHABET[i]]));
  const CHAR_TO_SYM = new Map(SYMBOLS.map((s, i) => [ALPHABET[i], s]));

  function encode(symbols) {
    let out = '';
    for (const s of symbols) {
      const c = SYM_TO_CHAR.get(s);
      if (!c) throw new Error('Fonema desconhecido: ' + s);
      out += c;
    }
    return out;
  }

  function decode(str) {
    const out = [];
    for (const ch of str) out.push(CHAR_TO_SYM.get(ch));
    return out;
  }

  /* ---------------------------------------------------------------- */
  /* Dicionário                                                        */
  /* ---------------------------------------------------------------- */

  const dict = new Map(); // palavra -> "codigo!codigo" (variantes)

  /** Carrega o dicionário compacto: uma entrada por linha, "palavra cod1!cod2". */
  function loadDict(data) {
    dict.clear();
    let start = 0;
    while (start < data.length) {
      let end = data.indexOf('\n', start);
      if (end === -1) end = data.length;
      const sp = data.indexOf(' ', start);
      if (sp > start && sp < end) dict.set(data.slice(start, sp), data.slice(sp + 1, end));
      start = end + 1;
    }
    return dict.size;
  }

  function dictSize() {
    return dict.size;
  }

  function rawLookup(word) {
    const hit = dict.get(word);
    return hit ? hit.split('!').map(decode) : null;
  }

  const SIBILANTS = new Set(['S', 'Z', 'SH', 'ZH', 'CH', 'JH']);
  const VOICELESS = new Set(['P', 'T', 'K', 'F', 'TH', 'S', 'SH', 'CH']);

  function addS(ph) {
    const last = ph[ph.length - 1];
    if (SIBILANTS.has(last)) return ph.concat('IH0', 'Z');
    return ph.concat(VOICELESS.has(last) ? 'S' : 'Z');
  }

  function addD(ph) {
    const last = ph[ph.length - 1];
    if (last === 'T' || last === 'D') return ph.concat('IH0', 'D');
    return ph.concat(VOICELESS.has(last) ? 'T' : 'D');
  }

  function firstOf(candidates) {
    for (const c of candidates) {
      const hit = rawLookup(c);
      if (hit) return hit[0];
    }
    return null;
  }

  function undouble(s) {
    const n = s.length;
    return n > 2 && s[n - 1] === s[n - 2] ? s.slice(0, -1) : s;
  }

  /** Palavras flexionadas que não estão no dicionário (plural, -ing, -ed, -ly, 's). */
  function inflected(w) {
    let base;
    if (w.endsWith("'s")) {
      base = firstOf([w.slice(0, -2)]);
      if (base) return addS(base);
    }
    if (w.endsWith("s'")) {
      base = firstOf([w.slice(0, -1), w.slice(0, -2)]);
      if (base) return base;
    }
    if (w.length > 4 && w.endsWith('ies')) {
      base = firstOf([w.slice(0, -3) + 'y']);
      if (base) return addS(base);
    }
    if (w.length > 3 && w.endsWith('es')) {
      base = firstOf([w.slice(0, -2), w.slice(0, -1)]);
      if (base) return addS(base);
    }
    if (w.length > 3 && w.endsWith('s')) {
      base = firstOf([w.slice(0, -1)]);
      if (base) return addS(base);
    }
    if (w.length > 4 && w.endsWith('ing')) {
      const stem = w.slice(0, -3);
      base = firstOf([stem, stem + 'e', undouble(stem)]);
      if (base) return base.concat('IH0', 'NG');
    }
    if (w.length > 3 && w.endsWith('ed')) {
      const stem = w.slice(0, -2);
      base = firstOf([stem, stem + 'e', undouble(stem)]);
      if (base) return addD(base);
    }
    if (w.length > 4 && w.endsWith('ly')) {
      base = firstOf([w.slice(0, -2)]);
      if (base) return base.concat('L', 'IY0');
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Palpite para palavras fora do dicionário (regras de ortografia)   */
  /* ---------------------------------------------------------------- */

  const LETTER_NAMES = {
    a: 'EY1', b: 'B IY1', c: 'S IY1', d: 'D IY1', e: 'IY1', f: 'EH1 F', g: 'JH IY1', h: 'EY1 CH',
    i: 'AY1', j: 'JH EY1', k: 'K EY1', l: 'EH1 L', m: 'EH1 M', n: 'EH1 N', o: 'OW1', p: 'P IY1',
    q: 'K Y UW1', r: 'AA1 R', s: 'EH1 S', t: 'T IY1', u: 'Y UW1', v: 'V IY1', w: 'D AH1 B AH0 L Y UW0',
    x: 'EH1 K S', y: 'W AY1', z: 'Z IY1',
  };

  const GUESS_RULES = [
    ['tion', 'SH AH N'], ['sion', 'ZH AH N'], ['ture', 'CH ER'], ['ough', 'AH F'], ['augh', 'AO'],
    ['igh', 'AY'], ['tch', 'CH'], ['dge', 'JH'], ['eau', 'OW'], ['ae', 'EH'],
    ['ch', 'CH'], ['sh', 'SH'], ['th', 'TH'], ['ph', 'F'], ['wh', 'W'], ['ck', 'K'], ['ng', 'NG'],
    ['qu', 'K W'], ['kn', 'N'], ['wr', 'R'], ['gh', 'G'],
    ['ee', 'IY'], ['ea', 'IY'], ['oo', 'UW'], ['ou', 'AW'], ['ow', 'OW'], ['oi', 'OY'], ['oy', 'OY'],
    ['ai', 'EY'], ['ay', 'EY'], ['au', 'AO'], ['aw', 'AO'], ['ew', 'UW'], ['ie', 'IY'], ['oa', 'OW'],
    ['ue', 'UW'], ['ey', 'IY'],
    ['er', 'ER'], ['ir', 'ER'], ['ur', 'ER'], ['ar', 'AA R'], ['or', 'AO R'],
  ];
  const SHORT = { a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH' };
  const LONG = { a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW' };
  const SIMPLE = {
    b: 'B', d: 'D', f: 'F', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', q: 'K',
    r: 'R', s: 'S', t: 'T', v: 'V', w: 'W', x: 'K S', z: 'Z',
  };

  function guess(word) {
    const w = word.replace(/[^a-z]/g, '');
    const out = [];
    const isV = (ch) => 'aeiou'.includes(ch);
    let i = 0;
    while (i < w.length) {
      const rest = w.slice(i);
      const ch = w[i];
      const next = w[i + 1];

      // "e mágico": vogal + consoante + e final (make, time, home)
      if (isV(ch) && next && !isV(next) && w[i + 2] === 'e' && i + 3 === w.length && i > 0) {
        out.push(LONG[ch]);
        if (SIMPLE[next]) out.push(...SIMPLE[next].split(' '));
        else if (next === 'c') out.push('S');
        else if (next === 'g') out.push('JH');
        break;
      }

      // Consoante + "le" no fim ("griddle", "bottles"): o "e" não soa e o l fica com a vogal fraca.
      if (ch === 'l' && next === 'e' && i > 0 && !isV(w[i - 1]) && (i + 2 === w.length || (w[i + 2] === 's' && i + 3 === w.length))) {
        out.push('AH', 'L');
        if (i + 3 === w.length) out.push('Z');
        break;
      }
      const rule = GUESS_RULES.find((r) => rest.startsWith(r[0]));
      if (rule) {
        out.push(...rule[1].split(' '));
        i += rule[0].length;
        continue;
      }
      if (ch === next && !isV(ch)) { i++; continue; } // consoante dobrada
      if (ch === 'c') out.push('eiy'.includes(next || ' ') ? 'S' : 'K');
      else if (ch === 'g') out.push('eiy'.includes(next || ' ') ? 'JH' : 'G');
      else if (ch === 'y') {
        if (i === 0) out.push('Y');
        else if (i === w.length - 1) out.push(w.length <= 3 ? 'AY' : 'IY');
        else out.push('IH');
      } else if (ch === 'e' && i === w.length - 1 && out.some((p) => VOWEL_SET.has(p))) {
        // e final mudo
      } else if (isV(ch)) out.push(SHORT[ch]);
      else if (SIMPLE[ch]) out.push(...SIMPLE[ch].split(' '));
      i++;
    }
    // Tonicidade: primeira vogal tônica, as demais átonas. Antes de "-tion"/"-sion" a tônica é a vogal anterior,
    // e ela é longa: "na·tion" = NEI, "mo·tion" = MOU, "aer·a·tion" = é·REI·chân.
    let target = out.findIndex((p) => VOWEL_SET.has(p));
    if (/[ts]ion$/.test(w) && out.length >= 4 && /^(SH|ZH)$/.test(out[out.length - 3])) {
      const before = out.slice(0, out.length - 3).map((p, k) => (VOWEL_SET.has(p) ? k : -1)).filter((k) => k >= 0).pop();
      if (before !== undefined) {
        target = before;
        const LONGER = { AE: 'EY', AA: 'OW', AH: 'UW', EH: 'IY' };
        if (LONGER[out[before]] && out[before - 1] !== undefined && !VOWEL_SET.has(out[before - 1])) out[before] = LONGER[out[before]];
      }
    }
    return out.map((p, k) => (VOWEL_SET.has(p) ? p + (k === target ? '1' : '0') : p));
  }

  /* ---------------------------------------------------------------- */
  /* Sílabas                                                           */
  /* ---------------------------------------------------------------- */

  const ONSET2 = new Set(['P L', 'P R', 'B L', 'B R', 'K L', 'K R', 'G L', 'G R', 'F L', 'F R', 'T R', 'D R',
    'TH R', 'SH R', 'S P', 'S T', 'S K', 'S M', 'S N', 'S L', 'S W', 'S F', 'K W', 'T W', 'D W', 'G W']);
  const ONSET3 = new Set(['S P R', 'S P L', 'S T R', 'S K R', 'S K W']);

  function legalOnset(cluster, nextVowel) {
    const n = cluster.length;
    if (n === 0) return true;
    if (n === 1) return cluster[0] !== 'NG';
    if (cluster[n - 1] === 'Y') {
      return (nextVowel === 'UW' || nextVowel === 'UH') && n <= 3 && cluster[n - 2] !== 'Y' &&
        legalOnset(cluster.slice(0, -1), null);
    }
    if (n === 2) return ONSET2.has(cluster.join(' '));
    if (n === 3) return ONSET3.has(cluster.join(' '));
    return false;
  }

  /** Recebe [{p:'AH', s:0}, {p:'B', s:null}...] e devolve os índices onde cada sílaba começa. */
  function syllableStarts(ph) {
    const vowelIdx = [];
    ph.forEach((x, i) => { if (x.s !== null) vowelIdx.push(i); });
    const starts = [0];
    for (let k = 1; k < vowelIdx.length; k++) {
      const from = vowelIdx[k - 1] + 1;
      const to = vowelIdx[k];
      const cluster = ph.slice(from, to).map((x) => x.p);
      let split = 0;
      while (!legalOnset(cluster.slice(split), ph[to].p)) split++;
      starts.push(from + split);
    }
    return starts;
  }

  /* ---------------------------------------------------------------- */
  /* Fonema -> grafia em português                                     */
  /* ---------------------------------------------------------------- */

  const FRONT_START = new Set(['AE', 'EH', 'EY', 'IH', 'IY', 'Y']); // grafia começa com e/é/i

  function startsFront(x) {
    if (!x) return false;
    if (x.p === 'ER') return x.s === 0; // "er" (átono) x "âr" (tônico)
    return FRONT_START.has(x.p);
  }

  const isVowel = (x) => !!x && x.s !== null;
  const SYLLABIC_N_AFTER = new Set(['T', 'D', 'S', 'Z']);

  /** "people", "button": vogal fraca que some antes de L/N no fim da palavra. */
  function isSyllabicSchwa(ph, i) {
    const cur = ph[i];
    const prev = ph[i - 1];
    const next = ph[i + 1];
    if (cur.p !== 'AH' || cur.s !== 0 || !prev || isVowel(prev) || !next) return false;
    // Só no fim da palavra (ou seguido apenas de consoantes: "buttons", "student").
    if (ph.slice(i + 2).some(isVowel)) return false;
    if (next.p === 'L') return prev.p !== 'L' && prev.p !== 'R' && prev.p !== 'W' && prev.p !== 'Y';
    if (next.p === 'N') return SYLLABIC_N_AFTER.has(prev.p);
    return false;
  }

  /** Vogal fraca (schwa): é escrita "â" e exibida mais apagada. */
  function isWeak(ph, i) {
    return ph[i].p === 'AH' && ph[i].s === 0 && !isSyllabicSchwa(ph, i);
  }

  /** "water", "city": no inglês americano, o T entre vogais (antes de sílaba fraca) vira um D rápido. */
  function isFlap(ph, i) {
    const prev = ph[i - 1];
    const next = ph[i + 1];
    if (!prev || !next || !isVowel(next) || next.s === 1) return false;
    if (!isVowel(prev) && !(prev.p === 'R' && isVowel(ph[i - 2]))) return false;
    // "anytime", "military", "hesitate": antes de sílaba com tônica secundária o T continua T.
    // Exceção: o "o" final de "photo", "potato", "auto", que o dicionário marca como secundário.
    if (next.s === 2 && !(next.p === 'OW' && !ph.slice(i + 2).some(isVowel))) return false;
    // "button", "certain", "important": antes de vogal fraca + N o T fica preso na garganta, não vira D.
    const after = ph[i + 2];
    if (after && after.p === 'N' && next.s === 0 && !isVowel(ph[i + 3])) return false;
    return true;
  }

  function spell(ph, i, opts) {
    const cur = ph[i];
    const prev = ph[i - 1];
    const next = ph[i + 1];
    const stressed = cur.s === 1;
    switch (cur.p) {
      // Vogais
      case 'AA': return 'a';
      case 'AE': return 'é';
      case 'AH':
        if (cur.s) return 'â';
        if (isSyllabicSchwa(ph, i)) return '';
        // No fim de palavra o brasileiro já lê o "a" fraco (como em "casa").
        if (i === ph.length - 1 && ph.filter(isVowel).length > 1) return 'a';
        return 'â';
      case 'AO': return 'ó';
      case 'AW': return 'au';
      case 'AY': return 'ai';
      case 'EH': return 'é';
      case 'ER': return cur.s ? 'âr' : 'er';
      case 'EY': return 'ei';
      case 'IH': return 'i';
      case 'IY': return stressed ? 'ii' : 'i';
      case 'OW': return 'ou';
      case 'OY': return 'ói';
      case 'UH': return 'u';
      case 'UW': return stressed ? 'uu' : 'u';
      // Consoantes
      case 'B': return 'b';
      case 'CH': return 'tch';
      case 'D': return 'd';
      case 'DH': return opts.simpleTh ? 'd' : 'dh';
      case 'F': return 'f';
      case 'G': {
        // "figure" (FIG·ier): antes de Y o g fecha a sílaba; só "argue" (G + YU na mesma sílaba) pede gu.
        const after = ph[i + 2];
        if (next && next.p === 'Y' && !(after && (after.p === 'UW' || after.p === 'UH'))) return 'g';
        return startsFront(next) ? 'gu' : 'g';
      }
      case 'HH': return 'rr';
      case 'JH': return 'dj';
      case 'K': return 'k';
      case 'L': return 'l';
      case 'M': return 'm';
      case 'N': return 'n';
      case 'NG':
        // "sing·ing", "sing·er": sem estalar o g. Só "finger", "think" (NG + G/K) viram "n".
        if (next && (next.p === 'K' || next.p === 'G')) return 'n';
        return 'ng';
      case 'P': return 'p';
      case 'R': return 'r';
      case 'S': {
        const vowelBefore = prev && prev.s !== null && prev.p !== 'ER';
        // "lesson": a vogal que some não conta, então fica "LÉ·sn", não "LÉ·ssn".
        const vowelAfter = isVowel(next) && !isSyllabicSchwa(ph, i + 1);
        return vowelBefore && vowelAfter ? 'ss' : 's';
      }
      case 'SH': return 'ch';
      case 'T': return isFlap(ph, i) ? 'd' : 't';
      case 'TH': return opts.simpleTh ? 't' : 'th';
      case 'V': return 'v';
      case 'W':
        if (next && (next.p === 'UW' || next.p === 'UH')) return 'w';
        if (prev && prev.p === 'G' && startsFront(next)) return 'w';
        return 'u';
      case 'Y': return next && (next.p === 'IH' || next.p === 'IY') ? 'y' : 'i';
      case 'Z': return 'z';
      case 'ZH': return 'j';
      default: return '';
    }
  }

  /** Fonemas ARPAbet (ex.: ['HH','AH0','L','OW1']) -> sílabas [{t:'rra', s:false}, {t:'lou', s:true}] */
  function toSyllables(symbols, opts) {
    opts = opts || {};
    const ph = symbols.map((sym) => {
      const m = /^([A-Z]+)([012])?$/.exec(sym);
      return { p: m[1], s: m[2] === undefined ? null : Number(m[2]) };
    });
    // "around", "salary": o "er" fraco antes de vogal é um â, e o r começa a sílaba seguinte (â·RAUND).
    for (let i = ph.length - 2; i >= 0; i--) {
      if (ph[i].p === 'ER' && ph[i].s === 0 && ph[i + 1].s !== null) ph.splice(i, 1, { p: 'AH', s: 0 }, { p: 'R', s: null });
    }
    const starts = syllableStarts(ph);
    const syllables = [];
    for (let k = 0; k < starts.length; k++) {
      const end = k + 1 < starts.length ? starts[k + 1] : ph.length;
      let text = '';
      let stressed = false;
      const parts = []; // trechos com a marca de vogal fraca, para a tela
      for (let i = starts[k]; i < end; i++) {
        const piece = spell(ph, i, opts);
        const weak = isWeak(ph, i);
        text += piece;
        if (ph[i].s === 1) stressed = true;
        const last = parts[parts.length - 1];
        if (last && last.w === weak) last.t += piece;
        else if (piece) parts.push({ t: piece, w: weak });
      }
      syllables.push({ t: text, s: stressed, parts });
    }
    // Monossílabos não recebem marca de tônica.
    if (syllables.length === 1) syllables[0].s = false;
    return syllables;
  }

  /* ---------------------------------------------------------------- */
  /* Números por extenso                                               */
  /* ---------------------------------------------------------------- */

  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
    'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function intToWords(n) {
    if (n < 20) return [ONES[n]];
    if (n < 100) return [TENS[Math.floor(n / 10)]].concat(n % 10 ? [ONES[n % 10]] : []);
    if (n < 1000) return [ONES[Math.floor(n / 100)], 'hundred'].concat(n % 100 ? intToWords(n % 100) : []);
    const scales = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
    for (const [value, name] of scales) {
      if (n >= value) {
        return intToWords(Math.floor(n / value)).concat(name, n % value ? intToWords(n % value) : []);
      }
    }
    return [];
  }

  function numberToWords(text) {
    const clean = text.replace(/,(?=\d{3})/g, '').replace(',', '.');
    const intPart = clean.split('.')[0];
    const decPart = (clean.split('.')[1] || '').replace(/\D.*$/, '');
    let words;
    if (intPart.length > 12) words = intPart.split('').map((d) => ONES[Number(d)]);
    else words = intToWords(Number(intPart));
    // "100.00" = one hundred: casas decimais zeradas não se falam.
    if (decPart && /[1-9]/.test(decPart)) words = words.concat('point', decPart.split('').map((d) => ONES[Number(d)]));
    return words;
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
    'November', 'December'];
  const FRACTIONS = { '1/2': ['one', 'half'], '1/3': ['one', 'third'], '1/4': ['one', 'quarter'],
    '2/3': ['two', 'thirds'], '3/4': ['three', 'quarters'], '½': ['one', 'half'], '⅓': ['one', 'third'],
    '¼': ['one', 'quarter'], '⅔': ['two', 'thirds'], '¾': ['three', 'quarters'] };
  const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/;

  const ORDINAL = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth',
    twelve: 'twelfth' };

  function toOrdinal(word) {
    if (ORDINAL[word]) return ORDINAL[word];
    return word.endsWith('y') ? word.slice(0, -1) + 'ieth' : word + 'th';
  }

  const NUMBER_RE = /^(\$ ?)?(\d+(?:,\d{3})*(?:\.\d+)?)(?::(\d\d))?(%|[a-z]+)?$/i;
  // Telefone americano: "(516) 934-8578", "631-668-4400", "603 444-6245", "934-8578".
  const PHONE_RE = /^(?:\(\d{3}\) ?|\d{3}[-. ])?\d{3}[-.]\d{4}(?!\d)$/;
  const DIGIT_NAMES = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

  /** "web.matheus@gmail.com" -> "web dot M A T H E U S at gmail dot com": palavra do dicionário é lida, o resto soletrado. */
  function emailWords(piece) {
    const out = [];
    const symbols = { '@': 'at', '.': 'dot', '_': 'underscore', '-': 'dash', '+': 'plus' };
    for (const part of piece.split(/([@._+-])/)) {
      if (!part) continue;
      if (symbols[part]) out.push(pronounce(symbols[part]).variants[0]);
      else if (rawLookup(part.toLowerCase())) out.push(pronounce(part.toLowerCase()).variants[0]);
      else {
        for (const ch of part.toLowerCase()) {
          out.push(/\d/.test(ch) ? pronounce(ONES[Number(ch)]).variants[0] : LETTER_NAMES[ch].split(' '));
        }
      }
    }
    return out;
  }

  /** Número de formulário ou código: "DS-160" = one sixty, "ETA-9142" = ninety-one forty-two, "401k" = four oh one. */
  function codeNumber(digits) {
    const tail = (lo) => (lo === 0 ? ['hundred'] : lo < 10 ? ['oh', ONES[lo]] : intToWords(lo));
    if (/^[1-9]\d\d$/.test(digits)) return [ONES[Number(digits[0])]].concat(tail(Number(digits.slice(1))));
    if (/^[1-9]\d{3}$/.test(digits)) return intToWords(Number(digits.slice(0, 2))).concat(tail(Number(digits.slice(2))));
    return numberToWords(digits);
  }

  /** "$15.50", "7:30", "1st", "90s", "10%", "5pm", "3/25/26", "1/2" -> palavras em inglês, como se fala. */
  function spokenNumber(piece, code) {
    if (FRACTIONS[piece]) return FRACTIONS[piece].slice();
    if (code && /^\d+$/.test(piece)) return codeNumber(piece);
    // Só centavos: "$.20" = twenty cents.
    const cents = /^\$\.(\d+)$/.exec(piece);
    if (cents) {
      const c = Number(cents[1].padEnd(2, '0').slice(0, 2));
      return intToWords(c).concat(c === 1 ? 'cent' : 'cents');
    }
    // Data americana (mês/dia/ano): "3/25/26" = March twenty-fifth, twenty twenty-six.
    const date = DATE_RE.exec(piece);
    if (date) {
      const [month, day] = [Number(date[1]), Number(date[2])];
      const year = date[3].length === 2 ? '20' + date[3] : date[3];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const dayWords = intToWords(day);
        dayWords[dayWords.length - 1] = toOrdinal(dayWords[dayWords.length - 1]);
        return [MONTHS[month - 1]].concat(dayWords, spokenNumber(year));
      }
      return [].concat(...piece.split('/').map((part) => numberToWords(part)));
    }
    // Telefone, com ou sem traços (7, 10 ou 11 dígitos), é lido dígito a dígito; "1000000" continua um milhão.
    // Também o número que começa com zero, como o CEP "02601".
    if (PHONE_RE.test(piece) || /^0\d+$/.test(piece) || (/^(?:\d{7}|\d{10,11})$/.test(piece) && !piece.endsWith('000'))) {
      return piece.replace(/\D/g, '').split('').map((d) => DIGIT_NAMES[Number(d)]);
    }
    const m = NUMBER_RE.exec(piece);
    const money = !!m[1];
    const suffix = (m[4] || '').toLowerCase();
    let words;
    if (m[3] !== undefined) {
      // Hora: "7:30" = seven thirty, "4:05" = four oh five, "7:00" = seven.
      const min = Number(m[3]);
      words = numberToWords(m[2]).concat(min === 0 ? [] : min < 10 ? ['oh', ONES[min]] : intToWords(min));
    } else if (money) {
      const [dollars, cents] = m[2].replace(/,(?=\d{3})/g, '').split('.');
      words = numberToWords(dollars).concat(Number(dollars) === 1 ? 'dollar' : 'dollars');
      if (cents && Number(cents)) {
        const c = Number(cents.padEnd(2, '0').slice(0, 2));
        words = words.concat('and', intToWords(c), c === 1 ? 'cent' : 'cents');
      }
    } else if (/^\d{4}$/.test(m[2]) && m[2] >= '1100' && m[2] <= '2099' && !/^200\d$/.test(m[2])
      && ['', 's'].includes(suffix)) {
      // Ano (e milhares redondos): "2027" = twenty twenty-seven, "1990s" = nineteen nineties, "1500" = fifteen hundred.
      const lo = Number(m[2].slice(2));
      words = intToWords(Number(m[2].slice(0, 2))).concat(lo === 0 ? ['hundred'] : lo < 10 ? ['oh', ONES[lo]] : intToWords(lo));
    } else {
      words = numberToWords(m[2]);
    }
    const last = words.length - 1;
    if (['st', 'nd', 'rd', 'th'].includes(suffix)) words[last] = toOrdinal(words[last]);
    else if (suffix === 's') words[last] = words[last].endsWith('y') ? words[last].slice(0, -1) + 'ies' : words[last] + 's';
    else if (suffix === '%') words.push('percent');
    else if (suffix === 'am' || suffix === 'pm') words.push(suffix.toUpperCase());
    return words;
  }

  /* ---------------------------------------------------------------- */
  /* API principal                                                     */
  /* ---------------------------------------------------------------- */

  /* ---------------------------------------------------------------- */
  /* Palavras com mais de uma pronúncia (o motor escolhe sozinho)       */
  /* ---------------------------------------------------------------- */

  const bare = (ph) => ph.map((x) => x.replace(/\d$/, ''));
  const startsWithSound = (ph, prefix) => {
    const a = bare(ph);
    const b = bare(prefix);
    return b.length <= a.length && b.every((x, i) => x === a[i]);
  };
  const vowelsOf = (ph) => ph.filter((x) => /\d$/.test(x));
  const primaryIndex = (ph) => vowelsOf(ph).findIndex((x) => x.endsWith('1'));
  // Consoantes da palavra (o ER conta como R), para achar pares que só mudam a sílaba forte.
  const skeleton = (ph) => ph.flatMap((x) => (x.startsWith('ER') ? ['R'] : /\d$/.test(x) ? [] : [x])).join(' ');
  // Mesmo som, ignorando a vogal fraca (AH, IH, IY ou EH átonos): "ri·ZUUM" e "rii·ZUUM" são a mesma leitura.
  const soundKey = (ph) => ph.map((x) => (/^(AH|IH|IY|EH)[02]$/.test(x) ? '@' : x.replace(/[02]$/, ''))).join(' ');

  /** Formas flexionadas da palavra que o dicionário tem, com o peso de cada uma para achar o verbo. */
  function familyForms(w) {
    const stem = w.endsWith('e') ? w.slice(0, -1) : w;
    const doubled = w + w.charAt(w.length - 1);
    const forms = [[w + 's', 1], [w + 'es', 1], [w + 'ed', 1], [w + 'd', 1], [doubled + 'ed', 1],
      // O -ing é a forma mais clara de verbo: vale o dobro.
      [w + 'ing', 2], [stem + 'ing', 2], [doubled + 'ing', 2]];
    const seen = new Set();
    return forms.filter(([f]) => f !== w && !seen.has(f) && seen.add(f) && rawLookup(f));
  }

  /** A pronúncia do verbo é a que combina com as flexões do próprio dicionário ("living" -> live = liv). */
  function verbVariant(w, variants) {
    const groups = new Map();
    for (const v of variants) {
      const k = soundKey(v);
      if (!groups.has(k)) groups.set(k, { v, score: 0 });
    }
    if (groups.size < 2) return null;
    const family = familyForms(w);
    // Sem a forma -ing no dicionário, a palavra não é verbo ("are", "to", "skier"): fica como está.
    if (!family.some(([, weight]) => weight === 2)) return null;
    for (const [form, weight] of family) {
      const formVariants = rawLookup(form);
      for (const g of groups.values()) {
        if (variants.some((v) => soundKey(v) === soundKey(g.v) && formVariants.some((f) => startsWithSound(f, v)))) {
          g.score += weight;
        }
      }
    }
    const ranked = [...groups.values()].sort((a, b) => b.score - a.score);
    if (ranked[0].score <= ranked[1].score) return null;
    const verb = ranked[0].v;
    // Uma leitura que é a outra com um som a menos é só fala rápida, não outra palavra:
    // LÉND·skeip/LÉN·skeip, SÉN·ter/SÉ·ner, kam/kalm, RRAI·er/rrair.
    const flat = (v) => bare(v).map((x) => (x === 'ER' ? 'R' : x));
    const reduction = (a, b) => {
      const [s, l] = a.length <= b.length ? [a, b] : [b, a];
      let i = 0;
      for (const x of l) if (x === s[i]) i++;
      return i === s.length;
    };
    if (variants.some((v) => soundKey(v) !== soundKey(verb) && reduction(flat(v), flat(verb)))) return null;
    return verb;
  }

  const hasVerbForm = (w) => familyForms(w).some(([, weight]) => weight === 2);

  /**
   * role: 'verb', 'noun', 'other' (depois de "is", "have": adjetivo ou particípio) ou null (o contexto não diz).
   * Sem sinal claro, a ordem do dicionário fica, menos nos pares de tônica, em que o substantivo é o mais comum.
   */
  function chooseVariant(w, variants, role) {
    // Palavra com forma fraca ("and" = ând/énd, "to" = tâ/tuu) é palavra de ligação: fica na ordem do dicionário.
    if (variants.some((v) => primaryIndex(v) < 0)) return null;
    // Pares que só mudam a sílaba forte (record, permit, contract): substantivo antes, verbo depois.
    // (Só palavras de 2+ sílabas com tônica nas duas leituras: "to" = tuu/tâ é só a forma fraca.)
    const stressed = (v) => vowelsOf(v).length > 1 && vowelsOf(v).filter((x) => x.endsWith('1')).length === 1;
    const pairs = variants.filter((v) => stressed(v) && variants.some((o) => o !== v && stressed(o)
      && skeleton(o) === skeleton(v) && vowelsOf(o).length === vowelsOf(v).length && primaryIndex(o) !== primaryIndex(v)));
    // Só palavras que também são verbo ("recording" existe; "yourself" e "effectively", não).
    if (pairs.length && hasVerbForm(w)) {
      if (role === 'other' || role === 'start' || role === 'place') return null;
      // Entre as leituras com a tônica no lugar certo, vale a primeira do dicionário.
      const target = role === 'verb' ? Math.max(...pairs.map(primaryIndex)) : Math.min(...pairs.map(primaryIndex));
      return pairs.find((v) => primaryIndex(v) === target);
    }
    if (!role || pairs.length) return null;
    const verb = verbVariant(w, variants);
    if (!verb) return null;
    // No começo da frase, a palavra é imperativo: "Use the gloves", "Close the door".
    if (role === 'verb' || role === 'start' || role === 'place') return verb;
    // O substantivo (ou adjetivo) precisa aparecer no plural ou no advérbio do dicionário: "uses" tem "iuus",
    // "lively" tem "laiv", "closely" tem "klous". Se não aparece, as leituras são só variantes de sotaque.
    const others = variants.filter((v) => soundKey(v) !== soundKey(verb));
    const stem = w.endsWith('e') ? w.slice(0, -1) : w;
    const forms = role === 'other' ? [w + 'ly', stem + 'ly'] : [w + 's', w + 'es', w + 'ly', stem + 'ly'];
    const evidence = forms.map(rawLookup).filter(Boolean).flat();
    return others.find((o) => evidence.some((f) => startsWithSound(f, o))) || null;
  }

  /** Põe na frente a pronúncia que o contexto pede; no plural, decide pela palavra no singular ("their lives"). */
  function orderByContext(w, variants, role) {
    if (variants.length < 2) return variants;
    let chosen = chooseVariant(w, variants, role);
    if (!chosen && w.length > 3 && w.endsWith('s')) {
      const base = rawLookup(w.slice(0, -1));
      const one = base && base.length > 1 ? chooseVariant(w.slice(0, -1), base, role) : null;
      if (one) chosen = variants.find((v) => bare(v).join(' ') === bare(addS(one)).join(' ')) || null;
    }
    return chosen ? [chosen].concat(variants.filter((v) => v !== chosen)) : variants;
  }

  /**
   * Flexão que não combina com a palavra base ("mowing" = MAU·ing, mas "mow" = MOU): é refeita pela base,
   * desde que outra forma da mesma família confirme a base ("mowed", "mower").
   */
  function alignWithBase(w, hit) {
    const rules = [['ing', (ph) => ph.concat('IH0', 'NG')], ['es', addS], ['s', addS], ['er', (ph) => ph.concat('ER0')]];
    for (const [suffix, build] of rules) {
      if (!w.endsWith(suffix) || w.length < suffix.length + 3) continue;
      const stem = w.slice(0, -suffix.length);
      // "-er" só depois de vogal ("ski·er"): "paper", "later" e "cover" não são "pap", "lat" e "cove" + er.
      const candidates = suffix === 'er'
        ? (/[aiou]$/.test(stem) ? [stem] : [])
        : [stem, stem + 'e', undouble(stem)];
      const bases = candidates.filter((b, i) => candidates.indexOf(b) === i && rawLookup(b));
      if (!bases.length) continue;
      const fits = (v) => bases.some((b) => rawLookup(b).some((bv) => startsWithSound(v, bv)));
      if (fits(hit[0])) return hit;
      // Outra leitura do dicionário é exatamente a base + o sufixo ("skier" = ski + er): ela vai primeiro.
      const fitting = hit.find((v) => bases.some((b) => rawLookup(b).some((bv) => bare(v).join(' ') === bare(build(bv)).join(' '))));
      if (fitting) return [fitting].concat(hit.filter((v) => v !== fitting));
      // Palavras curtas ficam como estão: "says" e "does" são irregulares, não erros.
      if (w.length < 5) return hit;
      const base = bases[0];
      const rebuilt = build(rawLookup(base)[0]);
      // Só quando a diferença é uma única vogal trocada (MAU·ing x MOU·ing), não uma palavra diferente.
      const a = bare(rebuilt);
      const b = bare(hit[0]);
      const diff = a.length === b.length ? a.filter((x, i) => x !== b[i]) : null;
      if (!diff || diff.length !== 1 || !VOWEL_SET.has(diff[0])) return hit;
      const support = familyForms(base).filter(([f]) => f !== w
        && rawLookup(f).some((fv) => startsWithSound(fv, rawLookup(base)[0])));
      return support.length ? [rebuilt].concat(hit) : hit;
    }
    return hit;
  }

  // Contexto que pede verbo: "to use", "I live", "can lead", "always use".
  const VERB_CONTEXT = new Set(['to', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'who', 'can', 'could', 'will',
    'would', 'should', 'must', 'may', 'might', 'do', 'does', 'did', "don't", "doesn't", "didn't", "can't", 'cannot',
    "won't", 'not', 'never', 'always', 'also', 'usually', 'often', 'sometimes', 'really', 'just', 'still', 'please',
    'and', 'or', "i'll", "we'll", "you'll", "they'll", "i'd", "we'd", 'people', 'children', 'men', 'women']);
  // Depois de "is" ou "have" vem adjetivo ou particípio: "is close", "have read".
  const OTHER_CONTEXT = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', "i've", "we've",
    "you've", "it's", "i'm", "you're", "we're", "they're"]);
  // No começo da frase, artigo ou pronome depois indica imperativo: "Use the...", "Record your...".
  const DETERMINERS = new Set(['the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these',
    'those', 'it', 'them', 'me', 'us', 'him', 'some', 'all', 'any', 'every', 'each']);

  const PLACE_WORDS = new Set(['in', 'on', 'at', 'with', 'near', 'here', 'there', 'from']);

  function contextRole(prev, next, atStart) {
    if (prev && VERB_CONTEXT.has(prev)) return 'verb';
    if (prev && OTHER_CONTEXT.has(prev)) return 'other';
    if (prev && DETERMINERS.has(prev)) return 'noun'; // "the wind", "my resume", "a separate room"
    if (next && DETERMINERS.has(next)) return 'verb'; // "use the", "record your"
    // Depois de um sujeito no plural vem o verbo: "employees use", "workers record".
    if (prev && prev.length > 3 && /[^s']s$/.test(prev)) return 'verb';
    if (!prev && atStart) return 'start';
    // Antes de "in", "here", "with": verbo ("my sister live in"); o adjetivo viria antes de um substantivo.
    return next && PLACE_WORDS.has(next) ? 'place' : null;
  }

  // Abreviações de anúncio de vaga, lidas por extenso.
  const ABBREVIATIONS = { hr: 'hour', hrs: 'hours', yr: 'year', yrs: 'years', wk: 'week', wks: 'weeks',
    wknd: 'weekend', wknds: 'weekends', mins: 'minutes', approx: 'approximately', ft: 'feet', yd: 'yard',
    yds: 'yards', sq: 'square', attn: 'attention' };
  // Prefixos: no composto a tônica fica na segunda parte ("pre·apPROVED").
  const PREFIXES = new Set(['pre', 're', 'un', 'non', 'mis', 'sub', 'co']);
  // Dias e meses abreviados, só com a inicial maiúscula ("Mon-Sun", "Sep"): "sun" e "sat" minúsculos são palavras.
  const CAPITAL_ABBREVIATIONS = { Mon: 'Monday', Tue: 'Tuesday', Tues: 'Tuesday', Wed: 'Wednesday',
    Thu: 'Thursday', Thur: 'Thursday', Thurs: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
    Feb: 'February', Apr: 'April', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Sept: 'September',
    Oct: 'October', Nov: 'November', Dec: 'December',
    Rd: 'road', Ave: 'avenue', Hwy: 'highway', Ln: 'lane', Ste: 'suite', Apt: 'apartment', Pkwy: 'parkway' };
  // Palavras curtas comuns que, em texto todo em maiúsculas ("UP TO", "IS"), não são siglas.
  const CAPS_WORDS = new Set(['TO', 'OF', 'IS', 'IN', 'OR', 'BE', 'UP', 'ON', 'AT', 'AN', 'AS', 'BY', 'DO', 'GO',
    'HE', 'IF', 'ME', 'MY', 'NO', 'SO', 'WE']);

  /** "worksite", "jobsites": duas palavras do dicionário juntas. Escolhe o corte com as partes mais equilibradas. */
  function compound(w) {
    let best = null;
    const demote = (ph) => ph.map((x) => x.replace(/1$/, '2'));
    for (let k = 3; k + 3 <= w.length; k++) {
      const a = rawLookup(w.slice(0, k));
      const bHit = rawLookup(w.slice(k));
      const b = bHit ? bHit[0] : inflected(w.slice(k));
      const size = Math.min(k, w.length - k);
      if (a && b && (!best || size > best.size)) {
        // A segunda parte perde a tônica principal ("WORK·site"); depois de prefixo, é a primeira ("prii·â·PRUUVD").
        best = { size, ph: PREFIXES.has(w.slice(0, k)) ? demote(a[0]).concat(b) : a[0].concat(demote(b)) };
      }
    }
    return best && best.ph;
  }

  /**
   * Pronúncias de uma palavra.
   * Retorna { source: 'dict' | 'guess', variants: [ [fonemas...] ] }
   */
  function pronounce(word) {
    const w = word.toLowerCase().replace(/[’‘`]/g, "'");
    // Siglas de 2 letras viram letras mesmo quando são palavras: "the US", "IT", "7 AM".
    if (/^[A-Z]{2}$/.test(word) && !CAPS_WORDS.has(word)) {
      return { source: 'dict', variants: [[...LETTER_NAMES[w[0]].split(' '), ...LETTER_NAMES[w[1]].split(' ')]] };
    }
    if (word === 'Dr') return pronounce('doctor');
    if (w === 'www') return { source: 'dict', variants: [[].concat(...[0, 1, 2].map(() => LETTER_NAMES.w.split(' ')))] };
    if (ABBREVIATIONS[w]) return pronounce(ABBREVIATIONS[w]);
    if (CAPITAL_ABBREVIATIONS[word]) return pronounce(CAPITAL_ABBREVIATIONS[word]);
    // Em maiúsculas ("MON-FRI", "AVE"), menos SAT, SUN e WED, que também são palavras ("THE SUN").
    const title = word.charAt(0) + word.slice(1).toLowerCase();
    if (/^[A-Z]{3,5}$/.test(word) && CAPITAL_ABBREVIATIONS[title] && !['SAT', 'SUN', 'WED'].includes(word)) {
      return pronounce(CAPITAL_ABBREVIATIONS[title]);
    }
    let hit = rawLookup(w);
    if (hit) hit = alignWithBase(w, hit);
    // O dicionário tem alguns possessivos sem o s final ("cabela's"): completa.
    if (hit && w.endsWith("'s")) hit = hit.map((v) => (/^[SZ]$/.test(v[v.length - 1]) ? v : addS(v)));
    if (hit) return { source: 'dict', variants: hit };
    const viaInflection = inflected(w);
    if (viaInflection) return { source: 'dict', variants: [viaInflection] };
    // Siglas em maiúsculas (ex.: "NBA"): soletra.
    if (word.length <= 5 && /^[A-Z]+$/.test(word)) {
      const spelled = [];
      for (const ch of w) spelled.push(...LETTER_NAMES[ch].split(' '));
      return { source: 'guess', variants: [spelled] };
    }
    if (w.length === 1 && LETTER_NAMES[w]) return { source: 'guess', variants: [LETTER_NAMES[w].split(' ')] };
    // No plural, corta a palavra sem o s ("jobsite·s"), para não sair "jobs·ites".
    const singular = w.length > 6 && w.endsWith('s') ? compound(w.slice(0, -1)) : null;
    const joined = singular ? addS(singular) : compound(w);
    if (joined) return { source: 'guess', variants: [joined] };
    return { source: 'guess', variants: [guess(w)] };
  }

  // Letras com acento entram na palavra ("João"), para ela não ser cortada no meio.
  const TOKEN_RE = new RegExp(
    '[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+|[½⅓¼⅔¾]|' +
    "[ap]\\.m\\.|e\\.g\\.|i\\.e\\.|[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)*" +
    '|\\d{1,2}/\\d{1,2}/(?:\\d{4}|\\d{2})(?![\\d/])|(?:1/[234]|2/3|3/4)(?![\\d/])' +
    '|' + PHONE_RE.source.slice(1, -1) +
    // Vírgula só como separador de milhar ("1,200"); "87,71,89" é uma lista de números.
    '|\\$\\.\\d+|\\$ ?\\d+(?:,\\d{3})*(?:\\.\\d+)?|\\d+(?:,\\d{3})*(?:\\.\\d+)?(?::\\d\\d)?(?:%|(?:st|nd|rd|th|s|am|pm)(?![A-Za-z]))?' +
    // O "$" antes de um número fica para o número: "($300", "-$35", "$.20".
    '|\\s+|(?:(?!\\$ ?\\.?\\d)[^\\sA-Za-zÀ-ÖØ-öø-ÿ\\d])+', 'gi');

  const DAY_WORDS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue',
    'tues', 'wed', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun']);

  /**
   * Faixas: o traço entre dois números, valores, horários ou dias se lê "to" ("1-5" = one to five,
   * "Monday-Friday", "8am – 4pm"). Códigos ("DS-160", "SOC 37-3011") e telefones ficam como estão.
   */
  function readRanges(tokens, opts) {
    const solid = (i, step) => {
      for (let k = i + step; k >= 0 && k < tokens.length; k += step) if (/\S/.test(tokens[k].text)) return k;
      return -1;
    };
    const isDay = (t) => t && t.type === 'word' && DAY_WORDS.has(t.text.toLowerCase());
    const endsTime = (k) => {
      // "7:00 AM - 7:00 PM": o AM/PM depois de um número fecha o horário da esquerda.
      const t = tokens[k];
      if (!t || t.type !== 'word' || !/^[ap]\.?m\.?$/i.test(t.text)) return false;
      const before = tokens[solid(k, -1)];
      return !!before && before.number;
    };
    const to = { type: 'word', text: 'to', source: 'dict', variants: [{ words: [toSyllables(pronounce('to').variants[0], opts)] }] };
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'sep' || !/^(?:-|–|—|--)$/.test(tokens[i].text)) continue;
      const l = solid(i, -1);
      const r = solid(i, 1);
      if (l < 0 || r < 0) continue;
      const left = tokens[l];
      const right = tokens[r];
      let range = (isDay(left) && isDay(right)) || ((left.number || endsTime(l)) && right.number);
      // Dois números simples: a faixa sobe e os dois têm tamanho parecido ("5-10", não o código "37-3011").
      const plain = /^(\d+)(?:\.\d+)?$/;
      if (range && plain.test(left.text) && plain.test(right.text)) {
        const [a, b] = [plain.exec(left.text)[1], plain.exec(right.text)[1]];
        range = Number(right.text) > Number(left.text) && b.length - a.length <= 1;
      }
      if (!range) continue;
      tokens.splice(l + 1, r - l - 1, { type: 'sep', text: ' ' }, to, { type: 'sep', text: ' ' });
      i = l + 3;
    }
  }

  /**
   * Converte um texto inteiro.
   * Retorna tokens:
   *   { type: 'word', text, source, variants: [ { words: [ [ {t, s} ] ] } ] }
   *   { type: 'sep', text }
   */
  function convertText(text, opts) {
    opts = opts || {};
    const tokens = [];
    const matches = text.match(TOKEN_RE) || [];
    let sentenceStart = true;
    let afterNumber = false; // "7 am": o am depois de um número é a sigla, não o verbo
    let keptName = false; // a palavra anterior ficou como estava escrita (nome)
    const pushWord = (tok) => {
      // "H-2B", "B1": número e letra grudados ganham um hífen, para não virar uma palavra só.
      if (tokens.length && tokens[tokens.length - 1].type === 'word') tokens.push({ type: 'sep', text: '-' });
      tokens.push(tok);
    };
    for (let mi = 0; mi < matches.length; mi++) {
      const raw = matches[mi];
      try {
        convertPiece(raw, mi);
      } catch (err) {
        // Um pedaço que o motor não entende fica como está escrito, em vez de derrubar o texto todo.
        tokens.push({ type: 'sep', text: raw });
      }
    }
    function convertPiece(raw, mi) {
      const wasStart = sentenceStart;
      const wasAfterNumber = afterNumber;
      if (/\S/.test(raw)) {
        sentenceStart = !/^[A-Za-zÀ-ÖØ-öø-ÿ\d$]/.test(raw) && (/[.!?:\n]/.test(raw) || wasStart);
        afterNumber = /^\$?\d/.test(raw);
      } else if (/\n/.test(raw)) {
        sentenceStart = true;
      }
      const prev = tokens[tokens.length - 1];
      const prev2 = tokens[tokens.length - 2];
      let piece = /^[ap]\.m\.$/i.test(raw) || (wasAfterNumber && /^[ap]m$/i.test(raw))
        ? raw.replace(/\./g, '').toUpperCase() : raw;
      // "$17.40/HR", "40 HOURS/WK": depois da barra é unidade, não sigla.
      if (prev && prev.text.endsWith('/') && /^[A-Z]{2,4}$/.test(piece) && ABBREVIATIONS[piece.toLowerCase()]) {
        piece = piece.toLowerCase();
      }
      // "$17.40-18.40", "$12.84 - 17.78": o segundo valor da faixa também é em dólares.
      if (/^\d/.test(piece)) {
        const back = [];
        for (let i = tokens.length - 1; i >= 0 && back.length < 2; i--) if (/\S/.test(tokens[i].text)) back.unshift(tokens[i]);
        if (back.length === 2 && /^[-–]$/.test(back[1].text) && back[0].money) piece = '$' + piece;
      }
      const wasKept = keptName;
      if (/\S/.test(raw)) keptName = false;
      if (/^(?:e\.g|i\.e)\.$/i.test(piece)) {
        const words = (/^e/i.test(piece) ? ['for', 'example'] : ['that', 'is']).map((w) => toSyllables(pronounce(w).variants[0], opts));
        pushWord({ type: 'word', text: raw, source: 'dict', variants: [{ words }] });
      } else if (piece.includes('@')) {
        pushWord({ type: 'word', text: raw, source: 'dict', variants: [{ words: emailWords(piece).map((ph) => toSyllables(ph, opts)) }] });
      } else if (FRACTIONS[piece]) {
        const words = FRACTIONS[piece].map((w) => toSyllables(pronounce(w).variants[0], opts));
        pushWord({ type: 'word', text: raw, source: 'dict', variants: [{ words }] });
      } else if (/[À-ÖØ-öø-ÿ]/.test(piece) || (opts.keep && opts.keep.has(piece.toLowerCase()))) {
        // Palavra com acento é português ("João", "São"), e opts.keep traz nomes a manter: ficam como estão.
        tokens.push({ type: 'sep', text: raw, kept: true });
        keptName = true;
      } else if (/^[A-Za-z]/.test(piece)) {
        // "MON-SUN": SAT, SUN e WED em maiúsculas só são dias quando estão numa faixa com hífen.
        if (/^(?:SAT|SUN|WED)$/.test(piece) && ((prev && /^[-–]$/.test(prev.text)) || /^[-–]$/.test(matches[mi + 1] || ''))) {
          piece = piece.charAt(0) + piece.slice(1).toLowerCase();
        }
        let res = pronounce(piece);
        // "used to" (costumava, acostumado) tem som de s: "iuust tu". Fora disso, "used" é "iuuzd".
        if (/^used$/i.test(piece) && /^\s+$/.test(matches[mi + 1] || '') && /^to$/i.test(matches[mi + 2] || '')) {
          res = { source: 'dict', variants: [['Y', 'UW1', 'S', 'T']] };
        }
        // Palavra com mais de uma pronúncia: as palavras vizinhas dizem se é verbo ou substantivo.
        if (res.source === 'dict' && res.variants.length > 1) {
          const before = prev && /^[ \t]+$/.test(prev.text) && prev2 && /^[A-Za-z']+$/.test(prev2.text) ? prev2.text.toLowerCase() : null;
          const after = /^[ \t]+$/.test(matches[mi + 1] || '') && /^[A-Za-z']+$/.test(matches[mi + 2] || '')
            ? matches[mi + 2].toLowerCase() : null;
          res = { source: res.source, variants: orderByContext(piece.toLowerCase(), res.variants, contextRole(before, after, wasStart)) };
        }
        // Nome no meio da frase fora do dicionário ("Pessoa") ou logo depois de um nome mantido
        // ("São Paulo"): fica como está escrito.
        if (/^[A-Z][a-z]/.test(piece) && (wasKept || (res.source === 'guess' && !wasStart))) {
          tokens.push({ type: 'sep', text: raw, kept: true });
          keptName = true;
          return;
        }
        const seen = new Set();
        const variants = [];
        for (const symbols of res.variants) {
          if (!symbols.length) continue;
          const syl = toSyllables(symbols, opts);
          const key = syl.map((x) => (x.s ? x.t.toUpperCase() : x.t)).join('-');
          if (seen.has(key)) continue;
          seen.add(key);
          variants.push({ words: [syl] });
        }
        if (variants.length) pushWord({ type: 'word', text: raw, source: res.source, variants });
        else tokens.push({ type: 'sep', text: raw });
      } else if (/^(?:\$ ?\.?|\()?\d/.test(piece)) {
        // Número de formulário depois de sigla e hífen ("DS-160", "ETA-9142") e o "401k".
        const code = (prev && prev.text === '-' && prev2 && prev2.type === 'word' && /^[A-Z]+$/.test(prev2.text))
          || (piece === '401' && (/^k$/i.test(matches[mi + 1] || '')
            || (matches[mi + 1] === '(' && /^k$/i.test(matches[mi + 2] || ''))));
        const words = spokenNumber(piece, code).map((w) => toSyllables(pronounce(w).variants[0], opts));
        pushWord({ type: 'word', text: raw, source: 'dict', variants: [{ words }], money: piece.startsWith('$'),
          number: !code });
      } else {
        tokens.push({ type: 'sep', text: piece });
      }
    }
    readRanges(tokens, opts);
    // "Rio de Janeiro", "Silva da Costa": de/da/do/dos/das entre duas palavras com maiúscula é nome em português.
    const keep = (tok) => ({ type: 'sep', text: tok.text, kept: true });
    const capital = (tok) => tok && (tok.type === 'word' || tok.kept) && /^[A-Z][a-z]/.test(tok.text);
    const space = (tok) => tok && /^[ \t]+$/.test(tok.text);
    for (let i = 2; i + 2 < tokens.length; i++) {
      if (tokens[i].type === 'word' && /^d[aeo]s?$/.test(tokens[i].text) && space(tokens[i - 1]) && space(tokens[i + 1])
        && capital(tokens[i - 2]) && capital(tokens[i + 2])) {
        tokens[i - 2] = keep(tokens[i - 2]);
        tokens[i] = keep(tokens[i]);
        tokens[i + 2] = keep(tokens[i + 2]);
      }
    }
    // A palavra com maiúscula logo antes de um nome mantido também é nome ("Joao Pessoa", sem acento).
    for (let i = tokens.length - 1; i >= 2; i--) {
      const word = tokens[i - 2];
      if (tokens[i].kept && /^[ \t]+$/.test(tokens[i - 1].text) && word.type === 'word' && /^[A-Z][a-z]/.test(word.text)) {
        tokens[i - 2] = { type: 'sep', text: word.text, kept: true };
      }
    }
    return tokens;
  }

  /** Uma variante -> texto. Sílaba tônica em MAIÚSCULAS. */
  function formatVariant(variant, opts) {
    const sep = opts && opts.separate ? '·' : '';
    return variant.words
      .map((syl) => syl.map((x) => (x.s ? x.t.toUpperCase() : x.t)).join(sep))
      .join(' ');
  }

  /** Tokens -> texto corrido só com a pronúncia. `choices[i]` = variante escolhida do token i. */
  function formatTokens(tokens, opts, choices) {
    return tokens
      .map((tok, i) => {
        if (tok.type === 'sep') return tok.text;
        const idx = (choices && choices[i]) || 0;
        return formatVariant(tok.variants[idx] || tok.variants[0], opts);
      })
      .join('');
  }

  return {
    SYMBOLS, encode, decode, loadDict, dictSize, pronounce, toSyllables, convertText,
    formatVariant, formatTokens, numberToWords,
  };
});
