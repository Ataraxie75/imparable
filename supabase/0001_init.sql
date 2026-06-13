-- IMPARABLE — schéma initial (PRD §17).
-- À exécuter MANUELLEMENT dans le SQL Editor du projet Supabase EU (Frankfurt),
-- jamais auto-appliqué (discipline PRD §22). Le gratuit ne touche JAMAIS la
-- base : seuls les audits payés, attestations et cabinets vivent ici.

-- ── Cabinets (Pass Cabinet, 290 €/an) ───────────────────────────────────────
create table cabinets (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  logo_url text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  statut text not null default 'actif' check (statut in ('actif', 'suspendu', 'resilie')),
  created_at timestamptz not null default now()
);

create table cabinet_membres (
  cabinet_id uuid references cabinets(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'membre' check (role in ('admin', 'membre')),
  primary key (cabinet_id, user_id)
);

-- ── Audits payés ────────────────────────────────────────────────────────────
create table audits (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reponses jsonb not null,            -- ReponsesAudit
  resultat jsonb not null,            -- ResultatAudit
  statut_global text not null check (statut_global in ('conforme', 'non_conforme', 'vigilance')),
  rules_version text not null,
  stripe_session_id text unique,      -- idempotence du webhook
  paid_at timestamptz,
  cabinet_id uuid references cabinets(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Attestations / rapports ─────────────────────────────────────────────────
create sequence attestation_seq;

create table attestations (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null,        -- 'IMP-2026-00042', généré serveur
  audit_id uuid not null references audits(id) on delete restrict,
  type text not null check (type in ('attestation', 'rapport')),  -- conforme → attestation ; sinon rapport
  pdf_sha256 text not null,
  emise_le timestamptz not null default now()
);

-- Numérotation 'IMP-AAAA-00042' — toujours côté serveur, jamais côté client.
create or replace function prochain_numero_attestation()
returns text
language sql
volatile
as $$
  select 'IMP-' || extract(year from now())::text || '-' ||
         lpad(nextval('attestation_seq')::text, 5, '0');
$$;

-- ── RLS : tout fermé par défaut ─────────────────────────────────────────────
alter table cabinets enable row level security;
alter table cabinet_membres enable row level security;
alter table audits enable row level security;
alter table attestations enable row level security;

-- Aucune policy anon/authenticated sur audits/attestations : accès uniquement
-- via fonctions serveur (service role), qui contournent la RLS.

-- Les membres d'un cabinet lisent leur cabinet…
create policy "membres lisent leur cabinet"
  on cabinets for select
  using (id in (select cabinet_id from cabinet_membres where user_id = auth.uid()));

-- …la liste des membres de leur cabinet…
create policy "membres lisent les membres de leur cabinet"
  on cabinet_membres for select
  using (cabinet_id in (select cabinet_id from cabinet_membres where user_id = auth.uid()));

-- …et les audits rattachés à leur cabinet (historique E8).
create policy "membres lisent les audits de leur cabinet"
  on audits for select
  using (cabinet_id in (select cabinet_id from cabinet_membres where user_id = auth.uid()));

create policy "membres lisent les attestations de leur cabinet"
  on attestations for select
  using (audit_id in (
    select a.id from audits a
    join cabinet_membres m on m.cabinet_id = a.cabinet_id
    where m.user_id = auth.uid()
  ));

-- ── Stockage privé des documents émis ───────────────────────────────────────
-- Bucket fermé : la lecture passe par des URLs signées générées côté serveur.
insert into storage.buckets (id, name, public)
values ('attestations', 'attestations', false)
on conflict (id) do nothing;

-- ── Vérification publique (E7) ──────────────────────────────────────────────
-- /verifier/{numero} appelle cette fonction (security definer) qui ne renvoie
-- JAMAIS de donnée personnelle : ni email, ni réponses, ni détail d'items.
create or replace function verifier_attestation(p_numero text)
returns table (numero text, emise_le timestamptz, type text, statut_global text, rules_version text)
language sql
security definer
set search_path = public
stable
as $$
  select att.numero, att.emise_le, att.type, a.statut_global, a.rules_version
  from attestations att
  join audits a on a.id = att.audit_id
  where att.numero = p_numero;
$$;

grant execute on function verifier_attestation(text) to anon;
