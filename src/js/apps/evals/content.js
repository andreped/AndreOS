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
                color: var(--text); background: var(--surface); overflow: hidden; }
            .evals-header { display: flex; align-items: center; gap: 10px; padding: 13px 18px 11px;
                flex: 0 0 auto; }
            .evals-header h1 { font-size: 15px; margin: 0; font-weight: 600; }
            .evals-header .evals-sub { font-size: 11px; color: var(--text-faint); margin-left: 2px; }
            .evals-spacer { flex: 1 1 auto; }
            .evals-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px;
                padding: 7px 12px; font-size: 12px; cursor: pointer; font-weight: 600; }
            .evals-btn:hover { background: var(--accent-hover); }
            .evals-btn:disabled { background: var(--fill-strong); color: var(--text-faint); cursor: default; }
            .evals-btn.secondary { background: var(--fill); color: var(--text); }
            .evals-btn.secondary:hover { background: var(--surface-hover); }

            .evals-tabs { display: flex; gap: 2px; padding: 0 14px; border-bottom: 1px solid var(--border);
                flex: 0 0 auto; }
            .evals-tab { background: none; border: none; color: var(--text-faint); font-size: 12px; font-weight: 600;
                padding: 8px 12px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
            .evals-tab:hover { color: var(--text-secondary); }
            .evals-tab.active { color: var(--text-strong); border-bottom-color: var(--accent); }
            .evals-tab .evals-tab-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%;
                background: var(--accent); margin-left: 6px; vertical-align: middle; animation: evalsPulse 1s infinite; }

            .evals-status { font-size: 11px; color: var(--text-faint); padding: 9px 18px 0; flex: 0 0 auto; }
            /* Body is a non-scrolling flex column; each active panel owns a fixed
               sub-header plus a single scrollable region below it. */
            .evals-body { flex: 1 1 auto; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
            .evals-panel { display: none; flex: 1 1 auto; min-height: 0; }
            .evals-panel.active { display: flex; flex-direction: column; min-height: 0; }
            /* Fixed sub-header inside a panel (sub-tabs / run controls). */
            .evals-subhead { flex: 0 0 auto; padding: 14px 18px 12px; background: var(--surface); }
            .evals-subhead > *:last-child { margin-bottom: 0; }
            /* The single scrollable region inside a panel. */
            .evals-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 18px 18px; }

            /* Short viewports (e.g. mobile): fall back to scrolling the whole body,
               so the fixed sub-header doesn't eat the limited height. */
            @media (max-height: 560px) {
                .evals-body { overflow-y: auto; display: block; }
                .evals-panel.active { display: block; min-height: 0; }
                .evals-subhead { position: sticky; top: 0; z-index: 3; }
                .evals-scroll { overflow: visible; }
                #evals-run-progress { display: block; }
                .eval-checklist { display: block; }
                #evals-checklist { overflow: visible; }
                .evals-panel[data-panel="json"] .evals-json { flex: none; }
            }

            /* Scorecard */
            .evals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
            .eval-card { background: var(--surface-raised); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
            .eval-card h3 { margin: 0 0 2px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); }
            .eval-card .eval-desc { font-size: 10.5px; color: var(--text-faint); margin-bottom: 10px; }
            .eval-metric { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
            .eval-metric .val { font-size: 26px; font-weight: 700; line-height: 1; }
            .eval-metric .lbl { font-size: 11px; color: var(--text-faint); }
            .eval-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
            .eval-badge.pass { background: rgba(46,160,67,.18); color: #4ade80; }
            .eval-badge.fail { background: rgba(220,80,80,.18); color: #f87171; }
            .eval-badge.na   { background: rgba(120,130,150,.15); color: #98a1b2; }
            .eval-sub { font-size: 11px; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; }
            .eval-sub b { color: var(--text); font-weight: 600; }
            .eval-trend { display: flex; align-items: flex-end; gap: 2px; height: 22px; margin-top: 10px; }
            .eval-trend .bar { flex: 1; background: #2d6cdf; border-radius: 1px; min-height: 2px; opacity: .8; }
            .eval-section-title { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; margin: 20px 0 8px; }
            .eval-fail-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .eval-fail-table td { padding: 4px 8px; border-bottom: 1px solid var(--border-soft); vertical-align: top; color: var(--text-secondary); }
            .eval-fail-table code { color: #f0b866; font-size: 10.5px; }
            .eval-empty { color: var(--text-faint); font-size: 12px; padding: 24px 0; text-align: center; }

            /* Run (progress) */
            #evals-run-progress { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
            #evals-run-empty { padding: 28px 18px; }
            .eval-prog { margin-bottom: 14px; }
            .eval-prog-head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; }
            .eval-prog-head .lbl { color: var(--text-secondary); font-weight: 600; }
            .eval-prog-head .lbl small { color: var(--text-faint); font-weight: 400; margin-left: 6px; }
            .eval-prog-head .cnt { color: var(--text-faint); font-variant-numeric: tabular-nums; }
            .eval-prog-track { height: 8px; background: var(--surface-sunken); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
            .eval-prog-fill { height: 100%; background: linear-gradient(90deg,#2d6cdf,#5b8def); width: 0; transition: width .18s ease; }
            .eval-prog-fill.child { background: linear-gradient(90deg,#8957e5,#a879f0); }
            .eval-prog-fill.done { background: linear-gradient(90deg,#2ea043,#4ade80); }

            .eval-runbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
            .eval-suite-tabs { display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 auto; }
            .eval-suite-tab { display: inline-flex; align-items: center; gap: 6px; background: var(--surface-raised);
                border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; font-weight: 600; padding: 5px 10px;
                border-radius: 20px; cursor: pointer; }
            .eval-suite-tab:hover { border-color: var(--border-strong); color: var(--text-secondary); }
            .eval-suite-tab.active { border-color: var(--accent); color: var(--text-strong); }
            .eval-suite-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); flex: 0 0 auto; }
            .eval-suite-tab[data-status="running"] .eval-suite-dot { background: #5b8def; animation: evalsPulse 1s infinite; }
            .eval-suite-tab[data-status="done"] .eval-suite-dot { background: #4ade80; }
            .eval-suite-tab[data-status="skip"] .eval-suite-dot { background: #7a818c; }
            .eval-follow-btn { flex: 0 0 auto; padding: 5px 10px; }

            .eval-checklist { margin: 14px 18px 18px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
                display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
            .eval-checklist-head { font-size: 11px; color: var(--text-muted); font-weight: 600; padding: 8px 12px;
                background: var(--surface-raised); border-bottom: 1px solid var(--border); text-transform: uppercase; letter-spacing: .04em; }
            .eval-checklist-head { flex: 0 0 auto; }
            #evals-checklist { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
            .eval-chk { display: flex; align-items: center; gap: 10px; padding: 6px 12px; font-size: 12px; border-bottom: 1px solid var(--border-soft); }
            .eval-chk:last-child { border-bottom: none; }
            .eval-chk-box { width: 16px; height: 16px; border-radius: 4px; flex: 0 0 auto; display: flex;
                align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
            .eval-chk-label { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .eval-chk-meta { margin-left: auto; font-size: 10.5px; color: var(--text-faint); flex: 0 0 auto; padding-left: 10px; }
            .eval-chk[data-status="pending"] .eval-chk-box { background: var(--fill); color: var(--text-faint); }
            .eval-chk[data-status="pending"] .eval-chk-label { color: var(--text-faint); }
            .eval-chk[data-status="running"] { background: rgba(45,108,223,.08); }
            .eval-chk[data-status="running"] .eval-chk-box { background: transparent; color: #5b8def; animation: evalsSpin .8s linear infinite; }
            .eval-chk[data-status="pass"] .eval-chk-box { background: rgba(46,160,67,.2); color: #4ade80; }
            .eval-chk[data-status="fail"] .eval-chk-box { background: rgba(220,80,80,.2); color: #f87171; }
            .eval-chk[data-status="skip"] .eval-chk-box { background: var(--fill); color: #7a818c; }

            /* JSON */
            .evals-json-toolbar { display: flex; justify-content: flex-end; margin-bottom: 8px; }
            .evals-json { background: var(--surface-sunken); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px;
                font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.5;
                color: var(--text-secondary); white-space: pre; overflow: auto; margin: 14px 18px 18px; flex: 1 1 auto; min-height: 0; }

            /* Dataset */
            .eval-ds-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
            .eval-ds-section { margin-bottom: 20px; }
            .eval-ds-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
            .eval-ds-head h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-muted); margin: 0; }
            .eval-ds-head .cnt { font-size: 11px; color: var(--text-secondary); }
            .eval-ds-head .desc { font-size: 11px; color: var(--text-faint); }
            .eval-ds-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
            .eval-ds-table th { text-align: left; color: var(--text-faint); font-weight: 600; padding: 5px 8px;
                border-bottom: 1px solid var(--border); }
            .eval-ds-table td { padding: 5px 8px; border-bottom: 1px solid var(--border-soft); color: var(--text-secondary); vertical-align: top; }
            .eval-ds-table tr:hover td { background: var(--surface-hover); }
            .eval-ds-table code { color: #f0b866; font-size: 11px; }
            .eval-ds-tag { display: inline-block; background: var(--fill); color: var(--text-muted); border-radius: 10px;
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
                <div class="evals-subhead">
                    <div class="eval-ds-tabs" id="evals-sc-tabs"></div>
                </div>
                <div class="evals-scroll">
                    <div id="evals-sc-metrics">
                        <div class="evals-grid" id="evals-grid"></div>
                    </div>
                    <div id="evals-sc-failures" style="display:none">
                        <div id="evals-failures"></div>
                    </div>
                </div>
            </div>

            <div class="evals-panel" data-panel="run">
                <div id="evals-run-empty" class="eval-empty">Click “Run live evals” to benchmark the assistant live.</div>
                <div id="evals-run-progress" style="display:none">
                    <div class="evals-subhead">
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
                    </div>
                    <div class="eval-checklist">
                        <div class="eval-checklist-head" id="evals-checklist-head">Samples</div>
                        <div id="evals-checklist"></div>
                    </div>
                </div>
            </div>

            <div class="evals-panel" data-panel="dataset">
                <div class="evals-subhead">
                    <div class="eval-ds-tabs" id="evals-ds-tabs"></div>
                </div>
                <div class="evals-scroll">
                    <div id="evals-dataset"></div>
                </div>
            </div>

            <div class="evals-panel" data-panel="json">
                <div class="evals-subhead">
                    <div class="evals-json-toolbar"><button class="evals-btn secondary" id="evals-copy">⧉ Copy</button></div>
                </div>
                <pre class="evals-json" id="evals-json">{}</pre>
            </div>
        </div>
    </div>`;
}
