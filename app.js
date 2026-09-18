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
const S={salesFile:null,smmtFile:null,templateFile:null,model:null};
const E={salesFile:$('salesFile'),smmtFile:$('smmtFile'),templateFile:$('templateFile'),salesName:$('salesName'),smmtName:$('smmtName'),templateName:$('templateName'),salesStatus:$('salesStatus'),smmtStatus:$('smmtStatus'),templateStatus:$('templateStatus'),salesCard:$('salesCard'),smmtCard:$('smmtCard'),templateCard:$('templateCard'),readyBadge:$('readyBadge'),buildBtn:$('buildBtn'),resetBtn:$('resetBtn'),printBtn:$('printBtn'),excelBtn:$('excelBtn'),parseLog:$('parseLog'),reportSection:$('reportSection'),approveCheck:$('approveCheck'),saveSnapshotBtn:$('saveSnapshotBtn')};
window.ATOMCurrentFiles={sales:null,smmt:null,template:null};
window.ATOMCurrentModel=null;

const CLOUD_BUCKET='plan-source-files';
let cloudClient=null;
let cloudUser=null;
let cloudReady=false;
let cloudSyncing=false;

function cloudPrefix(kind){return kind+'__'}
function cloudStamp(name,kind){
  const m=String(name||'').match(new RegExp('^'+kind+'__(\\d+)__'));
  return m?Number(m[1]):0;
}
function cloudOriginalName(name,kind){
  return String(name||'').replace(new RegExp('^'+kind+'__\\d+__'),'')||kind;
}
function cloudSafeName(name){
  return String(name||'file').replace(/[\\/]+/g,'_').replace(/[\u0000-\u001f\u007f]/g,'_').slice(0,160);
}
async function cloudList(){
  if(!cloudReady||!cloudClient||!cloudUser)return [];
  const {data,error}=await cloudClient.storage.from(CLOUD_BUCKET).list(cloudUser.id,{limit:100,sortBy:{column:'updated_at',order:'desc'}});
  if(error)throw error;
  return data||[];
}
async function cloudUpload(kind,file){
  if(!cloudReady||!cloudClient||!cloudUser||!file)return;
  const list=await cloudList();
  const prefix=cloudPrefix(kind);
  const old=(list||[]).filter(x=>String(x.name||'').startsWith(prefix)).map(x=>cloudUser.id+'/'+x.name);
  if(old.length){
    const {error}=await cloudClient.storage.from(CLOUD_BUCKET).remove(old);
    if(error)throw error;
  }
  const stamp=Number(file.lastModified||Date.now());
  const path=cloudUser.id+'/'+kind+'__'+stamp+'__'+cloudSafeName(file.name);
  const {error}=await cloudClient.storage.from(CLOUD_BUCKET).upload(path,file,{
    cacheControl:'3600',
    upsert:false,
    contentType:file.type||'application/octet-stream'
  });
  if(error)throw error;
}
async function cloudDelete(kind){
  if(!cloudReady||!cloudClient||!cloudUser)return;
  const list=await cloudList();
  const prefix=cloudPrefix(kind);
  const paths=(list||[]).filter(x=>String(x.name||'').startsWith(prefix)).map(x=>cloudUser.id+'/'+x.name);
  if(paths.length){
    const {error}=await cloudClient.storage.from(CLOUD_BUCKET).remove(paths);
    if(error)throw error;
  }
}
async function cloudDownload(kind,item){
  const path=cloudUser.id+'/'+item.name;
  const {data,error}=await cloudClient.storage.from(CLOUD_BUCKET).download(path);
  if(error)throw error;
  const stamp=cloudStamp(item.name,kind)||Date.now();
  return new File([data],cloudOriginalName(item.name,kind),{type:data.type||'application/octet-stream',lastModified:stamp});
}
function assignCloudFile(kind,file){
  if(kind==='sales')S.salesFile=file;
  else if(kind==='smmt')S.smmtFile=file;
  else S.templateFile=file;
  showFile(kind,file,true);
}
async function syncCloudState(){
  if(!cloudReady||cloudSyncing)return;
  cloudSyncing=true;
  try{
    if(E.parseLog)E.parseLog.textContent='Синхронизирую файлы с облаком...';
    let list=await cloudList();
    let restored=false;
    for(const kind of ['sales','smmt','template']){
      const prefix=cloudPrefix(kind);
      const remote=(list||[]).filter(x=>String(x.name||'').startsWith(prefix)).sort((x,y)=>cloudStamp(y.name,kind)-cloudStamp(x.name,kind))[0]||null;
      const local=kind==='sales'?S.salesFile:kind==='smmt'?S.smmtFile:S.templateFile;
      const remoteStamp=remote?cloudStamp(remote.name,kind):0;
      const localStamp=local?Number(local.lastModified||0):0;
      if(local&&(!remote||localStamp>remoteStamp)){
        await cloudUpload(kind,local);
        list=await cloudList();
        continue;
      }
      if(remote&&(!local||remoteStamp>localStamp)){
        const file=await cloudDownload(kind,remote);
        assignCloudFile(kind,file);
        await saveFile(kind,file);
        restored=true;
      }
    }
    syncCurrentFiles();
    updateReady();
    if(restored&&S.salesFile&&S.templateFile){
      await buildReport({scroll:false,reason:'cloud'});
    }
    if(E.parseLog){
      const names=[S.salesFile?.name,S.smmtFile?.name,S.templateFile?.name].filter(Boolean);
      E.parseLog.textContent=names.length
        ?'Облачная синхронизация включена. Файлы доступны после входа на другом компьютере.'
        :'Облачная синхронизация включена. Загрузите исходные файлы.';
    }
  }catch(e){
    console.error('Cloud sync failed',e);
    if(E.parseLog)E.parseLog.textContent='Локальные данные доступны, но облачная синхронизация сейчас не выполнена: '+(e.message||String(e));
  }finally{
    cloudSyncing=false;
  }
}
function connectCloud(client,user){
  if(!client||!user?.id)return;
  cloudClient=client;
  cloudUser=user;
  cloudReady=true;
  syncCloudState();
}
document.addEventListener('atom-auth-ready',e=>connectCloud(e.detail?.client,e.detail?.user));
if(window.ATOMSupabase&&window.ATOMAuthUser)connectCloud(window.ATOMSupabase,window.ATOMAuthUser);


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
async function deleteStoredFile(kind){
  try{
    const db=await openDb();
    await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(kind);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
    db.close();
  }catch(e){console.warn('File reset failed',e)}
}
function mirrorFileToInput(input,file){
  if(!input||!file)return;
  try{const dt=new DataTransfer();dt.items.add(file);input.files=dt.files}catch(e){console.debug('Input file mirror skipped',e)}
}
function syncCurrentFiles(){
  window.ATOMCurrentFiles.sales=S.salesFile;
  window.ATOMCurrentFiles.smmt=S.smmtFile;
  window.ATOMCurrentFiles.template=S.templateFile;
  mirrorFileToInput(E.salesFile,S.salesFile);
  mirrorFileToInput(E.smmtFile,S.smmtFile);
  mirrorFileToInput(E.templateFile,S.templateFile);
}
function fileStamp(file){
  if(!file)return '';
  return [file.name||'',Number(file.size||0),Number(file.lastModified||0)].join('|');
}
function saveModel(){
  if(!S.model)return;
  try{localStorage.setItem(MODEL_KEY,JSON.stringify({savedAt:new Date().toISOString(),salesName:S.salesFile?.name||'',templateName:S.templateFile?.name||'',salesStamp:fileStamp(S.salesFile),templateStamp:fileStamp(S.templateFile),model:S.model}))}catch(e){console.warn('Model cache failed',e)}
}
function loadModel(){
  try{const raw=localStorage.getItem(MODEL_KEY);if(!raw)return null;const data=JSON.parse(raw);return data?.model?data:null}catch(e){return null}
}
function setStatus(kind,state,text){
  const card=kind==='sales'?E.salesCard:kind==='smmt'?E.smmtCard:E.templateCard;
  const status=kind==='sales'?E.salesStatus:kind==='smmt'?E.smmtStatus:E.templateStatus;
  card?.classList.remove('loaded','error');
  if(status){status.className='upload-status '+(state==='loaded'?'status-loaded':state==='error'?'status-error':'status-empty');status.textContent=text}
  if(state==='loaded')card?.classList.add('loaded');
  if(state==='error')card?.classList.add('error');
}
function updateReady(){
  const c=[S.salesFile,S.smmtFile,S.templateFile].filter(Boolean).length;
  if(E.readyBadge){E.readyBadge.textContent=`${c} / 3`;E.readyBadge.classList.toggle('complete',c===3)}
  const coreReady=Boolean(S.salesFile&&S.templateFile);
  if(E.buildBtn)E.buildBtn.disabled=!coreReady;
  if(E.printBtn)E.printBtn.disabled=!coreReady||!S.model;
  if(E.excelBtn)E.excelBtn.disabled=!coreReady||!S.model;
}
function showFile(kind,file,restored=false){
  if(!file)return;
  const nameEl=kind==='sales'?E.salesName:kind==='smmt'?E.smmtName:E.templateName;
  if(nameEl)nameEl.textContent=file.name;
  setStatus(kind,'loaded',restored?'Сохранен':'Загружен');
}
function loadScript(url,timeout=7000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const t=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('timeout'))},timeout);s.src=url;s.async=true;s.onload=()=>{if(done)return;done=true;clearTimeout(t);resolve()};s.onerror=()=>{if(done)return;done=true;clearTimeout(t);s.remove();reject(new Error('load error'))};document.head.appendChild(s)})}
async function ensureXLSX(){if(window.XLSX)return true;for(const src of ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){try{await loadScript(src);if(window.XLSX)return true}catch(e){}}throw new Error('Модуль Excel не загрузился. Проверьте доступ к CDN и повторите.')}

function worksheetFromReportTable(table){
  if(!table)return null;
  const clone=table.cloneNode(true);
  clone.querySelectorAll('tr').forEach(row=>{row.hidden=false;row.style.display=''});
  clone.querySelectorAll('[hidden]').forEach(el=>el.removeAttribute('hidden'));
  const ws=window.XLSX.utils.table_to_sheet(clone,{raw:true});
  const head=clone.rows?.[0];
  if(head){
    ws['!cols']=Array.from(head.cells).map((cell,i)=>({wch:i===0?26:i===1?44:14}));
    if(head.cells.length&&clone.rows.length){
      ws['!autofilter']={ref:window.XLSX.utils.encode_range({s:{r:0,c:0},e:{r:clone.rows.length-1,c:head.cells.length-1}})};
    }
  }
  return ws;
}

async function exportExcel(){
  if(!S.model||!E.reportSection||E.reportSection.classList.contains('hidden'))return;
  const originalText=E.excelBtn?.textContent||'↓ Выгрузить Excel';
  if(E.excelBtn){E.excelBtn.disabled=true;E.excelBtn.textContent='Готовлю Excel...'}
  try{
    await ensureXLSX();
    const wb=window.XLSX.utils.book_new();
    const one=$('onePage');
    const dateText=one?.querySelector('.analytics-data-date')?.textContent?.trim()||'';
    const periodText=one?.querySelector('.period-chip.active')?.textContent?.trim()||one?.querySelector('.period-range')?.textContent?.trim()||'';
    const kpis=Array.from(one?.querySelectorAll('.analytics-kpi')||[]).map(card=>[
      card.querySelector('.analytics-kpi-label')?.textContent?.trim()||'',
      card.querySelector('.analytics-kpi-value')?.textContent?.trim()||'',
      card.querySelector('.analytics-kpi-note')?.textContent?.trim()||''
    ]);
    const summaryRows=[
      ['АТОМ Коммерческий штаб',''],
      ['Выгружено',new Date().toLocaleString('ru-RU')],
      ['Период',periodText],
      ['Дата данных',dateText.replace(/^Данные на\s*/i,'')],
      ['Источник',S.model?.sheetName||'S&OP09 plan'],
      [],
      ['Показатель','Значение','Комментарий'],
      ...kpis
    ];
    const summary=window.XLSX.utils.aoa_to_sheet(summaryRows);
    summary['!cols']=[{wch:34},{wch:22},{wch:44}];
    window.XLSX.utils.book_append_sheet(wb,summary,'Сводка');

    const balanceTable=one?.querySelector('.balance-table');
    const distributionTable=one?.querySelector('.distribution-table');
    const balance=worksheetFromReportTable(balanceTable);
    const distribution=worksheetFromReportTable(distributionTable);
    if(balance){
      if(balance['!cols']?.length){balance['!cols'][0]={wch:38};for(let i=1;i<balance['!cols'].length;i++)balance['!cols'][i]={wch:14}}
      window.XLSX.utils.book_append_sheet(wb,balance,'Баланс');
    }
    if(distribution){
      if(distribution['!cols']?.length){distribution['!cols'][0]={wch:22};if(distribution['!cols'][1])distribution['!cols'][1]={wch:46};for(let i=2;i<distribution['!cols'].length;i++)distribution['!cols'][i]={wch:14}}
      window.XLSX.utils.book_append_sheet(wb,distribution,'Распределение');
    }

    const stamp=new Date();
    const pad=n=>String(n).padStart(2,'0');
    const fileName='ATOM_SOP09_'+stamp.getFullYear()+'-'+pad(stamp.getMonth()+1)+'-'+pad(stamp.getDate())+'.xlsx';
    window.XLSX.writeFile(wb,fileName,{compression:true});
    if(E.parseLog)E.parseLog.textContent='Excel выгружен: '+fileName;
  }catch(err){
    console.error('Excel export failed',err);
    if(E.parseLog)E.parseLog.textContent='Не удалось выгрузить Excel: '+(err.message||String(err));
  }finally{
    if(E.excelBtn){E.excelBtn.textContent=originalText;E.excelBtn.disabled=!(S.salesFile&&S.templateFile&&S.model)}
  }
}

async function buildReport({scroll=false,reason='manual'}={}){
  if(!S.salesFile||!S.templateFile)return;
  if(E.buildBtn){E.buildBtn.disabled=true;E.buildBtn.textContent='Обновляю...'}
  if(E.parseLog)E.parseLog.textContent=reason==='restore'?'Восстанавливаю сохраненные данные...':'Читаю актуальный S&OP09 plan...';
  try{
    await ensureXLSX();
    S.model=await window.ATOMTemplateView.renderFromFile(S.salesFile,S.templateFile.name);
    if(S.smmtFile&&window.ATOMTemplateView?.parseSmmtFile){
      try{S.model.smmt=await window.ATOMTemplateView.parseSmmtFile(S.smmtFile)}catch(e){console.warn('SMMT parse failed',e);S.model.smmt={found:false,months:{},year:null,yearFound:false,error:String(e?.message||e)}}
      window.ATOMTemplateView.renderModel(S.model,S.templateFile.name);
    }
    window.ATOMCurrentModel=S.model;
    saveModel();
    setStatus('sales','loaded','Сохранен');
    setStatus('template','loaded','Сохранен');
    E.reportSection?.classList.remove('hidden');
    if(E.printBtn)E.printBtn.disabled=false;
    if(E.excelBtn)E.excelBtn.disabled=false;
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
  const valid=kind==='template'?/\.pptx$/i.test(file.name):/\.(xlsx|xls|xlsm)$/i.test(file.name);
  if(!valid){setStatus(kind,'error','Неверный формат');if(E.parseLog)E.parseLog.textContent='Выбран файл неподдерживаемого формата. Сохраненный файл не заменен.';return}
  if(kind==='sales'){
    S.salesFile=file;
    S.model=null;
    window.ATOMCurrentModel=null;
    try{localStorage.removeItem(MODEL_KEY)}catch{}
  }else if(kind==='smmt'){
    S.smmtFile=file;
  }else S.templateFile=file;
  showFile(kind,file,false);
  await saveFile(kind,file);
  if(cloudReady){
    try{await cloudUpload(kind,file)}catch(e){console.error('Cloud upload failed',e);if(E.parseLog)E.parseLog.textContent='Файл сохранен локально, но облачная синхронизация не выполнена: '+(e.message||String(e))}
  }
  syncCurrentFiles();
  updateReady();
  if(E.parseLog)E.parseLog.textContent=`${kind==='smmt'?'Файл СММТ':'Файл'} заменен и сохранен: ${file.name}`;
  if(S.salesFile&&S.templateFile)await buildReport({scroll:false,reason:'replace'});
}

async function resetFile(kind){
  const isSales=kind==='sales';
  const isSmmt=kind==='smmt';
  const file=isSales?S.salesFile:isSmmt?S.smmtFile:S.templateFile;
  if(!file)return;
  await deleteStoredFile(kind);
  if(cloudReady){
    try{await cloudDelete(kind)}catch(e){console.error('Cloud delete failed',e)}
  }
  if(isSales){
    S.salesFile=null;
    S.model=null;
    window.ATOMCurrentModel=null;
    E.reportSection?.classList.add('hidden');
    const onePage=$('onePage');if(onePage)onePage.innerHTML='';
    try{localStorage.removeItem(MODEL_KEY)}catch{}
  }else if(isSmmt){
    S.smmtFile=null;
    if(S.model){
      delete S.model.smmt;
      window.ATOMCurrentModel=S.model;
      try{window.ATOMTemplateView?.renderModel(S.model,S.templateFile?.name||'PPTX-шаблон')}catch{}
      saveModel();
    }
  }else{
    S.templateFile=null;
    try{localStorage.removeItem(MODEL_KEY)}catch{}
  }
  const input=isSales?E.salesFile:isSmmt?E.smmtFile:E.templateFile;
  const name=isSales?E.salesName:isSmmt?E.smmtName:E.templateName;
  try{if(input)input.value=''}catch{}
  if(name)name.textContent='Файл не выбран';
  setStatus(kind,'empty','Не загружен');
  syncCurrentFiles();
  updateReady();
  const label=isSales?'План продаж':isSmmt?'СММТ':'Шаблон презентации';
  if(E.parseLog)E.parseLog.textContent=`${label} сброшен. Загрузите новый файл.`;
}

E.salesFile?.addEventListener('click',()=>{try{E.salesFile.value=''}catch{}});
E.smmtFile?.addEventListener('click',()=>{try{E.smmtFile.value=''}catch{}});
E.templateFile?.addEventListener('click',()=>{try{E.templateFile.value=''}catch{}});
E.salesFile?.addEventListener('change',async()=>{const f=E.salesFile.files?.[0]||null;if(f)await replaceFile('sales',f)});
E.smmtFile?.addEventListener('change',async()=>{const f=E.smmtFile.files?.[0]||null;if(f)await replaceFile('smmt',f)});
E.templateFile?.addEventListener('change',async()=>{const f=E.templateFile.files?.[0]||null;if(f)await replaceFile('template',f)});
document.addEventListener('click',async e=>{
  const btn=e.target.closest?.('[data-reset-file]');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  await resetFile(btn.dataset.resetFile);
},true);
document.addEventListener('keydown',async e=>{
  const btn=e.target.closest?.('[data-reset-file]');
  if(!btn||!(e.key==='Enter'||e.key===' '))return;
  e.preventDefault();
  e.stopPropagation();
  await resetFile(btn.dataset.resetFile);
},true);
E.buildBtn?.addEventListener('click',async()=>{await buildReport({scroll:true,reason:'manual'})});
E.excelBtn?.addEventListener('click',exportExcel);
E.saveSnapshotBtn?.addEventListener('click',()=>{if(!S.model)return;localStorage.setItem('atom-onepage-baseline',JSON.stringify({savedAt:new Date().toISOString(),model:S.model}));E.saveSnapshotBtn.textContent='База сохранена'});

if(E.resetBtn){E.resetBtn.style.display='none'}

async function boot(){
  setStatus('sales','empty','Не загружен');
  setStatus('smmt','empty','Не загружен');
  setStatus('template','empty','Не загружен');
  const cached=loadModel();
  if(cached?.model&&window.ATOMTemplateView){
    try{
      S.model=cached.model;
      window.ATOMCurrentModel=S.model;
      window.ATOMTemplateView.renderModel(S.model,cached.templateName||'PPTX-шаблон');
      E.reportSection?.classList.remove('hidden');
      if(E.parseLog)E.parseLog.textContent='Показываю сохраненную таблицу. Восстанавливаю файлы...';
    }catch(e){console.warn('Cached model render failed',e)}
  }
  const [sales,smmt,template]=await Promise.all([loadFile('sales'),loadFile('smmt'),loadFile('template')]);
  if(sales){S.salesFile=sales;showFile('sales',sales,true)}
  if(smmt){S.smmtFile=smmt;showFile('smmt',smmt,true)}
  if(template){S.templateFile=template;showFile('template',template,true)}
  syncCurrentFiles();
  updateReady();
  if(S.salesFile&&S.templateFile){
    if(cached?.model&&cached.salesStamp&&cached.templateStamp&&cached.salesStamp===fileStamp(S.salesFile)&&cached.templateStamp===fileStamp(S.templateFile)){
      if(E.printBtn)E.printBtn.disabled=false;
      if(E.excelBtn)E.excelBtn.disabled=false;
      if(E.parseLog)E.parseLog.textContent=`Сохраненные файлы и таблица восстановлены. СММТ: ${S.smmtFile?S.smmtFile.name:'не загружен'}.`;
    }else{
      await buildReport({scroll:false,reason:'restore'});
    }
  }else if(!cached?.model){
    if(E.parseLog)E.parseLog.textContent='Выберите файлы. После входа файлы сохраняются в облаке и локально, затем восстанавливаются на любом вашем компьютере.';
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
    #sources .file-actions{position:relative!important;z-index:4!important;display:flex!important;align-items:center!important;gap:8px!important;margin-top:10px!important;flex-wrap:wrap!important}
    #sources .replace-file-btn,#sources .reset-file-btn{position:relative!important;z-index:4!important;display:inline-flex!important;align-items:center!important;width:max-content!important;margin-top:0!important;padding:8px 10px!important;border:1px solid #d0d5dd!important;border-radius:6px!important;background:#fff!important;font-size:12px!important;font-weight:700!important;line-height:1!important}
    #sources .replace-file-btn{color:#344054!important}
    #sources .reset-file-btn{color:#b42318!important;border-color:#f1b8b5!important;cursor:pointer!important}
    #sources .reset-file-btn:hover{background:#fef3f2!important}
    #sources .drop-card:not(.loaded) .reset-file-btn{display:none!important}
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

(()=>{
'use strict';
const PANEL_KEY='atom-sidebar-collapsed-v1';
const sources=document.getElementById('sources');
const page=document.querySelector('#appShell .page');
if(!sources||!page)return;
let collapsed=false;
try{collapsed=localStorage.getItem(PANEL_KEY)==='true'}catch{}

let closeBtn=document.getElementById('sidebarCollapseBtn');
if(!closeBtn){
  closeBtn=document.createElement('button');
  closeBtn.id='sidebarCollapseBtn';
  closeBtn.type='button';
  closeBtn.className='sidebar-collapse-btn';
  closeBtn.textContent='Закрыть панель';
  const nav=document.querySelector('.sidebar-main-nav');
  if(nav)nav.appendChild(closeBtn);
}
let openBtn=document.getElementById('sidebarOpenBtn');
if(!openBtn){
  openBtn=document.createElement('button');
  openBtn.id='sidebarOpenBtn';
  openBtn.type='button';
  openBtn.className='sidebar-open-btn no-print';
  openBtn.textContent='Открыть панель';
  document.body.appendChild(openBtn);
}
function apply(){
  document.body.classList.toggle('sidebar-collapsed',collapsed);
  closeBtn.textContent=collapsed?'Открыть панель':'Закрыть панель';
  try{localStorage.setItem(PANEL_KEY,String(collapsed))}catch{}
}
closeBtn.addEventListener('click',()=>{collapsed=!collapsed;apply()});
openBtn.addEventListener('click',()=>{collapsed=false;apply()});
apply();

const style=document.createElement('style');
style.id='sidebar-collapse-style';
style.textContent=`
  .sidebar-collapse-btn{display:flex;align-items:center;width:100%;min-height:38px;padding:0 11px;border:1px solid #d9dde5;border-radius:8px;background:#fff;color:#475467;text-align:left;font:700 12px Arial,Helvetica,sans-serif;cursor:pointer}
  .sidebar-collapse-btn:hover{background:#f4f6f8;color:#101828}
  .sidebar-open-btn{display:none;position:fixed;left:12px;top:12px;z-index:1000;height:38px;padding:0 12px;border:1px solid #d9dde5;border-radius:8px;background:#fff;color:#344054;font:700 12px Arial,Helvetica,sans-serif;box-shadow:0 4px 14px rgba(16,24,40,.12);cursor:pointer}
  body.sidebar-collapsed #sources.source-block{display:none!important}
  body.sidebar-collapsed #appShell .page{padding-left:28px!important}
  body.sidebar-collapsed .sidebar-open-btn{display:inline-flex;align-items:center}
  @media(max-width:900px){
    body.sidebar-collapsed #appShell .page{padding:20px 14px 50px!important}
    .sidebar-open-btn{left:10px;top:10px}
  }
`;
document.head.appendChild(style);
})();