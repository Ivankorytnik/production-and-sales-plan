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
function metricYear(m){return m?.yearFound?m.year:0}
function rowCells(metric,months=VIEW_MONTHS){return months.map(m=>`<td class="num">${dot(metric?.months?.[m]||0)}</td>`).join('')+`<td class="num total">${dot(metricYear(metric))}</td>`}
function chainRow(label,metric,cls=''){return `<tr class="${cls}"><td>${esc(label)}</td>${rowCells(metric)}</tr>`}
function clientRow(layer,name,metric,cls=''){const cells=VIEW_MONTHS.map(m=>{const value=metric?.months?.[m]||0;const hi=/псб каршеринг/i.test(name)&&value?' hot':'';return `<td class="num${hi}">${dot(value)}</td>`}).join('');return `<tr class="${cls}"><td class="layer">${esc(layer||'')}</td><td>${esc(name)}</td>${cells}<td class="num total">${dot(metricYear(metric))}</td></tr>`}
function renderModel(model,templateName){
  const one=$('onePage');if(!one)return;
  const {metrics,verticals}=model;
  const b2b=model.clients.filter(x=>x.vertical==='B2B');
  const b2g=model.clients.filter(x=>x.vertical==='B2G');
  const kpis=[
    ['cyan','ПЛАН ПРОИЗВОДСТВА',metricYear(metrics.production),'2026, S&OP09'],
    ['green','ПЛАН ОТГРУЗКИ',metricYear(metrics.shipPlan),'с завода'],
    ['red','ОТГРУЖЕНО АВТО',metricYear(metrics.shipped),'на дату файла'],
    ['yellow','ЗАБРОНИРОВАНО АТОМ',metricYear(metrics.booked),'подтверждено в ЕРП']
  ];
  const kpiHtml=kpis.map(([c,l,v,s])=>`<div class="atom-kpi ${c}"><div class="atom-kpi-label">${l}</div><div class="atom-kpi-bottom"><strong>${fmt(v)}</strong><small>${s}</small></div></div>`).join('');
  const chain=[chainRow('План производства',metrics.production),chainRow('План отгрузки с завода',metrics.shipPlan,'alt'),chainRow('Отгружено автомобилей',metrics.shipped),chainRow('Передано в корп. парк',metrics.corp,'alt'),chainRow('Забронировано клиентами',metrics.booked,'booked')].join('');
  let clientsHtml=clientRow('B2B','Итого B2B',verticals.B2B,'summary');
  clientsHtml+=b2b.map(x=>clientRow('',x.displayName,x)).join('');
  if(verticals.B2G&&metricYear(verticals.B2G)!==0){clientsHtml+=clientRow('B2G','Итого B2G',verticals.B2G,'summary')+b2g.map(x=>clientRow('',x.displayName,x)).join('')}
  clientsHtml+=clientRow('B2C','Итого B2C',verticals.B2C,'summary');
  clientsHtml+=clientRow('','Всего забронировано',metrics.booked,'summary grand');
  const date=new Date().toLocaleDateString('ru-RU');
  one.innerHTML=`
    <div class="atom-slide-head">
      <h2>План производства, отгрузки и коммерческого распределения АТОМ</h2>
      <div class="atom-logo"><span class="atom-logo-mark">⌃</span><b>ATOM</b><small>Обновлено ${date}</small></div>
    </div>
    <div class="atom-kpi-row">${kpiHtml}</div>
    <div class="atom-main-grid">
      <section class="atom-panel">
        <h3>Баланс производства, отгрузки и распределения автомобилей</h3>
        <table class="atom-table chain-table"><thead><tr><th>Показатель</th>${VIEW_MONTHS.map(m=>`<th>${m==='Июл'?'Июль':m}</th>`).join('')}<th>2026</th></tr></thead><tbody>${chain}</tbody></table>
      </section>
      <section class="atom-panel">
        <h3>Забронировано клиентами по коммерческим вертикалям</h3>
        <table class="atom-table clients-table"><thead><tr><th>Слой</th><th>Компания / проект</th>${VIEW_MONTHS.map(m=>`<th>${m}</th>`).join('')}<th>2026</th></tr></thead><tbody>${clientsHtml}</tbody></table>
      </section>
    </div>
    <div class="atom-slide-foot"><span>${esc(templateName||'PPTX-шаблон')}</span><span>S&OP09 plan</span><span class="page-no">1</span></div>`;
  const d=$('reportDate');if(d)d.textContent=date;const t=$('templateInfo');if(t)t.textContent=`Шаблон презентации: ${templateName||'—'}`;const sc=$('sourceCount');if(sc)sc.textContent='2/2';
}
async function renderFromFile(file,templateName){const buf=await file.arrayBuffer();const model=parseWorkbook(buf);renderModel(model,templateName);return model}
window.ATOMTemplateView={parseWorkbook,renderModel,renderFromFile};
})();