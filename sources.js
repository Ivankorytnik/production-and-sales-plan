(()=>{
'use strict';

const SUPABASE_URL='https://enlyiedwkarajvfsilel.supabase.co';
const SUPABASE_KEY='sb_publishable_YK0GMEpWNTnEp3ImIvONKQ_3IPZdvq5';
const SEND_ENDPOINT=SUPABASE_URL+'/functions/v1/atom-magic-auth';
const AUTH_ENDPOINT=SUPABASE_URL+'/functions/v1/atom-auth';
const CLOUD_BUCKET='plan-source-files';
const PREFIX='registry__';

const $=id=>document.getElementById(id);
const gate=$('authGate');
const shell=$('appShell');
const authStatus=$('authStatus');
const emailEl=$('authEmail');
const sendBtn=$('authSend');
const userEmail=$('authUserEmail');
const logoutBtn=$('authLogout');
const cloudStatus=$('cloudStatus');
const sourceName=$('sourceName');
const actualDate=$('actualDate');
const sourceFile=$('sourceFile');
const filePickText=$('filePickText');
const selectedFileName=$('selectedFileName');
const sourcePreview=$('sourcePreview');
const uploadBtn=$('uploadBtn');
const uploadMessage=$('uploadMessage');
const sourceCount=$('sourceCount');
const emptyState=$('emptyState');
const tableWrap=$('tableWrap');
const sourcesBody=$('sourcesBody');

let sb=null;
let currentUser=null;
let busy=false;

const domainOk=email=>/^[^@\s]+@atom\.team$/i.test(String(email||'').trim());
const setAuthStatus=(text,type='')=>{authStatus.textContent=text;authStatus.className='auth-status'+(type?' '+type:'')};
const setCloud=(text,type='')=>{cloudStatus.textContent=text;cloudStatus.className='cloud-status'+(type?' '+type:'')};
const setMessage=(text,type='')=>{uploadMessage.textContent=text;uploadMessage.className='message'+(type?' '+type:'')};

function saveLegacy(access,refresh){
  if(access)localStorage.setItem('atom_access_token',access);
  if(refresh)localStorage.setItem('atom_refresh_token',refresh);
}
function clearLegacy(){
  localStorage.removeItem('atom_access_token');
  localStorage.removeItem('atom_refresh_token');
}
function cleanCallbackUrl(){
  const url=new URL(location.href);
  ['access_token','refresh_token','expires_in','expires_at','token_type','type','error','error_code','error_description','code'].forEach(k=>url.searchParams.delete(k));
  url.hash='';
  history.replaceState(null,'',url.pathname+(url.searchParams.toString()?'?'+url.searchParams.toString():''));
}
function callbackParams(){
  const q=new URLSearchParams(location.search);
  const h=new URLSearchParams(location.hash.replace(/^#/,''));
  const get=k=>h.get(k)||q.get(k)||'';
  return {access:get('access_token'),refresh:get('refresh_token'),error:get('error'),errorCode:get('error_code'),errorDescription:get('error_description')};
}
async function call(url,body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data={};
  try{data=await r.json()}catch{}
  if(!r.ok){
    const raw=data.error||data.msg||'Ошибка авторизации';
    let msg=raw;
    if(typeof raw==='string'&&raw.trim().startsWith('{')){
      try{const parsed=JSON.parse(raw);msg=parsed.msg||parsed.message||parsed.error||raw}catch{}
    }
    throw new Error(String(msg));
  }
  return data;
}
function formatRuDate(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?m[3]+'.'+m[2]+'.'+m[1]:'';
}
function normalizeSource(value){
  return String(value||'').trim().replace(/\s+/g,'_').replace(/_+/g,'_').toUpperCase();
}
function updatePreview(){
  const code=normalizeSource(sourceName.value)||'ИСТОЧНИК';
  const date=formatRuDate(actualDate.value)||'ДД.ММ.ГГГГ';
  sourcePreview.textContent=code+'_'+date;
  uploadBtn.disabled=busy||!sourceFile.files?.[0]||!sourceName.value.trim()||!actualDate.value;
}
function safeName(name){
  return String(name||'file').replace(/[\\/]+/g,'_').replace(/[\u0000-\u001f\u007f]/g,'_').slice(0,160);
}
function encodeText(text){
  const bytes=new TextEncoder().encode(String(text||''));
  let bin='';
  bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeText(text){
  try{
    let s=String(text||'').replace(/-/g,'+').replace(/_/g,'/');
    while(s.length%4)s+='=';
    const bin=atob(s);
    const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch{return 'ИСТОЧНИК'}
}
function parseItem(item){
  const name=String(item?.name||'');
  const m=name.match(/^registry__(\d+)__(.+?)__(\d{4}-\d{2}-\d{2})__(.+)$/);
  if(!m)return null;
  return {
    path:currentUser.id+'/'+name,
    storageName:name,
    createdAt:Number(m[1])||0,
    source:decodeText(m[2]),
    actualDate:m[3],
    originalName:m[4],
    updatedAt:item.updated_at||item.created_at||''
  };
}
function formatDateTime(value,stamp){
  const d=value?new Date(value):new Date(stamp||Date.now());
  if(Number.isNaN(d.getTime()))return '';
  return d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',','');
}
function logicalName(entry){
  return normalizeSource(entry.source)+'_'+formatRuDate(entry.actualDate);
}
async function cloudList(){
  const {data,error}=await sb.storage.from(CLOUD_BUCKET).list(currentUser.id,{limit:100,sortBy:{column:'updated_at',order:'desc'}});
  if(error)throw error;
  return (data||[]).map(parseItem).filter(Boolean).sort((a,b)=>b.createdAt-a.createdAt);
}
async function refreshRegistry(){
  if(!sb||!currentUser)return;
  setCloud('Синхронизация...');
  try{
    const items=await cloudList();
    renderRegistry(items);
    setCloud('Облако подключено','ok');
  }catch(e){
    console.error(e);
    setCloud('Ошибка синхронизации','bad');
    setMessage('Не удалось получить список источников: '+(e.message||String(e)),'bad');
  }
}
function renderRegistry(items){
  sourcesBody.replaceChildren();
  sourceCount.textContent=String(items.length);
  emptyState.classList.toggle('hidden',items.length>0);
  tableWrap.classList.toggle('hidden',items.length===0);

  items.forEach(entry=>{
    const tr=document.createElement('tr');

    const tdSource=document.createElement('td');
    const code=document.createElement('div');
    code.className='source-code';
    code.textContent=logicalName(entry);
    tdSource.appendChild(code);

    const tdDate=document.createElement('td');
    tdDate.textContent=formatRuDate(entry.actualDate);

    const tdFile=document.createElement('td');
    tdFile.className='source-file';
    tdFile.title=entry.originalName;
    tdFile.textContent=entry.originalName;

    const tdAdded=document.createElement('td');
    tdAdded.textContent=formatDateTime(entry.updatedAt,entry.createdAt);

    const tdActions=document.createElement('td');
    const actions=document.createElement('div');
    actions.className='row-actions';

    const download=document.createElement('button');
    download.className='row-btn';
    download.type='button';
    download.textContent='Скачать';
    download.addEventListener('click',()=>downloadEntry(entry,download));

    const remove=document.createElement('button');
    remove.className='row-btn danger';
    remove.type='button';
    remove.textContent='Удалить';
    remove.addEventListener('click',()=>deleteEntry(entry,remove));

    actions.append(download,remove);
    tdActions.appendChild(actions);
    tr.append(tdSource,tdDate,tdFile,tdAdded,tdActions);
    sourcesBody.appendChild(tr);
  });
}
async function uploadSource(){
  const file=sourceFile.files?.[0];
  const name=sourceName.value.trim();
  const date=actualDate.value;
  if(!file||!name||!date||!sb||!currentUser)return;

  busy=true;
  updatePreview();
  setMessage('Загружаю '+logicalName({source:name,actualDate:date})+'...');
  try{
    const stamp=Date.now();
    const objectName=PREFIX+stamp+'__'+encodeText(name)+'__'+date+'__'+safeName(file.name);
    const path=currentUser.id+'/'+objectName;
    const {error}=await sb.storage.from(CLOUD_BUCKET).upload(path,file,{
      cacheControl:'3600',
      upsert:false,
      contentType:file.type||'application/octet-stream'
    });
    if(error)throw error;
    setMessage('Источник '+normalizeSource(name)+'_'+formatRuDate(date)+' сохранён.','ok');
    sourceFile.value='';
    filePickText.textContent='Выбрать файл';
    selectedFileName.textContent='Файл не выбран';
    await refreshRegistry();
  }catch(e){
    console.error(e);
    setMessage('Не удалось сохранить файл: '+(e.message||String(e)),'bad');
  }finally{
    busy=false;
    updatePreview();
  }
}
async function downloadEntry(entry,button){
  button.disabled=true;
  try{
    const {data,error}=await sb.storage.from(CLOUD_BUCKET).download(entry.path);
    if(error)throw error;
    const url=URL.createObjectURL(data);
    const a=document.createElement('a');
    a.href=url;
    a.download=entry.originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){
    setMessage('Не удалось скачать файл: '+(e.message||String(e)),'bad');
  }finally{
    button.disabled=false;
  }
}
async function deleteEntry(entry,button){
  if(!confirm('Удалить источник '+logicalName(entry)+'?'))return;
  button.disabled=true;
  try{
    const {error}=await sb.storage.from(CLOUD_BUCKET).remove([entry.path]);
    if(error)throw error;
    setMessage('Источник удалён.','ok');
    await refreshRegistry();
  }catch(e){
    setMessage('Не удалось удалить источник: '+(e.message||String(e)),'bad');
    button.disabled=false;
  }
}

function openApp(user){
  currentUser=user;
  gate.classList.add('app-hidden');
  shell.classList.remove('app-hidden');
  userEmail.textContent=user.email||'';
  refreshRegistry();
}
async function acceptSession(session){
  if(!session?.access_token)return false;
  try{
    const {data,error}=await sb.auth.getUser(session.access_token);
    if(error)throw error;
    const user=data.user;
    const email=String(user?.email||'').toLowerCase();
    if(!domainOk(email)){
      await sb.auth.signOut({scope:'local'}).catch(()=>{});
      clearLegacy();
      setAuthStatus('Доступ разрешён только для адресов @atom.team.','bad');
      return false;
    }
    saveLegacy(session.access_token,session.refresh_token);
    cleanCallbackUrl();
    openApp(user);
    return true;
  }catch(e){
    console.error('Session validation failed',e);
    return false;
  }
}
async function restoreLegacy(){
  const access=localStorage.getItem('atom_access_token');
  const refresh=localStorage.getItem('atom_refresh_token');
  if(!access&&!refresh)return false;
  if(access&&refresh){
    try{
      const {data,error}=await sb.auth.setSession({access_token:access,refresh_token:refresh});
      if(!error&&data.session&&await acceptSession(data.session))return true;
    }catch{}
  }
  if(access){
    try{
      const d=await call(AUTH_ENDPOINT,{action:'check',access_token:access});
      if(d.allowed){
        const {data}=await sb.auth.getUser(access);
        if(data?.user){openApp(data.user);return true}
      }
    }catch{}
  }
  clearLegacy();
  return false;
}
async function bootAuth(){
  if(!window.supabase?.createClient){
    setAuthStatus('Не удалось загрузить модуль авторизации.','bad');
    return;
  }
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit',storageKey:'atom-sales-plan-auth'}
  });

  const cb=callbackParams();
  if(cb.error||cb.errorCode){
    const msg=decodeURIComponent((cb.errorDescription||cb.errorCode||cb.error||'Ошибка входа').replace(/\+/g,' '));
    cleanCallbackUrl();
    setAuthStatus('Ссылка не сработала: '+msg+'. Запросите новую ссылку.','bad');
    return;
  }
  setAuthStatus(cb.access?'Завершаю вход...':'Проверяю текущий доступ...');

  if(cb.access&&cb.refresh){
    try{
      const {data,error}=await sb.auth.setSession({access_token:cb.access,refresh_token:cb.refresh});
      if(!error&&data.session&&await acceptSession(data.session))return;
    }catch{}
  }
  try{
    const {data,error}=await sb.auth.getSession();
    if(!error&&data.session&&await acceptSession(data.session))return;
  }catch{}
  if(await restoreLegacy())return;
  setAuthStatus('Введите рабочую почту @atom.team. Пароль не нужен.');
}
async function sendLink(){
  const email=emailEl.value.trim().toLowerCase();
  if(!domainOk(email)){setAuthStatus('Доступ разрешён только для адресов @atom.team.','bad');return}
  sendBtn.disabled=true;
  setAuthStatus('Отправляю ссылку...');
  try{
    await call(SEND_ENDPOINT,{email});
    setAuthStatus('Ссылка отправлена на '+email+'. Откройте последнее письмо и нажмите ссылку для входа.','ok');
  }catch(e){
    const m=String(e.message||e);
    if(m==='domain_not_allowed')setAuthStatus('Доступ разрешён только для @atom.team.','bad');
    else if(/rate limit|over_email_send_rate_limit/i.test(m))setAuthStatus('Лимит отправки писем Supabase. Используйте уже полученное последнее письмо или повторите позже.','bad');
    else setAuthStatus(m,'bad');
  }finally{
    sendBtn.disabled=false;
  }
}

const today=new Date();
actualDate.value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
sourceName.addEventListener('input',updatePreview);
actualDate.addEventListener('input',updatePreview);
sourceFile.addEventListener('change',()=>{
  const file=sourceFile.files?.[0];
  filePickText.textContent=file?'Файл выбран':'Выбрать файл';
  selectedFileName.textContent=file?.name||'Файл не выбран';
  updatePreview();
});
uploadBtn.addEventListener('click',uploadSource);
sendBtn.addEventListener('click',sendLink);
emailEl.addEventListener('keydown',e=>{if(e.key==='Enter')sendLink()});
logoutBtn.addEventListener('click',async()=>{
  try{if(sb)await sb.auth.signOut({scope:'local'})}catch{}
  clearLegacy();
  location.href=location.pathname;
});
updatePreview();
bootAuth().catch(e=>{console.error(e);setAuthStatus('Не удалось проверить доступ. Обновите страницу или запросите новую ссылку.','bad')});
})();