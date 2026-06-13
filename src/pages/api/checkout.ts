/** POST /api/checkout — E5 → session Stripe (PRD §18). */
import type { APIRoute } from 'astro';
import { ConfigurationManquante } from '../../lib/serveur/env';
import { creerSessionCheckout, type DemandeCheckout } from '../../lib/stripe/checkout';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let demande: DemandeCheckout;
  try {
    demande = (await request.json()) as DemandeCheckout;
  } catch {
    return Response.json({ erreur: 'Corps JSON attendu.' }, { status: 400 });
  }

  try {
    const resultat = await creerSessionCheckout(demande);
    if ('erreur' in resultat) {
      return Response.json({ erreur: resultat.erreur }, { status: resultat.statut });
    }
    return Response.json({ url: resultat.url });
  } catch (erreur) {
    if (erreur instanceof ConfigurationManquante) {
      return Response.json(
        { erreur: 'Paiement pas encore activé sur cet environnement.' },
        { status: 503 },
      );
    }
    console.error('checkout en échec', erreur);
    return Response.json({ erreur: 'Erreur interne.' }, { status: 500 });
  }
};
