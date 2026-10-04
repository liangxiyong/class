-- ============================================================
-- 修复维护表RLS安全警告
-- 给所有维护表启用RLS，并设置只允许管理员/老师访问的策略
-- 注意：pg_cron以超级用户运行，不受RLS限制，所以不会影响维护系统
-- ============================================================

-- ============================================================
-- 1. 启用RLS
-- ============================================================
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keepalive_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. 删除已存在的策略（如果有）
-- ============================================================
DROP POLICY IF EXISTS "backups_select" ON public.backups;
DROP POLICY IF EXISTS "backups_insert" ON public.backups;
DROP POLICY IF EXISTS "backups_update" ON public.backups;
DROP POLICY IF EXISTS "backups_delete" ON public.backups;

DROP POLICY IF EXISTS "daily_snapshots_select" ON public.daily_snapshots;
DROP POLICY IF EXISTS "daily_snapshots_insert" ON public.daily_snapshots;
DROP POLICY IF EXISTS "daily_snapshots_update" ON public.daily_snapshots;
DROP POLICY IF EXISTS "daily_snapshots_delete" ON public.daily_snapshots;

DROP POLICY IF EXISTS "operation_logs_select" ON public.operation_logs;
DROP POLICY IF EXISTS "operation_logs_insert" ON public.operation_logs;
DROP POLICY IF EXISTS "operation_logs_update" ON public.operation_logs;
DROP POLICY IF EXISTS "operation_logs_delete" ON public.operation_logs;

DROP POLICY IF EXISTS "integrity_reports_select" ON public.integrity_reports;
DROP POLICY IF EXISTS "integrity_reports_insert" ON public.integrity_reports;
DROP POLICY IF EXISTS "integrity_reports_update" ON public.integrity_reports;
DROP POLICY IF EXISTS "integrity_reports_delete" ON public.integrity_reports;

DROP POLICY IF EXISTS "keepalive_logs_select" ON public.keepalive_logs;
DROP POLICY IF EXISTS "keepalive_logs_insert" ON public.keepalive_logs;
DROP POLICY IF EXISTS "keepalive_logs_update" ON public.keepalive_logs;
DROP POLICY IF EXISTS "keepalive_logs_delete" ON public.keepalive_logs;

DROP POLICY IF EXISTS "system_health_select" ON public.system_health;
DROP POLICY IF EXISTS "system_health_insert" ON public.system_health;
DROP POLICY IF EXISTS "system_health_update" ON public.system_health;
DROP POLICY IF EXISTS "system_health_delete" ON public.system_health;

-- ============================================================
-- 3. 创建策略：只允许管理员、老师、admin2访问
-- ============================================================

-- backups
CREATE POLICY "backups_select" ON public.backups
  FOR SELECT TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "backups_insert" ON public.backups
  FOR INSERT TO public
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "backups_update" ON public.backups
  FOR UPDATE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]))
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "backups_delete" ON public.backups
  FOR DELETE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

-- daily_snapshots
CREATE POLICY "daily_snapshots_select" ON public.daily_snapshots
  FOR SELECT TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "daily_snapshots_insert" ON public.daily_snapshots
  FOR INSERT TO public
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "daily_snapshots_update" ON public.daily_snapshots
  FOR UPDATE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]))
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "daily_snapshots_delete" ON public.daily_snapshots
  FOR DELETE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

-- operation_logs
CREATE POLICY "operation_logs_select" ON public.operation_logs
  FOR SELECT TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "operation_logs_insert" ON public.operation_logs
  FOR INSERT TO public
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "operation_logs_update" ON public.operation_logs
  FOR UPDATE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]))
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "operation_logs_delete" ON public.operation_logs
  FOR DELETE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

-- integrity_reports
CREATE POLICY "integrity_reports_select" ON public.integrity_reports
  FOR SELECT TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "integrity_reports_insert" ON public.integrity_reports
  FOR INSERT TO public
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "integrity_reports_update" ON public.integrity_reports
  FOR UPDATE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]))
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "integrity_reports_delete" ON public.integrity_reports
  FOR DELETE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

-- keepalive_logs
CREATE POLICY "keepalive_logs_select" ON public.keepalive_logs
  FOR SELECT TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "keepalive_logs_insert" ON public.keepalive_logs
  FOR INSERT TO public
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "keepalive_logs_update" ON public.keepalive_logs
  FOR UPDATE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]))
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "keepalive_logs_delete" ON public.keepalive_logs
  FOR DELETE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

-- system_health
CREATE POLICY "system_health_select" ON public.system_health
  FOR SELECT TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "system_health_insert" ON public.system_health
  FOR INSERT TO public
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "system_health_update" ON public.system_health
  FOR UPDATE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]))
  WITH CHECK (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

CREATE POLICY "system_health_delete" ON public.system_health
  FOR DELETE TO public
  USING (jfz_role() = ANY (ARRAY['admin'::text, 'teacher'::text, 'admin2'::text]));

-- ============================================================
-- 4. 验证结果
-- ============================================================
SELECT
  tablename,
  rowsecurity,
  (SELECT count(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE tablename IN ('backups', 'daily_snapshots', 'operation_logs', 'integrity_reports', 'keepalive_logs', 'system_health')
ORDER BY tablename;
