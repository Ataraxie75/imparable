# HANDOFF — état de la reprise (branchement paiement)

> Document de reprise entre sessions. Versionné exprès : il doit survivre aux
> conteneurs éphémères. À la prochaine session, dire « on reprend le
> branchement paiement » et pointer ici.

Dernière mise à jour : 2026-06-19.

## Où on en est

Le flux de paiement (LOT 4, PRD §18) est **codé, gaté et buildable**. La seule
décision dev encore ouverte sur ce flux — **le rendu PDF de l'attestation** —
est désormais **tranchée et branchée**.

### Ce qui a été fait cette session : le rendu PDF

- **Choix** : Chromium headless (`@sparticuz/chromium` + `puppeteer-core`),
  retenu face à `@react-pdf`. Raison : il imprime **exactement** le HTML
  autoporté du template SPEC-PDF (`attestationDocumentHTML`), déjà affiché en
  spécimen sur le site → fidélité typographique parfaite (gradients, ombres,
  polices, `var()`) et un seul template à maintenir.
- **Code** :
  - `src/lib/pdf/rendu.ts` — nouveau. Fonction pure `htmlVersPdf(html) → Buffer`
    (A4, `printBackground`, marges 14/12 mm). Binaire fourni par
    `@sparticuz/chromium` sur Vercel ; override local via
    `PUPPETEER_EXECUTABLE_PATH`.
  - `src/lib/stripe/webhook.ts` — `genererDocument` rend désormais un **PDF**
    (`application/pdf`, extension `pdf`) au lieu du HTML placeholder ;
    `lienDocument` sert `.pdf` par défaut. `merci.astro` (E6) suit sans
    changement (il appelle `lienDocument` sans extension).
  - `astro.config.mjs` — `vercel({ maxDuration: 60 })` : le webhook a le temps
    de générer le PDF (cold start Chromium) avant un rejeu Stripe.
  - `package.json` — deps `@sparticuz/chromium@^143.0.4` (Node ≥20.11, binaire
    Amazon Linux 2023) + `puppeteer-core@^24` ; **`engines.node: "20.x"`** pour
    que Vercel build/exécute en `nodejs20.x` (AL2023, compatible binaire).
- **Validé en sandbox** : rendu du vrai template → PDF `%PDF-` de ~278 Ko,
  inspection visuelle conforme à la DA. `npm run build` vert (gates + astro
  check + bundle Vercel), binaire Chromium bien tracé dans
  `.vercel/output/functions/_render.func/`.

### À vérifier au déploiement (toi, côté Vercel)

1. **Version Node du projet Vercel = 20.x** (Project Settings → Node.js
   Version). C'est ce qui garantit le runtime `nodejs20.x` (AL2023) attendu par
   le binaire Chromium. `engines.node` le pilote, mais confirme-le.
2. Première émission réelle : vérifier que le PDF arrive bien (cold start
   Chromium = quelques secondes ; le `maxDuration: 60` couvre largement).

## Ce qui reste (inchangé — voir `docs/ACTIONS-ALEX.md`)

**Provisionnement externe (toi, bloquant)** — actions 9→14 :
Supabase EU + `supabase/0001_init.sql` · compte Stripe (29 € / 290 €) + webhook
+ signing secret · Resend (domaine vérifié) · 6 variables Vercel · **visa
avocat** (bloquant légal).

**Dev restant** : pages E11 (après visa). Le rendu PDF n'est plus un point
ouvert.

## Recette LOT 4 (quand les clés test sont posées)

Achat de bout en bout en test : `/audit` → checkout Stripe → webhook
`checkout.session.completed` → numéro (séquence SQL) → **PDF** émis dans le
bucket privé → email Resend → vérifiable sur `/verifier/{numero}`. Puis bascule
live.
