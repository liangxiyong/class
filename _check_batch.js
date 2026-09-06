const URL='https://zaeijgfuykhkabteqljw.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const H={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
(async()=>{
  const r=await fetch(URL+'/rest/v1/group_data?select=group_id,data',{headers:H});
  const rows=await r.json();
  let ok=0;
  for(const row of rows){
    const bo=row.data.baseOff||{};
    const hit=bo['2026-09-07']===true;
    if(hit)ok++;
    console.log('第'+row.group_id+'组 baseOff:', JSON.stringify(bo), hit?'✓':'（无 09-07）');
  }
  console.log('10组均含 2026-09-07:', ok===10);
})().catch(e=>console.log('ERR',e.message));
