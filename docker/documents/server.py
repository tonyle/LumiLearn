import http.server, tempfile, pathlib, subprocess, os, signal, threading
lock = threading.Semaphore(1)
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        self.send_response(200 if self.path == '/health' else 404); self.end_headers()
    def do_POST(self):
        ext = self.path.removeprefix('/convert?ext=')
        length = int(self.headers.get('Content-Length', '0'))
        if ext not in ('docx','pptx','doc','ppt') or length < 1 or length > 20*1024*1024:
            self.send_error(422); return
        if not lock.acquire(blocking=False): self.send_error(503); return
        try:
            with tempfile.TemporaryDirectory(prefix='document-') as tmp:
                root = pathlib.Path(tmp); src = root / ('source.'+ext); src.write_bytes(self.rfile.read(length))
                profile = root/'profile'; (profile/'user').mkdir(parents=True)
                (profile/'user'/'registrymodifications.xcu').write_text('''<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item></oor:items>''')
                proc = subprocess.Popen(['libreoffice','-env:UserInstallation='+profile.as_uri(),'--headless','--nologo','--nodefault','--norestore','--convert-to','pdf','--outdir',tmp,str(src)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
                try: proc.communicate(timeout=90)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL); proc.wait(); self.send_error(422); return
                out=root/'source.pdf'
                if proc.returncode or not out.exists() or out.stat().st_size>50*1024*1024: self.send_error(422); return
                data=out.read_bytes()
                if not data.startswith(b'%PDF-'): self.send_error(422); return
                self.send_response(200); self.send_header('Content-Type','application/pdf'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError): pass
        except Exception: self.send_error(422)
        finally: lock.release()
http.server.ThreadingHTTPServer(('0.0.0.0',8080), Handler).serve_forever()
