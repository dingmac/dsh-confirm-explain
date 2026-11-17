import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { JSDOM } from 'jsdom'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = fs.readFileSync(path.join(HERE, '..', 'client.js'), 'utf8')

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

/**
 * Evaluate the bundle in a fresh jsdom world with a stubbed Host.
 * Returns the captured registrations and the module store through the exports.
 */
function boot(options = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://127.0.0.1:9/' })
  const win = dom.window
  let entry = null
  win.__ModuleLoader__ = { load(value) { entry = value } }

  const calls = []
  const reply = {
    config: Object.assign({ presentation: 'drawer', autoExplain: true, injectButton: true, miniWindow: false, detail: 'standard' }, options.config || {}),
    explanation: Object.assign({
      title: '这条确认想让 AI 看你的屏幕',
      plain: '它想获得桌面控制权限，用来打开应用做验证。',
      willDo: ['读取当前桌面窗口'],
      impact: '系统级辅助功能权限',
      risk: { level: 'high', points: ['可读取其他应用内容'] },
      recommendation: { decision: 'reject', why: '与当前构建任务无关' },
      ifAllow: '会话获得桌面控制能力',
      ifReject: '任务继续按构建流程走',
      unclear: [],
    }, options.explanation || {}),
    chat: options.chat || '它只会读取窗口标题，不会改文件。',
  }

  const fetchStub = async (url, init) => {
    const target = String(url)
    let body
    try { body = init && typeof init.body === 'string' ? JSON.parse(init.body) : undefined } catch { body = undefined }
    calls.push({ url: target, body, method: init && init.method ? init.method : 'GET' })
    if (target.endsWith('/config') && (!init || init.method !== 'POST')) return response({ ok: true, config: reply.config })
    if (target.endsWith('/config')) return response({ ok: true, config: Object.assign({}, reply.config, body) })
    if (target.endsWith('/explain')) return response({ ok: true, explanation: reply.explanation, meta: { provider: 'fake', model: 'fake', ms: 1 } })
    if (target.endsWith('/chat')) return response({ ok: true, answer: reply.chat })
    return response({ error: 'not found' }, 404)
  }

  const run = new Function(
    'window', 'document', 'MutationObserver', 'fetch', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
    SOURCE,
  )
  run(win, win.document, win.MutationObserver, fetchStub, setInterval, clearInterval, setTimeout, clearTimeout)
  if (!entry) throw new Error('client bundle did not register with __ModuleLoader__')

  const exportsObject = entry.factory((name) => {
    if (name === 'react') return React
    throw new Error('unexpected require: ' + name)
  })
  assert.equal(typeof exportsObject.apply, 'function')

  globalThis.window = win
  globalThis.document = win.document
  globalThis.MutationObserver = win.MutationObserver
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  const registrations = []
  const disposers = []
  const ctx = {
    slots: {
      inject(name, callback) {
        const dispose = callback()
        if (typeof dispose === 'function') disposers.push(dispose)
        return dispose
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
  }
  exportsObject.apply(ctx)

  return { dom, win, entry, exportsObject, registrations, calls, reply, fetchStub, disposers }
}

function flush(win, ms = 20) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function mount(component, props) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(React.createElement(component, props || {}))
  })
  return { container, root }
}

function findRegistration(booted, name) {
  const found = booted.registrations.find((item) => item.options.name === name)
  assert.ok(found, 'missing registration ' + name)
  return found
}

test('bundle registers overlay, probe and settings section', async () => {
  const booted = boot()
  await act(async () => { await flush(booted.win, 10) })
  assert.deepEqual(
    booted.registrations.map((item) => item.options.name).sort(),
    ['conversation.session.header.actions', 'settings.section', 'shell.overlay'],
  )
  assert.equal(booted.registrations.find((item) => item.options.name === 'settings.section').options.label, '确认解释')
  assert.ok(document.getElementById('dce-style'), 'style tag injected')
  assert.ok(document.getElementById('dce-style').textContent.includes('.dce-drawer'))
})

test('approval card gets a pill; clicking it opens the drawer and explains', async () => {
  const booted = boot()
  const pending = { key: 'approval:s1:c1', kind: 'approval', toolName: 'Bash', reason: '要运行一条命令', sessionId: 's1' }
  const card = document.createElement('div')
  card.setAttribute('data-approval-key', pending.key)
  card.innerHTML = '<div>等待审批</div><div>Auto review 拒绝了此调用</div><button>拒绝</button><button>允许一次</button>'
  document.body.appendChild(card)

  const panelReg = findRegistration(booted, 'shell.overlay')
  const probeReg = findRegistration(booted, 'conversation.session.header.actions')
  const panel = await mount(panelReg.component, {})
  const probe = await mount(probeReg.component, {
    sessionId: 's1',
    useSessionStatus: (selector) => selector(new Map([['s1', { pendingInteraction: pending }]])),
  })

  const pill = card.querySelector('[data-dce-explain-btn]')
  assert.ok(pill, 'pill injected into the approval card')
  assert.equal(pill.textContent, '✦ 解释')

  await act(async () => {
    pill.dispatchEvent(new booted.win.MouseEvent('click', { bubbles: true }))
    await flush(booted.win, 30)
  })

  assert.ok(booted.calls.some((call) => call.url.endsWith('/explain')), 'explain requested')
  assert.ok(panel.container.querySelector('.dce-drawer'), 'drawer rendered')
  assert.match(panel.container.textContent, /这条确认想让 AI 看你的屏幕/)
  assert.match(panel.container.textContent, /建议拒绝/)
  assert.match(panel.container.textContent, /Auto review 拒绝了此调用/)

  await act(async () => { probe.root.unmount() })
  assert.equal(card.querySelector('[data-dce-explain-btn]'), null, 'pill removed with the probe')
  await act(async () => { panel.root.unmount() })
})

test('question card gets a pill inside its header', async () => {
  const booted = boot()
  const pending = {
    key: 'question:s1:call-1', kind: 'question', sessionId: 's1',
    questions: [{ header: '选择', question: '要覆盖旧文件吗？', multiSelect: false, options: [{ label: '覆盖', description: '写入新内容' }, { label: '保留', description: '跳过' }] }],
  }
  const card = document.createElement('div')
  card.setAttribute('data-question-key', pending.key)
  card.innerHTML = '<section><header><div></div><div><button>最小化</button></div></header><div>要覆盖旧文件吗？</div></section>'
  document.body.appendChild(card)

  const probeReg = findRegistration(booted, 'conversation.session.header.actions')
  const probe = await mount(probeReg.component, {
    sessionId: 's1',
    useSessionStatus: (selector) => selector(new Map([['s1', { pendingInteraction: pending }]])),
  })

  const pill = card.querySelector('[data-dce-explain-btn]')
  assert.ok(pill, 'pill injected into the question header')
  assert.equal(pill.parentElement.tagName.toLowerCase(), 'header')

  await act(async () => { probe.root.unmount() })
})

test('with injection disabled the probe renders the header fallback', async () => {
  const booted = boot({ config: { injectButton: false } })
  await act(async () => { await flush(booted.win, 10) })
  const pending = { key: 'approval:s1:c2', kind: 'approval', sessionId: 's1', toolName: 'Bash', reason: 'x' }
  const card = document.createElement('div')
  card.setAttribute('data-approval-key', pending.key)
  document.body.appendChild(card)

  const probeReg = findRegistration(booted, 'conversation.session.header.actions')
  const probe = await mount(probeReg.component, {
    sessionId: 's1',
    useSessionStatus: (selector) => selector(new Map([['s1', { pendingInteraction: pending }]])),
  })
  assert.equal(card.querySelector('[data-dce-explain-btn]'), null, 'no card injection')
  const fallback = probe.container.querySelector('.dce-header-btn')
  assert.ok(fallback, 'header fallback button rendered')
  await act(async () => { probe.root.unmount() })
})

test('settings section writes the chosen presentation mode', async () => {
  const booted = boot()
  await act(async () => { await flush(booted.win, 10) })
  const settingsReg = findRegistration(booted, 'settings.section')
  const settings = await mount(settingsReg.component, { close() {} })
  const buttons = Array.from(settings.container.querySelectorAll('button'))
  const modalButton = buttons.find((button) => button.textContent === '居中弹窗')
  assert.ok(modalButton, 'modal option present')
  await act(async () => {
    modalButton.dispatchEvent(new booted.win.MouseEvent('click', { bubbles: true }))
    await flush(booted.win, 10)
  })
  const posted = booted.calls.find((call) => call.method === 'POST' && call.url.endsWith('/config'))
  assert.ok(posted, 'config POST sent')
  assert.equal(posted.body.presentation, 'modal')
  await act(async () => { settings.root.unmount() })
})

test('follow-up chat sends history and renders the answer', async () => {
  const booted = boot()
  const pending = { key: 'approval:s1:c3', kind: 'approval', toolName: 'Bash', reason: '要运行一条命令', sessionId: 's1' }
  const card = document.createElement('div')
  card.setAttribute('data-approval-key', pending.key)
  document.body.appendChild(card)

  const panelReg = findRegistration(booted, 'shell.overlay')
  const probeReg = findRegistration(booted, 'conversation.session.header.actions')
  const panel = await mount(panelReg.component, {})
  const probe = await mount(probeReg.component, {
    sessionId: 's1',
    useSessionStatus: (selector) => selector(new Map([['s1', { pendingInteraction: pending }]])),
  })

  const pill = card.querySelector('[data-dce-explain-btn]')
  await act(async () => {
    pill.dispatchEvent(new booted.win.MouseEvent('click', { bubbles: true }))
    await flush(booted.win, 30)
  })

  const chatButton = Array.from(panel.container.querySelectorAll('button')).find((button) => button.textContent === '追问这条')
  assert.ok(chatButton, 'follow-up button present')
  await act(async () => {
    chatButton.dispatchEvent(new booted.win.MouseEvent('click', { bubbles: true }))
    await flush(booted.win, 10)
  })
  const float = panel.container.querySelector('.dce-float')
  assert.ok(float, 'floating chat opened')

  const textarea = float.querySelector('textarea')
  const setter = Object.getOwnPropertyDescriptor(booted.win.HTMLTextAreaElement.prototype, 'value').set
  await act(async () => {
    setter.call(textarea, '它会不会改我的文件？')
    textarea.dispatchEvent(new booted.win.Event('input', { bubbles: true }))
    await flush(booted.win, 10)
  })
  const send = Array.from(float.querySelectorAll('button')).find((button) => button.textContent === '发送')
  await act(async () => {
    send.dispatchEvent(new booted.win.MouseEvent('click', { bubbles: true }))
    await flush(booted.win, 30)
  })
  const chatCall = booted.calls.find((call) => call.url.endsWith('/chat'))
  assert.ok(chatCall, 'chat requested')
  assert.equal(chatCall.body.question, '它会不会改我的文件？')
  assert.match(float.textContent, /它只会读取窗口标题/)

  await act(async () => { probe.root.unmount(); panel.root.unmount() })
})
