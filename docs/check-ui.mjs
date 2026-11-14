/* Pengujian logika & render HTML tanpa browser eksternal.
   Ini BUKAN uji visual Chrome, kamera fisik, atau audit WCAG otomatis. */
import fs from 'node:fs';
const path=new URL('../public/js/ui/app.js',import.meta.url);
const previews=['S1','S2a','S2b','S2c','S3','S4','S5','S6','S7a','S7b','S8','S9','S10','S11','S12','S13'];
const memory=new Map();
const handlers={};
const element=(name)=>({
  innerHTML:'',textContent:'',disabled:false,dataset:{},
  classList:{add(){},remove(){}},focus(){},
  addEventListener(type,handler){handlers[name+':'+type]=handler;},
  querySelector(){return null;}
});
const root=element('app'),dialog=element('dialog'),toast=element('toast');
globalThis.document={querySelector(s){if(s==='#app')return root;if(s==='#dialog-root')return dialog;if(s==='#toast')return toast;return null;},addEventListener(){}};
globalThis.localStorage={getItem(k){return memory.get(k)||null;},setItem(k,v){memory.set(k,v);}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true,mediaDevices:{}}});
globalThis.fetch=async()=>({ok:true,json:async()=>[{id:'halo',teks_tampil:'Halo',audio_file:null,catatan_isyarat:'Contoh'}]});
globalThis.window={location:{search:''},scrollTo(){},addEventListener(){}};
globalThis.location=window.location;
globalThis.requestAnimationFrame=()=>0;
globalThis.cancelAnimationFrame=()=>{};
let count=0;
for(const screen of previews){
  window.location.search=`?preview=${screen}`;
  await import(`${path.href}?previewtest=${screen}`);
  const html=root.innerHTML;
  if(!html.includes('site-header')||!html.includes('bottom-navigation')||!html.includes('content-wrap'))throw Error('struktur hilang '+screen);
  if(screen==='S1'&&!html.includes('Ubah isyarat'))throw Error('S1 hilang');
  if(screen==='S3'&&(!html.includes('/assets/avatar-kamera-netral.svg?v=3')||!html.includes('Ilustrasi panduan')))throw Error('Avatar netral statis hilang');
  if(screen==='S4'&&!html.includes('Hasil belum cukup yakin'))throw Error('S4 hilang');
  if(screen==='S5'&&!html.includes('Halo'))throw Error('S5 hilang');
  if(screen==='S7b'&&!html.includes('Riwayat masih kosong'))throw Error('S7b hilang');
  if(screen==='S12'&&!dialog.innerHTML.includes('Hapus seluruh riwayat'))throw Error('S12 modal hilang');
  count++;
}
window.location.search='?mock=1';
await import(`${path.href}?interactiontest=1`);
const click=(action,id)=>{
  const node={dataset:{action,id},disabled:false};
  const e={target:{closest:()=>node}};
  handlers['app:click'](e);
};
click('mockHalo');click('mockTolong');
if(!root.innerHTML.includes('Halo Tolong'))throw Error('Kata tidak tersusun');
click('save');click('history');
if(!root.innerHTML.includes('Halo Tolong'))throw Error('Riwayat gagal disimpan');
click('confirmClearHistory');
if(!dialog.innerHTML.includes('Hapus seluruh riwayat'))throw Error('Modal hapus gagal');
const yes={dataset:{action:'doClearHistory'},disabled:false};
handlers['dialog:click']({target:{closest:()=>yes}});
if(!root.innerHTML.includes('Riwayat masih kosong'))throw Error('Riwayat gagal dihapus');
console.log(`LULUS: ${count} keadaan layar, navigasi HTML, mock, kalimat, simpan, konfirmasi & hapus riwayat.`);
