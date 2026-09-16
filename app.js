(()=>{'use strict';
const $=id=>document.getElementById(id),V=['B2C','B2B','B2G','Carsharing'];
const S={salesFile:null,templateFile:null,sales:null,model:null};
const E={salesFile:$('salesFile'),templateFile:$('templateFile'),salesName:$('salesName'),templateName:$('templateName'),salesStatus:$('salesStatus'),templateStatus:$('templateStatus'),salesCard:$('salesCard'),templateCard:$('templateCard'),readyBadge:$('readyBadge'),buildBtn:$('buildBtn'),resetBtn:$('resetBtn'),printBtn:$('printBtn'),parseLog:$('parseLog'),reportSection:$('reportSection'),reportDate:$('reportDate'),sourceCount:$('sourceCount'),kpiGrid:$('kpiGrid'),verticalTable:$('verticalTable'),clientTable:$('clientTable'),qualityList:$('qualityList'),qualityBadge:$('qualityBadge'),changesList:$('changesList'),decisionList:$('decisionList'),periodBadge:$('periodBadge'),templateInfo:$('templateInfo'),hitlInfo:$('hitlInfo'),clientFilter:$('clientFilter'),approveCheck:$('approveCheck'),saveSnapshotBtn:$('saveSnapshotBtn'),downloadHtmlBtn:$('downloadHtmlBtn')};
const n=v=>String(v??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const k=v=>n(v).toLowerCase().replace(/ё/g,'е');
const num=v=>{if(typeof v==='number'&&isFinite(v))return v;const s=n(v);if(!s||s==='-'||s==='—'||s==='·'||s==='`')return 0;const x=Number(s.replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return isFinite(x)?x:0};
const fmt=v=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(v||0);
const safe=s=>n(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=[['янв','jan','Янв'],['фев','feb','Фев'],['мар','mar','Мар'],['апр','apr','Апр'],['май','may','Май'],['июн','jun','Июн'],['июл','jul','Июл'],['авг','aug','Авг'],['сен','sep','Сен'],['окт','oct','Окт'],['ноя','nov','Ноя'],['дек','dec','Дек']];
function monthLabel(v){
  if(v instanceof Date&&!isNaN(v)){if(v.getDate()!==1)return null;return MONTHS[v.getMonth()][2]+' '+v.getFullYear()}
  const s=k(v);if(!s)return null;
  const iso=s.match(/^(20\d{2})[-/.](0?[1-9]|1[0-2])(?:[-/.]0?1)?$/);if(iso){const m=+iso[2]-1;return MONTHS[m][2]+' '+iso[1]}
  for(let i=0;i<MONTHS.length;i++){const [ru,en,label]=MONTHS[i];if(new RegExp(`(^|[^а-яa-z])(${ru}[а-я]*|${en}[a-z]*)([^а-яa-z]|$)`,'i').test(s)){const y=(s.match(/20\d{2}/)||[])[0]||'2026';return label+' '+y}}
  return null;
}
function vert(v){const s=k(v).replace(/\s/g,'');if(s.includes('b2c'))return'B2C';if(s.includes('b2b'))return'B2B';if(s.includes('b2g'))return'B2G';if(s.includes('carsharing')||s.includes('каршер'))return'Carsharing';return null}
function readWorkbook(buf){if(!window.XLSX)throw new Error('Модуль Excel не загрузился. Обновите страницу Ctrl+F5.');const w=XLSX.read(buf,{type:'array',cellDates:true});return w.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(w.Sheets[name],{header:1,defval:null,raw:true})}))}
function chooseSheet(ss){return ss.find(s=>k(s.name).replace(/\s/g,'').includes('s&op09plan'))||ss.find(s=>k(s.name).includes('s&op09'))||ss[0]}
function findMonthHeader(rows){let best=null;rows.slice(0,100).forEach((row,ri)=>{const cols=[];(row||[]).forEach((v,ci)=>{const label=monthLabel(v);if(label)cols.push({ci,label})});const unique=[...new Set(cols.map(x=>x.label))];if(unique.length>=4&&(!best||unique.length>best.count))best={ri,cols,count:unique.length}});return best}
function leftText(row,firstMonthCol){return (row||[]).slice(0,firstMonthCol).map(n).filter(Boolean)}
function rightText(row,lastMonthCol){return (row||[]).slice(lastMonthCol+1).map(n).filter(Boolean).join(' | ')}
function isGroupLabel(s){const x=k(s);return /^(b2b|b2c|b2g)(\s+всего)?$/.test(x)||/^(фэмили|family|такси|taxi|каршеринг|carsharing|итого|всего забронировано|выдачи)$/.test(x)||x.startsWith('итого b2')}
function carsharingName(s){const x=k(s);return /каршер|carsharing|citydrive|ситидрайв|делимоб|казань каршер|росатом каршер|псб cs|псб каршер|адс соснов|кубань-электромоторс|искра-парк|ск город/.test(x)}
function parseSales(ss){
  if(!ss.length)throw new Error('В Excel нет листов.');
  const sh=chooseSheet(ss),rows=sh.rows,header=findMonthHeader(rows);
  if(!header)throw new Error(`На листе «${sh.name}» не найдена строка с месяцами. Ожидаются колонки Июн/Июл/Авг/Сен/Окт/Ноя/Дек.`);
  const monthCols=[];const seen=new Set();header.cols.forEach(x=>{if(!seen.has(x.label)){seen.add(x.label);monthCols.push(x)}});
  monthCols.sort((a,b)=>a.ci-b.ci);
  const firstMonthCol=monthCols[0].ci,lastMonthCol=monthCols[monthCols.length-1].ci;
  let contract=null,product=null,active=false;const rec=[];
  for(let ri=header.ri+1;ri<rows.length;ri++){
    const row=rows[ri]||[],parts=leftText(row,firstMonthCol),label=parts.length?parts[parts.length-1]:'';
    const allLeft=parts.join(' | '),low=k(allLeft);
    if(!allLeft&&!monthCols.some(m=>num(row[m.ci])))continue;
    if(/план производства|отгрузка с завода|эптс|доступно/.test(low)&&!/(b2b|b2c|b2g)/.test(low)){if(active)break;continue}
    const v=vert(allLeft);
    if(v&&v!=='Carsharing'){contract=v;active=true;if(/b2b/.test(low))product=null;if(/b2c/.test(low))product=null;if(/b2g/.test(low))product=null}
    if(/(^|\s)(каршеринг|carsharing)(\s|$)/.test(low)&&!carsharingName(label))product='Carsharing';
    else if(/(^|\s)(такси|taxi)(\s|$)/.test(low)&&!carsharingName(label))product='Taxi';
    else if(/(^|\s)(фэмили|family)(\s|$)/.test(low))product='Family';
    if(!active||!contract)continue;
    const values={};let total=0;monthCols.forEach(m=>{const q=num(row[m.ci]);values[m.label]=q;total+=q});
    const comment=rightText(row,lastMonthCol);
    const group=isGroupLabel(label)||(!label&&v);
    if(group)continue;
    if(!label)continue;
    const outVertical=(product==='Carsharing'||carsharingName(label))?'Carsharing':contract;
    if(!V.includes(outVertical))continue;
    if(total===0&&!comment&&outVertical!=='B2G')continue;
    rec.push({row:ri+1,vertical:outVertical,client:label,region:'',status:comment,values,isAggregate:false});
  }
  if(!rec.length)throw new Error(`Лист «${sh.name}» и месяцы найдены, но клиентские строки B2B/B2C/B2G не распознаны.`);
  const periods=monthCols.map(x=>x.label);
  return{sheet:sh.name,records:rec,periods,headerRow:header.ri+1};
}
function snapshot(){try{return JSON.parse(localStorage.getItem('sales-plan-baseline')||'null')}catch{return null}}
function makeModel(sa){
  const periods=sa.periods,verticals=V.map(v=>{const p={};periods.forEach(x=>{const detail=sa.records.filter(r=>r.vertical===v).reduce((s,r)=>s+num(r.values[x]),0);p[x]={plan:detail,detail,delta:0}});return{vertical:v,periods:p}});
  const clients=sa.records.filter(r=>['B2B','B2G','Carsharing'].includes(r.vertical));
  const issues=[];
  const totals={};periods.forEach(p=>totals[p]=verticals.reduce((s,v)=>s+(v.periods[p]?.plan||0),0));
  const grand=Object.values(totals).reduce((a,b)=>a+b,0);
  if(grand===0)issues.push({s:'bad',t:'Все месячные значения равны нулю. Проверьте структуру листа S&OP09 plan.'});
  const ss={at:new Date().toISOString(),byClient:{}};clients.forEach(c=>ss.byClient[`${c.vertical}|${k(c.client)}`]={values:c.values,status:c.status,region:c.region});
  const old=snapshot(),changes=[];
  if(old){new Set([...Object.keys(old.byClient||{}),...Object.keys(ss.byClient)]).forEach(x=>{const a=old.byClient?.[x],b=ss.byClient?.[x],name=x.split('|')[1];if(!a&&b)changes.push({h:`Новый проект: ${name}`,t:'Добавлен в план'});else if(a&&!b)changes.push({h:`Проект исчез: ${name}`,t:'Отсутствует в текущем плане'});else if(a&&b){const ps=new Set([...Object.keys(a.values||{}),...Object.keys(b.values||{})]);ps.forEach(p=>{const av=num(a.values?.[p]),bv=num(b.values?.[p]);if(av!==bv)changes.push({h:`Объем: ${name}`,t:`${p}: ${fmt(av)} → ${fmt(bv)}`})});if(n(a.status)!==n(b.status))changes.push({h:`Статус: ${name}`,t:`${a.status||'—'} → ${b.status||'—'}`})}})}
  if(!changes.length)changes.push({h:old?'Существенных изменений нет':'База сравнения не сохранена',t:old?'Текущий план совпадает с сохраненным':'Сохраните текущий расчет для сравнения следующего среза'});
  return{periods,verticals,clients,issues,totals,grand,snapshot:ss,changes};
}
function render(m){
  E.reportSection.classList.remove('hidden');E.reportDate.textContent=new Date().toLocaleDateString('ru-RU');E.sourceCount.textContent='2/2';E.periodBadge.textContent=m.periods.join(' • ');E.templateInfo.textContent=`Шаблон презентации: ${S.templateFile?.name||'—'}`;
  const cards=m.periods.map(p=>`<div class="kpi"><span>${safe(p)}</span><strong>${fmt(m.totals[p])}</strong><small>автомобилей</small></div>`);cards.unshift(`<div class="kpi"><span>Итого план</span><strong>${fmt(m.grand)}</strong><small>автомобилей</small></div>`);E.kpiGrid.innerHTML=cards.slice(0,7).join('');
  const vh=`<thead><tr><th>Вертикаль</th>${m.periods.map(p=>`<th class="num">${safe(p)}</th>`).join('')}<th class="num">Итого</th></tr></thead>`;
  const vb=m.verticals.map(v=>{const total=m.periods.reduce((s,p)=>s+(v.periods[p]?.plan||0),0);return`<tr><td><strong>${v.vertical}</strong></td>${m.periods.map(p=>`<td class="num">${fmt(v.periods[p]?.plan||0)}</td>`).join('')}<td class="num"><strong>${fmt(total)}</strong></td></tr>`}).join('');
  E.verticalTable.innerHTML=vh+`<tbody>${vb}</tbody>`;renderClients(m.clients,m.periods);
  const q=m.issues.length;E.qualityBadge.textContent=q?`${q} проблем`:'OK';E.qualityList.innerHTML=q?m.issues.map(x=>`<div class="quality-item ${x.s}"><strong>Проверить</strong>${safe(x.t)}</div>`).join(''):`<div class="quality-item ok"><strong>OK</strong>Месяцы распознаны как календарные периоды S&OP09 plan.</div>`;
  E.changesList.innerHTML=m.changes.slice(0,12).map(x=>`<div class="change-item"><strong>${safe(x.h)}</strong>${safe(x.t)}</div>`).join('');E.decisionList.innerHTML=q?m.issues.slice(0,8).map(x=>`<span class="decision-chip">${safe(x.t)}</span>`).join(''):'<span class="decision-chip">Критичных ошибок распознавания не обнаружено</span>';E.printBtn.disabled=!E.approveCheck.checked;E.reportSection.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderClients(rows,periods){const f=k(E.clientFilter?.value||''),data=rows.filter(r=>!f||k([r.vertical,r.client,r.region,r.status].join(' ')).includes(f));E.clientTable.innerHTML=`<thead><tr><th>Вертикаль</th><th>Клиент / проект</th>${periods.map(p=>`<th class="num">${safe(p)}</th>`).join('')}<th class="num">Итого</th><th>Комментарий / статус</th></tr></thead><tbody>${data.map(r=>{const total=periods.reduce((s,p)=>s+num(r.values[p]),0);return`<tr><td>${safe(r.vertical)}</td><td><strong>${safe(r.client||'—')}</strong></td>${periods.map(p=>`<td class="num">${fmt(r.values[p]||0)}</td>`).join('')}<td class="num"><strong>${fmt(total)}</strong></td><td>${safe(r.status||'—')}</td></tr>`}).join('')}</tbody>`}
function setStatus(kind,state,text){const card=kind==='sales'?E.salesCard:E.templateCard,status=kind==='sales'?E.salesStatus:E.templateStatus;card.classList.remove('loaded','error');status.className='upload-status';if(state==='loaded'){card.classList.add('loaded');status.classList.add('status-loaded')}else if(state==='error'){card.classList.add('error');status.classList.add('status-error')}else status.classList.add('status-empty');status.textContent=text}
function updateReady(){const c=[S.salesFile,S.templateFile].filter(Boolean).length;E.readyBadge.textContent=`${c} / 2`;E.readyBadge.classList.toggle('complete',c===2);E.buildBtn.disabled=c!==2;if(c===2)E.parseLog.textContent='Оба файла загружены. Можно формировать One Page.'}
E.salesFile.addEventListener('change',()=>{const f=E.salesFile.files?.[0]||null;S.salesFile=null;S.sales=null;if(!f){E.salesName.textContent='Файл не выбран';setStatus('sales','empty','Не загружен');updateReady();return}if(!/\.(xlsx|xls|xlsm)$/i.test(f.name)){E.salesName.textContent=f.name;setStatus('sales','error','Ошибка формата');E.parseLog.textContent='План продаж должен быть Excel-файлом: XLSX, XLS или XLSM.';updateReady();return}S.salesFile=f;E.salesName.textContent=f.name;setStatus('sales','loaded','Загружен');E.parseLog.textContent=`План продаж выбран: ${f.name} (${(f.size/1024/1024).toFixed(2)} МБ).`;updateReady()});
E.templateFile.addEventListener('change',()=>{const f=E.templateFile.files?.[0]||null;S.templateFile=null;if(!f){E.templateName.textContent='Файл не выбран';setStatus('template','empty','Не загружен');updateReady();return}if(!/\.pptx$/i.test(f.name)){E.templateName.textContent=f.name;setStatus('template','error','Ошибка формата');E.parseLog.textContent='Шаблон презентации должен быть файлом PPTX.';updateReady();return}S.templateFile=f;E.templateName.textContent=f.name;setStatus('template','loaded','Загружен');E.parseLog.textContent=`Шаблон презентации выбран: ${f.name} (${(f.size/1024/1024).toFixed(2)} МБ).`;updateReady()});
E.buildBtn.addEventListener('click',async()=>{if(!S.salesFile||!S.templateFile)return;E.buildBtn.disabled=true;E.buildBtn.textContent='Читаю S&OP09 plan...';E.parseLog.textContent='Ищу вкладку S&OP09 plan и календарные месяцы...';try{S.sales=parseSales(readWorkbook(await S.salesFile.arrayBuffer()));S.model=makeModel(S.sales);setStatus('sales','loaded','Загружен и прочитан');E.parseLog.textContent=`Готово. Лист «${S.sales.sheet}», строка месяцев ${S.sales.headerRow}, периоды: ${S.sales.periods.join(', ')}, клиентских строк: ${S.sales.records.length}.`;render(S.model)}catch(err){setStatus('sales','error','Файл загружен, ошибка чтения');E.parseLog.textContent=`Excel загружен, но не удалось распознать план: ${err.message||String(err)}`}finally{E.buildBtn.textContent='Сформировать One Page';E.buildBtn.disabled=false}});
E.clientFilter?.addEventListener('input',()=>{if(S.model)renderClients(S.model.clients,S.model.periods)});E.approveCheck?.addEventListener('change',()=>{E.printBtn.disabled=!E.approveCheck.checked});E.printBtn?.addEventListener('click',()=>window.print());E.saveSnapshotBtn?.addEventListener('click',()=>{if(!S.model)return;localStorage.setItem('sales-plan-baseline',JSON.stringify(S.model.snapshot));E.saveSnapshotBtn.textContent='База сохранена'});E.downloadHtmlBtn?.addEventListener('click',()=>{const blob=new Blob(['<!doctype html><meta charset="utf-8">'+$('onePage').outerHTML],{type:'text/html'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ATOM_Sales_OnePage.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});E.resetBtn?.addEventListener('click',()=>{S.salesFile=S.templateFile=S.sales=S.model=null;E.salesFile.value='';E.templateFile.value='';E.salesName.textContent=E.templateName.textContent='Файл не выбран';setStatus('sales','empty','Не загружен');setStatus('template','empty','Не загружен');E.reportSection.classList.add('hidden');E.parseLog.textContent='Ожидаю загрузку файлов.';E.approveCheck.checked=false;E.printBtn.disabled=true;updateReady()});setStatus('sales','empty','Не загружен');setStatus('template','empty','Не загружен');updateReady();
})();