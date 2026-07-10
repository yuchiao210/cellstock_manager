(async function init(){
  loadConfig();
  currentLang=localStorage.getItem('cellstock_lang')||serverDefaultLang||'en';
  await loadData();
  syncStorageConfigWithData();
  populateDewarSelectors();
  buildQCList();
  document.getElementById('back-btn').addEventListener('click',goBack);
  document.getElementById('fwd-btn').addEventListener('click',goForward);
  document.getElementById('back-btn').disabled=true;
  document.getElementById('fwd-btn').disabled=true;
  document.getElementById('back-btn').style.opacity='0.3';
  document.getElementById('fwd-btn').style.opacity='0.3';
  setLang(currentLang,!!localStorage.getItem('cellstock_lang'));
  if(!config.username)openNameModal(false);
  initNameAutocomplete();
  document.getElementById('r-serum').value='10% FBS';
  document.getElementById('r-abx').value='100 U/mL Pen/Strep';
  document.getElementById('r-cryo').value='7% DMSO + DMEM';
  document.getElementById('r-registrant').value=config.username||'';
  setInterval(()=>{
    if(document.visibilityState==='visible') loadData();
  },30000);
})();
