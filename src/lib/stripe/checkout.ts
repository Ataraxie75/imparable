/**
 * Création de la session Stripe Checkout (PRD §18, flux Audit 29 €).
 *
 * Principe de défiance : le serveur RECALCULE l'audit depuis les réponses —
 * le résultat envoyé par le client n'est jamais cru. Le moteur étant
 * déterministe, le verdict payé est exactement le verdict affiché.
 */
import Stripe from 'stripe';
import { computeAudit } from '../moteur/audit';
import { TAXONOMIE } from '../moteur/taxonomie.generated';
import type { ReponsesAudit } from '../moteur/types';
import { secret, urlSite } from '../serveur/env';
import { clientServiceRole } from '../serveur/supabase';
import { LIBELLE_AUDIT, PRIX_AUDIT_CENTIMES } from './produits';

export interface DemandeCheckout {
  email: string;
  reponses: ReponsesAudit;
}

export async function creerSessionCheckout(
  demande: DemandeCheckout,
): Promise<{ url: string } | { erreur: string; statut: number }> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demande.email)) {
    return { erreur: 'Adresse email invalide.', statut: 400 };
  }

  // Recalcul serveur — zéro confiance dans le client.
  const resultat = computeAudit(demande.reponses, TAXONOMIE);
  if (resultat.global === 'hors_perimetre') {
    return {
      erreur: "Cas hors périmètre : aucune attestation ne peut être émise (R7).",
      statut: 422,
    };
  }

  const supabase = clientServiceRole();
  const { data: audit, error } = await supabase
    .from('audits')
    .insert({
      email: demande.email,
      reponses: demande.reponses,
      resultat,
      statut_global: resultat.global,
      rules_version: resultat.rulesVersion,
    })
    .select('id')
    .single();
  if (error || !audit) {
    console.error('checkout: insertion audit impossible', error);
    return { erreur: 'Enregistrement impossible, réessayez.', statut: 500 };
  }

  const stripe = new Stripe(secret('STRIPE_SECRET_KEY'));
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: demande.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: PRIX_AUDIT_CENTIMES,
          product_data: { name: LIBELLE_AUDIT },
        },
      },
    ],
    metadata: { audit_id: audit.id },
    success_url: `${urlSite()}/audit/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${urlSite()}/audit`,
  });

  if (!session.url) return { erreur: 'Session de paiement indisponible.', statut: 502 };

  // Idempotence du webhook : la session est rattachée à l'audit.
  await supabase.from('audits').update({ stripe_session_id: session.id }).eq('id', audit.id);
  return { url: session.url };
}
