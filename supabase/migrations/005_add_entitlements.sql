-- ============================================
-- ENTITLEMENT: paid tier for Dodo Payments (₹199 one-time)
-- ============================================

alter table users
  add column if not exists entitlement text not null default 'free' check (entitlement in ('free', 'paid')),
  add column if not exists dodo_payment_id text,
  add column if not exists paid_at timestamptz;

create index if not exists idx_users_entitlement on users(entitlement);
create index if not exists idx_users_dodo_payment_id on users(dodo_payment_id) where dodo_payment_id is not null;

comment on column users.entitlement is 'free | paid; paid = one-time purchase completed';
comment on column users.dodo_payment_id is 'Dodo payment_id for idempotency and support';
comment on column users.paid_at is 'When entitlement was set to paid';
