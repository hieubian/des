/* ===== UI: Router, Views, Components ===== */

// ===== UTILS =====
const $=id=>document.getElementById(id);
const html=s=>{const d=document.createElement("div");d.innerHTML=s.trim();return d.firstChild;};
function showToast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500);}
function showModal(title,message,onConfirm,danger=true){
  const m=$("confirmModal");$("modalTitle").textContent=title;$("modalMessage").textContent=message;
  const cb=$("modalConfirm");cb.className="btn "+(danger?"btn-danger":"btn-primary");cb.textContent=danger?"Xóa":"Xác nhận";
  m.classList.add("show");
  const cancel=()=>{m.classList.remove("show");$("modalCancel").removeEventListener("click",cancel);};
  $("modalCancel").onclick=cancel;
  m.onclick=e=>{if(e.target===m)cancel();};
  cb.onclick=async()=>{await onConfirm();m.classList.remove("show");};
}
function formatDate(d){return new Date(d).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function esc(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML;}

// ===== ROUTER =====
function getRoute(){
  const h=location.hash.slice(1)||"/";
  if(h==="/")return{page:"home"};
  if(h==="/quick")return{page:"quick"};
  const cm=h.match(/^\/config\/(\d+)$/);if(cm)return{page:"config",id:parseInt(cm[1])};
  if(h==="/config/new")return{page:"config",id:null};
  const rm=h.match(/^\/results\/(\d+)$/);if(rm)return{page:"results",id:parseInt(rm[1])};
  return{page:"home"};
}
async function navigate(){
  const route=getRoute();
  const app=$("appContent");
  app.innerHTML="";
  const wrap=document.createElement("div");
  wrap.className="page-enter";
  app.appendChild(wrap);
  try{
    if(route.page==="home")await renderHome(wrap);
    else if(route.page==="quick")renderQuickDES(wrap);
    else if(route.page==="config")await renderConfigEditor(wrap,route.id);
    else if(route.page==="results")await renderResults(wrap,route.id);
  }catch(e){wrap.innerHTML=`<div class="alert alert-error">Lỗi: ${esc(e.message)}</div>`;}
}
window.addEventListener("hashchange",navigate);
window.addEventListener("DOMContentLoaded",navigate);

// ===== HOME VIEW =====
async function renderHome(container){
  const configs=await db.getAll();
  let h=`<div class="page-header"><div><h1 class="page-title">DES Calculator</h1></div><div class="page-actions"><a href="#/quick" class="btn btn-outline">⚡ Mã hóa DES</a><a href="#/config/new" class="btn btn-primary">＋ Tùy chỉnh nâng cao</a></div></div>`;
  if(configs.length===0){
    h+=`<div class="card"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">Chưa có cấu hình nào</div><div class="empty-desc">Tạo cấu hình đầu tiên để bắt đầu mô phỏng thuật toán DES.</div><a href="#/config/new" class="btn btn-outline" style="margin-top:8px">Tạo cấu hình mới</a></div></div>`;
  }else{
    h+=`<div class="stack">`;
    configs.forEach(c=>{
      h+=`<div class="card session-card" data-id="${c.id}"><div class="session-card-info"><div class="session-card-name">${esc(c.name)}</div><div class="session-card-meta"><span class="chip">Đầu vào: ${c.input64.slice(0,12)}…</span><span style="font-size:0.72rem;color:var(--text-tertiary)" class="hide-mobile">Cập nhật: ${formatDate(c.updatedAt)}</span></div></div><div class="session-card-actions"><button class="btn-icon primary" title="Xem kết quả" data-action="view" data-id="${c.id}">▶</button><button class="btn-icon" title="Chỉnh sửa" data-action="edit" data-id="${c.id}">✏️</button><button class="btn-icon danger" title="Xóa" data-action="delete" data-id="${c.id}">🗑</button></div></div>`;
    });
    h+=`</div>`;
  }
  container.innerHTML=h;
  container.addEventListener("click",e=>{
    const btn=e.target.closest("[data-action]");if(!btn)return;
    const action=btn.dataset.action,id=parseInt(btn.dataset.id);
    if(action==="view")location.hash=`#/results/${id}`;
    else if(action==="edit")location.hash=`#/config/${id}`;
    else if(action==="delete")showModal("Xóa cấu hình","Bạn có chắc muốn xóa cấu hình này? Hành động này không thể hoàn tác.",async()=>{await db.remove(id);showToast("Đã xóa cấu hình");navigate();});
  });
}

// ===== CONFIG EDITOR VIEW =====
async function renderConfigEditor(container,id){
  const isNew=id===null;
  let cfg;
  if(!isNew){cfg=await db.getById(id);if(!cfg){container.innerHTML=`<div class="alert alert-error">Không tìm thấy cấu hình. Có thể đã bị xóa.</div><a href="#/" class="btn btn-secondary" style="margin-top:12px">← Quay lại</a>`;return;}}

  // State
  const state={
    name:cfg?cfg.name:`Cấu hình ${new Date().toLocaleString("vi-VN")}`,
    input64:cfg?cfg.input64:DEFAULT_INPUT_64,
    ipTable:cfg?[...cfg.ipTable]:[...DEFAULT_IP_TABLE],
    eTable:cfg?[...cfg.eTable]:[...DEFAULT_E_TABLE],
    pTable:cfg?[...cfg.pTable]:[...DEFAULT_P_TABLE],
    subkeys:cfg?[...cfg.subkeys]:[...DEFAULT_SUBKEYS],
    sBoxes:cfg?cfg.sBoxes.map(b=>b.map(r=>[...r])):DEFAULT_S_BOXES.map(b=>b.map(r=>[...r])),
    tab:0, activeSBox:0, saving:false
  };
  const TABS=["Đầu vào 64-bit","Bảng IP","Bảng E","Bảng P","Khóa con K1-K16","S-Box"];

  function buildConfig(){return{name:state.name,input64:state.input64,ipTable:state.ipTable,eTable:state.eTable,pTable:state.pTable,subkeys:state.subkeys,sBoxes:state.sBoxes};}

  function renderEditor(){
    const errors=validateConfig(buildConfig());
    let h=`<div class="page-header"><div><h1 class="page-title">${isNew?"Tạo cấu hình mới":"Chỉnh sửa cấu hình"}</h1></div><div class="page-actions"><button class="btn btn-secondary btn-sm" id="btnReset">↺ Đặt lại</button><button class="btn btn-primary btn-sm" id="btnSave" ${state.saving||errors.length>0?"disabled":""}>${isNew?"Lưu & Tính toán":"Cập nhật & Tính toán"}</button></div></div>`;
    h+=`<div class="stack"><div class="form-group"><label class="form-label">Tên cấu hình</label><input class="form-input" id="cfgName" value="${esc(state.name)}" maxlength="80"></div>`;
    if(errors.length>0){
      h+=`<div class="alert alert-warning"><div><strong>${errors.length} lỗi cần sửa:</strong><ul>${errors.slice(0,5).map(e=>`<li>${esc(e.message)}</li>`).join("")}${errors.length>5?`<li>…và ${errors.length-5} lỗi khác</li>`:""}</ul></div></div>`;
    }
    // Tabs
    h+=`<div class="card"><div class="card-body" style="padding:8px 12px"><div class="tabs-container"><div class="tabs">${TABS.map((t,i)=>`<button class="tab${state.tab===i?" active":""}" data-tab="${i}">${t}</button>`).join("")}</div></div></div>`;
    h+=`<div class="card-body" id="tabContent">`;
    h+=renderTabContent();
    h+=`</div></div></div>`;
    container.innerHTML=h;
    bindEditorEvents();
  }

  function renderTabContent(){
    if(state.tab===0)return renderBitInput();
    if(state.tab===1)return renderTableEditor("Bảng IP (Hoán vị ban đầu)","8×8 — 64 phần tử, giá trị 1-64, không trùng",state.ipTable,64,1,64,false,8);
    if(state.tab===2)return renderTableEditor("Bảng E (Mở rộng)","6×8 — 48 phần tử, giá trị 1-32",state.eTable,48,1,32,true,8);
    if(state.tab===3)return renderTableEditor("Bảng P (Hoán vị)","4×8 — 32 phần tử, giá trị 1-32, không trùng",state.pTable,32,1,32,false,8);
    if(state.tab===4)return renderKeysEditor();
    if(state.tab===5)return renderSBoxEditor();
    return "";
  }

  function renderBitInput(){
    const v=state.input64;const err=v.length>0?validateBinaryString(v,64):null;
    const chunks=[];for(let i=0;i<64;i+=8)chunks.push(v.slice(i,i+8).padEnd(8,"_"));
    let h=`<div class="stack"><div class="form-group"><label class="form-label">Đầu vào 64-bit</label><input class="form-input mono ${err?"error":""}" id="bitInput" value="${esc(v)}" maxlength="64" placeholder="Nhập 64 bit (chỉ 0 và 1)…"><span class="${err?"form-error":"form-hint"}">${err||`${v.length}/64 ký tự`}</span></div>`;
    if(v.length>0){
      h+=`<div class="bit-grid">${chunks.map((c,i)=>`<div class="bit-chunk"><span class="bit-chunk-value${c.includes("_")?" placeholder":""}">${c}</span><span class="bit-chunk-label">${i*8+1}-${i*8+8}</span></div>`).join("")}</div>`;
    }
    return h+`</div>`;
  }

  function renderTableEditor(label,desc,arr,expectedLen,minV,maxV,allowDup,cols){
    const raw=arr.join(" ");
    const valid=arr.length===expectedLen&&arr.every(v=>v>=minV&&v<=maxV)&&(allowDup||new Set(arr).size===expectedLen);
    let errMsg=null;
    if(arr.length>0){
      if(arr.length!==expectedLen)errMsg=`Cần đúng ${expectedLen} phần tử, hiện có ${arr.length}.`;
      else if(arr.some(v=>v<minV||v>maxV))errMsg=`Giá trị phải trong khoảng ${minV}-${maxV}.`;
      else if(!allowDup&&new Set(arr).size!==expectedLen)errMsg="Không được có giá trị trùng lặp.";
    }
    let h=`<div class="stack"><div class="row row-between"><span class="form-label">${label}</span><span class="chip ${valid?"chip-success":arr.length===0?"":"chip-warning"}">${arr.length}/${expectedLen}</span></div>`;
    if(desc)h+=`<span class="form-hint">${desc}</span>`;
    h+=`<textarea class="form-textarea mono ${errMsg?"error":""}" id="tableInput" rows="3">${esc(raw)}</textarea><span class="${errMsg?"form-error":"form-hint"}">${errMsg||`Nhập ${expectedLen} số cách nhau bởi dấu cách hoặc dấu phẩy`}</span>`;
    if(arr.length===expectedLen&&!errMsg){
      h+=`<div class="perm-grid" style="grid-template-columns:repeat(${cols},1fr)">${arr.map(v=>`<div class="perm-cell">${v}</div>`).join("")}</div>`;
    }
    return h+`</div>`;
  }

  function renderKeysEditor(){
    const allValid=state.subkeys.every(k=>!validateBinaryString(k,48));
    const validCount=state.subkeys.filter(k=>!validateBinaryString(k,48)).length;
    let h=`<div class="stack"><div class="row row-between"><span class="form-label">16 Khóa con (K1 — K16)</span><span class="chip ${allValid?"chip-success":"chip-warning"}">${validCount}/16 hợp lệ</span></div><div class="subkey-grid">`;
    state.subkeys.forEach((k,i)=>{
      const err=k.length>0?validateBinaryString(k,48):null;
      h+=`<div class="form-group"><label class="form-label" style="font-size:0.72rem">K${i+1}</label><input class="form-input mono ${err?"error":""}" data-key="${i}" value="${esc(k)}" maxlength="48"><span class="${err?"form-error":"form-hint"}" style="font-size:0.68rem">${err||`${k.length}/48`}</span></div>`;
    });
    return h+`</div></div>`;
  }

  function renderSBoxEditor(){
    const isBoxValid=box=>box.length===4&&box.every(r=>r.length===16&&r.every(v=>v>=0&&v<=15));
    const validCount=state.sBoxes.filter(isBoxValid).length;
    let h=`<div class="stack"><div class="row row-between"><span class="form-label">S-Box (S1 — S8)</span><span class="chip ${validCount===8?"chip-success":"chip-warning"}">${validCount}/8 hợp lệ</span></div>`;
    h+=`<div class="tabs-container"><div class="tabs">${state.sBoxes.map((_,i)=>`<button class="tab${state.activeSBox===i?" active":""}" data-sbox="${i}">S${i+1}</button>`).join("")}</div></div>`;
    const box=state.sBoxes[state.activeSBox];
    h+=`<div class="scroll-x"><div style="min-width:620px"><div style="display:flex;gap:4px;padding-left:36px;margin-bottom:4px">${Array.from({length:16},(_,j)=>`<span class="sbox-header" style="width:38px;display:inline-block">${j}</span>`).join("")}</div>`;
    box.forEach((row,ri)=>{
      h+=`<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px"><span class="sbox-header" style="width:28px;flex-shrink:0">H${ri}</span>${row.map((cell,ci)=>`<input class="sbox-cell" data-sbox-r="${ri}" data-sbox-c="${ci}" value="${cell}" maxlength="2">`).join("")}</div>`;
    });
    return h+`</div></div></div>`;
  }

  function bindEditorEvents(){
    $("cfgName")?.addEventListener("input",e=>{state.name=e.target.value;});
    container.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{state.tab=parseInt(b.dataset.tab);renderEditor();}));
    $("btnReset")?.addEventListener("click",()=>{
      state.input64=DEFAULT_INPUT_64;state.ipTable=[...DEFAULT_IP_TABLE];state.eTable=[...DEFAULT_E_TABLE];state.pTable=[...DEFAULT_P_TABLE];state.subkeys=[...DEFAULT_SUBKEYS];state.sBoxes=DEFAULT_S_BOXES.map(b=>b.map(r=>[...r]));
      showToast("Đã đặt lại về mặc định");renderEditor();
    });
    $("btnSave")?.addEventListener("click",async()=>{
      const errors=validateConfig(buildConfig());if(errors.length>0){showToast("Vui lòng sửa các lỗi trước khi lưu");return;}
      state.saving=true;renderEditor();
      try{
        const cfg=buildConfig();
        if(isNew){const newId=await db.create(cfg);location.hash=`#/results/${newId}`;}
        else{await db.update(id,cfg);location.hash=`#/results/${id}`;}
        showToast(isNew?"Đã tạo cấu hình":"Đã cập nhật cấu hình");
      }catch(e){showToast("Lưu thất bại: "+e.message);state.saving=false;renderEditor();}
    });
    // Tab-specific
    $("bitInput")?.addEventListener("input",e=>{state.input64=e.target.value.replace(/[^01]/g,"").slice(0,64);e.target.value=state.input64;renderEditor();});
    $("tableInput")?.addEventListener("input",e=>{
      const parsed=parseTableInput(e.target.value);
      if(state.tab===1)state.ipTable=parsed;else if(state.tab===2)state.eTable=parsed;else if(state.tab===3)state.pTable=parsed;
      // Don't re-render to avoid losing cursor, just update validation display
    });
    $("tableInput")?.addEventListener("change",()=>renderEditor());
    // Subkeys
    container.querySelectorAll("[data-key]").forEach(inp=>inp.addEventListener("input",e=>{const i=parseInt(inp.dataset.key);state.subkeys[i]=e.target.value.replace(/[^01]/g,"").slice(0,48);e.target.value=state.subkeys[i];}));
    container.querySelectorAll("[data-key]").forEach(inp=>inp.addEventListener("change",()=>renderEditor()));
    // S-Box tabs
    container.querySelectorAll("[data-sbox]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.sbox!==undefined){state.activeSBox=parseInt(b.dataset.sbox);renderEditor();}}));
    // S-Box cells
    container.querySelectorAll(".sbox-cell").forEach(inp=>inp.addEventListener("change",e=>{
      const r=parseInt(inp.dataset.sboxR),c=parseInt(inp.dataset.sboxC);
      const num=parseInt(e.target.value,10);
      if(e.target.value!==""&&(isNaN(num)||num<0||num>15))return;
      state.sBoxes[state.activeSBox][r][c]=e.target.value===""?0:num;
    }));
  }

  renderEditor();
}

// ===== RESULTS VIEW =====
async function renderResults(container,id){
  const cfg=await db.getById(id);
  if(!cfg){container.innerHTML=`<div class="alert alert-error">Không tìm thấy cấu hình. Có thể đã bị xóa.</div><a href="#/" class="btn btn-secondary" style="margin-top:12px">← Quay lại danh sách</a>`;return;}
  const errors=validateConfig(cfg);
  if(errors.length>0){
    container.innerHTML=`<div class="page-header"><div><h1 class="page-title">Lỗi tính toán</h1></div><div class="page-actions"><a href="#/" class="btn btn-secondary btn-sm">← Danh sách</a><a href="#/config/${id}" class="btn btn-outline btn-sm">✏️ Chỉnh sửa</a></div></div><div class="alert alert-error"><div><strong>Lỗi tính toán:</strong><ul>${errors.map(e=>`<li>${esc(e.message)}</li>`).join("")}</ul></div></div>`;
    return;
  }
  const result=runDES(cfg);
  const{ipBits,L0,R0,rounds,finalBits}=result;
  const lastRound=rounds[rounds.length-1];

  let h=`<div class="page-header"><div class="row" style="gap:10px;flex-wrap:wrap"><h1 class="page-title">Kết quả DES</h1><span class="chip chip-accent">${esc(cfg.name)}</span></div><div class="page-actions"><a href="#/" class="btn btn-secondary btn-sm">← Danh sách</a><a href="#/config/${id}" class="btn btn-outline btn-sm">✏️ Chỉnh sửa</a></div></div>`;

  // Final result card
  h+=`<div class="stack stack-lg">`;
  h+=`<div class="card final-result"><div class="card-header"><span class="card-header-title">KẾT QUẢ CUỐI CÙNG</span></div><div class="card-body"><div class="scroll-x"><div class="scroll-x-inner">`;
  h+=dataRow("R16 ‖ L16",formatBits(finalBits,4));
  h+=dataRow("L16",formatBits(lastRound.Lnext,4));
  h+=dataRow("R16",formatBits(lastRound.Rnext,4));
  h+=`</div></div></div><div class="card-body" style="border-top:1px solid var(--border);display:flex;gap:24px;flex-wrap:wrap"><div class="final-box"><span class="final-label">Nhị phân (64-bit)</span><span class="final-value">${finalBits}</span></div><div class="final-box"><span class="final-label">Thập lục phân (Hex)</span><span class="final-value final-hex">${hexFromBits(finalBits)}</span></div></div></div>`;

  // IP Step
  h+=`<div class="card"><div class="card-header"><span class="card-header-title">BƯỚC ĐẦU — HOÁN VỊ IP</span></div><div class="card-body"><div class="scroll-x"><div class="scroll-x-inner">`;
  h+=dataRow("IP(Đầu vào)",formatBits(ipBits,4));
  h+=dataRow("L0",formatBits(L0,4));
  h+=dataRow("R0",formatBits(R0,4));
  h+=`</div></div></div></div>`;

  // 16 Rounds
  rounds.forEach(round=>{
    const{roundNum,K,ER,fXor,sBoxInts,sBoxBits,fResult,L,R,Lnext,Rnext}=round;
    const i=roundNum-1;
    h+=`<div class="card"><div class="card-header"><span class="chip chip-accent" style="font-weight:600">Vòng ${roundNum}</span><span class="card-header-title" style="text-transform:none">Bảng K</span></div><div class="card-body"><div class="scroll-x"><div style="min-width:560px"><table class="result-table"><tbody>`;
    h+=tableRow(`K${roundNum}`,splitBits(K,6));
    h+=tableRow(`E(R${i})`,splitBits(ER,6));
    h+=tableRow(`f${roundNum} = K${roundNum} XOR E(R${i})`,splitBits(fXor,6));
    h+=tableRow("S BOX",["B1","B2","B3","B4","B5","B6","B7","B8"]);
    h+=tableRow("S1(B1)…S8(B8)",sBoxInts.map(v=>`<span style="color:var(--accent);font-weight:600">${v}</span>`),true);
    h+=tableRow("S BOX (Nhị phân)",splitBits(sBoxBits,4));
    h+=`</tbody></table></div></div></div>`;
    // L-Table
    h+=`<div class="card-header" style="border-top:1px solid var(--border)"><span class="chip" style="font-weight:600;background:var(--bg-secondary)">Vòng ${roundNum}</span><span class="card-header-title" style="text-transform:none">Bảng L</span></div><div class="card-body"><div class="scroll-x"><div style="min-width:560px"><table class="result-table"><tbody>`;
    h+=tableRow(`L${i}`,splitBits(L,4));
    h+=tableRow(`f(R${i}, K${roundNum})`,splitBits(fResult,4));
    h+=tableRow(`R${roundNum}`,splitBits(Rnext,4));
    h+=tableRow(`L${roundNum} = R${i}`,splitBits(Lnext,4));
    h+=`</tbody></table></div></div></div></div>`;
  });
  h+=`</div>`;
  container.innerHTML=h;
}

function splitBits(bits,chunk){const c=[];for(let i=0;i<bits.length;i+=chunk)c.push(bits.slice(i,i+chunk));return c;}
function dataRow(label,value,accent){return`<div class="data-row"><span class="data-label">${label}</span><span class="data-value${accent?" accent":""}">${value}</span></div>`;}
function tableRow(label,cells,isHtml){return`<tr><td class="td-label">${label}</td>${cells.map(c=>`<td>${isHtml?c:esc(String(c))}</td>`).join("")}</tr>`;}

// ===== QUICK DES (Plaintext + Key) =====
function renderQuickDES(container){
  const qState={plain:"0123456789ABCDEF",key:"133457799BBCDFF1",mode:"hex"};
  function render(){
    let h=`<div class="page-header"><div><h1 class="page-title">Giải mã DES chi tiết</h1><p class="page-subtitle">Nhập Plaintext và Key (HEX, 16 ký tự) — tự động sinh khóa con và mã hóa từng bước</p></div><div class="page-actions"><a href="#/" class="btn btn-secondary btn-sm">← Quay lại</a></div></div>`;
    h+=`<div class="card" style="margin-bottom:20px"><div class="card-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">`;
    h+=`<div class="form-group"><label class="form-label">Bản rõ (Plaintext) — HEX</label><input class="form-input mono" id="qPlain" value="${esc(qState.plain)}" spellcheck="false" autocomplete="off" placeholder="VD: 0123456789ABCDEF" maxlength="16"></div>`;
    h+=`<div class="form-group"><label class="form-label">Khóa (Key) — HEX</label><input class="form-input mono" id="qKey" value="${esc(qState.key)}" spellcheck="false" autocomplete="off" placeholder="VD: 133457799BBCDFF1" maxlength="16"></div>`;
    h+=`</div><div style="margin-top:16px;text-align:center"><button class="btn btn-primary" id="qRun">Giải mã chi tiết</button></div></div></div>`;
    h+=`<div id="qOutput"></div>`;
    container.innerHTML=h;
    $("qPlain").addEventListener("input",e=>{qState.plain=e.target.value;});
    $("qKey").addEventListener("input",e=>{qState.key=e.target.value;});
    $("qRun").addEventListener("click",()=>runQuick());
    runQuick();
  }
  function runQuick(){
    const pR=inputToBits(qState.plain,qState.mode);
    const kR=inputToBits(qState.key,qState.mode);
    if(pR.error){showToast(pR.error);return;}
    if(kR.error){showToast(kR.error);return;}
    const result=runFullDES(pR.bits,kR.bits);
    const out=$("qOutput");
    out.innerHTML=renderFullDESResult(result);
  }
  render();
}

function renderFullDESResult(r){
  const{ipBits,L0,R0,rounds,preFP,cipherBits,keySchedule,plainBits,keyBits}=r;
  const{keys,C,D}=keySchedule;
  const chunk=(s,n)=>{const a=[];for(let i=0;i<s.length;i+=n)a.push(s.slice(i,i+n));return a;};
  let h="";

  // BƯỚC 1: Khởi tạo
  h+=`<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-header-title" style="color:var(--danger)">BƯỚC 1: KHỞI TẠO BẢN RÕ</span></div><div class="card-body"><div class="scroll-x"><div style="min-width:560px">`;
  h+=dataRow("Bản rõ",formatBits(plainBits,4));
  h+=dataRow("Hoán vị IP",formatBits(ipBits,4));
  h+=dataRow("L0",formatBits(L0,4));
  h+=dataRow("R0",formatBits(R0,4));
  h+=`</div></div></div></div>`;

  // BƯỚC 2: Sinh khóa con
  h+=`<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-header-title" style="color:var(--danger)">BƯỚC 2: SINH KHÓA CON (KEY SCHEDULE)</span></div><div class="card-body"><div class="scroll-x"><div style="min-width:560px">`;
  h+=dataRow("Khóa đầu vào",formatBits(keyBits,4));
  for(let i=0;i<=16;i++){
    h+=`<div class="data-row"><span class="data-label" style="color:var(--danger)">C${i} D${i}</span><span class="data-value">${formatBits(C[i]+D[i],4)}</span></div>`;
  }
  h+=`</div></div></div></div>`;

  // Subkeys
  h+=`<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-header-title">16 KHÓA CON</span></div><div class="card-body"><div class="scroll-x"><div style="min-width:560px">`;
  keys.forEach((k,i)=>{
    h+=`<div class="data-row"><span class="data-label" style="color:var(--accent)">K${i+1}</span><span class="data-value">${formatBits(k,6)}</span></div>`;
  });
  h+=`</div></div></div></div>`;

  // BƯỚC 3: 16 Vòng Feistel
  h+=`<h2 style="font-size:1.1rem;font-weight:700;margin:24px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)">BƯỚC 3: MẠNG FEISTEL (16 VÒNG)</h2>`;
  rounds.forEach(round=>{
    const{roundNum,K,ER,fXor,sBoxInts,sBoxBits,fResult,L,R,Lnext,Rnext}=round;
    const i=roundNum-1;
    const kBlocks=chunk(K,6),erBlocks=chunk(ER,6),xBlocks=chunk(fXor,6),sOutBlocks=chunk(sBoxBits,4);
    // K-Table
    h+=`<div class="card" style="margin-bottom:12px"><div class="card-header"><span class="chip chip-accent" style="font-weight:600">Vòng ${roundNum}</span></div><div class="card-body"><div class="scroll-x"><div style="min-width:560px"><table class="result-table"><tbody>`;
    h+=tableRow(`K${roundNum}`,kBlocks);
    h+=tableRow(`E(R${i})`,erBlocks);
    h+=tableRow(`K${roundNum} ⊕ E(R${i})`,xBlocks);
    h+=tableRow("S-Box",["S1","S2","S3","S4","S5","S6","S7","S8"]);
    h+=tableRow("Thập phân",sBoxInts.map(v=>`<span style="color:var(--danger);font-weight:700">${v}</span>`),true);
    h+=tableRow("S-Box (nhị phân)",sOutBlocks);
    h+=`</tbody></table></div></div></div>`;
    // L-Table
    const lPrev=chunk(L,4),pBlocks=chunk(fResult,4),rNew=chunk(Rnext,4),lNew=chunk(Lnext,4);
    h+=`<div class="card-body" style="border-top:1px solid var(--border)"><div class="scroll-x"><div style="min-width:560px"><table class="result-table"><tbody>`;
    h+=tableRow(`L${i}`,lPrev);
    h+=tableRow(`f(R${i}, K${roundNum})`,pBlocks);
    h+=`<tr><td class="td-label" style="color:var(--accent);font-weight:600">R${roundNum}</td>${rNew.map(c=>`<td style="color:var(--accent);font-weight:600">${esc(c)}</td>`).join("")}</tr>`;
    h+=`<tr><td class="td-label" style="color:var(--accent);font-weight:600">L${roundNum}</td>${lNew.map(c=>`<td style="color:var(--accent);font-weight:600">${esc(c)}</td>`).join("")}</tr>`;
    h+=`</tbody></table></div></div></div></div>`;
  });

  // BƯỚC 4: Kết thúc
  h+=`<div class="card" style="margin-bottom:16px"><div class="card-header"><span class="card-header-title" style="color:var(--danger)">BƯỚC 4: KẾT THÚC</span></div><div class="card-body"><div class="scroll-x"><div style="min-width:560px">`;
  h+=dataRow("R16 + L16",formatBits(preFP,4));
  h+=dataRow("Bản mã (FP)",formatBits(cipherBits,4));
  h+=`</div></div></div></div>`;

  // Final HEX result
  h+=`<div class="card final-result" style="margin-bottom:16px"><div class="card-header"><span class="card-header-title">KẾT QUẢ BẢN MÃ</span></div><div class="card-body" style="text-align:center;padding:32px 20px"><div class="final-box" style="align-items:center"><span class="final-label">Nhị phân (64-bit)</span><span class="final-value" style="margin-bottom:12px">${cipherBits}</span><span class="final-label">Thập lục phân (HEX)</span><span class="final-value final-hex" style="font-size:1.5rem">${hexFromBits(cipherBits)}</span></div></div></div>`;

  return h;
}
