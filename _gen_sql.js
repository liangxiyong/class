/* 生成更新后的 supabase_setup.sql：Auth 账号迁移 + 按组隔离 RLS */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('group.html', 'utf8');

const seg = html.match(/const GROUP_NAMES=\{[\s\S]*?const LEADER_GROUP=\{[\s\S]*?\};/);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(seg[0] + '\n;this.__out={GROUP_NAMES,GROUP_MEMBERS,LEADER_GROUP};', ctx);
const { GROUP_NAMES, GROUP_MEMBERS, LEADER_GROUP } = ctx.__out;

const itemsSeg = html.match(/const DEFAULT_ITEMS = \[[\s\S]*?(?=\nconst DEFAULT_STATE)/);
const ctx2 = {};
vm.createContext(ctx2);
vm.runInContext('const DEFAULT_ITEMS = ' + itemsSeg[0].replace(/^const DEFAULT_ITEMS = /, '') + '\n;this.__items=DEFAULT_ITEMS;', ctx2);
const DEFAULT_ITEMS = ctx2.__items;

/* 组长 → 登录邮箱（拼音）映射，与 index.html 的 LEADER_EMAIL 保持一致 */
const LEADER_EMAIL = {
  '张益铭': 'zhangyiming', '董子瑜': 'dongziyu', '梁锡永': 'liangxiyong',
  '杨佳诺': 'yangjianuo', '马语秋': 'mayuqiu', '刘亦峻': 'liuyijun',
  '冯馨熠': 'fengxinyi', '黄詩宸': 'huangshichen', '谭梦瑶': 'tanmengyao', '张邵宸': 'zhangshaochen'
};
function emailOf(name) {
  if (name === 'admin' || name === 'admin2' || name === 'teacher') return name + '@jfz.local';
  return (LEADER_EMAIL[name] || name) + '@jfz.local';
}

function sq(v) { return JSON.stringify(v).replace(/'/g, "''"); }

let out = '';
out += `-- ============================================
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
`;
const leaderRows = Object.entries(LEADER_GROUP).map(([n, g]) => `  ('${n}','${g}')`).join(',\n');
out += leaderRows + '\n' + `on conflict (name) do nothing;

-- 4.1 插入账号角色信息（登录/改密在 Supabase Auth，本表仅记录角色）
-- admin / admin2 / teacher / 组长
insert into users (username, password, role, group_id) values
`;
const userRows = [
  `  ('admin','','admin',null)`,
  `  ('admin2','','admin2','1')`,
  `  ('teacher','','teacher',null)`
];
for (const [n, g] of Object.entries(LEADER_GROUP)) {
  userRows.push(`  ('${n}','','leader','${g}')`);
}
out += userRows.join(',\n') + '\n' + `on conflict (username) do nothing;

-- 4.2 迁移登录账号到 Supabase Auth（JWT 登录）
-- 账号 = 用户名（组长用拼音）；密码 = 原默认密码；已存在的账号不会被覆盖/重置
-- admin=19176164q  admin2=123456  teacher=123456  组长=组号
-- 先清理历史遗留的非 ASCII 邮箱账号（旧版生成器曾用中文名做邮箱）
delete from auth.identities i using auth.users u where i.user_id = u.id and u.email like '%@jfz.local' and u.email ~ '[^a-zA-Z0-9.@]';
delete from auth.users where email like '%@jfz.local' and email ~ '[^a-zA-Z0-9.@]';
`;
const authRows = [];
function authRow(name, role, pwd, groupId) {
  const meta = { username: name, role: role };
  if (groupId) meta.group_id = groupId;
  const email = emailOf(name);
  return `insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', '${email}',
  crypt('${pwd}', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}',
  '${sq(meta)}',
  now(), now()
where not exists (select 1 from auth.users where email = '${email}');

-- 同步 auth.identities（GoTrue 登录依赖；email 列为生成列，勿手动赋值）
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', u.email, now(), now(), now()
from auth.users u
where u.email = '${email}'
  and not exists (select 1 from auth.identities i where i.user_id = u.id);
`;
}
authRows.push(authRow('admin', 'admin', '19176164q', null));
authRows.push(authRow('admin2', 'admin2', '123456', '1'));
authRows.push(authRow('teacher', 'teacher', '123456', null));
for (const [n, g] of Object.entries(LEADER_GROUP)) {
  authRows.push(authRow(n, 'leader', g, g));
}
out += authRows.join('\n') + '\n' + `
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
`;
const groupRows = [];
for (const gid of Object.keys(GROUP_NAMES)) {
  const data = {
    version: 2,
    itemsVer: 3,
    groupName: GROUP_NAMES[gid],
    font: 'sans',
    students: GROUP_MEMBERS[gid].map((n, i) => ({ id: 'seed' + gid + '_' + (i + 1), name: n })),
    items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
    scores: {},
    notes: {},
    baseOff: {}
  };
  groupRows.push(`  ('${gid}','${GROUP_NAMES[gid]}','${sq(data)}'::jsonb)`);
}
out += groupRows.join(',\n') + '\n' + `on conflict (group_id) do update set
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
`;

fs.writeFileSync('supabase_setup.sql', out, 'utf8');
console.log('已生成 supabase_setup.sql，大小', out.length, '字节');
console.log('leader 行数:', Object.keys(LEADER_GROUP).length, 'user 行数:', userRows.length, 'auth 行数:', authRows.length, 'group 行数:', groupRows.length);
