// Gera dist/floresta-sombria.html: o jogo inteiro num único arquivo HTML
// (o Three.js é carregado da CDN jsDelivr). Uso: node tools/build-single-html.mjs
// Requer o esbuild (npm i -g esbuild, ou npx esbuild).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const js = execFileSync('npx', ['--yes', 'esbuild@0.24.0', 'src/main.js', '--bundle', '--format=esm', '--minify', '--external:three'], { encoding: 'utf8' });
const css = readFileSync('css/style.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const corpo = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));

const saida = `<title>Floresta Sombria</title>
<style>
${css}
:root { color-scheme: dark; }
</style>
<script type="importmap">{ "imports": { "three": "${THREE_CDN}" } }</script>
${corpo}
<script type="module">
${js.replaceAll('</script', '<\\/script')}
</script>
`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/floresta-sombria.html', saida);
console.log('dist/floresta-sombria.html', (saida.length / 1024).toFixed(0), 'KB');
