/**
 * MOTEUR-AUDIT — grille des causes de nullité d'une convocation d'AG.
 *
 * Librairie pure : zéro dépendance, zéro I/O. Cinq blocs (PRD §7.2) :
 *   A — délai & notification · B — mentions de la convocation ·
 *   C — documents joints par résolution · D — majorité par résolution ·
 *   E — qualité du convocateur.
 *
 * Règle d'humilité (non négociable) : toute réponse ambiguë, tout cas non
 * couvert → `vigilance`, jamais `conforme`. Le moteur préfère « faites
 * vérifier ce point » à une fausse certitude.
 */

import { computeDelai } from './delai';
import type {
  Regime,
  ReponsesAudit,
  ResolutionAuditee,
  ResultatAudit,
  ResultatItem,
  StatutItem,
  TypeResolution,
} from './types';
import DOCUMENTS from './documents.json';

/** Version des règles, affichée sur l'attestation (« règles vérifiées au… »). */
export const RULES_VERSION = '2026-06-13';

export const LIBELLES_REGIME: Record<Regime, string> = {
  art24: 'Majorité simple (art. 24)',
  art25: 'Majorité absolue (art. 25)',
  art26: 'Double majorité (art. 26)',
  unanimite: 'Unanimité',
};

/** Forme courte pour les badges de carte (tient sur une ligne). */
export const LIBELLES_REGIME_COURT: Record<Regime, string> = {
  art24: 'Art. 24',
  art25: 'Art. 25',
  art26: 'Art. 26',
  unanimite: 'Unanimité',
};

const REF_LOI_1965 = 'loi n°65-557 du 10 juillet 1965';
const REF_DECRET_1967 = 'décret n°67-223 du 17 mars 1967';

function libelleDocument(slug: string): string {
  return (DOCUMENTS as Record<string, string>)[slug] ?? slug;
}

function nomResolution(r: ResolutionAuditee, type?: TypeResolution): string {
  return type?.intitule ?? r.intituleLibre ?? 'Résolution sans intitulé';
}

/**
 * Tri-état déclaratif : `true` → conforme, `false` → non_conforme,
 * `undefined` (non répondu) → vigilance — règle d'humilité.
 */
function statutDeclaratif(reponse: boolean | undefined): StatutItem {
  if (reponse === true) return 'conforme';
  if (reponse === false) return 'non_conforme';
  return 'vigilance';
}

// ── Bloc A — Délai & notification ───────────────────────────────────────────

function blocA(r: ReponsesAudit, items: ResultatItem[]): void {
  const delai = computeDelai(r.delai);
  if (delai.statut === 'hors_perimetre') return; // géré en amont par computeAudit

  if (delai.statut === 'conforme') {
    items.push({
      code: 'A1',
      bloc: 'A',
      statut: 'conforme',
      libelle: 'Délai de convocation',
      explication:
        `Le délai de ${delai.n} jours est respecté : l'assemblée du ${r.delai.dateAG} se tient ` +
        `${delai.margeJours} jour(s) après la première date légale (${delai.agLegale}).`,
      refLegale: `art. 9 et 64, ${REF_DECRET_1967}`,
    });
  } else {
    items.push({
      code: 'A1',
      bloc: 'A',
      statut: 'non_conforme',
      libelle: 'Délai de convocation',
      explication:
        `Le délai de ${delai.n} jours n'est pas respecté : l'assemblée est convoquée ` +
        `${Math.abs(delai.margeJours)} jour(s) trop tôt. Toutes les décisions votées seraient ` +
        `exposées à l'annulation (art. 42, ${REF_LOI_1965}).`,
      refLegale: `art. 9 et 64, ${REF_DECRET_1967} · art. 42, ${REF_LOI_1965}`,
      actionCorrective:
        `Reportez l'assemblée au ${delai.agLegale} au plus tôt, ou notifiez une nouvelle ` +
        `convocation respectant le délai.`,
    });
  }

  const a2 = statutDeclaratif(r.modeAdmisPourTous);
  items.push({
    code: 'A2',
    bloc: 'A',
    statut: a2,
    libelle: 'Mode de notification admis pour tous les copropriétaires',
    explication:
      a2 === 'conforme'
        ? 'Chaque copropriétaire a été convoqué par un mode admis (LRAR, remise contre récépissé ou émargement, LRE).'
        : a2 === 'non_conforme'
          ? "Au moins un copropriétaire n'a pas été convoqué par un mode admis : la convocation lui est " +
            'inopposable et les décisions sont annulables à sa demande.'
          : 'Le mode de notification de chaque copropriétaire doit être vérifié.',
    refLegale: `art. 64, ${REF_DECRET_1967}`,
    actionCorrective:
      a2 === 'non_conforme'
        ? 'Notifiez à nouveau la convocation aux copropriétaires concernés par LRAR, remise contre émargement ou LRE.'
        : undefined,
  });

  if (r.delai.mode === 'lre') {
    const a3 = statutDeclaratif(r.lreAccordExpres);
    items.push({
      code: 'A3',
      bloc: 'A',
      statut: a3,
      libelle: 'Accord exprès préalable pour la notification électronique',
      explication:
        a3 === 'conforme'
          ? 'Chaque destinataire de la LRE a donné son accord exprès préalable.'
          : a3 === 'non_conforme'
            ? "La LRE sans accord exprès préalable du copropriétaire ne fait pas courir le délai : " +
              'la notification est irrégulière et les décisions annulables.'
            : "L'existence d'un accord exprès préalable de chaque destinataire doit être vérifiée.",
      refLegale: `art. 42-1, ${REF_LOI_1965} · art. 64-2, ${REF_DECRET_1967}`,
      actionCorrective:
        a3 === 'non_conforme'
          ? "Re-notifiez par LRAR (ou remise contre émargement) les copropriétaires n'ayant pas donné leur accord exprès."
          : undefined,
    });
  }
}

// ── Bloc B — Mentions de la convocation ─────────────────────────────────────

function blocB(r: ReponsesAudit, items: ResultatItem[]): void {
  const mentions: Array<{
    code: string;
    libelle: string;
    reponse: boolean | undefined;
    refLegale: string;
    consequence: string;
    action: string;
  }> = [
    {
      code: 'B1',
      libelle: "Lieu, date et heure de l'assemblée",
      reponse: r.mentions.lieuDateHeure,
      refLegale: `art. 9, ${REF_DECRET_1967}`,
      consequence:
        "Sans lieu, date et heure, la convocation est irrégulière et l'assemblée annulable.",
      action: 'Complétez la convocation et notifiez-la à nouveau dans le délai légal.',
    },
    {
      code: 'B2',
      libelle: "Ordre du jour énumérant chaque question",
      reponse: r.mentions.ordreDuJourComplet,
      refLegale: `art. 9 et 13, ${REF_DECRET_1967}`,
      consequence:
        "Toute décision votée sur une question absente de l'ordre du jour est annulable.",
      action: "Inscrivez chaque question à l'ordre du jour et notifiez une convocation rectificative.",
    },
    {
      code: 'B3',
      libelle: 'Modalités de consultation des pièces justificatives des charges',
      reponse: r.mentions.consultationPieces,
      refLegale: `art. 9 et 11, ${REF_DECRET_1967}`,
      consequence:
        "L'absence de cette mention est une irrégularité formelle exposant les décisions sur les comptes à l'annulation.",
      action: 'Ajoutez la mention (lieu et horaires de consultation) à la convocation.',
    },
  ];

  for (const m of mentions) {
    const statut = statutDeclaratif(m.reponse);
    items.push({
      code: m.code,
      bloc: 'B',
      statut,
      libelle: m.libelle,
      explication:
        statut === 'conforme'
          ? `La convocation comporte la mention exigée : ${m.libelle.toLowerCase()}.`
          : statut === 'non_conforme'
            ? `La mention est absente de la convocation. ${m.consequence}`
            : `La présence de cette mention doit être vérifiée sur la convocation.`,
      refLegale: m.refLegale,
      actionCorrective: statut === 'non_conforme' ? m.action : undefined,
    });
  }
}

// ── Bloc C — Documents joints par résolution ────────────────────────────────

function blocC(r: ReponsesAudit, taxonomie: Map<string, TypeResolution>, items: ResultatItem[]): void {
  // C0 — le formulaire de vote par correspondance est toujours exigé.
  const c0 = statutDeclaratif(r.formulaireVoteJoint);
  items.push({
    code: 'C0',
    bloc: 'C',
    statut: c0,
    libelle: 'Formulaire de vote par correspondance joint',
    explication:
      c0 === 'conforme'
        ? 'Le formulaire de vote par correspondance est joint à la convocation, comme exigé pour toute assemblée.'
        : c0 === 'non_conforme'
          ? "Le formulaire de vote par correspondance est obligatoire pour toute assemblée : son absence " +
            'rend la convocation irrégulière.'
          : 'La présence du formulaire de vote par correspondance doit être vérifiée.',
    refLegale: `art. 17-1 A, ${REF_LOI_1965} · art. 9, ${REF_DECRET_1967}`,
    actionCorrective:
      c0 === 'non_conforme'
        ? 'Joignez le formulaire conforme à l’arrêté du 2 juillet 2020 et notifiez à nouveau la convocation.'
        : undefined,
  });

  r.resolutions.forEach((res, i) => {
    const code = `C${i + 1}`;
    const type = res.slug ? taxonomie.get(res.slug) : undefined;
    const nom = nomResolution(res, type);

    if (!type) {
      items.push({
        code,
        bloc: 'C',
        statut: 'vigilance',
        libelle: `Documents joints — ${nom}`,
        explication:
          'Cette résolution est hors référentiel : les annexes exigées ne peuvent pas être contrôlées ' +
          'automatiquement. Faites vérifier ce point.',
        refLegale: `art. 11, ${REF_DECRET_1967}`,
      });
      return;
    }

    const manquants = type.documentsExiges.filter((doc) => !res.documentsJoints.includes(doc));
    if (manquants.length === 0) {
      items.push({
        code,
        bloc: 'C',
        statut: 'conforme',
        libelle: `Documents joints — ${nom}`,
        explication:
          type.documentsExiges.length === 0
            ? 'Aucune annexe spécifique n’est exigée pour cette résolution.'
            : `Les annexes exigées sont jointes : ${type.documentsExiges.map(libelleDocument).join(' · ')}.`,
        refLegale: `art. 11, ${REF_DECRET_1967}`,
      });
    } else {
      items.push({
        code,
        bloc: 'C',
        statut: 'non_conforme',
        libelle: `Documents joints — ${nom}`,
        explication:
          `Annexe(s) manquante(s) : ${manquants.map(libelleDocument).join(' · ')}. ` +
          'La validité de la décision est subordonnée à la notification de ces documents au plus tard ' +
          'avec la convocation : leur absence expose la résolution à l’annulation.',
        refLegale: `art. 11, ${REF_DECRET_1967}`,
        actionCorrective:
          'Joignez les documents manquants et notifiez-les au plus tard avec une convocation respectant le délai.',
      });
    }
  });
}

// ── Bloc D — Majorité par résolution ────────────────────────────────────────

function blocD(r: ReponsesAudit, taxonomie: Map<string, TypeResolution>, items: ResultatItem[]): void {
  r.resolutions.forEach((res, i) => {
    const code = `D${i + 1}`;
    const type = res.slug ? taxonomie.get(res.slug) : undefined;
    const nom = nomResolution(res, type);

    if (!type) {
      items.push({
        code,
        bloc: 'D',
        statut: 'vigilance',
        libelle: `Majorité — ${nom}`,
        explication:
          'Cette résolution est hors référentiel : le régime de majorité applicable ne peut pas être ' +
          'déterminé automatiquement. Faites vérifier la majorité annoncée ' +
          `(${LIBELLES_REGIME[res.majoriteAnnoncee]}).`,
        refLegale: `art. 24 à 26, ${REF_LOI_1965}`,
      });
      return;
    }

    if (type.contextuel) {
      items.push({
        code,
        bloc: 'D',
        statut: 'vigilance',
        libelle: `Majorité — ${nom}`,
        explication:
          `Le régime de cette résolution dépend du contexte (régime indicatif : ` +
          `${LIBELLES_REGIME[type.regime]}). Majorité annoncée : ` +
          `${LIBELLES_REGIME[res.majoriteAnnoncee]}. Une vérification renforcée est requise — ` +
          `voir l'encart de la fiche correspondante.`,
        refLegale: type.refLegale,
      });
      return;
    }

    if (res.majoriteAnnoncee === type.regime) {
      items.push({
        code,
        bloc: 'D',
        statut: 'conforme',
        libelle: `Majorité — ${nom}`,
        explication: `La majorité annoncée (${LIBELLES_REGIME[type.regime]}) correspond au régime applicable.`,
        refLegale: type.refLegale,
      });
    } else {
      items.push({
        code,
        bloc: 'D',
        statut: 'non_conforme',
        libelle: `Majorité — ${nom}`,
        explication:
          `La majorité annoncée (${LIBELLES_REGIME[res.majoriteAnnoncee]}) ne correspond pas au régime ` +
          `applicable (${LIBELLES_REGIME[type.regime]}). Une décision votée à une majorité erronée est ` +
          `annulable (art. 42, ${REF_LOI_1965}).`,
        refLegale: type.refLegale,
        actionCorrective: `Corrigez le projet de résolution : ${LIBELLES_REGIME[type.regime]} — ${type.refLegale}.`,
      });
    }
  });
}

// ── Bloc E — Qualité du convocateur ─────────────────────────────────────────

function blocE(r: ReponsesAudit, items: ResultatItem[]): void {
  const { qualite, mandatEnCours } = r.convocateur;

  if (qualite === undefined) {
    items.push({
      code: 'E1',
      bloc: 'E',
      statut: 'vigilance',
      libelle: 'Qualité du convocateur',
      explication: 'La qualité du convocateur doit être vérifiée.',
      refLegale: `art. 7 et 8, ${REF_DECRET_1967}`,
    });
    return;
  }

  if (qualite !== 'syndic') {
    const libelles: Record<Exclude<typeof qualite, 'syndic'>, string> = {
      conseil_syndical: 'le conseil syndical',
      coproprietaire_habilite: 'un copropriétaire habilité',
      administrateur_provisoire: "l'administrateur provisoire",
    };
    items.push({
      code: 'E1',
      bloc: 'E',
      statut: 'vigilance',
      libelle: 'Qualité du convocateur',
      explication:
        `La convocation émane de ${libelles[qualite]} : ce cas est admis sous conditions strictes ` +
        '(mise en demeure préalable, habilitation, mission). Faites vérifier que ces conditions sont réunies.',
      refLegale: `art. 8, ${REF_DECRET_1967}`,
    });
    return;
  }

  items.push({
    code: 'E1',
    bloc: 'E',
    statut: 'conforme',
    libelle: 'Qualité du convocateur',
    explication: "La convocation émane du syndic en exercice, convocateur de droit commun.",
    refLegale: `art. 7, ${REF_DECRET_1967}`,
  });

  const e2 = statutDeclaratif(mandatEnCours);
  items.push({
    code: 'E2',
    bloc: 'E',
    statut: e2,
    libelle: "Mandat du syndic en cours à la date d'envoi",
    explication:
      e2 === 'conforme'
        ? "Le mandat du syndic n'était pas expiré à la date d'envoi de la convocation."
        : e2 === 'non_conforme'
          ? "Le mandat du syndic était expiré à la date d'envoi : la convocation émane d'un syndic sans " +
            "pouvoir et l'assemblée est annulable."
          : "La date d'expiration du mandat doit être confrontée à la date d'envoi de la convocation.",
    refLegale: `art. 7, ${REF_DECRET_1967} · art. 42, ${REF_LOI_1965}`,
    actionCorrective:
      e2 === 'non_conforme'
        ? "Faites convoquer l'assemblée par une personne habilitée (art. 8 du décret) ou faites désigner un administrateur provisoire."
        : undefined,
  });
}

// ── Agrégation ──────────────────────────────────────────────────────────────

function verdictGlobal(items: ResultatItem[]): StatutItem {
  if (items.some((i) => i.statut === 'non_conforme')) return 'non_conforme';
  if (items.some((i) => i.statut === 'vigilance')) return 'vigilance';
  return 'conforme';
}

export function computeAudit(r: ReponsesAudit, taxonomie: TypeResolution[]): ResultatAudit {
  const delai = computeDelai(r.delai);

  // R7 — pas d'attestation possible sur un cas non modélisé.
  if (delai.statut === 'hors_perimetre') {
    return { global: 'hors_perimetre', raison: delai.raison, rulesVersion: RULES_VERSION };
  }

  const index = new Map(taxonomie.map((t) => [t.slug, t]));
  const items: ResultatItem[] = [];
  blocA(r, items);
  blocB(r, items);
  blocC(r, index, items);
  blocD(r, index, items);
  blocE(r, items);

  return { global: verdictGlobal(items), items, delai, rulesVersion: RULES_VERSION };
}
