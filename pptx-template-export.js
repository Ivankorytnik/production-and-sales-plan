(()=>{
'use strict';
const $=id=>document.getElementById(id);
const log=$('parseLog');
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const disp=v=>{const x=Number(v||0);return x===0?'·':String(Math.round(x))};
const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
const CLIENT_ALIASES={
  'ассоциация учреждений уимо':'ассоциация учреждений по управлению имуществом и материального обеспечения',
  'ассоциация учреждений по управлению имуществом и материального обеспечения':'ассоциация учреждений по управлению имуществом и материального обеспечения'
};

function monthLabel(v){
  const s=k(v);if(!s)return null;
  for(const [ru,en,label] of MONTHS){
    if(new RegExp(`(^|[^а-яa-z])(${ru}[а-я]*|${en}[a-z]*)([^а-яa-z]|$)`,'i').test(s))return label;
  }
  return null;
}
function canonicalPeriod(v){
  const m=monthLabel(v);if(m)return m;
  const s=k(v);
  if(/^2026$/.test(s)||/^total$/.test(s)||/^итого\s*2026$/.test(s)||/^всего\s*2026$/.test(s))return'2026';
  return null;
}
function sumMonths(metric){return Object.values(metric?.months||{}).reduce((a,v)=>a+Number(v||0),0)}
function annual(metric){return metric?.yearFound?Number(metric.year||0):sumMonths(metric)}
function normalizeMetric(metric){
  if(!metric)return null;
  const out={...metric,months:{...(metric.months||{})}};
  if(!out.yearFound){out.year=sumMonths(out);out.yearFound=true}
  return out;
}
function loadScript(url,timeout=8000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const t=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('timeout'))},timeout);s.src=url;s.async=true;s.onload=()=>{if(done)return;done=true;clearTimeout(t);resolve()};s.onerror=()=>{if(done)return;done=true;clearTimeout(t);s.remove();reject(new Error('load error'))};document.head.appendChild(s)})}
async function ensureJSZip(){
  if(window.JSZip)return true;
  for(const src of ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js']){try{await loadScript(src);if(window.JSZip)return true}catch{}}
  throw new Error('Модуль формирования PPTX не загрузился.');
}
async function ensureXLSX(){
  if(window.XLSX)return true;
  for(const src of ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){try{await loadScript(src);if(window.XLSX)return true}catch{}}
  throw new Error('Модуль чтения Excel не загрузился.');
}
function currentFiles(){
  return{
    sales:window.ATOMCurrentFiles?.sales||$('salesFile')?.files?.[0]||null,
    template:window.ATOMCurrentFiles?.template||$('templateFile')?.files?.[0]||null
  };
}
function getCachedCurrentModel(salesName){
  try{
    const raw=localStorage.getItem('atom-production-sales-plan-current-model-v1');
    if(!raw)return null;
    const data=JSON.parse(raw);
    if(data?.salesName===salesName&&data?.model)return data.model;
  }catch{}
  return null;
}
function parseCurrentModel(buf,salesName){
  const api=window.ATOMTemplateView;
  if(!api?.parseWorkbook)throw new Error('Парсер аналитики не загружен. Обновите страницу.');
  const parsed=api.parseWorkbook(buf);
  const cached=getCachedCurrentModel(salesName);
  if(cached?.sheetName===parsed.sheetName){
    parsed.clients=cached.clients||parsed.clients||[];
    parsed.verticals={...(parsed.verticals||{}),...(cached.verticals||{})};
  }
  return parsed;
}
function toExportModel(model){
  const clients={};
  for(const x of model.clients||[]){
    const nameKey=k(x.name||x.displayName);
    const displayKey=k(x.displayName||x.name);
    const metric=normalizeMetric(x);
    clients[nameKey]=metric;
    clients[displayKey]=metric;
    if(nameKey==='гринтех энерджи'&&x.product==='Taxi')clients['гринтех энерджи - такси']=metric;
    if(nameKey==='гринтех энерджи'&&x.product==='Carsharing')clients['гринтех энерджи - каршеринг']=metric;
  }
  return{
    production:normalizeMetric(model.metrics?.production),
    shipPlan:normalizeMetric(model.metrics?.shipPlan),
    shippedActual:normalizeMetric(model.metrics?.shipped),
    corp:normalizeMetric(model.metrics?.corp),
    booked:normalizeMetric(model.metrics?.booked),
    free:normalizeMetric(model.metrics?.free),
    verticals:{
      B2B:normalizeMetric(model.verticals?.B2B),
      B2C:normalizeMetric(model.verticals?.B2C),
      B2G:normalizeMetric(model.verticals?.B2G)
    },
    clients
  };
}
function textNodes(el){return [...el.getElementsByTagNameNS('*','t')]}
function elementText(el){return textNodes(el).map(x=>x.textContent).join('')}
function setTextIn(el,value){
  const ts=textNodes(el);if(!ts.length)return false;
  ts[0].textContent=String(value);
  for(let i=1;i<ts.length;i++)ts[i].textContent='';
  return true;
}
function setDate(doc){
  let changed=0;
  for(const sp of [...doc.getElementsByTagNameNS('*','sp')]){
    if(/обновлено/i.test(elementText(sp))){if(setTextIn(sp,'Обновлено '+new Date().toLocaleDateString('ru-RU')))changed++}
  }
  return changed;
}
function setKpiNearLabel(doc,re,metric){
  if(!metric?.found)return 0;
  const shapes=[...doc.getElementsByTagNameNS('*','sp')];
  let changed=0;
  for(let i=0;i<shapes.length;i++){
    if(!re.test(k(elementText(shapes[i]))))continue;
    for(let j=i+1;j<Math.min(i+8,shapes.length);j++){
      const tx=n(elementText(shapes[j]));
      if(/^[-+]?\d[\s\d,.]*$/.test(tx)||tx==='·'||tx==='—'||tx==='-'){
        if(setTextIn(shapes[j],disp(annual(metric))))changed++;
        break;
      }
    }
  }
  return changed;
}
function tableCells(table){return [...table.getElementsByTagNameNS('*','tr')].map(tr=>[...tr.getElementsByTagNameNS('*','tc')])}
function headerMap(cells){
  const out={};
  cells.forEach((c,i)=>{const p=canonicalPeriod(elementText(c));if(p&&out[p]===undefined)out[p]=i});
  return out;
}
function updateMetricRow(row,periodMap,metric){
  if(!metric?.found)return 0;
  let changed=0;
  for(const [p,ci] of Object.entries(periodMap)){
    if(!row[ci])continue;
    if(p==='2026'){
      if(setTextIn(row[ci],disp(annual(metric))))changed++;
    }else if(Object.prototype.hasOwnProperty.call(metric.months||{},p)){
      if(setTextIn(row[ci],disp(metric.months[p])))changed++;
    }
  }
  return changed;
}
function metricForLabel(label,m){
  const s=k(label);
  if(/план производства/.test(s))return m.production;
  if(/план отгрузк.*завод|отгрузк.*завод.*план/.test(s))return m.shipPlan;
  if(/отгружено.*автомоб|отгрузка.*завод.*факт|отгружено.*авто/.test(s))return m.shippedActual;
  if(/передано.*корп|корпоративн.*парк/.test(s))return m.corp;
  if((/забронировано.*клиент/.test(s)||/забронировано.*всего/.test(s)||/всего.*забронировано/.test(s))&&!/\bb2[bcg]\b/.test(s))return m.booked;
  if(/свободн.*сток|доступно.*конец|^доступно$/.test(s))return m.free;
  if(/итого\s*b2b|контракты.*забронировано.*b2b|^b2b$/.test(s))return m.verticals.B2B;
  if(/итого\s*b2c|контракты.*забронировано.*b2c|^b2c$/.test(s))return m.verticals.B2C;
  if(/итого\s*b2g|контракты.*забронировано.*b2g|^b2g$/.test(s))return m.verticals.B2G;
  if(/^всего$/.test(s))return m.booked;
  const direct=CLIENT_ALIASES[s]||s;
  return m.clients[direct]||null;
}
function updateTables(doc,m){
  let changed=0;
  for(const tbl of [...doc.getElementsByTagNameNS('*','tbl')]){
    const rows=tableCells(tbl);if(rows.length<2)continue;
    let periodRow=-1,periods={};
    for(let ri=0;ri<Math.min(4,rows.length);ri++){
      const p=headerMap(rows[ri]);
      if(Object.keys(p).length>Object.keys(periods).length){periods=p;periodRow=ri}
    }
    if(periodRow<0||!Object.keys(periods).length)continue;
    for(let ri=periodRow+1;ri<rows.length;ri++){
      const row=rows[ri];
      const labels=row.slice(0,Math.min(3,row.length)).map(c=>n(elementText(c))).filter(Boolean);
      if(!labels.length)continue;
      let metric=null;
      for(const label of labels){metric=metricForLabel(label,m);if(metric)break}
      if(!metric){metric=metricForLabel(labels.join(' '),m)}
      if(metric)changed+=updateMetricRow(row,periods,metric);
    }
  }
  return changed;
}
function updateSlide(doc,m){
  let changed=0;
  changed+=setDate(doc);
  changed+=setKpiNearLabel(doc,/план производства/,m.production);
  changed+=setKpiNearLabel(doc,/план.*отгрузк/,m.shipPlan);
  changed+=setKpiNearLabel(doc,/отгружено.*авто|отгрузка.*факт/,m.shippedActual);
  changed+=setKpiNearLabel(doc,/забронировано.*клиент|забронировано.*авто|забронировано.*всего/,m.booked);
  changed+=setKpiNearLabel(doc,/свободн.*сток|доступно/,m.free);
  changed+=updateTables(doc,m);
  return changed;
}
async function exportPptx(){
  const {sales,template}=currentFiles();
  if(!sales||!template){if(log)log.textContent='Для выгрузки нужны актуальный Excel и PPTX-шаблон.';return}
  try{
    if(log)log.textContent='Читаю текущий S&OP09 plan и готовлю PPTX...';
    await ensureXLSX();await ensureJSZip();
    const [salesBuf,tplBuf]=await Promise.all([sales.arrayBuffer(),template.arrayBuffer()]);
    const model=parseCurrentModel(salesBuf,sales.name);
    const m=toExportModel(model);
    const zip=await JSZip.loadAsync(tplBuf);
    const slidePaths=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/i.test(p)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    if(!slidePaths.length)throw new Error('В шаблоне не найдены слайды.');
    let changed=0;
    for(const slidePath of slidePaths){
      const xml=await zip.file(slidePath).async('string');
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      const count=updateSlide(doc,m);
      if(count){zip.file(slidePath,new XMLSerializer().serializeToString(doc));changed+=count}
    }
    if(changed===0)throw new Error('В PPTX-шаблоне не найдены поля для обновления. Проверьте структуру шаблона.');
    const out=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(out);
    a.download='ATOM_OnePage_'+new Date().toISOString().slice(0,10)+'.pptx';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    if(log)log.textContent=`PPTX обновлен из S&OP09 plan. Изменено полей: ${changed}. B2B ${disp(annual(m.verticals.B2B))}, B2C ${disp(annual(m.verticals.B2C))}, всего забронировано ${disp(annual(m.booked))}.`;
  }catch(e){
    console.error(e);
    if(log)log.textContent='Не удалось сформировать PPTX: '+(e.message||e);
  }
}

// Capture phase intentionally overrides legacy click handlers while keeping the same button/state logic.
document.addEventListener('click',e=>{
  const btn=e.target.closest?.('#printBtn,#downloadHtmlBtn');
  if(!btn||btn.disabled)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  exportPptx();
},true);
})();
