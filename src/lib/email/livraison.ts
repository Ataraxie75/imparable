/**
 * Email de livraison (PRD §18) — sobre, texte d'abord, zéro image traquante.
 * Fonctions pures : testables sans Resend.
 */

export interface ContenuLivraison {
  type: 'attestation' | 'rapport';
  numero: string;
  urlLivraison: string;
  urlVerification: string;
}

export function sujetLivraison(c: ContenuLivraison): string {
  return c.type === 'attestation'
    ? `Votre attestation de conformité ${c.numero}`
    : `Votre rapport de vérification ${c.numero}`;
}

export function texteLivraison(c: ContenuLivraison): string {
  const nomDocument =
    c.type === 'attestation' ? 'attestation de vérification de conformité' : 'rapport de vérification';
  return [
    `Bonjour,`,
    ``,
    `Votre ${nomDocument} n° ${c.numero} est disponible :`,
    c.urlLivraison,
    ``,
    `Son authenticité est vérifiable à tout moment, par vous ou par un tiers :`,
    c.urlVerification,
    ``,
    `Ce document atteste d'une vérification formelle réalisée à la date indiquée.`,
    `Il ne constitue pas un conseil juridique.`,
    ``,
    `IMPARABLE — https://imparable.fr`,
  ].join('\n');
}

export function htmlLivraison(c: ContenuLivraison): string {
  return texteLivraison(c)
    .split('\n\n')
    .map((p) => `<p>${p.replace(/\n/g, '<br />').replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`)
    .join('\n');
}
