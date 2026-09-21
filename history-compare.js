
(()=>{
'use strict';

const CLOUD_BUCKET='plan-source-files';
const PERIOD_KEY='atom-period-filter-v2';
const RANGE_KEY='atom-history-compare-range-v1';
const REGISTRY_PREFIX='registry__';
const MONTHS=['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const PERIODS={
  all:MONTHS,
  H1:['Янв','Фев','Мар','Апр','Май','Июн'],
  H2:['Июл','Авг','Сен','Окт','Ноя','Дек']
};
const RANGE_INFO={
  week:{label:'Неделя',days:7},
  twoWeeks:{label:'2 недели',days:14},
  month:{label:'Месяц',months:1}
};
const KPI_METRICS={
  'План производства':'production',
  'План отгрузки':'shipPlan',
  'Отгружено автомобилей':'shipped',
  'Забронировано клиентами':'booked',
  'Свободный сток':'free'
};

let client=window.ATOMSupabase||null;
let user=window.ATOMAuthUser||null;
let selectedRange=loadRange();
let listCache={at:0,items:[]};
const modelCache=new Map();
let requestId=0;
let renderTimer=null;

function loadRange(){
  try{
    const value=localStorage.getItem(RANGE_KEY);
    return RANGE_INFO[value]?value:'week';
  }catch{return'week'}
}
function saveRange(){
  try{localStorage.setItem(RANGE_KEY,selectedRange)}catch{}
}
function n(v){return String(v==null?'':v).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
function normalizeSource(value){
  return n(value).replace(/\s+/g,'_').replace(/_+/g,'_').toUpperCase();
}
function decodeText(text){
  try{
    let s=String(text||'').replace(/-/g,'+').replace(/_/g,'/');
    while(s.length%4)s+='=';
    const bin=atob(s);
    const bytes=Uint8Array.from(bin,function(c){return c.charCodeAt(0)});
    return new TextDecoder().decode(bytes);
  }catch{return'ИСТОЧНИК'}
}
function parseRegistryItem(item){
  const name=String(item&&item.name||'');
  const m=name.match(/^registry__(\d+)__(.+?)__(\d{4}-\d{2}-\d{2})__(.+)$/);
  if(!m)return null;
  return{
    storageName:name,
    path:(user&&user.id?user.id+'/':'')+name,
    createdAt:Number(m[1])||0,
    source:decodeText(m[2]),
    actualDate:m[3],
    originalName:m[4],
    updatedAt:item.updated_at||item.created_at||''
  };
}
function parseIsoDate(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return Number.isNaN(d.getTime())?null:d;
}
function parseRuDate(value){
  const m=String(value||'').match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(!m)return null;
  const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  return Number.isNaN(d.getTime())?null:d;
}
function formatRuDate(value){
  const d=value instanceof Date?value:parseIsoDate(value);
  if(!d)return'';
  return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
}
function currentAnchor(){
  const model=window.ATOMCurrentModel;
  const fromModel=parseRuDate(model&&model.sourceDate);
  const d=fromModel||new Date();
  return new Date(d.getFullYear(),d.getMonth(),d.getDate());
}
function targetFor(rangeKey){
  const anchor=currentAnchor();
  const info=RANGE_INFO[rangeKey]||RANGE_INFO.week;
  if(info.months){
    const day=anchor.getDate();
    const target=new Date(anchor.getFullYear(),anchor.getMonth()-info.months,1);
    const lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();
    target.setDate(Math.min(day,lastDay));
    return target;
  }
  const target=new Date(anchor);
  target.setDate(target.getDate()-Number(info.days||0));
  return target;
}
function logicalName(entry){
  return normalizeSource(entry.source)+'_'+formatRuDate(entry.actualDate);
}
function isExcel(entry){
  return /\.(xlsx|xlsm|xls)$/i.test(entry.originalName||'');
}
function isPlanLike(entry){
  const hay=(entry.source||'')+' '+(entry.originalName||'');
  return /штаб|sales|s&op|план[\s_-]*продаж|sales[\s_-]*plan/i.test(hay);
}
function chooseBaseline(items,rangeKey){
  const anchor=currentAnchor();
  const target=targetFor(rangeKey);
  const excel=(items||[]).filter(isExcel).filter(function(x){
    const d=parseIsoDate(x.actualDate);
    return d&&d<anchor;
  });
  const shtab=excel.filter(function(x){return normalizeSource(x.source)==='ШТАБ'});
  const planLike=excel.filter(isPlanLike);
  const pool=shtab.length?shtab:(planLike.length?planLike:excel);
  const eligible=pool.filter(function(x){
    const d=parseIsoDate(x.actualDate);
    return d&&d<=target;
  });
  eligible.sort(function(a,b){
    const da=parseIsoDate(a.actualDate).getTime();
    const db=parseIsoDate(b.actualDate).getTime();
    return db-da||(b.createdAt||0)-(a.createdAt||0);
  });
  return{entry:eligible[0]||null,target:target};
}
async function listRegistry(force){
  if(!client||!user||!user.id)return[];
  if(!force&&Date.now()-listCache.at<30000)return listCache.items;
  const result=await client.storage.from(CLOUD_BUCKET).list(user.id,{limit:100,sortBy:{column:'updated_at',order:'desc'}});
  if(result.error)throw result.error;
  const items=(result.data||[]).map(parseRegistryItem).filter(Boolean);
  listCache={at:Date.now(),items:items};
  return items;
}
function loadPeriod(){
  const def={mode:'half',key:new Date().getMonth()<6?'H1':'H2'};
  try{
    const saved=Object.assign({},def,JSON.parse(localStorage.getItem(PERIOD_KEY)||'{}'));
    if(saved.mode!=='all'&&saved.mode!=='half')saved.mode='half';
    if(saved.key!=='H1'&&saved.key!=='H2')saved.key=def.key;
    return saved;
  }catch{return def}
}
function metricTotal(metric){
  if(!metric||!metric.found)return null;
  const p=loadPeriod();
  if(p.mode==='all'){
    if(metric.yearFound)return Number(metric.year||0);
    return MONTHS.reduce(function(sum,m){return sum+Number(metric.months&&metric.months[m]||0)},0);
  }
  const months=PERIODS[p.key]||PERIODS.H2;
  return months.reduce(function(sum,m){return sum+Number(metric.months&&metric.months[m]||0)},0);
}
function fmt(value){
  return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(value||0));
}
function signedFmt(value){
  const v=Math.round(Number(value||0));
  if(v>0)return'+'+fmt(v);
  if(v<0)return'-'+fmt(Math.abs(v));
  return'0';
}
function ensureXLSX(){
  if(window.XLSX)return Promise.resolve();
  return new Promise(function(resolve,reject){
    const existing=document.querySelector('script[data-history-xlsx]');
    if(existing){
      existing.addEventListener('load',function(){resolve()},{once:true});
      existing.addEventListener('error',function(){reject(new Error('Не удалось загрузить модуль Excel.'))},{once:true});
      return;
    }
    const s=document.createElement('script');
    s.dataset.historyXlsx='1';
    s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload=function(){resolve()};
    s.onerror=function(){reject(new Error('Не удалось загрузить модуль Excel.'))};
    document.head.appendChild(s);
  });
}
async function baselineModel(entry){
  if(modelCache.has(entry.path))return modelCache.get(entry.path);
  const promise=(async function(){
    await ensureXLSX();
    if(!window.ATOMTemplateView||!window.ATOMTemplateView.parseWorkbook)throw new Error('Парсер S&OP09 plan недоступен.');
    const result=await client.storage.from(CLOUD_BUCKET).download(entry.path);
    if(result.error)throw result.error;
    const buf=await result.data.arrayBuffer();
    return window.ATOMTemplateView.parseWorkbook(buf);
  })();
  modelCache.set(entry.path,promise);
  try{return await promise}catch(e){modelCache.delete(entry.path);throw e}
}
function ensureControls(){
  const one=document.getElementById('onePage');
  const bar=one&&one.querySelector('.analytics-filterbar');
  if(!bar)return null;
  let group=bar.querySelector('.history-compare-group');
  if(!group){
    group=document.createElement('div');
    group.className='analytics-filter-group history-compare-group';

    const label=document.createElement('span');
    label.className='analytics-filter-label';
    label.textContent='ИЗМЕНЕНИЕ';

    const tabs=document.createElement('div');
    tabs.className='history-range-tabs';

    Object.keys(RANGE_INFO).forEach(function(key){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='history-range-btn';
      btn.dataset.historyRange=key;
      btn.textContent=RANGE_INFO[key].label;
      btn.addEventListener('click',function(){
        if(selectedRange===key)return;
        selectedRange=key;
        saveRange();
        renderCompare(true);
      });
      tabs.appendChild(btn);
    });

    const base=document.createElement('span');
    base.className='history-compare-base';
    base.dataset.historyBase='1';
    base.textContent='История...';

    group.append(label,tabs,base);
    bar.appendChild(group);
  }
  group.querySelectorAll('[data-history-range]').forEach(function(btn){
    btn.classList.toggle('active',btn.dataset.historyRange===selectedRange);
  });
  return group;
}
function baseBadge(){
  const group=ensureControls();
  return group&&group.querySelector('[data-history-base]');
}
function setBase(text,state,title){
  const el=baseBadge();
  if(!el)return;
  el.textContent=text;
  el.title=title||text;
  el.className='history-compare-base'+(state?' '+state:'');
}
function ensureDelta(card){
  let main=card.querySelector('.history-kpi-main');
  if(!main){
    const value=card.querySelector('.analytics-kpi-value');
    if(!value)return null;
    main=document.createElement('div');
    main.className='history-kpi-main';
    value.parentNode.insertBefore(main,value);
    main.appendChild(value);
    const delta=document.createElement('span');
    delta.className='history-delta muted';
    delta.dataset.historyDelta='1';
    main.appendChild(delta);
    card.classList.add('history-has-delta');
  }
  return main.querySelector('[data-history-delta]');
}
function setAllDeltas(state,text){
  document.querySelectorAll('#onePage .analytics-kpi').forEach(function(card){
    const label=n(card.querySelector('.analytics-kpi-label')&&card.querySelector('.analytics-kpi-label').textContent);
    if(!KPI_METRICS[label])return;
    const delta=ensureDelta(card);
    if(!delta)return;
    delta.className='history-delta '+(state||'muted');
    delta.textContent=text||'';
  });
}
function applyDeltas(historyModel){
  const current=window.ATOMCurrentModel;
  document.querySelectorAll('#onePage .analytics-kpi').forEach(function(card){
    const label=n(card.querySelector('.analytics-kpi-label')&&card.querySelector('.analytics-kpi-label').textContent);
    const key=KPI_METRICS[label];
    if(!key)return;
    const deltaEl=ensureDelta(card);
    if(!deltaEl)return;
    const currentValue=metricTotal(current&&current.metrics&&current.metrics[key]);
    const oldValue=metricTotal(historyModel&&historyModel.metrics&&historyModel.metrics[key]);
    if(currentValue===null||oldValue===null){
      deltaEl.className='history-delta muted';
      deltaEl.textContent='нет данных';
      return;
    }
    const diff=currentValue-oldValue;
    deltaEl.replaceChildren();
    const arrow=document.createElement('span');
    arrow.className='history-delta-arrow';
    arrow.textContent=diff>0?'▲':diff<0?'▼':'•';
    const value=document.createElement('span');
    value.className='history-delta-value';
    value.textContent=signedFmt(diff);
    deltaEl.className='history-delta '+(diff>0?'up':diff<0?'down':'flat');
    deltaEl.append(arrow,value);
    deltaEl.title='Было: '+fmt(oldValue)+'. Сейчас: '+fmt(currentValue)+'. Изменение: '+signedFmt(diff)+'.';
  });
}
async function renderCompare(forceList){
  clearTimeout(renderTimer);
  const one=document.getElementById('onePage');
  if(!one||!one.querySelector('.analytics-kpi-grid')||!window.ATOMCurrentModel)return;

  ensureControls();
  if(!client||!user||!user.id){
    setBase('Подключение истории...','');
    setAllDeltas('muted','...');
    return;
  }

  const myRequest=++requestId;
  setBase('Ищу файл...','');
  setAllDeltas('muted','...');

  try{
    const items=await listRegistry(Boolean(forceList));
    if(myRequest!==requestId)return;
    const pick=chooseBaseline(items,selectedRange);
    if(!pick.entry){
      setBase('Нет файла до '+formatRuDate(pick.target),'missing','В источниках нет подходящего Excel-файла на эту дату или раньше.');
      setAllDeltas('muted','нет файла для сравнения');
      return;
    }

    setBase('Сравнение с '+logicalName(pick.entry),'','Файл: '+pick.entry.originalName);
    const historical=await baselineModel(pick.entry);
    if(myRequest!==requestId)return;
    setBase('к '+logicalName(pick.entry),'ready','Файл: '+pick.entry.originalName);
    applyDeltas(historical);
  }catch(e){
    console.error('History comparison failed',e);
    if(myRequest!==requestId)return;
    setBase('Ошибка истории','error',String(e&&e.message||e));
    setAllDeltas('muted','ошибка');
  }
}
function scheduleRender(force){
  clearTimeout(renderTimer);
  renderTimer=setTimeout(function(){renderCompare(Boolean(force))},40);
}

document.addEventListener('atom-auth-ready',function(e){
  client=e.detail&&e.detail.client||window.ATOMSupabase||client;
  user=e.detail&&e.detail.user||window.ATOMAuthUser||user;
  listCache={at:0,items:[]};
  scheduleRender(true);
});

const onePage=document.getElementById('onePage');
if(onePage){
  const observer=new MutationObserver(function(){scheduleRender(false)});
  observer.observe(onePage,{childList:true});
}

document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'){
    listCache={at:0,items:[]};
    scheduleRender(true);
  }
});

scheduleRender(false);
})();
