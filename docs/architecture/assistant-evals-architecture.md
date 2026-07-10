# How the Assistant Is Evaluated (Evals)

> This describes how AndreOS measures the quality of its OS Assistant — what it
> tests, where the metrics live, how the same scorers run in CI and in the
> browser, and why the design scales as the assistant grows.

---

## 1. The big idea: score the decisions, not the vibes

The assistant makes a handful of **distinct decisions** on every utterance. Evals
give each decision its own score, so "is the assistant good?" becomes a set of
concrete, trackable numbers instead of a gut feeling.

Two properties shape the whole design:

- **Some decisions are deterministic** (pure JavaScript: retrieval ranking, app
  name resolution, registry structure). These run **headlessly in Node/CI** —
  fast, reproducible, and a hard gate on every push.
- **Some decisions need the real language model** (routing an *ask* vs a
  *command*, parsing a command into an action plan, holding a *multi-shot*
  conversation, and the *free-text answer* itself). The model runs on **WebGPU in
  the browser**, so those suites run **live inside an Evals app** and their
  results are committed back to the repo. Because real model calls are
  **nondeterministic**, every LLM sample is run several times and scored for both
  quality *and* stability (see §5b).

```mermaid
flowchart LR
    subgraph DET["⚙️ Deterministic (Node · CI)"]
        R["retrieval"]
        RES["resolution"]
        INT["integrity"]
        SCO["scorers self-test"]
    end
    subgraph LLM["🤖 Model-dependent (browser · repeated)"]
        RT["routing"]
        CMD["commands · single-shot"]
        PLN["plan · multi-shot"]
        ANS["answers · RAGAS"]
    end

    DET --> SC["📊 Scorecard<br/>results/latest.json"]
    LLM --> SC
    SC --> APP["🧪 Evals app<br/>(in AndreOS)"]
    DET --> CI["GitHub Actions<br/>(gates on thresholds)"]

    classDef det fill:#1f6feb,stroke:#0b3d91,color:#fff;
    classDef llm fill:#8957e5,stroke:#4b2a8a,color:#fff;
    class R,RES,INT,SCO det
    class RT,CMD,PLN,ANS llm
```

---

## 2. What gets measured

Each decision point in the assistant maps to one **suite**. A suite is a golden
dataset plus a scorer that emits a single headline metric (and supporting ones).

| Suite | Assistant code | Question it answers | Headline metric |
|---|---|---|---|
| **routing** | `routeIntent()` in `chat.js` | Is this an *ask* or a *command*? | accuracy |
| **commands** | `parseCommand()` in `chat.js` | Did it produce the *right actions* (single-shot)? | exact-match |
| **plan** | `parseCommand()` over a dialogue | Does it plan right *across turns* (multi-shot)? | plan exact-match |
| **answers** | `answer()` in `chat.js` | Is the *written answer* correct, grounded & relevant? | RAGAS score |
| **retrieval** | `RAGEngine` / `BM25` | Did it surface the *right paper*? | hit@3 |
| **resolution** | `AssistantRegistry.resolveId()` | Did a spoken name map to the *right app*? | accuracy |
| **integrity** | the two registries | Are all profiles/capabilities *well-formed*? | pass/fail |
| **scorers** | `harness/*` | Is the *scoring math itself* correct? | pass/fail |

The first four are the "how well does it follow **ask** questions and do the
right thing" suites — the reason evals exist. `commands` scores a single
utterance; `plan` scores a whole conversation where later turns depend on earlier
ones; `answers` grades the free text the model actually writes. The last four
protect the plumbing (and the scorers) those rely on.

---

## 3. The three layers

Evals are built from three small, independent layers — mirroring how apps are
built in this codebase.

```mermaid
flowchart TB
    subgraph DATA["📁 datasets/"]
        D1["routing.js"]
        D2["commands.js"]
        D3["retrieval.js + fixtureCorpus.js"]
        D4["resolution.js"]
    end
    subgraph SCORE["🧮 harness/"]
        S1["scoreRouting.js"]
        S2["scoreCommands.js"]
        S3["scoreRetrieval.js"]
        S0["normalize.js"]
    end
    subgraph RUN["▶️ runners"]
        N["runNode.js (CI)"]
        B["evals app (browser)"]
    end

    DATA --> N
    DATA --> B
    SCORE --> N
    SCORE --> B
    N --> J["results/latest.json + history.json"]
    B --> J
```

- **Datasets** are the single source of truth — plain data, tagged so weak
  categories show up in the scorecard. Add a row, and both runners pick it up.
- **Scorers** are pure functions shared by *both* runners, so a number computed
  in CI means exactly the same thing as one computed live in the browser.
- **Runners** feed the same datasets through the same scorers; only the
  *predictor* differs (a pure function in Node, the real engine in the browser).

---

## 4. Why the scorers are shared

The golden trap in eval systems is having two implementations drift apart. Here,
`normalize.js` defines the canonical comparison rules once:

- An action is reduced to a stable key — `open:research`, `open_paper:40`,
  `browse:github.com`.
- Free-text fields a small model can never reproduce verbatim (a `chat` message)
  are matched by **kind, not wording**.

Both `runNode.js` and the Evals app import the *same* `scoreCommands`,
`scoreRouting`, and `scoreRetrieval`. A live browser run and a CI run are
therefore directly comparable — no "it passed locally" ambiguity.

---

## 5. Deterministic vs model-dependent — and why the split

```mermaid
flowchart TB
    IN["utterance"] --> Q{"needs the LLM?"}
    Q -->|no| DET["Node scorer<br/>(BM25 · resolveId · registry)"]
    Q -->|yes| LLM["window.AndreChat<br/>routeIntent / parseCommand"]
    DET --> OK["✅ runs in CI on every push"]
    LLM --> BR["🧪 runs in the Evals app<br/>(model on WebGPU)"]
```

- **Retrieval** is scored against a **committed fixture corpus**
  (`fixtureCorpus.js`), *not* live OpenAlex — so it never touches the network and
  is fully reproducible in CI.
- **Resolution** and **integrity** import the live registries (with a tiny DOM
  shim) and inspect them directly.
- **Routing** and **commands** call the real in-browser engine. They cannot run
  in headless CI without WebGPU, so the Evals app is their home; a developer can
  **export** a run and commit it to publish those numbers.

---

## 5b. Nondeterminism: score quality *and* stability

Real model calls are not reproducible — the same prompt can route differently,
plan differently, or word an answer differently on each run. Scoring an LLM
sample **once** is therefore misleading. Every model-dependent runner repeats
each sample `REPEATS` times (default **3**) and aggregates with the shared
`harness/stats.js` helpers:

- **stability** — how often the runs agreed. For categorical suites (routing) it
  is the *majority consistency*; for plans/commands it is how often the *modal
  action plan* recurred; for answers it is `1 − stdev(ragas)`. High quality with
  low stability is a red flag the scorecard now makes visible.
- **pass@k** — did *any* of the k runs succeed? This separates "the model *can*
  do this but is flaky" from "the model *can't* do this at all".
- The representative row fed to the shared scorer is the **majority label** or
  **modal plan**, so a single lucky/unlucky sample can't swing the headline.

```mermaid
flowchart LR
    S["one sample"] --> RPT["run × REPEATS"]
    RPT --> AGG{"aggregate"}
    AGG --> REP["majority / modal → scored"]
    AGG --> STB["stability"]
    AGG --> PAK["pass@k"]
    REP --> HEAD["headline metric"]
```

## 5c. Answer quality — a RAGAS-style, embedding-free scorer

The **answers** suite grades the free text the model writes, modelled on
[RAGAS](https://docs.ragas.io): instead of one fuzzy "is it good?", it decomposes
answer quality into independent facets, each a lexical proxy computed by
`harness/scoreAnswers.js` (backed by `harness/text.js`):

| Facet | What it asks | How it's approximated |
|---|---|---|
| **faithfulness** | Grounded in context, or hallucinated? | fraction of answer content tokens supported by *reference + curated ground-truth facts + the actually-retrieved RAG context*; `mustNotContain` markers hard-cap it |
| **correctness** | Matches the reference answer? | token-set F1 with the reference, blended with coverage of expected key points |
| **relevancy** | Addresses *this* question? | key-point recall blended with question/answer overlap |
| **ragas** | headline | mean of the three facets |

The proxies are deliberately **lexical** (token overlap, keyword coverage, strict
phrase match) rather than embedding- or judge-based, so the exact same numbers
are reproducible with **no model download** and can be **self-tested in CI**. A
`judge` hook is left open for a future LLM-as-judge upgrade without changing the
suite shape. Each answer's golden case carries a `reference`, `keyPoints`,
`groundTruth`, and `mustNotContain` — everything the scorer needs, all sourced
from the assistant's own profile so a faithful model *can* score well.

---

## 6. Where metrics live

Metrics are committed to the repo — no backend required — which gives the Evals
app a free trend history.

```text
tests/evals/
├── datasets/            📁 golden truth (data only)
│   ├── routing.js
│   ├── commands.js
│   ├── plans.js             multi-shot conversations
│   ├── answers.js           RAGAS-style Q + reference + facts
│   ├── retrieval.js
│   ├── fixtureCorpus.js
│   └── resolution.js
├── harness/             🧮 pure scorers (shared Node + browser)
│   ├── normalize.js
│   ├── text.js              lexical helpers for answer scoring
│   ├── stats.js             nondeterminism aggregation (mean/stdev/majority/pass@k)
│   ├── scoreRouting.js
│   ├── scoreCommands.js
│   ├── scorePlan.js         multi-shot plan scoring (reuses scoreCommands)
│   ├── scoreAnswers.js      RAGAS-style facets
│   └── scoreRetrieval.js
├── runNode.js           ▶️ deterministic runner + scorer self-test (writes the scorecard)
└── results/
    ├── latest.json          the current scorecard
    └── history.json         trimmed per-run headline metrics (trend)
```

- `latest.json` — the canonical scorecard the app and CI both read.
- `history.json` — one small entry per run, powering the sparklines.

### Default view & privacy

The Evals app **always opens on the committed `latest.json`** — the published,
canonical results that everyone sees first. When a *visitor* runs the evals in
their browser, that run is shown in-session and its headline metrics are kept
**privately in their own `localStorage`** (feeding only their trend sparklines).
Visitor runs are **never** written back to the repo and never override the
default on open — their actions stay private to their browser.

Publishing new numbers is a deliberate **developer** action: run the evals
locally, click **⬇ Export for commit** to download a `latest.json` (identical in
format to what `runNode.js` writes), drop it into `tests/evals/results/`, and
commit. This is the only way the LLM suites (routing + commands) — which can
only run in a browser — reach the deployed site.

---

## 7. How a run happens

**In CI / locally** (`npm run eval`):

1. Build a BM25 index over the fixture corpus → score retrieval.
2. Import the registries → score resolution + integrity.
3. Run the **scorer self-test** — feed the plan + answers scorers a *perfect* and
   a *broken* simulated model and assert the metrics move correctly (guards the
   RAGAS-style and multi-shot math without needing a model).
4. Write `latest.json` + append to `history.json`.
5. **Exit non-zero** if any suite falls below its threshold in `THRESHOLDS`.

**In the browser** (the 🧪 Evals app → *Run live evals*):

1. Re-run the deterministic suites in-page (instant, for parity).
2. If the Ask André model is loaded, run **routing**, **commands**, **plan**, and
   **answers** through `window.AndreChat` — each sample repeated `REPEATS` times
   for stability — and score them with the shared scorers.
3. Render the scorecard with pass/below-threshold badges, stability/pass@k, and
   trend sparklines. The run stays private (localStorage); a **developer** can
   **Export for commit** to publish it.

```mermaid
flowchart LR
    NPM["npm run eval"] --> DETS["retrieval · resolution · integrity"]
    DETS --> FILE["results/latest.json"]
    FILE --> CIG{"below threshold?"}
    CIG -->|yes| FAIL["❌ CI fails"]
    CIG -->|no| PASS["✅ CI passes"]

    BTN["Evals app · Run live evals"] --> ALL["all 5 suites<br/>(routing+commands need model)"]
    ALL --> LS["🔒 private localStorage trend"]
    ALL --> EXP["⬇ Export for commit<br/>(developer)"]
    EXP --> FILE
    FILE --> APPVIEW["🧪 default view on open"]
```

---

## 8. Adding to the evals

| You want… | You do… |
|---|---|
| A new test case | **Add a row** to the relevant `datasets/*.js` file |
| A new fixture paper | Add an entry to `fixtureCorpus.js` (+ reference it in `retrieval.js`) |
| A new metric on a suite | Extend the scorer in `harness/` (both runners get it) |
| A new suite (new decision point) | Add a dataset + a scorer + wire it into `runNode.js` and the app's `SUITE_META` |
| A stricter CI gate | Bump the `min` in `THRESHOLDS` in `runNode.js` |

No assistant code changes to add coverage — datasets and scorers are the whole
surface area.

---

## 9. Why it scales

- **One dataset, two runtimes.** The same golden files drive CI and the browser,
  so coverage never forks.
- **Shared scorers.** A metric is defined once; committed and live numbers are
  always comparable.
- **Registry-driven.** Resolution and integrity read the live registries, so as
  apps are added their names and capabilities are automatically in scope.
- **Committed metrics = free history.** No database or service — the trend lives
  in `history.json`, versioned alongside the code that produced it.
- **Honest about the model.** Model-dependent suites are clearly separated and
  never faked in CI; they run where the model actually lives.

---

## In short

Every assistant decision gets a **suite**: a golden dataset plus a shared scorer.
Deterministic suites (retrieval, resolution, integrity) run in **Node/CI** and
gate every push; model-dependent suites (routing, commands) run live in the
**Evals app** against the real engine. Both write the same `latest.json`, so the
scorecard — and its committed trend history — tells you, in concrete numbers, how
well the assistant follows *ask* questions and whether it does the right thing.
