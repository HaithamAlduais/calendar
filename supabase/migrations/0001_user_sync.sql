-- مزامنة بيانات المستخدم عبر أجهزته — جدول واحد على شكل مفتاح/قيمة،
-- يطابق نموذج التخزين المحلي (hc.*) تمامًا فتكون المزامنة نسخًا لا ترجمة.
--
-- شغّله مرة واحدة في مشروع التقويم (buffer-production / znlkhlfmhdjmldnmrrym):
--   Dashboard ← SQL Editor ← New query ← لصق ← Run
-- وهو آمن للتكرار: كل جملة فيه مشروطة بعدم الوجود.

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

-- ربط اشتراك الإشعارات بصاحبه، حتى يحسب الخادم جدول كل مشترك من إعداداته.
-- مشروطٌ بوجود جدول الاشتراكات: فإن غاب (مشروع آخر) لم تسقط الهجرة كلها معه.
do $$
begin
  if to_regclass('public.calendar_push_subscriptions') is not null then
    alter table public.calendar_push_subscriptions
      add column if not exists user_id uuid references auth.users (id) on delete cascade;
    create index if not exists calendar_push_subscriptions_user_id_idx
      on public.calendar_push_subscriptions (user_id);
  else
    raise notice 'calendar_push_subscriptions غير موجود — تأكّد أنك في مشروع التقويم';
  end if;
end $$;
