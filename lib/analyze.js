// 邮件整理：一次模型调用拿到「中文主题 + 中文全文 + 摘要 + 需求清单 + 建议」。
// 只依赖 ctx.llm，不引第三方 SDK。

const BODY_LIMIT = 14000
export const PROMPT_VERSION = 'v2'

const SYSTEM = `你是外贸与技术支持团队的邮件助理。把一封客户邮件（或一段聊天记录）整理成结构化结果，只输出一个 JSON 对象，不要代码块、不要解释、不要多余文字。

JSON 字段：
- title：给这条事项起一个不超过 18 字的中文标题，概括客户要什么或问题是什么；不要照抄开头几个字，不要带日期
- subjectZh：邮件主题的中文翻译（不超过 30 字）
- bodyZh：邮件正文的中文全文翻译。逐段对应，不要省略、不要概括；原文里的表格用纯文本对齐保留；签名、免责声明、转发头不翻译，直接省略。
- summary：1-2 句中文摘要，说清客户是谁、要什么、有没有时间要求
- asks：数组，最多 5 条，只列真正需要我们回应或处理的事项，每项 {"text": "……", "owner": "us" 或 "customer", "deadline": "YYYY-MM-DD" 或 ""}
- suggestions：数组，最多 3 条，给我们的处理建议，每项 {"text": "……", "why": "一句话理由"}

规则：
1. 只依据原文，不编造事实，不补充原文没有的信息。
2. 原文是中文时，bodyZh 直接返回原文正文，subjectZh 返回原标题。
3. 寒暄、感谢、闲聊、签名、免责声明都不算 asks。
4. 不确定的 deadline 留空字符串，不要猜日期。
5. suggestions 要具体到「先做什么、再做什么」，不写空话。
6. 输出必须是合法 JSON。`

export function buildInput (mail, bodyLimit = BODY_LIMIT, priorSummary = '') {
  let body = String(mail.bodyText || '').trim()
  if (body.length > bodyLimit) body = body.slice(0, bodyLimit) + '\n\n（正文过长，已截断）'
  const attach = (mail.attachNames || []).length ? '\n附件：' + mail.attachNames.join('、') : ''
  const context = priorSummary
    ? [
        '【此前摘要】' + priorSummary,
        '（这是同一事项的后续消息：summary 要覆盖整个事项，而不只是这一条；asks 只列仍然待办的事。）',
        '',
      ]
    : []
  return [
    ...context,
    '主题：' + (mail.subject || '（无主题）'),
    '发件人：' + [mail.fromName, mail.fromAddr].filter(Boolean).join(' '),
    '时间：' + (mail.receivedAt || ''),
    '正文：',
    body || '（无正文）',
    attach,
  ].join('\n')
}

/**
 * 长邮件容易在翻译上撞输出上限：逐级缩短输入再试，而不是整封失败。
 */
export async function analyzeMail (llm, route, mail, options = {}) {
  if (!llm) throw new Error('模型服务不可用')
  if (!route || !route.provider || !route.model) throw new Error('没有可用的默认模型')

  const plans = [
    { bodyLimit: BODY_LIMIT, maxTokens: options.maxTokens || 8000 },
    { bodyLimit: 6000, maxTokens: options.maxTokens || 8000 },
    { bodyLimit: 3000, maxTokens: 6000 },
  ]

  let lastError = null
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]
    try {
      const text = await requestText(llm, route, buildInput(mail, plan.bodyLimit, options.priorSummary || ''), {
        signal: options.signal,
        maxTokens: plan.maxTokens,
        timeoutMs: options.timeoutMs || 180000,
      })
      return parseResult(text)
    } catch (err) {
      const message = err && err.message ? err.message : String(err)
      lastError = err instanceof Error ? err : new Error(message)
      const retryable = /截断|max-tokens|JSON|没有返回内容/.test(message)
      if (!retryable) throw lastError
    }
  }
  throw lastError || new Error('模型没有返回可用结果')
}

async function requestText (llm, route, input, options) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 180000)
  const relayAbort = () => controller.abort()
  if (options.signal) options.signal.addEventListener('abort', relayAbort)

  try {
    return await streamText(llm, route, input, {
      signal: controller.signal,
      maxTokens: options.maxTokens,
    })
  } finally {
    clearTimeout(timeout)
    if (options.signal) options.signal.removeEventListener('abort', relayAbort)
  }
}

async function streamText (llm, route, input, options) {
  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: input }],
      source: { kind: 'dsh-mail-cases' },
    },
  ]

  const stream = llm.stream({
    provider: route.provider,
    model: route.model,
    system: SYSTEM,
    messages,
    maxTokens: options.maxTokens,
    temperature: 0.2,
    signal: options.signal,
  })

  let text = ''
  let blockText = ''
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') {
      text += chunk.text
    } else if (chunk.type === 'block-end' && chunk.block && chunk.block.type === 'text') {
      blockText = chunk.block.text || blockText
    } else if (chunk.type === 'finish') {
      const reason = chunk.reason || {}
      if (reason.kind === 'error' || reason.kind === 'aborted') {
        const failure = reason.failure || {}
        throw new Error(failure.message || '模型调用失败')
      }
      if (reason.kind === 'max-tokens') throw new Error('模型输出被截断（max-tokens）')
    }
  }

  const result = text || blockText
  if (!result.trim()) throw new Error('模型没有返回内容')
  return result
}

function parseResult (raw) {
  const cleaned = String(raw)
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON')

  const slice = cleaned.slice(start, end + 1)
  let json
  try {
    json = JSON.parse(slice)
  } catch {
    json = JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'))
  }

  return {
    title: String(json.title || '').trim().slice(0, 40),
    subjectZh: String(json.subjectZh || json.subject_zh || '').slice(0, 200),
    bodyZh: String(json.bodyZh || json.body_zh || '').trim(),
    summary: String(json.summary || '').trim(),
    asks: normalizeAsks(json.asks),
    suggestions: normalizeSuggestions(json.suggestions),
  }
}

function normalizeAsks (value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item) continue
    const text = typeof item === 'string' ? item : String(item.text || '').trim()
    if (!text) continue
    out.push({
      text,
      owner: item.owner === 'customer' ? 'customer' : 'us',
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(String(item.deadline || '')) ? item.deadline : '',
    })
    if (out.length >= 6) break
  }
  return out
}

function normalizeSuggestions (value) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const item of value) {
    if (!item) continue
    const text = typeof item === 'string' ? item : String(item.text || '').trim()
    if (!text) continue
    out.push({ text, why: String(item.why || '').trim() })
    if (out.length >= 4) break
  }
  return out
}
