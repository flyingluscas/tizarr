// Bundles src/ into dist/, the exact folder that gets zipped into tizarr.wgt.
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

// Tizen 5.0 ships Chromium 63; esbuild lowers newer syntax to it.
const TARGET = 'chrome63';
const OUT = 'dist';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);

await build({
  entryPoints: { app: 'src/main.js', style: 'src/style.css' },
  outdir: OUT,
  bundle: true,
  minify: true,
  format: 'iife',
  target: TARGET,
  logLevel: 'warning',
});

await copyFile('src/index.html', `${OUT}/index.html`);
await copyFile('tizen/icon.png', `${OUT}/icon.png`);

const manifest = await readFile('tizen/config.xml', 'utf8');
await writeFile(`${OUT}/config.xml`, manifest.replace('version="0.0.0"', `version="${version}"`));

console.log(`Built ${OUT}/ (v${version})`);
