-- ============================================
-- TRIAL ENTITLEMENT: 7-day Pro trial
-- ============================================

alter table users
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_used_at timestamptz,
  add column if not exists trial_ended_notified_at timestamptz;

alter table users
  drop constraint if exists users_entitlement_check;

alter table users
  add constraint users_entitlement_check
  check (entitlement in ('free', 'trial', 'paid'));

create index if not exists idx_users_trial_ends_at
  on users(trial_ends_at)
  where entitlement = 'trial';

create index if not exists idx_users_trial_used_at
  on users(trial_used_at)
  where trial_used_at is not null;

comment on column users.entitlement is 'free | trial | paid; trial auto-downgrades to free at trial_ends_at';
comment on column users.trial_started_at is 'When user started 7-day Pro trial';
comment on column users.trial_ends_at is 'When 7-day Pro trial expires';
comment on column users.trial_used_at is 'Non-null once user has consumed their one-time trial';
comment on column users.trial_ended_notified_at is 'When trial-ended popup/notice was shown to the user';
