/**
 * Traitement du webhook `checkout.session.completed` (PRD §18).
 *
 * Garanties : signature vérifiée en amont (route API) · idempotence par
 * `stripe_session_id` (une attestation existante n'est jamais ré-émise) ·
 * numéro généré côté serveur (séquence SQL) · document stocké en bucket
 * privé, lié par URL signée · SHA-256 stocké.
 *
 * Format du document : PDF, rendu par Chromium headless à partir du HTML
 * autoporté du template SPEC-PDF (voir `pdf/rendu.ts`).
 */
import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import tokensCss from '../../styles/tokens.css?raw';
import {
  attestationDocumentHTML,
  typeDocument,
} from '../pdf/attestation';
import { htmlVersPdf } from '../pdf/rendu';
import type { ReponsesAudit, ResultatAudit } from '../moteur/types';
import { secret, urlSite } from '../serveur/env';
import { clientServiceRole } from '../serveur/supabase';
import { htmlLivraison, sujetLivraison, texteLivraison } from '../email/livraison';

const BUCKET = 'attestations';

async function genererDocument(
  html: string,
): Promise<{ contenu: Buffer; contentType: string; extension: string }> {
  const contenu = await htmlVersPdf(html);
  return { contenu, contentType: 'application/pdf', extension: 'pdf' };
}

export async function traiterPaiementValide(stripeSessionId: string): Promise<{ ok: boolean; detail: string }> {
  const supabase = clientServiceRole();

  const { data: audit, error } = await supabase
    .from('audits')
    .select('id, email, reponses, resultat, statut_global, paid_at')
    .eq('stripe_session_id', stripeSessionId)
    .single();
  if (error || !audit) return { ok: false, detail: `audit introuvable pour la session ${stripeSessionId}` };

  // Idempotence : Stripe rejoue ses webhooks, l'émission ne se rejoue pas.
  const { data: existante } = await supabase
    .from('attestations')
    .select('numero')
    .eq('audit_id', audit.id)
    .maybeSingle();
  if (existante) return { ok: true, detail: `déjà émise : ${existante.numero}` };

  await supabase.from('audits').update({ paid_at: new Date().toISOString() }).eq('id', audit.id);

  const { data: numero, error: erreurNumero } = await supabase.rpc('prochain_numero_attestation');
  if (erreurNumero || typeof numero !== 'string') {
    return { ok: false, detail: 'numérotation indisponible' };
  }

  const resultat = audit.resultat as ResultatAudit;
  const reponses = audit.reponses as ReponsesAudit;
  const type = typeDocument(resultat);
  const urlVerification = `${urlSite()}/verifier/${numero}`;

  const html = attestationDocumentHTML(
    reponses,
    resultat,
    {
      numero,
      emiseLe: new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(new Date()),
      urlVerification,
    },
    tokensCss,
  );

  const document = await genererDocument(html);
  const sha256 = createHash('sha256').update(document.contenu).digest('hex');
  const chemin = `${numero}.${document.extension}`;

  const { error: erreurUpload } = await supabase.storage
    .from(BUCKET)
    .upload(chemin, document.contenu, { contentType: document.contentType, upsert: false });
  if (erreurUpload) return { ok: false, detail: `stockage impossible : ${erreurUpload.message}` };

  const { error: erreurInsertion } = await supabase.from('attestations').insert({
    numero,
    audit_id: audit.id,
    type,
    pdf_sha256: sha256,
  });
  if (erreurInsertion) return { ok: false, detail: `insertion attestation : ${erreurInsertion.message}` };

  const contenu = {
    type,
    numero,
    urlLivraison: `${urlSite()}/audit/merci?session_id=${stripeSessionId}`,
    urlVerification,
  };
  const resend = new Resend(secret('RESEND_API_KEY'));
  const { error: erreurEmail } = await resend.emails.send({
    from: process.env['RESEND_FROM'] ?? 'IMPARABLE <attestations@imparable.fr>',
    to: audit.email,
    subject: sujetLivraison(contenu),
    text: texteLivraison(contenu),
    html: htmlLivraison(contenu),
  });
  if (erreurEmail) {
    // Le document est émis et récupérable sur E6 : l'échec d'email se logge,
    // Stripe ne doit pas rejouer l'émission.
    console.error('livraison email en échec', erreurEmail);
  }

  return { ok: true, detail: `émise : ${numero}` };
}

/** URL signée (7 jours) vers le document stocké — utilisée par E6. */
export async function lienDocument(numero: string, extension = 'pdf'): Promise<string | null> {
  const supabase = clientServiceRole();
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(`${numero}.${extension}`, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}
