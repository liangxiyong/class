function renderMyRecords(){
  const list=document.getElementById('myrecList');
  const count=document.getElementById('myrecCount');
  if(!list)return;
  if(!currentUser){
    list.innerHTML='<div class="empty-tip"><div class="big">🔒</div><div class="t">请先登录</div></div>';
    if(count)count.textContent='';
    return;
  }
  const recs=[];
  for(const dk in state.scores){
    for(const sid in state.scores[dk]){
      const st=state.students.find(s=>s.id===sid);
      for(const iid in state.scores[dk][sid]){
        const it=state.items.find(i=>i.id===iid);
        const arr=state.scores[dk][sid][iid];
        if(!Array.isArray(arr))continue;
        arr.forEach(e=>{
          if(e.by===currentUser.name){
            recs.push({dk,sid:st?st.name:'(已删除)',iid:it?it.name:'(已删除)',label:e.label,v:e.v,ts:e.ts||0});
          }
        });
      }
    }
  }
  recs.sort((a,b)=>b.ts-a.ts);
  if(count)count.textContent='共 '+recs.length+' 条记录';
  if(!recs.length){
    list.innerHTML='<div class="empty-tip"><div class="big">📋</div><div class="t">还没有操作记录</div><div class="s">去「每日评分」给成员加减分后，这里会显示</div></div>';
    return;
  }
  list.innerHTML=recs.map(r=>{
    const cls=r.v>0?'pos':'neg';
    const time=r.ts?new Date(r.ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
    return `<div class="myrec-item">
      <span class="myrec-date">${r.dk}</span>
      <span class="myrec-who">${esc(r.sid)}</span>
      <span class="myrec-itemname">${esc(r.iid)}</span>
      <span class="myrec-detail">${esc(r.label||'')}</span>
      <span class="myrec-val ${cls}">${r.v>0?'+':''}${r.v}</span>
      <span class="myrec-time">${time}</span>
    </div>`;
  }).join('');
}

/* ================= 账号管理 ================= */
function renderAccounts(){
  const list=document.getElementById('accList');
  if(!list)return;
  const accs=state.accounts||[];
  if(!accs.length){list.innerHTML='<div style="font-size:12px;color:var(--ink-soft)">暂无账号</div>';return;}
  list.innerHTML=accs.map(a=>`
    <div class="acc-item">
      <span class="acc-name">${esc(a.name)}</span>
      <span class="acc-role ${a.role==='admin'?'':'user'}">${a.role==='admin'?'管理员':'成员'}</span>
      <span class="acc-time">${new Date(a.createdAt).toLocaleDateString('zh-CN')}</span>
      ${currentUser&&currentUser.role==='admin'?`
        <button class="icon-btn" title="重置密码（忘记密码时）" onclick="resetAccPwd('${escJs(a.name)}')">🔑</button>
        ${a.name!==currentUser.name?`<button class="icon-btn" title="删除账号" onclick="removeAccount('${escJs(a.name)}')">🗑️</button>`:''}
      `:''}
    </div>`).join('');
}
function toggleAddAcc(){
  const row=document.getElementById('accAddRow');
  const show=row.style.display==='none';
  row.style.display=show?'flex':'none';
  document.getElementById('btnShowAddAcc').textContent=show?'取消添加':'＋ 添加账号';
}
function addAccount(){
  const name=document.getElementById('newAccName').value.trim();
  const pwd=document.getElementById('newAccPwd').value;
  if(!name||!pwd){toast('请输入用户名和密码');return;}
  if(findAccount(name)){toast('该用户名已存在');return;}
  const salt=genSalt();
  state.accounts=state.accounts||[];
  state.accounts.push({name,pwdHash:hashPwd(pwd,salt),salt,role:'user',createdAt:Date.now()});
  save();renderAccounts();
  document.getElementById('newAccName').value='';
  document.getElementById('newAccPwd').value='';
  toggleAddAcc();
  toast('已添加账号：'+name);
}
function removeAccount(name){
  if(!confirm('确定删除账号「'+name+'」吗？'))return;
  state.accounts=(state.accounts||[]).filter(a=>a.name!==name);
  save();renderAccounts();
  toast('已删除账号');
}
function resetAccPwd(name){
  const pwd=prompt('为账号「'+name+'」设置新密码（忘记密码时由管理员重置）：');
  if(!pwd||!pwd.trim())return;
  const acc=findAccount(name);
  if(!acc)return;
  const salt=genSalt();
  acc.salt=salt;acc.pwdHash=hashPwd(pwd,salt);
  save();renderAccounts();
  toast('已重置「'+name+'」的密码');
}
function toggleAutoSync(){
  cloudCfg.autoSync=!cloudCfg.autoSync;saveCloudCfg();
  const el=document.getElementById('autoSyncToggle');
  if(el)el.classList.toggle('on',cloudCfg.autoSync);
  toast(cloudCfg.autoSync?'已开启自动同步':'已关闭自动同步');
}
function renderCloudSettings(){
  if(cloudCfg.lastSync){
    const d=new Date(cloudCfg.lastSync);
    setSyncStatus('上次同步：'+d.toLocaleString('zh-CN'),'var(--ink-soft)');
  }else{
    setSyncStatus('每次修改会自动保存到云端','var(--ink-soft)');
  }
}

/* ================= 日期工具 ================= */
function weightF(){return (state&&state.weightFactor&&state.weightFactor>0)?state.weightFactor:1;}
function dayScore(sid,dk){
  if(isArchived(dk))return 0;
  if(!isSchoolDay(parseDate(dk),dk))return 0;
  const base=(state.baseOff&&state.baseOff[dk])?0:10;
  return Math.round((base+state.items.reduce((a,it)=>a+cellVal(sid,it.id,dk),0))*weightF()*100)/100;
}
function dayGroupTotal(dk){return Math.round(state.students.reduce((a,st)=>a+dayScore(st.id,dk),0)*100)/100;}
function weekTotal(sid,monday){let t=0;for(let i=0;i<7;i++){const d=addDays(monday,i);const dk=fmt(d);if(isSchoolDay(d,dk))t+=dayScore(sid,dk);}return Math.round(t*100)/100;}
function monthTotal(sid,y,m){let t=0;const n=monthDays(y,m);for(let d=1;d<=n;d++){const dt=new Date(y,m,d);const dk=fmt(dt);if(isSchoolDay(dt,dk))t+=dayScore(sid,dk);}return Math.round(t*100)/100;}
function weekGroupTotal(monday){return Math.round(state.students.reduce((a,st)=>a+weekTotal(st.id,monday),0)*100)/100;}
function monthGroupTotal(y,m){return Math.round(state.students.reduce((a,st)=>a+monthTotal(st.id,y,m),0)*100)/100;}
function itemWeekSum(sid,iid,monday){let t=0;for(let i=0;i<7;i++){const d=addDays(monday,i);const dk=fmt(d);if(isSchoolDay(d,dk))t+=cellVal(sid,iid,dk);}return Math.round(t*weightF()*100)/100;}
function itemMonthSum(sid,iid,y,m){let t=0;const n=monthDays(y,m);for(let d=1;d<=n;d++){const dt=new Date(y,m,d);const dk=fmt(dt);if(isSchoolDay(dt,dk))t+=cellVal(sid,iid,dk);}return Math.round(t*weightF()*100)/100;}
function studentName(id){const s=state.students.find(x=>x.id===id);return s?s.name:'(已删除)';}
function allTimeTotal(sid){
  const dks=Object.keys(state.scores||{}).filter(dk=>/^\d{4}-\d{2}-\d{2}$/.test(dk)).sort();
  if(!dks.length)return 0;
  const first=parseDate(dks[0]);
  const today=new Date();
  let t=0;
  for(let d=new Date(first);d<=today;d=addDays(d,1)){
    const dk=fmt(d);
    if(isSchoolDay(d,dk))t+=dayScore(sid,dk);
  }
  return Math.round(t*100)/100;
}
function avgOf(n){return state.students.length?Math.round(n/state.students.length*10)/10:0;}
function cellText(sid,iid,dk){
  const evs=cellEvents(sid,iid,dk);
  const base=itemDefault(iid);
  if(!evs.length)return base?('默认+'+base):'';
  const parts=evs.map(e=>{
    const who=e.by?'('+e.by+')':'';
    return (e.label?e.label:'')+(e.v>0?'+'+e.v:e.v)+who;
  });
  if(base)parts.unshift('默认+'+base);
  return parts.join('、');
}
function cellTextSimple(sid,iid,dk){
  const v=Math.round(cellVal(sid,iid,dk)*weightF()*100)/100;
  if(v===0)return '';
  return v>0?'+'+v:v;
}

/* ================= 公式 ================= */
function calcFormula(item,N){
  if(!item.formula)return null;
  const tiers=item.formula.tiers||{};
  if(tiers[N]!==undefined)return tiers[N];
  if(N>item.formula.minN)return null;
  const expr=String(item.formula.expr).replace(/N/g,'('+N+')');
  if(!/^[\d\s+\-*/().]+$/.test(expr))return null;
  try{const v=Function('"use strict";return ('+expr+')')();return Math.round(v*100)/100;}catch(e){return null;}
}
function formulaTotal(item,N){
  const base=calcFormula(item,N);
  if(base===null)return null;
  let total=base;const parts=[];
  (item.weights||[]).forEach(w=>{
    const on=(w.group==='xw'&&formulaWeights.xw===w.id)||(w.group==='top'&&formulaWeights.top.has(w.id));
    if(on){total+=base*w.pct/100;parts.push(w.label+'+'+w.pct+'%');}
  });
  total=Math.round(total*100)/100;
  return {base,total,parts};
}

/* ================= 导航 ================= */
function switchView(v){
  // 临时注释权限重定向，定位白屏问题
  // if(v==='settings'&&!canAccessSettings()){v='daily';}
  // if(v==='members'&&!canManageMembers()){v='daily';}
  if(v==='semester'){v='daily';}
  currentView=v;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===v));
  document.querySelectorAll('.view').forEach(el=>{
    el.classList.toggle('active',el.id==='view-'+v);
    if(el.id==='view-'+v){
      el.style.setProperty('display','block','important');
      el.style.background='#fff3cd'; // 临时黄色背景，确认显示
      el.style.minHeight='500px';
      el.style.padding='20px';
    }else{
      el.style.display='';
      el.style.background='';
    }
  });
  window.scrollTo(0,0);
  // 视图由隐藏变为可见后重绘，避免 display:none 期间按错误宽度画出的图表
  if(v==='daily')renderDaily();
  if(v==='weekly')renderWeekly();
  if(v==='monthly')renderMonthly();
  if(v==='myrecords')renderMyRecords();
  if(v==='members')renderMembers();
  if(v==='settings')renderSettings();
}
function render(){
  // 个人模式守卫：任何渲染前确保 students 已截断为自己（防止缓存完整版在初始化期间短暂泄露全组）
  try{
    if(isPersonalMode()&&state&&state.students&&state.students.length!==1){
      if(!state._allStudents)state._allStudents=state.students||[];
      state.students=(state.students||[]).filter(st=>st.name===currentUser.name);
    }
  }catch(e){}
  // 只渲染当前可见视图：全量渲染在手机端会造成卡顿/闪退（每次轮询重建 6 个视图的 DOM）
  try{
    const v=currentView||'daily';
    if(v==='weekly'){renderWeekly();return;}
    if(v==='monthly'){renderMonthly();return;}
    if(v==='myrecords'){renderMyRecords();return;}
    if(v==='members'){renderMembers();return;}
    if(v==='settings'){renderSettings();return;}
    renderDaily();
  }catch(e){
    console.error('渲染错误：', e);
    toast('页面渲染出错，请查看控制台');
  }
}

/* ================= 每日评分 ================= */
function renderDaily(){
  const dk=fmt(currentDate);
  const elDate=document.getElementById('dailyDate');if(!elDate)return;
  elDate.textContent=formatCN(currentDate)+' '+weekdayCN(currentDate);
  const elPicker=document.getElementById('dailyDatePicker');if(elPicker){elPicker.value=dk;elPicker.min='2026-08-31';}
  const elBT=document.getElementById('batchToggle');if(elBT)elBT.classList.toggle('on',batchMode);
  const elBH=document.getElementById('batchHint');if(elBH)elBH.classList.toggle('show',batchMode);
  const elBase=document.getElementById('baseToggle');
  if(elBase){
    const off=!!(state.baseOff&&state.baseOff[dk]);
    elBase.classList.toggle('on',!off);
    const bt=document.getElementById('baseToggleText');
    if(bt)bt.textContent=off?'无基础分':'基础分10';
  }
  const wb=document.getElementById('weightBtn');
  if(wb){const f=weightF();wb.textContent=f===1?'⚖️ 加权':'⚖️ 加权 ×'+Math.round(f*1000)/1000;}
  if(currentDate<MIN_DATE){
    document.getElementById('dailySummary').innerHTML=`<div class="summary-card" style="grid-column:1/-1"><div class="k">数据已归档</div><div class="v accent">—</div></div>`;
    document.getElementById('dailyTable').innerHTML=`<div class="empty-tip"><div class="big">🗄️</div><div class="t">该日期数据不可访问</div><div class="s">2026-08-30 及以前的数据已归档，仅可查看 2026-08-31 起的数据</div></div>`;
    return;
  }
  if(!isSchoolDay(currentDate,dk)){
    document.getElementById('dailySummary').innerHTML=`<div class="summary-card" style="grid-column:1/-1"><div class="k">今日无课</div><div class="v accent">0</div></div>`;
    document.getElementById('dailyTable').innerHTML=`<div class="empty-tip"><div class="big">🏖️</div><div class="t">今日无课（周末或节假日）</div><div class="s">不计算积分</div></div>`;
    return;
  }
  const group=dayGroupTotal(dk);
  const avg=avgOf(group);
  const totals=state.students.map(st=>({st,t:dayScore(st.id,dk)}));
  const best=totals.length?totals.reduce((a,b)=>b.t>a.t?b:a):null;
  document.getElementById('dailySummary').innerHTML=`
    <div class="summary-card"><div class="k">今日小组总分</div><div class="v accent">${group}</div></div>
    <div class="summary-card"><div class="k">今日人均</div><div class="v">${avg}</div></div>
    ${best?`<div class="summary-card"><div class="k">今日最高</div><div class="v pos">${esc(best.st.name)} · ${best.t}</div></div>`:''}`;
  const wrap=document.getElementById('dailyTable');
  if(state.students.length===0){
    wrap.innerHTML=`<div class="empty-tip"><div class="big">📋</div><div class="t">还没有成员</div><div class="s">请先到「成员管理」添加小组成员</div><button class="btn btn-primary" onclick="switchView('members')">去添加成员</button></div>`;
    return;
  }
  // 手机端转置：行=项目、列=人名，底部=个人总分（14 项竖排，不用横滑）
  if(window.innerWidth<=768){
    let h=`<div class="table-wrap"><table class="score-table"><thead><tr><th class="sticky-col">项目</th>`;
    state.students.forEach(st=>{h+=`<th>${esc(st.name)}</th>`;});
    h+=`</tr></thead><tbody>`;
    state.items.forEach(it=>{
      h+=`<tr><td class="sticky-col">${esc(it.name)}</td>`;
      state.students.forEach(st=>{
        const v=cellVal(st.id,it.id,dk);
        const cls=v>0?'pos':(v<0?'neg':'zero');
        const disp=v===0?'·':(v>0?'+'+v:v);
        const evs=cellEvents(st.id,it.id,dk);
        const evBadge=evs.length>1?`<span class="ev-count">${evs.length}</span>`:'';
        const hasNote=(state.notes[dk]||{})[st.id]?.[it.id]?'<span class="note-dot" title="有备注"></span>':'';
        h+=`<td class="cell" onclick="openScoreModal('${st.id}','${it.id}')"><span class="val ${cls}">${disp}</span>${evBadge}${hasNote}</td>`;
      });
      h+=`</tr>`;
    });
    h+=`<tr><td class="sticky-col" style="font-weight:700">个人总分</td>`;
    state.students.forEach(st=>{
      const t=dayScore(st.id,dk);
      const tcls=t>0?'pos':(t<0?'neg':'zero');
      h+=`<td class="total-col ${tcls}" style="font-weight:700">${t===0?'·':t}</td>`;
    });
    h+=`</tr></tbody></table></div>`;
    wrap.innerHTML=h;
    return;
  }
  let h=`<div class="table-wrap"><table class="score-table"><thead><tr><th class="sticky-col">${batchMode?'勾选成员':'姓名'}</th>`;
  state.items.forEach(it=>{h+=`<th>${esc(it.name)}</th>`;});
  h+=`<th class="total-col">个人总分</th></tr></thead><tbody>`;
  state.students.forEach(st=>{
    const sel=selectedStudents.has(st.id);
    h+=`<tr class="${sel?'selected':''}">`;
    h+=`<td class="sticky-col">${batchMode
      ?`<label class="name-check"><input type="checkbox" ${sel?'checked':''} onchange="toggleSelect('${st.id}')"><span>${esc(st.name)}</span></label>`
      :nameLink(st.id)}</td>`;
    state.items.forEach(it=>{
      const v=cellVal(st.id,it.id,dk);
      const cls=v>0?'pos':(v<0?'neg':'zero');
      const disp=v===0?'·':(v>0?'+'+v:v);
      const evs=cellEvents(st.id,it.id,dk);
      const evBadge=evs.length>1?`<span class="ev-count">${evs.length}</span>`:'';
      const hasNote=(state.notes[dk]||{})[st.id]?.[it.id]?'<span class="note-dot" title="有备注"></span>':'';
      h+=`<td class="cell" onclick="openScoreModal('${st.id}','${it.id}')"><span class="val ${cls}">${disp}</span>${evBadge}${hasNote}</td>`;
    });
    const t=dayScore(st.id,dk);
    const tcls=t>0?'pos':(t<0?'neg':'zero');
    h+=`<td class="total-col ${tcls}">${t===0?'·':t}</td></tr>`;
  });
  h+=`</tbody></table></div>`;
  wrap.innerHTML=h;
}

function shiftDate(n){currentDate=clampMinDate(addDays(currentDate,n));preloadMonth(currentDate.getFullYear(),currentDate.getMonth());renderDaily();}
function goToday(){currentDate=clampMinDate(new Date());preloadMonth(currentDate.getFullYear(),currentDate.getMonth());renderDaily();}
function pickDate(v){if(v){currentDate=clampMinDate(parseDate(v));preloadMonth(currentDate.getFullYear(),currentDate.getMonth());renderDaily();}}
function toggleBatch(){
  batchMode=!batchMode;
  if(!batchMode)selectedStudents.clear();
  renderDaily();
}
function toggleBase(){
  const dk=fmt(currentDate);
  if(!state.baseOff)state.baseOff={};
  if(state.baseOff[dk])delete state.baseOff[dk];else state.baseOff[dk]=true;
  save();renderDaily();
}
function toggleSelect(sid){
  if(selectedStudents.has(sid))selectedStudents.delete(sid);else selectedStudents.add(sid);
  renderDaily();
}
function targets(){
  return (batchMode&&selectedStudents.size>0)?[...selectedStudents]:[activeCell.sid];
}

/* ================= 评分弹窗 ================= */
function openScoreModal(sid,iid){
  activeCell={sid,iid};
  const item=state.items.find(i=>i.id===iid);
  const dk=fmt(currentDate);
  const tg=targets();
  formulaWeights={xw:null,top:new Set()};
  document.getElementById('scoreModalTitle').textContent=item.name;
  document.getElementById('scoreModalSub').textContent=formatCN(currentDate)+' · '+(tg.length>1?('选中 '+tg.length+' 位成员'):studentName(tg[0]));
  document.getElementById('scoreModalLbl').textContent=tg.length>1?'将应用到 '+tg.length+' 位成员':'当前分值';
  document.getElementById('noteInput').value=(state.notes[dk]||{})[tg[0]]?.[iid]||'';
  document.getElementById('presetSection').style.display=item.presets.length?'block':'none';
  renderFormulaSection();
  renderPresets();
  updateModalCurrent();
  renderEventHistory();
  document.getElementById('scoreModal').style.display='flex';
}
function closeScoreModal(){document.getElementById('scoreModal').style.display='none';activeCell=null;}
function renderPresets(){
  const item=state.items.find(i=>i.id===activeCell.iid);
  const grid=document.getElementById('presetGrid');
  if(!item.presets.length){
    grid.innerHTML=`<div style="grid-column:1/-1;font-size:12.5px;color:var(--ink-soft);text-align:center;padding:8px">该项目暂无预设按钮，可直接用下方自定义分值</div>`;
    return;
  }
  grid.innerHTML=item.presets.map(p=>{
    const cls=p.value>0?'pos':'neg';
    const sign=p.value>0?'+':'';
    return `<button class="preset-btn ${cls}" onclick="applyValue(${p.value},'${escJs(p.label)}')"><span class="pl">${esc(p.label)}</span><span class="pv">${sign}${p.value}</span></button>`;
  }).join('');
}
function updateModalCurrent(){
  const dk=fmt(currentDate);
  const tg=targets();
  const v=cellVal(tg[0],activeCell.iid,dk);
  const el=document.getElementById('scoreModalCurrent');
  el.textContent=v===0?'0':(v>0?'+'+v:v);
  el.className='val '+(v>0?'pos':(v<0?'neg':'zero'));
}
function renderEventHistory(){
  const dk=fmt(currentDate);
  const tg=targets();
  const el=document.getElementById('eventHistory');
  const evs=cellEvents(tg[0],activeCell.iid,dk);
  if(!evs.length){el.innerHTML=`<div class="eh-empty">暂无记录</div>`;return;}
  el.innerHTML=evs.map((e,idx)=>{
    const cls=e.v>0?'pos':'neg';
    const who=e.by||'本地';
    return `<div class="eh-item">
      <span class="eh-label">${esc(e.label||'记录')}</span>
      <span class="eh-who">${esc(who)}</span>
      <span class="eh-val ${cls}">${e.v>0?'+':''}${e.v}</span>
      ${isAdmin()?`<button class="eh-del" title="删除这条记录" onclick="deleteEvent(${idx})">✕</button>`:''}
    </div>`;
  }).join('');
}
function deleteEvent(idx){
  if(!isAdmin()){toast('仅管理员可删除记录');return;}
  if(!confirm('确定删除这条记录吗？'))return;
  pushHistory();
  const dk=fmt(currentDate);
  const tg=targets();
  tg.forEach(sid=>{
    const arr=state.scores[dk]?.[sid]?.[activeCell.iid];
    if(Array.isArray(arr)&&arr[idx])arr.splice(idx,1);
  });
  save();renderDaily();updateModalCurrent();renderEventHistory();
  toast('已删除该条记录');
}
function applyValue(value,label){
  pushHistory();
  const dk=fmt(currentDate);
  const tg=targets();
  if(!state.scores[dk])state.scores[dk]={};
  tg.forEach(sid=>{
    if(!state.scores[dk][sid])state.scores[dk][sid]={};
    if(!Array.isArray(state.scores[dk][sid][activeCell.iid]))state.scores[dk][sid][activeCell.iid]=[];
    state.scores[dk][sid][activeCell.iid].push(mkEvent(value,label||''));
  });
  save();renderDaily();updateModalCurrent();renderEventHistory();
  toast(`已为 ${tg.length} 位成员 ${value>0?'+':''}${value} 分`);
}
function applyCustom(mode){
  pushHistory();
  const input=document.getElementById('customValue');
  const v=parseFloat(input.value);
  if(isNaN(v)){toast('请输入有效数值');return;}
  const dk=fmt(currentDate);
  const tg=targets();
  if(!state.scores[dk])state.scores[dk]={};
  tg.forEach(sid=>{
    if(!state.scores[dk][sid])state.scores[dk][sid]={};
    if(mode==='set'){
      state.scores[dk][sid][activeCell.iid]=[mkEvent(v,'设为')];
    }else{
      if(!Array.isArray(state.scores[dk][sid][activeCell.iid]))state.scores[dk][sid][activeCell.iid]=[];
      state.scores[dk][sid][activeCell.iid].push(mkEvent(v,'自定义'));
    }
  });
  save();renderDaily();updateModalCurrent();renderEventHistory();
  input.value='';
  toast(mode==='set'?`已设为 ${v} 分`:`已为 ${tg.length} 位成员 ${v>0?'+':''}${v} 分`);
}
function saveNote(){
  pushHistory();
  const text=document.getElementById('noteInput').value.trim();
  const dk=fmt(currentDate);
  const tg=targets();
  if(!state.notes[dk])state.notes[dk]={};
  tg.forEach(sid=>{
    if(!state.notes[dk][sid])state.notes[dk][sid]={};
    if(text)state.notes[dk][sid][activeCell.iid]=text;else delete state.notes[dk][sid][activeCell.iid];
  });
  save();renderDaily();
  toast('备注已保存');
}
function clearCell(){
  if(!confirm('确定将该项目的分值清零吗？'))return;
  pushHistory();
  const dk=fmt(currentDate);
  const tg=targets();
  tg.forEach(sid=>{if(state.scores[dk]?.[sid])state.scores[dk][sid][activeCell.iid]=[];});
  save();renderDaily();updateModalCurrent();renderEventHistory();
  toast('已清零');
}

/* ================= 公式面板 ================= */
function renderFormulaSection(){
  const item=state.items.find(i=>i.id===activeCell.iid);
  const sec=document.getElementById('formulaSection');
  if(!item.formula){
    sec.style.display='none';
    return;
  }
  sec.style.display='block';
  document.getElementById('rankInput').value='';
  document.getElementById('formulaPreview').textContent='—';
  document.getElementById('formulaPreview').className='formula-preview';
  const wsec=document.getElementById('weightSection');
  const wopts=document.getElementById('weightOptions');
  if(item.weights&&item.weights.length){
    wsec.style.display='block';
    const xw=item.weights.filter(w=>w.group==='xw');
    const top=item.weights.filter(w=>w.group==='top');
    let h='';
    if(xw.length){
      h+=`<div class="weight-group"><span class="wg-label">${esc(xw[0].label)}加权（单选）</span>`;
      xw.forEach(w=>{
        h+=`<label class="wopt"><input type="radio" name="xwRadio" onchange="formulaWeights.xw='${w.id}';updateFormulaPreview()">${esc(w.label)} +${w.pct}%</label>`;
      });
      h+=`<label class="wopt"><input type="radio" name="xwRadio" checked onchange="formulaWeights.xw=null;updateFormulaPreview()">不选</label></div>`;
    }
    if(top.length){
      h+=`<div class="weight-group"><span class="wg-label">独立加权（可多选）</span>`;
      top.forEach(w=>{
        h+=`<label class="wopt"><input type="checkbox" onchange="if(this.checked)formulaWeights.top.add('${w.id}');else formulaWeights.top.delete('${w.id}');updateFormulaPreview()">${esc(w.label)} +${w.pct}%</label>`;
      });
      h+=`</div>`;
    }
    wopts.innerHTML=h;
  }else{
    wsec.style.display='none';
  }
}
function formulaMaxN(item){
  let m=item.formula.minN;
  const t=item.formula.tiers||{};
  for(const k in t){const n=+k;if(n>m)m=n;}
  return m;
}
function updateFormulaPreview(){
  const item=state.items.find(i=>i.id===activeCell.iid);
  const N=parseInt(document.getElementById('rankInput').value,10);
  const el=document.getElementById('formulaPreview');
  if(isNaN(N)){el.textContent='—';el.className='formula-preview';return;}
  const maxN=formulaMaxN(item);
  if(N<1||N>maxN){el.textContent='名次不合法（请输入 1~'+maxN+'）';el.className='formula-preview none';return;}
  const r=formulaTotal(item,N);
  if(r===null){el.textContent='该名次无对应计分规则';el.className='formula-preview none';return;}
  el.textContent=(r.total>0?'+':'')+r.total+' 分';
  el.className='formula-preview '+(r.total>0?'pos':(r.total<0?'neg':''));
}
function applyFormula(){
  pushHistory();
  const item=state.items.find(i=>i.id===activeCell.iid);
  const N=parseInt(document.getElementById('rankInput').value,10);
  if(isNaN(N)){toast('请输入名次');return;}
  const maxN=formulaMaxN(item);
  if(N<1||N>maxN){toast('名次不合法（请输入 1~'+maxN+'）');return;}
  const r=formulaTotal(item,N);
  if(r===null){toast('该名次无对应计分规则');return;}
  const label='名次'+N+(r.parts.length?'（'+r.parts.join('、')+'）':'');
  const dk=fmt(currentDate);
  const tg=targets();
  if(!state.scores[dk])state.scores[dk]={};
  tg.forEach(sid=>{
    if(!state.scores[dk][sid])state.scores[dk][sid]={};
    if(!Array.isArray(state.scores[dk][sid][activeCell.iid]))state.scores[dk][sid][activeCell.iid]=[];
    state.scores[dk][sid][activeCell.iid].push(mkEvent(r.total,label));
  });
  save();renderDaily();updateModalCurrent();renderEventHistory();
  toast(`已为 ${tg.length} 位成员 ${r.total>0?'+':''}${r.total} 分`);
}

/* ================= 周统计 ================= */
function weekDates(monday){
  const dates=[];
  for(let i=0;i<7;i++){
    const d=addDays(monday,i);
    if(isSchoolDay(d,fmt(d)))dates.push(d);
  }
  return dates;
}
function weekEndDate(monday){
  const dates=weekDates(monday);
  return dates.length?dates[dates.length-1]:addDays(monday,4);
}
function renderWeekly(){
  const monday=currentWeek;
  const dates=weekDates(monday);
  document.getElementById('weekLabel').textContent=monday.getFullYear()+'年 第'+weekOfDate(monday)+'周';
  if(monday<MIN_DATE){
    document.getElementById('weekRange').textContent='数据已归档';
    document.getElementById('weekSummary').innerHTML=`<div class="summary-card" style="grid-column:1/-1"><div class="k">数据已归档</div><div class="v accent">—</div></div>`;
    document.getElementById('weekTable').innerHTML=`<div class="empty-tip"><div class="big">🗄️</div><div class="t">该周数据不可访问</div><div class="s">2026-08-30 及以前的数据已归档，仅可查看 2026-08-31 起的数据</div></div>`;
    document.getElementById('weekItemTable').innerHTML='';
    return;
  }
  document.getElementById('weekRange').textContent=dates.length?(formatCN(dates[0])+' ~ '+formatCN(dates[dates.length-1])+' · '+dates.length+'天'):'本周无课';
  const totals=state.students.map(st=>({st,t:weekTotal(st.id,monday)}));
  const group=weekGroupTotal(monday);
  const avg=avgOf(group);
  const best=totals.length?totals.reduce((a,b)=>b.t>a.t?b:a):null;
  document.getElementById('weekSummary').innerHTML=`
    <div class="summary-card"><div class="k">本周小组总分</div><div class="v accent">${group}</div></div>
    <div class="summary-card"><div class="k">本周人均</div><div class="v">${avg}</div></div>
    ${best?`<div class="summary-card"><div class="k">本周最高</div><div class="v pos">${esc(best.st.name)} · ${best.t}</div></div>`:''}`;
  document.getElementById('weekRankTable').innerHTML=buildWeekRankTable(monday);
  drawTrendChart('week',monday);
  drawPieChart('week',monday);
}
function rankBadge(n){
  const cls=n===1?'rank-1':(n===2?'rank-2':(n===3?'rank-3':'rank-n'));
  return `<span class="rank-badge ${cls}">${n}</span>`;
}
function buildWeekRankTable(monday){
  if(!state.students.length)return emptyTip();
  // 计算每个学生本周总分（含基础分，weekTotal已包含）
  const rows=state.students.map(st=>({st,t:weekTotal(st.id,monday)})).sort((a,b)=>b.t-a.t);
  const maxT=rows.length?Math.max(...rows.map(r=>Math.abs(r.t)),1):1;
  const group=weekGroupTotal(monday);
  const avg=avgOf(group);
  let h=`<div style="display:flex;flex-direction:column;gap:6px">`;
  rows.forEach(({st,t},idx)=>{
    const pct=Math.max(5,Math.round(Math.abs(t)/maxT*100));
    const cls=t>0?'pos':(t<0?'neg':'zero');
    const barColor=t>=0?'linear-gradient(90deg,#4caf50,#8bc34a)':'linear-gradient(90deg,#f44336,#ff9800)';
    h+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--card);border-radius:8px;border:1px solid var(--line)">`;
    h+=`<div style="width:28px;text-align:center;flex-shrink:0">${rankBadge(idx+1)}</div>`;
    h+=`<div style="flex:1;min-width:0;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(st.name)}</div>`;
    h+=`<div style="width:70px;text-align:right;font-family:var(--font-mono);font-weight:700;font-size:14px" class="${cls}">${t}</div>`;
    h+=`</div>`;
    // 进度条
    h+=`<div style="height:4px;background:#eee;border-radius:2px;margin:-2px 0 2px 36px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${barColor};border-radius:2px"></div></div>`;
  });
  // 小组汇总
  h+=`<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f6f0e4;border-radius:8px;margin-top:4px;font-weight:700">`;
  h+=`<div style="width:28px;text-align:center;flex-shrink:0">👥</div>`;
  h+=`<div style="flex:1;font-size:13px">小组总分 / 人均</div>`;
  h+=`<div style="width:70px;text-align:right;font-family:var(--font-mono);font-size:13px">${group} / ${avg}</div>`;
  h+=`</div>`;
  h+=`</div>`;
  return h;
}
function buildWeekTable(monday,dates){
  if(!state.students.length)return emptyTip();
  // 手机端转置：行=日期、列=人名，底部=每日小组总分（7天竖排，手机宽度不用横滑）
  if(window.innerWidth<=900){
    let h=`<table class="score-table"><thead><tr><th class="sticky-col">日期</th>`;
    state.students.forEach(st=>{h+=`<th>${esc(st.name)}</th>`;});
    h+=`<th style="background:#f0ebe3;font-weight:700">日总分</th></tr></thead><tbody>`;
    dates.forEach(d=>{
      const dk=fmt(d);
      h+=`<tr><td class="sticky-col">${weekdayCN(d)} ${d.getMonth()+1}/${d.getDate()}</td>`;
      let daySum=0;
      state.students.forEach(st=>{
        const v=dayScore(st.id,dk);
        daySum+=v;
        const cls=v>0?'pos':(v<0?'neg':'zero');
        h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:600">${v===0?'·':v}</td>`;
      });
      daySum=Math.round(daySum*100)/100;
      const cls=daySum>0?'pos':(daySum<0?'neg':'zero');
      h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:700">${daySum}</td></tr>`;
    });
    // 周总分行
    h+=`<tr><td class="sticky-col" style="font-weight:700;background:#f6f0e4">周总分</td>`;
    state.students.forEach(st=>{
      const v=weekTotal(st.id,monday);
      const cls=v>0?'pos':(v<0?'neg':'zero');
      h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:700">${v}</td>`;
    });
    const group=weekGroupTotal(monday);
    h+=`<td style="font-family:var(--font-mono);font-weight:700;background:#f6f0e4">${group}</td></tr>`;
    h+=`</tbody></table>`;
    return h;
  }
  // PC端：原横向表格（行=学生、列=日期）
  const rows=state.students.map(st=>({st,t:weekTotal(st.id,monday)})).sort((a,b)=>b.t-a.t);
  let h=`<table class="score-table"><thead><tr><th style="position:sticky;left:0;z-index:4;background:#f6f0e4;min-width:46px;text-align:center;padding-left:6px;padding-right:6px">名次</th><th class="sticky-col" style="left:46px">姓名</th>`;
  dates.forEach(d=>{h+=`<th>${weekdayCN(d)}<br><span style="font-weight:400;font-size:11px">${d.getMonth()+1}/${d.getDate()}</span></th>`;});
  h+=`<th class="total-col">周总分</th></tr></thead><tbody>`;
  rows.forEach(({st,t},idx)=>{
    h+=`<tr><td style="position:sticky;left:0;z-index:2;background:var(--card);text-align:center;padding-left:6px;padding-right:6px">${rankBadge(idx+1)}</td><td class="sticky-col" style="left:46px">${nameLink(st.id)}</td>`;
    dates.forEach(d=>{
      const v=dayScore(st.id,fmt(d));
      const cls=v>0?'pos':(v<0?'neg':'zero');
      h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:600">${v===0?'·':v}</td>`;
    });
    const cls=t>0?'pos':(t<0?'neg':'zero');
    h+=`<td class="total-col ${cls}">${t}</td></tr>`;
  });
  const group=weekGroupTotal(monday);
  const avg=avgOf(group);
  h+=`<tr><td style="position:sticky;left:0;z-index:2;background:var(--card);text-align:center;padding-left:6px;padding-right:6px"></td><td class="sticky-col" style="left:46px;font-weight:700">小组总分</td>${dates.map(d=>{const g=dayGroupTotal(fmt(d));return `<td style="font-family:var(--font-mono);font-weight:700">${g}</td>`;}).join('')}<td class="total-col">${group}</td></tr>`;
  h+=`<tr><td style="position:sticky;left:0;z-index:2;background:var(--card);text-align:center;padding-left:6px;padding-right:6px"></td><td class="sticky-col" style="left:46px;font-weight:700">平均分</td>${dates.map(d=>{const g=dayGroupTotal(fmt(d));return `<td style="font-family:var(--font-mono);font-weight:700">${avgOf(g)}</td>`;}).join('')}<td class="total-col">${avg}</td></tr>`;
  h+=`</tbody></table>`;
  return h;
}
function buildItemTable(scope,ref){
  if(!state.students.length)return emptyTip();
  // 手机端转置：行=项目、列=人名，底部=个人总分（14 项竖排，手机宽度不用横滑）
  if(window.innerWidth<=768){
    let h=`<table class="score-table"><thead><tr><th class="sticky-col">项目</th>`;
    state.students.forEach(st=>{h+=`<th>${esc(st.name)}</th>`;});
    h+=`</tr></thead><tbody>`;
    state.items.forEach(it=>{
      h+=`<tr><td class="sticky-col">${esc(it.name)}</td>`;
      state.students.forEach(st=>{
        const v=scope==='week'?itemWeekSum(st.id,it.id,ref):itemMonthSum(st.id,it.id,ref.y,ref.m);
        const cls=v>0?'pos':(v<0?'neg':'zero');
        h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:600">${v===0?'·':v}</td>`;
      });
      h+=`</tr>`;
    });
    h+=`<tr><td class="sticky-col" style="font-weight:700">个人总分</td>`;
    state.students.forEach(st=>{
      let total=0;
      state.items.forEach(it=>{total+=scope==='week'?itemWeekSum(st.id,it.id,ref):itemMonthSum(st.id,it.id,ref.y,ref.m);});
      const cls=Math.round(total*100)/100>0?'pos':(total<0?'neg':'zero');
      h+=`<td class="total-col ${cls}" style="font-weight:700">${Math.round(total*100)/100}</td>`;
    });
    h+=`</tr></tbody></table>`;
    return h;
  }
  let h=`<table class="score-table"><thead><tr><th class="sticky-col">姓名</th>`;
  state.items.forEach(it=>{h+=`<th>${esc(it.name)}</th>`;});
  h+=`<th class="total-col">总分</th></tr></thead><tbody>`;
  state.students.forEach(st=>{
    h+=`<tr><td class="sticky-col">${nameLink(st.id)}</td>`;
    let total=0;
    state.items.forEach(it=>{
      const v=scope==='week'?itemWeekSum(st.id,it.id,ref):itemMonthSum(st.id,it.id,ref.y,ref.m);
      total+=v;
      const cls=v>0?'pos':(v<0?'neg':'zero');
      h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:600">${v===0?'·':v}</td>`;
    });
    const cls=Math.round(total*100)/100>0?'pos':(total<0?'neg':'zero');
    h+=`<td class="total-col ${cls}">${Math.round(total*100)/100}</td></tr>`;
  });
  h+=`</tbody></table>`;
  return h;
}
function shiftWeek(n){currentWeek=clampMinDate(startOfWeek(addDays(currentWeek,n*7)));preloadMonth(currentWeek.getFullYear(),currentWeek.getMonth());preloadMonth(addDays(currentWeek,4).getFullYear(),addDays(currentWeek,4).getMonth());renderWeekly();}
function goThisWeek(){currentWeek=clampMinDate(startOfWeek(new Date()));renderWeekly();}

/* ================= 图表 ================= */
const CHART_COLORS=['#c0392b','#2e7d32','#1e6f9f','#8e44ad','#d68910','#16a085','#c2185b','#546e7a'];
function drawTrendChart(scope,ref){
  const prefix=scope==='week'?'week':'month';
  const card=document.getElementById(prefix+'TrendCard');
  const canvas=document.getElementById(prefix+'TrendCanvas');
  const sub=document.getElementById(prefix+'TrendSub');
  const legend=document.getElementById(prefix+'TrendLegend');
  if(!card||!canvas)return;
  if(!state.students.length){card.style.display='none';return;}
  let labels=[],series=[];
  if(scope==='week'){
    const monday=ref;
    const dates=weekDates(monday);
    dates.forEach(d=>labels.push(weekdayCN(d)));
    const rows=state.students.map(st=>({st,t:weekTotal(st.id,monday)})).sort((a,b)=>b.t-a.t);
    rows.slice(0,5).forEach(({st})=>{
      const pts=dates.map(d=>dayScore(st.id,fmt(d)));
      series.push({name:st.name,pts});
    });
    sub.textContent=dates.length?(formatCN(dates[0])+' ~ '+formatCN(dates[dates.length-1])+'（总分前5名）'):'本周无课';
  }else{
    const {y,m}=ref;
    const weeks=monthWeeks(y,m);
    weeks.forEach((w,i)=>labels.push('第'+(i+1)+'周'));
    const rows=state.students.map(st=>({st,t:monthTotal(st.id,y,m)})).sort((a,b)=>b.t-a.t);
    rows.slice(0,5).forEach(({st})=>{
      const pts=weeks.map(w=>{let t=0;w.forEach(d=>t+=dayScore(st.id,fmt(d)));return Math.round(t*100)/100;});
      series.push({name:st.name,pts});
    });
    sub.textContent=y+'年'+(m+1)+'月（总分前5名）';
  }
  const hasData=series.some(s=>s.pts.some(v=>v!==0));
  if(!hasData){card.style.display='none';return;}
  card.style.display='block';
  const dpr=window.devicePixelRatio||1;
  const W=Math.max(canvas.parentElement.clientWidth-4,320);
  const H=240;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const padL=34,padR=16,padT=14,padB=30;
  const cw=W-padL-padR,ch=H-padT-padB;
  let min=0,max=0;
  series.forEach(s=>s.pts.forEach(v=>{if(v<min)min=v;if(v>max)max=v;}));
  if(min>0)min=0;if(max<0)max=0;
  if(max===min)max=min+1;
  const yVal=v=>padT+ch-(v-min)/(max-min)*ch;
  ctx.strokeStyle='#efe7d9';ctx.fillStyle='#7a6d61';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
  const steps=4;
  for(let i=0;i<=steps;i++){
    const v=min+(max-min)*i/steps;
    const y=yVal(v);
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillText(Math.round(v),padL-6,y);
  }
  ctx.textAlign='center';ctx.textBaseline='top';
  const stepX=cw/labels.length;
  labels.forEach((lb,i)=>{ctx.fillText(lb,padL+stepX*i+stepX/2,H-padB+8);});
  series.forEach((s,si)=>{
    const color=CHART_COLORS[si%CHART_COLORS.length];
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin='round';
    ctx.beginPath();
    s.pts.forEach((v,i)=>{
      const x=padL+stepX*i+stepX/2;
      const y=yVal(v);
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    });
    ctx.stroke();
    s.pts.forEach((v,i)=>{
      const x=padL+stepX*i+stepX/2;
      const y=yVal(v);
      ctx.fillStyle=color;
      ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(x,y,1.4,0,Math.PI*2);ctx.fill();
    });
  });
  legend.innerHTML=series.map((s,si)=>`<span class="legend-item"><span class="legend-dot" style="background:${CHART_COLORS[si%CHART_COLORS.length]}"></span>${esc(s.name)}</span>`).join('');
}
function drawPieChart(scope,ref){
  const prefix=scope==='week'?'week':'month';
  const card=document.getElementById(prefix+'PieCard');
  const canvas=document.getElementById(prefix+'PieCanvas');
  const legend=document.getElementById(prefix+'PieLegend');
  if(!card||!canvas)return;
  if(!state.students.length){card.style.display='none';return;}
  const data=[];
  state.items.forEach(it=>{
    let t=0;
    state.students.forEach(st=>{
      t+=scope==='week'?itemWeekSum(st.id,it.id,ref):itemMonthSum(st.id,it.id,ref.y,ref.m);
    });
    t=Math.round(t*100)/100;
    if(t!==0)data.push({name:it.name,val:Math.abs(t),sign:t>0?1:-1});
  });
  if(!data.length){card.style.display='none';return;}
  card.style.display='block';
  const dpr=window.devicePixelRatio||1;
  const W=Math.max(canvas.parentElement.clientWidth-4,320);
  const H=240;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const total=data.reduce((a,d)=>a+d.val,0);
  const cx=W/2,cy=H/2,rad=Math.min(W,H)/2-26;
  let start=-Math.PI/2;
  data.forEach((d,i)=>{
    const angle=d.val/total*Math.PI*2;
    const color=CHART_COLORS[i%CHART_COLORS.length];
    ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,rad,start,start+angle);ctx.closePath();ctx.fill();
    const mid=start+angle/2;
    const pct=Math.round(d.val/total*100);
    if(pct>=5){
      const lx=cx+Math.cos(mid)*rad*0.62;
      const ly=cy+Math.sin(mid)*rad*0.62;
      ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(pct+'%',lx,ly);
    }
    start+=angle;
  });
  legend.innerHTML=data.map((d,i)=>`<span class="legend-item"><span class="legend-dot" style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></span>${esc(d.name)} ${d.sign>0?'+':''}${d.sign>0?d.val:-d.val}</span>`).join('');
}

/* ================= 月统计 ================= */
function renderMonthly(){
  const {y,m}=currentMonth;
  document.getElementById('monthLabel').textContent=y+'年'+(m+1)+'月';
  if(new Date(y,m,monthDays(y,m))<MIN_DATE){
    document.getElementById('monthRange').textContent='数据已归档';
    document.getElementById('monthSummary').innerHTML=`<div class="summary-card" style="grid-column:1/-1"><div class="k">数据已归档</div><div class="v accent">—</div></div>`;
    document.getElementById('monthTable').innerHTML=`<div class="empty-tip"><div class="big">🗄️</div><div class="t">该月数据不可访问</div><div class="s">2026-08-30 及以前的数据已归档，仅可查看 2026-08-31 起的数据</div></div>`;
    document.getElementById('monthItemTable').innerHTML='';
    return;
  }
  document.getElementById('monthRange').textContent=y+'年'+(m+1)+'月 积分汇总';
  const totals=state.students.map(st=>({st,t:monthTotal(st.id,y,m)}));
  const group=monthGroupTotal(y,m);
  const avg=avgOf(group);
  const schoolDays=monthSchoolDays(y,m);
  const dailyGroup=schoolDays?Math.round(group/schoolDays*100)/100:'·';
  const best=totals.length?totals.reduce((a,b)=>b.t>a.t?b:a):null;
  document.getElementById('monthSummary').innerHTML=`
    <div class="summary-card"><div class="k">本月小组总分</div><div class="v accent">${group}</div></div>
    <div class="summary-card"><div class="k">人均月总分</div><div class="v">${avg}</div></div>
    
    ${best?`<div class="summary-card"><div class="k">本月最高</div><div class="v pos">${esc(best.st.name)} · ${best.t}</div></div>`:''}`;
  const mt=document.getElementById('monthTable');if(mt)mt.innerHTML=buildMonthTable(y,m);
  const mit=document.getElementById('monthItemTable');if(mit)mit.innerHTML=buildItemTable('month',currentMonth);
  drawTrendChart('month',currentMonth);
  drawPieChart('month',currentMonth);
}
// 该月实际上课天数（剔除周末与法定节假日，调休补班算上课；已归档日期不计入）
function monthSchoolDays(y,m){
  let n=0;const days=monthDays(y,m);
  for(let d=1;d<=days;d++){
    const dt=new Date(y,m,d);
    const dk=fmt(dt);
    if(!isArchived(dk)&&isSchoolDay(dt,dk))n++;
  }
  return n;
}
function monthWeeks(y,m){
  const n=monthDays(y,m);
  const first=new Date(y,m,1);
  const last=new Date(y,m,n);
  const monday=startOfWeek(first);
  const weeks=[];
  let cur=[];
  for(let d=new Date(monday);d<=last;d=addDays(d,1)){
    if(d.getDay()===1&&cur.length){weeks.push(cur);cur=[];}
    if(d>=first)cur.push(new Date(d));
  }
  if(cur.length)weeks.push(cur);
  return weeks;
}
function buildMonthTable(y,m){
  if(!state.students.length)return emptyTip();
  const weeks=monthWeeks(y,m);
  const rows=state.students.map(st=>({st,t:monthTotal(st.id,y,m)})).sort((a,b)=>b.t-a.t);
  let h=`<table class="score-table"><thead><tr><th style="position:sticky;left:0;z-index:4;background:#f6f0e4;min-width:46px;text-align:center;padding-left:6px;padding-right:6px">名次</th><th class="sticky-col" style="left:46px">姓名</th>`;
  weeks.forEach((ws,wi)=>{
    const school=ws.filter(d=>isSchoolDay(d,fmt(d)));
    h+=`<th>第${wi+1}周<br><span style="font-weight:400;font-size:11px">${ws[0].getMonth()+1}/${ws[0].getDate()}~${ws[ws.length-1].getMonth()+1}/${ws[ws.length-1].getDate()}</span>${school.length<ws.length?`<br><span style="font-weight:400;font-size:10px;color:var(--ink-soft)">${school.length}天有课</span>`:''}</th>`;
  });
  h+=`<th class="total-col">月总分</th></tr></thead><tbody>`;
  rows.forEach(({st,t},idx)=>{
    h+=`<tr><td style="position:sticky;left:0;z-index:2;background:var(--card);text-align:center;padding-left:6px;padding-right:6px">${rankBadge(idx+1)}</td><td class="sticky-col" style="left:46px">${nameLink(st.id)}</td>`;
    weeks.forEach(ws=>{
      let tw=0;
      ws.forEach(d=>tw+=dayScore(st.id,fmt(d)));
      tw=Math.round(tw*100)/100;
      const cls=tw>0?'pos':(tw<0?'neg':'zero');
      h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:600">${tw===0?'·':tw}</td>`;
    });
    const cls=t>0?'pos':(t<0?'neg':'zero');
    h+=`<td class="total-col ${cls}">${t}</td></tr>`;
  });
  const group=monthGroupTotal(y,m);
  const avg=avgOf(group);
  h+=`<tr><td style="position:sticky;left:0;z-index:2;background:var(--card);text-align:center;padding-left:6px;padding-right:6px"></td><td class="sticky-col" style="left:46px;font-weight:700">小组总分</td>${weeks.map(w=>{let t=0;w.forEach(d=>t+=dayGroupTotal(fmt(d)));t=Math.round(t*100)/100;return `<td style="font-family:var(--font-mono);font-weight:700">${t}</td>`;}).join('')}<td class="total-col">${group}</td></tr>`;
  h+=`<tr><td style="position:sticky;left:0;z-index:2;background:var(--card);text-align:center;padding-left:6px;padding-right:6px"></td><td class="sticky-col" style="left:46px;font-weight:700">平均分</td>${weeks.map(w=>{let t=0;w.forEach(d=>t+=dayGroupTotal(fmt(d)));t=Math.round(t*100)/100;return `<td style="font-family:var(--font-mono);font-weight:700">${avgOf(t)}</td>`;}).join('')}<td class="total-col">${avg}</td></tr>`;

  h+=`</tbody></table>`;
  return h;
}
function shiftMonth(n){
  let y=currentMonth.y,m=currentMonth.m+n;
  while(m<0){m+=12;y--;}
  while(m>11){m-=12;y++;}
  // 最早可访问月份：2026-08-31 是 8 月最后一天，月视图最早显示 2026-09
  let minY=MIN_DATE.getFullYear(),minM=MIN_DATE.getMonth()+1;
  if(minM>11){minM=0;minY++;}
  if(y<minY||(y===minY&&m<minM)){y=minY;m=minM;}
  currentMonth={y,m};
  preloadMonth(currentMonth.y,currentMonth.m);
  renderMonthly();
}
function goThisMonth(){currentMonth={y:new Date().getFullYear(),m:new Date().getMonth()};preloadMonth(currentMonth.y,currentMonth.m);renderMonthly();}
function emptyTip(){return `<div class="empty-tip"><div class="big">📋</div><div class="t">还没有成员</div><div class="s">请先到「成员管理」添加小组成员</div></div>`;}

/* ================= 学期报告 ================= */
function semesterWeeks(){
  const dks=Object.keys(state.scores||{}).filter(dk=>/^\d{4}-\d{2}-\d{2}$/.test(dk)&&!isArchived(dk)).sort();
  if(!dks.length)return [];
  const first=startOfWeek(new Date(dks[0]));
  const last=startOfWeek(new Date(dks[dks.length-1]));
  const weeks=[];
  for(let w=first;w<=last;w=addDays(w,7))weeks.push(w);
  return weeks;
}
function renderSemester(){
  const weeks=semesterWeeks();
  const elRange=document.getElementById('semesterRange');
  if(!state.students.length||!weeks.length){
    elRange.textContent='暂无数据';
    document.getElementById('semesterSummary').innerHTML='';
    document.getElementById('semesterTable').innerHTML=emptyTip();
    document.getElementById('semesterProgress').innerHTML='<div class="progress-empty">暂无数据</div>';
    document.getElementById('semesterBarCard').style.display='none';
    document.getElementById('semesterPieCard').style.display='none';
    document.getElementById('semesterItemTable').innerHTML='';
    return;
  }
  const first=weeks[0],last=weekEndDate(weeks[weeks.length-1]);
  elRange.textContent=formatCN(first)+' ~ '+formatCN(last)+' · 共 '+weeks.length+' 周';
  const rows=state.students.map(st=>({st,t:allTimeTotal(st.id)})).sort((a,b)=>b.t-a.t);
  const group=rows.reduce((a,r)=>a+r.t,0);
  const avg=avgOf(group);
  const best=rows[0];
  document.getElementById('semesterSummary').innerHTML=`
    <div class="summary-card"><div class="k">学期小组总分</div><div class="v accent">${group}</div></div>
    <div class="summary-card"><div class="k">学期人均</div><div class="v">${avg}</div></div>
    <div class="summary-card"><div class="k">统计周数</div><div class="v">${weeks.length}</div></div>
    ${best?`<div class="summary-card"><div class="k">学期最高</div><div class="v pos">${esc(best.st.name)} · ${best.t}</div></div>`:''}`;
  document.getElementById('semesterTable').innerHTML=buildSemesterTable(rows);
  document.getElementById('semesterProgress').innerHTML=buildProgressStars(weeks);
  document.getElementById('semesterItemTable').innerHTML=buildSemesterItemTable();
  drawSemesterBar(weeks);
  drawSemesterPie();
}
function buildSemesterTable(rows){
  let h=`<table class="score-table"><thead><tr><th style="position:sticky;left:0;z-index:4;background:#f6f0e4;min-width:46px;text-align:center;padding-left:6px;padding-right:6px">名次</th><th class="sticky-col" style="left:46px">姓名</th>`;
  state.items.forEach(it=>{h+=`<th>${esc(it.name)}</th>`;});
  h+=`<th class="total-col">总分</th></tr></thead><tbody>`;
  rows.forEach(({st,t},idx)=>{
    h+=`<tr><td style="position:sticky;left:0;z-index:2;background:var(--card);text-align:center;padding-left:6px;padding-right:6px">${rankBadge(idx+1)}</td><td class="sticky-col" style="left:46px">${nameLink(st.id)}</td>`;
    let total=0;
    state.items.forEach(it=>{
      const v=allTimeItemSum(st.id,it.id);
      total+=v;
      const cls=v>0?'pos':(v<0?'neg':'zero');
      h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:600">${v===0?'·':v}</td>`;
    });
    const cls=t>0?'pos':(t<0?'neg':'zero');
    h+=`<td class="total-col ${cls}">${t}</td></tr>`;
  });
  h+=`</tbody></table>`;
  return h;
}
function allTimeItemSum(sid,iid){
  let t=0;
  for(const dk in state.scores){
    if(!isSchoolDay(parseDate(dk),dk))continue;
    t+=cellVal(sid,iid,dk);
  }
  return Math.round(t*100)/100;
}
function buildSemesterItemTable(){
  let h=`<table class="score-table"><thead><tr><th class="sticky-col">姓名</th>`;
  state.items.forEach(it=>{h+=`<th>${esc(it.name)}</th>`;});
  h+=`<th class="total-col">总分</th></tr></thead><tbody>`;
  state.students.forEach(st=>{
    h+=`<tr><td class="sticky-col">${nameLink(st.id)}</td>`;
    let total=0;
    state.items.forEach(it=>{
      const v=allTimeItemSum(st.id,it.id);
      total+=v;
      const cls=v>0?'pos':(v<0?'neg':'zero');
      h+=`<td class="${cls}" style="font-family:var(--font-mono);font-weight:600">${v===0?'·':v}</td>`;
    });
    const cls=Math.round(total*100)/100>0?'pos':(total<0?'neg':'zero');
    h+=`<td class="total-col ${cls}">${Math.round(total*100)/100}</td></tr>`;
  });
  h+=`</tbody></table>`;
  return h;
}
function buildProgressStars(weeks){
  if(weeks.length<2)return '<div class="progress-empty">数据不足两周，无法计算进步</div>';
  const half=Math.floor(weeks.length/2);
  const firstHalf=weeks.slice(0,half),secondHalf=weeks.slice(half);
  const sumWeeks=(sid,ws)=>{let t=0;ws.forEach(w=>t+=weekTotal(sid,w));return Math.round(t*100)/100;};
  const items=state.students.map(st=>{
    const a=sumWeeks(st.id,firstHalf),b=sumWeeks(st.id,secondHalf);
    return {st,a,b,delta:b-a};
  });
  const up=items.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,5);
  const down=items.filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta).slice(0,3);
  let h='';
  if(up.length){
    h+=`<div class="section-label" style="margin-top:0">📈 进步最快</div>`;
    up.forEach(x=>{
      h+=`<div class="progress-item"><div class="avatar">${esc(x.st.name[0])}</div><div class="info"><div class="name">${esc(x.st.name)}</div><div class="sub">前半段 ${x.a} → 后半段 ${x.b}</div></div><div class="delta up">+${x.delta}</div></div>`;
    });
  }
  if(down.length){
    h+=`<div class="section-label">📉 需要关注</div>`;
    down.forEach(x=>{
      h+=`<div class="progress-item"><div class="avatar" style="background:#8d8d8d">${esc(x.st.name[0])}</div><div class="info"><div class="name">${esc(x.st.name)}</div><div class="sub">前半段 ${x.a} → 后半段 ${x.b}</div></div><div class="delta down">${x.delta}</div></div>`;
    });
  }
  if(!up.length&&!down.length)h='<div class="progress-empty">暂无进步数据</div>';
  return h;
}
function drawSemesterBar(weeks){
  const card=document.getElementById('semesterBarCard');
  const canvas=document.getElementById('semesterBarCanvas');
  const sub=document.getElementById('semesterBarSub');
  const legend=document.getElementById('semesterBarLegend');
  if(!card||!canvas)return;
  const data=weeks.map((w,i)=>({label:'第'+(i+1)+'周',val:weekGroupTotal(w)}));
  const hasData=data.some(d=>d.val!==0);
  if(!hasData){card.style.display='none';return;}
  card.style.display='block';
  sub.textContent=formatCN(weeks[0])+' ~ '+formatCN(weekEndDate(weeks[weeks.length-1]))+' · 小组每周总分';
  const dpr=window.devicePixelRatio||1;
  const W=Math.max(canvas.parentElement.clientWidth-4,320);
  const H=240;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const padL=34,padR=16,padT=14,padB=30;
  const cw=W-padL-padR,ch=H-padT-padB;
  let min=0,max=0;
  data.forEach(d=>{if(d.val<min)min=d.val;if(d.val>max)max=d.val;});
  if(max===min)max=min+1;
  const yVal=v=>padT+ch-(v-min)/(max-min)*ch;
  ctx.strokeStyle='#efe7d9';ctx.fillStyle='#7a6d61';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
  const steps=4;
  for(let i=0;i<=steps;i++){
    const v=min+(max-min)*i/steps;
    const y=yVal(v);
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillText(Math.round(v),padL-6,y);
  }
  const stepX=cw/data.length;
  const barW=Math.min(stepX*0.55,34);
  data.forEach((d,i)=>{
    const x=padL+stepX*i+stepX/2;
    const y=yVal(d.val);
    const color=d.val>=0?'#c0392b':'#8d8d8d';
    ctx.fillStyle=color;
    ctx.fillRect(x-barW/2,Math.min(y,yVal(0)),barW,Math.abs(yVal(0)-y));
    ctx.fillStyle='#7a6d61';ctx.textAlign='center';ctx.textBaseline='bottom';
    if(d.val!==0)ctx.fillText(d.val,x,y-3);
    ctx.textBaseline='top';
    ctx.fillText(d.label,x,H-padB+8);
  });
  legend.innerHTML=`<span class="legend-item"><span class="legend-dot" style="background:#c0392b"></span>小组周总分</span>`;
}
function drawSemesterPie(){
  const card=document.getElementById('semesterPieCard');
  const canvas=document.getElementById('semesterPieCanvas');
  const legend=document.getElementById('semesterPieLegend');
  if(!card||!canvas)return;
  const data=[];
  state.items.forEach(it=>{
    let t=0;
    state.students.forEach(st=>t+=allTimeItemSum(st.id,it.id));
    t=Math.round(t*100)/100;
    if(t!==0)data.push({name:it.name,val:Math.abs(t),sign:t>0?1:-1});
  });
  if(!data.length){card.style.display='none';return;}
  card.style.display='block';
  const dpr=window.devicePixelRatio||1;
  const W=Math.max(canvas.parentElement.clientWidth-4,320);
  const H=240;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const total=data.reduce((a,d)=>a+d.val,0);
  const cx=W/2,cy=H/2,rad=Math.min(W,H)/2-26;
  let start=-Math.PI/2;
  data.forEach((d,i)=>{
    const angle=d.val/total*Math.PI*2;
    const color=CHART_COLORS[i%CHART_COLORS.length];
    ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,rad,start,start+angle);ctx.closePath();ctx.fill();
    const mid=start+angle/2;
    const pct=Math.round(d.val/total*100);
    if(pct>=5){
      const lx=cx+Math.cos(mid)*rad*0.62;
      const ly=cy+Math.sin(mid)*rad*0.62;
      ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(pct+'%',lx,ly);
    }
    start+=angle;
  });
  legend.innerHTML=data.map((d,i)=>`<span class="legend-item"><span class="legend-dot" style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></span>${esc(d.name)} ${d.sign>0?'+':''}${d.sign>0?d.val:-d.val}</span>`).join('');
}

/* ================= 个人积分卡片 ================= */
function nameLink(sid){
  return `<a class="name-link" onclick="showStudentCard('${sid}')">${esc(studentName(sid))}</a>`;
}
function studentRank(sid){
  const rows=state.students.map(st=>({id:st.id,t:allTimeTotal(st.id)})).sort((a,b)=>b.t-a.t);
  return rows.findIndex(r=>r.id===sid)+1;
}
function showStudentCard(sid){
  const st=state.students.find(s=>s.id===sid);
  if(!st)return;
  const t=allTimeTotal(sid);
  const rank=studentRank(sid);
  const tcls=t>0?'pos':(t<0?'neg':'zero');
  document.getElementById('studentCardHead').innerHTML=`
    <div class="student-card-summary" style="border:none;padding:0;margin:0;background:transparent">
      <div class="scs-avatar">${esc(st.name[0])}</div>
      <div class="scs-info">
        <div class="scs-name">${esc(st.name)}</div>
        <div class="scs-meta">共 ${state.students.length} 名成员 · 点击姓名即可查看</div>
      </div>
      <div class="scs-nums">
        <div class="scs-num"><div class="k">总积分</div><div class="v ${tcls}">${t>0?'+':''}${t}</div></div>
        <div class="scs-num"><div class="k">排名</div><div class="v">${rank}</div></div>
      </div>
    </div>`;
  document.getElementById('studentCardSummary').innerHTML=buildStudentItemBars(sid);
  drawStudentTrend(sid);
  document.getElementById('studentRecent').innerHTML=buildStudentRecent(sid);
  document.getElementById('studentModal').style.display='flex';
}
function closeStudentCard(){document.getElementById('studentModal').style.display='none';}
function buildStudentItemBars(sid){
  const items=state.items.map(it=>({name:it.name,v:allTimeItemSum(sid,it.id)})).filter(x=>x.v!==0);
  if(!items.length)return '<div class="progress-empty">暂无项目记录</div>';
  const maxAbs=Math.max(...items.map(x=>Math.abs(x.v)));
  return items.map(x=>{
    const cls=x.v>0?'pos':'neg';
    const w=Math.max(Math.abs(x.v)/maxAbs*100,4);
    return `<div class="student-item-bar"><span class="sib-label">${esc(x.name)}</span><div class="sib-track"><div class="sib-fill ${cls}" style="width:${w}%">${Math.abs(x.v)}</div></div><span class="sib-val ${cls}">${x.v>0?'+':''}${x.v}</span></div>`;
  }).join('');
}
function drawStudentTrend(sid){
  const canvas=document.getElementById('studentTrendCanvas');
  const weeks=semesterWeeks();
  if(!weeks.length){canvas.style.display='none';return;}
  canvas.style.display='block';
  const pts=weeks.map(w=>weekTotal(sid,w));
  const hasData=pts.some(v=>v!==0);
  if(!hasData){canvas.style.display='none';return;}
  const dpr=window.devicePixelRatio||1;
  const W=Math.max(canvas.parentElement.clientWidth-4,320);
  const H=180;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);
  const padL=34,padR=16,padT=14,padB=26;
  const cw=W-padL-padR,ch=H-padT-padB;
  let min=0,max=0;
  pts.forEach(v=>{if(v<min)min=v;if(v>max)max=v;});
  if(min>0)min=0;if(max<0)max=0;
  if(max===min)max=min+1;
  const yVal=v=>padT+ch-(v-min)/(max-min)*ch;
  ctx.strokeStyle='#efe7d9';ctx.fillStyle='#7a6d61';ctx.font='10px sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
  const steps=3;
  for(let i=0;i<=steps;i++){
    const v=min+(max-min)*i/steps;
    const y=yVal(v);
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillText(Math.round(v),padL-6,y);
  }
  const stepX=cw/pts.length;
  ctx.textAlign='center';ctx.textBaseline='top';
  pts.forEach((v,i)=>{
    const x=padL+stepX*i+stepX/2;
    ctx.fillText('W'+(i+1),x,H-padB+6);
  });
  ctx.strokeStyle='#c0392b';ctx.lineWidth=2;ctx.lineJoin='round';
  ctx.beginPath();
  pts.forEach((v,i)=>{
    const x=padL+stepX*i+stepX/2;
    const y=yVal(v);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.stroke();
  pts.forEach((v,i)=>{
    const x=padL+stepX*i+stepX/2;
    const y=yVal(v);
    ctx.fillStyle='#c0392b';
    ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(x,y,1.4,0,Math.PI*2);ctx.fill();
  });
}
function buildStudentRecent(sid){
  const recs=[];
  for(const dk in state.scores){
    for(const iid in state.scores[dk][sid]||{}){
      const it=state.items.find(i=>i.id===iid);
      const arr=state.scores[dk][sid][iid];
      if(!Array.isArray(arr))continue;
      arr.forEach(e=>{
        recs.push({dk,iid:it?it.name:'(已删除)',label:e.label||'',v:e.v,ts:e.ts||0,by:e.by||'本地'});
      });
    }
  }
  recs.sort((a,b)=>b.ts-a.ts);
  if(!recs.length)return '<div class="progress-empty">暂无操作记录</div>';
  return recs.slice(0,12).map(r=>{
    const cls=r.v>0?'pos':'neg';
    return `<div class="student-recent-item"><span class="sri-date">${r.dk}</span><span class="sri-item">${esc(r.iid)}${r.label?' · '+esc(r.label):''}</span><span class="sri-val ${cls}">${r.v>0?'+':''}${r.v}</span></div>`;
  }).join('');
}

/* ================= 成员管理 ================= */
function renderMembers(){
  const list=document.getElementById('memberList');
  if(!state.students.length){
    list.innerHTML=`<div class="empty-tip" style="grid-column:1/-1"><div class="big">👥</div><div class="t">还没有成员</div><div class="s">在上方输入姓名，点击「添加成员」即可</div></div>`;
    return;
  }
  list.innerHTML=state.students.map(st=>{
    const t=allTimeTotal(st.id);
    return `<div class="member-card">
      <div class="info">
        <div class="avatar">${esc(st.name[0])}</div>
        <div>
          <div class="name">${esc(st.name)}</div>
          <div class="total">累计总分 <b>${t>0?'+':''}${t}</b></div>
        </div>
      </div>
      ${canManageMembers()?`<div class="actions">
        <button title="重命名" onclick="renameMember('${st.id}')">✏️</button>
        <button class="del" title="删除" onclick="removeMember('${st.id}')">🗑️</button>
      </div>`:''}
    </div>`;
  }).join('');
}
