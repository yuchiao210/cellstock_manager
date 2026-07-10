function onSearch(val){
  const el=document.getElementById('search-results');
  if(!val.trim()){el.classList.remove('open');return;}
  const hits=cellDb.filter(c=>c.name.toLowerCase().includes(val.toLowerCase())).slice(0,20);
  if(!hits.length){
    el.innerHTML='<div class="sri" style="color:var(--text-dim)">'+tr('search_no_match')+'</div>';
  } else {
    el.innerHTML=hits.map(c=>{
      const cls=c.stock===0?'empty':c.stock<=2?'low':'ok';
      const lbl=c.stock===0?tr('stock_zero'):c.stock+' '+tr('unit_vial_short');
      return '<div class="sri" onclick="selectCell('+c.id+')"><div><div class="sri-name">'+escHtml(c.name)+'</div><div class="sri-meta">'+escHtml((c.passage||'—')+' · '+(c.source||'—'))+'</div></div><div class="stock-chip '+cls+'">'+lbl+'</div></div>';
    }).join('');
  }
  el.classList.add('open');
}

function selectCell(id,fromHistory){
  currentCell=cellDb.find(c=>c.id===id);
  if(!currentCell) return;
  document.getElementById('search-results').classList.remove('open');
  document.getElementById('search-input').value=currentCell.name;
  if(!fromHistory){
    const viewRec={type:'view',cell:currentCell.name,qty:null,operator:config.username||tr('operator_unknown'),purpose:'view',notes:'',locationStr:'',positions:'',time:new Date()};
    actionLog.unshift(viewRec);
    apiPost('log_event',{event_type:'view_cell',cell_id:currentCell.id,cell:currentCell.name,qty:null,operator:config.username||tr('operator_unknown'),purpose:'view',notes:'',locationStr:'',positions:'',time:new Date()})
      .then(res=>applyServerState(res.state))
      .catch(e=>console.warn('查閱紀錄失敗',e));
    viewHistory=viewHistory.slice(0,historyIdx+1);
    viewHistory.push(id);
    historyIdx=viewHistory.length-1;
  }
  updateHistoryUI();
  renderCard(); closeForm();
}
function goBack(){
  if(historyIdx<=0) return;
  historyIdx--;
  const id=viewHistory[historyIdx];
  if(id==null) return;
  selectCell(id,true);
}
function goForward(){
  if(historyIdx>=viewHistory.length-1) return;
  historyIdx++;
  const id=viewHistory[historyIdx];
  if(id==null) return;
  selectCell(id,true);
}
function updateHistoryUI(){
  const backBtn=document.getElementById('back-btn');
  const fwdBtn=document.getElementById('fwd-btn');
  const crumbs=document.getElementById('hist-crumbs');
  if(backBtn){
    const canBack=historyIdx>0;
    backBtn.disabled=!canBack;
    backBtn.style.opacity=canBack?'1':'0.3';
    backBtn.style.cursor=canBack?'pointer':'not-allowed';
  }
  if(fwdBtn){
    const canFwd=historyIdx<viewHistory.length-1;
    fwdBtn.disabled=!canFwd;
    fwdBtn.style.opacity=canFwd?'1':'0.3';
    fwdBtn.style.cursor=canFwd?'pointer':'not-allowed';
  }
  if(crumbs){
    const names=viewHistory.map((id,i)=>{
      const c=cellDb.find(x=>x.id===id);
      return (i===historyIdx?'[ '+(c?c.name:'?')+' ]':(c?c.name:'?'));
    });
    crumbs.textContent=names.join(' > ');
    crumbs.title=names.join(' > ');
  }
}

function renderCard(){
  const c=currentCell;
  const txt=(v)=>v||'—';
  const fmtDate=(v)=>{
    if(!v) return '—';
    const d=new Date(v);
    return Number.isNaN(d.getTime())?String(v):d.toLocaleString(currentLang==='zh'?'zh-TW':'en-US');
  };
  document.getElementById('card-name').textContent=c.name;
  document.getElementById('card-sub').textContent=(c.source||'—')+' · '+(c.passage||'—');
  const se=document.getElementById('card-stock');
  se.textContent=c.stock;
  se.style.color=c.stock===0?'var(--danger)':c.stock<=2?'var(--warn)':'var(--accent)';
  document.getElementById('card-operator').textContent=txt(c.registrant);
  document.getElementById('card-source').textContent=txt(c.source);
  document.getElementById('card-passage').textContent=txt(c.passage);
  document.getElementById('card-operation-date').textContent=fmtDate(c.register_date||c.created_at);
  document.getElementById('card-species').textContent=txt(c.species);
  document.getElementById('card-tissue').textContent=txt(c.tissue);
  document.getElementById('card-genotype').textContent=txt(c.genotype);
  document.getElementById('card-geno-detail').textContent=txt(c.geno_detail);
  document.getElementById('card-medium').textContent=txt(c.medium);
  document.getElementById('card-serum').textContent=txt(c.serum);
  document.getElementById('card-abx').textContent=txt(c.abx);
  document.getElementById('card-selection').textContent=txt(c.selection);
  document.getElementById('card-cryo').textContent=txt(c.cryoprotectant);
  document.getElementById('card-notes').textContent=txt(c.notes);
  document.getElementById('card-culture-notes').textContent=txt(c.culture_notes);
  document.getElementById('card-qc-notes').textContent=txt(c.qc_notes);
  document.getElementById('card-registrant').textContent=txt(c.registrant);
  document.getElementById('card-reg-date').textContent=fmtDate(c.register_date||c.created_at);
  const qcMap={pass:'<span class="chip pass">Pass</span>',fail:'<span class="chip fail">Fail</span>',na:'<span class="chip na">N/A</span>'};
  const qcEl=document.getElementById('card-qc');
  if(c.qc_results&&Object.keys(c.qc_results).length>0){
    const qcHtml=QC_ITEMS.map(item=>{
      const r=c.qc_results[item.id];
      return r?'<span style="font-size:12px;color:var(--text-mid)">'+escHtml(item.lbl.split('/')[0].trim())+'</span>　'+(qcMap[r]||''):'';
    }).filter(Boolean).join('<br>');
    qcEl.innerHTML=qcHtml||'—';
  } else {
    qcEl.textContent='—';
  }
  const locsEl=document.getElementById('card-locs');
  const locs=c.locations||[];
  if(locs.length>0){
    locsEl.innerHTML=locs.map(l=>'<div class="loc-line loc-blur"><span class="loc-tag">'+escHtml(l.dewar)+' / '+escHtml(l.rack)+' / '+escHtml(l.box)+'</span><span class="loc-cells">'+l.occupied.join('  ')+'</span><span class="loc-count">('+l.quantity+' '+tr('unit_vial_short')+')</span></div>').join('');
  } else {
    locsEl.innerHTML='<span style="color:var(--text-dim)">'+tr('no_location_info')+'</span>';
  }
  const detailsEl=document.getElementById('card-details');
  const moreBtn=document.getElementById('card-more-btn');
  if(detailsEl) detailsEl.classList.remove('open');
  if(moreBtn) moreBtn.textContent=tr('btn_show_more');
  document.getElementById('cell-card').classList.add('visible');
}

function toggleCardDetails(){
  const detailsEl=document.getElementById('card-details');
  const moreBtn=document.getElementById('card-more-btn');
  if(!detailsEl) return;
  const open=detailsEl.classList.toggle('open');
  if(moreBtn) moreBtn.textContent=tr(open?'btn_show_less':'btn_show_more');
}

function getOccupiedAt(dewar,rack,box){
  const set=new Set();
  cellDb.forEach(c=>(c.locations||[]).forEach(l=>{
    if(l.dewar===dewar&&l.rack===rack&&l.box===box)(l.occupied||[]).forEach(p=>set.add(p));
  }));
  return set;
}
function locKey(l){return l.dewar+'/'+l.rack+'/'+l.box;}
function slotKey(s){return s.dewar+'/'+s.rack+'/'+s.box+'/'+s.pos;}
function slotLocationKey(s){return s.dewar+'/'+s.rack+'/'+s.box;}
function normalizePassageInput(v){
  const s=String(v||'').trim();
  const m=s.match(/^p?\s*(\d+)$/i);
  return m?'P'+parseInt(m[1],10):s;
}
function isSameSlot(a,b){return a.dewar===b.dewar&&a.rack===b.rack&&a.box===b.box&&a.pos===b.pos;}
function hasSlot(list,slot){return list.some(s=>isSameSlot(s,slot));}
function toggleSlotInList(list,slot){
  const idx=list.findIndex(s=>isSameSlot(s,slot));
  if(idx>=0) list.splice(idx,1);
  else list.push(slot);
}
function groupSlotsByLocation(slots){
  const groups=[];
  slots.forEach(s=>{
    let g=groups.find(x=>x.dewar===s.dewar&&x.rack===s.rack&&x.box===s.box);
    if(!g){g={dewar:s.dewar,rack:s.rack,box:s.box,occupied:[],quantity:0};groups.push(g);}
    if(!g.occupied.includes(s.pos)) g.occupied.push(s.pos);
    g.quantity=g.occupied.length;
  });
  groups.forEach(g=>g.occupied.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})));
  return groups;
}
function formatSlotSummary(slots){
  if(!slots.length) return tr('selection_none_multi');
  return groupSlotsByLocation(slots).map(g=>g.dewar+'/'+g.rack+'/'+g.box+': '+g.occupied.join(', ')).join('; ');
}
function updateStoreSelectionUI(){
  const qty=document.getElementById('f-qty');
  const lbl=document.getElementById('sel-pos-lbl');
  if(qty) qty.value=selectedPos.length;
  if(lbl) lbl.textContent=selectedPos.length?tr('selection_store_count',{count:selectedPos.length,summary:formatSlotSummary(selectedPos)}):tr('selection_none_multi');
}
function updateRegSelectionUI(){
  const qty=document.getElementById('r-stock');
  const lbl=document.getElementById('reg-pos-lbl');
  if(qty) qty.value=regSelPos.length;
  if(lbl) lbl.textContent=regSelPos.length?tr('selection_store_count',{count:regSelPos.length,summary:formatSlotSummary(regSelPos)}):tr('selection_none_multi');
}

function setStoreBatchValue(id,value){
  const el=document.getElementById(id);
  if(el) el.value=value||'';
}

function clearStoreBatchForm(){
  ['f-store-passage','f-store-source','f-store-species','f-store-tissue','f-store-genotype','f-store-geno-detail','f-store-medium','f-store-serum','f-store-abx','f-store-selection','f-store-cryo','f-store-notes','f-store-culture-notes']
    .forEach(id=>setStoreBatchValue(id,''));
}

function prefillStoreBatchForm(cell){
  if(!cell) return;
  setStoreBatchValue('f-store-passage',cell.passage||'');
  setStoreBatchValue('f-store-source',cell.source||'');
  setStoreBatchValue('f-store-species',cell.species||'');
  setStoreBatchValue('f-store-tissue',cell.tissue||'');
  setStoreBatchValue('f-store-genotype',cell.genotype||'');
  setStoreBatchValue('f-store-geno-detail',cell.geno_detail||'');
  setStoreBatchValue('f-store-medium',cell.medium||'');
  setStoreBatchValue('f-store-serum',cell.serum||'');
  setStoreBatchValue('f-store-abx',cell.abx||'');
  setStoreBatchValue('f-store-selection',cell.selection||'');
  setStoreBatchValue('f-store-cryo',cell.cryoprotectant||'');
  setStoreBatchValue('f-store-notes',cell.notes||'');
  setStoreBatchValue('f-store-culture-notes',cell.culture_notes||'');
}

function collectStoreBatchOverrides(){
  const get=id=>document.getElementById(id)?.value.trim()||'';
  const overrides={};
  const passage=normalizePassageInput(get('f-store-passage'));
  if(passage) overrides.passage=passage;
  ['source','species','tissue','genotype','geno-detail','medium','serum','abx','selection','cryo','notes','culture-notes'].forEach(key=>{
    const value=get('f-store-'+key);
    if(!value) return;
    if(key==='geno-detail') overrides.geno_detail=value;
    else if(key==='culture-notes') overrides.culture_notes=value;
    else if(key==='cryo') overrides.cryoprotectant=value;
    else overrides[key]=value;
  });
  return overrides;
}

function openForm(action){
  currentAction=action;
  document.querySelectorAll('.loc-blur').forEach(e=>e.classList.add('revealed'));
  const lbl=document.getElementById('form-type-lbl');
  const btn=document.getElementById('submit-btn');
  const t=I18N[currentLang];
  if(action==='take'){
    lbl.textContent=t.form_take_title;lbl.className='form-type-lbl take';
    btn.className='submit-btn take';btn.textContent=t.btn_confirm_take;
    document.getElementById('purpose-group').style.display='block';
  } else {
    lbl.textContent=t.form_store_title;lbl.className='form-type-lbl store';
    btn.className='submit-btn store';btn.textContent=t.btn_confirm_store;
    document.getElementById('purpose-group').style.display='none';
  }
  const storeBatchGroup=document.getElementById('store-batch-group');
  if(storeBatchGroup) storeBatchGroup.style.display=action==='store'?'block':'none';
  selectedPos=[];selectedTakePos=[];currentLocIdx=null;
  document.getElementById('f-qty').value=0;
  document.getElementById('f-purpose').value='';
  document.getElementById('f-notes').value='';
  clearStoreBatchForm();
  if(action==='store') prefillStoreBatchForm(currentCell);
  document.getElementById('pos-picker').style.display='none';
  document.getElementById('sel-pos-lbl').textContent=action==='store'?tr('selection_none_multi'):tr('selection_none');
  document.getElementById('box-grid').innerHTML='';
  ['new-loc-dewar-grp','new-loc-rack-grp','new-loc-box-grp'].forEach(id=>document.getElementById(id).style.display='none');
  buildLocSelector(action);
  document.getElementById('form-panel').classList.add('open');
  document.getElementById('action-panel').style.display='none';
}

function buildLocSelector(action){
  const sel=document.getElementById('f-loc-select');
  const locs=currentCell.locations||[];
  if(action==='take'){
    if(locs.length===0){
      sel.innerHTML='<option value="">'+tr('option_no_location')+'</option>';
    } else if(locs.length===1){
      sel.innerHTML='<option value="0">'+tr('option_location_qty',{location:locKey(locs[0]),count:locs[0].quantity})+'</option>';
      currentLocIdx=0;
      buildBoxGrid('take',0);
      document.getElementById('pos-picker').style.display='block';
    } else {
      sel.innerHTML='<option value="">'+tr('option_take_location')+'</option>'+locs.map((l,i)=>'<option value="'+i+'">'+tr('option_location_qty',{location:locKey(l),count:l.quantity})+'</option>').join('');
    }
  } else {
    if(locs.length===0){
      sel.innerHTML='<option value="new">'+tr('option_new_location')+'</option>';
      onLocSelect();
    } else {
      sel.innerHTML='<option value="">'+tr('option_store_location')+'</option>'+locs.map((l,i)=>'<option value="'+i+'">'+tr('option_existing_location',{location:locKey(l),count:l.quantity})+'</option>').join('')+'<option value="new">'+tr('option_new_other_box')+'</option>';
    }
  }
}

function onLocSelect(){
  const val=document.getElementById('f-loc-select').value;
  const newGrps=['new-loc-dewar-grp','new-loc-rack-grp','new-loc-box-grp'];
  selectedTakePos=[];
  if(currentAction==='take'){
    document.getElementById('f-qty').value=0;
    document.getElementById('sel-pos-lbl').textContent=tr('selection_none');
  } else {
    updateStoreSelectionUI();
  }
  if(val==='new'){
    newGrps.forEach(id=>document.getElementById(id).style.display='block');
    document.getElementById('pos-picker').style.display='none';
    ['f-new-dewar','f-new-rack','f-new-box'].forEach(id=>document.getElementById(id).value='');
    currentLocIdx=null;
  } else if(val!==''){
    newGrps.forEach(id=>document.getElementById(id).style.display='none');
    currentLocIdx=parseInt(val);
    buildBoxGrid(currentAction,currentLocIdx);
    document.getElementById('pos-picker').style.display='block';
  } else {
    newGrps.forEach(id=>document.getElementById(id).style.display='none');
    document.getElementById('pos-picker').style.display='none';
    currentLocIdx=null;
  }
}

function updateNewLocGrid(){
  const d=document.getElementById('f-new-dewar').value;
  const r=document.getElementById('f-new-rack').value;
  const b=document.getElementById('f-new-box').value;
  if(!d||!r||!b) return;
  const allOcc=getOccupiedAt(d,r,b);
  document.getElementById('box-grid-lbl').textContent=tr('store_grid_label',{location:d+'/'+r+'/'+b});
  buildStoreGrid(allOcc,{dewar:d,rack:r,box:b});
  updateStoreSelectionUI();
  document.getElementById('pos-picker').style.display='block';
}

function buildBoxGrid(action,locIdx){
  const loc=currentCell.locations[locIdx];
  if(action==='take'){
    document.getElementById('box-grid-lbl').textContent=tr('take_grid_label',{location:locKey(loc)});
    buildTakeGrid(new Set(loc.occupied||[]));
  } else {
    const allOcc=getOccupiedAt(loc.dewar,loc.rack,loc.box);
    document.getElementById('box-grid-lbl').textContent=tr('store_existing_grid_label',{location:locKey(loc)});
    buildStoreGrid(allOcc,{dewar:loc.dewar,rack:loc.rack,box:loc.box});
    updateStoreSelectionUI();
  }
}

function buildTakeGrid(cellOccupied){
  const g=document.getElementById('box-grid');g.innerHTML='';
  g.style.gridTemplateColumns='repeat('+BOX_GRID_N+',1fr)';
  selectedTakePos=[];
  allBoxPositions().forEach(pos=>{
    const d=document.createElement('div');
    if(cellOccupied.has(pos)){
      d.className='box-cell take-cell';d.textContent=pos;d.title=tr('take_cell_title');
      d.onclick=()=>{
        if(selectedTakePos.includes(pos)){
          selectedTakePos=selectedTakePos.filter(p=>p!==pos);
          d.className='box-cell take-cell';
        } else {
          selectedTakePos.push(pos);d.className='box-cell selected-take';
        }
        document.getElementById('f-qty').value=selectedTakePos.length;
        document.getElementById('sel-pos-lbl').textContent=selectedTakePos.length?tr('take_selected_count',{count:selectedTakePos.length,positions:selectedTakePos.join(', ')}):tr('take_select_hint');
      };
    } else {
      d.className='box-cell empty-cell';d.textContent=pos;
    }
    g.appendChild(d);
  });
  document.getElementById('sel-pos-lbl').textContent=tr('take_select_hint');
}

function buildStoreGrid(allOccupied,locCtx){
  const g=document.getElementById('box-grid');g.innerHTML='';
  g.style.gridTemplateColumns='repeat('+BOX_GRID_N+',1fr)';
  allBoxPositions().forEach(pos=>{
    const d=document.createElement('div');
    if(allOccupied.has(pos)){
      d.className='box-cell occupied';d.textContent=pos;
    } else {
      d.className='box-cell';d.textContent=pos;
      const slot={dewar:locCtx.dewar,rack:locCtx.rack,box:locCtx.box,pos};
      if(hasSlot(selectedPos,slot)) d.classList.add('selected');
      d.onclick=()=>{
        toggleSlotInList(selectedPos,slot);
        d.classList.toggle('selected',hasSlot(selectedPos,slot));
        updateStoreSelectionUI();
      };
    }
    g.appendChild(d);
  });
}

function resetSearch(){
  closeForm();
  currentCell=null;
  document.getElementById('cell-card').classList.remove('visible');
  const inp=document.getElementById('search-input');
  inp.value='';
  onSearch('');
  inp.focus();
}

function closeForm(){
  currentAction=null;
  document.getElementById('form-panel').classList.remove('open');
  document.getElementById('action-panel').style.display='block';
  document.querySelectorAll('.loc-blur').forEach(e=>e.classList.remove('revealed'));
}

async function submitAction(){
  const purpose=document.getElementById('f-purpose').value.trim();
  const notes=document.getElementById('f-notes').value.trim();
  const operator=config.username||tr('operator_unknown');
  try{
  if(currentAction==='take'){
    if(selectedTakePos.length===0){showToast(tr('toast_select_take_slot'));return;}
    const loc=currentCell.locations[currentLocIdx];
    const locStr=locKey(loc);
    const posTaken=[...selectedTakePos];
    const res=await apiPost('take_vials',{cell_id:currentCell.id,dewar:loc.dewar,rack:loc.rack,box:loc.box,positions:posTaken,operator,purpose,notes});
    applyServerState(res.state);
    renderCard();closeForm();
    showPosModal('take',currentCell.name,locStr,posTaken);
  } else {
    const locVal=document.getElementById('f-loc-select').value;
    if(selectedPos.length===0){showToast(tr('toast_select_store_slot'));return;}
    const groups=groupSlotsByLocation(selectedPos);
    const res=await apiPost('store_vials',{cell_id:currentCell.id,locations:groups,operator,notes,cell:collectStoreBatchOverrides()});
    applyServerState(res.state);
    const storedCellId=res.result?.cell_id||res.cell_id;
    if(storedCellId){
      const freshCell=cellDb.find(c=>c.id===storedCellId);
      if(freshCell) currentCell=freshCell;
    }
    const locStr=groups.map(g=>g.dewar+'/'+g.rack+'/'+g.box).join('; ');
    const storedPositions=selectedPos.map(s=>s.pos);
    renderCard();closeForm();
    showPosModal('store',currentCell.name,locStr,storedPositions);
  }
  }catch(e){
    console.error('操作失敗：',e);
    showToast(tr('toast_action_failed',{message:e.message}));
    await loadData();
    if(currentCell) renderCard();
  }
}

function showPosModal(type,cellName,locStr,positions){
  const titleEl=document.getElementById('pos-modal-title');
  const subEl=document.getElementById('pos-modal-sub');
  const detEl=document.getElementById('pos-modal-detail');
  if(type==='take'){titleEl.textContent=tr('pos_take_title');titleEl.style.color='var(--danger)';subEl.textContent=tr('pos_take_sub');}
  else{titleEl.textContent=tr('pos_store_title');titleEl.style.color='var(--accent)';subEl.textContent=tr('pos_store_sub');}
  detEl.innerHTML='<div><span class="lk">'+tr('pos_cell')+'</span><span class="lv">'+escHtml(cellName)+'</span></div><div><span class="lk">'+tr('pos_location')+'</span><span class="lv">'+escHtml(locStr)+'</span></div><div><span class="lk">'+tr('pos_slots')+'</span><span class="pv">'+positions.join('  ')+'</span></div><div><span class="lk">'+tr('pos_qty')+'</span><span class="lv">'+positions.length+' '+tr('unit_vial_short')+'</span></div>';
  document.getElementById('pos-modal').classList.add('open');
}

const LOG_PAGE_SIZE=20;
function renderGlobalLog(){
  const tb=document.getElementById('global-log');
  const pg=document.getElementById('log-pagination');
  const map={take:tr('log_action_take'),store:tr('log_action_store'),view:tr('log_action_view'),register:tr('log_action_register'),issue:tr('log_action_issue')};
  if(!actionLog.length){tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:32px">'+tr('log_empty')+'</td></tr>';if(pg)pg.innerHTML='';return;}
  const totalPages=Math.ceil(actionLog.length/LOG_PAGE_SIZE);
  if(logCurrentPage>=totalPages)logCurrentPage=totalPages-1;
  const start=logCurrentPage*LOG_PAGE_SIZE;
  const pageItems=actionLog.slice(start,start+LOG_PAGE_SIZE);
  tb.innerHTML=pageItems.map((r,pi)=>{
    const i=start+pi;
    const hasDetail=!!(r.locationStr||r.positions);
    const exp=hasDetail?'<span class="expand-hint">&#9658;</span>':'';
    return '<tr class="log-row-main'+(hasDetail?' clickable':'')+'" onclick="'+(hasDetail?'toggleLogDetail('+i+')':'')+'" style="cursor:'+(hasDetail?'pointer':'default')+'"><td><span class="log-chip '+r.type+'">'+(map[r.type]||r.type)+'</span></td><td>'+escHtml(logCellText(r.cell||'—'))+exp+'</td><td style="font-family:var(--mono)">'+(r.qty!=null?r.qty:'—')+'</td><td style="font-weight:500">'+escHtml(r.operator||'—')+'</td><td style="font-family:var(--mono);font-size:11px;color:var(--text-dim)">'+fmt(r.time)+'</td><td style="font-size:12px;color:var(--text-mid)">'+escHtml(logText(r.purpose||r.notes||'—'))+'</td></tr>'
    +(hasDetail?'<tr class="log-detail-row" id="log-detail-'+i+'" style="display:none"><td colspan="6">'+(r.locationStr?'<span style="color:var(--text-dim)">'+tr('log_location')+'</span><span style="color:var(--accent2)">'+escHtml(r.locationStr)+'</span>&nbsp;&nbsp;&nbsp;':'')+(r.positions?'<span style="color:var(--text-dim)">'+tr('log_slots')+'</span><span style="color:var(--accent)">'+escHtml(r.positions)+'</span>':'')+'</td></tr>':'');
  }).join('');
  if(pg){
    if(totalPages<=1){pg.innerHTML='';return;}
    const btnStyle='padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text);cursor:pointer;font-size:12px;';
    const activeBtnStyle='padding:4px 10px;border:1px solid var(--accent);border-radius:4px;background:var(--accent);color:#fff;cursor:default;font-size:12px;';
    let html='<button style="'+btnStyle+'" onclick="goLogPage(0)" '+(logCurrentPage===0?'disabled':'')+'>&#171;</button>';
    html+='<button style="'+btnStyle+'" onclick="goLogPage('+(logCurrentPage-1)+')" '+(logCurrentPage===0?'disabled':'')+'>&#8249;</button>';
    const rangeStart=Math.max(0,logCurrentPage-2),rangeEnd=Math.min(totalPages-1,logCurrentPage+2);
    for(let p=rangeStart;p<=rangeEnd;p++)html+='<button style="'+(p===logCurrentPage?activeBtnStyle:btnStyle)+'" onclick="goLogPage('+p+')">'+(p+1)+'</button>';
    html+='<button style="'+btnStyle+'" onclick="goLogPage('+(logCurrentPage+1)+')" '+(logCurrentPage===totalPages-1?'disabled':'')+'>&#8250;</button>';
    html+='<button style="'+btnStyle+'" onclick="goLogPage('+(totalPages-1)+')" '+(logCurrentPage===totalPages-1?'disabled':'')+'>&#187;</button>';
    html+='<span style="color:var(--text-dim);margin-left:4px">'+(start+1)+'–'+Math.min(start+LOG_PAGE_SIZE,actionLog.length)+' / '+actionLog.length+'</span>';
    pg.innerHTML=html;
  }
}
function goLogPage(p){logCurrentPage=p;renderGlobalLog();document.getElementById('page-log').scrollTop=0;}
function toggleLogDetail(i){const el=document.getElementById('log-detail-'+i);if(el)el.style.display=el.style.display==='none'?'table-row':'none';}
function logText(value){
  const s=String(value||'');
  const issueStatusUpdate=s.match(/^異常回報狀態更新：(.+)$/);
  if(issueStatusUpdate) return tr('log_issue_status_update',{status:logIssueStatusText(issueStatusUpdate[1])});
  const map={
    '查閱':tr('purpose_view'),view:tr('purpose_view'),'取出':tr('log_action_take'),'存入':tr('log_action_store'),'登錄新細胞系':tr('log_action_register'),
    '空位發現未知凍管':tr('issue_type_unknown_vial_in_empty_slot'),'應有凍管但找不到':tr('issue_type_missing_expected_vial'),'標籤不清':tr('issue_type_label_unclear'),
    '資料不一致':tr('issue_type_data_mismatch'),'凍管破損或污染疑慮':tr('issue_type_damaged_or_contaminated'),'其他異常':tr('issue_type_other')
  };
  return map[s]||s.replace(/^首次登錄：/,currentLang==='en'?'First registration: ':'首次登錄：').replace(/^合併登錄：/,currentLang==='en'?'Merged registration: ':'合併登錄：');
}
function logCellText(value){
  const s=String(value||'');
  const m=s.match(/^異常回報 #(\d+)$/);
  return m?tr('log_issue_prefix')+m[1]:s;
}
function logIssueStatusText(value){
  const map={'待處理':tr('issue_status_open'),'處理中':tr('issue_status_reviewing'),'已完成':tr('issue_status_resolved'),'不需處理':tr('issue_status_dismissed')};
  return map[String(value||'')]||String(value||'');
}
function fmt(d){
  const dt=d instanceof Date?d:new Date(d);
  if(Number.isNaN(dt.getTime())) return String(d||'');
  return currentLang==='zh'
    ? (dt.getMonth()+1)+'/'+dt.getDate()+' '+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0')
    : dt.toLocaleString('en-US',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
