// 邮件解析：拆头、解编码字（=?GBK?B?...?=）、走 multipart、解传输编码与字符集。
// 只求「商务邮件能读」，不追求完整 MIME 合规。

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseMessage (raw) {
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw || ''), 'utf8')
  const { headerText, body } = splitHeaderBody(buffer)
  const headers = parseHeaders(headerText)

  const out = { text: '', html: '', attachments: [] }
  walk(headers, body, 0, out)

  const from = parseAddress(headers.from || '')
  const to = splitAddresses(headers.to || '')
  const cc = splitAddresses(headers.cc || '')

  return {
    subject: decodeWords(headers.subject || '').replace(/\s+/g, ' ').trim(),
    fromName: from.name,
    fromAddr: from.addr,
    toAddrs: to.join(', '),
    ccAddrs: cc.join(', '),
    date: parseDateHeader(headers.date),
    messageId: stripBrackets(headers['message-id'] || ''),
    inReplyTo: stripBrackets(headers['in-reply-to'] || ''),
    references: String(headers.references || '')
      .split(/\s+/)
      .map(stripBrackets)
      .filter(Boolean),
    bodyText: out.text || htmlToText(out.html),
    hasAttachments: out.attachments.length > 0,
    attachments: out.attachments,
  }
}

// ---------- 头 ----------

export function splitHeaderBody (buffer) {
  const crlf = buffer.indexOf('\r\n\r\n')
  if (crlf >= 0) return { headerText: buffer.subarray(0, crlf).toString('utf8'), body: buffer.subarray(crlf + 4) }
  const lf = buffer.indexOf('\n\n')
  if (lf >= 0) return { headerText: buffer.subarray(0, lf).toString('utf8'), body: buffer.subarray(lf + 2) }
  return { headerText: buffer.toString('utf8'), body: Buffer.alloc(0) }
}

export function parseHeaders (text) {
  const headers = {}
  const lines = String(text || '').split(/\r?\n/)
  let current = ''
  for (const line of lines) {
    if (/^[ \t]/.test(line) && current) {
      headers[current] += ' ' + line.trim()
      continue
    }
    const match = /^([^:]+):\s*([\s\S]*)$/.exec(line)
    if (!match) continue
    current = match[1].trim().toLowerCase()
    const value = match[2].trim()
    headers[current] = headers[current] ? headers[current] + ', ' + value : value
  }
  return headers
}

export function decodeWords (value) {
  if (!value) return ''
  return String(value).replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (whole, charset, enc, payload) => {
    try {
      const bytes =
        enc.toUpperCase() === 'B'
          ? Buffer.from(payload, 'base64')
          : qpToBuffer(Buffer.from(payload.replace(/_/g, ' '), 'latin1'))
      const text = decodeCharset(bytes, charset)
      return text || whole
    } catch {
      return whole
    }
  })
}

function parseAddress (value) {
  const text = decodeWords(value || '').trim()
  if (!text) return { name: '', addr: '' }
  const angled = /^(.*?)<([^>]+)>/.exec(text)
  if (angled) {
    return { name: angled[1].replace(/^["']|["']$/g, '').trim(), addr: angled[2].trim() }
  }
  return { name: '', addr: text }
}

function splitAddresses (value) {
  return decodeWords(value || '')
    .split(',')
    .map((part) => {
      const angled = /<([^>]+)>/.exec(part)
      return (angled ? angled[1] : part).trim()
    })
    .filter(Boolean)
}

function parseDateHeader (value) {
  if (!value) return new Date()
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct
  const m = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4})?/.exec(value)
  if (m) {
    const month = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase())
    const utc = Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0))
    return new Date(utc)
  }
  return new Date()
}

function stripBrackets (value) {
  return String(value || '').trim().replace(/^<|>$/g, '')
}

// ---------- MIME 遍历 ----------

function parseContentType (value) {
  const text = String(value || '').trim()
  if (!text) return { type: 'text/plain', params: {} }
  const parts = text.split(';')
  const params = {}
  for (const part of parts.slice(1)) {
    const m = /^\s*([^=]+)=(.*)$/.exec(part)
    if (!m) continue
    params[m[1].trim().toLowerCase()] = m[2].trim().replace(/^"|"$/g, '')
  }
  return { type: (parts[0] || 'text/plain').trim().toLowerCase(), params }
}

function walk (headers, body, depth, out) {
  if (depth > 8) return
  const contentType = parseContentType(headers['content-type'])
  if (contentType.type.startsWith('multipart/')) {
    const boundary = contentType.params.boundary
    if (!boundary) return
    for (const part of splitMultipart(body, boundary)) {
      const { headerText, body: partBody } = splitHeaderBody(part)
      walk(parseHeaders(headerText), partBody, depth + 1, out)
    }
    return
  }

  const disposition = String(headers['content-disposition'] || '')
  const fileName = decodeWords(
    parseParam(disposition, 'filename') || parseParam(headers['content-type'] || '', 'name') || '',
  )
  const data = decodeTransfer(body, headers['content-transfer-encoding'])

  const isAttachment =
    /^attachment/i.test(disposition) || !!fileName || !contentType.type.startsWith('text/')

  if (isAttachment) {
    out.attachments.push({
      name: fileName || contentType.params.name || '未命名附件',
      type: contentType.type,
      size: data.length,
    })
    return
  }

  if (contentType.type === 'text/plain' && !out.text) {
    out.text = decodeCharset(data, contentType.params.charset).trim()
  } else if (contentType.type === 'text/html' && !out.html) {
    out.html = decodeCharset(data, contentType.params.charset)
  }
}

function parseParam (text, name) {
  const m = new RegExp(name + '\\*?\\s*=\\s*("([^"]*)"|[^;]+)', 'i').exec(String(text || ''))
  if (!m) return ''
  return (m[2] !== undefined ? m[2] : m[1]).trim()
}

function splitMultipart (body, boundary) {
  // latin1 是 1 字节 1 字符的映射，切完再转回 Buffer 不会破坏二进制
  const text = body.toString('latin1')
  const marker = '--' + boundary
  const segments = text.split(marker)
  const parts = []
  for (let i = 1; i < segments.length; i++) {
    let segment = segments[i]
    if (segment.startsWith('--')) break
    segment = segment.replace(/^\r?\n/, '')
    const cut = segment.lastIndexOf('\r\n')
    if (cut >= 0) segment = segment.slice(0, cut)
    parts.push(Buffer.from(segment, 'latin1'))
  }
  return parts
}

function decodeTransfer (body, encoding) {
  const kind = String(encoding || '').trim().toLowerCase()
  if (kind === 'base64') {
    return Buffer.from(body.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64')
  }
  if (kind === 'quoted-printable') return qpToBuffer(body)
  return body
}

function qpToBuffer (buffer) {
  const out = []
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]
    if (byte === 0x3d) {
      // '='
      const next = buffer[i + 1]
      if (next === 0x0d && buffer[i + 2] === 0x0a) {
        i += 2
        continue
      }
      if (next === 0x0a) {
        i += 1
        continue
      }
      const hex = buffer.subarray(i + 1, i + 3).toString('latin1')
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16))
        i += 2
        continue
      }
    }
    out.push(byte)
  }
  return Buffer.from(out)
}

function normalizeCharset (charset) {
  const label = String(charset || 'utf-8')
    .trim()
    .replace(/^"|"$/g, '')
    .toLowerCase()
  if (/^(gb2312|gbk|gb18030|cp936|euc-cn|x-gbk|gb_2312-80)$/.test(label)) return 'gbk'
  if (/^utf-?8$/.test(label)) return 'utf-8'
  if (/^(big5|big-5|cp950)$/.test(label)) return 'big5'
  if (/^(us-ascii|ascii|iso-8859-1|latin1|windows-1252)$/.test(label)) return 'windows-1252'
  return label || 'utf-8'
}

export function decodeCharset (buffer, charset) {
  const label = normalizeCharset(charset)
  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer)
  } catch {
    return Buffer.from(buffer).toString('utf8')
  }
}

export function htmlToText (html) {
  if (!html) return ''
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table|section)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
