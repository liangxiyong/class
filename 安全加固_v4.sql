-- ============================================
-- 安全加固迁移 v4（2026-09-06）
-- 修复提权漏洞：角色判定弃用 JWT user_metadata（用户可自行篡改），
-- 改为查询 users 表（仅 admin/teacher 可写）。
-- 在 Supabase 控制台 → SQL Editor 中运行本文件全部内容。
-- ============================================

-- 1. users 表补 email 列（用于 RLS 关联当前登录用户）
alter table users add column if not exists email text;

-- 2. 现有账号补齐 email（与前端 emailOf 拼音映射一致）
update users set email = case username
  when 'admin' then 'admin@jfz.local'
  when 'admin2' then 'admin2@jfz.local'
  when 'teacher' then 'teacher@jfz.local'
  when '张益铭' then 'zhangyiming@jfz.local'
  when '董子瑜' then 'dongziyu@jfz.local'
  when '梁锡永' then 'liangxiyong@jfz.local'
  when '杨佳诺' then 'yangjianuo@jfz.local'
  when '马语秋' then 'mayuqiu@jfz.local'
  when '刘亦峻' then 'liuyijun@jfz.local'
  when '冯馨熠' then 'fengxinyi@jfz.local'
  when '黄詩宸' then 'huangshichen@jfz.local'
  when '谭梦瑶' then 'tanmengyao@jfz.local'
  when '张邵宸' then 'zhangshaochen@jfz.local'
  else username || '@jfz.local'
end
where email is null or email = '';

-- 3. 重写角色/组号函数：查 users 表（用户不可篡改的权威来源）
create or replace function jfz_role() returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select role from public.users where email = auth.jwt()->>'email'),''),'')
$$;
create or replace function jfz_group() returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select group_id from public.users where email = auth.jwt()->>'email'),''),'')
$$;

-- 4. 管理员重置密码：函数内角色校验改走 jfz_role()（users 表）
create or replace function public.admin_reset_password(p_email text, p_new_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_uid uuid;
begin
  if jfz_role() not in ('admin','teacher') then
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
