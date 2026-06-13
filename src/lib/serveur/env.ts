/**
 * Accès aux secrets serveur (variables Vercel chiffrées, PRD §17).
 * Lecture au moment de la requête, jamais au build : le site statique
 * se construit sans aucune clé, et les routes serveur échouent avec un
 * message clair si la configuration est absente.
 */

export class ConfigurationManquante extends Error {
  constructor(variable: string) {
    super(`Configuration serveur incomplète : variable « ${variable} » absente.`);
    this.name = 'ConfigurationManquante';
  }
}

export function secret(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) throw new ConfigurationManquante(nom);
  return valeur;
}

/** URL publique du site (liens d'email, URLs de vérification). */
export function urlSite(): string {
  return process.env['SITE_URL'] ?? 'https://imparable.fr';
}
