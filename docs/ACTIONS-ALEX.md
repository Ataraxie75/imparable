# Plan d'actions — ce qui dépend de toi (Alex)

Le code des LOTS 0–3 + 6 est prêt et gaté. Tout ce qui reste est soit un
provisionnement de service externe, soit une décision humaine que le PRD te
réserve. Voici l'ordre exact, avec le critère « fait » de chaque action.

## Phase 1 — Mise en ligne gratuite (objectif : LANCEMENT PUBLIC du LOT 2)

| # | Action | Comment | Fait quand |
|---|--------|---------|------------|
| 1 | **Acheter le domaine** | imparable.fr (ou équivalent libre) chez le registrar de ton choix. Aucun lien DNS avec syndic-efficace.fr | Le domaine résout |
| 2 | **Créer le projet Vercel** | Nouveau projet (pas une branche du projet Syndic Efficace) · racine du build : `imparable/` · build command `npm run build` · framework Astro détecté automatiquement | Préview verte sur un push |
| 3 | **Brancher le domaine sur Vercel** | DNS → Vercel, HTTPS auto | `https://imparable.fr` sert la landing |
| 4 | **Plausible** | Créer le site sur plausible.io (EU, cookieless), puis ajouter le script dans `src/layouts/Layout.astro` (une ligne, je peux le faire dès que tu as le compte) | Visites visibles dans Plausible |
| 5 | **Vérification Légifrance des 33 fiches** | Pour chaque fiche de `src/content/resolutions/` : vérifier régime + référence sur Légifrance, corriger si besoin, mettre la vraie date dans `verifieLe`. Une fiche = un commit. **Les dates actuelles sont des placeholders posés pour le build** | 33 commits de vérification |
| 6 | **Inventaire migration (Annexe C)** | Lister les URLs fiches actuelles de syndic-efficace.fr + export Search Console (impressions/clics par URL) + remplir le mapping dans `redirects-bibliotheque.json` | Mapping complet versionné |
| 7 | **Bascule 301** | Appliquer le mapping dans la config Vercel de syndic-efficace.fr, supprimer les fiches là-bas LE MÊME JOUR, crawler les anciennes URLs : 100 % en 301 vers la bonne cible | Crawl de contrôle vert |
| 8 | **Search Console** | Déclarer imparable.fr, soumettre `sitemap-index.xml`, suivre les 301 | Propriété vérifiée, sitemap lu |

→ **Ici, tu es lancé publiquement (gratuit).** Métriques M1 : 300 visites orga/sem, 100 calculs/sem.

## Phase 2 — Monétisation (LOT 4)

| # | Action | Comment | Fait quand |
|---|--------|---------|------------|
| 9 | **Projet Supabase** | Nouveau projet, région EU (Frankfurt). Coller `supabase/0001_init.sql` dans le SQL Editor (manuellement, conformément au PRD §22) | Tables + RLS en place |
| 10 | **Compte Stripe** | Nouveau compte (séparé de tout existant). Produits : « Audit + Attestation » 29 € one-shot, « Pass Cabinet » 290 €/an subscription | Clés test + live dispo |
| 11 | **Resend** | Compte + domaine d'envoi vérifié (SPF/DKIM sur imparable.fr) | Email de test reçu |
| 12 | **Webhook Stripe** | Dashboard Stripe → endpoint `https://imparable.fr/api/stripe-webhook`, événement `checkout.session.completed`, copier le signing secret | Secret copié |
| 13 | **Variables Vercel** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY` (+ `SITE_URL`, `RESEND_FROM` optionnelles) — chiffrées, jamais dans le code | Les 6 variables posées |
| 14 | **Visa avocat** (bloquant) | Avocat en droit de la copropriété, trois livrables : (a) grille d'audit (`/methodologie` + `src/lib/moteur/audit.ts`), (b) texte de l'attestation (`/specimen-attestation`), (c) CGV + disclaimers. Quelques centaines d'euros | Visa écrit sur les 3 |
| 15 | **Recette LOT 4** | Le code du flux complet est DÉJÀ écrit (checkout → webhook → numéro → document → email → E6/E7). Avec les clés test : achat de bout en bout, puis bascule live. Reste deux décisions dev : rendu PDF définitif (`genererDocument` dans `src/lib/stripe/webhook.ts` — V1 livre un document HTML imprimable) et pages E11 (après visa) | Achat réel test→live : payé → document reçu par email → numéro vérifié sur /verifier |

## Phase 3 — Cabinet & suite (LOT 5)

15. Activer l'auth magic link Supabase, puis GO dev LOT 5 (E8, subscription, logo sur PDF).
16. Veille Légifrance trimestrielle : à chaque évolution, bump de `RULES_VERSION` dans `audit.ts` + commit documenté.

## Ce que tu ne fais PAS (non-goals gravés)

- Aucun partage de compte/projet/DNS/analytics avec Syndic Efficace — la seule
  interaction autorisée est la 301 sortante (action 7).
- Pas de tier intermédiaire, pas de promo de lancement, pas d'essai Cabinet.
- Toute feature hors des 4 surfaces = NO par défaut.
