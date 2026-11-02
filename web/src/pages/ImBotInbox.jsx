import { useState } from 'react'
import { Button, message } from '@ecom/aurora'
import { TAGS } from '../data.js'
import { ASSET_KEY } from '../flows/asset-model.mjs'
import { REPORT_KEY, ME_CONSUMER, addFeedback, changeState, pendingReports, ymd } from '../flows/lifecycle-model.mjs'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* 仅本页 */ } }
const nameOf = (id) => TAGS.find((t) => String(t.id) === String(id))?.name || `tag_${id}`

/* IM Bot 消息（消费方视角的演示）：真实环境推送到飞书，这里在「我的申请 / 权限」页预览并可直接操作。
 * 版本变更通知 → 反馈验证结论；收益填报 → 月度阶段性结论 / 季度项目收益，写入供给方的收益看板 */
export default function ImBotInbox({ myapply = [] }) {
  const mine = [...new Set(myapply.filter((a) => a.approval !== 'rejected').map((a) => String(a.tagId)))]
  const [assets, setAssets] = useState(() => read(ASSET_KEY, []))
  const [reports, setReports] = useState(() => read(REPORT_KEY, []))
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState({}) // key → { conclusion, gain, text }
  const changes = assets.filter((a) => a.change && mine.includes(String(a.tag_id).replace(/^tag_/, '')))
  const todo = pendingReports(mine, reports).slice(0, 4)
  const myFb = (a) => a.change.feedback.find((f) => f.by === ME_CONSUMER.name)
  const count = changes.filter((a) => !myFb(a)).length + todo.length
  if (!changes.length && !todo.length) return null
  const d = (k) => draft[k] || {}
  const setD = (k, v) => setDraft((x) => ({ ...x, [k]: { ...d(k), ...v } }))

  function feedback(a, verdict) {
    const text = (d(a.tag_id).text || '').trim()
    if (verdict === '有问题' && !text) { message.warning('请先写一下遇到的问题'); return }
    const next = assets.map((x) => (x.tag_id === a.tag_id ? addFeedback(x, { by: ME_CONSUMER.name, verdict, text }) : x))
    setAssets(next); write(ASSET_KEY, next)
    message.success('已反馈给供给方，可在变更详情中查看')
  }
  function report(r) {
    const k = `${r.tagId}:${r.kind}`, v = d(k)
    if (!(v.conclusion || '').trim()) { message.warning(r.kind === '月度' ? '请填写阶段性结论' : '请填写项目整体收益'); return }
    const next = [...reports, { tagId: r.tagId, consumer: ME_CONSUMER.name, team: ME_CONSUMER.team, kind: r.kind, period: r.period, conclusion: v.conclusion.trim(), gain: (v.gain || '').trim(), at: ymd(Date.now()) }]
    setReports(next); write(REPORT_KEY, next)
    message.success('已提交，供给方可在「下游使用与收益」看板查看')
  }

  return (
    <div className="imbot-inbox">
      <button type="button" className="imbot-inbox-head" onClick={() => setOpen((x) => !x)}>
        <span>🤖 IM Bot 消息</span>{count > 0 && <em>{count} 条待处理</em>}<small>演示：真实环境推送到飞书</small><i>{open ? '收起' : '展开'}</i>
      </button>
      {open && <div className="imbot-list">
        {changes.map((a) => { const c = a.change, cs = changeState(a), fb = myFb(a); return (
          <div key={a.tag_id} className="imbot-card">
            <div className="imbot-head">🔄 版本变更通知<small>{ymd(c.startAt)}</small></div>
            <b>『{a.tag_name}』将由 {c.from} 升级为 {c.to}</b>
            <p>{c.note}</p>
            <p className="asset-muted">测试窗口至 {ymd(c.endAt)}（剩 {cs.daysLeft} 天），期间新旧版本并行；到期自动切换到 {c.to}，旧版本下线。</p>
            {fb ? <p className="imbot-done">✓ 你已反馈：{fb.verdict}{fb.text ? `（${fb.text}）` : ''}</p> : <>
              <input className="au-input" placeholder="补充说明（反馈「有问题」时必填）" value={d(a.tag_id).text || ''} onChange={(e) => setD(a.tag_id, { text: e.target.value })} aria-label="反馈说明" />
              <div className="imbot-acts"><Button size="small" type="primary" onClick={() => feedback(a, '验证通过')}>验证通过</Button><Button size="small" onClick={() => feedback(a, '有问题')}>有问题</Button></div>
            </>}
          </div>) })}
        {todo.map((r) => { const k = `${r.tagId}:${r.kind}`; return (
          <div key={k} className="imbot-card">
            <div className="imbot-head">💰 {r.kind}收益填报<small>{r.period}</small></div>
            <b>『{nameOf(r.tagId)}』{r.kind === '月度' ? `${r.period} 阶段性结论` : `${r.period} 项目整体收益`}</b>
            <textarea className="au-textarea" rows={2} placeholder={r.kind === '月度' ? '这个月用在哪、效果怎么样，例如：召回人群点击率较对照组提升' : '本季度项目整体收益，例如：活动 GMV 增量约 3%（实验组对比）'} value={d(k).conclusion || ''} onChange={(e) => setD(k, { conclusion: e.target.value })} aria-label="填报内容" />
            <input className="au-input" placeholder="收益数据或佐证文档链接（选填）" value={d(k).gain || ''} onChange={(e) => setD(k, { gain: e.target.value })} aria-label="收益数据" />
            <div className="imbot-acts"><Button size="small" type="primary" onClick={() => report(r)}>提交</Button><span className="asset-muted">未填报会按周期再次提醒</span></div>
          </div>) })}
      </div>}
    </div>
  )
}
