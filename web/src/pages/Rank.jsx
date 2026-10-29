import { useMemo, useState } from 'react'
import { Button, Card, Tag } from '@ecom/aurora'
import { TAGS } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import { ASSET_KEY } from '../flows/asset-model.mjs'
import { isDelisted, BIZ_DOMAINS } from '../flows/asset-display.mjs'
import { RANGES, assetRank, SCENES, TOPICS } from '../flows/rank-model.mjs'

const BOARDS = [['asset', '🏷️ 热门资产榜'], ['rising', '🚀 飙升资产榜'], ['scene', '🎯 热门场景榜'], ['topic', '🔥 热点线索榜']]
const offlineIds = () => { try { return new Set((JSON.parse(localStorage.getItem(ASSET_KEY)) || []).filter((a) => a.status === 'off').map((a) => String(a.tag_id).replace(/^tag_/, ''))) } catch { return new Set() } }
const Trend = ({ n }) => <span className={`rank-trend ${n >= 0 ? 'up' : 'down'}`}>{n >= 0 ? '↑' : '↓'}{Math.abs(n)}%</span>
const No = ({ i }) => <i className={`rank-no${i < 3 ? ` top top${i + 1}` : ''}`}>{i + 1}</i>

/* 热度榜：独立页面。资产榜点击去标签广场，场景 / 线索榜点击带入交易画像 Agent */
export default function Rank({ onMarket, onAgent }) {
  const [board, setBoard] = useState('asset')
  const [range, setRange] = useState('7d')
  const [domain, setDomain] = useState('')
  const assets = useMemo(() => {
    const off = offlineIds()
    const list = assetRank(TAGS.filter((t) => !isDelisted(t) && !off.has(String(t.id))), { range, domain })
    return board === 'rising' ? [...list].sort((a, b) => b.trend - a.trend) : list
  }, [range, domain, board])
  const isAsset = board === 'asset' || board === 'rising'
  const rows = isAsset ? assets.slice(0, 20) : board === 'scene' ? SCENES.filter((s) => !domain || s.domain === domain) : TOPICS
  const podium = rows.slice(0, 3)
  const maxHeat = Math.max(1, ...rows.map((x) => x.heat))

  return (
    <div className="rank-page">
      <div className="rank-hero">
        <div><h2>热度榜</h2><p>看大家最近在用哪些资产、在做哪些场景、追哪些热点。资产榜按申请与圈人引用计热度，已下线和不可上架的字段不参与排名。</p></div>
        <div className="rank-filters">
          <div className="rank-seg">{RANGES.map(([k, l]) => <button key={k} type="button" className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div>
          {board !== 'topic' && <select className="au-input" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="业务域"><option value="">全部业务域</option>{[...BIZ_DOMAINS, ...(board === 'scene' ? ['跨域'] : [])].map((d) => <option key={d}>{d}</option>)}</select>}
        </div>
      </div>
      <div className="rank-tabs" role="tablist">{BOARDS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={board === k} className={board === k ? 'on' : ''} onClick={() => setBoard(k)}>{l}</button>)}</div>

      <div className="rank-podium">{podium.map((r, i) => (
        <button key={r.name} type="button" className={`rank-pod pod${i + 1}`} onClick={() => (isAsset ? onMarket() : onAgent(r.q))}>
          <span className="rank-medal">{['🥇', '🥈', '🥉'][i]}</span>
          <b>{r.name}</b>
          <small>{isAsset ? `${r.domain} · ${r.owner || ''}` : board === 'scene' ? `${r.domain} · 方案采纳率 ${r.adopt}%` : r.source}</small>
          <span className="rank-pod-heat">{(r.heat).toLocaleString('zh-CN')}<Trend n={r.trend} /></span>
        </button>
      ))}</div>

      <Card>
        <div className="rank-wrap"><table className="rank-table">
          <thead><tr>{isAsset
            ? <><th>排名</th><th>标签</th><th>业务域</th><th>密级</th><th>申请次数</th><th>圈人引用</th><th>热度</th><th>环比</th><th></th></>
            : board === 'scene'
              ? <><th>排名</th><th>场景</th><th>业务域</th><th>方案采纳率</th><th>发起次数</th><th>环比</th><th></th></>
              : <><th>排名</th><th>线索</th><th>来源</th><th>搜索热度</th><th>环比</th><th></th></>}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.name}>
            <td><No i={i} /></td>
            {isAsset ? <>
              <td><b>{r.name}</b><div className="asset-muted">tag_{r.id}</div></td><td>{r.domain}</td><td><LevelChip level={r.level} /></td>
              <td>{r.apply.toLocaleString('zh-CN')}</td><td>{r.use.toLocaleString('zh-CN')}</td>
              <td><div className="rank-bar"><i style={{ width: `${Math.round((r.heat / maxHeat) * 100)}%` }} /><span>{r.heat.toLocaleString('zh-CN')}</span></div></td>
              <td><Trend n={r.trend} /></td><td><Button size="small" type="link" onClick={onMarket}>去申请</Button></td>
            </> : board === 'scene' ? <>
              <td><b>{r.name}</b><div className="asset-muted">{r.q}</div></td><td><Tag>{r.domain}</Tag></td><td>{r.adopt}%</td>
              <td>{Math.round(r.heat * RANGES.find((x) => x[0] === range)[2]).toLocaleString('zh-CN')}</td><td><Trend n={r.trend} /></td>
              <td><Button size="small" type="link" onClick={() => onAgent(r.q)}>用这个场景圈人</Button></td>
            </> : <>
              <td><b>{r.name}</b><div className="asset-muted">{r.q}</div></td><td><Tag>{r.source}</Tag></td>
              <td><div className="rank-bar hot"><i style={{ width: `${Math.round((r.heat / maxHeat) * 100)}%` }} /><span>{r.heat.toLocaleString('zh-CN')}</span></div></td>
              <td><Trend n={r.trend} /></td><td><Button size="small" type="link" onClick={() => onAgent(r.q)}>带入 Agent</Button></td>
            </>}
          </tr>)}</tbody>
        </table></div>
        <p className="asset-muted rank-note">热度为演示数据，每日更新；真实环境由申请记录、圈人任务引用与站内搜索埋点计算。</p>
      </Card>
    </div>
  )
}
