function toggleOther(selId,inpId){
  const sel=document.getElementById(selId);const inp=document.getElementById(inpId);if(!inp)return;
  if(sel.value==='other'){inp.style.display='block';inp.focus();}else{inp.style.display='none';inp.value='';}
}
function getVal(selId,inpId){
  const sel=document.getElementById(selId);const inp=document.getElementById(inpId);
  if(sel.value==='other')return inp?inp.value.trim():'';return sel.value;
}
function toggleSourceOther(){
  const val=document.getElementById('r-source').value;
  const grp=document.getElementById('r-source-other-group');
  const lbl=document.getElementById('r-source-other-lbl');
  const inp=document.getElementById('r-source-other');
  if(val==='其他實驗室贈送'){grp.style.display='block';lbl.textContent=tr('lbl_provider_lab');inp.placeholder=tr('ph_source_lab');}
  else if(val==='商業購買'){grp.style.display='block';lbl.textContent=tr('lbl_vendor');inp.placeholder=tr('ph_vendor');}
  else{grp.style.display='none';inp.value='';}
}

function buildQCList(){
  document.getElementById('qc-list').innerHTML=QC_ITEMS.map(item=>'<div class="qc-item"><div class="qc-lbl">'+item.lbl+'</div><div class="qc-btns"><button class="qr-btn pass" onclick="setQC(\''+item.id+'\',\'pass\',this)">&#10003; Pass</button><button class="qr-btn fail" onclick="setQC(\''+item.id+'\',\'fail\',this)">&#10007; Fail</button><button class="qr-btn na" onclick="setQC(\''+item.id+'\',\'na\',this)">N/A</button></div></div>').join('');
}
function setQC(id,val,btn){
  qcResults[id]=val;
  btn.closest('.qc-btns').querySelectorAll('.qr-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function buildRegBoxGrid(){
  const dewar=getVal('r-dewar','r-dewar-other');
  const rack=getVal('r-rack','r-rack-other');
  const box=getVal('r-box','r-box-other');
  const capacity=boxSlotCapacity();
  const g=document.getElementById('reg-box-grid');g.innerHTML='';
  g.style.gridTemplateColumns='repeat('+BOX_GRID_N+',1fr)';
  if(!dewar||!rack||!box){updateRegSelectionUI();return;}
  const occupied=getOccupiedAt(dewar,rack,box);
  allBoxPositions().forEach(pos=>{
    const d=document.createElement('div');
    if(occupied.has(pos)){
      d.className='box-cell occupied';d.textContent=pos;d.title=tr('slot_occupied_title');
    } else {
      d.className='box-cell';d.textContent=pos;
      const slot={dewar,rack,box,pos};
      if(hasSlot(regSelPos,slot)) d.classList.add('selected');
      d.onclick=()=>{
        toggleSlotInList(regSelPos,slot);
        d.classList.toggle('selected',hasSlot(regSelPos,slot));
        updateRegSelectionUI();
      };
    }
    g.appendChild(d);
  });
  updateRegSelectionUI();
  if(!regSelPos.length) document.getElementById('reg-pos-lbl').textContent=tr('reg_slot_status',{location:dewar+'/'+rack+'/'+box,occupied:occupied.size,capacity});
}

function _regSlotList(){
  return getStorageLocations().map(loc=>[loc.dewar,loc.rack,loc.box]);
}
function _applyRegSlot(dw,rk,bx){
  const dSel=document.getElementById('r-dewar');
  const rSel=document.getElementById('r-rack');
  const bSel=document.getElementById('r-box');
  if([...dSel.options].some(o=>o.value===dw)) dSel.value=dw;
  else{dSel.value='other';document.getElementById('r-dewar-other').value=dw;document.getElementById('r-dewar-other').style.display='block';}
  if([...rSel.options].some(o=>o.value===rk)) rSel.value=rk;
  else{rSel.value='other';document.getElementById('r-rack-other').value=rk;document.getElementById('r-rack-other').style.display='block';}
  if([...bSel.options].some(o=>o.value===bx)) bSel.value=bx;
  else{bSel.value='other';document.getElementById('r-box-other').value=bx;document.getElementById('r-box-other').style.display='block';}
  buildRegBoxGrid();
  const free=boxSlotCapacity()-getOccupiedAt(dw,rk,bx).size;
  showToast(tr('toast_slot_found',{location:dw+' / '+rk+' / '+bx,free}));
}
function _searchSlotFrom(startIdx){
  const all=_regSlotList();
  for(let i=startIdx;i<all.length;i++){
    const[dw,rk,bx]=all[i];
    if(getOccupiedAt(dw,rk,bx).size<boxSlotCapacity()){
      regFindSlotCursor=i;
      _applyRegSlot(dw,rk,bx);
      document.getElementById('btn-find-next-slot').style.display='';
      return true;
    }
  }
  return false;
}
function findEmptySlotForReg(){
  if(!_searchSlotFrom(0)) alert(tr('alert_no_slot'));
}
function findNextEmptySlotForReg(){
  if(regFindSlotCursor<0){findEmptySlotForReg();return;}
  if(!_searchSlotFrom(regFindSlotCursor+1)) showToast(tr('toast_no_more_slot'));
}

function getSourceDisplay(){
  const val=document.getElementById('r-source').value;
  const other=document.getElementById('r-source-other').value.trim();
  return other?val+'（'+other+')':val;
}

function buildReview(){
  const g=id=>document.getElementById(id).value;
  const qcHtml=QC_ITEMS.map(i=>{
    const r=qcResults[i.id];
    const chip=r==='pass'?'<span class="chip pass">Pass</span>':r==='fail'?'<span class="chip fail">Fail</span>':r==='na'?'<span class="chip na">N/A</span>':'<span class="chip na">'+tr('review_empty')+'</span>';
    return i.lbl.split('/')[0].trim()+'：'+chip;
  }).join('<br>');
  const rows=[
    [tr('review_cell_name'),g('r-name')],[tr('review_source'),getSourceDisplay()],
    [tr('review_species_tissue'),g('r-species')+' / '+(g('r-tissue')||'—')],
    [tr('review_genotype'),g('r-genotype')+(g('r-geno-detail')?' — '+g('r-geno-detail'):'')],
    [tr('review_passage'),'P'+g('r-passage')],
    [tr('review_medium'),getVal('r-medium','r-medium-other')+' + '+getVal('r-serum','r-serum-other')],
    [tr('review_abx_selection'),(getVal('r-abx','r-abx-other')||'—')+' / '+(getVal('r-sel','r-sel-other')||'—')],
    [tr('review_cryo'),getVal('r-cryo','r-cryo-other')],[tr('review_qc'),qcHtml],
    [tr('review_location'),formatSlotSummary(regSelPos)||'—'],
    [tr('review_slots'),regSelPos.map(s=>s.pos).join(', ')||'—'],[tr('review_stock'),regSelPos.length+' '+tr('unit_vials')],
    [tr('review_registrant'),g('r-registrant')],
  ];
  document.getElementById('review-table').innerHTML=rows.map(([k,v])=>'<tr><td>'+k+'</td><td>'+(v||'—')+'</td></tr>').join('');
}

function goStep(n){
  const g=id=>document.getElementById(id).value.trim();
  if(n>currentStep){
    if(currentStep===1){
      if(!g('r-name')){alert(tr('alert_cell_name'));return;}
      if(!document.getElementById('r-source').value){alert(tr('alert_source'));return;}
      if(!document.getElementById('r-species').value){alert(tr('alert_species'));return;}
      if(!g('r-passage')){alert(tr('alert_passage'));return;}
    }
    if(currentStep===2){
      if(!document.getElementById('r-medium').value){alert(tr('alert_medium'));return;}
      if(document.getElementById('r-medium').value==='other'&&!g('r-medium-other')){alert(tr('alert_medium_other'));return;}
      if(!document.getElementById('r-sel').value){alert(tr('alert_selection'));return;}
      if(!document.getElementById('r-cryo').value){alert(tr('alert_cryo'));return;}
    }
    if(currentStep===4){
      if(regSelPos.length===0){alert(tr('alert_slot'));return;}
    }
  }
  if(n===4){regFindSlotCursor=-1;document.getElementById('btn-find-next-slot').style.display='none';buildRegBoxGrid();}
  if(n===5) buildReview();
  for(let i=1;i<=5;i++){
    document.getElementById('sd'+i).className='step-dot'+(i<n?' done':i===n?' active':'');
    document.getElementById('sl'+i).className='step-lbl'+(i<n?' done':i===n?' active':'');
    if(i<5) document.getElementById('sln'+i).className='step-line'+(i<n?' done':'');
  }
  document.querySelectorAll('.reg-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('rs'+n).classList.add('active');
  currentStep=n;
  window.scrollTo({top:0,behavior:'smooth'});
}

async function submitRegister(){
  const g=id=>document.getElementById(id).value.trim();
  const newCell={
    name:g('r-name'),source:getSourceDisplay(),
    passage:normalizePassageInput(g('r-passage')),
    species:document.getElementById('r-species').value,
    tissue:g('r-tissue'),
    genotype:document.getElementById('r-genotype').value,
    geno_detail:g('r-geno-detail'),
    medium:getVal('r-medium','r-medium-other'),serum:getVal('r-serum','r-serum-other'),
    abx:getVal('r-abx','r-abx-other'),selection:getVal('r-sel','r-sel-other'),
    cryoprotectant:getVal('r-cryo','r-cryo-other'),notes:g('r-desc'),
    culture_notes:g('r-culture-notes'),
    qc_results:{...qcResults},qc_notes:g('r-qc-notes'),
    registrant:config.username||'',register_date:new Date().toISOString(),
    locations:groupSlotsByLocation(regSelPos),
    stock:regSelPos.length,
  };
  const res=await apiPost('register_cell',{cell:newCell,operator:config.username||tr('operator_unknown')});
  applyServerState(res.state);
  showToast((res.merged||res.result?.merged)?tr('toast_register_merged',{name:newCell.name}):tr('toast_register_created',{name:newCell.name}));
  resetReg();switchPage('search');
  document.getElementById('search-input').value=newCell.name;
  onSearch(newCell.name);
}

function resetReg(){
  ['r-name','r-tissue','r-geno-detail','r-passage','r-desc','r-culture-notes','r-qc-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['r-source','r-species','r-medium','r-serum','r-abx','r-sel','r-cryo','r-dewar','r-rack','r-box'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.querySelectorAll('.other-input').forEach(el=>{el.style.display='none';el.value='';});
  document.getElementById('r-source-other-group').style.display='none';
  document.getElementById('r-source-other').value='';
  const def={'r-serum':'10% FBS','r-abx':'100 U/mL Pen/Strep','r-cryo':'7% DMSO + DMEM'};
  Object.entries(def).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.value=v;});
  document.getElementById('r-stock').value='0';
  document.getElementById('r-temp').value='37°C';
  document.getElementById('r-co2').value='5%';
  document.getElementById('r-registrant').value=config.username||'';
  document.getElementById('reg-box-grid').innerHTML='';
  document.getElementById('reg-pos-lbl').textContent=tr('reg_pos_empty');
  qcResults={};regSelPos=[];buildQCList();goStep(1);
  updatePassageFieldState();
}

function updatePassageFieldState(){
  const el=document.getElementById('r-passage');
  const wrap=document.getElementById('passage-field-wrap');
  if(!el||!wrap)return;
  wrap.classList.toggle('filled',el.value.trim()!=='');
}

function initNameAutocomplete(){
  const inp=document.getElementById('r-name');
  if(!inp)return;
  inp.addEventListener('input',()=>renderNameSuggestions(inp.value));
  inp.addEventListener('blur',()=>setTimeout(closeNameSuggestions,150));
}

function renderNameSuggestions(query){
  const box=document.getElementById('r-name-suggestions');
  const q=query.trim().toLowerCase();
  if(q.length<2){closeNameSuggestions();return;}
  const matches=cellDb.filter(c=>c.name.toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){closeNameSuggestions();return;}
  box.innerHTML=matches.map(c=>
    `<div class="nsi" onmousedown="applyNameSuggestion(${c.id})">
      <div class="nsi-name">${c.name} <span style="color:var(--text-dim);font-size:11px">P${c.passage}</span></div>
      <div class="nsi-detail">${c.species||'—'} · ${c.tissue||'—'} · ${c.genotype||'—'}</div>
    </div>`
  ).join('');
  box.classList.add('open');
}

function closeNameSuggestions(){
  const box=document.getElementById('r-name-suggestions');
  if(box){box.classList.remove('open');box.innerHTML='';}
}

function _setSelectWithOther(selId,otherId,value){
  const sel=document.getElementById(selId);
  const inp=document.getElementById(otherId);
  if(!sel||!value)return;
  const opt=[...sel.options].find(o=>o.value===value||o.text===value);
  if(opt){
    sel.value=opt.value;
    if(inp){inp.style.display='none';inp.value='';}
  } else {
    sel.value='other';
    if(inp){inp.style.display='block';inp.value=value;}
  }
}

function _applySource(source){
  if(!source)return;
  const sel=document.getElementById('r-source');
  const grp=document.getElementById('r-source-other-group');
  const lbl=document.getElementById('r-source-other-lbl');
  const inp=document.getElementById('r-source-other');
  const match=source.match(/^(.+?)（(.+)）$/);
  const base=match?match[1]:source;
  const other=match?match[2]:'';
  const opt=[...sel.options].find(o=>o.value===base||o.text===base);
  if(opt){
    sel.value=opt.value;
    if(other&&(base==='其他實驗室贈送'||base==='商業購買')){
      grp.style.display='block';
      lbl.textContent=base==='商業購買'?tr('lbl_vendor'):tr('lbl_provider_lab');
      inp.placeholder=base==='商業購買'?tr('ph_vendor'):tr('ph_source_lab');
      inp.value=other;
    } else {
      grp.style.display='none';
      inp.value='';
    }
  }
}

function applyNameSuggestion(cellId){
  const c=cellDb.find(x=>x.id===cellId);
  if(!c)return;
  document.getElementById('r-name').value=c.name;
  _applySource(c.source);
  const spSel=document.getElementById('r-species');
  const spOpt=[...spSel.options].find(o=>o.value===c.species||o.text===c.species);
  if(spOpt)spSel.value=spOpt.value;
  document.getElementById('r-tissue').value=c.tissue||'';
  const gnSel=document.getElementById('r-genotype');
  const gnOpt=[...gnSel.options].find(o=>o.value===c.genotype||o.text===c.genotype);
  if(gnOpt)gnSel.value=gnOpt.value;
  document.getElementById('r-geno-detail').value=c.geno_detail||'';
  _setSelectWithOther('r-medium','r-medium-other',c.medium);
  _setSelectWithOther('r-serum','r-serum-other',c.serum);
  _setSelectWithOther('r-abx','r-abx-other',c.abx);
  _setSelectWithOther('r-sel','r-sel-other',c.selection);
  _setSelectWithOther('r-cryo','r-cryo-other',c.cryoprotectant);
  document.getElementById('r-culture-notes').value=c.culture_notes||'';
  closeNameSuggestions();
}
