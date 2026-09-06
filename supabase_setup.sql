-- ============================================
-- 小组积分系统 · Supabase 建表 SQL（2026-09-06 v3：按组隔离）
-- 在 Supabase 控制台 → SQL Editor 中运行
-- v3 要点：
--   ① 登录迁移到 Supabase Auth（JWT），页面请求携带用户令牌
--   ② RLS 按角色/组隔离：admin/teacher 全权；admin2 仅第1组；组长仅自己组
--   ③ users 表不再存登录密码（登录/改密走 Auth）
-- ============================================

-- 0. 加密扩展（Auth 密码哈希）
create extension if not exists pgcrypto;

-- 1. 组数据表：每组存一份完整 JSON 数据
create table if not exists group_data (
  group_id   text primary key,          -- '1' ~ '10'
  group_name text not null,             -- 组名（第一组~第十组）
  data       jsonb not null default '{}'::jsonb,  -- 该组完整积分数据
  updated_at timestamptz default now()
);

-- 2. 组长表：姓名 → 所属组
create table if not exists leaders (
  name     text primary key,            -- 组长姓名（登录账号）
  group_id text not null                -- 所属组 '1' ~ '10'
);

-- 2.1 用户表：账号角色信息（登录/改密走 Supabase Auth，本表不再存密码）
create table if not exists users (
  username text primary key,            -- 登录用户名
  password text not null default '',    -- 保留列（不再使用，置空）
  role     text not null,               -- admin / admin2 / teacher / leader / user
  group_id text                         -- 组长所属组 '1' ~ '10'
);

-- 2.2 班级数据表：整班眼操/纪律数据存单行（id='class'）
create table if not exists class_data (
  id         text primary key,          -- 'class'
  data       jsonb not null default '{}'::jsonb,  -- 班级完整数据
  updated_at timestamptz default now()
);

-- 3. 行级安全 + 按组隔离策略
alter table group_data enable row level security;
alter table leaders enable row level security;
alter table users enable row level security;
alter table class_data enable row level security;

-- 3.0 辅助函数：读取当前登录用户（JWT user_metadata）的角色与组号
create or replace function jfz_role() returns text language sql stable as $$
  select coalesce(nullif(auth.jwt()->'user_metadata'->>'role',''),'')
$$;
create or replace function jfz_group() returns text language sql stable as $$
  select coalesce(nullif(auth.jwt()->'user_metadata'->>'group_id',''),'')
$$;

-- 3.1 group_data：admin/teacher 全权；admin2/组长仅自己组（读写删均按组）
drop policy if exists "group_data_all" on group_data;
drop policy if exists "group_data_select" on group_data;
drop policy if exists "group_data_insert" on group_data;
drop policy if exists "group_data_update" on group_data;
drop policy if exists "group_data_delete" on group_data;
create policy "group_data_select" on group_data
  for select using (jfz_role() in ('admin','teacher') or group_id = jfz_group());
create policy "group_data_insert" on group_data
  for insert with check (jfz_role() in ('admin','teacher') or group_id = jfz_group());
create policy "group_data_update" on group_data
  for update using (jfz_role() in ('admin','teacher') or group_id = jfz_group())
  with check (jfz_role() in ('admin','teacher') or group_id = jfz_group());
create policy "group_data_delete" on group_data
  for delete using (jfz_role() in ('admin','teacher') or group_id = jfz_group());

-- 3.2 leaders：登录用户可读（组长名列表，非敏感）
drop policy if exists "leaders_all" on leaders;
drop policy if exists "leaders_select" on leaders;
create policy "leaders_select" on leaders
  for select using (auth.role() = 'authenticated');

-- 3.3 users：登录用户可读，仅 admin/teacher 可写（防组长自我提权改 role）
drop policy if exists "users_all" on users;
drop policy if exists "users_all_authed" on users;
drop policy if exists "users_read_authed" on users;
drop policy if exists "users_insert_admin" on users;
drop policy if exists "users_update_admin" on users;
drop policy if exists "users_delete_admin" on users;
create policy "users_read_authed" on users
  for select using (auth.role() = 'authenticated');
create policy "users_insert_admin" on users
  for insert with check (jfz_role() in ('admin','teacher'));
create policy "users_update_admin" on users
  for update using (jfz_role() in ('admin','teacher'))
  with check (jfz_role() in ('admin','teacher'));
create policy "users_delete_admin" on users
  for delete using (jfz_role() in ('admin','teacher'));

-- 3.4 class_data：仅 admin / teacher / admin2（班级数据，admin2 为副管理员可维护）
drop policy if exists "class_data_all" on class_data;
drop policy if exists "class_data_select" on class_data;
drop policy if exists "class_data_insert" on class_data;
drop policy if exists "class_data_update" on class_data;
drop policy if exists "class_data_delete" on class_data;
create policy "class_data_select" on class_data
  for select using (jfz_role() in ('admin','teacher','admin2'));
create policy "class_data_insert" on class_data
  for insert with check (jfz_role() in ('admin','teacher','admin2'));
create policy "class_data_update" on class_data
  for update using (jfz_role() in ('admin','teacher','admin2'))
  with check (jfz_role() in ('admin','teacher','admin2'));
create policy "class_data_delete" on class_data
  for delete using (jfz_role() in ('admin','teacher','admin2'));

-- 3.5 表级授权（策略负责行级过滤）
grant select, insert, update, delete on group_data to anon, authenticated;
grant select, insert, update, delete on leaders to anon, authenticated;
grant select, insert, update, delete on users to anon, authenticated;
grant select, insert, update, delete on class_data to anon, authenticated;

-- 3.6 管理员重置任意账号密码（security definer 以服务端权限执行，函数内校验角色）
create or replace function public.admin_reset_password(p_email text, p_new_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_uid uuid;
begin
  if (auth.jwt()->'user_metadata'->>'role') not in ('admin','teacher') then
    raise exception '无权限：仅管理员可重置密码';
  end if;
  if p_new_password is null then
    raise exception '密码不能为空';
  end if;
  select id into v_uid from auth.users where email = lower(p_email);
  if v_uid is null then
    raise exception '用户不存在';
  end if;
  update auth.users set encrypted_password = crypt(p_new_password, gen_salt('bf', 10)) where id = v_uid;
  return 'ok';
end $$;
grant execute on function public.admin_reset_password(text, text) to authenticated;

-- 3.7 用户自助改密（任意长度，绕开 Auth 最小长度限制；函数内验证当前密码）
create or replace function public.change_my_password(old_password text, new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare v_uid uuid := auth.uid();
        v_email text;
        v_old_hash text;
begin
  if v_uid is null then
    raise exception '未登录';
  end if;
  if new_password is null or new_password = '' then
    raise exception '新密码不能为空';
  end if;
  select email into v_email from auth.users where id = v_uid;
  select encrypted_password into v_old_hash from auth.users where id = v_uid;
  if v_old_hash is null or v_old_hash = '' or v_old_hash not like '$2%' then
    raise exception '无法验证当前密码';
  end if;
  if crypt(old_password, v_old_hash) <> v_old_hash then
    raise exception '当前密码不正确';
  end if;
  update auth.users set encrypted_password = crypt(new_password, gen_salt('bf', 10)) where id = v_uid;
  return jsonb_build_object('ok', true, 'email', v_email);
end $$;
revoke execute on function public.change_my_password(text, text) from anon, public;
grant execute on function public.change_my_password(text, text) to authenticated;

-- 4. 插入组长名单（每组第1人是组长）
insert into leaders (name, group_id) values
  ('张益铭','1'),
  ('董子瑜','2'),
  ('梁锡永','3'),
  ('杨佳诺','4'),
  ('马语秋','5'),
  ('刘亦峻','6'),
  ('冯馨熠','7'),
  ('黄詩宸','8'),
  ('谭梦瑶','9'),
  ('张邵宸','10')
on conflict (name) do nothing;

-- 4.1 插入账号角色信息（登录/改密在 Supabase Auth，本表仅记录角色）
-- admin / admin2 / teacher / 组长
insert into users (username, password, role, group_id) values
  ('admin','','admin',null),
  ('admin2','','admin2','1'),
  ('teacher','','teacher',null),
  ('张益铭','','leader','1'),
  ('董子瑜','','leader','2'),
  ('梁锡永','','leader','3'),
  ('杨佳诺','','leader','4'),
  ('马语秋','','leader','5'),
  ('刘亦峻','','leader','6'),
  ('冯馨熠','','leader','7'),
  ('黄詩宸','','leader','8'),
  ('谭梦瑶','','leader','9'),
  ('张邵宸','','leader','10')
on conflict (username) do nothing;

-- 4.2 迁移登录账号到 Supabase Auth（JWT 登录）
-- 账号 = 用户名（组长用拼音）；密码 = 原默认密码；已存在的账号不会被覆盖/重置
-- admin=19176164q  admin2=123456  teacher=123456  组长=组号
-- 先清理历史遗留的非 ASCII 邮箱账号（旧版生成器曾用中文名做邮箱）
delete from auth.identities i using auth.users u where i.user_id = u.id and u.email like '%@jfz.local' and u.email ~ '[^a-zA-Z0-9.@]';
delete from auth.users where email like '%@jfz.local' and email ~ '[^a-zA-Z0-9.@]';
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'admin@jfz.local',
  crypt('19176164q', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"admin","role":"admin"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'admin@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'admin@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'admin2@jfz.local',
  crypt('123456', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"admin2","role":"admin2","group_id":"1"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'admin2@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'admin2@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'teacher@jfz.local',
  crypt('123456', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"teacher","role":"teacher"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'teacher@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'teacher@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'zhangyiming@jfz.local',
  crypt('1', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"张益铭","role":"leader","group_id":"1"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'zhangyiming@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'zhangyiming@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'dongziyu@jfz.local',
  crypt('2', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"董子瑜","role":"leader","group_id":"2"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'dongziyu@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'dongziyu@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'liangxiyong@jfz.local',
  crypt('3', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"梁锡永","role":"leader","group_id":"3"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'liangxiyong@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'liangxiyong@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'yangjianuo@jfz.local',
  crypt('4', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"杨佳诺","role":"leader","group_id":"4"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'yangjianuo@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'yangjianuo@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'mayuqiu@jfz.local',
  crypt('5', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"马语秋","role":"leader","group_id":"5"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'mayuqiu@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'mayuqiu@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'liuyijun@jfz.local',
  crypt('6', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"刘亦峻","role":"leader","group_id":"6"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'liuyijun@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'liuyijun@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'fengxinyi@jfz.local',
  crypt('7', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"冯馨熠","role":"leader","group_id":"7"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'fengxinyi@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'fengxinyi@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'huangshichen@jfz.local',
  crypt('8', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"黄詩宸","role":"leader","group_id":"8"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'huangshichen@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'huangshichen@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'tanmengyao@jfz.local',
  crypt('9', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"谭梦瑶","role":"leader","group_id":"9"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'tanmengyao@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'tanmengyao@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'zhangshaochen@jfz.local',
  crypt('10', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '{"username":"张邵宸","role":"leader","group_id":"10"}',
  now(), now()
where not exists (select 1 from auth.users where email = 'zhangshaochen@jfz.local');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = 'zhangshaochen@jfz.local'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);


-- 修复手工插入账号的 NULL 字符串列（GoTrue 登录要求非 NULL，否则报 Database error querying schema）
update auth.users set
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, '')
where email like '%@jfz.local';

-- 5. 插入10个组的完整默认数据（成员 + 评分项目）
-- 已存在且 data 非空的组不会被覆盖（仅空数据行被填充）
insert into group_data (group_id, group_name, data) values
  ('1','第一组','{"version":2,"itemsVer":3,"groupName":"第一组","font":"sans","students":[{"id":"seed1_1","name":"张益铭"},{"id":"seed1_2","name":"谭佑安"},{"id":"seed1_3","name":"李锦馨"},{"id":"seed1_4","name":"王铂乔"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('2','第二组','{"version":2,"itemsVer":3,"groupName":"第二组","font":"sans","students":[{"id":"seed2_1","name":"董子瑜"},{"id":"seed2_2","name":"李子涵"},{"id":"seed2_3","name":"刘一辰"},{"id":"seed2_4","name":"朱桐莹"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('3','第三组','{"version":2,"itemsVer":3,"groupName":"第三组","font":"sans","students":[{"id":"seed3_1","name":"梁锡永"},{"id":"seed3_2","name":"李宜锦"},{"id":"seed3_3","name":"刘铠墨"},{"id":"seed3_4","name":"王沐宇轩"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('4','第四组','{"version":2,"itemsVer":3,"groupName":"第四组","font":"sans","students":[{"id":"seed4_1","name":"杨佳诺"},{"id":"seed4_2","name":"平扬"},{"id":"seed4_3","name":"李锦桐"},{"id":"seed4_4","name":"季牧云"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('5','第五组','{"version":2,"itemsVer":3,"groupName":"第五组","font":"sans","students":[{"id":"seed5_1","name":"马语秋"},{"id":"seed5_2","name":"张儒溪"},{"id":"seed5_3","name":"邓泽雨"},{"id":"seed5_4","name":"马雨欣"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('6','第六组','{"version":2,"itemsVer":3,"groupName":"第六组","font":"sans","students":[{"id":"seed6_1","name":"刘亦峻"},{"id":"seed6_2","name":"郭一涵"},{"id":"seed6_3","name":"章浩宸"},{"id":"seed6_4","name":"梁馨悦"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('7','第七组','{"version":2,"itemsVer":3,"groupName":"第七组","font":"sans","students":[{"id":"seed7_1","name":"冯馨熠"},{"id":"seed7_2","name":"李晞玥"},{"id":"seed7_3","name":"盖俊杰"},{"id":"seed7_4","name":"王玺朝"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('8','第八组','{"version":2,"itemsVer":3,"groupName":"第八组","font":"sans","students":[{"id":"seed8_1","name":"黄詩宸"},{"id":"seed8_2","name":"刘若安"},{"id":"seed8_3","name":"李恩"},{"id":"seed8_4","name":"王珮钰"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('9','第九组','{"version":2,"itemsVer":3,"groupName":"第九组","font":"sans","students":[{"id":"seed9_1","name":"谭梦瑶"},{"id":"seed9_2","name":"周倾淳"},{"id":"seed9_3","name":"姚静怡"},{"id":"seed9_4","name":"陈浩天"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb),
  ('10','第十组','{"version":2,"itemsVer":3,"groupName":"第十组","font":"sans","students":[{"id":"seed10_1","name":"张邵宸"},{"id":"seed10_2","name":"王仁可"},{"id":"seed10_3","name":"刘相希"},{"id":"seed10_4","name":"张天阳"}],"items":[{"id":"late","name":"迟到","presets":[{"label":"晨检迟到","value":-4},{"label":"预备铃迟到","value":-2},{"label":"上课迟到","value":-4},{"label":"旷课","value":-8}]},{"id":"class","name":"课堂表现","presets":[{"label":"点名回答","value":1},{"label":"主动回答","value":2},{"label":"睡觉","value":-6},{"label":"说话","value":-4},{"label":"吃东西","value":-20}]},{"id":"study","name":"自习","presets":[{"label":"睡觉","value":-6},{"label":"说话","value":-4}]},{"id":"notes","name":"笔记","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不完整","value":-2}]},{"id":"hw","name":"作业","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不写","value":-6},{"label":"不全","value":-4},{"label":"不订正","value":-2}]},{"id":"break","name":"课间纪律","presets":[{"label":"骂人","value":-10},{"label":"打架","value":-20},{"label":"下湖","value":-50}]},{"id":"duty","name":"值日","presets":[{"label":"不值日","value":-20},{"label":"乱扔垃圾","value":-4}]},{"id":"exercise","name":"课间操","presets":[{"label":"逃操","value":-20},{"label":"说话","value":-6},{"label":"掉队","value":-4}]},{"id":"eye","name":"眼保健操","default":2,"presets":[{"label":"优秀","value":2},{"label":"不做操","value":-4},{"label":"不认真","value":-2}]},{"id":"appearance","name":"仪容仪表","presets":[{"label":"没戴红领巾","value":-4},{"label":"发型不合适","value":-10},{"label":"戴首饰","value":-10}]},{"id":"pass","name":"过关练习","presets":[{"label":"卓越","value":4},{"label":"优秀","value":2},{"label":"不合格","value":-2},{"label":"没完成","value":-4}]},{"id":"week","name":"周反馈","presets":[{"label":"第1名","value":6},{"label":"第2名","value":4},{"label":"第3名","value":2},{"label":"100分","value":6},{"label":"90分以上","value":4},{"label":"85分以上","value":2},{"label":"不及格","value":-4},{"label":"倒数第3名","value":-2},{"label":"倒数第2名","value":-4},{"label":"倒数第1名","value":-6}]},{"id":"month","name":"月反馈","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"},{"id":"top20","label":"年级前20","pct":5,"group":"top"}],"presets":[{"label":"倒数第5名","value":-2},{"label":"倒数第4名","value":-4},{"label":"倒数第3名","value":-6},{"label":"倒数第2名","value":-8},{"label":"倒数第1名","value":-10},{"label":"不及格","value":-6}]},{"id":"good","name":"好人好事","formula":{"expr":"46-N+1","minN":5},"weights":[{"id":"xw1","label":"馨菱1","pct":10,"group":"xw"},{"id":"xw2","label":"馨菱2","pct":5,"group":"xw"}],"presets":[{"label":"一般","value":2}]}],"scores":{},"notes":{},"baseOff":{}}'::jsonb)
on conflict (group_id) do update set
  data = excluded.data,
  group_name = excluded.group_name,
  updated_at = now()
where group_data.data = '{}'::jsonb;

-- 6. 验证查询（执行后应返回 10 组、10 组长、13 账号、13 Auth 账号）
-- select count(*) from group_data;
-- select count(*) from leaders;
-- select count(*) from users;
-- select count(*) from auth.users where email like '%@jfz.local';

-- 7. 清理诊断临时表（如存在）
drop table if exists public._dbg;
