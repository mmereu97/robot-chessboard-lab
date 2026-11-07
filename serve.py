"""Run this file in PyCharm (right-click > Run 'serve') to open the robot chessboard lab.

It serves the static/ folder on localhost and opens it in your browser. The private
puzzles you have solved are kept in puzzle-progress.json, next to this file, and the
level you last played Stockfish at in lab-settings.json.
If a port is blocked or busy (common on Windows with Hyper-V, WSL or Docker),
it tries the next one, and finally lets the system pick a free port.
Stop it with the red square in PyCharm's Run window.
"""
import functools
import http.server
import json
import socketserver
import sys
import webbrowser
from pathlib import Path

PORTS = [8000, 8080, 5500, 8765, 3000, 0]  # 0 = any free port chosen by the system
ROOT = Path(__file__).resolve().parent / "static"
HERE = Path(__file__).resolve().parent
# what the page may keep next to this file: the file, and what a valid content looks like
STORES = {
    "/api/progress": (HERE / "puzzle-progress.json", "[]", lambda v: isinstance(v, list) and all(isinstance(n, int) for n in v)),
    "/api/settings": (HERE / "lab-settings.json", "{}", lambda v: isinstance(v, dict) and all(isinstance(x, (str, int, float, bool)) for x in v.values())),
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # always serve the latest version of the files you edit
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def reply_json(self, status, body):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path not in STORES:
            return super().do_GET()
        path, empty, _ = STORES[self.path]
        self.reply_json(200, path.read_text(encoding="utf-8") if path.exists() else empty)

    def do_POST(self):
        # This content type makes a browser ask first, so other sites cannot write here.
        if self.path not in STORES or self.headers.get("Content-Type") != "application/json":
            return self.reply_json(404, "{}")
        path, _, valid = STORES[self.path]
        try:
            value = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 100000)))
            if not valid(value):
                raise ValueError
        except ValueError:
            return self.reply_json(400, "{}")
        temp = path.with_suffix(".tmp")
        temp.write_text(json.dumps(value), encoding="utf-8")
        temp.replace(path)
        self.reply_json(200, "{}")

    def log_message(self, fmt, *args):
        pass  # keep the Run window quiet


class Server(socketserver.TCPServer):
    # On Windows, SO_REUSEADDR can itself cause WinError 10013, so only use it elsewhere
    allow_reuse_address = sys.platform != "win32"


def main():
    if not (ROOT / "index.html").exists():
        sys.exit(f"Cannot find {ROOT / 'index.html'}. Keep serve.py next to the static/ folder.")
    handler = functools.partial(Handler, directory=str(ROOT))
    for port in PORTS:
        try:
            httpd = Server(("127.0.0.1", port), handler)
        except OSError as e:
            print(f"Port {port} not available ({e.strerror or e}), trying another...")
            continue
        with httpd:
            url = f"http://localhost:{httpd.server_address[1]}/"
            print(f"Serving {ROOT}\nOpen {url}  (Ctrl+C or the red stop button to quit)")
            webbrowser.open(url)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                pass
        return
    sys.exit("No free port found. You can also open static/index.html directly in your browser.")


if __name__ == "__main__":
    main()
