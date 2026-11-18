# /// script
# requires-python = ">=3.10"
# dependencies = ["transformers>=4.57", "torch", "safetensors", "tokenizers", "huggingface_hub", "numpy", "onnx", "onnxruntime"]
# ///
"""Export a Vela 3.1 pico decision model to ONNX for in-browser inference (onnxruntime-web).

Run:  uv run scripts/export_vela_web.py [--model vllm-sr/vela3.1-pico-150m] [--out models/vela3.1-onnx/pico-150m]
Out:  onnx/model.onnx (fp32), onnx/model_fp16w.onnx (WebGPU), onnx/model_quantized.onnx (int8, WASM),
      tokenizer files, config.json and parity.json (PyTorch reference answers for the JS self-check).
The graph includes the decision readout heads, so JS only renders, tokenises and soft-maxes.
One question per forward (batch 1): no padding, so no masked rows to go NaN in fp16.
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
import torch.nn.functional as F
from huggingface_hub import HfApi, snapshot_download
from onnx import TensorProto, helper, numpy_helper
from onnxruntime.quantization import QuantType, quantize_dynamic

p = argparse.ArgumentParser()
p.add_argument("--model", default="vllm-sr/vela3.1-pico-150m")
p.add_argument("--out", default=None)
args = p.parse_args()
name = args.model.split("/")[-1]
# One folder per variant, as in the hosted repo (huggingface.co/andreped/vela3.1-onnx).
out = Path(args.out or f"models/vela3.1-onnx/{name.removeprefix('vela3.1-')}")
(out / "onnx").mkdir(parents=True, exist_ok=True)

revision = HfApi().model_info(args.model).sha
src = Path(snapshot_download(args.model, revision=revision, ignore_patterns=["*_adapter.safetensors", "onnx/*"]))
sys.path.insert(0, str(src))
from vela3_encoder import DecisionEncoder  # noqa: E402

dec = DecisionEncoder.load(src, device="cpu")
dec.encoder.config._attn_implementation = "eager"


class Decide(torch.nn.Module):
    """input_ids [1, T], opt_pos [K] ([O] marker positions), pool [2] (state span) -> logits [K]."""

    def __init__(self, d):
        super().__init__()
        self.d = d

    def forward(self, input_ids, opt_pos, pool):
        d = self.d
        H = d.encoder(input_ids=input_ids, attention_mask=torch.ones_like(input_ids)).last_hidden_state[0].float()
        # Mean over the state span directly: the package's cumsum difference cancels catastrophically in fp16 on WebGPU.
        pooled = H.index_select(0, torch.arange(pool[0], pool[1])).mean(0, keepdim=True)
        v = F.normalize(d.w_p(d.norm(pooled)), dim=-1)
        Ho = H[opt_pos]
        u = F.normalize(d.w_o(d.norm(Ho)) + d.w_q(d.norm(H[1:2])), dim=-1)  # [Q] is always token 1
        return (u * v).sum(-1) / d.log_tau.exp() + d.cls_mlp(Ho).squeeze(-1)


model = Decide(dec).eval()
fp32 = out / "onnx/model.onnx"
r = dec.encode('Visitor said: "open research"', {"type": "choice", "instructions": "What to do?", "criteria": {"a": "x", "b": "y"}})
with torch.no_grad():
    torch.onnx.export(
        model,
        (torch.tensor([r["ids"]]), torch.tensor(r["opt_pos"]), torch.tensor(r["pool"])),
        str(fp32),
        input_names=["input_ids", "opt_pos", "pool"],
        output_names=["logits"],
        dynamic_axes={"input_ids": {1: "T"}, "opt_pos": {0: "K"}, "logits": {0: "K"}},
        opset_version=18,
        dynamo=False,
    )

def fp16_weights(model):
    """Store large weights as fp16 + a Cast to fp32 (folded at load): fp16 download, fp32 math.
    tl;dr: full fp16 compute flips decisions on onnxruntime-web's WebGPU EP (max |dp| 0.8), this is exact."""
    g = model.graph
    casts, keep = [], []
    for init in g.initializer:
        if init.data_type == TensorProto.FLOAT and int(np.prod(init.dims)) >= 1024:
            keep.append(numpy_helper.from_array(numpy_helper.to_array(init).astype(np.float16), init.name + "__fp16"))
            casts.append(helper.make_node("Cast", [init.name + "__fp16"], [init.name], to=TensorProto.FLOAT, name=init.name + "__cast"))
        else:
            keep.append(init)
    del g.initializer[:]
    g.initializer.extend(keep)
    nodes = casts + list(g.node)
    del g.node[:]
    g.node.extend(nodes)
    return model


variants = {"fp32": fp32, "fp16w": out / "onnx/model_fp16w.onnx", "q8": out / "onnx/model_quantized.onnx"}
onnx.save(fp16_weights(onnx.load(str(fp32))), str(variants["fp16w"]))
# Naive dynamic int8 flips decisions: RoPE, attention, MLP down_proj (outlier activations) and the readout
# (cosine / tau amplifies error ~20x) stay fp32 — the same "xdown" recipe as the source package's onnx/.
keep_fp32 = [n.name for n in onnx.load(str(fp32), load_external_data=False).graph.node if n.op_type in ("MatMul", "Gemm")
             and __import__("re").search(r"/encoder/\d+_0/|self_attn/MatMul|down_proj|^/w_|^/cls_mlp", n.name)]
quantize_dynamic(str(fp32), str(variants["q8"]), weight_type=QuantType.QInt8, per_channel=True, nodes_to_exclude=keep_fp32)

# Reference answers from the PyTorch package: rendering/tokenisation ids + probabilities per question.
ACTION = {"type": "choice", "instructions": "What should the AndreOS assistant do for this request?", "criteria": {
    "open": 'Open or show an app window by name, e.g. "open research", "show his resume"',
    "close": "Close the window", "browse": "Visit an external website or search the web",
    "chat": 'Answer a question or write a reply, e.g. "summarise it"', "none": 'Just filler, e.g. "ok", "thanks"'}}
CASES = [
    ('Visitor said: "open research"', {"action": ACTION}),
    ("Focused window: research\nVisitor said: \"give me the gist of it\"", {"action": ACTION,
        "app": {"type": "choice", "instructions": "Which AndreOS app does the request refer to?",
                "criteria": {"research": "Research app: papers", "resume": "Resume app: CV", "skills": "Skills app"}}}),
    ("Besøkende sa: «åpne CV-en hans»", {"action": ACTION, "polite": {"type": "noul", "instructions": "Is the visitor polite?"}}),
    ({"user": "Take me to his résumé, then show the desktop.", "page": 3}, {"site": {"type": "choice", "instructions": "Which site?",
        "criteria": ["github", "linkedin", "scholar", "web"]}}),
    ('Visitor said: "what has he been working on lately?"', {"needs_answer": {"type": "noul", "instructions": "Does this need a written answer?",
        "criteria": {"true": "a question about André", "false": "an OS action"}}}),
]
parity = []
for state, qs in CASES:
    answers, _ = dec.predict(state, qs)
    st = dec._ids(__import__("render31").to_row("q", state, next(iter(qs.values())))["parts"][0]["text"])
    parity.append({"state": state, "questions": qs, "ids": {k: dec.encode(state, q, st)["ids"] for k, q in qs.items()}, "answers": answers})

for tag, path in variants.items():
    s = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    worst, flips = 0.0, 0
    for case in parity:
        for k, q in case["questions"].items():
            r = dec.encode(case["state"], q)
            z = s.run(None, {"input_ids": np.array([r["ids"]], np.int64), "opt_pos": np.array(r["opt_pos"], np.int64), "pool": np.array(r["pool"], np.int64)})[0].astype(np.float64)
            pr = np.exp(z - z.max()); pr /= pr.sum()
            a = case["answers"][k]
            ref = np.array([1 - a["noul"], a["noul"]]) if q["type"] == "noul" else np.array([a["probabilities"][n] for n in r["names"]])
            worst, flips = max(worst, float(np.abs(pr - ref).max())), flips + int(pr.argmax() != ref.argmax())
    print(f"{tag:5s} {path.stat().st_size / 1e6:6.0f} MB  max |dp| {worst:.4f}  argmax flips {flips}")

cfg = dec.encoder.config
(out / "config.json").write_text(json.dumps({
    "model": name, "source": args.model, "source_revision": revision, "renderer": "render31/1",
    "markers": {t: int(i) for t, i in cfg.decision["marker_ids"].items()},
    "bos_token_id": dec.tok.bos_token_id, "eos_token_id": dec.tok.eos_token_id,
    "files": {"webgpu": "onnx/model_fp16w.onnx", "wasm": "onnx/model_quantized.onnx"},
}, indent=2) + "\n")
(out / "parity.json").write_text(json.dumps(parity, ensure_ascii=False) + "\n")
for f in ("tokenizer.json", "tokenizer_config.json", "LICENSE"):
    shutil.copy(src / f, out / f)
(out / "README.md").write_text(f"""---
license: apache-2.0
base_model: {args.model}
library_name: onnxruntime-web
pipeline_tag: zero-shot-classification
tags: [decision-model, system-one, onnx, webgpu, wasm]
---
# {name} (ONNX, browser)

ONNX export of the decision path of [{args.model}](https://huggingface.co/{args.model}) (revision `{revision[:8]}`)
for [onnxruntime-web](https://onnxruntime.ai/docs/tutorials/web/): the encoder **plus** the decision readout heads, so a
call is render → tokenise → one forward per question → softmax.

| File | Use |
|---|---|
| `onnx/model_fp16w.onnx` | WebGPU (fp16-stored weights, fp32 compute) |
| `onnx/model_quantized.onnx` | WASM / CPU (dynamic int8; RoPE, attention, MLP down-projections and heads kept fp32) |
| `onnx/model.onnx` | fp32 reference |

Inputs: `input_ids` [1, T] (int64), `opt_pos` [K] (positions of the `[O]` markers), `pool` [2] (start/end of the state span).
Output: `logits` [K]; softmax gives the option probabilities. Rendering is `render31` from the source package:
`[BOS] [Q] instructions ([O] name[: description])* [SEP_SCHEMA] [SEG_user] state [EOS]` (marker ids in `config.json`).
`parity.json` holds reference answers from the PyTorch package. Apache-2.0, as the source model; all credit to vLLM Semantic Router and KR Labs.
""")
print(f"Wrote {out}")
