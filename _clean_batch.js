const URL='https://zaeijgfuykhkabteqljw.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const H={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
(async()=>{
  const r=await fetch(URL+'/rest/v1/group_data?select=group_id,data',{headers:H});
  const rows=await r.json();
  let n=0;
  for(const row of rows){
    const d=row.data;
    if(d.baseOff&&d.baseOff['2026-09-07'])delete d.baseOff['2026-09-07'];
    if(Object.keys(d.baseOff||{}).length===0){delete d.baseOff;d.baseOff={};}
    delete d.lastModified;
    const body={group_id:row.group_id,group_name:row.data.groupName||('第'+row.group_id+'组'),data:d,updated_at:new Date().toISOString()};
    const w=await fetch(URL+'/rest/v1/group_data?on_conflict=group_id',{method:'POST',headers:Object.assign({},H,{Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(body)});
    if(w.status===200)n++;
  }
  console.log('已清理', n, '组');
  // 验证
  const r2=await fetch(URL+'/rest/v1/group_data?select=group_id,data',{headers:H});
  const rows2=await r2.json();
  let allClean=true;
  for(const row of rows2){
    const bo=row.data.baseOff||{};
    if(Object.keys(bo).length){allClean=false;console.log('残留:', row.group_id, JSON.stringify(bo));}
  }
  console.log('全部干净:', allClean);
})().catch(e=>console.log('ERR',e.message));
