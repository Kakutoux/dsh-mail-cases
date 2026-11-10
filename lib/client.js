;(function () {
  'use strict'

  function makeFactory () {
    return function (require) {
      var module = { exports: {} }
      var React = require('react')
      var h = React.createElement
      var useState = React.useState
      var useEffect = React.useEffect
      var useCallback = React.useCallback
      var useRef = React.useRef

      var PANEL_ID = 'mail-cases'

      var STATUS = [
        { value: 'todo', label: '未开始' },
        { value: 'doing', label: '处理中' },
        { value: 'waiting', label: '等待客户' },
        { value: 'done', label: '已完成' },
      ]

      var CSS = `
.mc-root{
  height:100%;display:flex;flex-direction:column;position:relative;overflow:hidden;
  --mc-border:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 12%,transparent);
  --mc-border-strong:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 22%,transparent);
  --mc-faint:var(--dsw-alias-label-secondary,#8b93a1);
  --mc-bg:var(--dsw-alias-bg-base,#0d0f13);
  --mc-surface:var(--dsw-alias-bg-layer-1,#12151a);
  --mc-surface-2:var(--dsw-alias-bg-layer-2,#191d24);
  background:var(--mc-bg);color:var(--dsw-alias-label-primary,#e8eaef);
  font-size:13px;line-height:1.55;padding-top:var(--dsh-frame-top-clearance,0px);
  -webkit-font-smoothing:antialiased;
}
.mc-root *{box-sizing:border-box}
.mc-header{display:flex;align-items:center;gap:10px;flex:none;padding:10px 18px;border-bottom:1px solid var(--mc-border)}
.mc-name{font-size:14px;font-weight:600}
.mc-badge{font-size:11px;color:var(--mc-faint);background:var(--mc-surface-2);border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums}
.mc-lastrun{font-size:11px;color:var(--mc-faint);max-width:32%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-spacer{flex:1}

.mc-btn{appearance:none;border:1px solid transparent;border-radius:8px;padding:6px 12px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;transition:background .14s,border-color .14s,color .14s,opacity .14s}
.mc-btn:disabled{opacity:.5;cursor:default}
.mc-btn-primary{background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff}
.mc-btn-primary:hover:not(:disabled){filter:brightness(1.08)}
.mc-btn-ghost{background:transparent;color:var(--mc-faint);border-color:var(--mc-border)}
.mc-btn-ghost:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 8%,transparent);color:var(--dsw-alias-label-primary,#e8eaef)}
.mc-btn-danger{background:transparent;color:var(--dsw-alias-state-error-primary,#f87171);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f87171) 32%,transparent)}
.mc-btn-danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f87171) 12%,transparent)}
.mc-btn-sm{padding:3px 9px;font-size:11.5px}
.mc-wide{width:100%}

.mc-body{flex:1;display:flex;min-height:0}
.mc-col{display:flex;flex-direction:column;min-height:0;min-width:0}
.mc-left{width:246px;flex:none;border-right:1px solid var(--mc-border);background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 3%,var(--mc-bg))}
.mc-mid{flex:1;background:var(--mc-bg)}
.mc-right{width:288px;flex:none;border-left:1px solid var(--mc-border);background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 3%,var(--mc-bg));overflow-y:auto}

.mc-filters{flex:none;padding:9px 10px 8px;border-bottom:1px solid var(--mc-border);display:flex;flex-direction:column;gap:7px;position:relative}
.mc-search-row{display:flex;gap:6px;align-items:center}
.mc-search-row>.mc-input{flex:1;min-width:0}
.mc-icon-btn{flex:none;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--mc-border);background:transparent;color:var(--mc-faint);cursor:pointer;font-size:13px;line-height:1}
.mc-icon-btn:hover{color:var(--dsw-alias-label-primary,#e8eaef);border-color:var(--mc-border-strong)}
.mc-icon-btn.is-on{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 14%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 34%,transparent);color:var(--dsw-alias-label-primary,#e8eaef)}
.mc-tabs{display:flex;gap:2px;padding:2px;border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 5%,transparent)}
.mc-tab{flex:1;min-width:0;font:inherit;font-size:11.5px;padding:4px 2px;border-radius:6px;border:0;background:transparent;color:var(--mc-faint);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-tab:hover{color:var(--dsw-alias-label-primary,#e8eaef)}
.mc-tab.is-on{background:var(--mc-surface,var(--mc-bg));color:var(--dsw-alias-label-primary,#e8eaef);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.10)}
.mc-tab em{font-style:normal;font-size:10px;color:var(--mc-faint);margin-left:3px}
.mc-menu{position:absolute;left:10px;right:10px;top:44px;z-index:40;background:var(--dsw-alias-bg-overlay,var(--mc-bg));border:1px solid var(--mc-border);border-radius:10px;padding:9px;box-shadow:0 10px 26px rgba(0,0,0,.22);display:flex;flex-direction:column;gap:8px}
.mc-menu-row{display:flex;align-items:center;gap:6px}
.mc-menu-row label{font-size:10.5px;color:var(--mc-faint);flex:none;width:32px}
.mc-input{width:100%;min-width:0;font:inherit;font-size:12px;color:inherit;background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 4%,var(--mc-surface-2));border:1px solid var(--mc-border);border-radius:8px;padding:6px 8px}
.mc-input::placeholder{color:var(--mc-faint)}
.mc-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
textarea.mc-input{resize:vertical;min-height:54px;line-height:1.55}
select.mc-input{cursor:pointer}
.mc-row{display:flex;gap:6px}
.mc-row>*{flex:1}
.mc-chips{display:flex;gap:4px;flex-wrap:wrap}
.mc-chip-btn{font:inherit;font-size:11px;padding:2px 8px;border-radius:999px;cursor:pointer;background:transparent;border:1px solid var(--mc-border);color:var(--mc-faint)}
.mc-chip-btn.is-on{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 16%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 38%,transparent);color:var(--dsw-alias-label-primary,#e8eaef)}
.mc-range{display:flex;flex-direction:column;gap:4px}
.mc-range label{font-size:10.5px;color:var(--mc-faint)}

.mc-list{flex:1;overflow-y:auto;padding:4px 7px 24px}
.mc-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 6px 3px;font-size:10.5px;color:var(--mc-faint);cursor:pointer;user-select:none}
.mc-group-head:hover{color:var(--dsw-alias-label-primary,#e8eaef)}
.mc-item{position:relative;border:1px solid transparent;border-left:3px solid var(--mc-border-strong);border-radius:7px;padding:6px 8px 7px 9px;cursor:pointer}
.mc-item:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 6%,transparent)}
.mc-item.is-active{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 13%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 32%,transparent)}
.mc-item.is-doing{border-left-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.mc-item.is-waiting{border-left-color:var(--dsw-alias-state-warn-primary,#f0b429)}
.mc-item.is-done{border-left-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 55%,transparent)}
.mc-item.is-todo{border-left-color:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 30%,transparent)}
.mc-item-line{display:flex;align-items:flex-start;gap:5px}
.mc-pin{flex:none;width:16px;height:16px;margin:-1px -3px 0 0;display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--mc-faint);cursor:pointer;opacity:0;font-size:11px;line-height:1;border-radius:4px;padding:0}
.mc-item:hover .mc-pin{opacity:1}
.mc-item.is-pinned .mc-pin{opacity:1;color:var(--dsw-alias-brand-primary,#4d6bfe)}
.mc-pin:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 12%,transparent)}
.mc-item-top{display:flex;gap:6px;align-items:baseline}
.mc-item-date{font-size:10px;color:var(--mc-faint);font-variant-numeric:tabular-nums;flex:none}
.mc-item-title{font-size:12.5px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.mc-item-meta{display:flex;gap:5px;align-items:center;margin-top:2px}
.mc-dot{width:5px;height:5px;border-radius:50%;background:var(--mc-border-strong);flex:none}
.mc-dot-doing{background:var(--dsw-alias-brand-primary,#4d6bfe)}
.mc-dot-waiting{background:var(--dsw-alias-state-warn-primary,#f0b429)}
.mc-dot-done{background:var(--dsw-alias-state-success-primary,#3fb950)}
.mc-count{font-size:10px;color:var(--mc-faint)}
.mc-empty{padding:26px 14px;text-align:center;color:var(--mc-faint);font-size:12px;display:flex;flex-direction:column;gap:6px;align-items:center}

.mc-detail{flex:1;display:flex;flex-direction:column;min-height:0}
.mc-detail-head{flex:none;padding:12px 22px 9px;border-bottom:1px solid var(--mc-border)}
.mc-detail-title{font-size:15px;font-weight:600;margin:0 0 3px;line-height:1.4}
.mc-detail-sub{font-size:11.5px;color:var(--mc-faint);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.mc-detail-body{flex:1;overflow-y:auto;padding:14px 22px 40px}
.mc-sec{margin-bottom:22px;max-width:860px}
.mc-sec-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.mc-sec-no{width:18px;height:18px;border-radius:5px;flex:none;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:600;color:var(--dsw-alias-brand-primary,#4d6bfe);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 14%,transparent)}
.mc-sec-title{font-size:12.5px;font-weight:600}
.mc-summary{font-size:12.5px;line-height:1.7;background:var(--mc-surface);border:1px solid var(--mc-border);border-left:3px solid var(--dsw-alias-brand-primary,#4d6bfe);border-radius:8px;padding:9px 12px;white-space:pre-wrap}
.mc-mail{padding:2px 0 14px;border-bottom:1px dashed var(--mc-border);margin-bottom:14px}
.mc-mail:last-child{border-bottom:none}
.mc-mail-title{font-size:13.5px;font-weight:600;line-height:1.45}
.mc-mail-latest{display:inline-block;margin-right:6px;padding:0 5px;border-radius:4px;font-size:10px;font-weight:500;line-height:16px;vertical-align:1px;color:var(--dsw-alias-brand-primary,#4d6bfe);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 14%,transparent)}
.mc-mail-meta{font-size:10.5px;color:var(--mc-faint);margin:2px 0 7px}
.mc-mail-orig{font-size:10.5px;color:var(--mc-faint);margin:-3px 0 7px;opacity:.85}
.mc-mail-body{white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.72;max-height:360px;overflow-y:auto}
.mc-mail-body.is-open{max-height:none}
.mc-zh{margin-top:9px;padding-top:8px;border-top:1px solid var(--mc-border)}
.mc-zh-label{display:inline-block;font-size:10px;color:var(--dsw-alias-brand-primary,#4d6bfe);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 34%,transparent);border-radius:999px;padding:0 6px;margin-bottom:5px}
.mc-zh-text{white-space:pre-wrap;word-break:break-word;font-size:12.5px;line-height:1.75;color:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 88%,transparent)}
.mc-pending{font-size:11px;color:var(--mc-faint);margin-top:6px}
.mc-ask{display:flex;gap:8px;padding:6px 10px;border:1px solid var(--mc-border);border-radius:8px;margin-bottom:5px;background:var(--mc-surface)}
.mc-ask-n{font-size:11px;color:var(--mc-faint);flex:none;width:14px;text-align:right}
.mc-ask-text{flex:1;min-width:0;font-size:12.5px}
.mc-ask-meta{display:flex;gap:5px;margin-top:2px;flex-wrap:wrap}
.mc-tag-s{font-size:10px;color:var(--mc-faint);border:1px solid var(--mc-border);border-radius:999px;padding:0 6px}
.mc-tag-warn{color:var(--dsw-alias-state-warn-primary,#f0b429);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f0b429) 36%,transparent)}
.mc-placeholder{padding:18px 14px;border:1px dashed var(--mc-border);border-radius:9px;color:var(--mc-faint);font-size:12px;text-align:center;line-height:1.7}
.mc-detail-foot{flex:none;display:flex;gap:8px;padding:9px 22px;border-top:1px solid var(--mc-border);align-items:center}

.mc-side{padding:12px 14px 6px;border-bottom:1px solid var(--mc-border);flex:none}
.mc-side-title{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mc-faint);margin-bottom:7px}
.mc-kv{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;padding:2px 0}
.mc-kv span:first-child{color:var(--mc-faint);flex:none}
.mc-kv span:last-child{text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-side-records{flex:1;min-height:0;display:flex;flex-direction:column;padding:12px 14px 0;border-bottom:none}
.mc-rec-head-row{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px}
.mc-rec-list{flex:1;min-height:0;overflow-y:auto;padding:0 4px 8px 0;margin-right:-4px}
.mc-rec{padding:7px 0;border-bottom:1px dashed var(--mc-border)}
.mc-rec:last-child{border-bottom:none}
.mc-rec.is-auto{opacity:.75}
.mc-rec-head{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--mc-faint)}
.mc-rec-kind{width:5px;height:5px;border-radius:50%;flex:none;background:var(--mc-border-strong)}
.mc-kind-email{background:var(--dsw-alias-brand-primary,#4d6bfe)}
.mc-kind-manual{background:var(--dsw-alias-state-success-primary,#3fb950)}
.mc-kind-status{background:var(--dsw-alias-state-warn-primary,#f0b429)}
.mc-rec .mc-del{opacity:0;transition:opacity .12s}
.mc-rec:hover .mc-del,.mc-rec:focus-within .mc-del{opacity:1}
.mc-rec-action{font-size:11.5px;margin-top:2px;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}
.mc-rec-detail{font-size:11px;color:var(--mc-faint);margin-top:2px;white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}
.mc-rec-next{font-size:11px;color:var(--dsw-alias-brand-primary,#4d6bfe);margin-top:2px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}
.mc-rec.is-open .mc-rec-action,.mc-rec.is-open .mc-rec-detail,.mc-rec.is-open .mc-rec-next{display:block;-webkit-line-clamp:unset;overflow:visible;white-space:normal}
.mc-rec.is-open .mc-rec-detail{white-space:pre-wrap}
.mc-flow-row{flex:none;border-top:1px dashed var(--mc-border);padding:8px 0}
.mc-flow-btn{display:flex;align-items:center;gap:6px;width:100%;font-size:11px;color:var(--mc-faint);background:none;border:none;padding:0;cursor:pointer;text-align:left;font-family:inherit}
.mc-flow-btn:hover{color:var(--dsw-alias-brand-primary,#4d6bfe)}
.mc-flow-btn b{font-weight:600;color:var(--dsw-alias-label-primary,#e8eaef);opacity:.85}
.mc-flow-btn i{font-style:normal;opacity:.7}
.mc-form{flex:none;display:flex;flex-direction:column;gap:6px;padding:12px 14px 24px;border-top:1px solid var(--mc-border);background:var(--mc-bg)}
.mc-empty-rec{padding:16px 0;font-size:11.5px;color:var(--mc-faint);text-align:center;line-height:1.7}
.mc-rec-hint{font-size:10.5px;color:var(--mc-faint);padding:2px 0 4px}
.mc-status-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;padding:5px 10px;border-radius:8px;border:1px solid var(--mc-border);background:color-mix(in srgb,currentColor 8%,transparent);align-self:flex-start}
.mc-status-pill .mc-status-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.mc-status-pill.is-todo{color:var(--dsw-alias-label-secondary,#8a93a6)}
.mc-status-pill.is-doing{color:#4d6bfe}
.mc-status-pill.is-waiting{color:#e08a2e}
.mc-status-pill.is-done{color:#2fa36b}
.mc-all-list{max-height:60vh;overflow-y:auto;margin-top:8px}

.mc-overlay{position:absolute;inset:0;background:color-mix(in srgb,#000 46%,transparent);display:flex;align-items:center;justify-content:center;z-index:20}
.mc-modal{width:min(520px,86%);max-height:86%;overflow-y:auto;background:var(--dsw-alias-bg-overlay,var(--mc-surface));border:1px solid var(--mc-border-strong);border-radius:14px;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.mc-modal h3{margin:0 0 4px;font-size:14px}
.mc-hint{font-size:11.5px;color:var(--mc-faint);margin:0 0 12px;line-height:1.6}
.mc-field{margin-bottom:9px}
.mc-field label{display:block;font-size:11.5px;color:var(--mc-faint);margin-bottom:3px}
.mc-check{display:flex;gap:7px;align-items:flex-start;font-size:12px;margin:10px 0;cursor:pointer}
.mc-check input{margin-top:2px}
.mc-modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.mc-danger-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#f87171) 28%,transparent);border-radius:9px;margin-top:12px}
.mc-danger-row div{font-size:11.5px;color:var(--mc-faint)}
.mc-wall-head{display:flex;align-items:center;justify-content:space-between;margin:16px 0 6px;font-size:12px;font-weight:600}
.mc-menu-mask{position:fixed;inset:0;z-index:35}
.mc-trash{border:1px solid var(--mc-border);border-radius:9px;max-height:190px;overflow-y:auto}
.mc-trash-item{display:flex;align-items:center;gap:8px;padding:6px 9px;border-bottom:1px solid var(--mc-border);font-size:11.5px}
.mc-trash-item:last-child{border-bottom:0}
.mc-trash-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#e8eaef)}
.mc-trash-actions{display:flex;gap:5px;flex:none}
.mc-trash-empty{padding:14px;text-align:center;font-size:11.5px;color:var(--mc-faint)}
.mc-item-who{font-size:10px;color:var(--mc-faint);max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none}
.mc-banner{font-size:11.5px;padding:6px 18px;display:flex;gap:8px;align-items:center;flex:none;border-bottom:1px solid var(--mc-border)}
.mc-banner-warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f0b429) 12%,transparent);color:var(--dsw-alias-state-warn-primary,#f0b429)}
.mc-banner-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f87171) 12%,transparent);color:var(--dsw-alias-state-error-primary,#f87171)}
.mc-toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:30;background:var(--dsw-alias-bg-overlay,var(--mc-surface-2));border:1px solid var(--mc-border-strong);border-radius:10px;padding:6px 14px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.35)}
.mc-link{color:var(--dsw-alias-brand-primary,#4d6bfe);cursor:pointer;text-decoration:underline;background:none;border:none;font:inherit;padding:0}

@keyframes mc-rot{to{transform:rotate(360deg)}}
@keyframes mc-slide{0%{left:-35%}100%{left:100%}}
.mc-spin{display:inline-block;width:11px;height:11px;border:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 26%,transparent);border-top-color:var(--dsw-alias-brand-primary,#4d6bfe);border-radius:50%;animation:mc-rot .8s linear infinite;vertical-align:-1px;margin-right:6px}
.mc-progress{position:relative;flex:none;height:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 8%,transparent);overflow:hidden}
.mc-progress-fill{position:absolute;left:0;top:0;bottom:0;background:var(--dsw-alias-brand-primary,#4d6bfe);transition:width .35s ease}
.mc-progress.is-indeterminate .mc-progress-fill{width:32%;animation:mc-slide 1.2s ease-in-out infinite}
.mc-item-status{font-size:10px;color:var(--mc-faint)}
.mc-caret{display:inline-block;font-size:8px;color:var(--mc-faint);transition:transform .15s;transform:translateY(-1px)}
.mc-caret.is-open{transform:rotate(90deg) translateX(1px)}
.mc-hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:40px 24px;text-align:center}
.mc-hero-icon{width:62px;height:62px;border-radius:20px;display:flex;align-items:center;justify-content:center;margin-bottom:4px;background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 10%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 22%,transparent);color:var(--dsw-alias-brand-primary,#4d6bfe)}
.mc-hero-title{font-size:15px;font-weight:600}
.mc-hero-desc{font-size:12.5px;color:var(--mc-faint);max-width:430px;line-height:1.75}
.mc-hero-actions{display:flex;gap:8px;margin-top:10px}
.mc-hero-tip{font-size:11px;color:var(--mc-faint);max-width:430px;line-height:1.75;margin-top:14px;padding-top:12px;border-top:1px dashed var(--mc-border)}

.mc-src{font-size:9.5px;border-radius:4px;padding:0 4px;border:1px solid var(--mc-border);color:var(--mc-faint);line-height:1.5}
.mc-src-wechat{color:#3eb575;border-color:color-mix(in srgb,#3eb575 40%,transparent)}
.mc-src-qq{color:#4d9bfe;border-color:color-mix(in srgb,#4d9bfe 40%,transparent)}
.mc-src-other{color:var(--dsw-alias-state-warn-primary,#f0b429);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#f0b429) 36%,transparent)}
.mc-compose-files{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.mc-file{position:relative;border:1px solid var(--mc-border);border-radius:8px;padding:4px 6px;font-size:10.5px;color:var(--mc-faint);display:flex;align-items:center;gap:6px;max-width:100%}
.mc-file img{width:40px;height:40px;object-fit:cover;border-radius:5px;display:block}
.mc-file button{position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;border:none;background:var(--dsw-alias-state-error-primary,#f87171);color:#fff;font-size:10px;line-height:1;cursor:pointer;padding:0}
.mc-compose textarea.mc-input{min-height:108px}
.mc-src-row{display:flex;gap:6px;margin-bottom:10px}
`

      // ---------- 基础 ----------

      function MailIcon (props) {
        var size = (props && props.size) || 16
        return h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.6,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          },
          h('rect', { x: 2.5, y: 5.5, width: 19, height: 13, rx: 2.5 }),
          h('path', { d: 'M3.4 7.4 12 12.9l8.6-5.5' }),
          h('path', { d: 'm14.6 16.2 1.6 1.6 3.1-3.1' }),
        )
      }

      function api (url, body) {
        var options = body
          ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
          : undefined
        return fetch(url, options).then(function (response) {
          return response.json()
        })
      }

      function statusLabel (value) {
        for (var i = 0; i < STATUS.length; i++) if (STATUS[i].value === value) return STATUS[i].label
        return value || ''
      }

      function sourceLabel (value) {
        return { email: '邮箱', wechat: '微信', qq: 'QQ', other: '其他' }[value] || ''
      }

      function pad (n) {
        return String(n).padStart(2, '0')
      }

      function toDate (value) {
        if (!value) return null
        var d = new Date(value)
        return isNaN(d.getTime()) ? null : d
      }

      function fmtDateTime (value) {
        var d = toDate(value)
        if (!d) return ''
        return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
      }

      function dateKey (date) {
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
      }

      function todayKey () {
        return dateKey(new Date())
      }

      function addDays (days) {
        var d = new Date()
        d.setDate(d.getDate() + days)
        return dateKey(d)
      }

      function stripDatePrefix (title) {
        return String(title || '').replace(/^\d{2}\/\d{2}\/\d{2}\s+/, '')
      }

      function queryString (filters, tab) {
        var parts = []
        if (filters.q) parts.push('q=' + encodeURIComponent(filters.q))
        if (filters.from) parts.push('from=' + encodeURIComponent(filters.from))
        if (filters.to) parts.push('to=' + encodeURIComponent(filters.to))
        if (tab) parts.push('status=' + encodeURIComponent(tab))
        if (filters.sort) parts.push('sort=' + encodeURIComponent(filters.sort))
        return parts.length ? '?' + parts.join('&') : ''
      }

      // ---------- 面板 ----------

      function MailPage (props) {
        var [summary, setSummary] = useState(null)
        var [cases, setCases] = useState([])
        var [selectedId, setSelectedId] = useState(null)
        var [detail, setDetail] = useState(null)
        var [loadingDetail, setLoadingDetail] = useState(false)
        var [filters, setFilters] = useState({ q: '', from: '', to: '', sort: 'activity' })
        var [tab, setTab] = useState('active')
        var [menuOpen, setMenuOpen] = useState(false)
        var [trashCases, setTrashCases] = useState([])
        var [range, setRange] = useState('all')
        var [reloadKey, setReloadKey] = useState(0)
        var [detailKey, setDetailKey] = useState(0)
        var [runBusy, setRunBusy] = useState(false)
        var [openBodies, setOpenBodies] = useState({})
        var [autoOpen, setAutoOpen] = useState(false)
        var [expandRec, setExpandRec] = useState({})
        var lastDoneRef = useRef(-1)
        var detailIdRef = useRef(0)
        var [toast, setToast] = useState('')
        var [error, setError] = useState('')
        var [settingsOpen, setSettingsOpen] = useState(false)
        var [form, setForm] = useState({ email: '', authCode: '', imapHost: 'imap.qiye.163.com', imapPort: 993, syncDays: 30, scheduleTime: '08:30', unreadOnly: true })
        var [formNote, setFormNote] = useState('')
        var [saving, setSaving] = useState(false)
        var [recAction, setRecAction] = useState('')
        var [recDetail, setRecDetail] = useState('')
        var [recNext, setRecNext] = useState('')
        var [recStatus, setRecStatus] = useState('')
        var [recAll, setRecAll] = useState(false)
        var [analyzing, setAnalyzing] = useState(false)
        var [composeOpen, setComposeOpen] = useState(false)
        var [composeMode, setComposeMode] = useState('create')
        var [draft, setDraft] = useState({ source: 'wechat', customer: '', title: '', text: '', files: [] })
        var [composeBusy, setComposeBusy] = useState(false)
        var fileInputRef = useRef(null)
        var toastTimer = useRef(null)
        var searchTimer = useRef(null)
        var [draftQ, setDraftQ] = useState('')

        var close = props && props.close
        var running = (summary && summary.running) || runBusy
        detailIdRef.current = detail && detail.case ? detail.case.id : 0

        var flash = useCallback(function (message) {
          setToast(message)
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(function () {
            setToast('')
          }, 2600)
        }, [])

        var loadSummary = useCallback(function () {
          return api('/mail/summary')
            .then(function (value) {
              if (value && value.ok) setSummary(value)
              return value
            })
            .catch(function () {
              setError('读不到面板状态：宿主没有响应')
            })
        }, [])

        useEffect(function () {
          loadSummary()
        }, [loadSummary])

        useEffect(
          function () {
            var cancelled = false
            api('/mail/cases' + queryString(filters, tab))
              .then(function (res) {
                if (cancelled) return
                if (!res.ok) {
                  setError(res.error || '读取列表失败')
                  return
                }
                setCases(res.cases || [])
                setSelectedId(function (current) {
                  var list = res.cases || []
                  for (var i = 0; i < list.length; i++) if (list[i].id === current) return current
                  return list.length ? list[0].id : null
                })
              })
              .catch(function () {
                if (!cancelled) setError('读取列表失败：宿主没有响应')
              })
            return function () {
              cancelled = true
            }
          },
          [filters.q, filters.from, filters.to, filters.sort, tab, reloadKey],
        )

        useEffect(
          function () {
            if (!selectedId) {
              setDetail(null)
              return undefined
            }
            var cancelled = false
            setLoadingDetail(true)
            api('/mail/case?id=' + selectedId)
              .then(function (res) {
                if (cancelled) return
                setDetail(res.ok ? res : null)
                setLoadingDetail(false)
              })
              .catch(function () {
                if (!cancelled) setLoadingDetail(false)
              })
            return function () {
              cancelled = true
            }
          },
          [selectedId, detailKey],
        )

        useEffect(
          function () {
            if (!running) return undefined
            var timer = setInterval(function () {
              api('/mail/summary')
                .then(function (value) {
                  if (!value || !value.ok) return
                  setSummary(value)
                  var run = value.run
                  // 一封一封冒出来：进度一变就刷新列表；正在看的那条也跟着刷新
                  if (run && run.done !== lastDoneRef.current) {
                    lastDoneRef.current = run.done
                    setReloadKey(function (k) {
                      return k + 1
                    })
                    if (run.caseId && detailIdRef.current === run.caseId) {
                      setDetailKey(function (k) {
                        return k + 1
                      })
                    }
                  }
                  if (!value.running) {
                    clearInterval(timer)
                    setRunBusy(false)
                    setReloadKey(function (k) {
                      return k + 1
                    })
                    setDetailKey(function (k) {
                      return k + 1
                    })
                    if (value.run && value.run.error) setError(value.run.error)
                  }
                })
                .catch(function () {})
            }, 1500)
            return function () {
              clearInterval(timer)
            }
          },
          [running],
        )

        useEffect(
          function () {
            return function () {
              if (toastTimer.current) clearTimeout(toastTimer.current)
              if (searchTimer.current) clearTimeout(searchTimer.current)
            }
          },
          [],
        )

        var setFilter = function (patch) {
          setFilters(function (current) {
            var next = {}
            for (var key in current) next[key] = current[key]
            for (var key2 in patch) next[key2] = patch[key2]
            return next
          })
        }

        var pickRange = function (kind) {
          setRange(kind)
          if (kind === 'all') setFilter({ from: '', to: '' })
          else if (kind === 'today') setFilter({ from: todayKey(), to: todayKey() })
          else if (kind === '7d') setFilter({ from: addDays(-6), to: todayKey() })
        }

        var doRun = function (days) {
          var backfill = typeof days === 'number' ? days : 0
          setError('')
          setRunBusy(true)
          setSettingsOpen(false)
          lastDoneRef.current = -1
          api('/mail/run', backfill ? { days: backfill } : {})
            .then(function (res) {
              setRunBusy(false)
              setReloadKey(function (k) {
                return k + 1
              })
              setDetailKey(function (k) {
                return k + 1
              })
              loadSummary()
              if (res.ok && res.run) {
                var head = backfill ? '补收完成' : '整理完成'
                var tail = res.run.skipped ? ' · 跳过 ' + res.run.skipped : ''
                flash(head + '：新 ' + res.run.created + ' · 合并 ' + res.run.merged + ' · 已译 ' + res.run.analyzed + tail)
              } else {
                setError(res.error || '整理失败')
              }
            })
            .catch(function () {
              setRunBusy(false)
              setError('整理失败：宿主没有响应')
            })
        }

        var analyzeCase = function () {
          if (!detail) return
          setAnalyzing(true)
          api('/mail/analyze', { caseId: detail.case.id })
            .then(function (res) {
              setAnalyzing(false)
              setDetailKey(function (k) {
                return k + 1
              })
              setReloadKey(function (k) {
                return k + 1
              })
              if (!res.ok) flash('整理失败：' + (res.error || '未知原因'))
              else if (res.failed) flash('翻译失败 ' + res.failed + ' 封，稍后再试')
              else flash('已整理 ' + res.analyzed + ' 封')
            })
            .catch(function () {
              setAnalyzing(false)
              flash('整理失败：宿主没有响应')
            })
        }

        var changeStatus = function (status) {
          if (!detail) return
          api('/mail/case/state', { id: detail.case.id, status })
            .then(function () {
              setDetailKey(function (k) {
                return k + 1
              })
              setReloadKey(function (k) {
                return k + 1
              })
              loadSummary()
              flash(
                status === 'done' ? '已移入「已完成」' : '状态改为「' + statusLabel(status) + '」',
              )
            })
            .catch(function () {
              flash('改状态失败')
            })
        }

        var removeCase = function () {
          if (!detail) return
          if (!window.confirm('删除后这个 Case 不再出现在列表里（数据仍在库中）。确定删除？')) return
          api('/mail/case/delete', { id: detail.case.id })
            .then(function () {
              setDetail(null)
              setReloadKey(function (k) {
                return k + 1
              })
              loadSummary()
              flash('已删除')
            })
            .catch(function () {
              flash('删除失败')
            })
        }

        var submitRecord = function () {
          if (!detail) return
          var action = recAction.trim()
          var currentStatus = detail.case.archivedAt ? 'done' : detail.case.status
          var statusChanged = !!recStatus && recStatus !== currentStatus
          if (!action && !statusChanged) {
            flash('写点「做了什么」，或者选个新状态')
            return
          }
          api('/mail/case/record', {
            id: detail.case.id,
            action:
              action ||
              (recStatus === 'done'
                ? '处理完了，移入「已完成」'
                : '状态改为「' + statusLabel(recStatus) + '」'),
            detail: recDetail.trim(),
            nextStep: recNext.trim(),
            status: statusChanged ? recStatus : '',
          })
            .then(function () {
              setRecAction('')
              setRecDetail('')
              setRecNext('')
              setRecStatus('')
              setDetailKey(function (k) {
                return k + 1
              })
              setReloadKey(function (k) {
                return k + 1
              })
              flash('记录已添加')
            })
            .catch(function () {
              flash('添加记录失败')
            })
        }

        var removeRecord = function (recordId) {
          api('/mail/record/delete', { id: recordId })
            .then(function () {
              setDetailKey(function (k) {
                return k + 1
              })
            })
            .catch(function () {
              flash('删除记录失败')
            })
        }

        // ---------- 手动新建 ----------

        var openCompose = function (mode) {
          var next = mode === 'append' ? 'append' : 'create'
          var source = 'wechat'
          if (next === 'append' && detail && detail.case && ['wechat', 'qq', 'other'].includes(detail.case.source)) {
            source = detail.case.source
          }
          setComposeMode(next)
          setDraft({ source: source, customer: '', title: '', text: '', files: [] })
          setComposeOpen(true)
        }

        var addFiles = function (fileList) {
          var list = Array.prototype.slice.call(fileList || [])
          if (!list.length) return
          var readers = list.map(function (file) {
            return new Promise(function (resolve) {
              var reader = new FileReader()
              reader.onload = function () {
                var result = String(reader.result || '')
                var comma = result.indexOf(',')
                resolve({
                  name: file.name || '粘贴图片-' + Date.now() + '.png',
                  mime: file.type || 'application/octet-stream',
                  size: file.size || 0,
                  data: comma >= 0 ? result.slice(comma + 1) : result,
                })
              }
              reader.onerror = function () {
                resolve(null)
              }
              reader.readAsDataURL(file)
            })
          })
          Promise.all(readers).then(function (items) {
            var good = items.filter(Boolean)
            if (!good.length) {
              flash('读取文件失败')
              return
            }
            setDraft(function (current) {
              var next = Object.assign({}, current)
              next.files = current.files.concat(good)
              return next
            })
          })
        }

        var onComposePaste = function (event) {
          var items = (event.clipboardData && event.clipboardData.items) || []
          var files = []
          for (var i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
              var file = items[i].getAsFile()
              if (file) files.push(file)
            }
          }
          if (files.length) {
            event.preventDefault()
            addFiles(files)
          }
        }

        var removeDraftFile = function (index) {
          setDraft(function (current) {
            var next = Object.assign({}, current)
            next.files = current.files.filter(function (_, i) {
              return i !== index
            })
            return next
          })
        }

        var saveCompose = function () {
          if (composeBusy) return
          var text = draft.text.trim()
          if (!text && !draft.files.length) {
            flash('写点内容，或者加一张图片')
            return
          }
          var isAppend = composeMode === 'append' && detail
          setComposeBusy(true)
          var url = isAppend ? '/mail/case/append' : '/mail/case/manual'
          var payload = isAppend
            ? { caseId: detail.case.id, source: draft.source, text: text, files: draft.files }
            : {
                source: draft.source,
                customer: draft.customer.trim(),
                title: draft.title.trim(),
                text: text,
                files: draft.files,
              }
          api(url, payload)
            .then(function (res) {
              setComposeBusy(false)
              if (!res.ok) {
                flash('保存失败：' + (res.error || '未知原因'))
                return
              }
              setComposeOpen(false)
              setReloadKey(function (k) {
                return k + 1
              })
              if (isAppend) {
                setDetailKey(function (k) {
                  return k + 1
                })
              } else {
                setSelectedId(res.caseId)
              }
              loadSummary()
              flash(isAppend ? '已追加，正在整理…' : '已创建，正在整理…')
            })
            .catch(function () {
              setComposeBusy(false)
              flash('保存失败：宿主没有响应')
            })
        }

        var splitMessage = function (messageId) {
          if (!window.confirm('把这封邮件拆成独立的事项？原 Case 会保留其余邮件。')) return
          api('/mail/case/split', { messageId: messageId })
            .then(function (res) {
              if (!res.ok) {
                flash(res.error || '拆分失败')
                return
              }
              setSelectedId(res.caseId)
              setReloadKey(function (k) {
                return k + 1
              })
              setDetailKey(function (k) {
                return k + 1
              })
              flash('已拆成新 Case')
            })
            .catch(function () {
              flash('拆分失败：宿主没有响应')
            })
        }

        var removeMessage = function (messageId) {
          if (!window.confirm('删除这条消息？（只删这一条，不影响邮件）')) return
          api('/mail/message/delete', { messageId: messageId })
            .then(function (res) {
              if (!res.ok) {
                flash(res.error || '删除失败')
                return
              }
              setDetailKey(function (k) {
                return k + 1
              })
              setReloadKey(function (k) {
                return k + 1
              })
              flash('已删除')
            })
            .catch(function () {
              flash('删除失败：宿主没有响应')
            })
        }

        var restoreCase = function () {
          if (!detail) return
          api('/mail/case/restore', { id: detail.case.id })
            .then(function () {
              setReloadKey(function (k) {
                return k + 1
              })
              setDetailKey(function (k) {
                return k + 1
              })
              loadSummary()
              flash('已恢复')
            })
            .catch(function () {
              flash('恢复失败')
            })
        }

        var purgeCase = function () {
          if (!detail) return
          if (!window.confirm('彻底删除？邮件、记录和附件都会删掉，无法恢复。')) return
          api('/mail/case/delete', { id: detail.case.id, hard: true })
            .then(function () {
              setDetail(null)
              setReloadKey(function (k) {
                return k + 1
              })
              loadSummary()
              flash('已彻底删除')
            })
            .catch(function () {
              flash('删除失败')
            })
        }

        var loadTrash = function () {
          api('/mail/cases?status=deleted')
            .then(function (res) {
              setTrashCases(res && res.ok ? res.cases || [] : [])
            })
            .catch(function () {
              setTrashCases([])
            })
        }

        var restoreTrash = function (id) {
          api('/mail/case/restore', { id: id })
            .then(function (res) {
              if (!res || !res.ok) return flash('恢复失败')
              loadTrash()
              loadSummary()
              setReloadKey(function (k) {
                return k + 1
              })
              flash('已恢复')
            })
            .catch(function () {
              flash('恢复失败：宿主没有响应')
            })
        }

        var purgeTrash = function (id) {
          if (!window.confirm('彻底删除？邮件、记录和附件都会删掉，无法恢复。')) return
          api('/mail/case/delete', { id: id, hard: true })
            .then(function (res) {
              if (!res || !res.ok) return flash('删除失败')
              loadTrash()
              loadSummary()
              setReloadKey(function (k) {
                return k + 1
              })
              flash('已彻底删除')
            })
            .catch(function () {
              flash('删除失败：宿主没有响应')
            })
        }

        var downloadByUrl = function (url, name) {
          var anchor = document.createElement('a')
          anchor.href = url
          anchor.download = name
          anchor.click()
        }

        var exportCase = function () {
          if (!detail) return
          downloadByUrl('/mail/export?id=' + detail.case.id, (detail.case.title || 'case') + '.md')
        }

        var exportAll = function () {
          downloadByUrl('/mail/export/all', 'mail-cases.json')
        }

        // ---------- 添加到对话 ----------

        var buildChatPrompt = function (d) {
          var c = d.case
          var lines = []
          lines.push('我在整理一条客户事项，有些地方想再弄清楚。')
          lines.push('')
          lines.push('【事项】' + c.title)
          lines.push('【客户】' + (c.customer || '—'))
          lines.push('【来源】' + (sourceLabel(c.source) || '邮箱'))
          lines.push('【状态】' + statusLabel(c.status))
          if (c.summary) lines.push('【摘要】' + c.summary)
          lines.push('')
          lines.push('【内容】')
          ;(d.messages || []).forEach(function (mail, index) {
            lines.push('')
            lines.push(
              '(' + (index + 1) + ') ' + (mail.subjectZh || mail.subject || '') + ' · ' + fmtDateTime(mail.receivedAt),
            )
            var body = String(mail.bodyText || '').slice(0, 1200)
            if (body) lines.push(body)
            if (mail.bodyZh) lines.push('中文：' + String(mail.bodyZh).slice(0, 800))
            if ((mail.attachments || []).length) {
              lines.push('附件：' + mail.attachments.map(function (item) { return item.name }).join('、'))
            }
          })
          if ((c.asks || []).length) {
            lines.push('')
            lines.push('【客户需求】')
            c.asks.forEach(function (ask, index) {
              lines.push(index + 1 + '. ' + ask.text + (ask.deadline ? '（截止 ' + ask.deadline + '）' : ''))
            })
          }
          lines.push('')
          lines.push('我的问题是：')
          return lines.join('\n')
        }

        var askInChat = function () {
          if (!detail) return
          var prompt = buildChatPrompt(detail)
          var opened = false
          try {
            opened = props && typeof props.askInChat === 'function' ? props.askInChat(prompt) === true : false
          } catch (err) {
            opened = false
          }
          if (opened) return
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt)
          } catch (err) {
            // 复制失败也不影响主流程
          }
          flash('已复制到剪贴板，去对话里粘贴')
        }

        var openSettings = function () {
          setFormNote('')
          api('/mail/settings').then(function (res) {
            if (!res.ok) {
              setFormNote(res.error || '读不到设置')
              return
            }
            setForm({
              email: res.email || '',
              authCode: '',
              imapHost: res.imapHost || 'imap.qiye.163.com',
              imapPort: res.imapPort || 993,
              syncDays: res.syncDays || 30,
              scheduleTime: res.scheduleTime || '08:30',
              unreadOnly: res.unreadOnly !== false,
            })
            setFormNote(res.hasAuthCode ? '授权码已保存；留空表示不修改。' : '还没填授权码。')
            setSettingsOpen(true)
            loadTrash()
          })
        }

        var testAccount = function () {
          setFormNote('正在连接邮箱…')
          api('/mail/account/test', form)
            .then(function (res) {
              if (res.ok) setFormNote('连接成功：收件箱共 ' + res.exists + ' 封。')
              else setFormNote('连接失败：' + (res.error || '未知原因'))
            })
            .catch(function () {
              setFormNote('连接失败：宿主没有响应')
            })
        }

        var saveSettings = function () {
          setSaving(true)
          api('/mail/settings', form)
            .then(function (res) {
              setSaving(false)
              if (!res.ok) {
                setFormNote('保存失败：' + (res.error || '未知原因'))
                return
              }
              setSettingsOpen(false)
              flash('设置已保存')
              loadSummary()
              setReloadKey(function (k) {
                return k + 1
              })
            })
            .catch(function () {
              setSaving(false)
              setFormNote('保存失败：宿主没有响应')
            })
        }

        var clearAll = function () {
          if (!window.confirm('清空所有 Case、邮件和处理记录？只保留邮箱设置。此操作不可撤销。')) return
          api('/mail/clear', {}).then(function (res) {
            if (!res.ok) {
              setFormNote('清空失败：' + (res.error || '未知原因'))
              return
            }
            setSettingsOpen(false)
            setDetail(null)
            setReloadKey(function (k) {
              return k + 1
            })
            loadSummary()
            flash('已清空')
          })
        }

        var onSearch = function (value) {
          setDraftQ(value)
          if (searchTimer.current) clearTimeout(searchTimer.current)
          searchTimer.current = setTimeout(function () {
            setFilter({ q: value })
          }, 260)
        }

        var toggleBody = function (id) {
          setOpenBodies(function (current) {
            var next = {}
            for (var key in current) next[key] = current[key]
            next[id] = !current[id]
            return next
          })
        }

        var clearFilters = function () {
          setDraftQ('')
          setRange('all')
          setFilters({ q: '', from: '', to: '', sort: 'activity' })
        }

        var hasFilter = !!(filters.q || filters.from || filters.to)

        // 库里到底有没有事项——不能用「当前筛选结果」判断，否则筛到空就把三栏整个换成空状态
        var dbEmpty = !!(summary && summary.counts && Number(summary.counts.open || 0) === 0)

        var tabCount = function (key) {
          var c = (summary && summary.counts) || {}
          if (key === 'active') return Number(c.active || 0)
          if (key === 'waiting') return Number(c.waiting || 0)
          return Number(c.doneRecent || 0)
        }

        // 行首时间用「最近活动」，否则按最近活动排序却显示首封日期，看起来像乱序
        var relTime = function (iso) {
          if (!iso) return ''
          var d = new Date(iso)
          if (isNaN(d.getTime())) return ''
          var dayOf = function (x) {
            return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
          }
          var diff = Math.round((dayOf(new Date()) - dayOf(d)) / 86400000)
          var hm =
            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
          if (diff <= 0) return '今天 ' + hm
          if (diff === 1) return '昨天'
          if (diff === 2) return '前天'
          if (diff < 7) return diff + ' 天前'
          return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0')
        }

        var togglePin = function (item, event) {
          if (event && event.stopPropagation) event.stopPropagation()
          var next = !item.pinned
          api('/mail/case/pin', { id: item.id, pinned: next })
            .then(function (res) {
              if (!res || !res.ok) {
                flash('置顶失败')
                return
              }
              setReloadKey(function (k) {
                return k + 1
              })
              if (detail && detail.case && detail.case.id === item.id) {
                setDetailKey(function (k) {
                  return k + 1
                })
              }
              flash(next ? '已置顶' : '已取消置顶')
            })
            .catch(function () {
              flash('置顶失败：宿主没有响应')
            })
        }

        var renderItem = function (item) {
          var who = item.customer || (item.fromAddrs || '').split(/[,;]/)[0] || ''
          return h(
            'div',
            {
              key: item.id,
              className:
                'mc-item is-' +
                (item.archivedAt ? 'done' : item.status || 'todo') +
                (detail && detail.case && detail.case.id === item.id ? ' is-active' : '') +
                (item.pinned ? ' is-pinned' : ''),
              onClick: function () {
                setSelectedId(item.id)
              },
            },
            h(
              'div',
              { className: 'mc-item-line' },
              h(
                'span',
                { className: 'mc-item-title', title: stripDatePrefix(item.title) },
                stripDatePrefix(item.title),
              ),
              h(
                'button',
                {
                  className: 'mc-pin',
                  title: item.pinned ? '取消置顶' : '置顶',
                  onClick: function (event) {
                    togglePin(item, event)
                  },
                },
                item.pinned ? '★' : '☆',
              ),
            ),
            h(
              'div',
              { className: 'mc-item-meta' },
              who ? h('span', { className: 'mc-item-who', title: who }, who) : null,
              h('span', { className: 'mc-count' }, relTime(item.lastActivityAt || item.primaryDate)),
              item.msgCount > 1 ? h('span', { className: 'mc-count' }, item.msgCount + ' 封') : null,
              item.source && item.source !== 'email'
                ? h('span', { className: 'mc-src mc-src-' + item.source }, sourceLabel(item.source))
                : null,
              item.pendingCount ? h('span', { className: 'mc-count' }, '整理中…') : null,
            ),
          )
        }

        var chip = function (kind, label) {
          return h(
            'button',
            {
              className: 'mc-chip-btn' + (range === kind ? ' is-on' : ''),
              onClick: function () {
                pickRange(kind)
              },
            },
            label,
          )
        }

        var renderMenu = function () {
          if (!menuOpen) return null
          return h(
            'div',
            null,
            h('div', {
              className: 'mc-menu-mask',
              onClick: function () {
                setMenuOpen(false)
              },
            }),
            h(
              'div',
              { className: 'mc-menu', onClick: function (event) { event.stopPropagation() } },
            h(
              'div',
              { className: 'mc-menu-row' },
              h('label', null, '时间'),
              h('div', { className: 'mc-chips' }, chip('all', '全部'), chip('today', '今天'), chip('7d', '近 7 天'), chip('custom', '自定义')),
            ),
            range === 'custom'
              ? h(
                  'div',
                  { className: 'mc-menu-row' },
                  h('label', null, '起止'),
                  h('input', {
                    className: 'mc-input',
                    type: 'date',
                    value: filters.from,
                    onChange: function (event) {
                      setFilter({ from: event.target.value })
                    },
                  }),
                  h('input', {
                    className: 'mc-input',
                    type: 'date',
                    value: filters.to,
                    onChange: function (event) {
                      setFilter({ to: event.target.value })
                    },
                  }),
                )
              : null,
            h(
              'div',
              { className: 'mc-menu-row' },
              h('label', null, '排序'),
              h(
                'select',
                {
                  className: 'mc-input',
                  value: filters.sort,
                  onChange: function (event) {
                    setFilter({ sort: event.target.value })
                  },
                },
                h('option', { value: 'activity' }, '最近活动'),
                h('option', { value: 'received' }, '收件日期'),
                h('option', { value: 'status' }, '状态'),
              ),
            ),
            hasFilter
              ? h(
                  'button',
                  {
                    className: 'mc-btn mc-btn-ghost mc-btn-sm',
                    onClick: function () {
                      clearFilters()
                      setMenuOpen(false)
                    },
                  },
                  '清除筛选',
                )
              : null,
            ),
          )
        }

        var TABS = [
          { key: 'active', label: '待我处理' },
          { key: 'waiting', label: '等待客户' },
          { key: 'done', label: '已完成' },
        ]

        var renderLeft = function () {
          // 页签已经是「分区」本身，列表里不再分组、不再折叠
          var cutoff = Date.now() - 30 * 86400000
          var listItems = cases
          if (tab === 'done' && !filters.q) {
            listItems = cases.filter(function (item) {
              var at = new Date(item.archivedAt || item.lastActivityAt || 0).getTime()
              return at >= cutoff
            })
          }

          var emptyText = hasFilter
            ? '这个筛选下没有事项'
            : tab === 'active'
              ? dbEmpty
                ? '还没有 Case'
                : '这一档空了'
              : tab === 'waiting'
                ? '没有等待客户的事项'
                : '最近 30 天没有完成的事项'

          return h(
            'aside',
            { className: 'mc-col mc-left' },
            h(
              'div',
              { className: 'mc-filters' },
              h(
                'div',
                { className: 'mc-search-row' },
                h('input', {
                  className: 'mc-input',
                  value: draftQ,
                  placeholder: '搜索主题 / 正文 / 客户',
                  onChange: function (event) {
                    onSearch(event.target.value)
                  },
                }),
                h(
                  'button',
                  {
                    className: 'mc-icon-btn' + (menuOpen || hasFilter ? ' is-on' : ''),
                    title: '筛选与排序',
                    onClick: function (event) {
                      event.stopPropagation()
                      setMenuOpen(function (v) {
                        return !v
                      })
                    },
                  },
                  '⋯',
                ),
              ),
              h(
                'div',
                { className: 'mc-tabs' },
                TABS.map(function (item) {
                  return h(
                    'button',
                    {
                      key: item.key,
                      className: 'mc-tab' + (tab === item.key ? ' is-on' : ''),
                      onClick: function () {
                        setTab(item.key)
                      },
                    },
                    item.label,
                    tabCount(item.key) ? h('em', null, String(tabCount(item.key))) : null,
                  )
                }),
              ),
              renderMenu(),
            ),
            h(
              'div',
              { className: 'mc-list' },
              listItems.length === 0
                ? h(
                    'div',
                    { className: 'mc-empty' },
                    h(MailIcon, { size: 22 }),
                    h('div', null, emptyText),
                    hasFilter
                      ? h(
                          'button',
                          { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: clearFilters },
                          '清除筛选',
                        )
                      : tab === 'active' && dbEmpty
                        ? h('div', null, '点右上「立即整理」')
                        : null,
                  )
                : listItems.map(renderItem),
              tab === 'done' && !filters.q && listItems.length
                ? h(
                    'div',
                    { className: 'mc-hint', style: { padding: '10px 6px', textAlign: 'center' } },
                    '只显示最近 30 天完成的；更早的搜主题能找到',
                  )
                : null,
            ),
          )
        }
        var renderMail = function (mail, index, total) {
          var open = !!openBodies[mail.id]
          var failed = mail.analysisState === 'failed'
          var pending = mail.analysisState !== 'done'
          var attachments = mail.attachments || []
          return h(
            'div',
            { key: mail.id, className: 'mc-mail' },
            h(
              'div',
              { className: 'mc-mail-title' },
              index === 0 && total > 1 ? h('span', { className: 'mc-mail-latest' }, '最新') : null,
              mail.subjectZh || mail.subject || '（无主题）',
            ),
            h(
              'div',
              { className: 'mc-mail-meta' },
              [mail.fromName, mail.fromAddr].filter(Boolean).join(' ') + ' · ' + fmtDateTime(mail.receivedAt),
              mail.source && mail.source !== ((detail && detail.case && detail.case.source) || 'email')
                ? h(
                    'span',
                    { className: 'mc-src mc-src-' + mail.source, style: { marginLeft: '6px' } },
                    sourceLabel(mail.source),
                  )
                : null,
              mail.kind === 'text'
                ? h(
                    'button',
                    {
                      className: 'mc-link',
                      style: { fontSize: '10px', marginLeft: '8px' },
                      onClick: function () {
                        removeMessage(mail.id)
                      },
                    },
                    '删',
                  )
                : null,
              total > 1
                ? h(
                    'button',
                    {
                      className: 'mc-link',
                      style: { fontSize: '10px', marginLeft: '8px' },
                      onClick: function () {
                        splitMessage(mail.id)
                      },
                    },
                    '拆出去',
                  )
                : null,
            ),
            mail.subjectZh && mail.subject && mail.subjectZh !== mail.subject
              ? h('div', { className: 'mc-mail-orig' }, mail.subject)
              : null,
            h('div', { className: 'mc-mail-body' + (open ? ' is-open' : '') }, mail.bodyText || '（空）'),
            (mail.bodyText || '').length > 700
              ? h(
                  'button',
                  {
                    className: 'mc-btn mc-btn-ghost mc-btn-sm',
                    style: { marginTop: '4px' },
                    onClick: function () { toggleBody(mail.id) },
                  },
                  open ? '收起' : '展开全文',
                )
              : null,
            attachments.length
              ? h(
                  'div',
                  { className: 'mc-compose-files', style: { marginTop: '8px' } },
                  attachments.map(function (item) {
                    var isImage = /^image\//.test(item.mime || '')
                    var src = '/mail/file?id=' + item.id
                    return h(
                      'a',
                      {
                        key: item.id,
                        className: 'mc-file',
                        href: src,
                        target: '_blank',
                        rel: 'noreferrer',
                        style: { textDecoration: 'none', color: 'inherit' },
                      },
                      isImage ? h('img', { src: src, alt: item.name }) : null,
                      h('span', null, item.name || '附件'),
                    )
                  }),
                )
              : null,
            mail.bodyZh
              ? h(
                  'div',
                  { className: 'mc-zh' },
                  h('span', { className: 'mc-zh-label' }, '中文'),
                  h('div', { className: 'mc-zh-text' }, mail.bodyZh),
                )
              : pending
                ? h('div', { className: 'mc-pending' }, failed ? '翻译失败：' + (mail.analysisError || '未知原因') : '还没翻译，点上面「整理」补上')
                : null,
          )
        }

        var renderAsks = function (caseRow) {
          var asks = caseRow.asks || []
          if (!asks.length) {
            return h('div', { className: 'mc-placeholder' }, '整理完成后，客户需要做的事会逐条列在这里。')
          }
          return asks.map(function (ask, index) {
            return h(
              'div',
              { key: index, className: 'mc-ask' },
              h('span', { className: 'mc-ask-n' }, index + 1),
              h(
                'div',
                { className: 'mc-ask-text' },
                ask.text,
                h(
                  'div',
                  { className: 'mc-ask-meta' },
                  ask.owner === 'customer' ? h('span', { className: 'mc-tag-s' }, '客户侧') : null,
                  ask.deadline ? h('span', { className: 'mc-tag-s mc-tag-warn' }, '截止 ' + ask.deadline) : null,
                ),
              ),
            )
          })
        }

        var renderSuggestions = function (caseRow) {
          var items = caseRow.suggestions || []
          if (!items.length) return h('div', { className: 'mc-placeholder' }, '整理完成后，这里给出处理建议与理由。')
          return items.map(function (item, index) {
            return h(
              'div',
              { key: index, className: 'mc-ask' },
              h('span', { className: 'mc-ask-n' }, index + 1),
              h(
                'div',
                { className: 'mc-ask-text' },
                item.text,
                item.why ? h('div', { className: 'mc-rec-detail' }, item.why) : null,
              ),
            )
          })
        }

        var renderMid = function () {
          if (!detail) {
            if (loadingDetail) {
              return h('div', { className: 'mc-hero' }, h('span', { className: 'mc-spin' }), h('div', { className: 'mc-hero-desc' }, '读取中…'))
            }
            if (!summary || !summary.configured) {
              return h(
                'div',
                { className: 'mc-hero' },
                h('div', { className: 'mc-hero-icon' }, h(MailIcon, { size: 26 })),
                h('div', { className: 'mc-hero-title' }, '还没有接入邮箱'),
                h('div', { className: 'mc-hero-desc' }, '点「去设置」填邮箱地址和客户端授权码，就能开始整理。'),
                h(
                  'div',
                  { className: 'mc-hero-actions' },
                  h('button', { className: 'mc-btn mc-btn-primary', onClick: openSettings }, '去设置'),
                ),
              )
            }
            if (cases.length === 0 && hasFilter) {
              return h(
                'div',
                { className: 'mc-hero' },
                h('div', { className: 'mc-hero-icon' }, h(MailIcon, { size: 26 })),
                h('div', { className: 'mc-hero-title' }, '当前筛选下没有事项'),
                h('div', { className: 'mc-hero-desc' }, '换个状态或日期试试，也可以直接清掉筛选。'),
                h(
                  'div',
                  { className: 'mc-hero-actions' },
                  h('button', { className: 'mc-btn mc-btn-ghost', onClick: clearFilters }, '清除筛选'),
                ),
              )
            }
            return h(
              'div',
              { className: 'mc-hero' },
              h('div', { className: 'mc-hero-icon' }, h(MailIcon, { size: 26 })),
              h('div', { className: 'mc-hero-title' }, '选一条事项开始'),
              h('div', { className: 'mc-hero-desc' }, '左边点开任意 Case，这里会显示邮件原文、中文全文、客户需求和处理建议。'),
            )
          }

          var caseRow = detail.case
          var messages = detail.messages || []
          var pendingCount = messages.filter(function (m) { return m.analysisState !== 'done' }).length

          return h(
            'section',
            { className: 'mc-col mc-mid' },
            h(
              'div',
              { className: 'mc-detail' },
              h(
                'div',
                { className: 'mc-detail-head' },
                h('h2', { className: 'mc-detail-title' }, caseRow.title),
                h(
                  'div',
                  { className: 'mc-detail-sub' },
                  h('span', null, caseRow.customer || '未知客户'),
                  h('span', { className: 'mc-src mc-src-' + (caseRow.source || 'email') }, sourceLabel(caseRow.source || 'email')),
                  h('span', null, messages.length + ' 封'),
                  h('span', null, fmtDateTime(caseRow.lastActivityAt)),
                  h('span', { className: 'mc-tag-s' }, statusLabel(caseRow.status)),
                  pendingCount
                    ? h(
                        'button',
                        { className: 'mc-link', style: { fontSize: '11px' }, disabled: analyzing, onClick: analyzeCase },
                        analyzing ? '整理中…' : '有 ' + pendingCount + ' 封未整理，点此整理',
                      )
                    : null,
                ),
              ),
              h(
                'div',
                { className: 'mc-detail-body' },
                caseRow.summary ? h('div', { className: 'mc-sec' }, h('div', { className: 'mc-summary' }, caseRow.summary)) : null,
                h(
                  'div',
                  { className: 'mc-sec' },
                  h(
                    'div',
                    { className: 'mc-sec-head' },
                    h('span', { className: 'mc-sec-no' }, '1'),
                    h('span', { className: 'mc-sec-title' }, '邮件内容'),
                  ),
                  messages.length
                    ? messages
                        .slice()
                        .sort(function (a, b) {
                          return new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime()
                        })
                        .map(function (mail, index) {
                          return renderMail(mail, index, messages.length)
                        })
                    : h('div', { className: 'mc-placeholder' }, '这封邮件没有取到正文'),
                ),
                h(
                  'div',
                  { className: 'mc-sec' },
                  h(
                    'div',
                    { className: 'mc-sec-head' },
                    h('span', { className: 'mc-sec-no' }, '2'),
                    h('span', { className: 'mc-sec-title' }, '客户需要我们做什么'),
                  ),
                  renderAsks(caseRow),
                ),
                h(
                  'div',
                  { className: 'mc-sec' },
                  h(
                    'div',
                    { className: 'mc-sec-head' },
                    h('span', { className: 'mc-sec-no' }, '3'),
                    h('span', { className: 'mc-sec-title' }, '处理建议'),
                  ),
                  renderSuggestions(caseRow),
                ),
              ),
              h(
                'div',
                { className: 'mc-detail-foot' },
                caseRow.deletedAt
                  ? h('button', { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: restoreCase }, '恢复')
                  : null,
                h(
                  'button',
                  {
                    className: 'mc-btn mc-btn-ghost mc-btn-sm',
                    onClick: function () {
                      openCompose('append')
                    },
                  },
                  '追加消息',
                ),
                h('button', { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: askInChat }, '添加到对话'),
                h('button', { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: exportCase }, '导出'),
                h('span', { className: 'mc-spacer' }),
                caseRow.deletedAt
                  ? h('button', { className: 'mc-btn mc-btn-danger mc-btn-sm', onClick: purgeCase }, '彻底删除')
                  : h('button', { className: 'mc-btn mc-btn-danger mc-btn-sm', onClick: removeCase }, '删除'),
              ),
            ),
          )
        }

        var renderRight = function () {
          if (!detail) return h('aside', { className: 'mc-col mc-right' })
          var caseRow = detail.case
          var records = detail.records || []
          // 手工记录和系统流水分开：流水默认折叠成一行，右栏才不会被「收到邮件」刷屏。
          var isAutoRec = function (record) {
            return record.kind === 'email' || record.kind === 'status'
          }
          var manualRecords = records.filter(function (record) {
            return !isAutoRec(record)
          })
          var autoRecords = records.filter(isAutoRec)
          var emailCount = autoRecords.filter(function (record) {
            return record.kind === 'email'
          }).length
          var statusCount = autoRecords.length - emailCount
          var MANUAL_IN_COLUMN = 3
          var hiddenManual = Math.max(0, manualRecords.length - MANUAL_IN_COLUMN)
          var visibleRecords = autoOpen
            ? records
            : hiddenManual > 0
              ? manualRecords.slice(0, MANUAL_IN_COLUMN)
              : manualRecords
          var renderRecord = function (record) {
            var auto = isAutoRec(record)
            var open = !!expandRec[record.id]
            return h(
              'div',
              { key: record.id, className: 'mc-rec' + (auto ? ' is-auto' : '') + (open ? ' is-open' : '') },
              h(
                'div',
                { className: 'mc-rec-head' },
                h('span', { className: 'mc-rec-kind mc-kind-' + record.kind }),
                h('span', null, relTime(record.at)),
                h('span', { className: 'mc-spacer' }),
                h(
                  'button',
                  {
                    className: 'mc-link mc-del',
                    style: { fontSize: '10px' },
                    onClick: function () {
                      removeRecord(record.id)
                    },
                  },
                  '删',
                ),
              ),
              h(
                'div',
                {
                  className: 'mc-rec-action',
                  onClick: function () {
                    var next = Object.assign({}, expandRec)
                    next[record.id] = !next[record.id]
                    setExpandRec(next)
                  },
                },
                record.action,
              ),
              record.detail ? h('div', { className: 'mc-rec-detail' }, record.detail) : null,
              record.nextStep ? h('div', { className: 'mc-rec-next' }, '下一步：' + record.nextStep) : null,
            )
          }
          return h(
            'aside',
            { className: 'mc-col mc-right' },
            h(
              'div',
              { className: 'mc-side' },
              h(
                'div',
                { className: 'mc-status-pill is-' + (caseRow.archivedAt ? 'done' : caseRow.status) },
                h('span', { className: 'mc-status-dot' }),
                statusLabel(caseRow.archivedAt ? 'done' : caseRow.status),
              ),
              h(
                'div',
                { style: { marginTop: '8px' } },
                h('div', { className: 'mc-kv' }, h('span', null, '客户'), h('span', null, caseRow.customer || '—')),
                h('div', { className: 'mc-kv' }, h('span', null, '最近活动'), h('span', null, fmtDateTime(caseRow.lastActivityAt))),
                h('div', { className: 'mc-kv' }, h('span', null, '邮件 / 记录'), h('span', null, (detail.messages || []).length + ' / ' + records.length)),
              ),
            ),
            h(
              'div',
              { className: 'mc-side mc-side-records' },
              h(
                'div',
                { className: 'mc-rec-head-row' },
                h('div', { className: 'mc-side-title' }, '处理记录'),
                h('span', { className: 'mc-spacer' }),
                records.length > 6
                  ? h(
                      'button',
                      {
                        className: 'mc-link',
                        style: { fontSize: '10.5px' },
                        onClick: function () {
                          setRecAll(true)
                        },
                      },
                      '全部 ' + records.length + ' 条',
                    )
                  : null,
              ),
              h(
                'div',
                { className: 'mc-rec-list' },
                records.length === 0
                  ? h('div', { className: 'mc-empty-rec' }, '还没有记录')
                  : visibleRecords.length === 0
                    ? h('div', { className: 'mc-empty-rec' }, '还没有手动记录', h('br'), '系统流水收在下面，点开可以看')
                    : visibleRecords.map(renderRecord),
              ),
              autoRecords.length
                ? h(
                    'div',
                    { className: 'mc-flow-row' },
                    h(
                      'button',
                      { className: 'mc-flow-btn', onClick: function () { setAutoOpen(!autoOpen) } },
                      h('span', null, autoOpen ? '▾' : '▸'),
                      h('b', null, '自动流水 ' + autoRecords.length + ' 条'),
                      h('i', null, '收信 ' + emailCount + ' · 状态 ' + statusCount),
                      h('span', { className: 'mc-spacer' }),
                      h('span', null, autoOpen ? '收起' : '展开'),
                    ),
                  )
                : null,
            ),
            h(
              'div',
              { className: 'mc-form' },
              h('div', { className: 'mc-side-title' }, '添加记录'),
              h('textarea', {
                className: 'mc-input',
                placeholder: '做了什么（只改状态时可留空）',
                value: recAction,
                onChange: function (event) { setRecAction(event.target.value) },
              }),
              h('input', {
                className: 'mc-input',
                placeholder: '怎么处理的（可选）',
                value: recDetail,
                onChange: function (event) { setRecDetail(event.target.value) },
              }),
              h('input', {
                className: 'mc-input',
                placeholder: '下一步（可选）',
                value: recNext,
                onChange: function (event) { setRecNext(event.target.value) },
              }),
              h(
                'select',
                {
                  className: 'mc-input',
                  value: recStatus,
                  onChange: function (event) { setRecStatus(event.target.value) },
                },
                h('option', { value: '' }, '状态不变'),
                STATUS.map(function (item) {
                  return h('option', { key: item.value, value: item.value }, '改为「' + item.label + '」')
                }),
              ),
              h('button', { className: 'mc-btn mc-btn-primary', onClick: submitRecord }, '保存记录'),
            ),
            recAll
              ? h(
                  'div',
                  {
                    className: 'mc-overlay',
                    onClick: function (event) {
                      if (event.target === event.currentTarget) setRecAll(false)
                    },
                  },
                  h(
                    'div',
                    { className: 'mc-modal' },
                    h('h3', null, '全部记录 · ' + records.length + ' 条'),
                    h('div', { className: 'mc-all-list' }, records.map(renderRecord)),
                    h(
                      'div',
                      { className: 'mc-modal-foot' },
                      h(
                        'button',
                        { className: 'mc-btn mc-btn-ghost', onClick: function () { setRecAll(false) } },
                        '关闭',
                      ),
                    ),
                  ),
                )
              : null,
          )
        }

        var renderSettings = function () {
          if (!settingsOpen) return null
          return h(
            'div',
            {
              className: 'mc-overlay',
              onClick: function (event) {
                if (event.target === event.currentTarget) setSettingsOpen(false)
              },
            },
            h(
              'div',
              { className: 'mc-modal' },
              h('h3', null, '邮箱设置'),
              h('p', { className: 'mc-hint' }, '网易企业邮箱要用「客户端授权码」，不是登录密码：网页端 → 设置 → 账户与安全 → 客户端设置 → 生成授权码。'),
              h(
                'div',
                { className: 'mc-field' },
                h('label', null, '邮箱地址'),
                h('input', {
                  className: 'mc-input',
                  value: form.email,
                  placeholder: 'you@company.com',
                  onChange: function (event) { setForm(Object.assign({}, form, { email: event.target.value })) },
                }),
              ),
              h(
                'div',
                { className: 'mc-field' },
                h('label', null, '客户端授权码'),
                h('input', {
                  className: 'mc-input',
                  type: 'password',
                  value: form.authCode,
                  placeholder: '留空表示不修改',
                  onChange: function (event) { setForm(Object.assign({}, form, { authCode: event.target.value })) },
                }),
              ),
              h(
                'label',
                { className: 'mc-check' },
                h('input', {
                  type: 'checkbox',
                  checked: form.unreadOnly,
                  onChange: function (event) { setForm(Object.assign({}, form, { unreadOnly: event.target.checked })) },
                }),
                h('span', null, '只整理未读的邮件；已读的一律不建新 Case，只有能并进已有事项时才收'),
              ),
              h(
                'div',
                { className: 'mc-row' },
                h(
                  'div',
                  { className: 'mc-field' },
                  h('label', null, '每天整理时间'),
                  h('input', {
                    className: 'mc-input',
                    type: 'time',
                    value: form.scheduleTime,
                    onChange: function (event) { setForm(Object.assign({}, form, { scheduleTime: event.target.value })) },
                  }),
                ),
                h(
                  'div',
                  { className: 'mc-field' },
                  h('label', null, '同步范围（天）'),
                  h('input', {
                    className: 'mc-input',
                    type: 'number',
                    value: form.syncDays,
                    onChange: function (event) { setForm(Object.assign({}, form, { syncDays: Number(event.target.value) || 30 })) },
                  }),
                ),
              ),
              h(
                'div',
                { className: 'mc-row' },
                h(
                  'div',
                  { className: 'mc-field' },
                  h('label', null, 'IMAP 服务器'),
                  h('input', {
                    className: 'mc-input',
                    value: form.imapHost,
                    onChange: function (event) { setForm(Object.assign({}, form, { imapHost: event.target.value })) },
                  }),
                ),
                h(
                  'div',
                  { className: 'mc-field' },
                  h('label', null, '端口'),
                  h('input', {
                    className: 'mc-input',
                    type: 'number',
                    value: form.imapPort,
                    onChange: function (event) { setForm(Object.assign({}, form, { imapPort: Number(event.target.value) || 993 })) },
                  }),
                ),
              ),
              h('p', { className: 'mc-hint' }, formNote),
              h(
                'div',
                { className: 'mc-danger-row', style: { borderColor: 'var(--mc-border)' } },
                h(
                  'div',
                  null,
                  '补收漏掉的邮件',
                  h('span', { className: 'mc-hint', style: { display: 'block', marginTop: '2px' } }, '不管已读未读，把这个时间范围内库里还没有的邮件都收进来。'),
                ),
                h(
                  'div',
                  { style: { display: 'flex', gap: '6px', flexShrink: 0 } },
                  h('button', { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: function () { doRun(3) } }, '最近 3 天'),
                  h('button', { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: function () { doRun(7) } }, '最近 7 天'),
                ),
              ),
              h(
                'div',
                { className: 'mc-danger-row', style: { borderColor: 'var(--mc-border)' } },
                h('div', null, '导出全部数据（JSON 备份）'),
                h('button', { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: exportAll }, '导出'),
              ),
              h(
                'div',
                { className: 'mc-wall-head' },
                h('span', null, '回收站'),
                h('span', { className: 'mc-hint', style: { margin: 0 } }, trashCases.length + ' 条'),
              ),
              h(
                'div',
                { className: 'mc-trash' },
                trashCases.length === 0
                  ? h('div', { className: 'mc-trash-empty' }, '空的。删掉的 Case 会先放这里。')
                  : trashCases.map(function (item) {
                      return h(
                        'div',
                        { key: item.id, className: 'mc-trash-item' },
                        h('span', { className: 'mc-trash-title', title: item.title }, stripDatePrefix(item.title)),
                        h(
                          'div',
                          { className: 'mc-trash-actions' },
                          h(
                            'button',
                            { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: function () { restoreTrash(item.id) } },
                            '恢复',
                          ),
                          h(
                            'button',
                            { className: 'mc-btn mc-btn-danger mc-btn-sm', onClick: function () { purgeTrash(item.id) } },
                            '彻底删除',
                          ),
                        ),
                      )
                    }),
              ),
              h(
                'div',
                { className: 'mc-danger-row' },
                h('div', null, '清空所有 Case 与邮件（保留邮箱设置）'),
                h('button', { className: 'mc-btn mc-btn-danger mc-btn-sm', onClick: clearAll }, '清空'),
              ),
              h(
                'div',
                { className: 'mc-modal-foot' },
                h('button', { className: 'mc-btn mc-btn-ghost', onClick: testAccount }, '测试连接'),
                h('button', { className: 'mc-btn mc-btn-ghost', onClick: function () { setSettingsOpen(false) } }, '取消'),
                h('button', { className: 'mc-btn mc-btn-primary', disabled: saving, onClick: saveSettings }, saving ? '保存中…' : '保存'),
              ),
            ),
          )
        }

        var renderCompose = function () {
          if (!composeOpen) return null
          var sources = [
            { value: 'wechat', label: '微信' },
            { value: 'qq', label: 'QQ' },
            { value: 'other', label: '其他' },
          ]
          return h(
            'div',
            {
              className: 'mc-overlay',
              onClick: function (event) {
                if (event.target === event.currentTarget) setComposeOpen(false)
              },
            },
            h(
              'div',
              { className: 'mc-modal mc-compose' },
              h('h3', null, composeMode === 'append' ? '追加到这条事项' : '新建事项'),
              h(
                'p',
                { className: 'mc-hint' },
                composeMode === 'append'
                  ? detail && detail.case
                    ? '客户在这条事项之后又通过微信/QQ 说了什么？追加进来会接在邮件后面，来源单独标注。'
                    : ''
                  : '微信 / QQ 里的客户问题也能收进来：粘聊天记录、粘图片，来源会标在左边列表上。',
              ),
              h(
                'div',
                { className: 'mc-src-row' },
                sources.map(function (item) {
                  return h(
                    'button',
                    {
                      key: item.value,
                      className: 'mc-chip-btn' + (draft.source === item.value ? ' is-on' : ''),
                      onClick: function () {
                        setDraft(Object.assign({}, draft, { source: item.value }))
                      },
                    },
                    item.label,
                  )
                }),
              ),
              composeMode === 'append'
                ? null
                : h(
                    'div',
                    { className: 'mc-field' },
                    h('label', null, '客户 / 联系人'),
                    h('input', {
                      className: 'mc-input',
                      value: draft.customer,
                      placeholder: '张三 / 某公司',
                      onChange: function (event) {
                        setDraft(Object.assign({}, draft, { customer: event.target.value }))
                      },
                    }),
                  ),
              composeMode === 'append'
                ? null
                : h(
                    'div',
                    { className: 'mc-field' },
                    h('label', null, '标题'),
                    h('input', {
                      className: 'mc-input',
                      value: draft.title,
                      placeholder: '留空自动取内容前 40 字',
                      onChange: function (event) {
                        setDraft(Object.assign({}, draft, { title: event.target.value }))
                      },
                    }),
                  ),
              h(
                'div',
                { className: 'mc-field' },
                h('label', null, '内容'),
                h('textarea', {
                  className: 'mc-input',
                  value: draft.text,
                  placeholder: '粘贴聊天记录；也可以直接 Ctrl+V 粘图片',
                  onPaste: onComposePaste,
                  onChange: function (event) {
                    setDraft(Object.assign({}, draft, { text: event.target.value }))
                  },
                }),
              ),
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                h(
                  'button',
                  {
                    className: 'mc-btn mc-btn-ghost mc-btn-sm',
                    onClick: function () {
                      if (fileInputRef.current) fileInputRef.current.click()
                    },
                  },
                  '+ 图片 / 附件',
                ),
                h('input', {
                  type: 'file',
                  multiple: true,
                  ref: fileInputRef,
                  style: { display: 'none' },
                  onChange: function (event) {
                    addFiles(event.target.files)
                    event.target.value = ''
                  },
                }),
                h(
                  'span',
                  { className: 'mc-hint', style: { margin: 0 } },
                  draft.files.length ? draft.files.length + ' 个文件' : '单个 ≤ 12MB',
                ),
              ),
              draft.files.length
                ? h(
                    'div',
                    { className: 'mc-compose-files' },
                    draft.files.map(function (file, index) {
                      var isImage = /^image\//.test(file.mime || '')
                      return h(
                        'div',
                        { key: index, className: 'mc-file' },
                        isImage
                          ? h('img', { src: 'data:' + file.mime + ';base64,' + file.data, alt: file.name })
                          : null,
                        h('span', null, file.name),
                        h(
                          'button',
                          {
                            onClick: function () {
                              removeDraftFile(index)
                            },
                          },
                          '×',
                        ),
                      )
                    }),
                  )
                : null,
              h(
                'div',
                { className: 'mc-modal-foot' },
                h('button', { className: 'mc-btn mc-btn-ghost', onClick: function () { setComposeOpen(false) } }, '取消'),
                h(
                  'button',
                  { className: 'mc-btn mc-btn-primary', disabled: composeBusy, onClick: saveCompose },
                  composeBusy ? '保存中…' : '保存',
                ),
              ),
            ),
          )
        }

        var renderHero = function () {
          var configured = !!(summary && summary.configured)
          return h(
            'div',
            { className: 'mc-hero' },
            h('div', { className: 'mc-hero-icon' }, h(MailIcon, { size: 28 })),
            h('div', { className: 'mc-hero-title' }, configured ? '还没有需要整理的邮件' : '先接入你的客户邮箱'),
            h(
              'div',
              { className: 'mc-hero-desc' },
              configured
                ? '到设定时间会自动整理未读邮件，也可以随时手动整理一次。整理好的事项会出现在左边，点开就是中文全文、需求清单和处理建议。'
                : '填网易企业邮箱的地址与「客户端授权码」，之后每天的未读邮件会自动整理成可跟进的事项。',
            ),
            h(
              'div',
              { className: 'mc-hero-actions' },
              configured
                ? h('button', { className: 'mc-btn mc-btn-primary', disabled: running, onClick: doRun }, running ? '整理中…' : '立即整理')
                : null,
              h('button', { className: 'mc-btn mc-btn-ghost', onClick: openSettings }, configured ? '设置' : '去设置'),
            ),
            h(
              'div',
              { className: 'mc-hero-tip' },
              configured
                ? '只收未读的邮件：你留着未读的，都是要新建事项的。已读的不再建新 Case，只有能并进已有事项时才收。整理时一封一封出现，不用等全部跑完。'
                : '授权码在邮箱网页端「设置 → 账户与安全 → 客户端设置」生成，不是登录密码。',
            ),
          )
        }

        var lastRunText = ''
        if (summary && summary.lastRunAt) {
          lastRunText = fmtDateTime(summary.lastRunAt) + (summary.lastResult ? ' · ' + summary.lastResult : '')
        } else {
          lastRunText = '还没有整理过'
        }

        var run = summary && summary.run
        // 注意：这里看的是「库里有没有数据」，不是「当前筛选结果」。
        // 之前用 cases.length 判断，导致筛到空就把整个三栏换成空状态，连筛选器都没了。
        var showHero = dbEmpty && !filters.q && !filters.from && !filters.to && !running

        var progressText = lastRunText
        if (running) {
          if (run && run.steps) {
            progressText = '整理中 ' + run.done + '/' + run.steps + (run.current ? ' · ' + run.current : '')
          } else {
            progressText = (run && run.phase ? run.phase : '整理中') + '…'
          }
        }
        var progressPercent = run && run.steps ? Math.round((run.done / run.steps) * 100) : 32

        var banner = null
        if (summary && summary.storage && !summary.storage.ok) {
          banner = h('div', { className: 'mc-banner mc-banner-error' }, '数据库不可用：' + summary.storage.error)
        } else if (summary && summary.configured && summary.lastError) {
          banner = h('div', { className: 'mc-banner mc-banner-warn' }, '上次整理失败：' + summary.lastError)
        } else if (summary && !summary.configured) {
          banner = h('div', { className: 'mc-banner mc-banner-warn' }, '还没有接入邮箱，点右上「设置」开始。')
        }

        return h(
          'div',
          { className: 'mc-root' },
          h('style', null, CSS),
          h(
            'header',
            { className: 'mc-header' },
            h('span', { className: 'mc-name' }, '客户邮件'),
            h('span', { className: 'mc-badge' }, (summary && summary.counts ? summary.counts.open : 0) + ' 未完成'),
            h(
              'span',
              { className: 'mc-lastrun', title: lastRunText },
              running ? h('span', null, h('span', { className: 'mc-spin' }), progressText) : lastRunText,
            ),
            h('span', { className: 'mc-spacer' }),
            h(
              'button',
              { className: 'mc-btn mc-btn-primary', disabled: running || !!(summary && !summary.configured), onClick: doRun },
              running ? '整理中…' : '立即整理',
            ),
            h('button', { className: 'mc-btn mc-btn-ghost', onClick: function () { openCompose('create') } }, '+ 新建'),
            h('button', { className: 'mc-btn mc-btn-ghost', onClick: openSettings }, '设置'),
            close ? h('button', { className: 'mc-btn mc-btn-ghost', onClick: close }, '返回对话') : null,
          ),
          running
            ? h(
                'div',
                { className: 'mc-progress' + (run && run.steps ? '' : ' is-indeterminate') },
                h('div', { className: 'mc-progress-fill', style: { width: progressPercent + '%' } }),
              )
            : null,
          banner,
          error
            ? h(
                'div',
                { className: 'mc-banner mc-banner-error' },
                h('span', null, error),
                h('button', { className: 'mc-link', onClick: function () { setError('') } }, '知道了'),
              )
            : null,
          showHero ? renderHero() : h('div', { className: 'mc-body' }, renderLeft(), renderMid(), renderRight()),
          renderSettings(),
          renderCompose(),
          toast ? h('div', { className: 'mc-toast' }, toast) : null,
        )
      }

      var name = 'mail-cases'
      var inject = ['slots']

      function apply (ctx) {
        try {
          ctx.slots.inject('sidebar.panellist', function () {
            return ctx.slots.register(
              { name: 'sidebar.panellist', id: PANEL_ID, order: 45, label: '客户邮件' },
              MailIcon,
            )
          })
        } catch (err) {
          console.warn('[mail-cases] 注册侧栏入口失败:', err)
        }

        try {
          ctx.slots.inject('main', function () {
            return ctx.slots.register(
              {
                name: 'main',
                key: PANEL_ID,
                label: '客户邮件',
                inject: function () {
                  return {
                    // 把事项内容预填进「新对话」的输入框，用户补一句问题就能发
                    askInChat: function (prompt) {
                      try {
                        var ui = (ctx.get && ctx.get('uiWorkspace')) || ctx.uiWorkspace
                        if (ui && typeof ui.startSession === 'function') {
                          ui.startSession(undefined, { prompt: String(prompt || ''), whenDraftExists: 'append' })
                          return true
                        }
                      } catch (e) {
                        console.warn('[mail-cases] 添加到对话失败:', e)
                      }
                      return false
                    },
                    close: function () {
                      try {
                        var layout = (ctx.get && ctx.get('layout')) || ctx.layout
                        if (layout && typeof layout.selectPanel === 'function') {
                          layout.selectPanel(null)
                          return
                        }
                        console.warn('[mail-cases] 找不到 layout 服务，无法返回对话')
                      } catch (e) {
                        console.warn('[mail-cases] 返回对话失败:', e)
                      }
                    },
                  }
                },
              },
              MailPage,
            )
          })
        } catch (err) {
          console.warn('[mail-cases] 注册主面板失败:', err)
        }
      }

      module.exports = { name: name, inject: inject, apply: apply }
      return module.exports
    }
  }

  window.__ModuleLoader__.load({
    id: 'dsh-mail-cases',
    factory: makeFactory(),
  })
})()
