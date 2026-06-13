/**
 * check-resolutions.mjs — gate de publication des fiches (PRD §6, §10).
 *
 * Échoue (exit 1) si : frontmatter incomplet · `regime` ou `categorie` hors
 * enum · `published: true` sans `verifieLe` · slug dupliqué ou différent du
 * nom de fichier · document exigé inconnu du référentiel documents.json.
 * Une fiche non vérifiée ne build pas en production.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireFiches } from './frontmatter.mjs';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGIMES = ['art24', 'art25', 'art26', 'unanimite'];
const CATEGORIES = [
  'comptes', 'budget', 'syndic', 'conseil-syndical',
  'travaux', 'parties-communes', 'reglement', 'divers',
];
const CHAMPS_REQUIS = ['titre', 'slug', 'categorie', 'regime', 'refLegale', 'piege', 'published'];
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

const documents = JSON.parse(
  readFileSync(join(racine, 'src', 'lib', 'moteur', 'documents.json'), 'utf8'),
);
const fiches = lireFiches(join(racine, 'src', 'content', 'resolutions'));

const erreurs = [];
const slugsVus = new Set();

for (const { file, data } of fiches) {
  for (const champ of CHAMPS_REQUIS) {
    if (!(champ in data)) erreurs.push(`${file} : champ obligatoire manquant « ${champ} »`);
  }
  if (data.slug !== undefined) {
    if (slugsVus.has(data.slug)) erreurs.push(`${file} : slug dupliqué « ${data.slug} »`);
    slugsVus.add(data.slug);
    if (`${data.slug}.md` !== file) {
      erreurs.push(`${file} : le slug « ${data.slug} » diffère du nom de fichier`);
    }
  }
  if (data.regime !== undefined && !REGIMES.includes(data.regime)) {
    erreurs.push(`${file} : regime « ${data.regime} » hors enum (${REGIMES.join(' | ')})`);
  }
  if (data.categorie !== undefined && !CATEGORIES.includes(data.categorie)) {
    erreurs.push(`${file} : categorie « ${data.categorie} » hors enum`);
  }
  if (data.published === true) {
    if (typeof data.verifieLe !== 'string' || !DATE_ISO.test(data.verifieLe)) {
      erreurs.push(
        `${file} : published: true sans « verifieLe » (date de vérification Légifrance) — publication refusée`,
      );
    }
  }
  for (const doc of data.documentsExiges ?? []) {
    if (!(doc in documents)) {
      erreurs.push(`${file} : document exigé inconnu « ${doc} » (référentiel documents.json)`);
    }
  }
}

if (erreurs.length > 0) {
  console.error(`check-resolutions : ${erreurs.length} erreur(s) — build refusé.\n`);
  for (const e of erreurs) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`check-resolutions : ${fiches.length} fiche(s) valides, gate verte.`);
