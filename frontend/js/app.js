const API = (window.API_BASE || 'http://localhost:8000') + '/api'
let activeView = 'followers'
let page = 1, totalItems = 0, searchQuery = ''
const PER = 30
let searchTimer = null

// ── URL state ─────────────────────────────────────────────────────────────────

function pushURL(view, p) {
  const url = new URL(location.href)
  url.searchParams.set('view', view)
  url.searchParams.set('page', p)
  history.pushState({ view, page: p }, '', url)
}

function readURL() {
  const params = new URLSearchParams(location.search)
  const v = params.get('view')
  const p = parseInt(params.get('page')) || 1
  if (['followers', 'following', 'unfollowed'].includes(v)) activeView = v
  page = p
}

window.addEventListener('popstate', (e) => {
  if (e.state) { activeView = e.state.view; page = e.state.page }
  else readURL()
  syncTabUI()
  renderContent()
})

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path) {
  const r = await fetch(API + path)
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
}

const IST = { timeZone: 'Asia/Kolkata' }

function shortNum(n) {
  if (n === null || n === undefined) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

function fmt(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', {
    ...IST, month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function fmtShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    ...IST, month: 'short', day: 'numeric', year: 'numeric',
  })
}

function ago(iso) {
  if (!iso) return ''
  const s = (Date.now() - new Date(iso)) / 1000
  if (s < 60)    return 'just now'
  if (s < 3600)  return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

function animateCount(el, target) {
  if (!el) return
  const from = parseInt(el.textContent) || 0
  const dur = 700, t0 = performance.now()
  function tick(now) {
    const p = Math.min((now - t0) / dur, 1)
    const ease = 1 - Math.pow(1 - p, 3)
    el.textContent = Math.round(from + (target - from) * ease)
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// ── Profile ───────────────────────────────────────────────────────────────────

async function loadProfile() {
  try {
    const p = await apiFetch('/profile')
    document.getElementById('p-avatar').src = p.avatar_url
    document.getElementById('p-name').textContent = p.name || p.login
    document.getElementById('p-username').textContent = '@' + p.login
    document.getElementById('p-bio').textContent = p.bio || ''
    document.getElementById('p-bio').style.display = p.bio ? 'block' : 'none'
    document.getElementById('ps-repos').textContent     = shortNum(p.public_repos)
    document.getElementById('ps-followers').textContent  = shortNum(p.followers)
    document.getElementById('ps-following').textContent  = shortNum(p.following)
  } catch (_) {}
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function setTabCount(view, n) {
  const el = document.querySelector(`.sub-tab[data-view="${view}"] .count`)
  if (el) el.textContent = n
}

async function loadStats() {
  try {
    const [s, f] = await Promise.all([
      apiFetch('/followers/stats'),
      apiFetch('/following?per_page=1'),
    ])
    animateCount(document.getElementById('st-followers'),  s.total_followers)
    animateCount(document.getElementById('st-unfollowed'), s.total_unfollowed_events)
    animateCount(document.getElementById('st-following'),  f.total)

    // Set tab badges directly from raw API values — never read mid-animation DOM
    setTabCount('followers',  s.total_followers)
    setTabCount('following',  f.total)
    setTabCount('unfollowed', s.total_unfollowed_events)
  } catch (_) {}
}

// ── Navigation ────────────────────────────────────────────────────────────────

const VIEW_LABELS = {
  followers:  ['Following You',   'People who are currently in your audience on GitHub'],
  following:  ['You Follow',      'People you are currently following on GitHub'],
  unfollowed: ['Lost Followers',  'People who were in your audience but dropped off'],
}

function syncTabUI() {
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.toggle('active', t.dataset.view === activeView))
  const [title, desc] = VIEW_LABELS[activeView] || VIEW_LABELS.followers
  document.getElementById('view-title').textContent = title
  document.getElementById('view-desc').textContent  = desc
}

function switchView(view) {
  activeView = view
  page = 1
  searchQuery = ''
  document.getElementById('search-input').value = ''
  document.getElementById('search-clear').classList.remove('visible')
  document.getElementById('search-meta').style.display = 'none'
  pushURL(view, 1)
  syncTabUI()
  renderContent()
}

// ── Content ───────────────────────────────────────────────────────────────────

async function renderContent() {
  const box = document.getElementById('content')
  box.innerHTML = skeleton()
  hidePagination()
  setSearchSpinner(true)

  const q = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''

  try {
    if (activeView === 'followers') {
      const d = await apiFetch(`/followers?page=${page}&per_page=${PER}${q}`)
      totalItems = d.total
      box.innerHTML = d.data.length
        ? userGrid(d.data)
        : emptyState('👥', searchQuery ? `No results for "${searchQuery}"` : 'No audience yet', searchQuery ? 'Try a different username.' : 'Click Sync Now to fetch your GitHub audience.')
    } else if (activeView === 'following') {
      const d = await apiFetch(`/following?page=${page}&per_page=${PER}${q}`)
      totalItems = d.total
      box.innerHTML = d.data.length
        ? userGrid(d.data)
        : emptyState('🔍', searchQuery ? `No results for "${searchQuery}"` : 'Not following anyone yet', searchQuery ? 'Try a different username.' : 'Click Sync Now to fetch who you follow.')
    } else {
      const d = await apiFetch(`/followers/unfollowed?page=${page}&per_page=${PER}${q}`)
      totalItems = d.total
      box.innerHTML = d.data.length
        ? unfollowFeed(d.data)
        : emptyState('🎉', searchQuery ? `No results for "${searchQuery}"` : 'No lost followers — great!', searchQuery ? 'Try a different username.' : 'Everyone who followed you is still here. Keep it up!')
    }
    renderPagination()
    updateSearchMeta()
  } catch (e) {
    box.innerHTML = emptyState('⚠️', 'Could not load data', 'Make sure the backend is running. ' + e.message)
  } finally {
    setSearchSpinner(false)
  }
}

function skeleton() {
  if (activeView === 'unfollowed') {
    return `<div class="unfollow-feed">${Array(5).fill(`<div class="skel" style="height:66px"></div>`).join('')}</div>`
  }
  return `<div class="user-grid">${Array(9).fill(`<div class="skel" style="height:62px"></div>`).join('')}</div>`
}

function userGrid(list) {
  return `<div class="user-grid">${list.map(u => {
    const isNew = u.is_initial === false
    const label = isNew
      ? `<div class="u-since u-new">Followed ${fmtShort(u.captured_at)}</div>`
      : `<div class="u-since">Existing</div>`
    return `<a class="u-card${isNew ? ' u-card-new' : ''}" href="${u.html_url}" target="_blank" rel="noopener noreferrer">
      <img src="${u.avatar_url}" alt="${u.login}" loading="lazy"/>
      <div class="u-text">
        <div class="u-name">${u.login}</div>
        ${label}
      </div>
    </a>`
  }).join('')}</div>`
}

function unfollowFeed(list) {
  const icon = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`
  return `<div class="unfollow-feed">${list.map(ev => `
    <div class="unf-card">
      <div class="unf-badge">${icon}</div>
      <img src="${ev.avatar_url}" alt="${ev.login}" loading="lazy"/>
      <div class="unf-info">
        <a href="${ev.html_url}" target="_blank" rel="noopener noreferrer">${ev.login}</a>
        <div class="unf-date">Unfollowed on ${fmt(ev.event_at)}</div>
      </div>
      <button class="hist-btn" onclick="openHistory('${ev.login}')">History</button>
    </div>`).join('')}</div>`
}

function emptyState(emoji, title, desc) {
  return `<div class="empty"><div class="empty-emoji">${emoji}</div><h3>${title}</h3><p>${desc}</p></div>`
}

// ── Pagination ────────────────────────────────────────────────────────────────

function renderPagination() {
  const total = Math.ceil(totalItems / PER)
  const el = document.getElementById('pages')
  if (total <= 1) { el.style.display = 'none'; return }
  el.style.display = 'flex'
  document.getElementById('pg-prev').disabled = page <= 1
  document.getElementById('pg-next').disabled = page >= total
  document.getElementById('pg-info').textContent = `${page} / ${total}`
}

function hidePagination() { document.getElementById('pages').style.display = 'none' }

function changePage(d) {
  page += d
  pushURL(activeView, page)
  renderContent()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── Sync ──────────────────────────────────────────────────────────────────────

function startProg() {
  const b = document.getElementById('prog')
  b.className = ''; b.style.opacity = '1'
  b.style.transition = 'width 2.5s ease'; b.style.width = '0%'
  requestAnimationFrame(() => { b.style.width = '75%' })
}
function doneProg() {
  const b = document.getElementById('prog')
  b.style.transition = 'width 0.3s'; b.style.width = '100%'
  setTimeout(() => { b.classList.add('done') }, 300)
  setTimeout(() => { b.style.cssText = '' }, 1000)
}

function showToast(msg, ok = true) {
  const t = document.getElementById('toast')
  const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg>`
  const warn  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  t.className = ''
  t.innerHTML = (ok ? check : warn) + ' ' + msg
  requestAnimationFrame(() => t.className = ok ? 'ok' : 'err')
  setTimeout(() => { t.className = '' }, 4000)
}

async function syncNow() {
  const btn = document.getElementById('sync-btn')
  const spin = document.getElementById('i-spin')
  const chk  = document.getElementById('i-check')
  const def  = document.getElementById('i-def')
  const lbl  = document.getElementById('btn-label')

  btn.disabled = true
  def.style.display = 'none'
  spin.style.display = 'inline-block'; spin.classList.add('spin')
  lbl.textContent = 'Syncing…'
  startProg()

  try {
    const r = await fetch(API + '/sync', { method: 'POST' })
    const d = await r.json()
    doneProg()

    spin.style.display = 'none'; spin.classList.remove('spin')
    chk.style.display = 'inline-block'
    btn.classList.add('synced')
    lbl.textContent = 'Synced!'

    const parts = [`${d.total_followers} followers`]
    if (d.new_followers)  parts.push(`+${d.new_followers} gained`)
    if (d.lost_followers) parts.push(`-${d.lost_followers} unfollowed`)
    showToast(parts.join(' · '))

    loadStats()
    renderContent()

    setTimeout(() => {
      chk.style.display = 'none'; def.style.display = 'inline-block'
      btn.classList.remove('synced'); lbl.textContent = 'Sync Now'
      btn.disabled = false
    }, 2500)

  } catch (e) {
    doneProg()
    spin.style.display = 'none'; spin.classList.remove('spin')
    def.style.display = 'inline-block'
    lbl.textContent = 'Sync Now'; btn.disabled = false
    showToast('Sync failed — is the backend running?', false)
  }
}

// ── History Modal ─────────────────────────────────────────────────────────────

async function openHistory(login) {
  document.getElementById('modal-login').textContent = login
  document.getElementById('modal-body').innerHTML = `<div class="empty" style="padding:28px"><p>Loading…</p></div>`
  document.getElementById('modal').style.display = 'flex'

  try {
    const list = await apiFetch(`/followers/${login}/history`)
    if (!list.length) {
      document.getElementById('modal-body').innerHTML = `<div class="empty" style="padding:28px"><h3>No history found</h3></div>`
      return
    }
    const gainIcon = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`
    const lossIcon = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`

    document.getElementById('modal-body').innerHTML = list.map(ev => {
      const isGain = ev.event_type === 'followed'
      return `<div class="h-row">
        <div class="unf-badge" style="${isGain ? 'background:rgba(63,185,80,0.1);border-color:rgba(63,185,80,0.25)' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" width="16" height="16" style="stroke:${isGain ? '#3fb950' : '#f85149'}">
            ${isGain ? '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>' : '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/>'}
          </svg>
        </div>
        <div>
          <div class="h-action">${isGain ? 'Followed you' : 'Unfollowed you'}</div>
          <div class="h-date">${fmt(ev.event_at)}</div>
        </div>
      </div>`
    }).join('')
  } catch (e) {
    document.getElementById('modal-body').innerHTML = `<div class="empty" style="padding:28px"><p>Error: ${e.message}</p></div>`
  }
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal'))
    document.getElementById('modal').style.display = 'none'
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

// ── Search ────────────────────────────────────────────────────────────────────

function onSearch(val) {
  const clearBtn = document.getElementById('search-clear')
  clearBtn.classList.toggle('visible', val.length > 0)
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchQuery = val.trim()
    page = 1
    pushURL(activeView, 1)
    renderContent()
  }, 320)
}

function clearSearch() {
  document.getElementById('search-input').value = ''
  document.getElementById('search-clear').classList.remove('visible')
  document.getElementById('search-meta').style.display = 'none'
  searchQuery = ''
  page = 1
  pushURL(activeView, 1)
  renderContent()
  document.getElementById('search-input').focus()
}

function setSearchSpinner(active) {
  document.getElementById('search-spinner').classList.toggle('active', active)
}

function updateSearchMeta() {
  const meta = document.getElementById('search-meta')
  const txt  = document.getElementById('search-result-text')
  if (!searchQuery) { meta.style.display = 'none'; return }
  meta.style.display = 'flex'
  const viewLabel = { followers: 'in your audience', following: 'you follow', unfollowed: 'lost followers' }
  txt.innerHTML = `<strong>${totalItems}</strong> ${viewLabel[activeView] || 'results'} matching <span class="highlight">"${searchQuery}"</span>`
}

// ── Init ──────────────────────────────────────────────────────────────────────

readURL()
syncTabUI()
loadProfile()
loadStats()
renderContent()
