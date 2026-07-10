function maintToggleOther(selId,inpId){
  const sel=document.getElementById(selId);
  const inp=document.getElementById(inpId);
  if(!sel||!inp) return;
  if(sel.value==='other'){inp.style.display='block';inp.focus();}
  else{inp.style.display='none';inp.value='';}
}

function maintGetVal(selId){
  const el=document.getElementById(selId);
  if(!el) return '';
  if(el.tagName==='SELECT'){
    if(el.value==='other'){
      const inp=document.getElementById(selId+'-other');
      return inp?inp.value.trim():'';
    }
    return el.value;
  }
  return el.value.trim();
}

function maintSetVal(selId,value){
  const sel=document.getElementById(selId);
  if(!sel) return;
  if(sel.tagName!=='SELECT'){sel.value=value||'';return;}
  const otherInp=document.getElementById(selId+'-other');
  if(!value){
    sel.selectedIndex=0;
    if(otherInp){otherInp.value='';otherInp.style.display='none';}
    return;
  }
  sel.value=value;
  if(sel.value===value){
    if(otherInp){otherInp.value='';otherInp.style.display='none';}
    return;
  }
  const byText=Array.from(sel.options).find(o=>o.textContent.trim().toLowerCase()===value.toLowerCase()&&o.value!=='other');
  if(byText){
    sel.value=byText.value;
    if(otherInp){otherInp.value='';otherInp.style.display='none';}
    return;
  }
  const hasOther=Array.from(sel.options).some(o=>o.value==='other');
  if(hasOther&&otherInp){
    sel.value='other';
    otherInp.value=value;
    otherInp.style.display='block';
  } else {
    sel.selectedIndex=0;
  }
}

function populateMaintOperatorSelect(){
  const sel=document.getElementById('maint-edit-registrant');
  if(!sel) return;
  const names=new Set();
  if(config.username) names.add(config.username);
  operatorDb.forEach(n=>{if(n) names.add(n);});
  cellDb.forEach(cell=>{if(cell.registrant) names.add(cell.registrant);});
  sel.innerHTML='<option value="">'+tr('maint_op_select')+'</option>'+
    Array.from(names).sort().map(n=>'<option value="'+escHtml(n)+'">'+escHtml(n)+'</option>').join('')+
    '<option value="other">'+tr('opt_other_manual')+'</option>';
}

function initMaintDateSelects(){
  const yearSel=document.getElementById('maint-date-year');
  if(!yearSel||yearSel.options.length>1) return;
  const cur=new Date().getFullYear();
  for(let y=cur;y>=cur-20;y--){
    const opt=document.createElement('option');
    opt.value=y;opt.textContent=y+tr('unit_year');
    yearSel.appendChild(opt);
  }
}

function maintUpdateDays(){
  const yearSel=document.getElementById('maint-date-year');
  const monthSel=document.getElementById('maint-date-month');
  const daySel=document.getElementById('maint-date-day');
  const prev=daySel.value;
  daySel.innerHTML='<option value="">'+tr('opt_day')+'</option>';
  const y=parseInt(yearSel.value),m=parseInt(monthSel.value);
  if(!y||!m) return;
  const total=new Date(y,m,0).getDate();
  for(let d=1;d<=total;d++){
    const opt=document.createElement('option');
    opt.value=d;opt.textContent=d+tr('unit_day');
    daySel.appendChild(opt);
  }
  if(prev&&parseInt(prev)<=total) daySel.value=prev;
}

function getMaintDateValue(){
  const y=document.getElementById('maint-date-year').value;
  const m=document.getElementById('maint-date-month').value;
  const d=document.getElementById('maint-date-day').value;
  if(!y||!m||!d) return '';
  const pad=n=>String(n).padStart(2,'0');
  return y+'-'+pad(m)+'-'+pad(d)+'T00:00:00.000Z';
}

function setMaintDateValue(dateStr){
  const yearSel=document.getElementById('maint-date-year');
  const monthSel=document.getElementById('maint-date-month');
  const daySel=document.getElementById('maint-date-day');
  yearSel.value='';monthSel.value='';
  daySel.innerHTML='<option value="">'+tr('opt_day')+'</option>';
  if(!dateStr) return;
  const dt=new Date(dateStr);
  if(isNaN(dt)) return;
  const y=dt.getFullYear(),mo=dt.getMonth()+1,dy=dt.getDate();
  if(!yearSel.querySelector('option[value="'+y+'"]')){
    const opt=document.createElement('option');
    opt.value=y;opt.textContent=y+tr('unit_year');
    yearSel.insertBefore(opt,yearSel.options[1]||null);
  }
  yearSel.value=y;
  monthSel.value=mo;
  maintUpdateDays();
  daySel.value=dy;
}

function openAddDewarModal(){
  document.getElementById('add-dewar-name').value='Dewar '+(MAINT_DEWARS.length+1);
  document.getElementById('add-dewar-racks').value=6;
  document.getElementById('add-dewar-boxes').value=5;
  document.getElementById('add-dewar-grid').value=5;
  document.getElementById('add-dewar-modal').classList.add('open');
  setTimeout(()=>document.getElementById('add-dewar-name').focus(),100);
}

function closeAddDewarModal(){
  document.getElementById('add-dewar-modal').classList.remove('open');
}

function confirmAddDewar(){
  const name=document.getElementById('add-dewar-name').value.trim();
  const rackCount=Math.max(1,Math.min(20,parseInt(document.getElementById('add-dewar-racks').value)||6));
  const boxCount=Math.max(1,Math.min(30,parseInt(document.getElementById('add-dewar-boxes').value)||5));
  const gridN=Math.max(2,Math.min(12,parseInt(document.getElementById('add-dewar-grid').value)||5));
  if(!name){showToast(tr('toast_dewar_name_invalid'));return;}
  if(MAINT_DEWARS.includes(name)){showToast(tr('toast_dewar_exists'));return;}
  const racks=Array.from({length:rackCount},(_,i)=>'Rack '+(i+1));
  const boxes=Array.from({length:boxCount},(_,i)=>'Box '+(i+1));
  try{
    MAINT_DEWARS.push(name);
    if(!config.dewarConfigs) config.dewarConfigs={};
    config.dewarConfigs[name]={racks,boxes,gridN};
    config.maintDewars=Array.from(new Set(MAINT_DEWARS));
    config.storageConfigVersion=STORAGE_CONFIG_VERSION;
    saveConfig();
    maintState.dewar=name;
    closeAddDewarModal();
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_dewar_added',{name,racks:rackCount,boxes:boxCount,grid:gridN}));
  }catch(e){
    console.error('新增 Dewar 失敗:',e);
    showApiError(tr('err_add_dewar'),e);
  }
}

async function batchRenameRacks(){
  const cfg=getDewarConfig(maintState.dewar);
  const racks=cfg.racks;
  // 偵測目前格式：尾端是數字 → 切換為字母，尾端是字母 → 切換為數字
  const isNumeric=racks.some(r=>/\s\d+$/.test(r));
  const renames=[];
  const newRacks=racks.map((r,i)=>{
    let newName;
    if(isNumeric){
      // "Rack 1" → "Rack A"
      newName=r.replace(/(\s)\d+$/,(_,sp)=>sp+String.fromCharCode(64+i+1));
    } else {
      // "Rack A" → "Rack 1"
      newName=r.replace(/(\s)[A-Za-z]$/,(_,sp)=>sp+(i+1));
    }
    if(newName!==r) renames.push({old:r,new:newName});
    return newName;
  });
  if(!renames.length){showToast(tr('toast_no_change'));return;}
  const preview=renames.slice(0,3).map(p=>p.old+'→'+p.new).join('、')+(renames.length>3?'…':'');
  if(!confirm(tr('confirm_batch_rename_racks',{preview}))) return;
  try{
    const res=await apiPost('maintenance_batch_rename_racks',{dewar:maintState.dewar,renames});
    applyServerState(res.state);
    cfg.racks=newRacks;
    if(!config.dewarConfigs) config.dewarConfigs={};
    config.dewarConfigs[maintState.dewar]=cfg;
    saveConfig();
    MAINT_RACKS=newRacks.slice();
    maintState.rack=newRacks[racks.indexOf(maintState.rack)]||newRacks[0];
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_rack_switched',{fmt:isNumeric?tr('fmt_letters'):tr('fmt_numbers')}));
  }catch(e){
    console.error('批次重新命名失敗：',e);
    showApiError(tr('err_batch_rename'),e);
    await loadData();syncStorageConfigWithData();populateDewarSelectors();renderMaintenancePage();
  }
}

async function promptRenameMaintenanceRack(){
  const rackSel=document.getElementById('m-rack');
  if(!rackSel) return;
  const oldName=rackSel.value||maintState.rack;
  const cfg=getDewarConfig(maintState.dewar);
  if(!oldName||!cfg.racks.includes(oldName)){showToast(tr('toast_select_valid_rack'));return;}
  const newName=window.prompt(tr('prompt_new_rack_name'),oldName);
  if(newName===null) return;
  const cleanName=newName.trim();
  if(!cleanName){showToast(tr('toast_rack_name_invalid'));return;}
  if(cleanName===oldName) return;
  if(cfg.racks.includes(cleanName)){showToast(tr('toast_rack_exists'));return;}
  try{
    const res=await apiPost('maintenance_rename_rack',{dewar:maintState.dewar,old_rack:oldName,new_rack:cleanName});
    applyServerState(res.state);
    cfg.racks=cfg.racks.map(r=>r===oldName?cleanName:r);
    if(!config.dewarConfigs) config.dewarConfigs={};
    config.dewarConfigs[maintState.dewar]=cfg;
    config.maintDewars=Array.from(new Set(MAINT_DEWARS));
    saveConfig();
    MAINT_RACKS=cfg.racks.slice();
    maintState.rack=cleanName;
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_rack_renamed',{name:cleanName}));
  }catch(e){
    console.error('Rack 重新命名失敗：',e);
    showApiError(tr('err_rack_rename'),e);
    await loadData();
    syncStorageConfigWithData();
    populateDewarSelectors();
    renderMaintenancePage();
  }
}

function removeMaintenanceRack(){
  const rackSel=document.getElementById('m-rack');
  if(!rackSel) return;
  const current=rackSel.value||maintState.rack;
  const cfg=getDewarConfig(maintState.dewar);
  if(!current||!cfg.racks.includes(current)){
    showToast(tr('toast_rack_invalid'));
    return;
  }
  const used=cellDb.some(cell=>
    (cell.locations||[]).some(loc=>loc.dewar===maintState.dewar&&loc.rack===current)
  );
  if(used){
    showToast(tr('toast_rack_has_data'));
    return;
  }
  if(cfg.racks.length<=1){
    showToast(tr('toast_rack_keep_one'));
    return;
  }
  if(!confirm(tr('confirm_remove_rack',{name:current}))) return;
  try{
    cfg.racks=cfg.racks.filter(r=>r!==current);
    if(!config.dewarConfigs) config.dewarConfigs={};
    config.dewarConfigs[maintState.dewar]=cfg;
    config.storageConfigVersion=STORAGE_CONFIG_VERSION;
    saveConfig();
    MAINT_RACKS=cfg.racks.slice();
    maintState.rack=MAINT_RACKS[0];
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_rack_removed',{name:current}));
  }catch(e){
    console.error('移除 Rack 失敗:',e);
    showToast(tr('toast_rack_remove_failed',{message:e.message}));
  }
}

async function batchRenameBoxes(){
  const cfg=getDewarConfig(maintState.dewar);
  const boxes=cfg.boxes;
  const isNumeric=boxes.some(b=>/\s\d+$/.test(b));
  const renames=[];
  const newBoxes=boxes.map((b,i)=>{
    let newName;
    if(isNumeric){
      newName=b.replace(/(\s)\d+$/,(_,sp)=>sp+String.fromCharCode(64+i+1));
    } else {
      newName=b.replace(/(\s)[A-Za-z]$/,(_,sp)=>sp+(i+1));
    }
    if(newName!==b) renames.push({old:b,new:newName});
    return newName;
  });
  if(!renames.length){showToast(tr('toast_no_change'));return;}
  const preview=renames.slice(0,3).map(p=>p.old+'→'+p.new).join('、')+(renames.length>3?'…':'');
  if(!confirm(tr('confirm_batch_rename_boxes',{preview}))) return;
  try{
    const res=await apiPost('maintenance_batch_rename_boxes',{dewar:maintState.dewar,rack:maintState.rack,renames});
    applyServerState(res.state);
    cfg.boxes=newBoxes;
    if(!config.dewarConfigs) config.dewarConfigs={};
    config.dewarConfigs[maintState.dewar]=cfg;
    saveConfig();
    MAINT_BOXES=newBoxes.slice();
    maintState.box=newBoxes[boxes.indexOf(maintState.box)]||newBoxes[0];
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_box_switched',{fmt:isNumeric?tr('fmt_letters'):tr('fmt_numbers')}));
  }catch(e){
    console.error('批次重新命名失敗：',e);
    showApiError(tr('err_batch_rename'),e);
    await loadData();syncStorageConfigWithData();populateDewarSelectors();renderMaintenancePage();
  }
}

async function promptRenameMaintenanceBox(oldName){
  const cfg=getDewarConfig(maintState.dewar);
  if(!oldName||!cfg.boxes.includes(oldName)){showToast(tr('toast_select_valid_box'));return;}
  const newName=window.prompt(tr('prompt_new_box_name'),oldName);
  if(newName===null) return;
  const cleanName=newName.trim();
  if(!cleanName){showToast(tr('toast_box_name_invalid'));return;}
  if(cleanName===oldName) return;
  if(cfg.boxes.includes(cleanName)){showToast(tr('toast_box_exists'));return;}
  try{
    const res=await apiPost('maintenance_rename_box',{dewar:maintState.dewar,rack:maintState.rack,old_box:oldName,new_box:cleanName});
    applyServerState(res.state);
    cfg.boxes=cfg.boxes.map(b=>b===oldName?cleanName:b);
    if(!config.dewarConfigs) config.dewarConfigs={};
    config.dewarConfigs[maintState.dewar]=cfg;
    saveConfig();
    MAINT_BOXES=cfg.boxes.slice();
    if(maintState.box===oldName) maintState.box=cleanName;
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_box_renamed',{name:cleanName}));
  }catch(e){
    console.error('Box 重新命名失敗：',e);
    showApiError(tr('err_box_rename'),e);
    await loadData();
    syncStorageConfigWithData();
    populateDewarSelectors();
    renderMaintenancePage();
  }
}

async function promptRenameMaintenanceDewar(){
  const dewarSel = document.getElementById('m-dewar');
  if(!dewarSel) return;
  const oldName = dewarSel.value || maintState.dewar;
  if(!oldName || !MAINT_DEWARS.includes(oldName)){
    showToast(tr('toast_select_valid_dewar'));
    return;
  }
  const newName = window.prompt(tr('prompt_new_dewar_name'), oldName);
  if(newName===null) return;
  const cleanName = newName.trim();
  if(!cleanName){
    showToast(tr('toast_dewar_name_invalid'));
    return;
  }
  if(cleanName===oldName) return;
  if(MAINT_DEWARS.includes(cleanName)){
    showToast(tr('toast_dewar_name_exists'));
    return;
  }
  try{
    const res=await apiPost('maintenance_rename_dewar',{old_dewar:oldName,new_dewar:cleanName});
    applyServerState(res.state);
    MAINT_DEWARS=MAINT_DEWARS.map(d=>d===oldName?cleanName:d);
    config.maintDewars=Array.from(new Set(MAINT_DEWARS));
    config.storageConfigVersion=STORAGE_CONFIG_VERSION;
    saveConfig();
    maintState.dewar=cleanName;
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_dewar_renamed',{name:cleanName}));
  }catch(e){
    console.error('Dewar 重新命名失敗：',e);
    showApiError(tr('err_dewar_rename'),e);
    await loadData();
    syncStorageConfigWithData();
    populateDewarSelectors();
    renderMaintenancePage();
  }
}

function startMaintenanceMode(){
  isAdminMaintenance=true;
  maintState={dewar:'Dewar 1',rack:'Rack 1',box:'Box 1'};
  maintBatchEditSelectMode=false;
  maintSelectedBatchEditCells=[];
  document.getElementById('maint-banner-input').value=document.getElementById('lab-banner').textContent;
  if(typeof syncMaintLangSelect==='function') syncMaintLangSelect();
  showToast(I18N[currentLang].toast_enter_maint);
  logMaintenanceEntry();
  switchPage('maintenance');
}

function exitMaintenanceMode(){
  isAdminMaintenance=false;
  maintMultiSelectMode=false;
  maintSelectedEmptyCells=[];
  maintDeleteSelectMode=false;
  maintSelectedDeleteCells=[];
  maintBatchEditSelectMode=false;
  maintSelectedBatchEditCells=[];
  switchPage('search');
  showToast(I18N[currentLang].toast_exit_maint);
}

function logMaintenanceEntry(){
  apiPost('log_event',{event_type:'maintenance_enter',cell:'維護模式',qty:null,operator:'admin',purpose:'進入維護模式',notes:'',locationStr:'',positions:'',time:new Date()}).catch(e=>console.warn('維護紀錄失敗',e));
}

function renderMaintenancePage(){
  maintSelectedEmptyCells=[];
  maintSelectedDeleteCells=[];
  updateMaintMultiCount();
  updateMaintDeleteCount();
  updateMaintBatchEditCount();
  syncMaintSelectionBars();
  const dewarSel=document.getElementById('m-dewar');
  const rackSel=document.getElementById('m-rack');
  if(dewarSel){
    const currentDewar = dewarSel.value || maintState.dewar;
    dewarSel.innerHTML = MAINT_DEWARS.map(d=>' <option value="'+escHtml(d)+'">'+escHtml(d)+'</option>').join('');
    if(MAINT_DEWARS.includes(currentDewar)) dewarSel.value = currentDewar;
  }
  const selectedRack = rackSel ? (rackSel.value || maintState.rack) : maintState.rack;
  const selectedDewar = (dewarSel&&dewarSel.value) || maintState.dewar;
  maintState.dewar = MAINT_DEWARS.includes(selectedDewar) ? selectedDewar : MAINT_DEWARS[0] || selectedDewar;
  if(dewarSel) dewarSel.value = maintState.dewar;
  applyDewarConfig(maintState.dewar);
  if(rackSel){
    rackSel.innerHTML = MAINT_RACKS.map(r=>' <option value="'+escHtml(r)+'">'+escHtml(r)+'</option>').join('');
  }
  maintState.rack = MAINT_RACKS.includes(selectedRack) ? selectedRack : MAINT_RACKS[0] || selectedRack;
  if(rackSel) rackSel.value = maintState.rack;
  if(!MAINT_BOXES.includes(maintState.box)) maintState.box=MAINT_BOXES[0];
  document.getElementById('maint-current-location').textContent=tr('maint_position_prefix')+maintState.dewar+' / '+maintState.rack+' / '+maintState.box;
  refreshMaintenanceBoxes();
}

function syncMaintSelectionBars(){
  const multiBar=document.getElementById('maint-multiselect-bar');
  const deleteBar=document.getElementById('maint-delete-bar');
  const batchBar=document.getElementById('maint-batch-edit-bar');
  if(multiBar) multiBar.classList.toggle('active',maintMultiSelectMode);
  if(deleteBar) deleteBar.classList.toggle('active',maintDeleteSelectMode);
  if(batchBar) batchBar.classList.toggle('active',maintBatchEditSelectMode);
  const batchBtn=document.getElementById('maint-batch-edit-toggle');
  if(batchBtn) batchBtn.style.background=maintBatchEditSelectMode?'rgba(96,165,250,.12)':'';
}

function removeMaintenanceDewar(){
  const dewarSel = document.getElementById('m-dewar');
  if(!dewarSel) return;
  const current = dewarSel.value || maintState.dewar;
  if(!current || !MAINT_DEWARS.includes(current)){
    showToast(tr('toast_dewar_invalid'));
    return;
  }
  const used = cellDb.some(cell=>
    (cell.locations||[]).some(loc=>loc.dewar===current)
  );
  if(used){
    showToast(tr('toast_dewar_has_data'));
    return;
  }
  if(MAINT_DEWARS.length<=1){
    showToast(tr('toast_dewar_keep_one'));
    return;
  }
  try {
    MAINT_DEWARS = MAINT_DEWARS.filter(d=>d!==current);
    config.maintDewars = Array.from(new Set(MAINT_DEWARS));
    config.storageConfigVersion = STORAGE_CONFIG_VERSION;
    saveConfig();
    maintState.dewar = MAINT_DEWARS[0] || 'Dewar 1';
    maintState.box = MAINT_BOXES[0];
    console.log('已移除 Dewar:', current);
    console.log('當前 MAINT_DEWARS:', MAINT_DEWARS);
    populateDewarSelectors();
    renderMaintenancePage();
    showToast(tr('toast_dewar_removed',{name:current}));
  } catch(e) {
    console.error('移除 Dewar 失敗:', e);
    showToast(tr('toast_dewar_remove_failed',{message:e.message}));
  }
}

function refreshMaintenanceBoxes(){
  const capacity=boxSlotCapacity();
  const list=document.getElementById('maint-box-list');
  list.innerHTML=MAINT_BOXES.map(box=>{
    const map=getMaintRecordsByPosition(maintState.dewar,maintState.rack,box);
    const count=Object.keys(map).length;
    const active=box===maintState.box?' active':'';
    return '<div style="display:flex;gap:6px;align-items:stretch">'+
      '<button type="button" class="maint-box-btn'+active+'" onclick="selectMaintBox(\''+escHtml(box)+'\')" style="flex:1">'+escHtml(box)+'<span>'+count+'/'+capacity+'</span></button>'+
      '<button type="button" class="sm-btn" onclick="promptRenameMaintenanceBox(\''+escHtml(box)+'\')" title="'+tr('title_rename_box')+'" style="padding:8px 10px;white-space:nowrap">✎</button>'+
    '</div>';
  }).join('');
  renderMaintBoxGrid();
}

function selectMaintBox(box){
  maintState.box=box;
  maintSelectedEmptyCells=[];
  maintSelectedDeleteCells=[];
  updateMaintMultiCount();
  updateMaintDeleteCount();
  document.getElementById('maint-current-location').textContent=I18N[currentLang].maint_position_prefix+maintState.dewar+' / '+maintState.rack+' / '+maintState.box;
  refreshMaintenanceBoxes();
}

function findMultipleRecords(){
  const targetBox = MAINT_BOXES.find(box=>{
    const map = getMaintRecordsByPosition(maintState.dewar, maintState.rack, box);
    return Object.values(map).some(records=>records.length>1);
  });
  if(targetBox){
    selectMaintBox(targetBox);
    const map=getMaintRecordsByPosition(maintState.dewar, maintState.rack, targetBox);
    const multiCount = Object.values(map).filter(records=>records.length>1).length;
    const msg=I18N[currentLang].toast_find_multi.replace('{box}',targetBox).replace('{count}',multiCount);
    showToast(msg);
  } else {
    showToast(I18N[currentLang].toast_no_multi);
  }
}

function findGlobalDuplicates(){
  const duplicates = findAllDuplicates();
  if(duplicates.length === 0){
    showToast(tr('toast_no_duplicates'));
    return;
  }
  
  renderGlobalDuplicatesModal(duplicates);
  document.getElementById('global-duplicates-modal').classList.add('open');
}

function findAllDuplicates(){
  const positionMap = {};
  const duplicates = [];
  
  // 收集所有位置的記錄
  cellDb.forEach((cell, cellIdx) => {
    (cell.locations || []).forEach((loc, locIdx) => {
      if (!MAINT_DEWARS.includes(loc.dewar)) return;
      
      (loc.occupied || []).forEach(pos => {
        const key = `${loc.dewar}-${loc.rack}-${loc.box}-${pos}`;
        if (!positionMap[key]) {
          positionMap[key] = [];
        }
        positionMap[key].push({
          cellIdx,
          locIdx,
          cell,
          loc,
          pos,
          key
        });
      });
    });
  });
  
  // 找出重複的位置
  Object.keys(positionMap).forEach(key => {
    const records = positionMap[key];
    if (records.length > 1) {
      duplicates.push({
        position: key,
        records: records
      });
    }
  });
  
  return duplicates;
}

function renderGlobalDuplicatesModal(duplicates){
  const content = document.getElementById('global-duplicates-content');
  const title = document.getElementById('global-duplicates-title');
  
  title.textContent = tr('dup_title',{count:duplicates.length});

  if (duplicates.length === 0) {
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">'+tr('toast_no_duplicates')+'</div>';
    document.getElementById('batch-delete-btn').style.display = 'none';
    return;
  }

  let html = '<div style="margin-bottom:20px">'+tr('dup_desc')+'</div>';
  
  duplicates.forEach((dup, dupIdx) => {
    const [dewar, rack, box, pos] = dup.position.split('-');
    html += `
      <div class="duplicate-group" style="border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px;background:var(--bg-light)">
        <div class="duplicate-header" style="font-weight:bold;margin-bottom:12px;color:var(--accent)">
          📍 ${tr('dup_position_prefix')}${dewar} / ${rack} / ${box} / ${pos}
        </div>
        <div class="duplicate-records">
    `;
    
    dup.records.forEach((rec, recIdx) => {
      const globalIdx = `dup_${dupIdx}_${recIdx}`;
      html += `
        <div class="duplicate-record" style="display:flex;align-items:center;padding:8px;border-radius:4px;margin-bottom:8px;background:white;border:1px solid var(--border-light)">
          <input type="checkbox" id="${globalIdx}" class="duplicate-checkbox" data-dup-idx="${dupIdx}" data-rec-idx="${recIdx}" style="margin-right:12px">
          <div style="flex:1">
            <div style="font-weight:500">${escHtml(rec.cell.name || tr('maint_unnamed'))}</div>
            <div style="font-size:12px;color:var(--text-dim)">
              ${tr('maint_tooltip_source')}${escHtml(rec.cell.source || '—')} |
              ${tr('maint_tooltip_passage')}${escHtml(rec.cell.passage || '—')} |
              ${tr('maint_tooltip_species')}${escHtml(rec.cell.species || '—')}
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-mid)">ID: ${rec.cell.id}</div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  content.innerHTML = html;
  document.getElementById('batch-delete-btn').style.display = 'block';
  
  // 為每個重複組添加選擇邏輯：只能選擇保留一個
  duplicates.forEach((dup, dupIdx) => {
    const checkboxes = content.querySelectorAll(`input[data-dup-idx="${dupIdx}"]`);
    checkboxes.forEach(cb => {
      cb.addEventListener('change', function() {
        if (this.checked) {
          // 取消選取其他同組的checkbox
          checkboxes.forEach(otherCb => {
            if (otherCb !== this) {
              otherCb.checked = false;
            }
          });
        }
      });
    });
  });
}

function closeGlobalDuplicatesModal(){
  document.getElementById('global-duplicates-modal').classList.remove('open');
}

async function batchDeleteSelectedDuplicates(){
  const duplicates = findAllDuplicates();
  const selectedToDelete = [];
  
  // 收集選取要刪除的記錄
  document.querySelectorAll('.duplicate-checkbox:checked').forEach(cb => {
    const dupIdx = parseInt(cb.dataset.dupIdx);
    const recIdx = parseInt(cb.dataset.recIdx);
    const dup = duplicates[dupIdx];
    if (dup && dup.records[recIdx]) {
      selectedToDelete.push(dup.records[recIdx]);
    }
  });
  
  if (selectedToDelete.length === 0) {
    showToast(tr('toast_select_delete_records'));
    return;
  }

  if (!confirm(tr('confirm_delete_duplicates',{count:selectedToDelete.length}))) {
    return;
  }
  
  const records=selectedToDelete.map(rec=>({
    cell_id:rec.cell.id,
    dewar:rec.loc.dewar,
    rack:rec.loc.rack,
    box:rec.loc.box,
    position:rec.pos
  }));
  const res=await apiPost('maintenance_delete_vials',{records,purpose:'全域重複記錄清理'});
  applyServerState(res.state);
  const deletedCount=records.length;
  
  // 重新渲染維護頁面
  renderMaintenancePage();
  
  // 關閉模態框
  closeGlobalDuplicatesModal();
  
  showToast(tr('toast_duplicates_deleted',{count:deletedCount}));
}

function getMaintRecordsByPosition(dewar,rack,box){
  const map={};
  cellDb.forEach((cell,cellIdx)=>{
    (cell.locations||[]).forEach((loc,locIdx)=>{
      if(loc.dewar===dewar&&loc.rack===rack&&loc.box===box){
        (loc.occupied||[]).forEach(pos=>{
          if(!map[pos]) map[pos]=[];
          map[pos].push({cellIdx,locIdx,cell,loc,pos});
        });
      }
    });
  });
  return map;
}

function maintSlotKey(dewar,rack,box,pos){
  return [dewar,rack,box,pos].join('||');
}

function parseMaintSlotKey(key){
  const parts=String(key).split('||');
  return {dewar:parts[0]||'',rack:parts[1]||'',box:parts[2]||'',pos:parts[3]||''};
}

function currentMaintSlotKey(pos){
  return maintSlotKey(maintState.dewar,maintState.rack,maintState.box,pos);
}

function findMaintRecordForSlot(slot){
  const map=getMaintRecordsByPosition(slot.dewar,slot.rack,slot.box);
  return map[slot.pos]||[];
}

function buildMaintSearchEntries(query){
  const q=String(query||'').trim().toLowerCase();
  if(!q) return [];
  const entries=[];
  cellDb.forEach(cell=>{
    const baseText=[
      cell.name, cell.source, cell.passage, cell.species, cell.tissue,
      cell.genotype, cell.geno_detail, cell.medium, cell.serum, cell.abx,
      cell.selection, cell.cryoprotectant, cell.notes, cell.qc_notes
    ].filter(Boolean).join(' ').toLowerCase();
    (cell.locations||[]).forEach(loc=>{
      (loc.occupied||[]).forEach(pos=>{
        const locText=[loc.dewar,loc.rack,loc.box,pos].join(' ');
        const haystack=(baseText+' '+locText).toLowerCase();
        if(!haystack.includes(q)) return;
        entries.push({cell,loc,pos,locText:loc.dewar+' / '+loc.rack+' / '+loc.box+' / '+pos});
      });
    });
  });
  return entries.slice(0,40);
}

function onMaintSearch(value){
  const box=document.getElementById('maint-search-results');
  if(!box) return;
  const hits=buildMaintSearchEntries(value);
  const hasQuery=String(value||'').trim().length>0;
  if(!hasQuery){
    box.classList.remove('open');
    box.innerHTML='';
    return;
  }
  if(!hits.length){
    box.innerHTML='<div class="maint-search-result" style="display:block;color:var(--text-dim);cursor:default">'+tr('maint_search_no_match')+'</div>';
    box.classList.add('open');
    return;
  }
  box.innerHTML=hits.map((hit,i)=>{
    const stock=hit.cell.stock==null?'—':hit.cell.stock;
    return '<button type="button" class="maint-search-result" data-maint-hit="'+i+'">'+
      '<div><div class="maint-search-result-name">'+escHtml(hit.cell.name||tr('maint_unnamed'))+'</div>'+
      '<div class="maint-search-result-meta">'+escHtml((hit.cell.passage||'—')+' · '+(hit.cell.source||'—'))+'</div></div>'+
      '<div class="maint-search-result-stock">'+escHtml(String(stock))+' '+tr('unit_vial_short')+'</div>'+
      '<div class="maint-search-result-loc">'+escHtml(hit.locText)+'</div>'+
    '</button>';
  }).join('');
  box.querySelectorAll('[data-maint-hit]').forEach(btn=>{
    btn.onclick=()=>openMaintSearchHit(hits[Number(btn.dataset.maintHit)]);
  });
  box.classList.add('open');
}

function clearMaintSearch(){
  const input=document.getElementById('maint-search-input');
  const box=document.getElementById('maint-search-results');
  if(input) input.value='';
  if(box){
    box.innerHTML='';
    box.classList.remove('open');
  }
}

function openMaintSearchHit(hit){
  if(!hit) return;
  maintState.dewar=hit.loc.dewar;
  maintState.rack=hit.loc.rack;
  maintState.box=hit.loc.box;
  const dewarSel=document.getElementById('m-dewar');
  const rackSel=document.getElementById('m-rack');
  if(dewarSel) dewarSel.value=hit.loc.dewar;
  if(rackSel) rackSel.value=hit.loc.rack;
  renderMaintenancePage();
  clearMaintSearch();
  const slot={dewar:hit.loc.dewar,rack:hit.loc.rack,box:hit.loc.box,pos:hit.pos};
  const records=findMaintRecordForSlot(slot).sort((a,b)=>{
    const am=a.cell&&a.cell.id===hit.cell.id ? 0 : 1;
    const bm=b.cell&&b.cell.id===hit.cell.id ? 0 : 1;
    return am-bm;
  });
  if(records.length) openMaintEditModal(hit.pos,records);
  else showToast(tr('toast_slot_record_not_found'));
}

function renderMaintBoxGrid(){
  const grid=document.getElementById('maint-box-grid');
  const map=getMaintRecordsByPosition(maintState.dewar,maintState.rack,maintState.box);
  const capacity=boxSlotCapacity();
  grid.innerHTML='';
  grid.style.gridTemplateColumns='repeat('+BOX_GRID_N+',minmax(56px,1fr))';
  allBoxPositions().forEach(pos=>{
    const records=map[pos]||[];
    const btn=document.createElement('button');
    btn.type='button';
    const stateClass = records.length>1 ? 'multiple' : records.length===1 ? 'occupied' : 'empty';
    btn.className='maint-grid-cell '+stateClass;
    btn.textContent=pos;
    btn.onmouseenter=e=>showMaintTooltip(pos,records,e);
    btn.onmouseleave=hideMaintTooltip;
    if(maintBatchEditSelectMode){
      const key=currentMaintSlotKey(pos);
      if(records.length){
        if(maintSelectedBatchEditCells.includes(key)) btn.classList.add('multi-selected');
        btn.onclick=()=>toggleMaintBatchEditCellSelection(pos);
      } else {
        btn.onclick=()=>showToast(tr('toast_no_editable_cell'));
      }
    } else if(maintDeleteSelectMode){
      if(records.length){
        if(maintSelectedDeleteCells.includes(pos)) btn.classList.add('multi-selected');
        btn.onclick=()=>toggleMaintDeleteCellSelection(pos);
      } else {
        btn.onclick=()=>showToast(tr('toast_no_deletable_cell'));
      }
    } else if(records.length){
      btn.onclick=()=>openMaintEditModal(pos,records);
    } else if(maintMultiSelectMode){
      if(maintSelectedEmptyCells.includes(pos)) btn.classList.add('multi-selected');
      btn.onclick=()=>toggleMaintCellSelection(pos);
    } else {
      btn.onclick=()=>openAddMaintRecordModal([pos]);
    }
    grid.appendChild(btn);
  });
  const emptyCount=capacity-Object.keys(map).length;
  document.getElementById('maint-empty-count').textContent=I18N[currentLang].maint_empty_label+emptyCount+' / '+capacity;
}

function showMaintTooltip(pos,records,event){
  const tooltip=document.getElementById('maint-tooltip');
  const fmtDate=s=>{if(!s) return '—'; const d=s.slice(0,10); return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:'—';};
  const lbl=(zh,en)=>currentLang==='zh'?zh:en;
  if(records.length===0){
    tooltip.innerHTML='<strong>'+pos+'</strong><div>'+I18N[currentLang].maint_tooltip_empty+'</div>';
  } else if(records.length===1){
    const rec=records[0];
    tooltip.innerHTML='<strong>'+escHtml(rec.cell.name||I18N[currentLang].maint_unnamed)+'</strong>'+
      '<div>'+lbl('代數：','Passage: ')+escHtml(rec.cell.passage||'—')+'</div>'+
      '<div>'+lbl('操作人：','Operator: ')+escHtml(rec.cell.registrant||'—')+'</div>'+
      '<div>'+lbl('日期：','Date: ')+fmtDate(rec.cell.register_date||rec.cell.created_at)+'</div>';
  } else {
    const countText = I18N[currentLang].maint_tooltip_multiple.replace('{count}', records.length);
    const countLabel = currentLang==='zh' ? '（'+countText+'）' : ' ('+countText+')';
    tooltip.innerHTML='<strong>'+pos+countLabel+'</strong>'+
      records.map((rec,i)=>'<div>'+(i+1)+'. '+escHtml(rec.cell.name||I18N[currentLang].maint_unnamed)+
        ' / '+escHtml(rec.cell.registrant||'—')+
        ' / '+escHtml(rec.cell.passage||'—')+
        ' / '+fmtDate(rec.cell.register_date||rec.cell.created_at)+'</div>').join('');
  }
  tooltip.style.display='block';
  tooltip.style.left='0px';
  tooltip.style.top='0px';
  const margin=12;
  const left=event.clientX+16;
  const top=event.clientY+16;
  const docW=document.documentElement.clientWidth;
  const docH=document.documentElement.clientHeight;
  const rect=tooltip.getBoundingClientRect();
  let x=left;
  let y=top;
  if(x+rect.width+margin>docW) x=Math.max(margin, event.clientX-rect.width-16);
  if(y+rect.height+margin>docH) y=Math.max(margin, event.clientY-rect.height-16);
  tooltip.style.left=x+'px';
  tooltip.style.top=y+'px';
}

function hideMaintTooltip(){
  const tooltip=document.getElementById('maint-tooltip');
  if(tooltip) tooltip.style.display='none';
}

function toggleMaintMultiSelect(){
  maintMultiSelectMode=!maintMultiSelectMode;
  maintSelectedEmptyCells=[];
  if(maintMultiSelectMode){
    maintDeleteSelectMode=false;
    maintSelectedDeleteCells=[];
    maintBatchEditSelectMode=false;
  }
  const btn=document.getElementById('maint-multiselect-toggle');
  const bar=document.getElementById('maint-multiselect-bar');
  const deleteBtn=document.getElementById('maint-delete-toggle');
  const deleteBar=document.getElementById('maint-delete-bar');
  const batchBtn=document.getElementById('maint-batch-edit-toggle');
  const batchBar=document.getElementById('maint-batch-edit-bar');
  if(maintMultiSelectMode){
    btn.style.borderColor='var(--warn)';
    btn.style.color='var(--warn)';
    bar.classList.add('active');
    deleteBtn.style.background='';
    deleteBar.classList.remove('active');
    batchBtn.style.background='';
    batchBar.classList.remove('active');
  } else {
    btn.style.borderColor='';
    btn.style.color='';
    bar.classList.remove('active');
  }
  updateMaintMultiCount();
  updateMaintDeleteCount();
  updateMaintBatchEditCount();
  renderMaintBoxGrid();
}

function toggleMaintCellSelection(pos){
  const idx=maintSelectedEmptyCells.indexOf(pos);
  if(idx>=0) maintSelectedEmptyCells.splice(idx,1);
  else maintSelectedEmptyCells.push(pos);
  updateMaintMultiCount();
  renderMaintBoxGrid();
}

function updateMaintMultiCount(){
  const el=document.getElementById('maint-multi-count');
  if(el) el.textContent=tr('maint_selected_count',{count:maintSelectedEmptyCells.length});
}

function clearMaintMultiSelect(){
  maintSelectedEmptyCells=[];
  updateMaintMultiCount();
  renderMaintBoxGrid();
}

function confirmMaintMultiAdd(){
  if(maintSelectedEmptyCells.length===0){
    showToast(tr('toast_select_empty_slot'));
    return;
  }
  openAddMaintRecordModal([...maintSelectedEmptyCells]);
}

function toggleMaintDeleteSelect(){
  maintDeleteSelectMode=!maintDeleteSelectMode;
  maintSelectedDeleteCells=[];
  if(maintDeleteSelectMode){
    maintMultiSelectMode=false;
    maintSelectedEmptyCells=[];
    maintBatchEditSelectMode=false;
  }
  const btn=document.getElementById('maint-delete-toggle');
  const bar=document.getElementById('maint-delete-bar');
  const addBtn=document.getElementById('maint-multiselect-toggle');
  const addBar=document.getElementById('maint-multiselect-bar');
  const batchBtn=document.getElementById('maint-batch-edit-toggle');
  const batchBar=document.getElementById('maint-batch-edit-bar');
  if(maintDeleteSelectMode){
    btn.style.background='rgba(248,113,113,.12)';
    bar.classList.add('active');
    addBtn.style.borderColor='';
    addBtn.style.color='';
    addBar.classList.remove('active');
    batchBtn.style.background='';
    batchBar.classList.remove('active');
  } else {
    btn.style.background='';
    bar.classList.remove('active');
  }
  updateMaintMultiCount();
  updateMaintDeleteCount();
  updateMaintBatchEditCount();
  renderMaintBoxGrid();
}

function toggleMaintDeleteCellSelection(pos){
  const idx=maintSelectedDeleteCells.indexOf(pos);
  if(idx>=0) maintSelectedDeleteCells.splice(idx,1);
  else maintSelectedDeleteCells.push(pos);
  updateMaintDeleteCount();
  renderMaintBoxGrid();
}

function updateMaintDeleteCount(){
  const el=document.getElementById('maint-delete-count');
  if(el) el.textContent=tr('maint_selected_count',{count:maintSelectedDeleteCells.length});
}

function clearMaintDeleteSelect(){
  maintSelectedDeleteCells=[];
  updateMaintDeleteCount();
  renderMaintBoxGrid();
}

function toggleMaintBatchEditSelect(){
  maintBatchEditSelectMode=!maintBatchEditSelectMode;
  if(maintBatchEditSelectMode){
    maintMultiSelectMode=false;
    maintSelectedEmptyCells=[];
    maintDeleteSelectMode=false;
    maintSelectedDeleteCells=[];
  }
  const btn=document.getElementById('maint-batch-edit-toggle');
  const bar=document.getElementById('maint-batch-edit-bar');
  const addBtn=document.getElementById('maint-multiselect-toggle');
  const addBar=document.getElementById('maint-multiselect-bar');
  const deleteBtn=document.getElementById('maint-delete-toggle');
  const deleteBar=document.getElementById('maint-delete-bar');
  if(maintBatchEditSelectMode){
    btn.style.background='rgba(96,165,250,.12)';
    bar.classList.add('active');
    addBtn.style.borderColor='';
    addBtn.style.color='';
    addBar.classList.remove('active');
    deleteBtn.style.background='';
    deleteBar.classList.remove('active');
  } else {
    btn.style.background='';
    bar.classList.remove('active');
  }
  updateMaintMultiCount();
  updateMaintDeleteCount();
  updateMaintBatchEditCount();
  renderMaintBoxGrid();
}

function toggleMaintBatchEditCellSelection(pos){
  const key=currentMaintSlotKey(pos);
  const idx=maintSelectedBatchEditCells.indexOf(key);
  if(idx>=0) maintSelectedBatchEditCells.splice(idx,1);
  else maintSelectedBatchEditCells.push(key);
  updateMaintBatchEditCount();
  renderMaintBoxGrid();
}

function updateMaintBatchEditCount(){
  const el=document.getElementById('maint-batch-edit-count');
  if(el) el.textContent=tr('maint_selected_count',{count:maintSelectedBatchEditCells.length});
}

function clearMaintBatchEditSelect(){
  maintSelectedBatchEditCells=[];
  updateMaintBatchEditCount();
  renderMaintBoxGrid();
}

function confirmMaintBatchEdit(){
  if(maintSelectedBatchEditCells.length===0){
    showToast(tr('toast_select_occupied_slot'));
    return;
  }
  const records=[];
  maintSelectedBatchEditCells.forEach(key=>{
    const slot=parseMaintSlotKey(key);
    findMaintRecordForSlot(slot).forEach(rec=>records.push(rec));
  });
  if(!records.length){
    showToast(tr('toast_no_editable_records'));
    return;
  }
  openMaintBatchEditModal(records);
}

async function confirmMaintBatchDelete(){
  if(maintSelectedDeleteCells.length===0){
    showToast(tr('toast_select_occupied_slot'));
    return;
  }
  const map=getMaintRecordsByPosition(maintState.dewar,maintState.rack,maintState.box);
  const records=maintSelectedDeleteCells.flatMap(pos=>(map[pos]||[]).map(rec=>({
    cell_id:rec.cell.id,
    dewar:rec.loc.dewar,
    rack:rec.loc.rack,
    box:rec.loc.box,
    position:rec.pos
  })));
  if(records.length===0){
    showToast(tr('toast_no_deletable_records'));
    return;
  }
  if(!confirm(tr('confirm_delete_records',{count:records.length}))) return;
  try{
    const res=await apiPost('maintenance_delete_vials',{records,purpose:'維護模式多格刪除'});
    applyServerState(res.state);
    maintSelectedDeleteCells=[];
    updateMaintDeleteCount();
    renderMaintenancePage();
    showToast(tr('toast_records_deleted',{count:records.length}));
  }catch(e){
    console.error('多格刪除失敗：',e);
    showApiError(tr('err_multi_delete'),e);
    await loadData();
    renderMaintenancePage();
  }
}

function openAddMaintRecordModal(positions){
  if(!Array.isArray(positions)) positions=[positions];
  maintEditCandidates = [{ pos: positions }];
  maintEditSelectedIdx = 0;
  const list = document.getElementById('maint-records-list');
  list.style.display = 'none';
  initMaintDateSelects();
  clearMaintEditFields();
  populateMaintOperatorSelect();
  maintSetVal('maint-edit-registrant',config.username||'');
  setMaintDateValue(new Date().toISOString());
  const posLabel = positions.length > 1
    ? tr('maint_multi_pos_label',{positions:positions.join(', '),count:positions.length})
    : positions[0];
  document.getElementById('maint-modal-title').textContent = tr('maint_add_title',{pos:posLabel});
  document.getElementById('maint-delete-btn').style.display='none';
  document.getElementById('maint-edit-modal').classList.add('open');
}

function clearMaintEditFields(){
  ['name','passage','tissue','genotype','qc-notes','notes']
    .forEach(id=>{document.getElementById('maint-edit-'+id).value='';});
  setMaintDateValue('');
  ['source','species','cryoprotectant','medium','serum','abx','selection','registrant']
    .forEach(id=>{
      const sel=document.getElementById('maint-edit-'+id);
      if(sel) sel.selectedIndex=0;
      const inp=document.getElementById('maint-edit-'+id+'-other');
      if(inp){inp.value='';inp.style.display='none';}
    });
}

function openMaintBatchEditModal(records){
  const cellGroups={};
  records.forEach(rec=>{
    if(rec&&rec.cell&&rec.cell.id!=null){
      const id=rec.cell.id;
      if(!cellGroups[id]) cellGroups[id]={...rec,selectedSlots:[]};
      cellGroups[id].selectedSlots.push({dewar:rec.loc.dewar,rack:rec.loc.rack,box:rec.loc.box,pos:rec.pos});
    }
  });
  const uniqueRecords=Object.values(cellGroups);
  maintEditCandidates=[{batch:true,records:uniqueRecords}];
  maintEditSelectedIdx=0;
  const list=document.getElementById('maint-records-list');
  list.style.display='block';
  list.innerHTML='<div style="font-size:12px;color:var(--text-dim);line-height:1.6">'+tr('maint_batch_desc',{cells:uniqueRecords.length,slots:maintSelectedBatchEditCells.length})+'</div>'+
    uniqueRecords.slice(0,40).map((rec,i)=>{
      const slots=rec.selectedSlots||[{dewar:rec.loc.dewar,rack:rec.loc.rack,box:rec.loc.box,pos:rec.pos}];
      const posStr=slots.map(s=>escHtml(s.dewar)+' / '+escHtml(s.rack)+' / '+escHtml(s.box)+' / '+escHtml(s.pos)).join('; ');
      return '<div class="maint-record-option" style="cursor:default">'+
        '<strong>#'+(i+1)+'</strong> '+escHtml(rec.cell.name||tr('maint_unnamed'))+
        ' <span style="color:var(--text-dim)">'+posStr+'</span></div>';
    }).join('')+
    (uniqueRecords.length>40?'<div class="hint">'+tr('maint_more_not_listed',{count:uniqueRecords.length-40})+'</div>':'');
  initMaintDateSelects();
  clearMaintEditFields();
  populateMaintOperatorSelect();
  document.getElementById('maint-modal-title').textContent=tr('maint_batch_title',{count:uniqueRecords.length});
  document.getElementById('maint-delete-btn').style.display='none';
  document.getElementById('maint-edit-modal').classList.add('open');
}

function openMaintEditModal(pos,records){
  maintEditCandidates=records;
  maintEditSelectedIdx=0;
  const list=document.getElementById('maint-records-list');
  if(records.length>1){
    list.innerHTML=records.map((rec,i)=>
      '<div class="maint-record-option'+(i===0?' active':'')+'" onclick="selectMaintEditRecord('+i+')">'+
      '<strong>#'+(i+1)+'</strong> '+escHtml(rec.cell.name||tr('maint_unnamed'))+' / '+escHtml(rec.cell.source||'—')+'</div>'
    ).join('');
    list.style.display='block';
  } else {
    list.style.display='none';
  }
  initMaintDateSelects();
  populateMaintOperatorSelect();
  fillMaintEditModal(0);
  document.getElementById('maint-modal-title').textContent=tr('maint_edit_title',{pos});
  document.getElementById('maint-delete-btn').style.display='block';
  document.getElementById('maint-edit-modal').classList.add('open');
}

function selectMaintEditRecord(idx){
  maintEditSelectedIdx=idx;
  document.querySelectorAll('#maint-records-list .maint-record-option').forEach((el,i)=>el.classList.toggle('active',i===idx));
  fillMaintEditModal(idx);
}

function fillMaintEditModal(idx){
  const rec=maintEditCandidates[idx];
  if(!rec) return;
  if(!rec.cell) return;
  document.getElementById('maint-edit-name').value=rec.cell.name||'';
  maintSetVal('maint-edit-source',rec.cell.source||'');
  document.getElementById('maint-edit-passage').value=rec.cell.passage||'';
  maintSetVal('maint-edit-species',rec.cell.species||'');
  document.getElementById('maint-edit-tissue').value=rec.cell.tissue||'';
  document.getElementById('maint-edit-genotype').value=rec.cell.genotype||'';
  maintSetVal('maint-edit-cryoprotectant',rec.cell.cryoprotectant||'');
  maintSetVal('maint-edit-medium',rec.cell.medium||'');
  maintSetVal('maint-edit-serum',rec.cell.serum||'');
  maintSetVal('maint-edit-abx',rec.cell.abx||'');
  maintSetVal('maint-edit-selection',rec.cell.selection||'');
  maintSetVal('maint-edit-registrant',rec.cell.registrant||'');
  setMaintDateValue(rec.cell.register_date||rec.cell.created_at||'');
  document.getElementById('maint-edit-qc-notes').value=rec.cell.qc_notes||'';
  document.getElementById('maint-edit-notes').value=rec.cell.notes||'';
}

async function saveMaintEdit(){
  const rec=maintEditCandidates[maintEditSelectedIdx];
  if(!rec) return;
  try{

  if(rec.batch){
    const fieldMap={
      name:'maint-edit-name',
      source:'maint-edit-source',
      passage:'maint-edit-passage',
      species:'maint-edit-species',
      tissue:'maint-edit-tissue',
      genotype:'maint-edit-genotype',
      cryoprotectant:'maint-edit-cryoprotectant',
      medium:'maint-edit-medium',
      serum:'maint-edit-serum',
      abx:'maint-edit-abx',
      selection:'maint-edit-selection',
      registrant:'maint-edit-registrant',
      register_date:'maint-edit-register-date',
      qc_notes:'maint-edit-qc-notes',
      notes:'maint-edit-notes'
    };
    const MAINT_SEL_IDS=new Set(['maint-edit-source','maint-edit-species','maint-edit-cryoprotectant','maint-edit-medium','maint-edit-serum','maint-edit-abx','maint-edit-selection','maint-edit-registrant']);
    const patch={};
    Object.entries(fieldMap).forEach(([key,id])=>{
      const value=MAINT_SEL_IDS.has(id)?maintGetVal(id):
                  id==='maint-edit-register-date'?getMaintDateValue():
                  document.getElementById(id).value.trim();
      if(value!=='') patch[key]=value;
    });
    if(!Object.keys(patch).length){
      showToast(tr('toast_batch_need_field'));
      return;
    }
    if(!confirm(tr('confirm_batch_apply',{count:rec.records.length}))) return;
    const updates=rec.records.map(item=>({
      cell_id:item.cell.id,
      cell:patch,
      locationStr:item.loc.dewar+'/'+item.loc.rack+'/'+item.loc.box,
      positions:item.selectedSlots?item.selectedSlots.map(s=>s.pos).join(','):item.pos,
      selected_slots:item.selectedSlots||[{dewar:item.loc.dewar,rack:item.loc.rack,box:item.loc.box,pos:item.pos}]
    }));
    const res=await apiPost('maintenance_batch_update_cells',{updates});
    applyServerState(res.state);
    maintSelectedBatchEditCells=[];
    updateMaintBatchEditCount();
  } else if (rec.pos && rec.cellIdx===undefined) {
    // Adding new record (rec.pos is now an array of positions)
    const positions = Array.isArray(rec.pos) ? rec.pos : [rec.pos];
    const newCell = {
      name: document.getElementById('maint-edit-name').value.trim() || tr('maint_unnamed'),
      source: maintGetVal('maint-edit-source'),
      passage: document.getElementById('maint-edit-passage').value.trim(),
      species: maintGetVal('maint-edit-species'),
      tissue: document.getElementById('maint-edit-tissue').value.trim(),
      genotype: document.getElementById('maint-edit-genotype').value.trim(),
      cryoprotectant: maintGetVal('maint-edit-cryoprotectant'),
      medium: maintGetVal('maint-edit-medium'),
      serum: maintGetVal('maint-edit-serum'),
      abx: maintGetVal('maint-edit-abx'),
      selection: maintGetVal('maint-edit-selection'),
      qc_notes: document.getElementById('maint-edit-qc-notes').value.trim(),
      notes: document.getElementById('maint-edit-notes').value.trim(),
      registrant: maintGetVal('maint-edit-registrant') || config.username || '',
      register_date: getMaintDateValue() || new Date().toISOString()
    };
    const res=await apiPost('maintenance_add_cell',{cell:newCell,dewar:maintState.dewar,rack:maintState.rack,box:maintState.box,positions});
    applyServerState(res.state);
    if(maintMultiSelectMode){
      maintSelectedEmptyCells=[];
      updateMaintMultiCount();
    }
  } else {
    // Editing existing record
    const cell={
      name:document.getElementById('maint-edit-name').value.trim()||rec.cell.name,
      source:maintGetVal('maint-edit-source'),
      passage:document.getElementById('maint-edit-passage').value.trim(),
      species:maintGetVal('maint-edit-species'),
      tissue:document.getElementById('maint-edit-tissue').value.trim(),
      genotype:document.getElementById('maint-edit-genotype').value.trim(),
      cryoprotectant:maintGetVal('maint-edit-cryoprotectant'),
      medium:maintGetVal('maint-edit-medium'),
      serum:maintGetVal('maint-edit-serum'),
      abx:maintGetVal('maint-edit-abx'),
      selection:maintGetVal('maint-edit-selection'),
      registrant:maintGetVal('maint-edit-registrant'),
      register_date:getMaintDateValue(),
      qc_notes:document.getElementById('maint-edit-qc-notes').value.trim(),
      notes:document.getElementById('maint-edit-notes').value.trim()
    };
    const res=await apiPost('maintenance_update_cell',{cell_id:rec.cell.id,cell,locationStr:rec.loc.dewar+'/'+rec.loc.rack+'/'+rec.loc.box,positions:rec.pos});
    applyServerState(res.state);
  }

  closeMaintEditModal();
  renderMaintBoxGrid();
  showToast(tr('toast_maint_saved'));
  }catch(e){
    console.error('維護修改失敗：',e);
    showApiError(tr('err_maint_save'),e);
    await loadData();
    renderMaintenancePage();
  }
}

async function deleteMaintRecord(){
  const rec=maintEditCandidates[maintEditSelectedIdx];
  if(!rec || rec.cellIdx===undefined) return;

  if(!confirm(tr('confirm_delete_record',{loc:rec.loc.dewar+'/'+rec.loc.rack+'/'+rec.loc.box+'/'+rec.pos,name:rec.cell.name}))) return;

  try{
  const res=await apiPost('maintenance_delete_vial',{cell_id:rec.cell.id,dewar:rec.loc.dewar,rack:rec.loc.rack,box:rec.loc.box,position:rec.pos});
  applyServerState(res.state);
  closeMaintEditModal();
  renderMaintBoxGrid();
  showToast(tr('toast_record_deleted'));
  }catch(e){
    console.error('刪除記錄失敗：',e);
    showApiError(tr('err_delete_record'),e);
    await loadData();
    renderMaintenancePage();
  }
}

function closeMaintEditModal(){
  document.getElementById('maint-edit-modal').classList.remove('open');
}
