(()=>{
'use strict';
const $=id=>document.getElementById(id);
const salesInput=$('salesFile'),templateInput=$('templateFile'),exportTop=$('printBtn'),exportBtn=$('downloadHtmlBtn'),log=$('parseLog');
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const num=v=>{if(typeof v==='number'&&isFinite(v))return v;const s=n(v);if(!s||s==='·'||s==='-'||s==='—'||s==='`')return 0;const x=Number(s.replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0};
const disp=v=>{const x=Number(v||0);return x===0?'·':String(Math.round(x))};
const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
const CLIENT_ALIASES={'ассоциация учреждений уимо':'ассоциация учреждений по управлению имуществом и материального обеспечения'};
function monthLabel(v){if(v instanceof Date&&!isNaN(v))return MONTHS[v.getMonth()][2];const s=k(v);if(!s)return null;for(const [ru,en,label] of MONTHS){if(new RegExp(`(^|[^а-яa-z])(${ru}[а-я]*|${en}[a-z]*)([^а-яa-z]|$)`,'i').test(s))return label}return null}
function canonicalPeriod(v){const m=monthLabel(v);if(m)return m;const s=k(v);if(/^2026$/.test(s)||/^total$/.test(s)||/^итого\s*2026$/.test(s))return'2026';return null}
function loadScript(url,timeout=7000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const t=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('timeout'))},timeout);s.src=url;s.async=true;s.onload=()=>{if(done)return;done=true;clearTimeout(t);resolve()};s.onerror=()=>{if(done)return;done=true;clearTimeout(t);s.remove();reject(new Error('load error'))};document.head.appendChild(s)})}
async function ensureJSZip(){if(window.JSZip)return true;for(const src of ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js','https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js']){try{await loadScript(src);if(window.JSZip)return true}catch(e){}}throw new Error('Модуль формирования PPTX не загрузился. Проверьте интернет/корпоративный фильтр и повторите.')}
async function ensureXLSX(){if(window.XLSX)return true;for(const src of ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){try{await loadScript(src);if(window.XLSX)return true}catch(e){}}throw new Error('Модуль чтения Excel не загрузился. Проверьте интернет/корпоративный фильтр и повторите.')}
function getSheetData(buf){const wb=XLSX.read(buf,{type:'array',cellDates:true});const name=wb.SheetNames.find(x=>k(x).replace(/\s/g,'').includes('s&op09plan'))||wb.SheetNames.find(x=>k(x).includes('s&op09'))||wb.SheetNames[0];const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});return{name,rows}}
function findHeader(rows){let best=null;rows.slice(0,120).forEach((r,ri)=>{const cols=[];(r||[]).forEach((v,ci)=>{const m=monthLabel(v);if(m)cols.push({ci,m})});const uniq=[...new Set(cols.map(x=>x.m))];if(uniq.length>=4&&(!best||uniq.length>best.uniq))best={ri,cols,uniq:uniq.length,row:r}});return best}
function addMetric(a,b){if(!a)return{found:true,months:{...b.months},year:b.year,yearFound:b.yearFound};for(const [p,v] of Object.entries(b.months||{}))a.months[p]=(a.months[p]||0)+v;if(b.yearFound){a.year=(a.year||0)+(b.year||0);a.yearFound=true}a.found=true;return a}
function extractExcelModel(buf){
  const {rows}=getSheetData(buf),h=findHeader(rows);if(!h)throw new Error('На листе S&OP09 plan не найдена строка календарных месяцев.');
  const mcols=[],seen=new Set();h.cols.forEach(x=>{if(!seen.has(x.m)){seen.add(x.m);mcols.push(x)}});mcols.sort((a,b)=>a.ci-b.ci);
  const first=Math.min(...mcols.map(x=>x.ci));
  let yearCol=-1;(h.row||[]).forEach((v,ci)=>{const s=k(v);if(/^total$/.test(s)||/^2026$/.test(s)||/^итого\s*2026$/.test(s))yearCol=ci});
  const rowLabel=row=>{const parts=(row||[]).slice(0,first).map(n).filter(Boolean);return parts.length?parts[parts.length-1]:''};
  const rowMetric=row=>{const months={};mcols.forEach(c=>months[c.m]=num(row[c.ci]));const yearFound=yearCol>=0&&n(row[yearCol])!=='';return{found:true,months,year:yearFound?num(row[yearCol]):null,yearFound}};
  const firstMetric=re=>{for(const row of rows){const label=rowLabel(row);if(re.test(k(label)))return{...rowMetric(row),label}}return{found:false,months:{},year:null,yearFound:false,label:''}};
  const production=firstMetric(/^план производства/);
  const shipPlan=firstMetric(/^отгрузка с завода план$|^план отгрузк.*завод/);
  const shippedActual=firstMetric(/^отгрузка с завода факт$|^отгружено.*авто/);
  const corp=firstMetric(/^передано в корпоративный парк$|^передано.*корп/);
  const booked=firstMetric(/^выдачи$|^всего забронировано$|^забронировано клиентами$/);
  const free=firstMetric(/^доступно$|^свободный сток$|^свободн.*сток/);
  const verticals={B2B:null,B2C:null,B2G:null};
  const clients={};let currentVertical=null,product=null;
  const isAggregate=(s,v)=>new RegExp(`^(контракты\\s*${v.toLowerCase()}|итого\\s*${v.toLowerCase()}|${v.toLowerCase()})(\\s+всего)?$`).test(s);
  const groupOf=s=>/^фэмили$|^family$/.test(s)?'Family':(/^такси$|^taxi$/.test(s)?'Taxi':(/^каршеринг$|^carsharing$/.test(s)?'Carsharing':null));
  const specialKey=(label,product)=>{const s=k(label);if(s==='гринтех энерджи'&&(product==='Taxi'||product==='Carsharing'))return`${s}|${product}`;return s};
  for(let ri=h.ri+1;ri<rows.length;ri++){
    const row=rows[ri]||[],label=rowLabel(row),s=k(label);if(!label)continue;
    if(isAggregate(s,'B2B')){currentVertical='B2B';product=null;verticals.B2B=rowMetric(row);continue}
    if(isAggregate(s,'B2G')){currentVertical='B2G';product=null;verticals.B2G=rowMetric(row);continue}
    if(isAggregate(s,'B2C')){currentVertical='B2C';product=null;verticals.B2C=rowMetric(row);continue}
    if(/^выдачи$|^доступно$/.test(s)){currentVertical=null;product=null;continue}
    const g=groupOf(s);if(g){product=g;continue}
    if(!currentVertical||currentVertical==='B2C')continue;
    if(/^план |^выпуск |^отгрузка |^передано /.test(s))continue;
    const m=rowMetric(row),key=specialKey(label,product);
    if(!clients[key])clients[key]={name:label,product,vertical:currentVertical,found:true,months:{},year:0,yearFound:false};
    addMetric(clients[key],m);
  }
  return{production,shipPlan,shippedActual,corp,booked,free,verticals,clients};
}
function textNodes(el){return [...el.getElementsByTagNameNS('*','t')]}
function elementText(el){return textNodes(el).map(x=>x.textContent).join('')}
function setTextIn(el,value){const ts=textNodes(el);if(ts.length){ts[0].textContent=String(value);for(let i=1;i<ts.length;i++)ts[i].textContent=''}}
function setDate(doc){for(const sp of [...doc.getElementsByTagNameNS('*','sp')]){if(/обновлено/i.test(elementText(sp))){setTextIn(sp,'Обновлено '+new Date().toLocaleDateString('ru-RU'));return}}}
function setKpiAfter(doc,re,metric){if(!metric?.found||!metric.yearFound)return false;const shapes=[...doc.getElementsByTagNameNS('*','sp')];for(let i=0;i<shapes.length;i++){if(re.test(k(elementText(shapes[i])))){for(let j=i+1;j<Math.min(i+5,shapes.length);j++){const tx=n(elementText(shapes[j]));if(/^\d+[\s\d]*$/.test(tx)||tx==='·'){setTextIn(shapes[j],Math.round(metric.year||0));return true}}}}return false}
function tableCells(table){return [...table.getElementsByTagNameNS('*','tr')].map(tr=>[...tr.getElementsByTagNameNS('*','tc')])}
function findTableByHeader(doc,needles){for(const tbl of [...doc.getElementsByTagNameNS('*','tbl')]){const rows=tableCells(tbl);if(!rows[0])continue;const headers=rows[0].map(c=>k(elementText(c)));if(needles.every(nd=>headers.some(h=>h.includes(k(nd)))))return tbl}return null}
function headerMap(cells){const out={};cells.forEach((c,i)=>{const p=canonicalPeriod(elementText(c));if(p&&out[p]===undefined)out[p]=i});return out}
function updateMetricRow(row,periodMap,metric){if(!metric?.found)return;for(const [p,ci] of Object.entries(periodMap)){if(p==='2026'){if(metric.yearFound)setTextIn(row[ci],disp(metric.year));}else if(Object.prototype.hasOwnProperty.call(metric.months,p))setTextIn(row[ci],disp(metric.months[p]));}}
function metricForChainLabel(label,m){const s=k(label);if(/план производства/.test(s))return m.production;if(/план отгрузк.*завод|отгрузк.*завод.*план/.test(s))return m.shipPlan;if(/отгружено.*автомоб|отгружено.*авто/.test(s))return m.shippedActual;if(/передано.*корп/.test(s))return m.corp;if(/забронировано.*клиент/.test(s))return m.booked;if(/свободн.*сток|доступно/.test(s))return m.free;return null}
function fillChain(tbl,m){if(!tbl)return;const rows=tableCells(tbl);if(rows.length<2)return;const periods=headerMap(rows[0]);for(let ri=1;ri<rows.length;ri++)updateMetricRow(rows[ri],periods,metricForChainLabel(elementText(rows[ri][0]),m))}
function clientSource(label,m){const s=k(label);if(/^итого\s*b2b$/.test(s))return m.verticals.B2B;if(/^итого\s*b2c$/.test(s))return m.verticals.B2C;if(/^итого\s*b2g$/.test(s))return m.verticals.B2G;if(/^всего забронировано$/.test(s))return m.booked;if(s==='гринтех энерджи - каршеринг')return m.clients['гринтех энерджи|Carsharing'];if(s==='гринтех энерджи - такси')return m.clients['гринтех энерджи|Taxi'];const lookup=CLIENT_ALIASES[s]||s;return m.clients[lookup]||null}
function fillClients(tbl,m){if(!tbl)return;const rows=tableCells(tbl);if(rows.length<2)return;const headers=rows[0].map(c=>n(elementText(c))),periods=headerMap(rows[0]);const nameCol=headers.findIndex(h=>/компания\s*\/\s*проект|клиент\s*\/\s*проект/i.test(h));if(nameCol<0)return;for(let ri=1;ri<rows.length;ri++){const row=rows[ri],label=n(elementText(row[nameCol]));if(!label)continue;updateMetricRow(row,periods,clientSource(label,m))}}
function currentFiles(){return{sales:window.ATOMCurrentFiles?.sales||salesInput?.files?.[0]||null,template:window.ATOMCurrentFiles?.template||templateInput?.files?.[0]||null}}
async function exportPptx(){const {sales,template}=currentFiles();if(!sales||!template){if(log)log.textContent='Для выгрузки нужны Excel и PPTX-шаблон.';return}try{if(log)log.textContent='Читаю актуальный S&OP09 plan...';await ensureXLSX();await ensureJSZip();const [salesBuf,tplBuf]=await Promise.all([sales.arrayBuffer(),template.arrayBuffer()]);const m=extractExcelModel(salesBuf);if(log)log.textContent='Обновляю шаблон актуальными значениями из Excel...';const zip=await JSZip.loadAsync(tplBuf),slidePath='ppt/slides/slide1.xml',file=zip.file(slidePath);if(!file)throw new Error('В шаблоне не найден первый слайд.');const xml=await file.async('string'),doc=new DOMParser().parseFromString(xml,'application/xml');setDate(doc);setKpiAfter(doc,/план производства/,m.production);setKpiAfter(doc,/план.*отгрузк/,m.shipPlan);setKpiAfter(doc,/отгружено.*авто|отгружено.*автомоб/,m.shippedActual);setKpiAfter(doc,/забронировано.*атом|забронировано.*авто.*клиент/,m.booked);fillChain(findTableByHeader(doc,['Показатель']),m);fillClients(findTableByHeader(doc,['Компания / проект'])||findTableByHeader(doc,['Клиент / проект']),m);zip.file(slidePath,new XMLSerializer().serializeToString(doc));const out=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),a=document.createElement('a');a.href=URL.createObjectURL(out);a.download='ATOM_OnePage_Обновлено_'+new Date().toISOString().slice(0,10)+'.pptx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);if(log)log.textContent=`PPTX готов. Актуально: B2B ${m.verticals.B2B?.year??'—'}, B2C ${m.verticals.B2C?.year??'—'}, всего забронировано ${m.booked?.year??'—'}.`}catch(e){console.error(e);if(log)log.textContent='Не удалось сформировать PPTX: '+(e.message||e)}}
function bind(btn){btn?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();exportPptx()},true)}
bind(exportTop);bind(exportBtn);
})();