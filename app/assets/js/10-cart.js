function openStoreAdmin(){
  if(!currentCell) return;
  if(transientAdminAuth) openForm('store');
  else openAdminModal('store');
}

function cartTotalQty(){return cartItems.reduce((sum,i)=>sum+i.qty,0);}

function renderCartBadge(){
  const fab=document.getElementById('cart-fab');
  const badge=document.getElementById('cart-fab-badge');
  const total=cartTotalQty();
  if(!fab||!badge) return;
  fab.style.display=total>0?'flex':'none';
  badge.textContent=total;
}

function openCartAddModal(){
  if(!currentCell) return;
  if(currentCell.stock<=0){showToast(tr('stock_zero'));return;}
  document.getElementById('cart-add-cell-name').textContent=currentCell.name;
  const qtyInput=document.getElementById('cart-add-qty');
  qtyInput.value=1;
  qtyInput.max=currentCell.stock;
  document.getElementById('cart-add-max-hint').textContent=tr('cart_add_max_hint',{stock:currentCell.stock});
  document.getElementById('cart-add-modal').classList.add('open');
  setTimeout(()=>qtyInput.focus(),50);
}
function closeCartAddModal(){document.getElementById('cart-add-modal').classList.remove('open');}

function confirmAddToCart(){
  if(!currentCell) return;
  const qty=parseInt(document.getElementById('cart-add-qty').value,10);
  if(!Number.isFinite(qty)||qty<1||qty>currentCell.stock){
    showToast(tr('alert_cart_qty_invalid',{max:currentCell.stock}));
    return;
  }
  const existing=cartItems.find(i=>i.cell_id===currentCell.id);
  if(existing) existing.qty=Math.min(existing.qty+qty,currentCell.stock);
  else cartItems.push({cell_id:currentCell.id,cell_name:currentCell.name,qty});
  closeCartAddModal();
  renderCartBadge();
  showToast(tr('toast_added_to_cart',{name:currentCell.name,qty}));
}

function renderCartPanel(){
  const body=document.getElementById('cart-panel-body');
  if(!cartItems.length){
    body.innerHTML='<p class="hint" style="font-size:13px;padding:12px 0">'+tr('cart_empty')+'</p>'
      +'<div class="modal-actions"><button class="btn-secondary" onclick="closeCartPanel()">'+tr('btn_cancel')+'</button></div>';
    return;
  }
  const rows=cartItems.map((item,idx)=>{
    const cell=cellDb.find(c=>c.id===item.cell_id);
    const maxQty=cell?cell.stock:item.qty;
    return '<div class="cart-item-row">'
      +'<div class="cart-item-name">'+escHtml(item.cell_name)+'</div>'
      +'<div class="cart-item-qty-ctrl">'
      +'<button class="btn-secondary cart-qty-btn" onclick="changeCartQty('+idx+',-1)">&#8722;</button>'
      +'<span class="cart-qty-val">'+item.qty+' '+tr('cart_item_qty_unit')+'</span>'
      +'<button class="btn-secondary cart-qty-btn" onclick="changeCartQty('+idx+',1)" '+(item.qty>=maxQty?'disabled':'')+'>&#43;</button>'
      +'</div>'
      +'<button class="btn-secondary cart-remove-btn" onclick="removeCartItem('+idx+')">'+tr('btn_remove')+'</button>'
      +'</div>';
  }).join('');
  body.innerHTML='<div class="cart-item-list">'+rows+'</div>'
    +'<div class="modal-actions"><button class="btn-secondary" onclick="closeCartPanel()">'+tr('btn_cancel')+'</button>'
    +'<button class="btn-primary" onclick="openCartCheckout()">'+tr('btn_checkout')+'</button></div>';
}

function openCartPanel(){renderCartPanel();document.getElementById('cart-panel-modal').classList.add('open');}
function closeCartPanel(){document.getElementById('cart-panel-modal').classList.remove('open');}

function changeCartQty(idx,delta){
  const item=cartItems[idx];
  if(!item) return;
  const cell=cellDb.find(c=>c.id===item.cell_id);
  const maxQty=cell?cell.stock:item.qty;
  const next=item.qty+delta;
  if(next<1){removeCartItem(idx);return;}
  item.qty=Math.min(next,maxQty);
  renderCartPanel();
  renderCartBadge();
}

function removeCartItem(idx){
  cartItems.splice(idx,1);
  renderCartPanel();
  renderCartBadge();
}

function openCartCheckout(){
  if(!cartItems.length) return;
  closeCartPanel();
  cartWizardIdx=0;
  cartWizardGroups=[];
  document.getElementById('cart-wizard-modal').classList.add('open');
  renderCartWizardStep();
}

function closeCartWizard(){document.getElementById('cart-wizard-modal').classList.remove('open');}

function slotFromGroups(groups){
  const slots=[];
  (groups||[]).forEach(g=>(g.occupied||[]).forEach(pos=>slots.push({dewar:g.dewar,rack:g.rack,box:g.box,pos})));
  return slots;
}

function renderCartWizardStep(){
  if(cartWizardIdx>=cartItems.length){renderCartReview();return;}
  const item=cartItems[cartWizardIdx];
  const cell=cellDb.find(c=>c.id===item.cell_id);
  const body=document.getElementById('cart-wizard-body');
  if(!cell){
    cartWizardGroups[cartWizardIdx]=[];
    cartWizardIdx++;
    renderCartWizardStep();
    return;
  }
  cartWizardSelected=slotFromGroups(cartWizardGroups[cartWizardIdx]);
  body.innerHTML='<div class="modal-title" style="color:var(--danger)">'+tr('cart_wizard_title')+'</div>'
    +'<div class="hint" style="margin-bottom:8px">'+tr('cart_wizard_progress',{idx:cartWizardIdx+1,total:cartItems.length})+'</div>'
    +'<div style="font-size:18px;font-weight:600;margin-bottom:4px">'+escHtml(cell.name)+'</div>'
    +'<div class="hint" style="margin-bottom:12px">'+tr('cart_wizard_requested',{qty:item.qty})+'</div>'
    +'<div id="cart-wizard-grids"></div>'
    +'<div class="hint" id="cart-wizard-count" style="margin-top:8px;font-size:13px"></div>'
    +'<div class="modal-actions" style="justify-content:space-between">'
    +'<div>'+(cartWizardIdx>0?'<button class="btn-secondary" onclick="wizardPrev()">'+tr('btn_wizard_prev')+'</button>':'')+'</div>'
    +'<div><button class="btn-secondary" onclick="wizardSkip()">'+tr('btn_wizard_skip')+'</button> '
    +'<button class="btn-primary" onclick="wizardNext()">'+(cartWizardIdx===cartItems.length-1?tr('btn_wizard_finish'):tr('btn_wizard_next'))+'</button></div>'
    +'</div>';
  renderWizardGrids(cell);
  updateWizardCount();
}

function updateWizardCount(){
  const el=document.getElementById('cart-wizard-count');
  if(el) el.textContent=tr('cart_wizard_selected_count',{count:cartWizardSelected.length});
}

function renderWizardGrids(cell){
  const wrap=document.getElementById('cart-wizard-grids');
  wrap.innerHTML='';
  const locs=cell.locations||[];
  if(!locs.length){
    wrap.innerHTML='<p class="hint">'+tr('option_no_location')+'</p>';
    return;
  }
  locs.forEach(loc=>{
    const section=document.createElement('div');
    section.className='box-grid-wrap';
    section.style.marginBottom='14px';
    const lbl=document.createElement('div');
    lbl.className='box-grid-lbl';
    lbl.textContent=tr('take_grid_label',{location:locKey(loc)});
    section.appendChild(lbl);
    const g=document.createElement('div');
    g.className='box-grid';
    g.style.gridTemplateColumns='repeat('+BOX_GRID_N+',1fr)';
    const cellOccupied=new Set(loc.occupied||[]);
    allBoxPositions().forEach(pos=>{
      const d=document.createElement('div');
      const slot={dewar:loc.dewar,rack:loc.rack,box:loc.box,pos};
      if(cellOccupied.has(pos)){
        d.className='box-cell take-cell'+(hasSlot(cartWizardSelected,slot)?' selected-take':'');
        d.textContent=pos;
        d.title=tr('take_cell_title');
        d.onclick=()=>{
          toggleSlotInList(cartWizardSelected,slot);
          d.classList.toggle('selected-take',hasSlot(cartWizardSelected,slot));
          updateWizardCount();
        };
      } else {
        d.className='box-cell empty-cell';
        d.textContent=pos;
      }
      g.appendChild(d);
    });
    section.appendChild(g);
    wrap.appendChild(section);
  });
  wrap.appendChild(Object.assign(document.createElement('div'),{className:'hint',textContent:tr('cart_wizard_hint')}));
}

function wizardNext(){
  const item=cartItems[cartWizardIdx];
  cartWizardGroups[cartWizardIdx]=cartWizardSelected.length?groupSlotsByLocation(cartWizardSelected).map(g=>({...g,cell_id:item.cell_id,cell_name:item.cell_name})):[];
  cartWizardIdx++;
  renderCartWizardStep();
}

function wizardSkip(){
  cartWizardGroups[cartWizardIdx]=[];
  cartWizardIdx++;
  renderCartWizardStep();
}

function wizardPrev(){
  const item=cartItems[cartWizardIdx];
  cartWizardGroups[cartWizardIdx]=cartWizardSelected.length?groupSlotsByLocation(cartWizardSelected).map(g=>({...g,cell_id:item.cell_id,cell_name:item.cell_name})):[];
  cartWizardIdx--;
  renderCartWizardStep();
}

function flattenCartWizardGroups(){
  return cartWizardGroups.reduce((all,groups)=>all.concat(groups||[]),[]);
}

function renderCartReview(){
  const body=document.getElementById('cart-wizard-body');
  const groups=flattenCartWizardGroups();
  if(!groups.length){
    body.innerHTML='<div class="modal-title" style="color:var(--danger)">'+tr('cart_review_title')+'</div>'
      +'<p class="hint" style="margin:12px 0">'+tr('cart_review_empty')+'</p>'
      +'<div class="modal-actions"><button class="btn-secondary" onclick="cartWizardIdx=Math.max(0,cartItems.length-1);renderCartWizardStep()">'+tr('btn_wizard_back_review')+'</button>'
      +'<button class="btn-secondary" onclick="closeCartWizard()">'+tr('btn_cancel')+'</button></div>';
    return;
  }
  const totalQty=groups.reduce((s,g)=>s+g.occupied.length,0);
  const rows=groups.map(g=>'<div><span class="lk">'+escHtml(g.cell_name)+'</span> — <span class="lv">'+g.dewar+'/'+g.rack+'/'+g.box+'</span> — <span class="pv">'+g.occupied.join('  ')+'</span></div>').join('');
  body.innerHTML='<div class="modal-title" style="color:var(--danger)">'+tr('cart_review_title')+'</div>'
    +'<div class="pos-detail">'+rows+'<div style="margin-top:8px"><span class="lk">'+tr('pos_qty')+'</span><span class="lv">'+totalQty+' '+tr('unit_vial_short')+'</span></div></div>'
    +'<div class="form-grid" style="margin-top:14px">'
    +'<div class="form-group"><label class="form-label">'+tr('label_operator')+'</label><input class="form-input" id="cart-review-operator" readonly value="'+escHtml(config.username||tr('operator_unknown'))+'"></div>'
    +'<div class="form-group full"><label class="form-label">'+tr('label_purpose')+'</label><textarea class="form-textarea" id="cart-review-purpose"></textarea></div>'
    +'<div class="form-group full"><label class="form-label">'+tr('label_notes_optional')+'</label><input class="form-input" id="cart-review-notes"></div>'
    +'</div>'
    +'<div class="modal-actions">'
    +'<button class="btn-secondary" onclick="cartWizardIdx=Math.max(0,cartItems.length-1);renderCartWizardStep()">'+tr('btn_wizard_back_review')+'</button>'
    +'<button class="btn-primary" onclick="submitCartCheckout()">'+tr('btn_confirm_cart_checkout')+'</button>'
    +'</div>';
}

async function submitCartCheckout(){
  const groups=flattenCartWizardGroups();
  if(!groups.length) return;
  const operator=config.username||tr('operator_unknown');
  const purpose=document.getElementById('cart-review-purpose').value.trim();
  const notes=document.getElementById('cart-review-notes').value.trim();
  const items=groups.map(g=>({cell_id:g.cell_id,dewar:g.dewar,rack:g.rack,box:g.box,positions:g.occupied}));
  try{
    const res=await apiPost('take_vials_batch',{items,operator,purpose,notes});
    applyServerState(res.state);
    const totalQty=groups.reduce((s,g)=>s+g.occupied.length,0);
    cartItems=[];cartWizardGroups=[];cartWizardSelected=[];
    closeCartWizard();
    renderCartBadge();
    if(currentCell) renderCard();
    showToast(tr('toast_cart_checkout_success',{qty:totalQty}));
    showCartPosModal(groups);
  }catch(e){
    console.error('購物車結帳失敗：',e);
    showToast(tr('toast_cart_checkout_failed',{message:e.message}));
    await loadData();
    renderCartReview();
  }
}

function showCartPosModal(groups){
  const detEl=document.getElementById('cart-pos-modal-detail');
  const rows=groups.map(g=>'<div><span class="lk">'+escHtml(g.cell_name)+'</span> — <span class="lv">'+g.dewar+'/'+g.rack+'/'+g.box+'</span> — <span class="pv">'+g.occupied.join('  ')+'</span></div>').join('');
  detEl.innerHTML=rows;
  document.getElementById('cart-pos-modal').classList.add('open');
}
