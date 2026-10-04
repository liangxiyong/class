-- ============================================
-- 登录日志表 login_logs
-- 记录每次登录的用户、IP、地理位置、时间等
-- ============================================

-- 建表
CREATE TABLE IF NOT EXISTS public.login_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_email TEXT NOT NULL,
  username TEXT,
  role TEXT,
  group_id INTEGER,
  ip TEXT NOT NULL,
  country TEXT,
  province TEXT,
  city TEXT,
  district TEXT,
  adcode TEXT,
  rectangle TEXT,
  user_agent TEXT,
  login_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT true,
  fail_reason TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_login_logs_user_email ON public.login_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_at ON public.login_logs(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_ip ON public.login_logs(ip);
CREATE INDEX IF NOT EXISTS idx_login_logs_city ON public.login_logs(city);

-- 启用 RLS
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- admin 可以查看全部记录
DROP POLICY IF EXISTS "admin_read_all" ON public.login_logs;
CREATE POLICY "admin_read_all" ON public.login_logs
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'admin');

-- 普通用户只能查看自己的记录
DROP POLICY IF EXISTS "user_read_own" ON public.login_logs;
CREATE POLICY "user_read_own" ON public.login_logs
  FOR SELECT
  USING (user_email = auth.jwt() ->> 'email');

-- 已认证用户可以插入（记录登录日志）
DROP POLICY IF EXISTS "auth_insert" ON public.login_logs;
CREATE POLICY "auth_insert" ON public.login_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
