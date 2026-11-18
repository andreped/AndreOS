# ADR 0002 — Nemotron streaming speech is opt-in; Whisper Base stays the default

- **Status:** Accepted (Nemotron selectable in Settings → Speech as *Experimental*)
- **Date:** 2026-11-18
- **Details:** [docs/architecture/speech-transcription.md](../architecture/speech-transcription.md)

## Context

Voice input ran Whisper (Tiny/Base/Small) after you stopped speaking. We wanted live text
in the chat field while dictating, in **English and Norwegian**, at a size a browser can download.

Recent open speech-to-text models, checked for Norwegian support:

| Model | Size | Norwegian | Streaming |
|---|---|---|---|
| NVIDIA Parakeet TDT 0.6B v3 | 0.6B | ✗ (25 EU languages, not `no`) | chunked |
| Moonshine | tiny–medium | ✗ | ✓ |
| Mistral Voxtral Mini 4B Realtime | 4B | ✗ (13 languages) | ✓ |
| **NVIDIA Nemotron 3.5 ASR Streaming** | 0.6B | ✓ `nb-NO` ("broad-coverage" tier) | ✓ cache-aware |
| NB-Whisper (National Library of Norway) | 39M–1.5B | ✓ (Bokmål, Nynorsk, English) | ✗ |

Nemotron 3.5 was the only small, natively streaming model listing Norwegian. Its model card reports
FLEURS WER ~8–9% for English but ~18–20% for `nb-NO`.

## Decision

1. **Run Nemotron 3.5 in the browser** with onnxruntime-web (no Python), on the onnx-community int4 export,
   with our own log-mel front-end and greedy RNN-T loop ([nemotron.js](../../src/js/assistant/voice/nemotron.js)).
2. **Stream mic audio to the speech worker** and show partial transcripts in the chat input; Send while
   dictating sends what's there and stops transcription.
3. **Keep Whisper Base as the default.** Nemotron is offered as *Experimental* so visitors can try realtime
   dictation — it works well in English.
4. **Settings → Speech → Transcription Mode: Realtime / Full audio** to compare the experience.

## Findings (why)

Measured in Node on the same code the browser runs, with clips from macOS `say` (voices *Nora* for
Norwegian, *Samantha* for English).

- **Streaming doesn't change the result.** Pushing audio in 100 ms pieces gives exactly the same text as
  one pass (asserted by `tests/evals/nemotron.selfcheck.mjs`). Realtime and full-audio differ only in
  when you see the text.
- **Resampling isn't the problem.** Our 48→16 kHz box filter vs macOS `afconvert` gave equally good (and
  equally flawed) Norwegian.
- **Speech in the first chunk is often lost.** With no leading silence, 2 of 4 Norwegian sentences decoded
  to an empty string; 0.25–0.5 s of silence recovered them. → every stream is primed with 0.5 s of silence.
  Initialising the pre-encode cache with silence instead of zeros made no difference.
- **The Norwegian prompt id is right but weak.** `nb-NO` (103) is the usable one; `no` (27) yields
  garbage, `nn-NO` (104) is worse. Even with `nb-NO`, output drifts to German/Danish/Swedish spellings:

  | Said (Norwegian) | Heard |
  |---|---|
  | Søk etter publikasjoner om kunstig intelligens og medisinsk bildebehandling | Sir Kepublikationer om kunstig intelligens og medicinsk bildebehandling. |
  | Vis meg CV-en og ta meg til kontaktsiden | Wie Smeizer wären automatik und Taktsiden. |
  | Åpne innstillingene og lukk vinduet | Open instilling Nalo Qwindur. |

  English on the same pipeline is clean ("Open the research app and show me the settings.").
- **Small input changes flip Norwegian results** (e.g. doubling the gain turned an empty result into
  text), so impressions from a few tries are noisy.

## Consequences

- Nemotron is a ~790 MB download vs ~74 MB for Whisper Base; fine as an opt-in, not as a default.
- Realtime dictation is available today for English via Nemotron.

## Open questions

- Does a less-quantised export (fp16 / int8 — community exports exist) recover Norwegian accuracy? int4
  may hurt a lower-resource language more than English. Untested.
- Would a NeMo-exact first chunk (49 frames, no pre-encode cache) remove the need for silence priming?
- For Norwegian quality, NB-Whisper (`onnx-community/nb-whisper-*-ONNX`) is a drop-in for the Whisper path,
  but not streaming.
