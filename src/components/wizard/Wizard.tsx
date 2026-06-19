/**
 * Wizard d'audit (E4) — 5 étapes, blocs A→E, état repris depuis localStorage.
 * Le wizard complet est AVANT le paiement (PRD E5) : le calcul est local,
 * rien n'est transmis tant que l'utilisateur ne paie pas.
 */
import { useEffect, useMemo, useState } from 'react';
import { computeAudit } from '../../lib/moteur/audit';
import { DELAI_LEGAL_MIN, DELAI_REGLEMENT_MAX } from '../../lib/moteur/delai';
import { TAXONOMIE } from '../../lib/moteur/taxonomie.generated';
import type { ModeNotification, Regime, ReponsesAudit } from '../../lib/moteur/types';
import DOCUMENTS from '../../lib/moteur/documents.json';
import { CLE_CALCULATEUR, type SaisieCalculateur } from '../Calculateur';
import TriEtat, { versBooleen, type Reponse } from './TriEtat';
import Resultat from './Resultat';

const CLE_STOCKAGE = 'imparable-audit-v1';

interface ResolutionWizard {
  id: number;
  /** Slug taxonomie, ou null pour une résolution libre. */
  slug: string | null;
  intituleLibre: string;
  majoriteAnnoncee: Regime | null;
  documentsJoints: string[];
}

interface EtatWizard {
  etape: number;
  mode: ModeNotification;
  dateNotification: string;
  dateAG: string;
  delaiReglement: number;
  urgence: boolean;
  modeAdmisPourTous: Reponse;
  lreAccordExpres: Reponse;
  lieuDateHeure: Reponse;
  ordreDuJourComplet: Reponse;
  consultationPieces: Reponse;
  formulaireVoteJoint: Reponse;
  resolutions: ResolutionWizard[];
  prochainId: number;
  qualite: ReponsesAudit['convocateur']['qualite'] | null;
  mandatEnCours: Reponse;
}

const ETAT_INITIAL: EtatWizard = {
  etape: 0,
  mode: 'lrar',
  dateNotification: '',
  dateAG: '',
  delaiReglement: DELAI_LEGAL_MIN,
  urgence: false,
  modeAdmisPourTous: null,
  lreAccordExpres: null,
  lieuDateHeure: null,
  ordreDuJourComplet: null,
  consultationPieces: null,
  formulaireVoteJoint: null,
  resolutions: [],
  prochainId: 1,
  qualite: null,
  mandatEnCours: null,
};

const ETAPES = [
  { bloc: 'A', titre: 'Délai & notification' },
  { bloc: 'B', titre: 'Mentions de la convocation' },
  { bloc: 'C', titre: 'Résolutions & documents joints' },
  { bloc: 'D', titre: 'Majorités annoncées' },
  { bloc: 'E', titre: 'Qualité du convocateur' },
  { bloc: '✓', titre: 'Résultat' },
] as const;

function versReponses(e: EtatWizard): ReponsesAudit {
  return {
    delai: {
      mode: e.mode,
      dateNotification: e.dateNotification,
      dateAG: e.dateAG,
      delaiReglement: e.delaiReglement,
      urgence: e.urgence,
    },
    modeAdmisPourTous: versBooleen(e.modeAdmisPourTous),
    lreAccordExpres: versBooleen(e.lreAccordExpres),
    mentions: {
      lieuDateHeure: versBooleen(e.lieuDateHeure),
      ordreDuJourComplet: versBooleen(e.ordreDuJourComplet),
      consultationPieces: versBooleen(e.consultationPieces),
    },
    formulaireVoteJoint: versBooleen(e.formulaireVoteJoint),
    resolutions: e.resolutions.map((r) => ({
      slug: r.slug ?? undefined,
      intituleLibre: r.intituleLibre || undefined,
      majoriteAnnoncee: r.majoriteAnnoncee ?? 'art24',
      documentsJoints: r.documentsJoints,
    })),
    convocateur: {
      qualite: e.qualite ?? undefined,
      mandatEnCours: versBooleen(e.mandatEnCours),
    },
  };
}

function libelleDocument(slug: string): string {
  return (DOCUMENTS as Record<string, string>)[slug] ?? slug;
}

function typeDeResolution(slug: string | null) {
  return slug ? TAXONOMIE.find((t) => t.slug === slug) : undefined;
}

export default function Wizard() {
  const [etat, setEtat] = useState<EtatWizard>(ETAT_INITIAL);
  const [charge, setCharge] = useState(false);
  // Le clic LANCE l'audit. Géré ici, dans l'îlot React déjà hydraté,
  // pour ne dépendre d'aucun script externe.
  const [demarre, setDemarre] = useState(false);

  // Reprise de session : localStorage uniquement côté client (PRD E4).
  // À défaut de session en cours, reprend la saisie du calculateur (S1) :
  // l'utilisateur qui arrive du verdict ne retape pas ses dates.
  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(CLE_STOCKAGE);
      if (brut) {
        setEtat({ ...ETAT_INITIAL, ...(JSON.parse(brut) as Partial<EtatWizard>) });
      } else {
        const calc = window.localStorage.getItem(CLE_CALCULATEUR);
        if (calc) {
          const saisie = JSON.parse(calc) as SaisieCalculateur;
          setEtat((e) => ({
            ...e,
            mode: saisie.mode,
            dateNotification: saisie.dateNotification,
            dateAG: saisie.dateAG,
            delaiReglement: saisie.delaiReglement,
          }));
        }
      }
    } catch {
      // état corrompu → repartir de zéro
    }
    setCharge(true);
  }, []);

  useEffect(() => {
    if (charge) window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
  }, [etat, charge]);

  const maj = (delta: Partial<EtatWizard>) => setEtat((e) => ({ ...e, ...delta }));

  const majResolution = (id: number, delta: Partial<ResolutionWizard>) =>
    setEtat((e) => ({
      ...e,
      resolutions: e.resolutions.map((r) => (r.id === id ? { ...r, ...delta } : r)),
    }));

  const etapeAValide = etat.urgence || (etat.dateNotification !== '' && etat.dateAG !== '');

  const reponses = useMemo(() => versReponses(etat), [etat]);
  const resultat = useMemo(
    () => (etat.etape === 5 && etapeAValide ? computeAudit(reponses, TAXONOMIE) : null),
    [etat.etape, etapeAValide, reponses],
  );

  const etapeCourante = ETAPES[Math.min(etat.etape, ETAPES.length - 1)] ?? ETAPES[0];

  // Focus le 1er champ dès que l'audit démarre, pour un effet immédiat.
  useEffect(() => {
    if (demarre) {
      const champ = document.querySelector<HTMLElement>('.calculateur input, .calculateur select');
      champ?.focus();
    }
  }, [demarre]);

  // Écran de départ : on ne montre QUE le bouton tant qu'il n'est pas cliqué.
  if (!demarre) {
    return (
      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          className="bouton bouton-voltage bouton-cta-audit"
          onClick={() => {
            // « Commencer » dépose toujours sur la 1re question, jamais sur
            // l'écran de résultat/paiement d'une session précédente terminée.
            setEtat((e) => ({ ...e, etape: 0 }));
            setDemarre(true);
          }}
        >
          Commencer mon audit gratuit →
        </button>
      </div>
    );
  }

  return (
    <div className="carte calculateur" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="wizard-progression" aria-hidden="true">
        {ETAPES.map((s, i) => (
          <span key={s.titre} className={i <= etat.etape ? 'actif' : ''} />
        ))}
      </div>
      <p className="wizard-bloc-titre">
        {etat.etape < 5 ? `Étape ${etat.etape + 1} sur 5` : 'Verdict'}
      </p>
      <h3 style={{ marginBottom: 20 }}>{etapeCourante.titre}</h3>

      {etat.etape === 0 && (
        <>
          <div className="ligne-champs">
            <div className="pleine-largeur">
              <label className="etiquette" htmlFor="wiz-mode">Mode de notification</label>
              <select
                id="wiz-mode"
                className="champ"
                value={etat.mode}
                onChange={(e) => maj({ mode: e.target.value as ModeNotification })}
              >
                <option value="lrar">Lettre recommandée avec accusé de réception</option>
                <option value="main_propre">Remise en main propre contre récépissé/émargement</option>
                <option value="lre">Lettre recommandée électronique</option>
              </select>
              <p className="aide">Comment la convocation est partie chez les copropriétaires.</p>
            </div>
            <div>
              <label className="etiquette" htmlFor="wiz-notif">
                {etat.mode === 'lrar'
                  ? 'Date de première présentation'
                  : etat.mode === 'main_propre'
                    ? 'Date de remise'
                    : 'Date d’envoi de la LRE'}
              </label>
              <input
                id="wiz-notif"
                className="champ"
                type="date"
                value={etat.dateNotification}
                onChange={(e) => maj({ dateNotification: e.target.value })}
              />
              <p className="aide">
                {etat.mode === 'lrar'
                  ? 'La date où le courrier a été présenté au domicile (sur l’accusé de réception / l’avis de passage), pas la date d’envoi.'
                  : etat.mode === 'main_propre'
                    ? 'La date où la convocation a été remise en main propre.'
                    : 'La date d’envoi du recommandé électronique.'}
              </p>
            </div>
            <div>
              <label className="etiquette" htmlFor="wiz-ag">Date de l’assemblée</label>
              <input
                id="wiz-ag"
                className="champ"
                type="date"
                value={etat.dateAG}
                onChange={(e) => maj({ dateAG: e.target.value })}
              />
              <p className="aide">La date prévue de la réunion, indiquée sur la convocation.</p>
            </div>
            <details className="wizard-avance pleine-largeur">
              <summary>Cas particulier (facultatif) — délai du règlement, urgence</summary>
              <div style={{ marginTop: 14 }}>
                <label className="etiquette" htmlFor="wiz-delai">Délai prévu par votre règlement de copropriété (jours)</label>
                <input
                  id="wiz-delai"
                  className="champ"
                  type="number"
                  min={DELAI_LEGAL_MIN}
                  max={DELAI_REGLEMENT_MAX}
                  value={etat.delaiReglement}
                  onChange={(e) => maj({ delaiReglement: Number(e.target.value) })}
                />
                <p className="aide">Laissez 21 si votre règlement ne prévoit pas de délai plus long — c'est le minimum légal.</p>
                <label className="case" style={{ marginTop: 14 }}>
                  <input
                    type="checkbox"
                    checked={etat.urgence}
                    onChange={(e) => maj({ urgence: e.target.checked })}
                  />
                  <span>Convocation d’urgence (« délai raisonnable », art. 9 al. 3 du décret de 1967)</span>
                </label>
              </div>
            </details>
          </div>

          <TriEtat
            nom="modeAdmis"
            question="Tous les copropriétaires ont-ils été convoqués selon un mode admis ?"
            aide="LRAR, remise contre récépissé ou émargement, ou LRE (art. 64, décret du 17 mars 1967)."
            valeur={etat.modeAdmisPourTous}
            onChange={(v) => maj({ modeAdmisPourTous: v })}
          />
          {etat.mode === 'lre' && (
            <TriEtat
              nom="lreAccord"
              question="Chaque destinataire de la LRE a-t-il donné son accord exprès préalable ?"
              aide="Sans accord exprès, la notification électronique est irrégulière (art. 42-1, loi du 10 juillet 1965)."
              valeur={etat.lreAccordExpres}
              onChange={(v) => maj({ lreAccordExpres: v })}
            />
          )}
        </>
      )}

      {etat.etape === 1 && (
        <>
          <TriEtat
            nom="b1"
            question="La convocation indique-t-elle le lieu, la date et l’heure de l’assemblée ?"
            valeur={etat.lieuDateHeure}
            onChange={(v) => maj({ lieuDateHeure: v })}
          />
          <TriEtat
            nom="b2"
            question="L’ordre du jour énumère-t-il chacune des questions soumises au vote ?"
            aide="Une question absente de l’ordre du jour ne peut pas être valablement votée (art. 13, décret de 1967)."
            valeur={etat.ordreDuJourComplet}
            onChange={(v) => maj({ ordreDuJourComplet: v })}
          />
          <TriEtat
            nom="b3"
            question="Les modalités de consultation des pièces justificatives des charges sont-elles précisées ?"
            valeur={etat.consultationPieces}
            onChange={(v) => maj({ consultationPieces: v })}
          />
        </>
      )}

      {etat.etape === 2 && (
        <>
          <TriEtat
            nom="c0"
            question="Le formulaire de vote par correspondance est-il joint à la convocation ?"
            aide="Il est exigé pour toute assemblée (art. 17-1 A, loi du 10 juillet 1965)."
            valeur={etat.formulaireVoteJoint}
            onChange={(v) => maj({ formulaireVoteJoint: v })}
          />

          <p className="etiquette">Résolutions inscrites à l’ordre du jour</p>
          {etat.resolutions.length === 0 && (
            <p className="aide" style={{ marginBottom: 14 }}>
              Ajoutez chaque résolution : le moteur contrôlera les documents à joindre et la
              majorité applicable depuis la Bibliothèque.
            </p>
          )}

          {etat.resolutions.map((r) => {
            const type = typeDeResolution(r.slug);
            return (
              <div className="resolution-carte" key={r.id}>
                <div className="resolution-entete">
                  <strong>{type?.intitule ?? 'Résolution libre'}</strong>
                  <button
                    type="button"
                    className="lien-discret"
                    onClick={() =>
                      setEtat((e) => ({
                        ...e,
                        resolutions: e.resolutions.filter((x) => x.id !== r.id),
                      }))
                    }
                  >
                    Retirer
                  </button>
                </div>
                {!type && (
                  <input
                    className="champ"
                    style={{ marginBottom: 10 }}
                    placeholder="Intitulé de la résolution (hors référentiel → vigilance)"
                    value={r.intituleLibre}
                    onChange={(e) => majResolution(r.id, { intituleLibre: e.target.value })}
                  />
                )}
                {type && type.documentsExiges.length > 0 ? (
                  <>
                    <p className="aide" style={{ marginBottom: 8 }}>
                      Documents joints à la convocation pour cette résolution :
                    </p>
                    {type.documentsExiges.map((doc) => (
                      <label className="case" key={doc} style={{ marginBottom: 6 }}>
                        <input
                          type="checkbox"
                          checked={r.documentsJoints.includes(doc)}
                          onChange={(e) =>
                            majResolution(r.id, {
                              documentsJoints: e.target.checked
                                ? [...r.documentsJoints, doc]
                                : r.documentsJoints.filter((d) => d !== doc),
                            })
                          }
                        />
                        <span>{libelleDocument(doc)}</span>
                      </label>
                    ))}
                  </>
                ) : type ? (
                  <p className="aide">Aucune annexe spécifique exigée pour cette résolution.</p>
                ) : (
                  <p className="aide">
                    Résolution hors référentiel : annexes et majorité seront signalées « à faire
                    vérifier ».
                  </p>
                )}
              </div>
            );
          })}

          <div className="ligne-champs" style={{ marginTop: 6 }}>
            <select
              className="champ"
              value=""
              aria-label="Ajouter une résolution depuis la Bibliothèque"
              onChange={(e) => {
                const slug = e.target.value;
                if (!slug) return;
                setEtat((et) => ({
                  ...et,
                  prochainId: et.prochainId + 1,
                  resolutions: [
                    ...et.resolutions,
                    {
                      id: et.prochainId,
                      slug,
                      intituleLibre: '',
                      majoriteAnnoncee: null,
                      documentsJoints: [],
                    },
                  ],
                }));
              }}
            >
              <option value="">+ Ajouter depuis la Bibliothèque…</option>
              {TAXONOMIE.map((t) => (
                <option key={t.slug} value={t.slug}>{t.intitule}</option>
              ))}
            </select>
            <button
              type="button"
              className="bouton bouton-secondaire"
              onClick={() =>
                setEtat((et) => ({
                  ...et,
                  prochainId: et.prochainId + 1,
                  resolutions: [
                    ...et.resolutions,
                    {
                      id: et.prochainId,
                      slug: null,
                      intituleLibre: '',
                      majoriteAnnoncee: null,
                      documentsJoints: [],
                    },
                  ],
                }))
              }
            >
              + Résolution libre
            </button>
          </div>
        </>
      )}

      {etat.etape === 3 && (
        <>
          {etat.resolutions.length === 0 ? (
            <p className="aide">Aucune résolution déclarée à l’étape précédente.</p>
          ) : (
            etat.resolutions.map((r) => {
              const type = typeDeResolution(r.slug);
              return (
                <div className="resolution-carte" key={r.id}>
                  <p className="etiquette" style={{ marginBottom: 8 }}>
                    {type?.intitule ?? r.intituleLibre ?? 'Résolution libre'}
                  </p>
                  <label className="aide" htmlFor={`maj-${r.id}`} style={{ display: 'block', marginBottom: 6 }}>
                    Majorité annoncée dans le projet de résolution :
                  </label>
                  <select
                    id={`maj-${r.id}`}
                    className="champ"
                    value={r.majoriteAnnoncee ?? ''}
                    onChange={(e) =>
                      majResolution(r.id, { majoriteAnnoncee: (e.target.value || null) as Regime | null })
                    }
                  >
                    <option value="">— Sélectionnez —</option>
                    <option value="art24">Majorité simple (art. 24)</option>
                    <option value="art25">Majorité absolue (art. 25)</option>
                    <option value="art26">Double majorité (art. 26)</option>
                    <option value="unanimite">Unanimité</option>
                  </select>
                </div>
              );
            })
          )}
        </>
      )}

      {etat.etape === 4 && (
        <>
          <div className="question">
            <label className="etiquette" htmlFor="wiz-qualite">Qui a convoqué l’assemblée ?</label>
            <select
              id="wiz-qualite"
              className="champ"
              value={etat.qualite ?? ''}
              onChange={(e) =>
                maj({ qualite: (e.target.value || null) as EtatWizard['qualite'] })
              }
            >
              <option value="">— Sélectionnez —</option>
              <option value="syndic">Le syndic en exercice</option>
              <option value="conseil_syndical">Le conseil syndical</option>
              <option value="coproprietaire_habilite">Un copropriétaire habilité</option>
              <option value="administrateur_provisoire">L’administrateur provisoire</option>
            </select>
          </div>
          {etat.qualite === 'syndic' && (
            <TriEtat
              nom="e2"
              question="Le mandat du syndic était-il en cours à la date d’ENVOI de la convocation ?"
              aide="Un syndic au mandat expiré n’a plus le pouvoir de convoquer (art. 7, décret de 1967)."
              valeur={etat.mandatEnCours}
              onChange={(v) => maj({ mandatEnCours: v })}
            />
          )}
        </>
      )}

      {etat.etape === 5 && resultat && (
        <Resultat
          resultat={resultat}
          reponses={reponses}
          onRecommencer={() => {
            window.localStorage.removeItem(CLE_STOCKAGE);
            setEtat(ETAT_INITIAL);
          }}
        />
      )}

      {etat.etape < 5 && (
        <div className="wizard-actions">
          <button
            type="button"
            className="bouton bouton-secondaire"
            disabled={etat.etape === 0}
            style={etat.etape === 0 ? { visibility: 'hidden' } : undefined}
            onClick={() => maj({ etape: etat.etape - 1 })}
          >
            Retour
          </button>
          <button
            type="button"
            className="bouton bouton-voltage"
            disabled={etat.etape === 0 && !etapeAValide}
            onClick={() => maj({ etape: etat.etape + 1 })}
          >
            {etat.etape === 4 ? 'Voir mon verdict →' : 'Continuer →'}
          </button>
        </div>
      )}
    </div>
  );
}
