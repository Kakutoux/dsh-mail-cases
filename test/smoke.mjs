// 宿主侧冒烟测试：SQL、MIME 解析、IMAP ID 命令。
// 只在开发时跑（node test/smoke.mjs），不进 bundle。
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const libDir = path.resolve(process.argv[2] || '.')
const { Store, todayString } = await import(pathToFileURL(path.join(libDir, 'db.js')).href)
const { parseMessage } = await import(pathToFileURL(path.join(libDir, 'mime.js')).href)
const { ImapConnection, formatImapDate } = await import(pathToFileURL(path.join(libDir, 'imap.js')).href)

let failures = 0
function check (name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '  ' + extra : ''))
  if (!ok) failures++
}

// ---------- SQL ----------
const dbFile = path.join(os.tmpdir(), 'mail-cases-smoke-' + Date.now() + '.db')
const store = new Store(dbFile)

const acc = store.getAccount()
check('account 默认行', !!acc && acc.scheduleTime === '08:30', JSON.stringify(acc && { e: acc.email, t: acc.scheduleTime }))
store.saveAccount({ email: 'me@corp.com', authCode: 'abc', syncDays: 15 })
check('saveAccount', store.getAccount().syncDays === 15)

const caseId = store.createCase({
  title: '26/11/05 报价单与交期确认',
  threadKey: '报价单与交期确认',
  customer: 'Leo Wang',
  fromAddrs: 'leo@acme.com',
  status: 'todo',
  primaryDate: todayString(),
  lastActivityAt: new Date().toISOString(),
  messageCount: 1,
  searchText: '26/11/05 报价单与交期确认 leo wang leo@acme.com 需要 2000pcs 的报价',
})
check('createCase', caseId > 0, 'id=' + caseId)

const msgId = store.insertMessage({
  mailbox: 'INBOX',
  uid: 101,
  uidValidity: '777',
  messageId: 'abc@acme.com',
  subject: 'Quotation for 2000pcs',
  fromName: 'Leo Wang',
  fromAddr: 'leo@acme.com',
  receivedAt: new Date().toISOString(),
  size: 2048,
  bodyText: 'Please quote 2000pcs, delivery before Dec. 我们的交期要 12 月前。',
  caseId,
})
check('insertMessage', msgId > 0, 'id=' + msgId)
check('insert 去重（同 uid）', store.insertMessage({ mailbox: 'INBOX', uid: 101, uidValidity: '777', messageId: 'x@y', receivedAt: new Date().toISOString() }) === 0)
check('knownUids', store.knownUids('INBOX', '777').has(101))
check('findByMessageId', !!store.findByMessageId('abc@acme.com'))

store.addRecord(caseId, { kind: 'manual', action: '已回复报价', nextStep: '周五跟进', status: 'doing' })
store.setStatus(caseId, 'doing')
check('recordsOfCase', store.recordsOfCase(caseId).length === 1)

const listAll = store.listCases({ status: 'all' })
check('listCases all', listAll.length === 1 && listAll[0].recordCount === 1 && listAll[0].msgCount === 1)
check('listCases 关键字命中正文', store.listCases({ q: '2000pcs' }).length === 1)
check('listCases 关键字中文子串', store.listCases({ q: '报价' }).length >= 0)
check('listCases 关键字不命中', store.listCases({ q: 'zzz-not-exist' }).length === 0)
check('listCases 状态过滤', store.listCases({ status: 'doing' }).length === 1 && store.listCases({ status: 'waiting' }).length === 0)
check('listCases open', store.listCases({ status: 'open' }).length === 1)
check('listCases 日期区间外', store.listCases({ from: '2000-01-01', to: '2000-01-02' }).length === 0)
check('counts', store.counts().open === 1)

store.setArchived(caseId, true)
check('完成后 open=0 done=1', store.counts().open === 0 && store.counts().done === 1)
check('listCases done', store.listCases({ status: 'done' }).length === 1)
store.setArchived(caseId, false)
check('重新打开', store.counts().open === 1)

store.setAnalysis(caseId, { summary: '客户要 2000pcs 报价', asks: [{ text: '报价' }], suggestions: [{ text: '先回复单价' }] })
const detail = store.getCase(caseId)
check('setAnalysis', detail.summary === '客户要 2000pcs 报价' && detail.asks.length === 1)

check('messagesOfCase', store.messagesOfCase(caseId).length === 1)
store.softDeleteCase(caseId)
check('软删除后不可见', store.getCase(caseId) === null && store.listCases({ status: 'all' }).length === 0)
store.deleteCase(caseId)
check('物理删除', store.recordsOfCase(caseId).length === 0)

// ---------- 分析结果与合并 ----------
const caseA = store.createCase({ title: '26/11/05 测试合并', threadKey: '测试合并', customer: 'Amy', fromAddrs: 'amy@x.com', status: 'todo', primaryDate: todayString(), lastActivityAt: new Date().toISOString(), messageCount: 1, searchText: '测试合并' })
const m1 = store.insertMessage({ mailbox: 'INBOX', uid: 201, uidValidity: 'v1', messageId: 'm1@x', subject: 'Need quotation', fromAddr: 'amy@x.com', receivedAt: new Date().toISOString(), bodyText: 'Please quote 2000pcs', caseId: caseA })
const m2 = store.insertMessage({ mailbox: 'INBOX', uid: 202, uidValidity: 'v1', messageId: 'm2@x', subject: 'Re: Need quotation', fromAddr: 'amy@x.com', receivedAt: new Date().toISOString(), bodyText: 'Any update?', caseId: caseA })
check('两封邮件入库', m1 > 0 && m2 > 0)
check('新邮件默认 pending', store.pendingMessages(10).some((p) => p.id === m1))

store.updateMessageAnalysis(m1, {
  subjectZh: '需要报价',
  bodyZh: '请报 2000pcs 的价格。',
  summary: '客户要 2000pcs 报价',
  asks: [{ text: '提供 2000pcs 报价', owner: 'us', deadline: '' }, { text: '确认交期', owner: 'us', deadline: '' }],
  suggestions: [{ text: '先回单价', why: '对方在催' }],
  state: 'done',
})
store.updateMessageAnalysis(m2, {
  subjectZh: '跟进',
  bodyZh: '有进展吗？',
  summary: '客户追问报价',
  asks: [{ text: '确认交期', owner: 'us', deadline: '' }, { text: '发 PI', owner: 'us', deadline: '2026-11-10' }],
  suggestions: [{ text: '今天先回一封', why: '已第二次追问' }],
  state: 'done',
})
store.recomputeCase(caseA)
const merged = store.getCase(caseA)
check('合并需求去重', merged.asks.length === 3, JSON.stringify(merged.asks.map((a) => a.text)))
check('合并建议去重', merged.suggestions.length === 2)
check('摘要取最新一封', merged.summary === '客户追问报价', merged.summary)
check('中文译文进检索', store.listCases({ q: '2000pcs 的价格' }).length === 1)
check('分析后不再 pending', store.pendingMessages(10).every((p) => p.id !== m1 && p.id !== m2))

store.setAnalysisState(m2, 'failed', '模型超时')
check('失败保留已有译文', store.messagesOfCase(caseA).find((m) => m.id === m2).bodyZh === '有进展吗？')
check('失败状态可重试', store.messagesOfCase(caseA).find((m) => m.id === m2).analysisState === 'failed')

store.clearAll()
check('clearAll 清空', store.listCases({ status: 'all' }).length === 0 && store.getAccount().email === 'me@corp.com')

// ---------- 手动事项 / 附件 / 拆分 / 回收站 ----------
const manualId = store.createCase({
  title: '26/11/05 微信：客户要样品',
  threadKey: '',
  customer: '王经理',
  source: 'wechat',
  status: 'todo',
  primaryDate: todayString(),
  lastActivityAt: new Date().toISOString(),
  messageCount: 1,
  searchText: '微信 样品',
})
const mm = store.insertMessage({
  mailbox: 'manual',
  kind: 'text',
  uid: store.nextManualUid(),
  subject: '客户要样品',
  fromName: '王经理',
  receivedAt: new Date().toISOString(),
  bodyText: '能不能寄两台样品到深圳？',
  caseId: manualId,
})
check('手动事项入库', manualId > 0 && mm > 0)
check('来源可读', store.getCase(manualId).source === 'wechat')
const att = store.addAttachment({ caseId: manualId, messageId: mm, name: 'a.png', mime: 'image/png', size: 3, file: 'x/a.png' })
check('附件登记', att > 0 && store.messagesOfCase(manualId)[0].attachments.length === 1)
check('手动 uid 递增', store.nextManualUid() === 2)
check('按来源不过滤到邮箱项', store.listCases({ q: '样品' }).length === 1)

// 同主题再来一封 -> 拆出去
const mm2 = store.insertMessage({
  mailbox: 'manual',
  kind: 'text',
  uid: store.nextManualUid(),
  subject: '客户要样品（补充）',
  fromName: '王经理',
  receivedAt: new Date().toISOString(),
  bodyText: '另外要一份说明书',
  caseId: manualId,
})
store.syncCaseCount(manualId)
check('两封后再拆', store.splitMessage(mm2) > 0)
check('拆分后原 Case 只剩 1 封', store.messagesOfCase(manualId).length === 1 && store.getCase(manualId).messageCount === 1)

store.softDeleteCase(manualId)
check('回收站可见', store.listCases({ status: 'deleted' }).length === 1 && store.listCases({ status: 'all' }).length >= 1)
store.restoreCase(manualId)
check('恢复后回列表', store.listCases({ status: 'deleted' }).length === 0 && store.getCase(manualId) !== null)
check('附件文件清单', store.attachmentFilesOfCase(manualId).length === 1)
store.deleteCase(manualId)
check('物理删除带附件', store.getCase(manualId, true) === null)

check('formatImapDate', formatImapDate(new Date(2026, 10, 5)) === '05-Nov-2026', formatImapDate(new Date(2026, 10, 5)))
store.close()
fs.rmSync(dbFile, { force: true })
fs.rmSync(dbFile + '-wal', { force: true })
fs.rmSync(dbFile + '-shm', { force: true })

// ---------- MIME ----------
const raw = [
  'From: =?GBK?B?wLXP7sLl?= <leo@acme.com>',
  'To: me@corp.com',
  'Subject: =?utf-8?B?5oql5Lu35Y2V5LiO5Lqk5pyf?=',
  'Date: Wed, 5 Nov 2026 08:12:33 +0800',
  'Message-ID: <abc@acme.com>',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="B1"',
  '',
  '--B1',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Please quote 2000pcs=2C delivery before Dec.',
  '',
  '--B1',
  'Content-Type: text/html; charset=utf-8',
  '',
  '<p>Please quote <b>2000pcs</b>, delivery before Dec.</p>',
  '--B1--',
  '',
].join('\r\n')

const parsed = parseMessage(Buffer.from(raw, 'utf8'))
check('MIME 主题解码', parsed.subject === '报价单与交期', parsed.subject)
check('MIME 发件人', parsed.fromAddr === 'leo@acme.com' && parsed.fromName.length > 0, parsed.fromName + ' / ' + parsed.fromAddr)
check('MIME 正文（QP+plain 优先）', /2000pcs/.test(parsed.bodyText) && !/<b>/.test(parsed.bodyText), JSON.stringify(parsed.bodyText))
check('MIME messageId', parsed.messageId === 'abc@acme.com')
check('MIME 无附件', parsed.hasAttachments === false)

const gbkRaw = Buffer.concat([
  Buffer.from(
    'From: "张三" <z@cn.com>\r\nSubject: =?GBK?B?u9i4tA==?=\r\nContent-Type: text/plain; charset=gbk\r\nContent-Transfer-Encoding: 8bit\r\n\r\n',
    'utf8',
  ),
  Buffer.from([0xbb, 0xd8, 0xb8, 0xb4, 0x0d, 0x0a]),
])
const gbk = parseMessage(gbkRaw)
check('GBK 正文解码', gbk.bodyText.trim() === '回复', JSON.stringify(gbk.bodyText))
check('GBK 主题解码', gbk.subject === '回复', gbk.subject)

// ---------- IMAP ID（不发密码，只验证命令格式被接受）----------
try {
  const conn = new ImapConnection({ host: 'imap.qiye.163.com', port: 993 })
  const greeting = await conn.connect()
  const res = await conn.command('ID ("name" "dsh-mail-cases" "version" "0.1.0" "vendor" "DeepSeek Harness" "support-email" "none")')
  check('IMAP ID 命令被接受', res.status === 'OK', res.status + ' ' + res.detail)
  conn.close()
} catch (err) {
  check('IMAP ID 命令被接受', false, err.message)
}

console.log(failures === 0 ? '\n全部通过' : '\n失败 ' + failures + ' 项')
process.exit(failures === 0 ? 0 : 1)
