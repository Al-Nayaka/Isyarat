const KEY='isyarat.history.v1';
let memory=[];
export let storageWarning=false;
export function readHistory(){
  try {let data=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(data)?data.filter(x=>typeof x?.text==='string').slice(0,100):[];}
  catch { storageWarning=true;return memory; }
}
export function writeHistory(items){
  memory=items.slice(0,100);
  try {localStorage.setItem(KEY,JSON.stringify(memory));storageWarning=false;return true;}
  catch{storageWarning=true;return false;}
}
export function addEntry(text){
  const cleaned=String(text).trim();if(!cleaned)return false;
  const list=readHistory();list.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,text:cleaned,time:new Date().toISOString()});return writeHistory(list);
}
export function removeEntry(id){return writeHistory(readHistory().filter(entry=>entry.id!==id));}
export function emptyHistory(){return writeHistory([]);}
