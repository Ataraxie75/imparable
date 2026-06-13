/**
 * SPEC-PDF (PRD §19) — template de l'attestation / du rapport de vérification.
 *
 * Fonction pure : (réponses, résultat, méta) → HTML autoporté, rendu en PDF
 * par la fonction serverless du LOT 4 (et affiché en spécimen sur le site).
 * Global `conforme` → « Attestation de vérification de conformité » ;
 * sinon → « Rapport de vérification » : l'utilisateur paie le diagnostic
 * dans les deux cas.
 *
 * Librairie pure (zéro import d'asset) : le CSS des tokens est fourni par
 * l'appelant (`?raw` côté Astro, lecture fichier côté serverless), si bien
 * que check-color-tokens reste la source unique du design.
 */
import type { ReponsesAudit, ResultatAudit, ResultatItem } from '../moteur/types';

/** conforme → attestation ; sinon → rapport (PRD §19, schéma §17). */
export function typeDocument(resultat: ResultatAudit): 'attestation' | 'rapport' {
  if (resultat.global === 'hors_perimetre') {
    throw new Error('Aucun document ne peut être émis sur un cas hors périmètre (R7).');
  }
  return resultat.global === 'conforme' ? 'attestation' : 'rapport';
}

export interface MetaAttestation {
  /** ex. 'IMP-2026-00042' — généré serveur via attestation_seq (LOT 4). */
  numero: string;
  /** Horodatage d'émission, affiché tel quel. */
  emiseLe: string;
  /** URL publique de vérification d'authenticité (E7). */
  urlVerification: string;
  /** Logo du cabinet (Pass Cabinet) — sinon marque IMPARABLE. */
  logoCabinetUrl?: string;
  /** Filigrane SPÉCIMEN (démonstration sur le site, jamais en production). */
  specimen?: boolean;
}

const LIBELLES_MODE: Record<string, string> = {
  lrar: 'Lettre recommandée AR (première présentation)',
  main_propre: 'Remise en main propre contre récépissé/émargement',
  lre: 'Lettre recommandée électronique (envoi)',
};

const LIBELLES_STATUT: Record<ResultatItem['statut'], string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  vigilance: 'Vigilance',
};

function e(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Styles du document — consomme les variables de tokens.css. */
export const ATTESTATION_CSS = `
.attestation {
  font-family: var(--police-texte);
  color: var(--encre);
  background: var(--carte);
  max-width: 760px;
  margin: 0 auto;
  padding: 40px 48px;
  border: 1px solid var(--carte-bord);
  border-radius: var(--carte-rayon);
  position: relative;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.55;
}
.attestation h1 {
  font-family: var(--police-display);
  font-weight: var(--graisse-display);
  font-size: 21px;
  margin: 0 0 2px;
}
.attestation .marque {
  font-family: var(--police-display);
  font-weight: var(--graisse-display);
  letter-spacing: 0.06em;
  background: var(--voltage-grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 15px;
}
.attestation .entete-doc {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--carte-bord);
  padding-bottom: 14px;
  margin-bottom: 18px;
}
.attestation .numero { font-size: 12px; color: var(--encre-3); text-align: right; }
.attestation .verdict-global {
  display: inline-block;
  border-radius: 999px;
  padding: 5px 16px;
  font-family: var(--police-display);
  font-weight: var(--graisse-display);
  font-size: 13px;
  margin: 4px 0 14px;
}
.attestation .verdict-global.g-conforme { color: var(--verdict-conforme); background: var(--verdict-conforme-fond); }
.attestation .verdict-global.g-non_conforme { color: var(--verdict-annulable); background: var(--verdict-annulable-fond); }
.attestation .verdict-global.g-vigilance { color: var(--verdict-vigilance); background: var(--verdict-vigilance-fond); }
.attestation table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
.attestation th, .attestation td {
  text-align: left;
  padding: 5px 8px;
  border-bottom: 1px solid var(--carte-bord);
  vertical-align: top;
}
.attestation th {
  font-family: var(--police-display);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--encre-3);
}
.attestation h2 {
  font-family: var(--police-display);
  font-weight: var(--graisse-display);
  font-size: 14px;
  margin: 18px 0 6px;
}
.attestation .item { padding: 6px 0 6px 12px; border-left: 3px solid var(--carte-bord); margin-bottom: 6px; }
.attestation .item.s-conforme { border-left-color: var(--verdict-conforme); }
.attestation .item.s-non_conforme { border-left-color: var(--verdict-annulable); }
.attestation .item.s-vigilance { border-left-color: var(--verdict-vigilance); }
.attestation .item .statut { font-weight: 700; }
.attestation .item.s-conforme .statut { color: var(--verdict-conforme); }
.attestation .item.s-non_conforme .statut { color: var(--verdict-annulable); }
.attestation .item.s-vigilance .statut { color: var(--verdict-vigilance); }
.attestation .item .ref { color: var(--encre-3); font-size: 11px; }
.attestation .limite {
  border: 1.5px solid var(--carte-bord);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 11px;
  color: var(--encre-2);
  margin-top: 18px;
}
.attestation .pied-doc {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 18px;
  font-size: 11px;
  color: var(--encre-3);
}
.attestation .qr {
  width: 74px;
  height: 74px;
  border: 1.5px dashed var(--carte-bord);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  text-align: center;
  color: var(--encre-3);
  flex: none;
}
.attestation .filigrane {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-family: var(--police-display);
  font-weight: var(--graisse-display);
  font-size: 96px;
  letter-spacing: 0.2em;
  color: var(--voile-violet);
  transform: rotate(-28deg);
}
`;

/**
 * Fragment HTML du document (sans <html>) — embarqué tel quel sur la page
 * spécimen, et enveloppé par `attestationDocumentHTML` pour le rendu PDF.
 */
export function attestationFragmentHTML(
  reponses: ReponsesAudit,
  resultat: ResultatAudit,
  meta: MetaAttestation,
): string {
  if (resultat.global === 'hors_perimetre') {
    throw new Error('Aucune attestation ne peut être émise sur un cas hors périmètre (R7).');
  }
  if (resultat.delai.statut === 'hors_perimetre') {
    throw new Error('Aucune attestation ne peut être émise sur un cas hors périmètre (R7).');
  }

  const titre =
    resultat.global === 'conforme'
      ? 'Attestation de vérification de conformité'
      : 'Rapport de vérification';

  const delai = resultat.delai;
  const corrections = resultat.items.filter((i) => i.statut !== 'conforme');

  const lignesItems = resultat.items
    .map(
      (item) => `
      <div class="item s-${item.statut}">
        <div><strong>${e(item.code)} — ${e(item.libelle)}</strong> · <span class="statut">${LIBELLES_STATUT[item.statut]}</span></div>
        <div>${e(item.explication)}</div>
        ${item.actionCorrective ? `<div><strong>Action corrective :</strong> ${e(item.actionCorrective)}</div>` : ''}
        <div class="ref">${e(item.refLegale)}</div>
      </div>`,
    )
    .join('');

  return `
<div class="attestation">
  ${meta.specimen ? '<div class="filigrane" aria-hidden="true">SPÉCIMEN</div>' : ''}
  <div class="entete-doc">
    <div>
      ${
        meta.logoCabinetUrl
          ? `<img src="${e(meta.logoCabinetUrl)}" alt="Logo du cabinet" style="max-height:36px;" />`
          : '<span class="marque">IMPARABLE</span>'
      }
      <h1>${titre}</h1>
      <div>Convocation d'assemblée générale de copropriété</div>
    </div>
    <div class="numero">
      N° <strong>${e(meta.numero)}</strong><br />
      Émise le ${e(meta.emiseLe)}<br />
      Règles vérifiées au ${e(resultat.rulesVersion)}
    </div>
  </div>

  <span class="verdict-global g-${resultat.global}">
    ${resultat.global === 'conforme' ? 'CONFORME' : resultat.global === 'non_conforme' ? 'NON CONFORME' : 'VIGILANCES À LEVER'}
  </span>

  ${
    corrections.length > 0
      ? `<h2>Points à reprendre (${corrections.length})</h2>
         <p>Chaque point ci-dessous comporte son explication et, le cas échéant, son action corrective datée.</p>`
      : ''
  }

  <h2>Computation du délai de convocation</h2>
  <table>
    <tbody>
      <tr><td>Mode de notification</td><td>${e(LIBELLES_MODE[reponses.delai.mode] ?? reponses.delai.mode)}</td></tr>
      <tr><td>Date de notification</td><td>${e(reponses.delai.dateNotification)}</td></tr>
      <tr><td>Point de départ du délai (J1)</td><td>${e(delai.j1)}</td></tr>
      <tr><td>Durée du délai (N)</td><td>${delai.n} jours</td></tr>
      <tr><td>Dernier jour du délai</td><td>${e(delai.dernierJour)}</td></tr>
      <tr><td>Première date légale d'AG</td><td>${e(delai.agLegale)}</td></tr>
      <tr><td>Date d'AG déclarée</td><td>${e(reponses.delai.dateAG)}</td></tr>
      <tr><td>Marge</td><td>${delai.margeJours >= 0 ? `+${delai.margeJours}` : delai.margeJours} jour(s)</td></tr>
    </tbody>
  </table>

  <h2>Points contrôlés (${resultat.items.length})</h2>
  ${lignesItems}

  <div class="limite">
    Ce document atteste d'une vérification formelle réalisée à la date indiquée, sur la base des
    déclarations fournies. Il ne constitue pas un conseil juridique.
  </div>

  <div class="pied-doc">
    <div>
      Authenticité vérifiable à tout moment :<br />
      <strong>${e(meta.urlVerification)}</strong>
    </div>
    <div class="qr">QR<br />/verifier</div>
  </div>
</div>`;
}

/** Document autoporté (tokens inclus) — entrée du rendu PDF serverless (LOT 4). */
export function attestationDocumentHTML(
  reponses: ReponsesAudit,
  resultat: ResultatAudit,
  meta: MetaAttestation,
  tokensCss: string,
): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${e(meta.numero)}</title>
<style>${tokensCss}</style>
<style>body { margin: 0; padding: 24px; background: var(--carte); } ${ATTESTATION_CSS}</style>
</head>
<body>${attestationFragmentHTML(reponses, resultat, meta)}</body>
</html>`;
}
