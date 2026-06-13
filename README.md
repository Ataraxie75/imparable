# IMPARABLE

Vérificateur de conformité des AG de copropriété + Bibliothèque de résolutions.
Produit 100 % stand-alone — voir le PRD V2 (13 juin 2026), document de référence unique.

## État du build

| Lot | Contenu | État |
|---|---|---|
| LOT 0 — Fondations | Squelette Astro + tokens.css + 4 gates prebuild | ✅ fait (domaine, Vercel, Supabase, Plausible : à provisionner) |
| LOT 1 — Moteur délai + Landing | `moteur/delai.ts` + T1–T12 · landing E1 + calculateur | ✅ fait |
| LOT 2 — Bibliothèque | Content collection · gen-taxonomie · E2/E3 · seed fiches | ✅ fait (33 fiches — toute l'Annexe A · 301 + Search Console : à faire) |
| LOT 3 — Audit | `moteur/audit.ts` + tests S-* · wizard E4 · résultat E5 | ✅ fait (paywall non branché, conforme au gate LOT 3) |
| LOT 4 — Monétisation | Stripe · PDF · Resend · E6/E7 · légal + **visa avocat** | 🟨 **code-complet** : checkout (recalcul serveur), webhook signé + idempotent, numérotation SQL, stockage privé + URL signée, email Resend, E6, E7 — il manque : clés (5 variables), bucket+schéma SQL à exécuter, décision rendu PDF (`genererDocument`), E11 + visa avocat |
| LOT 5 — Pass Cabinet | Auth · E8 · subscription | ⬜ à faire |
| LOT 6 — Guides SEO | 10–15 guides E9 | ✅ fait (10 guides, calculateur + maillage fiches sur chacun) |

Spécificité moteur : les items ⚠ de l'Annexe A portent `contextuel: true` dans leur
frontmatter — le bloc D rend alors `vigilance` (vérification renforcée) au lieu d'un
verdict tranché, et la fiche affiche « régime selon le contexte ».

## Avertissements bloquants avant lancement public

- **`verifieLe` des fiches seed = placeholder.** Chaque mapping régime/référence doit être
  re-vérifié sur Légifrance par un humain avant la mise en ligne (gate PRD §6) — la date est
  posée pour permettre le build, pas pour attester la vérification.
- **Visa avocat** requis avant toute mise en ligne payante (PRD §21) : grille d'audit, texte
  de l'attestation, CGV + disclaimers.
- Le scénario T12 (Cass. 3e civ., 4 déc. 2025) est reconstruit d'après le PRD : à confronter
  à l'arrêt publié.

## Commandes

```bash
npm install
npm run dev      # gen-taxonomie + serveur de dev
npm run test     # gen-taxonomie + vitest (T1–T12, S-*)
npm run gates    # les 4 gates prebuild
npm run build    # gates → astro check → astro build — un rouge n'importe où = pas de build
```

## Architecture (PRD §16)

- `src/lib/moteur/` — moteur PUR (zéro I/O) : `delai.ts`, `audit.ts`, `types.ts`,
  `taxonomie.generated.ts` (généré, non versionné), `documents.json` (référentiel des annexes).
- `src/content/resolutions/` — la Bibliothèque, markdown versionné. Une fiche = un commit.
- `scripts/` — `gen-taxonomie.mjs` (frontmatters → taxonomie), `check-resolutions.mjs`
  (gate de publication), `check-color-tokens.mjs` (aucun hex hors `src/styles/tokens.css`).
- `tests/moteur/` — T1–T12 (délai) et S-* (audit), gates prebuild.
- `redirects-bibliotheque.json` — mapping 301 appliqué côté syndic-efficace.fr (seule
  interaction autorisée).

**Invariant central :** la majorité affichée sur une fiche et la majorité contrôlée par
l'audit proviennent du même frontmatter — elles ne peuvent pas diverger, par construction.
