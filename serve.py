# Optional: python3 serve.py  ->  http://localhost:8000
from http.server import SimpleHTTPRequestHandler, HTTPServer
HTTPServer(("", 8000), SimpleHTTPRequestHandler).serve_forever()