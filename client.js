/**
 * dsh-confirm-explain — browser half.
 *
 * One lazy-CJS module: only 'react' is required. It renders through the Host's
 * slot system (shell.overlay, settings.section) and augments the existing
 * approval / question card with one small Explain pill.
 *
 * Surfaces:
 *   card      data-approval-key / data-question-key elements — injected pill
 *   overlay   shell.overlay — right drawer or centered modal + floating chat
 *   settings  settings.section — presentation and behaviour preferences
 *
 * The card pill is a deliberate DOM augmentation: upstream exposes no
 * additive action slot on the approval card, and replacing the composer chain
 * would fork the approval lifecycle. The injector is idempotent, re-inserts
 * after React re-renders, and removes itself when the request settles.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-confirm-explain',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const VERSION = '1.0.0'
    const BASE = '/_dsh/confirm-explain'
    const STYLE_ID = 'dce-style'
    const BTN_ATTR = 'data-dce-explain-btn'

    const T = {
      base: 'var(--dsw-alias-bg-base, #111)',
      layer1: 'var(--dsw-alias-bg-layer-1, #191919)',
      layer2: 'var(--dsw-alias-bg-layer-2, #232323)',
      layer3: 'var(--dsw-alias-bg-layer-3, #2b2b2b)',
      border1: 'var(--dsw-alias-border-l1, #333)',
      border2: 'var(--dsw-alias-border-l2, #444)',
      text: 'var(--dsw-alias-label-primary, #eee)',
      muted: 'var(--dsw-alias-label-secondary, #9a9a9a)',
      faint: 'var(--dsw-alias-label-tertiary, #6f6f6f)',
      brand: 'var(--dsw-alias-brand-primary, #7c9cff)',
      ok: 'var(--dsw-alias-state-success-primary, #22c55e)',
      warn: 'var(--dsw-alias-state-warn-primary, #f59e0b)',
      error: 'var(--dsw-alias-state-error-primary, #ef4444)',
    }

    const DEFAULT_CONFIG = {
      presentation: 'drawer',
      autoExplain: true,
      injectButton: true,
      miniWindow: false,
      detail: 'standard',
    }

    const KIND_LABEL = {
      approval: '权限审批',
      question: '需要你选择',
      'plan-review': '计划评审',
    }

    const DECISION_LABEL = {
      allow: '建议放行',
      reject: '建议拒绝',
      careful: '建议先确认',
    }

    const DECISION_COLOR = {
      allow: T.ok,
      reject: T.error,
      careful: T.warn,
    }

    const RISK_LABEL = { low: '低风险', medium: '中等风险', high: '高风险', unknown: '未说明' }
    const RISK_COLOR = { low: T.ok, medium: T.warn, high: T.error, unknown: T.muted }

    const CSS = `
.dce-pill{font:inherit;font-size:12px;line-height:1;display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#232323);color:var(--dsw-alias-label-secondary,#b9b9b9);cursor:pointer;white-space:nowrap;transition:color .15s,border-color .15s,background .15s;pointer-events:auto}
.dce-pill:hover{color:var(--dsw-alias-label-primary,#eee);border-color:var(--dsw-alias-brand-primary,#7c9cff);background:var(--dsw-alias-bg-layer-3,#2b2b2b)}
.dce-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#7c9cff);outline-offset:1px}
.dce-card-btn{position:absolute;top:10px;right:10px;z-index:6;box-shadow:0 1px 6px rgba(0,0,0,.25)}
.dce-header-btn{margin-left:4px}
.dce-drawer{position:fixed;top:0;right:0;height:100dvh;width:min(440px,94vw);background:var(--dsw-alias-bg-layer-1,#191919);border-left:1px solid var(--dsw-alias-border-l1,#333);box-shadow:-18px 0 48px rgba(0,0,0,.38);z-index:2147483000;display:flex;flex-direction:column;animation:dce-slide .18s ease-out}
@keyframes dce-slide{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}
.dce-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.46);z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:22px}
.dce-modal{width:min(700px,94vw);max-height:86vh;background:var(--dsw-alias-bg-layer-1,#191919);border:1px solid var(--dsw-alias-border-l1,#333);border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden;animation:dce-pop .16s ease-out}
@keyframes dce-pop{from{transform:translateY(8px) scale(.99);opacity:.5}to{transform:none;opacity:1}}
.dce-panel{display:flex;flex-direction:column;min-height:0;flex:1;color:var(--dsw-alias-label-primary,#eee)}
.dce-head{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--dsw-alias-border-l1,#333);flex:none}
.dce-title{font-size:14px;font-weight:600;letter-spacing:.2px}
.dce-kind{font-size:11px;padding:2px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#444);color:var(--dsw-alias-label-secondary,#aaa);white-space:nowrap}
.dce-spacer{flex:1}
.dce-icon-btn{width:26px;height:26px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer;font-size:15px;line-height:1;display:inline-flex;align-items:center;justify-content:center;pointer-events:auto}
.dce-icon-btn:hover{background:var(--dsw-alias-bg-layer-2,#232323);color:var(--dsw-alias-label-primary,#eee);border-color:var(--dsw-alias-border-l1,#333)}
.dce-body{flex:1;min-height:0;overflow:auto;padding:14px 16px 18px;display:flex;flex-direction:column;gap:12px}
.dce-foot{flex:none;display:flex;gap:8px;padding:10px 16px;border-top:1px solid var(--dsw-alias-border-l1,#333);background:var(--dsw-alias-bg-layer-1,#191919)}
.dce-btn{font:inherit;font-size:12px;height:28px;padding:0 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:transparent;color:var(--dsw-alias-label-primary,#eee);cursor:pointer;display:inline-flex;align-items:center;gap:5px;pointer-events:auto}
.dce-btn:hover{background:var(--dsw-alias-bg-layer-2,#232323)}
.dce-btn[disabled]{opacity:.5;cursor:not-allowed}
.dce-btn-primary{background:var(--dsw-alias-brand-primary,#7c9cff);border-color:transparent;color:#fff}
.dce-btn-primary:hover{filter:brightness(1.06);background:var(--dsw-alias-brand-primary,#7c9cff)}
.dce-btn-ghost{border-color:transparent;color:var(--dsw-alias-label-secondary,#aaa)}
.dce-sec{border:1px solid var(--dsw-alias-border-l1,#333);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#232323);padding:10px 12px}
.dce-sec-title{font-size:11px;letter-spacing:.4px;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#777);margin-bottom:6px}
.dce-lead{font-size:14px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.dce-plain{font-size:13px;line-height:1.7;color:var(--dsw-alias-label-secondary,#c9c9c9);white-space:pre-wrap;word-break:break-word}
.dce-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
.dce-list li{font-size:13px;line-height:1.6;word-break:break-word}
.dce-risk{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600}
.dce-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.dce-rec{border-radius:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,#333);display:flex;flex-direction:column;gap:4px}
.dce-rec b{font-size:13px}
.dce-rec span{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary,#c9c9c9);white-space:pre-wrap}
.dce-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:560px){.dce-cols{grid-template-columns:1fr}}
.dce-col{font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary,#c9c9c9);white-space:pre-wrap;word-break:break-word}
.dce-source{border:1px dashed var(--dsw-alias-border-l2,#444);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.dce-source summary{cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary,#aaa);pointer-events:auto}
.dce-source-text{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-secondary,#b5b5b5);max-height:220px;overflow:auto;margin:0}
.dce-loading{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--dsw-alias-label-secondary,#bbb);padding:18px 2px}
.dce-spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(124,156,255,.25);border-top-color:var(--dsw-alias-brand-primary,#7c9cff);animation:dce-spin .8s linear infinite;flex:none}
@keyframes dce-spin{to{transform:rotate(360deg)}}
.dce-error{border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.08);border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.6;color:#f2b8b5;display:flex;flex-direction:column;gap:8px}
.dce-empty{font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-tertiary,#888);padding:8px 2px}
.dce-banner{font-size:12px;line-height:1.6;padding:7px 10px;border-radius:8px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#f0c88a}
.dce-float{position:fixed;right:24px;bottom:24px;width:380px;height:440px;min-width:300px;min-height:320px;max-width:min(560px,94vw);max-height:80vh;resize:both;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#191919);border:1px solid var(--dsw-alias-border-l2,#444);border-radius:14px;box-shadow:0 18px 54px rgba(0,0,0,.5);z-index:2147483001;display:flex;flex-direction:column;pointer-events:auto}
.dce-float-head{display:flex;align-items:center;gap:8px;padding:9px 10px 9px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,#333);cursor:move;user-select:none;flex:none}
.dce-float-title{font-size:12.5px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dce-float-body{flex:1;min-height:0;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px}
.dce-msg{max-width:88%;font-size:12.5px;line-height:1.65;padding:7px 10px;border-radius:10px;white-space:pre-wrap;word-break:break-word}
.dce-msg-user{align-self:flex-end;background:var(--dsw-alias-brand-primary,#7c9cff);color:#fff;border-bottom-right-radius:3px}
.dce-msg-assistant{align-self:flex-start;background:var(--dsw-alias-bg-layer-2,#232323);border:1px solid var(--dsw-alias-border-l1,#333);border-bottom-left-radius:3px}
.dce-float-foot{flex:none;display:flex;gap:6px;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l1,#333)}
.dce-input{flex:1;font:inherit;font-size:12.5px;line-height:1.5;min-height:30px;max-height:90px;resize:none;padding:6px 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#232323);color:var(--dsw-alias-label-primary,#eee);outline:none;pointer-events:auto}
.dce-input:focus{border-color:var(--dsw-alias-brand-primary,#7c9cff)}
.dce-settings{display:flex;flex-direction:column;gap:14px;max-width:620px;color:var(--dsw-alias-label-primary,#eee);padding:4px 2px 24px}
.dce-settings h2{font-size:16px;margin:0}
.dce-settings p{margin:0;font-size:12.5px;line-height:1.7;color:var(--dsw-alias-label-secondary,#aaa)}
.dce-row{display:flex;align-items:flex-start;gap:16px;padding:12px 0;border-top:1px solid var(--dsw-alias-border-l1,#333)}
.dce-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.dce-row-title{font-size:13px;font-weight:600}
.dce-row-hint{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,#888)}
.dce-seg{display:inline-flex;padding:2px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#232323);flex:none}
.dce-seg button{font:inherit;font-size:12px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);padding:5px 10px;border-radius:7px;cursor:pointer;pointer-events:auto}
.dce-seg button[data-on="1"]{background:var(--dsw-alias-bg-layer-3,#2e2e2e);color:var(--dsw-alias-label-primary,#eee);box-shadow:0 1px 2px rgba(0,0,0,.25)}
.dce-note{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#777)}
`

    /* ---------------------------------------------------------------- */
    /* Store                                                             */
    /* ---------------------------------------------------------------- */

    let state = {
      config: Object.assign({}, DEFAULT_CONFIG),
      configReady: false,
      pending: null,
      open: false,
      resolved: false,
      request: null,
      explanation: { key: null, status: 'idle', data: null, error: null },
      chat: { open: false, key: null, messages: [], sending: false, error: null },
      injected: false,
      toast: null,
    }
    const listeners = new Set()
    const getState = () => state

    function update(patch) {
      state = Object.assign({}, state, patch)
      for (const listener of listeners) {
        try { listener() } catch { /* one broken subscriber must not stop the rest */ }
      }
    }

    function subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }

    /** Whole-store subscription: the state object is replaced on every change. */
    function useStore() {
      return React.useSyncExternalStore(subscribe, getState)
    }

    function setInjected(value) {
      if (state.injected !== value) update({ injected: value })
    }

    /* ---------------------------------------------------------------- */
    /* Host API                                                          */
    /* ---------------------------------------------------------------- */

    async function api(path, body) {
      const response = await fetch(BASE + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
      })
      let data = null
      try { data = await response.json() } catch { data = null }
      if (!response.ok) {
        const message = data && typeof data.error === 'string' ? data.error : '请求失败（HTTP ' + response.status + '）'
        throw new Error(message)
      }
      return data || {}
    }

    let configPromise = null
    function loadConfig() {
      if (configPromise !== null) return configPromise
      configPromise = api('/config').then((data) => {
        update({ config: Object.assign({}, DEFAULT_CONFIG, data.config || {}), configReady: true })
      }).catch(() => {
        update({ configReady: true })
      })
      return configPromise
    }

    function saveConfig(patch) {
      update({ config: Object.assign({}, state.config, patch) })
      api('/config', patch).then((data) => {
        if (data && data.config) update({ config: Object.assign({}, DEFAULT_CONFIG, data.config) })
      }).catch((error) => {
        update({ toast: '设置保存失败：' + error.message })
        setTimeout(() => { if (state.toast) update({ toast: null }) }, 4000)
      })
    }

    /* ---------------------------------------------------------------- */
    /* Pending request                                                   */
    /* ---------------------------------------------------------------- */

    function reasonOf(pending) {
      const display = pending && pending.displayReason
      if (display && typeof display === 'object') {
        const preferred = display.zh || display['zh-CN'] || display.en
        if (typeof preferred === 'string' && preferred !== '') return preferred
        for (const value of Object.values(display)) if (typeof value === 'string' && value !== '') return value
      }
      return pending && typeof pending.reason === 'string' ? pending.reason : ''
    }

    function questionsOf(pending) {
      const list = pending && Array.isArray(pending.questions) ? pending.questions : []
      return list.slice(0, 8).map((question) => ({
        header: typeof question.header === 'string' ? question.header : '',
        question: typeof question.question === 'string' ? question.question : '',
        detail: typeof question.detail === 'string' ? question.detail : '',
        multiSelect: question.multiSelect === true,
        options: Array.isArray(question.options)
          ? question.options.slice(0, 12).map((option) => ({
            label: String(option && option.label !== undefined ? option.label : ''),
            description: String(option && option.description !== undefined ? option.description : ''),
          }))
          : [],
      }))
    }

    function toRequest(pending, cardText) {
      const kind = pending && (pending.kind === 'question' || pending.kind === 'plan-review') ? pending.kind : 'approval'
      return {
        key: pending && pending.key ? String(pending.key) : '',
        kind,
        sessionId: pending && pending.sessionId !== undefined ? String(pending.sessionId) : '',
        toolName: pending && typeof pending.toolName === 'string' ? pending.toolName : '',
        reason: reasonOf(pending),
        questions: questionsOf(pending),
        cardText: typeof cardText === 'string' ? cardText.slice(0, 12000) : '',
      }
    }

    function setPending(pending) {
      const previous = state.pending
      if (previous && pending && previous.key === pending.key) return
      if (!pending) {
        update({ pending: null, resolved: state.open ? true : state.resolved })
        return
      }
      const sameKey = state.explanation.key === pending.key
      const request = toRequest(pending, sameKey && state.request ? state.request.cardText : '')
      update({
        pending,
        resolved: false,
        request,
        open: sameKey ? state.open : false,
        explanation: sameKey ? state.explanation : { key: pending.key, status: 'idle', data: null, error: null },
        chat: sameKey ? state.chat : { open: false, key: pending.key, messages: [], sending: false, error: null },
      })
    }

    /* ---------------------------------------------------------------- */
    /* Card text + injection                                             */
    /* ---------------------------------------------------------------- */

    function cardTextOf(root) {
      try {
        const clone = root.cloneNode(true)
        const own = clone.querySelectorAll ? clone.querySelectorAll('[' + BTN_ATTR + ']') : []
        for (const node of own) node.remove()
        const content = clone.textContent || ''
        return content.replace(/\s+/g, ' ').trim().slice(0, 12000)
      } catch {
        return ''
      }
    }

    function findCard(pending) {
      const attribute = pending.kind === 'approval' ? 'data-approval-key' : 'data-question-key'
      const wanted = String(pending.key || '')
      const nodes = document.querySelectorAll('[' + attribute + ']')
      for (const node of nodes) {
        if (node.getAttribute(attribute) === wanted) return node
      }
      return null
    }

    function makeButton(onClick) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'dce-pill'
      button.setAttribute(BTN_ATTR, '1')
      button.setAttribute('aria-label', '用大白话解释这条确认')
      button.title = '用大白话解释这条确认'
      button.textContent = '✦ 解释'
      button.style.pointerEvents = 'auto'
      button.addEventListener('mousedown', (event) => { event.stopPropagation() })
      // Keep every key inside the pill: an Escape bubbling to the approval card
      // would reject the request the user is trying to understand.
      button.addEventListener('keydown', (event) => { event.stopPropagation() })
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        // Move focus out of the card before the drawer mounts, so Escape closes
        // the drawer instead of reaching the approval card's Escape handler.
        button.blur()
        onClick()
      })
      return button
    }

    function placeOnApproval(root, button) {
      button.classList.add('dce-card-btn')
      // The slot root is a full-width wrapper; the visible card is its first child.
      // Anchor to the card so the pill sits on the card's corner, not the page edge.
      const card = root.firstElementChild || root
      const computed = window.getComputedStyle ? window.getComputedStyle(card) : null
      if (computed && computed.position === 'static') card.style.position = 'relative'
      card.appendChild(button)
    }

    function placeOnQuestion(root, button) {
      const header = root.querySelector('header')
      if (!header) {
        button.classList.add('dce-card-btn')
        const computed = window.getComputedStyle ? window.getComputedStyle(root) : null
        if (computed && computed.position === 'static') root.style.position = 'relative'
        root.appendChild(button)
        return
      }
      button.style.flex = 'none'
      header.appendChild(button)
    }

    /**
     * Keep one pill on the live card until the request settles.
     * @param pending the interaction currently waiting for the user
     * @param onOpen receives the card's visible text
     * @returns teardown that removes the pill and every observer
     */
    function startInjector(pending, onOpen) {
      let stopped = false
      let button = null
      let queued = false

      const ensure = () => {
        if (stopped) return
        if (!state.pending || state.pending.key !== pending.key) return
        const root = findCard(pending)
        if (!root) {
          setInjected(false)
          return
        }
        if (root.querySelector('[' + BTN_ATTR + ']')) {
          setInjected(true)
          return
        }
        button = makeButton(() => onOpen(cardTextOf(root)))
        if (pending.kind === 'approval') placeOnApproval(root, button)
        else placeOnQuestion(root, button)
        setInjected(true)
      }

      const schedule = () => {
        if (queued || stopped) return
        queued = true
        const run = () => { queued = false; ensure() }
        if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run)
        else setTimeout(run, 30)
      }

      const observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
      ensure()
      const timer = setInterval(ensure, 900)

      return () => {
        stopped = true
        observer.disconnect()
        clearInterval(timer)
        if (button && button.parentNode) button.parentNode.removeChild(button)
        button = null
        setInjected(false)
      }
    }

    function injectStyle() {
      if (document.getElementById(STYLE_ID)) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
    }

    /* ---------------------------------------------------------------- */
    /* Actions                                                           */
    /* ---------------------------------------------------------------- */

    function openPanel(cardText) {
      const pending = state.pending
      if (!pending) return
      const request = toRequest(pending, cardText || '')
      const sameKey = state.explanation.key === pending.key
      const chat = sameKey
        ? state.chat
        : { open: false, key: pending.key, messages: [], sending: false, error: null }
      if (state.config.miniWindow && !chat.open) chat.open = true
      update({ open: true, resolved: false, request, chat })
      const idle = !sameKey || state.explanation.status === 'idle'
      const failed = state.explanation.status === 'error'
      if (failed || (idle && state.config.autoExplain)) runExplain(request)
    }

    function runExplain(request) {
      const target = request || state.request
      if (!target) return
      const key = target.key
      update({ explanation: { key, status: 'loading', data: null, error: null } })
      api('/explain', { request: target, detail: state.config.detail }).then((data) => {
        if (!state.request || state.request.key !== key) return
        update({ explanation: { key, status: 'ready', data: data.explanation, error: null } })
      }).catch((error) => {
        if (!state.request || state.request.key !== key) return
        update({ explanation: { key, status: 'error', data: null, error: error.message } })
      })
    }

    function closePanel() {
      update({ open: false })
    }

    function openChat() {
      const request = state.request
      if (!request) return
      const same = state.chat.key === request.key
      update({
        chat: same
          ? Object.assign({}, state.chat, { open: true })
          : { open: true, key: request.key, messages: [], sending: false, error: null },
      })
    }

    function closeChat() {
      update({ chat: Object.assign({}, state.chat, { open: false }) })
    }

    function sendChat(question) {
      const content = String(question || '').trim()
      const request = state.request
      if (content === '' || !request || state.chat.sending) return
      const history = state.chat.messages
      const messages = history.concat([{ role: 'user', content }])
      update({ chat: Object.assign({}, state.chat, { messages, sending: true, error: null }) })
      api('/chat', { request, history, question: content }).then((data) => {
        update({
          chat: Object.assign({}, state.chat, {
            messages: state.chat.messages.concat([{ role: 'assistant', content: data.answer }]),
            sending: false,
          }),
        })
      }).catch((error) => {
        update({ chat: Object.assign({}, state.chat, { sending: false, error: error.message }) })
      })
    }


    /* ---------------------------------------------------------------- */
    /* Components                                                        */
    /* ---------------------------------------------------------------- */

    function Section(props) {
      return h('div', { className: 'dce-sec' },
        props.title ? h('div', { className: 'dce-sec-title' }, props.title) : null,
        props.children)
    }

    function Segmented(props) {
      return h('div', { className: 'dce-seg' }, props.options.map(function (option) {
        return h('button', {
          key: option[0],
          type: 'button',
          'data-on': props.value === option[0] ? '1' : '0',
          onClick: function () { props.onChange(option[0]) },
        }, option[1])
      }))
    }

    function Row(props) {
      return h('div', { className: 'dce-row' },
        h('div', { className: 'dce-row-main' },
          h('div', { className: 'dce-row-title' }, props.title),
          props.hint ? h('div', { className: 'dce-row-hint' }, props.hint) : null),
        props.children)
    }

    function RiskBadge(props) {
      const level = props.level === 'low' || props.level === 'high' || props.level === 'unknown' ? props.level : 'medium'
      return h('div', { className: 'dce-risk', style: { color: RISK_COLOR[level] } },
        h('span', { className: 'dce-dot', style: { background: RISK_COLOR[level] } }),
        RISK_LABEL[level])
    }

    function ExplanationView(props) {
      const data = props.data
      if (!data) return null
      const risk = data.risk || { level: 'medium', points: [] }
      const rec = data.recommendation || { decision: 'careful', why: '' }
      const decision = rec.decision === 'allow' || rec.decision === 'reject' ? rec.decision : 'careful'
      const recBackground = decision === 'allow'
        ? 'rgba(34,197,94,.08)'
        : decision === 'reject' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)'
      return h(React.Fragment, null,
        data.parseFailed
          ? h('div', { className: 'dce-banner' }, '模型这次把 JSON 写断了，下面是原文；点底部「重新生成」会再试一次。')
          : null,
        data.parseFailed
          ? h('pre', { className: 'dce-source-text', style: { maxHeight: 300 } }, data.raw || data.plain)
          : null,
        data.parseFailed ? null : h('div', { className: 'dce-sec' },
          h('div', { className: 'dce-lead' }, data.title || '这条确认在问什么'),
          data.plain ? h('div', { className: 'dce-plain', style: { marginTop: 6 } }, data.plain) : null),
        data.willDo && data.willDo.length > 0
          ? h(Section, { title: '它会做什么' },
            h('ul', { className: 'dce-list' }, data.willDo.map(function (item, index) {
              return h('li', { key: index }, item)
            })))
          : null,
        data.impact ? h(Section, { title: '影响范围' }, h('div', { className: 'dce-plain' }, data.impact)) : null,
        h(Section, { title: '风险' },
          h(RiskBadge, { level: risk.level }),
          risk.points && risk.points.length > 0
            ? h('ul', { className: 'dce-list', style: { marginTop: 6 } }, risk.points.map(function (item, index) {
              return h('li', { key: index }, item)
            }))
            : null),
        h('div', {
          className: 'dce-rec',
          style: { borderColor: DECISION_COLOR[decision], background: recBackground },
        },
          h('b', { style: { color: DECISION_COLOR[decision] } }, DECISION_LABEL[decision]),
          rec.why ? h('span', null, rec.why) : null),
        (data.ifAllow || data.ifReject)
          ? h('div', { className: 'dce-cols' },
            data.ifAllow ? h(Section, { title: '如果允许' }, h('div', { className: 'dce-col' }, data.ifAllow)) : null,
            data.ifReject ? h(Section, { title: '如果拒绝' }, h('div', { className: 'dce-col' }, data.ifReject)) : null)
          : null,
        data.unclear && data.unclear.length > 0
          ? h(Section, { title: '原文没说清的' },
            h('ul', { className: 'dce-list' }, data.unclear.map(function (item, index) {
              return h('li', { key: index }, item)
            })))
          : null)
    }

    function Panel() {
      const st = useStore()
      const [ticks, setTicks] = React.useState(0)
      const bodyRef = React.useRef(null)
      const status = st.explanation.status

      React.useEffect(function () {
        if (bodyRef.current) bodyRef.current.scrollTop = 0
      }, [st.open, st.request && st.request.key])

      React.useEffect(function () {
        if (status !== 'loading') {
          setTicks(0)
          return undefined
        }
        const timer = setInterval(function () { setTicks(function (value) { return value + 1 }) }, 500)
        return function () { clearInterval(timer) }
      }, [status])

      React.useEffect(function () {
        if (!st.open && !st.chat.open) return undefined
        function onKey(event) {
          if (event.key !== 'Escape') return
          if (st.chat.open) closeChat()
          else closePanel()
        }
        window.addEventListener('keydown', onKey)
        return function () { window.removeEventListener('keydown', onKey) }
      }, [st.open, st.chat.open])

      const request = st.request
      const body = []

      if (st.resolved) {
        body.push(h('div', { className: 'dce-banner', key: 'resolved' }, '这条确认已经处理过了；下面保留的是当时的解释，供回看。'))
      }

      if (!request) {
        body.push(h('div', { className: 'dce-empty', key: 'empty' }, '还没有可解释的确认。等下一次审批或提问出现时，点卡片上的「解释」。'))
      } else {
        body.push(h('div', { className: 'dce-sec', key: 'request' },
          h('div', { className: 'dce-sec-title' }, '这次确认'),
          request.toolName ? h('div', { className: 'dce-kind', style: { display: 'inline-block', marginBottom: 6 } }, request.toolName) : null,
          request.reason
            ? h('div', { className: 'dce-plain' }, request.reason)
            : h('div', { className: 'dce-empty' }, '卡片没有附加说明，主要看下面的原文。'),
          request.cardText
            ? h('details', { className: 'dce-source' },
              h('summary', null, '查看卡片原文'),
              h('pre', { className: 'dce-source-text' }, request.cardText))
            : null))

        if (status === 'loading') {
          body.push(h('div', { className: 'dce-loading', key: 'loading' },
            h('span', { className: 'dce-spinner' }),
            '正在读懂这条确认' + (ticks > 0 ? '（' + Math.round(ticks / 2) + ' 秒）' : '…')))
        } else if (status === 'error') {
          body.push(h('div', { className: 'dce-error', key: 'error' },
            h('div', null, '没能生成解释：' + (st.explanation.error || '未知错误')),
            h('div', null,
              h('button', { className: 'dce-btn', onClick: function () { runExplain() } }, '再试一次'))))
        } else if (status === 'ready') {
          body.push(h(ExplanationView, { key: 'explanation', data: st.explanation.data }))
        } else {
          body.push(h('div', { className: 'dce-empty', key: 'idle' },
            '自动解释已关闭。点下面的按钮，让模型把这张卡片翻译成大白话。',
            h('div', { style: { marginTop: 10 } },
              h('button', { className: 'dce-btn dce-btn-primary', onClick: function () { runExplain() } }, '生成解释'))))
        }
      }

      const panel = h('div', { className: 'dce-panel' },
        h('div', { className: 'dce-head' },
          h('span', { style: { color: T.brand, fontSize: 13, lineHeight: 1 } }, '✦'),
          h('div', { className: 'dce-title' }, '这条确认在问什么'),
          request ? h('span', { className: 'dce-kind' }, KIND_LABEL[request.kind] || '确认') : null,
          h('div', { className: 'dce-spacer' }),
          h('button', {
            className: 'dce-icon-btn', type: 'button', title: '在小窗里追问', 'aria-label': '在小窗里追问',
            onClick: openChat, disabled: !request,
          }, '💬'),
          h('button', { className: 'dce-icon-btn', type: 'button', title: '关闭', 'aria-label': '关闭', autoFocus: true, onClick: closePanel }, '✕')),
        h('div', { className: 'dce-body', ref: bodyRef }, body),
        h('div', { className: 'dce-foot' },
          h('button', { className: 'dce-btn dce-btn-primary', type: 'button', onClick: openChat, disabled: !request }, '追问这条'),
          h('button', {
            className: 'dce-btn', type: 'button',
            onClick: function () { runExplain() },
            disabled: !request || status === 'loading',
          }, status === 'loading' ? '生成中…' : '重新生成'),
          h('div', { className: 'dce-spacer' }),
          h('button', {
            className: 'dce-btn dce-btn-ghost', type: 'button',
            onClick: function () {
              saveConfig({ presentation: st.config.presentation === 'modal' ? 'drawer' : 'modal' })
            },
          }, st.config.presentation === 'modal' ? '改成侧栏' : '改成弹窗')))

      const surface = st.config.presentation === 'modal'
        ? h('div', {
          className: 'dce-backdrop', key: 'modal',
          onMouseDown: function (event) { if (event.target === event.currentTarget) closePanel() },
        }, h('div', { className: 'dce-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '确认解释' }, panel))
        : h('div', { className: 'dce-drawer', key: 'drawer', role: 'dialog', 'aria-modal': 'false', 'aria-label': '确认解释' }, panel)

      return h(React.Fragment, null,
        st.open ? surface : null,
        st.chat.open ? h(FloatChat, { key: 'chat' }) : null)
    }

    function FloatChat() {
      const st = useStore()
      const chat = st.chat
      const [draft, setDraft] = React.useState('')
      const [pos, setPos] = React.useState(null)
      const [drag, setDrag] = React.useState(null)
      const surface = React.useRef(null)
      const scroller = React.useRef(null)

      React.useEffect(function () {
        if (!drag) return undefined
        function move(event) {
          setPos({
            left: Math.max(4, drag.left + event.clientX - drag.x),
            top: Math.max(4, drag.top + event.clientY - drag.y),
          })
        }
        function up() { setDrag(null) }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        return function () {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
      }, [drag])

      React.useEffect(function () {
        const node = scroller.current
        if (node) node.scrollTop = node.scrollHeight
      }, [chat.messages.length, chat.sending])

      function startDrag(event) {
        if (event.button !== 0 || !surface.current) return
        const rect = surface.current.getBoundingClientRect()
        setPos({ left: rect.left, top: rect.top })
        setDrag({ x: event.clientX, y: event.clientY, left: rect.left, top: rect.top })
      }

      function submit() {
        const text = draft.trim()
        if (text === '') return
        setDraft('')
        sendChat(text)
      }

      const docked = st.open && st.config.presentation === 'drawer'
      const style = pos === null
        ? { right: docked ? '464px' : '24px' }
        : { left: pos.left + 'px', top: pos.top + 'px', right: 'auto', bottom: 'auto' }
      return h('div', { className: 'dce-float', ref: surface, style: style, role: 'dialog', 'aria-label': '追问这条确认' },
        h('div', { className: 'dce-float-head', onPointerDown: startDrag, style: { touchAction: 'none' } },
          h('span', { style: { color: T.brand, fontSize: 12 } }, '💬'),
          h('div', { className: 'dce-float-title' }, '追问 · 这条确认'),
          h('button', { className: 'dce-icon-btn', type: 'button', title: '关闭', 'aria-label': '关闭追问窗', onClick: closeChat }, '✕')),
        h('div', { className: 'dce-float-body', ref: scroller },
          chat.messages.length === 0
            ? h('div', { className: 'dce-empty' },
              '针对刚才这条确认继续问。比如：',
              h('div', { style: { marginTop: 4 } }, '· 它会不会删掉我的文件？'),
              h('div', null, '· 如果我拒绝，任务还能继续吗？'),
              h('div', null, '· 这个权限以后还会再要吗？'))
            : chat.messages.map(function (message, index) {
              return h('div', {
                key: index,
                className: 'dce-msg ' + (message.role === 'user' ? 'dce-msg-user' : 'dce-msg-assistant'),
              }, message.content)
            }),
          chat.sending ? h('div', { className: 'dce-loading', style: { padding: '4px 2px' } }, h('span', { className: 'dce-spinner' }), '正在回答…') : null,
          chat.error ? h('div', { className: 'dce-error' }, chat.error) : null),
        h('div', { className: 'dce-float-foot' },
          h('textarea', {
            className: 'dce-input', value: draft, rows: 1, placeholder: '追问这条判断…（Enter 发送）',
            onInput: function (event) { setDraft(event.target.value) },
            onKeyDown: function (event) {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            },
          }),
          h('button', { className: 'dce-btn dce-btn-primary', type: 'button', onClick: submit, disabled: chat.sending || draft.trim() === '' }, '发送')))
    }

    function Probe(props) {
      const sessionId = props.sessionId
      const pending = props.useSessionStatus
        ? props.useSessionStatus(function (map) {
          return map && map.get(sessionId) ? map.get(sessionId).pendingInteraction : undefined
        })
        : undefined
      const key = pending && pending.key ? String(pending.key) : ''

      React.useEffect(function () {
        setPending(pending || null)
        if (!pending || !state.config.injectButton) {
          setInjected(false)
          return undefined
        }
        return startInjector(pending, function (cardText) { openPanel(cardText) })
      }, [key, state.config.injectButton])

      const st = useStore()
      if (!pending) return null
      if (st.injected) return null
      return h('button', {
        type: 'button',
        className: 'dce-pill dce-header-btn',
        title: '用大白话解释这条确认',
        style: { marginLeft: 6 },
        onClick: function () { openPanel('') },
      }, '✦ 解释')
    }

    function SettingsSection() {
      const st = useStore()
      const config = st.config
      return h('div', { className: 'dce-settings' },
        h('h2', null, '确认解释'),
        h('p', null, '把权限审批和选择确认翻译成大白话：会做什么、影响什么、有什么风险、建议放行还是拒绝。解释只供参考，按钮仍由你自己点。'),
        h(Row, { title: '展示方式', hint: '右侧抽屉不挡输入框；居中弹窗适合仔细读长解释。' },
          h(Segmented, {
            value: config.presentation,
            options: [['drawer', '右侧抽屉'], ['modal', '居中弹窗']],
            onChange: function (value) { saveConfig({ presentation: value }) },
          })),
        h(Row, { title: '打开时自动解释', hint: '关闭后先显示「生成解释」，点一下才调用模型，更省额度。' },
          h(Segmented, {
            value: config.autoExplain ? 'on' : 'off',
            options: [['on', '开'], ['off', '关']],
            onChange: function (value) { saveConfig({ autoExplain: value === 'on' }) },
          })),
        h(Row, { title: '在确认卡片上显示「解释」', hint: '关闭后入口移到会话标题栏，卡片保持原样。' },
          h(Segmented, {
            value: config.injectButton ? 'on' : 'off',
            options: [['on', '开'], ['off', '关']],
            onChange: function (value) { saveConfig({ injectButton: value === 'on' }) },
          })),
        h(Row, { title: '同时打开追问小窗', hint: '打开解释面板时，顺带展开右下角的独立聊天窗。' },
          h(Segmented, {
            value: config.miniWindow ? 'on' : 'off',
            options: [['on', '开'], ['off', '关']],
            onChange: function (value) { saveConfig({ miniWindow: value === 'on' }) },
          })),
        h(Row, { title: '解释详细度', hint: '简明更快；标准会列出具体动作与允许/拒绝后果。' },
          h(Segmented, {
            value: config.detail,
            options: [['brief', '简明'], ['standard', '标准']],
            onChange: function (value) { saveConfig({ detail: value }) },
          })),
        h('div', { className: 'dce-note' },
          '配置保存在 ~/.dsh/confirm-explain/config.json。模型沿用 DSH 当前默认模型；卡片原文只在本次调用中发送，不落盘。' + (st.configReady ? '' : '（正在读取配置…）')))
    }

    /* ---------------------------------------------------------------- */
    /* Registration                                                      */
    /* ---------------------------------------------------------------- */

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          injectStyle()
          loadConfig()
          ctx.slots.inject('shell.overlay', function () {
            return ctx.slots.register({ name: 'shell.overlay', id: 'confirm-explain-panel', order: 50 }, Panel)
          })
          ctx.slots.inject('conversation.session.header.actions', function () {
            return ctx.slots.register({ name: 'conversation.session.header.actions', id: 'confirm-explain-probe', order: 80 }, Probe)
          })
          ctx.slots.inject('settings.section', function () {
            return ctx.slots.register({ name: 'settings.section', id: 'confirm-explain', order: 120, label: '确认解释' }, SettingsSection)
          })
        } catch (error) {
          console.error('[dsh-confirm-explain] 注册失败', error)
        }
      },
    }
  },
})
