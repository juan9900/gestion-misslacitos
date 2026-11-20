"""Arma una copia de la app que usa una nube simulada, para correr las pruebas.

Uso:  python pruebas/preparar.py   y luego abre http://127.0.0.1:8766/runner.html
Nunca toca la base de datos real: la copia carga fake-supa.js en vez de Supabase.
"""
import os, shutil, tempfile, http.server, functools
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dst = os.path.join(tempfile.gettempdir(), "misslacitos-pruebas")
os.makedirs(dst, exist_ok=True)
s = open(os.path.join(raiz, "index.html"), encoding="utf-8").read()
a = "const LIB_SUPA='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';"
b = "if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});"
assert s.count(a) == 1 and s.count(b) == 1, "index.html cambio: actualiza preparar.py"
s = s.replace(a, "const LIB_SUPA=new URL('fake-supa.js',location.href).href;").replace(b, "")
open(os.path.join(dst, "index.html"), "w", encoding="utf-8", newline="").write(s)
open(os.path.join(dst, "config.js"), "w", encoding="utf-8").write("window.ML_CONFIG={supabaseUrl:'https://nube.falsa',supabaseKey:'x'};")
for f in ("fake-supa.js", "runner.html"):
    shutil.copy(os.path.join(raiz, "pruebas", f), dst)
print("Abre http://127.0.0.1:8766/runner.html  (Ctrl+C para terminar)")
http.server.ThreadingHTTPServer(("127.0.0.1", 8766), functools.partial(http.server.SimpleHTTPRequestHandler, directory=dst)).serve_forever()
