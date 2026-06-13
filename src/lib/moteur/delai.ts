/**
 * MOTEUR-DELAI — computation du délai de convocation d'AG de copropriété.
 *
 * Librairie pure : zéro dépendance, zéro I/O. Arithmétique de dates civiles
 * (année/mois/jour entiers) — jamais `Date` ni timezone : le moteur calcule,
 * l'affichage formate.
 *
 * Règles R1–R7 (PRD §5.1) :
 *   R1 point de départ · R2 durée N · R3 dernier jour · R4 première date
 *   légale d'AG · R5 pas de prorogation (art. 642 al. 2 CPC inapplicable —
 *   tout code de prorogation est un bug) · R6 verdict · R7 hors périmètre.
 *
 * Sources : art. 9 et 64 du décret n°67-223 du 17 mars 1967 · art. 42 et
 * 42-1 de la loi n°65-557 du 10 juillet 1965 · Cass. 3e civ., 4 déc. 2025.
 */

import type { EntreeDelai, VerdictDelai } from './types';

/** R2 — 21 jours, d'ordre public (art. 9 décret n°67-223 du 17 mars 1967). */
export const DELAI_LEGAL_MIN = 21;
/** R2 — borne haute de saisie du délai conventionnel. */
export const DELAI_REGLEMENT_MAX = 90;

// ── Dates civiles ───────────────────────────────────────────────────────────

interface DateCivile {
  annee: number;
  mois: number; // 1–12
  jour: number; // 1–31
}

function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

function joursDansMois(annee: number, mois: number): number {
  const JOURS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
  if (mois === 2 && estBissextile(annee)) return 29;
  return JOURS[mois - 1] ?? 0;
}

function parseDateCivile(iso: string): DateCivile {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Date invalide : « ${iso} » (attendu : YYYY-MM-DD)`);
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  const jour = Number(m[3]);
  if (mois < 1 || mois > 12 || jour < 1 || jour > joursDansMois(annee, mois)) {
    throw new Error(`Date inexistante au calendrier : « ${iso} »`);
  }
  return { annee, mois, jour };
}

/**
 * Nombre de jours écoulés depuis l'époque civile 1970-01-01 (jour 0).
 * Algorithme « days from civil » de Howard Hinnant — entiers uniquement.
 */
function versJours(d: DateCivile): number {
  const a = d.mois <= 2 ? d.annee - 1 : d.annee;
  const ere = Math.floor(a / 400);
  const aDeEre = a - ere * 400; // [0, 399]
  const jourDeAn =
    Math.floor((153 * (d.mois + (d.mois > 2 ? -3 : 9)) + 2) / 5) + d.jour - 1; // [0, 365]
  const jourDeEre =
    aDeEre * 365 + Math.floor(aDeEre / 4) - Math.floor(aDeEre / 100) + jourDeAn; // [0, 146096]
  return ere * 146097 + jourDeEre - 719468;
}

/** Réciproque de versJours. */
function depuisJours(z: number): DateCivile {
  const zz = z + 719468;
  const ere = Math.floor(zz / 146097);
  const jourDeEre = zz - ere * 146097; // [0, 146096]
  const aDeEre = Math.floor(
    (jourDeEre - Math.floor(jourDeEre / 1460) + Math.floor(jourDeEre / 36524) - Math.floor(jourDeEre / 146096)) / 365,
  ); // [0, 399]
  const a = aDeEre + ere * 400;
  const jourDeAn =
    jourDeEre - (aDeEre * 365 + Math.floor(aDeEre / 4) - Math.floor(aDeEre / 100)); // [0, 365]
  const mp = Math.floor((5 * jourDeAn + 2) / 153); // [0, 11]
  const jour = jourDeAn - Math.floor((153 * mp + 2) / 5) + 1; // [1, 31]
  const mois = mp < 10 ? mp + 3 : mp - 9; // [1, 12]
  return { annee: mois <= 2 ? a + 1 : a, mois, jour };
}

function formatISO(d: DateCivile): string {
  const mm = String(d.mois).padStart(2, '0');
  const jj = String(d.jour).padStart(2, '0');
  return `${d.annee}-${mm}-${jj}`;
}

/** Ajoute `n` jours civils à une date ISO. R5 : aucune prorogation, jamais. */
function ajouterJours(iso: string, n: number): string {
  return formatISO(depuisJours(versJours(parseDateCivile(iso)) + n));
}

/** Écart signé en jours entre deux dates ISO (`b − a`). */
function ecartJours(a: string, b: string): number {
  return versJours(parseDateCivile(b)) - versJours(parseDateCivile(a));
}

// ── Moteur ──────────────────────────────────────────────────────────────────

export function computeDelai(e: EntreeDelai): VerdictDelai {
  // R7 — le moteur ne rend JAMAIS de verdict sur un cas non modélisé.
  if (e.urgence) {
    return {
      statut: 'hors_perimetre',
      raison:
        "Convocation d'urgence : le « délai raisonnable » de l'art. 9 al. 3 du décret du 17 mars 1967 " +
        "relève d'une appréciation au cas par cas, non modélisée. Faites valider la convocation par un avocat.",
    };
  }

  // Valide les deux dates avant tout calcul.
  parseDateCivile(e.dateNotification);
  parseDateCivile(e.dateAG);

  // R2 — N = max(21, délai du règlement), clampé à [21, 90]. 21 est d'ordre public.
  const saisie = e.delaiReglement ?? DELAI_LEGAL_MIN;
  const n = Math.min(Math.max(Math.trunc(saisie), DELAI_LEGAL_MIN), DELAI_REGLEMENT_MAX);
  const delaiCorrige = n !== saisie;

  // R1 — point de départ.
  //   LRAR : lendemain de la première présentation (pas l'envoi, pas le retrait).
  //   Main propre contre récépissé/émargement : jour de la remise.
  //   LRE : lendemain de l'envoi.
  const j1 =
    e.mode === 'main_propre' ? e.dateNotification : ajouterJours(e.dateNotification, 1);

  // R3 — le N-ième jour expire à minuit.
  const dernierJour = ajouterJours(j1, n - 1);

  // R4 — l'AG ne peut se tenir qu'à partir du (N+1)-ième jour ;
  // le jour de l'AG ne compte jamais dans le délai.
  const agLegale = ajouterJours(j1, n);

  // R6 — verdict + marge signée.
  const margeJours = ecartJours(agLegale, e.dateAG);
  return {
    statut: margeJours >= 0 ? 'conforme' : 'annulable',
    j1,
    dernierJour,
    agLegale,
    margeJours,
    n,
    delaiCorrige,
  };
}
