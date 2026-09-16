(()=>{'use strict';
const $=id=>document.getElementById(id);
const cmmtFile=$('cmmtFile'),cmmtName=$('cmmtName'),cmmtCard=$('cmmtCard'),ready=$('readyBadge'),build=$('buildBtn'),sourceCount=$('sourceCount'),parseLog=$('parseLog'),reset=$('resetBtn');
const required=['salesFile','productionFile','cmmtFile','requirementsFile'];
let cmmtMeta=null;
function getFile(id){return $(id)?.files?.[0]||null}
function count(){return required.reduce((s,id)=>s+(getFile(id)?1:0),0)}
function update(){const c=count();if(ready){ready.textContent=`${c} / 4`;ready.classList.toggle('complete',c===4)}if(build)build.disabled=c!==4;if(sourceCount&&c===4)sourceCount.textContent='4/4'}
function summarizeWorkbook(file){return file.arrayBuffer().then(buf=>{const wb=XLSX.read(buf,{type:'array',cellDates:true});let nonEmpty=0,maxRows=0;wb.SheetNames.forEach(name=>{const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});const useful=rows.filter(r=>(r||[]).some(v=>v!==null&&String(v).trim()!=='')).length;nonEmpty+=useful;maxRows=Math.max(maxRows,useful)});return{fileName:file.name,sheets:wb.SheetNames.length,rows:nonEmpty,maxRows}})}
if(cmmtFile){cmmtFile.addEventListener('change',async()=>{const f=cmmtFile.files?.[0]||null;cmmtMeta=null;if(f){cmmtName.textContent=f.name;cmmtCard.classList.add('loaded');try{cmmtMeta=await summarizeWorkbook(f);if(parseLog)parseLog.textContent=`План СММТ загружен: ${cmmtMeta.sheets} лист(а), ${cmmtMeta.rows} непустых строк. Готов к сверке.`}catch(err){cmmtCard.classList.remove('loaded');cmmtName.textContent='Ошибка чтения файла';if(parseLog)parseLog.textContent=`Не удалось прочитать План СММТ: ${err.message||err}`;cmmtFile.value=''}}else{cmmtName.textContent='Выберите файл';cmmtCard.classList.remove('loaded')}update()})}
['salesFile','productionFile','requirementsFile'].forEach(id=>$(id)?.addEventListener('change',()=>setTimeout(update,0)));
if(build){build.addEventListener('click',e=>{if(count()!==4){e.preventDefault();e.stopImmediatePropagation();if(parseLog)parseLog.textContent='Для формирования One Page загрузите все 4 файла, включая План СММТ.';update()}else{setTimeout(()=>{if(sourceCount)sourceCount.textContent='4/4';if(parseLog&&cmmtMeta)parseLog.textContent=`Использованы 4 источника. План СММТ: ${cmmtMeta.sheets} лист(а), ${cmmtMeta.rows} строк.`},0)}},true)}
if(sourceCount){new MutationObserver(()=>{if(count()===4&&sourceCount.textContent!=='4/4')sourceCount.textContent='4/4'}).observe(sourceCount,{childList:true,characterData:true,subtree:true})}
if(reset){reset.addEventListener('click',()=>setTimeout(()=>{if(cmmtFile)cmmtFile.value='';cmmtMeta=null;if(cmmtName)cmmtName.textContent='Выберите файл';cmmtCard?.classList.remove('loaded');update()},0))}
update();
})();