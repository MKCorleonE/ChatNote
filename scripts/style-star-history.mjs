import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Match the light and dark accents in src/styles.css. Star Chart's area
// renderer uses separate stroke/fill variables rather than palette levels.
const themes = {light: '#317659', dark: '#a1d9c0'};
const charts = Object.entries(themes).map(([theme, mint]) => {
  const file = path.join(root, `.github/assets/star-history-${theme}.svg`);
  let svg = fs.readFileSync(file, 'utf8');
  for (const variable of ['--sc-stroke', '--sc-fill', '--sc-accent']) {
    const pattern = new RegExp(`${variable}:#[0-9a-fA-F]{6};`, 'g');
    if ([...svg.matchAll(pattern)].length !== 1) {
      throw new Error(`Unexpected Star Chart color declaration: ${theme} ${variable}`);
    }
    svg = svg.replace(pattern, `${variable}:${mint};`);
  }
  return {file, svg};
});

// Validate both before writing either image; preserve existing charts on error.
for (const {file, svg} of charts) fs.writeFileSync(file, svg);
console.log('Applied ChatNote light/dark mint colors to star history.');
