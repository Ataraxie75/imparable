/**
 * SPEC-PDF — le template d'attestation contient tout ce que le PRD §19 exige.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeAudit, RULES_VERSION } from '../../src/lib/moteur/audit';
import {
  attestationDocumentHTML,
  attestationFragmentHTML,
  type MetaAttestation,
} from '../../src/lib/pdf/attestation';
import type { ReponsesAudit, TypeResolution } from '../../src/lib/moteur/types';

const TAXONOMIE: TypeResolution[] = [
  {
    slug: 'budget-previsionnel',
    intitule: 'Vote du budget prévisionnel',
    regime: 'art24',
    refLegale: 'art. 24, loi n°65-557 du 10 juillet 1965',
    verifieLe: '2026-06-13',
    documentsExiges: ['budget-previsionnel-detaille'],
  },
];

const META: MetaAttestation = {
  numero: 'IMP-2026-00042',
  emiseLe: '13/06/2026 à 10:00 (heure de Paris)',
  urlVerification: 'https://imparable.fr/verifier/IMP-2026-00042',
};

function reponses(dateAG: string): ReponsesAudit {
  return {
    delai: { mode: 'lrar', dateNotification: '2026-05-12', dateAG },
    modeAdmisPourTous: true,
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

describe('SPEC-PDF — attestation', () => {
  it('conforme → « Attestation de vérification de conformité », computation et mentions obligatoires', () => {
    const r = reponses('2026-06-09');
    const html = attestationFragmentHTML(r, computeAudit(r, TAXONOMIE), META);
    expect(html).toContain('Attestation de vérification de conformité');
    expect(html).toContain('IMP-2026-00042');
    expect(html).toContain(RULES_VERSION);
    expect(html).toContain('2026-05-13'); // J1
    expect(html).toContain('2026-06-03'); // agLegale
    expect(html).toContain('ne constitue pas un conseil juridique');
    expect(html).toContain('https://imparable.fr/verifier/IMP-2026-00042');
    expect(html).not.toContain('SPÉCIMEN');
  });

  it('non conforme → « Rapport de vérification », ouvert sur les corrections datées', () => {
    const r = reponses('2026-06-02'); // dernier jour du délai : annulable
    const html = attestationFragmentHTML(r, computeAudit(r, TAXONOMIE), META);
    expect(html).toContain('Rapport de vérification');
    expect(html).toContain('corrections prioritaires');
    expect(html).toContain('Action corrective');
    expect(html).toContain('2026-06-03'); // date de report dans l'action
  });

  it('specimen → filigrane SPÉCIMEN', () => {
    const r = reponses('2026-06-09');
    const html = attestationFragmentHTML(r, computeAudit(r, TAXONOMIE), {
      ...META,
      specimen: true,
    });
    expect(html).toContain('SPÉCIMEN');
  });

  it('hors_perimetre → aucune attestation possible (R7)', () => {
    const r = reponses('2026-06-09');
    r.delai.urgence = true;
    expect(() => attestationFragmentHTML(r, computeAudit(r, TAXONOMIE), META)).toThrow(/R7/);
  });

  it('document autoporté → tokens embarqués, HTML complet', () => {
    const tokensCss = readFileSync(
      join(__dirname, '..', '..', 'src', 'styles', 'tokens.css'),
      'utf8',
    );
    const r = reponses('2026-06-09');
    const html = attestationDocumentHTML(r, computeAudit(r, TAXONOMIE), META, tokensCss);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('--voltage-1'); // tokens.css inliné
  });
});
