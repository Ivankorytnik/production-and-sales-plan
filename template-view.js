(()=>{
'use strict';
const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
const VIEW_MONTHS=['Июл','Авг','Сен','Окт','Ноя','Дек'];
const $=id=>document.getElementById(id);
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const num=v=>{if(typeof v==='number'&&Number.isFinite(v))return v;const s=n(v);if(!s||s==='·'||s==='-'||s==='—'||s==='`')return 0;const x=Number(s.replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(x)?x:0};
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v||0));
const dot=v=>Number(v||0)===0?'·':fmt(v);
const esc=s=>n(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function monthLabel(v){if(v instanceof Date&&!isNaN(v))return MONTHS[v.getMonth()][2];const s=k(v);if(!s)return null;for(const [ru,en,label] of MONTHS){if(new RegExp(`(^|[^а-яa-z])(${ru}[а-я]*|${en}[a-z]*)([^а-яa-z]|$)`,'i').test(s))return label}return null}
function findHeader(rows){let best=null;rows.slice(0,120).forEach((r,ri)=>{const cols=[];(r||[]).forEach((v,ci)=>{const m=monthLabel(v);if(m)cols.push({ci,m})});const uniq=[...new Set(cols.map(x=>x.m))];if(uniq.length>=6&&(!best||uniq.length>best.count))best={ri,cols,count:uniq.length,row:r}});return best}
function addMetric(target,src){if(!target)return{...src,months:{...src.months}};for(const [m,v] of Object.entries(src.months||{}))target.months[m]=(target.months[m]||0)+v;if(src.yearFound){target.year=(target.year||0)+(src.year||0);target.yearFound=true}target.found=true;return target}
function parseWorkbook(buf){
  if(!window.XLSX)throw new Error('Модуль Excel еще не загружен.');
  const wb=XLSX.read(buf,{type:'array',cellDates:true});
  const sheetName=wb.SheetNames.find(x=>k(x).replace(/\s/g,'').includes('s&op09plan'))||wb.SheetNames.find(x=>k(x).includes('s&op09'))||wb.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true});
  const h=findHeader(rows);if(!h)throw new Error('На листе S&OP09 plan не найдена строка месяцев.');
  const monthCols=[],seen=new Set();h.cols.forEach(x=>{if(!seen.has(x.m)){seen.add(x.m);monthCols.push(x)}});monthCols.sort((a,b)=>a.ci-b.ci);
  const first=Math.min(...monthCols.map(x=>x.ci));
  let totalCol=-1;(h.row||[]).forEach((v,ci)=>{if(/^(total|2026|итого\s*2026)$/i.test(n(v)))totalCol=ci});
  const rowLabel=row=>{const p=(row||[]).slice(0,first).map(n).filter(Boolean);return p.length?p[p.length-1]:''};
  const rowMetric=row=>{const months={};monthCols.forEach(c=>months[c.m]=num(row[c.ci]));const yearFound=totalCol>=0&&n(row[totalCol])!=='';return{found:true,months,year:yearFound?num(row[totalCol]):null,yearFound}};
  const firstMetric=re=>{for(const row of rows){const label=rowLabel(row);if(re.test(k(label)))return{...rowMetric(row),label}}return{found:false,months:{},year:null,yearFound:false,label:''}};
  const metrics={
    production:firstMetric(/^план производства/),
    shipPlan:firstMetric(/^отгрузка с завода план$|^план отгрузк.*завод/),
    shipped:firstMetric(/^отгрузка с завода факт$|^отгружено.*авто/),
    corp:firstMetric(/^передано в корпоративный парк$|^передано.*корп/),
    booked:firstMetric(/^выдачи$|^всего забронировано$|^забронировано клиентами$/),
    free:firstMetric(/^доступно$|^свободный сток$|^свободн.*сток/)
  };
  const verticals={B2B:null,B2G:null,B2C:null};
  const clients={},order=[];
  let currentVertical=null,product=null;
  const isAggregate=(s,v)=>new RegExp(`^(контракты\\s*${v.toLowerCase()}|итого\\s*${v.toLowerCase()}|${v.toLowerCase()})(\\s+всего)?$`).test(s.replace(/\s+/g,' '));
  const group=s=>/^фэмили$|^family$/.test(s)?'Family':(/^такси$|^taxi$/.test(s)?'Taxi':(/^каршеринг$|^carsharing$/.test(s)?'Carsharing':null));
  const keyFor=(label,prod)=>{const s=k(label);if(s==='гринтех энерджи'&&(prod==='Taxi'||prod==='Carsharing'))return `${s}|${prod}`;return s};
  for(let ri=h.ri+1;ri<rows.length;ri++){
    const row=rows[ri]||[],label=rowLabel(row),s=k(label);if(!label)continue;
    if(isAggregate(s,'B2B')){currentVertical='B2B';product=null;verticals.B2B=rowMetric(row);continue}
    if(isAggregate(s,'B2G')){currentVertical='B2G';product=null;verticals.B2G=rowMetric(row);continue}
    if(isAggregate(s,'B2C')){currentVertical='B2C';product=null;verticals.B2C=rowMetric(row);continue}
    if(/^выдачи$|^доступно$/.test(s)){currentVertical=null;product=null;continue}
    const g=group(s);if(g){product=g;continue}
    if(!currentVertical||currentVertical==='B2C')continue;
    if(/^план |^выпуск |^отгрузка |^передано /.test(s))continue;
    const key=keyFor(label,product),m=rowMetric(row);
    if(!clients[key]){clients[key]={key,name:label,product,vertical:currentVertical,found:true,months:{},year:0,yearFound:false};order.push(key)}
    addMetric(clients[key],m);
  }
  const aliasName=x=>{const s=k(x.name);if(s==='ассоциация учреждений по управлению имуществом и материального обеспечения')return'Ассоциация учреждений УИМО';if(s==='гринтех энерджи'&&x.product==='Carsharing')return'Гринтех Энерджи - каршеринг';if(s==='гринтех энерджи'&&x.product==='Taxi')return'Гринтех Энерджи - такси';return n(x.name)};
  const clientRows=order.map(key=>({...clients[key],displayName:aliasName(clients[key])}));
  const sourceDate=(()=>{for(const row of rows.slice(0,8)){for(const v of row||[]){const m=n(v).match(/обновлено\s*(\d{2}\.\d{2}\.\d{4})/i);if(m)return m[1]}}return null})();
  return{sheetName,metrics,verticals,clients:clientRows,sourceDate};
}
function metricYear(m){return m?.yearFound?Number(m.year||0):0}
function monthCells(metric){return VIEW_MONTHS.map(m=>`<td class="dash-num">${dot(metric?.months?.[m]||0)}</td>`).join('')}
function metricRow(label,metric,cls=''){
  const missing=!metric?.found?' is-missing':'';
  return `<tr class="${cls}${missing}"><td class="dash-label">${esc(label)}</td><td class="dash-total">${metric?.found?dot(metricYear(metric)):'·'}</td>${monthCells(metric)}</tr>`;
}
function projectWord(v){const n=Math.abs(Number(v||0))%100;if(n>=11&&n<=14)return'проектов';const d=n%10;return d===1?'проект':d>=2&&d<=4?'проекта':'проектов'}
function clientSummaryRow(layer,metric,count){
  return `<tr class="layer-summary"><td class="layer-name"><strong>${esc(layer)}</strong><small>${count?`${count} ${projectWord(count)}`:'итого'}</small></td><td class="project-name"><strong>Итого ${esc(layer)}</strong></td><td class="dash-total">${dot(metricYear(metric))}</td>${monthCells(metric)}</tr>`;
}
function clientDetailRow(x){
  const product=x.product?`<small>${esc(x.product)}</small>`:'';
  return `<tr class="client-detail"><td></td><td class="project-name"><strong>${esc(x.displayName)}</strong>${product}</td><td class="dash-total">${dot(metricYear(x))}</td>${monthCells(x)}</tr>`;
}
function kpiCard(label,metric,note,tone=''){
  return `<div class="analytics-kpi ${tone}"><div class="analytics-kpi-label">${esc(label)}</div><div class="analytics-kpi-value">${metric?.found?fmt(metricYear(metric)):'·'}</div><div class="analytics-kpi-note">${esc(note)}</div></div>`;
}
function renderModel(model,templateName){
  const one=$('onePage');if(!one)return;
  const {metrics,verticals}=model;
  const b2b=model.clients.filter(x=>x.vertical==='B2B');
  const b2g=model.clients.filter(x=>x.vertical==='B2G');
  const date=model.sourceDate||new Date().toLocaleDateString('ru-RU');
  one.className='one-page analytics-onepage';
  const kpiHtml=[
    kpiCard('План производства',metrics.production,'2026, S&OP09'),
    kpiCard('План отгрузки',metrics.shipPlan,'с завода'),
    kpiCard('Отгружено автомобилей',metrics.shipped,'факт на дату файла','accent-red'),
    kpiCard('Забронировано клиентами',metrics.booked,'все коммерческие слои','accent-green'),
    kpiCard('Свободный сток',metrics.free,'доступно к распределению','accent-green')
  ].join('');
  const balance=[
    metricRow('План производства',metrics.production),
    metricRow('План отгрузки с завода',metrics.shipPlan),
    metricRow('Отгружено автомобилей',metrics.shipped),
    metricRow('Передано в корпоративный парк',metrics.corp),
    metricRow('Забронировано клиентами',metrics.booked,'row-accent'),
    metricRow('Свободный сток / доступно',metrics.free)
  ].join('');
  let distribution='';
  distribution+=clientSummaryRow('B2C',verticals.B2C,0);
  distribution+=clientSummaryRow('B2B',verticals.B2B,b2b.length)+b2b.map(clientDetailRow).join('');
  if(verticals.B2G?.found||b2g.length)distribution+=clientSummaryRow('B2G',verticals.B2G,b2g.length)+b2g.map(clientDetailRow).join('');
  distribution+=`<tr class="grand-total"><td class="layer-name"><strong>ВСЕГО</strong></td><td class="project-name"><strong>Забронировано клиентами</strong></td><td class="dash-total">${dot(metricYear(metrics.booked))}</td>${monthCells(metrics.booked)}</tr>`;
  one.innerHTML=`
    <div class="analytics-head">
      <div>
        <h2>Аналитика</h2>
        <div class="analytics-subtitle">Производство, отгрузка и коммерческое распределение АТОМ</div>
      </div>
      <div class="analytics-data-date">Данные на ${esc(date)}</div>
    </div>
    <div class="analytics-filterbar">
      <div class="analytics-filter-group"><span class="analytics-filter-label">ПЕРИОД</span><span class="period-chip active">6 мес</span><span class="period-range">Июль - декабрь 2026</span></div>
      <div class="analytics-filter-group source"><span class="analytics-filter-label">ИСТОЧНИК</span><span class="source-pill">${esc(model.sheetName||'S&OP09 plan')}</span></div>
    </div>
    <div class="analytics-kpi-grid">${kpiHtml}</div>
    <section class="analytics-section">
      <div class="analytics-section-title">БАЛАНС ПРОИЗВОДСТВА И ПРОДАЖ · 6 МЕС</div>
      <div class="analytics-table-wrap">
        <table class="analytics-table balance-table">
          <thead><tr><th>Показатель</th><th>Итого 2026</th>${VIEW_MONTHS.map(m=>`<th>${m}</th>`).join('')}</tr></thead>
          <tbody>${balance}</tbody>
        </table>
      </div>
    </section>
    <section class="analytics-section distribution-section">
      <div class="analytics-section-title">КОММЕРЧЕСКОЕ РАСПРЕДЕЛЕНИЕ ПО СЛОЯМ · 6 МЕС</div>
      <div class="analytics-table-wrap">
        <table class="analytics-table distribution-table">
          <thead><tr><th>Бизнес-слой</th><th>Компания / проект</th><th>Итого 2026</th>${VIEW_MONTHS.map(m=>`<th>${m}</th>`).join('')}</tr></thead>
          <tbody>${distribution}</tbody>
        </table>
      </div>
    </section>
    <div class="analytics-footnote"><span>В таблицах показаны все поля, используемые в текущей презентации.</span><span>${esc(templateName||'PPTX-шаблон')} · ${esc(model.sheetName||'S&OP09 plan')}</span></div>`;
  const d=$('reportDate');if(d)d.textContent=date;
  const t=$('templateInfo');if(t)t.textContent=`Шаблон презентации: ${templateName||'—'}`;
  const sc=$('sourceCount');if(sc)sc.textContent='2/2';
}
async function renderFromFile(file,templateName){const buf=await file.arrayBuffer();const model=parseWorkbook(buf);renderModel(model,templateName);return model}
window.ATOMTemplateView={parseWorkbook,renderModel,renderFromFile};
})();

(()=>{
  const version=document.querySelector('.user-nav > span:first-child');
  if(!version)return;
  const loadedAt=new Date().toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',','');
  version.textContent=`Версия v2.5.0 · загрузка ${loadedAt}`;
})();

(()=>{
'use strict';
const $=id=>document.getElementById(id);
const heading=document.querySelector('.page-heading');
const helper=heading?.querySelector('p');
if(helper)helper.remove();
const duplicatePptx=$('downloadHtmlBtn');
if(duplicatePptx)duplicatePptx.style.display='none';

const titleRow=heading?.firstElementChild;
if(titleRow)titleRow.classList.add('heading-title-row');

const uploadGrid=document.querySelector('#sources .upload-grid');
const sourceTitle=document.querySelector('#sources .source-title-row h2');
const sourceText=document.querySelector('#sources .source-title-row p');
const templateIndex=document.querySelector('#templateCard .file-index');
if(sourceTitle)sourceTitle.textContent='Загрузите 3 файла';
if(sourceText)sourceText.textContent='План продаж, СММТ и PPTX-шаблон. Файлы сохраняются в браузере.';
if(templateIndex)templateIndex.textContent='03';

if(uploadGrid&&!$('smmtCard')){
  const card=document.createElement('label');
  card.className='drop-card';
  card.id='smmtCard';
  card.innerHTML='<input id="smmtFile" type="file" accept=".xlsx,.xls,.xlsm" /><div class="drop-card-top"><span class="file-index">02</span><span class="file-type">EXCEL</span></div><strong>СММТ</strong><small>Вкладка «Все проекты»</small><span id="smmtStatus" class="upload-status status-empty">Не загружен</span><span class="file-name" id="smmtName">Файл не выбран</span><span class="replace-file-btn">Заменить файл</span>';
  const templateCard=$('templateCard');
  if(templateCard)uploadGrid.insertBefore(card,templateCard);else uploadGrid.appendChild(card);
}

const smmtInput=$('smmtFile'),smmtCard=$('smmtCard'),smmtStatus=$('smmtStatus'),smmtName=$('smmtName'),readyBadge=$('readyBadge');
const DB_NAME='atom-production-sales-plan',DB_STORE='files',DB_VERSION=1;
window.ATOMCurrentFiles=window.ATOMCurrentFiles||{};

function openDb(){return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error('IndexedDB недоступен'));return}const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'kind'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('DB error'))})}
async function saveSmmt(file){const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put({kind:'smmt',name:file.name,type:file.type,lastModified:file.lastModified||Date.now(),blob:file.slice(0,file.size,file.type||'application/octet-stream')});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function loadSmmt(){try{const db=await openDb();const rec=await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly');const req=tx.objectStore(DB_STORE).get('smmt');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});db.close();if(!rec?.blob)return null;return new File([rec.blob],rec.name,{type:rec.type||rec.blob.type,lastModified:rec.lastModified||Date.now()})}catch(e){console.warn('SMMT restore failed',e);return null}}
function mirror(file){if(!smmtInput||!file)return;try{const dt=new DataTransfer();dt.items.add(file);smmtInput.files=dt.files}catch{}}
function setSmmt(file,restored=false){if(!file)return;window.ATOMCurrentFiles.smmt=file;if(smmtName)smmtName.textContent=file.name;if(smmtStatus){smmtStatus.className='upload-status status-loaded';smmtStatus.textContent=restored?'Сохранен':'Загружен'}smmtCard?.classList.add('loaded');mirror(file);updateCount()}
function updateCount(){const loaded=[document.getElementById('salesCard'),document.getElementById('smmtCard'),document.getElementById('templateCard')].filter(card=>card?.classList.contains('loaded')).length;if(readyBadge){readyBadge.textContent=`${loaded} / 3`;readyBadge.classList.toggle('complete',loaded===3)}}

smmtInput?.addEventListener('change',async()=>{const file=smmtInput.files?.[0]||null;if(!file)return;if(!/\.(xlsx|xls|xlsm)$/i.test(file.name)){if(smmtStatus){smmtStatus.className='upload-status status-error';smmtStatus.textContent='Неверный формат'}return}try{await saveSmmt(file);setSmmt(file,false);const log=$('parseLog');if(log)log.textContent=`СММТ сохранен: ${file.name}`;}catch(e){console.error(e)}});

const observer=new MutationObserver(()=>setTimeout(updateCount,0));
['salesCard','templateCard','smmtCard'].forEach(id=>{const el=$(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class']})});
setTimeout(updateCount,0);
loadSmmt().then(file=>{if(file)setSmmt(file,true)});

const style=document.createElement('style');
style.id='header-smmt-v1';
style.textContent=`
  .page-heading{align-items:center!important;flex-wrap:nowrap!important;gap:18px!important}
  .page-heading .heading-title-row{display:flex!important;align-items:center!important;gap:14px!important;min-width:0!important}
  .page-heading .breadcrumb{margin:0!important;white-space:nowrap!important}
  .page-heading h1{margin:0!important;white-space:nowrap!important}
  .page-heading .heading-actions{margin-left:auto!important;flex-wrap:nowrap!important;white-space:nowrap!important}
  #downloadHtmlBtn{display:none!important}
  @media(max-width:900px){.page-heading{flex-wrap:wrap!important}.page-heading .heading-actions{width:auto!important}.page-heading .heading-title-row{flex-wrap:wrap!important}}
`;
document.head.appendChild(style);
})();