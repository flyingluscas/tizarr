// Sanity checks on dist/ before it is packaged. Run after `npm run build`.
import { parse } from 'acorn';
import { access, readFile } from 'node:fs/promises';

const OUT = 'dist';
const REQUIRED_FILES = ['index.html', 'app.js', 'style.css', 'config.xml', 'icon.png'];
// Chromium 63 supports ES2017 plus parts of ES2018; anything newer must have been lowered.
const MAX_ECMA_VERSION = 2018;

const { version } = JSON.parse(await readFile('package.json', 'utf8'));

for (const file of REQUIRED_FILES) await access(`${OUT}/${file}`);

parse(await readFile(`${OUT}/app.js`, 'utf8'), { ecmaVersion: MAX_ECMA_VERSION });

const manifest = await readFile(`${OUT}/config.xml`, 'utf8');
if (!manifest.includes(`version="${version}"`)) {
  throw new Error(`dist/config.xml version does not match package.json (${version})`);
}

const tag = process.env.GITHUB_REF_NAME || '';
if (tag.startsWith('v') && tag !== `v${version}`) {
  throw new Error(`Tag ${tag} does not match package.json version ${version}`);
}

console.log(`${OUT}/ is valid (v${version})`);
