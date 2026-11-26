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
    ['igh', 'AY'], ['tch', 'CH'], ['dge', 'JH'], ['eau', 'OW'],
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
    // Tonicidade: primeira vogal tônica, as demais átonas.
    let stressed = false;
    return out.map((p) => {
      if (!VOWEL_SET.has(p)) return p;
      if (!stressed) { stressed = true; return p + '1'; }
      return p + '0';
    });
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
      case 'G': return startsFront(next) ? 'gu' : 'g';
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
        const vowelAfter = next && next.s !== null;
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
    const [intPart, decPart] = clean.split('.');
    let words;
    if (intPart.length > 12) words = intPart.split('').map((d) => ONES[Number(d)]);
    else words = intToWords(Number(intPart));
    if (decPart) words = words.concat('point', decPart.split('').map((d) => ONES[Number(d)]));
    return words;
  }

  /* ---------------------------------------------------------------- */
  /* API principal                                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Pronúncias de uma palavra.
   * Retorna { source: 'dict' | 'guess', variants: [ [fonemas...] ] }
   */
  /** Variante igual à primeira, só que com "u" (UW0) no lugar de uma vogal fraca (AH0). */
  function isRoundedOf(base, other) {
    if (base.length !== other.length) return false;
    let diffs = 0;
    for (let i = 0; i < base.length; i++) {
      if (base[i] === other[i]) continue;
      if (base[i] !== 'AH0' || other[i] !== 'UW0') return false;
      diffs++;
    }
    return diffs === 1;
  }

  /**
   * "today", "tomorrow", "document": a vogal fraca aí soa como um "u" curto para o brasileiro.
   * Mostra primeiro a variante com "u" e mantém a outra como alternativa.
   */
  function preferRounded(w, variants) {
    const list = variants.slice();
    const first = list[0];
    // "to-" (today, together, tonight): a vogal fraca puxa para "u".
    if (w.startsWith('to') && first[0] === 'T' && first[1] === 'AH0' && !list.some((v) => isRoundedOf(first, v))) {
      list.push(['T', 'UW0'].concat(first.slice(2)));
    }
    const idx = list.findIndex((v, i) => i > 0 && isRoundedOf(first, v));
    if (idx > 0) list.unshift(list.splice(idx, 1)[0]);
    return list;
  }

  function pronounce(word) {
    const w = word.toLowerCase().replace(/[’‘`]/g, "'");
    let hit = rawLookup(w);
    if (hit) return { source: 'dict', variants: preferRounded(w, hit) };
    const viaInflection = inflected(w);
    if (viaInflection) return { source: 'dict', variants: [viaInflection] };
    // Siglas em maiúsculas (ex.: "NBA"): soletra.
    if (word.length <= 5 && /^[A-Z]+$/.test(word)) {
      const spelled = [];
      for (const ch of w) spelled.push(...LETTER_NAMES[ch].split(' '));
      return { source: 'guess', variants: [spelled] };
    }
    if (w.length === 1 && LETTER_NAMES[w]) return { source: 'guess', variants: [LETTER_NAMES[w].split(' ')] };
    return { source: 'guess', variants: [guess(w)] };
  }

  const TOKEN_RE = /[A-Za-z]+(?:['’][A-Za-z]+)*|\d+(?:[.,]\d+)*|\s+|[^\sA-Za-z\d]+/g;

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
    for (const piece of matches) {
      if (/^[A-Za-z]/.test(piece)) {
        const res = pronounce(piece);
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
        if (variants.length) tokens.push({ type: 'word', text: piece, source: res.source, variants });
        else tokens.push({ type: 'sep', text: piece });
      } else if (/^\d/.test(piece)) {
        const words = numberToWords(piece).map((w) => toSyllables(pronounce(w).variants[0], opts));
        tokens.push({ type: 'word', text: piece, source: 'dict', variants: [{ words }] });
      } else {
        tokens.push({ type: 'sep', text: piece });
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
