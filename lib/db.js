// 数据层：本机单文件 SQLite（%LOCALAPPDATA%\dsh-mail-cases\cases.db）。
// 所有 SQL 都收敛在 Store 里，方便脱离 DSH 单独测。

import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
create table if not exists account (
  id integer primary key check (id = 1),
  provider text not null default 'netease',
  email text not null default '',
  authCode text not null default '',
  imapHost text not null default 'imap.qiye.163.com',
  imapPort integer not null default 993,
  syncDays integer not null default 30,
  scheduleTime text not null default '08:30',
  unreadOnly integer not null default 1,
  lastRunAt text,
  lastAttemptAt text default '',
  lastResult text default '',
  lastError text default '',
  uidValidity text default ''
);

create table if not exists cases (
  id integer primary key autoincrement,
  title text not null default '',
  threadKey text not null default '',
  customer text default '',
  source text not null default 'email',
  fromAddrs text default '',
  status text not null default 'todo',
  primaryDate text not null default '',
  lastActivityAt text not null default '',
  messageCount integer not null default 0,
  summary text default '',
  asks text default '[]',
  suggestions text default '[]',
  archivedAt text,
  deletedAt text,
  createdAt text not null,
  updatedAt text not null,
  searchText text default ''
);
create index if not exists cases_list on cases(deletedAt, archivedAt, lastActivityAt);

create table if not exists messages (
  id integer primary key autoincrement,
  mailbox text not null default 'INBOX',
  kind text not null default 'email',
  uid integer not null,
  uidValidity text not null default '',
  messageId text default '',
  subject text default '',
  fromName text default '',
  fromAddr text default '',
  toAddrs text default '',
  ccAddrs text default '',
  receivedAt text not null,
  size integer default 0,
  bodyText text default '',
  hasAttachments integer default 0,
  attachNames text default '[]',
  subjectZh text default '',
  bodyZh text default '',
  summary text default '',
  asks text default '[]',
  suggestions text default '[]',
  analysisState text default 'pending',
  analysisError text default '',
  caseId integer,
  createdAt text not null
);
create unique index if not exists messages_uid on messages(mailbox, uidValidity, uid);
create index if not exists messages_mid on messages(messageId);
create index if not exists messages_case on messages(caseId, receivedAt);

create table if not exists records (
  id integer primary key autoincrement,
  caseId integer not null,
  at text not null,
  kind text not null default 'manual',
  status text default '',
  action text default '',
  detail text default '',
  nextStep text default '',
  createdAt text not null
);
create index if not exists records_case on records(caseId, at);

create table if not exists attachments (
  id integer primary key autoincrement,
  caseId integer not null,
  messageId integer not null,
  name text default '',
  mime text default '',
  size integer default 0,
  file text default '',
  createdAt text not null
);
create index if not exists attachments_message on attachments(messageId);
`

export const STATUSES = ['todo', 'doing', 'waiting', 'done']

// 老库升级：SQLite 不支持 add column if not exists，只能自己看。
const MIGRATIONS = [
  ['account', 'unreadOnly', 'integer not null default 1'],
  ['cases', 'source', "text not null default 'email'"],
  ['messages', 'kind', "text not null default 'email'"],
  ['messages', 'source', "text not null default 'email'"],
  ['messages', 'subjectZh', "text default ''"],
  ['messages', 'bodyZh', "text default ''"],
  ['messages', 'summary', "text default ''"],
  ['messages', 'asks', "text default '[]'"],
  ['messages', 'suggestions', "text default '[]'"],
  ['messages', 'analysisState', "text default 'pending'"],
  ['messages', 'analysisError', "text default ''"],
]

const ACCOUNT_FIELDS = [
  'provider',
  'email',
  'authCode',
  'imapHost',
  'imapPort',
  'syncDays',
  'scheduleTime',
  'unreadOnly',
]

function nowIso () {
  return new Date().toISOString()
}

export class Store {
  constructor (file) {
    this.file = file
    this.db = new DatabaseSync(file)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA busy_timeout = 4000')
    this.db.exec(SCHEMA)
    for (const [table, column, ddl] of MIGRATIONS) {
      const exists = this.db
        .prepare('pragma table_info(' + table + ')')
        .all()
        .some((row) => row.name === column)
      if (!exists) this.db.exec('alter table ' + table + ' add column ' + column + ' ' + ddl)
    }
    const row = this.db.prepare('select id from account where id = 1').get()
    if (!row) this.db.prepare('insert into account (id) values (1)').run()
  }

  close () {
    try {
      this.db.close()
    } catch {
      // 关闭失败不影响退出
    }
  }

  // ---------- 账户 ----------

  getAccount () {
    return this.db.prepare('select * from account where id = 1').get() || null
  }

  saveAccount (patch) {
    const sets = []
    const values = []
    for (const key of ACCOUNT_FIELDS) {
      if (!(key in patch) || patch[key] === undefined) continue
      sets.push(key + ' = ?')
      values.push(patch[key])
    }
    if (!sets.length) return this.getAccount()
    this.db.prepare('update account set ' + sets.join(', ') + ' where id = 1').run(...values)
    return this.getAccount()
  }

  markRun ({ at, result }) {
    const stamp = at || nowIso()
    this.db
      .prepare("update account set lastRunAt = ?, lastAttemptAt = ?, lastResult = ?, lastError = '' where id = 1")
      .run(stamp, stamp, String(result || ''))
  }

  // 失败只记尝试时间，不动 lastRunAt：这样补跑逻辑还会继续尝试
  markFailure ({ at, error }) {
    this.db
      .prepare("update account set lastAttemptAt = ?, lastError = ?, lastResult = '失败' where id = 1")
      .run(at || nowIso(), String(error || ''))
  }

  // ---------- 去重 ----------

  knownMessageIds () {
    const rows = this.db.prepare("select messageId from messages where messageId <> ''").all()
    return new Set(rows.map((r) => String(r.messageId).toLowerCase()))
  }

  knownUids (mailbox, uidValidity) {
    const rows = this.db
      .prepare('select uid from messages where mailbox = ? and uidValidity = ?')
      .all(mailbox, String(uidValidity))
    return new Set(rows.map((r) => Number(r.uid)))
  }

  // 已经收过的发件域名：用来判断「是不是认识这个客户」。
  knownDomains () {
    const rows = this.db.prepare("select distinct fromAddr from messages where fromAddr like '%@%'").all()
    const set = new Set()
    for (const row of rows) {
      const domain = String(row.fromAddr || '').split('@')[1]
      if (domain) set.add(domain.toLowerCase().trim().replace(/[>)\s].*$/, ''))
    }
    return set
  }

  findByMessageId (messageId) {
    if (!messageId) return null
    return this.db
      .prepare('select * from messages where messageId = ? collate nocase limit 1')
      .get(String(messageId))
  }

  // ---------- 邮件 ----------

  insertMessage (msg) {
    const info = this.db
      .prepare(
        `insert or ignore into messages
          (mailbox, kind, source, uid, uidValidity, messageId, subject, fromName, fromAddr, toAddrs, ccAddrs,
           receivedAt, size, bodyText, hasAttachments, attachNames, caseId, createdAt)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        msg.mailbox || 'INBOX',
        msg.kind || 'email',
        msg.source || 'email',
        Number(msg.uid) || 0,
        String(msg.uidValidity || ''),
        String(msg.messageId || ''),
        String(msg.subject || ''),
        String(msg.fromName || ''),
        String(msg.fromAddr || ''),
        String(msg.toAddrs || ''),
        String(msg.ccAddrs || ''),
        String(msg.receivedAt || nowIso()),
        Number(msg.size) || 0,
        String(msg.bodyText || ''),
        msg.hasAttachments ? 1 : 0,
        JSON.stringify(msg.attachNames || []),
        msg.caseId ?? null,
        nowIso(),
      )
    // insert or ignore 命中唯一约束时 changes 为 0；此时 lastInsertRowid 仍是上一行的值，不能用它判断
    if (!info || !info.changes) return 0
    return Number(info.lastInsertRowid) || 0
  }

  messagesOfCase (caseId) {
    const rows = this.db
      .prepare('select * from messages where caseId = ? order by receivedAt asc, id asc')
      .all(caseId)
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind || 'email',
      source: r.source || 'email',
      subject: r.subject || '',
      subjectZh: r.subjectZh || '',
      fromName: r.fromName || '',
      fromAddr: r.fromAddr || '',
      toAddrs: r.toAddrs || '',
      ccAddrs: r.ccAddrs || '',
      receivedAt: r.receivedAt,
      size: r.size,
      bodyText: r.bodyText || '',
      bodyZh: r.bodyZh || '',
      summary: r.summary || '',
      asks: safeJson(r.asks, []),
      suggestions: safeJson(r.suggestions, []),
      analysisState: r.analysisState || 'pending',
      analysisError: r.analysisError || '',
      hasAttachments: !!r.hasAttachments,
      attachNames: safeJson(r.attachNames, []),
      attachments: this.attachmentsOfMessage(r.id),
    }))
  }

  // ---------- 附件 ----------

  // 删掉一条（手动追加的）消息；返回它的 Case 和需要清理的文件
  deleteMessage (messageId) {
    const row = this.db.prepare('select * from messages where id = ?').get(messageId)
    if (!row) return null
    const files = this.db
      .prepare('select file from attachments where messageId = ?')
      .all(messageId)
      .map((item) => item.file)
    this.db.prepare('delete from attachments where messageId = ?').run(messageId)
    this.db.prepare('delete from messages where id = ?').run(messageId)
    if (row.caseId) {
      this.syncCaseCount(row.caseId)
      this.recomputeCase(row.caseId)
    }
    return { caseId: row.caseId, subject: row.subject || '', files }
  }

  attachmentsOfMessage (messageId) {
    return this.db
      .prepare('select id, name, mime, size from attachments where messageId = ? order by id asc')
      .all(messageId)
  }

  addAttachment ({ caseId, messageId, name, mime, size, file }) {
    const info = this.db
      .prepare('insert into attachments (caseId, messageId, name, mime, size, file, createdAt) values (?,?,?,?,?,?,?)')
      .run(caseId, messageId, String(name || ''), String(mime || ''), Number(size) || 0, String(file || ''), nowIso())
    return Number(info.lastInsertRowid) || 0
  }

  getAttachment (id) {
    return this.db.prepare('select * from attachments where id = ?').get(id) || null
  }

  attachmentFilesOfCase (caseId) {
    return this.db.prepare('select file from attachments where caseId = ?').all(caseId).map((r) => r.file)
  }

  nextManualUid () {
    const row = this.db.prepare("select coalesce(max(uid), 0) as n from messages where mailbox = 'manual'").get()
    return Number(row.n || 0) + 1
  }

  // ---------- Case ----------

  createCase (fields) {
    const at = nowIso()
    const info = this.db
      .prepare(
        `insert into cases
          (title, threadKey, customer, source, fromAddrs, status, primaryDate, lastActivityAt,
           messageCount, summary, asks, suggestions, createdAt, updatedAt, searchText)
         values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        String(fields.title || ''),
        String(fields.threadKey || ''),
        String(fields.customer || ''),
        String(fields.source || 'email'),
        String(fields.fromAddrs || ''),
        STATUSES.includes(fields.status) ? fields.status : 'todo',
        String(fields.primaryDate || ''),
        String(fields.lastActivityAt || at),
        Number(fields.messageCount) || 0,
        String(fields.summary || ''),
        JSON.stringify(fields.asks || []),
        JSON.stringify(fields.suggestions || []),
        at,
        at,
        String(fields.searchText || '').toLowerCase(),
      )
    return Number(info.lastInsertRowid) || 0
  }

  touchCase (caseId, { activityAt, addMessages = 0, searchText }) {
    const sets = ['updatedAt = ?', 'messageCount = messageCount + ?', 'lastActivityAt = max(lastActivityAt, ?)']
    const values = [nowIso(), addMessages, String(activityAt || nowIso())]
    if (searchText) {
      sets.push('searchText = ?')
      values.push(String(searchText).toLowerCase())
    }
    values.push(caseId)
    this.db.prepare('update cases set ' + sets.join(', ') + ' where id = ?').run(...values)
  }

  findOpenCaseByThread (threadKey, fromAddr) {
    if (!threadKey) return null
    const domain = String(fromAddr || '').split('@')[1] || ''
    const row = this.db
      .prepare(
        `select * from cases
         where threadKey = ? and archivedAt is null and deletedAt is null
         order by lastActivityAt desc limit 1`,
      )
      .get(threadKey)
    if (!row) return null
    if (!domain) return row
    const rowDomain = String(row.fromAddrs || '').split('@')[1] || ''
    return rowDomain && rowDomain !== domain ? null : row
  }

  setCaseTitle (caseId, title) {
    if (!title) return
    this.db.prepare('update cases set title = ?, updatedAt = ? where id = ?').run(String(title), nowIso(), caseId)
  }

  setStatus (caseId, status) {
    if (!STATUSES.includes(status)) throw new Error('未知状态：' + status)
    this.db.prepare('update cases set status = ?, updatedAt = ? where id = ?').run(status, nowIso(), caseId)
  }

  setArchived (caseId, archived) {
    const at = nowIso()
    if (archived) {
      this.db.prepare("update cases set archivedAt = ?, status = 'done', updatedAt = ? where id = ?").run(at, at, caseId)
    } else {
      this.db.prepare("update cases set archivedAt = null, status = 'doing', updatedAt = ? where id = ?").run(at, caseId)
    }
  }

  setAnalysis (caseId, { summary, asks, suggestions, title }) {
    const sets = ['updatedAt = ?', 'summary = ?', 'asks = ?', 'suggestions = ?']
    const values = [nowIso(), String(summary || ''), JSON.stringify(asks || []), JSON.stringify(suggestions || [])]
    if (title) {
      sets.push('title = ?')
      values.push(String(title))
    }
    values.push(caseId)
    this.db.prepare('update cases set ' + sets.join(', ') + ' where id = ?').run(...values)
  }

  softDeleteCase (caseId) {
    const at = nowIso()
    this.db.prepare('update cases set deletedAt = ?, updatedAt = ? where id = ?').run(at, at, caseId)
  }

  deleteCase (caseId) {
    this.db.prepare('delete from records where caseId = ?').run(caseId)
    this.db.prepare('delete from attachments where caseId = ?').run(caseId)
    this.db.prepare('delete from messages where caseId = ?').run(caseId)
    this.db.prepare('delete from cases where id = ?').run(caseId)
  }

  restoreCase (caseId) {
    this.db.prepare('update cases set deletedAt = null, updatedAt = ? where id = ?').run(nowIso(), caseId)
  }

  getCase (caseId, includeDeleted = false) {
    const row = includeDeleted
      ? this.db.prepare('select * from cases where id = ?').get(caseId)
      : this.db.prepare('select * from cases where id = ? and deletedAt is null').get(caseId)
    if (!row) return null
    return decorateCase(row)
  }

  // 把一封邮件拆成独立的 Case（误合并时的补救）
  splitMessage (messageId) {
    const row = this.db.prepare('select * from messages where id = ?').get(messageId)
    if (!row || !row.caseId) return null
    const oldCase = this.db.prepare('select * from cases where id = ?').get(row.caseId)
    const siblingCount = this.db
      .prepare('select count(*) as n from messages where caseId = ?')
      .get(row.caseId)
    if (!oldCase || Number(siblingCount.n) < 2) return null

    const when = new Date(row.receivedAt || nowIso())
    const label = row.subjectZh || row.subject || '（无主题）'
    const title = shortDateText(when) + ' ' + trimText(label, 42)
    const newCaseId = this.createCase({
      title,
      threadKey: '',
      customer: row.fromName || String(row.fromAddr || '').split('@')[1] || '',
      source: oldCase.source || 'email',
      fromAddrs: row.fromAddr || '',
      status: 'todo',
      primaryDate: dateKeyOf(when),
      lastActivityAt: row.receivedAt || nowIso(),
      messageCount: 1,
      searchText: [title, row.fromAddr || '', row.bodyText || ''].join(' ').slice(0, 6000),
    })

    this.db.prepare('update messages set caseId = ? where id = ?').run(newCaseId, messageId)
    this.db.prepare('update attachments set caseId = ? where messageId = ?').run(newCaseId, messageId)
    this.syncCaseCount(newCaseId)
    this.syncCaseCount(row.caseId)
    this.addRecord(newCaseId, {
      kind: 'status',
      action: '从原 Case 拆出',
      detail: '原 Case：' + (oldCase.title || ''),
    })
    this.addRecord(row.caseId, {
      kind: 'status',
      action: '拆出一封邮件到新 Case',
      detail: trimText(String(row.subject || ''), 60),
    })
    this.recomputeCase(newCaseId)
    this.recomputeCase(row.caseId)
    return newCaseId
  }

  syncCaseCount (caseId) {
    this.db
      .prepare(
        'update cases set messageCount = (select count(*) from messages where caseId = ?), updatedAt = ? where id = ?',
      )
      .run(caseId, nowIso(), caseId)
  }

  listCases ({ status, q, from, to, sort } = {}) {
    const where = []
    const params = []

    if (status === 'deleted') where.push('c.deletedAt is not null')
    else where.push('c.deletedAt is null')

    if (status === 'open') where.push('c.archivedAt is null')
    else if (status === 'done') where.push('c.archivedAt is not null')
    else if (status && STATUSES.includes(status)) {
      where.push('c.status = ?')
      params.push(status)
    }

    if (q) {
      const like = '%' + String(q).toLowerCase() + '%'
      where.push('(c.searchText like ? or exists (select 1 from messages m where m.caseId = c.id and lower(m.bodyText) like ?))')
      params.push(like, like)
    }
    if (from) {
      where.push('c.primaryDate >= ?')
      params.push(String(from))
    }
    if (to) {
      where.push('c.primaryDate <= ?')
      params.push(String(to))
    }

    let order = 'c.lastActivityAt desc, c.id desc'
    if (sort === 'received') order = 'c.primaryDate desc, c.lastActivityAt desc, c.id desc'
    else if (sort === 'status') {
      order =
        "case c.status when 'doing' then 0 when 'todo' then 1 when 'waiting' then 2 else 3 end asc, c.lastActivityAt desc, c.id desc"
    }

    const rows = this.db
      .prepare(
        `select c.*,
                (select count(*) from records r where r.caseId = c.id) as recordCount,
                (select count(*) from messages m where m.caseId = c.id) as msgCount,
                (select count(*) from messages m where m.caseId = c.id and m.analysisState <> 'done') as pendingCount
         from cases c
         where ${where.join(' and ')}
         order by ${order}
         limit 500`,
      )
      .all(...params)

    return rows.map(decorateCase)
  }

  counts () {
    const row = this.db
      .prepare(
        `select
           sum(case when deletedAt is null and archivedAt is null then 1 else 0 end) as open,
           sum(case when deletedAt is null and archivedAt is not null then 1 else 0 end) as done,
           sum(case when deletedAt is null and primaryDate = ? then 1 else 0 end) as today
         from cases`,
      )
      .get(todayString())
    return { open: Number(row.open || 0), done: Number(row.done || 0), today: Number(row.today || 0) }
  }

  // ---------- 分析结果 ----------

  updateMessageAnalysis (messageId, result) {
    this.db
      .prepare(
        `update messages set
           subjectZh = ?, bodyZh = ?, summary = ?, asks = ?, suggestions = ?,
           analysisState = ?, analysisError = ?
         where id = ?`,
      )
      .run(
        String(result.subjectZh || ''),
        String(result.bodyZh || ''),
        String(result.summary || ''),
        JSON.stringify(result.asks || []),
        JSON.stringify(result.suggestions || []),
        String(result.state || 'done'),
        String(result.error || ''),
        messageId,
      )
  }

  // 失败时只改状态，不覆盖已经拿到的译文
  setAnalysisState (messageId, state, error) {
    this.db
      .prepare('update messages set analysisState = ?, analysisError = ? where id = ?')
      .run(String(state || 'pending'), String(error || ''), messageId)
  }

  pendingMessages (limit = 20) {
    return this.db
      .prepare("select id, caseId from messages where analysisState = 'pending' order by receivedAt asc limit ?")
      .all(limit)
  }

  messageForAnalysis (messageId) {
    const row = this.db.prepare('select * from messages where id = ?').get(messageId)
    if (!row) return null
    return {
      id: row.id,
      caseId: row.caseId,
      subject: row.subject || '',
      fromName: row.fromName || '',
      fromAddr: row.fromAddr || '',
      receivedAt: row.receivedAt,
      bodyText: row.bodyText || '',
      hasAttachments: !!row.hasAttachments,
      attachNames: safeJson(row.attachNames, []),
    }
  }

  // 一个 Case 里多封邮件：需求清单与建议按文本去重合并，摘要取最新一封
  recomputeCase (caseId) {
    const rows = this.db
      .prepare(
        `select id, subject, bodyText, subjectZh, bodyZh, summary, asks, suggestions
         from messages where caseId = ? order by receivedAt asc, id asc`,
      )
      .all(caseId)
    if (!rows.length) return

    const asks = []
    const suggestions = []
    const seenAsk = new Set()
    const seenSuggestion = new Set()
    let summary = ''

    for (const row of rows) {
      if (row.summary) summary = row.summary
      for (const item of safeJson(row.asks, [])) {
        const key = dedupeKey(item && item.text)
        if (!key || seenAsk.has(key)) continue
        seenAsk.add(key)
        asks.push({ text: String(item.text || ''), owner: item.owner || 'us', deadline: item.deadline || '' })
      }
      for (const item of safeJson(row.suggestions, [])) {
        const key = dedupeKey(item && item.text)
        if (!key || seenSuggestion.has(key)) continue
        seenSuggestion.add(key)
        suggestions.push({ text: String(item.text || ''), why: item.why || '' })
      }
    }

    const caseRow = this.db.prepare('select title, customer, fromAddrs from cases where id = ?').get(caseId)
    // 多封合并时最容易变成一屏几百条：留最新的，砍掉旧的重复项
    const trimmedAsks = asks.length > 10 ? asks.slice(-10) : asks
    const trimmedSuggestions = suggestions.length > 6 ? suggestions.slice(-6) : suggestions
    const searchText = [
      caseRow ? caseRow.title : '',
      caseRow ? caseRow.customer : '',
      caseRow ? caseRow.fromAddrs : '',
      ...rows.map((row) => [row.subject, row.subjectZh, (row.bodyText || '').slice(0, 2000), row.bodyZh].join(' ')),
    ]
      .join(' ')
      .toLowerCase()

    this.db
      .prepare(
        'update cases set summary = ?, asks = ?, suggestions = ?, searchText = ?, messageCount = ?, updatedAt = ? where id = ?',
      )
      .run(
        summary,
        JSON.stringify(trimmedAsks),
        JSON.stringify(trimmedSuggestions),
        searchText,
        rows.length,
        nowIso(),
        caseId,
      )
  }

  // 清空要"重来"：连 lastRunAt / uidValidity 一起清掉，
  // 否则下次整理只从刚才那一刻往后找，等于什么都不抓。
  clearAll () {
    this.db.exec('delete from records; delete from messages; delete from cases;')
    this.db
      .prepare(
        "update account set lastRunAt = null, lastAttemptAt = '', lastResult = '', lastError = '', uidValidity = '' where id = 1",
      )
      .run()
  }

  // ---------- 记录 ----------

  addRecord (caseId, fields) {
    const at = fields.at || nowIso()
    const info = this.db
      .prepare(
        'insert into records (caseId, at, kind, status, action, detail, nextStep, createdAt) values (?,?,?,?,?,?,?,?)',
      )
      .run(
        caseId,
        at,
        String(fields.kind || 'manual'),
        String(fields.status || ''),
        String(fields.action || ''),
        String(fields.detail || ''),
        String(fields.nextStep || ''),
        nowIso(),
      )
    this.db.prepare('update cases set lastActivityAt = max(lastActivityAt, ?), updatedAt = ? where id = ?').run(at, nowIso(), caseId)
    return Number(info.lastInsertRowid) || 0
  }

  recordsOfCase (caseId) {
    return this.db
      .prepare('select * from records where caseId = ? order by at desc, id desc')
      .all(caseId)
      .map((r) => ({
        id: r.id,
        at: r.at,
        kind: r.kind,
        status: r.status || '',
        action: r.action || '',
        detail: r.detail || '',
        nextStep: r.nextStep || '',
      }))
  }

  deleteRecord (recordId) {
    this.db.prepare('delete from records where id = ?').run(recordId)
  }
}

function decorateCase (row) {
  return {
    id: row.id,
    title: row.title || '',
    threadKey: row.threadKey || '',
    customer: row.customer || '',
    source: row.source || 'email',
    fromAddrs: row.fromAddrs || '',
    status: row.status || 'todo',
    primaryDate: row.primaryDate || '',
    lastActivityAt: row.lastActivityAt || '',
    messageCount: Number(row.messageCount || 0),
    msgCount: Number(row.msgCount ?? row.messageCount ?? 0),
    pendingCount: Number(row.pendingCount || 0),
    recordCount: Number(row.recordCount || 0),
    summary: row.summary || '',
    asks: safeJson(row.asks, []),
    suggestions: safeJson(row.suggestions, []),
    archivedAt: row.archivedAt || null,
    deletedAt: row.deletedAt || null,
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  }
}

export function dateKeyOf (date) {
  const d = date instanceof Date ? date : new Date(date)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function shortDateText (date) {
  const d = date instanceof Date ? date : new Date(date)
  return String(d.getFullYear()).slice(2) + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0')
}

export function trimText (text, max = 42) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  return clean.length > max ? clean.slice(0, max) + '…' : clean
}

function safeJson (text, fallback) {
  if (!text) return fallback
  try {
    const value = JSON.parse(text)
    return value ?? fallback
  } catch {
    return fallback
  }
}

function dedupeKey (text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s，。、；：,.;:!?！？"'“”‘’()（）\-—_]/g, '')
    .slice(0, 120)
}

export function todayString (date = new Date()) {
  const d = date
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}
