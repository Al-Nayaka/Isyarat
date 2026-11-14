"""Tes visual & kamera semu Chrome. Harus dijalankan setelah npm start (port 5500).
Tidak menguji kamera fisik ataupun model AI asli.
"""
import os,sys
from playwright.sync_api import sync_playwright
base=os.getenv('ISYARAT_URL','http://127.0.0.1:5500')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=[
        '--no-sandbox','--disable-dev-shm-usage','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'
    ])
    cases=[(390,844,'HP_390'),(360,740,'HP_360'),(1280,720,'LAPTOP_1280'),(768,900,'TABLET_768')]
    for width,height,label in cases:
        context=browser.new_context(viewport={'width':width,'height':height},permissions=['camera'],is_mobile=width<600,has_touch=width<600)
        page=context.new_page()
        errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        page.goto(base+'/?mock=1',wait_until='networkidle',timeout=12000)
        page.get_by_role('button',name='Mulai kamera').first.click()
        page.wait_for_timeout(280)
        page.screenshot(path=f'/mnt/data/ISYARAT_FULL_FIX_HP_13NOV/preview/TEST_{label}.png',full_page=True)
        assert not errors,(label,errors)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'),label+' overflow'
        assert page.locator('#camera-video').count()==1,label+' video not shown'
        assert page.evaluate("document.querySelector('#camera-video').srcObject?.getVideoTracks().length===1"),label+' video stream unavailable'
        assert page.locator('button[data-action="switchCamera"]').count()==1,label+' switch button absent'
        # Navigate, stop tracks after leaving camera
        page.locator('button[data-action="history"]').first.click()
        assert page.get_by_role('heading',name='Riwayat').count(),label+' history not shown'
        assert page.locator('#camera-video').count()==0
        print('OK',label,'browser video fake, nav, no overflow')
        context.close()
    # Test accessible UI in fallback simulation mode without a camera
    context=browser.new_context(viewport={'width':390,'height':844})
    page=context.new_page()
    page.goto(base+'/?mock=1',wait_until='networkidle')
    page.get_by_role('button',name='Mulai kamera').first.click()
    page.get_by_role('button',name='Terima “Halo”').click()
    assert 'Halo' in page.locator('.sentence-output').inner_text()
    page.get_by_role('button',name='Terima “Tolong”').click()
    assert 'Halo Tolong' in page.locator('.sentence-output').inner_text()
    page.locator('button[data-action="save"]').click()
    page.locator('button[data-action="history"]').first.click()
    assert 'Halo Tolong' in page.locator('.history-list').inner_text()
    print('OK mock kata, simpan, history')
    context.close()
    browser.close()
