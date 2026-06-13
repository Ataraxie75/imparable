/**
 * Clients Supabase serveur. Le client service-role contourne la RLS :
 * il ne sort JAMAIS des routes serveur (PRD §17 — audits/attestations
 * accessibles uniquement via fonctions serveur).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secret } from './env';

export function clientServiceRole(): SupabaseClient {
  return createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}

/** Client anonyme — uniquement pour la RPC publique `verifier_attestation` (E7). */
export function clientAnon(): SupabaseClient {
  return createClient(secret('SUPABASE_URL'), secret('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  });
}
