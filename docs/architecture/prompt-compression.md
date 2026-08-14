# Prompt compression (retrieval, not a big system prompt)

Cuts **time-to-first-token** by shrinking the prompt — critical on CPU, where TTFT ≈
prefill length. Also helps the small (2B) model stay on-topic.

## Problem
Every QA answer injected the full **~1,200-token** bio system prompt (+ all matched
research papers). On CPU that's ~15s of prefill for a one-line answer, and it drowns
a small model in irrelevant context.

## Fix
- Split the bio into a tiny **stable core** (~160 tok: identity + response rules) plus
  labeled **sections** (Role, Experience, Education, Publications, Skills, Projects, Contact…).
- Per query, **BM25-retrieve** the top few relevant sections (reuses the existing
  [`BM25`](../../src/js/assistant/retrieval/BM25.js)) — see [`andre-profile.js`](../../src/js/assistant/engine/andre-profile.js).
- **Gate** the research-paper RAG block on research relevance instead of always running it.

Result: "Hello" **1,206 → 161 tokens**; typical QA **~400 tokens**.

## The honest tradeoff
This is *worse* in a pure caching sense: a static prompt lets llama.cpp reuse the whole
cached prefix across turns (near-instant follow-ups). Dynamic sections change per turn, so
only the ~160-token core stays cached and each turn re-prefills its small section chunk.
Net: **much faster first token + better answers**, at the cost of retry-fast follow-ups.
Retrieval can also miss the right section for oblique phrasing.

## Routing is separate (and imperfect)
"Command vs ask" is its own lean classifier call — it never carries the bio. On CPU we
also **skip routing for plainly conversational text** to keep the KV cache warm. Small-model
routing sits around ~79% accuracy; misroutes cluster on verbless commands and indirect
phrasing ("summarize his PhD research", "what can you do?"). Acceptable for a portfolio toy.

## Why not agentic tool-calling
Textbook-correct, but each tool round-trip is another full prefill → slower on CPU, and 2B
tool-call reliability is shaky. One-shot retrieval gets ~90% of the benefit in one pass.
