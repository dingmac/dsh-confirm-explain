import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import {
  DEFAULT_CONFIG, normalizeConfig, normalizeRequest, buildExplainPrompt,
  extractJsonObject, parseExplanation, createRuntime, ROUTE,
} from '../index.js'

/** A fake Host context: only the three services the runtime touches. */
function makeCtx(options = {}) {
  const calls = []
  const ctx = {
    calls,
    get(name) {
      if (name === 'llm') {
        return {
          stream(request) {
            calls.push(request)
            return (async function* () {
              if (options.failWith) {
                yield { type: 'text-delta', text: 'partial' }
                yield { type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: options.failWith } } }
                return
              }
              const reply = typeof options.reply === 'function' ? options.reply(request) : (options.reply || '{}')
              yield { type: 'text-delta', text: reply.slice(0, 3) }
              yield { type: 'text-delta', text: reply.slice(3) }
              yield { type: 'finish', reason: { kind: 'stop' } }
            })()
          },
        }
      }
      if (name === 'agentDefaultModel') {
        return { currentSelection: () => (options.noModel ? null : { provider: 'fake-provider', model: 'fake-model' }) }
      }
      return undefined
    },
  }
  return ctx
}

function tempConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dce-test-'))
  return { dataDir: dir, maxTokens: 1200, timeoutMs: 5000 }
}

async function withServer(runtime, run) {
  const server = http.createServer(runtime.handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const base = 'http://127.0.0.1:' + port + ROUTE
  try {
    return await run(base)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

const CARD = '等待审批\nAuto review 拒绝了此调用：Selecting the DSH desktop app grants desktop-control/AX access.\n拒绝  允许一次'

test('pure: defaults and normalization', () => {
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG)
  assert.equal(normalizeConfig({ presentation: 'modal' }).presentation, 'modal')
  assert.equal(normalizeConfig({ presentation: 'weird' }).presentation, 'drawer')
  assert.equal(normalizeConfig({ detail: 'brief' }).detail, 'brief')
  assert.equal(normalizeConfig({ autoExplain: false }).autoExplain, false)
})

test('pure: request validation', () => {
  assert.equal(normalizeRequest(null), null)
  assert.equal(normalizeRequest({}), null)
  const request = normalizeRequest({ kind: 'question', cardText: ' 选一个 ', questions: [{ question: 'Q1', options: [{ label: 'A' }] }] })
  assert.equal(request.kind, 'question')
  assert.equal(request.cardText, '选一个')
  assert.equal(request.questions.length, 1)
  assert.equal(request.questions[0].options[0].label, 'A')
})

test('pure: prompt carries the card text and detail switch', () => {
  const request = normalizeRequest({ kind: 'approval', toolName: 'Bash', cardText: CARD })
  const standard = buildExplainPrompt(request, 'standard')
  assert.match(standard.user, /Auto review/)
  assert.match(standard.user, /Bash/)
  const brief = buildExplainPrompt(request, 'brief')
  assert.match(brief.system, /写得短一些/)
})

test('pure: JSON extraction handles fences and prose', () => {
  const fence = String.fromCharCode(96, 96, 96)
  const value = extractJsonObject('好的：\n' + fence + 'json\n{"title":"读文件","willDo":["读取 a.txt"]}\n' + fence + '\n完')
  assert.equal(value.title, '读文件')
  assert.equal(extractJsonObject('no json here'), null)
  const parsed = parseExplanation('not json at all')
  assert.equal(parsed.parseFailed, true)
  assert.equal(parsed.plain, 'not json at all')
  const normalized = parseExplanation('{"title":"x","risk":{"level":"high","points":["p"]},"recommendation":{"decision":"reject","why":"w"}}')
  assert.equal(normalized.risk.level, 'high')
  assert.equal(normalized.recommendation.decision, 'reject')
})

test('http: health and config', async () => {
  const config = tempConfig()
  const runtime = createRuntime(makeCtx(), config)
  await withServer(runtime, async (base) => {
    const health = await fetch(base + '/health')
    assert.equal(health.status, 200)
    assert.equal((await health.json()).ok, true)

    const initial = await (await fetch(base + '/config')).json()
    assert.deepEqual(initial.config, DEFAULT_CONFIG)

    const saved = await fetch(base + '/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ presentation: 'modal', autoExplain: false }),
    })
    assert.equal(saved.status, 200)
    const body = await saved.json()
    assert.equal(body.config.presentation, 'modal')
    assert.equal(body.config.autoExplain, false)

    const disk = JSON.parse(fs.readFileSync(path.join(config.dataDir, 'config.json'), 'utf8'))
    assert.equal(disk.presentation, 'modal')

    const rejected = await fetch(base + '/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nope: 1 }),
    })
    assert.equal(rejected.status, 400)
  })
})

test('http: explain returns a normalized explanation', async () => {
  const config = tempConfig()
  const reply = JSON.stringify({
    title: '授权 AI 查看屏幕',
    plain: '它在请求桌面控制权限。',
    willDo: ['读取当前桌面窗口'],
    impact: '系统级辅助功能权限',
    risk: { level: 'high', points: ['可读取其他应用内容'] },
    recommendation: { decision: 'reject', why: '与当前任务无关' },
    ifAllow: '会话获得桌面控制能力',
    ifReject: '任务继续用其他方式完成',
    unclear: [],
  })
  const ctx = makeCtx({ reply })
  const runtime = createRuntime(ctx, config)
  await withServer(runtime, async (base) => {
    const response = await fetch(base + '/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request: { key: 'k1', kind: 'approval', toolName: 'cua.getApp', reason: '需要桌面控制', cardText: CARD }, detail: 'standard' }),
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.explanation.title, '授权 AI 查看屏幕')
    assert.equal(body.explanation.risk.level, 'high')
    assert.equal(body.meta.provider, 'fake-provider')
    assert.equal(ctx.calls.length, 1)
    assert.match(ctx.calls[0].messages[0].content[0].text, /Auto review/)
  })
})

test('http: explain dedupes concurrent identical calls', async () => {
  const config = tempConfig()
  const ctx = makeCtx({ reply: '{"title":"x"}' })
  const runtime = createRuntime(ctx, config)
  const request = { key: 'k1', kind: 'approval', cardText: CARD }
  const [a, b] = await Promise.all([runtime.handleExplain({ request }), runtime.handleExplain({ request })])
  assert.equal(a.status, 200)
  assert.equal(b.status, 200)
  assert.equal(ctx.calls.length, 1)
})

test('http: model failure surfaces a message', async () => {
  const config = tempConfig()
  const runtime = createRuntime(makeCtx({ failWith: '额度不足' }), config)
  await withServer(runtime, async (base) => {
    const response = await fetch(base + '/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request: { kind: 'approval', cardText: CARD } }),
    })
    assert.equal(response.status, 502)
    const body = await response.json()
    assert.match(body.error, /额度不足/)
  })
})

test('http: missing model is a 503', async () => {
  const config = tempConfig()
  const runtime = createRuntime(makeCtx({ noModel: true }), config)
  const result = await runtime.handleExplain({ request: { kind: 'approval', cardText: CARD } })
  assert.equal(result.status, 503)
})

test('http: chat answers with history', async () => {
  const config = tempConfig()
  const ctx = makeCtx({ reply: '它只想读取窗口标题。' })
  const runtime = createRuntime(ctx, config)
  await withServer(runtime, async (base) => {
    const response = await fetch(base + '/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        request: { kind: 'approval', cardText: CARD },
        history: [{ role: 'user', content: '它要干什么？' }, { role: 'assistant', content: '要桌面权限。' }],
        question: '会影响别的软件吗？',
      }),
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.answer, '它只想读取窗口标题。')
    assert.equal(ctx.calls[0].messages.length, 4)
  })
})

test('http: guards', async () => {
  const runtime = createRuntime(makeCtx(), tempConfig())
  await withServer(runtime, async (base) => {
    const wrongType = await fetch(base + '/explain', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })
    assert.equal(wrongType.status, 415)

    const invalid = await fetch(base + '/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })
    assert.equal(invalid.status, 400)

    const empty = await fetch(base + '/explain', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    assert.equal(empty.status, 400)

    const cross = await fetch(base + '/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ request: { kind: 'approval', cardText: CARD } }),
    })
    assert.equal(cross.status, 403)

    const missing = await fetch(base + '/nope')
    assert.equal(missing.status, 404)
  })
})
