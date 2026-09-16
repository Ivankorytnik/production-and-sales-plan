(()=>{
'use strict';
const $=id=>document.getElementById(id);
const salesInput=$('salesFile'),templateInput=$('templateFile'),exportTop=$('printBtn'),exportBtn=$('downloadHtmlBtn'),log=$('parseLog');
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const num=v=>{if(typeof v==='number'&&isFinite(v))return v;const s=n(v);if(!s||s==='·'||s==='-'||s==='—')return 0;const x=Number(s.replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0};
const disp=v=>{const x=Number(v||0);return x===0?'·':String(Math.round(x))};
const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
function monthLabel(v){if(v instanceof Date&&!isNaN(v))return MONTHS[v.getMonth()][2];const s=k(v);if(!s)return null;for(const [ru,en,label] of MONTHS){if(new RegExp(`(^|[^а-яa-z])(${ru}[а-я]*|${en}[a-z]*)([^а-яa-z]|$)`,'i').test(s))return label}return null}
function canonicalPeriod(v){const m=monthLabel(v);if(m)return m;const s=k(v);if(/^2026$/.test(s)||/^итого\s*2026$/.test(s))return'2026';return null}
function loadScript(url,timeout=7000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const t=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('timeout'))},timeout);s.src=url;s.async=true;s.onload=()=>{if(done)return;done=true;clearTimeout(t);resolve()};s.onerror=()=>{if(done)return;done=true;clearTimeout(t);s.remove();reject(new Error('load error'))};document.head.appendChild(s)})}
async function ensureJSZip(){if(window.JSZip)return true;for(const src of ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js']){try{await loadScript(src);if(window.JSZip)return true}catch(e){}}throw new Error('Модуль формирования PPTX не загрузился. Проверьте интернет/корпоративный фильтр и повторите.')}
async function ensureXLSX(){if(window.XLSX)return true;for(const src of ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){try{await loadScript(src);if(window.XLSX)return true}catch(e){}}throw new Error('Модуль чтения Excel не загрузился. Проверьте интернет/корпоративный фильтр и повторите.')}
function getSheetData(buf){const wb=XLSX.read(buf,{type:'array',cellDates:true});const name=wb.SheetNames.find(x=>k(x).replace(/\s/g,'').includes('s&op09plan'))||wb.SheetNames.find(x=>k(x).includes('s&op09'))||wb.SheetNames[0];const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});return{name,rows}}
function findHeader(rows){let best=null;rows.slice(0,120).forEach((r,ri)=>{const cols=[];(r||[]).forEach((v,ci)=>{const m=monthLabel(v);if(m)cols.push({ci,m})});const uniq=[...new Set(cols.map(x=>x.m))];if(uniq.length>=4&&(!best||uniq.length>best.uniq))best={ri,cols,uniq:uniq.length,row:r}});return best}
function extractExcelMetrics(buf){
  const {rows}=getSheetData(buf),h=findHeader(rows);if(!h)return{};
  const mcols=[],seen=new Set();h.cols.forEach(x=>{if(!seen.has(x.m)){seen.add(x.m);mcols.push(x)}});
  const yearCandidates=[];(h.row||[]).forEach((v,ci)=>{const s=k(v);if(/^2026$/.test(s)||/^итого\s*2026$/.test(s))yearCandidates.push(ci)});
  const yearCol=yearCandidates.length?yearCandidates[yearCandidates.length-1]:-1;
  const first=Math.min(...mcols.map(x=>x.ci));
  const rowMetric=row=>{const months={};mcols.forEach(c=>months[c.m]=num(row[c.ci]));const yearFound=yearCol>=0&&n(row[yearCol])!=='';return{found:true,months,year:yearFound?num(row[yearCol]):null,yearFound}};
  const labels={};
  for(const row of rows){
    const parts=(row||[]).slice(0,first).map(n).filter(Boolean);if(!parts.length)continue;
    const label=k(parts[parts.length-1]);if(!label)continue;
    const m=rowMetric(row);
    if(!labels[label])labels[label]={count:0,months:{},year:0,yearFound:false,found:true};
    const x=labels[label];x.count++;
    for(const [p,v] of Object.entries(m.months))x.months[p]=(x.months[p]||0)+v;
    if(m.yearFound){x.year+=m.year;x.yearFound=true}
  }
  const uniqueLabel=label=>{const x=labels[k(label)];return x&&x.count===1?x:null};
  const metric=re=>{
    for(const row of rows){
      const left=(row||[]).slice(0,first).map(n).filter(Boolean).join(' | ');
      if(re.test(k(left)))return{...rowMetric(row),label:left};
    }
    return{found:false,months:{},year:null,yearFound:false,label:''};
  };
  const booked=uniqueLabel('Всего забронировано')||uniqueLabel('Забронировано клиентами')||metric(/всего забронировано|забронирован.*клиент/);
  return{
    labels,uniqueLabel,
    production:metric(/план производства/),
    shipPlan:metric(/отгрузк.*завод.*план|план.*отгрузк.*завод/),
    shippedActual:metric(/отгружено.*автомоб|отгружено.*авто/),
    corp:metric(/передано.*корп|корп.*парк/),
    booked,
    issues:metric(/план.*выдач.*клиент|выдач.*клиент/),
    free:metric(/свободн.*сток/)
  };
}
function textNodes(el){return [...el.getElementsByTagNameNS('*','t')]}
function elementText(el){return textNodes(el).map(x=>x.textContent).join('')}
function setTextIn(el,value){const ts=textNodes(el);if(ts.length){ts[0].textContent=String(value);for(let i=1;i<ts.length;i++)ts[i].textContent=''}}
function setDate(doc){for(const sp of [...doc.getElementsByTagNameNS('*','sp')]){if(/обновлено/i.test(elementText(sp))){setTextIn(sp,'Обновлено '+new Date().toLocaleDateString('ru-RU')+' ·');return}}}
function setKpiAfter(doc,re,metric){if(!metric?.found||!metric.yearFound)return false;const value=metric.year;const shapes=[...doc.getElementsByTagNameNS('*','sp')];for(let i=0;i<shapes.length;i++){if(re.test(k(elementText(shapes[i])))){for(let j=i+1;j<Math.min(i+5,shapes.length);j++){const tx=n(elementText(shapes[j]));if(/^\d+[\s\d]*$/.test(tx)||tx==='·'){setTextIn(shapes[j],Math.round(value||0));return true}}}}return false}
function tableCells(table){return [...table.getElementsByTagNameNS('*','tr')].map(tr=>[...tr.getElementsByTagNameNS('*','tc')])}
function findTableByHeader(doc,needles){for(const tbl of [...doc.getElementsByTagNameNS('*','tbl')]){const rows=tableCells(tbl);if(!rows[0])continue;const headers=rows[0].map(c=>k(elementText(c)));if(needles.every(nd=>headers.some(h=>h.includes(k(nd)))))return tbl}return null}
function headerMap(cells){const out={};cells.forEach((c,i)=>{const p=canonicalPeriod(elementText(c));if(p&&out[p]===undefined)out[p]=i});return out}
function metricForChainLabel(label,metrics){const s=k(label);if(/план производства/.test(s))return metrics.production;if(/план отгрузк.*завод|отгрузк.*завод.*план/.test(s))return metrics.shipPlan;if(/отгружено.*автомоб|отгружено.*авто/.test(s))return metrics.shippedActual;if(/передано.*корп|корп.*парк/.test(s))return metrics.corp;if(/забронировано.*клиент/.test(s))return metrics.booked;if(/план.*выдач.*клиент|выдач.*клиент/.test(s))return metrics.issues;if(/свободн.*сток/.test(s))return metrics.free;return null}
function updateMetricRow(row,periodMap,metric){if(!metric?.found)return;for(const [p,ci] of Object.entries(periodMap)){if(p==='2026'){if(metric.yearFound)setTextIn(row[ci],disp(metric.year));}else if(Object.prototype.hasOwnProperty.call(metric.months,p)){setTextIn(row[ci],disp(metric.months[p]));}}}
function fillChain(tbl,metrics){if(!tbl)return;const rows=tableCells(tbl);if(rows.length<2)return;const periods=headerMap(rows[0]);for(let ri=1;ri<rows.length;ri++){const label=elementText(rows[ri][0]);updateMetricRow(rows[ri],periods,metricForChainLabel(label,metrics))}}
function sourceForClientRow(label,metrics){
  const s=k(label);
  if(/^итого\s*b2b$/.test(s))return metrics.uniqueLabel('Итого B2B');
  if(/^итого\s*b2c$/.test(s))return metrics.uniqueLabel('Итого B2C');
  if(/^итого\s*b2g$/.test(s))return metrics.uniqueLabel('Итого B2G');
  if(/^всего забронировано$/.test(s))return metrics.booked?.found?metrics.booked:null;
  if(/^план продаж/.test(s))return metrics.uniqueLabel(label);
  return metrics.uniqueLabel(label);
}
function fillClients(tbl,metrics){
  if(!tbl)return;const rows=tableCells(tbl);if(rows.length<2)return;
  const headers=rows[0].map(c=>n(elementText(c))),periods=headerMap(rows[0]);
  const nameCol=headers.findIndex(h=>/компания\s*\/\s*проект|клиент\s*\/\s*проект/i.test(h));
  if(nameCol<0)return;
  for(let ri=1;ri<rows.length;ri++){
    const row=rows[ri],label=n(elementText(row[nameCol]));if(!label)continue;
    const src=sourceForClientRow(label,metrics);if(!src)continue;
    for(const [p,ci] of Object.entries(periods)){
      if(p==='2026'){if(src.yearFound)setTextIn(row[ci],disp(src.year));}
      else if(src.months&&Object.prototype.hasOwnProperty.call(src.months,p))setTextIn(row[ci],disp(src.months[p]));
    }
  }
}
async function exportPptx(){
  const sales=salesInput?.files?.[0],template=templateInput?.files?.[0];if(!sales||!template){if(log)log.textContent='Для выгрузки нужны Excel и PPTX-шаблон.';return}
  try{
    if(log)log.textContent='Подготавливаю модули Excel и PPTX...';await ensureXLSX();await ensureJSZip();
    if(log)log.textContent='Обновляю значения напрямую из S&OP09 plan без повторного суммирования...';
    const [salesBuf,tplBuf]=await Promise.all([sales.arrayBuffer(),template.arrayBuffer()]);
    const metrics=extractExcelMetrics(salesBuf);
    const zip=await JSZip.loadAsync(tplBuf),slidePath='ppt/slides/slide1.xml',file=zip.file(slidePath);if(!file)throw new Error('В шаблоне не найден первый слайд.');
    const xml=await file.async('string'),doc=new DOMParser().parseFromString(xml,'application/xml');
    setDate(doc);
    setKpiAfter(doc,/план производства/,metrics.production);
    setKpiAfter(doc,/план.*отгрузк/,metrics.shipPlan);
    setKpiAfter(doc,/отгружено.*авто|отгружено.*автомоб/,metrics.shippedActual);
    setKpiAfter(doc,/забронировано.*атом|забронировано.*авто.*клиент/,metrics.booked);
    fillChain(findTableByHeader(doc,['Показатель']),metrics);
    fillClients(findTableByHeader(doc,['Компания / проект'])||findTableByHeader(doc,['Клиент / проект']),metrics);
    zip.file(slidePath,new XMLSerializer().serializeToString(doc));
    const out=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),a=document.createElement('a');
    a.href=URL.createObjectURL(out);a.download='ATOM_OnePage_Обновлено_'+new Date().toISOString().slice(0,10)+'.pptx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    if(log)log.textContent='PPTX готов. Итоги B2B/B2C и «Всего забронировано» взяты напрямую из Excel, повторное суммирование отключено.';
  }catch(e){console.error(e);if(log)log.textContent='Не удалось сформировать PPTX: '+(e.message||e)}
}
function bind(btn){btn?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();exportPptx()},true)}
bind(exportTop);bind(exportBtn);
})();
