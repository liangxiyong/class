function loadState(){
  // 按需求：刷新只从云端加载，本地缓存仅做保存备份，不读取
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
let state = loadState();
function migrateItems(s){
  const oldMap={};
  (s.items||[]).forEach(it=>oldMap[it.id]=it);
  const out=[];
  DEFAULT_ITEMS.forEach(d=>{if(oldMap[d.id])out.push(JSON.parse(JSON.stringify(d)));});
  const have=new Set(out.map(i=>i.id));
  DEFAULT_ITEMS.forEach(d=>{if(!have.has(d.id))out.push(JSON.parse(JSON.stringify(d)));});
  s.items=out;
}
function fixFormulaMinN(s){
  (s.items||[]).forEach(it=>{
    if(it.formula&&it.id==='month'){
      if(it.formula.minN<=5)it.formula.minN=41;
      it.formula.expr='47-N';
      if(!it.formula.tiers)it.formula.tiers={42:-2,43:-4,44:-6,45:-8,46:-10};
    }
  });
}
function fixGoodWeights(s){
  const good=(s.items||[]).find(i=>i.id==='good');
  if(!good)return;
  if(good.formula)delete good.formula;
  good.weights=[];
}
function normalizeScores(s){
  if(!s.scores)return;
  for(const dk in s.scores){
    for(const sid in s.scores[dk]){
      const cell=s.scores[dk][sid];
      for(const iid in cell){
        const v=cell[iid];
        if(!Array.isArray(v))cell[iid]=[{v:Number(v)||0,label:''}];
      }
    }
  }
}
function save(){
  state.lastModified=Date.now();
  const snap=personalSnapshot(state);
  try{
    const bak=localStorage.getItem(KEY);
    if(bak)localStorage.setItem(KEY+'_bak',bak);
  }catch(e){}
  try{localStorage.setItem(KEY, JSON.stringify(snap));}catch(e){}
  if(currentGroupId){
    try{localStorage.setItem('jfz_group_local_v2_'+currentGroupId,JSON.stringify(snap));}catch(e){}
    queueSbSave();
  }
}
let sbSaveTimer=null;
let sbRetryTimer=null;
let sbSavePending=false;
let pendingRemoteUpdate=false; // 有远程更新待本地保存成功后处理
let localDirty=false;   // 本地是否有尚未成功同步到云端的修改
let sbRetryCount=0;
function queueSbSave(){
  localDirty=true;
  sbSavePending=true;
  if(sbSaveTimer)clearTimeout(sbSaveTimer);
  if(sbRetryTimer){clearTimeout(sbRetryTimer);sbRetryTimer=null;}
  sbSaveTimer=setTimeout(()=>{
    sbSaveTimer=null;
    doSbSave();
  },150);
}
function doSbSave(){
  if(!currentGroupId){sbSavePending=false;return;}
  setSyncStatus('⏳ 正在同步到云端...','#7a6d61');
  saveGroupData(currentGroupId,state).then(()=>{
    localDirty=false;
    sbSavePending=false;
    sbRetryCount=0;
    setSyncStatus('✅ 已同步 '+new Date().toLocaleTimeString('zh-CN'),'var(--green)');
    // 跨标签页广播：同一浏览器其他标签页收到后立即刷新
    try{localStorage.setItem('jfz_sync_broadcast',JSON.stringify({gid:currentGroupId,ts:Date.now()}));}catch(e){}
    if(pendingRemoteUpdate){pendingRemoteUpdate=false;setTimeout(pollRemote,300);}
  }).catch(err=>{
    sbSavePending=false;
    const msg=(err&&err.message)?err.message:'网络错误';
    // 自动重试 3 次：1s、2s、4s
    if(sbRetryCount<3){
      sbRetryCount++;
      const delay=1000*Math.pow(2,sbRetryCount-1);
      setSyncStatus('同步失败，'+(delay/1000)+' 秒后自动重试（'+sbRetryCount+'/3）','#c98a3a');
      sbRetryTimer=setTimeout(doSbSave,delay);
    }else{
      setSyncStatus('❌ 暂未同步（已保存在本机），联网后自动重试','var(--red)');
    }
  });
}
// 兜底重传：本地有未同步修改、且当前没有保存动作在进行时，立即重新上传
function retrySyncIfDirty(){
  if(localDirty&&!sbSavePending&&!sbSaveTimer&&!sbRetryTimer&&currentGroupId&&state){
    sbRetryCount=0;
    doSbSave();
  }
}
async function flushSbSave(){
  if(sbSaveTimer){clearTimeout(sbSaveTimer);sbSaveTimer=null;}
  if(sbRetryTimer){clearTimeout(sbRetryTimer);sbRetryTimer=null;}
  if(currentGroupId){
    try{
      await saveGroupData(currentGroupId,state);
      localDirty=false;sbSavePending=false;sbRetryCount=0;
    if(pendingRemoteUpdate){pendingRemoteUpdate=false;setTimeout(pollRemote,500);} // 保存成功后补拉远程更新
      setSyncStatus('✅ 已同步 '+new Date().toLocaleTimeString('zh-CN'),'var(--green)');
    }catch(e){
      sbSavePending=false;
      // 保存失败：保持localDirty=true，显示未同步状态，联网后自动重试
      localDirty=true;
      setSyncStatus('❌ 暂未同步（已保存在本机），联网后自动重试','var(--red)');
    }
  }
}
// 页面关闭/刷新前立即同步，避免 300ms 防抖未触发导致云端丢失
function sendSbKeepalive(){
  if(!currentGroupId||!state||!sbAccessToken)return;
  const out=Object.assign({},state);
  delete out._allStudents;
  if(!out.students||!out.students.length)return;
  const body={group_id:currentGroupId,group_name:GROUP_NAMES[currentGroupId]||('第'+currentGroupId+'组'),data:out,updated_at:new Date().toISOString()};
  try{
    fetch(SUPABASE_URL+'/rest/v1/group_data?on_conflict=group_id',{
      method:'POST',keepalive:true,
      headers:{'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+sbAccessToken,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(body)
    }).catch(()=>{});
  }catch(e){}
}
window.addEventListener('pagehide',sendSbKeepalive);
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escJs(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}

/* ================= 撤销 / 重做 ================= */
function pushHistory(){
  undoStack.push(JSON.stringify(state));
  if(undoStack.length>60)undoStack.shift();
  redoStack=[];
}
function undo(){
  if(!undoStack.length){toast('没有可撤销的操作');return;}
  redoStack.push(JSON.stringify(state));
  state=JSON.parse(undoStack.pop());
  save();render();
  toast('已撤销');
}
function redo(){
  if(!redoStack.length){toast('没有可重做的操作');return;}
  undoStack.push(JSON.stringify(state));
  state=JSON.parse(redoStack.pop());
  save();render();
  toast('已重做');
}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
});

/* ================= Supabase 存储 ================= */
async function sbFetch(path,options,retried){
  const token=await ensureSbToken();
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),8000);
  try{
    const resp=await fetch(SUPABASE_URL+'/rest/v1/'+path,Object.assign({
      signal:ctrl.signal
    },options||{},{
      headers:Object.assign({'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},(options&&options.headers)||{})
    }));
    if(resp.status===401&&!retried&&SB){
      // token 过期：先尝试刷新会话后重试一次，避免误踢用户且丢失本次写入
      try{
        const {data:rr}=await SB.auth.refreshSession();
        if(rr&&rr.session){sbAccessToken=rr.session.access_token;}
        return sbFetch(path,options,true);
      }catch(e){}
    }
    if(resp.status===401){clearSession();if(SB)SB.auth.signOut().catch(()=>{});location.href='index.html';throw new Error('HTTP 401');}
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    return resp;
  }finally{
    clearTimeout(timer);
  }
}
async function loadGroupData(groupId){
  const resp=await sbFetch('group_data?group_id=eq.'+groupId+'&select=group_id,group_name,data');
  const rows=await resp.json();
  return rows&&rows.length?rows[0]:null;
}
async function saveGroupData(groupId,data){
  const out=Object.assign({},data);
  // 防御：绝不让历史残留的 _allStudents 字段上传到云端
  delete out._allStudents;
  // 防御：名单为空时用默认名单兜底恢复，避免阻断正常保存（比直接拒绝更安全）
  if(!out.students||!out.students.length){
    const def=initGroupState(groupId);
    if(def&&def.students&&def.students.length)out.students=def.students;
  }
  if(!out.students||!out.students.length)throw new Error('名单为空，已阻止覆盖云端');
  const body={group_id:groupId,group_name:GROUP_NAMES[groupId]||('第'+groupId+'组'),data:out,updated_at:new Date().toISOString()};
  // 用 UPSERT（on_conflict=group_id + merge-duplicates）：行不存在时自动插入，
  // 避免 PATCH 在无行时静默无效（返回成功但什么都没写）
  const resp=await sbFetch('group_data?on_conflict=group_id',{method:'POST',body:JSON.stringify(body),headers:{'Prefer':'resolution=merge-duplicates,return=representation'}});
  // 验证：读取返回的数据，确认lastModified一致，防止假成功
  try{
    const saved=await resp.json();
    if(saved&&saved.length&&saved[0].data&&saved[0].data.lastModified!==out.lastModified){
      throw new Error('保存验证失败：云端lastModified与本地不一致');
    }
  }catch(e){
    if(e.message&&e.message.indexOf('保存验证失败')>=0)throw e;
  }
  sbSavePending=false;
  lastRemoteUpdatedAt=body.updated_at;
}
let lastRemoteUpdatedAt=0;
// 云端实时同步：检测他人（admin 批量关闭等）对当前组的修改，自动刷新
async function pollRemote(){
  // 超时保护：本地有修改超过30秒还没同步成功，强制拉取云端（避免永久阻塞远程更新）
  if(localDirty&&!window._localDirtyTime){window._localDirtyTime=Date.now();}
  if(localDirty&&Date.now()-window._localDirtyTime>30000){localDirty=false;sbSavePending=false;pendingRemoteUpdate=false;console.log('[同步]本地修改超时，强制拉取云端');}
  if(!localDirty){window._localDirtyTime=0;}
  // 页面不可见（切后台/锁屏）时跳过，降低手机端内存与电量压力，避免浏览器自动回收页面
  if(typeof document!=='undefined'&&document.hidden)return;
  if(switchingGroup)return; // 切换组中：跳过轮询，防止拉取旧组数据覆盖新组
  if(!currentGroupId)return;
  // 本地有未同步修改时优先重传，避免弱网下分数只留在本机
  if(localDirty){retrySyncIfDirty();return;}
  if(sbSavePending)return;
  try{
    const row=await loadGroupData(currentGroupId);
    if(row&&row.updated_at&&row.updated_at!==lastRemoteUpdatedAt){
      lastRemoteUpdatedAt=row.updated_at;
      // localDirty/sbSavePending 已在上方检查过，这里直接拉取云端最新数据
      // 传false：云端加载失败时保持当前页面，绝不用空数据覆盖
      await loadGroupIntoState(currentGroupId,false);
      render();
      setSyncStatus('☁️ 已自动同步 '+new Date().toLocaleTimeString('zh-CN'),'var(--ink-soft)');
      pendingRemoteUpdate=false;
    }
  }catch(e){}
}
setInterval(pollRemote,15000);
// 手动全局刷新：强制从云端重新拉取当前组数据（不允许空覆盖）
async function forceRefresh(){
  if(!currentGroupId)return;
  if(localDirty||sbSavePending){toast('正在同步，请稍候再刷新');return;}
  setSyncStatus('⏳ 正在从云端刷新...','var(--ink-soft)');
  try{
    await loadGroupIntoState(currentGroupId,false);
    render();
    setSyncStatus('✅ 已刷新 '+new Date().toLocaleTimeString('zh-CN'),'var(--green)');
    toast('已从云端刷新');
  }catch(e){
    setSyncStatus('❌ 刷新失败','var(--red)');
    toast('刷新失败：'+errMsg(e));
  }
}
// 跨标签页即时同步：同一浏览器一个标签页上传成功后，其他标签页立即刷新
window.addEventListener('storage',function(ev){
  if(ev.key==='jfz_sync_broadcast'&&ev.newValue){
    if(pendingRemoteUpdate){pendingRemoteUpdate=false;setTimeout(pollRemote,300);}
    try{
      const msg=JSON.parse(ev.newValue);
      if(msg.gid&&String(msg.gid)===String(currentGroupId)&&!localDirty&&!sbSavePending){
        pollRemote();
      }
    }catch(e){}
  }
});
// Supabase Realtime 订阅：跨设备实时同步（需在 Supabase 控制台开启 group_data 表的 Replication）
let sbRealtimeChannel=null;
let realtimeReconnectTimer=null;
function clearRealtimeReconnect(){
  if(realtimeReconnectTimer){clearTimeout(realtimeReconnectTimer);realtimeReconnectTimer=null;}
}
function scheduleRealtimeReconnect(gid){
  clearRealtimeReconnect();
  setSyncStatus('⚠️ 实时同步断开，3秒后重连...','#e67e22');
  realtimeReconnectTimer=setTimeout(function(){subscribeRealtime(gid);},3000);
}
function subscribeRealtime(gid){
  if(!SB||!SB.channel||!gid)return;
  try{
    clearRealtimeReconnect();
    if(sbRealtimeChannel){try{SB.removeChannel(sbRealtimeChannel);}catch(e){}sbRealtimeChannel=null;}
    sbRealtimeChannel=SB.channel('grp-'+gid)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'group_data',filter:'group_id=eq.'+gid},function(payload){
        if(switchingGroup)return; // 切换组中：忽略旧组的更新通知，防止跳回旧组
        if(!currentGroupId||String(currentGroupId)!==String(gid))return;
        if(typeof document!=='undefined'&&document.hidden)return;
        if(localDirty||sbSavePending){pendingRemoteUpdate=true;return;} // 本地有修改时记标志位，保存成功后补拉
        const newAt=payload.new&&payload.new.updated_at;
        if(newAt&&newAt!==lastRemoteUpdatedAt){
          // 关键防护：先验证云端数据有效（有items），有效才覆盖当前state；
          // 无效则忽略，绝不能让Realtime触发时把页面清空成默认空数据
          loadGroupData(gid).then(function(row){
            if(row&&row.data&&row.data.items&&row.data.items.length){
              // 传false：云端加载失败时保持当前页面，绝不用空数据覆盖
              loadGroupIntoState(gid,false).then(function(){render();setSyncStatus('☁️ 实时同步 '+new Date().toLocaleTimeString('zh-CN'),'var(--ink-soft)');}).catch(function(){});
            }
          }).catch(function(){});
        }
      })
      .subscribe(function(status){
        if(status==='SUBSCRIBED'){
          clearRealtimeReconnect();
          setSyncStatus('☁️ 实时同步已连接','var(--ink-soft)');
        }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
          scheduleRealtimeReconnect(gid);
        }
      });
  }catch(e){
    scheduleRealtimeReconnect(gid);
  }
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){
      // 切后台/锁屏/切标签页瞬间立即上传：手机切标签页不触发 pagehide，且后台定时器会被浏览器暂停，
      // 若不在此时抢发，刚打的分数可能只留在本机
      if(localDirty||sbSavePending){
        try{flushSbSave();}catch(e){}
        try{sendSbKeepalive();}catch(e){}
      }
    }else{
      // 回到前台：先重传本地未同步数据，再检查云端更新
      retrySyncIfDirty();if(pendingRemoteUpdate){pendingRemoteUpdate=false;setTimeout(pollRemote,800);}else{pollRemote();}
    }
  });
}
// 从 bfcache 恢复（手机前进/后退）时也兜底重传
window.addEventListener('pageshow',function(ev){if(ev&&ev.persisted)retrySyncIfDirty();});
if(typeof window!=='undefined'){
  // 网络从断开恢复时立即重传
  window.addEventListener('online',function(){retrySyncIfDirty();});
}
async function loadLeaders(){
  try{
    const resp=await sbFetch('leaders?select=name,group_id');
    const rows=await resp.json();
    groupLeaders=Array.isArray(rows)?rows:[];
  }catch(e){groupLeaders=[];}
}
function leaderGroupOf(name){
  const l=groupLeaders.find(x=>x.name===name);
  if(l)return l.group_id;
  return LEADER_GROUP[name]||null;
}
function openChangePwdModal(){
  if(!currentUser){toast('请先登录');return;}
  document.getElementById('pwdMeName').value=currentUser.name;
  document.getElementById('pwdMeOld').value='';
  document.getElementById('pwdMeNew').value='';
  document.getElementById('pwdMeNew2').value='';
  document.getElementById('pwdMeErr').textContent='';
  document.getElementById('pwdMeModal').style.display='flex';
}
function closeChangePwdModal(){document.getElementById('pwdMeModal').style.display='none';}
async function doChangePwdMe(){
  const name=document.getElementById('pwdMeName').value.trim();
  const old=document.getElementById('pwdMeOld').value;
  const np=document.getElementById('pwdMeNew').value;
  const np2=document.getElementById('pwdMeNew2').value;
  const err=document.getElementById('pwdMeErr');
  if(!old){err.textContent='请输入当前密码';return;}
  if(!np){err.textContent='请输入新密码';return;}
  if(np!==np2){err.textContent='两次输入的新密码不一致';return;}
  if(!SB){err.textContent='无法连接认证服务，请检查网络';return;}
  try{
    const {error:ve}=await SB.auth.signInWithPassword({email:emailOf(name),password:old});
    if(ve){err.textContent='当前密码错误';return;}
    const {error:ue}=await SB.rpc('change_my_password',{old_password:old,new_password:np});
    if(ue){err.textContent='修改失败：'+(ue.message||'未知错误');return;}
    err.textContent='';
    alert('密码修改成功，请使用新密码登录');
    closeChangePwdModal();
  }catch(e){
    err.textContent='修改失败：无法连接云端';
  }
}
function loadLocalGroup(groupId){
  try{
    const raw=localStorage.getItem('jfz_group_local_v2_'+groupId);
    if(raw){
      const s=JSON.parse(raw);
      if(s&&s.items){repairPersonalCache(s);normalizeGroupData(s,groupId);return s;}
    }
  }catch(e){}
  return null;
}
function initGroupState(groupId){
  const s=JSON.parse(JSON.stringify(DEFAULT_STATE));
  s.groupName=GROUP_NAMES[groupId]||('第'+groupId+'组');
  s.students=(GROUP_MEMBERS[groupId]||[]).map(n=>({id:uid(),name:n}));
  return s;
}
/* 规范化小组数据（迁移+修复，批量导出时云端原始数据必须经过此处理）
   返回 true 表示发生了问号污染修复（调用方应写回云端） */
function normalizeGroupData(s,groupId){
  if(!s||!s.items)return false;
  let fixed=false;
  if(!s.groupName)s.groupName=GROUP_NAMES[groupId]||('第'+groupId+'组');
  if(s.itemsVer!==3){migrateItems(s);s.itemsVer=3;}
  fixGoodWeights(s);
  fixFormulaMinN(s);
  normalizeScores(s);
  // 补全baseOff字段，防止基础分开关丢失
  if(!s.baseOff || typeof s.baseOff !== 'object'){s.baseOff={};fixed=true;}
  // 自动修复分数记录里的学生ID与学生名单ID不匹配的问题（如名单被重建后历史分数仍是旧ID）
  if(s.students&&s.students.length&&s.scores){
    const rosterIds=s.students.map(function(st){return st.id;});
    const rosterSet={};
    rosterIds.forEach(function(id){rosterSet[id]=true;});
    for(const dk in s.scores){
      const day=s.scores[dk];
      if(!day||typeof day!=='object')continue;
      const scoreIds=Object.keys(day);
      // 孤儿ID：分数里有但名单里没有
      const orphanIds=scoreIds.filter(function(id){return !rosterSet[id];});
      if(!orphanIds.length)continue;
      // 缺失ID：名单里有但分数里没有
      const missingIds=rosterIds.filter(function(id){return !day[id];});
      if(orphanIds.length===missingIds.length&&missingIds.length>0){
        // 数量一致：按顺序把孤儿ID的数据迁移到缺失ID
        orphanIds.sort();missingIds.sort();
        for(let k=0;k<orphanIds.length;k++){
          day[missingIds[k]]=day[orphanIds[k]];
          delete day[orphanIds[k]];
          fixed=true;
        }
      }
    }
  }
  // 自动修复被编码污染的姓名（???/？？？）：seed id 可直接还原；手动添加的成员（uid id）按组内位置对齐 GROUP_MEMBERS 还原
  const hasQM=s=>s!=null&&/[?？]/.test(String(s));
  const itemNameMap={};
  DEFAULT_ITEMS.forEach(it=>itemNameMap[it.id]=it.name);
  const members=GROUP_MEMBERS[groupId]||[];
  (s.students||[]).forEach((st,idx)=>{
    if(hasQM(st.name)){
      let fix=null;
      const m=st.id&&st.id.match(/^seed(\d+)_(\d+)$/);
      if(m&&GROUP_MEMBERS[m[1]]&&GROUP_MEMBERS[m[1]][parseInt(m[2])-1]){
        fix=GROUP_MEMBERS[m[1]][parseInt(m[2])-1];
      }else if(members[idx]){
        fix=members[idx];
      }
      if(fix){st.name=fix;fixed=true;}
    }
  });
  (s.items||[]).forEach(it=>{
    if(hasQM(it.name)&&itemNameMap[it.id]){it.name=itemNameMap[it.id];fixed=true;}
    const defItem=DEFAULT_ITEMS.find(d=>d.id===it.id);
    if(defItem){
      if(defItem.presets&&it.presets){
        it.presets.forEach((p,i)=>{
          if(hasQM(p.label)&&defItem.presets[i]){p.label=defItem.presets[i].label;fixed=true;}
        });
      }
      if(defItem.weights&&it.weights){
        it.weights.forEach((w,i)=>{
          if(hasQM(w.label)&&defItem.weights[i]){w.label=defItem.weights[i].label;fixed=true;}
        });
      }
    }
  });
  return fixed;
}
async function loadGroupIntoState(groupId,allowEmpty){
  // allowEmpty: 页面初始化时传true（默认），允许云端失败时用空数据兜底；
  // Realtime/轮询/手动刷新时传false，云端失败时保持当前state绝不覆盖
  if(allowEmpty===undefined)allowEmpty=true;
  let s=null;
  let fixedPollution=false;
  let needUpload=false; // 用本地备份恢复（且本地更新）时回传云端
  try{
    const row=await loadGroupData(groupId);
    if(row&&row.data&&row.data.items){
      s=row.data;
      fixedPollution=normalizeGroupData(s,groupId);
      // 防御：云端名单异常为空时，用默认名单兜底（不读本地缓存）
      if(!s.students||!s.students.length)s=initGroupState(groupId);
      lastRemoteUpdatedAt=row.updated_at||0;
    }
  }catch(e){
    // 云端加载失败，只有这时候才弹提示
    toast('网络不稳定，正在显示本地缓存数据');
  }
  if(!s){
    if(!allowEmpty)return state; // 不允许空覆盖：保持当前页面数据不变
    // 云端完全取不到时：本地有备份就恢复本地（防丢数据），否则空状态
    try{
      const local=loadLocalGroup(groupId);
      if(local&&local.items){s=local;needUpload=true;if(normalizeGroupData(local,groupId))fixedPollution=true;}
    }catch(e){}
    if(!s)s=initGroupState(groupId);
  }
  s=applyPersonalMode(s);
  state=s;
  currentGroupId=groupId;
  // 切换/加载小组后清空撤销栈：防止把上一组的旧快照恢复到本组（跨组数据污染+误上传）
  undoStack=[];redoStack=[];
  saveLocal();
  if(needUpload||fixedPollution)queueSbSave(); // 本地恢复或问号修复后写回云端
  console.log('[调试] 即将调用subscribeRealtime, groupId=', groupId);
  subscribeRealtime(groupId);
  const sub=document.getElementById('sidebarGroup');
  if(sub){sub.textContent=(GROUP_NAMES[groupId]||s.groupName)+(isPersonalMode()?' · 我的分数':'');sub.style.display='block';}
  return s;
}
function renderAdminGroupBar(){
  const bar=document.getElementById('adminGroupBar');
  if(!bar)return;
  bar.style.display=isAdmin()?'':'none';
  if(!isAdmin())return;
  const sel=document.getElementById('adminGroupSelect');
  if(!sel)return;
  sel.innerHTML=Object.keys(GROUP_NAMES).map(g=>`<option value="${g}" ${g===currentGroupId?'selected':''}>${GROUP_NAMES[g]}</option>`).join('');
}
async function switchAdminGroup(gid){
  if(!isAdmin())return;
  if(switchingGroup)return; // 正在切换中，防止重复触发
  switchingGroup=true;
  try{
    await flushSbSave();
    const oldGid=currentGroupId;
    // 传false：切换组时云端加载失败则保持当前组，不显示空数据
    const loaded=await loadGroupIntoState(gid,false);
    // 关键：只有真正加载成功（currentGroupId变了）才更新UI，否则保持原组防止"组名和数据不匹配"
    if(String(currentGroupId)!==String(gid)){
      toast('切换失败：云端数据加载异常，已保持当前组');
      return;
    }
    render();
    renderSidebarUser();
    updateNavForRole();
    renderAdminGroupBar();
    // 显式更新侧边栏组名，防止被renderSettings覆盖
    const sub=document.getElementById('sidebarGroup');
    if(sub){sub.textContent=GROUP_NAMES[gid]||('第'+gid+'组');sub.style.display='block';}
    toast('已切换到 '+GROUP_NAMES[gid]);
  }catch(e){
    toast('切换失败：'+errMsg(e));
  }finally{
    // 延迟重置标志，确保Realtime回调都已处理完
    setTimeout(()=>{switchingGroup=false;},2000);
  }
}

/* ================= 云同步 ================= */
const CLOUD_KEY='jfz_cloud_v1';
let cloudCfg=loadCloudCfg();
let cloudSyncing=false;
let lastCloudOp=0;
function checkCloudThrottle(){
  const now=Date.now();
  const diff=now-lastCloudOp;
  if(diff<15000){
    const sec=Math.ceil((15000-diff)/1000);
    toast('操作太频繁，请 '+sec+' 秒后再试');
    return false;
  }
  lastCloudOp=now;
  return true;
}
function cloudEncode(obj){
  return JSON.stringify({__lz:1,data:LZString.compressToBase64(JSON.stringify(obj))});
}
function cloudDecode(remote){
  if(!remote)return null;
  if(remote.__lz===1){
    try{return JSON.parse(LZString.decompressFromBase64(remote.data));}catch(e){return null;}
  }
  return remote;
}

function loadCloudCfg(){
  try{
    const raw=localStorage.getItem(CLOUD_KEY);
    if(raw){
      const c=JSON.parse(raw);
      return{autoSync:c.autoSync!==false,lastSync:c.lastSync||0};
    }
  }catch(e){}
  return{autoSync:true,lastSync:0};
}
function saveCloudCfg(){localStorage.setItem(CLOUD_KEY,JSON.stringify(cloudCfg));}
function setSyncStatus(msg,color){
  const el=document.getElementById('syncStatus');
  if(el){el.textContent=msg;el.style.color=color||'var(--ink-soft)';}
  const sb=document.getElementById('sidebarSync');
  if(sb){
    if(color==='var(--green)'){sb.textContent='☁️ 已同步';sb.style.color='rgba(46,125,50,.7)';}
    else if(color==='var(--red)'){sb.textContent='☁️ 同步失败';sb.style.color='rgba(198,40,40,.7)';}
    else if(color==='#7a6d61'){sb.textContent='☁️ 同步中…';sb.style.color='rgba(247,241,230,.5)';}
    else if(color==='#e67e22'){sb.textContent='☁️ 重连中…';sb.style.color='rgba(230,126,34,.8)';}
    else{sb.textContent='☁️ '+(cloudCfg.lastSync?'已同步':'未同步');sb.style.color='rgba(247,241,230,.38)';}
  }
}
async function cloudPush(silent){
  if(!currentGroupId){if(!silent)toast('请先选择小组');return;}
  if(!silent&&!checkCloudThrottle())return;
  cloudSyncing=true;
  try{
    await saveGroupData(currentGroupId,state);
    cloudCfg.lastSync=Date.now();saveCloudCfg();
    const days=Object.keys(state.scores||{}).length;
    setSyncStatus('✅ 已上传 '+days+' 天数据 '+new Date().toLocaleTimeString('zh-CN'),'var(--green)');
    if(!silent)toast('已上传到云端（'+days+' 天数据）');
  }catch(e){
    let msg=errMsg(e);
    setSyncStatus('❌ 上传失败：'+msg,'var(--red)');
    if(!silent)toast('上传失败：'+msg);
  }
  cloudSyncing=false;
}
async function cloudPull(){
  if(!currentGroupId){toast('请先选择小组');return;}
  if(!checkCloudThrottle())return;
  cloudSyncing=true;
  setSyncStatus('正在从云端拉取…','#7a6d61');
  try{
    const row=await loadGroupData(currentGroupId);
    const remote=row&&row.data?row.data:null;
    if(!remote||!remote.items){setSyncStatus('云端暂无数据','var(--ink-soft)');cloudSyncing=false;return;}
    if(remote.version!==state.version){toast('云端数据版本不兼容');cloudSyncing=false;return;}
    const lt=state.lastModified||0;
    const rt=remote.lastModified||0;
    if(lt>rt&&!confirm('本地有更新的数据（比云端新），确定用云端覆盖本地吗？')){cloudSyncing=false;setSyncStatus('已取消','var(--ink-soft)');return;}
    normalizeScores(remote);
    state=applyPersonalMode(remote);saveLocal();
    render();
    cloudCfg.lastSync=Date.now();saveCloudCfg();
    const remoteCount=Object.keys(remote.scores||{}).length;
    setSyncStatus('✅ 已从云端拉取 '+remoteCount+' 天数据 '+new Date().toLocaleTimeString('zh-CN'),'var(--green)');
    toast('已从云端拉取数据');
  }catch(e){
    let msg=errMsg(e);
    setSyncStatus('❌ 拉取失败：'+msg,'var(--red)');
    toast('拉取失败：'+msg);
  }
  cloudSyncing=false;
}
function errMsg(e){
  if(e instanceof TypeError)return'网络无法访问云端（Failed to fetch），请检查网络后重试';
  const s=String(e&&e.message||e);
  if(s.indexOf('401')>=0)return'云端鉴权失败（401），请刷新页面重试';
  if(s.indexOf('403')>=0)return'云端拒绝访问（403），请检查权限';
  if(s.indexOf('404')>=0)return'云端数据不存在（404）';
  if(s.indexOf('429')>=0)return'请求过于频繁（429），请稍后再试';
  return s;
}

/* ================= 合并同步（多人协作） ================= */
function mergeRecords(a,b){
  const map=new Map();
  [...(a||[]),...(b||[])].forEach(r=>{
    const key=r.id||((r.by||'')+'|'+(r.ts||'')+'|'+(r.label||'')+'|'+r.v);
    if(!map.has(key))map.set(key,r);
  });
  return [...map.values()];
}
function mergeState(local,remote){
  const out=JSON.parse(JSON.stringify(local));
  if(!out.scores)out.scores={};
  if(!out.notes)out.notes={};
  const rScores=remote.scores||{};
  for(const dk in rScores){
    if(!out.scores[dk])out.scores[dk]={};
    for(const sid in rScores[dk]){
      if(!out.scores[dk][sid])out.scores[dk][sid]={};
      for(const iid in rScores[dk][sid]){
        out.scores[dk][sid][iid]=mergeRecords(out.scores[dk][sid][iid],rScores[dk][sid][iid]);
      }
    }
  }
  const rNotes=remote.notes||{};
  for(const dk in rNotes){
    if(!out.notes[dk])out.notes[dk]={};
    for(const sid in rNotes[dk]){
      if(!out.notes[dk][sid])out.notes[dk][sid]={};
      Object.assign(out.notes[dk][sid],rNotes[dk][sid]);
    }
  }
  const stMap=new Map(out.students.map(s=>[s.id,s]));
  (remote.students||[]).forEach(s=>{if(!stMap.has(s.id))stMap.set(s.id,s);});
  out.students=[...stMap.values()];
  dedupeStudents(out);
  const itMap=new Map(out.items.map(i=>[i.id,i]));
  (remote.items||[]).forEach(i=>{if(!itMap.has(i.id))itMap.set(i.id,i);});
  out.items=[...itMap.values()];
  if(out.itemsVer>=3)out.items=out.items.filter(i=>DEFAULT_ITEMS.some(d=>d.id===i.id));
  fixGoodWeights(out);
  const accMap=new Map((out.accounts||[]).map(a=>[a.name,a]));
  (remote.accounts||[]).forEach(a=>{if(!accMap.has(a.name))accMap.set(a.name,a);});
  out.accounts=[...accMap.values()];
  return out;
}
function dedupeStudents(st){
  const count=sid=>{
    let c=0;
    for(const dk in st.scores)if(st.scores[dk][sid])for(const iid in st.scores[dk][sid])c+=st.scores[dk][sid][iid].length;
    for(const dk in st.notes)if(st.notes[dk][sid])for(const iid in st.notes[dk][sid])c++;
    return c;
  };
  const best=new Map();
  for(const s of st.students){
    const key=s.group+':'+s.name;
    const score=count(s.id);
    if(!best.has(key)||score>best.get(key).score)best.set(key,{student:s,score});
  }
  const idMap=new Map();
  const kept=[];
  for(const s of st.students){
    const b=best.get(s.group+':'+s.name);
    if(b.student.id===s.id)kept.push(s);
    else idMap.set(s.id,b.student.id);
  }
  if(idMap.size===0)return false;
  for(const dk in st.scores){
    const day=st.scores[dk];
    for(const oldId in day){
      if(idMap.has(oldId)){
        const newId=idMap.get(oldId);
        if(!day[newId])day[newId]={};
        for(const iid in day[oldId]){
          day[newId][iid]=mergeRecords(day[newId][iid]||[],day[oldId][iid]);
        }
        delete day[oldId];
      }
    }
  }
  for(const dk in st.notes){
    const day=st.notes[dk];
    for(const oldId in day){
      if(idMap.has(oldId)){
        const newId=idMap.get(oldId);
        if(!day[newId])day[newId]={};
        Object.assign(day[newId],day[oldId]);
        delete day[oldId];
      }
    }
  }
  st.students=kept;
  return true;
}
function saveLocal(){
  try{
    const bak=localStorage.getItem(KEY);
    if(bak)localStorage.setItem(KEY+'_bak',bak);
  }catch(e){}
  const snap=personalSnapshot(state);
  localStorage.setItem(KEY,JSON.stringify(snap));
  if(currentGroupId){
    try{localStorage.setItem('jfz_group_local_v2_'+currentGroupId,JSON.stringify(snap));}catch(e){}
  }
}
if(dedupeStudents(state))saveLocal();
async function cloudPullMerge(silent){
  cloudSyncing=true;
  try{
    const row=await loadGroupData(currentGroupId);
    const remote=row&&row.data?row.data:null;
    if(!remote||!remote.items)return;
    if(remote.version!==state.version)return;
    if(isPersonalMode()){
      // 个人模式：只合并自己的分数，远端名单过滤为自己，避免整组成员泄露进本地
      const mine=(remote.students||[]).filter(s=>s.name===currentUser.name);
      remote=Object.assign({},remote,{students:mine});
      if(!state._allStudents)state._allStudents=state.students||[];
    }
    state=mergeState(state,remote);
    saveLocal();
    if(currentView==='daily'||currentView==='weekly'||currentView==='monthly'||currentView==='semester'||currentView==='myrecords')render();
    cloudCfg.lastSync=Date.now();saveCloudCfg();
    setSyncStatus('✅ 已同步 '+new Date().toLocaleTimeString('zh-CN'),'var(--green)');
  }catch(e){}
  cloudSyncing=false;
}
async function autoSyncOnce(){
  if(!currentUser||cloudSyncing)return;
  await cloudPullMerge(true);
  await cloudPush(true);
}
function startPolling(){
  // 自动同步已关闭：仅在打开页面时拉取一次，退出时手动上传
}
window.addEventListener('pagehide',()=>{});
document.addEventListener('visibilitychange',()=>{});

/* ================= 我的记录 ================= */


