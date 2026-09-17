(()=>{
'use strict';
const $=id=>document.getElementById(id);
const log=$('parseLog');
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const disp=v=>{const x=Number(v||0);return x===0?'·':String(Math.round(x))};
const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];

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
function parseCurrentModel(buf){
  const api=window.ATOMTemplateView;
  if(!api?.parseWorkbook)throw new Error('Парсер аналитики не загружен. Обновите страницу.');
  return api.parseWorkbook(buf);
}
function toExportModel(model){
  const clientRows=(model.clients||[]).map(x=>({
    ...normalizeMetric(x),
    name:x.name||x.displayName||'',
    displayName:x.displayName||x.name||'',
    product:x.product||'',
    vertical:x.vertical||''
  }));
  return{
    production:normalizeMetric(model.metrics?.production),
    shipPlan:normalizeMetric(model.metrics?.shipPlan),
    shippedActual:normalizeMetric(model.metrics?.shipped),
    clientShipPlan:normalizeMetric(model.metrics?.clientShipPlan),
    corp:normalizeMetric(model.metrics?.corp),
    booked:normalizeMetric(model.metrics?.booked),
    free:normalizeMetric(model.metrics?.free),
    verticals:{
      B2B:normalizeMetric(model.verticals?.B2B),
      B2C:normalizeMetric(model.verticals?.B2C),
      B2G:normalizeMetric(model.verticals?.B2G)
    },
    clientRows,
    sourceDate:model.sourceDate||'',
    sheetName:model.sheetName||'S&OP09 plan'
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
function setDate(doc,sourceDate){
  let changed=0;
  const date=sourceDate||new Date().toLocaleDateString('ru-RU');
  for(const sp of [...doc.getElementsByTagNameNS('*','sp')]){
    if(/^обновлено\b/i.test(n(elementText(sp)))){if(setTextIn(sp,'Обновлено '+date))changed++}
  }
  return changed;
}
function setSourceNote(doc,salesName,sheetName){
  let changed=0;
  for(const sp of [...doc.getElementsByTagNameNS('*','sp')]){
    const txt=n(elementText(sp));
    if(/^источник\s*:/i.test(txt)){
      if(setTextIn(sp,`Источник: ${salesName}, лист ${sheetName}.`))changed++;
    }
  }
  return changed;
}
function setKpiNearLabel(doc,re,metric){
  if(!metric?.found)return 0;
  const shapes=[...doc.getElementsByTagNameNS('*','sp')];
  let changed=0;
  for(let i=0;i<shapes.length;i++){
    const label=k(elementText(shapes[i]));
    if(!re.test(label))continue;
    for(let j=i+1;j<Math.min(i+10,shapes.length);j++){
      const tx=n(elementText(shapes[j]));
      if(/^[-+]?\d[\s\d,.]*$/.test(tx)||tx==='·'||tx==='—'||tx==='-'){
        if(setTextIn(shapes[j],disp(annual(metric))))changed++;
        break;
      }
    }
  }
  return changed;
}
function tableRows(table){return [...table.getElementsByTagNameNS('*','tr')]}
function tableCells(table){return tableRows(table).map(tr=>[...tr.getElementsByTagNameNS('*','tc')])}
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
  if(/отгрузка\s+клиенту\s+план|план\s+отгрузки\s+клиенту/.test(s))return m.clientShipPlan;
  if(/план отгрузк.*завод|отгрузк.*завод.*план/.test(s))return m.shipPlan;
  if(/отгружено.*автомоб|отгрузка.*завод.*факт|отгружено.*авто/.test(s))return m.shippedActual;
  if(/передано.*корп|корпоративн.*парк/.test(s))return m.corp;
  if((/забронировано/.test(s)&&(/клиент|автомоб|атом|erp|ерп|всего/.test(s)))&&!/\bb2[bcg]\b/.test(s))return m.booked;
  if(/^забронировано$/.test(s))return m.booked;
  if(/свободн.*сток|доступно.*конец|^доступно$/.test(s))return m.free;
  if(/итого\s*b2b|контракты.*забронировано.*b2b|^b2b$/.test(s))return m.verticals.B2B;
  if(/итого\s*b2c|контракты.*забронировано.*b2c|^b2c$/.test(s))return m.verticals.B2C;
  if(/итого\s*b2g|контракты.*забронировано.*b2g|^b2g$/.test(s))return m.verticals.B2G;
  if(/^всего$/.test(s))return m.booked;
  return null;
}
function balanceInfo(tbl){
  const rows=tableCells(tbl);
  for(let ri=0;ri<Math.min(4,rows.length);ri++){
    const headers=rows[ri].map(c=>k(elementText(c)));
    const labelCol=headers.findIndex(h=>h.includes('показатель'));
    const periods=headerMap(rows[ri]);
    if(labelCol>=0&&Object.keys(periods).length>=2)return{headerRow:ri,labelCol,periods};
  }
  return null;
}
function fillBalanceRow(tr,info,label,metric){
  const cells=[...tr.getElementsByTagNameNS('*','tc')];
  if(cells[info.labelCol])setTextIn(cells[info.labelCol],label);
  updateMetricRow(cells,info.periods,metric);
  return Object.keys(info.periods).length+1;
}
function rebuildBalanceTable(tbl,m){
  const info=balanceInfo(tbl);if(!info)return 0;
  const trs=tableRows(tbl),rows=tableCells(tbl);
  const existing={};
  for(let i=info.headerRow+1;i<rows.length;i++){
    const label=k(elementText(rows[i][info.labelCol]||rows[i][0]));
    if(label)existing[label]=trs[i];
  }
  const anyTemplate=trs[info.headerRow+1];
  if(!anyTemplate)return 0;
  const desired=[
    ['План производства',m.production,/план производства/],
    ['План отгрузки с завода',m.shipPlan,/план отгрузк.*завод|отгрузк.*завод.*план/],
    ['Отгружено автомобилей',m.shippedActual,/отгружено.*автомоб|отгрузка.*завод.*факт|отгружено.*авто/],
    ['Отгрузка клиенту ПЛАН',m.clientShipPlan,/отгрузка\s+клиенту\s+план|план\s+отгрузки\s+клиенту/],
    ['Передано в корпоративный парк',m.corp,/передано.*корп|корпоративн.*парк/],
    ['Забронировано клиентами',m.booked,/забронировано/],
    ['Свободный сток / доступно',m.free,/свободн.*сток|доступно/]
  ];
  const findTemplate=re=>{
    for(const [label,tr] of Object.entries(existing)){if(re.test(label))return tr}
    return null;
  };
  const shipTemplate=findTemplate(/план отгрузк.*завод|отгрузк.*завод.*план/)||anyTemplate;
  const parent=anyTemplate.parentNode;
  for(let i=trs.length-1;i>info.headerRow;i--)parent.removeChild(trs[i]);
  let changed=0;
  desired.forEach(([label,metric,re])=>{
    if(!metric?.found)return;
    const template=findTemplate(re)||(label==='Отгрузка клиенту ПЛАН'?shipTemplate:anyTemplate);
    const tr=template.cloneNode(true);
    changed+=fillBalanceRow(tr,info,label,metric);
    parent.appendChild(tr);
  });
  return changed;
}
function distributionInfo(tbl){
  const rows=tableCells(tbl);
  for(let ri=0;ri<Math.min(4,rows.length);ri++){
    const headers=rows[ri].map(c=>k(elementText(c)));
    const layerCol=headers.findIndex(h=>h==='слой'||h.includes('бизнес-слой'));
    const nameCol=headers.findIndex(h=>h.includes('компания')||h.includes('клиент'));
    const periods=headerMap(rows[ri]);
    if(layerCol>=0&&nameCol>=0&&Object.keys(periods).length>=2)return{headerRow:ri,layerCol,nameCol,periods};
  }
  return null;
}
function fillDistributionRow(tr,info,layer,name,metric){
  const cells=[...tr.getElementsByTagNameNS('*','tc')];
  cells.forEach(c=>setTextIn(c,''));
  if(cells[info.layerCol])setTextIn(cells[info.layerCol],layer||'');
  if(cells[info.nameCol])setTextIn(cells[info.nameCol],name||'');
  updateMetricRow(cells,info.periods,metric);
  return Object.keys(info.periods).length+2;
}
function rebuildDistributionTable(tbl,m){
  const info=distributionInfo(tbl);if(!info)return 0;
  const trs=tableRows(tbl),rows=tableCells(tbl);
  let b2bIdx=-1,b2cIdx=-1,b2gIdx=-1,totalIdx=-1;
  for(let i=info.headerRow+1;i<rows.length;i++){
    const layer=k(elementText(rows[i][info.layerCol]||rows[i][0]));
    const name=k(elementText(rows[i][info.nameCol]||rows[i][1]));
    if(b2bIdx<0&&(layer==='b2b'||/итого\s*b2b/.test(name)))b2bIdx=i;
    if(b2cIdx<0&&(layer==='b2c'||/итого\s*b2c/.test(name)))b2cIdx=i;
    if(b2gIdx<0&&(layer==='b2g'||/итого\s*b2g/.test(name)))b2gIdx=i;
    if(totalIdx<0&&/всего\s+забронировано/.test(name))totalIdx=i;
  }
  if(b2bIdx<0)return 0;
  const summaryTemplate=trs[b2bIdx];
  const nextSummary=[b2cIdx,b2gIdx,totalIdx,trs.length].filter(x=>x>b2bIdx).sort((a,b)=>a-b)[0];
  const detailTemplates=trs.slice(b2bIdx+1,nextSummary).filter(Boolean);
  const b2cTemplate=b2cIdx>=0?trs[b2cIdx]:summaryTemplate;
  const b2gTemplate=b2gIdx>=0?trs[b2gIdx]:summaryTemplate;
  const totalTemplate=totalIdx>=0?trs[totalIdx]:(b2cTemplate||summaryTemplate);
  const parent=summaryTemplate.parentNode;
  for(let i=trs.length-1;i>info.headerRow;i--)parent.removeChild(trs[i]);

  let changed=0;
  const append=(template,layer,name,metric)=>{
    const tr=template.cloneNode(true);
    changed+=fillDistributionRow(tr,info,layer,name,metric);
    parent.appendChild(tr);
  };
  append(summaryTemplate,'B2B','Итого B2B',m.verticals.B2B);
  const b2b=(m.clientRows||[])
    .filter(x=>x.vertical==='B2B'&&annual(x)>0)
    .slice()
    .sort((a,b)=>annual(b)-annual(a)||String(a.displayName||a.name).localeCompare(String(b.displayName||b.name),'ru'));
  b2b.forEach((x,i)=>{
    const template=detailTemplates.length?detailTemplates[i%detailTemplates.length]:summaryTemplate;
    append(template,'',x.displayName||x.name,x);
  });

  if(m.verticals.B2G?.found&&annual(m.verticals.B2G)>0){
    append(b2gTemplate,'B2G','Итого B2G',m.verticals.B2G);
    const b2g=(m.clientRows||[]).filter(x=>x.vertical==='B2G'&&annual(x)>0).slice().sort((a,b)=>annual(b)-annual(a)||String(a.displayName||a.name).localeCompare(String(b.displayName||b.name),'ru'));
    b2g.forEach((x,i)=>{const template=detailTemplates.length?detailTemplates[i%detailTemplates.length]:summaryTemplate;append(template,'',x.displayName||x.name,x)});
  }

  append(b2cTemplate,'B2C','Итого B2C',m.verticals.B2C);
  append(totalTemplate,'','Всего забронировано',m.booked);
  return changed;
}
function updateTables(doc,m){
  let changed=0;
  for(const tbl of [...doc.getElementsByTagNameNS('*','tbl')]){
    if(distributionInfo(tbl)){
      changed+=rebuildDistributionTable(tbl,m);
      continue;
    }
    if(balanceInfo(tbl)){
      changed+=rebuildBalanceTable(tbl,m);
      continue;
    }
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
      if(!metric)metric=metricForLabel(labels.join(' '),m);
      if(metric)changed+=updateMetricRow(row,periods,metric);
    }
  }
  return changed;
}
function updateSlide(doc,m,salesName){
  let changed=0;
  changed+=setDate(doc,m.sourceDate);
  changed+=setSourceNote(doc,salesName,m.sheetName);
  changed+=setKpiNearLabel(doc,/^план производства$/,m.production);
  changed+=setKpiNearLabel(doc,/^план отгрузки(?: с завода)?$/,m.shipPlan);
  changed+=setKpiNearLabel(doc,/^отгружено авто(?:мобилей)?$/,m.shippedActual);
  changed+=setKpiNearLabel(doc,/^забронировано(?: атом| авто(?:мобилей)?(?: клиентами)?| клиентами)?$/,m.booked);
  changed+=setKpiNearLabel(doc,/^свободный сток$/,m.free);
  changed+=updateTables(doc,m);
  return changed;
}
async function exportPptx(){
  const {sales,template}=currentFiles();
  if(!sales||!template){if(log)log.textContent='Для выгрузки нужны актуальный Excel и PPTX-шаблон.';return}
  try{
    if(log)log.textContent='Читаю текущий S&OP09 plan и пересобираю PPTX...';
    await ensureXLSX();await ensureJSZip();
    const [salesBuf,tplBuf]=await Promise.all([sales.arrayBuffer(),template.arrayBuffer()]);
    const model=parseCurrentModel(salesBuf);
    const m=toExportModel(model);
    const zip=await JSZip.loadAsync(tplBuf);
    const slidePaths=Object.keys(zip.files).filter(p=>/^ppt\/slides\/slide\d+\.xml$/i.test(p)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    if(!slidePaths.length)throw new Error('В шаблоне не найдены слайды.');
    let changed=0;
    for(const slidePath of slidePaths){
      const xml=await zip.file(slidePath).async('string');
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      const count=updateSlide(doc,m,sales.name);
      if(count){zip.file(slidePath,new XMLSerializer().serializeToString(doc));changed+=count}
    }
    if(changed===0)throw new Error('В PPTX-шаблоне не найдены поля для обновления. Проверьте структуру шаблона.');
    const out=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(out);
    a.download='ATOM_OnePage_'+new Date().toISOString().slice(0,10)+'_v2.2.pptx';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    if(log)log.textContent=`PPTX пересобран из S&OP09 plan. Производство ${disp(annual(m.production))}, план отгрузки клиенту ${disp(annual(m.clientShipPlan))}, B2B ${disp(annual(m.verticals.B2B))}, B2C ${disp(annual(m.verticals.B2C))}, всего ${disp(annual(m.booked))}.`;
  }catch(e){
    console.error(e);
    if(log)log.textContent='Не удалось сформировать PPTX: '+(e.message||e);
  }
}

document.addEventListener('click',e=>{
  const btn=e.target.closest?.('#printBtn,#downloadHtmlBtn');
  if(!btn||btn.disabled)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  exportPptx();
},true);
})();