// ── Contributions ─────────────────────────────────────────────────────────────

const CONTRIB_COLORS = ['var(--surface3)', '#0e4429', '#006d32', '#26a641', '#39d353']
function contribLevel(n) { return n === 0 ? 0 : n < 4 ? 1 : n < 7 ? 2 : n < 10 ? 3 : 4 }

let contribYears      = []
let activeContribYear = null

// ── Init ──────────────────────────────────────────────────────────────────────

async function initContributions() {
  renderContribSkeleton()
  try {
    const summary = await apiFetch('/contributions')
    if (!summary.years || !summary.years.length) { renderContribEmpty(); return }
    contribYears      = summary.years
    activeContribYear = summary.years[0].year
    renderContribFrame(summary)
    await loadContribYear(activeContribYear)
  } catch (e) {
    document.getElementById('contrib-main').innerHTML =
      `<div class="empty"><div class="empty-emoji">⚠️</div><h3>Could not load contributions</h3><p>${e.message}</p></div>`
  }
}

function renderContribSkeleton() {
  const sk = (h, r = 12) => `<div class="skel" style="height:${h}px;border-radius:${r}px"></div>`
  document.getElementById('contrib-main').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${sk(24)}
      ${sk(220, 14)}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${Array(4).fill(sk(80)).join('')}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${Array(2).fill(sk(180)).join('')}</div>
    </div>`
}

function renderContribEmpty() {
  document.getElementById('contrib-main').innerHTML = `
    <div class="contrib-empty">
      <div class="contrib-empty-icon">📊</div>
      <div class="contrib-empty-title">No contribution history yet</div>
      <div class="contrib-empty-body">
        Click <strong>Sync Now</strong> to load your GitHub activity across all years —
        commits, PRs, issues, reviews, public &amp; private repos.
      </div>
    </div>`
}

// ── Frame: all-time bar + year body slot ───────────────────────────────────────

function renderContribFrame(summary) {
  const { total_all_time, years } = summary
  const oldest = years[years.length - 1].year
  const newest = years[0].year
  const tot    = k => years.reduce((s, y) => s + (y[k] || 0), 0)

  document.getElementById('contrib-main').innerHTML = `
    <div class="catb">
      <span class="catb-total"><span id="cat-total">—</span> contributions</span>
      <span class="catb-sep">·</span>
      <span><span id="cat-commits" style="color:#3fb950;font-weight:700">—</span> commits</span>
      <span class="catb-sep">·</span>
      <span><span id="cat-prs" style="color:#a371f7;font-weight:700">—</span> PRs</span>
      <span class="catb-sep">·</span>
      <span><span id="cat-issues" style="color:#f85149;font-weight:700">—</span> issues</span>
      <span class="catb-sep">·</span>
      <span><span id="cat-reviews" style="color:#f9c513;font-weight:700">—</span> reviews</span>
      <span class="catb-range">${oldest === newest ? oldest : oldest + '–' + newest}</span>
    </div>
    <div id="contrib-year-body"></div>`

  animateCount(document.getElementById('cat-total'),   total_all_time)
  animateCount(document.getElementById('cat-commits'), tot('total_commits'))
  animateCount(document.getElementById('cat-prs'),     tot('total_prs'))
  animateCount(document.getElementById('cat-issues'),  tot('total_issues'))
  animateCount(document.getElementById('cat-reviews'), tot('total_reviews'))
}

// ── Load a year ────────────────────────────────────────────────────────────────

async function loadContribYear(year) {
  activeContribYear = year
  // Update pills if already visible
  document.querySelectorAll('.hm-pill').forEach(b => b.classList.toggle('active', +b.dataset.y === year))

  const body = document.getElementById('contrib-year-body')
  if (!body) return
  const sk = h => `<div class="skel" style="height:${h}px;border-radius:12px"></div>`
  body.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
    ${sk(220)}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${Array(4).fill(sk(80)).join('')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${Array(2).fill(sk(180)).join('')}</div>
  </div>`

  try {
    const data = await apiFetch(`/contributions/${year}`)
    renderYearData(data)
  } catch (e) {
    body.innerHTML = `<div class="empty" style="padding:48px 0">
      <div class="empty-emoji">📅</div><h3>No data for ${year}</h3>
      <p>Click Sync Now to fetch all years.</p></div>`
  }
}

// ── Render year data ───────────────────────────────────────────────────────────

function renderYearData(data) {
  const { year, weeks, total_contributions, total_commits, total_issues, total_prs, total_reviews, restricted } = data
  const body = document.getElementById('contrib-year-body')
  if (!body) return

  const allDays  = weeks.flatMap(w => w.contributionDays)
  const streak   = computeStreak(allDays)
  const insights = computeInsights(allDays)
  const privNote = restricted > 0 ? `· ${shortNum(restricted)} private` : '· incl. private'

  const pills = contribYears.map(y =>
    `<button class="hm-pill${y.year === activeContribYear ? ' active' : ''}" data-y="${y.year}"
      onclick="loadContribYear(${y.year})">${y.year}</button>`).join('')

  const statCards = [
    { icon: '💾', val: total_commits,  label: 'Commits',  color: '#3fb950', id: 'cst0' },
    { icon: '🔀', val: total_prs,      label: 'PRs',      color: '#a371f7', id: 'cst1' },
    { icon: '🔴', val: total_issues,   label: 'Issues',   color: '#f85149', id: 'cst2' },
    { icon: '👁', val: total_reviews,  label: 'Reviews',  color: '#f9c513', id: 'cst3' },
  ]

  body.innerHTML = `
    <div class="heatmap-card">
      <div class="heatmap-header">
        <div class="hm-meta">
          <div class="hm-year">${year}</div>
          <div class="hm-sub">${shortNum(total_contributions)} contributions <span class="hm-priv">${privNote}</span></div>
        </div>
        <div class="hm-pills">${pills}</div>
      </div>
      ${buildHeatmapHTML(weeks)}
    </div>

    <div class="yst-grid">
      ${statCards.map(({ icon, label, color, id }) => `
        <div class="yst-card">
          <div class="yst-icon">${icon}</div>
          <div class="yst-val" style="color:${color}" id="${id}">—</div>
          <div class="yst-lbl">${label}</div>
        </div>`).join('')}
    </div>

    <div class="contrib-insights">
      <div class="insight-card">
        <div class="insight-title">Streaks · ${year}</div>
        ${renderStreaks(streak)}
      </div>
      <div class="insight-card">
        <div class="insight-title">Activity by Day · ${year}</div>
        ${renderActivityBreakdown(insights)}
      </div>
    </div>`

  statCards.forEach(({ id, val }) => animateCount(document.getElementById(id), val))
}

// ── Heatmap HTML ──────────────────────────────────────────────────────────────

function buildHeatmapHTML(weeks) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  let months = '<div class="heatmap-months">'
  let prev = -1
  weeks.forEach(w => {
    const d = w.contributionDays[0]?.date; if (!d) return
    const m = new Date(d + 'T00:00:00').getMonth()
    months += `<div class="heatmap-month-cell">${m !== prev ? MONTHS[m] : ''}</div>`
    prev = m
  })
  months += '</div>'

  const grid = `<div class="heatmap-body">
    <div class="heatmap-day-labels">${DAYS.map((d, i) =>
      `<div class="heatmap-day-lbl">${[1,3,5].includes(i) ? d : ''}</div>`).join('')}</div>
    <div class="heatmap-grid">${weeks.map(w =>
      `<div class="heatmap-week">${Array(7).fill(0).map((_, di) => {
        const day = w.contributionDays.find(d => d.weekday === di)
        if (!day) return `<div class="heatmap-cell" style="background:transparent"></div>`
        return `<div class="heatmap-cell" style="background:${CONTRIB_COLORS[contribLevel(day.contributionCount)]}"
          title="${day.date}: ${day.contributionCount} contribution${day.contributionCount !== 1 ? 's' : ''}"></div>`
      }).join('')}</div>`).join('')}</div></div>`

  const legend = `<div class="heatmap-legend">
    <span style="font-size:10px;color:var(--muted)">Less</span>
    ${CONTRIB_COLORS.map(c => `<div class="heatmap-cell" style="background:${c}"></div>`).join('')}
    <span style="font-size:10px;color:var(--muted)">More</span>
  </div>`

  return months + grid + legend
}

// ── Streak ────────────────────────────────────────────────────────────────────

function computeStreak(days) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const today  = new Date().toISOString().split('T')[0]
  let cur = 0, i = sorted.length - 1
  while (i >= 0) {
    const d = sorted[i]
    if (d.date > today) { i--; continue }
    if (d.contributionCount > 0) { cur++; i-- } else break
  }
  let best = 0, run = 0
  for (const d of sorted) { if (d.contributionCount > 0) { run++; best = Math.max(best, run) } else run = 0 }
  return { current: cur, longest: best }
}

function renderStreaks({ current, longest }) {
  return `<div class="streak-grid">
    <div class="streak-item">
      <div class="streak-val" style="color:#f9c513">🔥 ${current}</div>
      <div class="streak-lbl">Current Streak</div>
      <div class="streak-sub">days in a row</div>
    </div>
    <div class="streak-item">
      <div class="streak-val" style="color:#a371f7">🏆 ${longest}</div>
      <div class="streak-lbl">Longest Streak</div>
      <div class="streak-sub">this year</div>
    </div>
  </div>`
}

// ── Activity breakdown ─────────────────────────────────────────────────────────

function computeInsights(days) {
  const byDay = Array(7).fill(0)
  days.forEach(d => { byDay[d.weekday] = (byDay[d.weekday] || 0) + d.contributionCount })
  return { byDay, dayNames: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], maxDay: Math.max(...byDay) }
}

function renderActivityBreakdown({ byDay, dayNames, maxDay }) {
  if (maxDay === 0) return '<div class="insight-empty">No activity data</div>'
  return `<div class="activity-bars">${byDay.map((count, i) => `
    <div class="activity-bar-row">
      <span class="activity-day">${dayNames[i]}</span>
      <div class="activity-bar-wrap">
        <div class="activity-bar" style="width:${maxDay ? (count/maxDay*100).toFixed(0) : 0}%"></div>
      </div>
      <span class="activity-count">${shortNum(count)}</span>
    </div>`).join('')}</div>`
}

async function syncContributions() { syncNow() }
