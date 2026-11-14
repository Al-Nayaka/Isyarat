/* Kamera perangkat. HTTP dengan alamat IP LAN tidak mendapat akses webcam di
   browser modern. Gunakan HTTPS terpercaya atau localhost pada perangkat. */
let stream = null;
let facingMode = 'user';

export function getCameraStream(){return stream;}
export function getCameraFacing(){return facingMode;}
export function cameraSecureContext(){return window.isSecureContext !== false;}

function cameraError(name, message){
  const error = new Error(message);
  error.name = name;
  return error;
}

async function requestStream(mode,strict=false){
  try {
    // Gunakan ideal alih-alih exact sehingga resolusi tak harus sama di semua HP.
    return await navigator.mediaDevices.getUserMedia({
      audio:false,
      video:{facingMode:strict?{exact:mode}:{ideal:mode},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}}
    });
  } catch(err) {
    // Pada beberapa kamera laptop/HP, constraints gagal walaupun kamera tersedia.
    // Jangan mengulang permintaan jika izin sudah ditolak.
    if(!strict && ['OverconstrainedError','NotFoundError','DevicesNotFoundError'].includes(err?.name)) {
      return navigator.mediaDevices.getUserMedia({audio:false,video:true});
    }
    throw err;
  }
}

export async function activateCamera({facing,strict=false}={}){
  if(!cameraSecureContext()){
    throw cameraError('InsecureContextError','Alamat HTTP Wi-Fi tidak diizinkan mengakses kamera HP. Gunakan HTTPS terpercaya atau localhost melalui USB port forwarding.');
  }
  if(!navigator.mediaDevices?.getUserMedia){
    throw cameraError('NotSupportedError','Browser ini tidak menyediakan getUserMedia.');
  }
  if(stream && stream.getVideoTracks().some(t=>t.readyState==='live')) return stream;
  const chosen=facing||facingMode;
  const candidate=await requestStream(chosen,strict);
  stream=candidate;
  facingMode=chosen;
  return stream;
}

export function attachCamera(video){
  if(!video||!stream)return;
  video.muted=true;
  video.autoplay=true;
  video.playsInline=true;
  if(video.srcObject!==stream)video.srcObject=stream;
  const play=video.play();
  if(play && typeof play.catch==='function')play.catch(err=>{
    // Jangan diam-diam menelan masalah tanpa meninggalkan informasi diagnostik.
    console.warn('Isyarat: video belum bisa diputar:',err?.name||err);
  });
}

export function deactivateCamera(){
  if(stream){for(const track of stream.getTracks())track.stop();}
  stream=null;
}

export async function switchCamera(){
  const previous=facingMode;
  const wanted=previous==='user'?'environment':'user';
  deactivateCamera();
  try{return await activateCamera({facing:wanted,strict:true});}
  catch(error){
    // Bila gagal pindah kamera, upayakan mengembalikan kamera sebelumnya.
    try{await activateCamera({facing:previous});}catch{}
    throw error;
  }
}

export function mapCameraError(error){
  switch(error?.name){
    case 'InsecureContextError':return 'insecure';
    case 'NotAllowedError':case 'PermissionDeniedError':case 'SecurityError':return 'denied';
    case 'NotFoundError':case 'DevicesNotFoundError':case 'OverconstrainedError':return 'missing';
    case 'NotReadableError':case 'TrackStartError':return 'busy';
    case 'NotSupportedError':return 'unsupported';
    default:return 'unknown';
  }
}
