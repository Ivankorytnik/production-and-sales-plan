(()=>{
'use strict';

const PARSER_VERSION='3.1.1';
const MODEL_KEY='atom-production-sales-plan-current-model-v1';
const PERIOD_KEY='atom-period-filter-v2';
const LAYER_KEY='atom-business-layer-collapse-v2';
const STOCK_VISIBILITY_KEY='atom-free-stock-visibility-v1';
const SMMT_VISIBILITY_KEY='atom-smmt-visibility-v1';
const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
const MONTH_NAMES=MONTHS.map(x=>x[2]);
const PERIODS={
  all:{label:'Весь 2026 год',short:'2026',months:MONTH_NAMES},
  H1:{label:'1 полугодие · Янв - Июн',short:'1 полугодие',months:['Янв','Фев','Мар','Апр','Май','Июн']},
  H2:{label:'2 полугодие · Июл - Дек',short:'2 полугодие',months:['Июл','Авг','Сен','Окт','Ноя','Дек']}
};
const $=id=>document.getElementById(id);
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const num=v=>{
  if(typeof v==='number'&&Number.isFinite(v))return v;
  const s=n(v);
  if(!s||s==='·'||s==='-'||s==='—'||s==='`')return 0;
  const x=Number(s.replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));
  return Number.isFinite(x)?x:0;
};
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v||0));
const dot=v=>Number(v||0)===0?'·':fmt(v);
const esc=s=>n(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

try{
  if(localStorage.getItem('atom-parser-version')!==PARSER_VERSION){
    localStorage.removeItem(MODEL_KEY);
    localStorage.setItem('atom-parser-version',PARSER_VERSION);
  }
}catch{}

function monthLabel(v){
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return MONTHS[v.getMonth()][2];
  const s=k(v);if(!s)return null;
  for(const [ru,en,label] of MONTHS){
    if(new RegExp(`(^|[^а-яa-z])(${ru}[а-я]*|${en}[a-z]*)([^а-яa-z]|$)`,'i').test(s))return label;
  }
  return null;
}
function findHeader(rows){
  let best=null;
  rows.slice(0,120).forEach((r,ri)=>{
    const cols=[];
    (r||[]).forEach((v,ci)=>{const m=monthLabel(v);if(m)cols.push({ci,m})});
    const uniq=[...new Set(cols.map(x=>x.m))];
    if(uniq.length>=6&&(!best||uniq.length>best.count))best={ri,cols,count:uniq.length,row:r};
  });
  return best;
}
function addMetric(target,src){
  if(!target)return{...src,months:{...(src.months||{})}};
  for(const [m,v] of Object.entries(src.months||{}))target.months[m]=(target.months[m]||0)+Number(v||0);
  if(src.yearFound){target.year=(target.year||0)+Number(src.year||0);target.yearFound=true}
  target.found=true;
  return target;
}
function sumMonths(metric,months=MONTH_NAMES){return months.reduce((sum,m)=>sum+Number(metric?.months?.[m]||0),0)}
function annualTotal(metric){return metric?.yearFound?Number(metric.year||0):sumMonths(metric)}
function hasVerticalToken(s,v){return new RegExp(`(^|[^a-z0-9])${v.toLowerCase()}([^a-z0-9]|$)`,'i').test(s)}
function isAggregate(s,v){
  const t=s.replace(/\s+/g,' '),vl=v.toLowerCase();
  return t===vl||t===`итого ${vl}`||(hasVerticalToken(t,v)&&(t.includes('контракт')||t.includes('забронирован')||t.startsWith('итого ')));
}
function groupLabel(s){
  if(/^фэмили$|^family$/.test(s))return'Family';
  if(/^такси$|^taxi$/.test(s))return'Taxi';
  if(/^каршеринг$|^carsharing$/.test(s))return'Carsharing';
  return null;
}
function parseWorkbook(buf){
  if(!window.XLSX)throw new Error('Модуль Excel еще не загружен.');
  const wb=XLSX.read(buf,{type:'array',cellDates:true});
  const sheetName=wb.SheetNames.find(x=>k(x).replace(/\s/g,'').includes('s&op09plan'))||wb.SheetNames.find(x=>k(x).includes('s&op09'))||wb.SheetNames[0];
  if(!sheetName)throw new Error('В Excel не найден лист S&OP09 plan.');
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true});
  const h=findHeader(rows);
  if(!h)throw new Error('На листе S&OP09 plan не найдена строка месяцев.');

  const monthCols=[],seen=new Set();
  h.cols.forEach(x=>{if(!seen.has(x.m)){seen.add(x.m);monthCols.push(x)}});
  monthCols.sort((a,b)=>a.ci-b.ci);
  const first=Math.min(...monthCols.map(x=>x.ci));
  let totalCol=-1;
  (h.row||[]).forEach((v,ci)=>{if(/^(total|2026|итого\s*2026)$/i.test(n(v)))totalCol=ci});
  const rowLabel=row=>{const p=(row||[]).slice(0,first).map(n).filter(Boolean);return p.length?p[p.length-1]:''};
  const rowMetric=row=>{
    const months={};
    monthCols.forEach(c=>months[c.m]=num(row[c.ci]));
    const totalRaw=totalCol>=0?n(row[totalCol]):'';
    const hasMonthValue=monthCols.some(c=>n(row[c.ci])!=='');
    const fallbackTotal=Object.values(months).reduce((a,v)=>a+Number(v||0),0);
    const yearFound=totalRaw!==''||hasMonthValue;
    return{found:true,months,year:yearFound?(totalRaw!==''?num(row[totalCol]):fallbackTotal):null,yearFound};
  };
  const hasPeriodData=row=>monthCols.some(c=>n(row[c.ci])!=='')||(totalCol>=0&&n(row[totalCol])!=='');
  const firstMetric=matcher=>{
    for(const row of rows){
      const label=rowLabel(row),s=k(label);
      if((matcher instanceof RegExp&&matcher.test(s))||(typeof matcher==='function'&&matcher(s)))return{...rowMetric(row),label};
    }
    return{found:false,months:{},year:null,yearFound:false,label:''};
  };

  const metrics={
    production:firstMetric(/^план производства/),
    shipPlan:firstMetric(/^отгрузка с завода план$|^план отгрузк.*завод/),
    shipped:firstMetric(/^отгрузка с завода факт$|^отгружено.*авто/),
    clientShipPlan:firstMetric(s=>/^отгрузка\s+клиенту\s+план$/.test(s)||/^план\s+отгрузки\s+клиенту$/.test(s)||/^доступно\s+для\s+отгрузки\s+клиенту[-\s]*план$/.test(s)),
    corp:firstMetric(s=>(s.includes('корпоративн')&&s.includes('парк'))||s.includes('передано в корпоративный парк')),
    booked:firstMetric(s=>s==='выдачи'||s==='всего забронировано'||s==='забронировано клиентами'||(s.includes('забронировано')&&s.includes('всего'))),
    free:(()=>{const exact=firstMetric(s=>s.includes('свободный сток'));return exact.found?exact:firstMetric(s=>s==='доступно'||(s.startsWith('доступно')&&s.includes('конец месяца')))})()
  };

  const verticals={B2B:null,B2G:null,B2C:null};
  const clients={},order=[];
  let currentVertical=null,product=null;
  for(let ri=h.ri+1;ri<rows.length;ri++){
    const row=rows[ri]||[];
    const label=rowLabel(row),s=k(label);
    if(!label)continue;
    if(isAggregate(s,'B2B')){currentVertical='B2B';product=null;verticals.B2B=rowMetric(row);continue}
    if(isAggregate(s,'B2G')){currentVertical='B2G';product=null;verticals.B2G=rowMetric(row);continue}
    if(isAggregate(s,'B2C')){currentVertical='B2C';product=null;verticals.B2C=rowMetric(row);continue}
    if(s==='выдачи'||s.startsWith('доступно')||(s.includes('забронировано')&&s.includes('всего'))){currentVertical=null;product=null;continue}
    const g=groupLabel(s);if(g){product=g;continue}
    if(!currentVertical)continue;
    if(/^план |^выпуск |^отгрузка |^передано |^контракты |^итого /.test(s))continue;
    if(!hasPeriodData(row)&&currentVertical==='B2C')continue;
    const m=rowMetric(row);
    const clientKey=`${currentVertical}|${s}|${product||''}`;
    if(!clients[clientKey]){
      clients[clientKey]={key:clientKey,name:label,displayName:label,product,vertical:currentVertical,found:true,months:{},year:0,yearFound:false};
      order.push(clientKey);
    }
    addMetric(clients[clientKey],m);
  }

  const aliasName=x=>{
    const s=k(x.name);
    if(s==='ассоциация учреждений по управлению имуществом и материального обеспечения')return'Ассоциация учреждений УИМО';
    if(s==='гринтех энерджи'&&x.product==='Carsharing')return'Гринтех Энерджи - каршеринг';
    if(s==='гринтех энерджи'&&x.product==='Taxi')return'Гринтех Энерджи - такси';
    return n(x.name);
  };
  const clientRows=order.map(id=>({...clients[id],displayName:aliasName(clients[id])}));
  const sourceDate=(()=>{
    for(const row of rows.slice(0,10)){
      for(const v of row||[]){
        const m=n(v).match(/обновлено\s*(\d{2}\.\d{2}\.\d{4})/i);
        if(m)return m[1];
      }
    }
    return null;
  })();
  return{sheetName,metrics,verticals,clients:clientRows,sourceDate,parserVersion:PARSER_VERSION};
}

function parseSmmtWorkbook(buf){
  if(!window.XLSX)throw new Error('Модуль Excel еще не загружен.');
  const wb=XLSX.read(buf,{type:'array',cellDates:true});
  const sheetName=wb.SheetNames.find(x=>k(x)==='все проекты')||wb.SheetNames.find(x=>k(x).includes('все')&&k(x).includes('проект'))||wb.SheetNames[0];
  if(!sheetName)throw new Error('В СММТ не найден лист «Все проекты».');
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true});
  const h=findHeader(rows);
  if(!h)throw new Error('В СММТ не найдены месяцы 2026.');

  const monthCols=[],seen=new Set();
  h.cols.forEach(x=>{if(!seen.has(x.m)){seen.add(x.m);monthCols.push(x)}});
  monthCols.sort((a,b)=>a.ci-b.ci);
  const first=Math.min(...monthCols.map(x=>x.ci));
  const headers=(h.row||[]).map(v=>k(v));
  let nameCol=-1;
  for(let ci=0;ci<first;ci++){
    if(/проект|компан|клиент|назван/.test(headers[ci]||'')){nameCol=ci;break}
  }
  if(nameCol<0){
    for(let ci=0;ci<first;ci++){if(headers[ci]){nameCol=ci;break}}
  }
  if(nameCol<0)nameCol=0;

  const months=Object.fromEntries(MONTH_NAMES.map(m=>[m,0]));
  let projectCount=0,nonZeroProjects=0;
  for(let ri=h.ri+1;ri<rows.length;ri++){
    const row=rows[ri]||[];
    const left=row.slice(0,first).map(n).filter(Boolean);
    const label=n(row[nameCol])||left[0]||'';
    const s=k(label);
    if(!label)continue;
    if(/^(проект|компания|клиент|название)$/.test(s))continue;
    if(/(^|\s)(итого|всего|total)(\s|$)/.test(s)||s.includes('план сммт'))continue;
    const hasPeriodCells=monthCols.some(c=>n(row[c.ci])!=='');
    if(!hasPeriodCells)continue;
    let rowTotal=0;
    for(const c of monthCols){
      const v=num(row[c.ci]);
      months[c.m]=(months[c.m]||0)+v;
      rowTotal+=Math.abs(v);
    }
    projectCount++;
    if(rowTotal>0)nonZeroProjects++;
  }
  const year=sumMonths({months});
  return{
    found:projectCount>0,
    months,
    year,
    yearFound:true,
    sheetName,
    projectCount,
    nonZeroProjects
  };
}
async function parseSmmtFile(file){
  const buf=await file.arrayBuffer();
  return parseSmmtWorkbook(buf);
}

function loadPeriodState(){
  const def={mode:'half',key:new Date().getMonth()<6?'H1':'H2'};
  try{
    const saved={...def,...JSON.parse(localStorage.getItem(PERIOD_KEY)||'{}')};
    if(!['all','half'].includes(saved.mode))saved.mode='half';
    if(!['H1','H2'].includes(saved.key))saved.key=def.key;
    return saved;
  }catch{return def}
}
function loadLayerState(){
  const def={B2C:true,B2B:false,B2G:false};
  try{return{...def,...JSON.parse(localStorage.getItem(LAYER_KEY)||'{}')}}catch{return def}
}
function loadStockVisibility(){
  try{
    const saved=localStorage.getItem(STOCK_VISIBILITY_KEY);
    return saved===null?true:saved!=='false';
  }catch{return true}
}
let periodState=loadPeriodState();
let layerState=loadLayerState();
let stockVisible=loadStockVisibility();
let smmtVisible=true;
try{const saved=localStorage.getItem(SMMT_VISIBILITY_KEY);smmtVisible=saved===null?true:saved!=='false'}catch{}
let currentModel=null;
let currentTemplateName='PPTX-шаблон';
function savePeriodState(){try{localStorage.setItem(PERIOD_KEY,JSON.stringify(periodState))}catch{}}
function saveLayerState(){try{localStorage.setItem(LAYER_KEY,JSON.stringify(layerState))}catch{}}
function saveStockVisibility(){try{localStorage.setItem(STOCK_VISIBILITY_KEY,String(stockVisible))}catch{}}
function saveSmmtVisibility(){try{localStorage.setItem(SMMT_VISIBILITY_KEY,String(smmtVisible))}catch{}}
function selectedPeriod(){return periodState.mode==='all'?PERIODS.all:PERIODS[periodState.key]||PERIODS.H2}
function metricTotal(metric){const p=selectedPeriod();return periodState.mode==='all'?annualTotal(metric):sumMonths(metric,p.months)}
function projectWord(v){const x=Math.abs(Number(v||0))%100;if(x>=11&&x<=14)return'проектов';const d=x%10;return d===1?'проект':d>=2&&d<=4?'проекта':'проектов'}
function totalHeader(){if(periodState.mode==='all')return'Итого 2026';return periodState.key==='H1'?'Итого Янв - Июн':'Итого Июл - Дек'}
function ensureStockToggleButton(){
  const nav=document.querySelector('.sidebar-main-nav');
  if(!nav)return;
  let btn=$('stockVisibilityBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='stockVisibilityBtn';
    btn.type='button';
    btn.className='sidebar-stock-toggle';
    nav.appendChild(btn);
  }
  btn.textContent=stockVisible?'Скрыть свободный сток':'Показать свободный сток';
  btn.setAttribute('aria-pressed',stockVisible?'true':'false');
  btn.title=stockVisible?'Скрыть «Свободный сток» и «Свободный сток / доступно»':'Показать «Свободный сток» и «Свободный сток / доступно»';
}
function ensureSmmtToggleButton(){
  const nav=document.querySelector('.sidebar-main-nav');
  if(!nav)return;
  let btn=$('smmtVisibilityBtn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='smmtVisibilityBtn';
    btn.type='button';
    btn.className='sidebar-smmt-toggle';
    nav.appendChild(btn);
  }
  btn.textContent=smmtVisible?'Скрыть СММТ':'Показать СММТ';
  btn.setAttribute('aria-pressed',smmtVisible?'true':'false');
}
function kpiCard(label,metric,note,tone=''){
  return `<div class="analytics-kpi ${tone}"><div class="analytics-kpi-label">${esc(label)}</div><div class="analytics-kpi-value">${metric?.found?fmt(metricTotal(metric)):'·'}</div><div class="analytics-kpi-note">${esc(note)}</div></div>`;
}
function metricRow(label,metric,months,cls=''){
  const missing=!metric?.found?' is-missing':'';
  return `<tr class="${cls}${missing}"><td class="dash-label">${esc(label)}</td><td class="dash-total">${metric?.found?dot(metricTotal(metric)):'·'}</td>${months.map(m=>`<td class="dash-num">${dot(metric?.months?.[m]||0)}</td>`).join('')}</tr>`;
}
function compareTone(value,production){
  const a=Number(value||0),b=Number(production||0);
  return a>b?'smmt-over':a<b?'smmt-under':'smmt-equal';
}
function smmtPlanRow(smmt,production,months){
  if(!smmt?.found)return'';
  const total=metricTotal(smmt),prodTotal=metricTotal(production);
  const totalTone=compareTone(total,prodTotal);
  const totalTitle=`План СММТ: ${fmt(total)}; план производства: ${fmt(prodTotal)}`;
  const cells=months.map(m=>{
    const v=Number(smmt?.months?.[m]||0),p=Number(production?.months?.[m]||0);
    const tone=compareTone(v,p);
    return `<td class="dash-num smmt-compare ${tone}" title="План СММТ: ${fmt(v)}; план производства: ${fmt(p)}">${dot(v)}</td>`;
  }).join('');
  return `<tr class="smmt-plan-row"><td class="dash-label"><strong>План СММТ</strong></td><td class="dash-total smmt-compare ${totalTone}" title="${esc(totalTitle)}">${dot(total)}</td>${cells}</tr>`;
}
function clientDetailRow(x,months){
  const product=x.product?`<small>${esc(x.product)}</small>`:'';
  const noPlannedDeliveries=annualTotal(x)===0;
  const hint=noPlannedDeliveries?`<span class="no-deliveries-hint" tabindex="0" role="note" aria-label="Нет запланированных выдач" title="Нет запланированных выдач">!</span>`:'';
  return `<tr class="client-detail${noPlannedDeliveries?' no-planned-deliveries':''}"${noPlannedDeliveries?' title="Нет запланированных выдач"':''}><td></td><td class="project-name"><strong>${esc(x.displayName||x.name)}</strong>${hint}${product}</td><td class="dash-total">${dot(metricTotal(x))}</td>${months.map(m=>`<td class="dash-num">${dot(x?.months?.[m]||0)}</td>`).join('')}</tr>`;
}
function clientSummaryRow(layer,metric,count,months,collapsed){
  const staticRow=count===0;
  const cls=staticRow?'layer-summary layer-static':`layer-summary layer-toggle-row${collapsed?' layer-collapsed':''}`;
  const attr=staticRow?'':` data-layer-toggle="${layer}" tabindex="0" role="button" aria-expanded="${collapsed?'false':'true'}"`;
  const small=count?`${count} ${projectWord(count)} · ${collapsed?'Показать':'Скрыть'}`:'итого';
  return `<tr class="${cls}"${attr}><td class="layer-name"><strong>${esc(layer)}</strong><small>${small}</small></td><td class="project-name"><strong>Итого ${esc(layer)}</strong></td><td class="dash-total">${dot(metricTotal(metric))}</td>${months.map(m=>`<td class="dash-num">${dot(metric?.months?.[m]||0)}</td>`).join('')}</tr>`;
}
function renderControls(model){
  const halfOptions=['H1','H2'].map(h=>`<option value="${h}"${h===periodState.key?' selected':''}>${PERIODS[h].label}</option>`).join('');
  return `<div class="analytics-filter-group period-control-group"><span class="analytics-filter-label">ПЕРИОД</span><div class="period-mode-tabs" role="group" aria-label="Выбор периода"><button type="button" data-period-mode="all" class="period-mode-btn${periodState.mode==='all'?' active':''}">Весь период</button><button type="button" data-period-mode="half" class="period-mode-btn${periodState.mode==='half'?' active':''}">6 месяцев</button></div>${periodState.mode==='half'?`<select id="periodDetailSelect" class="period-detail-select" aria-label="Выбор полугодия">${halfOptions}</select>`:''}</div><div class="analytics-filter-group source"><span class="analytics-filter-label">ИСТОЧНИК</span><span class="source-pill">${esc(model.sheetName||'S&OP09 plan')}</span></div>`;
}
function renderModel(model,templateName=currentTemplateName){
  if(!model)return;
  currentModel=model;
  currentTemplateName=templateName||'PPTX-шаблон';
  const one=$('onePage');if(!one)return;
  const p=selectedPeriod();
  const months=p.months;
  const {metrics,verticals}=model;
  const date=model.sourceDate||new Date().toLocaleDateString('ru-RU');
  one.className='one-page analytics-onepage';

  const kpiHtml=[
    kpiCard('План производства',metrics.production,p.label),
    kpiCard('План отгрузки',metrics.shipPlan,p.label),
    kpiCard('Отгружено автомобилей',metrics.shipped,p.label,'accent-red'),
    kpiCard('Забронировано клиентами',metrics.booked,p.label,'accent-green'),
    ...(stockVisible?[kpiCard('Свободный сток',metrics.free,p.label,'accent-green')]:[])
  ].join('');
  const smmtPlan=smmtVisible?smmtPlanRow(model.smmt,metrics.production,months):'';
  const balance=[
    smmtPlan,
    metricRow('План производства',metrics.production,months),
    metricRow('План отгрузки с завода',metrics.shipPlan,months),
    metricRow('Отгружено автомобилей',metrics.shipped,months),
    metricRow('Доступно для отгрузки клиенту-план',metrics.clientShipPlan,months,'row-client-ship-plan'),
    metricRow('Передано в корпоративный парк',metrics.corp,months),
    metricRow('Забронировано клиентами',metrics.booked,months,'row-accent'),
    ...(stockVisible?[metricRow('Свободный сток / доступно',metrics.free,months)]:[])
  ].join('');

  let distribution='';
  for(const layer of ['B2C','B2B','B2G']){
    const metric=verticals?.[layer];
    const items=(model.clients||[])
      .filter(x=>x.vertical===layer&&(layer==='B2B'||layer==='B2G'||annualTotal(x)>0))
      .slice()
      .sort((a,b)=>annualTotal(b)-annualTotal(a)||String(a.displayName||a.name||'').localeCompare(String(b.displayName||b.name||''),'ru'));
    if(layer==='B2G'&&!metric?.found&&!items.length)continue;
    const collapsed=Boolean(layerState[layer]);
    distribution+=clientSummaryRow(layer,metric,items.length,months,collapsed);
    if(!collapsed)distribution+=items.map(x=>clientDetailRow(x,months)).join('');
  }
  distribution+=`<tr class="grand-total"><td class="layer-name"><strong>ВСЕГО</strong></td><td class="project-name"><strong>Забронировано клиентами</strong></td><td class="dash-total">${dot(metricTotal(metrics.booked))}</td>${months.map(m=>`<td class="dash-num">${dot(metrics.booked?.months?.[m]||0)}</td>`).join('')}</tr>`;

  one.innerHTML=`<div class="analytics-head analytics-head-date-only"><div class="analytics-data-date">Данные на ${esc(date)}</div></div><div class="analytics-filterbar">${renderControls(model)}</div><div class="analytics-kpi-grid">${kpiHtml}</div><section class="analytics-section"><div class="analytics-section-title">БАЛАНС ПРОИЗВОДСТВА И ПРОДАЖ · ${esc(p.short.toUpperCase())}</div><div class="analytics-table-wrap"><table class="analytics-table balance-table"><thead><tr><th>Показатель</th><th>${esc(totalHeader())}</th>${months.map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>${balance}</tbody></table></div></section><section class="analytics-section distribution-section"><div class="analytics-section-title">КОММЕРЧЕСКОЕ РАСПРЕДЕЛЕНИЕ ПО СЛОЯМ · ${esc(p.short.toUpperCase())}</div><div class="analytics-table-wrap"><table class="analytics-table distribution-table"><thead><tr><th>Бизнес-слой</th><th>Компания / проект</th><th>${esc(totalHeader())}</th>${months.map(m=>`<th>${m}</th>`).join('')}</tr></thead><tbody>${distribution}</tbody></table></div></section><div class="analytics-footnote"><span>Источник: ${esc(model.sheetName||'S&OP09 plan')}.</span><span>${esc(currentTemplateName)}</span></div>`;
  ensureStockToggleButton();
  ensureSmmtToggleButton();

  const d=$('reportDate');if(d)d.textContent=date;
  const t=$('templateInfo');if(t)t.textContent=`Шаблон презентации: ${currentTemplateName}`;
  const sc=$('sourceCount');if(sc)sc.textContent='2/2';
}
async function renderFromFile(file,templateName){
  const buf=await file.arrayBuffer();
  const model=parseWorkbook(buf);
  renderModel(model,templateName);
  return model;
}

if(!window.__ATOM_TEMPLATE_V3_BOUND__){
  window.__ATOM_TEMPLATE_V3_BOUND__=true;
  ensureStockToggleButton();
  ensureSmmtToggleButton();
  document.addEventListener('click',e=>{
    const stockBtn=e.target.closest?.('#stockVisibilityBtn');
    if(stockBtn){
      stockVisible=!stockVisible;
      saveStockVisibility();
      ensureStockToggleButton();
      renderModel(currentModel,currentTemplateName);
      return;
    }
    const smmtBtn=e.target.closest?.('#smmtVisibilityBtn');
    if(smmtBtn){
      smmtVisible=!smmtVisible;
      saveSmmtVisibility();
      ensureSmmtToggleButton();
      renderModel(currentModel,currentTemplateName);
      return;
    }
    const mode=e.target.closest?.('[data-period-mode]');
    if(mode){
      periodState.mode=mode.dataset.periodMode==='all'?'all':'half';
      savePeriodState();
      renderModel(currentModel,currentTemplateName);
      return;
    }
    const row=e.target.closest?.('[data-layer-toggle]');
    if(row){
      const layer=row.dataset.layerToggle;
      layerState[layer]=!Boolean(layerState[layer]);
      saveLayerState();
      renderModel(currentModel,currentTemplateName);
    }
  });
  document.addEventListener('keydown',e=>{
    const row=e.target.closest?.('[data-layer-toggle]');
    if(!row||!(e.key==='Enter'||e.key===' '))return;
    e.preventDefault();
    const layer=row.dataset.layerToggle;
    layerState[layer]=!Boolean(layerState[layer]);
    saveLayerState();
    renderModel(currentModel,currentTemplateName);
  });
  document.addEventListener('change',e=>{
    if(e.target.id!=='periodDetailSelect')return;
    periodState.key=e.target.value==='H1'?'H1':'H2';
    savePeriodState();
    renderModel(currentModel,currentTemplateName);
  });
}

if(!document.getElementById('template-v3-style')){
  const style=document.createElement('style');
  style.id='template-v3-style';
  style.textContent=`
    .analytics-head-date-only{display:flex!important;justify-content:flex-end!important;margin-bottom:18px!important}.period-control-group{display:flex!important;align-items:center!important;gap:10px!important;flex-wrap:wrap!important}
    .period-mode-tabs{display:flex;align-items:center;border:1px solid #d9dde5;border-radius:9px;overflow:hidden;background:#fff}
    .period-mode-btn{height:42px;padding:0 18px;border:0;border-right:1px solid #e4e7ec;background:#fff;color:#475467;font:700 14px Arial,Helvetica,sans-serif;cursor:pointer;white-space:nowrap}
    .period-mode-btn:last-child{border-right:0}.period-mode-btn:hover{background:#f7f8fa}.period-mode-btn.active{background:#111318;color:#fff}
    .period-detail-select{height:42px;min-width:225px;padding:0 34px 0 12px;border:1px solid #d9dde5;border-radius:9px;background:#fff;color:#101828;font:700 14px Arial,Helvetica,sans-serif;cursor:pointer}
    .analytics-filterbar{align-items:center!important;gap:16px!important;flex-wrap:wrap!important}.analytics-filter-group.source{margin-left:auto!important}
    .analytics-table th,.analytics-table td{white-space:nowrap}.analytics-table .project-name{white-space:normal!important}
    .balance-table .smmt-plan-row td{font-weight:700!important;border-bottom:2px solid #cfd4dc!important}.balance-table .smmt-plan-row .dash-label{background:#f7f8fa!important}.smmt-compare{transition:background .15s ease,color .15s ease}.smmt-compare.smmt-over{background:#fef3f2!important;color:#b42318!important}.smmt-compare.smmt-under{background:#ecfdf3!important;color:#067647!important}.smmt-compare.smmt-equal{background:#f2f4f7!important;color:#475467!important}
    .distribution-table .layer-toggle-row{cursor:pointer;user-select:none;transition:background .15s ease}.distribution-table .layer-toggle-row:hover td{background:#eef3f6!important}
    .distribution-table .layer-toggle-row .layer-name{position:relative;padding-left:40px!important}.distribution-table .layer-toggle-row .layer-name:before{content:'▾';position:absolute;left:16px;top:50%;transform:translateY(-50%);font-size:18px;line-height:1;color:#667085;font-weight:700}
    .distribution-table .layer-toggle-row.layer-collapsed .layer-name:before{content:'▸'}.distribution-table .layer-toggle-row:focus{outline:2px solid #98a2b3;outline-offset:-2px}.distribution-table .layer-static .layer-name{padding-left:14px!important}
    .distribution-table .no-planned-deliveries td{background:#fff1c2!important;border-top-color:#f5b942!important;border-bottom-color:#f5b942!important}.distribution-table .no-planned-deliveries td:first-child{box-shadow:inset 4px 0 0 #d97706}.distribution-table .no-planned-deliveries .project-name strong{color:#8a4b00}.no-deliveries-hint{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-left:7px;border-radius:50%;background:#b54708;color:#fff;font:700 11px Arial,Helvetica,sans-serif;cursor:help;vertical-align:1px}.no-deliveries-hint:focus{outline:2px solid #f79009;outline-offset:2px}
    .sidebar-main-nav .sidebar-stock-toggle,.sidebar-main-nav .sidebar-smmt-toggle{display:flex;align-items:center;width:100%;min-height:38px;padding:0 11px;border:1px solid #d9dde5;border-radius:8px;background:#fff;color:#475467;text-align:left;font:700 12px Arial,Helvetica,sans-serif;cursor:pointer}.sidebar-main-nav .sidebar-stock-toggle:hover,.sidebar-main-nav .sidebar-smmt-toggle:hover{background:#f4f6f8;color:#101828}.sidebar-main-nav .sidebar-stock-toggle[aria-pressed="false"],.sidebar-main-nav .sidebar-smmt-toggle[aria-pressed="false"]{border-style:dashed;color:#667085}
    @media(max-width:1100px){.analytics-filter-group.source{margin-left:0!important}}
  `;
  document.head.appendChild(style);
}

window.ATOMTemplateView={parseWorkbook,parseSmmtWorkbook,parseSmmtFile,renderModel,renderFromFile,parserVersion:PARSER_VERSION};
})();