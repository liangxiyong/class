-- 检查 RLS 启用状态与策略
select relname, relrowsecurity from pg_class
where relname in ('group_data','users','class_data','leaders');
select tablename, policyname, cmd, permissive, roles
from pg_policies
where tablename in ('group_data','users','class_data','leaders')
order by tablename, cmd;
