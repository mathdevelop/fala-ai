# Fala Aí

Converte texto em inglês na pronúncia **escrita com os sons do português**, sem alfabeto fonético.

`Hello! How are you today?` → `rra·LOU! rrau ar iuu ta·DEI?`

## Como usar

Dê dois cliques em `index.html` — o site funciona direto do arquivo, sem instalar nada.

Ou, com servidor local (precisa só do Node.js):

```bash
npm start
```

e abra http://localhost:5173.

## Como funciona

1. Cada palavra é procurada no [CMU Pronouncing Dictionary](http://www.speech.cs.cmu.edu/cgi-bin/cmudict) (inglês americano, ~126 mil palavras).
2. Os fonemas são separados em sílabas.
3. Cada fonema vira uma grafia que um brasileiro lê naturalmente (`js/converter.js`, função `spell`).

Palavras fora do dicionário são estimadas por regras de ortografia e aparecem com sublinhado pontilhado.

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `index.html`, `style.css` | Página e visual |
| `js/converter.js` | Motor de conversão (também funciona no Node) |
| `js/app.js` | Interface: digitação, áudio, copiar, opções |
| `data/cmudict.js` | Dicionário compacto (gerado) |
| `tools/build-dict.mjs` | Baixa o dicionário CMU e gera `data/cmudict.js` |
| `tools/test.mjs` | Teste no terminal: `npm test` ou `node tools/test.mjs "any text"` |
| `tools/serve.mjs` | Servidor local |

## Ajustar a escrita

A tabela fonema → grafia fica na função `spell` de `js/converter.js`. Por exemplo, para escrever o som de *cat* como `a` em vez de `é`, troque a linha `case 'AE'`.

## Publicar

É um site estático: basta enviar a pasta para GitHub Pages, Netlify ou qualquer hospedagem.

## Licença do dicionário

O CMU Pronouncing Dictionary é distribuído pela Carnegie Mellon University sob licença BSD de 2 cláusulas.
