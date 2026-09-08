-- ============================================================
-- 小组积分系统 - 每日维护 SQL 脚本（v2）
-- 完整维护：每天北京时间 22:45（UTC 14:45）
-- 完整性检查：北京 22:45/00:45/02:45/04:45（UTC 14:45/16:45/18:45/20:45）
-- 保活：每小时一次
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

-- ============================================================
-- 2. 完整性检查函数（每晚调用 3-4 次）
-- ============================================================
create or replace function run_integrity_check()
returns void as $$
declare
  g record;
  student record;
  score_date text;
  student_id text;
begin
  for g in select group_id, group_name, data from group_data loop
    -- 检查学生名字是否有问号污染
    if g.data ? 'students' then
      for student in select value from jsonb_array_elements(g.data->'students') loop
        if student.value->>'name' like '%?%' or student.value->>'name' like '%？%' then
          insert into integrity_reports(group_id, issue_type, issue_detail)
          values (g.group_id, 'question_mark_pollution',
            '学生 id=' || (student.value->>'id') || ' 名字被污染: ' || (student.value->>'name'));
        end if;
        if student.value->>'name' is null or student.value->>'name' = '' then
          insert into integrity_reports(group_id, issue_type, issue_detail)
          values (g.group_id, 'empty_name',
            '学生 id=' || (student.value->>'id') || ' 名字为空');
        end if;
      end loop;
    end if;

    -- 检查分数记录里的学生 id 是否在学生名单中
    if g.data ? 'scores' and g.data ? 'students' then
      for score_date in select jsonb_object_keys(g.data->'scores') loop
        for student_id in select jsonb_object_keys(g.data->'scores'->score_date) loop
          if not exists (
            select 1 from jsonb_array_elements(g.data->'students') s
            where s->>'id' = student_id
          ) then
            insert into integrity_reports(group_id, issue_type, issue_detail)
            values (g.group_id, 'orphan_score',
              '日期 ' || score_date || ' 有分数记录但学生 id=' || student_id || ' 不在名单中');
          end if;
        end loop;
      end loop;
    end if;

    -- 检查 lastModified 是否存在
    if g.data->>'lastModified' is null then
      insert into integrity_reports(group_id, issue_type, issue_detail)
      values (g.group_id, 'missing_lastModified', '该组数据缺少 lastModified 字段');
    end if;
  end loop;
end;
$$ language plpgsql;

-- ============================================================
-- 3. 完整维护函数（每天 22:45 一次）
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
begin
  -- 清空今天的完整性报告（完整维护时重新生成）
  delete from integrity_reports where report_date = current_date;

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
              if score_date = to_char(current_date, 'YYYY-MM-DD') then
                sname := null;
                select s->>'name' into sname
                from jsonb_array_elements(g.data->'students') s
                where s->>'id' = student_id limit 1;

                insert into operation_logs(log_date, group_id, student_id, student_name,
                  item_id, score_value, label, by_user, ts)
                values (current_date, g.group_id, student_id, sname,
                  item_id, (rec.value->>'v')::numeric, rec.value->>'label', rec.value->>'by', (rec.value->>'ts')::bigint);
              end if;
            end loop;
          end loop;
        end loop;
      end loop;
    end if;

    -- 插入每日快照
    insert into daily_snapshots(snapshot_date, group_id, group_name, student_count, total_score, avg_score)
    values (current_date, g.group_id, g.group_name,
      coalesce(jsonb_array_length(g.data->'students'), 0),
      total,
      case when cnt > 0 then round(total / cnt, 2) else 0 end)
    on conflict (snapshot_date, group_id) do update set
      group_name = excluded.group_name,
      student_count = excluded.student_count,
      total_score = excluded.total_score,
      avg_score = excluded.avg_score;
  end loop;

  -- ---------- 3. 完整性检查 ----------
  perform run_integrity_check();

  -- ---------- 4. 清理旧数据 ----------
  delete from backups where created_at < now() - interval '30 days';
  delete from operation_logs where log_date < current_date - interval '30 days';
  delete from integrity_reports where report_date < current_date - interval '30 days';
  delete from daily_snapshots where snapshot_date < current_date - interval '90 days';
  delete from keepalive_logs where checked_at < now() - interval '7 days';
end;
$$ language plpgsql;

-- ============================================================
-- 4. 保活函数（每天凌晨2点一次，防止 Supabase 空闲暂停）
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
-- 5. 创建 pg_cron 定时任务
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

-- 任务1：完整维护 - 每天 UTC 16:10（北京 0:10），维护时段0:00-0:30内执行
select cron.schedule('daily-maintenance', '10 16 * * *', 'select run_daily_maintenance();');

-- 任务2：完整性检查 - 维护期间执行两次：北京 0:15（UTC16:15）、0:20（UTC16:20）
select cron.schedule('integrity-check', '15,20 16 * * *', 'select run_integrity_check();');

-- 任务3：保活 - 维护期间执行：北京 0:12（UTC16:12）
select cron.schedule('keepalive', '12 16 * * *', 'select keepalive();');

-- ============================================================
-- 6. 验证
-- ============================================================
select '维护系统已部署完成' as status;
select jobname, schedule, command, active from cron.job order by jobname;
