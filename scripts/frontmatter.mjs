/**
 * Parseur de frontmatter YAML — sous-ensemble strict, zéro dépendance.
 * Supporte : chaînes (nues ou entre guillemets), nombres, booléens,
 * tableaux en ligne (["a", "b"]) et tableaux en bloc (- item).
 * Tout le reste est une erreur : mieux vaut un build rouge qu'un frontmatter
 * silencieusement mal lu.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function parseScalar(raw, file, key) {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
  if (quoted) return quoted[1];
  if (value.includes('#')) {
    // Coupe un commentaire de fin de ligne sur les valeurs nues.
    return value.split('#')[0].trim();
  }
  if (value === '') {
    throw new Error(`${file} : valeur vide pour « ${key} »`);
  }
  return value;
}

function parseInlineArray(raw, file, key) {
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((part) => parseScalar(part, file, key));
}

export function parseFrontmatter(content, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) throw new Error(`${file} : frontmatter absent (bloc --- attendu en tête)`);

  const data = {};
  const lines = match[1].split(/\r?\n/);
  let currentArrayKey = null;

  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const arrayItem = /^\s+-\s+(.*)$/.exec(line);
    if (arrayItem) {
      if (!currentArrayKey) throw new Error(`${file} : élément de liste orphelin : « ${line.trim()} »`);
      data[currentArrayKey].push(parseScalar(arrayItem[1], file, currentArrayKey));
      continue;
    }

    const kv = /^([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (!kv) throw new Error(`${file} : ligne de frontmatter illisible : « ${line} »`);
    const key = kv[1];
    const rest = kv[2].trim();
    if (key in data) throw new Error(`${file} : clé dupliquée « ${key} »`);

    if (rest === '') {
      data[key] = [];
      currentArrayKey = key;
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      data[key] = parseInlineArray(rest, file, key);
      currentArrayKey = null;
    } else {
      data[key] = parseScalar(rest, file, key);
      currentArrayKey = null;
    }
  }
  return data;
}

/** Liste les fiches résolution du repo : [{ file, data }]. */
export function lireFiches(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({ file: f, data: parseFrontmatter(readFileSync(join(dir, f), 'utf8'), f) }));
}
