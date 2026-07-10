const ISSUE_TYPE_LABELS={
  unknown_vial_in_empty_slot:'issue_type_unknown_vial_in_empty_slot',
  missing_expected_vial:'issue_type_missing_expected_vial',
  label_unclear:'issue_type_label_unclear',
  data_mismatch:'issue_type_data_mismatch',
  damaged_or_contaminated:'issue_type_damaged_or_contaminated',
  other:'issue_type_other'
};
const ISSUE_STATUS_LABELS={open:'issue_status_open',reviewing:'issue_status_reviewing',resolved:'issue_status_resolved',dismissed:'issue_status_dismissed'};
let issueSelectedPositions=[];

function issueTypeLabel(type){return ISSUE_TYPE_LABELS[type]?tr(ISSUE_TYPE_LABELS[type]):(type||tr('issue_title_fallback'));}
function issueStatusLabel(status){return ISSUE_STATUS_LABELS[status]?tr(ISSUE_STATUS_LABELS[status]):(status||tr('issue_status_open'));}
function issueLocation(issue){
  return [issue.dewar,issue.rack,issue.box].filter(Boolean).join('/')+(issue.position?'/'+issue.position:'');
}
function openIssueReportModal(){
  populateIssueSelectors();
  issueSelectedPositions=[];
  document.getElementById('issue-type').value='unknown_vial_in_empty_slot';
  document.getElementById('issue-priority').value='normal';
  document.getElementById('issue-operator').value=config.username||tr('operator_unknown');
  ['issue-label','issue-cell-name','issue-passage','issue-date','issue-notes'].forEach(id=>document.getElementById(id).value='');
  renderIssueBoxGrid();
  document.getElementById('issue-report-modal').classList.add('open');
  setTimeout(()=>document.getElementById('issue-type').focus(),100);
}
function closeIssueReportModal(){document.getElementById('issue-report-modal').classList.remove('open');}

function populateIssueSelectors(){
  const dewars=Array.from(new Set([...MAINT_DEWARS,...getStorageLocations().map(l=>l.dewar)])).filter(Boolean);
  const dewarEl=document.getElementById('issue-dewar');
  const rackEl=document.getElementById('issue-rack');
  const boxEl=document.getElementById('issue-box');
  dewarEl.innerHTML=dewars.map(d=>'<option>'+escHtml(d)+'</option>').join('')||'<option>Dewar 1</option>';
  function refreshIssueRackBox(){
    const cfg=getDewarConfig(dewarEl.value);
    rackEl.innerHTML=cfg.racks.map(r=>'<option>'+escHtml(r)+'</option>').join('');
    boxEl.innerHTML=cfg.boxes.map(b=>'<option>'+escHtml(b)+'</option>').join('');
  }
  refreshIssueRackBox();
  dewarEl.onchange=()=>{refreshIssueRackBox();onIssueLocationChange();};
  rackEl.onchange=onIssueLocationChange;
}

function onIssueLocationChange(){
  issueSelectedPositions=[];
  renderIssueBoxGrid();
}

function renderIssueBoxGrid(){
  const grid=document.getElementById('issue-box-grid');
  const locLabel=document.getElementById('issue-grid-location');
  if(!grid) return;
  const dewar=document.getElementById('issue-dewar').value;
  const rack=document.getElementById('issue-rack').value;
  const box=document.getElementById('issue-box').value;
  locLabel.textContent=[dewar,rack,box].filter(Boolean).join(' / ');
  const occupied=getIssueOccupiedPositions(dewar,rack,box);
  grid.style.gridTemplateColumns='repeat('+BOX_GRID_N+',minmax(42px,1fr))';
  grid.innerHTML=allBoxPositions().map(pos=>{
    const isSelected=issueSelectedPositions.includes(pos);
    const isOccupied=occupied.has(pos);
    return '<button type="button" class="issue-grid-cell '+(isOccupied?'occupied':'empty')+(isSelected?' selected':'')+'" onclick="toggleIssuePosition(\''+pos+'\')" title="'+escHtml(pos+' '+(isOccupied?tr('issue_occupied_title'):tr('issue_empty_title')))+'">'+
      '<span>'+pos+'</span>'+
    '</button>';
  }).join('');
  updateIssueSelectedLabel();
}

function getIssueOccupiedPositions(dewar,rack,box){
  const occupied=new Set();
  cellDb.forEach(cell=>(cell.locations||[]).forEach(loc=>{
    if(loc.dewar===dewar&&loc.rack===rack&&loc.box===box){
      (loc.occupied||[]).forEach(pos=>occupied.add(pos));
    }
  }));
  return occupied;
}

function toggleIssuePosition(pos){
  const idx=issueSelectedPositions.indexOf(pos);
  if(idx>=0) issueSelectedPositions.splice(idx,1);
  else issueSelectedPositions.push(pos);
  issueSelectedPositions.sort(positionSort);
  renderIssueBoxGrid();
}

function clearIssuePositions(){
  issueSelectedPositions=[];
  renderIssueBoxGrid();
}

function updateIssueSelectedLabel(){
  const el=document.getElementById('issue-selected-label');
  if(!el) return;
  el.textContent=issueSelectedPositions.length
    ? tr('issue_selected_count',{count:issueSelectedPositions.length,positions:issueSelectedPositions.join(', ')})
    : tr('issue_selected_none');
}

function positionSort(a,b){
  return Number(a)-Number(b)||String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
}

async function submitIssueReport(){
  const data={
    issue_type:document.getElementById('issue-type').value,
    priority:document.getElementById('issue-priority').value,
    operator:config.username||tr('operator_unknown'),
    dewar:document.getElementById('issue-dewar').value,
    rack:document.getElementById('issue-rack').value,
    box:document.getElementById('issue-box').value,
    positions:[...issueSelectedPositions],
    observed_label:document.getElementById('issue-label').value.trim(),
    observed_cell_name:document.getElementById('issue-cell-name').value.trim(),
    observed_passage:document.getElementById('issue-passage').value.trim(),
    observed_date:document.getElementById('issue-date').value.trim(),
    observed_notes:document.getElementById('issue-notes').value.trim()
  };
  if(!data.dewar||!data.rack||!data.box||!data.positions.length){showToast(tr('issue_alert_position'));return;}
  try{
    const res=await apiPost('create_issue_report',data);
    applyServerState(res.state);
    closeIssueReportModal();
    showToast(tr('issue_toast_created',{id:res.issue_id}));
  }catch(e){
    console.error('異常回報失敗：',e);
    showApiError(tr('issue_create_failed'),e);
  }
}

function updateIssueBadge(){
  const openCount=issueOpenCount||issueReports.filter(i=>i.status==='open'||i.status==='reviewing').length;
  const badge=document.getElementById('issue-badge');
  if(!badge) return;
  badge.textContent=openCount;
  badge.style.display=openCount?'inline-flex':'none';
}

function renderIssuePage(){
  const list=document.getElementById('issue-list');
  const summary=document.getElementById('issue-summary');
  if(!list||!summary) return;
  const open=issueReports.filter(i=>i.status==='open').length;
  const reviewing=issueReports.filter(i=>i.status==='reviewing').length;
  const closed=issueReports.filter(i=>i.status==='resolved'||i.status==='dismissed').length;
  summary.innerHTML=[
    ['var(--warn)',open,tr('issue_status_open')],
    ['var(--accent2)',reviewing,tr('issue_status_reviewing')],
    ['var(--text-dim)',closed,tr('issue_closed')]
  ].map(([color,num,label])=>'<div class="issue-stat"><div class="issue-stat-num" style="color:'+color+'">'+num+'</div><div class="issue-stat-lbl">'+label+'</div></div>').join('');
  if(!issueReports.length){
    list.innerHTML='<div class="issue-empty">'+tr('issue_empty')+'</div>';
    return;
  }
  list.innerHTML=issueReports.map(issue=>renderIssueCard(issue)).join('');
}

function renderIssueCard(issue){
  const isClosed=issue.status==='resolved'||issue.status==='dismissed';
  const high=issue.priority==='high';
  const created=issue.created_at?new Date(issue.created_at).toLocaleString(currentLang==='zh'?'zh-TW':'en-US'):'';
  return '<article class="issue-card '+escHtml(issue.status)+(high?' high':'')+'">'+
    '<div class="issue-card-main">'+
      '<div class="issue-card-head">'+
        '<div><span class="issue-id">#'+issue.id+'</span> <span class="issue-title">'+escHtml(issueTypeLabel(issue.issue_type))+'</span></div>'+
        '<div class="issue-status '+escHtml(issue.status)+'">'+escHtml(issueStatusLabel(issue.status))+'</div>'+
      '</div>'+
      '<div class="issue-meta">'+
        '<span>'+escHtml(tr('issue_location_prefix'))+'<strong>'+escHtml(issueLocation(issue))+'</strong></span>'+
        '<span>'+escHtml(tr('issue_reporter_prefix'))+escHtml(issue.operator||tr('operator_unknown'))+'</span>'+
        '<span>'+escHtml(created)+'</span>'+
        (high?'<span class="issue-priority">'+tr('issue_high')+'</span>':'')+
      '</div>'+
      '<div class="issue-observed">'+
        issueField(tr('issue_field_label'),issue.observed_label)+
        issueField(tr('issue_field_suspected_cell'),issue.observed_cell_name)+
        issueField('Passage',issue.observed_passage)+
        issueField(tr('issue_field_date'),issue.observed_date)+
        issueField(tr('issue_field_notes'),issue.observed_notes)+
        issueField(tr('issue_field_admin_notes'),issue.admin_notes)+
      '</div>'+
    '</div>'+
    '<div class="issue-actions">'+
      '<textarea class="form-textarea issue-admin-note" id="issue-note-'+issue.id+'" placeholder="'+escHtml(tr('issue_admin_note_ph'))+'">'+escHtml(issue.admin_notes||'')+'</textarea>'+
      '<div class="issue-action-row">'+
        issueButton(issue.id,'reviewing',tr('issue_btn_reviewing'),isClosed)+
        issueButton(issue.id,'resolved',tr('issue_btn_resolved'),false)+
        issueButton(issue.id,'dismissed',tr('issue_btn_dismissed'),false)+
        issueButton(issue.id,'open',tr('issue_btn_reopen'),!isClosed)+
      '</div>'+
    '</div>'+
  '</article>';
}
function issueField(label,value){
  if(!value) return '';
  return '<div><span>'+escHtml(label)+'：</span>'+escHtml(value)+'</div>';
}
function issueButton(id,status,label,disabled){
  return '<button type="button" class="sm-btn" '+(disabled?'disabled ':'')+'onclick="updateIssueStatus('+id+',\''+status+'\')">'+label+'</button>';
}
async function updateIssueStatus(id,status){
  const noteEl=document.getElementById('issue-note-'+id);
  try{
    const res=await apiPost('update_issue_report',{issue_id:id,status,admin_notes:noteEl?noteEl.value.trim():''});
    applyServerState(res.state);
    showToast(tr('issue_toast_updated',{id}));
  }catch(e){
    console.error('更新異常回報失敗：',e);
    showApiError(tr('issue_update_failed'),e);
  }
}
