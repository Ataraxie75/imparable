/**
 * Types partagés du moteur juridique IMPARABLE.
 *
 * Librairie pure : zéro dépendance, zéro I/O, zéro `Date` pour le calcul.
 * Sources normatives : loi n°65-557 du 10 juillet 1965 (art. 24, 25, 26,
 * 42, 42-1) · décret n°67-223 du 17 mars 1967 (art. 7 à 11, 13, 64) ·
 * Cass. 3e civ., 4 déc. 2025.
 */

// ── MOTEUR-DELAI ────────────────────────────────────────────────────────────

export type ModeNotification = 'lrar' | 'main_propre' | 'lre';

export interface EntreeDelai {
  mode: ModeNotification;
  /** 'YYYY-MM-DD' — date civile, JAMAIS de timestamp. */
  dateNotification: string;
  /** 'YYYY-MM-DD'. */
  dateAG: string;
  /** Délai du règlement de copropriété. Défaut 21, clampé à [21, 90] (R2). */
  delaiReglement?: number;
  /** Convocation d'urgence (art. 9 al. 3 décret 1967) : hors périmètre (R7). */
  urgence?: boolean;
}

export type VerdictDelai =
  | {
      statut: 'conforme' | 'annulable';
      /** Point de départ du délai (R1). */
      j1: string;
      /** Dernier jour du délai : J1 + (N − 1), expire à minuit (R3). */
      dernierJour: string;
      /** Première date à laquelle l'AG peut légalement se tenir : J1 + N (R4). */
      agLegale: string;
      /** dateAG − agLegale, en jours, signée (R6). */
      margeJours: number;
      /** Durée retenue du délai (R2). */
      n: number;
      /** true si la saisie a été ramenée dans [21, 90] — message UI (T8). */
      delaiCorrige: boolean;
    }
  | { statut: 'hors_perimetre'; raison: string };

// ── TAXONOMIE ───────────────────────────────────────────────────────────────

export type Regime = 'art24' | 'art25' | 'art26' | 'unanimite';

export interface TypeResolution {
  /** = slug de la fiche Bibliothèque. */
  slug: string;
  intitule: string;
  regime: Regime;
  /** ex. 'art. 24, loi n°65-557 du 10 juillet 1965'. */
  refLegale: string;
  /** Date de vérification Légifrance — OBLIGATOIRE pour publier. */
  verifieLe: string;
  /** Annexes exigées à la convocation pour cette résolution (audit bloc C). */
  documentsExiges: string[];
  /**
   * Items ⚠ de l'Annexe A : régime indicatif, dépendant du contexte.
   * Le bloc D rend alors `vigilance` (vérification renforcée), jamais un
   * verdict tranché — règle d'humilité.
   */
  contextuel?: boolean;
}

// ── MOTEUR-AUDIT ────────────────────────────────────────────────────────────

export type StatutItem = 'conforme' | 'non_conforme' | 'vigilance';

export type QualiteConvocateur =
  | 'syndic'
  | 'conseil_syndical'
  | 'coproprietaire_habilite'
  | 'administrateur_provisoire';

/** Une résolution inscrite à l'ordre du jour, telle que déclarée au wizard. */
export interface ResolutionAuditee {
  /** Slug de la taxonomie (picker Bibliothèque). Absent si saisie libre. */
  slug?: string;
  /** Intitulé saisi librement (résolution hors taxonomie → vigilance). */
  intituleLibre?: string;
  /** Majorité annoncée dans le projet de résolution (bloc D). */
  majoriteAnnoncee: Regime;
  /** Slugs des documents joints à la convocation (bloc C). */
  documentsJoints: string[];
}

/** Réponses typées du wizard, blocs A–E. `undefined` = non répondu → vigilance. */
export interface ReponsesAudit {
  /** Bloc A1 — computation complète (MOTEUR-DELAI). */
  delai: EntreeDelai;
  /** Bloc A2 — tous les copropriétaires convoqués selon un mode admis. */
  modeAdmisPourTous?: boolean;
  /** Bloc A3 — si LRE : accord exprès préalable de chaque destinataire. */
  lreAccordExpres?: boolean;
  /** Bloc B — mentions de la convocation. */
  mentions: {
    /** B1 — lieu, date et heure de l'AG. */
    lieuDateHeure?: boolean;
    /** B2 — ordre du jour énumérant chaque question. */
    ordreDuJourComplet?: boolean;
    /** B3 — modalités de consultation des pièces justificatives des charges. */
    consultationPieces?: boolean;
  };
  /** Bloc C — formulaire de vote par correspondance joint (toujours exigé). */
  formulaireVoteJoint?: boolean;
  /** Blocs C & D — résolutions inscrites à l'ordre du jour. */
  resolutions: ResolutionAuditee[];
  /** Bloc E — qualité du convocateur. */
  convocateur: {
    qualite?: QualiteConvocateur;
    /** E2 — mandat non expiré à la date d'ENVOI de la convocation. */
    mandatEnCours?: boolean;
  };
}

export interface ResultatItem {
  code: string;
  bloc: 'A' | 'B' | 'C' | 'D' | 'E';
  statut: StatutItem;
  libelle: string;
  /** Format : constat → conséquence juridique → action corrective → référence. */
  explication: string;
  refLegale: string;
  actionCorrective?: string;
}

export type ResultatAudit =
  | {
      global: StatutItem;
      items: ResultatItem[];
      delai: VerdictDelai;
      /** ex. '2026-06-13' — affichée sur l'attestation. */
      rulesVersion: string;
    }
  | {
      global: 'hors_perimetre';
      raison: string;
      rulesVersion: string;
    };
