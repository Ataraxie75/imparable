import { defineCollection, z } from 'astro:content';

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bibliothèque de résolutions (PRD §8) — markdown versionné, zéro base de
 * données. Le schéma reflète la gate scripts/check-resolutions.mjs.
 */
const resolutions = defineCollection({
  type: 'content',
  // NB : `slug` est présent dans le frontmatter (source de la taxonomie et
  // gate check-resolutions) mais réservé par Astro — il ne figure pas dans
  // `data`, on lit `entry.slug`.
  schema: z.object({
    titre: z.string().min(1),
    categorie: z.enum([
      'comptes',
      'budget',
      'syndic',
      'conseil-syndical',
      'travaux',
      'parties-communes',
      'reglement',
      'divers',
    ]),
    regime: z.enum(['art24', 'art25', 'art26', 'unanimite']),
    refLegale: z.string().min(1),
    verifieLe: z.string().regex(DATE_ISO),
    documentsExiges: z.array(z.string()).default([]),
    variables: z.array(z.string()).default([]),
    piege: z.string().min(1),
    /** Item ⚠ Annexe A : régime indicatif, dépendant du contexte. */
    contextuel: z.boolean().default(false),
    published: z.boolean(),
  }),
});

/** Guides SEO (PRD E9) — pages piliers, calculateur embarqué sur chacune. */
const guides = defineCollection({
  type: 'content',
  schema: z.object({
    titre: z.string().min(1),
    description: z.string().min(1),
    verifieLe: z.string().regex(DATE_ISO),
    /** Slugs de fiches résolution liées (maillage interne, PRD §20). */
    fichesLiees: z.array(z.string()).default([]),
    /** Cercles de chiffres-clés en tête de guide (DA éditoriale premium). */
    statsCles: z
      .array(z.object({ chiffre: z.string(), label: z.string() }))
      .default([]),
    published: z.boolean(),
  }),
});

export const collections = { resolutions, guides };
