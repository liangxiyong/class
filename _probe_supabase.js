const URL='https://zaeijgfuykhkabteqljw.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const H={'apikey':KEY,'Authorization':'Bearer '+KEY};
(async()=>{
  for(const t of ['group_data','leaders','users']){
    try{
      const r=await fetch(URL+'/rest/v1/'+t+'?select=*&limit=5',{headers:H});
      const body=await r.text();
      console.log('['+t+'] status='+r.status+' body='+body.slice(0,300));
    }catch(e){console.log('['+t+'] ERR',e.message);}
  }
})().catch(e=>console.log('FATAL',e));
