(()=>{
'use strict';
const API=window.ATOMTemplateView;
if(!API)return;

const MODEL_KEY='atom-production-sales-plan-current-model-v1';
const MIGRATION_KEY='atom-b2c-details-migration-v2';
try{
  if(!localStorage.getItem(MIGRATION_KEY)){
    localStorage.removeItem(MODEL_KEY);
    localStorage.setItem(MIGRATION_KEY,'1');
  }
}catch{}

const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
const VIEW_MONTHS=['Июл','Авг','Сен','Окт','Ноя','Дек'];
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const num=v=>{if(typeof v==='number'&&Number.isFinite(v))return v;const s=n(v);if(!s||s==='·'||s==='-'||s==='—'||s==='`')return 0;const x=Number(s.replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(x)?x:0};
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(v||0));
const dot=v=>Number(v||0)===0?'·':fmt(v);
const esc=s=>n(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function monthLabel(v){
  if(v instanceof Date&&!isNaN(v))return MONTHS[v.getMonth()][2];
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
  if(!target)return{...src,months:{...src.months}};
  for(const [m,v] of Object.entries(src.months||{}))target.months[m]=(target.months[m]||0)+v;
  if(src.yearFound){target.year=(target.year||0)+(src.year||0);target.yearFound=true}
  return target;
}
function groupLabel(s){
  if(/^фэмили$|^family$/.test(s))return'Family';
  if(/^такси$|^taxi$/.test(s))return'Taxi';
  if(/^каршеринг$|^carsharing$/.test(s))return'Carsharing';
  return null;
}
function hasVerticalToken(s,v){
  return new RegExp(`(^|[^a-z0-9])${v.toLowerCase()}([^a-z0-9]|$)`,'i').test(s);
}
function aggregateVertical(s){
  const clean=s.replace(/\s+/g,' ');
  for(const v of ['B2C','B2B','B2G']){
    const low=v.toLowerCase();
    if(clean===low||clean===`итого ${low}`)return v;
    if(hasVerticalToken(clean,v)&&(clean.includes('контракт')||clean.includes('забронирован')||clean.startsWith('итого ')))return v;
  }
  return null;
}
function isStopRow(s){
  return s==='выдачи'||(s.includes('забронировано')&&s.includes('всего'))||s.startsWith('доступно')||s.includes('свободный сток');
}
function extractB2C(buf){
  if(!window.XLSX)return[];
  const wb=XLSX.read(buf,{type:'array',cellDates:true});
  const sheetName=wb.SheetNames.find(x=>k(x).replace(/\s/g,'').includes('s&op09plan'))||wb.SheetNames.find(x=>k(x).includes('s&op09'))||wb.SheetNames[0];
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:true});
  const h=findHeader(rows);if(!h)return[];
  const monthCols=[],seen=new Set();
  h.cols.forEach(x=>{if(!seen.has(x.m)){seen.add(x.m);monthCols.push(x)}});
  monthCols.sort((a,b)=>a.ci-b.ci);
  const first=Math.min(...monthCols.map(x=>x.ci));
  let totalCol=-1;
  (h.row||[]).forEach((v,ci)=>{if(/^(total|2026|итого\s*2026)$/i.test(n(v)))totalCol=ci});
  const rowLabel=row=>{const p=(row||[]).slice(0,first).map(n).filter(Boolean);return p.length?p[p.length-1]:''};
  const rowMetric=row=>{
    const months={};monthCols.forEach(c=>months[c.m]=num(row[c.ci]));
    const totalRaw=totalCol>=0?n(row[totalCol]):'';
    const hasMonthValue=monthCols.some(c=>n(row[c.ci])!=='');
    const yearFound=totalRaw!==''||hasMonthValue;
    const fallbackTotal=Object.values(months).reduce((a,v)=>a+Number(v||0),0);
    return{found:true,months,year:yearFound?(totalRaw!==''?num(row[totalCol]):fallbackTotal):null,yearFound};
  };
  const hasPeriodData=row=>monthCols.some(c=>n(row[c.ci])!=='')||(totalCol>=0&&n(row[totalCol])!=='');
  const out={},order=[];
  let current=null,product=null;
  for(let ri=h.ri+1;ri<rows.length;ri++){
    const row=rows[ri]||[];
    const label=rowLabel(row),s=k(label);
    if(!label)continue;
    const v=aggregateVertical(s);
    if(v){current=v;product=null;continue}
    if(isStopRow(s)){current=null;product=null;continue}
    const g=groupLabel(s);
    if(g){product=g;continue}
    if(current!=='B2C')continue;
    if(/^план |^выпуск |^отгрузка |^передано |^контракты |^итого /.test(s))continue;
    if(!hasPeriodData(row))continue;
    const key=`${s}|${product||''}`;
    const metric=rowMetric(row);
    if(!out[key]){
      out[key]={key,name:label,displayName:label,product,vertical:'B2C',found:true,months:{},year:0,yearFound:false};
      order.push(key);
    }
    addMetric(out[key],metric);
  }
  return order.map(key=>out[key]);
}
function projectWord(v){
  const x=Math.abs(Number(v||0))%100;
  if(x>=11&&x<=14)return'проектов';
  const d=x%10;
  return d===1?'проект':d>=2&&d<=4?'проекта':'проектов';
}
function yearValue(x){return x?.yearFound?Number(x.year||0):0}
function detailRow(x){
  const tr=document.createElement('tr');
  tr.className='client-detail b2c-detail';
  const product=x.product?`<small>${esc(x.product)}</small>`:'';
  tr.innerHTML=`<td></td><td class="project-name"><strong>${esc(x.displayName||x.name)}</strong>${product}</td><td class="dash-total">${dot(yearValue(x))}</td>${VIEW_MONTHS.map(m=>`<td class="dash-num">${dot(x?.months?.[m]||0)}</td>`).join('')}`;
  return tr;
}
function injectB2C(model){
  const table=document.querySelector('.distribution-table');
  if(!table)return;
  const rows=(model?.clients||[]).filter(x=>x.vertical==='B2C');
  const summaries=[...table.querySelectorAll('tr.layer-summary')];
  const summary=summaries.find(row=>(row.querySelector('.layer-name strong')?.textContent||'').trim().toUpperCase()==='B2C');
  if(!summary)return;
  summary.classList.add('b2c-summary');
  table.querySelectorAll('tr.b2c-detail').forEach(row=>row.remove());
  const small=summary.querySelector('.layer-name small');
  if(small)small.textContent=rows.length?`${rows.length} ${projectWord(rows.length)}`:'итого';
  if(!rows.length){summary.classList.add('layer-static');summary.classList.remove('layer-toggle-row');return}
  summary.classList.remove('layer-static');
  let anchor=summary;
  rows.forEach(item=>{const tr=detailRow(item);anchor.insertAdjacentElement('afterend',tr);anchor=tr});
}

const originalRenderModel=API.renderModel.bind(API);
API.renderModel=(model,templateName)=>{
  originalRenderModel(model,templateName);
  injectB2C(model);
};
API.renderFromFile=async(file,templateName)=>{
  const buf=await file.arrayBuffer();
  const model=API.parseWorkbook(buf);
  const b2c=extractB2C(buf);
  model.clients=[...(model.clients||[]).filter(x=>x.vertical!=='B2C'),...b2c];
  model.b2cSource='S&OP09 plan';
  API.renderModel(model,templateName);
  return model;
};
})();
