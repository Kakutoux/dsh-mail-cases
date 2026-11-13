// 宿主半区：/mail 路由 + 定时整理 + IMAP 抓取 + AI 整理 + 落库。
// 面板是纯被动的：不注册任何会话监听，不碰对话流。

import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

import { Store, STATUSES, todayString } from './db.js'
import { ImapConnection, ImapError } from './imap.js'
import { parseMessage, parseHeaders, decodeWords } from './mime.js'
import { analyzeMail } from './analyze.js'

const DATA_DIR =
  process.env.DSH_MAIL_DIR ||
  path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'dsh-mail-cases')
const DB_FILE = path.join(DATA_DIR, 'cases.db')
const MAX_PER_RUN = 60
const ANALYZE_PER_RUN = 30
const FIRST_RUN_DAYS = 7
// 每次整理至少回看这么久，避免「上次整理」把窗口压成几秒钟
const MANUAL_LOOKBACK_HOURS = 26

const state = {
  store: null,
  openError: null,
  running: false,
  run: null,
  ctx: null,
}

export const name = 'mail-cases'
export const inject = ['webServer']

// ---------- 工具 ----------

function log (...args) {
  console.log('[mail-cases]', ...args)
}

function nowIso () {
  return new Date().toISOString()
}

function shortDate (date) {
  const d = date instanceof Date ? date : new Date(date)
  return (
    String(d.getFullYear()).slice(2) +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    String(d.getDate()).padStart(2, '0')
  )
}

function normalizeSubject (subject) {
  return String(subject || '')
    .replace(/^\s*((re|fw|fwd|aw|sv)\s*[:：]\s*)+/gi, '')
    .replace(/^\s*(答复|回复|转发)\s*[:：]\s*/g, '')
    .replace(/\[[^\]]{0,30}\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function summarizeSubject (subject, max = 42) {
  const clean = String(subject || '')
    .replace(/^\s*((re|fw|fwd|aw|sv)\s*[:：]\s*)+/gi, '')
    .replace(/^\s*(答复|回复|转发)\s*[:：]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return '（无主题）'
  return clean.length > max ? clean.slice(0, max) + '…' : clean
}

function customerOf (fromName, fromAddr) {
  const name = String(fromName || '').trim()
  if (name) return name
  const domain = String(fromAddr || '').split('@')[1] || ''
  return domain || String(fromAddr || '')
}

function addressOf (value) {
  const text = String(value || '')
  const angled = /<([^>]+)>/.exec(text)
  return (angled ? angled[1] : text).trim().toLowerCase()
}

function atTime (base, hhmm) {
  const [hour, minute] = String(hhmm || '08:30')
    .split(':')
    .map((x) => Number(x))
  const d = new Date(base)
  d.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 30, 0, 0)
  return d
}

function computeWindow (account, mode, now, forceDays) {
  // 补收模式：无视上次整理时间，直接往前推 N 天。漏掉的邮件靠它捞回来。
  if (forceDays > 0) return { from: new Date(now.getTime() - forceDays * 86400000), to: now }
  const last = account.lastRunAt ? new Date(account.lastRunAt) : null
  const floor = new Date(now.getTime() - Math.max(1, Number(account.syncDays) || 30) * 86400000)

  if (mode === 'scheduled') {
    const anchor = atTime(now, account.scheduleTime)
    return { from: new Date(anchor.getTime() - 86400000), to: anchor }
  }
  if (!last) {
    const days = Math.min(FIRST_RUN_DAYS, Math.max(1, Number(account.syncDays) || 30))
    return { from: new Date(now.getTime() - days * 86400000), to: now }
  }
  // 窗口起点取「上次整理」和「固定回看」里更早的那个：
  // 只按上次整理时间算的话，连着点两次整理，第二次的窗口就只有几百毫秒，
  // 上一次被跳过（比如当时还是已读）的邮件就永远落在窗口外面，再也补不回来。
  const lookback = new Date(now.getTime() - MANUAL_LOOKBACK_HOURS * 3600000)
  let from = last < lookback ? last : lookback
  if (from < floor) from = floor
  return { from, to: now }
}

// ---------- 模型 ----------

function resolveRoute (ctx) {
  try {
    const service = ctx && ctx.get ? ctx.get('agentDefaultModel') : null
    if (!service || typeof service.currentSelection !== 'function') return null
    const selection = service.currentSelection()
    if (selection && typeof selection === 'object') {
      const provider = selection.provider || selection.providerId
      const model = selection.model || selection.modelId
      if (provider && model) return { provider: String(provider), model: String(model) }
    }
  } catch (err) {
    log('取默认模型失败：', err && err.message)
  }
  return null
}

function getLlm (ctx) {
  try {
    return ctx && ctx.get ? ctx.get('llm') : null
  } catch {
    return null
  }
}

async function analyzeOne (messageId, ctx, options = {}) {
  const store = state.store
  const mail = store.messageForAnalysis(messageId)
  if (!mail) return { ok: false, error: '邮件不存在' }

  const llm = getLlm(ctx)
  const route = resolveRoute(ctx)
  if (!llm) {
    store.setAnalysisState(messageId, 'failed', '模型服务不可用')
    return { ok: false, error: '模型服务不可用' }
  }
  if (!route) {
    store.setAnalysisState(messageId, 'failed', '没有可用的默认模型')
    return { ok: false, error: '没有可用的默认模型' }
  }

  try {
    const result = await analyzeMail(llm, route, mail, { priorSummary: options.priorSummary || '' })
    store.updateMessageAnalysis(messageId, { ...result, state: 'done' })
    if (mail.caseId) {
      // 优先用模型起的中文短标题；没有就退回主题
      // 追加进来的后续消息不改 Case 标题（否则整条事项会被改名）
      const messages = store.messagesOfCase(mail.caseId)
      const named = messages.find((item) => item.subjectZh)
      const base = result.title || (named ? named.subjectZh : '')
      if (base && options.setTitle !== false) {
        const stamp = new Date((named && named.receivedAt) || mail.receivedAt || Date.now())
        store.setCaseTitle(mail.caseId, shortDate(stamp) + ' ' + summarizeSubject(base, 26))
      }
      store.recomputeCase(mail.caseId)
    }
    return { ok: true }
  } catch (err) {
    const message = err && err.message ? err.message : String(err)
    store.setAnalysisState(messageId, 'failed', message)
    if (mail.caseId) store.recomputeCase(mail.caseId)
    return { ok: false, error: message }
  }
}

// ---------- 整理 ----------

async function runOnce (mode = 'manual', options = {}) {
  if (state.running) return { ok: false, error: '正在整理中，请稍等' }
  const store = state.store
  const ctx = state.ctx
  if (!store) return { ok: false, error: '数据库不可用：' + (state.openError ? state.openError.message : '未知原因') }

  const account = store.getAccount()
  if (!account || !account.email) return { ok: false, error: '还没有配置邮箱账号' }
  if (!account.authCode) return { ok: false, error: '还没有填写客户端授权码' }

  state.running = true
  const run = {
    mode,
    startedAt: nowIso(),
    finishedAt: '',
    phase: '准备',
    created: 0,
    merged: 0,
    skipped: 0,
    total: 0,
    steps: 0,
    done: 0,
    current: '',
    caseId: 0,
    analyzed: 0,
    analyzeFailed: 0,
    error: '',
    window: null,
  }
  state.run = run

  const now = new Date()
  const forceDays = Math.max(0, Math.min(365, Number(options.days) || 0))
  const window = computeWindow(account, mode, now, forceDays)
  run.window = { from: window.from.toISOString(), to: window.to.toISOString() }
  run.mode = forceDays > 0 ? 'catchup' : mode

  let conn = null
  const newMessageIds = []
  try {
    run.phase = '连接邮箱'
    conn = new ImapConnection({ host: account.imapHost, port: Number(account.imapPort) || 993 })
    await conn.connect()

    run.phase = '登录'
    await conn.identify()
    await conn.login(account.email, account.authCode)

    run.phase = '打开收件箱'
    const box = await conn.select('INBOX')

    const sameUidValidity = String(account.uidValidity || '') === String(box.uidValidity || '')
    const knownUids = sameUidValidity ? store.knownUids('INBOX', box.uidValidity) : new Set()
    const knownIds = store.knownMessageIds()

    run.phase = '搜索邮件'
    // 一律搜全部（不按 UNSEEN 过滤）：已读的邮件也要看，否则我们读完邮件再整理就漏了。
    // 「只整理未读」的取舍放到下面按邮件头判断。
    const uids = await conn.searchSince(new Date(window.from.getTime() - 86400000), { unseen: false })

    run.phase = '读取邮件头'
    const headers = await conn.fetchHeaders(uids)
    const inWindow = headers.filter((h) => h.receivedAt >= window.from && h.receivedAt < window.to)

    // 规则：未读的一律收；已读的只在能并进已有 Case 时才收，其余不处理。
    // 补收（重新扫描最近 N 天）用同一个判断，只是窗口更宽。
    const unreadOnly = Number(account.unreadOnly) === 1
    const candidates = []
    for (const header of inWindow) {
      if (knownUids.has(header.uid)) {
        run.skipped++
        continue
      }
      const head = parseHeaders(header.rawHeaders ? header.rawHeaders.toString('utf8') : '')
      const messageId = String(head['message-id'] || '')
        .trim()
        .replace(/^<|>$/g, '')
      if (messageId && knownIds.has(messageId.toLowerCase())) {
        run.skipped++
        continue
      }

      const senderAddr = addressOf(head.from)
      const seen = (header.flags || []).some((flag) => flag.toLowerCase() === '\\seen')
      if (unreadOnly && seen) {
        const subject = decodeWords(String(head.subject || ''))
        const threadKey = normalizeSubject(subject)
        let known = null
        for (const ref of [head['in-reply-to'], ...(String(head.references || '').split(/\s+/))]) {
          const clean = String(ref || '')
            .trim()
            .replace(/^<|>$/g, '')
          if (!clean) continue
          const hit = store.findByMessageId(clean)
          if (hit) {
            known = hit
            break
          }
        }
        if (!known && threadKey) known = store.findOpenCaseByThread(threadKey, senderAddr)
        if (!known) {
          run.skipped++
          continue
        }
      }

      candidates.push({ ...header, messageId, head })
    }

    candidates.sort((a, b) => a.receivedAt - b.receivedAt)
    run.total = candidates.length
    run.steps = Math.min(candidates.length, MAX_PER_RUN)
    const limited = candidates.slice(0, MAX_PER_RUN)
    let analyzedThisRun = 0

    // 163 的连接在长时间整理（中间夹着模型调用）时会被服务端掐断，断了就重连再来。
    const reopen = async () => {
      try {
        if (conn) conn.close()
      } catch {
        // 忽略
      }
      conn = new ImapConnection({ host: account.imapHost, port: Number(account.imapPort) || 993 })
      await conn.connect()
      await conn.identify()
      await conn.login(account.email, account.authCode)
      await conn.select('INBOX')
    }
    const fetchBodySafe = async (uid) => {
      try {
        await conn.command('NOOP')
        return await conn.fetchBody(uid)
      } catch {
        run.phase = '重新连接邮箱'
        await reopen()
        return await conn.fetchBody(uid)
      }
    }

    for (const candidate of limited) {
      run.done = run.created + run.merged
      run.phase = '读取第 ' + (run.done + 1) + '/' + limited.length + ' 封'
      const raw = await fetchBodySafe(candidate.uid)
      const parsed = parseMessage(raw)
      const receivedAt = candidate.receivedAt
      const subject = parsed.subject || String((candidate.head && candidate.head.subject) || '').trim()
      const threadKey = normalizeSubject(subject)

      // 1) 引用链优先：In-Reply-To / References 命中已知邮件
      let caseRow = null
      const refs = [parsed.inReplyTo, ...(parsed.references || [])].filter(Boolean)
      for (const ref of refs) {
        const hit = store.findByMessageId(ref)
        if (hit && hit.caseId) {
          caseRow = store.getCase(hit.caseId)
          if (caseRow) break
        }
      }
      // 2) 退化：规范化主题 + 同域名
      if (!caseRow) caseRow = store.findOpenCaseByThread(threadKey, parsed.fromAddr)

      const baseMessage = {
        mailbox: 'INBOX',
        uid: candidate.uid,
        uidValidity: box.uidValidity,
        messageId: parsed.messageId || candidate.messageId,
        subject,
        fromName: parsed.fromName,
        fromAddr: parsed.fromAddr,
        toAddrs: parsed.toAddrs,
        ccAddrs: parsed.ccAddrs,
        receivedAt: receivedAt.toISOString(),
        size: candidate.size,
        bodyText: parsed.bodyText,
        hasAttachments: parsed.hasAttachments,
        attachNames: parsed.attachments.map((a) => a.name),
      }

      let targetCaseId = caseRow ? caseRow.id : 0
      let insertedMessageId = 0

      if (caseRow) {
        insertedMessageId = store.insertMessage({ ...baseMessage, caseId: caseRow.id })
        if (insertedMessageId) newMessageIds.push(insertedMessageId)
        store.touchCase(caseRow.id, { activityAt: receivedAt.toISOString(), addMessages: 1 })
        const reopened = store.reopenOnReply(caseRow.id)
        store.addRecord(caseRow.id, {
          kind: 'email',
          at: receivedAt.toISOString(),
          status: reopened ? 'todo' : caseRow.status,
          action: '收到同一事项的新邮件：' + summarizeSubject(subject, 60),
          detail: parsed.fromAddr ? '来自 ' + parsed.fromAddr : '',
        })
        if (reopened) {
          store.addRecord(caseRow.id, {
            kind: 'status',
            at: receivedAt.toISOString(),
            status: 'todo',
            action: '自动改回「未开始」',
            detail: '客户回了新邮件，原来是「' + (reopened.from === 'waiting' ? '等待客户' : '已完成') + '」',
          })
          run.reopened = (run.reopened || 0) + 1
        }
        run.merged++
      } else {
        const title = shortDate(receivedAt) + ' ' + summarizeSubject(subject)
        const customer = customerOf(parsed.fromName, parsed.fromAddr)
        targetCaseId = store.createCase({
          title,
          threadKey,
          customer,
          fromAddrs: parsed.fromAddr,
          status: 'todo',
          primaryDate: todayString(receivedAt),
          lastActivityAt: receivedAt.toISOString(),
          messageCount: 1,
          searchText: [title, customer, parsed.fromAddr, subject, (parsed.bodyText || '').slice(0, 4000)].join(' '),
        })
        insertedMessageId = store.insertMessage({ ...baseMessage, caseId: targetCaseId })
        if (insertedMessageId) newMessageIds.push(insertedMessageId)
        store.addRecord(targetCaseId, {
          kind: 'email',
          at: receivedAt.toISOString(),
          status: 'todo',
          action: '收到邮件：' + summarizeSubject(subject, 60),
          detail: parsed.fromAddr ? '来自 ' + parsed.fromAddr : '',
        })
        run.created++
      }

      // 一封一封出：插入后立刻翻译，前端轮询才能看到逐条冒出来
      run.current = summarizeSubject(subject, 30)
      run.caseId = targetCaseId
      if (insertedMessageId && analyzedThisRun < ANALYZE_PER_RUN) {
        analyzedThisRun++
        run.phase = '翻译第 ' + (run.done + 1) + '/' + limited.length + ' 封'
        const result = await analyzeOne(insertedMessageId, ctx)
        if (result.ok) run.analyzed++
        else run.analyzeFailed++
      }
      run.done = run.created + run.merged
    }

    if (candidates.length > limited.length) {
      run.phase = '本轮已到上限，剩余 ' + (candidates.length - limited.length) + ' 封下次继续'
    }

    await conn.logout()
    conn = null

    // ---------- 补漏：上一轮没整理完的 ----------
    const leftovers = store.pendingMessages(5)
    for (let i = 0; i < leftovers.length; i++) {
      run.phase = '补整理 ' + (i + 1) + '/' + leftovers.length
      const result = await analyzeOne(leftovers[i].id, ctx)
      if (result.ok) run.analyzed++
      else run.analyzeFailed++
    }
    run.done = run.created + run.merged

    run.finishedAt = nowIso()
    run.phase = '完成'
    store.saveAccount({ uidValidity: String(box.uidValidity || '') })
    const summaryText =
      '新 ' +
      run.created +
      ' · 合并 ' +
      run.merged +
      ' · 跳过 ' +
      run.skipped +
      (run.reopened ? ' · 重开 ' + run.reopened : '') +
      (run.analyzed ? ' · 已译 ' + run.analyzed : '') +
      (run.analyzeFailed ? ' · 翻译失败 ' + run.analyzeFailed : '') +
      (candidates.length > limited.length ? ' · 余 ' + (candidates.length - limited.length) : '')
    store.markRun({ at: run.finishedAt, result: summaryText })
    log('整理完成', summaryText)
    return { ok: true, run }
  } catch (err) {
    const message = err instanceof ImapError ? err.message : err && err.message ? err.message : String(err)
    run.error = message
    run.finishedAt = nowIso()
    run.phase = '失败'
    if (store) store.markFailure({ at: run.finishedAt, error: message })
    log('整理失败：', message)
    return { ok: false, error: message, run }
  } finally {
    if (conn) conn.close()
    state.running = false
  }
}

// ---------- 定时 ----------

function tick () {
  const store = state.store
  if (!store || state.running) return
  const account = store.getAccount()
  if (!account || !account.email || !account.authCode) return

  const now = new Date()
  const anchor = atTime(now, account.scheduleTime)
  if (now < anchor) return

  const last = account.lastRunAt ? new Date(account.lastRunAt) : null
  if (last && last >= anchor) return
  runOnce(last ? 'scheduled' : 'initial').catch((err) => log('定时任务异常：', err && err.message))
}

// ---------- HTTP ----------

function sendJson (res, status, payload) {
  if (res.writableEnded) return
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(payload))
}

async function readJson (req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 2 * 1024 * 1024) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function storageInfo () {
  let ok = false
  let error = ''
  if (state.store) ok = true
  else if (state.openError) error = state.openError.message
  return { file: DB_FILE, ok, error }
}

function summaryPayload () {
  const store = state.store
  const account = store ? store.getAccount() : null
  return {
    ok: true,
    configured: !!(account && account.email && account.authCode),
    email: account ? account.email : '',
    scheduleTime: account ? account.scheduleTime : '08:30',
    unreadOnly: account ? Number(account.unreadOnly) === 1 : true,
    lastRunAt: account ? account.lastRunAt || '' : '',
    lastResult: account ? account.lastResult || '' : '',
    lastError: account ? account.lastError || '' : '',
    running: state.running,
    run: state.run,
    counts: store ? store.counts() : { open: 0, active: 0, waiting: 0, done: 0, doneRecent: 0, deleted: 0, today: 0 },
    storage: storageInfo(),
    version: '0.8.8',
  }
}

async function handle (req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const route = url.pathname.replace(/^\/mail/, '') || '/'
  const method = (req.method || 'GET').toUpperCase()
  const store = state.store
  const ctx = state.ctx

  try {
    if (route === '/diag' && method === 'GET') {
      let selectionRaw = ''
      try {
        const service = ctx && ctx.get ? ctx.get('agentDefaultModel') : null
        if (service && typeof service.currentSelection === 'function') {
          selectionRaw = JSON.stringify(service.currentSelection())
        }
      } catch (err) {
        selectionRaw = 'ERR ' + (err && err.message)
      }
      return sendJson(res, 200, {
        ok: true,
        node: process.versions.node,
        electron: process.versions.electron || '',
        dataDir: DATA_DIR,
        dbFile: DB_FILE,
        storage: storageInfo(),
        hasLlm: !!getLlm(ctx),
        modelSelection: selectionRaw,
        route: resolveRoute(ctx),
      })
    }

    // 只读诊断：看看邮箱里最近 N 天有什么，以及每封会不会被收进来。不写库、不调模型。
    if (route === '/probe' && method === 'GET') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const account = store.getAccount()
      if (!account || !account.email || !account.authCode) {
        return sendJson(res, 400, { ok: false, error: '还没有配置邮箱账号' })
      }
      const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days')) || 3))
      const conn = new ImapConnection({ host: account.imapHost, port: Number(account.imapPort) || 993 })
      try {
        await conn.connect()
        await conn.identify()
        await conn.login(account.email, account.authCode)
        const box = await conn.select('INBOX')
        const knownIds = store.knownMessageIds()
        const knownUids = store.knownUids('INBOX', box.uidValidity)
        const since = new Date(Date.now() - days * 86400000)
        const uids = await conn.searchSince(since, { unseen: false })
        const headers = await conn.fetchHeaders(uids)
        const rows = []
        for (const header of headers) {
          if (header.receivedAt < since) continue
          const head = parseHeaders(header.rawHeaders ? header.rawHeaders.toString('utf8') : '')
          const messageId = String(head['message-id'] || '')
            .trim()
            .replace(/^<|>$/g, '')
          const seen = (header.flags || []).some((flag) => flag.toLowerCase() === '\\seen')
          const subject = decodeWords(String(head.subject || ''))
          const fromAddr = addressOf(head.from)
          const domain = String(fromAddr || '').split('@')[1] || ''
          const inDb = (!!messageId && knownIds.has(messageId.toLowerCase())) || knownUids.has(header.uid)
          const toHeader = decodeWords(String(head.to || '')).toLowerCase()
          let verdict = '会收（未读，新建）'
          if (inDb) {
            verdict = '已在库里'
          } else if (seen) {
            const threadKey = normalizeSubject(subject)
            let mergeTo = null
            for (const ref of [head['in-reply-to'], ...(String(head.references || '').split(/\s+/))]) {
              const clean = String(ref || '')
                .trim()
                .replace(/^<|>$/g, '')
              if (!clean) continue
              const hit = store.findByMessageId(clean)
              if (hit) {
                mergeTo = store.getCase(hit.caseId)
                break
              }
            }
            if (!mergeTo && threadKey) mergeTo = store.findOpenCaseByThread(threadKey, fromAddr)
            verdict = mergeTo ? '会收（已读，并入：' + String(mergeTo.title || '').slice(0, 24) + '）' : '跳过（已读，没有对应 Case）'
          }
          rows.push({
            uid: header.uid,
            at: header.receivedAt.toISOString(),
            seen,
            from: fromAddr,
            domain,
            subject: subject.slice(0, 70),
            to: toHeader.slice(0, 90),
            inDb,
            verdict,
          })
        }
        rows.sort((a, b) => String(b.at).localeCompare(String(a.at)))
        return sendJson(res, 200, {
          ok: true,
          mailbox: 'INBOX',
          exists: box.exists,
          uidValidity: box.uidValidity,
          days,
          scanned: rows.length,
          rows: rows.slice(0, 60),
        })
      } catch (err) {
        return sendJson(res, 200, { ok: false, error: err && err.message ? err.message : String(err) })
      } finally {
        try {
          conn.close()
        } catch {
          // 忽略
        }
      }
    }

    if (route === '/summary' && method === 'GET') return sendJson(res, 200, summaryPayload())

    if (route === '/settings' && method === 'GET') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const account = store.getAccount()
      return sendJson(res, 200, {
        ok: true,
        email: account.email || '',
        hasAuthCode: !!account.authCode,
        imapHost: account.imapHost || 'imap.qiye.163.com',
        imapPort: account.imapPort || 993,
        syncDays: account.syncDays || 30,
        scheduleTime: account.scheduleTime || '08:30',
        unreadOnly: Number(account.unreadOnly) === 1,
      })
    }

    if (route === '/settings' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const patch = {}
      if (typeof body.email === 'string') patch.email = body.email.trim()
      if (typeof body.authCode === 'string' && body.authCode.trim()) patch.authCode = body.authCode.trim()
      if (typeof body.imapHost === 'string' && body.imapHost.trim()) patch.imapHost = body.imapHost.trim()
      if (body.imapPort) patch.imapPort = Math.max(1, Math.min(65535, Number(body.imapPort) || 993))
      if (body.syncDays) patch.syncDays = Math.max(1, Math.min(365, Number(body.syncDays) || 30))
      if (typeof body.scheduleTime === 'string' && /^\d{1,2}:\d{2}$/.test(body.scheduleTime)) {
        patch.scheduleTime = body.scheduleTime
      }
      if (typeof body.unreadOnly === 'boolean') patch.unreadOnly = body.unreadOnly ? 1 : 0
      store.saveAccount(patch)
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/account/test' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const account = store.getAccount()
      const email = String(body.email || account.email || '').trim()
      const authCode = String(body.authCode || account.authCode || '').trim()
      const host = String(body.imapHost || account.imapHost || 'imap.qiye.163.com').trim()
      const port = Number(body.imapPort || account.imapPort || 993)
      if (!email || !authCode) return sendJson(res, 400, { ok: false, error: '请先填写邮箱地址和客户端授权码' })

      const conn = new ImapConnection({ host, port })
      try {
        await conn.connect()
        await conn.identify()
        await conn.login(email, authCode)
        const box = await conn.select('INBOX')
        await conn.logout()
        return sendJson(res, 200, { ok: true, exists: box.exists, uidValidity: box.uidValidity })
      } catch (err) {
        conn.close()
        return sendJson(res, 200, { ok: false, error: err && err.message ? err.message : String(err) })
      }
    }

    if (route === '/run' && method === 'POST') {
      if (state.running) return sendJson(res, 409, { ok: false, error: '正在整理中' })
      const body = await readJson(req).catch(() => ({}))
      const days = Math.max(0, Math.min(365, Number(body && body.days) || 0))
      const result = await runOnce(days > 0 ? 'catchup' : 'manual', days > 0 ? { days } : {})
      return sendJson(res, result.ok ? 200 : 500, result)
    }

    if (route === '/analyze' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const caseId = Number(body.caseId)
      if (!caseId) return sendJson(res, 400, { ok: false, error: '缺少 caseId' })

      const messages = store.messagesOfCase(caseId)
      const targets = messages.filter((m) => m.analysisState !== 'done')
      if (!targets.length) return sendJson(res, 200, { ok: true, analyzed: 0, failed: 0 })

      let analyzed = 0
      let failed = 0
      for (const message of targets) {
        const result = await analyzeOne(message.id, ctx)
        if (result.ok) analyzed++
        else failed++
      }
      return sendJson(res, 200, { ok: true, analyzed, failed })
    }

    if (route === '/selftest-llm' && method === 'POST') {
      const llm = getLlm(ctx)
      const routeInfo = resolveRoute(ctx)
      if (!llm) return sendJson(res, 200, { ok: false, error: '模型服务不可用' })
      if (!routeInfo) return sendJson(res, 200, { ok: false, error: '没有可用的默认模型' })
      try {
        const result = await analyzeMail(
          llm,
          routeInfo,
          {
            subject: 'Quotation request',
            fromName: 'Test Buyer',
            fromAddr: 'buyer@example.com',
            receivedAt: new Date().toISOString(),
            bodyText: 'Hi, please send your quotation for 2000pcs by this Friday. We also need the CE certificate.',
            attachNames: [],
          },
          { maxTokens: 1500, timeoutMs: 90000 },
        )
        return sendJson(res, 200, { ok: true, route: routeInfo, result })
      } catch (err) {
        return sendJson(res, 200, { ok: false, error: err && err.message ? err.message : String(err) })
      }
    }

    if (route === '/clear' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      store.clearAll()
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/cases' && method === 'GET') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const params = url.searchParams
      const cases = store.listCases({
        status: params.get('status') || 'all',
        q: params.get('q') || '',
        from: params.get('from') || '',
        to: params.get('to') || '',
        sort: params.get('sort') || 'activity',
      })
      return sendJson(res, 200, { ok: true, cases, total: cases.length })
    }

    if (route === '/case' && method === 'GET') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const id = Number(url.searchParams.get('id'))
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id' })
      const caseRow = store.getCase(id, true)
      if (!caseRow) return sendJson(res, 404, { ok: false, error: 'Case 不存在' })
      return sendJson(res, 200, {
        ok: true,
        case: caseRow,
        messages: store.messagesOfCase(id),
        records: store.recordsOfCase(id),
      })
    }

    if (route === '/file' && method === 'GET') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const id = Number(url.searchParams.get('id'))
      const row = store.getAttachment(id)
      if (!row) return sendJson(res, 404, { ok: false, error: '附件不存在' })
      const root = path.resolve(FILES_DIR)
      const full = path.resolve(FILES_DIR, row.file)
      if (!full.startsWith(root + path.sep)) return sendJson(res, 400, { ok: false, error: '非法路径' })
      if (!fs.existsSync(full)) return sendJson(res, 404, { ok: false, error: '文件已丢失' })
      const data = fs.readFileSync(full)
      res.writeHead(200, {
        'content-type': row.mime || 'application/octet-stream',
        'content-length': data.length,
        'cache-control': 'private, max-age=86400',
      })
      res.end(data)
      return
    }

    if (route === '/case/manual' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const text = String(body.text || '').trim()
      const files = Array.isArray(body.files) ? body.files : []
      if (!text && !files.length) return sendJson(res, 400, { ok: false, error: '写点内容，或者加一张图片/附件' })

      const source = ['wechat', 'qq', 'other'].includes(body.source) ? body.source : 'other'
      const customer = String(body.customer || '').trim()
      const now = new Date()
      const fallback = files.length ? String(files[0].name || '图片') : '手动记录'
      const autoTitle = summarizeSubject(String(body.title || '').trim() || text || fallback, 22)
      const title = shortDate(now) + ' ' + autoTitle

      const caseId = store.createCase({
        title,
        threadKey: '',
        customer,
        source,
        fromAddrs: '',
        status: 'todo',
        primaryDate: todayString(now),
        lastActivityAt: now.toISOString(),
        messageCount: 1,
        searchText: [title, customer, text].join(' '),
      })

      const messageId = store.insertMessage({
        mailbox: 'manual',
        kind: 'text',
        source,
        uid: store.nextManualUid(),
        uidValidity: '',
        messageId: '',
        subject: autoTitle,
        fromName: customer,
        fromAddr: '',
        receivedAt: now.toISOString(),
        size: Buffer.byteLength(text, 'utf8'),
        bodyText: text,
        hasAttachments: files.length > 0,
        attachNames: files.map((item) => String(item.name || '')),
        caseId,
      })

      const saved = []
      for (const file of files) {
        try {
          const stored = saveUpload(caseId, file)
          store.addAttachment({ caseId, messageId, ...stored })
          saved.push(stored.name)
        } catch (err) {
          log('附件保存失败：', err && err.message)
        }
      }

      store.addRecord(caseId, {
        kind: 'manual',
        action: '手动创建（来源：' + sourceLabel(source) + '）',
        detail: [customer ? '联系人：' + customer : '', saved.length ? '附件 ' + saved.length + ' 个' : '']
          .filter(Boolean)
          .join(' · '),
      })

      // 建完就回，翻译与摘要后台跑，免得等；纯图片没有文字就不必调模型
      if (text) analyzeOne(messageId, ctx).catch((err) => log('手动事项整理失败：', err && err.message))

      return sendJson(res, 200, { ok: true, caseId })
    }

    // 把一条微信/QQ 消息追加进已有事项（客户在原邮件之后的后续沟通）
    if (route === '/case/append' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const caseId = Number(body.caseId)
      const text = String(body.text || '').trim()
      const files = Array.isArray(body.files) ? body.files : []
      if (!caseId) return sendJson(res, 400, { ok: false, error: '缺少 caseId' })
      const existing = store.getCase(caseId)
      if (!existing) return sendJson(res, 404, { ok: false, error: 'Case 不存在' })
      if (!text && !files.length) return sendJson(res, 400, { ok: false, error: '写点内容，或者加一张图片' })

      const source = ['wechat', 'qq', 'other', 'email'].includes(body.source) ? body.source : 'wechat'
      const now = new Date()
      const fallback = files.length ? String(files[0].name || '图片') : '追加消息'
      const subject = summarizeSubject(text || fallback, 24)

      const messageId = store.insertMessage({
        mailbox: 'manual',
        kind: 'text',
        source,
        uid: store.nextManualUid(),
        uidValidity: '',
        messageId: '',
        subject,
        fromName: String(body.customer || existing.customer || '').trim(),
        fromAddr: '',
        receivedAt: now.toISOString(),
        size: Buffer.byteLength(text, 'utf8'),
        bodyText: text,
        hasAttachments: files.length > 0,
        attachNames: files.map((item) => String(item.name || '')),
        caseId,
      })

      const saved = []
      for (const file of files) {
        try {
          const stored = saveUpload(caseId, file)
          store.addAttachment({ caseId, messageId, ...stored })
          saved.push(stored.name)
        } catch (err) {
          log('附件保存失败：', err && err.message)
        }
      }

      store.syncCaseCount(caseId)
      store.addRecord(caseId, {
        kind: 'manual',
        action: '追加一条' + sourceLabel(source) + '消息',
        detail: [summarizeSubject(text, 40), saved.length ? '附件 ' + saved.length + ' 个' : '']
          .filter(Boolean)
          .join(' · '),
      })

      // 新信息进来，摘要和需求跟着更新；但不动 Case 标题
      if (text) {
        analyzeOne(messageId, ctx, { setTitle: false, priorSummary: existing.summary || '' }).catch((err) =>
          log('追加消息整理失败：', err && err.message),
        )
      }

      return sendJson(res, 200, { ok: true, messageId })
    }

    if (route === '/case/split' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const messageId = Number(body.messageId)
      if (!messageId) return sendJson(res, 400, { ok: false, error: '缺少 messageId' })
      const newCaseId = store.splitMessage(messageId)
      if (!newCaseId) return sendJson(res, 400, { ok: false, error: '只有包含多封邮件的事项才能拆' })
      return sendJson(res, 200, { ok: true, caseId: newCaseId })
    }

    if (route === '/case/restore' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id' })
      store.restoreCase(id)
      store.addRecord(id, { kind: 'status', action: '从回收站恢复' })
      return sendJson(res, 200, { ok: true })
    }

    // 手动修正摘要与需求（AI 写偏了、或历史数据要纠正时用）
    if (route === '/case/analysis' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const caseId = Number(body.caseId)
      if (!caseId) return sendJson(res, 400, { ok: false, error: '缺少 caseId' })
      store.setAnalysis(caseId, {
        summary: String(body.summary || ''),
        asks: Array.isArray(body.asks) ? body.asks : [],
        suggestions: Array.isArray(body.suggestions) ? body.suggestions : [],
      })
      store.addRecord(caseId, { kind: 'status', action: '手动修正摘要与需求' })
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/message/delete' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const messageId = Number(body.messageId)
      if (!messageId) return sendJson(res, 400, { ok: false, error: '缺少 messageId' })
      const removed = store.deleteMessage(messageId)
      if (!removed) return sendJson(res, 404, { ok: false, error: '消息不存在' })
      for (const file of removed.files || []) {
        try {
          const full = path.resolve(FILES_DIR, file)
          if (full.startsWith(path.resolve(FILES_DIR) + path.sep) && fs.existsSync(full)) fs.unlinkSync(full)
        } catch {
          // 文件删不掉不影响记录删除
        }
      }
      if (removed.caseId) {
        store.addRecord(removed.caseId, {
          kind: 'status',
          action: '删除了一条消息',
          detail: summarizeSubject(removed.subject, 40),
        })
      }
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/export' && method === 'GET') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const id = Number(url.searchParams.get('id'))
      const caseRow = store.getCase(id, true)
      if (!caseRow) return sendJson(res, 404, { ok: false, error: 'Case 不存在' })
      const markdown = caseMarkdown(store, caseRow)
      return sendDownload(res, (caseRow.title || 'case').replace(/[\\/:*?"<>|]/g, '_') + '.md', 'text/markdown', markdown)
    }

    if (route === '/export/all' && method === 'GET') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const cases = store.listCases({ status: 'all' }).concat(store.listCases({ status: 'deleted' }))
      const dump = {
        exportedAt: new Date().toISOString(),
        version: '0.6.3',
        cases: cases.map((caseRow) => ({
          ...caseRow,
          messages: store.messagesOfCase(caseRow.id),
          records: store.recordsOfCase(caseRow.id),
        })),
      }
      return sendDownload(
        res,
        'mail-cases-' + todayString() + '.json',
        'application/json',
        JSON.stringify(dump, null, 2),
      )
    }

    if (route === '/case/state' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      if (!id || !STATUSES.includes(body.status)) return sendJson(res, 400, { ok: false, error: '参数不完整' })
      store.setState(id, body.status)
      store.addRecord(id, {
        kind: 'status',
        status: body.status,
        action:
          body.status === 'done'
            ? '标记完成，移入「已完成」'
            : '状态改为「' + statusLabel(body.status) + '」',
      })
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/case/status' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      if (!id || !STATUSES.includes(body.status)) return sendJson(res, 400, { ok: false, error: '参数不完整' })
      store.setStatus(id, body.status)
      store.addRecord(id, { kind: 'status', status: body.status, action: '状态改为「' + statusLabel(body.status) + '」' })
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/case/pin' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id' })
      store.setPinned(id, body.pinned !== false)
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/case/record' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      const action = String(body.action || '').trim()
      if (!id || !action) return sendJson(res, 400, { ok: false, error: '请填写「做了什么」' })
      store.addRecord(id, {
        kind: 'manual',
        at: body.at ? new Date(body.at).toISOString() : nowIso(),
        status: body.status || '',
        action,
        detail: String(body.detail || '').trim(),
        nextStep: String(body.nextStep || '').trim(),
      })
      if (body.status && STATUSES.includes(body.status)) store.setState(id, body.status)
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/case/complete' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id' })
      const done = body.done !== false
      store.setArchived(id, done)
      store.addRecord(id, {
        kind: 'status',
        status: done ? 'done' : 'doing',
        action: done ? '标记完成，移入「已完成」' : '重新打开，移回「未完成」',
      })
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/case/delete' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id' })
      if (body.hard) {
        for (const file of store.attachmentFilesOfCase(id)) {
          try {
            const full = path.resolve(FILES_DIR, file)
            if (full.startsWith(path.resolve(FILES_DIR) + path.sep) && fs.existsSync(full)) fs.unlinkSync(full)
          } catch {
            // 文件删不掉不影响记录删除
          }
        }
        store.deleteCase(id)
      } else store.softDeleteCase(id)
      return sendJson(res, 200, { ok: true })
    }

    if (route === '/record/delete' && method === 'POST') {
      if (!store) return sendJson(res, 500, { ok: false, error: storageInfo().error })
      const body = await readJson(req)
      const id = Number(body.id)
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id' })
      store.deleteRecord(id)
      return sendJson(res, 200, { ok: true })
    }

    return sendJson(res, 404, { ok: false, error: '未知路由：' + route })
  } catch (err) {
    log('路由异常：', err)
    return sendJson(res, 500, { ok: false, error: err && err.message ? err.message : String(err) })
  }
}

function statusLabel (status) {
  return (
    { todo: '未开始', doing: '处理中', waiting: '等待客户', done: '已完成' }[status] || String(status || '')
  )
}

function sourceLabel (source) {
  return { email: '邮箱', wechat: '微信', qq: 'QQ', other: '其他' }[source] || '其他'
}

// ---------- 附件文件 ----------

const FILES_DIR = path.join(DATA_DIR, 'files')
const MAX_UPLOAD = 12 * 1024 * 1024

function saveUpload (caseId, file) {
  const raw = String((file && file.data) || '')
  const buffer = Buffer.from(raw, 'base64')
  if (!buffer.length) throw new Error('空文件：' + ((file && file.name) || ''))
  if (buffer.length > MAX_UPLOAD) throw new Error('单个文件不能超过 12MB：' + ((file && file.name) || ''))

  const dir = path.join(FILES_DIR, String(caseId))
  fs.mkdirSync(dir, { recursive: true })
  const safeName = String((file && file.name) || 'file')
    .replace(/[\\/:*?"<>|\r\n]/g, '_')
    .slice(-80) || 'file'
  const stored = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '-' + safeName
  fs.writeFileSync(path.join(dir, stored), buffer)
  return {
    file: path.join(String(caseId), stored),
    name: safeName,
    mime: String((file && file.mime) || 'application/octet-stream'),
    size: buffer.length,
  }
}

function caseMarkdown (store, caseRow) {
  const messages = store.messagesOfCase(caseRow.id)
  const records = store.recordsOfCase(caseRow.id)
  const lines = []
  lines.push('# ' + caseRow.title)
  lines.push('')
  lines.push('- 来源：' + sourceLabel(caseRow.source))
  lines.push('- 客户：' + (caseRow.customer || '—'))
  lines.push('- 日期：' + caseRow.primaryDate)
  lines.push('- 状态：' + statusLabel(caseRow.status))
  lines.push('')

  if (caseRow.summary) {
    lines.push('## 摘要')
    lines.push('')
    lines.push(caseRow.summary)
    lines.push('')
  }

  lines.push('## 内容')
  messages.forEach((mail, index) => {
    lines.push('')
    lines.push('### ' + (index + 1) + '. ' + (mail.subjectZh || mail.subject || '（无主题）'))
    lines.push('')
    lines.push('> ' + [mail.fromName, mail.fromAddr].filter(Boolean).join(' ') + ' · ' + mail.receivedAt)
    lines.push('')
    lines.push(mail.bodyText || '（空）')
    if (mail.bodyZh) {
      lines.push('')
      lines.push('**中文**')
      lines.push('')
      lines.push(mail.bodyZh)
    }
    if ((mail.attachments || []).length) {
      lines.push('')
      lines.push('附件：' + mail.attachments.map((item) => item.name).join('、'))
    }
  })

  if ((caseRow.asks || []).length) {
    lines.push('')
    lines.push('## 客户需要我们做什么')
    lines.push('')
    caseRow.asks.forEach((ask, index) => {
      lines.push(index + 1 + '. ' + ask.text + (ask.deadline ? '（截止 ' + ask.deadline + '）' : ''))
    })
  }

  if ((caseRow.suggestions || []).length) {
    lines.push('')
    lines.push('## 处理建议')
    lines.push('')
    caseRow.suggestions.forEach((item, index) => {
      lines.push(index + 1 + '. ' + item.text + (item.why ? '——' + item.why : ''))
    })
  }

  if (records.length) {
    lines.push('')
    lines.push('## 处理记录')
    lines.push('')
    records.forEach((record) => {
      lines.push('- ' + record.at + '　' + record.action + (record.detail ? '：' + record.detail : ''))
      if (record.nextStep) lines.push('  - 下一步：' + record.nextStep)
    })
  }

  lines.push('')
  return lines.join('\n')
}

function sendDownload (res, filename, contentType, body) {
  res.writeHead(200, {
    'content-type': contentType + '; charset=utf-8',
    'content-disposition':
      "attachment; filename=\"export\"; filename*=UTF-8''" + encodeURIComponent(filename),
    'cache-control': 'no-store',
  })
  res.end(body)
}

// ---------- 插件入口 ----------

export function apply (ctx) {
  state.ctx = ctx

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    state.store = new Store(DB_FILE)
    log('数据库就绪：', DB_FILE)
  } catch (err) {
    state.openError = err instanceof Error ? err : new Error(String(err))
    log('数据库不可用：', state.openError.message)
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/mail',
        handler: (req, res) => {
          handle(req, res).catch((err) => {
            log('未捕获异常：', err)
            sendJson(res, 500, { ok: false, error: String(err && err.message ? err.message : err) })
          })
        },
      }),
    'mail-cases: /mail routes',
  )

  try {
    ctx.effect(() => ctx.setInterval(tick, 60000), 'mail-cases: scheduler')
  } catch (err) {
    const timer = setInterval(tick, 60000)
    ctx.effect(() => () => clearInterval(timer), 'mail-cases: scheduler-fallback')
    log('定时器走兜底实现：', err && err.message)
  }

  Promise.resolve()
    .then(() => tick())
    .catch((err) => log('启动检查失败：', err && err.message))

  log('已挂载 /mail，数据目录：', DATA_DIR)
}
