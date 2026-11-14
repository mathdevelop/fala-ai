// Teste rápido no terminal:  node tools/test.mjs "any english text"
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = require(join(root, 'js', 'converter.js'));
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'data', 'cmudict.js'), 'utf8'), sandbox);
P.loadDict(sandbox.window.CMUDICT_DATA);

const samples = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : [
  'Hello! How are you today?',
  'The quick brown fox jumps over the lazy dog.',
  'Could you repeat that, please? I would like a cup of coffee.',
  'Thank you very much. This is my mother and that is my brother.',
  'computer banana beautiful information international question language singer finger think extra',
  'year yeast wood would argue penguin linguist basic person nation vision measure',
  "I don't know. She's working. It's 42 dollars and 3.5 miles. NBA xyzzy blorfing Matheus's",
];
for (const s of samples) {
  const tokens = P.convertText(s, {});
  console.log(s + '\n  -> ' + P.formatTokens(tokens, { separate: true }) + '\n');
}
