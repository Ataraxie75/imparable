/**
 * Question déclarative à trois états : oui / non / à vérifier.
 * « À vérifier » (ou l'absence de réponse) déclenche la règle d'humilité
 * du moteur : vigilance, jamais conforme.
 */
export type Reponse = 'oui' | 'non' | 'averifier' | null;

/** Conversion vers l'entrée du moteur (`undefined` = non garanti). */
export function versBooleen(r: Reponse): boolean | undefined {
  if (r === 'oui') return true;
  if (r === 'non') return false;
  return undefined;
}

const OPTIONS: ReadonlyArray<{ valeur: Exclude<Reponse, null>; libelle: string }> = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
  { valeur: 'averifier', libelle: 'À vérifier' },
];

interface Props {
  nom: string;
  question: string;
  aide?: string;
  valeur: Reponse;
  onChange: (valeur: Reponse) => void;
}

export default function TriEtat({ nom, question, aide, valeur, onChange }: Props) {
  return (
    <fieldset className="question" style={{ border: 0, padding: 0, margin: '0 0 22px' }}>
      <legend className="etiquette">{question}</legend>
      {aide && <p className="aide" style={{ marginBottom: 8 }}>{aide}</p>}
      <div className="tri-etat">
        {OPTIONS.map((o) => (
          <label key={o.valeur} className={valeur === o.valeur ? 'choisi' : ''}>
            <input
              type="radio"
              name={nom}
              checked={valeur === o.valeur}
              onChange={() => onChange(o.valeur)}
            />
            {o.libelle}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
