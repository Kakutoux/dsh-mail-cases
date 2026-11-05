// 极简 IMAP 客户端：只做「登录 → 按日期搜 → 取头 → 取正文 → 退出」这一条线。
// 不引第三方库，避免给 profile 增加依赖；协议面窄，出错也看得懂。

import tls from 'node:tls'

const CRLF = '\r\n'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export class ImapError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'ImapError'
    this.code = code || 'IMAP_ERROR'
  }
}

function quote (value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

export function formatImapDate (date) {
  const d = date instanceof Date ? date : new Date(date)
  return String(d.getDate()).padStart(2, '0') + '-' + MONTHS[d.getMonth()] + '-' + d.getFullYear()
}

function parseInternalDate (text) {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(String(text).trim())
  if (!m) {
    const fallback = new Date(text)
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback
  }
  const month = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase())
  const utc = Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]))
  const offset = (m[7] === '-' ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9])) * 60000
  return new Date(utc - offset)
}

function mapLoginError (detail, email) {
  const text = String(detail || '')
  const upper = text.toUpperCase()
  if (/REQCODE|NEED.*AUTH.*CODE|授权码/.test(upper) || /授权码/.test(text)) {
    return new ImapError(
      '需要「客户端授权码」而不是登录密码。请到邮箱网页端：设置 → 账户与安全 → 客户端设置 → 生成授权码，再填到这里。',
      'EAUTHCODE',
    )
  }
  if (/PERMDENY|PERMISSION|DISABLED|NOT ENABLE/.test(upper)) {
    return new ImapError(
      'IMAP 协议没有开启。请在邮箱后台（管理员与成员两侧）开启 IMAP/SMTP 服务后重试。',
      'EPERMDENY',
    )
  }
  if (/PASSERR|PASSWORD|AUTHENTICATIONFAILED|INVALID CREDENTIALS|LOGIN FAILED/.test(upper)) {
    return new ImapError('账号或授权码不正确（' + email + '）。', 'EPASSERR')
  }
  if (/DOMAINNOTEXIST|DOMAINNOTFOUND|NO SUCH DOMAIN/.test(upper)) {
    return new ImapError(
      '这个域名没有对应的邮箱账号：请确认邮箱地址写全（含 @ 域名），且该域名已开通网易企业邮箱。',
      'EDOMAIN',
    )
  }
  return new ImapError('登录被拒绝：' + (text || '未知原因'), 'ELOGIN')
}

export class ImapConnection {
  constructor ({ host, port = 993, timeout = 20000 }) {
    this.host = host
    this.port = port
    this.timeout = timeout
    this.seq = 0
    this.socket = null
    this.closed = false
    this.buffer = Buffer.alloc(0)
    this.units = []
    this.pending = null
    this.readingLiteral = false
    this.literalNeed = 0
  }

  // ---------- 连接 ----------

  connect () {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn, arg) => {
        if (settled) return
        settled = true
        fn(arg)
      }
      const socket = tls.connect({ host: this.host, port: this.port, servername: this.host })
      this.socket = socket

      socket.setTimeout(this.timeout, () => {
        const err = new ImapError('连接邮箱超时（' + this.host + '）', 'ETIMEOUT')
        finish(reject, err)
        socket.destroy()
      })
      socket.once('secureConnect', () => finish(resolve))
      socket.on('error', (err) => {
        this.closed = true
        finish(reject, new ImapError('无法连接邮箱 ' + this.host + '：' + (err.code || err.message), 'ENETWORK'))
        this._failPending(err)
      })
      socket.on('close', () => {
        this.closed = true
        this._failPending(new ImapError('邮箱连接已断开', 'ECLOSED'))
      })
      socket.on('data', (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk])
        this._feed()
      })
    }).then(async () => {
      const greeting = await this._next()
      if (!greeting || greeting.type !== 'line' || !/^\*\s+(OK|PREAUTH)/i.test(greeting.text)) {
        throw new ImapError('邮箱没有正常响应：' + (greeting && greeting.text ? greeting.text : '空响应'), 'EGREETING')
      }
      return greeting.text
    })
  }

  _failPending (err) {
    if (this.pending) {
      const pending = this.pending
      this.pending = null
      pending.reject(err instanceof Error ? err : new ImapError(String(err), 'ECLOSED'))
    }
  }

  _feed () {
    for (;;) {
      if (!this.readingLiteral) {
        const index = this.buffer.indexOf(CRLF)
        if (index < 0) break
        const line = this.buffer.subarray(0, index).toString('utf8')
        this.buffer = this.buffer.subarray(index + 2)
        this.units.push({ type: 'line', text: line })
        const literal = /\{(\d+)\}$/.exec(line)
        if (literal) {
          this.readingLiteral = true
          this.literalNeed = Number(literal[1])
        }
      } else {
        if (this.buffer.length < this.literalNeed) break
        const data = this.buffer.subarray(0, this.literalNeed)
        this.buffer = this.buffer.subarray(this.literalNeed)
        this.units.push({ type: 'literal', data })
        this.readingLiteral = false
        this.literalNeed = 0
      }
    }
    if (this.pending && this.units.length) {
      const pending = this.pending
      this.pending = null
      pending.resolve(this.units.shift())
    }
  }

  _next () {
    if (this.units.length) return Promise.resolve(this.units.shift())
    if (this.closed) return Promise.reject(new ImapError('邮箱连接已断开', 'ECLOSED'))
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject }
    })
  }

  // ---------- 命令 ----------

  async command (text) {
    if (!this.socket || this.closed) throw new ImapError('邮箱连接已断开', 'ECLOSED')
    const tag = 'a' + ++this.seq
    this.socket.write(tag + ' ' + text + CRLF)

    const entries = []
    const lines = []
    for (;;) {
      const unit = await this._next()
      entries.push(unit)
      if (unit.type === 'literal') continue
      const line = unit.text
      if (line.startsWith(tag + ' ')) {
        const rest = line.slice(tag.length + 1)
        return {
          status: rest.slice(0, 2).toUpperCase(),
          detail: rest.slice(3).trim(),
          lines,
          entries,
        }
      }
      lines.push(line)
    }
  }

  // 网易/Coremail 在没收到合规 ID 时会拒绝 SELECT（Unsafe Login）。
  // 个别服务器不支持 ID，回了 BAD 也不影响后续。
  async identify () {
    try {
      await this.command(
        'ID ("name" "dsh-mail-cases" "version" "0.1.0" "vendor" "DeepSeek Harness" "support-email" "none")',
      )
    } catch {
      // 忽略
    }
  }

  async login (email, authCode) {
    const res = await this.command('LOGIN ' + quote(email) + ' ' + quote(authCode))
    if (res.status !== 'OK') throw mapLoginError(res.detail, email)
  }

  async select (mailbox = 'INBOX') {
    const res = await this.command('SELECT ' + quote(mailbox))
    if (res.status !== 'OK') throw new ImapError('打开「' + mailbox + '」失败：' + res.detail, 'ESELECT')
    const joined = res.lines.join('\n')
    const exists = /\*\s+(\d+)\s+EXISTS/.exec(joined)
    const uidValidity = /UIDVALIDITY\s+(\d+)/.exec(joined)
    return {
      exists: exists ? Number(exists[1]) : 0,
      uidValidity: uidValidity ? uidValidity[1] : '',
    }
  }

  async searchSince (date, options = {}) {
    const criteria = ['SINCE ' + formatImapDate(date)]
    if (options.unseen) criteria.push('UNSEEN')
    const res = await this.command('UID SEARCH ' + criteria.join(' '))
    if (res.status !== 'OK') throw new ImapError('搜索邮件失败：' + res.detail, 'ESEARCH')
    const line = res.lines.find((l) => /^\*\s+SEARCH/i.test(l))
    if (!line) return []
    return line
      .replace(/^\*\s+SEARCH\s*/i, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0)
  }

  // 只取头，用来判断要不要下载正文
  async fetchHeaders (uids) {
    const out = []
    for (let i = 0; i < uids.length; i += 40) {
      const chunk = uids.slice(i, i + 40)
      const res = await this.command(
        'UID FETCH ' +
          chunk.join(',') +
          ' (UID INTERNALDATE RFC822.SIZE FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)])',
      )
      out.push(...parseFetch(res.entries))
    }
    return out
  }

  async fetchBody (uid) {
    const res = await this.command('UID FETCH ' + uid + ' (BODY.PEEK[])')
    const literal = res.entries.find((entry) => entry.type === 'literal')
    if (!literal) throw new ImapError('取邮件正文失败：' + (res.detail || '无内容'), 'EBODY')
    return literal.data
  }

  async logout () {
    try {
      if (this.socket && !this.closed) await this.command('LOGOUT')
    } catch {
      // 退出失败无所谓
    }
    this.close()
  }

  close () {
    this.closed = true
    if (this.socket) {
      try {
        this.socket.destroy()
      } catch {
        // 忽略
      }
      this.socket = null
    }
    this._failPending(new ImapError('邮箱连接已关闭', 'ECLOSED'))
  }
}

function parseFetch (entries) {
  const items = []
  let current = null
  for (const entry of entries) {
    if (entry.type === 'line') {
      if (/^\*\s+\d+\s+FETCH\s+\(/i.test(entry.text)) {
        current = { text: entry.text, raw: null }
        items.push(current)
      } else if (current && entry.text !== ')') {
        current.text += ' ' + entry.text
      }
    } else if (current) {
      current.raw = entry.data
    }
  }

  return items.map((item) => {
    const uid = /\bUID\s+(\d+)/.exec(item.text)
    const internal = /INTERNALDATE\s+"([^"]+)"/.exec(item.text)
    const size = /RFC822\.SIZE\s+(\d+)/.exec(item.text)
    const flags = /FLAGS\s+\(([^)]*)\)/.exec(item.text)
    return {
      uid: uid ? Number(uid[1]) : 0,
      receivedAt: internal ? parseInternalDate(internal[1]) : new Date(),
      size: size ? Number(size[1]) : 0,
      flags: flags ? flags[1].trim().split(/\s+/).filter(Boolean) : [],
      rawHeaders: item.raw,
    }
  })
}
