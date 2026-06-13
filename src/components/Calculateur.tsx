/**
 * Calculateur de délai (S1) — island React, calcul 100 % client-side.
 * Aucune donnée n'est collectée ni transmise : le moteur tourne dans le
 * navigateur (PRD §21). Aucun chiffre légal hardcodé : tout vient du moteur.
 */
import { useEffect, useMemo, useState } from 'react';
import { computeDelai, DELAI_LEGAL_MIN, DELAI_REGLEMENT_MAX } from '../lib/moteur/delai';
import type { ModeNotification } from '../lib/moteur/types';

/** Saisie partagée avec le wizard d'audit : l'utilisateur ne retape rien. */
export const CLE_CALCULATEUR = 'imparable-calc-v1';

export interface SaisieCalculateur {
  mode: ModeNotification;
  dateNotification: string;
  dateAG: string;
  delaiReglement: number;
}

const LIBELLES_MODE: Record<ModeNotification, { mode: string; date: string }> = {
  lrar: {
    mode: 'Lettre recommandée avec accusé de réception',
    date: 'Date de PREMIÈRE PRÉSENTATION (pas l’envoi, pas le retrait)',
  },
  main_propre: {
    mode: 'Remise en main propre contre récépissé ou émargement',
    date: 'Date de la remise',
  },
  lre: {
    mode: 'Lettre recommandée électronique',
    date: 'Date d’ENVOI de la LRE',
  },
};

export default function Calculateur() {
  const [mode, setMode] = useState<ModeNotification>('lrar');
  const [dateNotification, setDateNotification] = useState('');
  const [dateAG, setDateAG] = useState('');
  const [delaiReglement, setDelaiReglement] = useState(DELAI_LEGAL_MIN);
  const [urgence, setUrgence] = useState(false);

  const verdict = useMemo(() => {
    if (!urgence && (!dateNotification || !dateAG)) return null;
    try {
      return computeDelai({ mode, dateNotification, dateAG, delaiReglement, urgence });
    } catch {
      return null;
    }
  }, [mode, dateNotification, dateAG, delaiReglement, urgence]);

  // Mémorise la saisie pour que le wizard d'audit reparte des mêmes dates.
  useEffect(() => {
    if (!dateNotification && !dateAG) return;
    const saisie: SaisieCalculateur = { mode, dateNotification, dateAG, delaiReglement };
    try {
      window.localStorage.setItem(CLE_CALCULATEUR, JSON.stringify(saisie));
    } catch {
      // stockage indisponible (navigation privée) : le calcul reste fonctionnel
    }
  }, [mode, dateNotification, dateAG, delaiReglement]);

  return (
    <div className="carte calculateur">
      <h3>Votre AG est-elle convoquée dans les délais ?</h3>
      <p className="aide" style={{ marginBottom: 18 }}>
        Verdict immédiat, sans inscription. Le calcul reste dans votre navigateur : aucune donnée
        n’est transmise.
      </p>

      <div className="ligne-champs">
        <div className="pleine-largeur">
          <label className="etiquette" htmlFor="calc-mode">Mode de notification</label>
          <select
            id="calc-mode"
            className="champ"
            value={mode}
            onChange={(e) => setMode(e.target.value as ModeNotification)}
          >
            {(Object.keys(LIBELLES_MODE) as ModeNotification[]).map((m) => (
              <option key={m} value={m}>{LIBELLES_MODE[m].mode}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="etiquette" htmlFor="calc-notification">{LIBELLES_MODE[mode].date}</label>
          <input
            id="calc-notification"
            className="champ"
            type="date"
            value={dateNotification}
            onChange={(e) => setDateNotification(e.target.value)}
          />
        </div>

        <div>
          <label className="etiquette" htmlFor="calc-ag">Date de l’assemblée générale</label>
          <input
            id="calc-ag"
            className="champ"
            type="date"
            value={dateAG}
            onChange={(e) => setDateAG(e.target.value)}
          />
        </div>

        <div className="pleine-largeur">
          <label className="etiquette" htmlFor="calc-delai">
            Délai du règlement de copropriété (jours)
          </label>
          <input
            id="calc-delai"
            className="champ"
            type="number"
            min={DELAI_LEGAL_MIN}
            max={DELAI_REGLEMENT_MAX}
            value={delaiReglement}
            onChange={(e) => setDelaiReglement(Number(e.target.value))}
          />
          <p className="aide">
            Laissez {DELAI_LEGAL_MIN} si votre règlement ne prévoit pas de délai supérieur — c’est
            le minimum d’ordre public.
          </p>
        </div>

        <label className="case pleine-largeur">
          <input type="checkbox" checked={urgence} onChange={(e) => setUrgence(e.target.checked)} />
          <span>
            Convocation d’urgence (art. 9 al. 3 du décret du 17 mars 1967) — cas non modélisé
          </span>
        </label>
      </div>

      {verdict && <AffichageVerdict verdict={verdict} dateAG={dateAG} />}
    </div>
  );
}

function AffichageVerdict({
  verdict,
  dateAG,
}: {
  verdict: ReturnType<typeof computeDelai>;
  dateAG: string;
}) {
  if (verdict.statut === 'hors_perimetre') {
    return (
      <div className="verdict-carte verdict-vigilance">
        <div className="verdict-titre">Hors périmètre</div>
        <p className="verdict-detail" style={{ marginBottom: 0 }}>{verdict.raison}</p>
      </div>
    );
  }

  const conforme = verdict.statut === 'conforme';
  return (
    <div className={`verdict-carte ${conforme ? 'verdict-conforme' : 'verdict-annulable'}`}>
      <div className="verdict-titre">{conforme ? 'Délai conforme' : 'AG annulable'}</div>
      <p className="verdict-detail">
        {conforme
          ? `L'assemblée se tient ${verdict.margeJours} jour(s) après la première date légale.`
          : `L'assemblée est convoquée ${Math.abs(verdict.margeJours)} jour(s) trop tôt : toutes les décisions votées seraient exposées à l'annulation (art. 42, loi du 10 juillet 1965).`}
      </p>
      {verdict.delaiCorrige && (
        <p className="verdict-detail">
          Le délai saisi a été ramené à {verdict.n} jours : {DELAI_LEGAL_MIN} jours est un minimum
          d’ordre public, {DELAI_REGLEMENT_MAX} jours la borne de saisie.
        </p>
      )}
      <table>
        <tbody>
          <tr><td>Point de départ du délai (J1)</td><td>{verdict.j1}</td></tr>
          <tr><td>Dernier jour du délai ({verdict.n} jours)</td><td>{verdict.dernierJour}</td></tr>
          <tr><td>Première date légale d’AG</td><td>{verdict.agLegale}</td></tr>
          <tr><td>Date d’AG saisie</td><td>{dateAG}</td></tr>
          <tr><td>Marge</td><td>{verdict.margeJours >= 0 ? `+${verdict.margeJours}` : verdict.margeJours} jour(s)</td></tr>
        </tbody>
      </table>
      <p className="verdict-ref">
        Computation : art. 9 et 64 du décret n°67-223 du 17 mars 1967 · art. 42 de la loi
        n°65-557 du 10 juillet 1965 · Cass. 3e civ., 4 déc. 2025. Dimanches et jours fériés ne
        prorogent jamais ce délai.
      </p>
      <p style={{ margin: '14px 0 0' }}>
        <a className="bouton bouton-voltage" href="/audit">
          Le délai n’est qu’une cause de nullité sur dix — vérifiez les autres
        </a>
      </p>
    </div>
  );
}
