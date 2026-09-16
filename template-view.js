(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  function numText(el){
    const t=el?.textContent||'';
    const m=t.replace(/\s/g,'').match(/-?\d+(?:[.,]\d+)?/);
    return m?Number(m[0].replace(',','.')):0;
  }
  function relabelKpis(){
    const grid=$('kpiGrid');
    const table=$('verticalTable');
    if(!grid||!table)return;
    const rows=[...table.querySelectorAll('tbody tr')];
    const by={};
    rows.forEach(r=>{
      const c=[...r.querySelectorAll('td')];
      if(!c.length)return;
      const name=(c[0].textContent||'').trim();
      const total=numText(c[c.length-1]);
      by[name]=total;
    });
    const total=Object.values(by).reduce((a,b)=>a+(Number(b)||0),0);
    const cards=[
      ['ПЛАН ПРОДАЖ',total,'2026'],
      ['B2C',by.B2C||0,'авто'],
      ['B2B',by.B2B||0,'авто'],
      ['B2G',by.B2G||0,'авто'],
      ['CARSHARING',by.Carsharing||0,'авто']
    ];
    grid.innerHTML=cards.map(([l,v,s])=>`<div class="kpi"><span>${l}</span><strong>${new Intl.NumberFormat('ru-RU').format(v)}</strong><small>${s}</small></div>`).join('');
  }
  function renameClientHeaders(){
    const t=$('clientTable');
    if(!t)return;
    const th=[...t.querySelectorAll('thead th')];
    if(th[0])th[0].textContent='Слой';
    if(th[1])th[1].textContent='Компания / проект';
  }
  const target=$('reportSection');
  if(target){
    new MutationObserver(()=>{relabelKpis();renameClientHeaders()}).observe(target,{subtree:true,childList:true,characterData:true});
  }
})();