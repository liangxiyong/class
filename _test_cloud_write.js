const URL='https://zaeijgfuykhkabteqljw.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const H={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
async function get(path){const r=await fetch(URL+'/rest/v1/'+path,{headers:H});if(!r.ok)throw new Error('GET '+r.status+' '+await r.text());return r.json();}
async function post(path,body,prefer){const r=await fetch(URL+'/rest/v1/'+path,{method:'POST',headers:Object.assign({},H,{Prefer:prefer}),body:JSON.stringify(body)});if(!r.ok)throw new Error('POST '+r.status+' '+await r.text());return r.text();}
(async()=>{
  // 1. 读取第1组
  const rows=await get('group_data?group_id=eq.1&select=group_id,group_name,data');
  const row=rows[0];
  console.log('读取第1组:', row.group_name, '| data 版本:', row.data.version, '| 成员:', row.data.students.length);
  console.log('当前 baseOff:', JSON.stringify(row.data.baseOff));
  // 2. 模拟 toggleBase：加 2026-09-07
  row.data.baseOff['2026-09-07']=true;
  const body={group_id:'1',group_name:row.group_name,data:row.data,updated_at:new Date().toISOString()};
  await post('group_data?on_conflict=group_id',body,'resolution=merge-duplicates,return=minimal');
  console.log('UPSERT 写入成功');
  // 3. 读回验证
  const rows2=await get('group_data?group_id=eq.1&select=data');
  console.log('读回 baseOff:', JSON.stringify(rows2[0].data.baseOff));
  console.log('2026-09-07 =', rows2[0].data.baseOff['2026-09-07'], '| 成员数:', rows2[0].data.students.length);
})().catch(e=>console.log('ERR:', e.message));
