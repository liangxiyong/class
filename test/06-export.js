async function exportExcel(){
  try{await doExportExcel();}catch(e){console.error(e);toast('导出失败：'+e.message);}
}
async function doExportExcel(){
  if(typeof ExcelJS==='undefined'){await loadExcelJS();}
  const workbook=new ExcelJS.Workbook();
  const hasSubGroups=state.students.some(st=>st.group);
  const groups=hasSubGroups?groupList():[state.groupName||GROUP_NAMES[currentGroupId]||'小组积分'];
  const stsOf=(g)=>hasSubGroups?studentsOfGroup(g):state.students;
  // 计算周数：以2026-08-31为第一周
  const weekOfDate=(d)=>{
    const start=new Date(2026,7,31); // 2026-08-31
    const diff=Math.floor((d-start)/(1000*60*60*24));
    return Math.floor(diff/7)+1;
  };
  if(currentView==='daily'||currentView==='weekly'){
    const monday=(currentView==='daily')?startOfWeek(currentDate):currentWeek;
    const dates=weekDates(monday);
    const weekNum=weekOfDate(monday);
    const groupName=GROUP_NAMES[currentGroupId]||state.groupName||'小组';
    groups.forEach(g=>{
      const sts=stsOf(g);
      const rows=[];
      dates.forEach(d=>{
        const dk=fmt(d);
        // 跳过没有基础分的天（baseOff为true）
        if(state.baseOff&&state.baseOff[dk])return;
        if(!isSchoolDay(d,dk))return;
        rows.push(...buildDayBlock(dk,sts));rows.push([]);
      });
      rows.push(...buildWeekSummaryRows(monday,sts));
      const ws=workbook.addWorksheet(safeSheetName(g));
      rowsToXlsxSheet(ws,rows,g);
    });
    await downloadXlsx(workbook,groupName+'_第'+weekNum+'周.xlsx');
    toast('Excel 已导出（带样式）');
    return;
  }else if(currentView==='monthly'){
    const {y,m}=currentMonth;
    groups.forEach(g=>{
      const sts=stsOf(g);
      const ws=workbook.addWorksheet(safeSheetName(g+'·汇总'));
      rowsToXlsxSheet(ws,buildMonthSummaryRows(y,m,sts),g+' · 月汇总');
      const dRows=[];
      const n=monthDays(y,m);
      for(let d=1;d<=n;d++){
        const dt=new Date(y,m,d);
        if(!isSchoolDay(dt,fmt(dt)))continue;
        dRows.push(...buildDayBlock(fmt(dt),sts));dRows.push([]);
      }
      if(dRows.length){
        const ws2=workbook.addWorksheet(safeSheetName(g+'·明细'));
        rowsToXlsxSheet(ws2,dRows,g+' · 每日明细');
      }
    });
  }else if(currentView==='semester'){
    groups.forEach(g=>{
      const sts=stsOf(g);
      const ws=workbook.addWorksheet(safeSheetName(g));
      rowsToXlsxSheet(ws,buildSemesterRows(sts),g);
    });
  }
  await downloadXlsx(workbook,'班级小组积分表.xlsx');
  toast('Excel 已导出（带样式）');
}
function exportCSV(){
  let rows=[];
  const all=state.students;
  if(currentView==='daily'||currentView==='weekly'){
    const monday=(currentView==='daily')?startOfWeek(currentDate):currentWeek;
    const dates=weekDates(monday);
    rows=[];
    dates.forEach(d=>{rows.push(...buildDayBlock(fmt(d),all));rows.push([]);});
    rows.push(...buildWeekSummaryRows(monday,all));
  }else if(currentView==='monthly'){
    const {y,m}=currentMonth;
    rows=buildMonthSummaryRows(y,m,all);
  }else if(currentView==='semester'){
    rows=buildSemesterRows(all);
  }
  const csv='\uFEFF'+rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  download('积分表.csv',csv,'text/csv;charset=utf-8');
  toast('CSV 已导出');
}

/* ================= 打印 ================= */
function printDayBlockHTML(dk){
  const d=parseDate(dk);
  let h=`<div class="print-day"><div class="print-day-title">${weekdayCN(d)} ${formatCN(d)}</div>`;
  h+=`<table class="print-table"><thead><tr><th>序号</th><th>姓名</th>`;
  state.items.forEach(it=>h+=`<th>${esc(it.name)}</th>`);
  h+=`<th>个人总分</th></tr></thead><tbody>`;
  state.students.forEach((st,idx)=>{
    h+=`<tr><td>${idx+1}</td><td class="pt-name">${esc(st.name)}</td>`;
    state.items.forEach(it=>h+=`<td>${esc(cellTextSimple(st.id,it.id,dk))}</td>`);
    h+=`<td>${dayScore(st.id,dk)}</td></tr>`;
  });
  const group=dayGroupTotal(dk);
  const avg=avgOf(group);
  h+=`<tr class="pt-total"><td colspan="2">小组总分</td>`;
  state.items.forEach(()=>h+=`<td></td>`);
  h+=`<td>${group}</td></tr>`;
  h+=`<tr class="pt-total"><td colspan="2">平均分</td>`;
  state.items.forEach(()=>h+=`<td></td>`);
  h+=`<td>${avg}</td></tr>`;
  h+=`</tbody></table></div>`;
  return h;
}
function printWeekSummaryHTML(monday){
  const dates=weekDates(monday);
  let h=`<div class="print-day"><div class="print-day-title">周汇总</div>`;
  h+=`<table class="print-table"><thead><tr><th>姓名</th>`;
  dates.forEach(d=>h+=`<th>${weekdayCN(d)}<br><span style="font-weight:400;font-size:8px">${d.getMonth()+1}/${d.getDate()}</span></th>`);
  h+=`<th>周总分</th></tr></thead><tbody>`;
  state.students.forEach(st=>{
    h+=`<tr><td class="pt-name">${esc(st.name)}</td>`;
    dates.forEach(d=>h+=`<td>${dayScore(st.id,fmt(d))||''}</td>`);
    h+=`<td>${weekTotal(st.id,monday)}</td></tr>`;
  });
  const group=weekGroupTotal(monday);
  const avg=avgOf(group);
  h+=`<tr class="pt-total"><td>小组总分</td>${dates.map(()=>'<td></td>').join('')}<td>${group}</td></tr>`;
  h+=`<tr class="pt-total"><td>平均分</td>${dates.map(()=>'<td></td>').join('')}<td>${avg}</td></tr>`;
  h+=`</tbody></table></div>`;
  return h;
}
function printMonthSummaryHTML(y,m){
  const weeks=monthWeeks(y,m);
  let h=`<div class="print-day"><div class="print-day-title">月汇总 · ${y}年${m+1}月</div>`;
  h+=`<table class="print-table"><thead><tr><th>姓名</th>`;
  weeks.forEach((_,i)=>h+=`<th>第${i+1}周</th>`);
  h+=`<th>月总分</th></tr></thead><tbody>`;
  state.students.forEach(st=>{
    h+=`<tr><td class="pt-name">${esc(st.name)}</td>`;
    weeks.forEach(w=>{
      let t=0;w.forEach(d=>t+=dayScore(st.id,fmt(d)));
      t=Math.round(t*100)/100;
      h+=`<td>${t||''}</td>`;
    });
    h+=`<td>${monthTotal(st.id,y,m)}</td></tr>`;
  });
  const group=monthGroupTotal(y,m);
  const avg=avgOf(group);
  h+=`<tr class="pt-total"><td>小组总分</td>${weeks.map(()=>'<td></td>').join('')}<td>${group}</td></tr>`;
  h+=`<tr class="pt-total"><td>平均分</td>${weeks.map(()=>'<td></td>').join('')}<td>${avg}</td></tr>`;
  h+=`</tbody></table></div>`;
  return h;
}
function printSemesterHTML(){
  const weeks=semesterWeeks();
  if(!weeks.length)return '';
  const first=weeks[0],last=weekEndDate(weeks[weeks.length-1]);
  const rows=state.students.map(st=>({st,t:allTimeTotal(st.id)})).sort((a,b)=>b.t-a.t);
  let h=`<div class="print-day"><div class="print-day-title">学期总排名 · ${formatCN(first)} ~ ${formatCN(last)}</div>`;
  h+=`<table class="print-table"><thead><tr><th>名次</th><th>姓名</th>`;
  state.items.forEach(it=>h+=`<th>${esc(it.name)}</th>`);
  h+=`<th>总分</th></tr></thead><tbody>`;
  rows.forEach(({st,t},idx)=>{
    h+=`<tr><td>${idx+1}</td><td class="pt-name">${esc(st.name)}</td>`;
    state.items.forEach(it=>h+=`<td>${allTimeItemSum(st.id,it.id)||''}</td>`);
    h+=`<td>${t}</td></tr>`;
  });
  const group=rows.reduce((a,r)=>a+r.t,0);
  const avg=avgOf(group);
  h+=`<tr class="pt-total"><td colspan="2">小组总分</td>${state.items.map(()=>'<td></td>').join('')}<td>${group}</td></tr>`;
  h+=`<tr class="pt-total"><td colspan="2">平均分</td>${state.items.map(()=>'<td></td>').join('')}<td>${avg}</td></tr>`;
  h+=`</tbody></table></div>`;
  return h;
}
function buildPrintHTML(){
  let h=`<div class="print-head">班级小组积分表${state.groupName?' · '+esc(state.groupName):''}</div>`;
  if(currentView==='daily'||currentView==='weekly'){
    const monday=(currentView==='daily')?startOfWeek(currentDate):currentWeek;
    const dates=weekDates(monday);
    h+=`<div class="print-sub">第${weekNumber(monday)}周 · ${dates.length?(formatCN(dates[0])+' ~ '+formatCN(dates[dates.length-1])):'本周无课'}</div>`;
    dates.forEach(d=>{h+=printDayBlockHTML(fmt(d));});
    h+=printWeekSummaryHTML(monday);
  }else if(currentView==='monthly'){
    const {y,m}=currentMonth;
    h+=`<div class="print-sub">${y}年${m+1}月 积分汇总</div>`;
    h+=printMonthSummaryHTML(y,m);
    const n=monthDays(y,m);
    for(let d=1;d<=n;d++){
      const dt=new Date(y,m,d);
      if(!isSchoolDay(dt,fmt(dt)))continue;
      h+=printDayBlockHTML(fmt(dt));
    }
  }else if(currentView==='semester'){
    const weeks=semesterWeeks();
    if(weeks.length){
      const first=weeks[0],last=weekEndDate(weeks[weeks.length-1]);
      h+=`<div class="print-sub">学期报告 · ${formatCN(first)} ~ ${formatCN(last)}</div>`;
    }
    h+=printSemesterHTML();
  }
  return h;
}
function printView(){
  if(!state.students.length){toast('请先添加成员');return;}
  const area=document.getElementById('printArea');
  area.innerHTML=buildPrintHTML();
  setTimeout(()=>window.print(),80);
}

/* ================= Toast ================= */
let toastTimer=null;
function toast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),1800);
}

/* ================= 节假日检测 ================= */
// 内置官方节假日兜底表（2026 年，依据国务院办公厅通知）。2=放假 3=补班（上班）。
// 当 timor.tech API 不可用/被拦截时自动使用此表，保证节假日仍能被正确剔除。
const HOLIDAY_FALLBACK={
  '2026':{
    '01-01':2,'01-02':2,'01-03':2,'01-04':3,
    '02-14':3,'02-15':2,'02-16':2,'02-17':2,'02-18':2,'02-19':2,'02-20':2,'02-21':2,'02-22':2,'02-23':2,'02-28':3,
    '04-04':2,'04-05':2,'04-06':2,
    '05-01':2,'05-02':2,'05-03':2,'05-04':2,'05-05':2,'05-09':3,
    '06-19':2,'06-20':2,'06-21':2,
    '09-20':3,'09-25':2,'09-26':2,'09-27':2,
    '10-01':2,'10-02':2,'10-03':2,'10-04':2,'10-05':2,'10-06':2,'10-07':2,'10-10':3
  }
};
let holidayLoading=false;
let holidayQueue=[];
function loadHolidayYear(year){
  // ① 内置兜底表优先写入缓存（不依赖网络也能正确剔除节假日）
  if(HOLIDAY_FALLBACK[year]){
    for(const mmdd in HOLIDAY_FALLBACK[year]){
      holidayCache[year+'-'+mmdd]=HOLIDAY_FALLBACK[year][mmdd];
    }
  }
  const cacheKey='holidayCache_'+year;
  try{
    const cached=localStorage.getItem(cacheKey);
    if(cached){
      const map=JSON.parse(cached);
      for(const dk in map)holidayCache[dk]=map[dk];
      return;
    }
  }catch(e){}
  if(holidayQueue.includes(year))return;
  holidayQueue.push(year);
  processHolidayQueue();
}
function processHolidayQueue(){
  if(holidayLoading||!holidayQueue.length)return;
  const year=holidayQueue.shift();
  holidayLoading=true;
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),8000);
  fetch('https://timor.tech/api/holiday/year/'+year,{signal:ctrl.signal})
    .then(r=>r.json())
    .then(data=>{
      clearTimeout(timer);
      if(data.code===0&&data.holiday){
        const map={};
        for(const mmdd in data.holiday){
          const item=data.holiday[mmdd];
          const dk=year+'-'+mmdd;
          const t=item.holiday?2:3;
          map[dk]=t;
          holidayCache[dk]=t;
        }
        try{localStorage.setItem('holidayCache_'+year,JSON.stringify(map));}catch(e){}
      }
      holidayLoading=false;
      processHolidayQueue();
      render();
    })
    .catch(()=>{clearTimeout(timer);holidayLoading=false;processHolidayQueue();});
}
function preloadMonth(y,m){
  loadHolidayYear(y);
  if(m===0)loadHolidayYear(y-1);
  if(m===11)loadHolidayYear(y+1);
}

/* ================= Init ================= */
applyFont();
renderSidebarUser();
updateNavForRole();
const adminBtn=document.getElementById('adminBtn');
if(adminBtn)adminBtn.style.display=(isAdmin()||isAdmin2())?'':'none';
if(isAdmin())loadAdmin2Enabled();
setSyncStatus(cloudCfg.lastSync?('上次同步：'+new Date(cloudCfg.lastSync).toLocaleString('zh-CN')):'尚未同步','var(--ink-soft)');
(function(){
  const now=new Date();
  preloadMonth(now.getFullYear(),now.getMonth()-1);
  preloadMonth(now.getFullYear(),now.getMonth());
  preloadMonth(now.getFullYear(),now.getMonth()+1);
})();
// 同步阶段 currentUser 尚未就绪（登录信息在下方异步 IIFE 中重建），此时渲染会用缓存完整名单造成个人模式短暂泄露全组，故延后
if(currentUser)render();
// 手机端滑动切换已移除（用户要求）
// (function bindSwipe(){...})();
// 拦截手机系统左滑/返回键退出（留在当前页；正常退出走「退出登录」按钮）
(function guardHistory(){
  try{
    if(history&&history.pushState&&history.state===null){
      history.replaceState({jfzGuard:1},'');
      history.pushState({jfzGuard:1},'');
      window.addEventListener('popstate',function(){
        if(history.state&&history.state.jfzGuard){
          history.pushState({jfzGuard:1},'');
        }
      });
    }
  }catch(e){}
})();
(async function(){
  try{
    // 会话检查：无有效 JWT 会话直接回登录页
    if(!SB){requireLogin();return;}
    const {data:sd}=await SB.auth.getSession();
    if(!sd||!sd.session){requireLogin();return;}
    sbAccessToken=sd.session.access_token;
    // 从 users 表重建 currentUser（权威角色；user_metadata 用户可改，仅作兜底）
    let cu=null;
    if(!currentUser){
      try{
        const em=(sd.session.user&&sd.session.user.email)||'';
        if(em){
          const rresp=await sbFetch('users?email=eq.'+encodeURIComponent(em)+'&select=username,role,group_id');
          const rrows=await rresp.json();
          if(rrows&&rrows.length)cu={name:rrows[0].username||'',role:rrows[0].role||'user',groupId:rrows[0].group_id||null};
        }
      }catch(e){}
      if(!cu){
        const meta=(sd.session.user&&sd.session.user.user_metadata)||{};
        cu={name:meta.username||'',role:meta.role||'user',groupId:meta.group_id||null};
      }
      currentUser=cu;
      try{saveSession();}catch(e){}
    }
    await loadLeaders();
    if(!currentUser){
      requireLogin();
      return;
    }
    // 维护时间检查：禁止使用小组积分V1
    var nowD=new Date();
    if(nowD.getHours()===0 && nowD.getMinutes()<30){
      document.body.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#f6f1e8;text-align:center;padding:20px"><div style="font-size:60px;margin-bottom:20px">🔧</div><div style="font-size:20px;font-weight:700;color:#c0392b;margin-bottom:10px">小组积分维护中</div><div style="font-size:14px;color:#7a6d61;line-height:1.8">每天 0:00 - 0:30 为系统维护时间<br>维护期间小组积分V1暂不可用<br>请使用小组积分V2或在 0:30 后重新访问</div><div style="margin-top:24px"><a href="index.html" style="display:inline-block;padding:10px 24px;background:#c0392b;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">返回登录页</a></div></div>';
      return;
    }
    let gid=null;
    if(currentUser.role==='admin')gid=currentGroupId||'3';
    else if(currentUser.role==='teacher')gid=currentGroupId||'1';
    else if(currentUser.role==='admin2')gid='1';
    else if(currentUser.role==='leader')gid=currentUser.groupId||leaderGroupOf(currentUser.name);
    if(!gid){requireLogin();return;}
    await loadGroupIntoState(gid);
    render();
    renderSidebarUser();
    updateNavForRole();
    if(isAdmin())renderAdminGroupBar();
    toast('已加载 '+GROUP_NAMES[gid]);
  }catch(e){
    render();
    toast('加载数据失败：'+errMsg(e));
  }
})();

/* ================= 系统维护：23:50提示、0:00自动保存退出 ================= */
var MAINT_WARN=23*60+50; // 23:50 开始提示
var MAINT_START=0;       // 0:00 维护开始
var MAINT_END=30;        // 0:30 维护结束
var maintBanner=null;
var maintKicked=false;
function nowMins(){var d=new Date();return d.getHours()*60+d.getMinutes();}
function isMaintTime(){var d=new Date();return d.getHours()===0&&d.getMinutes()<MAINT_END;}
function isWarnTime(){return nowMins()>=MAINT_WARN;}
function showMaintBanner(msg,color,showSaveBtn){
  if(!maintBanner){
    maintBanner=document.createElement('div');
    maintBanner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;padding:10px 16px;text-align:center;font-size:14px;font-weight:600;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;gap:12px;';
    document.body.appendChild(maintBanner);
  }
  maintBanner.style.background=color||'#e67e22';
  if(showSaveBtn){
    maintBanner.innerHTML='<span>'+msg+'</span><button id="maintSaveBtn" style="background:#fff;color:#e67e22;border:none;padding:5px 12px;border-radius:5px;font-size:12px;font-weight:700;cursor:pointer">立即保存</button>';
    var btn=document.getElementById('maintSaveBtn');
    if(btn){
      btn.onclick=async function(){
        btn.textContent='保存中...';
        btn.disabled=true;
        try{
          if(typeof flushSbSave==='function')await flushSbSave();
          btn.textContent='✅ 已保存';
          setTimeout(function(){btn.textContent='立即保存';btn.disabled=false;},2000);
        }catch(e){
          btn.textContent='❌ 保存失败';
          setTimeout(function(){btn.textContent='立即保存';btn.disabled=false;},2000);
        }
      };
    }
  }else{
    maintBanner.textContent=msg;
  }
  maintBanner.style.display='flex';
}
function hideMaintBanner(){if(maintBanner)maintBanner.style.display='none';}
function maintKickOut(){
  if(maintKicked)return;
  maintKicked=true;
  showMaintBanner('🔧 系统维护开始，正在保存数据并退出...','#c0392b');
  // 自动保存后退出
  const doExit=async function(){
    try{if(typeof flushSbSave==='function')await flushSbSave();}catch(e){}
    clearSession();
    if(SB){try{await SB.auth.signOut();}catch(e){}}
    showMaintBanner('系统维护中（0:00-0:30），已自动退出','#c0392b');
    setTimeout(function(){location.href='index.html';},1500);
  };
  doExit();
}
function checkMaintenance(){
  if(isMaintTime()){maintKickOut();return;}
  if(isWarnTime()){
    var m=nowMins();
    var mins=(24*60)-m; // 到0:00的分钟数
    showMaintBanner('🔔 系统将于 '+mins+' 分钟后（0:00）进入维护，请及时保存数据','#f39c12',true);
    return;
  }
  hideMaintBanner();
}
/* ================= 公告弹窗 ================= */
async function loadNotice(){
  if(!currentUser)return;
  try{
    const r=await fetch(SUPABASE_URL+'/rest/v1/group_data?group_id=eq.notice&select=data',{
      headers:{'apikey':SUPABASE_ANON_KEY,'Authorization':'Bearer '+(SB?(await SB.auth.getSession()).data.session?.access_token:'')}
    });
    if(!r.ok)return;
    const rows=await r.json();
    if(!rows||!rows.length||!rows[0].data)return;
    const d=rows[0].data;
    if(!d.message)return;
    // 判断可见范围
    const role=currentUser.role;
    const scope=d.scope||'all';
    let visible=false;
    if(scope==='all'){
      visible=true;
    }else if(scope==='admin'){
      visible=(role==='admin');
    }else if(scope==='teacher'){
      visible=(role==='admin'||role==='admin2'||role==='teacher');
    }else if(scope==='leader'){
      visible=(role==='admin'||role==='admin2'||role==='teacher'||role==='leader');
    }else if(scope==='groups'){
      // 指定组别：组长只能看自己组，admin/admin2/teacher都能看
      if(role==='admin'||role==='admin2'||role==='teacher'){
        visible=true;
      }else if(role==='leader'&&currentGroupId){
        visible=(d.groups||[]).indexOf(String(currentUser.groupId))>=0;
      }
    }
    if(!visible)return;
    // 检查是否已经看过（用消息内容+时间做key）
    const seenKey='jfz_notice_seen_'+(d.updatedAt||'');
    if(localStorage.getItem(seenKey))return;
    // 显示公告
    document.getElementById('noticeContent').textContent=d.message;
    if(d.updatedAt){
      try{document.getElementById('noticeTime').textContent=new Date(d.updatedAt).toLocaleString('zh-CN');}catch(e){}
    }
    document.getElementById('noticeModal').style.display='flex';
    // 标记已看
    localStorage.setItem(seenKey,'1');
  }catch(e){
    console.log('公告加载失败',e);
  }
}
function closeNotice(){
  document.getElementById('noticeModal').style.display='none';
}
loadNotice();




if(typeof document!=='undefined'){
}



