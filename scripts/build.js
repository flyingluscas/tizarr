// Bundles src/ into dist/, the exact folder that gets signed into tizarr.wgt.
// `--dev` instead watches src/, builds into dist-dev/, serves it on the LAN and
// live-reloads the browser.
import { build, context } from 'esbuild';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

// Tizen 5.0 ships Chromium 63; esbuild lowers newer syntax to it.
const TARGET = 'chrome63';
// 0.0.0.0 so other machines on the LAN can open the preview.
const DEV_HOST = '0.0.0.0';
const DEV_PORT = 5173;

const dev = process.argv.includes('--dev');
// Separate folders so `npm run build`/`validate` never clobber a running dev preview.
const OUT = dev ? 'dist-dev' : 'dist';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));

async function copyStaticFiles() {
  await copyFile('src/index.html', `${OUT}/index.html`);
  await copyFile('tizen/icon.png', `${OUT}/icon.png`);
  // The bundled font's license must ship with it (SIL OFL).
  await mkdir(`${OUT}/fonts`, { recursive: true });
  await copyFile('src/fonts/OFL.txt', `${OUT}/fonts/OFL.txt`);
  const manifest = await readFile('tizen/config.xml', 'utf8');
  await writeFile(`${OUT}/config.xml`, manifest.replace('version="0.0.0"', `version="${version}"`));
}

// esbuild only rebuilds bundles on change; static files are re-copied after every build.
const copyStaticPlugin = {
  name: 'copy-static',
  setup(pluginBuild) {
    pluginBuild.onEnd(copyStaticFiles);
  },
};

const options = {
  entryPoints: { app: 'src/main.js', style: 'src/style.css' },
  outdir: OUT,
  bundle: true,
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  format: 'iife',
  target: TARGET,
  logLevel: 'warning',
  plugins: [copyStaticPlugin],
  // Fonts referenced from style.css are emitted as files next to it.
  loader: { '.woff2': 'file' },
  assetNames: 'fonts/[name]',
  // Dev only: reload the page whenever esbuild finishes a rebuild.
  banner: dev
    ? { js: "new EventSource('/esbuild').addEventListener('change', () => location.reload());" }
    : undefined,
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);

if (dev) {
  const ctx = await context(options);
  await ctx.watch();
  await ctx.serve({ host: DEV_HOST, port: DEV_PORT, servedir: OUT });
  console.log(`Dev server on http://${DEV_HOST}:${DEV_PORT} (watching src/)`);
} else {
  await build(options);
  console.log(`Built ${OUT}/ (v${version})`);
}
