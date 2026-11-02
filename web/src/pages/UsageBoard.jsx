import { useMemo, useState } from 'react'
import { Button, Card, Tag, message } from '@ecom/aurora'
import { TAGS, INITIAL_MYAPPLY } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import { ASSET_KEY } from '../flows/asset-model.mjs'
import { REPORT_KEY, REMIND_KEY, benefitRows, boardSummary, consumersOf, changeState, periodsOf } from '../flows/lifecycle-model.mjs'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const myTagIds = INITIAL_MYAPPLY.filter((a) => a.approval !== 'rejected').map((a) => a.tagId)

/* 下游使用与收益看板（供给方工作台）：按字段选择或检索，看消费方、使用效果与收益，辅助评估资产变更影响 */
export default function UsageBoard({ ownSrc }) {
  const tags = useMemo(() => TAGS.filter((t) => !ownSrc || t.src === ownSrc), [ownSrc])
  const [q, setQ] = useState('')
  const [pick, setPick] = useState(tags[0]?.id)
  const [reminds, setReminds] = useState(() => read(REMIND_KEY, {}))
  const reports = useMemo(() => read(REPORT_KEY, []), [])
  const assets = useMemo(() => read(ASSET_KEY, []), [])
  const changeOf = (id) => assets.find((a) => a.tag_id === 'tag_' + id && a.change)
  const p = periodsOf()

  const list = tags.filter((t) => !q || `${t.name} ${t.id} ${t.table}`.toLowerCase().includes(q.trim().toLowerCase()))
  const tag = tags.find((t) => t.id === pick) || list[0]
  const rows = tag ? benefitRows(tag.id, { reports, myTagIds }) : []
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
        <input className="au-input" placeholder="检索字段名 / ID / 表名" value={q} onChange={(e) => setQ(e.target.value)} aria-label="检索字段" />
        <div className="usage-items">{list.map((t) => {
          const n = consumersOf(t.id, myTagIds).length, c = changeOf(t.id)
          return <button key={t.id} type="button" className={tag?.id === t.id ? 'on' : ''} onClick={() => setPick(t.id)}>
            <b>{t.name}</b><small>tag_{t.id} · {n} 个消费方{c ? ' · ' : ''}{c && <em>变更测试中</em>}</small>
          </button>
        })}{!list.length && <p className="asset-muted">没有匹配的字段</p>}</div>
      </aside>
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
            {rows.map((r) => <tr key={r.name}>
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
