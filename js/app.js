(function () {
  'use strict';

  const P = window.PronunciaPT;
  const $ = (id) => document.getElementById(id);

  const input = $('input');
  const output = $('output');
  const optInterlinear = $('opt-interlinear');
  const optSeparate = $('opt-separate');
  const optTh = $('opt-th');

  const SAMPLES = [
    'Hello! How are you today?',
    'Could you repeat that, please?',
    'I would like a cup of coffee.',
    'Thank you very much for your help.',
    'The weather is beautiful this morning.',
  ];

  const LEGEND = [
    ['MAIÚSCULAS', 'É a sílaba forte da palavra. Capriche nela e fale as outras mais fracas.', ['computer', 'banana']],
    ['ii · uu', 'Vogal comprida: segure o som um pouco mais. Com uma letra só, o som é curtinho.', ['sheep', 'ship', 'food', 'book']],
    ['â', 'Um “a” fechado e curto, como em “câmera” ou “cama”.', ['cup', 'love']],
    ['é · ó', 'Bem abertos, como em “pé” e “pó”.', ['bed', 'cat', 'dog']],
    ['â apagado', 'Nas sílabas fracas o â aparece mais claro: é curtíssimo e quase some. Nunca abra para “a”.', ['today', 'about', 'police']],
    ['d entre vogais', 'No inglês americano o “t” entre vogais vira um “d” leve e rápido, quase o “r” de “caro”.', ['water', 'city', 'better']],
    ['tn · pl', 'Sem vogal no meio: passe direto de uma consoante para a outra, sem acrescentar som.', ['button', 'people', 'little']],
    ['t · p · k', 'No começo da palavra ou da sílaba forte, saem com um sopro de ar. Por isso o “t” de “today” pode parecer “tch”: mantenha a língua no lugar do “t” e só solte o ar.', ['today', 'time', 'park']],
    ['rr', 'O “r” de “rato” ou “carro”: um sopro vindo da garganta.', ['house', 'hello']],
    ['r', 'Sempre o “r” do interior (“porta” caipira), com a língua enrolada para trás — mesmo no começo da palavra.', ['red', 'car']],
    ['âr · er', 'O mesmo “r” do interior, emendado na vogal.', ['bird', 'teacher']],
    ['th', 'Ponta da língua entre os dentes, soprando o ar (sem voz). Fica entre um “t” e um “s”.', ['think', 'three']],
    ['dh', 'Ponta da língua entre os dentes, agora com voz. Fica entre um “d” e um “z”.', ['this', 'mother']],
    ['tch · dj', 'Como em “tchau” e no “dj” de “adjetivo” falado rápido.', ['chair', 'job']],
    ['ch · j', 'Como em “chá” e “já”.', ['she', 'vision']],
    ['ng', 'Som nasal no fundo da boca, sem estalar o “g”.', ['sing', 'long']],
    ['k', 'Sempre o som de “c” em “casa”.', ['cat', 'key']],
    ['ss · s · z', '“ss” e “s” sempre chiam como em “massa”; “z” sempre vibra como em “zebra”.', ['basic', 'is']],
  ];

  let tokens = [];
  let choices = [];

  function options() {
    return { separate: optSeparate.checked, simpleTh: optTh.checked };
  }

  /* ---------------- Renderização ---------------- */

  function appendSyllable(parent, syl) {
    const parts = syl.parts && syl.parts.length ? syl.parts : [{ t: syl.t, w: false }];
    for (const part of parts) {
      if (part.w) {
        const weak = document.createElement('span');
        weak.className = 'weak';
        weak.textContent = part.t;
        parent.append(weak);
      } else {
        parent.append(part.t);
      }
    }
  }

  function sayNode(variant, separate, tag) {
    const span = document.createElement(tag || 'span');
    span.className = 'say';
    variant.words.forEach((syllables, w) => {
      if (w > 0) span.append(' ');
      syllables.forEach((syl, i) => {
        if (i > 0 && separate) {
          const dot = document.createElement('span');
          dot.className = 'dot';
          dot.textContent = '·';
          span.append(dot);
        }
        if (syl.s) {
          const b = document.createElement('b');
          b.textContent = syl.t.toUpperCase();
          span.append(b);
        } else {
          appendSyllable(span, syl);
        }
      });
    });
    return span;
  }

  function render() {
    const opts = options();
    tokens = P.convertText(input.value, opts);
    if (choices.length !== tokens.length) choices = new Array(tokens.length).fill(0);

    output.classList.toggle('interlinear', optInterlinear.checked);
    output.textContent = '';

    if (!tokens.some((t) => t.type === 'word')) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'A pronúncia aparece aqui enquanto você digita.';
      output.append(p);
      return;
    }

    let line = document.createElement('div');
    line.className = 'line';
    output.append(line);

    tokens.forEach((tok, i) => {
      if (tok.type === 'sep') {
        const parts = tok.text.split('\n');
        parts.forEach((part, k) => {
          if (k > 0) {
            line = document.createElement('div');
            line.className = 'line';
            output.append(line);
          }
          if (part) {
            const s = document.createElement('span');
            s.className = 'punct';
            s.textContent = part.replace(/\s+/g, ' ');
            line.append(s);
          }
        });
        return;
      }

      const idx = choices[i] < tok.variants.length ? choices[i] : 0;
      const word = document.createElement('span');
      word.className = 'word' + (tok.source === 'guess' ? ' guess' : '');
      word.tabIndex = 0;
      word.setAttribute('role', 'button');
      word.title = tok.source === 'guess'
        ? 'Palavra fora do dicionário: pronúncia estimada. Clique para ouvir.'
        : 'Clique para ouvir';

      const en = document.createElement('span');
      en.className = 'en';
      en.lang = 'en';
      en.textContent = tok.text;
      word.append(en, sayNode(tok.variants[idx], opts.separate));

      const hear = () => speak(tok.text, 0.85);
      word.addEventListener('click', hear);
      word.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hear(); }
      });

      if (tok.variants.length > 1) {
        const alt = document.createElement('button');
        alt.type = 'button';
        alt.className = 'alt';
        alt.textContent = (idx + 1) + '/' + tok.variants.length;
        alt.title = 'Esta palavra tem mais de uma pronúncia. Clique para trocar.';
        alt.addEventListener('click', (e) => {
          e.stopPropagation();
          choices[i] = (idx + 1) % tok.variants.length;
          render();
        });
        word.append(alt);
      }
      line.append(word);
    });
  }

  function renderLegend() {
    const body = $('legend');
    const opts = { separate: true };
    for (const [spelling, how, examples] of LEGEND) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = spelling;
      const td2 = document.createElement('td');
      td2.textContent = how;
      const td3 = document.createElement('td');
      examples.forEach((ex, i) => {
        if (i > 0) td3.append(document.createElement('br'));
        const span = document.createElement('span');
        span.className = 'ex';
        const tok = P.convertText(ex, opts)[0];
        const say = sayNode(tok.variants[0], true, 'i');
        say.className = '';
        span.append(ex + ' → ', say);
        td3.append(span);
      });
      tr.append(td1, td2, td3);
      body.append(tr);
    }
  }

  /* ---------------- Áudio (voz do próprio navegador) ---------------- */

  function englishVoice() {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((v) => v.lang === 'en-US') || voices.find((v) => v.lang.startsWith('en')) || null;
  }

  function speak(text, rate) {
    if (!('speechSynthesis' in window) || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    const voice = englishVoice();
    if (voice) u.voice = voice;
    u.rate = rate;
    window.speechSynthesis.speak(u);
  }

  /* ---------------- Eventos ---------------- */

  function save() {
    try {
      localStorage.setItem('falaai', JSON.stringify({
        text: input.value,
        interlinear: optInterlinear.checked,
        separate: optSeparate.checked,
        th: optTh.checked,
      }));
    } catch (e) { /* sem armazenamento: segue sem salvar */ }
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem('falaai') || 'null');
      if (!saved) return false;
      input.value = saved.text || '';
      optInterlinear.checked = saved.interlinear !== false;
      optSeparate.checked = saved.separate !== false;
      optTh.checked = !!saved.th;
      return true;
    } catch (e) {
      return false;
    }
  }

  function setText(text) {
    input.value = text;
    choices = [];
    render();
    save();
  }

  input.addEventListener('input', () => { choices = []; render(); save(); });
  for (const opt of [optInterlinear, optSeparate, optTh]) {
    opt.addEventListener('change', () => { render(); save(); });
  }

  $('clear').addEventListener('click', () => { setText(''); input.focus(); });
  $('listen').addEventListener('click', () => speak(input.value, 1));
  $('listen-slow').addEventListener('click', () => speak(input.value, 0.6));

  $('copy').addEventListener('click', async () => {
    const btn = $('copy');
    const text = P.formatTokens(tokens, options(), choices);
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = 'Copiado!';
    } catch (e) {
      btn.textContent = 'Não deu para copiar';
    }
    setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
  });

  const samplesBox = $('samples');
  for (const sample of SAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = 'en';
    b.textContent = sample;
    b.addEventListener('click', () => setText(sample));
    samplesBox.append(b);
  }

  /* ---------------- Início ---------------- */

  if (window.CMUDICT_DATA) P.loadDict(window.CMUDICT_DATA);
  else $('dict-warning').hidden = false;

  if (!('speechSynthesis' in window)) {
    $('listen').hidden = true;
    $('listen-slow').hidden = true;
  }

  if (!restore() || !input.value) input.value = SAMPLES[0];
  renderLegend();
  render();
})();
