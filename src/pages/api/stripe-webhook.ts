/**
 * POST /api/stripe-webhook — vérification de signature OBLIGATOIRE,
 * idempotence par stripe_session_id, échec loggé + retry Stripe natif
 * (PRD §18) : toute réponse non-2xx déclenche le rejeu côté Stripe.
 */
import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { secret } from '../../lib/serveur/env';
import { traiterPaiementValide } from '../../lib/stripe/webhook';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('signature absente', { status: 400 });

  let evenement: Stripe.Event;
  try {
    const stripe = new Stripe(secret('STRIPE_SECRET_KEY'));
    evenement = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      secret('STRIPE_WEBHOOK_SECRET'),
    );
  } catch (erreur) {
    console.error('webhook : signature invalide ou configuration absente', erreur);
    return new Response('signature invalide', { status: 400 });
  }

  if (evenement.type !== 'checkout.session.completed') {
    return new Response('ignoré', { status: 200 });
  }

  const session = evenement.data.object as Stripe.Checkout.Session;
  const resultat = await traiterPaiementValide(session.id);
  if (!resultat.ok) {
    console.error(`webhook ${session.id} : ${resultat.detail}`);
    return new Response(resultat.detail, { status: 500 }); // → retry Stripe
  }
  return new Response(resultat.detail, { status: 200 });
};
