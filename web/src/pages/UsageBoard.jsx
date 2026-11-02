import { useMemo, useState } from 'react'
import { Button, Card, Tag, message } from '@ecom/aurora'
import { TAGS, INITIAL_MYAPPLY } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import { ASSET_KEY } from '../flows/asset-model.mjs'
import { REPORT_KEY, REMIND_KEY, benefitRows, boardSummary, consumersOf, changeState, periodsOf, searchUsage, searchWords } from '../flows/lifecycle-model.mjs'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const myTagIds = INITIAL_MYAPPLY.filter((a) => a.approval !== 'rejected').map((a) => a.tagId)
const FILTERS = [['all', '全部'], ['pending', '有待填报'], ['change', '变更测试中']]

/* 把文本里命中的关键词标出来 */
function Hl({ text, words }) {
  const s = String(text ?? '')
  if (!words.length) return s
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  return s.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}

/* 下游使用与收益看板（供给方工作台）：按字段选择或检索，看消费方、使用效果与收益，辅助评估资产变更影响 */
export default function UsageBoard({ ownSrc }) {
  const tags = useMemo(() => TAGS.filter((t) => !ownSrc || t.src === ownSrc), [ownSrc])
  const [q, setQ] = useState('')
  const [only, setOnly] = useState('all')
  const [pick, setPick] = useState(tags[0]?.id)
  const [reminds, setReminds] = useState(() => read(REMIND_KEY, {}))
  const reports = useMemo(() => read(REPORT_KEY, []), [])
  const assets = useMemo(() => read(ASSET_KEY, []), [])
  const changeOf = (id) => assets.find((a) => a.tag_id === 'tag_' + id && a.change)
  const p = periodsOf()

  const words = searchWords(q)
  const hasPending = (id) => benefitRows(id, { reports, myTagIds }).some((r) => r.pending.length)
  const list = searchUsage(tags, q, myTagIds)
    .filter(({ tag: t }) => only === 'all' || (only === 'pending' ? hasPending(t.id) : changeOf(t.id)))
  const tag = (list.find((r) => r.tag.id === pick) || list[0])?.tag
  const rows = tag ? benefitRows(tag.id, { reports, myTagIds }) : []
  const rowHit = (r) => words.some((w) => `${r.name} ${r.team} ${r.scene}`.toLowerCase().includes(w))
  const sum = boardSummary(rows)
  const chg = tag && changeOf(tag.id)

  function remind(r) {
    const key = `${tag.id}:${r.name}`
    const next = { ...reminds, [key]: new Date().toLocaleString('zh-CN', { hour12: false }).slice(5, 16) }
    setReminds(next); try { localStorage.setItem(REMIND_KEY, JSON.stringify(next)) } catch { /* 仅本页 */ }
    message.success(`已通过 IM Bot 提醒 ${r.name} 填报${r.pending.join('、')}收益`)
  }

  return (
    <div className="usage-board">
      <aside className="usage-list">
        <div className="usage-search">
          <input className="au-input" placeholder="字段名 / tag_ID / 表名 / 消费方 / 场景" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQ('')} aria-label="检索字段" />
          {q && <button type="button" aria-label="清空检索" onClick={() => setQ('')}>×</button>}
        </div>
        <div className="usage-filters">{FILTERS.map(([k, label]) => <button key={k} type="button" className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{label}</button>)}</div>
        <small className="asset-muted">{words.length || only !== 'all' ? `匹配 ${list.length} / ${tags.length} 个字段` : `共 ${tags.length} 个字段，可搜 Owner、枚举值、口径，空格分隔多个词`}</small>
        <div className="usage-items">{list.map(({ tag: t, hits }) => {
          const n = consumersOf(t.id, myTagIds).length, c = changeOf(t.id)
          const extra = hits.filter((x) => x.at !== '字段名' && x.at !== 'ID')
          return <button key={t.id} type="button" className={tag?.id === t.id ? 'on' : ''} onClick={() => setPick(t.id)}>
            <b><Hl text={t.name} words={words} /></b><small><Hl text={`tag_${t.id}`} words={words} /> · {n} 个消费方{c ? ' · ' : ''}{c && <em>变更测试中</em>}</small>
            {extra.length > 0 && <small className="usage-hit">命中 {extra.map((x) => x.show ? `${x.at}：${x.show}` : x.at).join('；')}</small>}
          </button>
        })}{!list.length && <p className="asset-muted usage-empty">没有匹配的字段，换个关键词或切回「全部」。</p>}</div>
      </aside>
      {!tag && <section className="usage-detail"><Card><p className="asset-muted">左侧没有匹配的字段。可以按字段名、tag_ID、表名、Owner、消费方或使用场景检索。</p></Card></section>}
      {tag && <section className="usage-detail">
        <Card title={<span>{tag.name} <LevelChip level={tag.level} /></span>} extra={<span className="asset-muted">tag_{tag.id} · {tag.src}</span>}>
          <div className="asset-impact usage-kpi">
            <div><b>{sum.consumers}</b><span>下游消费方</span></div>
            <div><b>{sum.calls.toLocaleString('zh-CN')}</b><span>近 30 天调用量</span></div>
            <div><b>{sum.month} / {sum.consumers}</b><span>{p.month} 月度已填报</span></div>
            <div><b>{sum.quarter} / {sum.consumers}</b><span>{p.quarter} 季度已填报</span></div>
          </div>
          {chg ? (() => { const cs = changeState(chg); return <div className="usage-chg">🔄 版本变更测试中：{chg.change.from} → {chg.change.to}，剩 {cs.daysLeft} 天到期自动切换。以下 {sum.consumers} 个消费方会受影响，已反馈 {chg.change.feedback.length} 个{cs.issues ? `，其中 ${cs.issues} 个反馈有问题` : ''}。</div> })()
            : <p className="asset-muted">变更或下线这个字段前，先看下面的消费方与收益，评估影响范围。</p>}
          <table className="asset-table usage-table"><thead><tr><th>消费方</th><th>使用场景</th><th>近 30 天调用</th><th>使用效果（{p.month} 月度）</th><th>项目收益（{p.quarter} 季度）</th><th>填报</th><th></th></tr></thead><tbody>
            {rows.map((r) => <tr key={r.name} className={words.length && rowHit(r) ? 'usage-row-hit' : undefined}>
              <td><b>{r.name}</b><small>{r.team}</small></td>
              <td>{r.scene}</td>
              <td>{r.calls.toLocaleString('zh-CN')}</td>
              <td>{r.month ? <>{r.month.conclusion}{r.month.gain && <small>{r.month.gain}</small>}</> : <span className="asset-muted">未填报</span>}</td>
              <td>{r.quarter ? <>{r.quarter.conclusion}{r.quarter.gain && <small>{r.quarter.gain}</small>}</> : <span className="asset-muted">未填报</span>}</td>
              <td>{r.pending.length ? <Tag color="warning">待填 {r.pending.join(' / ')}</Tag> : <Tag color="success">已填报</Tag>}</td>
              <td>{r.pending.length > 0 && (reminds[`${tag.id}:${r.name}`] ? <small className="asset-muted">已提醒 {reminds[`${tag.id}:${r.name}`]}</small> : <Button size="small" type="link" onClick={() => remind(r)}>IM Bot 提醒</Button>)}</td>
            </tr>)}
          </tbody></table>
          <p className="asset-muted usage-note">收益由消费方在 IM Bot 卡片手动填报：每月初收上月阶段性结论，每季度首月收上季度项目整体收益；未填报会按周期再次提醒。调用量与历史填报为演示数据。</p>
        </Card>
      </section>}
    </div>
  )
}
