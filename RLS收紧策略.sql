-- RLS 策略收紧（v3 按组隔离 + jfz_role/jfz_group 查 users 表）
-- 执行本段后：组长只能读写自己组；admin/teacher 全权；admin2 仅第1组+班级数据
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

drop policy if exists "leaders_all" on leaders;
drop policy if exists "leaders_select" on leaders;
create policy "leaders_select" on leaders
  for select using (auth.role() = 'authenticated');

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
