import urllib.request
import re
import ssl
import json

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

# Try to use a more realistic browser agent
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7",
}

for name, base_url in urls.items():
    print(f"--- {name} ---")
    try:
        req = urllib.request.Request(base_url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')
            
            # Check for Next.js data
            if '__NEXT_DATA__' in html:
                print("Type: SPA (Next.js)")
                print("Feasibility: cheap-scrape (extract JSON from __NEXT_DATA__)")
            # Check for Nuxt
            elif '__NUXT__' in html:
                print("Type: SPA (Nuxt.js)")
                print("Feasibility: cheap-scrape (extract JSON from __NUXT__ window object)")
            # Check for Angular/React generic
            elif 'ng-version' in html or 'data-reactroot' in html:
                print("Type: SPA (Angular/React)")
                print("Feasibility: expensive-scrape (needs headless, or find internal API)")
            else:
                # Let's see if we find any obvious JSON api calls in script tags
                api_calls = re.findall(r'https?://[a-zA-Z0-9.-]+/api/[a-zA-Z0-9./-]+', html)
                if api_calls:
                    print("Type: Classic HTML + API")
                    print(f"Feasibility: cheap-API (Found endpoints like {api_calls[0]})")
                else:
                    print("Type: Server-Rendered HTML")
                    print("Feasibility: cheap-scrape (parse HTML elements)")
    except Exception as e:
        print(f"Error fetching: {e}")
        print("Feasibility: not-currently-feasible (Blocked or Cloudflare)")
