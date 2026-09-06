const fs=require('fs');
function makeEl(v){
  const ctx2d={scale(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},setTransform(){},arc(){},fill(){},closePath(){},fillRect(){},strokeRect(){},save(){},restore(){},translate(){},rotate(){},drawImage(){},strokeStyle:'',fillStyle:'',font:'',textAlign:'',textBaseline:'',lineWidth:1};
  return{
    _value:v||'',_html:'',_style:{},_text:'',
    set innerHTML(x){this._html=x;},get innerHTML(){return this._html;},
    set textContent(x){this._text=x;},get textContent(){return this._text;},
    set value(x){this._value=x;},get value(){return this._value;},
    style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    addEventListener(){},appendChild(){},click(){},dataset:{},
    parentElement:{clientWidth:800},getContext(){return ctx2d;},
    width:0,height:0,getBoundingClientRect(){return{width:800,height:240,left:0,top:0};}
  };
}
let pass=0,fail=0;
function t(name,cond){if(cond){pass++;console.log('  ✓ '+name);}else{fail++;console.log('  ✗ '+name);}}
/* Supabase Auth stub：登录账号 → (密码, user_metadata) */
const AUTH_ACCOUNTS={
  'admin@jfz.local':{pwd:'19176164q',meta:{username:'admin',role:'admin'}},
  'admin2@jfz.local':{pwd:'123456',meta:{username:'admin2',role:'admin2',group_id:'1'}},
  'teacher@jfz.local':{pwd:'123456',meta:{username:'teacher',role:'teacher'}},
  'zhangyiming@jfz.local':{pwd:'1',meta:{username:'张益铭',role:'leader',group_id:'1'}},
  'dongziyu@jfz.local':{pwd:'2',meta:{username:'董子瑜',role:'leader',group_id:'2'}},
  'zhangshaochen@jfz.local':{pwd:'10',meta:{username:'张邵宸',role:'leader',group_id:'10'}}
};
function authStub(win){
  return{
    createClient:()=>{
      const client={
        auth:{
          signInWithPassword:async({email,password})=>{
            const a=AUTH_ACCOUNTS[email];
            if(a&&a.pwd===password)return{data:{user:{id:'u1',user_metadata:a.meta},session:{access_token:'tok-'+email,user:{user_metadata:a.meta}}},error:null};
            return{data:{user:null,session:null},error:{message:'Invalid login credentials'}};
          },
          getSession:async()=>{
            if(win.__sessionMeta)return{data:{session:{access_token:'tok',user:{user_metadata:win.__sessionMeta}}},error:null};
            return{data:{session:null},error:null};
          },
          updateUser:async({password})=>{client._updatedPwd=password;return{data:{user:{}},error:null};},
          signOut:async()=>({error:null})
        }
      };
      win.__client=client;
      return client;
    }
  };
}
function runFile(f,els,storage,win,fetchImpl,keys){
  const html=fs.readFileSync('c:/Users/liuxi/Documents/小组积分/'+f,'utf8');
  const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  win=win||{};
  if(!win.supabase){
    if(!win.__sessionMeta){
      try{
        const s=storage['jfz_session_v1'];
        if(s){const j=JSON.parse(s);win.__sessionMeta={username:j.name,role:j.role,group_id:j.groupId||undefined};}
      }catch(e){}
    }
    win.supabase=authStub(win);
  }
  const doc={
    body:{dataset:{}},
    getElementById(id){if(!els[id])els[id]=makeEl();return els[id];},
    querySelectorAll(){return[];},querySelector(){return makeEl();},
    createElement(){return makeEl();},addEventListener(){},
    head:{appendChild(){}}
  };
  const localStorageMock={getItem:k=>k in storage?storage[k]:null,setItem:(k,v)=>storage[k]=String(v),removeItem:k=>delete storage[k]};
  const fn=new Function('document','localStorage','window','navigator','fetch','confirm','alert','setInterval','clearTimeout','setTimeout','Date','JSON','Math','Blob','URL','location',
    js+'\n;return {'+(keys||['state']).join(',')+'};');
  const api=fn(doc,localStorageMock,win,{},fetchImpl||(async()=>({ok:true,json:async()=>({})})),()=>true,()=>{},()=>0,()=>{},()=>0,Date,JSON,Math,function(){}, {createObjectURL:()=>'',revokeObjectURL:()=>{}}, win.location);
  return {api,els,storage,win,doc};
}
async function tick(n){for(let i=0;i<(n||30);i++)await Promise.resolve();}
function groupFetchImpl(){
  return async(url,opts)=>{
    if(url.indexOf('leaders')>=0)return{ok:true,json:async()=>[
      {name:'张益铭',group_id:'1'},{name:'董子瑜',group_id:'2'},{name:'张邵宸',group_id:'10'}
    ]};
    if(url.indexOf('group_data')>=0){
      const m=url.match(/group_id=eq\.(\d+)/);
      const gid=m?m[1]:'1';
      const data={version:2,itemsVer:3,groupName:'第'+gid+'组',students:[{id:'s'+gid+'1',name:'组'+gid+'成员甲'},{id:'s'+gid+'2',name:'组'+gid+'成员乙'}],items:[],scores:{},notes:{},baseOff:{}};
      return{ok:true,json:async()=>[{group_id:gid,group_name:'',data}]};
    }
    return{ok:true,json:async()=>({})};
  };
}
function groupEls(els){
  els['sidebarUser']=makeEl();
  els['sidebarGroup']=makeEl();
  els['syncStatus']=makeEl();
  els['sidebarSync']=makeEl();
  els['adminGroupBar']=makeEl();
  els['adminGroupSelect']=makeEl();
  els['memberList']=makeEl();
  els['memberAddRow']=makeEl();
  els['newMemberName']=makeEl();
  els['adminBtn']=makeEl();
  els['admin2Switch']=makeEl();
  els['groupNameInput']=makeEl();
  els['fontSelect']=makeEl();
  els['cloudPanel']=makeEl();
  els['dangerPanel']=makeEl();
}
function indexEls(els){
  els['loginName']=makeEl();
  els['loginPwd']=makeEl();
  els['loginErr']=makeEl();
  els['loginPwdField']=makeEl();
  els['loginFields']=makeEl();
  els['chooseBox']=makeEl();
  els['chooseName']=makeEl();
}

(async function main(){
console.log('== index.html 统一登录 ==');
{
  // 组长登录成功
  const els={};indexEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,groupFetchImpl(),['doLogin','leaderGroupOf']);
  els['loginName']._value='董子瑜';
  els['loginPwd']._value='2';
  await api.doLogin();
  const sess=JSON.parse(storage['jfz_session_v1']);
  t('组长登录成功并跳转 group.html',win.location.href==='group.html');
  t('组长会话 role=leader groupId=2',sess&&sess.role==='leader'&&sess.groupId==='2');
}
{
  // 组长密码错误
  const els={};indexEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,groupFetchImpl(),['doLogin']);
  els['loginName']._value='董子瑜';
  els['loginPwd']._value='5';
  await api.doLogin();
  t('组长密码错误拒绝',els['loginErr']._text.indexOf('密码错误')>=0&&win.location.href==='');
}
{
  // 普通成员禁止登录
  const els={};indexEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,groupFetchImpl(),['doLogin']);
  els['loginName']._value='谭佑安';
  els['loginPwd']._value='1';
  await api.doLogin();
  t('普通成员拒绝登录',els['loginErr']._text.indexOf('用户名或密码错误')>=0&&win.location.href==='');
}
{
  // admin 登录 → 选择界面
  const els={};indexEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,groupFetchImpl(),['doLogin']);
  els['loginName']._value='admin';
  els['loginPwd']._value='19176164q';
  await api.doLogin();
  t('admin 显示选择界面',els['chooseBox'].style.display==='block');
  t('admin 会话 role=admin',JSON.parse(storage['jfz_session_v1']).role==='admin');
}
{
  // admin2 登录 → 选择界面；班级管理按钮可用（启用状态）
  const els={};indexEls(els);
  els['chooseClassBtn']=makeEl();
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,async()=>({ok:true,json:async()=>[{data:{admin2Enabled:true}}]}),['doLogin']);
  els['loginName']._value='admin2';
  els['loginPwd']._value='123456';
  await api.doLogin();
  t('admin2 显示选择界面',els['chooseBox'].style.display==='block');
  t('admin2 会话 role=admin2',JSON.parse(storage['jfz_session_v1']).role==='admin2');
  t('admin2 启用时班级管理可点',els['chooseClassBtn'].disabled===false);
}
{
  // admin2 被禁班级管理 → 仍显示选择界面，但班级管理按钮置灰
  const els={};indexEls(els);
  els['chooseClassBtn']=makeEl();els['chooseBtnG']=makeEl();
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,async()=>({ok:true,json:async()=>[{data:{admin2Enabled:false}}]}),['doLogin']);
  els['loginName']._value='admin2';
  els['loginPwd']._value='123456';
  await api.doLogin();
  t('禁用后仍显示选择界面',els['chooseBox'].style.display==='block');
  t('禁用后班级管理置灰',els['chooseClassBtn'].disabled===true);
  t('禁用后仍可进小组积分',els['chooseBtnG'].disabled!==true);
}

console.log('== group.html 会话加载（无登录界面） ==');
{
  // 组长会话 → 加载自己组
  const els={};groupEls(els);
  const storage={'jfz_session_v1':JSON.stringify({name:'董子瑜',role:'leader',groupId:'2'})};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('group.html',els,storage,win,groupFetchImpl(),['canManageMembers','canAccessSettings','canAccessCloud','getState:function(){return state;}','getGid:function(){return currentGroupId;}','getUser:function(){return currentUser;}']);
  await tick();
  t('组长会话加载第2组',api.getGid()==='2');
  t('组长看到自己组成员',api.getState().students[0].name==='组2成员甲');
  t('组长可管理成员',api.canManageMembers()===true);
  t('组长可进设置',api.canAccessSettings()===true);
  t('组长不可看云配置',api.canAccessCloud()===false);
}
{
  // admin2 会话 → 第1组，可看云配置
  const els={};groupEls(els);
  const storage={'jfz_session_v1':JSON.stringify({name:'admin2',role:'admin2'})};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('group.html',els,storage,win,groupFetchImpl(),['canManageMembers','canAccessSettings','canAccessCloud','getGid:function(){return currentGroupId;}']);
  await tick();
  t('admin2 会话加载第1组',api.getGid()==='1');
  t('admin2 可管理第1组成员',api.canManageMembers()===true);
  t('admin2 可进设置',api.canAccessSettings()===true);
  t('admin2 可看云配置',api.canAccessCloud()===true);
}
{
  // 无会话 → 跳转 index.html
  const els={};groupEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  runFile('group.html',els,storage,win,groupFetchImpl(),['getUser:function(){return currentUser;}']);
  await tick();
  t('无会话跳转 index.html',win.location.href==='index.html');
}
{
  // 云端失败回退本地默认成员
  const els={};groupEls(els);
  const storage={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win={addEventListener(){},location:{href:''}};
  const fetchImpl=async(url)=>{
    if(url.indexOf('leaders')>=0)return{ok:false,json:async()=>({})};
    if(url.indexOf('group_data')>=0)return{ok:false,json:async()=>({})};
    return{ok:true,json:async()=>({})};
  };
  const {api}=runFile('group.html',els,storage,win,fetchImpl,['getState:function(){return state;}','getGid:function(){return currentGroupId;}']);
  await tick();
  t('云端失败回退admin默认第3组成员',api.getGid()==='3'&&api.getState().students.some(s=>s.name==='梁锡永'));
}

console.log('== group.html 日期归档限制 ==');
{
  // 归档日期分数计算返回0
  const els={};groupEls(els);
  const storage={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('group.html',els,storage,win,groupFetchImpl(),['dayScore','cellVal','shiftDate','shiftMonth','goToday','renderDaily','getDate:function(){return currentDate;}','getMonth:function(){return currentMonth;}','getWeek:function(){return currentWeek;}','getState:function(){return state;}','MIN_DATE','setDate:function(d){currentDate=d;}']);
  await tick();
  t('归档日 dayScore 返回0',api.dayScore(api.getState().students[0].id,'2026-08-30')===0);
  t('归档日 cellVal 返回0',api.cellVal(api.getState().students[0].id,'x1','2026-08-29')===0);
  t('可访问日 dayScore 正常',api.dayScore(api.getState().students[0].id,'2026-08-31')===10);
  // 日视图导航钳制
  api.shiftDate(-100);
  t('shiftDate 钳制到 2026-08-31',api.getDate().getFullYear()===2026&&api.getDate().getMonth()===7&&api.getDate().getDate()===31);
  api.goToday();
  t('goToday 不早于 2026-08-31',api.getDate()>=api.MIN_DATE);
  // 月视图导航钳制
  api.shiftMonth(-100);
  t('shiftMonth 钳制到 2026-09',api.getMonth().y===2026&&api.getMonth().m===8);
  // 周视图钳制
  api.shiftDate(-100);
  t('周起始不早于 2026-08-31',api.getWeek()>=api.MIN_DATE);
  // 归档日渲染提示
  api.setDate(new Date(2026,7,30));
  api.renderDaily();
  t('归档日显示不可访问提示',els['dailyTable'].innerHTML.indexOf('数据不可访问')>=0);
}

console.log('== group.html 管理员批量功能 ==');
{
  // getBatchRange 校验与钳制
  const els={};groupEls(els);
  els['batchExportStart']=makeEl();els['batchExportEnd']=makeEl();
  els['batchBaseStart']=makeEl();els['batchBaseEnd']=makeEl();
  const storage={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('group.html',els,storage,win,groupFetchImpl(),['getBatchRange','adminBatchBaseOff','exportAllGroupsExcel','getState:function(){return state;}','getGid:function(){return currentGroupId;}']);
  await tick();
  t('getBatchRange 空范围返回null',api.getBatchRange('batchExport')===null);
  els['batchExportStart']._value='2026-08-01';
  els['batchExportEnd']._value='2026-09-05';
  const r=api.getBatchRange('batchExport');
  t('getBatchRange 钳制到 2026-08-31',r&&r.start.getTime()===new Date(2026,7,31).getTime());
  els['batchExportStart']._value='2026-09-03';
  els['batchExportEnd']._value='2026-09-01';
  const r2=api.getBatchRange('batchExport');
  t('getBatchRange 自动交换起止',r2&&r2.start.getTime()===new Date(2026,8,1).getTime()&&r2.end.getTime()===new Date(2026,8,3).getTime());
  // 批量关闭基础分
  const patches=[];
  const fetchImpl=async(url,opts)=>{
    if(url.indexOf('group_data')>=0){
      const m=url.match(/group_id=eq\.(\d+)/);
      const gid=m?m[1]:'1';
      if(opts&&(opts.method==='PATCH'||(opts.method==='POST'&&url.indexOf('on_conflict')>=0))){
        patches.push({gid,body:JSON.parse(opts.body)});
        return{ok:true,json:async()=>({})};
      }
      const data={version:2,itemsVer:3,groupName:'第'+gid+'组',students:[{id:'s'+gid+'1',name:'组'+gid+'成员甲'}],items:[],scores:{},notes:{},baseOff:{}};
      return{ok:true,json:async()=>[{group_id:gid,group_name:'',data}]};
    }
    return{ok:true,json:async()=>({})};
  };
  const els2={};groupEls(els2);
  els2['batchExportStart']=makeEl();els2['batchExportEnd']=makeEl();
  els2['batchBaseStart']=makeEl();els2['batchBaseEnd']=makeEl();
  const storage2={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win2={addEventListener(){},location:{href:''}};
  const {api:api2}=runFile('group.html',els2,storage2,win2,fetchImpl,['adminBatchBaseOff','getState:function(){return state;}','getGid:function(){return currentGroupId;}']);
  await tick();
  els2['batchBaseStart']._value='2026-09-01';
  els2['batchBaseEnd']._value='2026-09-02';
  await api2.adminBatchBaseOff();
  t('批量关闭基础分写入全部小组',patches.length===10);
  t('批量关闭基础分设置日期范围',patches.length===10&&patches.every(p=>p.body.data.baseOff['2026-09-01']===true&&p.body.data.baseOff['2026-09-02']===true));
  // 未初始化小组（云端空数据）也要能批量关闭基础分
  const patches2=[];
  const fetchImpl2=async(url,opts)=>{
    if(url.indexOf('group_data')>=0){
      if(opts&&(opts.method==='PATCH'||(opts.method==='POST'&&url.indexOf('on_conflict')>=0))){
        patches2.push({gid:(url.match(/group_id=eq\.(\d+)/)||[])[1]||'1',body:JSON.parse(opts.body)});
        return{ok:true,json:async()=>({})};
      }
      const m=url.match(/group_id=eq\.(\d+)/);
      const gid=m?m[1]:'1';
      return{ok:true,json:async()=>[{group_id:gid,group_name:'',data:{}}]};
    }
    return{ok:true,json:async()=>({})};
  };
  const els4={};groupEls(els4);
  els4['batchExportStart']=makeEl();els4['batchExportEnd']=makeEl();
  els4['batchBaseStart']=makeEl();els4['batchBaseEnd']=makeEl();
  const storage4={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win4={addEventListener(){},location:{href:''}};
  const {api:api4}=runFile('group.html',els4,storage4,win4,fetchImpl2,['adminBatchBaseOff']);
  await tick();
  els4['batchBaseStart']._value='2026-09-01';
  els4['batchBaseEnd']._value='2026-09-02';
  await api4.adminBatchBaseOff();
  t('未初始化小组自动初始化并全部写入',patches2.length===10);
  t('未初始化小组写入默认成员和baseOff',patches2.length===10&&patches2.every(p=>p.body.data.students&&p.body.data.students.length>0&&p.body.data.baseOff['2026-09-01']===true&&p.body.data.baseOff['2026-09-02']===true));
  // 批量导出
  globalThis.XLSX={
    utils:{book_new:()=>({sheets:[],SheetNames:[]}),aoa_to_sheet:r=>r,book_append_sheet:(wb,ws,name)=>{wb.sheets.push(ws);wb.SheetNames.push(name);}},
    writeFile:(wb,name)=>{globalThis.__lastExport={wb,name};}
  };
  const els3={};groupEls(els3);
  els3['batchExportStart']=makeEl();els3['batchExportEnd']=makeEl();
  els3['batchBaseStart']=makeEl();els3['batchBaseEnd']=makeEl();
  const storage3={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win3={addEventListener(){},location:{href:''}};
  const {api:api3}=runFile('group.html',els3,storage3,win3,groupFetchImpl(),['exportAllGroupsExcel']);
  await tick();
  els3['batchExportStart']._value='2026-09-01';
  els3['batchExportEnd']._value='2026-09-01';
  await api3.exportAllGroupsExcel();
  t('批量导出生成工作表',globalThis.__lastExport&&globalThis.__lastExport.wb.SheetNames.length>=1);
  t('批量导出文件名含日期范围',globalThis.__lastExport&&globalThis.__lastExport.name.indexOf('2026-09-01')>=0);
  delete globalThis.XLSX;delete globalThis.__lastExport;
}

console.log('== group.html 组长可重新打开基础分 ==');
{
  const els={};groupEls(els);
  els['dailyDate']=makeEl();els['dailyDatePicker']=makeEl();els['batchToggle']=makeEl();els['batchHint']=makeEl();els['baseToggle']=makeEl();els['baseToggleText']=makeEl();els['dailySummary']=makeEl();els['dailyTable']=makeEl();
  const storage={'jfz_session_v1':JSON.stringify({name:'董子瑜',role:'leader',groupId:'2'})};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('group.html',els,storage,win,groupFetchImpl(),['toggleBase','getState:function(){return state;}','setDate:function(d){currentDate=d;}','getDate:function(){return currentDate;}']);
  await tick();
  api.setDate(new Date(2026,8,1));
  const dk='2026-09-01';
  api.getState().baseOff={};api.getState().baseOff[dk]=true;
  api.toggleBase();
  t('组长可重新打开基础分',!(api.getState().baseOff&&api.getState().baseOff[dk]));
  api.toggleBase();
  t('组长也可关闭基础分',api.getState().baseOff&&api.getState().baseOff[dk]===true);
}

console.log('== index.html Teacher 账号 ==');
{
  const els={};indexEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,groupFetchImpl(),['doLogin']);
  els['loginName']._value='teacher';
  els['loginPwd']._value='123456';
  await api.doLogin();
  const sess=JSON.parse(storage['jfz_session_v1']);
  t('Teacher 默认密码登录成功',sess&&sess.name==='teacher'&&sess.role==='teacher');
  t('Teacher 显示选择界面',els['chooseBox'].style.display==='block');
}
{
  const els={};indexEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('index.html',els,storage,win,groupFetchImpl(),['doLogin']);
  els['loginName']._value='teacher';
  els['loginPwd']._value='wrong';
  await api.doLogin();
  t('Teacher 错误密码拒绝',els['loginErr']._text.indexOf('密码错误')>=0&&win.location.href==='');
}

console.log('== group.html Teacher 权限 ==');
{
  const els={};groupEls(els);
  const storage={'jfz_session_v1':JSON.stringify({name:'teacher',role:'teacher'})};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('group.html',els,storage,win,groupFetchImpl(),['canAccessSettings','canAccessCloud','isAdmin','getGid:function(){return currentGroupId;}','getState:function(){return state;}']);
  await tick();
  t('Teacher 会话加载第1组',api.getGid()==='1');
  t('Teacher 视为管理员',api.isAdmin()===true);
  t('Teacher 可看云配置',api.canAccessCloud()===true);
}

console.log('== group.html 修改密码 ==');
{
  const els={};groupEls(els);
  els['pwdMeName']=makeEl();els['pwdMeOld']=makeEl();els['pwdMeNew']=makeEl();els['pwdMeNew2']=makeEl();els['pwdMeErr']=makeEl();els['pwdMeModal']=makeEl();
  const storage={'jfz_session_v1':JSON.stringify({name:'董子瑜',role:'leader',groupId:'2'})};
  const win={addEventListener(){},location:{href:''}};
  let patched=null;
  const fetchImpl=async(url,opts)=>{
    if(url.indexOf('leaders')>=0)return{ok:true,json:async()=>[{name:'张益铭',group_id:'1'},{name:'董子瑜',group_id:'2'}]};
    if(url.indexOf('users')>=0){
      if(opts&&opts.method==='PATCH'){patched=JSON.parse(opts.body);return{ok:true,json:async()=>({})};}
      return{ok:true,json:async()=>[{username:'董子瑜',password:'h3t1z',role:'leader',group_id:'2'}]};
    }
    if(url.indexOf('group_data')>=0){
      const m=url.match(/group_id=eq\.(\d+)/);
      const gid=m?m[1]:'1';
      const data={version:2,itemsVer:3,groupName:'第'+gid+'组',students:[{id:'s'+gid+'1',name:'组'+gid+'成员甲'},{id:'s'+gid+'2',name:'组'+gid+'成员乙'}],items:[],scores:{},notes:{},baseOff:{}};
      return{ok:true,json:async()=>[{group_id:gid,group_name:'',data}]};
    }
    return{ok:true,json:async()=>({})};
  };
  const {api}=runFile('group.html',els,storage,win,fetchImpl,['doChangePwdMe','getState:function(){return state;}']);
  await tick();
  els['pwdMeName']._value='董子瑜';
  els['pwdMeOld']._value='2';
  els['pwdMeNew']._value='8888';
  els['pwdMeNew2']._value='8888';
  await api.doChangePwdMe();
  t('组长正确密码可修改',win.__client&&win.__client._updatedPwd==='8888');
  t('修改成功后弹窗关闭',els['pwdMeModal'].style.display==='none');
  els['pwdMeModal'].style.display='flex';
  els['pwdMeOld']._value='wrong';
  await api.doChangePwdMe();
  t('旧密码错误拒绝',els['pwdMeErr']._text.indexOf('当前密码错误')>=0);
  els['pwdMeOld']._value='2';
  els['pwdMeNew']._value='888';
  els['pwdMeNew2']._value='888';
  await api.doChangePwdMe();
  t('短密码可修改（无长度限制）',win.__client&&win.__client._updatedPwd==='888');
}
{
  // admin 重置他人密码 → 调用 RPC
  const els={};groupEls(els);
  els['resetPwdName']=makeEl();els['resetPwdNew']=makeEl();els['resetPwdErr']=makeEl();
  const storage={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win={addEventListener(){},location:{href:''}};
  let rpcBody=null;
  const fetchImpl=async(url,opts)=>{
    if(url.indexOf('/rpc/admin_reset_password')>=0){rpcBody=JSON.parse(opts.body);return{ok:true,text:async()=>'ok'};}
    return{ok:true,json:async()=>({})};
  };
  const {api}=runFile('group.html',els,storage,win,fetchImpl,['adminResetPwd']);
  await tick();
  els['resetPwdName']._value='董子瑜';
  els['resetPwdNew']._value='newpwd';
  await api.adminResetPwd();
  t('admin 重置密码调用 RPC(拼音邮箱)',rpcBody&&rpcBody.p_email==='dongziyu@jfz.local'&&rpcBody.p_new_password==='newpwd');
  t('重置成功后清空输入',els['resetPwdName']._value===''&&els['resetPwdNew']._value==='');
}

console.log('== class.html Teacher 权限 ==');
function classEls(els){
  ['adminBtn','curDate','sidebarUser','syncStatus','sidebarSync','weekLabel','exportPreview','eyeTable','eyeTabs','disTable','disTabs','memberList','memberCount','orderList','toast'].forEach(id=>{els[id]=makeEl();});
}
{
  // Teacher 会话可进入 class.html
  const els={};classEls(els);
  const storage={'jfz_session_v1':JSON.stringify({name:'teacher',role:'teacher'})};
  const win={addEventListener(){},location:{href:''}};
  const {api}=runFile('class.html',els,storage,win,async()=>({ok:true,json:async()=>({})}),['getUser:function(){return currentUser;}']);
  await tick();
  t('Teacher 可进入 class.html 不跳转',win.location.href===''&&api.getUser().name==='teacher');
}
{
  // admin 会话可进入 class.html
  const els={};classEls(els);
  const storage={'jfz_session_v1':JSON.stringify({name:'admin',role:'admin'})};
  const win={addEventListener(){},location:{href:''}};
  runFile('class.html',els,storage,win,async()=>({ok:true,json:async()=>({})}),[]);
  await tick();
  t('admin 可进入 class.html',win.location.href==='');
}
{
  // 无会话跳回 index.html
  const els={};classEls(els);
  const storage={};
  const win={addEventListener(){},location:{href:''}};
  runFile('class.html',els,storage,win,async()=>({ok:true,json:async()=>({})}),[]);
  await tick();
  t('无会话跳转 index.html',win.location.href==='index.html');
}

console.log('\n结果: '+pass+' 通过, '+fail+' 失败');
process.exit(fail?1:0);
})();
