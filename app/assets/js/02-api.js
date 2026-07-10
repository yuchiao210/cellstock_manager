async function apiPost(type,data){
  if(demoMode) return demoApiPost(type,data);
  const adminActions=['list_issue_reports','update_issue_report','maintenance_add_cell','maintenance_update_cell','maintenance_batch_update_cells','maintenance_delete_vial','maintenance_delete_vials','maintenance_rename_dewar','maintenance_rename_rack','maintenance_batch_rename_racks','maintenance_rename_box','maintenance_batch_rename_boxes','set_default_lang','import_cells','celldb','log','store_vials'];
  const payloadData=(data&&typeof data==='object')?{...data}:data;
  if(payloadData&&transientAdminAuth&&adminActions.includes(type)&&!payloadData.admin_auth){
    payloadData.admin_auth=transientAdminAuth;
  }
  const res=await fetch('api.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:type,data:payloadData})});
  const raw=await res.text();
  let j={};
  try{j=raw?JSON.parse(raw):{};}catch(_){j={raw:raw.slice(0,500)};}
  if(!res.ok){
    console.error('API error',res.status,j);
    const detail=j.error||j.raw||('HTTP '+res.status);
    const extra=j.json_error?('：'+j.json_error):'';
    localStorage.setItem('cellstock_last_api_error',JSON.stringify({status:res.status,response:j,raw:raw.slice(0,2000)},null,2));
    throw new Error(detail+extra);
  }
  if(j.error) throw new Error(j.error);
  return j;
}

function applyServerState(state){
  if(!state) return;
  const cellsChanged=Array.isArray(state.cells);
  if(cellsChanged) cellDb=state.cells;
  if(Array.isArray(state.operators)) operatorDb=state.operators;
  if(Array.isArray(state.log)) actionLog=state.log.map(r=>({...r,time:r.time?new Date(r.time):new Date()}));
  if(Array.isArray(state.issues)) issueReports=state.issues;
  if(Number.isFinite(Number(state.issue_open_count))) issueOpenCount=Number(state.issue_open_count);
  if(typeof state.lab_name==='string' && state.lab_name.trim() && !(config&&config.bannerText)){
    document.getElementById('lab-banner').textContent=state.lab_name.trim();
  }
  if(state.default_lang==='zh'||state.default_lang==='en'){
    serverDefaultLang=state.default_lang;
    // No explicit per-device choice → follow the installation/maintenance default.
    if(!localStorage.getItem('cellstock_lang') && currentLang!==serverDefaultLang && typeof setLang==='function'){
      setLang(serverDefaultLang,false);
    }
    if(typeof syncMaintLangSelect==='function') syncMaintLangSelect();
  }
  if(currentCell){
    const fresh=cellDb.find(c=>c.id===currentCell.id);
    if(fresh) currentCell=fresh;
  }
  if(cellsChanged&&typeof syncStorageConfigWithData==='function'){
    syncStorageConfigWithData();
    if(typeof populateDewarSelectors==='function') populateDewarSelectors();
    const maintPage=document.getElementById('page-maintenance');
    if(maintPage&&maintPage.classList.contains('active')&&typeof renderMaintenancePage==='function') renderMaintenancePage();
  }
  if(typeof updateIssueBadge==='function') updateIssueBadge();
  if(typeof renderIssuePage==='function') renderIssuePage();
}

async function saveData(){
  try{
    const res=await apiPost('celldb',cellDb);
    applyServerState(res.state);
  }catch(e){
    console.error('儲存失敗：',e);
    showToast(tr('toast_save_failed',{message:e.message}));
  }
}

async function loadData(){
  if(demoMode){
    applyServerState(demoSnapshot());
    if(!demoToastShown){
      demoToastShown=true;
      setTimeout(()=>showToast(currentLang==='en'?'Demo mode: sample data only':'Demo 模式：使用展示資料，不會寫入資料庫'),300);
    }
    return;
  }
  try{
    const res=await fetch('api.php?action=init');
    const state=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(state.error||tr('err_read_sqlite',{status:res.status}));
    if(state.error) throw new Error(state.error);
    applyServerState(state);
  }catch(e){
    console.error('載入失敗：',e);
    showToast(tr('toast_db_connect_failed',{message:e.message}));
  }
}

function demoSnapshot(){
  if(!window.cellstockDemoState){
    const now=new Date();
    window.cellstockDemoState={
      cells:[
        {
          id:101,name:'HEK293T-STIM1KO',source:'FCT lab',passage:'P18',species:'Human',tissue:'Kidney',
          genotype:'CRISPR Knockout',geno_detail:'STIM1-KO clone #7',medium:'DMEM',serum:'10% FBS',
          abx:'100 U/mL Pen/Strep',selection:'None',cryoprotectant:'7% DMSO + DMEM',
          notes:'Fast-growing demo cell line for search and access workflow.',culture_notes:'Split 1:5 every 2-3 days.',
          qc_results_json:'{"mycoplasma":"pass","morphology":"pass","identity":"pass"}',qc_notes:'Mycoplasma negative; morphology normal.',
          registrant:'Demo User',register_date:'2026-05-20',
          locations:[{dewar:'Dewar 1',rack:'Rack 2',box:'Box 3',occupied:['A1','A2','B4','C5'],quantity:4}],
          stock:4
        },
        {
          id:102,name:'A549-mCherry',source:'ATCC',passage:'P9',species:'Human',tissue:'Lung',
          genotype:'Stable overexpression',geno_detail:'mCherry reporter',medium:'RPMI-1640',serum:'10% FBS',
          abx:'100 U/mL Pen/Strep',selection:'Puromycin 1 ug/mL',cryoprotectant:'7% DMSO + DMEM',
          notes:'Bright reporter line for imaging demos.',culture_notes:'Protect from prolonged light exposure.',
          qc_results_json:'{"mycoplasma":"pass","morphology":"pass"}',qc_notes:'Reporter expression confirmed.',
          registrant:'Demo User',register_date:'2026-05-20',
          locations:[{dewar:'Dewar 1',rack:'Rack 1',box:'Box 1',occupied:['D1','D2','D3'],quantity:3}],
          stock:3
        },
        {
          id:103,name:'HeLa-control',source:'Lab stock',passage:'P24',species:'Human',tissue:'Cervix',
          genotype:'Wild-type',geno_detail:'',medium:'DMEM',serum:'10% FBS',
          abx:'None',selection:'None',cryoprotectant:'7% DMSO + DMEM',
          notes:'Control line for workflow demonstration.',culture_notes:'Avoid over-confluence before freezing.',
          qc_results_json:'{"mycoplasma":"pass"}',qc_notes:'Demo record.',
          registrant:'Demo User',register_date:'2026-05-20',
          locations:[{dewar:'Dewar 2',rack:'Rack 3',box:'Box 2',occupied:['A6','B6'],quantity:2}],
          stock:2
        }
      ],
      log:[
        {type:'store',cell:'HEK293T-STIM1KO',qty:4,operator:'Demo User',purpose:'Demo seed',notes:'Initial demo stock',locationStr:'Dewar 1 / Rack 2 / Box 3',positions:'A1, A2, B4, C5',time:new Date(now.getTime()-1000*60*12).toISOString()},
        {type:'view',cell:'A549-mCherry',qty:null,operator:'Demo User',purpose:'Viewed',notes:'',locationStr:'',positions:'',time:new Date(now.getTime()-1000*60*5).toISOString()}
      ],
      issues:[],
      issue_open_count:0,
      admin:true,
      lab_name:'FCT lab DEMO',
      default_lang:'en'
    };
  }
  const state=window.cellstockDemoState;
  state.cells.forEach(c=>{c.stock=(c.locations||[]).reduce((sum,l)=>sum+(l.occupied||[]).length,0);});
  return state;
}

function demoApiPost(type,data){
  const state=demoSnapshot();
  const now=new Date().toISOString();
  if(type==='list_issue_reports') return Promise.resolve({issues:state.issues,issue_open_count:state.issue_open_count});
  if(type==='admin_login') return Promise.resolve({ok:true,admin:true});
  if(type==='admin_logout') return Promise.resolve({ok:true,admin:false});
  if(type==='log_event'){
    state.log.unshift({
      type:'view',cell:data.cell||data.cell_name||'Demo cell',qty:data.qty??null,operator:data.operator||config.username||'Demo User',
      purpose:data.purpose||'Viewed',notes:data.notes||'',locationStr:data.locationStr||'',positions:data.positions||'',time:now
    });
    return Promise.resolve({ok:true,state});
  }
  if(type==='take_vials'){
    const cell=state.cells.find(c=>c.id===data.cell_id);
    if(cell){
      const positions=data.positions||[];
      (cell.locations||[]).forEach(loc=>{
        if(loc.dewar===data.dewar&&loc.rack===data.rack&&loc.box===data.box){
          loc.occupied=(loc.occupied||[]).filter(pos=>!positions.includes(pos));
          loc.quantity=loc.occupied.length;
        }
      });
      cell.locations=(cell.locations||[]).filter(loc=>(loc.occupied||[]).length>0);
      state.log.unshift({type:'take',cell:cell.name,qty:positions.length,operator:data.operator||config.username||'Demo User',purpose:data.purpose||'',notes:data.notes||'',locationStr:[data.dewar,data.rack,data.box].join(' / '),positions:positions.join(', '),time:now});
    }
    return Promise.resolve({ok:true,state});
  }
  if(type==='take_vials_batch'){
    (data.items||[]).forEach(item=>demoApiPost('take_vials',{...item,operator:data.operator,purpose:data.purpose,notes:data.notes}));
    return Promise.resolve({ok:true,state});
  }
  if(type==='store_vials'){
    const sourceCell=state.cells.find(c=>c.id===data.cell_id);
    if(sourceCell){
      const overrides=data.cell||{};
      const normalizedPassage=overrides.passage?normalizePassageInput(overrides.passage):'';
      const previewName=(overrides.name||sourceCell.name||'').trim();
      const previewPassage=normalizedPassage||sourceCell.passage||'';
      let cell=state.cells.find(c=>((c.name||'').trim()===previewName)&&((normalizePassageInput(c.passage||'')||c.passage||'')===previewPassage));
      if(!cell){
        const newId=Math.max(...state.cells.map(c=>c.id||0),0)+1;
        cell={...sourceCell,...overrides,id:newId,locations:[],stock:0};
        if(normalizedPassage) cell.passage=normalizedPassage;
        if(overrides.name) cell.name=overrides.name;
        if(overrides.register_date) cell.register_date=overrides.register_date;
        state.cells.push(cell);
      } else if(cell.id!==sourceCell.id){
        Object.assign(cell,overrides);
        if(normalizedPassage) cell.passage=normalizedPassage;
      } else {
        Object.assign(cell,overrides);
        if(normalizedPassage) cell.passage=normalizedPassage;
      }
      (data.locations||[]).forEach(inLoc=>{
        let loc=(cell.locations||[]).find(l=>l.dewar===inLoc.dewar&&l.rack===inLoc.rack&&l.box===inLoc.box);
        if(!loc){loc={dewar:inLoc.dewar,rack:inLoc.rack,box:inLoc.box,occupied:[],quantity:0};cell.locations.push(loc);}
        (inLoc.occupied||[]).forEach(pos=>{if(!loc.occupied.includes(pos)) loc.occupied.push(pos);});
        loc.quantity=loc.occupied.length;
      });
      const positions=(data.locations||[]).flatMap(l=>l.occupied||[]);
      const locationStr=(data.locations||[]).map(l=>[l.dewar,l.rack,l.box].join(' / ')).join('; ');
      state.log.unshift({type:'store',cell:cell.name,qty:positions.length,operator:data.operator||config.username||'Demo User',purpose:'',notes:data.notes||'',locationStr,positions:positions.join(', '),time:now});
      return Promise.resolve({ok:true,state,cell_id:cell.id});
    }
    return Promise.resolve({ok:true,state});
  }
  return Promise.resolve({ok:true,state});
}

async function loadIssueReports(){
  try{
    const res=await apiPost('list_issue_reports',{});
    if(Array.isArray(res.issues)) issueReports=res.issues;
    if(Number.isFinite(Number(res.issue_open_count))) issueOpenCount=Number(res.issue_open_count);
    if(typeof updateIssueBadge==='function') updateIssueBadge();
    if(typeof renderIssuePage==='function') renderIssuePage();
    return res;
  }catch(e){
    console.error('載入異常待辦失敗：',e);
    showToast(tr('toast_load_issues_failed',{message:e.message}));
    throw e;
  }
}
