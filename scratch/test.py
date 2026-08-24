import urllib.request
import urllib.error
import json
import ssl
import gzip
from io import BytesIO

urls = {
    "ALLACCESS": "https://www.allaccess.com.ar",
    "LIVEPASS": "https://livepass.com.ar",
    "ENIGMA": "https://enigmatickets.com",
    "PASSLINE": "https://www.passline.com",
    "ALPOGO": "https://alpogo.com",
    "VENTI": "https://venti.com.ar",
    "ENTRASTE": "https://entraste.com",
    "TUENTRADA": "https://www.tuentrada.com",
    "MIENTRADA": "https://www.mientrada.com.ar",
    "PUNTOTICKET": "https://www.puntoticket.com",
    "KONEX": "https://entradas.cckonex.org",
    "MOVISTAR ARENA": "https://www.movistararena.com.ar",
    "EDÉN ENTRADAS": "https://www.edenentradas.com.ar",
    "PULSOTICKETS": "https://pulsotickets.com",
    "NORTETICKET": "https://norteticket.com",
    "ENTRADAWEB": "https://www.entradaweb.com.ar",
    "QUEHACEMOS": "https://quehacemos.com.ar"
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def fetch(url):
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return str(e), None

for name, base_url in urls.items():
    print(f"--- {name} ---")
    robots_code, robots_data = fetch(base_url + "/robots.txt")
    print(f"Robots: {robots_code}")
    if robots_data:
        try:
            print(robots_data.decode('utf-8')[:200])
        except:
            pass
    
    html_code, html_data = fetch(base_url)
    print(f"HTML: {html_code}")
    if html_data:
        try:
            html_text = html_data.decode('utf-8')
            if 'window.__INITIAL_STATE__' in html_text or 'NEXT_DATA' in html_text:
                print("Appears to be an SPA/Server-rendered state (Next.js/React)")
            if 'api' in html_text.lower():
                print("Mentions API in source.")
        except:
            pass
    print("\n")
