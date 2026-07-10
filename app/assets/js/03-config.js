function loadConfig(){
  const s=localStorage.getItem('cellstock_cfg');
  if(!s) return;
  config=JSON.parse(s);
  document.getElementById('username-display').textContent=config.username||'';
  document.getElementById('f-operator').value=config.username||'';
  document.getElementById('r-registrant').value=config.username||'';
  if(config.bannerText) document.getElementById('lab-banner').textContent=config.bannerText;
  if(Array.isArray(config.maintDewars) && config.maintDewars.length){
    MAINT_DEWARS = Array.from(new Set(['Dewar 1', ...config.maintDewars]));
  }
}

function saveConfig(){
  try {
    localStorage.setItem('cellstock_cfg',JSON.stringify(config));
  } catch(e) {
    console.error('無法保存設置:', e);
    console.warn('localStorage 可能不可用或已滿');
  }
}

function _populateSelectFromDewarCfg(rackEl, boxEl, dewarName){
  if(!dewarName || dewarName==='other') return;
  const cfg=getDewarConfig(dewarName);
  if(rackEl){
    const cur=rackEl.value;
    rackEl.innerHTML='<option value="">'+tr('opt_choose')+'</option>'+
      cfg.racks.map(r=>'<option value="'+escHtml(r)+'">'+escHtml(r)+'</option>').join('')+
      '<option value="other">'+tr('opt_other_fill')+'</option>';
    if(cfg.racks.includes(cur)||cur==='other') rackEl.value=cur;
  }
  if(boxEl){
    const cur=boxEl.value;
    boxEl.innerHTML='<option value="">'+tr('opt_choose')+'</option>'+
      cfg.boxes.map(b=>'<option value="'+escHtml(b)+'">'+escHtml(b)+'</option>').join('')+
      '<option value="other">'+tr('opt_other_fill')+'</option>';
    if(cfg.boxes.includes(cur)||cur==='other') boxEl.value=cur;
  }
}

function populateDewarSelectors(){
  const rdewar = document.getElementById('r-dewar');
  const rRack  = document.getElementById('r-rack');
  const rBox   = document.getElementById('r-box');
  if(rdewar){
    const current = rdewar.value;
    rdewar.innerHTML = '<option value="">'+tr('opt_choose')+'</option>' + MAINT_DEWARS.map(d => '<option value="'+escHtml(d)+'">'+escHtml(d)+'</option>').join('') + '<option value="other">'+tr('opt_other_fill')+'</option>';
    if(MAINT_DEWARS.includes(current)||current==='other') rdewar.value = current;
    rdewar.onchange = function(){
      const v=this.value;
      _populateSelectFromDewarCfg(rRack, rBox, v);
      if(v && v!=='other') BOX_GRID_N=getDewarConfig(v).gridN;
      buildRegBoxGrid();
    };
    const initDewar=MAINT_DEWARS.includes(rdewar.value)?rdewar.value:null;
    if(initDewar) _populateSelectFromDewarCfg(rRack, rBox, initDewar);
  }
  const fnew = document.getElementById('f-new-dewar');
  const fRack = document.getElementById('f-new-rack');
  const fBox  = document.getElementById('f-new-box');
  if(fnew){
    const current = fnew.value;
    fnew.innerHTML = '<option value="">'+tr('opt_choose')+'</option>' + MAINT_DEWARS.map(d => '<option>'+escHtml(d)+'</option>').join('');
    if(MAINT_DEWARS.includes(current)) fnew.value = current;
    fnew.onchange = function(){
      _populateSelectFromDewarCfg(fRack, fBox, this.value);
      updateNewLocGrid();
    };
    const initFDewar=MAINT_DEWARS.includes(fnew.value)?fnew.value:null;
    if(initFDewar) _populateSelectFromDewarCfg(fRack, fBox, initFDewar);
  }
  const mdewar = document.getElementById('m-dewar');
  if(mdewar){
    const current = mdewar.value || maintState.dewar;
    mdewar.innerHTML = MAINT_DEWARS.map(d => '<option value="'+escHtml(d)+'">'+escHtml(d)+'</option>').join('');
    if(MAINT_DEWARS.includes(current)) mdewar.value = current;
  }
}

function saveBannerText(){
  const text=document.getElementById('maint-banner-input').value.trim();
  if(!text) return;
  config.bannerText=text;
  saveConfig();
  document.getElementById('lab-banner').textContent=text;
  showToast(tr('toast_banner_saved'));
}

function syncMaintLangSelect(){
  const sel=document.getElementById('maint-lang-select');
  if(sel) sel.value=(serverDefaultLang==='zh'?'zh':'en');
}

async function saveDefaultLang(){
  const sel=document.getElementById('maint-lang-select');
  if(!sel) return;
  const lang=sel.value==='zh'?'zh':'en';
  try{
    const res=await apiPost('set_default_lang',{lang});
    applyServerState(res.state);
    setLang(lang);
    showToast(tr('toast_lang_saved'));
  }catch(e){
    console.error('更新預設語言失敗：',e);
    showApiError(tr('toast_lang_saved'),e);
  }
}
