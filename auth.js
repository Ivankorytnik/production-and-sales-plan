(()=>{
  'use strict';

  const SUPABASE_URL='https://enlyiedwkarajvfsilel.supabase.co';
  const SUPABASE_KEY='sb_publishable_YK0GMEpWNTnEp3ImIvONKQ_3IPZdvq5';
  const REDIRECT_URL='https://ivankorytnik.github.io/production-and-sales-plan/';
  const ALLOWED_DOMAIN='atom.team';

  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });

  const $=id=>document.getElementById(id);
  const gate=$('authGate');
  const app=$('protectedApp');
  const form=$('authForm');
  const emailInput=$('authEmail');
  const submit=$('authSubmit');
  const message=$('authMessage');
  const userEmail=$('authUserEmail');
  const logout=$('logoutBtn');

  function isAllowed(email){
    return String(email||'').trim().toLowerCase().endsWith('@'+ALLOWED_DOMAIN);
  }

  function setMessage(text,type=''){
    message.textContent=text||'';
    message.className='auth-message'+(type?' '+type:'');
  }

  function showGate(text=''){
    document.body.classList.remove('auth-ok');
    document.body.classList.add('auth-pending');
    if(gate)gate.hidden=false;
    if(app)app.hidden=true;
    if(text)setMessage(text,'error');
  }

  function showApp(email){
    if(!isAllowed(email)){
      client.auth.signOut();
      showGate('Доступ разрешен только для адресов @atom.team');
      return;
    }
    document.body.classList.remove('auth-pending');
    document.body.classList.add('auth-ok');
    if(gate)gate.hidden=true;
    if(app)app.hidden=false;
    if(userEmail)userEmail.textContent=email;
  }

  async function syncSession(){
    const {data:{session},error}=await client.auth.getSession();
    if(error){showGate('Не удалось проверить сессию. Повторите вход.');return;}
    if(session?.user?.email) showApp(session.user.email);
    else showGate();
  }

  form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=String(emailInput.value||'').trim().toLowerCase();
    if(!isAllowed(email)){
      setMessage('Используйте корпоративную почту вида name@atom.team','error');
      return;
    }
    submit.disabled=true;
    setMessage('Отправляем ссылку...','pending');
    const {error}=await client.auth.signInWithOtp({
      email,
      options:{emailRedirectTo:REDIRECT_URL,shouldCreateUser:true}
    });
    submit.disabled=false;
    if(error){
      setMessage(error.message||'Не удалось отправить письмо.','error');
      return;
    }
    setMessage('Письмо отправлено. Откройте ссылку из письма на этом устройстве.','success');
  });

  logout?.addEventListener('click',async()=>{
    await client.auth.signOut();
    location.replace(REDIRECT_URL);
  });

  client.auth.onAuthStateChange((_event,session)=>{
    if(session?.user?.email) showApp(session.user.email);
    else if(_event==='SIGNED_OUT') showGate();
  });

  syncSession();
})();
