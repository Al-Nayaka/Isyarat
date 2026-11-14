"""Browser smoke test tanpa jaringan (khusus tampilan dan interaksi simulasi).
Menggabungkan modul hanya pada salinan pengujian; source code asli tetap modular.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,base64
root=Path(__file__).resolve().parent.parent
public=root/'public'
body_html='''<!doctype html><html lang="id"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app" class="app-shell"></div><div id="dialog-root"></div><div id="toast" class="toast" aria-live="polite" role="status"></div></body></html>'''
js_files=['camera.js','engine-bridge.js','storage.js','speech.js','app.js']
code=[]
for name in js_files:
    text=(public/'js/ui'/name).read_text()
    text=re.sub(r'^import\s+.+?;\s*$', '', text, flags=re.M)
    text=re.sub(r'^export\s+(?=(async\s+)?function|let|const|class)', '', text, flags=re.M)
    text=text.replace('new URLSearchParams(window.location.search)', "new URLSearchParams('?mock=1')")
    for img in ['logo.svg','avatar-kamera-netral.svg','ilustrasi-beranda.png']:
        content=(public/'assets'/img).read_bytes(); mime='image/svg+xml' if img.endswith('.svg') else 'image/png'
        uri=f'data:{mime};base64,{base64.b64encode(content).decode()}'
        text=text.replace('/assets/'+img,uri)
    code.append(text)
bundle='\n'.join(code)
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    for width,height,label in [(320,680,'HP320'),(360,740,'HP360'),(390,844,'HP390'),(768,900,'TABLET768'),(1280,720,'LAPTOP1280')]:
        context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
        page=context.new_page()
        errs=[]
        page.on('pageerror',lambda e:errs.append(str(e)))
        page.set_content(body_html)
        page.add_style_tag(content=(public/'css/style.css').read_text())
        page.add_script_tag(content=bundle)
        page.wait_for_timeout(180)
        assert not errs, errs
        assert page.locator('.site-header').count()==1
        page.screenshot(path=str(root/'preview'/f'RENDER_{label}_HOME.png'))
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), f'{label} horizontal scroll on home'
        page.locator('button[data-action="start"]').click()
        page.wait_for_timeout(200)
        assert page.get_by_role('heading',name='Kamera isyarat').count()>=1
        assert page.locator('.camera-illustration').count()==1
        assert page.locator('.result-panel').count()==1
        page.screenshot(path=str(root/'preview'/f'RENDER_{label}_CAMERA.png'),full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'), f'{label} horizontal scroll camera'
        page.locator('button[data-action="mockHalo"]').click()
        page.locator('button[data-action="mockTolong"]').click()
        assert 'Halo Tolong' in page.locator('.sentence-output').inner_text()
        page.locator('button[data-action="save"]').click()
        page.locator('button[data-action="history"]:visible').first.click()
        assert 'Halo Tolong' in page.locator('.history-list').inner_text()
        assert not errs, errs
        print('LULUS',label,'layout, mock, riwayat, tanpa overflow horizontal')
        context.close()
    browser.close()
