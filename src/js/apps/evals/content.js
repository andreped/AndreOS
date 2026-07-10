/**
 * Evals app content — the scorecard shell (tabbed).
 *
 * Three tabs, all populated by window.js:
 *   • Scorecard — suite cards + failures (the committed or last-run results)
 *   • Run       — live two-level progress (suites → samples) + per-sample checklist
 *   • JSON      — the raw scorecard JSON, with copy
 *
 * Structure + scoped styles only; window.js owns all data and behaviour.
 */
export function render() {
    return `
    <div class="evals-app">
        <style>
            .evals-app { height: 100%; display: flex; flex-direction: column; font-family: inherit;
                color: #e6e6e6; background: #14161c; overflow: hidden; }
            .evals-header { display: flex; align-items: center; gap: 10px; padding: 13px 18px 11px;
                flex: 0 0 auto; }
            .evals-header h1 { font-size: 15px; margin: 0; font-weight: 600; }
            .evals-header .evals-sub { font-size: 11px; color: #8b93a1; margin-left: 2px; }
            .evals-spacer { flex: 1 1 auto; }
            .evals-btn { background: #2d6cdf; color: #fff; border: none; border-radius: 6px;
                padding: 7px 12px; font-size: 12px; cursor: pointer; font-weight: 600; }
            .evals-btn:hover { background: #3b78e7; }
            .evals-btn:disabled { background: #33383f; color: #7a818c; cursor: default; }
            .evals-btn.secondary { background: #262a33; }
            .evals-btn.secondary:hover { background: #313640; }

            .evals-tabs { display: flex; gap: 2px; padding: 0 14px; border-bottom: 1px solid #262a33;
                flex: 0 0 auto; }
            .evals-tab { background: none; border: none; color: #8b93a1; font-size: 12px; font-weight: 600;
                padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
            .evals-tab:hover { color: #cdd3dd; }
            .evals-tab.active { color: #fff; border-bottom-color: #2d6cdf; }
            .evals-tab .evals-tab-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
                background: #2d6cdf; margin-left: 6px; vertical-align: middle; animation: evalsPulse 1s infinite; }

            .evals-status { font-size: 11px; color: #8b93a1; padding: 9px 18px 0; flex: 0 0 auto; }
            .evals-body { flex: 1 1 auto; overflow-y: auto; padding: 14px 18px 18px; }
            .evals-panel { display: none; }
            .evals-panel.active { display: block; }

            /* Scorecard */
            .evals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
            .eval-card { background: #1b1e26; border: 1px solid #262a33; border-radius: 10px; padding: 14px; }
            .eval-card h3 { margin: 0 0 2px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #aab2c0; }
            .eval-card .eval-desc { font-size: 10.5px; color: #767e8c; margin-bottom: 10px; }
            .eval-metric { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
            .eval-metric .val { font-size: 26px; font-weight: 700; line-height: 1; }
            .eval-metric .lbl { font-size: 11px; color: #8b93a1; }
            .eval-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
            .eval-badge.pass { background: rgba(46,160,67,.18); color: #4ade80; }
            .eval-badge.fail { background: rgba(220,80,80,.18); color: #f87171; }
            .eval-badge.na   { background: rgba(120,130,150,.15); color: #98a1b2; }
            .eval-sub { font-size: 11px; color: #9aa2b1; display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
            .eval-sub b { color: #d6dbe4; font-weight: 600; }
            .eval-trend { display: flex; align-items: flex-end; gap: 2px; height: 22px; margin-top: 10px; }
            .eval-trend .bar { flex: 1; background: #2d6cdf; border-radius: 1px; min-height: 2px; opacity: .8; }
            .eval-section-title { font-size: 12px; color: #aab2c0; text-transform: uppercase; letter-spacing: .04em; margin: 20px 0 8px; }
            .eval-fail-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .eval-fail-table td { padding: 4px 8px; border-bottom: 1px solid #1f232b; vertical-align: top; color: #c4cad4; }
            .eval-fail-table code { color: #f0b866; font-size: 10.5px; }
            .eval-empty { color: #6b7280; font-size: 12px; padding: 24px 0; text-align: center; }

            /* Run (progress) */
            .eval-prog { margin-bottom: 14px; }
            .eval-prog-head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
            .eval-prog-head .lbl { color: #cdd3dd; font-weight: 600; }
            .eval-prog-head .lbl small { color: #767e8c; font-weight: 400; margin-left: 6px; }
            .eval-prog-head .cnt { color: #8b93a1; font-variant-numeric: tabular-nums; }
            .eval-prog-track { height: 8px; background: #1b1e26; border: 1px solid #262a33; border-radius: 6px; overflow: hidden; }
            .eval-prog-fill { height: 100%; background: linear-gradient(90deg,#2d6cdf,#5b8def); width: 0; transition: width .18s ease; }
            .eval-prog-fill.child { background: linear-gradient(90deg,#8957e5,#a879f0); }
            .eval-prog-fill.done { background: linear-gradient(90deg,#2ea043,#4ade80); }

            .eval-runbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
            .eval-suite-tabs { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; }
            .eval-suite-tab { display: inline-flex; align-items: center; gap: 6px; background: #1b1e26;
                border: 1px solid #262a33; color: #9aa2b1; font-size: 11px; font-weight: 600; padding: 5px 10px;
                border-radius: 20px; cursor: pointer; }
            .eval-suite-tab:hover { border-color: #3a4150; color: #cdd3dd; }
            .eval-suite-tab.active { border-color: #2d6cdf; color: #fff; }
            .eval-suite-dot { width: 7px; height: 7px; border-radius: 50%; background: #5b636f; flex: 0 0 auto; }
            .eval-suite-tab[data-status="running"] .eval-suite-dot { background: #5b8def; animation: evalsPulse 1s infinite; }
            .eval-suite-tab[data-status="done"] .eval-suite-dot { background: #4ade80; }
            .eval-suite-tab[data-status="skip"] .eval-suite-dot { background: #7a818c; }
            .eval-follow-btn { flex: 0 0 auto; padding: 5px 10px; }

            .eval-checklist { margin-top: 14px; border: 1px solid #262a33; border-radius: 10px; overflow: hidden; }
            .eval-checklist-head { font-size: 11px; color: #aab2c0; font-weight: 600; padding: 8px 12px;
                background: #1b1e26; border-bottom: 1px solid #262a33; text-transform: uppercase; letter-spacing: .04em; }
            .eval-chk { display: flex; align-items: center; gap: 10px; padding: 6px 12px; font-size: 12px; border-bottom: 1px solid #1a1d24; }
            .eval-chk:last-child { border-bottom: none; }
            .eval-chk-box { width: 16px; height: 16px; border-radius: 4px; flex: 0 0 auto; display: flex;
                align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
            .eval-chk-label { color: #c4cad4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .eval-chk-meta { margin-left: auto; font-size: 10.5px; color: #767e8c; flex: 0 0 auto; padding-left: 10px; }
            .eval-chk[data-status="pending"] .eval-chk-box { background: #22262e; color: #5b636f; }
            .eval-chk[data-status="pending"] .eval-chk-label { color: #767e8c; }
            .eval-chk[data-status="running"] { background: rgba(45,108,223,.08); }
            .eval-chk[data-status="running"] .eval-chk-box { background: transparent; color: #5b8def; animation: evalsSpin .8s linear infinite; }
            .eval-chk[data-status="pass"] .eval-chk-box { background: rgba(46,160,67,.2); color: #4ade80; }
            .eval-chk[data-status="fail"] .eval-chk-box { background: rgba(220,80,80,.2); color: #f87171; }
            .eval-chk[data-status="skip"] .eval-chk-box { background: #22262e; color: #7a818c; }

            /* JSON */
            .evals-json-toolbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
            .evals-json { background: #0f1116; border: 1px solid #262a33; border-radius: 8px; padding: 12px 14px;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5;
                color: #c4cad4; white-space: pre; overflow: auto; margin: 0; }

            /* Dataset */
            .eval-ds-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
            .eval-ds-section { margin-bottom: 20px; }
            .eval-ds-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
            .eval-ds-head h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #aab2c0; margin: 0; }
            .eval-ds-head .cnt { font-size: 11px; color: #cdd3dd; }
            .eval-ds-head .desc { font-size: 11px; color: #767e8c; }
            .eval-ds-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
            .eval-ds-table th { text-align: left; color: #767e8c; font-weight: 600; padding: 5px 8px;
                border-bottom: 1px solid #262a33; }
            .eval-ds-table td { padding: 5px 8px; border-bottom: 1px solid #1a1d24; color: #c4cad4; vertical-align: top; }
            .eval-ds-table tr:hover td { background: #1a1d24; }
            .eval-ds-table code { color: #f0b866; font-size: 11px; }
            .eval-ds-tag { display: inline-block; background: #22262e; color: #98a1b2; border-radius: 10px;
                padding: 1px 7px; font-size: 10px; margin: 1px 2px 1px 0; }

            @keyframes evalsSpin { to { transform: rotate(360deg); } }
            @keyframes evalsPulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
        </style>

        <div class="evals-header">
            <h1>🧪 Assistant Evals</h1>
            <span class="evals-sub" id="evals-source"></span>
            <div class="evals-spacer"></div>
            <button class="evals-btn secondary" id="evals-export" title="Download the current scorecard as JSON">⬇ Export</button>
            <button class="evals-btn" id="evals-run">▶ Run live evals</button>
        </div>

        <div class="evals-tabs">
            <button class="evals-tab active" data-tab="scorecard">Scorecard</button>
            <button class="evals-tab" data-tab="run">Run <span class="evals-tab-dot" id="evals-run-indicator" style="display:none"></span></button>
            <button class="evals-tab" data-tab="dataset">Dataset</button>
            <button class="evals-tab" data-tab="json">JSON</button>
        </div>

        <div class="evals-status" id="evals-status">Loading committed scorecard…</div>

        <div class="evals-body">
            <div class="evals-panel active" data-panel="scorecard">
                <div class="eval-ds-tabs" id="evals-sc-tabs"></div>
                <div id="evals-sc-metrics">
                    <div class="evals-grid" id="evals-grid"></div>
                </div>
                <div id="evals-sc-failures" style="display:none">
                    <div id="evals-failures"></div>
                </div>
            </div>

            <div class="evals-panel" data-panel="run">
                <div id="evals-run-empty" class="eval-empty">Click “Run live evals” to benchmark the assistant live.</div>
                <div id="evals-run-progress" style="display:none">
                    <div class="eval-runbar">
                        <div class="eval-suite-tabs" id="evals-suite-tabs"></div>
                        <button class="evals-btn secondary eval-follow-btn" id="evals-follow" style="display:none" title="Auto-follow the running suite">👁 Follow run</button>
                    </div>
                    <div class="eval-prog">
                        <div class="eval-prog-head"><span class="lbl">Suites <small id="evals-parent-name"></small></span><span class="cnt" id="evals-parent-cnt">0 / 0</span></div>
                        <div class="eval-prog-track"><div class="eval-prog-fill" id="evals-parent-fill"></div></div>
                    </div>
                    <div class="eval-prog">
                        <div class="eval-prog-head"><span class="lbl" id="evals-child-name">—</span><span class="cnt" id="evals-child-cnt">0 / 0</span></div>
                        <div class="eval-prog-track"><div class="eval-prog-fill child" id="evals-child-fill"></div></div>
                    </div>
                    <div class="eval-checklist">
                        <div class="eval-checklist-head" id="evals-checklist-head">Samples</div>
                        <div id="evals-checklist"></div>
                    </div>
                </div>
            </div>

            <div class="evals-panel" data-panel="dataset">
                <div class="eval-ds-tabs" id="evals-ds-tabs"></div>
                <div id="evals-dataset"></div>
            </div>

            <div class="evals-panel" data-panel="json">
                <div class="evals-json-toolbar"><button class="evals-btn secondary" id="evals-copy">⧉ Copy</button></div>
                <pre class="evals-json" id="evals-json">{}</pre>
            </div>
        </div>
    </div>`;
}
