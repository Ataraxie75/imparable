/**
 * Résultat d'audit (E5) — synthèse visible, détail flouté derrière le
 * paywall. Le wizard complet est AVANT le paiement : le payant vend le
 * détail + l'attestation, pas la rétention du verdict (PRD §12).
 * Le CTA appelle /api/checkout ; tant que l'environnement n'a pas de
 * clés Stripe, l'API répond 503 et l'écran l'explique.
 */
import { useState } from 'react';
import type { ReponsesAudit, ResultatAudit } from '../../lib/moteur/types';

const LIBELLES_GLOBAL = {
  conforme: { titre: 'Convocation conforme', classe: 'verdict-conforme' },
  non_conforme: { titre: 'Convocation non conforme — AG annulable', classe: 'verdict-annulable' },
  vigilance: { titre: 'Points de vigilance à faire vérifier', classe: 'verdict-vigilance' },
} as const;

interface Props {
  resultat: ResultatAudit;
  reponses: ReponsesAudit;
  onRecommencer: () => void;
}

export default function Resultat({ resultat, reponses, onRecommencer }: Props) {
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (resultat.global === 'hors_perimetre') {
    return (
      <div>
        <div className="verdict-carte verdict-vigilance">
          <div className="verdict-titre">Hors périmètre</div>
          <p className="verdict-detail" style={{ marginBottom: 0 }}>{resultat.raison}</p>
        </div>
        <p className="aide" style={{ marginTop: 14 }}>
          Le moteur ne rend jamais de verdict sur un cas non modélisé : aucune attestation ne peut
          être émise. Rapprochez-vous d’un avocat en droit de la copropriété.
        </p>
        <button type="button" className="bouton bouton-secondaire" onClick={onRecommencer}>
          Recommencer un audit
        </button>
      </div>
    );
  }

  const compte = (statut: string) => resultat.items.filter((i) => i.statut === statut).length;
  const global = LIBELLES_GLOBAL[resultat.global];

  async function payer() {
    setMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage('Indiquez l’email qui recevra le document.');
      return;
    }
    setEnCours(true);
    try {
      const reponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reponses }),
      });
      const corps = (await reponse.json()) as { url?: string; erreur?: string };
      if (reponse.ok && corps.url) {
        window.location.assign(corps.url);
        return;
      }
      setMessage(corps.erreur ?? 'Paiement indisponible, réessayez.');
    } catch {
      setMessage('Paiement indisponible, réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <div className={`verdict-carte ${global.classe}`}>
        <div className="verdict-titre">{global.titre}</div>
        <p className="verdict-detail" style={{ marginBottom: 0 }}>
          {resultat.items.length} points contrôlés · règles vérifiées au {resultat.rulesVersion}.
        </p>
      </div>

      <div className="compteurs">
        <span className="compteur verdict-conforme">{compte('conforme')} conformes</span>
        <span className="compteur verdict-annulable">{compte('non_conforme')} à corriger</span>
        <span className="compteur verdict-vigilance">{compte('vigilance')} vigilances</span>
      </div>

      <div className="detail-floute">
        <div className="items-floutes" aria-hidden="true">
          {resultat.items.map((item) => (
            <div key={item.code} className={`item-audit statut-${item.statut}`}>
              <span className="code">{item.code} — {item.libelle}</span>
              <p style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>{item.explication}</p>
              {item.actionCorrective && (
                <p style={{ margin: '4px 0 0', fontSize: '0.92rem' }}>
                  <strong>Action :</strong> {item.actionCorrective}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="paywall-voile">
          <div className="carte" style={{ maxWidth: 440 }}>
            <h3>Débloquez le détail point par point</h3>
            <p style={{ fontSize: '0.95rem' }}>
              Chaque cause de nullité expliquée avec sa référence légale, son action corrective,
              et votre {resultat.global === 'conforme' ? 'attestation' : 'rapport'} PDF numéroté,
              vérifiable en ligne.
            </p>
            <label className="etiquette" htmlFor="paywall-email">Email de livraison</label>
            <input
              id="paywall-email"
              className="champ"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <button
              type="button"
              className="bouton bouton-voltage"
              style={{ width: '100%' }}
              disabled={enCours}
              onClick={payer}
            >
              {enCours ? 'Redirection vers le paiement…' : 'Obtenir l’audit complet + attestation — 29 €'}
            </button>
            {message && (
              <p className="aide" style={{ marginTop: 10 }}>{message}</p>
            )}
            <p className="aide" style={{ marginTop: 10 }}>
              <a href="/specimen-attestation">Voir un spécimen d'attestation</a>
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="lien-discret"
        style={{ marginTop: 16 }}
        onClick={onRecommencer}
      >
        Recommencer un audit
      </button>
    </div>
  );
}
