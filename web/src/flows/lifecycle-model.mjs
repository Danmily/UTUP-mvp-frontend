/* 资产迭代与收益回收（1026 会议 · @张航 收集的 3 项供给方需求）。纯函数，便于测试
 * 1. 版本变更：IM Bot 通知下游 → 测试窗口内新旧并行、收集反馈 → 到期自动保留新版本、下线旧版本
 * 2. 下游使用与收益看板：按字段查看消费方、使用场景、调用量与已填报收益，评估变更影响
 * 3. IM Bot 收益反馈：按月收阶段性结论、按季度收项目整体收益，关联字段与消费方 */
export const CHANGE_WINDOWS = [3, 7, 14]
export const REPORT_KEY = 'utup.benefit.reports'
export const REMIND_KEY = 'utup.benefit.reminds'
export const ME_CONSUMER = { name: '@user', team: '电商增长' } // 演示：当前登录的消费方

const DAY = 864e5
const h = (s) => { let x = 7; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) % 100003; return x }
const iso = (t) => new Date(t).toISOString()
export const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const tagIdOf = (assetId) => String(assetId).replace(/^tag_/, '')

/* ---- 版本变更 ---- */
export function nextVersion(a) { return 'v' + ((parseInt(String(a.version || 'v1').slice(1), 10) || 1) + 1) }
export function startChange(a, { note, windowDays, to, now = Date.now() }) {
  return { ...a, change: { from: a.version || 'v1', to: to || nextVersion(a), note: String(note || '').trim(), windowDays, startAt: iso(now), endAt: iso(now + windowDays * DAY), feedback: [], reminded: 0 } }
}
/* 自定义新版本号：v + 数字，可带小版本（v2、v1.1）；不能与当前版本或历史版本重复 */
export function versionError(a, to) {
  const v = String(to || '').trim()
  if (!/^v\d+(\.\d+)*$/.test(v)) return '版本号格式为 v + 数字，如 v2、v1.1'
  if (v === (a.version || 'v1') || (a.versions || []).some((x) => x.to === v || x.from === v)) return `${v} 已使用过，请换一个`
  return ''
}
export function changeState(a, now = Date.now()) {
  if (!a.change) return null
  const left = Math.ceil((new Date(a.change.endAt) - now) / DAY)
  return { daysLeft: Math.max(0, left), due: left <= 0, ok: a.change.feedback.filter((f) => f.verdict === '验证通过').length, issues: a.change.feedback.filter((f) => f.verdict === '有问题').length }
}
/* 到期：自动保留新版本、下线旧版本，变更进入版本记录 */
export function finishChange(a, at = a.change.endAt) {
  const c = a.change
  return { ...a, version: c.to, change: null, versions: [{ from: c.from, to: c.to, note: c.note, at: ymd(at), feedback: c.feedback.length, issues: c.feedback.filter((f) => f.verdict === '有问题').length }, ...(a.versions || [])] }
}
export function applyDue(assets, now = Date.now()) {
  let changed = []
  const next = assets.map((a) => { if (a.change && changeState(a, now).due) { changed.push(a.tag_name); return finishChange(a) } return a })
  return { assets: next, changed }
}
export function addFeedback(a, fb) {
  if (!a.change) return a
  const rest = a.change.feedback.filter((f) => f.by !== fb.by)
  return { ...a, change: { ...a.change, feedback: [...rest, { ...fb, at: fb.at || ymd(Date.now()) }] } }
}

/* ---- 下游消费方（真实环境来自权限系统与调用日志；演示按字段生成稳定示例） ---- */
const CONSUMERS = [
  { name: '@liwei', team: '电商增长' }, { name: '@chenjing', team: '生服营销' }, { name: '@wangfang', team: '推荐算法' },
  { name: '@zhaolei', team: '用户运营' }, { name: '@sunmin', team: '风控策略' }, { name: '@zhoujie', team: '广告投放' },
]
const SCENES = ['人群圈选', '营销投放', '模型特征', '数据分析']
export function consumersOf(tagId, myTagIds = []) {
  const id = String(tagId), n = 2 + (h(id) % 3), start = h(id + 'c') % CONSUMERS.length
  const list = Array.from({ length: n }, (_, i) => {
    const c = CONSUMERS[(start + i) % CONSUMERS.length]
    return { ...c, scene: SCENES[h(id + c.name) % SCENES.length], calls: 1200 + (h(id + c.name + 'k') % 48) * 350 }
  })
  if (myTagIds.map(String).includes(id)) list.unshift({ ...ME_CONSUMER, scene: '人群圈选', calls: 2600 + (h(id) % 20) * 120 })
  return list
}

/* ---- 收益填报周期：每月初收上月阶段性结论，每季度首月收上季度整体收益 ---- */
export function periodsOf(now = Date.now()) {
  const d = new Date(now), y = d.getFullYear(), m = d.getMonth() // m：0–11，本月
  const pm = m === 0 ? 12 : m, py = m === 0 ? y - 1 : y
  const q = Math.floor(m / 3), pq = q === 0 ? 4 : q, qy = q === 0 ? y - 1 : y
  return { month: `${py}-${String(pm).padStart(2, '0')}`, quarter: `${qy} Q${pq}` }
}
const MONTH_TPL = ['召回人群点击率较对照组提升，持续观察转化', '圈选人群规模稳定，口径与预期一致', '作为模型特征上线，离线 AUC 小幅提升', '本月未在投放中使用，计划下月启用']
const QUARTER_TPL = ['季度活动 GMV 增量约 3.2%（实验组对比）', '模型迭代后人均订单提升约 1.8%', '营销券核销率提升约 2.4 个百分点']
/* 演示：其他消费方已有的填报；当前消费方的填报来自 IM Bot 卡片（浏览器存储） */
function seedReport(tagId, c, kind, period) {
  if (c.name === ME_CONSUMER.name) return null
  const k = h(tagId + c.name + kind)
  if (kind === '月度' ? k % 3 === 0 : k % 2 === 0) return null
  return { tagId: String(tagId), consumer: c.name, team: c.team, kind, period, conclusion: (kind === '月度' ? MONTH_TPL : QUARTER_TPL)[k % (kind === '月度' ? MONTH_TPL.length : QUARTER_TPL.length)], gain: '', at: '' }
}
export function findReport(reports, tagId, consumer, kind, period) {
  return reports.find((r) => r.tagId === String(tagId) && r.consumer === consumer && r.kind === kind && r.period === period)
}
export function benefitRows(tagId, { reports = [], myTagIds = [], now = Date.now() } = {}) {
  const p = periodsOf(now)
  return consumersOf(tagId, myTagIds).map((c) => {
    const month = findReport(reports, tagId, c.name, '月度', p.month) || seedReport(tagId, c, '月度', p.month)
    const quarter = findReport(reports, tagId, c.name, '季度', p.quarter) || seedReport(tagId, c, '季度', p.quarter)
    return { ...c, month, quarter, pending: [!month && '月度', !quarter && '季度'].filter(Boolean) }
  })
}
export function boardSummary(rows) {
  return {
    consumers: rows.length,
    calls: rows.reduce((n, r) => n + r.calls, 0),
    month: rows.filter((r) => r.month).length,
    quarter: rows.filter((r) => r.quarter).length,
  }
}
/* ---- 下游看板检索：空格分隔多个词，每个词都要命中；字段本身的信息排在消费方信息前面 ---- */
export const searchWords = (q) => String(q ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
export function searchUsage(tags, q, myTagIds = []) {
  const words = searchWords(q)
  if (!words.length) return tags.map((tag) => ({ tag, hits: [] }))
  return tags.flatMap((tag) => {
    const cs = consumersOf(tag.id, myTagIds)
    const fields = [ // [命中位置, 检索文本, 展示文本]
      ['字段名', tag.name], ['ID', `tag_${tag.id}`], ['表名', tag.table],
      ['Owner', `${tag.owner} ${tag.team}`, tag.owner], ['数据源', tag.src], ['枚举', (tag.enums || []).join(' ')], ['口径', tag.desc],
      ...cs.map((c) => ['消费方', `${c.name} ${c.team}`, `${c.name}（${c.team}）`]),
      ...cs.map((c) => ['使用场景', c.scene]),
    ]
    const hits = []
    for (const w of words) {
      const f = fields.find(([, text]) => String(text ?? '').toLowerCase().includes(w))
      if (!f) return []
      const show = f[0] === '枚举' ? tag.enums.find((e) => e.toLowerCase().includes(w)) : f[0] === '口径' ? '' : (f[2] ?? f[1])
      if (!hits.some((x) => x.at === f[0] && x.show === show)) hits.push({ at: f[0], show })
    }
    return [{ tag, hits, rank: hits.filter((x) => x.at === '字段名' || x.at === 'ID').length }]
  }).sort((a, b) => b.rank - a.rank)
}
/* 当前消费方待填报的 IM Bot 卡片：每个持有的字段 × 本期月度 / 季度 */
export function pendingReports(myTagIds, reports, now = Date.now()) {
  const p = periodsOf(now)
  return [...new Set(myTagIds.map(String))].flatMap((id) => [['月度', p.month], ['季度', p.quarter]]
    .filter(([kind, period]) => !findReport(reports, id, ME_CONSUMER.name, kind, period))
    .map(([kind, period]) => ({ tagId: id, kind, period })))
}
