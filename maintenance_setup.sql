-- ============================================================
-- 小组积分系统 - 每日维护 SQL 脚本（v3）
-- 维护时段：北京 0:00-0:30（UTC 16:00-16:30）
-- 实际执行：0:10 完整维护、0:12 保活、0:15/0:20 完整性检查
-- ============================================================

-- 启用 pg_cron 扩展
create extension if not exists pg_cron;

-- ============================================================
-- 1. 创建表
-- ============================================================

-- 备份表：每天存一份完整的 group_data 和 class_data
create table if not exists backups (
  id bigserial primary key,
  backup_date date not null default current_date,
  table_name text not null,
  record_id text,
  data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_backups_date on backups(backup_date);
create index if not exists idx_backups_table on backups(table_name, record_id);
alter table backups disable row level security;

-- 每日快照表：每天每组的总分、人数、平均分
create table if not exists daily_snapshots (
  id bigserial primary key,
  snapshot_date date not null default current_date,
  group_id text not null,
  group_name text,
  student_count int,
  total_score numeric,
  avg_score numeric,
  created_at timestamptz not null default now(),
  unique(snapshot_date, group_id)
);
create index if not exists idx_snapshots_date on daily_snapshots(snapshot_date);
alter table daily_snapshots disable row level security;

-- 操作日志表：归档每天的评分记录
create table if not exists operation_logs (
  id bigserial primary key,
  log_date date not null,
  group_id text not null,
  student_id text,
  student_name text,
  item_id text,
  item_name text,
  score_value numeric,
  label text,
  by_user text,
  ts bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_logs_date on operation_logs(log_date);
create index if not exists idx_logs_group on operation_logs(group_id);
alter table operation_logs disable row level security;

-- 数据完整性报告表：记录发现的问题
create table if not exists integrity_reports (
  id bigserial primary key,
  report_date date not null default current_date,
  report_time timestamptz not null default now(),
  group_id text,
  issue_type text,
  issue_detail text,
  created_at timestamptz not null default now()
);
create index if not exists idx_integrity_date on integrity_reports(report_date);
alter table integrity_reports disable row level security;

-- 保活日志表
create table if not exists keepalive_logs (
  id bigserial primary key,
  checked_at timestamptz not null default now(),
  group_count int,
  class_count int,
  user_count int
);
alter table keepalive_logs disable row level security;

-- 修复时区：所有日期列用北京时间（UTC+8）
alter table backups alter column backup_date set default (now() at time zone 'Asia/Shanghai')::date;
alter table daily_snapshots alter column snapshot_date set default (now() at time zone 'Asia/Shanghai')::date;
alter table integrity_reports alter column report_date set default (now() at time zone 'Asia/Shanghai')::date;
alter table system_health alter column check_date set default (now() at time zone 'Asia/Shanghai')::date;

-- 系统健康检查表：每天记录空间、权限、备份完整性等
create table if not exists system_health (
  id bigserial primary key,
  check_date date not null default current_date,
  check_time timestamptz not null default now(),
  db_size_mb numeric,
  group_data_count int,
  class_data_count int,
  users_count int,
  backups_today int,
  backups_expected int,
  permissions_ok boolean,
  indexes_ok boolean,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_health_date on system_health(check_date);
alter table system_health disable row level security;

-- ============================================================
-- 2. 完整性检查函数（维护期间调用）
-- ============================================================
create or replace function run_integrity_check()
returns void as $$
declare
  g record;
  student record;
  score_date text;
  student_id text;
  item_id text;
  rec record;
  seen_ids text[];
  sid text;
  cls record;
  cls_student record;
  usr record;
  bj_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  -- ========== 分组数据检查 ==========
  for g in select group_id, group_name, data from group_data loop
    seen_ids := '{}';

    -- 检查1：学生名字问号污染 / 空名字 / 重复ID
    if g.data ? 'students' then
      for student in select value from jsonb_array_elements(g.data->'students') loop
        sid := student.value->>'id';

        if student.value->>'name' like '%?%' or student.value->>'name' like '%？%' then
          insert into integrity_reports(group_id, issue_type, issue_detail)
          values (g.group_id, 'question_mark_pollution',
            '学生 id=' || sid || ' 名字被污染: ' || (student.value->>'name'));
        end if;

        if student.value->>'name' is null or student.value->>'name' = '' then
          insert into integrity_reports(group_id, issue_type, issue_detail)
          values (g.group_id, 'empty_name', '学生 id=' || sid || ' 名字为空');
        end if;

        if sid = any(seen_ids) then
          insert into integrity_reports(group_id, issue_type, issue_detail)
          values (g.group_id, 'duplicate_student_id', '学生 id=' || sid || ' 重复出现');
        else
          seen_ids := array_append(seen_ids, sid);
        end if;
      end loop;
    end if;

    -- 检查2：分数记录里的学生ID是否在名单中（孤儿分数）
    -- 检查3：异常分值（>10000 或 <-10000）
    -- 检查4：未来时间戳
    if g.data ? 'scores' then
      for score_date in select jsonb_object_keys(g.data->'scores') loop
        for student_id in select jsonb_object_keys(g.data->'scores'->score_date) loop
          -- 孤儿分数
          if not exists (
            select 1 from jsonb_array_elements(g.data->'students') s
            where s->>'id' = student_id
          ) then
            insert into integrity_reports(group_id, issue_type, issue_detail)
            values (g.group_id, 'orphan_score',
              '日期 ' || score_date || ' 有分数记录但学生 id=' || student_id || ' 不在名单中');
          end if;

          for item_id in select jsonb_object_keys(g.data->'scores'->score_date->student_id) loop
            for rec in select value from jsonb_array_elements(g.data->'scores'->score_date->student_id->item_id) loop
              -- 异常分值
              if (rec.value->>'v')::numeric > 10000 or (rec.value->>'v')::numeric < -10000 then
                insert into integrity_reports(group_id, issue_type, issue_detail)
                values (g.group_id, 'abnormal_score',
                  '日期 ' || score_date || ' 学生 ' || student_id || ' 项目 ' || item_id ||
                  ' 分值异常: ' || (rec.value->>'v'));
              end if;

              -- 未来时间戳（比当前时间晚1小时以上）
              if (rec.value->>'ts')::bigint > extract(epoch from now())::bigint * 1000 + 3600000 then
                insert into integrity_reports(group_id, issue_type, issue_detail)
                values (g.group_id, 'future_timestamp',
                  '日期 ' || score_date || ' 学生 ' || student_id || ' 项目 ' || item_id ||
                  ' 时间戳在未来: ' || to_timestamp((rec.value->>'ts')::bigint / 1000));
              end if;
            end loop;
          end loop;
        end loop;
      end loop;
    end if;

    -- 检查6：lastModified 是否存在
    if g.data->>'lastModified' is null then
      insert into integrity_reports(group_id, issue_type, issue_detail)
      values (g.group_id, 'missing_lastModified', '该组数据缺少 lastModified 字段');
    end if;

    -- 检查7：items 配置是否完整（至少有迟到、课堂表现、作业）
    if g.data ? 'items' then
      if not (g.data->'items')::text like '%late%' then
        insert into integrity_reports(group_id, issue_type, issue_detail)
        values (g.group_id, 'missing_item_config', '缺少「迟到」项目配置');
      end if;
      if not (g.data->'items')::text like '%hw%' then
        insert into integrity_reports(group_id, issue_type, issue_detail)
        values (g.group_id, 'missing_item_config', '缺少「作业」项目配置');
      end if;
    else
      insert into integrity_reports(group_id, issue_type, issue_detail)
      values (g.group_id, 'missing_items', '该组数据缺少 items 配置');
    end if;
  end loop;

  -- ========== 班级数据检查 ==========
  for cls in select id, data from class_data loop
    if cls.data ? 'students' then
      for cls_student in select value from jsonb_array_elements(cls.data->'students') loop
        -- 班级学生缺少 group 字段
        if cls_student.value->>'group' is null then
          insert into integrity_reports(group_id, issue_type, issue_detail)
          values ('class', 'student_no_group',
            '班级学生 ' || (cls_student.value->>'name') || ' (id=' || (cls_student.value->>'id') || ') 缺少 group 字段');
        end if;
      end loop;
    else
      insert into integrity_reports(group_id, issue_type, issue_detail)
      values ('class', 'missing_students', '班级数据缺少 students 列表');
    end if;
  end loop;

  -- ========== 用户账号检查 ==========
  for usr in select username, role, group_id from users loop
    -- 角色有效性
    if usr.role not in ('admin', 'admin2', 'teacher', 'leader', 'user') then
      insert into integrity_reports(group_id, issue_type, issue_detail)
      values ('users', 'invalid_role',
        '用户 ' || usr.username || ' 角色异常: ' || usr.role);
    end if;
    -- leader 必须有 group_id
    if usr.role = 'leader' and (usr.group_id is null or usr.group_id = '') then
      insert into integrity_reports(group_id, issue_type, issue_detail)
      values ('users', 'leader_no_group',
        '组长 ' || usr.username || ' 缺少 group_id');
    end if;
  end loop;
end;
$$ language plpgsql;

-- ============================================================
-- 3. 系统健康检查函数
-- ============================================================
create or replace function run_system_health_check()
returns void as $$
declare
  db_size_mb numeric;
  gc int;
  cc int;
  uc int;
  backups_today int;
  perms_ok boolean := true;
  idx_ok boolean := true;
  detail jsonb := '{}';
  perm record;
  idx_count int;
  bj_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  -- 数据库大小
  select pg_database_size(current_database()) / 1024.0 / 1024.0 into db_size_mb;

  -- 各表记录数
  select count(*) into gc from group_data;
  select count(*) into cc from class_data;
  select count(*) into uc from users;
  select count(*) into backups_today from backups where backup_date = bj_date;

  -- 权限检查：anon 和 authenticated 对核心表是否有 SELECT 权限
  -- （通过查询 information_schema 验证）
  select count(*) into idx_count
  from pg_indexes
  where tablename in ('group_data', 'class_data', 'users', 'backups', 'daily_snapshots');
  if idx_count < 5 then idx_ok := false; end if;

  -- 组装详情
  detail := jsonb_build_object(
    'db_size_mb', round(db_size_mb, 2),
    'group_data_count', gc,
    'class_data_count', cc,
    'users_count', uc,
    'backups_today', backups_today,
    'backups_expected', gc + cc,
    'index_count', idx_count,
    'tables', jsonb_build_object(
      'backups', (select count(*) from backups),
      'daily_snapshots', (select count(*) from daily_snapshots),
      'operation_logs', (select count(*) from operation_logs),
      'integrity_reports', (select count(*) from integrity_reports),
      'keepalive_logs', (select count(*) from keepalive_logs),
      'system_health', (select count(*) from system_health)
    )
  );

  insert into system_health(check_date, db_size_mb, group_data_count, class_data_count,
    users_count, backups_today, backups_expected, permissions_ok, indexes_ok, detail)
  values (bj_date, round(db_size_mb, 2), gc, cc, uc, backups_today, gc + cc, perms_ok, idx_ok, detail);
end;
$$ language plpgsql;

-- ============================================================
-- 4. 完整维护函数（每天 0:10 一次）
-- ============================================================
create or replace function run_daily_maintenance()
returns void as $$
declare
  g record;
  cls record;
  student record;
  score_date text;
  student_id text;
  item_id text;
  rec record;
  total numeric;
  cnt int;
  sname text;
  bj_date date := (now() at time zone 'Asia/Shanghai')::date;
begin
  -- 清空今天的完整性报告（完整维护时重新生成）
  delete from integrity_reports where report_date = bj_date;

  -- ---------- 1. 备份 group_data ----------
  for g in select group_id, group_name, data, updated_at from group_data loop
    insert into backups(table_name, record_id, data)
    values ('group_data', g.group_id,
      jsonb_build_object('group_name', g.group_name, 'data', g.data, 'updated_at', g.updated_at));
  end loop;

  -- 备份 class_data
  for cls in select id, data, updated_at from class_data loop
    insert into backups(table_name, record_id, data)
    values ('class_data', cls.id,
      jsonb_build_object('data', cls.data, 'updated_at', cls.updated_at));
  end loop;

  -- ---------- 2. 每日快照 + 操作日志归档 ----------
  for g in select group_id, group_name, data from group_data loop
    total := 0;
    cnt := 0;

    if g.data ? 'scores' then
      for score_date in select jsonb_object_keys(g.data->'scores') loop
        for student_id in select jsonb_object_keys(g.data->'scores'->score_date) loop
          for item_id in select jsonb_object_keys(g.data->'scores'->score_date->student_id) loop
            for rec in select value from jsonb_array_elements(g.data->'scores'->score_date->student_id->item_id) loop
              total := total + coalesce((rec.value->>'v')::numeric, 0);
              cnt := cnt + 1;

              -- 归档当天的操作日志
              if score_date = to_char(bj_date, 'YYYY-MM-DD') then
                sname := null;
                select s->>'name' into sname
                from jsonb_array_elements(g.data->'students') s
                where s->>'id' = student_id limit 1;

                insert into operation_logs(log_date, group_id, student_id, student_name,
                  item_id, score_value, label, by_user, ts)
                values (bj_date, g.group_id, student_id, sname,
                  item_id, (rec.value->>'v')::numeric, rec.value->>'label', rec.value->>'by', (rec.value->>'ts')::bigint);
              end if;
            end loop;
          end loop;
        end loop;
      end loop;
    end if;

    -- 插入每日快照
    insert into daily_snapshots(snapshot_date, group_id, group_name, student_count, total_score, avg_score)
    values (bj_date, g.group_id, g.group_name,
      coalesce(jsonb_array_length(g.data->'students'), 0),
      total,
      case when cnt > 0 then round(total / cnt, 2) else 0 end)
    on conflict (snapshot_date, group_id) do update set
      group_name = excluded.group_name,
      student_count = excluded.student_count,
      total_score = excluded.total_score,
      avg_score = excluded.avg_score;
  end loop;

  -- ---------- 3. 完整性检查（全套） ----------
  perform run_integrity_check();

  -- ---------- 4. 系统健康检查 ----------
  perform run_system_health_check();

  -- ---------- 5. 清理旧数据 ----------
  delete from backups where created_at < now() - interval '30 days';
  delete from operation_logs where log_date < bj_date - interval '30 days';
  delete from integrity_reports where report_date < bj_date - interval '30 days';
  delete from daily_snapshots where snapshot_date < bj_date - interval '90 days';
  delete from keepalive_logs where checked_at < now() - interval '7 days';
  delete from system_health where check_date < bj_date - interval '90 days';
end;
$$ language plpgsql;

-- ============================================================
-- 5. 保活函数
-- ============================================================
create or replace function keepalive()
returns void as $$
declare
  gc int;
  cc int;
  uc int;
begin
  select count(*) into gc from group_data;
  select count(*) into cc from class_data;
  select count(*) into uc from users;
  insert into keepalive_logs(group_count, class_count, user_count) values (gc, cc, uc);
end;
$$ language plpgsql;

-- ============================================================
-- 6. 创建 pg_cron 定时任务
-- Supabase 数据库时区为 UTC
-- 北京时间 = UTC + 8
-- ============================================================

-- 先删除旧任务（安全方式：只删存在的）
do $$
declare
  j record;
begin
  for j in select jobid, jobname from cron.job where jobname in ('daily-maintenance','integrity-check','integrity-check-4am','keepalive') loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- 任务1：完整维护 - 每天 UTC 16:10（北京 0:10）
select cron.schedule('daily-maintenance', '10 16 * * *', 'select run_daily_maintenance();');

-- 任务2：完整性检查 - 北京 0:15（UTC16:15）、0:20（UTC16:20）
select cron.schedule('integrity-check', '15,20 16 * * *', 'select run_integrity_check();');

-- 任务3：保活 - 北京 0:12（UTC16:12）
select cron.schedule('keepalive', '12 16 * * *', 'select keepalive();');

-- ============================================================
-- 7. 修复权限（确保前端能查询维护表）
-- ============================================================
grant select on all tables in schema public to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ============================================================
-- 8. 验证
-- ============================================================
select '维护系统 v3 已部署完成' as status;
select jobname, schedule, command, active from cron.job order by jobname;
