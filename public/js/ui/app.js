import {activateCamera,attachCamera,deactivateCamera,getCameraStream,getCameraFacing,switchCamera,cameraSecureContext,mapCameraError} from './camera.js';
import {connectEngine,hasEngine,recognizeFrame,getEngineError} from './engine-bridge.js';
import {readHistory,writeHistory,addEntry,removeEntry,emptyHistory,storageWarning} from './storage.js';
import {startSpeech,cancelSpeech,canSpeak} from './speech.js';

/* Isyarat frontend Anggota A. HTML/CSS/JS murni; seluruh aset disimpan lokal.
 * ?mock=1: tombol contoh untuk pengujian UI (BUKAN pengenalan isyarat).
 * Integrasi sebenarnya: tambahkan /public/js/engine/index.js oleh Anggota B.
 * Vocab final: /public/data/vocab.json oleh Anggota C.
 */
const $=(s,root=document)=>root.querySelector(s);
const app=$('#app');
const dialogRoot=$('#dialog-root');
const toastEl=$('#toast');
const params=new URLSearchParams(window.location.search);
const isPreview=/^S(1|2a|2b|2c|3|4|5|6|7a|7b|8|9|10|11|12|13)$/.test(params.get('preview')||'');
const isMock=params.get('mock')==='1'||isPreview;
const previewScreen=isPreview?params.get('preview'):null;
const state={page:'home',cam:'idle',engine:'not_connected',recognition:{status:'no_hand',label:null,confidence:0,accepted:false},words:[],latest:null,speaking:false,modal:null,error:null,voiceError:false,history:readHistory(),vocab:[],vocabFinal:false,lastAcceptedLabel:null,lastAcceptedAt:0,preview:isPreview,loopId:0};
let toastTimeout=null,engineInitPromise=null,frameBusy=false,lastInfer=0,loopAnimation=0,cameraStartSerial=0,modalTrigger=null;
const fullScreen={S1:'home',S2a:'cam_error',S2b:'cam_error',S2c:'cam_error',S3:'camera',S4:'camera',S5:'camera',S6:'camera',S7a:'history',S7b:'history',S8:'camera',S9:'engine_error',S10:'voice_error',S11:'vocab',S12:'history',S13:'guide'};
if(isPreview){state.page=fullScreen[previewScreen];
  if(previewScreen==='S2a')state.cam='denied';
  if(previewScreen==='S2b')state.cam='missing';
  if(previewScreen==='S2c')state.cam='busy';
  if(previewScreen==='S4')state.recognition={status:'low_confidence',label:'halo',confidence:.54,accepted:false};
  if(['S5','S6'].includes(previewScreen)){state.recognition={status:'ok',label:'halo',confidence:.93,accepted:true};state.latest='Halo';state.words=['Halo'];}
  if(previewScreen==='S6')state.speaking=true;
  if(previewScreen==='S8')state.engine='loading';
  if(previewScreen==='S9')state.engine='error';
  if(previewScreen==='S10')state.voiceError=true;
  if(previewScreen==='S7a')state.history=[{id:'preview-1',text:'Halo, tolong',time:new Date().toISOString()},{id:'preview-2',text:'Terima kasih',time:new Date(Date.now()-3600000).toISOString()}];
  if(previewScreen==='S12'){state.history=[{id:'preview-1',text:'Halo, tolong',time:new Date().toISOString()}];state.modal='clearHistory';}
}

const icons={
 home:'<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 camera:'<path d="M14 5 12 3H7L5 5H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"/><circle cx="12" cy="13" r="4"/>',
 book:'<path d="M12 6C8 4 5 4 2 5v15c4-1 7-1 10 1 3-2 6-2 10-1V5c-3-1-6-1-10 1Zm0 0v15"/>',
 history:'<path d="M3 11a9 9 0 1 1 3 7M3 4v6h6m3-4v6l4 2"/>',
 guide:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
 back:'<path d="m15 18-6-6 6-6"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 volume:'<path d="m11 5-5 4H2v6h4l5 4V5Zm4.5 3a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14"/>',
 stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/>',
 undo:'<path d="M9 14 4 9l5-5M4 9h9a7 7 0 0 1 0 14h-1"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 warning:'<path d="M12 3 2 21h20L12 3zm0 6v5m0 3h.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6m0-9h.01"/>',
 wifi:'<path d="M2 8c6-5 14-5 20 0M5 12c4-3 10-3 14 0m-11 4c3-2 5-2 8 0m-4 4h.01"/>',
 offline:'<path d="M3 3 21 21M2 8c3-3 6-4 9-4m4 1c3 .4 5 1.3 7 3M5 12c2-1.5 4-2.5 7-2.5m3 .5c1.5.4 3 1 4 2m-11 4c1-1 2-1.5 3-1.5m2 .2 3 1.3m-4 4h.01"/>',
 refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
 videoOff:'<path d="M3 4 21 20M10 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12l5 3V9l-4 2"/>',
 save:'<path d="M4 3h14l3 3v15H3V3Zm3 0v6h10V3M7 21v-8h10v8"/>',
 text:'<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h4"/>',
 hand:'<path d="M7 21c-2-2-3-4-4-6l-1-2c-1-2 1-3 2-2l3 2V5a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v9c0 4-2 6-5 6Z"/>',
 x:'<path d="M5 5 19 19M19 5 5 19"/>',
 expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 alertCircle:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
 empty:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h6"/>',
 privacy:'<path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>',
 sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>'
};
function icon(name,size=22){return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.info}</svg>`;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function titleCase(s){return String(s||'').replaceAll('_',' ').replace(/\b\p{L}/gu,l=>l.toLocaleUpperCase('id-ID'));}
function nowDate(d){try{return new Date(d).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});}catch{return 'Waktu tidak diketahui';}}
function actionBtn(label,action,cls='secondary',ico=null,disabled=false,attr=''){
  return `<button type="button" class="btn btn-${cls}" data-action="${action}" ${disabled?'disabled':''} ${attr}>${ico?icon(ico,20):''}<span>${esc(label)}</span></button>`;
}
function mockChip(){return isMock?'<span class="mock-chip">SIMULASI UI</span>':'';}
function networkPill(){return `<span class="network-pill ${navigator.onLine?'online':'offline'}" title="Status koneksi, bukan bukti aplikasi sudah dapat bekerja offline">${icon(navigator.onLine?'wifi':'offline',16)}<span>${navigator.onLine?'Online':'Offline'}</span></span>`;}
const NAV=[['home','Beranda','home'],['camera','Kamera','camera'],['history','Riwayat','history'],['vocab','Isyarat','book'],['guide','Panduan','guide']];
function navActive(id){return state.page===id||(id==='camera'&&['cam_error','engine_error','voice_error'].includes(state.page));}
function header(){return `<header class="site-header">
  <button type="button" data-action="home" class="brand" aria-label="Isyarat, ke beranda"><img src="/assets/logo.svg" alt=""/><span>isyarat<span class="brand-dot">.</span></span></button>
  <nav aria-label="Navigasi utama" class="desktop-navigation">${NAV.map(([id,label,ico])=>`<button type="button" class="desktop-nav-item ${navActive(id)?'active':''}" data-action="${id}" ${navActive(id)?'aria-current="page"':''}>${icon(ico,18)}<span>${label==='Isyarat'?'Daftar Isyarat':label}</span></button>`).join('')}</nav>
  <div class="header-end">${mockChip()}${networkPill()}</div>
</header>`;}
function bottomNav(){return `<nav class="bottom-navigation" aria-label="Navigasi HP">${NAV.filter(([id])=>id!=='guide').map(([id,label,ico])=>`<button type="button" data-action="${id}" class="bottom-nav-item ${navActive(id)?'active':''}" ${navActive(id)?'aria-current="page"':''}>${icon(ico,22)}<span>${label}</span></button>`).join('')}</nav>`;}
function home(){return `<main class="home-page content-wrap">
  <section class="home-copy"><div class="home-label">Pengenal isyarat dasar</div><h1>Ubah isyarat<br>tangan jadi<br><span>teks dan suara</span></h1><p>Peragakan isyarat di depan kamera. Hasilnya bisa dibaca dan diucapkan melalui perangkat.</p>
  <div class="home-illustration"><img src="/assets/ilustrasi-beranda.png" alt="Ilustrasi seseorang mengangkat tangan, bukan contoh gerakan bahasa isyarat tertentu"/><span class="hero-ornament" aria-hidden="true"></span></div>
  <div class="home-actions">${actionBtn('Mulai kamera','start','primary','camera')}${actionBtn('Daftar isyarat','vocab','outlined','book')}${actionBtn('Panduan','guide','outlined','guide')}</div>
  <div class="home-note">${icon('lock',16)} Pemrosesan dilakukan di perangkat. Setelah kunjungan pertama, aplikasi dapat dibuka offline.</div>
  </section>
  <aside class="home-desktop-art" aria-hidden="true"><div class="desktop-hero-card"><span class="art-label">ISYARAT / KOMUNIKASI</span><img src="/assets/ilustrasi-beranda.png" alt=""/><div class="art-footer"><strong>Dari gerak, jadi kata.</strong><span>Antarmuka yang sederhana dan mudah digunakan.</span></div></div></aside>
</main>`;}
function cameraHint(){return `<div class="camera-hint">${icon('info',18)}<span>Posisikan kamera senyaman mungkin.<br>Pastikan kedua tangan terlihat sepenuhnya.</span></div>`;}
function cameraState(){
  if(state.cam==='loading')return {kind:'loading',badge:'Meminta izin kamera…',hint:'Izinkan kamera di browser untuk melihat pratinjau langsung.',ico:'clock'};
  const result=state.recognition;
  if(state.engine==='loading')return {kind:'loading',badge:'Memuat mesin pengenal…',hint:'Menyiapkan pemrosesan isyarat di perangkat.',ico:'clock'};
  if(result.status==='ok'&&state.latest)return {kind:'success',badge:'Kata diterima',hint:'Kata berhasil ditambahkan ke kalimat.',ico:'check'};
  if(result.status==='low_confidence')return {kind:'waiting',badge:'Hasil belum cukup yakin',hint:'Coba ulangi isyarat dengan posisi lebih jelas.',ico:'warning'};
  if(getCameraStream()&&state.engine==='not_connected'&&!isMock)return {kind:'waiting',badge:'Mesin pengenal gagal dimuat',hint:'Periksa pesan kesalahan, lalu muat ulang halaman.',ico:'warning'};
  if(!getCameraStream()&&!cameraSecureContext()&&!state.preview)return {kind:'waiting',badge:'Kamera butuh koneksi aman',hint:'Gunakan localhost pada HP lewat USB, atau HTTPS tepercaya.',ico:'warning'};
  if(!getCameraStream()&&!state.preview)return {kind:'waiting',badge:'Kamera belum dinyalakan',hint:'Pilih “Aktifkan kamera” untuk melihat pratinjau langsung.',ico:'camera'};
  return {kind:'waiting',badge:'Tangan belum terlihat',hint:'Arahkan tangan ke kamera atau atur posisinya.',ico:'warning'};
}
function cameraPanel(){
  const info=cameraState(),stream=getCameraStream(),haveCam=!!stream;
  const videoClass=getCameraFacing()==='user'?'mirror':'';
  return `<section class="camera-side" aria-label="Pratinjau kamera">
  <div class="mobile-camera-heading"><h1>Kamera isyarat</h1>${cameraHint()}</div>
  <div class="camera-preview ${haveCam?'camera-live':''}" id="camera-preview">
    ${haveCam?`<video id="camera-video" class="${videoClass}" autoplay playsinline muted aria-label="Video langsung dari kamera perangkat"></video>`:`<img class="camera-illustration" src="/assets/avatar-kamera-netral.svg?v=3" alt="Ilustrasi statis siluet manusia netral gender, dengan kedua tangan terbuka sebagai panduan posisi, bukan kamera langsung atau isyarat tervalidasi"/>`}

    <div class="corner tl" aria-hidden="true"></div><div class="corner tr" aria-hidden="true"></div><div class="corner bl" aria-hidden="true"></div><div class="corner br" aria-hidden="true"></div>
    <div class="camera-overlay-tools">${mockChip()}</div>
  </div>
  <div class="detection-status ${info.kind==='success'?'status-success':info.kind==='loading'?'status-loading':'status-warning'}" role="status" aria-live="polite">${icon(info.ico,18)}<span>${esc(info.badge)}</span></div>
  <p class="camera-subhint">${esc(info.hint)}${!haveCam?' <span class="illustration-disclaimer">(Ilustrasi panduan, bukan video langsung)</span>':''}</p>
  <div class="camera-tools">${actionBtn(haveCam?'Matikan kamera':'Aktifkan kamera',haveCam?'stopCamera':'startCamera','camera-tool',haveCam?'videoOff':'camera')}
  ${haveCam?actionBtn('Ganti kamera','switchCamera','camera-tool','refresh'):''}
  <span class="camera-res-note">${icon('expand',16)} Pratinjau tidak dipotong</span></div>
  ${!cameraSecureContext()?`<div class="mobile-camera-warning" role="alert">${icon('warning',18)} <span>Kamera HP tidak bisa diakses dari alamat HTTP Wi-Fi. Gunakan localhost melalui USB atau HTTPS tepercaya.</span>${actionBtn('Lihat petunjuk','cameraGuide','outlined','guide')}</div>`:''}
  </section>`;
}
function resultPanel(){
  const result=state.recognition;
  const hasWords=state.words.length>0;
  const low=result.status==='low_confidence';
  const success=result.status==='ok'&&state.latest;
  const percent=Math.round(Math.max(0,Math.min(1,result.confidence))*100);
  let display=success?state.latest:low?titleCase(result.label):'Belum ada hasil';
  return `<section class="result-panel" aria-label="Hasil pengenalan isyarat">
    <div class="result-heading">${icon('text',19)}<h2>Hasil pengenalan</h2></div>
    <div class="recognition-display ${success?'has-result':low?'low-result':'empty-result'}" role="status" aria-live="polite">${esc(display)}</div>
    ${low?`<p class="low-confidence">${icon('warning',16)} Contoh prediksi ${percent}% — belum dimasukkan ke kalimat.</p>`:''}
    ${success?`<p class="confidence-note">${isMock?'Skor simulasi':'Keyakinan model'}: ${percent}% <span>· Bukan akurasi model</span></p>`:''}
    <div class="sentence-heading"><label for="sentence-output">${icon('info',18)} Kalimatmu</label><button type="button" class="save-inline" data-action="save" ${hasWords?'':'disabled'}>${icon('save',16)} Simpan</button></div>
    <div id="sentence-output" class="sentence-output ${hasWords?'':'placeholder'}" role="textbox" aria-readonly="true" aria-label="Susunan kalimat">${hasWords?esc(state.words.join(' ')):'Teks akan muncul di sini…'}</div>
    ${state.speaking?actionBtn('Hentikan suara','stopSpeech','muted','stop'):actionBtn('Ucapkan','speak','primary','volume',!hasWords)}
    <div class="result-actions">${actionBtn('Hapus kata','erase','light','undo',!hasWords)}${actionBtn('Hapus semua','clearSentence','light','trash',!hasWords)}</div>
    <p class="result-footnote">${isMock?'Hasil contoh untuk pengujian UI, bukan pengenalan AI.':'Hanya kata yang diterima model dimasukkan ke kalimat.'}</p>
  </section>`;
}
function cameraPage(){return `<main class="content-wrap camera-page">
  <div class="desktop-page-heading"><div><h1>Kamera isyarat</h1><p>Tunjukkan kedua tangan dalam bingkai agar mudah terlihat.</p></div><div class="engine-pills"><span class="engine-badge ${getCameraStream()?'active':''}">${icon('camera',17)} Kamera: ${getCameraStream()?'Aktif':'Belum aktif'}</span><span class="engine-badge ${hasEngine()?'active':''}">${icon('sparkle',17)} Engine: ${hasEngine()?'Siap':state.engine==='loading'?'Memuat':'Belum tersedia'}</span></div></div>
  <div class="camera-layout">${cameraPanel()}${resultPanel()}</div>
  </main>`;}
function errorDetails(){
 const errors={
 denied:{head:'Izin kamera ditolak',note:'Browser belum mendapat izin untuk memakai kamera.',suggest:['Klik ikon kamera atau gembok di kolom alamat browser.','Ubah izin kamera menjadi Izinkan, lalu pilih Coba lagi.']},
 missing:{head:'Kamera tidak ditemukan',note:'Perangkat ini tidak menemukan kamera yang bisa digunakan.',suggest:['Pastikan laptop atau HP memiliki kamera yang berfungsi.','Cek apakah kamera tersambung, lalu coba lagi.']},
 busy:{head:'Kamera sedang digunakan',note:'Kamera mungkin dipakai oleh aplikasi lain.',suggest:['Tutup aplikasi lain yang sedang memakai kamera.','Buka kembali Isyarat lalu coba lagi.']},
 insecure:{head:'Kamera HP perlu koneksi aman',note:'Alamat http://192.168... hanya dapat dipakai untuk melihat tampilan. Kamera HP memerlukan localhost pada HP atau HTTPS dengan sertifikat tepercaya.',suggest:['Hubungkan HP ke laptop menggunakan kabel USB data dan aktifkan USB debugging.','Di Chrome laptop buka chrome://inspect/#devices, aktifkan Port forwarding dari localhost:5500 ke localhost:5500.','Buka http://localhost:5500 pada Chrome HP, lalu tekan Aktifkan kamera dan beri izin.']},
 unsupported:{head:'Kamera tidak didukung',note:'Browser atau alamat halaman ini belum mengizinkan akses kamera.',suggest:['Gunakan Chrome atau Edge terbaru.','Jalankan melalui localhost atau HTTPS, bukan dengan membuka file HTML langsung.']},
 unknown:{head:'Kamera tidak dapat dibuka',note:'Terjadi masalah ketika meminta akses kamera.',suggest:['Periksa pengaturan kamera perangkat.','Muat ulang halaman, kemudian coba lagi.']}
 };return errors[state.cam]||errors.unknown;
}
function problemPage(type){
 const issue=type==='cam_error'?errorDetails():type==='voice_error'?{
 head:'Suara tidak tersedia',note:'Browser atau perangkat tidak dapat membacakan kalimat saat ini.',suggest:['Teks hasil pengenalan tetap dapat dibaca.','Periksa pengaturan suara atau gunakan perangkat dengan suara bahasa Indonesia.']
 }:{head:'Mesin pengenal gagal dijalankan',note:'Model atau modul deteksi mengalami kendala saat diproses.',suggest:['Periksa berkas engine dan model di perangkat.','Muat ulang aplikasi atau hubungi pengembang tim.']};
 return `<main class="content-wrap simple-page"><div class="problem-card"><div class="problem-icon">${icon(type==='voice_error'?'volume':type==='cam_error'?'videoOff':'warning',42)}</div><p class="eyebrow">${type==='cam_error'?'Masalah kamera':type==='voice_error'?'Masalah suara':'Masalah engine'}</p><h1>${esc(issue.head)}</h1><p class="problem-lead">${esc(issue.note)}</p><div class="help-steps"><strong>Coba lakukan:</strong>${issue.suggest.map((s,i)=>`<div class="help-step"><span>${i+1}</span><p>${esc(s)}</p></div>`).join('')}</div><div class="problem-buttons">${type==='cam_error'?actionBtn('Coba lagi','startCamera','primary','refresh'):actionBtn('Kembali ke kamera','camera','primary','camera')}${type==='cam_error'?actionBtn('Panduan kamera HP','cameraGuide','outlined','guide'):''}${actionBtn('Kembali ke beranda','home','outlined','back')}</div></div></main>`;
}
function historyPage(){
 const list=state.history;
 return `<main class="content-wrap simple-page history-page"><div class="section-title"><div><p class="eyebrow">Disimpan di perangkat</p><h1>Riwayat</h1><p>Kalimat yang kamu simpan tersedia di sini.</p></div>${list.length?actionBtn('Hapus semua riwayat','confirmClearHistory','outlined','trash'):''}</div>
 ${storageWarning?'<div class="notice notice-warning">Penyimpanan browser sedang dibatasi. Riwayat mungkin hilang setelah aplikasi ditutup.</div>':''}
 ${list.length?`<div class="history-list">${list.map(entry=>`<article class="history-entry"><div><strong>${esc(entry.text)}</strong><time datetime="${esc(entry.time)}">${esc(nowDate(entry.time))}</time></div><div class="history-controls"><button type="button" class="icon-button" data-action="speakHistory" data-id="${esc(entry.id)}" aria-label="Ucapkan kalimat: ${esc(entry.text)}">${icon('volume')}</button><button type="button" class="icon-button delete" data-action="confirmDeleteHistory" data-id="${esc(entry.id)}" aria-label="Hapus entri: ${esc(entry.text)}">${icon('trash')}</button></div></article>`).join('')}</div>`:
 `<section class="blank-card"><div class="empty-icon">${icon('history',42)}</div><h2>Riwayat masih kosong</h2><p>Setelah hasil isyarat menjadi kalimat, tekan Simpan untuk menambahkannya ke riwayat.</p>${actionBtn('Buka kamera','camera','primary','camera')}</section>`}
 </main>`;
}
function vocabPage(){return `<main class="content-wrap simple-page"><div class="section-title"><div><p class="eyebrow">Kosakata Isyarat</p><h1>Daftar isyarat</h1><p>Daftar kata yang tersedia atau sedang dipersiapkan.</p></div></div>
 <div class="vocab-list">${state.vocab.map(item=>{
  const letter=`<span class="word-letter">${esc(item.teks_tampil.charAt(0).toLocaleUpperCase('id-ID'))}</span>`;
  const visual=state.vocabFinal&&/^[a-z0-9_]+$/.test(item.id)?`<figure class="vocab-visual"><img src="/assets/guides/${esc(item.id)}.svg" alt="Sketsa kartun perkiraan gerakan ${esc(item.teks_tampil)}" width="120" height="76" loading="lazy"><figcaption>Sketsa kartun</figcaption></figure>`:letter;
  return `<article class="vocab-entry">${visual}<div><strong>${esc(item.teks_tampil)}</strong><p>${esc(item.catatan_isyarat||'Keterangan gerakan menunggu verifikasi.')}</p></div><span class="word-tag">${state.vocabFinal?'Kosakata':'Contoh'}</span></article>`;
 }).join('')}</div>
 </main>`;}
function guidePage(){return `<main class="content-wrap simple-page"><div class="section-title"><div><p class="eyebrow">Petunjuk penggunaan</p><h1>Cara menggunakan</h1><p>Ikuti langkah sederhana berikut saat memakai aplikasi.</p></div></div><div class="guide-steps">
 <article class="guide-step"><span class="step-num">01</span><div class="guide-icon">${icon('camera',30)}</div><div><h2>Aktifkan kamera</h2><p>Tekan Mulai kamera dan izinkan browser mengakses kamera perangkatmu.</p></div></article>
 <article class="guide-step"><span class="step-num">02</span><div class="guide-icon">${icon('hand',30)}</div><div><h2>Peragakan isyarat</h2><p>Posisikan kamera senyaman mungkin. Pastikan tubuh bagian atas dan kedua tangan terlihat penuh di bingkai.</p></div></article>
 <article class="guide-step"><span class="step-num">03</span><div class="guide-icon">${icon('text',30)}</div><div><h2>Baca hasil</h2><p>Kata yang diterima akan masuk ke Kalimatmu. Jika belum dikenali, coba perbaiki pencahayaan atau posisi tangan.</p></div></article>
 <article class="guide-step"><span class="step-num">04</span><div class="guide-icon">${icon('volume',30)}</div><div><h2>Ucapkan dan simpan</h2><p>Tekan Ucapkan untuk membaca kalimat, atau Simpan agar kalimat dapat dilihat lagi di Riwayat.</p></div></article>
 <section id="panduan-kamera-hp" class="camera-guide-card"><h2>Kenapa kamera HP tidak bisa dibuka dari Wi-Fi?</h2><p>Browser hanya mengizinkan kamera melalui alamat aman. <code>http://192.168.x.x:5500</code> untuk melihat tampilan saja. Untuk uji kamera HP tanpa mengunggah video ke internet, gunakan USB port forwarding:</p><ol><li>Jalankan <code>npm start</code> di laptop dan sambungkan HP menggunakan kabel USB data.</li><li>Aktifkan <strong>Opsi pengembang → Debugging USB</strong> di Android dan izinkan komputer ketika diminta.</li><li>Di Chrome laptop buka <code>chrome://inspect/#devices</code>, centang <strong>Discover USB devices</strong>, lalu buka <strong>Port forwarding</strong>.</li><li>Aktifkan forwarding: port perangkat <code>5500</code> → tujuan <code>localhost:5500</code> (sesuaikan port server).</li><li>Di Chrome HP buka <code>http://localhost:5500</code> dan izinkan kamera saat diminta.</li></ol><p>Alternatif: jalankan melalui HTTPS dengan sertifikat tepercaya. Jangan mengabaikan peringatan sertifikat.</p></section></main>`;}
function mockPanel(){if(!isMock||state.preview)return '';
 return `<section class="mock-panel" aria-label="Panel pengujian simulasi"><div><strong>Mode simulasi UI — tidak mengenali bahasa isyarat</strong><p>Gunakan tombol ini untuk mengecek perubahan tampilan dan riwayat tanpa model ML.</p></div><div class="mock-buttons"><button type="button" data-action="mockNoHand">Tanpa tangan</button><button type="button" data-action="mockLow">Keyakinan rendah</button><button type="button" data-action="mockHalo">Terima “Halo”</button><button type="button" data-action="mockTolong">Terima “Tolong”</button><button type="button" data-action="mockError">Error engine</button></div></section>`;
}
function previewFlag(){return state.preview?`<div class="preview-flag">Pratinjau desain ${esc(previewScreen)} · Bukan hasil AI langsung</div>`:'';}
function render(){
 app.innerHTML=`${header()}${state.page==='home'?home():state.page==='camera'?cameraPage():state.page==='history'?historyPage():state.page==='vocab'?vocabPage():state.page==='guide'?guidePage():problemPage(state.page)}${bottomNav()}${mockPanel()}${previewFlag()}`;
 const video=$('#camera-video');if(video)attachCamera(video);
 renderModal();
}
function renderModal(){
 if(!state.modal){dialogRoot.innerHTML='';if(modalTrigger?.isConnected)modalTrigger.focus();modalTrigger=null;return;}
 let title='',body='',confirm='Hapus',kind='confirmSentence';
 if(state.modal==='clearSentence'){title='Hapus semua kata?';body='Semua kata pada kalimat saat ini akan dihapus.';kind='doClearSentence';}
 else if(state.modal==='clearHistory'){title='Hapus seluruh riwayat?';body='Semua kalimat yang tersimpan di perangkat akan dihapus. Tindakan ini tidak bisa dibatalkan.';kind='doClearHistory';}
 else if(state.modal.startsWith('delete:')){title='Hapus entri ini?';body='Kalimat yang dipilih akan dihapus dari riwayat.';kind='doDeleteHistory';}
 dialogRoot.innerHTML=`<div class="modal-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-desc" class="modal-card"><div class="modal-alert">${icon('warning',30)}</div><h2 id="modal-title">${title}</h2><p id="modal-desc">${body}</p><div class="modal-actions">${actionBtn('Batal','closeModal','outlined')}${actionBtn(confirm,kind,'destructive','trash')}</div></div></div>`;
 $('#dialog-root button')?.focus();
}
function showToast(message){
 toastEl.textContent=message;toastEl.classList.add('visible');clearTimeout(toastTimeout);
 toastTimeout=setTimeout(()=>toastEl.classList.remove('visible'),3200);
}
function setPage(page){
 if(!['home','camera','history','vocab','guide','cam_error','engine_error','voice_error'].includes(page))return;
 if(state.page==='camera'&&page!=='camera')stopCameraAndInference();
 if(state.speaking&&page!=='camera'){cancelSpeech();state.speaking=false;}
 state.page=page;state.modal=null;
 if(page==='history')state.history=readHistory();
 render();window.scrollTo({top:0,behavior:'instant'});
}
async function startCameraFlow(){
 if(state.cam==='loading')return;
 const serial=++cameraStartSerial;
 if(state.preview){state.page='camera';render();showToast('Pratinjau desain — kamera tidak dinyalakan.');return;}
 if(isMock&&!cameraSecureContext()){state.page='camera';state.cam='idle';state.engine='not_connected';render();showToast('Mode simulasi UI: kamera tidak aktif karena alamat belum HTTPS.');return;}
 state.page='camera';state.cam='loading';state.engine='loading';render();
 try{
   await activateCamera();
   if(serial!==cameraStartSerial||state.page!=='camera'){deactivateCamera();return;}
   state.cam='active';
   if(isMock){state.engine='not_connected';render();return;}
   if(!engineInitPromise)engineInitPromise=connectEngine();
   const ready=await engineInitPromise;
   if(serial!==cameraStartSerial||state.page!=='camera')return;
   state.engine=ready?'ready':'not_connected';
   render();
   if(ready)beginInference();else{
     const failure=getEngineError();
     const reason=failure?.code==='CLASSIFIER_MISSING'?'classifier C belum tersedia':failure?.code==='KNN_MODEL_LOAD_FAILED'?'model KNN belum ada (rekam dataset lalu jalankan npm run ml:train)':failure?.code==='MEDIAPIPE_LOAD_FAILED'?'aset MediaPipe gagal dimuat':failure?.code==='MODEL_LOAD_FAILED'?'model hand_landmarker gagal dimuat':'engine belum siap';
     showToast(`Kamera hidup, tetapi ${reason}. Untuk uji UI gunakan ?mock=1.`);
   }
 }catch(e){
   if(serial!==cameraStartSerial||state.page!=='camera')return;
   state.cam=mapCameraError(e);state.engine='not_connected';state.page='cam_error';deactivateCamera();render();
 }
}
async function switchCameraFlow(){
 if(state.cam==='loading'||!getCameraStream())return;
 const serial=++cameraStartSerial;state.cam='loading';state.loopId++;cancelAnimationFrame(loopAnimation);render();
 try{await switchCamera();if(serial!==cameraStartSerial||state.page!=='camera')return;state.cam='active';render();if(hasEngine()&&!isMock)beginInference();showToast('Kamera berhasil diganti.');}
 catch(e){if(serial!==cameraStartSerial||state.page!=='camera')return;state.cam=getCameraStream()?'active':mapCameraError(e);state.page=getCameraStream()?'camera':'cam_error';render();showToast('Tidak dapat mengganti kamera pada perangkat ini.');if(getCameraStream()&&hasEngine()&&!isMock)beginInference();}
}
function stopCameraAndInference(){cameraStartSerial++;state.loopId++;cancelAnimationFrame(loopAnimation);deactivateCamera();state.cam='idle';state.engine=hasEngine()?'ready':'not_connected';}
function beginInference(){
 const token=++state.loopId;let lastResultSignature='';
 async function frame(time){
   if(token!==state.loopId||state.page!=='camera'||!getCameraStream())return;
   if(!frameBusy&&time-lastInfer>=240){
     lastInfer=time;frameBusy=true;
     try{
       const value=await recognizeFrame($('#camera-video'));
       if(value){
         let changed=false;
         if(value.status==='ok'&&value.accepted&&value.label){
           const now=Date.now();
           // Proteksi duplikat UI. B tetap memiliki logika stabilisasi dan accepted.
           if(value.label!==state.lastAcceptedLabel||now-state.lastAcceptedAt>=2200){
             acceptWord(value.label,value.confidence);changed=true;
             state.lastAcceptedLabel=value.label;state.lastAcceptedAt=now;
           }
         } else {
           if(value.status==='no_hand')state.lastAcceptedLabel=null;
           const signature=[value.status,value.label,Math.round(value.confidence*10)].join(':');
           if(signature!==lastResultSignature){state.recognition=value;changed=true;lastResultSignature=signature;}
         }
         if(changed&&token===state.loopId)render();
       }
     }catch(e){state.engine='error';state.page='engine_error';stopCameraAndInference();render();return;}
     finally{frameBusy=false;}
   }
   if(token===state.loopId)loopAnimation=requestAnimationFrame(frame);
 }
 loopAnimation=requestAnimationFrame(frame);
}
function acceptWord(id,confidence=.93){
 const inVocab=state.vocab.find(w=>w.id===id||w.teks_tampil?.toLowerCase()===id?.toLowerCase());
 const label=inVocab?.teks_tampil||titleCase(id);
 state.latest=label;state.words.push(label);state.recognition={status:'ok',label:id,confidence,accepted:true};
 if(navigator.vibrate&&isMock===false)try{navigator.vibrate(40);}catch{}
}
function doMock(kind){state.page='camera';state.cam=getCameraStream()?'active':'idle';
 if(kind==='nohand'){state.recognition={status:'no_hand',label:null,confidence:0,accepted:false};state.latest=null;}
 if(kind==='low'){state.recognition={status:'low_confidence',label:'halo',confidence:.54,accepted:false};state.latest=null;}
 if(kind==='halo'||kind==='tolong')acceptWord(kind,.93);
 if(kind==='error'){state.engine='error';setPage('engine_error');return;}
 render();}
function startReading(text){
 try{
   if(!canSpeak())throw new Error('Speech synthesis tidak tersedia');
   startSpeech(text,{onStart:()=>{state.speaking=true;if(state.page==='camera')render();},onEnd:()=>{state.speaking=false;if(state.page==='camera')render();},onError:()=>{state.speaking=false;state.voiceError=true;setPage('voice_error');}});
 }catch{state.voiceError=true;setPage('voice_error');}
}
function cancelReading(){cancelSpeech();state.speaking=false;render();}
async function initVocabulary(){
 for(const path of ['/data/vocab.json','/data/kosakata.contoh.json']){
   try{
     const resp=await fetch(path,{cache:'no-store'});if(!resp.ok)continue;
     const data=await resp.json();if(!Array.isArray(data))continue;
     state.vocab=data.filter(x=>x&&typeof x.id==='string'&&typeof x.teks_tampil==='string').slice(0,100);
     state.vocabFinal=path.endsWith('/vocab.json');if(state.page==='vocab')render();return;
   }catch{}
 }
}
function actionHandler(action,element){
 switch(action){
 case 'home':setPage('home');break;
 case 'start':case 'startCamera':startCameraFlow();break;
 case 'camera': if(state.page==='camera'){if(!getCameraStream()&&!state.preview)startCameraFlow();else render();}else startCameraFlow();break;
 case 'stopCamera':stopCameraAndInference();render();break;
 case 'switchCamera':switchCameraFlow();break;
 case 'cameraGuide':setPage('guide');requestAnimationFrame(()=>document.getElementById('panduan-kamera-hp')?.scrollIntoView({block:'start'}));break;
 case 'history':setPage('history');break;
 case 'vocab':setPage('vocab');break;
 case 'guide':setPage('guide');break;
 case 'speak':if(state.words.length)startReading(state.words.join(' '));break;
 case 'stopSpeech':cancelReading();break;
 case 'erase':state.words.pop();if(!state.words.length){state.latest=null;state.recognition={status:'no_hand',label:null,confidence:0,accepted:false};}render();break;
 case 'clearSentence':modalTrigger=element;state.modal='clearSentence';renderModal();break;
 case 'save':if(!state.words.length)return;if(addEntry(state.words.join(' ')))showToast('Kalimat berhasil disimpan di Riwayat.');else showToast('Riwayat hanya tersimpan sementara.');state.history=readHistory();break;
 case 'confirmClearHistory':modalTrigger=element;state.modal='clearHistory';renderModal();break;
 case 'confirmDeleteHistory':modalTrigger=element;state.modal='delete:'+element.dataset.id;renderModal();break;
 case 'speakHistory':{const record=state.history.find(x=>x.id===element.dataset.id);if(record)startReading(record.text);break;}
 case 'closeModal':state.modal=null;renderModal();break;
 case 'doClearSentence':state.words=[];state.latest=null;state.recognition={status:'no_hand',label:null,confidence:0,accepted:false};state.modal=null;render();showToast('Kalimat sudah dikosongkan.');break;
 case 'doClearHistory':emptyHistory();state.history=[];state.modal=null;render();showToast('Semua riwayat sudah dihapus.');break;
 case 'doDeleteHistory':removeEntry(state.modal.slice(7));state.history=readHistory();state.modal=null;render();showToast('Entri dihapus.');break;
 case 'mockNoHand':doMock('nohand');break;
 case 'mockLow':doMock('low');break;
 case 'mockHalo':doMock('halo');break;
 case 'mockTolong':doMock('tolong');break;
 case 'mockError':doMock('error');break;
 }
}
app.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(button&&!button.disabled)actionHandler(button.dataset.action,button);
});
dialogRoot.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button&&!button.disabled)actionHandler(button.dataset.action,button);else if(event.target.classList.contains('modal-backdrop')){state.modal=null;renderModal();}});
document.addEventListener('keydown',e=>{
 if(!state.modal)return;
 if(e.key==='Escape'){state.modal=null;renderModal();return;}
 if(e.key==='Tab'){const controls=[...dialogRoot.querySelectorAll('button:not([disabled])')];if(!controls.length)return;
 const first=controls[0],last=controls.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
window.addEventListener('online',render);window.addEventListener('offline',render);
window.addEventListener('pagehide',()=>{deactivateCamera();cancelSpeech();});
render();initVocabulary();
/* PWA hanya didaftarkan pada secure context (localhost/HTTPS). */
if(window.isSecureContext&&'serviceWorker'in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js').catch(error=>console.warn('Isyarat: service worker gagal didaftarkan:',error?.message||error));
  });
}
