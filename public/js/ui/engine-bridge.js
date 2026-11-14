/* Kontrak B -> A: modul optional di /js/engine/index.js mengekspor
   initEngine():Promise<void> dan processFrame(video):Promise<EngineResult>|EngineResult.
   EngineResult: {status:'no_hand'|'low_confidence'|'ok',label:string|null,
                  confidence:number (0..1),accepted:boolean}
   Tidak ada model tiruan berjalan otomatis dalam mode produksi. */
let plugin=null,lastError=null;
export function getEngineError(){return lastError;}
export async function connectEngine(){
  try{
    const m=await import('/js/engine/index.js');
    if(typeof m.initEngine!=='function'||typeof m.processFrame!=='function')throw new Error('Kontrak engine tidak cocok.');
    await m.initEngine();plugin=m;lastError=null;return true;
  }catch(e){
    plugin=null;
    // Simpan penyebab agar UI dapat menampilkan pesan yang jujur (model, MediaPipe, classifier).
    lastError={code:e?.code||'ENGINE_UNAVAILABLE',message:e?.message||String(e)};
    console.warn('Isyarat: engine gagal diinisialisasi:',lastError.code,lastError.message);
    return false;
  }
}
export function hasEngine(){return !!plugin;}
export async function recognizeFrame(video){
  if(!plugin||video.readyState<2)return null;
  const raw=await plugin.processFrame(video);
  if(!raw||!['no_hand','low_confidence','ok'].includes(raw.status))throw new Error('Status hasil engine tidak valid.');
  return {
    status:raw.status,
    label:raw.label==null?null:String(raw.label),
    confidence:Math.min(1,Math.max(0,Number(raw.confidence)||0)),
    accepted:raw.accepted===true
  };
}
