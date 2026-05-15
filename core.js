/* DES Engine + Constants + Validation + Database */

// ===== DEFAULT CONSTANTS =====
const DEFAULT_INPUT_64="0000000100100011010001010110011110001001101010111100110111101111";
const DEFAULT_IP_TABLE=[58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const DEFAULT_E_TABLE=[32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const DEFAULT_P_TABLE=[16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const DEFAULT_SUBKEYS=["000110110001010101101011111111000111000001110010","000110111010101011011001110110111100100111100101","000111010111010010111010010000101100111110011001","111101100000110111001100110110110011010100011101","010110101110101000000101111010110101001110101000","000010011011110100111110010100000111101100101111","111001000010010011101111111101100001100010111100","111100111100111000100000110000010011101111111011","111101001001100001101011111011011110011110000001","101000111110001001100110101110100100011001001111","101010000101111110010110110111101101001110000110","011101000011001101111001100101000110011111101001","100001111101010001110001111110101011101001000001","110011110100101111010110111100101110011100111010","001111101111001110001001001111010011111100001010","111011110001100110000101000011100001011111110101"];
const DEFAULT_S_BOXES=[[[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7],[0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8],[4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0],[15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13]],[[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10],[3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5],[0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15],[13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9]],[[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8],[13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1],[13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7],[1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12]],[[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15],[13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9],[10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4],[3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14]],[[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9],[14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6],[4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14],[11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3]],[[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11],[10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8],[9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6],[4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13]],[[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1],[13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6],[1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2],[6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12]],[[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7],[1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2],[7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8],[2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]]];

// ===== DES ENGINE =====
function permute(bits,table){return table.map(p=>bits[p-1]).join("")}
function xorBits(a,b){return a.split("").map((bit,i)=>(bit!==b[i]?"1":"0")).join("")}
function sBoxStep(bits,sBoxes){
  const ints=[],chunks=[];
  for(let i=0;i<8;i++){
    const block=bits.slice(i*6,i*6+6);
    const row=parseInt(block[0]+block[5],2);
    const col=parseInt(block.slice(1,5),2);
    const val=sBoxes[i][row][col];
    ints.push(val);
    chunks.push(val.toString(2).padStart(4,"0"));
  }
  return{ints,bits:chunks.join("")};
}
function runDES(config){
  const ipBits=permute(config.input64,config.ipTable);
  let L=ipBits.slice(0,32),R=ipBits.slice(32);
  const L0=L,R0=R,rounds=[];
  for(let i=0;i<16;i++){
    const K=config.subkeys[i];
    const ER=permute(R,config.eTable);
    const fXor=xorBits(K,ER);
    const sb=sBoxStep(fXor,config.sBoxes);
    const fResult=permute(sb.bits,config.pTable);
    const Rnext=xorBits(L,fResult);
    const Lnext=R;
    rounds.push({roundNum:i+1,K,ER,fXor,sBoxInts:sb.ints,sBoxBits:sb.bits,fResult,L,R,Lnext,Rnext});
    L=Lnext;R=Rnext;
  }
  return{ipBits,L0,R0,rounds,finalBits:R+L};
}
function formatBits(bits,chunk){const c=[];for(let i=0;i<bits.length;i+=chunk)c.push(bits.slice(i,i+chunk));return c.join(" ")}
function hexFromBits(bits){let h="";for(let i=0;i<bits.length;i+=4)h+=parseInt(bits.slice(i,i+4),2).toString(16).toUpperCase();return h}
function lshift(s,n){return s.slice(n)+s.slice(0,n)}

// ===== KEY SCHEDULE TABLES =====
const T_PC1=[57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const T_PC2=[14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const T_SHIFTS=[1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const T_FP=[40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];

function inputToBits(v,mode){
  v=v.replace(/\s+/g,"").toUpperCase();
  if(mode==="hex"){
    if(!/^[0-9A-F]{16}$/.test(v))return{error:"Vui lòng nhập đúng 16 ký tự HEX!"};
    return{bits:v.split("").map(c=>parseInt(c,16).toString(2).padStart(4,"0")).join("")};
  }
  if(!/^[01]{64}$/.test(v))return{error:"Vui lòng nhập đúng 64 bit nhị phân!"};
  return{bits:v};
}

function generateSubkeys(keyBits){
  const key56=permute(keyBits,T_PC1);
  const C=[key56.slice(0,28)],D=[key56.slice(28)];
  const keys=[];
  for(let i=1;i<=16;i++){
    C[i]=lshift(C[i-1],T_SHIFTS[i-1]);
    D[i]=lshift(D[i-1],T_SHIFTS[i-1]);
    keys.push(permute(C[i]+D[i],T_PC2));
  }
  return{keys,C,D,key56};
}

function runFullDES(plainBits,keyBits){
  const ks=generateSubkeys(keyBits);
  const ipBits=permute(plainBits,DEFAULT_IP_TABLE);
  let L=ipBits.slice(0,32),R=ipBits.slice(32);
  const L0=L,R0=R,rounds=[],Ls=[L],Rs=[R];
  for(let i=0;i<16;i++){
    const K=ks.keys[i];
    const ER=permute(R,DEFAULT_E_TABLE);
    const fXor=xorBits(K,ER);
    const sb=sBoxStep(fXor,DEFAULT_S_BOXES);
    const fResult=permute(sb.bits,DEFAULT_P_TABLE);
    const Rnext=xorBits(L,fResult);
    const Lnext=R;
    rounds.push({roundNum:i+1,K,ER,fXor,sBoxInts:sb.ints,sBoxBits:sb.bits,fResult,L,R,Lnext,Rnext});
    L=Lnext;R=Rnext;
    Ls.push(L);Rs.push(R);
  }
  const preFP=R+L;
  const cipherBits=permute(preFP,T_FP);
  return{ipBits,L0,R0,rounds,preFP,cipherBits,keySchedule:ks,Ls,Rs,plainBits,keyBits};
}

// ===== VALIDATION =====
const BINARY_RE=/^[01]+$/;
function validateConfig(c){
  const e=[];
  if(!c.input64||c.input64.length!==64)e.push({field:"input64",message:"Input phải đúng 64 bit."});
  else if(!BINARY_RE.test(c.input64))e.push({field:"input64",message:"Input chỉ được chứa ký tự 0 hoặc 1."});
  if(!c.ipTable||c.ipTable.length!==64)e.push({field:"ipTable",message:"Bảng IP phải có đúng 64 phần tử."});
  else{const s=new Set(c.ipTable);if(s.size!==64||c.ipTable.some(v=>v<1||v>64))e.push({field:"ipTable",message:"Bảng IP phải chứa các số từ 1-64, không trùng lặp."});}
  if(!c.eTable||c.eTable.length!==48)e.push({field:"eTable",message:"Bảng E phải có đúng 48 phần tử."});
  else if(c.eTable.some(v=>v<1||v>32))e.push({field:"eTable",message:"Bảng E chỉ được chứa giá trị từ 1-32."});
  if(!c.pTable||c.pTable.length!==32)e.push({field:"pTable",message:"Bảng P phải có đúng 32 phần tử."});
  else{const s=new Set(c.pTable);if(s.size!==32||c.pTable.some(v=>v<1||v>32))e.push({field:"pTable",message:"Bảng P phải chứa các số từ 1-32, không trùng lặp."});}
  if(!c.subkeys||c.subkeys.length!==16)e.push({field:"subkeys",message:"Phải có đúng 16 subkey."});
  else c.subkeys.forEach((k,i)=>{if(k.length!==48)e.push({field:`subkeys[${i}]`,message:`K${i+1} phải đúng 48 bit.`});else if(!BINARY_RE.test(k))e.push({field:`subkeys[${i}]`,message:`K${i+1} chỉ được chứa 0 hoặc 1.`});});
  if(!c.sBoxes||c.sBoxes.length!==8)e.push({field:"sBoxes",message:"Phải có đúng 8 S-box."});
  else c.sBoxes.forEach((box,bi)=>{if(box.length!==4){e.push({field:`sBoxes[${bi}]`,message:`S${bi+1} phải có 4 hàng.`});return;}box.forEach((row,ri)=>{if(row.length!==16){e.push({field:`sBoxes[${bi}][${ri}]`,message:`S${bi+1} hàng ${ri} phải có 16 cột.`});return;}row.forEach((v,ci)=>{if(v<0||v>15||!Number.isInteger(v))e.push({field:`sBoxes[${bi}][${ri}][${ci}]`,message:`S${bi+1}[${ri}][${ci}] phải là số nguyên 0-15.`});});});});
  return e;
}
function validateBinaryString(val,len){if(val.length!==len)return`Phải đúng ${len} ký tự.`;if(!BINARY_RE.test(val))return"Chỉ được chứa 0 hoặc 1.";return null}
function parseTableInput(raw){return raw.trim().split(/[\s,]+/).filter(Boolean).map(Number)}

// ===== INDEXEDDB DATABASE =====
class DESDatabase{
  constructor(){this.dbName="DESCalculatorDB";this.dbVersion=1;this._db=null;}
  open(){
    if(this._db)return Promise.resolve(this._db);
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(this.dbName,this.dbVersion);
      req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains("configs")){const store=db.createObjectStore("configs",{keyPath:"id",autoIncrement:true});store.createIndex("createdAt","createdAt",{unique:false});}};
      req.onsuccess=e=>{this._db=e.target.result;resolve(this._db);};
      req.onerror=e=>reject(e.target.error);
    });
  }
  async getAll(){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction("configs","readonly");const store=tx.objectStore("configs");const req=store.index("createdAt").openCursor(null,"prev");const results=[];req.onsuccess=e=>{const cursor=e.target.result;if(cursor){results.push(cursor.value);cursor.continue();}else res(results);};req.onerror=e=>rej(e.target.error);});}
  async getById(id){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction("configs","readonly");const req=tx.objectStore("configs").get(id);req.onsuccess=e=>res(e.target.result);req.onerror=e=>rej(e.target.error);});}
  async create(config){const db=await this.open();const now=new Date();const data={...config,createdAt:now,updatedAt:now};return new Promise((res,rej)=>{const tx=db.transaction("configs","readwrite");const req=tx.objectStore("configs").add(data);req.onsuccess=e=>res(e.target.result);req.onerror=e=>rej(e.target.error);});}
  async update(id,config){const db=await this.open();const existing=await this.getById(id);if(!existing)throw new Error("Không tìm thấy");const data={...existing,...config,id,updatedAt:new Date()};return new Promise((res,rej)=>{const tx=db.transaction("configs","readwrite");const req=tx.objectStore("configs").put(data);req.onsuccess=()=>res();req.onerror=e=>rej(e.target.error);});}
  async remove(id){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction("configs","readwrite");const req=tx.objectStore("configs").delete(id);req.onsuccess=()=>res();req.onerror=e=>rej(e.target.error);});}
}
const db=new DESDatabase();
