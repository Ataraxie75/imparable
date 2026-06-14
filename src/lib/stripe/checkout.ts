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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_RESOLUTIONS = 60;

export async function creerSessionCheckout(
  demande: DemandeCheckout,
): Promise<{ url: string } | { erreur: string; statut: number }> {
  // Validation défensive — endpoint public non authentifié.
  if (!demande || typeof demande !== 'object') {
    return { erreur: 'Requête invalide.', statut: 400 };
  }
  const { email, reponses } = demande;
  if (typeof email !== 'string' || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return { erreur: 'Adresse email invalide.', statut: 400 };
  }
  if (!reponses || typeof reponses !== 'object' || Array.isArray(reponses)) {
    return { erreur: "Données d'audit invalides.", statut: 400 };
  }
  if (Array.isArray(reponses.resolutions) && reponses.resolutions.length > MAX_RESOLUTIONS) {
    return { erreur: 'Nombre de résolutions excessif.', statut: 400 };
  }

  // Recalcul serveur — zéro confiance dans le client. Toute donnée illisible
  // (date inexistante, structure cassée) est rejetée proprement.
  let resultat;
  try {
    resultat = computeAudit(reponses, TAXONOMIE);
  } catch {
    return { erreur: "Données d'audit illisibles.", statut: 422 };
  }
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
      email,
      reponses,
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
    customer_email: email,
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
