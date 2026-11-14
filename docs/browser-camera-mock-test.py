"""Test state kamera dengan stream tiruan. Tidak memakai kamera fisik.
Memakai bundling sementara pada pengujian offline browser.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re
root=Path(__file__).resolve().parent.parent
src=root/'public/js/ui'
code=[]
for name in ['camera.js','engine-bridge.js','storage.js','speech.js','app.js']:
 s=(src/name).read_text()
 s=re.sub(r'^import\s+.+?;\s*$','',s,flags=re.M)
 s=re.sub(r'^export\s+(?=(async\s+)?function|let|const|class)','',s,flags=re.M)
 s=s.replace('new URLSearchParams(window.location.search)', "new URLSearchParams('?mock=1')")
 code.append(s)
html='''<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app" class="app-shell"></div><div id="dialog-root"></div><div id="toast" class="toast"></div></body></html>'''
setup="""
Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
const track=()=>({readyState:'live',stop(){this.readyState='ended';}});
Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{let t=track();return {getVideoTracks:()=>[t],getTracks:()=>[t]};}}});
Object.defineProperty(HTMLMediaElement.prototype,'srcObject',{configurable:true,set(v){this.__fakeStream=v},get(){return this.__fakeStream}});
HTMLMediaElement.prototype.play=()=>Promise.resolve();
"""
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html)
 page.add_style_tag(content=(root/'public/css/style.css').read_text())
 page.add_script_tag(content=setup)
 page.add_script_tag(content='\n'.join(code))
 page.locator('button[data-action="start"]').click()
 page.wait_for_timeout(150)
 assert page.locator('#camera-video').count()==1, 'video tidak muncul'
 assert page.locator('.camera-illustration').count()==0, 'avatar tidak hilang'
 assert page.locator('button[data-action="switchCamera"]').count()==1, 'ganti kamera hilang'
 page.locator('button[data-action="switchCamera"]').click()
 page.wait_for_timeout(150)
 assert page.locator('#camera-video').count()==1, 'ganti kamera menghilangkan video'
 page.locator('button[data-action="stopCamera"]').click()
 page.wait_for_timeout(60)
 assert page.locator('#camera-video').count()==0
 assert page.locator('.camera-illustration').count()==1
 assert not errors,errors
 print('LULUS kamera stream tiruan: start → video → ganti → matikan → avatar kembali')
 b.close()
