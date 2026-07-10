function openAdminModal(mode){
  pendingExportType=mode;
  document.getElementById('admin-user').value='';
  document.getElementById('admin-pass').value='';
  document.getElementById('admin-error').style.display='none';
  const imp=document.getElementById('admin-import-section');
  const desc=document.getElementById('admin-desc');
  const btn=document.getElementById('admin-confirm-btn');
  if(mode==='import'){
    imp.style.display='block';
    document.getElementById('admin-import-file').value='';
    desc.textContent=tr('admin_desc_import');
    btn.textContent=tr('btn_validate_import');
  } else if(mode==='maint'){
    imp.style.display='none';
    desc.textContent=tr('admin_desc_maint');
    btn.textContent=tr('btn_confirm');
  } else if(mode==='issues'){
    imp.style.display='none';
    desc.textContent=tr('admin_desc_issues');
    btn.textContent=tr('btn_confirm');
  } else if(mode==='store'){
    imp.style.display='none';
    desc.textContent=tr('admin_desc_store');
    btn.textContent=tr('btn_confirm');
  } else {
    imp.style.display='none';
    desc.textContent=mode==='log'?tr('admin_desc_export_log'):tr('admin_desc_export_cells');
    btn.textContent=tr('btn_validate_export');
  }
  document.getElementById('admin-modal').classList.add('open');
  setTimeout(()=>document.getElementById('admin-user').focus(),100);
}
function closeAdminModal(){document.getElementById('admin-modal').classList.remove('open');pendingExportType=null;}
async function submitAdminAuth(){
  const u=document.getElementById('admin-user').value.trim();
  const p=document.getElementById('admin-pass').value;
  try{
    await apiPost('admin_login',{username:u,password:p});
    ADMIN_CREDENTIALS.username=u;
    transientAdminAuth={username:u,password:p};
    localStorage.setItem('admin_username',u);
    const action=pendingExportType;
    closeAdminModal();
    if(action==='log')exportLogCSV();
    else if(action==='cells')exportCellsCSV();
    else if(action==='import')importCellsCSV();
    else if(action==='maint')startMaintenanceMode();
    else if(action==='issues'){await loadIssueReports();switchPage('issues');}
    else if(action==='store'){if(currentCell)openForm('store');}
  } catch(e) {
    document.getElementById('admin-error').style.display='block';
    document.getElementById('admin-pass').value='';
    document.getElementById('admin-pass').focus();
  }
}

function escCSV(v){if(v==null)return '';const s=String(v);return(s.includes(',')||s.includes('"')||s.includes('\n'))?'"'+s.replace(/"/g,'""')+'"':s;}
function downloadCSV(fn,rows){
  const csv=rows.map(r=>r.map(escCSV).join(',')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;a.click();URL.revokeObjectURL(a.href);
}
function exportLogCSV(){
  const map={take:tr('log_action_take'),store:tr('log_action_store'),view:tr('log_action_view'),register:tr('log_action_register'),issue:tr('log_action_issue')};
  const hdr=[tr('csv_log_action'),tr('csv_cell'),tr('csv_qty'),tr('csv_operator'),tr('csv_time'),tr('csv_location'),tr('csv_slots'),tr('csv_purpose_notes')];
  const rows=actionLog.map(r=>[map[r.type]||r.type,typeof logCellText==='function'?logCellText(r.cell||''):r.cell||'',r.qty!=null?r.qty:'',r.operator,formatLogCsvTime(r.time),r.locationStr||'',r.positions||'',typeof logText==='function'?logText(r.purpose||r.notes||''):r.purpose||r.notes||'']);
  downloadCSV(tr('csv_log_filename')+'_'+new Date().toISOString().slice(0,10)+'.csv',[hdr,...rows]);
  showToast(tr('toast_log_exported'));
}
function formatLogCsvTime(value){
  if(value instanceof Date) return value.toLocaleString(currentLang==='zh'?'zh-TW':'en-US');
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:d.toLocaleString(currentLang==='zh'?'zh-TW':'en-US');
}
function exportCellsCSV(){
  const hdr=['name','source','passage','species','tissue','genotype','geno_detail','medium','serum','abx','selection','cryoprotectant','notes','culture_notes','qc_notes','registrant','register_date','locations','total_stock'];
  const rows=cellDb.map(c=>{
    const locStr=(c.locations||[]).map(l=>l.dewar+'|'+l.rack+'|'+l.box+'|'+(l.occupied||[]).join(',')).join(';');
    return [c.name,c.source||'',c.passage||'',c.species||'',c.tissue||'',c.genotype||'',c.geno_detail||'',c.medium||'',c.serum||'',c.abx||'',c.selection||'',c.cryoprotectant||'',c.notes||'',c.culture_notes||'',c.qc_notes||'',c.registrant||'',c.register_date||'',locStr,c.stock||0];
  });
  downloadCSV(tr('csv_cells_filename')+'_'+new Date().toISOString().slice(0,10)+'.csv',[hdr,...rows]);
  showToast(tr('toast_cells_exported'));
}
function importCellsCSV(){
  const file=document.getElementById('admin-import-file').files[0];
  if(!file){showToast(tr('toast_select_csv'));return;}
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const text=e.target.result.replace(/^﻿/,'');
      const lines=text.split('\n').filter(l=>l.trim());
      if(lines.length<2){showToast(tr('toast_csv_format_error'));return;}
      const hdrs=parseCSVRow(lines[0]).map(h=>h.trim().toLowerCase());
      const ni=hdrs.indexOf('name');if(ni===-1){showToast(tr('toast_csv_no_name'));return;}
      const fi=h=>hdrs.indexOf(h);
      const imports=[];
      for(let i=1;i<lines.length;i++){
        if(!lines[i].trim())continue;
        const cols=parseCSVRow(lines[i]);
        const name=cols[ni]?.trim();if(!name)continue;
        const locStr=fi('locations')>=0?cols[fi('locations')]?.trim():'';
        const locs=parseLocations(locStr);
        const stock=locs.reduce((s,l)=>s+l.quantity,0);
        const col=(key)=>fi(key)>=0?cols[fi(key)]?.trim()||'':'';
        const data={source:col('source'),passage:col('passage'),species:col('species'),tissue:col('tissue'),genotype:col('genotype'),geno_detail:col('geno_detail'),medium:col('medium'),serum:col('serum'),abx:col('abx'),selection:col('selection'),cryoprotectant:col('cryoprotectant'),notes:col('notes'),culture_notes:col('culture_notes'),qc_notes:col('qc_notes'),registrant:col('registrant'),register_date:col('register_date'),locations:locs,stock};
        imports.push({name,...data});
      }
      if(!imports.length){showToast(tr('toast_csv_no_rows'));return;}
      showToast(tr('toast_importing',{count:imports.length}));
      const chunkSize=25;
      let added=0,updated=0,lastState=null;
      for(let start=0;start<imports.length;start+=chunkSize){
        const chunk=imports.slice(start,start+chunkSize);
        try{
          const res=await apiPost('import_cells',{cells:chunk});
          added+=res.result?.added||0;
          updated+=res.result?.updated||0;
          lastState=res.state||lastState;
          showToast(tr('toast_import_progress',{done:Math.min(start+chunk.length,imports.length),total:imports.length}));
        }catch(err){
          throw new Error(tr('err_import_chunk',{from:start+1,to:Math.min(start+chunk.length,imports.length),message:err.message}));
        }
      }
      applyServerState(lastState);
      showToast(tr('toast_import_done',{added,updated}));
      if(document.getElementById('search-input').value)onSearch(document.getElementById('search-input').value);
    }catch(err){
      const apiDetail=localStorage.getItem('cellstock_last_api_error')||'';
      const msg=tr('err_import_prefix',{message:err.message})+(apiDetail?'\n\nAPI detail:\n'+apiDetail:'');
      showToast(tr('toast_import_failed'));
      showErrorPanel(msg);
    }
  };
  reader.readAsText(file,'UTF-8');
}
function parseCSVRow(line){
  const res=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(ch===','&&!inQ){res.push(cur);cur='';}
    else cur+=ch;
  }
  res.push(cur);return res;
}
function parseLocations(locStr){
  if(!locStr)return[];
  return locStr.split(';').map(seg=>{
    const p=seg.trim().split('|');
    const d=p[0]?.trim()||'',r=p[1]?.trim()||'',b=p[2]?.trim()||'';
    const occ=(p[3]||'').split(',').map(x=>x.trim()).filter(Boolean);
    return{dewar:d,rack:r,box:b,occupied:occ,quantity:occ.length};
  }).filter(l=>l.dewar);
}
