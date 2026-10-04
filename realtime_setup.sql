-- ============================================
-- 小组积分系统 · Supabase 实时同步配置 SQL
-- 用途：开启 WebSocket Realtime 实时监听
-- 在 Supabase 控制台 → SQL Editor 中运行
-- ============================================

-- ============================================
-- 第1步：检查 WAL 级别（必须是 logical）
-- ============================================
show wal_level;
-- 预期结果：logical
-- 如果不是 logical，需要在 Supabase 后台 → Database → Replication 中开启


-- ============================================
-- 第2步：设置 REPLICA IDENTITY 为 FULL
-- （Realtime 需要完整的列信息来推送变更）
-- ============================================
ALTER TABLE public.group_data REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.class_data REPLICA IDENTITY FULL;
ALTER TABLE public.leaders REPLICA IDENTITY FULL;

-- 验证
SELECT relname, CASE relreplident
  WHEN 'd' THEN 'default(主键)'
  WHEN 'f' THEN 'full(全列)'
  WHEN 'i' THEN 'index'
  WHEN 'n' THEN 'nothing'
END as replica_identity
FROM pg_class
WHERE relname IN ('group_data', 'users', 'class_data', 'leaders')
ORDER BY relname;


-- ============================================
-- 第3步：将表加入 supabase_realtime publication
-- （这是 Realtime 监听的核心配置）
-- ============================================

-- 先检查当前 publication 中有哪些表
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- 将需要实时监听的表加入 publication
-- （如果表已在 publication 中会报错 "already member"，属正常现象，可忽略）
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaders;

-- 验证
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;


-- ============================================
-- 第4步：检查复制槽状态
-- ============================================
SELECT slot_name, plugin, slot_type, active, restart_lsn
FROM pg_replication_slots
WHERE slot_name LIKE '%realtime%'
ORDER BY slot_name;
-- 预期：有2个 active 的复制槽
--   supabase_realtime_messages_replication_slot_... (pgoutput)
--   supabase_realtime_replication_slot_... (wal2json)


-- ============================================
-- 第5步：检查 max_replication_slots
-- ============================================
show max_replication_slots;
-- 预期：至少 5（Supabase 默认就是5）


-- ============================================
-- 第6步：验证 RLS 策略（Realtime 受 RLS 约束）
-- ============================================
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('group_data', 'users', 'class_data', 'leaders')
ORDER BY tablename, cmd;

-- 注意：
-- - Realtime 推送的变更数据会经过 RLS 过滤
-- - 用户只能收到自己有权限查看的行的变更
-- - 如果 RLS 策略拒绝了某行，该用户不会收到该行的变更通知


-- ============================================
-- 第7步：完整诊断查询（一键检查所有配置）
-- ============================================
SELECT '=== WAL 级别 ===' as check_item, current_setting('wal_level') as value
UNION ALL
SELECT '=== max_replication_slots ===', current_setting('max_replication_slots')
UNION ALL
SELECT '=== Publication 表数量 ===', count(*)::text FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
UNION ALL
SELECT '=== 活跃复制槽数量 ===', count(*)::text FROM pg_replication_slots WHERE slot_name LIKE '%realtime%' AND active = true;


-- ============================================
-- 常见问题排查
-- ============================================

-- 问题1：WebSocket 连接挂起，无响应
-- 可能原因：
--   a. 表没有加入 supabase_realtime publication → 运行第3步
--   b. REPLICA IDENTITY 不是 FULL → 运行第2步
--   c. wal_level 不是 logical → 在 Supabase 后台开启
--   d. Supabase Realtime 服务端故障 → 查看 status.supabase.com

-- 问题2：能连接但收不到变更
-- 可能原因：
--   a. RLS 策略拒绝了当前用户 → 检查第6步
--   b. 用户没有登录（anon角色）→ 确保已登录
--   c. 监听的表名或 schema 不对 → 检查代码中的 channel 配置

-- 问题3：连接后立即断开
-- 可能原因：
--   a. 网络不稳定 → 检查网络
--   b. 浏览器扩展拦截 → 禁用扩展测试
--   c. 代理/VPN 干扰 → 关闭代理测试
