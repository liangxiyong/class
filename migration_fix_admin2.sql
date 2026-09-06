-- ============================================================
-- 迁移：修复 admin2 业务逻辑越权
-- 问题：admin2Enabled=false 时，前端禁止 admin2 进入，但 RLS 只查 role，API 层仍可读写 class_data
-- 修复：新增 is_admin2_enabled() 函数，class_data 策略对 admin2 增加开关检查
-- 执行方式：Supabase 控制台 → SQL Editor → 粘贴全部 → Run
-- ============================================================

-- 1. 创建函数（security definer 绕过 RLS，避免 class_data 策略循环依赖）
create or replace function public.is_admin2_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->>'admin2Enabled')::boolean from public.class_data where id='class'), true)
$$;

-- 2. 重建 class_data 四条策略
drop policy if exists "class_data_select" on class_data;
drop policy if exists "class_data_insert" on class_data;
drop policy if exists "class_data_update" on class_data;
drop policy if exists "class_data_delete" on class_data;

create policy "class_data_select" on class_data
  for select using (jfz_role() in ('admin','teacher') or (jfz_role()='admin2' and public.is_admin2_enabled()));

create policy "class_data_insert" on class_data
  for insert with check (jfz_role() in ('admin','teacher') or (jfz_role()='admin2' and public.is_admin2_enabled()));

create policy "class_data_update" on class_data
  for update using (jfz_role() in ('admin','teacher') or (jfz_role()='admin2' and public.is_admin2_enabled()))
  with check (jfz_role() in ('admin','teacher') or (jfz_role()='admin2' and public.is_admin2_enabled()));

create policy "class_data_delete" on class_data
  for delete using (jfz_role() in ('admin','teacher') or (jfz_role()='admin2' and public.is_admin2_enabled()));

-- 3. 验证（执行后可在 SQL Editor 运行以下查询确认策略已更新）
-- select policyname, permissive, roles, cmd, qual, with_check from pg_policies where tablename='class_data';
