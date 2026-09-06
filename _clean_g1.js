const URL='https://zaeijgfuykhkabteqljw.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const H={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
(async()=>{
  // 清理第1组测试残留：baseOff 清空、移除 lastModified
  const r=await fetch(URL+'/rest/v1/group_data?group_id=eq.1&select=data',{headers:H});
  const rows=await r.json();
  const d=rows[0].data;
  d.baseOff={};
  delete d.lastModified;
  const body={group_id:'1',group_name:'第一组',data:d,updated_at:new Date().toISOString()};
  const w=await fetch(URL+'/rest/v1/group_data?on_conflict=group_id',{method:'POST',headers:Object.assign({},H,{Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(body)});
  console.log('清理写入:', w.status);
  // 读回确认
  const r2=await fetch(URL+'/rest/v1/group_data?group_id=eq.1&select=data',{headers:H});
  const rows2=await r2.json();
  console.log('第1组 baseOff:', JSON.stringify(rows2[0].data.baseOff), '| lastModified:', rows2[0].data.lastModified);
})().catch(e=>console.log('ERR',e.message));
