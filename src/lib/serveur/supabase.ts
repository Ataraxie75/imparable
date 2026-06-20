/**
 * Clients Supabase serveur. Le client service-role contourne la RLS :
 * il ne sort JAMAIS des routes serveur (PRD §17 — audits/attestations
 * accessibles uniquement via fonctions serveur).
 *
 * `realtime.transport: ws` : on tourne sur Node 20 (runtime imposé par le
 * rendu PDF), qui n'a pas de WebSocket natif. Sans ça, `createClient` plante
 * à l'instanciation (realtime-js). On ne se sert pas du realtime, mais le
 * client l'initialise quand même — `ws` lui fournit le transport attendu.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';
import { secret } from './env';

const OPTIONS = {
  auth: { persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
} as const;

export function clientServiceRole(): SupabaseClient {
  return createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), OPTIONS);
}

/** Client anonyme — uniquement pour la RPC publique `verifier_attestation` (E7). */
export function clientAnon(): SupabaseClient {
  return createClient(secret('SUPABASE_URL'), secret('SUPABASE_ANON_KEY'), OPTIONS);
}
