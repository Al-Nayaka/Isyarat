let currentUtterance=null;
export function canSpeak(){return typeof window!=='undefined'&&'speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;}
export function cancelSpeech(){if(canSpeak())window.speechSynthesis.cancel();currentUtterance=null;}
export function startSpeech(text,{onStart=()=>{},onEnd=()=>{},onError=()=>{}}={}){
  if(!canSpeak())throw new Error('Browser ini tidak mendukung text-to-speech.');
  const words=String(text).trim();if(!words)return;
  cancelSpeech();
  const utterance=new SpeechSynthesisUtterance(words);utterance.lang='id-ID';utterance.rate=0.9;utterance.pitch=1;
  const voices=window.speechSynthesis.getVoices();const indonesian=voices.find(v=>v.lang?.toLowerCase().startsWith('id'));
  if(indonesian)utterance.voice=indonesian;
  utterance.onstart=()=>{if(currentUtterance===utterance)onStart();};
  utterance.onend=()=>{if(currentUtterance===utterance){currentUtterance=null;onEnd();}};
  utterance.onerror=e=>{if(currentUtterance===utterance){currentUtterance=null;if(e.error!=='canceled'&&e.error!=='interrupted')onError(e);else onEnd();}};
  currentUtterance=utterance;window.speechSynthesis.speak(utterance);
}
