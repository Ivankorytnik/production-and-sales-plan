(()=>{
'use strict';
const API=window.ATOMTemplateView;
if(!API)return;

const MONTHS=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const MONTH_ALIASES=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
const PERIODS={
  all:{label:'Весь 2026 год',months:MONTHS},
  H1:{label:'1 полугодие · Янв - Июн',months:['Янв','Фев','Мар','Апр','Май','Июн']},
  H2:{label:'2 полугодие · Июл - Дек',months:['Июл','Авг','Сен','Окт','Ноя','Дек']}
};
const MODE_KEY='atom-period-filter-v1';
const CLIENT_SHIP_PATCH='atom-client-ship-plan-v1';
const MODEL_KEY='atom-production-sales-plan-current-model-v1';
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v||0));
const dot=v=>Number(v||0)===0?'·':fmt(v);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const projectWord=v=>{const n=Math.abs(Number(v||0))%100;if(n>=11&&n<=14)return'проектов';const d=n%10;return d===1?'проект':d>=2&&d<=4?'проекта':'проектов'};
const norm=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const key=v=>norm(v).toLowerCase().replace(/ё/g,'е');
const num=v=>{if(typeof v==='number'&&Number.isFinite(v))return v;const s=norm(v);if(!s||s==='·'||s==='-'||s==='—'||s==='`')return 0;const x=Number(s.replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(x)?x:0};

try{
  if(localStorage.getItem(CLIENT_SHIP_PATCH)!=='1'){
    localStorage.removeItem(MODEL_KEY);
    localStorage.setItem(CLIENT_SHIP_PATCH,'1');
  }
}catch{}

function excelMonthLabel(v){
  const s=key(v);if(!s)return null;
  for(const [ru,en,label] of MONTH_ALIASES){
    if(new RegExp(`(^|[^а-яa-z])(${ru}[а-я]*|${en}[a-z]*)([^а-яa-z]|$)`,'i').test(s))return label;
  }
  return null;
}
function extractClientShipPlan(buf){
  if(!window.XLSX)return{found:false,months:{},year:null,yearFound:false,label:'Доступно для отгрузки клиенту-план'};
  const wb=XLSX.read(buf,{type:'array',cellDates:true});
  const sheetName=wb.SheetNames.find(x=>key(x).replace(/\s/g,'').includes('s&op09plan'))||wb.SheetNames.find(x=>key(x).includes('s&op09'))||wb.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true});
  let header=null;
  rows.slice(0,120).forEach((r,ri)=>{
    const cols=[];(r||[]).forEach((v,ci)=>{const m=excelMonthLabel(v);if(m)cols.push({ci,m})});
    const uniq=[...new Set(cols.map(x=>x.m))];
    if(uniq.length>=6&&(!header||uniq.length>header.count))header={ri,cols,count:uniq.length,row:r};
  });
  if(!header)return{found:false,months:{},year:null,yearFound:false,label:'Доступно для отгрузки клиенту-план'};
  const monthCols=[],seen=new Set();
  header.cols.forEach(x=>{if(!seen.has(x.m)){seen.add(x.m);monthCols.push(x)}});
  monthCols.sort((a,b)=>a.ci-b.ci);
  const first=Math.min(...monthCols.map(x=>x.ci));
  let totalCol=-1;
  (header.row||[]).forEach((v,ci)=>{if(/^(total|2026|итого\s*2026)$/i.test(norm(v)))totalCol=ci});
  const rowLabel=row=>{const parts=(row||[]).slice(0,first).map(norm).filter(Boolean);return parts.length?parts[parts.length-1]:''};
  for(const row of rows.slice(header.ri+1)){
    const label=rowLabel(row),s=key(label);
    if(!/^отгрузка\s+клиенту\s+план$/.test(s)&&!/^план\s+отгрузки\s+клиенту$/.test(s))continue;
    const months={};monthCols.forEach(c=>months[c.m]=num(row[c.ci]));
    const totalRaw=totalCol>=0?norm(row[totalCol]):'';
    const hasMonth=monthCols.some(c=>norm(row[c.ci])!=='');
    const fallback=Object.values(months).reduce((a,v)=>a+Number(v||0),0);
    return{found:true,label,months,year:totalRaw!==''?num(row[totalCol]):fallback,yearFound:totalRaw!==''||hasMonth};
  }
  return{found:false,months:{},year:null,yearFound:false,label:'Доступно для отгрузки клиенту-план'};
}

const originalParseWorkbook=API.parseWorkbook.bind(API);
API.parseWorkbook=buf=>{
  const model=originalParseWorkbook(buf);
  model.metrics=model.metrics||{};
  model.metrics.clientShipPlan=extractClientShipPlan(buf);
  return model;
};

function defaultState(){
  const now=new Date();
  return{mode:'half',key:now.getMonth()<6?'H1':'H2'};
}
function loadState(){
  const d=defaultState();
  try{
    const saved={...d,...JSON.parse(localStorage.getItem(MODE_KEY)||'{}')};
    if(saved.mode!=='all'&&saved.mode!=='half')saved.mode='half';
    if(saved.key!=='H1'&&saved.key!=='H2')saved.key=d.key;
    return saved;
  }catch{return d}
}
let state=loadState();
let currentModel=null;

function saveState(){try{localStorage.setItem(MODE_KEY,JSON.stringify(state))}catch{}}
function selectedMonths(){return state.mode==='all'?MONTHS:(PERIODS[state.key]?.months||PERIODS.H2.months)}
function periodLabel(){return state.mode==='all'?PERIODS.all.label:(PERIODS[state.key]?.label||PERIODS.H2.label)}
function periodShort(){return state.mode==='all'?'2026':(state.key==='H1'?'1 полугодие':'2 полугодие')}
function periodTotalHeader(){
  if(state.mode==='all')return'Итого 2026';
  return state.key==='H1'?'Итого Янв - Июн':'Итого Июл - Дек';
}
function sumMonths(metric,months){return months.reduce((sum,m)=>sum+Number(metric?.months?.[m]||0),0)}
function annualTotal(metric){
  if(!metric)return 0;
  return metric.yearFound?Number(metric.year||0):sumMonths(metric,MONTHS);
}
function metricTotal(metric){
  if(!metric)return 0;
  if(state.mode==='all')return annualTotal(metric);
  return sumMonths(metric,selectedMonths());
}
function renderControls(){
  const bar=document.querySelector('.analytics-filterbar');
  if(!bar)return;
  const source=currentModel?.sheetName||'S&OP09 plan';
  const halfOptions=['H1','H2'].map(h=>`<option value="${h}"${h===state.key?' selected':''}>${PERIODS[h].label}</option>`).join('');
  bar.innerHTML=`
    <div class="analytics-filter-group period-control-group">
      <span class="analytics-filter-label">ПЕРИОД</span>
      <div class="period-mode-tabs" role="group" aria-label="Выбор периода">
        <button type="button" data-period-mode="all" class="period-mode-btn${state.mode==='all'?' active':''}">Весь период</button>
        <button type="button" data-period-mode="half" class="period-mode-btn${state.mode==='half'?' active':''}">6 месяцев</button>
      </div>
      ${state.mode==='half'?`<select id="periodDetailSelect" class="period-detail-select" aria-label="Выбор полугодия">${halfOptions}</select>`:''}
    </div>
    <div class="analytics-filter-group source"><span class="analytics-filter-label">ИСТОЧНИК</span><span class="source-pill">${esc(source)}</span></div>`;
}
function metricRow(label,metric,months,cls=''){
  return `<tr class="${cls}"><td class="dash-label">${esc(label)}</td><td class="dash-total">${dot(metricTotal(metric))}</td>${months.map(m=>`<td class="dash-num">${dot(metric?.months?.[m]||0)}</td>`).join('')}</tr>`;
}
function clientSummaryRow(layer,metric,count,months){
  return `<tr class="layer-summary"><td class="layer-name"><strong>${esc(layer)}</strong><small>${count?`${count} ${projectWord(count)}`:'итого'}</small></td><td class="project-name"><strong>Итого ${esc(layer)}</strong></td><td class="dash-total">${dot(metricTotal(metric))}</td>${months.map(m=>`<td class="dash-num">${dot(metric?.months?.[m]||0)}</td>`).join('')}</tr>`;
}
function clientDetailRow(x,months){
  const product=x.product?`<small>${esc(x.product)}</small>`:'';
  return `<tr class="client-detail"><td></td><td class="project-name"><strong>${esc(x.displayName||x.name)}</strong>${product}</td><td class="dash-total">${dot(metricTotal(x))}</td>${months.map(m=>`<td class="dash-num">${dot(x?.months?.[m]||0)}</td>`).join('')}</tr>`;
}
function updateKpis(model){
  const cards=[...document.querySelectorAll('.analytics-kpi')];
  const metrics=[model.metrics?.production,model.metrics?.shipPlan,model.metrics?.shipped,model.metrics?.booked,model.metrics?.free];
  cards.forEach((card,i)=>{
    const val=card.querySelector('.analytics-kpi-value');
    const note=card.querySelector('.analytics-kpi-note');
    if(val)val.textContent=fmt(metricTotal(metrics[i]));
    if(note)note.textContent=periodLabel();
  });
}
function rebuildTables(model){
  const months=selectedMonths();
  const totalHeader=periodTotalHeader();
  const balance=document.querySelector('.balance-table');
  if(balance){
    balance.querySelector('thead').innerHTML=`<tr><th>Показатель</th><th>${totalHeader}</th>${months.map(m=>`<th>${m}</th>`).join('')}</tr>`;
    balance.querySelector('tbody').innerHTML=[
      metricRow('План производства',model.metrics?.production,months),
      metricRow('План отгрузки с завода',model.metrics?.shipPlan,months),
      metricRow('Отгружено автомобилей',model.metrics?.shipped,months),
      metricRow('Доступно для отгрузки клиенту-план',model.metrics?.clientShipPlan,months,'row-client-ship-plan'),
      metricRow('Передано в корпоративный парк',model.metrics?.corp,months),
      metricRow('Забронировано клиентами',model.metrics?.booked,months,'row-accent'),
      metricRow('Свободный сток / доступно',model.metrics?.free,months)
    ].join('');
  }
  const dist=document.querySelector('.distribution-table');
  if(dist){
    dist.querySelector('thead').innerHTML=`<tr><th>Бизнес-слой</th><th>Компания / проект</th><th>${totalHeader}</th>${months.map(m=>`<th>${m}</th>`).join('')}</tr>`;
    let body='';
    for(const layer of ['B2C','B2B','B2G']){
      const items=(model.clients||[])
        .filter(x=>x.vertical===layer)
        .slice()
        .sort((a,b)=>{
          const diff=annualTotal(b)-annualTotal(a);
          if(diff!==0)return diff;
          return String(a.displayName||a.name||'').localeCompare(String(b.displayName||b.name||''),'ru');
        });
      const metric=model.verticals?.[layer];
      if(layer==='B2G'&&!metric?.found&&!items.length)continue;
      body+=clientSummaryRow(layer,metric,items.length,months);
      body+=items.map(x=>clientDetailRow(x,months)).join('');
    }
    body+=`<tr class="grand-total"><td class="layer-name"><strong>ВСЕГО</strong></td><td class="project-name"><strong>Забронировано клиентами</strong></td><td class="dash-total">${dot(metricTotal(model.metrics?.booked))}</td>${months.map(m=>`<td class="dash-num">${dot(model.metrics?.booked?.months?.[m]||0)}</td>`).join('')}</tr>`;
    dist.querySelector('tbody').innerHTML=body;
  }
}
function applyPeriod(model){
  if(!model)return;
  currentModel=model;
  renderControls();
  updateKpis(model);
  rebuildTables(model);
  document.querySelectorAll('.analytics-section-title').forEach((el,i)=>{
    el.textContent=(i===0?'БАЛАНС ПРОИЗВОДСТВА И ПРОДАЖ':'КОММЕРЧЕСКОЕ РАСПРЕДЕЛЕНИЕ ПО СЛОЯМ')+` · ${periodShort().toUpperCase()}`;
  });
}

const originalRenderModel=API.renderModel.bind(API);
const originalRenderFromFile=API.renderFromFile.bind(API);
API.renderModel=(model,templateName)=>{originalRenderModel(model,templateName);applyPeriod(model)};
API.renderFromFile=async(file,templateName)=>{const model=await originalRenderFromFile(file,templateName);applyPeriod(model);return model};

document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-period-mode]');
  if(!btn)return;
  state.mode=btn.dataset.periodMode==='all'?'all':'half';
  saveState();
  applyPeriod(currentModel);
});
document.addEventListener('change',e=>{
  if(e.target.id!=='periodDetailSelect')return;
  state.key=e.target.value==='H1'?'H1':'H2';
  saveState();
  applyPeriod(currentModel);
});

const style=document.createElement('style');
style.id='period-filter-style';
style.textContent=`
  .period-control-group{display:flex!important;align-items:center!important;gap:10px!important;flex-wrap:wrap!important}
  .period-mode-tabs{display:flex;align-items:center;border:1px solid #d9dde5;border-radius:9px;overflow:hidden;background:#fff}
  .period-mode-btn{height:42px;padding:0 18px;border:0;border-right:1px solid #e4e7ec;background:#fff;color:#475467;font:700 14px Arial,Helvetica,sans-serif;cursor:pointer;white-space:nowrap}
  .period-mode-btn:last-child{border-right:0}
  .period-mode-btn:hover{background:#f7f8fa}
  .period-mode-btn.active{background:#111318;color:#fff}
  .period-detail-select{height:42px;min-width:225px;padding:0 34px 0 12px;border:1px solid #d9dde5;border-radius:9px;background:#fff;color:#101828;font:700 14px Arial,Helvetica,sans-serif;cursor:pointer}
  .analytics-filterbar{align-items:center!important;gap:16px!important;flex-wrap:wrap!important}
  .analytics-filter-group.source{margin-left:auto!important}
  .analytics-table th,.analytics-table td{white-space:nowrap}
  .analytics-table .project-name{white-space:normal!important}
  @media(max-width:1100px){.period-mode-tabs{width:auto}.analytics-filter-group.source{margin-left:0!important}}
`;
document.head.appendChild(style);
})();