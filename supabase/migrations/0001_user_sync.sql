-- مزامنة بيانات المستخدم عبر أجهزته — جدول واحد على شكل مفتاح/قيمة،
-- يطابق نموذج التخزين المحلي (hc.*) تمامًا فتكون المزامنة نسخًا لا ترجمة.
--
-- شغّله مرة واحدة في: Supabase Dashboard ← SQL Editor ← New query ← Run

create table if not exists public.user_state (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;

-- كل مستخدم لا يرى ولا يكتب إلا صفوفه
drop policy if exists "user_state own rows" on public.user_state;
create policy "user_state own rows"
  on public.user_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ربط اشتراك الإشعارات بصاحبه، حتى يحسب الخادم جدول كل مشترك من إعداداته
alter table public.calendar_push_subscriptions
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists calendar_push_subscriptions_user_id_idx
  on public.calendar_push_subscriptions (user_id);
