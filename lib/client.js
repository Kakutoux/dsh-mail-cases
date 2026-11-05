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

.mc-filters{flex:none;padding:9px 10px;border-bottom:1px solid var(--mc-border);display:flex;flex-direction:column;gap:6px}
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
.mc-item{border:1px solid transparent;border-radius:8px;padding:6px 8px;cursor:pointer}
.mc-item:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#e8eaef) 6%,transparent)}
.mc-item.is-active{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 13%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 32%,transparent)}
.mc-item-top{display:flex;gap:6px;align-items:baseline}
.mc-item-date{font-size:10px;color:var(--mc-faint);font-variant-numeric:tabular-nums;flex:none}
.mc-item-title{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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

.mc-side{padding:12px 14px 6px;border-bottom:1px solid var(--mc-border)}
.mc-side-title{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mc-faint);margin-bottom:7px}
.mc-kv{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;padding:2px 0}
.mc-kv span:first-child{color:var(--mc-faint);flex:none}
.mc-kv span:last-child{text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-rec{padding:7px 0;border-bottom:1px dashed var(--mc-border)}
.mc-rec:last-child{border-bottom:none}
.mc-rec-head{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--mc-faint)}
.mc-rec-kind{width:5px;height:5px;border-radius:50%;flex:none;background:var(--mc-border-strong)}
.mc-kind-email{background:var(--dsw-alias-brand-primary,#4d6bfe)}
.mc-kind-manual{background:var(--dsw-alias-state-success-primary,#3fb950)}
.mc-kind-status{background:var(--dsw-alias-state-warn-primary,#f0b429)}
.mc-rec-action{font-size:11.5px;margin-top:2px;word-break:break-word}
.mc-rec-detail{font-size:11px;color:var(--mc-faint);margin-top:2px;white-space:pre-wrap;word-break:break-word}
.mc-rec-next{font-size:11px;color:var(--dsw-alias-brand-primary,#4d6bfe);margin-top:2px}
.mc-form{display:flex;flex-direction:column;gap:6px;padding:12px 14px 24px}

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

      function dayLabel (key) {
        if (!key) return '未知日期'
        if (key === todayKey()) return '今天'
        if (key === addDays(-1)) return '昨天'
        return key.slice(5).replace('-', '/')
      }

      function stripDatePrefix (title) {
        return String(title || '').replace(/^\d{2}\/\d{2}\/\d{2}\s+/, '')
      }

      function dayOf (iso) {
        var d = toDate(iso)
        return d ? dateKey(d) : ''
      }

      function groupByDay (items) {
        var groups = []
        var index = {}
        for (var i = 0; i < items.length; i++) {
          var item = items[i]
          var key = item.primaryDate || dayOf(item.lastActivityAt)
          if (!index[key]) {
            index[key] = { key: key, label: dayLabel(key), items: [] }
            groups.push(index[key])
          }
          index[key].items.push(item)
        }
        return groups
      }

      function queryString (filters) {
        var parts = []
        if (filters.q) parts.push('q=' + encodeURIComponent(filters.q))
        if (filters.from) parts.push('from=' + encodeURIComponent(filters.from))
        if (filters.to) parts.push('to=' + encodeURIComponent(filters.to))
        if (filters.status && filters.status !== 'all') parts.push('status=' + encodeURIComponent(filters.status))
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
        var [filters, setFilters] = useState({ q: '', from: '', to: '', status: 'all', sort: 'activity' })
        var [range, setRange] = useState('all')
        var [reloadKey, setReloadKey] = useState(0)
        var [detailKey, setDetailKey] = useState(0)
        var [runBusy, setRunBusy] = useState(false)
        var [openBodies, setOpenBodies] = useState({})
        var [collapsed, setCollapsed] = useState({ done: true })
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
        var [analyzing, setAnalyzing] = useState(false)
        var [composeOpen, setComposeOpen] = useState(false)
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
            api('/mail/cases' + queryString(filters))
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
          [filters.q, filters.from, filters.to, filters.status, filters.sort, reloadKey],
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

        var doRun = function () {
          setError('')
          setRunBusy(true)
          lastDoneRef.current = -1
          api('/mail/run', {})
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
                flash('整理完成：新 ' + res.run.created + ' · 合并 ' + res.run.merged + ' · 已译 ' + res.run.analyzed)
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
          api('/mail/case/status', { id: detail.case.id, status })
            .then(function () {
              setDetailKey(function (k) {
                return k + 1
              })
              setReloadKey(function (k) {
                return k + 1
              })
              flash('状态改为「' + statusLabel(status) + '」')
            })
            .catch(function () {
              flash('改状态失败')
            })
        }

        var toggleArchive = function () {
          if (!detail) return
          var done = !detail.case.archivedAt
          api('/mail/case/complete', { id: detail.case.id, done })
            .then(function () {
              setDetailKey(function (k) {
                return k + 1
              })
              setReloadKey(function (k) {
                return k + 1
              })
              flash(done ? '已移入「已完成」' : '已移回「未完成」')
            })
            .catch(function () {
              flash('操作失败')
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
              flash('已删除')
            })
            .catch(function () {
              flash('删除失败')
            })
        }

        var submitRecord = function () {
          if (!detail) return
          var action = recAction.trim()
          if (!action) {
            flash('先写「做了什么」')
            return
          }
          api('/mail/case/record', {
            id: detail.case.id,
            action: action,
            detail: recDetail.trim(),
            nextStep: recNext.trim(),
            status: recStatus || detail.case.status,
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

        var openCompose = function () {
          setDraft({ source: 'wechat', customer: '', title: '', text: '', files: [] })
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
          setComposeBusy(true)
          api('/mail/case/manual', {
            source: draft.source,
            customer: draft.customer.trim(),
            title: draft.title.trim(),
            text: text,
            files: draft.files,
          })
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
              setSelectedId(res.caseId)
              loadSummary()
              flash('已创建，正在整理…')
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

        // ---------- 渲染 ----------

        var renderItem = function (item) {
          return h(
            'div',
            {
              key: item.id,
              className: 'mc-item' + (detail && detail.case && detail.case.id === item.id ? ' is-active' : ''),
              onClick: function () {
                setSelectedId(item.id)
              },
            },
            h(
              'div',
              { className: 'mc-item-top' },
              h('span', { className: 'mc-item-date' }, (item.primaryDate || '').slice(5).replace('-', '/')),
              h('span', { className: 'mc-item-title', title: item.title }, stripDatePrefix(item.title)),
            ),
            h(
              'div',
              { className: 'mc-item-meta' },
              h('span', { className: 'mc-dot mc-dot-' + item.status }),
              h('span', { className: 'mc-item-status' }, statusLabel(item.status)),
              item.msgCount > 1 ? h('span', { className: 'mc-count' }, item.msgCount + ' 封') : null,
              h('span', { className: 'mc-src mc-src-' + (item.source || 'email') }, sourceLabel(item.source || 'email')),
              item.pendingCount ? h('span', { className: 'mc-count' }, '整理中…') : null,
            ),
          )
        }

        var isCollapsed = function (key) {
          return !!collapsed[key]
        }

        var toggleGroup = function (key) {
          setCollapsed(function (current) {
            var next = {}
            for (var k in current) next[k] = current[k]
            next[key] = !current[key]
            return next
          })
        }

        var caret = function (closed) {
          return h('span', { className: 'mc-caret' + (closed ? '' : ' is-open') }, '▶')
        }

        var renderGroup = function (group, keyPrefix) {
          var key = keyPrefix + group.key
          var closed = isCollapsed(key)
          return h(
            'div',
            { key: key },
            h(
              'div',
              {
                className: 'mc-group-head',
                onClick: function () {
                  toggleGroup(key)
                },
              },
              h('span', null, caret(closed), ' ' + group.label),
              h('span', null, group.items.length),
            ),
            closed ? null : group.items.map(renderItem),
          )
        }

        var renderLeft = function () {
          var openCases = []
          var doneCases = []
          for (var i = 0; i < cases.length; i++) {
            if (cases[i].archivedAt) doneCases.push(cases[i])
            else openCases.push(cases[i])
          }

          var sections = []
          if (filters.status === 'all') {
            if (openCases.length) {
              sections.push(
                h(
                  'div',
                  { key: 'open', className: 'mc-group' },
                  h(
                    'div',
                    {
                      className: 'mc-group-head',
                      onClick: function () {
                        toggleGroup('open')
                      },
                    },
                    h('span', null, caret(isCollapsed('open')), ' ', h('b', null, '未完成')),
                    h('span', null, openCases.length),
                  ),
                  isCollapsed('open')
                    ? null
                    : groupByDay(openCases).map(function (group) {
                        return renderGroup(group, 'o')
                      }),
                ),
              )
            }
            if (doneCases.length) {
              sections.push(
                h(
                  'div',
                  { key: 'done', className: 'mc-group' },
                  h(
                    'div',
                    {
                      className: 'mc-group-head',
                      onClick: function () {
                        toggleGroup('done')
                      },
                    },
                    h('span', null, caret(isCollapsed('done')), ' ', h('b', null, '已完成')),
                    h('span', null, doneCases.length),
                  ),
                  isCollapsed('done')
                    ? null
                    : groupByDay(doneCases).map(function (group) {
                        return renderGroup(group, 'd')
                      }),
                ),
              )
            }
          } else {
            sections = groupByDay(cases).map(function (group) {
              return renderGroup(group, 'f')
            })
          }

          return h(
            'aside',
            { className: 'mc-col mc-left' },
            h(
              'div',
              { className: 'mc-filters' },
              h('input', {
                className: 'mc-input',
                value: draftQ,
                placeholder: '搜索主题 / 正文 / 客户',
                onChange: function (event) {
                  onSearch(event.target.value)
                },
              }),
              h(
                'div',
                { className: 'mc-chips' },
                h(
                  'button',
                  { className: 'mc-chip-btn' + (range === 'all' ? ' is-on' : ''), onClick: function () { pickRange('all') } },
                  '全部',
                ),
                h(
                  'button',
                  { className: 'mc-chip-btn' + (range === 'today' ? ' is-on' : ''), onClick: function () { pickRange('today') } },
                  '今天',
                ),
                h(
                  'button',
                  { className: 'mc-chip-btn' + (range === '7d' ? ' is-on' : ''), onClick: function () { pickRange('7d') } },
                  '近 7 天',
                ),
                h(
                  'button',
                  { className: 'mc-chip-btn' + (range === 'custom' ? ' is-on' : ''), onClick: function () { pickRange('custom') } },
                  '自定义',
                ),
              ),
              range === 'custom'
                ? h(
                    'div',
                    { className: 'mc-range' },
                    h('label', null, '起'),
                    h('input', {
                      className: 'mc-input',
                      type: 'date',
                      value: filters.from,
                      onChange: function (event) {
                        setFilter({ from: event.target.value })
                      },
                    }),
                    h('label', null, '止'),
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
                { className: 'mc-row' },
                h(
                  'select',
                  {
                    className: 'mc-input',
                    value: filters.status,
                    onChange: function (event) {
                      setFilter({ status: event.target.value })
                    },
                  },
                  h('option', { value: 'all' }, '全部状态'),
                  h('option', { value: 'open' }, '未完成'),
                  h('option', { value: 'done' }, '已完成'),
                  h('option', { value: 'doing' }, '处理中'),
                  h('option', { value: 'waiting' }, '等待客户'),
                  h('option', { value: 'deleted' }, '回收站'),
                ),
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
            ),
            h(
              'div',
              { className: 'mc-list' },
              cases.length === 0
                ? h(
                    'div',
                    { className: 'mc-empty' },
                    h(MailIcon, { size: 22 }),
                    h('div', null, filters.q || filters.from || filters.to ? '没有匹配的 Case' : '还没有 Case'),
                    h('div', null, filters.q || filters.from || filters.to ? '换个条件试试' : '点右上「立即整理」'),
                  )
                : sections,
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
            h('div', { className: 'mc-mail-title' }, mail.subjectZh || mail.subject || '（无主题）'),
            h(
              'div',
              { className: 'mc-mail-meta' },
              [mail.fromName, mail.fromAddr].filter(Boolean).join(' ') + ' · ' + fmtDateTime(mail.receivedAt),
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
                    ? messages.map(function (mail, index) {
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
                  : h(
                      'button',
                      { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: toggleArchive },
                      caseRow.archivedAt ? '重新打开' : '标记完成',
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
          return h(
            'aside',
            { className: 'mc-col mc-right' },
            h(
              'div',
              { className: 'mc-side' },
              h(
                'select',
                {
                  className: 'mc-input',
                  value: caseRow.status,
                  onChange: function (event) {
                    changeStatus(event.target.value)
                  },
                },
                STATUS.map(function (item) {
                  return h('option', { key: item.value, value: item.value }, item.label)
                }),
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
              { className: 'mc-side' },
              h('div', { className: 'mc-side-title' }, '处理记录'),
              records.length === 0
                ? h('div', { className: 'mc-placeholder' }, '还没有记录')
                : records.map(function (record) {
                    return h(
                      'div',
                      { key: record.id, className: 'mc-rec' },
                      h(
                        'div',
                        { className: 'mc-rec-head' },
                        h('span', { className: 'mc-rec-kind mc-kind-' + record.kind }),
                        h('span', null, fmtDateTime(record.at)),
                        h('span', { className: 'mc-spacer' }),
                        h(
                          'button',
                          { className: 'mc-link', style: { fontSize: '10px' }, onClick: function () { removeRecord(record.id) } },
                          '删',
                        ),
                      ),
                      h('div', { className: 'mc-rec-action' }, record.action),
                      record.detail ? h('div', { className: 'mc-rec-detail' }, record.detail) : null,
                      record.nextStep ? h('div', { className: 'mc-rec-next' }, '下一步：' + record.nextStep) : null,
                    )
                  }),
            ),
            h(
              'div',
              { className: 'mc-form' },
              h('div', { className: 'mc-side-title' }, '添加记录'),
              h('textarea', {
                className: 'mc-input',
                placeholder: '做了什么（必填）',
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
                h('span', null, '只整理未读邮件（关闭则窗口内的已读邮件也整理）'),
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
                h('div', null, '导出全部数据（JSON 备份）'),
                h('button', { className: 'mc-btn mc-btn-ghost mc-btn-sm', onClick: exportAll }, '导出'),
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
              h('h3', null, '新建事项'),
              h('p', { className: 'mc-hint' }, '微信 / QQ 里的客户问题也能收进来：粘聊天记录、粘图片，来源会标在左边列表上。'),
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
              h(
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
              h(
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
                ? '只整理未读邮件：已读过的不会重复进来。整理时一封一封出现，不用等全部跑完。'
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
        var showHero = cases.length === 0 && !filters.q && !filters.from && !filters.to && !running

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
            h('button', { className: 'mc-btn mc-btn-ghost', onClick: openCompose }, '+ 新建'),
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
