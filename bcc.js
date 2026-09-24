const API='https://ytdacypygsfalkixhemj.supabase.co/functions/v1/commercial-analytics-api';
const PREFIX='atom-bcc-main-';
const K={
  start:PREFIX+'started-at',
  stages:PREFIX+'stage-statuses',
  teams:PREFIX+'team-owners',
  modules:PREFIX+'module-statuses',
  blockers:PREFIX+'blockers',
  dod:PREFIX+'dod',
  deadlines:PREFIX+'stage-deadlines'
};
const WEEKLY_TASKS_KEY='atom-weekly-review-tasks-v02-hq-only';
const DELETED_TASKS_KEY='atom-weekly-review-deleted-v02-hq-only';
const B2B_TEAM_KEY='atom-bcc-b2b-team-v02';
const CLOUD_KEYS=[...Object.values(K),WEEKLY_TASKS_KEY,DELETED_TASKS_KEY,B2B_TEAM_KEY];
const LOCAL_META_KEY='atom-bcc-local-meta-v03';

const STAGE_STATUSES=['Не начато','Подготовка','В работе','Ожидание','На согласовании','Блокер','Завершено'];
const MODULE_STATUSES=['Не начато','Проектирование','Разработка','Тестирование','Пилот','Готово','Блокер'];
const BLOCKER_STATUSES=['Открыт','В работе','Ожидаем ответ','На эскалации','Решен','Закрыт'];
const TASK_STATUSES=['Не начато','Новая','В работе','На контроле','Блокер','Готово','Отложено'];
const SEVERITY=['Низкая','Средняя','Высокая','Критическая'];
const PROGRESS={
  'Не начато':0,'Подготовка':10,'Проектирование':20,'В работе':45,'Разработка':45,
  'Ожидание':50,'На согласовании':70,'Тестирование':70,'Пилот':85,'Блокер':50,
  'Завершено':100,'Готово':100
};

const DATA={
  goal:'Внедрить единый Business Control Center, в котором руководство и владельцы процессов видят проекты, задачи, встречи, KPI, решения, блокеры и статус исполнения в одном рабочем контуре.',
  stages:[
    {id:'1',name:'Цели, границы и владелец BCC',start:0,end:7,team:'Коммерческий блок'},
    {id:'2',name:'Роли пользователей и RACI',start:0,end:14,team:'Коммерческий блок'},
    {id:'3',name:'Справочники и единая модель статусов',start:7,end:21,team:'IT / разработка'},
    {id:'4',name:'Портфель проектов и инициатив',start:14,end:28,team:'Коммерческий блок'},
    {id:'5',name:'Задачи, сроки и контроль исполнения',start:21,end:35,team:'IT / разработка'},
    {id:'6',name:'Встречи, решения и обязательства',start:28,end:42,team:'Руководители направлений'},
    {id:'7',name:'KPI и управленческие показатели',start:35,end:49,team:'DATA / BI'},
    {id:'8',name:'Блокеры и эскалации',start:42,end:56,team:'Коммерческий блок'},
    {id:'9',name:'Еженедельная управленческая отчетность',start:42,end:63,team:'DATA / BI'},
    {id:'10',name:'Облачная синхронизация и права доступа',start:49,end:70,team:'IT / разработка'},
    {id:'11',name:'Пилот с рабочими командами',start:63,end:84,team:'Руководители направлений'},
    {id:'12',name:'Приемка и переход в рабочий контур',start:84,end:90,team:'Коммерческий блок'}
  ],
  teams:[
    ['Коммерческий блок','A','Приоритеты, KPI, управленческие решения'],
    ['Корпоративные продажи','R/C','Проекты, задачи, фактическое исполнение'],
    ['Маркетинг','R/C','Инициативы, лиды, активности и KPI'],
    ['IT / разработка','R','Архитектура, интеграции, развитие BCC'],
    ['DATA / BI','C/R','Показатели, источники данных, витрины'],
    ['1С / Финансы','C','Финансовые факты и управленческие показатели'],
    ['Информационная безопасность','C/A','Доступы, требования ИБ, допуск в рабочий контур'],
    ['Руководители направлений','R','Актуальность задач, статусов, сроков и решений']
  ],
  modules:[
    ['Проекты','Портфель инициатив, владелец, сроки, готовность'],
    ['Мои задачи','Исполнение, срок, приоритет, просрочка'],
    ['Встречи','Адженда, решения, обязательства, контроль следующей встречи'],
    ['KPI','План, факт, прогноз и отклонения'],
    ['Блокеры','Проблемы, критичность, владелец, срок снятия'],
    ['Решения','Вопросы, которые требуют решения руководителя'],
    ['Команды и RACI','Ответственные и зоны ответственности'],
    ['Отчеты','Недельная сводка: сделано, план, риски, решения'],
    ['Справочники','Управление статусами, ролями, приоритетами и командами'],
    ['Права доступа','Ролевой доступ и разделение видимости данных'],
    ['Облачная синхронизация','Единое состояние между устройствами и пользователями']
  ],
  dod:[
    ['Структура BCC утверждена','Согласованы основные разделы и логика навигации'],
    ['Роли и права доступа определены','Понятно, кто что видит и кто что изменяет'],
    ['Проекты и задачи работают','Проверяется автоматически по статусам модулей «Проекты» и «Мои задачи»'],
    ['Встречи связаны с обязательствами','Проверяется автоматически по статусу модуля «Встречи»'],
    ['KPI имеют план и факт','Проверяется автоматически по статусу модуля «KPI»'],
    ['Блокеры и эскалации работают','Проверяется автоматически по статусу модуля «Блокеры»'],
    ['Справочники редактируются','Проверяется автоматически по статусу модуля «Справочники»'],
    ['Права и синхронизация проверены','Проверяется автоматически по модулям «Права доступа» и «Облачная синхронизация»'],
    ['Пилот проведен минимум на 2 командах','Собрана обратная связь реальных пользователей'],
    ['ИБ дала допуск в рабочий контур','Нет критических замечаний по хранению и доступам'],
    ['Еженедельный отчет формируется из BCC','Проверяется автоматически по статусу модуля «Отчеты»'],
    ['Приемка завершена','Коммерческий директор и владельцы процессов приняли систему']
  ]
};

const AUTO_DOD={
  2:()=>moduleStatus(0)==='Готово'&&moduleStatus(1)==='Готово',
  3:()=>moduleStatus(2)==='Готово',
  4:()=>moduleStatus(3)==='Готово',
  5:()=>moduleStatus(4)==='Готово',
  6:()=>moduleStatus(8)==='Готово',
  7:()=>moduleStatus(9)==='Готово'&&moduleStatus(10)==='Готово',
  10:()=>moduleStatus(7)==='Готово'
};

const app=document.getElementById('app');
const BCC_VIEWS=['overview','tasks','gantt','team','issues'];
function viewFromHash(){
  const view=location.hash.replace(/^#/,'');
  return BCC_VIEWS.includes(view)?view:'tasks';
}
let currentView=viewFromHash();
let taskEditorOpen=false;
let clockTimer=null;
let syncTimer=null;
let hydrated=false;
let pushing=false;
const pendingKeys=new Set();
const ganttColumnState={vertical:false,source:false,owner:false};

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
const meta=()=>load(LOCAL_META_KEY,{});
const setMeta=(key,ts)=>{const m=meta();m[key]=ts;localStorage.setItem(LOCAL_META_KEY,JSON.stringify(m));};
const localTs=key=>meta()[key]||'';
const nowIso=()=>new Date().toISOString();
function updateBuildTimestamp(){
  const el=document.getElementById('buildUpdatedAt');
  if(!el)return;
  const d=new Date(document.lastModified);
  if(Number.isNaN(d.getTime())){el.textContent='—';return;}
  el.textContent=new Intl.DateTimeFormat('ru-RU',{
    day:'2-digit',month:'2-digit',year:'numeric',
    hour:'2-digit',minute:'2-digit'
  }).format(d).replace(',','');
}

function saveJson(key,value){
  const ts=nowIso();
  localStorage.setItem(key,JSON.stringify(value));
  setMeta(key,ts);
  pendingKeys.add(key);
  scheduleSync();
}
function saveRaw(key,value){
  const ts=nowIso();
  localStorage.setItem(key,String(value));
  setMeta(key,ts);
  pendingKeys.add(key);
  scheduleSync();
}
function setFromRemote(key,value,updatedAt){
  localStorage.setItem(key,value);
  setMeta(key,updatedAt||nowIso());
}

const started=()=>Boolean(localStorage.getItem(K.start));
const stageStatuses=()=>load(K.stages,{});
const teamOwners=()=>load(K.teams,{});
const moduleStatuses=()=>load(K.modules,{});
const blockers=()=>load(K.blockers,[]);
const dodManual=()=>load(K.dod,{});
const deadlineOverrides=()=>load(K.deadlines,{});
const weeklyTasks=()=>load(WEEKLY_TASKS_KEY,[]);
const deletedTaskIds=()=>load(DELETED_TASKS_KEY,[]);
const b2bTeam=()=>load(B2B_TEAM_KEY,[]);
const saveLocalJson=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const saveSharedJson=(key,value)=>saveJson(key,value);
const B2B_TEAM_STATUSES=['Активен','Отпуск','Пауза'];
const B2B_TEAM_ROLES=['Админ','Пользователь'];
const DEFAULT_B2B_TEAM=[
  {id:'tm-kostylev',name:'Александр Костылев',email:'aleksander.kostylev@atom.team',role:'Админ',status:'Активен'},
  {id:'tm-korytnik',name:'Иван Корытник',email:'ivan.korytnik@atom.team',role:'Админ',status:'Активен'},
  {id:'tm-voronkevich',name:'Виталий Воронкевич',email:'vitaly.voronkevich@atom.team',role:'Пользователь',status:'Активен'},
  {id:'tm-lisitsyn',name:'Алексей Лисицын',email:'aleksei.lisitsyn@atom.team',role:'Пользователь',status:'Активен'},
  {id:'tm-kosylev',name:'Михаил Косылев',email:'mikhail.kiselyov@atom.team',role:'Пользователь',status:'Активен'}
];
function ensureB2BTeam(){
  if(localStorage.getItem(B2B_TEAM_KEY)!==null)return false;
  saveLocalJson(B2B_TEAM_KEY,DEFAULT_B2B_TEAM);
  return true;
}
function taskAssignedToMember(t,m){
  const owner=String(t.owner||'').toLocaleLowerCase('ru-RU');
  const full=String(m.name||'').trim().toLocaleLowerCase('ru-RU');
  if(!owner||!full)return false;
  if(owner===full)return true;
  const first=full.split(/\s+/)[0];
  return first.length>2&&owner.includes(first);
}

// 23.09.2026: источник задач - Google Sheet "Sales & Marketing Штаб - контроль решений".
// Загружаются только строки, где в колонке "Признак" указано "Штаб_39".
const WEEKLY_REVIEW_TAG='Штаб_39';
const WEEKLY_HQ_CODE='WEEK_392026';
const WEEKLY_START_DATE='2026-09-21';
const WEEKLY_DUE_DATE='2026-09-28';
const SOURCE_WEEKLY_TASKS=[
  ["GSH-24",1,"Дополнительные задачи","Актуализировать 113 компаний в Альфа, с которыми работала предыдущая команда","Все 113 компаний проверены. По каждой принято решение: LOST или продолжить работу. Для продолжаемых проектов указан актуальный этап","Алексей","Не начато","Срок/период: В работу. Решение встречи 23.09.2026. На встрече озвучено около 112 компаний; в текущей задаче ранее зафиксировано 113."],
  ["GSH-25",2,"Дополнительные задачи","Разобрать 100 лидов в ЭЛМА, сгенерированных ИИ","По всем 100 лидам принято решение: закрыть как дисквалифицированные либо провести квалификацию. Статусы в ЭЛМА обновлены","Алексей","Не начато","Срок/период: В работу. Решение встречи 23.09.2026. Подтвержден приоритет обработки текущего массива около 100 лидов."],
  ["GSH-27",3,"B2B / бронирование","Настроить единый процесс Soft / Hard booking","В одной схеме зафиксированы Soft booking на этапе КП и Hard booking после договора; видны количество, даты, срок действия Soft booking, плановая дата выдачи, текущий статус и свободный остаток.","Иван","Не начато","Срок/период: Приоритетно. Решение встречи 23.09.2026."],
  ["GSH-28",4,"B2B / бронирование","Сделать прозрачный контроль изменений бронирования","Иван, B2B, Autosales и другие участники процесса одновременно видят реальный резерв, предварительный резерв, свободный сток и план выдач; изменения бронирования прослеживаются.","Иван","Не начато","Срок/период: Приоритетно. Решение встречи 23.09.2026."],
  ["GSH-29",5,"B2B / бронирование","Автоматизировать уведомления о завершении Soft booking","Менеджер получает уведомление об окончании срока Soft booking и подтверждает либо снимает резерв.","Иван / команда","Не начато","Срок/период: Следующий этап. Решение встречи 23.09.2026."],
  ["GSH-30",6,"B2B / лиды и воронка","Начать с горячих лидов из ELMA / сайта","Горячие входящие лиды из ELMA / сайта разобраны в первую очередь; по каждому зафиксированы результат и следующий шаг.","Алексей","Не начато","Срок/период: Сразу. Решение встречи 23.09.2026."],
  ["GSH-31",7,"B2B / лиды и воронка","Настроить понятное распределение лидов по вертикалям","Для каждого лида определена вертикаль по модели использования автомобиля и назначен ответственный.","Команда","Не начато","Срок/период: Приоритетно. Решение встречи 23.09.2026."],
  ["GSH-32",8,"B2B / лиды и воронка","Переносить в CMT только реальные коммерческие проекты","В CMT попадают только компании с реальным коммерческим проектом и потенциальной закупкой автомобилей; неподтвержденные идеи остаются лидами / гипотезами.","Команда","Не начато","Срок/период: Постоянно. Решение встречи 23.09.2026."],
  ["GSH-33",9,"B2B / отчетность","Обеспечивать показатели по лидам к понедельнику","К утру понедельника доступны: получено лидов, обработано, результат, а также конверсия до реальных проектов, сделок и объема автомобилей.","Иван / Алексей","Не начато","Срок/период: Еженедельно, к понедельнику. Решение встречи 23.09.2026."],
  ["GSH-34",10,"B2B / команда","Не принимать решение о дополнительных sales без фактической конверсии","Решение об увеличении команды принимается только после расчета фактической конверсии по текущей базе.","Команда","Не начато","Срок/период: После обработки текущей базы. Решение встречи 23.09.2026."],
  ["GSH-35",11,"B2B / проекты","Прорабатывать крупные реальные проекты после квалификации","После квалификации крупный реальный проект передан Михаилу / команде и по нему зафиксирован следующий шаг.","Михаил / команда","Не начато","Срок/период: Постоянно. Решение встречи 23.09.2026."],
  ["GSH-36",12,"Омар (Авеню) / финмодель","Зафиксировать финансовую модель компенсации Омар (Авеню)","Зафиксированы целевая выручка, фактическая выручка, формула компенсации, периодичность получения факта и механизм расчетов.","Команда проекта Омар (Авеню)","Не начато","Срок/период: В работу. Решение встречи 23.09.2026."],
  ["GSH-37",13,"Омар (Авеню) / договор","Проработать договор Омар (Авеню) ↔ АТОМ","Согласована договорная конструкция АТОМ ↔ Омар (Авеню) с моделью компенсации недополученной выручки и параметрами расчетов.","Команда проекта","Не начато","Срок/период: В работу. Решение встречи 23.09.2026."],
  ["GSH-38",14,"Яндекс Драйв / промокоды","Проработать механику АТОМ ↔ Яндекс Драйв по промокодам","Определены выпуск и учет использованных промокодов, идентификация клиента и связи с ATOM ID, ELMA, Альфа-Авто и другими системами; оплачиваются фактически использованные промокоды.","Команда проекта","Не начато","Срок/период: В работу. Решение встречи 23.09.2026."],
  ["GSH-39",15,"Омар (Авеню) / Яндекс Драйв","Проработать юридическую конструкцию Омар (Авеню) и Яндекс Драйв","Юридическая схема Омар (Авеню) и Яндекс Драйв согласована с Юлией Рябчиковой и командой.","Юлия Рябчикова / команда","Не начато","Срок/период: В работу. Решение встречи 23.09.2026."],
  ["GSH-40",16,"Омар (Авеню) / отчетность","Определить источник фактической выручки автомобилей Омар (Авеню)","Определены источник, периодичность и ответственный за получение фактической выручки автомобилей Омар (Авеню).","Команда","Не начато","Срок/период: В работу. Решение встречи 23.09.2026."]
];

// Удаляем прежний набор задач v01. Новый ключ гарантирует чистую загрузку только штабных задач.
localStorage.removeItem('atom-weekly-review-tasks-v01');
localStorage.removeItem('atom-weekly-review-deleted-v01');

function ensureWeeklyTasks(sync=false){
  const list=weeklyTasks();
  const before=JSON.stringify(list);
  list.forEach(t=>{
    ['block','title','result','owner','comment'].forEach(key=>{
      if(typeof t[key]==='string')t[key]=t[key].replace(/AMAR/g,'Омар (Авеню)');
    });
  });
  const deleted=new Set(deletedTaskIds());
  SOURCE_WEEKLY_TASKS.forEach(r=>{
    const [sourceId,number,block,title,criterion,sourceOwner,sourceStatus,sourceComment]=r;
    if(deleted.has(sourceId))return;
    let t=list.find(x=>x.sourceId===sourceId||String(x.title||'').trim()===title);
    if(t){
      t.sourceId=t.sourceId||sourceId;
      if(t.number==null)t.number=number;
      t.block=t.block||block;
      t.result=t.result||criterion;
      t.owner=t.owner||sourceOwner;
      t.status=t.status||sourceStatus||'Не начато';
      t.comment=t.comment||sourceComment||'';
      t.reviewTag=t.reviewTag||WEEKLY_REVIEW_TAG;
      t.project=t.project||WEEKLY_HQ_CODE;
      t.startDate=t.startDate||WEEKLY_START_DATE;
      t.dueDate=t.dueDate||WEEKLY_DUE_DATE;
      if(!t.vertical)t.vertical='Все вертикали';
    }else{
      list.push({
        id:'t-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
        sourceId,number,block,vertical:'Все вертикали',project:WEEKLY_HQ_CODE,title,owner:sourceOwner,
        status:sourceStatus||'Не начато',priority:'Средний',progress:0,reviewTag:WEEKLY_REVIEW_TAG,
        startDate:WEEKLY_START_DATE,dueDate:WEEKLY_DUE_DATE,
        result:criterion,comment:sourceComment||'',createdAt:nowIso(),updatedAt:nowIso()
      });
    }
  });
  list.sort((a,b)=>(a.number||9999)-(b.number||9999));
  const changed=before!==JSON.stringify(list);
  if(changed){
    (sync?saveSharedJson:saveLocalJson)(WEEKLY_TASKS_KEY,list);
  }
  return changed;
}
function normalizeCurrentTaskOwners(sync=false){
  const names=b2bTeam().map(m=>m.name).filter(Boolean);
  if(!names.length)return false;
  const list=weeklyTasks();
  let changed=false;
  list.forEach(t=>{
    const normalized=normalizedTaskOwner(t.owner,names);
    if((t.owner||'')!==normalized){
      t.owner=normalized;
      t.updatedAt=nowIso();
      changed=true;
    }
  });
  if(changed)(sync?saveSharedJson:saveLocalJson)(WEEKLY_TASKS_KEY,list);
  return changed;
}
const weeklyTaskOverdue=t=>t&&t.status!=='Готово'&&t.dueDate&&Date.now()>dateEndMs(t.dueDate);
const weeklyDoneCount=()=>weeklyTasks().filter(t=>t.status==='Готово').length;
const weeklyOpenCount=()=>weeklyTasks().filter(t=>t.status!=='Готово').length;
const weeklyProgress=()=>weeklyTasks().length?Math.round(weeklyDoneCount()/weeklyTasks().length*100):0;
function weeklyWindow(){
  const tasks=weeklyTasks();
  const starts=tasks.map(t=>t.startDate).filter(Boolean).sort();
  const dues=tasks.map(t=>t.dueDate).filter(Boolean).sort();
  const project=tasks.find(t=>t.project)?.project||WEEKLY_HQ_CODE;
  return{project,start:starts[0]||WEEKLY_START_DATE,due:dues[dues.length-1]||WEEKLY_DUE_DATE};
}
function nextReviewDate(){
  const now=new Date(),d=new Date(now);
  d.setHours(9,30,0,0);
  let delta=(1-d.getDay()+7)%7;
  if(delta===0&&now.getTime()>d.getTime())delta=7;
  d.setDate(d.getDate()+delta);
  return d;
}
function prevReviewDate(){const d=nextReviewDate();d.setDate(d.getDate()-7);return d;}
function fmtReviewDate(d){return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
function mondayStart(ms){const d=new Date(ms);d.setHours(0,0,0,0);const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.getTime();}


const stageStatus=id=>stageStatuses()[id]||'Не начато';
const moduleStatus=i=>moduleStatuses()[i]||'Не начато';
const stageProgress=id=>started()?(PROGRESS[stageStatus(id)]||0):0;
const stageScore=()=>started()?Math.round(DATA.stages.reduce((sum,s)=>sum+stageProgress(s.id),0)/DATA.stages.length):0;
const moduleScore=()=>Math.round(DATA.modules.reduce((sum,_,i)=>sum+(PROGRESS[moduleStatus(i)]||0),0)/DATA.modules.length);
const assignedOwner=v=>Boolean(v&&String(v).trim()&&String(v).trim()!=='Не назначен');
const ownerReadyCount=()=>DATA.teams.filter((_,i)=>assignedOwner(teamOwners()[i])).length;
const ownerScore=()=>Math.round(ownerReadyCount()/DATA.teams.length*100);
const dodDone=i=>AUTO_DOD[i]?Boolean(AUTO_DOD[i]()):Boolean(dodManual()[i]);
const dodReadyCount=()=>DATA.dod.filter((_,i)=>dodDone(i)).length;
const dodScore=()=>Math.round(dodReadyCount()/DATA.dod.length*100);
const implementationReadiness=()=>started()?Math.round(stageScore()*.5+moduleScore()*.25+ownerScore()*.1+dodScore()*.15):0;

const activeBlockers=()=>blockers().filter(x=>!['Решен','Закрыт'].includes(x.status));
const criticalBlockers=()=>activeBlockers().filter(x=>x.severity==='Критическая').length;
const incompleteBlockers=()=>activeBlockers().filter(x=>!assignedOwner(x.owner)||!x.due).length;

function localDateString(ms){
  const d=new Date(Number(ms));
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function dateEndMs(iso){return new Date(`${iso}T23:59:59`).getTime();}
function dateStartMs(iso){return new Date(`${iso}T00:00:00`).getTime();}
function fmtDate(ms){return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(Number(ms)));}
function fmtStart(ms){return new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'medium'}).format(new Date(Number(ms)));}
function addDays(ms,days){return Number(ms)+days*86400000;}
function projectBase(){return started()?Number(localStorage.getItem(K.start)):Date.now();}
function planStartMs(stage){return addDays(projectBase(),stage.start);}
function planEndMs(stage){return addDays(projectBase(),stage.end);}
function planEndIso(stage){return localDateString(planEndMs(stage));}
function stageDeadlineIso(stage){return deadlineOverrides()[stage.id]||planEndIso(stage);}
function stageDeadlineMs(stage){return dateEndMs(stageDeadlineIso(stage));}
function extendedDays(stage){const custom=deadlineOverrides()[stage.id];if(!custom)return 0;return Math.round((dateStartMs(custom)-dateStartMs(planEndIso(stage)))/86400000);}
function stageOverdue(stage){return started()&&stageStatus(stage.id)!=='Завершено'&&Date.now()>stageDeadlineMs(stage);}
function overdueStages(){return DATA.stages.filter(stageOverdue);}
function blockerOverdue(b){return b.due&&!['Решен','Закрыт'].includes(b.status)&&Date.now()>dateEndMs(b.due);}
function overdueBlockers(){return activeBlockers().filter(blockerOverdue);}
function teamOwner(team){const idx=DATA.teams.findIndex(r=>r[0]===team);return idx>=0?(teamOwners()[idx]||''):'';}

const progress=p=>`<div class="progress"><div style="width:${Math.max(0,Math.min(100,p))}%"></div></div>`;
const options=(arr,current)=>arr.map(x=>`<option ${x===current?'selected':''}>${esc(x)}</option>`).join('');
function badge(text,type='neutral'){return `<span class="badge ${type}">${esc(text)}</span>`;}
function statusBadge(status){
  if(['Завершено','Готово','Закрыт','Решен'].includes(status))return badge(status,'ok');
  if(status==='Блокер'||status==='Критическая')return badge(status,'bad');
  if(['В работе','Подготовка','Проектирование','Тестирование','Пилот','На согласовании'].includes(status))return badge(status,'work');
  return badge(status,'neutral');
}

function updateHeader(){
  const p=weeklyProgress();
  document.getElementById('headerProgress').textContent=p+'%';
  document.getElementById('headerProgressBar').style.width=p+'%';
}
function setSync(text,state='ok'){
  const el=document.getElementById('syncPill');
  if(!el)return;
  el.textContent=text;
  el.style.background=state==='error'?'#5b2d2d':state==='work'?'#5b4a20':'#173233';
  el.style.color=state==='error'?'#ffffff':state==='work'?'#fff7d6':'#d5eeee';
}
function syncOkLabel(){return 'Синхронизировано '+new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(new Date());}

function render(view=currentView,updateHash=false){
  const safeView=BCC_VIEWS.includes(view)?view:'tasks';
  currentView=safeView;
  if(updateHash&&location.hash!=='#'+safeView)history.pushState(null,'','#'+safeView);
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===safeView));
  const views={overview,tasks,gantt,team,issues};
  app.innerHTML=(views[safeView]||tasks)();
  bind();
  updateHeader();
  updateClock();
}
document.querySelectorAll('.nav').forEach(btn=>btn.addEventListener('click',()=>render(btn.dataset.view,true)));

function overview(){
  const tasks=weeklyTasks();
  const total=tasks.length;
  const done=weeklyDoneCount();
  const open=weeklyOpenCount();
  const overdue=tasks.filter(weeklyTaskOverdue);
  const taskBlockers=tasks.filter(t=>t.status==='Блокер');
  const allBlockers=taskBlockers.length;
  const completion=total?Math.round(done/total*100):0;
  const today=localDateString(Date.now());
  const next3=localDateString(Date.now()+3*86400000);
  const dueSoon=tasks.filter(t=>t.status!=='Готово'&&t.dueDate&&t.dueDate>=today&&t.dueDate<=next3&&!weeklyTaskOverdue(t));

  const attention=[];
  overdue.forEach(t=>attention.push({title:`Просрочена задача: ${t.title}`,note:`${t.owner||'Ответственный не указан'} · ${t.project||''} · срок ${t.dueDate||'—'}`,type:'bad'}));
  taskBlockers.forEach(t=>attention.push({title:`Блокер по задаче: ${t.title}`,note:`${t.owner||'Ответственный не указан'} · ${t.project||''}`,type:'bad'}));
  dueSoon.forEach(t=>attention.push({title:`Срок в ближайшие 3 дня: ${t.title}`,note:`${t.owner||'Ответственный не указан'} · срок ${t.dueDate||'—'}`,type:'work'}));

  const statusOrder=['Не начато','Новая','В работе','На контроле','Блокер','Готово','Отложено'];
  const statusRows=statusOrder.map(status=>{
    const count=tasks.filter(t=>t.status===status).length;
    if(!count)return '';
    const pct=total?Math.round(count/total*100):0;
    const type=status==='Готово'?'ok':status==='Блокер'?'bad':['В работе','На контроле'].includes(status)?'work':'neutral';
    return `<div class="dash-bar-row">
      <div class="dash-bar-label">${statusBadge(status)}</div>
      <div class="dash-bar-track"><div class="dash-bar-fill ${type}" style="width:${pct}%"></div></div>
      <div class="dash-bar-value">${count} · ${pct}%</div>
    </div>`;
  }).join('');

  const activeTeam=b2bTeam().filter(m=>m.status==='Активен');
  const ownerNames=activeTeam.map(m=>m.name).filter(Boolean);
  const ownerStats=activeTeam.map(m=>{
    const memberTasks=tasks.filter(t=>normalizedTaskOwner(t.owner,ownerNames)===m.name);
    const memberOpen=memberTasks.filter(t=>t.status!=='Готово').length;
    const memberDone=memberTasks.filter(t=>t.status==='Готово').length;
    const memberOverdue=memberTasks.filter(weeklyTaskOverdue).length;
    return {name:m.name,total:memberTasks.length,open:memberOpen,done:memberDone,overdue:memberOverdue};
  });
  const maxOwner=Math.max(1,...ownerStats.map(x=>x.open));
  const ownerRows=ownerStats.map(x=>{
    const pct=Math.round(x.open/maxOwner*100);
    return `<div class="owner-load-row">
      <div class="owner-load-name"><b>${esc(x.name)}</b><small>${x.done} готово${x.overdue?' · '+x.overdue+' просрочено':''}</small></div>
      <div class="owner-load-track"><div style="width:${pct}%"></div></div>
      <div class="owner-load-value">${x.open}</div>
    </div>`;
  }).join('');
  const unassigned=tasks.filter(t=>!normalizedTaskOwner(t.owner,ownerNames)).length;

  const blocks=[...new Set(tasks.map(t=>t.block||'Без блока'))];
  const blockRows=blocks.map(block=>{
    const blockTasks=tasks.filter(t=>(t.block||'Без блока')===block);
    const blockDone=blockTasks.filter(t=>t.status==='Готово').length;
    const pct=blockTasks.length?Math.round(blockDone/blockTasks.length*100):0;
    const blockOverdue=blockTasks.filter(weeklyTaskOverdue).length;
    return `<div class="block-progress-row">
      <div class="block-progress-head"><b>${esc(block)}</b><span>${blockDone}/${blockTasks.length} · ${pct}%${blockOverdue?' · просрочено '+blockOverdue:''}</span></div>
      <div class="block-progress-track"><div style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  return `
    <div class="project-start-card">
      <div>
        <div class="label">Текущий цикл ревью</div>
        <div class="project-state">${fmtReviewDate(prevReviewDate())} → ${fmtReviewDate(nextReviewDate())}</div>
        <div class="start-meta">Ревью проектов B2B · B2G · Каршеринг · Такси проходит каждый понедельник в 09:30</div>
      </div>
      <div>
        <div class="label">Открытые задачи</div>
        <div class="project-timer">${open}</div>
        <div class="start-meta">из ${total} задач</div>
      </div>
      <button class="btn primary" onclick="render('tasks')">Открыть задачи</button>
    </div>

    <div class="grid">
      <div class="card kpi"><div class="label">Выполнение задач</div><div class="value">${completion}%</div>${progress(completion)}<div class="sub">готово ${done} из ${total}</div></div>
      <div class="card kpi"><div class="label">Просрочено</div><div class="value">${overdue.length}</div><div class="sub">требуют решения</div></div>
      <div class="card kpi"><div class="label">Блокеры</div><div class="value">${allBlockers}</div><div class="sub">задач в статусе «Блокер»</div></div>
      <div class="card kpi"><div class="label">Срок ≤ 3 дней</div><div class="value">${dueSoon.length}</div><div class="sub">контроль ближайших сроков</div></div>
    </div>

    <div class="section-title"><h2>Дашборд задач</h2><small>${weeklyWindow().project} · ${weeklyWindow().start}–${weeklyWindow().due}</small></div>
    <div class="overview-dashboard">
      <div class="card dashboard-card completion-card">
        <div class="dashboard-card-head"><div><h3>Выполнение</h3><small>готово / всего</small></div><b>${done} / ${total}</b></div>
        <div class="completion-visual">
          <div class="completion-donut" style="--pct:${completion}"><div><strong>${completion}%</strong><span>готово</span></div></div>
          <div class="completion-stats">
            <div><span>Открыто</span><b>${open}</b></div>
            <div><span>Просрочено</span><b>${overdue.length}</b></div>
            <div><span>Блокеры</span><b>${allBlockers}</b></div>
            <div><span>Не назначено</span><b>${unassigned}</b></div>
          </div>
        </div>
      </div>

      <div class="card dashboard-card">
        <div class="dashboard-card-head"><div><h3>Статусы задач</h3><small>распределение текущего штаба</small></div></div>
        <div class="dash-bars">${statusRows||'<div class="empty">Нет данных по статусам.</div>'}</div>
      </div>

      <div class="card dashboard-card">
        <div class="dashboard-card-head"><div><h3>Нагрузка команды B2B</h3><small>открытые задачи по ответственным</small></div></div>
        <div class="owner-load">${ownerRows||'<div class="empty">Команда не заполнена.</div>'}</div>
      </div>

      <div class="card dashboard-card">
        <div class="dashboard-card-head"><div><h3>Готовность по блокам</h3><small>доля выполненных задач</small></div></div>
        <div class="block-progress-list">${blockRows||'<div class="empty">Нет данных по блокам.</div>'}</div>
      </div>
    </div>

    <div class="section-title"><h2>Требует внимания</h2><small>${attention.length?'текущие отклонения':'отклонений нет'}</small></div>
    ${attention.length?`<div class="attention-list">${attention.slice(0,12).map(a=>`<div class="attention-item"><div><b>${esc(a.title)}</b><small>${esc(a.note)}</small></div>${badge(a.type==='bad'?'Требует действия':'Контроль',a.type)}</div>`).join('')}</div>`:'<div class="empty">Просроченных задач, блокеров и ближайших критичных сроков сейчас нет.</div>'}
  `;
}

function taskOptions(arr,current){
  return arr.map(x=>`<option ${x===current?'selected':''}>${esc(x)}</option>`).join('');
}
function taskStatusClass(status){
  return {
    'Не начато':'status-not-started',
    'Новая':'status-new',
    'В работе':'status-work',
    'На контроле':'status-control',
    'Блокер':'status-blocker',
    'Готово':'status-done',
    'Отложено':'status-postponed'
  }[status]||'status-neutral';
}
function applyTaskStatusClass(el){
  if(!el)return;
  [...el.classList].filter(x=>x.startsWith('status-')).forEach(x=>el.classList.remove(x));
  el.classList.add(taskStatusClass(el.value));
}
function normalizedTaskOwner(owner,owners){
  const value=String(owner||'').trim();
  if(!value)return '';
  if(owners.includes(value))return value;
  const lower=value.toLocaleLowerCase('ru-RU');
  return owners.find(name=>{
    const first=String(name||'').trim().split(/\s+/)[0].toLocaleLowerCase('ru-RU');
    return first.length>2&&lower.includes(first);
  })||'';
}
function taskOwnerOptions(owners,current){
  const selected=normalizedTaskOwner(current,owners);
  return `<option value="" ${selected?'':'selected'}>Не назначен</option>`+
    owners.map(o=>`<option value="${esc(o)}" ${o===selected?'selected':''}>${esc(o)}</option>`).join('');
}
function tasks(){
  const list=weeklyTasks().slice().sort((a,b)=>(a.number||9999)-(b.number||9999));
  const owners=b2bTeam().map(m=>m.name).filter(Boolean).sort((a,b)=>a.localeCompare(b,'ru'));
  const rows=list.map(t=>`<tr class="${weeklyTaskOverdue(t)?'task-overdue':''}">
    <td>${t.number||'—'}</td>
    <td><b>${esc(t.title||'')}</b><span class="deadline-note">${esc(t.result||'')}</span></td>
    <td>${esc(t.project||'—')}</td>
    <td><select class="taskOwnerSelect" data-id="${t.id}" aria-label="Ответственный по задаче №${t.number||''}">${taskOwnerOptions(owners,t.owner)}</select></td>
    <td><select class="taskStatusSelect ${taskStatusClass(t.status||'Новая')}" data-id="${t.id}" aria-label="Статус задачи №${t.number||''}">${taskOptions(TASK_STATUSES,t.status||'Новая')}</select></td>
    <td>${esc(t.startDate||'—')}</td>
    <td>${esc(t.dueDate||'—')}${weeklyTaskOverdue(t)?'<span class="deadline-note">'+badge('Просрочено','bad')+'</span>':''}</td>
    <td>${esc(t.block||'')}</td>
    <td><div class="task-actions"><button class="btn taskEditBtn" data-id="${t.id}">Изменить</button><button class="btn danger taskDeleteBtn" data-id="${t.id}">Удалить</button></div></td>
  </tr>`).join('');
  return `
    <div class="task-create-toolbar">
      <button id="taskEditorToggle" class="btn primary" type="button">${taskEditorOpen?'Свернуть':'Создать задачу'}</button>
    </div>
    <div id="taskEditorCard" class="card task-editor ${taskEditorOpen?'':'hidden'}">
      <div class="task-editor-head"><h3 id="taskEditorTitle">Создать задачу</h3><button id="taskCancelEdit" class="btn hidden">Отменить изменение</button></div>
      <input id="taskEditId" type="hidden">
      <div class="task-form-grid">
        <label>Блок<select id="taskBlock"><option>Решения прошлого штаба</option><option>Дополнительные задачи</option><option>Новые задачи ревью</option></select></label>
        <label>Вертикаль<select id="taskVertical"><option>Все вертикали</option><option>B2B</option><option>B2G</option><option>Каршеринг</option><option>Такси</option></select></label>
        <label class="task-wide">Задача<input id="taskTitle" placeholder="Что должно быть сделано"></label>
        <label>Источник<input id="taskProject" placeholder="WEEK_NNГГГГ"></label>
        <label>Ответственный<select id="taskOwner"><option value="">Не назначен</option>${owners.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select></label>
        <label>Статус<select id="taskStatus" class="${taskStatusClass('Новая')}">${taskOptions(TASK_STATUSES,'Новая')}</select></label>
        <label>Дата с<input id="taskStartDate" type="date"></label>
        <label>Дата до<input id="taskDueDate" type="date"></label>
        <label class="task-wide">Критерий готовности<textarea id="taskResult" rows="2" placeholder="Как поймем, что задача выполнена"></textarea></label>
        <label class="task-wide">Комментарий<textarea id="taskComment" rows="2" placeholder="Результат, причина переноса, следующий шаг"></textarea></label>
      </div>
      <div class="task-editor-actions"><button id="taskSaveBtn" class="btn primary">Создать задачу</button></div>
    </div>
    <div class="section-title"><h2>Реестр задач</h2><small>создание · изменение · удаление · контроль периода</small></div>
    ${list.length?`<div class="table-wrap"><table class="table wide task-admin-table"><thead><tr><th>#</th><th>Задача / критерий</th><th>Источник задачи</th><th>Ответственный</th><th>Статус</th><th>Дата с</th><th>Дата до</th><th>Блок</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Задач пока нет.</div>'}
  `;
}
function resetTaskEditor(collapse=false){
  const ids=['taskEditId','taskTitle','taskProject','taskOwner','taskResult','taskComment'];
  ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const start=document.getElementById('taskStartDate'),due=document.getElementById('taskDueDate');
  if(start)start.value=localDateString(Date.now());
  if(due)due.value=localDateString(nextReviewDate().getTime());
  const st=document.getElementById('taskStatus');if(st){st.value='Новая';applyTaskStatusClass(st);}
  const v=document.getElementById('taskVertical');if(v)v.value='B2B';
  const b=document.getElementById('taskBlock');if(b)b.value='Новые задачи ревью';
  const source=document.getElementById('taskProject');if(source)source.value=currentWeekSourceCode();
  const title=document.getElementById('taskEditorTitle');if(title)title.textContent='Создать задачу';
  const save=document.getElementById('taskSaveBtn');if(save)save.textContent='Создать задачу';
  document.getElementById('taskCancelEdit')?.classList.add('hidden');
  if(collapse){
    taskEditorOpen=false;
    document.getElementById('taskEditorCard')?.classList.add('hidden');
    const toggle=document.getElementById('taskEditorToggle');if(toggle)toggle.textContent='Создать задачу';
  }
}
function openTaskEditor(id){
  const t=weeklyTasks().find(x=>x.id===id);if(!t)return;
  taskEditorOpen=true;
  document.getElementById('taskEditorCard')?.classList.remove('hidden');
  const toggle=document.getElementById('taskEditorToggle');if(toggle)toggle.textContent='Свернуть';
  document.getElementById('taskEditId').value=t.id;
  document.getElementById('taskBlock').value=t.block||'Новые задачи ревью';
  document.getElementById('taskVertical').value=t.vertical||'B2B';
  document.getElementById('taskTitle').value=t.title||'';
  document.getElementById('taskProject').value=t.project||'';
  document.getElementById('taskOwner').value=t.owner||'';
  document.getElementById('taskStatus').value=t.status||'Новая';
  applyTaskStatusClass(document.getElementById('taskStatus'));
  document.getElementById('taskStartDate').value=t.startDate||'';
  document.getElementById('taskDueDate').value=t.dueDate||'';
  document.getElementById('taskResult').value=t.result||'';
  document.getElementById('taskComment').value=t.comment||'';
  document.getElementById('taskEditorTitle').textContent='Изменить задачу №'+(t.number||'');
  document.getElementById('taskSaveBtn').textContent='Сохранить изменения';
  document.getElementById('taskCancelEdit').classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}
function saveTaskFromEditor(){
  const id=document.getElementById('taskEditId').value;
  const title=document.getElementById('taskTitle').value.trim();
  const startDate=document.getElementById('taskStartDate').value;
  const dueDate=document.getElementById('taskDueDate').value;
  if(!title){alert('Укажите задачу');return;}
  if(!startDate||!dueDate){alert('Укажите период: Дата с и Дата до');return;}
  if(dateStartMs(dueDate)<dateStartMs(startDate)){alert('Дата до не может быть раньше даты с');return;}
  const owner=document.getElementById('taskOwner').value;
  const allowedOwners=new Set(b2bTeam().map(m=>m.name));
  if(owner&&!allowedOwners.has(owner)){alert('Ответственный должен быть выбран из таблицы Команда B2B');return;}
  const list=weeklyTasks();
  if(id){
    const t=list.find(x=>x.id===id);if(!t)return;
    Object.assign(t,{
      block:document.getElementById('taskBlock').value,
      vertical:document.getElementById('taskVertical').value,
      title,
      project:document.getElementById('taskProject').value.trim(),
      owner,
      status:document.getElementById('taskStatus').value,
      startDate,dueDate,
      result:document.getElementById('taskResult').value.trim(),
      comment:document.getElementById('taskComment').value.trim(),
      updatedAt:nowIso()
    });
  }else{
    const maxNo=Math.max(0,...list.map(t=>Number(t.number)||0));
    list.push({
      id:'t-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
      number:maxNo+1,
      block:document.getElementById('taskBlock').value,
      vertical:document.getElementById('taskVertical').value,
      title,
      project:document.getElementById('taskProject').value.trim(),
      owner,
      status:document.getElementById('taskStatus').value,
      priority:'Средний',progress:0,startDate,dueDate,
      result:document.getElementById('taskResult').value.trim(),
      comment:document.getElementById('taskComment').value.trim(),
      createdAt:nowIso(),updatedAt:nowIso()
    });
  }
  saveSharedJson(WEEKLY_TASKS_KEY,list);
  taskEditorOpen=false;
  render('tasks');
}
function updateTaskStatusFromTable(id,status){
  const list=weeklyTasks();
  const t=list.find(x=>x.id===id);if(!t)return;
  t.status=status;
  t.updatedAt=nowIso();
  saveSharedJson(WEEKLY_TASKS_KEY,list);
  render('tasks');
}
function updateTaskOwnerFromTable(id,owner){
  const allowed=new Set(b2bTeam().map(m=>m.name).filter(Boolean));
  if(owner&&!allowed.has(owner))return;
  const list=weeklyTasks();
  const t=list.find(x=>x.id===id);if(!t)return;
  t.owner=owner;
  t.updatedAt=nowIso();
  saveSharedJson(WEEKLY_TASKS_KEY,list);
  render('tasks');
}

function deleteTaskFromManager(id){
  const list=weeklyTasks(),t=list.find(x=>x.id===id);if(!t)return;
  if(!confirm(`Удалить задачу «${t.title}»?`))return;
  if(t.sourceId){
    const deleted=new Set(deletedTaskIds());
    deleted.add(t.sourceId);
    saveSharedJson(DELETED_TASKS_KEY,[...deleted]);
  }
  saveSharedJson(WEEKLY_TASKS_KEY,list.filter(x=>x.id!==id));
  render('tasks');
}

function isoWeekNumber(date){
  const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  const day=d.getUTCDay()||7;
  d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-yearStart)/86400000)+1)/7);
}
function currentWeekSourceCode(date=new Date()){
  const week=String(isoWeekNumber(date)).padStart(2,'0');
  return 'WEEK_'+week+date.getFullYear();
}
function gantt(){
  const allTasks=weeklyTasks().filter(t=>t.startDate&&t.dueDate);
  const weeks=12;
  const start=mondayStart(Date.now());
  const end=start+weeks*7*86400000;
  const tasks=allTasks.filter(t=>{
    const s=dateStartMs(t.startDate),e=dateEndMs(t.dueDate);
    return e>=start&&s<end;
  });
  const metaColumns=[
    {key:'vertical',label:'Вертикаль',width:125},
    {key:'source',label:'Источник',width:145},
    {key:'owner',label:'Ответственный',width:180}
  ];
  const visibleMeta=metaColumns.filter(c=>ganttColumnState[c.key]);
  const gridTemplate=['300px',...visibleMeta.map(c=>c.width+'px'),'minmax(820px,1fr)'].join(' ');
  const minWidth=300+visibleMeta.reduce((sum,c)=>sum+c.width,0)+820;
  const gridStyle=`grid-template-columns:${gridTemplate};min-width:${minWidth}px`;
  const weekHead=Array.from({length:weeks},(_,i)=>{
    const d=new Date(start+i*7*86400000);
    const week=isoWeekNumber(d);
    const monday=`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    return `<div class="gantt-week"><b>Нед. ${week}</b><small>${monday}</small></div>`;
  }).join('');
  const gridStep=100/weeks;
  const nextReview=nextReviewDate().getTime();
  const reviewVisible=nextReview>=start&&nextReview<end;
  const reviewLeft=Math.max(0,Math.min(100,(nextReview-start)/(end-start)*100));
  const rows=tasks.sort((a,b)=>dateStartMs(a.startDate)-dateStartMs(b.startDate)).map(t=>{
    const rawStart=dateStartMs(t.startDate),rawEnd=dateEndMs(t.dueDate);
    const s=Math.max(rawStart,start),e=Math.min(rawEnd,end);
    const left=Math.max(0,(s-start)/(end-start)*100);
    const width=Math.max(.8,(e-s)/(end-start)*100);
    const statusCls=taskStatusClass(t.status||'Новая');
    const clippedLeft=rawStart<start;
    const clippedRight=rawEnd>end;
    const clipNote=(clippedLeft||clippedRight)?' · часть периода вне 12 недель':'';
    return `<div class="gantt-row" style="${gridStyle}">
      <div class="gantt-task"><b>${t.number?t.number+'. ':''}${esc(t.title)}</b>${clipNote?`<small>${esc(clipNote.replace(/^ · /,''))}</small>`:''}</div>
      ${ganttColumnState.vertical?`<div class="gantt-meta gantt-vertical">${esc(t.vertical||'—')}</div>`:''}
      ${ganttColumnState.source?`<div class="gantt-meta gantt-source">${esc(t.project||'—')}</div>`:''}
      ${ganttColumnState.owner?`<div class="gantt-meta gantt-owner">${esc(t.owner||'Без ответственного')}</div>`:''}
      <div class="gantt-track">
        <div class="gantt-grid" style="background:repeating-linear-gradient(to right,transparent 0,transparent calc(${gridStep}% - 1px),var(--line) calc(${gridStep}% - 1px),var(--line) ${gridStep}%)"></div>
        ${reviewVisible?`<div class="gantt-marker" title="Следующее ревью" style="left:${reviewLeft}%"></div>`:''}
        <div class="gantt-bar ${statusCls}" title="${esc(t.status||'Новая')}" style="left:${left}%;width:${Math.min(width,100-left)}%"><span>${esc(t.status||'Новая')}</span></div>
      </div>
    </div>`;
  }).join('');
  const hiddenCount=allTasks.length-tasks.length;
  return `
    <div class="section-title"><h2>Диаграмма Ганта по задачам</h2><small>12 недель · ${tasks.length} задач в периоде</small></div>
    <div class="callout"><b>Горизонт:</b> 12 недель от текущей недели. Красная вертикальная линия показывает следующее ревью в понедельник 09:30.${hiddenCount?` За пределами горизонта: ${hiddenCount} задач.`:''}</div>
    <div class="gantt-column-controls">
      <span>Показать столбцы:</span>
      ${metaColumns.map(c=>`<button type="button" class="btn ganttColToggle ${ganttColumnState[c.key]?'active':''}" data-gantt-col="${c.key}" aria-pressed="${ganttColumnState[c.key]?'true':'false'}"><b>${ganttColumnState[c.key]?'−':'+'}</b> ${c.label}</button>`).join('')}
    </div>
    <div class="gantt-status-legend">
      ${TASK_STATUSES.map(status=>`<span><i class="${taskStatusClass(status)}"></i>${esc(status)}</span>`).join('')}
    </div>
    <div class="gantt-wrap">
      <div class="gantt-head" style="${gridStyle}">
        <div class="gantt-task-head">Задача</div>
        ${ganttColumnState.vertical?'<div class="gantt-col-head">Вертикаль</div>':''}
        ${ganttColumnState.source?'<div class="gantt-col-head">Источник</div>':''}
        ${ganttColumnState.owner?'<div class="gantt-col-head">Ответственный</div>':''}
        <div class="gantt-weeks" style="grid-template-columns:repeat(12,1fr)">${weekHead}</div>
      </div>
      ${rows||'<div class="empty">В выбранном 12-недельном периоде задач нет.</div>'}
    </div>
  `;
}

function roadmap(){
  const rows=DATA.stages.map(s=>{
    const status=stageStatus(s.id),ext=extendedDays(s),owner=teamOwner(s.team);
    const deviation=stageOverdue(s)?badge('Просрочен','bad'):ext>0?badge(`Продлен +${ext} дн.`,'work'):ext<0?badge(`Сокращен ${Math.abs(ext)} дн.`,'ok'):badge('По плану','neutral');
    return `<tr>
      <td>${s.id}</td>
      <td><b>${esc(s.name)}</b><span class="deadline-note">${esc(s.team)}${owner?` · ${esc(owner)}`:''}</span></td>
      <td><select class="stageSelect" data-id="${s.id}">${options(STAGE_STATUSES,status)}</select></td>
      <td>${fmtDate(planEndMs(s))}</td>
      <td class="deadline-cell"><b>${fmtDate(stageDeadlineMs(s))}</b><span class="deadline-note">${deviation}</span></td>
      <td>${stageProgress(s.id)}% ${progress(stageProgress(s.id))}</td>
      <td><button class="btn deadlineBtn" data-id="${s.id}" ${started()?'':'disabled'}>Изменить срок</button></td>
    </tr>`;
  }).join('');
  return `
    <div class="section-title"><h2>Этапы внедрения</h2><small>Один источник для статусов, сроков и Ганта</small></div>
    <div class="callout"><b>Логика:</b> статус этапа влияет на прогресс. Срок можно изменить только после старта проекта. Продленный срок отдельно показывается в таблице и на Ганте. Статус «Блокер» автоматически создает запись в реестре блокеров.</div>
    <div class="table-wrap"><table class="table wide"><thead><tr><th>#</th><th>Этап</th><th>Статус</th><th>Плановый срок</th><th>Текущий срок</th><th>Готовность</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}

function team(){
  const list=b2bTeam(),taskList=weeklyTasks();
  const rows=list.map(m=>{
    const assigned=taskList.filter(t=>taskAssignedToMember(t,m)&&t.status!=='Готово');
    const over=assigned.filter(weeklyTaskOverdue).length;
    const bl=assigned.filter(t=>t.status==='Блокер').length;
    return `<tr>
      <td><input class="teamField" data-id="${m.id}" data-key="name" value="${esc(m.name||'')}" placeholder="ФИО"></td>
      <td><input class="teamField" data-id="${m.id}" data-key="email" type="email" value="${esc(m.email||'')}" placeholder="E-mail"></td>
      <td><select class="teamField" data-id="${m.id}" data-key="role">${options(B2B_TEAM_ROLES,m.role||'Пользователь')}</select></td>
      <td><select class="teamField" data-id="${m.id}" data-key="status">${options(B2B_TEAM_STATUSES,m.status||'Активен')}</select></td>
      <td>${assigned.length}</td><td>${over}</td><td>${bl}</td>
      <td><button class="btn danger delTeamMember" data-id="${m.id}">Удалить</button></td>
    </tr>`;
  }).join('');
  return `<div class="section-title"><h2>Команда B2B</h2><small>нагрузка считается из задач Weekly Review</small></div>
    <div class="card"><h3 style="margin-top:0">Добавить сотрудника</h3><div class="form-grid"><input id="tmName" placeholder="ФИО"><input id="tmEmail" type="email" placeholder="E-mail"><select id="tmRole">${B2B_TEAM_ROLES.map(x=>`<option>${x}</option>`).join('')}</select><select id="tmStatus">${B2B_TEAM_STATUSES.map(x=>`<option>${x}</option>`).join('')}</select><button id="addTeamMember" class="btn primary">Добавить</button></div></div>
    <div class="section-title"><h2>Состав команды</h2><small>${list.length} сотрудников</small></div>
    ${list.length?`<div class="table-wrap"><table class="table"><thead><tr><th>ФИО</th><th>E-mail</th><th>Роль</th><th>Статус</th><th>Открыто</th><th>Просрочено</th><th>Блокеры</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Сотрудники пока не добавлены.</div>'}`;
}

function modules(){
  const rows=DATA.modules.map((r,i)=>{
    const status=moduleStatus(i),p=PROGRESS[status]||0;
    return `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td><select class="moduleSelect" data-i="${i}">${options(MODULE_STATUSES,status)}</select></td><td>${p}% ${progress(p)}</td></tr>`;
  }).join('');
  return `<div class="section-title"><h2>Модули ATOM BCC</h2><small>Модули дают 25% общей готовности внедрения</small></div><div class="callout"><b>Важно:</b> часть Definition of Done теперь рассчитывается автоматически по фактическим статусам модулей. Нельзя вручную отметить функцию готовой, если связанный модуль еще не готов.</div><div class="table-wrap"><table class="table"><thead><tr><th>Модуль</th><th>Назначение</th><th>Статус внедрения</th><th>Готовность</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function issues(){
  const list=weeklyTasks();
  const taskBlockers=list.filter(t=>t.status==='Блокер');
  const overdue=list.filter(t=>weeklyTaskOverdue(t)&&t.status!=='Блокер');
  const rows=arr=>arr.map(t=>`<tr><td>${t.number||'—'}</td><td><b>${esc(t.title)}</b><span class="deadline-note">${esc(t.result||'')}</span></td><td>${esc(t.owner||'—')}</td><td>${esc(t.dueDate||'—')}</td><td>${esc(t.project||'')}</td></tr>`).join('');
  return `<div class="section-title"><h2>Блокеры</h2><small>${taskBlockers.length}</small></div>
    <div class="callout"><b>Единый источник:</b> блокер определяется статусом задачи. Отдельного ручного реестра блокеров больше нет.</div>
    ${taskBlockers.length?`<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Задача</th><th>Ответственный</th><th>Контроль до</th><th>Проект</th></tr></thead><tbody>${rows(taskBlockers)}</tbody></table></div>`:'<div class="empty">Задач в статусе «Блокер» нет.</div>'}
    <div class="section-title"><h2>Просроченные задачи</h2><small>${overdue.length}</small></div>
    ${overdue.length?`<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Задача</th><th>Ответственный</th><th>Контроль до</th><th>Проект</th></tr></thead><tbody>${rows(overdue)}</tbody></table></div>`:'<div class="empty">Просроченных задач нет.</div>'}`;
}

function dod(){
  const rows=DATA.dod.map((r,i)=>{
    const auto=Boolean(AUTO_DOD[i]);
    const done=dodDone(i);
    return `<label class="check ${auto?'check-auto':''}"><input type="checkbox" class="dodCheck" data-i="${i}" ${done?'checked':''} ${auto?'disabled':''}><span><b>${esc(r[0])}</b><small>${esc(r[1])}${auto?' · автоматически':''}</small></span>${done?badge('Выполнено','ok'):badge(auto?'Ждет модули':'Не выполнено',auto?'work':'neutral')}</label>`;
  }).join('');
  return `<div class="section-title"><h2>Definition of Done</h2><small>${dodReadyCount()} из ${DATA.dod.length} · ${dodScore()}%</small></div><div class="callout"><b>Логика приемки:</b> технические критерии связаны со статусами модулей и рассчитываются автоматически. Организационные критерии остаются ручными, потому что требуют фактического подтверждения.</div><div class="checklist">${rows}</div>`;
}

function architecture(){
  return `<div class="section-title"><h2>Архитектура ATOM BCC</h2><small>BCC как управленческий слой, а не замена учетных систем</small></div>
  <div class="card"><div class="flow"><div class="node"><b>ELMA / CRM</b></div><div class="node"><b>Альфа-Авто</b></div><div class="node"><b>1С / Финансы</b></div><div class="node"><b>DATA / DWH / BI</b></div><div class="node"><b>Ручные данные</b></div><div class="arrow">→</div><div class="node"><b>ATOM BCC</b><br><small>единый управленческий слой</small></div><div class="arrow">→</div><div class="node"><b>Проекты</b></div><div class="node"><b>Задачи</b></div><div class="node"><b>Встречи</b></div><div class="node"><b>KPI</b></div><div class="node"><b>Решения</b></div><div class="node"><b>Блокеры</b></div><div class="arrow">→</div><div class="node"><b>Контроль руководителя</b></div></div></div>
  <div class="callout"><b>BCC не заменяет ELMA, 1С, DWH, BI или профильные системы.</b><br><br>Он связывает их на уровне управления: владелец, срок, статус, отклонение, решение, блокер и факт исполнения.</div>
  <div class="callout warn"><b>Текущий сайт остается публичным тестовым контуром.</b> Ролевые права и конфиденциальные данные должны появляться только после отдельного защищенного рабочего контура и допуска ИБ.</div>`;
}

function ensureStageBlocker(stage){
  const list=blockers();
  const exists=list.some(b=>b.linkType==='stage'&&b.linkId===stage.id&&!['Решен','Закрыт'].includes(b.status));
  if(exists)return;
  list.push({
    id:'stage-'+stage.id+'-'+Date.now().toString(36),
    linkType:'stage',linkId:stage.id,source:stage.name,
    description:'Этап переведен в статус «Блокер». Уточните причину.',
    severity:'Высокая',owner:teamOwner(stage.team)||'Не назначен',due:stageDeadlineIso(stage),status:'Открыт',comment:'Создан автоматически из этапа внедрения.'
  });
  saveJson(K.blockers,list);
}
function closeStageBlockers(stage){
  const list=blockers();let changed=false;
  list.forEach(b=>{
    if(b.linkType==='stage'&&b.linkId===stage.id&&!['Решен','Закрыт'].includes(b.status)){
      b.status='Закрыт';
      b.comment=((b.comment||'')+' Закрыт автоматически после завершения этапа.').trim();
      changed=true;
    }
  });
  if(changed)saveJson(K.blockers,list);
}
function patchBlocker(id,key,value,rerender=false){
  const list=blockers();const b=list.find(x=>x.id===id);if(!b)return;
  b[key]=value;
  saveJson(K.blockers,list);
  if(rerender)render('issues');
}

function bind(){

  const taskEditorToggle=document.getElementById('taskEditorToggle');
  if(taskEditorToggle)taskEditorToggle.onclick=()=>{
    taskEditorOpen=!taskEditorOpen;
    const card=document.getElementById('taskEditorCard');
    if(taskEditorOpen){
      card?.classList.remove('hidden');
      taskEditorToggle.textContent='Свернуть';
      resetTaskEditor(false);
    }else{
      resetTaskEditor(true);
    }
  };

  document.querySelectorAll('.ganttColToggle').forEach(btn=>btn.onclick=()=>{
    const key=btn.dataset.ganttCol;
    if(!(key in ganttColumnState))return;
    ganttColumnState[key]=!ganttColumnState[key];
    render('gantt');
  });

  const taskSaveBtn=document.getElementById('taskSaveBtn');
  if(taskSaveBtn)taskSaveBtn.onclick=saveTaskFromEditor;
  const taskCancelEdit=document.getElementById('taskCancelEdit');
  if(taskCancelEdit)taskCancelEdit.onclick=()=>resetTaskEditor(true);
  document.querySelectorAll('.taskEditBtn').forEach(el=>el.onclick=()=>openTaskEditor(el.dataset.id));
  document.querySelectorAll('.taskStatusSelect').forEach(el=>{
    applyTaskStatusClass(el);
    el.onchange=()=>{
      applyTaskStatusClass(el);
      updateTaskStatusFromTable(el.dataset.id,el.value);
    };
  });
  const taskStatus=document.getElementById('taskStatus');
  if(taskStatus){
    applyTaskStatusClass(taskStatus);
    taskStatus.onchange=()=>applyTaskStatusClass(taskStatus);
  }
  document.querySelectorAll('.taskOwnerSelect').forEach(el=>el.onchange=()=>updateTaskOwnerFromTable(el.dataset.id,el.value));
  document.querySelectorAll('.taskDeleteBtn').forEach(el=>el.onclick=()=>deleteTaskFromManager(el.dataset.id));
  if(currentView==='tasks'&&!document.getElementById('taskEditId')?.value){
    const start=document.getElementById('taskStartDate');
    const due=document.getElementById('taskDueDate');
    if(start&&!start.value)start.value=localDateString(Date.now());
    if(due&&!due.value)due.value=localDateString(nextReviewDate().getTime());
  }

  const startBtn=document.getElementById('startBtn');
  if(startBtn)startBtn.onclick=()=>{if(started())return;saveRaw(K.start,String(Date.now()));render('overview');};

  document.querySelectorAll('.stageSelect').forEach(el=>el.onchange=()=>{
    const s=stageStatuses();s[el.dataset.id]=el.value;saveJson(K.stages,s);
    const stage=DATA.stages.find(x=>x.id===el.dataset.id);
    if(el.value==='Блокер')ensureStageBlocker(stage);
    if(el.value==='Завершено')closeStageBlockers(stage);
    render('roadmap');
  });

  document.querySelectorAll('.deadlineBtn').forEach(btn=>btn.onclick=()=>{
    if(!started())return;
    const stage=DATA.stages.find(s=>s.id===btn.dataset.id);
    const current=stageDeadlineIso(stage);
    const value=prompt(`Новый срок для этапа «${stage.name}» в формате ГГГГ-ММ-ДД`,current);
    if(value===null)return;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(dateStartMs(value))){alert('Введите дату в формате ГГГГ-ММ-ДД');return;}
    if(dateStartMs(value)<dateStartMs(localDateString(planStartMs(stage)))){alert('Срок не может быть раньше даты начала этапа');return;}
    const d=deadlineOverrides();
    if(value===planEndIso(stage))delete d[stage.id];else d[stage.id]=value;
    saveJson(K.deadlines,d);
    const list=blockers();let changed=false;
    list.forEach(b=>{if(b.linkType==='stage'&&b.linkId===stage.id&&!['Решен','Закрыт'].includes(b.status)){b.due=value;changed=true;}});
    if(changed)saveJson(K.blockers,list);
    render('roadmap');
  });

  document.querySelectorAll('.moduleSelect').forEach(el=>el.onchange=()=>{
    const m=moduleStatuses();m[el.dataset.i]=el.value;saveJson(K.modules,m);render('modules');
  });

  document.querySelectorAll('.ownerInput').forEach(el=>el.onchange=()=>{
    const o=teamOwners();o[el.dataset.i]=el.value.trim();saveJson(K.teams,o);
  });

  const addTeam=document.getElementById('addTeamMember');
  if(addTeam)addTeam.onclick=()=>{
    const name=document.getElementById('tmName').value.trim();
    const email=document.getElementById('tmEmail').value.trim();
    const role=document.getElementById('tmRole').value;
    const status=document.getElementById('tmStatus').value;
    if(!name){alert('Укажите сотрудника');return;}
    if(!email){alert('Укажите E-mail');return;}
    const list=b2bTeam();
    if(list.some(m=>String(m.email||'').toLowerCase()===email.toLowerCase())){alert('Сотрудник с таким E-mail уже есть');return;}
    list.push({id:'tm-'+Date.now().toString(36),name,email,role,status});
    saveSharedJson(B2B_TEAM_KEY,list);
    render('team');
  };

  document.querySelectorAll('.teamField').forEach(el=>el.onchange=()=>{
    const list=b2bTeam();
    const m=list.find(x=>x.id===el.dataset.id);
    if(!m)return;
    m[el.dataset.key]=el.value.trim();
    saveSharedJson(B2B_TEAM_KEY,list);
    render('team');
  });

  document.querySelectorAll('.delTeamMember').forEach(el=>el.onclick=()=>{
    if(!confirm('Удалить сотрудника из списка?'))return;
    saveSharedJson(B2B_TEAM_KEY,b2bTeam().filter(m=>m.id!==el.dataset.id));
    render('team');
  });

  document.querySelectorAll('.dodCheck').forEach(el=>el.onchange=()=>{
    if(AUTO_DOD[el.dataset.i])return;
    const d=dodManual();d[el.dataset.i]=el.checked;saveJson(K.dod,d);render('dod');
  });

  const addBtn=document.getElementById('addBlocker');
  if(addBtn)addBtn.onclick=()=>{
    const source=document.getElementById('blSource').value.trim();
    const description=document.getElementById('blDesc').value.trim();
    const severity=document.getElementById('blSeverity').value;
    const owner=document.getElementById('blOwner').value.trim();
    const due=document.getElementById('blDue').value;
    const comment=document.getElementById('blComment').value.trim();
    if(!source||!description||!assignedOwner(owner)||!due){alert('Заполните источник, описание, ответственного и срок');return;}
    const list=blockers();
    list.push({id:'bl-'+Date.now().toString(36),source,description,severity,owner,due,status:'Открыт',comment});
    saveJson(K.blockers,list);render('issues');
  };

  document.querySelectorAll('.blField').forEach(el=>el.onchange=()=>patchBlocker(el.dataset.id,el.dataset.key,el.value,true));
  document.querySelectorAll('.delBlocker').forEach(el=>el.onclick=()=>{
    if(!confirm('Удалить блокер?'))return;
    saveJson(K.blockers,blockers().filter(b=>b.id!==el.dataset.id));render('issues');
  });
}

function updateClock(){
  clearInterval(clockTimer);
  const el=document.getElementById('projectTimer');
  if(!el||!started())return;
  const tick=()=>{
    const t=Math.max(0,Math.floor((Date.now()-Number(localStorage.getItem(K.start)))/1000));
    const d=Math.floor(t/86400),h=Math.floor((t%86400)/3600),m=Math.floor((t%3600)/60),s=t%60,p=n=>String(n).padStart(2,'0');
    el.textContent=`${d} дн. ${p(h)}:${p(m)}:${p(s)}`;
  };
  tick();clockTimer=setInterval(tick,1000);
}

async function api(method,params='',body){
  let session=window.ATOMAuthSession||null;
  if(!session&&window.ATOMAuth?.getSession)session=await window.ATOMAuth.getSession();
  const token=session?.access_token||'';
  if(!token)throw new Error('Нет активной авторизации');
  const r=await fetch(`${API}?table=ca_sync_state${params?'&'+params:''}`,{
    method,
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:body?JSON.stringify(body):undefined
  });
  if(!r.ok)throw new Error(await r.text());
  const text=await r.text();return text?JSON.parse(text):null;
}
function remoteRowsOnly(rows){return (Array.isArray(rows)?rows:[]).filter(r=>CLOUD_KEYS.includes(r.key));}
function compareIso(a,b){if(!a&&!b)return 0;if(!a)return -1;if(!b)return 1;return new Date(a).getTime()-new Date(b).getTime();}
function scheduleSync(){
  if(!hydrated)return;
  clearTimeout(syncTimer);setSync('Сохраняется...','work');syncTimer=setTimeout(pushPending,180);
}
async function pushPending(){
  if(pushing||!hydrated||!pendingKeys.size)return;
  pushing=true;
  const keys=[...pendingKeys];
  const sent=keys.map(key=>({key,value:localStorage.getItem(key),updated_at:localTs(key)||nowIso()})).filter(r=>r.value!==null);
  const sentTs=Object.fromEntries(sent.map(r=>[r.key,r.updated_at]));
  try{
    if(sent.length)await api('POST','on_conflict=key',sent);
    keys.forEach(key=>{if(localTs(key)===sentTs[key])pendingKeys.delete(key);});
    setSync(syncOkLabel());
  }catch(e){
    console.error('BCC sync push failed',e);setSync('Ошибка синхронизации','error');
  }finally{
    pushing=false;
    if(pendingKeys.size){clearTimeout(syncTimer);syncTimer=setTimeout(pushPending,1200);}
  }
}
async function hydrate(){
  try{
    setSync('Синхронизация...','work');
    const rows=remoteRowsOnly(await api('GET','select=key,value,updated_at&order=updated_at.asc'));
    const remote=new Map(rows.map(r=>[r.key,r]));
    let changed=false;
    CLOUD_KEYS.forEach(key=>{
      const localValue=localStorage.getItem(key),localUpdated=localTs(key),r=remote.get(key);
      if(!r){if(localValue!==null)pendingKeys.add(key);return;}
      if(localValue===null){setFromRemote(key,r.value,r.updated_at);changed=true;return;}
      if(localUpdated&&compareIso(localUpdated,r.updated_at)>0){pendingKeys.add(key);return;}
      if(localValue!==r.value||!localUpdated){setFromRemote(key,r.value,r.updated_at);changed=true;}
    });
    hydrated=true;
    if(pendingKeys.size)await pushPending();
    else setSync(syncOkLabel());
    const ownersChanged=normalizeCurrentTaskOwners(true);
    if(changed||ownersChanged)render(currentView);
  }catch(e){
    console.error('BCC sync hydrate failed',e);hydrated=true;setSync('Локальный режим','error');
  }
}
async function pullRemote(){
  if(!hydrated||pushing||pendingKeys.size)return;
  try{
    const rows=remoteRowsOnly(await api('GET','select=key,value,updated_at&order=updated_at.asc'));
    let changed=false;
    rows.forEach(r=>{
      if(pendingKeys.has(r.key))return;
      const lv=localStorage.getItem(r.key),lt=localTs(r.key);
      if(lv===null||!lt||compareIso(r.updated_at,lt)>0){
        if(lv!==r.value)changed=true;
        setFromRemote(r.key,r.value,r.updated_at);
      }
    });
    const ownersChanged=normalizeCurrentTaskOwners(true);
    if(changed||ownersChanged)render(currentView);
    setSync(syncOkLabel());
  }catch(e){
    console.error('BCC sync pull failed',e);setSync('Локальный режим','error');
  }
}

let appBooted=false;
window.addEventListener('storage',e=>{if(appBooted&&CLOUD_KEYS.includes(e.key))render(currentView);});
window.addEventListener('hashchange',()=>{if(appBooted)render(viewFromHash(),false);});
window.startAtomBccApp=()=>{
  if(appBooted)return;
  appBooted=true;
  ensureB2BTeam();
  normalizeCurrentTaskOwners(false);
  updateBuildTimestamp();
  currentView=viewFromHash();
  render(currentView,false);
  hydrate();
  setInterval(pullRemote,15000);
};
