
// 临时维护提示
const MAINT_DATE='2026-09-21';
function isMaintTime(){
  const d=new Date();
  const dateStr=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(dateStr!==MAINT_DATE) return false;
  const now=d.getHours()*60+d.getMinutes();
  return now>=22*60+50;
}
function isMaintNotice(){
  const d=new Date();
  const dateStr=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  if(dateStr!==MAINT_DATE) return false;
  const now=d.getHours()*60+d.getMinutes();
  return now>=22*60 && now<22*60+50;
}
// 页面加载时检查维护状态
if(isMaintTime()){
  document.body.innerHTML='<div style="padding:40px;text-align:center;font-size:18px;">系统维护中，请明天再试</div>';
}else if(isMaintNotice()){
  document.getElementById('maintBanner').style.display='block';
}
/* ================= LZString 压缩库 ================= */
var LZString=function(){var r=String.fromCharCode,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",e={};function t(r,o){if(!e[r]){e[r]={};for(var n=0;n<r.length;n++)e[r][r.charAt(n)]=n}return e[r][o]}var i={compressToBase64:function(r){if(null==r)return"";var n=i._compress(r,6,function(r){return o.charAt(r)});switch(n.length%4){default:case 0:return n;case 1:return n+"===";case 2:return n+"==";case 3:return n+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(n){return t(o,r.charAt(n))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(r){return null==r?"":""==r?null:i._decompress(r.length,16384,function(o){return r.charCodeAt(o)-32})},compressToUint8Array:function(r){for(var o=i.compress(r),n=new Uint8Array(2*o.length),e=0,t=o.length;e<t;e++){var s=o.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null==o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;e<t;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(r){return null==r?"":i._compress(r,6,function(r){return n.charAt(r)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(o){return t(n,r.charAt(o))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(r,o,n){if(null==r)return"";var e,t,i,s={},u={},a="",p="",c="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<r.length;i+=1)if(a=r.charAt(i),Object.prototype.hasOwnProperty.call(s,a)||(s[a]=f++,u[a]=!0),p=c+a,Object.prototype.hasOwnProperty.call(s,p))c=p;else{if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++),s[p]=f++,c=String(a)}if(""!==c){if(Object.prototype.hasOwnProperty.call(u,c)){if(c.charCodeAt(0)<256){for(e=0;e<h;e++)m<<=1,v==o-1?(v=0,d.push(n(m)),m=0):v++;for(t=c.charCodeAt(0),e=0;e<8;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;e<h;e++)m=m<<1|t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=c.charCodeAt(0),e=0;e<16;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}0==--l&&(l=Math.pow(2,h),h++),delete u[c]}else for(t=s[c],e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;0==--l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;e<h;e++)m=m<<1|1&t,v==o-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==o-1){d.push(n(m));break}v++}return d.join("")},decompress:function(r){return null==r?"":""==r?null:i._decompress(r.length,32768,function(o){return r.charCodeAt(o)})},_decompress:function(o,n,e){var t,i,s,u,a,p,c,l=[],f=4,h=4,d=3,m="",v=[],g={val:e(0),position:n,index:1};for(t=0;t<3;t+=1)l[t]=t;for(s=0,a=Math.pow(2,2),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;c=r(s);break;case 2:return""}for(l[3]=c,i=c,v.push(c);;){if(g.index>o)return"";for(s=0,a=Math.pow(2,d),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;switch(c=s){case 0:for(s=0,a=Math.pow(2,8),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 1:for(s=0,a=Math.pow(2,16),p=1;p!=a;)u=g.val&g.position,g.position>>=1,0==g.position&&(g.position=n,g.val=e(g.index++)),s|=(u>0?1:0)*p,p<<=1;l[h++]=r(s),c=h-1,f--;break;case 2:return v.join("")}if(0==f&&(f=Math.pow(2,d),d++),l[c])m=l[c];else{if(c!==h)return null;m=i+i.charAt(0)}v.push(m),l[h++]=i+m.charAt(0),i=m,0==--f&&(f=Math.pow(2,d),d++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module?module.exports=LZString:"undefined"!=typeof angular&&null!=angular&&angular.module("LZString",[]).factory("LZString",function(){return LZString});
/* ================= 状态 ================= */
const KEY = 'jfz_state_v3';
const DEFAULT_ITEMS = [
  {id:'late', name:'迟到', presets:[
    {label:'晨检迟到', value:-4},{label:'预备铃迟到', value:-2},
    {label:'上课迟到', value:-4},{label:'旷课', value:-8}]},
  {id:'class', name:'课堂表现', presets:[
    {label:'点名回答', value:1},{label:'主动回答', value:2},
    {label:'睡觉', value:-6},{label:'说话', value:-4},{label:'吃东西', value:-20}]},
  {id:'study', name:'自习', presets:[
    {label:'睡觉', value:-6},{label:'说话', value:-4}]},
  {id:'notes', name:'笔记', presets:[
    {label:'卓越', value:4},{label:'优秀', value:2},
    {label:'不写', value:-6},{label:'不完整', value:-2}]},
  {id:'hw', name:'作业', presets:[
    {label:'卓越', value:4},{label:'优秀', value:2},
    {label:'不写', value:-6},{label:'不全', value:-4},{label:'不订正', value:-2}]},
  {id:'break', name:'课间纪律', presets:[
    {label:'骂人', value:-10},{label:'打架', value:-20},{label:'下湖', value:-50}]},
  {id:'duty', name:'值日', presets:[
    {label:'不值日', value:-20},{label:'乱扔垃圾', value:-4}]},
  {id:'exercise', name:'课间操', presets:[
    {label:'逃操', value:-20},{label:'说话', value:-6},{label:'掉队', value:-4}]},
  {id:'eye', name:'眼保健操', default:2, presets:[
    {label:'优秀', value:2},{label:'不做操', value:-4},{label:'不认真', value:-2}]},
  {id:'appearance', name:'仪容仪表', presets:[
    {label:'没戴红领巾', value:-4},{label:'发型不合适', value:-10},{label:'戴首饰', value:-10}]},
  {id:'pass', name:'过关练习', presets:[
    {label:'卓越', value:4},{label:'优秀', value:2},
    {label:'不合格', value:-2},{label:'没完成', value:-4}]},
  {id:'week', name:'周反馈', presets:[
    {label:'第1名', value:6},{label:'第2名', value:4},{label:'第3名', value:2},
    {label:'100分', value:6},{label:'90分以上', value:4},{label:'85分以上', value:2},
    {label:'不及格', value:-4},
    {label:'倒数第3名', value:-2},{label:'倒数第2名', value:-4},{label:'倒数第1名', value:-6}]},
  {id:'month', name:'月反馈', formula:{expr:'47-N', minN:41, tiers:{42:-2,43:-4,44:-6,45:-8,46:-10}}, weights:[
    {id:'xw1', label:'馨菱1', pct:10, group:'xw'},
    {id:'xw2', label:'馨菱2', pct:5, group:'xw'},
    {id:'top20', label:'年级前20', pct:5, group:'top'}], presets:[
    {label:'倒数第5名', value:-2},{label:'倒数第4名', value:-4},
    {label:'倒数第3名', value:-6},{label:'倒数第2名', value:-8},
    {label:'倒数第1名', value:-10},{label:'不及格', value:-6}]},
  {id:'good', name:'好人好事', presets:[
    {label:'一般', value:2}]}
];
const DEFAULT_STATE = {
  version:2, itemsVer:3, groupName:'', font:'sans', students:[], items:DEFAULT_ITEMS, scores:{}, notes:{}, baseOff:{}
};

/* ================= Supabase 多组配置 ================= */
const SUPABASE_URL='https://zaeijgfuykhkabteqljw.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZWlqZ2Z1eWtoa2FidGVxbGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1ODA5MzgsImV4cCI6MjEwNDE1NjkzOH0.CQ-jqsslzaWpeeXg0OJnQsaW-iMNoCKbJGW_-p1F3D8';
const SB=window.supabase?window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{
  realtime:{
    reconnectAfterMs:function(tries){
      const backoff=[3000,5000,10000,30000,60000];
      return backoff[Math.min(tries-1,backoff.length-1)];
    }
  }
}):null;
let sbAccessToken='';
async function ensureSbToken(){
  if(!SB){requireLogin();return '';}
  try{
    // 每次都取会话：SDK 会自行刷新过期 token，避免缓存旧 token 导致云端请求 401
    const {data}=await SB.auth.getSession();
    if(data&&data.session){sbAccessToken=data.session.access_token;return sbAccessToken;}
  }catch(e){}
  requireLogin();
  return '';
}
/* 组长姓名 → 登录邮箱（拼音），与 SQL 种子一致 */
const LEADER_EMAIL={'张誉俪':'zhangyiming','张益铭':'zhangyiming','董子瑜':'dongziyu','梁锡永':'liangxiyong','杨佳诺':'yangjianuo','马语秋':'mayuqiu','刘亦峻':'liuyijun','冯馨熠':'fengxinyi','黄詩宸':'huangshichen','谭梦瑶':'tanmengyao','张邵宸':'zhangshaochen','李宜锦':'liyijin','刘铠墨':'liukaimo','王沐宇轩':'wangmuyuxuan','张昊群':'zhanghaoqun'};
function emailOf(name){
  if(name==='admin'||name==='admin2'||name==='teacher')return name+'@jfz.local';
  return (LEADER_EMAIL[name]||name)+'@jfz.local';
}
const GROUP_NAMES={'1':'第一组','2':'第二组','3':'第三组','4':'第四组','5':'第五组','6':'第六组','7':'第七组','8':'第八组','9':'第九组','10':'第十组'};
const GROUP_MEMBERS={
  '1':['张益铭','谭佑安','李锦馨','王铂乔','张翰伯'],
  '2':['董子瑜','李子涵','刘一辰','朱桐莹','周钰心'],
  '3':['梁锡永','李宜锦','刘铠墨','王沐宇轩','张昊群'],
  '4':['杨佳诺','平扬','李锦桐','季牧云'],
  '5':['马语秋','张儒溪','邓泽雨','马雨欣'],
  '6':['刘亦峻','郭一涵','章浩宸','梁馨悦'],
  '7':['冯馨熠','李晞玥','盖俊杰','王玺朝'],
  '8':['黄詩宸','刘若安','李恩','王珮钰','杨译贺'],
  '9':['谭梦瑶','周倾淳','姚静怡','陈浩天'],
  '10':['张邵宸','王仁可','刘相希','张天阳']
};
const LEADER_GROUP={'张益铭':'1','董子瑜':'2','梁锡永':'3','杨佳诺':'4','马语秋':'5','刘亦峻':'6','冯馨熠':'7','黄詩宸':'8','谭梦瑶':'9','张邵宸':'10'};
let currentGroupId=null;
let groupLeaders=[];

let currentView = 'daily';
let currentDate = new Date();
let switchingGroup=false; // 切换组中标志：防止保存旧组触发Realtime回调跳回旧组
const MIN_DATE=new Date(2026,7,31); // 2026-08-31 起可访问，此前数据已归档
function clampMinDate(d){return d<MIN_DATE?new Date(MIN_DATE):d;}
function isArchived(dk){return parseDate(dk)<MIN_DATE;}
let currentWeek = startOfWeek(new Date());
let currentMonth = {y:new Date().getFullYear(), m:new Date().getMonth()};
let batchMode = false;
let selectedStudents = new Set();
let activeCell = null;
let formulaWeights = {xw:null, top:new Set()};
let undoStack=[], redoStack=[];

function uid(){return 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

/* ================= SHA-256（纯JS，file:// 下可用） ================= */
function sha256(ascii){
  function rightRotate(value,amount){return (value>>>amount)|(value<<(32-amount));}
  const mathPow=Math.pow;
  const maxWord=mathPow(2,32);
  let result='';
  const words=[];
  const asciiBitLength=ascii.length*8;
  let hash=sha256.h=sha256.h||[];
  const k=sha256.k=sha256.k||[];
  let primeCounter=k.length;
  const isComposite={};
  for(let candidate=2;primeCounter<64;candidate++){
    if(!isComposite[candidate]){
      for(let i=0;i<313;i+=candidate)isComposite[i]=candidate;
      hash[primeCounter]=(mathPow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(mathPow(candidate,1/3)*maxWord)|0;
    }
  }
  ascii+='\x80';
  while(ascii.length%64-56)ascii+='\x00';
  for(let i=0;i<ascii.length;i++){
    const j=ascii.charCodeAt(i);
    if(j>>8)return'';
    words[i>>2]|=j<<((3-i)%4)*8;
  }
  words[words.length]=(asciiBitLength/maxWord)|0;
  words[words.length]=asciiBitLength;
  for(let j=0;j<words.length;){
    const w=words.slice(j,j+=16);
    const oldHash=hash.slice(0,8);
    for(let i=0;i<64;i++){
      const w15=w[i-15],w2=w[i-2];
      const a=hash[0],e=hash[4];
      const temp1=hash[7]+(rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))+w[i-7]+(rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10)))|0);
      const temp2=(rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(temp1+temp2)|0].concat(hash);
      hash[4]=(hash[4]+temp1)|0;
    }
    for(let i=0;i<8;i++)hash[i]=(hash[i]+oldHash[i])|0;
  }
  for(let i=0;i<8;i++){
    for(let j=3;j+1;j--){
      const b=(hash[i]>>(j*8))&255;
      result+=((b<16)?0:'')+b.toString(16);
    }
  }
  return result;
}

/* ================= 账号系统 ================= */

function fmt(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function parseDate(s){const p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function startOfWeek(d){
  const x=new Date(d);
  const dow=d.getDay();
  x.setDate(d.getDate()-dow);
  return x;
}
function formatCN(d){return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日';}
function weekdayCN(d){return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];}
function monthDays(y,m){return new Date(y,m+1,0).getDate();}
function weekNumber(d){const start=new Date(d.getFullYear(),0,1);return Math.floor((d-start)/86400000/7)+1;}
function weekOfDate(d){
  const start=new Date(2026,7,31); // 2026-08-31 第一周开始
  const a=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const b=new Date(start.getFullYear(),start.getMonth(),start.getDate());
  let weeks=0;
  const x=new Date(b);
  while(x < a){
    x.setDate(x.getDate()+7);
    weeks++;
  }
  return weeks+1;
}

/* ================= 计算 ================= */
function cellEvents(sid,iid,dk){
  const c=(state.scores[dk]||{})[sid]?.[iid];
  if(c==null)return [];
  if(Array.isArray(c))return c;
  return [{v:Number(c)||0,label:''}];
}
function itemDefault(iid){const it=state.items.find(i=>i.id===iid);return it&&it.default?Number(it.default)||0:0;}
function cellVal(sid,iid,dk){
  if(isArchived(dk))return 0;
  const def=(state.baseOff&&state.baseOff[dk])?0:itemDefault(iid);
  return Math.round(cellEvents(sid,iid,dk).reduce((a,e)=>a+(Number(e.v)||0),def)*100)/100;
}
function dayHasData(dk){return !!(state.scores[dk]&&Object.keys(state.scores[dk]).length>0);}
let holidayCache={};
// holidayCache[dk]: 0=工作日 1=周末 2=节假日 3=调休补班
function isSchoolDay(d,dk){
  if(holidayCache[dk]!==undefined)return holidayCache[dk]===0||holidayCache[dk]===3;
  const wd=d.getDay();
  return wd>=1&&wd<=5;
}
