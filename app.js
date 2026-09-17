(()=>{
'use strict';
const faviconSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#071217"/><circle cx="32" cy="32" r="21" fill="none" stroke="#19d6e1" stroke-width="4"/><path d="M22 43 30 20h4l8 23h-5l-2-6H29l-2 6h-5Zm8-10h4l-2-7-2 7Z" fill="#fff"/><circle cx="48" cy="16" r="4" fill="#19d6e1"/></svg>';
let favicon=document.querySelector('link[rel="icon"]');
if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon)}
favicon.type='image/svg+xml';
favicon.href='data:image/svg+xml,'+encodeURIComponent(faviconSvg);

const $=id=>document.getElementById(id);
const DB_NAME='atom-production-sales-plan';
const DB_STORE='files';
const DB_VERSION=1;
const MODEL_KEY='atom-production-sales-plan-current-model-v1';
const S={salesFile:null,templateFile:null,model:null};
const E={salesFile:$('salesFile'),templateFile:$('templateFile'),salesName:$('salesName'),templateName:$('templateName'),salesStatus:$('salesStatus'),templateStatus:$('templateStatus'),salesCard:$('salesCard'),templateCard:$('templateCard'),readyBadge:$('readyBadge'),buildBtn:$('buildBtn'),resetBtn:$('resetBtn'),printBtn:$('printBtn'),parseLog:$('parseLog'),reportSection:$('reportSection'),approveCheck:$('approveCheck'),saveSnapshotBtn:$('saveSnapshotBtn')};
window.ATOMCurrentFiles={sales:null,template:null};

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('IndexedDB недоступен'));return}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'kind'})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Не удалось открыть локальное хранилище'));
  });
}
async function saveFile(kind,file){
  try{
    const db=await openDb();
    const blob=file.slice(0,file.size,file.type||'application/octet-stream');
    await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put({kind,name:file.name,type:file.type,lastModified:file.lastModified||Date.now(),blob});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    db.close();
  }catch(e){console.warn('File persistence failed',e)}
}
async function loadFile(kind){
  try{
    const db=await openDb();
    const rec=await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly');const req=tx.objectStore(DB_STORE).get(kind);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});
    db.close();
    if(!rec?.blob)return null;
    return new File([rec.blob],rec.name,{type:rec.type||rec.blob.type,lastModified:rec.lastModified||Date.now()});
  }catch(e){console.warn('File restore failed',e);return null}
}
function mirrorFileToInput(input,file){
  if(!input||!file)return;
  try{const dt=new DataTransfer();dt.items.add(file);input.files=dt.files}catch(e){console.debug('Input file mirror skipped',e)}
}
function syncCurrentFiles(){
  window.ATOMCurrentFiles.sales=S.salesFile;
  window.ATOMCurrentFiles.template=S.templateFile;
  mirrorFileToInput(E.salesFile,S.salesFile);
  mirrorFileToInput(E.templateFile,S.templateFile);
}
function saveModel(){
  if(!S.model)return;
  try{localStorage.setItem(MODEL_KEY,JSON.stringify({savedAt:new Date().toISOString(),salesName:S.salesFile?.name||'',templateName:S.templateFile?.name||'',model:S.model}))}catch(e){console.warn('Model cache failed',e)}
}
function loadModel(){
  try{const raw=localStorage.getItem(MODEL_KEY);if(!raw)return null;const data=JSON.parse(raw);return data?.model?data:null}catch(e){return null}
}
function setStatus(kind,state,text){
  const card=kind==='sales'?E.salesCard:E.templateCard;
  const status=kind==='sales'?E.salesStatus:E.templateStatus;
  card?.classList.remove('loaded','error');
  if(status){status.className='upload-status '+(state==='loaded'?'status-loaded':state==='error'?'status-error':'status-empty');status.textContent=text}
  if(state==='loaded')card?.classList.add('loaded');
  if(state==='error')card?.classList.add('error');
}
function updateReady(){
  const c=[S.salesFile,S.templateFile].filter(Boolean).length;
  if(E.readyBadge){E.readyBadge.textContent=`${c} / 2`;E.readyBadge.classList.toggle('complete',c===2)}
  if(E.buildBtn)E.buildBtn.disabled=c!==2;
  if(E.printBtn)E.printBtn.disabled=c!==2||!S.model;
}
function showFile(kind,file,restored=false){
  if(!file)return;
  if(kind==='sales'){
    if(E.salesName)E.salesName.textContent=file.name;
    setStatus('sales','loaded',restored?'Сохранен':'Загружен');
  }else{
    if(E.templateName)E.templateName.textContent=file.name;
    setStatus('template','loaded',restored?'Сохранен':'Загружен');
  }
}
function loadScript(url,timeout=7000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const t=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('timeout'))},timeout);s.src=url;s.async=true;s.onload=()=>{if(done)return;done=true;clearTimeout(t);resolve()};s.onerror=()=>{if(done)return;done=true;clearTimeout(t);s.remove();reject(new Error('load error'))};document.head.appendChild(s)})}
async function ensureXLSX(){if(window.XLSX)return true;for(const src of ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){try{await loadScript(src);if(window.XLSX)return true}catch(e){}}throw new Error('Модуль Excel не загрузился. Проверьте доступ к CDN и повторите.')}

async function buildReport({scroll=false,reason='manual'}={}){
  if(!S.salesFile||!S.templateFile)return;
  if(E.buildBtn){E.buildBtn.disabled=true;E.buildBtn.textContent='Обновляю...'}
  if(E.parseLog)E.parseLog.textContent=reason==='restore'?'Восстанавливаю сохраненные данные...':'Читаю актуальный S&OP09 plan...';
  try{
    await ensureXLSX();
    S.model=await window.ATOMTemplateView.renderFromFile(S.salesFile,S.templateFile.name);
    saveModel();
    setStatus('sales','loaded','Сохранен');
    setStatus('template','loaded','Сохранен');
    E.reportSection?.classList.remove('hidden');
    if(E.printBtn)E.printBtn.disabled=false;
    if(E.approveCheck)E.approveCheck.checked=true;
    if(E.parseLog)E.parseLog.textContent=`Данные актуальны. Используются сохраненные файлы: ${S.salesFile.name} и ${S.templateFile.name}.`;
    if(scroll)E.reportSection?.scrollIntoView({behavior:'smooth',block:'start'});
  }catch(err){
    if(E.parseLog)E.parseLog.textContent=`Не удалось обновить таблицу: ${err.message||String(err)}`;
  }finally{
    if(E.buildBtn){E.buildBtn.textContent='Обновить данные';E.buildBtn.disabled=!(S.salesFile&&S.templateFile)}
    updateReady();
  }
}

async function replaceFile(kind,file){
  if(!file)return;
  const valid=kind==='sales'?/\.(xlsx|xls|xlsm)$/i.test(file.name):/\.pptx$/i.test(file.name);
  if(!valid){setStatus(kind,'error','Неверный формат');if(E.parseLog)E.parseLog.textContent='Выбран файл неподдерживаемого формата. Сохраненный файл не заменен.';return}
  if(kind==='sales')S.salesFile=file;else S.templateFile=file;
  showFile(kind,file,false);
  await saveFile(kind,file);
  syncCurrentFiles();
  updateReady();
  if(E.parseLog)E.parseLog.textContent=`Файл заменен и сохранен: ${file.name}`;
  if(S.salesFile&&S.templateFile)await buildReport({scroll:false,reason:'replace'});
}

E.salesFile?.addEventListener('change',async()=>{const f=E.salesFile.files?.[0]||null;if(f)await replaceFile('sales',f)});
E.templateFile?.addEventListener('change',async()=>{const f=E.templateFile.files?.[0]||null;if(f)await replaceFile('template',f)});
E.buildBtn?.addEventListener('click',async()=>{await buildReport({scroll:true,reason:'manual'})});
E.saveSnapshotBtn?.addEventListener('click',()=>{if(!S.model)return;localStorage.setItem('atom-onepage-baseline',JSON.stringify({savedAt:new Date().toISOString(),model:S.model}));E.saveSnapshotBtn.textContent='База сохранена'});

if(E.resetBtn){E.resetBtn.style.display='none'}

async function boot(){
  setStatus('sales','empty','Не загружен');
  setStatus('template','empty','Не загружен');
  const cached=loadModel();
  if(cached?.model&&window.ATOMTemplateView){
    try{
      S.model=cached.model;
      window.ATOMTemplateView.renderModel(S.model,cached.templateName||'PPTX-шаблон');
      E.reportSection?.classList.remove('hidden');
      if(E.parseLog)E.parseLog.textContent='Показываю сохраненную таблицу. Восстанавливаю файлы...';
    }catch(e){console.warn('Cached model render failed',e)}
  }
  const [sales,template]=await Promise.all([loadFile('sales'),loadFile('template')]);
  if(sales){S.salesFile=sales;showFile('sales',sales,true)}
  if(template){S.templateFile=template;showFile('template',template,true)}
  syncCurrentFiles();
  updateReady();
  if(S.salesFile&&S.templateFile){
    if(cached?.model&&cached.salesName===S.salesFile.name&&cached.templateName===S.templateFile.name){
      if(E.printBtn)E.printBtn.disabled=false;
      if(E.parseLog)E.parseLog.textContent='Сохраненные файлы и таблица восстановлены. Они останутся после обновления страницы, пока вы не выберете другие файлы.';
    }else{
      await buildReport({scroll:false,reason:'restore'});
    }
  }else if(!cached?.model){
    if(E.parseLog)E.parseLog.textContent='Выберите файлы. После первой загрузки они будут храниться в этом браузере и восстановятся после обновления страницы.';
  }
}

boot().catch(e=>{console.error(e);if(E.parseLog)E.parseLog.textContent='Не удалось восстановить сохраненные данные. Выберите файлы заново.'});
})();

(()=>{
  const style=document.createElement('style');
  style.id='analytics-readability-v2';
  style.textContent=`
    #appShell .page{max-width:none!important;margin:0!important;padding:30px 28px 70px 350px!important}
    #sources.source-block{position:fixed!important;z-index:30!important;left:0!important;top:58px!important;bottom:0!important;width:322px!important;margin:0!important;padding:24px 18px 28px!important;border:0!important;border-right:1px solid #e2e5e9!important;border-radius:0!important;background:#fff!important;overflow-y:auto!important;box-shadow:8px 0 24px rgba(16,24,40,.035)!important}
    #sources .section-kicker{font-size:11px!important;margin-bottom:7px!important}
    #sources .source-title-row{display:flex!important;flex-direction:column!important;gap:12px!important;margin-top:0!important}
    #sources .source-title-row h2{font-size:22px!important;line-height:1.15!important}
    #sources .source-title-row p{font-size:13px!important;line-height:1.45!important;color:#667085!important}
    #sources .source-counter{position:absolute!important;top:20px!important;right:18px!important;height:32px!important;min-width:54px!important;font-size:12px!important}
    #sources .upload-grid{display:grid!important;grid-template-columns:1fr!important;gap:14px!important;max-width:none!important;margin-top:20px!important}
    #sources .drop-card{min-height:178px!important;padding:16px!important;border-radius:10px!important}
    #sources .drop-card strong{margin-top:22px!important;font-size:16px!important;line-height:1.25!important}
    #sources .drop-card small{font-size:12px!important;line-height:1.35!important}
    #sources .file-index{font-size:13px!important}
    #sources .file-type{font-size:11px!important}
    #sources .upload-status{font-size:11px!important;padding:5px 9px!important}
    #sources .file-name{font-size:12px!important;line-height:1.35!important;white-space:normal!important;overflow-wrap:anywhere!important;padding-top:10px!important}
    #sources .replace-file-btn{font-size:12px!important;padding:8px 10px!important;margin-top:10px!important}
    #sources .source-actions{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:12px!important;margin-top:16px!important}
    #sources .source-actions .hint{font-size:12px!important;line-height:1.45!important;color:#667085!important}
    #sources .source-actions .btn{width:100%!important;height:44px!important;font-size:13px!important}
    #sources .parse-log{margin-top:13px!important;padding:12px!important;border-radius:8px!important;background:#f7f8fa!important;font-size:12px!important;line-height:1.45!important;color:#667085!important}
    .page-heading{max-width:1800px!important;margin:0 auto 22px!important}
    .page-heading h1{font-size:30px!important}
    .page-heading p{font-size:14px!important}
    .page-heading .btn{height:40px!important;font-size:13px!important}
    .report-shell{width:100%!important;max-width:1800px!important;margin:0 auto!important;transform:none!important}
    .analytics-onepage{padding:38px 40px 32px!important;border-radius:14px!important}
    .analytics-head{margin-bottom:26px!important}
    .analytics-head h2{font-size:44px!important;line-height:1.02!important}
    .analytics-subtitle{font-size:19px!important;line-height:1.45!important;margin-top:10px!important;color:#667085!important}
    .analytics-data-date{font-size:15px!important;color:#667085!important;padding-top:8px!important}
    .analytics-filterbar{margin-bottom:24px!important}
    .analytics-filter-label{font-size:13px!important}
    .period-chip,.source-pill{height:42px!important;padding:0 16px!important;font-size:16px!important}
    .period-range{font-size:15px!important;color:#667085!important}
    .analytics-kpi-grid{gap:15px!important;margin-bottom:26px!important}
    .analytics-kpi{min-height:154px!important;padding:20px!important;border-radius:12px!important}
    .analytics-kpi-label{font-size:15px!important;line-height:1.35!important;min-height:40px!important;color:#667085!important;font-weight:700!important}
    .analytics-kpi-value{font-size:44px!important;margin-top:12px!important}
    .analytics-kpi-note{font-size:14px!important;margin-top:12px!important;color:#667085!important;line-height:1.4!important}
    .analytics-section{margin-top:18px!important}
    .analytics-section-title{height:62px!important;padding:0 20px!important;font-size:18px!important;letter-spacing:.1px!important}
    .analytics-table-wrap{overflow:auto!important}
    .analytics-table{font-size:16px!important;min-width:1450px!important}
    .analytics-table th{height:58px!important;padding:0 14px!important;font-size:16px!important;color:#475467!important;font-weight:700!important}
    .analytics-table td{height:58px!important;padding:0 14px!important;font-size:16px!important;color:#344054!important}
    .analytics-table .dash-label{font-size:17px!important;font-weight:600!important;color:#101828!important}
    .analytics-table .dash-num,.analytics-table .dash-total{font-size:17px!important}
    .analytics-table .dash-total{font-weight:700!important}
    .balance-table th:first-child,.balance-table td:first-child{width:32%!important}
    .distribution-table{min-width:1560px!important}
    .distribution-table th:nth-child(1),.distribution-table td:nth-child(1){width:13%!important}
    .distribution-table th:nth-child(2),.distribution-table td:nth-child(2){width:31%!important}
    .distribution-table th:nth-child(3),.distribution-table td:nth-child(3){width:11%!important}
    .layer-summary td{height:64px!important}
    .layer-name strong{font-size:17px!important;color:#101828!important}
    .project-name strong{font-size:16px!important;line-height:1.35!important;color:#101828!important}
    .layer-name small,.project-name small{font-size:13px!important;line-height:1.35!important;margin-top:5px!important;color:#667085!important}
    .client-detail td{height:58px!important}
    .client-detail .project-name{padding-left:20px!important}
    .grand-total td{height:66px!important}
    .analytics-footnote{font-size:12px!important;padding-top:15px!important;color:#667085!important}
    @media(max-width:1250px){
      #appShell .page{padding-left:314px!important;padding-right:18px!important}
      #sources.source-block{width:292px!important;padding-left:14px!important;padding-right:14px!important}
      .analytics-kpi-grid{grid-template-columns:repeat(3,1fr)!important}
      .analytics-head h2{font-size:38px!important}
      .analytics-kpi-value{font-size:38px!important}
    }
    @media(max-width:900px){
      #appShell .page{padding:20px 14px 50px!important}
      #sources.source-block{position:relative!important;top:auto!important;left:auto!important;bottom:auto!important;width:100%!important;margin:0 0 18px!important;border:1px solid #e2e5e9!important;border-radius:12px!important;box-shadow:none!important}
      #sources .upload-grid{grid-template-columns:1fr 1fr!important}
      .analytics-kpi-grid{grid-template-columns:repeat(2,1fr)!important}
      .analytics-head h2{font-size:34px!important}
      .analytics-table-wrap{overflow-x:auto!important}
    }
    @media(max-width:620px){
      #sources .upload-grid{grid-template-columns:1fr!important}
      .analytics-kpi-grid{grid-template-columns:1fr!important}
      .analytics-head{flex-direction:column!important}
      .analytics-head h2{font-size:32px!important}
    }
  `;
  document.head.appendChild(style);
})();