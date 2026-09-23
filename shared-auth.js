(()=>{
'use strict';

const SUPABASE_URL='https://enlyiedwkarajvfsilel.supabase.co';
const SUPABASE_KEY='sb_publishable_YK0GMEpWNTnEp3ImIvONKQ_3IPZdvq5';
const SEND_ENDPOINT=SUPABASE_URL+'/functions/v1/atom-magic-auth';
const AUTH_ENDPOINT=SUPABASE_URL+'/functions/v1/atom-auth';
const STORAGE_KEY='atom-sales-plan-auth';
const LEGACY_ACCESS='atom_access_token';
const LEGACY_REFRESH='atom_refresh_token';
const SHARED_KEY='atom-global-auth-v1';

const readJson=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
const domainOk=e=>/^[^@\s]+@atom\.team$/i.test(String(e||'').trim());

function persist(session){
  if(!session?.access_token)return;
  localStorage.setItem(LEGACY_ACCESS,session.access_token);
  if(session.refresh_token)localStorage.setItem(LEGACY_REFRESH,session.refresh_token);
  localStorage.setItem(SHARED_KEY,JSON.stringify({
    access_token:session.access_token,
    refresh_token:session.refresh_token||'',
    updated_at:Date.now()
  }));
}
function legacy(){
  const x=readJson(SHARED_KEY)||{};
  return {
    access_token:localStorage.getItem(LEGACY_ACCESS)||x.access_token||'',
    refresh_token:localStorage.getItem(LEGACY_REFRESH)||x.refresh_token||''
  };
}
function clearLegacy(){
  localStorage.removeItem(LEGACY_ACCESS);
  localStorage.removeItem(LEGACY_REFRESH);
  localStorage.removeItem(SHARED_KEY);
}
function callbackTokens(){
  const q=new URLSearchParams(location.search);
  const h=new URLSearchParams(location.hash.replace(/^#/,''));
  const get=k=>h.get(k)||q.get(k)||'';
  return {access_token:get('access_token'),refresh_token:get('refresh_token')};
}
async function post(url,body){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw new Error(d.error||d.msg||'auth_failed');
  return d;
}

const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true,
    flowType:'implicit',
    storageKey:STORAGE_KEY
  }
});
window.ATOMSharedSupabase=client;

async function validate(session){
  if(!session?.access_token)return null;
  const localUser=session.user||null;
  if(domainOk(localUser?.email)){
    persist(session);
    return {client,session,user:localUser};
  }
  try{
    const {data,error}=await client.auth.getUser(session.access_token);
    if(error)throw error;
    const user=data.user||null;
    if(!domainOk(user?.email))return null;
    persist(session);
    return {client,session,user};
  }catch{return null}
}

async function restore(){
  const cb=callbackTokens();
  if(cb.access_token&&cb.refresh_token){
    try{
      const {data,error}=await client.auth.setSession(cb);
      if(!error&&data.session){
        const ok=await validate(data.session);
        if(ok)return ok;
      }
    }catch{}
  }

  try{
    const {data,error}=await client.auth.getSession();
    if(!error&&data.session){
      const ok=await validate(data.session);
      if(ok)return ok;
    }
  }catch{}

  const old=legacy();
  if(old.access_token&&old.refresh_token){
    try{
      const {data,error}=await client.auth.setSession(old);
      if(!error&&data.session){
        const ok=await validate(data.session);
        if(ok)return ok;
      }
    }catch{}
  }

  if(old.refresh_token){
    try{
      const d=await post(AUTH_ENDPOINT,{action:'refresh',refresh_token:old.refresh_token});
      if(d.access_token&&d.refresh_token){
        const {data,error}=await client.auth.setSession({access_token:d.access_token,refresh_token:d.refresh_token});
        if(!error&&data.session){
          const ok=await validate(data.session);
          if(ok)return ok;
        }
      }
    }catch{}
  }

  return null;
}

const ready=restore();
window.ATOM_AUTH_READY=ready;

window.ATOMAuth={
  client,
  ready,
  async get(){
    const r=await ready;
    if(r)return r;
    try{
      const {data}=await client.auth.getSession();
      return data.session?await validate(data.session):null;
    }catch{return null}
  },
  async send(email,redirectTo){
    email=String(email||'').trim().toLowerCase();
    if(!domainOk(email))throw new Error('domain_not_allowed');
    const redirect=redirectTo||location.origin+'/production-and-sales-plan/';
    localStorage.setItem('atom-auth-next',location.pathname+location.search);
    const {data,error}=await client.auth.signInWithOtp({
      email,
      options:{shouldCreateUser:true,emailRedirectTo:redirect}
    });
    if(error)throw error;
    return data;
  },
  async signOut(){
    try{await client.auth.signOut({scope:'local'})}catch{}
    clearLegacy();
  }
};

client.auth.onAuthStateChange((event,session)=>{
  if(session)persist(session);
});
})();