# /// script
# requires-python = ">=3.10"
# dependencies = ["transformers>=4.57", "torch", "torchvision", "pillow", "opencv-python-headless", "accelerate", "safetensors", "tokenizers", "huggingface_hub"]
# ///
"""Local System One endpoint for an open decision model (planner experiment).

Run:  uv run scripts/decision_server.py [--model vllm-sr/vela3.1-pico-150m] [--port 8765]
      Works with Decision 1.0 (Kai), Decision 3.0 (d3-*) and Vela 3.1 (vela3.1-*) packages.
POST /v1/systemone  {"state": ..., "questions": {...}}  ->  model.system_one(...)
"""
import argparse
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

p = argparse.ArgumentParser()
p.add_argument("--model", default="vllm-sr/vela3.1-pico-150m")
p.add_argument("--port", type=int, default=8765)
args = p.parse_args()

if "vela3" in args.model:
    # Vela 3.x ships its own loader instead of AutoModel; decisions don't need the span/router adapters.
    from huggingface_hub import snapshot_download

    path = snapshot_download(args.model, ignore_patterns=["*_adapter.safetensors"])
    sys.path.insert(0, path)
    from vela3_encoder import Vela3Encoder

    model = Vela3Encoder.load(path)
else:
    from transformers import AutoModel

    model = AutoModel.from_pretrained(args.model, trust_remote_code=True)
device = str(getattr(model, "device", "cpu"))


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/v1/systemone":
            return self.send_error(404)
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            out, code = {**model.system_one(state=body["state"], questions=body["questions"]), "model": args.model, "device": device}, 200
        except Exception as e:  # malformed request or invalid question
            out, code = {"error": str(e)}, 400
        data = json.dumps(out).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


print(f"{args.model} ({device}) ready on http://127.0.0.1:{args.port}/v1/systemone", flush=True)
HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
