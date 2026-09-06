const URL='https://zaeijgfuykhkabteqljw.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const H={'apikey':KEY,'Authorization':'Bearer '+KEY};
(async()=>{
  const r=await fetch(URL+'/rest/v1/group_data?group_id=eq.1&select=group_id,data',{headers:H});
  const rows=await r.json();
  const d=rows[0].data;
  console.log('第1组 baseOff:', JSON.stringify(d.baseOff));
  console.log('lastModified:', d.lastModified, '| 成员:', d.students.length, '| 项目:', d.items.length);
})().catch(e=>console.log('ERR',e.message));
