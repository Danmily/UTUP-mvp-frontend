/* 资产管理「操作记录」的演示数据：覆盖批量导入（成功 / 校验失败 / 批量更新）、单个录入、版本变更（测试中 / 已切换 / 已撤回）、
 * 批量版本变更与下线。记录里引用的资产会同步写入对应的版本状态，保证「当前进度」与资产列表一致 */
import { consumersOf, tagIdOf, ymd } from './lifecycle-model.mjs'

const DAY = 864e5
const pad = (n) => String(n).padStart(2, '0')
const stamp = (t) => { const d = new Date(t); return `${ymd(t)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
const batchNo = (t) => 'B' + stamp(t).replace(/\D/g, '').slice(2) + pad(new Date(t).getSeconds())
/* 固定在当天某个时间点，避免演示记录随打开时间漂移 */
const at = (now, daysAgo, hh, mm) => { const d = new Date(now - daysAgo * DAY); d.setHours(hh, mm, 7, 0); return d.getTime() }

export function demoHistory(assets, { now = Date.now(), by = '供给方 · Owner', myIds = [] } = {}) {
  const nameOf = (id) => assets.find((a) => a.tag_id === id)?.tag_name || id
  const item = (id, action, detail = '') => ({ tag_id: id, tag_name: nameOf(id), action, detail })
  const log = (t, l) => ({ no: batchNo(t), at: stamp(t), by, officer: '—', result: '—', items: [], ...l })
  const NO_COMP = { officer: '—', result: '无需（未改密级与数据源）' }

  /* 1）批量版本变更：3 个资产正在测试 v2，部分消费方已反馈 */
  const batchIds = ['tag_14520', 'tag_14533', 'tag_14566']
  const tBatch = at(now, 2, 10, 32)
  const batchNote = '上游订单表切换为支付口径，统一按支付成功订单计算'
  const feedbackOf = (id) => {
    const cs = consumersOf(tagIdOf(id), myIds)
    return [
      cs[0] && { by: cs[0].name, verdict: '验证通过', text: '新旧版本人群重合度 96%，可切换', at: ymd(tBatch + DAY) },
      id === 'tag_14533' && cs[1] && { by: cs[1].name, verdict: '有问题', text: '近 30 天活跃人数少了约 8%，需确认是否剔除了未支付订单', at: ymd(tBatch + DAY) },
    ].filter(Boolean)
  }
  /* 2）单个版本变更后提前切换：tag_14479 v1 → v2 */
  const tChg1 = at(now, 12, 15, 8), tSwitch = at(now, 8, 11, 20)
  const note1 = '支付单数分层阈值调整：高消费由 ≥2000/月 提到 ≥3000/月'
  /* 3）版本变更后撤回：tag_14555 保持 v1 */
  const tChg2 = at(now, 5, 14, 40), tBack = at(now, 4, 9, 55)

  const logs = [
    log(tBatch, { mode: '批量版本变更', file: '3 个资产', note: batchNote, days: 7, endAt: ymd(tBatch + 7 * DAY), items: batchIds.map((id) => item(id, '版本变更', 'v1 → v2')) }),
    log(tBack, { mode: '撤回变更', file: nameOf('tag_14555'), items: [item('tag_14555', '撤回变更', '保持 v1，不升级 v2')] }),
    log(tChg2, { mode: '版本变更', file: nameOf('tag_14555'), note: '脱敏粒度由三级类目调整为二级类目', days: 3, endAt: ymd(tChg2 + 3 * DAY), items: [item('tag_14555', '版本变更', 'v1 → v2')] }),
    log(tSwitch, { mode: '版本切换', file: nameOf('tag_14479'), items: [item('tag_14479', '提前切换', 'v1 → v2')] }),
    log(tChg1, { mode: '版本变更', file: nameOf('tag_14479'), note: note1, days: 7, endAt: ymd(tChg1 + 7 * DAY), items: [item('tag_14479', '版本变更', 'v1 → v2')] }),
    log(at(now, 15, 17, 46), { mode: '批量', file: '电商DMP_资产更新_1018.csv', created: 0, updated: 4, failed: 0, ...NO_COMP,
      items: [['tag_14501', '覆盖率 85 → 88'], ['tag_14540', '补充使用限制：仅支持正向圈选'], ['tag_14572', '更新业务口径描述'], ['tag_14578', '覆盖率 60 → 64']].map(([id, d]) => item(id, '更新', d)) }),
    log(at(now, 16, 16, 12), { mode: '批量', file: '电商DMP_资产更新_1017.csv', created: 0, updated: 0, failed: 2, officer: '@hegui_li', result: '通过',
      items: [
        { tag_id: 'tag_14501', tag_name: nameOf('tag_14501'), action: '第 3 行校验失败', detail: '覆盖率需为 0–100，最多 1 位小数' },
        { tag_id: 'tag_14578', tag_name: nameOf('tag_14578'), action: '第 5 行校验失败', detail: '统一级别「开放」与密级 L3 不对应（L2→开放，L3→通用 / 受控，L4→高敏）' },
      ] }),
    log(new Date('2026-09-30T18:00:07').getTime(), { mode: '下线', file: '旧版活跃序列 V1', note: '已由新版标签替代', items: [item('old_active_v1', '下线', '已由新版标签替代')] }),
    log(new Date('2026-09-25T14:26:07').getTime(), { mode: '单个', file: nameOf('tag_14590'), created: 1, updated: 0, failed: 0, officer: '@hegui_wang', result: '通过', items: [item('tag_14590', '新增')] }),
    log(new Date('2026-09-20T10:00:07').getTime(), { mode: '批量', file: '电商DMP_首批资产接入.csv', created: 11, updated: 0, failed: 0, officer: '@hegui_li', result: '通过',
      items: ['tag_14479', 'tag_14501', 'tag_14520', 'tag_14533', 'tag_14540', 'tag_14555', 'tag_14560', 'tag_14566', 'tag_14572', 'tag_14578', 'tag_14584'].map((id) => item(id, '新增')) }),
  ]

  /* 资产侧同步：让记录里的版本状态在资产列表、变更详情、下游看板里都能看到 */
  const next = assets.map((a) => {
    if (batchIds.includes(a.tag_id)) return { ...a, status: 'online', version: 'v1', change: { from: 'v1', to: 'v2', note: batchNote, windowDays: 7, startAt: new Date(tBatch).toISOString(), endAt: new Date(tBatch + 7 * DAY).toISOString(), feedback: feedbackOf(a.tag_id), reminded: 1 }, updated: stamp(tBatch) }
    if (a.tag_id === 'tag_14479') return { ...a, status: 'online', version: 'v2', change: null, versions: [{ from: 'v1', to: 'v2', note: note1, at: ymd(tSwitch), feedback: 3, issues: 0 }], updated: stamp(tSwitch) }
    if (a.tag_id === 'tag_14555') return { ...a, status: 'online', version: 'v1', change: null, versions: [], updated: stamp(tBack) }
    return a
  })
  return { logs, assets: next }
}
