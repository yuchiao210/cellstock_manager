function boxSlotCapacity(){return BOX_GRID_N*BOX_GRID_N;}
function allBoxPositions(){
  return Array.from({length:BOX_GRID_N*BOX_GRID_N},(_,i)=>String(i+1));
}
const DEFAULT_DEWAR_CONFIG={racks:['Rack 1','Rack 2','Rack 3','Rack 4','Rack 5','Rack 6'],boxes:['Box 1','Box 2','Box 3','Box 4','Box 5'],gridN:5};

function cloneDewarConfig(cfg){
  cfg=cfg||DEFAULT_DEWAR_CONFIG;
  return {
    racks:Array.isArray(cfg.racks)&&cfg.racks.length?cfg.racks.slice():DEFAULT_DEWAR_CONFIG.racks.slice(),
    boxes:Array.isArray(cfg.boxes)&&cfg.boxes.length?cfg.boxes.slice():DEFAULT_DEWAR_CONFIG.boxes.slice(),
    gridN:parseInt(cfg.gridN,10)||DEFAULT_DEWAR_CONFIG.gridN
  };
}

function getDewarConfig(dewarName){
  return cloneDewarConfig(config.dewarConfigs&&config.dewarConfigs[dewarName]);
}

function applyDewarConfig(dewarName){
  const cfg=getDewarConfig(dewarName);
  MAINT_RACKS=cfg.racks.slice();
  MAINT_BOXES=cfg.boxes.slice();
  BOX_GRID_N=cfg.gridN;
}

function getStorageLocations(){
  const all=[];
  MAINT_DEWARS.forEach(dewar=>{
    const cfg=getDewarConfig(dewar);
    cfg.racks.forEach(rack=>cfg.boxes.forEach(box=>all.push({dewar,rack,box})));
  });
  return all;
}
function usedDewarsFromData(){
  const used=new Set();
  cellDb.forEach(cell=>(cell.locations||[]).forEach(loc=>{if(loc.dewar) used.add(loc.dewar);}));
  return used;
}
function usedStorageConfigFromData(){
  const used={};
  cellDb.forEach(cell=>(cell.locations||[]).forEach(loc=>{
    if(!loc.dewar) return;
    if(!used[loc.dewar]) used[loc.dewar]={racks:new Set(),boxes:new Set()};
    if(loc.rack) used[loc.dewar].racks.add(loc.rack);
    if(loc.box) used[loc.dewar].boxes.add(loc.box);
  }));
  return used;
}
function mergeUnique(base,extra){
  return Array.from(new Set([...(Array.isArray(base)?base:[]),...(Array.isArray(extra)?extra:[])]));
}
function sameArray(a,b){
  return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
}
function syncStorageConfigWithData(){
  const usedByDewar=usedStorageConfigFromData();
  const used=new Set(Object.keys(usedByDewar));
  const configured=Array.isArray(config.maintDewars) ? config.maintDewars.filter(Boolean) : MAINT_DEWARS;
  const oldDefaultExtras=new Set(['Dewar 2','Dewar 3','Dewar 4']);
  const migrated=config.storageConfigVersion>=STORAGE_CONFIG_VERSION
    ? configured
    : configured.filter(d=>d==='Dewar 1' || used.has(d) || !oldDefaultExtras.has(d));
  const nextDewars=Array.from(new Set(['Dewar 1', ...migrated, ...used]));
  let changed=!sameArray(config.maintDewars||[],nextDewars)||config.storageConfigVersion!==STORAGE_CONFIG_VERSION;
  MAINT_DEWARS=Array.from(new Set(['Dewar 1', ...migrated, ...used]));
  config.maintDewars=MAINT_DEWARS;
  config.storageConfigVersion=STORAGE_CONFIG_VERSION;
  if(!config.dewarConfigs) config.dewarConfigs={};
  MAINT_DEWARS.forEach(dewar=>{
    const current=cloneDewarConfig(config.dewarConfigs[dewar]);
    const usedCfg=usedByDewar[dewar];
    const next={
      racks:mergeUnique(current.racks,usedCfg?Array.from(usedCfg.racks):[]),
      boxes:mergeUnique(current.boxes,usedCfg?Array.from(usedCfg.boxes):[]),
      gridN:current.gridN
    };
    const existing=config.dewarConfigs[dewar];
    if(!existing||!sameArray(existing.racks,next.racks)||!sameArray(existing.boxes,next.boxes)||parseInt(existing.gridN,10)!==next.gridN) changed=true;
    config.dewarConfigs[dewar]=next;
  });
  if(changed) saveConfig();
  if(!MAINT_DEWARS.includes(maintState.dewar)) maintState.dewar=MAINT_DEWARS[0];
  applyDewarConfig(maintState.dewar);
}

function escHtml(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
