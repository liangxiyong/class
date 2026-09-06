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
  if p_new_password is null or length(p_new_password) < 4 then
    raise exception '新密码至少4位';
  end if;
  select id into v_uid from auth.users where email = lower(p_email);
  if v_uid is null then
    raise exception '用户不存在';
  end if;
  update auth.users set encrypted_password = crypt(p_new_password, gen_salt('bf', 10)) where id = v_uid;
  return 'ok';
end $$;
grant execute on function public.admin_reset_password(text, text) to authenticated;


