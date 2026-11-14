// Baixa o CMU Pronouncing Dictionary e gera data/cmudict.js (formato compacto).
// Uso:  node tools/build-dict.mjs
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { encode } = require(join(root, 'js', 'converter.js'));

const SOURCE = 'https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict';
const localCopy = join(root, 'data', 'cmudict.dict');

let raw;
if (existsSync(localCopy)) {
  console.log('Usando cópia local:', localCopy);
  raw = readFileSync(localCopy, 'utf8');
} else {
  console.log('Baixando', SOURCE);
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error('Falha no download: HTTP ' + res.status);
  raw = await res.text();
}

const entries = new Map();
let skipped = 0;
for (const line of raw.split('\n')) {
  const clean = line.split('#')[0].trim();
  if (!clean) continue;
  const parts = clean.split(/\s+/);
  const word = parts[0].replace(/\(\d+\)$/, '');
  try {
    const code = encode(parts.slice(1));
    if (!entries.has(word)) entries.set(word, []);
    const list = entries.get(word);
    if (!list.includes(code)) list.push(code);
  } catch {
    skipped++;
  }
}

const body = [...entries].map(([word, codes]) => word + ' ' + codes.join('!')).join('\n');
const header =
  '// Gerado por tools/build-dict.mjs a partir do CMU Pronouncing Dictionary\n' +
  '// (http://www.speech.cs.cmu.edu/cgi-bin/cmudict) - licença BSD de 2 cláusulas, Carnegie Mellon University.\n';
mkdirSync(join(root, 'data'), { recursive: true });
const outFile = join(root, 'data', 'cmudict.js');
writeFileSync(outFile, header + 'window.CMUDICT_DATA = ' + JSON.stringify(body) + ';\n');
console.log(`${entries.size} palavras gravadas em ${outFile} (${skipped} linhas ignoradas)`);
