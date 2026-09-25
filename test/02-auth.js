const SESSION_KEY='jfz_session_v1';
function loadSession(){try{const r=localStorage.getItem(SESSION_KEY);return r?JSON.parse(r):null;}catch(e){return null;}}
let currentUser=loadSession();
function saveSession(){localStorage.setItem(SESSION_KEY,JSON.stringify({name:currentUser.name,role:currentUser.role,groupId:currentUser.groupId||null}));}
function clearSession(){localStorage.removeItem(SESSION_KEY);currentUser=null;}
function hashPwd(pwd,salt){return sha256(salt+'::'+pwd);}
function genSalt(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36);}
function findAccount(name){return (state.accounts||[]).find(a=>a.name===name);}
function isAdmin(){return !!(currentUser&&(currentUser.role==='admin'||currentUser.role==='teacher'));}
let admin2Enabled=true;
async function loadAdmin2Enabled(){
  try{
    const resp=await sbFetch('class_data?id=eq.class&select=data');
    const rows=await resp.json();
    const remote=rows&&rows.length?rows[0].data:null;
    admin2Enabled=remote?remote.admin2Enabled!==false:true;
  }catch(e){}
}
function openAdminModal(){
  if(!isAdmin()&&!isAdmin2())return;
  renderAdminModal();
  document.getElementById('adminModal').style.display='flex';
  const es=document.getElementById('batchExportStart');
  if(es&&!es.value)setBatchRangeToday('batchExport');
  const bs=document.getElementById('batchBaseStart');
  if(bs&&!bs.value)setBatchRangeToday('batchBase');
  const rn=document.getElementById('resetPwdName');
  if(rn)rn.value='';
  const rp=document.getElementById('resetPwdNew');
  if(rp)rp.value='';
  const re=document.getElementById('resetPwdErr');
  if(re)re.textContent='';
}
function closeAdminModal(){
  document.getElementById('adminModal').style.display='none';
}
function renderAdminModal(){
  const row=document.getElementById('admin2SwitchRow');
  if(row)row.style.display=(currentUser&&currentUser.role==='admin')?'':'none';
  const sec=document.getElementById('resetPwdSection');
  if(sec)sec.style.display=(currentUser&&currentUser.role==='admin')?'':'none';
  const sw=document.getElementById('admin2Switch');
  if(sw)sw.classList.toggle('on',admin2Enabled!==false);
}
async function toggleAdmin2(){
  if(!(currentUser&&currentUser.role==='admin'))return;
  const enabling=admin2Enabled===false;
  if(!enabling&&!confirm('确定禁用 admin2 的班级管理V2功能吗？禁用后 admin2 的V2入口将变灰，仍可使用小组积分。'))return;
  try{
    const resp=await sbFetch('class_data?id=eq.class&select=data');
    const rows=await resp.json();
    const remote=(rows&&rows.length?rows[0].data:{})||{};
    remote.admin2Enabled=enabling;
    await sbFetch('class_data?on_conflict=id',{method:'POST',body:JSON.stringify({id:'class',data:remote,updated_at:new Date().toISOString()}),headers:{'Prefer':'resolution=merge-duplicates,return=minimal'}});
    admin2Enabled=enabling;
    renderAdminModal();
    toast(enabling?'已启用 admin2 班级管理V2':'已禁用 admin2 班级管理V2');
  }catch(e){
    toast('操作失败：无法连接云端');
  }
}
function ensureStudentAccount(name){}
function setBatchRangeToday(prefix){
  const dk=fmt(new Date());
  const s=document.getElementById(prefix+'Start');
  const e=document.getElementById(prefix+'End');
  if(s)s.value=dk;
  if(e)e.value=dk;
}
function getBatchRange(prefix){
  const s=document.getElementById(prefix+'Start').value;
  const e=document.getElementById(prefix+'End').value;
  if(!s&&!e)return null;
  let start=s?parseDate(s):new Date(MIN_DATE);
  let end=e?parseDate(e):new Date();
  if(start>end){const t=start;start=end;end=t;}
  if(end<MIN_DATE)return null;
  if(start<MIN_DATE)start=new Date(MIN_DATE);
  return {start,end};
}
async function exportAllGroupsExcel(){
  if(!(isAdmin()||isAdmin2()))return;
  const range=getBatchRange('batchExport');
  if(!range){toast('请选择导出日期范围');return;}
  if(typeof ExcelJS==='undefined'){try{await loadExcelJS();}catch(e){toast('Excel库加载失败');return;}}
  const workbook=new ExcelJS.Workbook();
  let count=0;
  const savedState=state;
  try{
    for(const gid of Object.keys(GROUP_NAMES)){
      let data=null;
      try{
        const row=await loadGroupData(gid);
        if(row&&row.data&&row.data.items)data=row.data;
      }catch(e){}
      if(!data)data=initGroupState(gid);
      if(!data)continue;
      normalizeGroupData(data,gid);
      state=data;
      const sts=data.students||[];
      const rows=[];
      for(let d=new Date(range.start);d<=range.end;d=addDays(d,1)){
        const dk=fmt(d);
        if(!isSchoolDay(d,dk))continue;
        rows.push(...buildDayBlock(dk,sts));
        rows.push([]);
      }
      if(rows.length){
        const ws=workbook.addWorksheet(safeSheetName(GROUP_NAMES[gid]));
        rowsToXlsxSheet(ws,rows,GROUP_NAMES[gid]);
        count++;
      }
    }
  }finally{
    state=savedState;
  }
  if(!count){toast('没有可导出的数据');return;}
  await downloadXlsx(workbook,'班级批量导出_'+fmt(range.start)+'_至_'+fmt(range.end)+'.xlsx');
  toast('已导出 '+count+' 个小组（带样式）');
}
async function adminBatchBaseOff(){
  if(!(isAdmin()||isAdmin2()))return;
  const range=getBatchRange('batchBase');
  if(!range){toast('请选择日期范围');return;}
  if(!confirm('确定对全部小组在 '+fmt(range.start)+' ~ '+fmt(range.end)+' 关闭基础分吗？'))return;
  const dks=[];
  for(let d=new Date(range.start);d<=range.end;d=addDays(d,1))dks.push(fmt(d));
  let ok=0,fail=0;const fails=[];
  for(const gid of Object.keys(GROUP_NAMES)){
    try{
      let data=null;
      try{
        const row=await loadGroupData(gid);
        if(row&&row.data&&row.data.items)data=row.data;
      }catch(e){}
      if(!data)data=initGroupState(gid); // 从未初始化的小组：用默认成员+项目兜底，确保每组都能写入
      if(!data.baseOff)data.baseOff={};
      dks.forEach(dk=>{data.baseOff[dk]=true;});
      try{
        await saveGroupData(gid,data);
      }catch(e){
        await saveGroupData(gid,data); // 失败重试一次
      }
      ok++;
    }catch(e){fail++;fails.push(GROUP_NAMES[gid]||gid);}
  }
  if(currentGroupId){
    try{
      await loadGroupIntoState(currentGroupId);
      render();
    }catch(e){}
  }
  toast(ok?('已关闭 '+ok+' 个小组的基础分'+(fail?('，失败 '+fail+' 个：'+fails.join('、')):'')):'操作失败：'+(fails.join('、')||'未知错误'));
}
async function adminResetPwd(){
  if(!isAdmin())return;
  const name=document.getElementById('resetPwdName').value.trim();
  const np=document.getElementById('resetPwdNew').value;
  const err=document.getElementById('resetPwdErr');
  if(!name){err.textContent='请输入用户名';return;}
  err.textContent='';
  try{
    const token=await ensureSbToken();
    const resp=await fetch(SUPABASE_URL+'/rest/v1/rpc/admin_reset_password',{method:'POST',headers:{'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_email:emailOf(name),p_new_password:np})});
    const text=await resp.text();
    if(!resp.ok){
      let m='操作失败';
      try{const j=JSON.parse(text);if(j&&j.message)m=j.message;}catch(e){}
      err.textContent=m;
      return;
    }
    err.textContent='';
    document.getElementById('resetPwdName').value='';
    document.getElementById('resetPwdNew').value='';
    toast('已重置「'+name+'」的密码');
  }catch(e){
    err.textContent='操作失败：无法连接云端';
  }
}
function isLeader(){return !!(currentUser&&currentUser.role==='leader');}
function isAdmin2(){return !!(currentUser&&currentUser.role==='admin2');}
// 个人模式：已停用（第三组学生与组长同权，均查看/修改全组；保留函数以便将来启用）
function isPersonalMode(){return false;}
// 保存前恢复完整学生名单，防止个人模式把整组覆盖成只剩自己
function personalSnapshot(s){
  if(isPersonalMode()&&s&&s._allStudents){
    const out=Object.assign({},s,{students:s._allStudents});
    delete out._allStudents;
    return out;
  }
  return s;
}
// 加载后：备份完整名单，students 截断为当前用户自己
function applyPersonalMode(s){
  if(!isPersonalMode()||!s)return s;
  s._allStudents=s.students||[];
  s.students=(s.students||[]).filter(st=>st.name===currentUser.name);
  return s;
}
// 自愈历史坏缓存：早期个人模式把截断版+_allStudents 存进了本地缓存，读回时用 _allStudents 还原完整名单
function repairPersonalCache(s){
  if(s&&Array.isArray(s._allStudents)&&s._allStudents.length>=1){
    s.students=s._allStudents;
  }
  delete s._allStudents;
  return s;
}
function canManageMembers(){if(isPersonalMode())return false;return isAdmin()||isLeader()||isAdmin2();}
function canAccessSettings(){return !!currentUser;}
function canAccessCloud(){return isAdmin()||isAdmin2();}
function updateNavForRole(){
  const adminOnly=['settings'];
  const leaderAllowed=['members'];
  document.querySelectorAll('.nav-item').forEach(n=>{
    if(adminOnly.includes(n.dataset.view))n.style.display=canAccessSettings()?'':'none';
    else if(leaderAllowed.includes(n.dataset.view))n.style.display=canManageMembers()?'':'none';
  });
  const secSettings=document.getElementById('view-settings');
  if(secSettings)secSettings.style.display=canAccessSettings()?'':'none';
  const secMembers=document.getElementById('view-members');
  if(secMembers)secMembers.style.display=canManageMembers()?'':'none';
  const addRow=document.getElementById('memberAddRow');
  if(addRow)addRow.style.display=canManageMembers()?'':'none';
  // 个人模式：设置里只保留「账号与密码」（改密），隐藏小组信息与评分项目配置
  const pi=document.getElementById('panelGroupInfo');
  if(pi)pi.style.display=isPersonalMode()?'none':'';
  const ic=document.getElementById('panelItemsCfg');
  if(ic)ic.style.display=(isPersonalMode()||isLeader())?'none':'';
}
function mkEvent(v,label){return {v,label,by:currentUser?currentUser.name:'本地',ts:Date.now(),id:uid()};}
function renderSidebarUser(){
  const el=document.getElementById('sidebarUser');
  if(!el)return;
  if(!currentUser){el.textContent='🔑 点击登录';return;}
  el.textContent='👤 '+currentUser.name;
}
function showLogout(){
  if(!currentUser){location.href='index.html';return;}
  if(confirm('退出登录「'+currentUser.name+'」吗？')){
    // 先冲刷待上传的云端数据，再登出，最后跳转（确保session清干净）
    const done=async function(){
      clearSession();
      if(SB){try{await SB.auth.signOut();}catch(e){}}
      location.href='index.html';
    };
    flushSbSave().then(done,done);
  }
}
function requireLogin(){
  clearSession();
  if(SB)SB.auth.signOut().catch(()=>{});
  location.href='index.html';
}
