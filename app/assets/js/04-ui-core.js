function toggleLang(){setLang(currentLang==='zh'?'en':'zh');}
function tr(key,params){
  let text=(I18N[currentLang]&&I18N[currentLang][key])||(I18N.zh&&I18N.zh[key])||key;
  if(params) Object.keys(params).forEach(k=>{text=String(text).replaceAll('{'+k+'}',params[k]);});
  return text;
}
function setLang(lang,persist=true){
  currentLang=lang;
  if(persist) localStorage.setItem('cellstock_lang',lang);
  const t=I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.getAttribute('data-i18n');
    if(t[k]!==undefined) el.innerHTML=t[k];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const k=el.getAttribute('data-i18n-placeholder');
    if(t[k]!==undefined) el.placeholder=t[k];
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{
    const k=el.getAttribute('data-i18n-title');
    if(t[k]!==undefined) el.title=t[k];
  });
  document.querySelectorAll('[data-lang-toggle]').forEach(btn=>{btn.textContent=lang==='zh'?'EN':'中文';});
  document.documentElement.lang=lang==='zh'?'zh-TW':'en';
  if(typeof populateDewarSelectors==='function') populateDewarSelectors();
  if(typeof buildQCList==='function') buildQCList();
  if(typeof updateRegSelectionUI==='function') updateRegSelectionUI();
  if(typeof toggleSourceOther==='function') toggleSourceOther();
  if(typeof renderCard==='function'&&currentCell) renderCard();
  if(document.getElementById('page-log')&&document.getElementById('page-log').classList.contains('active')&&typeof renderGlobalLog==='function') renderGlobalLog();
  const maintPage=document.getElementById('page-maintenance');
  if(maintPage&&maintPage.classList.contains('active')&&typeof renderMaintenancePage==='function') renderMaintenancePage();
  if(document.getElementById('page-issues')&&document.getElementById('page-issues').classList.contains('active')) renderIssuePage();
}

function openNameModal(allowCancel=false){
  document.getElementById('name-cancel-btn').style.display=allowCancel?'block':'none';
  document.getElementById('name-input').value=config.username||'';
  document.getElementById('name-error').style.display='none';
  document.getElementById('name-modal').classList.add('open');
  setTimeout(()=>document.getElementById('name-input').focus(),100);
}
function closeNameModal(){document.getElementById('name-modal').classList.remove('open');}

function openChangePasswordModal(){
  document.getElementById('old-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  document.getElementById('change-password-error').style.display = 'none';
  document.getElementById('change-password-modal').classList.add('open');
  setTimeout(() => document.getElementById('old-password').focus(), 100);
}

function closeChangePasswordModal(){
  document.getElementById('change-password-modal').classList.remove('open');
}

async function changePassword(){
  const oldPwd = document.getElementById('old-password').value;
  const newPwd = document.getElementById('new-password').value;
  const confirmPwd = document.getElementById('confirm-password').value;
  const errorDiv = document.getElementById('change-password-error');

  if (newPwd.length < 6) {
    errorDiv.textContent = I18N[currentLang].error_password_too_short;
    errorDiv.style.display = 'block';
    return;
  }

  if (newPwd !== confirmPwd) {
    errorDiv.textContent = I18N[currentLang].error_password_mismatch;
    errorDiv.style.display = 'block';
    return;
  }

  try{
    await apiPost('change_admin_password',{old_password:oldPwd,new_password:newPwd});
    errorDiv.style.display = 'none';
    closeChangePasswordModal();
    showToast(I18N[currentLang].toast_password_changed);
  }catch(e){
    errorDiv.textContent = e.message || I18N[currentLang].error_old_password;
    errorDiv.style.display = 'block';
  }
}

function saveName(){
  const name=document.getElementById('name-input').value.trim();
  const err=document.getElementById('name-error');
  const inp=document.getElementById('name-input');
  if(!name){inp.classList.add('error');err.style.display='block';setTimeout(()=>inp.classList.remove('error'),1500);return;}
  const chCount=(name.match(/[一-鿿]/g)||[]).length;
  const latinCount=(name.match(/[A-Za-z]/g)||[]).length;
  const invalidEnglishName=currentLang==='en'&&(latinCount<2||!/^[A-Za-z][A-Za-z\s'.-]*$/.test(name));
  if((currentLang==='zh'&&chCount<2)||invalidEnglishName){inp.classList.add('error');err.style.display='block';setTimeout(()=>inp.classList.remove('error'),1500);return;}
  err.style.display='none';
  config.username=name;
  localStorage.setItem('cellstock_cfg',JSON.stringify(config));
  document.getElementById('username-display').textContent=name;
  document.getElementById('f-operator').value=name;
  document.getElementById('r-registrant').value=name;
  closeNameModal();
  showToast(tr('toast_name_saved',{name}));
}

function switchPage(name){
  if(name==='maintenance' && !isAdminMaintenance){openAdminModal('maint');return;}
  if(name==='issues' && !transientAdminAuth && !isAdminMaintenance){openAdminModal('issues');return;}
  if(name==='issues' && transientAdminAuth && typeof loadIssueReports==='function') loadIssueReports().catch(()=>{});
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  const idx=['search','register','space','log','issues','maintenance'].indexOf(name);
  if(idx>=0) document.querySelectorAll('.nav-tab')[idx].classList.add('active');
  if(name==='log'){logCurrentPage=0;renderGlobalLog();}
  if(name==='space') renderSpacePage();
  if(name==='issues') renderIssuePage();
  if(name==='maintenance') renderMaintenancePage();
}

function renderSpacePage(){
  const capacity=boxSlotCapacity();
  const map={};
  getStorageLocations().forEach(loc=>{
    if(!map[loc.dewar])map[loc.dewar]={};
    if(!map[loc.dewar][loc.rack])map[loc.dewar][loc.rack]={};
    if(!map[loc.dewar][loc.rack][loc.box])map[loc.dewar][loc.rack][loc.box]=new Set();
  });
  cellDb.forEach(cell=>(cell.locations||[]).forEach(loc=>{
    if(!map[loc.dewar])map[loc.dewar]={};
    if(!map[loc.dewar][loc.rack])map[loc.dewar][loc.rack]={};
    if(!map[loc.dewar][loc.rack][loc.box])map[loc.dewar][loc.rack][loc.box]=new Set();
    (loc.occupied||[]).forEach(p=>map[loc.dewar][loc.rack][loc.box].add(p));
  }));
  let totalSlots=0,totalOccupied=0;
  Object.values(map).forEach(dewar=>Object.values(dewar).forEach(rack=>Object.values(rack).forEach(occ=>{totalSlots+=capacity;totalOccupied+=occ.size;})));
  const totalFree=totalSlots-totalOccupied;
  const t=I18N[currentLang];
  document.getElementById('space-summary').innerHTML=[
    ['var(--accent)',totalFree,t.stat_free],
  ].map(([color,num,lbl])=>`<div class="space-stat"><div class="space-stat-num" style="color:${color}">${num}</div><div class="space-stat-lbl">${lbl}</div></div>`).join('');
  document.getElementById('space-content').innerHTML='';
}

function showToast(msg){
  document.getElementById('toast-msg').textContent=msg;
  const t=document.getElementById('toast');
  t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);
}
function showErrorPanel(msg,title){
  title=title||tr('api_error_title');
  const text=String(msg||tr('unknown_error'));
  localStorage.setItem('cellstock_last_import_error',text);
  document.getElementById('error-panel-title').textContent=title;
  document.getElementById('error-panel-body').textContent=text;
  document.getElementById('error-panel').classList.add('open');
}
function showApiError(title,err){
  const apiDetail=localStorage.getItem('cellstock_last_api_error')||'';
  const msg=title+'：'+(err&&err.message?err.message:String(err||tr('unknown_error')))+(apiDetail?'\n\nAPI detail:\n'+apiDetail:'');
  showToast(tr('toast_api_error_detail',{title}));
  showErrorPanel(msg,title);
}
function hideErrorPanel(){
  document.getElementById('error-panel').classList.remove('open');
}
async function copyLastError(){
  const text=document.getElementById('error-panel-body').textContent||localStorage.getItem('cellstock_last_import_error')||'';
  try{
    await navigator.clipboard.writeText(text);
    showToast(tr('toast_error_copied'));
  }catch(_){
    window.prompt(tr('prompt_copy_error'),text);
  }
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.search-wrap'))document.getElementById('search-results').classList.remove('open');
  if(!e.target.closest('.maint-search-wrap')){
    const maintSearch=document.getElementById('maint-search-results');
    if(maintSearch) maintSearch.classList.remove('open');
  }
  if(!e.target.closest('.modal')&&!e.target.closest('[onclick*="openAdminModal"]')&&!e.target.closest('[onclick*="openNameModal"]'))
    document.getElementById('admin-modal').classList.remove('open');
});
