-- ============================================
-- 修复0：创建 pgcrypto 扩展（密码哈希依赖）
-- （admin_reset_password 和 change_my_password 里的 crypt()/gen_salt() 需要）
-- ============================================
create extension if not exists pgcrypto;

-- ============================================
-- 修复1：创建 admin_reset_password 函数
-- （管理员重置任意账号密码，迁移时遗漏）
-- ============================================
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

-- ============================================
-- 修复2：创建 change_my_password 函数
-- （用户自助修改密码，迁移时遗漏）
-- ============================================
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

-- ============================================
-- 修复3：创建 leaders 表的 RLS 策略
-- （组长名单查询，迁移时遗漏）
-- ============================================
-- 先确保 leaders 表开启了 RLS
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
-- 删除可能存在的旧策略
drop policy if exists "leaders_select" on leaders;
-- 创建新策略：登录用户可读
create policy "leaders_select" on leaders
  for select using (auth.role() = 'authenticated');

-- ============================================
-- 修复4：重新启用 users 表的 RLS
-- （之前测试登录时禁用了，安全检查已报警）
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 验证
-- ============================================
-- 检查函数是否创建成功
select proname from pg_proc where proname in ('admin_reset_password', 'change_my_password') order by proname;

-- 检查 RLS 策略
select tablename, policyname from pg_policies where schemaname = 'public' and tablename = 'leaders';

-- 检查各表 RLS 是否启用
select relname, relrowsecurity from pg_class where relname in ('users', 'leaders', 'group_data', 'class_data') order by relname;
