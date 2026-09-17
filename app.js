(()=>{
'use strict';
const faviconSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#071217"/><circle cx="32" cy="32" r="21" fill="none" stroke="#19d6e1" stroke-width="4"/><path d="M22 43 30 20h4l8 23h-5l-2-6H29l-2 6h-5Zm8-10h4l-2-7-2 7Z" fill="#fff"/><circle cx="48" cy="16" r="4" fill="#19d6e1"/></svg>';
let favicon=document.querySelector('link[rel="icon"]');
if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon)}
favicon.type='image/svg+xml';
favicon.href='data:image/svg+xml,'+encodeURIComponent(faviconSvg);
const $=id=>document.getElementById(id);
const S={salesFile:null,templateFile:null,model:null};
const E={salesFile:$('salesFile'),templateFile:$('templateFile'),salesName:$('salesName'),templateName:$('templateName'),salesStatus:$('salesStatus'),templateStatus:$('templateStatus'),salesCard:$('salesCard'),templateCard:$('templateCard'),readyBadge:$('readyBadge'),buildBtn:$('buildBtn'),resetBtn:$('resetBtn'),printBtn:$('printBtn'),parseLog:$('parseLog'),reportSection:$('reportSection'),approveCheck:$('approveCheck'),saveSnapshotBtn:$('saveSnapshotBtn')};
function setStatus(kind,state,text){const card=kind==='sales'?E.salesCard:E.templateCard,status=kind==='sales'?E.salesStatus:E.templateStatus;card?.classList.remove('loaded','error');if(status){status.className='upload-status '+(state==='loaded'?'status-loaded':state==='error'?'status-error':'status-empty');status.textContent=text}if(state==='loaded')card?.classList.add('loaded');if(state==='error')card?.classList.add('error')}
function updateReady(){const c=[S.salesFile,S.templateFile].filter(Boolean).length;if(E.readyBadge){E.readyBadge.textContent=`${c} / 2`;E.readyBadge.classList.toggle('complete',c===2)}if(E.buildBtn)E.buildBtn.disabled=c!==2;if(c===2&&E.parseLog)E.parseLog.textContent='Оба файла загружены. Можно сформировать One Page.'}
function loadScript(url,timeout=7000){return new Promise((resolve,reject)=>{const s=document.createElement('script');let done=false;const t=setTimeout(()=>{if(done)return;done=true;s.remove();reject(new Error('timeout'))},timeout);s.src=url;s.async=true;s.onload=()=>{if(done)return;done=true;clearTimeout(t);resolve()};s.onerror=()=>{if(done)return;done=true;clearTimeout(t);reject(new Error('load error'))};document.head.appendChild(s)})}
async function ensureXLSX(){if(window.XLSX)return true;for(const src of ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js']){try{await loadScript(src);if(window.XLSX)return true}catch(e){}}throw new Error('Модуль Excel не загрузился. Проверьте доступ к CDN и повторите.')}
E.salesFile?.addEventListener('change',()=>{const f=E.salesFile.files?.[0]||null;S.salesFile=null;if(!f){E.salesName.textContent='Файл не выбран';setStatus('sales','empty','Не загружен');updateReady();return}if(!/\.(xlsx|xls|xlsm)$/i.test(f.name)){E.salesName.textContent=f.name;setStatus('sales','error','Ошибка формата');updateReady();return}S.salesFile=f;E.salesName.textContent=f.name;setStatus('sales','loaded','Загружен');if(E.parseLog)E.parseLog.textContent=`План продаж выбран: ${f.name}`;updateReady()});
E.templateFile?.addEventListener('change',()=>{const f=E.templateFile.files?.[0]||null;S.templateFile=null;if(!f){E.templateName.textContent='Файл не выбран';setStatus('template','empty','Не загружен');updateReady();return}if(!/\.pptx$/i.test(f.name)){E.templateName.textContent=f.name;setStatus('template','error','Ошибка формата');updateReady();return}S.templateFile=f;E.templateName.textContent=f.name;setStatus('template','loaded','Загружен');if(E.parseLog)E.parseLog.textContent=`Шаблон презентации выбран: ${f.name}`;updateReady()});
E.buildBtn?.addEventListener('click',async()=>{if(!S.salesFile||!S.templateFile)return;E.buildBtn.disabled=true;E.buildBtn.textContent='Формирую One Page...';if(E.parseLog)E.parseLog.textContent='Читаю S&OP09 plan и собираю экран в стиле PPTX-шаблона...';try{await ensureXLSX();S.model=await window.ATOMTemplateView.renderFromFile(S.salesFile,S.templateFile.name);setStatus('sales','loaded','Загружен и прочитан');E.reportSection?.classList.remove('hidden');E.printBtn.disabled=false;if(E.approveCheck)E.approveCheck.checked=true;if(E.parseLog)E.parseLog.textContent=`Готово. Лист «${S.model.sheetName}». Экран собран в стиле PPTX-шаблона.`;E.reportSection?.scrollIntoView({behavior:'smooth',block:'start'})}catch(err){setStatus('sales','error','Ошибка чтения');if(E.parseLog)E.parseLog.textContent=`Не удалось сформировать One Page: ${err.message||String(err)}`}finally{E.buildBtn.textContent='Сформировать One Page';E.buildBtn.disabled=false}});
E.saveSnapshotBtn?.addEventListener('click',()=>{if(!S.model)return;localStorage.setItem('atom-onepage-baseline',JSON.stringify({savedAt:new Date().toISOString(),model:S.model}));E.saveSnapshotBtn.textContent='База сохранена'});
E.resetBtn?.addEventListener('click',()=>{S.salesFile=S.templateFile=S.model=null;if(E.salesFile)E.salesFile.value='';if(E.templateFile)E.templateFile.value='';if(E.salesName)E.salesName.textContent='Файл не выбран';if(E.templateName)E.templateName.textContent='Файл не выбран';setStatus('sales','empty','Не загружен');setStatus('template','empty','Не загружен');E.reportSection?.classList.add('hidden');if(E.parseLog)E.parseLog.textContent='Ожидаю загрузку файлов.';if(E.printBtn)E.printBtn.disabled=true;updateReady()});
setStatus('sales','empty','Не загружен');setStatus('template','empty','Не загружен');updateReady();
})();

(()=>{
  const style=document.createElement('style');
  style.id='analytics-readability-v1';
  style.textContent=`
    .report-shell{width:min(1800px,calc(100vw - 24px))!important}
    .analytics-onepage{padding:34px 36px 28px!important}
    .analytics-head{margin-bottom:22px!important}
    .analytics-head h2{font-size:36px!important;line-height:1.05!important}
    .analytics-subtitle{font-size:16px!important;line-height:1.4!important;margin-top:9px!important;color:#667085!important}
    .analytics-data-date{font-size:13px!important;color:#667085!important}
    .analytics-filterbar{margin-bottom:20px!important}
    .analytics-filter-label{font-size:11px!important}
    .period-chip,.source-pill{height:38px!important;padding:0 15px!important;font-size:14px!important}
    .period-range{font-size:13px!important;color:#667085!important}
    .analytics-kpi-grid{gap:14px!important;margin-bottom:22px!important}
    .analytics-kpi{min-height:132px!important;padding:18px 18px!important;border-radius:12px!important}
    .analytics-kpi-label{font-size:12px!important;line-height:1.35!important;min-height:32px!important;color:#667085!important;font-weight:700!important}
    .analytics-kpi-value{font-size:36px!important;margin-top:10px!important}
    .analytics-kpi-note{font-size:12px!important;margin-top:11px!important;color:#667085!important;line-height:1.35!important}
    .analytics-section{margin-top:16px!important}
    .analytics-section-title{height:54px!important;padding:0 18px!important;font-size:15px!important;letter-spacing:.15px!important}
    .analytics-table{font-size:13px!important;min-width:1180px!important}
    .analytics-table th{height:52px!important;padding:0 12px!important;font-size:13px!important;color:#475467!important;font-weight:700!important}
    .analytics-table td{height:50px!important;padding:0 12px!important;font-size:13px!important;color:#344054!important}
    .analytics-table .dash-label{font-size:14px!important;font-weight:600!important;color:#101828!important}
    .analytics-table .dash-num,.analytics-table .dash-total{font-size:14px!important}
    .analytics-table .dash-total{font-weight:700!important}
    .distribution-table{min-width:1280px!important}
    .distribution-table th:nth-child(1),.distribution-table td:nth-child(1){width:13%!important}
    .distribution-table th:nth-child(2),.distribution-table td:nth-child(2){width:31%!important}
    .distribution-table th:nth-child(3),.distribution-table td:nth-child(3){width:11%!important}
    .layer-summary td{height:54px!important}
    .layer-name strong{font-size:14px!important;color:#101828!important}
    .project-name strong{font-size:13px!important;line-height:1.3!important;color:#101828!important}
    .layer-name small,.project-name small{font-size:11px!important;line-height:1.3!important;margin-top:4px!important;color:#667085!important}
    .client-detail td{height:48px!important}
    .client-detail .project-name{padding-left:18px!important}
    .grand-total td{height:56px!important}
    .analytics-footnote{font-size:11px!important;padding-top:13px!important;color:#667085!important}
    @media(max-width:1200px){
      .analytics-onepage{padding:26px 22px 22px!important}
      .analytics-head h2{font-size:32px!important}
      .analytics-subtitle{font-size:15px!important}
      .analytics-kpi-grid{grid-template-columns:repeat(3,1fr)!important}
      .analytics-kpi-label{font-size:12px!important}
      .analytics-kpi-value{font-size:32px!important}
      .analytics-table{font-size:13px!important;min-width:1180px!important}
    }
    @media(max-width:850px){
      .analytics-kpi-grid{grid-template-columns:repeat(2,1fr)!important}
      .analytics-head h2{font-size:30px!important}
      .analytics-table-wrap{overflow-x:auto!important}
    }
  `;
  document.head.appendChild(style);
})();