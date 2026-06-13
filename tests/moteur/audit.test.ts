/**
 * Scénarios S-* — gate prebuild du MOTEUR-AUDIT (PRD §7.4).
 * La taxonomie est passée en fixture : les tests ne dépendent pas du build.
 */
import { describe, expect, it } from 'vitest';
import { computeAudit, RULES_VERSION } from '../../src/lib/moteur/audit';
import type { ReponsesAudit, ResultatItem, TypeResolution } from '../../src/lib/moteur/types';

const TAXONOMIE: TypeResolution[] = [
  {
    slug: 'approbation-comptes',
    intitule: "Approbation des comptes de l'exercice clos",
    regime: 'art24',
    refLegale: 'art. 24, loi n°65-557 du 10 juillet 1965',
    verifieLe: '2026-06-13',
    documentsExiges: ['etat-financier', 'annexes-comptables'],
  },
  {
    slug: 'budget-previsionnel',
    intitule: 'Vote du budget prévisionnel',
    regime: 'art24',
    refLegale: 'art. 24, loi n°65-557 du 10 juillet 1965',
    verifieLe: '2026-06-13',
    documentsExiges: ['budget-previsionnel-detaille'],
  },
  {
    slug: 'travaux-amelioration',
    intitule: "Travaux d'amélioration",
    regime: 'art25',
    refLegale: 'art. 25 n), loi n°65-557 du 10 juillet 1965',
    verifieLe: '2026-06-13',
    documentsExiges: ['devis', 'contrats'],
  },
  {
    slug: 'ravalement',
    intitule: 'Ravalement de façade',
    regime: 'art24',
    refLegale: 'art. 24 ou 25, loi n°65-557 du 10 juillet 1965, selon la nature des travaux',
    verifieLe: '2026-06-13',
    documentsExiges: ['devis'],
    contextuel: true,
  },
];

/** Réponses intégralement conformes — base mutée par chaque scénario. */
function reponsesConformes(): ReponsesAudit {
  return {
    delai: { mode: 'lrar', dateNotification: '2026-05-12', dateAG: '2026-06-09' },
    modeAdmisPourTous: true,
    lreAccordExpres: undefined,
    mentions: { lieuDateHeure: true, ordreDuJourComplet: true, consultationPieces: true },
    formulaireVoteJoint: true,
    resolutions: [
      {
        slug: 'budget-previsionnel',
        majoriteAnnoncee: 'art24',
        documentsJoints: ['budget-previsionnel-detaille'],
      },
    ],
    convocateur: { qualite: 'syndic', mandatEnCours: true },
  };
}

function items(r: ReponsesAudit): ResultatItem[] {
  const res = computeAudit(r, TAXONOMIE);
  if (res.global === 'hors_perimetre') throw new Error('hors_perimetre inattendu');
  return res.items;
}

function item(r: ReponsesAudit, code: string): ResultatItem {
  const found = items(r).find((i) => i.code === code);
  if (!found) throw new Error(`item ${code} absent`);
  return found;
}

describe('MOTEUR-AUDIT — scénarios S-*', () => {
  it('S-OK — tout conforme → global conforme, rulesVersion exposée', () => {
    const res = computeAudit(reponsesConformes(), TAXONOMIE);
    expect(res.global).toBe('conforme');
    expect(res.rulesVersion).toBe(RULES_VERSION);
    if (res.global === 'conforme') {
      expect(res.items.every((i) => i.statut === 'conforme')).toBe(true);
    }
  });

  it('S-DELAI — délai KO, reste OK → global non_conforme + actionCorrective datée', () => {
    const r = reponsesConformes();
    r.delai.dateAG = '2026-06-02'; // dernier jour du délai : annulable
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('non_conforme');
    const a1 = item(r, 'A1');
    expect(a1.statut).toBe('non_conforme');
    expect(a1.actionCorrective).toContain('2026-06-03'); // date de report = agLegale
  });

  it("S-MAJ — travaux d'amélioration annoncés art. 24 → D non_conforme", () => {
    const r = reponsesConformes();
    r.resolutions = [
      { slug: 'travaux-amelioration', majoriteAnnoncee: 'art24', documentsJoints: ['devis', 'contrats'] },
    ];
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('non_conforme');
    const d1 = item(r, 'D1');
    expect(d1.statut).toBe('non_conforme');
    expect(d1.actionCorrective).toContain('art. 25');
  });

  it('S-DOC — budget voté sans budget joint → C non_conforme', () => {
    const r = reponsesConformes();
    r.resolutions = [{ slug: 'budget-previsionnel', majoriteAnnoncee: 'art24', documentsJoints: [] }];
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('non_conforme');
    const c1 = item(r, 'C1');
    expect(c1.statut).toBe('non_conforme');
    expect(c1.explication).toContain('budget');
  });

  it('S-VIG — résolution hors taxonomie → vigilance, jamais conforme', () => {
    const r = reponsesConformes();
    r.resolutions = [
      { intituleLibre: 'Installation de ruches sur le toit', majoriteAnnoncee: 'art24', documentsJoints: [] },
    ];
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('vigilance');
    expect(item(r, 'C1').statut).toBe('vigilance');
    expect(item(r, 'D1').statut).toBe('vigilance');
  });

  it('S-LRE — LRE sans accord exprès → A3 non_conforme', () => {
    const r = reponsesConformes();
    r.delai = { mode: 'lre', dateNotification: '2026-05-12', dateAG: '2026-06-09' };
    r.lreAccordExpres = false;
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('non_conforme');
    expect(item(r, 'A3').statut).toBe('non_conforme');
  });

  it("S-URGENCE — convocation d'urgence → hors_perimetre, pas d'attestation", () => {
    const r = reponsesConformes();
    r.delai.urgence = true;
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('hors_perimetre');
    expect('items' in res).toBe(false);
  });

  it("règle d'humilité — réponse manquante → vigilance, jamais conforme", () => {
    const r = reponsesConformes();
    r.mentions.consultationPieces = undefined;
    r.convocateur.mandatEnCours = undefined;
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('vigilance');
    expect(item(r, 'B3').statut).toBe('vigilance');
    expect(item(r, 'E2').statut).toBe('vigilance');
  });

  it('S-CTX — résolution au régime contextuel (⚠) → D vigilance, même si la majorité annoncée correspond', () => {
    const r = reponsesConformes();
    r.resolutions = [{ slug: 'ravalement', majoriteAnnoncee: 'art24', documentsJoints: ['devis'] }];
    const res = computeAudit(r, TAXONOMIE);
    expect(res.global).toBe('vigilance');
    expect(item(r, 'D1').statut).toBe('vigilance');
    expect(item(r, 'D1').explication).toContain('contexte');
    expect(item(r, 'C1').statut).toBe('conforme'); // les documents, eux, restent contrôlés
  });

  it('convocateur hors syndic → vigilance + renvoi', () => {
    const r = reponsesConformes();
    r.convocateur = { qualite: 'conseil_syndical' };
    expect(item(r, 'E1').statut).toBe('vigilance');
  });
});
