/**
 * T1–T12 — gate prebuild du MOTEUR-DELAI (PRD §5.3).
 * Le build échoue si un seul de ces tests est rouge.
 */
import { describe, expect, it } from 'vitest';
import { computeDelai } from '../../src/lib/moteur/delai';
import type { EntreeDelai, VerdictDelai } from '../../src/lib/moteur/types';

function verdict(e: EntreeDelai) {
  const v = computeDelai(e);
  if (v.statut === 'hors_perimetre') throw new Error(`hors_perimetre inattendu : ${v.raison}`);
  return v;
}

describe('MOTEUR-DELAI — T1–T12', () => {
  it('T1 — LRAR présentée 2026-05-12, AG 2026-06-09, N=21 → conforme, marge +6', () => {
    const v = verdict({ mode: 'lrar', dateNotification: '2026-05-12', dateAG: '2026-06-09' });
    expect(v.statut).toBe('conforme');
    expect(v.j1).toBe('2026-05-13');
    expect(v.dernierJour).toBe('2026-06-02');
    expect(v.agLegale).toBe('2026-06-03');
    expect(v.margeJours).toBe(6);
    expect(v.n).toBe(21);
  });

  it('T2 — AG le dernier jour du délai (2026-06-02) → annulable, marge −1', () => {
    const v = verdict({ mode: 'lrar', dateNotification: '2026-05-12', dateAG: '2026-06-02' });
    expect(v.statut).toBe('annulable');
    expect(v.margeJours).toBe(-1);
  });

  it('T3 — AG le premier jour légal (2026-06-03) → conforme, marge 0', () => {
    const v = verdict({ mode: 'lrar', dateNotification: '2026-05-12', dateAG: '2026-06-03' });
    expect(v.statut).toBe('conforme');
    expect(v.margeJours).toBe(0);
  });

  it('T4 — main propre 2026-05-12, AG 2026-06-02 → conforme (J1 = jour de remise)', () => {
    const v = verdict({ mode: 'main_propre', dateNotification: '2026-05-12', dateAG: '2026-06-02' });
    expect(v.statut).toBe('conforme');
    expect(v.j1).toBe('2026-05-12');
    expect(v.agLegale).toBe('2026-06-02');
    expect(v.margeJours).toBe(0);
  });

  it("T5 — LRE envoyée 2026-05-12, AG 2026-06-02 → annulable (J1 = lendemain de l'envoi)", () => {
    const v = verdict({ mode: 'lre', dateNotification: '2026-05-12', dateAG: '2026-06-02' });
    expect(v.statut).toBe('annulable');
    expect(v.j1).toBe('2026-05-13');
    expect(v.agLegale).toBe('2026-06-03');
  });

  it('T6 — dernierJour un dimanche → aucun décalage (anti-régression R5)', () => {
    // Remise en main propre lundi 2026-05-11 : J1 = 2026-05-11,
    // dernierJour = J1 + 20 = dimanche 2026-05-31. R5 : pas de prorogation.
    const v = verdict({ mode: 'main_propre', dateNotification: '2026-05-11', dateAG: '2026-06-01' });
    expect(v.dernierJour).toBe('2026-05-31'); // reste le dimanche, pas le lundi
    expect(v.agLegale).toBe('2026-06-01'); // pas décalée au 06-02
    expect(v.statut).toBe('conforme');
    expect(v.margeJours).toBe(0);
  });

  it('T7 — N=30 (règlement), LRAR présentée 2026-05-12 → agLegale 2026-06-12', () => {
    const v = verdict({
      mode: 'lrar',
      dateNotification: '2026-05-12',
      dateAG: '2026-06-15',
      delaiReglement: 30,
    });
    expect(v.n).toBe(30);
    expect(v.agLegale).toBe('2026-06-12');
    expect(v.delaiCorrige).toBe(false);
  });

  it('T8 — delaiReglement=15 → clampé à 21 + flag delaiCorrige', () => {
    const v = verdict({
      mode: 'lrar',
      dateNotification: '2026-05-12',
      dateAG: '2026-06-09',
      delaiReglement: 15,
    });
    expect(v.n).toBe(21);
    expect(v.delaiCorrige).toBe(true);
    expect(v.agLegale).toBe('2026-06-03');
  });

  it('T9 — chevauchement du 29 février (2028 bissextile) → dates exactes', () => {
    // LRAR présentée 2028-02-15 : J1 = 2028-02-16, février 2028 compte 29 jours.
    // dernierJour = J1 + 20 = 2028-03-07 · agLegale = 2028-03-08.
    const v = verdict({ mode: 'lrar', dateNotification: '2028-02-15', dateAG: '2028-03-10' });
    expect(v.j1).toBe('2028-02-16');
    expect(v.dernierJour).toBe('2028-03-07');
    expect(v.agLegale).toBe('2028-03-08');
    expect(v.statut).toBe('conforme');
    expect(v.margeJours).toBe(2);
  });

  it("T10 — chevauchement d'année (présentation 20 déc → AG janvier) → dates exactes", () => {
    // J1 = 2026-12-21 · dernierJour = 2027-01-10 · agLegale = 2027-01-11.
    const v = verdict({ mode: 'lrar', dateNotification: '2026-12-20', dateAG: '2027-01-11' });
    expect(v.j1).toBe('2026-12-21');
    expect(v.dernierJour).toBe('2027-01-10');
    expect(v.agLegale).toBe('2027-01-11');
    expect(v.statut).toBe('conforme');
    expect(v.margeJours).toBe(0);
  });

  it('T11 — déterminisme : 1000 computations strictement identiques', () => {
    const entree: EntreeDelai = {
      mode: 'lrar',
      dateNotification: '2026-05-12',
      dateAG: '2026-06-09',
      delaiReglement: 25,
    };
    const reference = computeDelai(entree);
    for (let i = 0; i < 1000; i++) {
      expect(computeDelai(entree)).toStrictEqual(reference);
    }
  });

  it('T12 — scénario Cass. 3e civ., 4 déc. 2025 → annulable, aligné sur la Cour', () => {
    // LRAR présentée le lundi 2026-05-11. Décompte erroné (départ le jour de la
    // présentation) : 21e jour = dimanche 2026-05-31, veille de l'AG → « conforme ».
    // Décompte exact (R1) : J1 = 2026-05-12, l'AG du lundi 2026-06-01 se tient le
    // dernier jour du délai → annulable.
    const v = verdict({ mode: 'lrar', dateNotification: '2026-05-11', dateAG: '2026-06-01' });
    expect(v.j1).toBe('2026-05-12');
    expect(v.dernierJour).toBe('2026-06-01');
    expect(v.agLegale).toBe('2026-06-02');
    expect(v.statut).toBe('annulable');
    expect(v.margeJours).toBe(-1);
  });

  it('R7 — urgence cochée → hors_perimetre, jamais de verdict', () => {
    const v: VerdictDelai = computeDelai({
      mode: 'lrar',
      dateNotification: '2026-05-12',
      dateAG: '2026-05-15',
      urgence: true,
    });
    expect(v.statut).toBe('hors_perimetre');
  });

  it('R2 — delaiReglement=120 → clampé à 90 + flag delaiCorrige', () => {
    const v = verdict({
      mode: 'lrar',
      dateNotification: '2026-01-01',
      dateAG: '2026-06-01',
      delaiReglement: 120,
    });
    expect(v.n).toBe(90);
    expect(v.delaiCorrige).toBe(true);
  });

  it('rejette une date inexistante au calendrier', () => {
    expect(() =>
      computeDelai({ mode: 'lrar', dateNotification: '2026-02-30', dateAG: '2026-03-25' }),
    ).toThrow(/inexistante/);
  });
});
