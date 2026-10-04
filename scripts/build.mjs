// Inlines CSS + JS into single-file builds:
//   dist/valheim-gear-compare.html  standalone page, open it straight from disk
//   dist/artifact.html              same content without the document skeleton (for hosts that add their own)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
let html = read('index.html')
  .replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`)
  .replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p).replaceAll('</script', '<\\/script')}</script>`);

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/valheim-gear-compare.html'), html);

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>\n?/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync(resolve(root, 'dist/artifact.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('built dist/valheim-gear-compare.html and dist/artifact.html');
