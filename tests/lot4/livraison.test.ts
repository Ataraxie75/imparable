/** LOT 4 — briques pures du flux de livraison. */
import { describe, expect, it } from 'vitest';
import { typeDocument } from '../../src/lib/pdf/attestation';
import {
  htmlLivraison,
  sujetLivraison,
  texteLivraison,
  type ContenuLivraison,
} from '../../src/lib/email/livraison';
import type { ResultatAudit } from '../../src/lib/moteur/types';

function resultat(global: 'conforme' | 'non_conforme' | 'vigilance'): ResultatAudit {
  return {
    global,
    items: [],
    delai: {
      statut: 'conforme',
      j1: '2026-05-13',
      dernierJour: '2026-06-02',
      agLegale: '2026-06-03',
      margeJours: 6,
      n: 21,
      delaiCorrige: false,
    },
    rulesVersion: '2026-06-13',
  };
}

describe('typeDocument (PRD §19)', () => {
  it('conforme → attestation', () => {
    expect(typeDocument(resultat('conforme'))).toBe('attestation');
  });
  it('non_conforme et vigilance → rapport', () => {
    expect(typeDocument(resultat('non_conforme'))).toBe('rapport');
    expect(typeDocument(resultat('vigilance'))).toBe('rapport');
  });
  it('hors_perimetre → refus (R7)', () => {
    expect(() =>
      typeDocument({ global: 'hors_perimetre', raison: 'urgence', rulesVersion: '2026-06-13' }),
    ).toThrow(/R7/);
  });
});

describe('email de livraison', () => {
  const contenu: ContenuLivraison = {
    type: 'attestation',
    numero: 'IMP-2026-00042',
    urlLivraison: 'https://imparable.fr/audit/merci?session_id=cs_test_123',
    urlVerification: 'https://imparable.fr/verifier/IMP-2026-00042',
  };

  it('sujet et corps portent le numéro, les liens et la limite de portée', () => {
    expect(sujetLivraison(contenu)).toContain('IMP-2026-00042');
    const texte = texteLivraison(contenu);
    expect(texte).toContain(contenu.urlLivraison);
    expect(texte).toContain(contenu.urlVerification);
    expect(texte).toContain('ne constitue pas un conseil juridique');
  });

  it('rapport → sujet adapté, jamais « attestation »', () => {
    const sujet = sujetLivraison({ ...contenu, type: 'rapport' });
    expect(sujet).toContain('rapport de vérification');
    expect(sujet.toLowerCase()).not.toContain('attestation');
  });

  it('html : liens cliquables, aucune couleur en dur', () => {
    const html = htmlLivraison(contenu);
    expect(html).toContain('<a href="https://imparable.fr/verifier/IMP-2026-00042">');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
