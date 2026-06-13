/**
 * gen-taxonomie.mjs — frontmatters de la Bibliothèque → taxonomie.generated.ts.
 *
 * Une seule source de vérité (PRD §6, §10) : la majorité affichée sur une
 * fiche et la majorité contrôlée par l'audit ne peuvent jamais diverger,
 * par construction. Seules les fiches `published: true` entrent dans la
 * taxonomie. Lancé en prebuild, avant check-resolutions.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireFiches } from './frontmatter.mjs';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirFiches = join(racine, 'src', 'content', 'resolutions');
const cible = join(racine, 'src', 'lib', 'moteur', 'taxonomie.generated.ts');

const fiches = existsSync(dirFiches) ? lireFiches(dirFiches) : [];
const publiees = fiches.filter(({ data }) => data.published === true);

const entrees = publiees
  .sort((a, b) => String(a.data.slug).localeCompare(String(b.data.slug)))
  .map(({ data }) => ({
    slug: data.slug,
    intitule: data.titre,
    regime: data.regime,
    refLegale: data.refLegale,
    verifieLe: data.verifieLe,
    documentsExiges: data.documentsExiges ?? [],
    contextuel: data.contextuel === true,
  }));

const contenu = `// AUTO-GÉNÉRÉ par scripts/gen-taxonomie.mjs — NE PAS ÉDITER À LA MAIN.
// Source unique : frontmatters de src/content/resolutions/*.md (PRD §6, §10).
import type { TypeResolution } from './types';

export const TAXONOMIE: TypeResolution[] = ${JSON.stringify(entrees, null, 2)};
`;

mkdirSync(dirname(cible), { recursive: true });
writeFileSync(cible, contenu, 'utf8');
console.log(`gen-taxonomie : ${entrees.length} type(s) de résolution générés → taxonomie.generated.ts`);
