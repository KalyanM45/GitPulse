// ── Repo Analytics ────────────────────────────────────────────────────────────

let repoPage = 1
let repoTotalItems = 0
let repoSearch = ''
let selectedRepo = 'all'
let repoDropdownOpen = false
let allReposList = []
let repoSearchTimer = null

// ── Language colors (GitHub palette) ─────────────────────────────────────────

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5',
  Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', 'C++': '#f34b7d',
  C: '#555555', 'C#': '#178600', Ruby: '#701516', PHP: '#4F5D95',
  Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Vue: '#41b883',
  'Jupyter Notebook': '#DA5B0B', R: '#198CE7', Scala: '#c22d40',
  'Objective-C': '#438eff', Haskell: '#5e5086', Elixir: '#6e4a7e',
  Lua: '#000080', Perl: '#0298c3', Dockerfile: '#384d54',
}
function langColor(lang) { return LANG_COLORS[lang] || '#8b949e' }

// ── SVG icon strings ──────────────────────────────────────────────────────────

const iStar   = `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
const iFork   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`
const iEye    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const iClone  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
const iCommit = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/></svg>`
const iRepo   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M3 3h18v18H3zM3 9h18M9 21V9"/></svg>`
const iWatch  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
const iLink   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
const iCal    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
const iIssue  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
const iDisk   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(kb) {
  if (!kb) return '—'
  if (kb < 1024) return kb + ' KB'
  return (kb / 1024).toFixed(1) + ' MB'
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function initRepos() {
  renderReposLoadingState()
  try {
    await loadRepoDropdownOptions()
    await loadReposOverview()
  } catch (e) {
    document.getElementById('repos-all').innerHTML =
      `<div class="empty"><div class="empty-emoji">⚠️</div><h3>Could not load repos</h3><p>Sync repos first or check your connection. ${e.message}</p></div>`
  }
}

function renderReposLoadingState() {
  const skel = (h) => `<div class="skel" style="height:${h}px;border-radius:14px"></div>`
  document.getElementById('repo-stats-row').innerHTML =
    [skel(80), skel(80), skel(80)].join('')
  document.getElementById('repo-insights').innerHTML =
    `<div class="repo-insight-grid">${[skel(200), skel(200), skel(200)].join('')}</div>`
  document.getElementById('repo-list-content').innerHTML =
    Array(5).fill(`<div class="skel" style="height:56px;border-radius:12px;margin-bottom:8px"></div>`).join('')
}

// ── Repo Dropdown ─────────────────────────────────────────────────────────────

async function loadRepoDropdownOptions() {
  const d = await apiFetch('/repos?per_page=100&page=1')
  allReposList = d.data
  renderDropdownOptions(allReposList)
}

function toggleRepoDropdown() {
  repoDropdownOpen = !repoDropdownOpen
  const menu = document.getElementById('repo-sel-menu')
  menu.style.display = repoDropdownOpen ? 'block' : 'none'
  if (repoDropdownOpen) {
    const fi = document.getElementById('repo-sel-filter')
    if (fi) { fi.value = ''; fi.focus() }
    renderDropdownOptions(allReposList)
  }
}

document.addEventListener('click', (e) => {
  if (repoDropdownOpen && !e.target.closest('#repo-sel-wrap')) {
    repoDropdownOpen = false
    const menu = document.getElementById('repo-sel-menu')
    if (menu) menu.style.display = 'none'
  }
})

function filterRepoOptions(val) {
  const filtered = val
    ? allReposList.filter(r => r.name.toLowerCase().includes(val.toLowerCase()))
    : allReposList
  renderDropdownOptions(filtered)
}

function renderDropdownOptions(repos) {
  const el = document.getElementById('repo-sel-options')
  if (!el) return
  const allOpt = `<div class="repo-opt${selectedRepo === 'all' ? ' active' : ''}" onclick="selectRepoView('all')">
    <span style="color:var(--blue);font-size:12px">All</span> All Repositories
  </div>`
  const repoOpts = repos.map(r =>
    `<div class="repo-opt${selectedRepo === r.name ? ' active' : ''}" onclick="selectRepoView('${r.name}')">
      <span class="lang-dot" style="background:${langColor(r.language || '')}"></span>
      ${r.name}
      ${r.is_fork ? '<span class="repo-badge fork" style="font-size:9px;padding:1px 4px">Fork</span>' : ''}
    </div>`
  ).join('')
  el.innerHTML = allOpt + repoOpts
}

function selectRepoView(name) {
  selectedRepo = name
  repoDropdownOpen = false
  document.getElementById('repo-sel-menu').style.display = 'none'
  document.getElementById('repo-sel-name').textContent = name === 'all' ? 'All Repositories' : name
  renderDropdownOptions(allReposList)

  if (name === 'all') {
    document.getElementById('repos-all').style.display = 'block'
    document.getElementById('repo-detail').style.display = 'none'
    repoPage = 1; repoSearch = ''
    const si = document.getElementById('repo-search')
    if (si) si.value = ''
    loadReposOverview()
  } else {
    document.getElementById('repos-all').style.display = 'none'
    document.getElementById('repo-detail').style.display = 'block'
    loadRepoDetail(name)
  }
}

// ── Overview (All Repos) ──────────────────────────────────────────────────────

async function loadReposOverview() {
  try {
    const [overview, list] = await Promise.all([
      apiFetch('/repos/overview'),
      apiFetch(`/repos?per_page=20&page=${repoPage}${repoSearch ? '&search=' + encodeURIComponent(repoSearch) : ''}`),
    ])
    renderOverviewStats(overview)
    renderInsights(overview)
    repoTotalItems = list.total
    renderRepoRows(list.data)
    renderRepoPagination()
  } catch (e) {
    document.getElementById('repo-stats-row').innerHTML =
      `<div style="color:var(--muted);font-size:13px">Could not load overview — sync first.</div>`
  }
}

async function loadRepoListContent() {
  document.getElementById('repo-list-content').innerHTML =
    Array(5).fill(`<div class="skel" style="height:56px;border-radius:12px;margin-bottom:8px"></div>`).join('')
  const q = repoSearch ? `&search=${encodeURIComponent(repoSearch)}` : ''
  const d = await apiFetch(`/repos?per_page=20&page=${repoPage}${q}`)
  repoTotalItems = d.total
  renderRepoRows(d.data)
  renderRepoPagination()
}

function renderOverviewStats(ov) {
  const cards = [
    { label: 'Repositories',   val: ov.total_repos,  color: 'c-blue',   icon: iRepo },
    { label: 'Total Stars',    val: ov.total_stars,  color: 'c-yellow', icon: iStar },
    { label: 'Total Forks',    val: ov.total_forks,  color: 'c-purple', icon: iFork },
    { label: 'Watchers',       val: ov.total_watchers, color: 'c-green', icon: iWatch },
  ]
  document.getElementById('repo-stats-row').innerHTML = cards.map(({ label, color, icon }, i) => `
    <div class="stat-card ${color}">
      <div class="stat-icon-box">${icon}</div>
      <div>
        <div class="stat-lbl">${label}</div>
        <div class="stat-val" id="rst${i}">—</div>
      </div>
    </div>
  `).join('')
  cards.forEach(({ val }, i) => animateCount(document.getElementById(`rst${i}`), val))
}

function renderInsights(ov) {
  const el = document.getElementById('repo-insights')
  el.innerHTML = `
    <div class="repo-insight-grid">
      <div class="insight-card">
        <div class="insight-title">Top Languages</div>
        <div id="repo-lang-body">${renderLangsHTML(ov.top_languages)}</div>
      </div>
      <div class="insight-card">
        <div class="insight-title">Most Starred</div>
        <div id="repo-starred-body">${renderTopReposList(ov.most_starred, 'stars', iStar, '#f9c513')}</div>
      </div>
      <div class="insight-card">
        <div class="insight-title">Most Visited</div>
        <div id="repo-viewed-body">${renderTopReposList(ov.most_viewed, 'traffic_views_total', iEye, '#3fb950')}</div>
      </div>
    </div>
  `
}

function renderLangsHTML(langs) {
  if (!langs || !langs.length) return '<div class="insight-empty">Sync to see language breakdown</div>'
  const total = langs.reduce((s, l) => s + l.bytes, 0)
  const bar = `<div class="lang-bar">${langs.map(l =>
    `<div class="lang-seg" style="width:${(l.bytes/total*100).toFixed(1)}%;background:${langColor(l.name)}" title="${l.name} ${(l.bytes/total*100).toFixed(1)}%"></div>`
  ).join('')}</div>`
  const list = langs.map(l => `
    <div class="lang-row">
      <span class="lang-dot" style="background:${langColor(l.name)}"></span>
      <span class="lang-name">${l.name}</span>
      <span class="lang-pct">${(l.bytes/total*100).toFixed(1)}%</span>
      <span class="lang-repos">${l.count} repo${l.count !== 1 ? 's' : ''}</span>
    </div>
  `).join('')
  return bar + list
}

function renderTopReposList(repos, statKey, icon, color) {
  if (!repos || !repos.length) return '<div class="insight-empty">Sync to see data</div>'
  if (statKey === 'traffic_views_total' && repos.every(r => !r[statKey])) {
    return '<div class="insight-empty">No visitor data yet — GitHub only counts external visits (not the repo owner)</div>'
  }
  return repos.map((r, i) => `
    <div class="insight-repo-row">
      <span class="insight-rank">${i + 1}</span>
      <div class="insight-repo-info">
        <a href="${r.html_url}" target="_blank" rel="noopener noreferrer">${r.name}</a>
        ${r.language ? `<span class="lang-dot" style="background:${langColor(r.language)};width:8px;height:8px;flex-shrink:0"></span>` : ''}
      </div>
      <span class="insight-stat" style="color:${color}">${icon} ${shortNum(r[statKey])}</span>
    </div>
  `).join('')
}

// ── Repo List ─────────────────────────────────────────────────────────────────

function renderRepoRows(repos) {
  const el = document.getElementById('repo-list-content')
  if (!repos.length) {
    el.innerHTML = `<div class="empty" style="padding:48px 24px">
      <div class="empty-emoji">📦</div>
      <h3>${repoSearch ? `No results for "${repoSearch}"` : 'No repositories found'}</h3>
      <p>${repoSearch ? 'Try a different name.' : 'Click Sync Repos to fetch your repositories.'}</p>
    </div>`
    return
  }
  el.innerHTML = `<div class="repo-rows">${repos.map(r => `
    <a class="repo-row-card" href="${r.html_url}" target="_blank" rel="noopener noreferrer">
      <div class="repo-row-left">
        <span class="lang-dot" style="background:${langColor(r.language || '')}"></span>
        <span class="repo-row-name">${r.name}</span>
        ${r.is_fork     ? '<span class="repo-badge fork">Fork</span>'         : ''}
        ${r.is_archived ? '<span class="repo-badge archived">Archived</span>' : ''}
        ${r.is_private  ? '<span class="repo-badge priv">Private</span>'      : ''}
      </div>
      <div class="repo-row-stats">
        <span class="rs rs-star" title="Stars">${iStar}${shortNum(r.stars)}</span>
        <span class="rs rs-fork" title="Forks">${iFork}${shortNum(r.forks)}</span>
        <span class="rs rs-wch"  title="Watchers">${iWatch}${shortNum(r.watchers)}</span>
        <span class="rs rs-iss"  title="Open Issues">${iIssue}${shortNum(r.open_issues)}</span>
      </div>
    </a>
  `).join('')}</div>`
}

function renderRepoPagination() {
  const total = Math.ceil(repoTotalItems / 20)
  const el = document.getElementById('repos-pages')
  if (total <= 1) { el.style.display = 'none'; return }
  el.style.display = 'flex'
  document.getElementById('repos-pg-prev').disabled = repoPage <= 1
  document.getElementById('repos-pg-next').disabled = repoPage >= total
  document.getElementById('repos-pg-info').textContent = `${repoPage} / ${total}`
}

function changeRepoPage(d) {
  repoPage += d
  loadRepoListContent()
  document.getElementById('repos-all').scrollIntoView({ behavior: 'smooth' })
}

function onRepoSearch(val) {
  const clr = document.getElementById('repo-search-clear')
  if (clr) clr.classList.toggle('visible', val.length > 0)
  clearTimeout(repoSearchTimer)
  repoSearchTimer = setTimeout(() => {
    repoSearch = val.trim()
    repoPage = 1
    loadRepoListContent()
  }, 320)
}

function clearRepoSearch() {
  const si = document.getElementById('repo-search')
  const clr = document.getElementById('repo-search-clear')
  if (si) si.value = ''
  if (clr) clr.classList.remove('visible')
  repoSearch = ''
  repoPage = 1
  loadRepoListContent()
}

// ── Single Repo Detail ────────────────────────────────────────────────────────

async function loadRepoDetail(name) {
  const el = document.getElementById('repo-detail')
  el.innerHTML = `<div class="skel" style="height:180px;border-radius:16px;margin-bottom:20px"></div>
    <div class="repo-detail-stats">${Array(6).fill('<div class="skel" style="height:90px;border-radius:14px"></div>').join('')}</div>`
  try {
    const repo = await apiFetch(`/repos/${encodeURIComponent(name)}`)
    el.innerHTML = renderRepoDetailHTML(repo)
  } catch (e) {
    el.innerHTML = `<div class="empty"><div class="empty-emoji">⚠️</div><h3>Could not load ${name}</h3><p>${e.message}</p></div>`
  }
}

function renderRepoDetailHTML(r) {
  const langTotal = Object.values(r.languages || {}).reduce((a, b) => a + b, 0)
  const langEntries = Object.entries(r.languages || {}).sort(([,a],[,b]) => b - a)

  const langBar = langTotal ? `<div class="lang-bar" style="margin-bottom:10px">${
    langEntries.slice(0, 8).map(([l, b]) =>
      `<div class="lang-seg" style="width:${(b/langTotal*100).toFixed(1)}%;background:${langColor(l)}" title="${l}: ${(b/langTotal*100).toFixed(1)}%"></div>`
    ).join('')
  }</div>` : ''

  const langList = langEntries.slice(0, 6).map(([l, b]) => `
    <div class="lang-row">
      <span class="lang-dot" style="background:${langColor(l)}"></span>
      <span class="lang-name">${l}</span>
      <span class="lang-pct">${langTotal ? (b/langTotal*100).toFixed(1) + '%' : '—'}</span>
    </div>
  `).join('')

  const topics = (r.topics || []).map(t => `<span class="topic-chip">${t}</span>`).join('')

  const stats = [
    { label: 'Stars',       val: shortNum(r.stars),       icon: iStar,   color: '#f9c513' },
    { label: 'Forks',       val: shortNum(r.forks),       icon: iFork,   color: '#a371f7' },
    { label: 'Watchers',    val: shortNum(r.watchers),    icon: iWatch,  color: '#4f8ef7' },
    { label: 'Open Issues', val: shortNum(r.open_issues), icon: iIssue,  color: '#f85149' },
    { label: 'Size',        val: fmtSize(r.size),         icon: iDisk,   color: '#8b949e' },
  ]

  return `
  <div class="repo-detail-hero">
    <div class="repo-detail-header">
      <div class="repo-detail-title">
        ${iRepo}
        <span>${r.name}</span>
        ${r.is_fork     ? '<span class="repo-badge fork">Fork</span>'         : ''}
        ${r.is_archived ? '<span class="repo-badge archived">Archived</span>' : ''}
        ${r.is_private  ? '<span class="repo-badge priv">Private</span>'      : ''}
        ${r.stars_since_last_sync > 0 ? `<span class="new-stars-badge">+${r.stars_since_last_sync} ⭐ new</span>` : ''}
      </div>
      <a class="repo-gh-link" href="${r.html_url}" target="_blank" rel="noopener noreferrer">View on GitHub →</a>
    </div>

    ${r.description ? `<p class="repo-detail-desc">${r.description}</p>` : ''}

    <div class="repo-detail-meta">
      ${r.homepage ? `<a href="${r.homepage}" target="_blank" rel="noopener noreferrer" class="repo-meta-link">${iLink} ${r.homepage}</a>` : ''}
      ${r.language  ? `<span class="repo-meta-item"><span class="lang-dot" style="background:${langColor(r.language)}"></span>${r.language}</span>` : ''}
      ${r.created_at ? `<span class="repo-meta-item">${iCal} Created ${fmtShort(r.created_at)}</span>` : ''}
      ${r.updated_at ? `<span class="repo-meta-item">${iCal} Updated ${ago(r.updated_at)}</span>` : ''}
    </div>

    ${topics ? `<div class="repo-topics">${topics}</div>` : ''}
  </div>

  <div class="repo-detail-stats">
    ${stats.map(({ label, val, icon, color }) => `
      <div class="repo-stat-item">
        <div class="repo-stat-icon" style="color:${color}">${icon}</div>
        <div class="repo-stat-val" style="color:${color}">${val}</div>
        <div class="repo-stat-lbl">${label}</div>
      </div>
    `).join('')}
  </div>

  <div class="repo-traffic-grid">
    <div class="repo-insight-card">
      <div class="insight-title">Traffic · Last 14 Days</div>
      <div class="traffic-split">
        <div class="traffic-item">
          <div class="traffic-icon" style="color:#3fb950">${iEye}</div>
          <div class="traffic-val">${shortNum(r.traffic_views_total)}</div>
          <div class="traffic-lbl">Page Views</div>
          <div class="traffic-sub">${shortNum(r.traffic_views_unique)} unique</div>
        </div>
        <div class="traffic-divider"></div>
        <div class="traffic-item">
          <div class="traffic-icon" style="color:#4f8ef7">${iClone}</div>
          <div class="traffic-val">${shortNum(r.traffic_clones_total)}</div>
          <div class="traffic-lbl">Git Clones</div>
          <div class="traffic-sub">${shortNum(r.traffic_clones_unique)} unique</div>
        </div>
      </div>
    </div>

    <div class="repo-insight-card">
      <div class="insight-title">Languages</div>
      ${langTotal ? langBar + langList : '<div class="insight-empty">No language data available</div>'}
    </div>
  </div>

  <div class="repo-traffic-grid" style="margin-top:14px">
    <div class="repo-insight-card">
      <div class="insight-title">Top Referrers · Last 14 Days</div>
      ${renderReferrers(r.referrers)}
    </div>
    <div class="repo-insight-card">
      <div class="insight-title">Popular Content · Last 14 Days</div>
      ${renderPopularPaths(r.popular_paths)}
    </div>
  </div>`
}

function renderReferrers(refs) {
  if (!refs || !refs.length) return '<div class="insight-empty">No referrer data — sync to populate</div>'
  return `<div class="ref-table">
    <div class="ref-row ref-header"><span>Source</span><span>Views</span><span>Unique</span></div>
    ${refs.slice(0, 10).map(r => `
      <div class="ref-row">
        <span class="ref-source" title="${r.referrer}">${r.referrer}</span>
        <span class="ref-num">${shortNum(r.count)}</span>
        <span class="ref-num ref-uniq">${shortNum(r.uniques)}</span>
      </div>`).join('')}
  </div>`
}

function renderPopularPaths(paths) {
  if (!paths || !paths.length) return '<div class="insight-empty">No path data — sync to populate</div>'
  return `<div class="ref-table">
    <div class="ref-row ref-header"><span>Path</span><span>Views</span><span>Unique</span></div>
    ${paths.slice(0, 10).map(p => {
      const label = p.path.replace(/^\//, '').replace(/\//g, ' / ') || 'Root'
      return `<div class="ref-row">
        <span class="ref-source" title="${p.path}">${label}</span>
        <span class="ref-num">${shortNum(p.count)}</span>
        <span class="ref-num ref-uniq">${shortNum(p.uniques)}</span>
      </div>`
    }).join('')}
  </div>`
}

// ── Sync Repos ────────────────────────────────────────────────────────────────

async function syncRepos() {
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
    const resp = await fetch(API + '/repos/sync', { method: 'POST' })
    const d = await resp.json()
    doneProg()
    spin.style.display = 'none'; spin.classList.remove('spin')
    chk.style.display = 'inline-block'
    btn.classList.add('synced')
    lbl.textContent = 'Synced!'
    showToast(`Repos synced — ${d.total_repos} repositories`)

    // Refresh view
    allReposList = []
    await loadRepoDropdownOptions()
    if (selectedRepo === 'all') loadReposOverview()
    else loadRepoDetail(selectedRepo)

    setTimeout(() => {
      chk.style.display = 'none'; def.style.display = 'inline-block'
      btn.classList.remove('synced'); lbl.textContent = 'Sync Repos'
      btn.disabled = false
    }, 2500)
  } catch (e) {
    doneProg()
    spin.style.display = 'none'; spin.classList.remove('spin')
    def.style.display = 'inline-block'
    lbl.textContent = 'Sync Repos'; btn.disabled = false
    showToast('Repo sync failed — is the backend running?', false)
  }
}
