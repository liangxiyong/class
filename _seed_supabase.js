/* Supabase 数据同步脚本：将 group.html 内置默认数据写入 Supabase */
const fs = require('fs');
const vm = require('vm');

const SUPABASE_URL = 'https://zaeijgfuykhkabteqljw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json'
};

function hashPwd(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'h' + h.toString(36);
}

const html = fs.readFileSync('group.html', 'utf8');

/* 从 group.html 提取常量块并求值 */
const seg = html.match(/const GROUP_NAMES=\{[\s\S]*?const LEADER_GROUP=\{[\s\S]*?\};/);
if (!seg) throw new Error('GROUP_NAMES/GROUP_MEMBERS/LEADER_GROUP 提取失败');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(seg[0] + '\n;this.__out={GROUP_NAMES,GROUP_MEMBERS,LEADER_GROUP};', ctx);
const { GROUP_NAMES, GROUP_MEMBERS, LEADER_GROUP } = ctx.__out;

const itemsSeg = html.match(/const DEFAULT_ITEMS = \[[\s\S]*?(?=\nconst DEFAULT_STATE)/);
if (!itemsSeg) throw new Error('DEFAULT_ITEMS 提取失败');
const ctx2 = {};
vm.createContext(ctx2);
vm.runInContext('const DEFAULT_ITEMS = ' + itemsSeg[0].replace(/^const DEFAULT_ITEMS = /, '') + '\n;this.__items=DEFAULT_ITEMS;', ctx2);
const DEFAULT_ITEMS = ctx2.__items;

console.log('组数:', Object.keys(GROUP_NAMES).length, '成员总数:', Object.values(GROUP_MEMBERS).reduce((a, v) => a + v.length, 0), '项目数:', DEFAULT_ITEMS.length);

async function sb(path, opts) {
  opts = opts || {};
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method: opts.method || 'GET',
    headers: Object.assign({}, HEADERS, opts.headers || {}),
    body: opts.body
  });
  const body = r.status === 204 ? null : await r.text();
  if (!r.ok) throw new Error(path + ' -> HTTP ' + r.status + ' ' + String(body).slice(0, 200));
  return body ? JSON.parse(body) : null;
}

(async () => {
  /* 1. group_data：10 组完整默认数据 */
  let okG = 0;
  for (const gid of Object.keys(GROUP_NAMES)) {
    const data = {
      version: 2,
      itemsVer: 3,
      groupName: GROUP_NAMES[gid],
      font: 'sans',
      students: GROUP_MEMBERS[gid].map((n, i) => ({ id: 'seed' + gid + '_' + (i + 1), name: n })),
      items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
      scores: {},
      notes: {},
      baseOff: {}
    };
    await sb('group_data?on_conflict=group_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ group_id: gid, group_name: GROUP_NAMES[gid], data, updated_at: new Date().toISOString() })
    });
    okG++;
    console.log('  group_data 第' + gid + '组 已写入 (' + data.students.length + ' 人)');
  }

  /* 2. leaders：组长名单 */
  let okL = 0;
  for (const [name, gid] of Object.entries(LEADER_GROUP)) {
    await sb('leaders?on_conflict=name', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ name, group_id: gid })
    });
    okL++;
  }
  console.log('leaders 已写入 ' + okL + ' 人');

  /* 3. users：账号（admin/admin2/teacher/组长），密码用 djb2 哈希 */
  const users = [
    { username: 'admin', password: hashPwd('19176164q'), role: 'admin', group_id: null },
    { username: 'admin2', password: hashPwd('123456'), role: 'admin2', group_id: null },
    { username: 'teacher', password: hashPwd('123456'), role: 'teacher', group_id: null }
  ];
  for (const [name, gid] of Object.entries(LEADER_GROUP)) {
    users.push({ username: name, password: hashPwd(gid), role: 'leader', group_id: gid });
  }
  let okU = 0;
  for (const u of users) {
    await sb('users?on_conflict=username', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(u)
    });
    okU++;
  }
  console.log('users 已写入 ' + okU + ' 个账号');

  console.log('全部完成：group_data=' + okG + '，leaders=' + okL + '，users=' + okU);
})().catch(e => { console.error('失败：', e.message); process.exit(1); });
