/**
 * check-color-tokens.mjs — garde-fou DA (PRD §13).
 *
 * Aucune couleur hexadécimale hors de src/styles/tokens.css : la source
 * unique du design est tokens.css, tout le reste consomme var(--…).
 * Échoue (exit 1) à la première couleur en dur.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirSrc = join(racine, 'src');
const EXEMPTE = join('src', 'styles', 'tokens.css');
const EXTENSIONS = new Set(['.astro', '.tsx', '.ts', '.jsx', '.css', '.html']);
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z])/g;

function* fichiers(dir) {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      yield* fichiers(chemin);
    } else if (EXTENSIONS.has(nom.slice(nom.lastIndexOf('.')))) {
      yield chemin;
    }
  }
}

const violations = [];
for (const chemin of fichiers(dirSrc)) {
  const rel = relative(racine, chemin);
  if (rel === EXEMPTE) continue;
  if (rel.endsWith('taxonomie.generated.ts')) continue;
  const lignes = readFileSync(chemin, 'utf8').split('\n');
  lignes.forEach((ligne, i) => {
    for (const m of ligne.matchAll(HEX)) {
      violations.push(`${rel}:${i + 1} → ${m[0]}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`check-color-tokens : ${violations.length} couleur(s) hors tokens.css — build refusé.\n`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  process.exit(1);
}
console.log('check-color-tokens : aucune couleur hors tokens.css, gate verte.');
