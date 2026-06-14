/**
 * SPEC-PDF (PRD §19) — template de l'attestation / du rapport de vérification.
 *
 * Fonction pure : (réponses, résultat, méta) → HTML autoporté, rendu en PDF
 * par la fonction serverless du LOT 4 (et affiché en spécimen sur le site).
 * Global `conforme` → « Attestation de vérification de conformité » ;
 * sinon → « Rapport de vérification ».
 *
 * Mise en forme alignée sur la DA du site. Librairie pure (zéro import
 * d'asset) : le CSS des tokens est fourni par l'appelant, et toutes les
 * couleurs passent par var() — check-color-tokens reste la source unique.
 */
import type { ReponsesAudit, ResultatAudit, ResultatItem, StatutItem } from '../moteur/types';

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

const LIBELLES_STATUT: Record<StatutItem, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  vigilance: 'Vigilance',
};

const RISQUE: Record<StatutItem, string> = {
  conforme: 'Conforme · aucune réserve',
  non_conforme: 'Risque élevé · décisions annulables',
  vigilance: 'À sécuriser avant l’envoi',
};

/** Priorité d'affichage : les problèmes d'abord. */
const ORDRE: Record<StatutItem, number> = { non_conforme: 0, vigilance: 1, conforme: 2 };

function e(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Styles du document — premium, alignés DA, 100 % via var() (zéro hex). */
export const ATTESTATION_CSS = `
.attestation {
  font-family: var(--police-texte); color: var(--encre); background: var(--carte);
  max-width: 820px; margin: 0 auto; padding: 44px 48px 40px;
  border: 1px solid var(--carte-bord); border-radius: var(--carte-rayon);
  box-shadow: var(--carte-ombre); position: relative; overflow: hidden;
  font-size: 13.5px; line-height: 1.6;
}
.attestation::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
  background: var(--voltage-grad);
}
.att-entete { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
.att-marque {
  font-family: var(--police-display); font-weight: 800; font-size: 17px; letter-spacing: 0.05em;
  background: var(--voltage-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.att-meta { font-size: 11.5px; color: var(--encre-3); text-align: right; line-height: 1.5; }
.att-surlabel {
  font-family: var(--police-display); font-weight: 800; font-size: 11px;
  letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 4px;
  background: var(--voltage-grad); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.att-h1 { font-family: var(--police-display); font-weight: 800; font-size: 25px; margin: 0 0 20px; color: var(--encre); }

.att-verdict { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; border-radius: 16px; padding: 16px 20px; margin-bottom: 22px; }
.att-verdict.v-conforme { background: var(--verdict-conforme-fond); }
.att-verdict.v-non_conforme { background: var(--verdict-annulable-fond); }
.att-verdict.v-vigilance { background: var(--verdict-vigilance-fond); }
.att-pastille { font-family: var(--police-display); font-weight: 800; font-size: 13px; padding: 6px 16px; border-radius: 999px; color: var(--encre-inverse); }
.att-verdict.v-conforme .att-pastille { background: var(--verdict-conforme); }
.att-verdict.v-non_conforme .att-pastille { background: var(--verdict-annulable); }
.att-verdict.v-vigilance .att-pastille { background: var(--verdict-vigilance); }
.att-risque { font-family: var(--police-display); font-weight: 800; font-size: 13px; }
.att-verdict.v-conforme .att-risque { color: var(--verdict-conforme); }
.att-verdict.v-non_conforme .att-risque { color: var(--verdict-annulable); }
.att-verdict.v-vigilance .att-risque { color: var(--verdict-vigilance); }
.att-compteurs { margin-left: auto; font-size: 12px; color: var(--encre-2); }

.att-synthese { background: var(--champ-fond); border: 1px solid var(--carte-bord); border-radius: 14px; padding: 18px 22px; margin-bottom: 22px; }
.att-synthese h2 { font-family: var(--police-display); font-weight: 800; font-size: 15px; margin: 0 0 12px; }
.att-actions { margin: 0; padding: 0; list-style: none; counter-reset: a; }
.att-actions li { counter-increment: a; position: relative; padding-left: 32px; margin-bottom: 10px; }
.att-actions li:last-child { margin-bottom: 0; }
.att-actions li::before {
  content: counter(a); position: absolute; left: 0; top: -1px; width: 22px; height: 22px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--police-display); font-weight: 800; font-size: 11px;
  color: var(--encre-inverse); background: var(--voltage-grad);
}

.att-section { font-family: var(--police-display); font-weight: 800; font-size: 15px; margin: 26px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--carte-bord); }
.att-table { width: 100%; border-collapse: collapse; }
.att-table td { padding: 7px 8px; border-bottom: 1px solid var(--carte-bord); }
.att-table tr:last-child td { border-bottom: 0; }
.att-table td:first-child { color: var(--encre-3); }
.att-table td:last-child { font-weight: 700; text-align: right; }

.att-item { border: 1px solid var(--carte-bord); border-left: 4px solid var(--carte-bord); border-radius: 12px; padding: 13px 16px; margin-bottom: 10px; }
.att-item.s-conforme { border-left-color: var(--verdict-conforme); }
.att-item.s-non_conforme { border-left-color: var(--verdict-annulable); }
.att-item.s-vigilance { border-left-color: var(--verdict-vigilance); }
.att-item-tete { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.att-item-code { font-family: var(--police-display); font-weight: 800; font-size: 11px; color: var(--encre-3); }
.att-item-titre { font-family: var(--police-display); font-weight: 700; font-size: 13.5px; flex: 1; }
.att-item-statut { font-family: var(--police-display); font-weight: 800; font-size: 10.5px; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.att-item.s-conforme .att-item-statut { color: var(--verdict-conforme); background: var(--verdict-conforme-fond); }
.att-item.s-non_conforme .att-item-statut { color: var(--verdict-annulable); background: var(--verdict-annulable-fond); }
.att-item.s-vigilance .att-item-statut { color: var(--verdict-vigilance); background: var(--verdict-vigilance-fond); }
.att-item p { margin: 0 0 7px; }
.att-action { background: var(--voile-violet); border-radius: 8px; padding: 8px 12px; font-size: 12.5px; margin-bottom: 7px; }
.att-ref { color: var(--encre-3); font-size: 11px; }

.att-limite { border: 1px solid var(--carte-bord); border-radius: 12px; padding: 12px 16px; font-size: 11.5px; color: var(--encre-2); margin-top: 24px; }
.att-pied { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 18px; font-size: 11px; color: var(--encre-3); }
.att-qr { width: 72px; height: 72px; border: 1.5px dashed var(--carte-bord); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 9px; text-align: center; color: var(--encre-3); flex: none; }
.att-filigrane { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; font-family: var(--police-display); font-weight: 800; font-size: 92px; letter-spacing: 0.2em; color: var(--voile-violet); transform: rotate(-28deg); }
`;

/**
 * Fragment HTML du document (sans <html>) — embarqué tel quel sur le site,
 * et enveloppé par `attestationDocumentHTML` pour le rendu PDF.
 */
export function attestationFragmentHTML(
  reponses: ReponsesAudit,
  resultat: ResultatAudit,
  meta: MetaAttestation,
): string {
  if (resultat.global === 'hors_perimetre' || resultat.delai.statut === 'hors_perimetre') {
    throw new Error('Aucune attestation ne peut être émise sur un cas hors périmètre (R7).');
  }

  const titre =
    resultat.global === 'conforme'
      ? 'Attestation de vérification de conformité'
      : 'Rapport de vérification';

  const delai = resultat.delai;
  const nb = (s: StatutItem) => resultat.items.filter((i) => i.statut === s).length;
  const corrections = resultat.items.filter((i) => i.statut === 'non_conforme');
  const vigilances = resultat.items.filter((i) => i.statut === 'vigilance');
  const itemsTries = [...resultat.items].sort((a, b) => ORDRE[a.statut] - ORDRE[b.statut]);

  // Synthèse en tête : les corrections prioritaires, sinon les vigilances, sinon le conforme.
  let synthese: string;
  if (corrections.length > 0) {
    const actions = corrections
      .map((i) => `<li><strong>${e(i.libelle)}.</strong> ${e(i.actionCorrective ?? i.explication)}</li>`)
      .join('');
    synthese = `<div class="att-synthese"><h2>Vos corrections prioritaires (${corrections.length})</h2><ol class="att-actions">${actions}</ol></div>`;
  } else if (vigilances.length > 0) {
    const items = vigilances
      .map((i) => `<li><strong>${e(i.libelle)}.</strong> ${e(i.explication)}</li>`)
      .join('');
    synthese = `<div class="att-synthese"><h2>Points à faire vérifier (${vigilances.length})</h2><ol class="att-actions">${items}</ol></div>`;
  } else {
    synthese = `<div class="att-synthese"><h2>Aucune correction requise</h2><p style="margin:0;">Votre convocation est conforme sur les ${resultat.items.length} points contrôlés.</p></div>`;
  }

  const lignesItems = itemsTries
    .map(
      (item) => `
      <div class="att-item s-${item.statut}">
        <div class="att-item-tete">
          <span class="att-item-code">${e(item.code)}</span>
          <span class="att-item-titre">${e(item.libelle)}</span>
          <span class="att-item-statut">${LIBELLES_STATUT[item.statut]}</span>
        </div>
        <p>${e(item.explication)}</p>
        ${item.actionCorrective ? `<div class="att-action"><strong>Action corrective :</strong> ${e(item.actionCorrective)}</div>` : ''}
        <div class="att-ref">${e(item.refLegale)}</div>
      </div>`,
    )
    .join('');

  const verdictLabel =
    resultat.global === 'conforme'
      ? 'CONFORME'
      : resultat.global === 'non_conforme'
        ? 'NON CONFORME'
        : 'VIGILANCES À LEVER';

  return `
<div class="attestation">
  ${meta.specimen ? '<div class="att-filigrane" aria-hidden="true">SPÉCIMEN</div>' : ''}
  <div class="att-entete">
    ${
      meta.logoCabinetUrl
        ? `<img src="${e(meta.logoCabinetUrl)}" alt="Logo du cabinet" style="max-height:36px;" />`
        : '<span class="att-marque">IMPARABLE</span>'
    }
    <div class="att-meta">
      N° <strong>${e(meta.numero)}</strong><br />
      Émise le ${e(meta.emiseLe)}<br />
      Règles vérifiées au ${e(resultat.rulesVersion)}
    </div>
  </div>

  <p class="att-surlabel">${titre}</p>
  <h1 class="att-h1">Convocation d'assemblée générale de copropriété</h1>

  <div class="att-verdict v-${resultat.global}">
    <span class="att-pastille">${verdictLabel}</span>
    <span class="att-risque">${RISQUE[resultat.global]}</span>
    <span class="att-compteurs">${nb('conforme')} conformes · ${nb('non_conforme')} à corriger · ${nb('vigilance')} à vérifier</span>
  </div>

  ${synthese}

  <h2 class="att-section">Le calcul du délai de convocation</h2>
  <table class="att-table">
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

  <h2 class="att-section">Les ${resultat.items.length} points contrôlés</h2>
  ${lignesItems}

  <div class="att-limite">
    Ce document atteste d'une vérification formelle réalisée à la date indiquée, sur la base des
    déclarations fournies. Il ne constitue pas un conseil juridique.
  </div>

  <div class="att-pied">
    <div>
      Authenticité vérifiable à tout moment :<br />
      <strong>${e(meta.urlVerification)}</strong>
    </div>
    <div class="att-qr">QR<br />/verifier</div>
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
<style>body { margin: 0; padding: 24px; background: var(--fond-debut); } ${ATTESTATION_CSS}</style>
</head>
<body>${attestationFragmentHTML(reponses, resultat, meta)}</body>
</html>`;
}
