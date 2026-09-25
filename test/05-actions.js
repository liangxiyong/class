function addMember(){
  if(!canManageMembers()){toast('仅组长或管理员可添加成员');return;}
  const input=document.getElementById('newMemberName');
  const name=input.value.trim();
  if(!name){toast('请输入姓名');return;}
  if(state.students.some(s=>s.name===name)){toast('该成员已存在');return;}
  state.students.push({id:uid(),name});
  ensureStudentAccount(name);
  save();input.value='';renderMembers();
  if(!cloudSyncing)cloudPush(true);
  toast('已添加成员：'+name);
}
function renameMember(id){
  if(!canManageMembers()){toast('仅组长或管理员可重命名成员');return;}
  const st=state.students.find(s=>s.id===id);
  const name=prompt('输入新姓名：',st.name);
  if(name&&name.trim()){
    const old=st.name;
    st.name=name.trim();
    const acc=findAccount(old);
    if(acc&&acc.role==='user'){acc.name=st.name;}
    save();renderMembers();
    toast('已重命名');
  }
}
function removeMember(id){
  if(!canManageMembers()){toast('仅组长或管理员可删除成员');return;}
  const st=state.students.find(s=>s.id===id);
  if(!confirm(`确定删除成员「${st.name}」吗？其历史积分将一并清除。`))return;
  state.students=state.students.filter(s=>s.id!==id);
  for(const dk in state.scores)delete state.scores[dk][id];
  for(const dk in state.notes)delete state.notes[dk][id];
  selectedStudents.delete(id);
  const acc=findAccount(st.name);
  if(acc&&acc.role==='user')state.accounts=state.accounts.filter(a=>a.name!==st.name);
  save();renderMembers();
  toast('已删除成员');
}

/* ================= 设置 ================= */
function renderSettings(){
  document.getElementById('groupNameInput').value=state.groupName;
  document.getElementById('fontSelect').value=state.font||'sans';
  const sub=document.getElementById('sidebarGroup');
  // 用GROUP_NAMES强制显示正确组名，防止state.groupName被污染
  if(sub){sub.textContent=(GROUP_NAMES[currentGroupId]||state.groupName||'')+(isPersonalMode()?' · 我的分数':'');sub.style.display='block';}
  const cp=document.getElementById('cloudPanel');
  if(cp)cp.style.display=canAccessCloud()?'':'none';
  const dp=document.getElementById('dangerPanel');
  if(dp)dp.style.display=canAccessCloud()?'':'none';
  renderCloudSettings();
  const list=document.getElementById('itemsList');
  list.innerHTML=state.items.map(it=>{
    const isRank=!!it.formula;
    return `<div class="item-editor">
      <div class="item-editor-head">
        <input value="${esc(it.name)}" onchange="renameItem('${it.id}',this.value)">
        <button class="btn btn-danger btn-sm" onclick="removeItem('${it.id}')">删除</button>
      </div>
      <div class="preset-editors">
        ${it.presets.map((p,pi)=>`
          <div class="preset-editor">
            <input type="text" value="${esc(p.label)}" onchange="editPreset('${it.id}',${pi},'label',this.value)">
            <input type="number" value="${p.value}" onchange="editPreset('${it.id}',${pi},'value',this.value)">
            <button class="icon-btn" onclick="removePreset('${it.id}',${pi})">✕</button>
          </div>`).join('')}
        <button class="add-preset-btn" onclick="addPreset('${it.id}')">＋ 添加预设按钮</button>
      </div>
      <div class="calc-editor">
        <div class="calc-type-row">
          <label>计算方式</label>
          <select onchange="setCalcType('${it.id}',this.value)">
            <option value="manual" ${isRank?'':'selected'}>手动加减分</option>
            <option value="rank" ${isRank?'selected':''}>名次公式</option>
          </select>
        </div>
        <div class="calc-formula-row" id="calcFormula-${it.id}" style="${isRank?'':'display:none'}">
          <label>公式</label>
          <input type="text" value="${it.formula?esc(it.formula.expr):''}" placeholder="如 46-N+1" onchange="setFormula('${it.id}','expr',this.value)">
          <label>名次≤</label>
          <input type="number" value="${it.formula?it.formula.minN:41}" onchange="setFormula('${it.id}','minN',this.value)">
        </div>
        <div class="calc-weights" id="calcWeights-${it.id}" style="${isRank?'':'display:none'}">
          ${(it.weights||[]).map((w,wi)=>`
            <div class="weight-editor">
              <input type="text" value="${esc(w.label)}" onchange="setWeight('${it.id}',${wi},'label',this.value)">
              <input type="number" value="${w.pct}" onchange="setWeight('${it.id}',${wi},'pct',this.value)"><span class="pct-suffix">%</span>
              <select onchange="setWeight('${it.id}',${wi},'group',this.value)">
                <option value="xw" ${w.group==='xw'?'selected':''}>单选组（互斥）</option>
                <option value="top" ${w.group==='top'?'selected':''}>独立（可叠加）</option>
              </select>
              <button class="icon-btn" onclick="removeWeight('${it.id}',${wi})">✕</button>
            </div>`).join('')}
          <button class="add-preset-btn" onclick="addWeight('${it.id}')">＋ 添加加权选项</button>
        </div>
        <div class="calc-hint">名次公式：输入名次 N，按公式自动算分（名次需大于设定值才生效）。加权选项按百分比加在公式分上。</div>
      </div>
    </div>`;
  }).join('');
}
function saveGroupName(v){state.groupName=v.trim();save();const sub=document.getElementById('sidebarGroup');if(state.groupName){sub.textContent=state.groupName;sub.style.display='block';}else{sub.style.display='none';}toast('已保存');}
function saveFont(v){state.font=v;save();applyFont();toast('字体已更新');}
function applyFont(){document.body.dataset.font='sans';}
function renameItem(id,v){const it=state.items.find(i=>i.id===id);if(it&&v.trim()){it.name=v.trim();save();toast('已保存');}}
function removeItem(id){
  if(!confirm('确定删除该项目吗？该项目的历史积分将一并清除。'))return;
  state.items=state.items.filter(i=>i.id!==id);
  for(const dk in state.scores)for(const sid in state.scores[dk])delete state.scores[dk][sid][id];
  save();renderSettings();toast('已删除项目');
}
function addItem(){
  const name=prompt('输入新项目名称：');
  if(!name||!name.trim())return;
  state.items.push({id:uid(),name:name.trim(),presets:[]});
  save();renderSettings();toast('已添加项目');
}
function addPreset(id){
  const it=state.items.find(i=>i.id===id);
  it.presets.push({label:'新预设',value:1});
  save();renderSettings();
}
function editPreset(id,pi,field,v){
  const it=state.items.find(i=>i.id===id);
  if(field==='value')it.presets[pi].value=Number(v)||0;
  else it.presets[pi].label=v;
  save();
}
function removePreset(id,pi){
  const it=state.items.find(i=>i.id===id);
  it.presets.splice(pi,1);
  save();renderSettings();
}
function setCalcType(id,type){
  const it=state.items.find(i=>i.id===id);
  if(type==='rank'){
    if(!it.formula)it.formula={expr:'46-N+1',minN:5};
  }else{
    it.formula=null;
  }
  save();renderSettings();
}
function setFormula(id,field,v){
  const it=state.items.find(i=>i.id===id);
  if(!it.formula)it.formula={expr:'46-N+1',minN:5};
  if(field==='expr')it.formula.expr=v;
  else it.formula.minN=Number(v)||0;
  save();
}
function setWeight(id,wi,field,v){
  const it=state.items.find(i=>i.id===id);
  if(!it.weights)it.weights=[];
  if(field==='label')it.weights[wi].label=v;
  else if(field==='pct')it.weights[wi].pct=Number(v)||0;
  else it.weights[wi].group=v;
  save();
}
function addWeight(id){
  const it=state.items.find(i=>i.id===id);
  if(!it.weights)it.weights=[];
  it.weights.push({id:uid(),label:'新加权',pct:5,group:'xw'});
  save();renderSettings();
}
function removeWeight(id,wi){
  const it=state.items.find(i=>i.id===id);
  it.weights.splice(wi,1);
  save();renderSettings();
}

/* ================= 导出 / 导入 / 打印 ================= */
function download(name,content,mime){
  const blob=new Blob([content],{type:mime||'application/octet-stream'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},100);
}
function exportConfig(){
  download('积分配置.json',JSON.stringify({groupName:state.groupName,items:state.items},null,2),'application/json');
  toast('配置已导出');
}
function openWeightModal(){
  document.getElementById('weightModal').style.display='flex';
  const now=document.getElementById('weightFactorNow');
  if(now)now.textContent='×'+Math.round(weightF()*1000)/1000;
  // 滑块初始值 = 当前系数对应的百分比
  const curPct=Math.round((weightF()-1)*100);
  const slider=document.getElementById('weightPercent');
  const val=document.getElementById('weightPercentVal');
  if(slider){slider.value=Math.max(0,Math.min(12,curPct));}
  if(val){val.textContent=Math.max(0,Math.min(12,curPct))+'%';}
}
function closeWeightModal(){
  document.getElementById('weightModal').style.display='none';
}
function applyWeight(){
  const p=parseFloat(document.getElementById('weightPercent').value);
  if(p<0||p>12){toast('加权百分比仅限0%-12%');return;}
  // 直接设置成目标系数，不在当前系数上累加
  const nf=Math.round((1+p/100)*1000)/1000;
  if(nf<=0){toast('无法设置为0以下');return;}
  state.weightFactor=nf;
  save();render();
  closeWeightModal();
  toast('已设置加权，全部总分 ×'+Math.round(nf*1000)/1000);
}
function exportData(){
  download('积分数据备份_'+fmt(new Date())+'.json',JSON.stringify(state,null,2),'application/json');
  toast('数据备份已导出');
}
function importConfig(input){
  const f=input.files[0];
  if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const cfg=JSON.parse(e.target.result);
      if(!cfg.items||!Array.isArray(cfg.items))throw new Error('格式错误');
      state.groupName=cfg.groupName||'';
      state.items=cfg.items;
      save();renderSettings();
      toast('配置已导入');
    }catch(err){toast('导入失败：文件格式不正确');}
  };
  reader.readAsText(f);
  input.value='';
}
function importData(input){
  const f=input.files[0];
  if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.items||!data.students)throw new Error('格式错误');
      if(!confirm('导入备份将覆盖当前全部数据，确定继续吗？'))return;
      normalizeScores(data);
      state=data;
      save();render();
      toast('数据已恢复');
    }catch(err){toast('导入失败：文件格式不正确');}
  };
  reader.readAsText(f);
  input.value='';
}
function clearAllData(){
  if(!confirm('确定清空全部数据吗？此操作不可恢复！'))return;
  if(!confirm('再次确认：将删除所有成员、配置和积分数据。'))return;
  state=JSON.parse(JSON.stringify(DEFAULT_STATE));
  save();render();
  toast('已清空全部数据');
}

/* ================= Excel 导出 ================= */
/* 美化工作表：列宽自适应、标题行合并、冻结表头、数字格式 */
function beautifySheet(ws, opts){
  opts=opts||{};
  if(!ws||!ws['!ref'])return ws;
  const range=XLSX.utils.decode_range(ws['!ref']);
  const R0=range.s.r, C0=range.s.c, R1=range.e.r, C1=range.e.c;
  // 1. 列宽自适应（中文按2字符宽）
  const cols=[];
  for(let C=C0;C<=C1;C++){
    let max=5;
    for(let R=R0;R<=R1;R++){
      const cell=ws[XLSX.utils.encode_cell({r:R,c:C})];
      if(cell&&cell.v!=null&&String(cell.v).trim()!==''){
        const s=String(cell.v);
        const cjk=(s.match(/[\u4e00-\u9fa5]/g)||[]).length;
        const w=s.length+cjk;
        if(w>max)max=w;
      }
    }
    cols.push({wch:Math.min(max+2,28)});
  }
  ws['!cols']=cols;
  // 2. 合并标题行（只有A列有内容且看起来是标题的行）
  const merges=ws['!merges']||[];
  const titleKeywords=['月','日','周','学期','统计','报告','汇总'];
  for(let R=R0;R<=R1;R++){
    let filled=0, firstVal='';
    for(let C=C0;C<=C1;C++){
      const cell=ws[XLSX.utils.encode_cell({r:R,c:C})];
      if(cell&&cell.v!=null&&String(cell.v).trim()!==''){
        filled++;
        if(filled===1)firstVal=String(cell.v);
      }
    }
    if(filled===1&&C1>C0&&titleKeywords.some(k=>firstVal.indexOf(k)>=0)){
      merges.push({s:{r:R,c:C0},e:{r:R,c:C1}});
    }
  }
  if(merges.length)ws['!merges']=merges;
  // 3. 冻结前两行（标题+表头）
  ws['!freeze']={xSplit:0,ySplit:opts.freezeRows||2};
  // 4. 数字列格式（分数列保留1位小数）
  for(let R=R0;R<=R1;R++){
    for(let C=C0;C<=C1;C++){
      const cell=ws[XLSX.utils.encode_cell({r:R,c:C})];
      if(cell&&cell.t==='n'&&typeof cell.v==='number'&&!Number.isInteger(cell.v)){
        cell.z='0.0';
      }
    }
  }
  return ws;
}
/* ================= ExcelJS 真正 .xlsx 导出（无格式提示、多sheet、完整样式） ================= */
const EXCELJS_CDNS=[
  'https://cdn.jsdelivr.net/npm/exceljs/dist/exceljs.min.js',
  'https://unpkg.com/exceljs/dist/exceljs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js'
];
let exceljsLoading=null;
function loadExcelJS(){
  if(typeof ExcelJS!=='undefined')return Promise.resolve();
  if(exceljsLoading)return exceljsLoading;
  exceljsLoading=new Promise((resolve,reject)=>{
    let i=0;
    const tryNext=()=>{
      if(i>=EXCELJS_CDNS.length){exceljsLoading=null;reject(new Error('ExcelJS加载失败'));return;}
      const s=document.createElement('script');
      s.src=EXCELJS_CDNS[i++];
      s.onload=()=>{if(typeof ExcelJS!=='undefined'){resolve();}else{tryNext();}};
      s.onerror=tryNext;
      document.head.appendChild(s);
    };
    tryNext();
  });
  return exceljsLoading;
}
const THIN_BORDER={top:{style:'thin',color:{argb:'FFB4C6E7'}},bottom:{style:'thin',color:{argb:'FFB4C6E7'}},left:{style:'thin',color:{argb:'FFB4C6E7'}},right:{style:'thin',color:{argb:'FFB4C6E7'}}};
function xlsStyle(cell,opts){
  cell.border=THIN_BORDER;
  if(opts.fill)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:opts.fill}};
  cell.font={name:'微软雅黑',size:opts.fontSize||10,bold:!!opts.bold,color:opts.color?{argb:opts.color}:{argb:'FF000000'}};
  cell.alignment={horizontal:opts.align||'center',vertical:'middle'};
}
function rowsToXlsxSheet(worksheet,rows,groupTitle){
  let rowNum=1;
  const maxCols=rows.reduce((m,r)=>Math.max(m,r?r.length:0),1);
  if(groupTitle){
    worksheet.addRow([groupTitle]);
    worksheet.mergeCells(rowNum,1,rowNum,maxCols);
    xlsStyle(worksheet.getCell(rowNum,1),{fill:'FF1F3864',fontSize:14,bold:true,color:'FFFFFFFF'});
    worksheet.getRow(rowNum).height=30;
    rowNum++;
  }
  rows.forEach(r=>{
    if(!r||!r.length||r.every(c=>c==null||String(c).trim()==='')){
      worksheet.addRow([]);
      worksheet.getRow(rowNum).height=8;
      rowNum++;
      return;
    }
    const filled=r.filter(c=>c!=null&&String(c).trim()!=='').length;
    if(filled===1&&r.length>1){
      const val=r.find(c=>c!=null&&String(c).trim()!=='');
      worksheet.addRow([val]);
      worksheet.mergeCells(rowNum,1,rowNum,r.length);
      xlsStyle(worksheet.getCell(rowNum,1),{fill:'FF2F5496',fontSize:12,bold:true,color:'FFFFFFFF'});
      worksheet.getRow(rowNum).height=26;
      rowNum++;
      return;
    }
    const isHeader=r.some(c=>c==='序号'||c==='姓名'||c==='名次');
    const isTotal=r.some(c=>typeof c==='string'&&c.indexOf('小组总分')>=0);
    const isAvg=r.some(c=>typeof c==='string'&&c.indexOf('平均分')>=0);
    worksheet.addRow(r);
    for(let c=1;c<=r.length;c++){
      const cell=worksheet.getCell(rowNum,c);
      const v=r[c-1];
      if(isHeader){
        xlsStyle(cell,{fill:'FF4472C4',bold:true,color:'FFFFFFFF'});
      }else if(isTotal){
        xlsStyle(cell,{fill:'FFFFF2CC',bold:true,color:'FF806000'});
      }else if(isAvg){
        xlsStyle(cell,{fill:'FFE2EFDA',bold:true,color:'FF375623'});
      }else{
        xlsStyle(cell,{});
        let num=null;
        if(typeof v==='number')num=v;
        else if(typeof v==='string'&&/^[+-]?\d/.test(v.trim()))num=parseFloat(v);
        if(num!=null){
          if(num>0)cell.font={name:'微软雅黑',size:10,bold:true,color:{argb:'FFC00000'}};
          else if(num<0)cell.font={name:'微软雅黑',size:10,bold:true,color:{argb:'FF00B050'}};
        }
      }
    }
    rowNum++;
  });
  // 列宽自适应
  for(let c=1;c<=maxCols;c++){
    let max=5;
    rows.forEach(r=>{if(r&&r[c-1]!=null){const s=String(r[c-1]);const cjk=(s.match(/[\u4e00-\u9fa5]/g)||[]).length;const w=s.length+cjk;if(w>max)max=w;}});
    worksheet.getColumn(c).width=Math.min(max+2,28);
  }
  // 冻结
  worksheet.views=[{state:'frozen',ySplit:1}];
}
function safeSheetName(name){
  return String(name).replace(/[:\\\/\?\*\[\]]/g,'_').substring(0,31);
}
async function downloadXlsx(workbook,filename){
  const buffer=await workbook.xlsx.writeBuffer();
  const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
/* ================= HTML 样式化 Excel 导出（支持颜色/边框/字体/合并） ================= */
function escHtml(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
const STYLED_CSS=`
table{border-collapse:collapse;font-family:'微软雅黑','Microsoft YaHei',sans-serif;mso-number-format:'\\@';}
td,th{border:1px solid #B4C6E7;padding:3px 7px;font-size:10pt;vertical-align:middle;white-space:nowrap;}
th{background-color:#4472C4;color:#ffffff;font-weight:bold;text-align:center;}
.day-title{background-color:#2F5496;color:#ffffff;font-weight:bold;font-size:12pt;text-align:center;height:26px;}
.group-title{background-color:#1F3864;color:#ffffff;font-weight:bold;font-size:14pt;text-align:center;height:30px;}
.total-row{background-color:#FFF2CC;font-weight:bold;}
.total-row td{color:#806000;}
.avg-row{background-color:#E2EFDA;font-weight:bold;}
.avg-row td{color:#375623;}
.pos{color:#C00000;font-weight:bold;}
.neg{color:#00B050;font-weight:bold;}
.spacer{border:none;height:10px;background-color:#ffffff;}
`;
function rowsToStyledTable(rows, groupTitle){
  let h='';
  const maxCols=rows.reduce((m,r)=>Math.max(m,r?r.length:0),1);
  if(groupTitle)h+='<tr><td class="group-title" colspan="'+maxCols+'">'+escHtml(groupTitle)+'</td></tr>';
  rows.forEach(r=>{
    if(!r||!r.length||r.every(c=>c==null||String(c).trim()==='')){h+='<tr><td class="spacer" colspan="'+maxCols+'">&nbsp;</td></tr>';return;}
    const filled=r.filter(c=>c!=null&&String(c).trim()!=='').length;
    if(filled===1&&r.length>1){
      const val=r.find(c=>c!=null&&String(c).trim()!=='');
      h+='<tr><td class="day-title" colspan="'+r.length+'">'+escHtml(val)+'</td></tr>';
      return;
    }
    const isHeader=r.some(c=>c==='序号'||c==='姓名'||c==='名次');
    const isTotal=r.some(c=>typeof c==='string'&&c.indexOf('小组总分')>=0);
    const isAvg=r.some(c=>typeof c==='string'&&c.indexOf('平均分')>=0);
    let trClass='';
    if(isTotal)trClass=' class="total-row"';
    else if(isAvg)trClass=' class="avg-row"';
    h+='<tr'+trClass+'>';
    r.forEach(c=>{
      const tag=isHeader?'th':'td';
      let cls='';
      if(typeof c==='number'){if(c>0)cls=' class="pos"';else if(c<0)cls=' class="neg"';}
      else if(typeof c==='string'&&/^[+-]?\d/.test(c.trim())){
        const num=parseFloat(c);
        if(num>0)cls=' class="pos"';else if(num<0)cls=' class="neg"';
      }
      h+='<'+tag+cls+'>'+escHtml(c)+'</'+tag+'>';
    });
    h+='</tr>';
  });
  return h;
}
function styledExcelDoc(sheetName, bodyHtml){
return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>'+escHtml(sheetName)+'</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><style>'+STYLED_CSS+'</style></head><body><div id="maintBanner" style="display:none;position:fixed;top:0;left:0;right:0;z-index:9999;background:#ff9800;color:white;padding:10px;text-align:center;font-size:14px;">  提示：今天22:50开始系统维护，请尽快完成操作</div>'+bodyHtml+'</body></html>';
}
function buildDayBlock(dk,students){
  const d=parseDate(dk);
  const rows=[];
  rows.push([formatCN(d)+' '+weekdayCN(d)]);
  rows.push(['序号','姓名',...state.items.map(i=>i.name),'个人总分']);
  students.forEach((st,idx)=>{
    rows.push([idx+1,st.name,...state.items.map(it=>cellTextSimple(st.id,it.id,dk)),dayScore(st.id,dk)]);
  });
  const group=Math.round(students.reduce((a,st)=>a+dayScore(st.id,dk),0)*100)/100;
  const avg=students.length?Math.round(group/students.length*10)/10:0;
  rows.push(['','小组总分',...state.items.map(()=>''),group]);
  rows.push(['','平均分',...state.items.map(()=>''),avg]);
  return rows;
}
function buildWeekSummaryRows(monday,students){
  const dates=weekDates(monday);
  const rows=[];
  rows.push(['周统计 '+(dates.length?(formatCN(dates[0])+' ~ '+formatCN(dates[dates.length-1])):'本周无课')]);
  rows.push(['姓名',...dates.map(d=>weekdayCN(d)),'周总分']);
  students.forEach(st=>{
    rows.push([st.name,...dates.map(d=>dayScore(st.id,fmt(d))),weekTotal(st.id,monday)]);
  });
  const group=Math.round(students.reduce((a,st)=>a+weekTotal(st.id,monday),0)*100)/100;
  const avg=students.length?Math.round(group/students.length*10)/10:0;
  rows.push(['小组总分',...dates.map(()=>''),group]);
  rows.push(['平均分',...dates.map(()=>''),avg]);
  return rows;
}
function buildMonthSummaryRows(y,m,students){
  const weeks=monthWeeks(y,m);
  const rows=[];
  rows.push([y+'年'+(m+1)+'月 月统计']);
  rows.push(['姓名',...weeks.map((_,i)=>'第'+(i+1)+'周'),'月总分']);
  students.forEach(st=>{
    const row=[st.name];
    weeks.forEach(w=>{
      let t=0;w.forEach(d=>t+=dayScore(st.id,fmt(d)));row.push(Math.round(t*100)/100);
    });
    row.push(monthTotal(st.id,y,m));
    rows.push(row);
  });
  const group=Math.round(students.reduce((a,st)=>a+monthTotal(st.id,y,m),0)*100)/100;
  const avg=students.length?Math.round(group/students.length*10)/10:0;
  rows.push(['小组总分',...weeks.map(()=>''),group]);
  rows.push(['平均分',...weeks.map(()=>''),avg]);
  return rows;
}
function buildSemesterRows(students){
  const weeks=semesterWeeks();
  const rows=[];
  if(weeks.length){
    const first=weeks[0],last=weekEndDate(weeks[weeks.length-1]);
    rows.push(['学期报告 '+formatCN(first)+' ~ '+formatCN(last)]);
  }else{
    rows.push(['学期报告']);
  }
  rows.push(['名次','姓名',...state.items.map(i=>i.name),'总分']);
  const sorted=students.map(st=>({st,t:allTimeTotal(st.id)})).sort((a,b)=>b.t-a.t);
  sorted.forEach(({st,t},idx)=>{
    rows.push([idx+1,st.name,...state.items.map(it=>allTimeItemSum(st.id,it.id)),t]);
  });
  const group=Math.round(sorted.reduce((a,r)=>a+r.t,0)*100)/100;
  const avg=students.length?Math.round(group/students.length*10)/10:0;
  rows.push(['','小组总分',...state.items.map(()=>''),group]);
  rows.push(['','平均分',...state.items.map(()=>''),avg]);
  return rows;
}
function groupList(){
  const gs=[];
  state.students.forEach(st=>{
    const g=st.group||'未分组';
    if(!gs.includes(g))gs.push(g);
  });
  return gs;
}
function studentsOfGroup(g){
  return state.students.filter(st=>(st.group||'未分组')===g);
}
const XLSX_CDNS=[
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.bootcdn.net/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
let xlsxLoading=null;
function loadXLSX(){
  if(typeof XLSX!=='undefined')return Promise.resolve();
  if(xlsxLoading)return xlsxLoading;
  xlsxLoading=new Promise((resolve,reject)=>{
    let i=0;
    const tryNext=()=>{
      if(i>=XLSX_CDNS.length){xlsxLoading=null;reject(new Error('XLSX 加载失败'));return;}
      const s=document.createElement('script');
      s.src=XLSX_CDNS[i++];
      s.onload=()=>{if(typeof XLSX!=='undefined'){resolve();}else{tryNext();}};
      s.onerror=tryNext;
      document.head.appendChild(s);
    };
    tryNext();
  });
  return xlsxLoading;
}
