import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const entries = [];
function licenseText(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^(licen[cs]e|copying|notice|copyright)([._-]|$)/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => `${entry.name}\n\n${fs.readFileSync(path.join(directory, entry.name), 'utf8')}`).join('\n\n');
}
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
for (const [directory, pkg] of Object.entries(lock.packages)) {
  if (!directory || pkg.dev) continue;
  const full = path.resolve(directory);
  if (!fs.existsSync(full)) throw new Error(`Missing installed package: ${directory}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(full, 'package.json'), 'utf8'));
  entries.push({ ecosystem: 'npm', name: manifest.name, version: manifest.version, license: manifest.license || pkg.license || 'See package notices', text: licenseText(full) });
}
const cargo = JSON.parse(execFileSync('cargo', ['metadata', '--offline', '--format-version', '1', '--manifest-path', 'src-tauri/Cargo.toml'], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 }));
for (const pkg of cargo.packages) {
  if (!pkg.source) continue;
  const directory = path.dirname(pkg.manifest_path);
  let text = licenseText(directory);
  if (pkg.license_file && !text.includes(pkg.license_file)) text += `\n\n${fs.readFileSync(path.join(directory, pkg.license_file), 'utf8')}`;
  entries.push({ ecosystem: 'Cargo', name: pkg.name, version: pkg.version, license: pkg.license || 'See package notices', text });
}
const unique = [...new Map(entries.map(entry => [`${entry.ecosystem}:${entry.name}:${entry.version}`, entry])).values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
fs.writeFileSync('src/third-party-notices.json', JSON.stringify(unique, null, 2) + '\n');
console.log(`Generated notices for ${unique.length} components (${unique.filter(entry => !entry.text).length} declare a license without a top-level notice).`);
