const fs=require('fs');
// 从 class.html 提取 LZString 库
const html=fs.readFileSync('class.html','utf8');
const start=html.indexOf('var LZString=function(){');
const end=html.indexOf('}();"function"==typeof define', start);
if(start<0||end<0){console.log('LZString not found', start, end);process.exit(1);}
const lib=html.slice(start, end+4);
eval(lib);
const URL='https://zaeijgfuykhkabteqljw.supabase.co';
const KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const H={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
const BIN='6a9aa9dcda38895dfe38114c';
const MASTER='$2a$10$MG7YuUjozuFbJqmvDDYI9O.0EfUdXvhDdTHgjuB2INph2OjxvB3Pq';
function cloudDecode(remote){
  if(!remote)return null;
  if(remote.__lz===1){
    try{return JSON.parse(LZString.decompressFromBase64(remote.data));}catch(e){return null;}
  }
  return remote;
}
(async()=>{
  const jr=await fetch('https://api.jsonbin.io/v3/b/'+BIN+'/latest',{headers:{'X-Master-Key':MASTER}});
  console.log('jsonbin status:', jr.status);
  const jd=await jr.json();
  const remote=cloudDecode(jd.record||jd);
  if(!remote){console.log('decode failed, raw keys:', Object.keys(jd.record||jd).join(','));return;}
  console.log('decoded students:', remote.students?remote.students.length:'none', 'lastModified:', remote.lastModified);
  console.log('eyeRecords days:', Object.keys(remote.eyeRecords||{}).length, 'disRecords days:', Object.keys(remote.disRecords||{}).length);
  // 写入 Supabase
  const body={id:'class',data:remote,updated_at:new Date().toISOString()};
  const wr=await fetch(URL+'/rest/v1/class_data?on_conflict=id',{method:'POST',headers:Object.assign({},H,{Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(body)});
  console.log('supabase write status:', wr.status);
  // 读回验证
  const rr=await fetch(URL+'/rest/v1/class_data?id=eq.class&select=data',{headers:H});
  const rows=await rr.json();
  const back=rows&&rows.length?rows[0].data:null;
  const same=back&&back.students&&remote.students&&back.students.length===remote.students.length;
  console.log('readback students:', back?back.students.length:'none', '一致:', same);
  console.log('eye:', Object.keys((back||{}).eyeRecords||{}).length, 'dis:', Object.keys((back||{}).disRecords||{}).length);
})().catch(e=>console.log('ERR',e.message));
