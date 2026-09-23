(()=>{
'use strict';

const SUPABASE_URL='https://enlyiedwkarajvfsilel.supabase.co';
const SUPABASE_KEY='sb_publishable_YK0GMEpWNTnEp3ImIvONKQ_3IPZdvq5';
const AUTH_ENDPOINT=SUPABASE_URL+'/functions/v1/atom-auth';
const STORAGE_KEY='atom-sales-plan-auth';
const SHARED_AUTH_KEY='atom-global-auth-v1';

const readJson=(key)=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const saveTokens=(session)=>{
  if(!session?.access_token)return;
  localStorage.setItem('atom_access_token',session.access_token);
  if(session.refresh_token)localStorage.setItem('atom_refresh_token',session.refresh_token);
  localStorage.setItem(SHARED_AUTH_KEY,JSON.stringify({
    access_token:session.access_token,
    refresh_token:session.refresh_token||'',
    updated_at:Date.now()
  }));
};
const callbackTokens=()=>{
  const q=new URLSearchParams(location.search);
  const h=new URLSearchParams(location.hash.replace(/^#/,''));
  const get=k=>h.get(k)||q.get(k)||'';
  return {access_token:get('access_token'),refresh_token:get('refresh_token')};
};
const legacyTokens=()=>{
  const shared=readJson(SHARED_AUTH_KEY)||{};
  return {
    access_token:localStorage.getItem('atom_access_token')||shared.access_token||'',
    refresh_token:localStorage.getItem('atom_refresh_token')||shared.refresh_token||''
  };
};
async function callAuth(body){
  const r=await fetch(AUTH_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data={};
  try{data=await r.json()}catch{}
  if(!r.ok)throw new Error(data.error||'auth_failed');
  return data;
}

window.ATOM_AUTH_READY=(async()=>{
  if(!window.supabase?.createClient)return null;
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

  client.auth.onAuthStateChange((event,session)=>{
    if(session)saveTokens(session);
  });

  try{
    const cb=callbackTokens();
    if(cb.access_token&&cb.refresh_token){
      const {data,error}=await client.auth.setSession(cb);
      if(!error&&data.session){
        saveTokens(data.session);
        return {client,session:data.session,user:data.user||null};
      }
    }

    const {data:existing,error:existingError}=await client.auth.getSession();
    if(!existingError&&existing.session){
      saveTokens(existing.session);
      return {client,session:existing.session,user:existing.session.user||null};
    }

    const legacy=legacyTokens();
    if(legacy.access_token&&legacy.refresh_token){
      const {data,error}=await client.auth.setSession(legacy);
      if(!error&&data.session){
        saveTokens(data.session);
        return {client,session:data.session,user:data.user||null};
      }
    }

    if(legacy.refresh_token){
      try{
        const refreshed=await callAuth({action:'refresh',refresh_token:legacy.refresh_token});
        if(refreshed.access_token&&refreshed.refresh_token){
          const {data,error}=await client.auth.setSession({
            access_token:refreshed.access_token,
            refresh_token:refreshed.refresh_token
          });
          if(!error&&data.session){
            saveTokens(data.session);
            return {client,session:data.session,user:data.user||null};
          }
        }
      }catch{}
    }

    if(legacy.access_token){
      try{
        const checked=await callAuth({action:'check',access_token:legacy.access_token});
        if(checked.allowed){
          return {client,session:{access_token:legacy.access_token,refresh_token:legacy.refresh_token||''},user:{email:checked.email}};
        }
      }catch{}
    }
  }catch(e){
    console.error('Shared auth bootstrap failed',e);
  }
  return null;
})();
})();