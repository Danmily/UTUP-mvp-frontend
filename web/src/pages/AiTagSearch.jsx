import { useEffect, useRef, useState } from 'react'
import { Button } from '@ecom/aurora'
import { TAGS, visibility } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import { assetState } from '../flows/application-model.mjs'

/* AI 标签智能搜索 · 交互演示：围绕「业务需求 → 哪些标签合适」，按关键词匹配标签主题，不调用模型 */
export const AI_EXAMPLES = [
  ['看消费能力', '想判断用户的消费能力高低，有哪些标签合适？'],
  ['看兴趣偏好', '要做服饰新品推广，哪些标签能看出用户的品类兴趣？'],
  ['看活跃与流失', '做老客召回，哪些标签能反映用户活跃度和流失风险？'],
  ['看到店偏好', '想了解用户的到店消费偏好，有哪些生服标签？'],
]
/* 标签主题：每个主题下的标签与「这个标签能看出什么」 */
const TOPICS = [
  { test: /消费力|消费能力|购买力|客单|高价值|消费水平|有钱|消费高|消费低|消费一般/, topic: '消费能力',
    tags: [[14501, '按电商消费金额与频次划分消费力层级，最直接反映消费能力'], [14566, '看单笔订单金额高低，适合判断价格带'], [14606, '生服侧的客单价分层，看到店消费水平'], [14660, '融合电商与生服两域的消费力打分，适合跨域判断']] },
  { test: /兴趣|偏好|喜欢|品类|类目|新品|推广|爱买/, topic: '兴趣偏好',
    tags: [[14520, '用户近期最常购买的一二级类目序列，反映真实购买偏好'], [14610, '基于行为的 LLM 品类兴趣侧写，覆盖还没下单的潜在兴趣'], [14572, '加购、收藏的活跃程度，反映近期购买意向'], [14646, '用户关注的内容主题，适合内容种草场景']] },
  { test: /活跃|流失|沉默|召回|没下单|没有下单|回流|唤醒|生命周期/, topic: '活跃与流失',
    tags: [[14533, '近 30 天活跃天数分层，判断用户是否还在用'], [14678, '跨域流失风险打分，适合挑出需要优先召回的人'], [14666, '用户所处的生命周期阶段（新客、成熟、衰退等）']] },
  { test: /券|优惠|促销|大促|价格敏感|发券|补贴|核销/, topic: '优惠敏感度',
    tags: [[14578, '对大促和优惠的响应程度，判断是否适合发券'], [14612, '生服团购券的核销情况，反映领券后是否真的使用']] },
  { test: /到店|门店|生服|商圈|本地|团购|线下|餐饮/, topic: '到店与本地生活',
    tags: [[14618, '用户常去的到店品类，如餐饮、丽人、休闲'], [14580, '到店消费的频次，区分高频与低频用户'], [14624, '常驻商圈分层，判断用户活动的区域'], [14630, '到店消费集中的时段，适合安排触达时间']] },
  { test: /退货|退款|风控|售后|风险/, topic: '售后与风险',
    tags: [[14560, '退货退款率分层，识别售后风险较高的用户'], [14479, '支付交易单数分层，反映交易活跃程度（高敏，申请需合规审批）']] },
]
const FALLBACK = TOPICS[1]
export function recommend(V, query) {
  /* 按主题在问题中出现的先后排序：先提到的通常是主诉求 */
  const hit = TOPICS.filter((t) => t.test.test(query)).sort((a, b) => query.search(a.test) - query.search(b.test))
  const topics = hit.length ? hit : [FALLBACK]
  const seen = new Set()
  const items = topics.flatMap((t) => t.tags).map(([id, reason]) => ({ tag: TAGS.find((x) => x.id === id), reason }))
    .filter((x) => x.tag && visibility(V, x.tag).visible && !seen.has(x.tag.id) && seen.add(x.tag.id))
  const groups = [
    { key: 'core', title: '最匹配', hint: '和你的需求最相关', items: items.slice(0, 3) },
    { key: 'extra', title: '也可以看看', hint: '相关但用途不完全相同，按需选择', items: items.slice(3, 7) },
  ].filter((g) => g.items.length)
  const visible = TAGS.filter((t) => visibility(V, t).visible).length
  const count = groups.reduce((n, g) => n + g.items.length, 0)
  const scene = topics.map((t) => t.topic).join(' · ')
  return {
    query, scene, groups, at: new Date().toTimeString().slice(0, 5), guessed: !hit.length,
    steps: [
      `理解业务需求：关注「${scene}」${hit.length ? '' : '（未识别到明确主题，先按兴趣偏好推荐）'}`,
      `检索标签目录：在你可见的 ${visible} 个标签中找到 ${count} 个相关标签`,
      `按相关度排序：最匹配 ${groups[0]?.items.length || 0} 个${groups[1] ? `，也可以看看 ${groups[1].items.length} 个` : ''}`,
    ],
  }
}

const STEP_COUNT = 3
/* 会话：一次对话可以追问多轮；左侧历史按会话保存（仅当前页面内存） */
export function useAiSearch(V) {
  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const active = sessions.find((s) => s.id === activeId) || null
  function run(query) {
    const q = query.trim()
    if (!q || loading) return
    timers.current.forEach(clearTimeout)
    let id = activeId
    if (!active) {
      id = 'S' + Date.now()
      setSessions((list) => [{ id, title: q, at: new Date().toTimeString().slice(0, 5), turns: [] }, ...list])
      setActiveId(id)
    }
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, turns: [...s.turns, { query: q, rec: null }] } : s)))
    setLoading(true); setStep(0)
    timers.current = Array.from({ length: STEP_COUNT }, (_, i) => setTimeout(() => {
      if (i < STEP_COUNT - 1) { setStep(i + 1); return }
      const rec = recommend(V, q)
      setSessions((list) => list.map((s) => (s.id === id ? { ...s, scene: s.scene || rec.scene, turns: s.turns.map((t, k) => (k === s.turns.length - 1 ? { ...t, rec } : t)) } : s)))
      setLoading(false)
    }, 480 * (i + 1)))
  }
  function newSession() { if (!loading) setActiveId(null) }
  function open(id) { if (!loading) setActiveId(id) }
  const current = active?.turns.filter((t) => t.rec).at(-1)?.rec || null
  return { sessions, active, current, loading, step, run, newSession, open }
}

const ICON_SPARK = <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.5l2 5.6 5.6 2-5.6 2L10 16.7l-2-5.6-5.6-2 5.6-2z"/></svg>

/* 推荐结果卡：两个方案共用；标签可查看详情、加入待选择清单；已有权限的只标注「可使用」 */
export function AiRecommendation({ V, myapply, rec, pending, onAdd, onOpen, onBasket }) {
  const addable = (tag) => assetState(V, tag, myapply).selectable && !pending.includes(tag.id)
  const coreIds = (rec.groups.find((g) => g.key === 'core')?.items || []).map((x) => x.tag).filter(addable).map((t) => t.id)
  const inBasket = rec.groups.flatMap((g) => g.items).filter((x) => pending.includes(x.tag.id)).length
  return (
    <div className="ai-rec">
      <div className="ai-rec-head"><b>推荐标签</b><span className="ai-scene">{rec.scene}</span></div>
      {rec.groups.map((g) => (
        <section key={g.key} className={`ai-group ai-group-${g.key}`}>
          <h4>{g.title}<small>{g.hint}</small></h4>
          {g.items.map(({ tag, reason }) => {
            const st = assetState(V, tag, myapply)
            return (
              <div key={tag.id} className="ai-tag-row">
                <div className="ai-tag-main">
                  <div className="ai-tag-title"><button type="button" className="ai-tag-name" onClick={() => onOpen(tag.id)}>{tag.name}</button><LevelChip level={visibility(V, tag).eff} /></div>
                  <p>{reason}</p><small className="ai-tag-meta">{tag.src} · 更新 {tag.freq}{tag.cov ? ` · 覆盖率 ${tag.cov}%` : ''}</small>
                </div>
                <div className="ai-tag-action">
                  {st.code === 'active' ? <span className="ai-tag-state">可使用</span>
                    : pending.includes(tag.id) ? <span className="ai-added">✓ 已加入</span>
                      : st.selectable ? <button type="button" className="ai-add" onClick={() => onAdd([tag.id])}>+ 加入清单</button>
                        : <span className="ai-tag-state">{st.label}</span>}
                </div>
              </div>
            )
          })}
        </section>
      ))}
      <div className="ai-rec-foot">
        <span>{inBasket ? `已有 ${inBasket} 个在待选择清单中` : '点标签名看口径详情，合适的加入待选择清单统一申请'}</span>
        <div>
          {onBasket && <button type="button" className="ai-link" onClick={onBasket}>去待选择清单提交 →</button>}
          <Button type="primary" size="small" disabled={!coreIds.length} onClick={() => onAdd(coreIds)}>{coreIds.length ? `最匹配的加入待选择清单（${coreIds.length}）` : '最匹配的已处理'}</Button>
        </div>
      </div>
    </div>
  )
}

function Thinking({ step }) {
  return (
    <div className="ai-steps is-live" role="status">
      {['理解业务需求', '检索标签目录', '按相关度排序'].map((s, i) => (
        <span key={s} className={i < step ? 'done' : i === step ? 'on' : ''}><i />{s}</span>
      ))}
    </div>
  )
}

function Composer({ ai, hero, placeholder }) {
  const [text, setText] = useState('')
  const send = (v = text) => { if (!v.trim() || ai.loading) return; ai.run(v); setText('') }
  return (
    <div className={`ai-composer${hero ? ' is-hero' : ''}`}>
      <textarea rows={hero ? 3 : 2} value={text} placeholder={placeholder} aria-label="描述业务需求"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} />
      <div className="ai-composer-foot">
        <span>Enter 发送 · Shift + Enter 换行</span>
        <button type="button" className="ai-send" disabled={!text.trim() || ai.loading} onClick={() => send()} aria-label="发送">{ICON_SPARK}{hero ? '推荐标签' : '发送'}</button>
      </div>
    </div>
  )
}

/* 方案 A：独立的 AI 智能搜索（左侧历史会话 + 居中对话） */
export function AiSearchPage({ ai, renderRec }) {
  const stream = useRef(null)
  const turns = ai.active?.turns || []
  useEffect(() => { if (stream.current) stream.current.scrollTop = stream.current.scrollHeight }, [turns.length, ai.loading, ai.step])
  return (
    <div className="ai-shell">
      <aside className="ai-side">
        <button type="button" className="ai-new" onClick={ai.newSession} disabled={ai.loading}>＋ 新对话</button>
        <div className="ai-side-title">历史对话</div>
        {ai.sessions.length ? ai.sessions.map((s) => (
          <button type="button" key={s.id} className={`ai-hist${s.id === ai.active?.id ? ' on' : ''}`} onClick={() => ai.open(s.id)} title={s.title}>
            <span>{s.title}</span><small>{s.scene || '推荐中'} · {s.at}</small>
          </button>
        )) : <p className="ai-side-empty">还没有对话记录</p>}
      </aside>
      <section className="ai-conv">
        {!turns.length ? (
          <div className="ai-hero">
            <span className="ai-hero-mark">{ICON_SPARK}</span>
            <h2>想找哪些标签？</h2>
            <p>说说你的业务需求，我来推荐合适的标签，并说明每个标签能看出什么。</p>
            <Composer ai={ai} hero placeholder="例如：想判断用户的消费能力高低，有哪些标签合适？" />
            <div className="ai-examples">{AI_EXAMPLES.map(([k, v]) => <button type="button" key={k} onClick={() => ai.run(v)}><b>{k}</b><span>{v}</span></button>)}</div>
            <p className="ai-note">演示推荐 · 按关键词匹配，不代表模型能力</p>
          </div>
        ) : (
          <>
            <header className="ai-conv-head">{ai.active.title}</header>
            <div className="ai-stream" ref={stream}>
              <div className="ai-col">
                {turns.map((t, i) => (
                  <div key={i} className="ai-turn">
                    <div className="ai-user"><div>{t.query}</div></div>
                    <div className="ai-bot">
                      <div className="ai-bot-name"><span className="ai-avatar">{ICON_SPARK}</span>标签助手</div>
                      {t.rec ? <>
                        <p>{t.rec.guessed ? '没有识别到明确的标签主题，先按兴趣偏好推荐，你可以换个说法再问：' : `和「${t.rec.scene}」相关的标签有这些，点标签名可以看口径详情：`}</p>
                        <details className="ai-steps"><summary>查看分析过程 {t.rec.steps.length}/{t.rec.steps.length}</summary><ol>{t.rec.steps.map((s) => <li key={s}>{s}</li>)}</ol></details>
                        {renderRec(t.rec)}
                      </> : <><p>正在分析你的需求…</p><Thinking step={ai.step} /></>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ai-dock"><div className="ai-col"><Composer ai={ai} placeholder="继续问，例如：还有哪些能看出优惠敏感度的标签？" /><p className="ai-note">演示推荐 · 按关键词匹配，不代表模型能力；是否可用以标签详情中的口径为准</p></div></div>
          </>
        )}
      </section>
    </div>
  )
}

/* 方案 B：搜索框切到 AI 后，结果出现在右侧栏 */
export function AiSidePanel({ ai, children }) {
  return (
    <>
      <Composer ai={ai} placeholder="继续问，例如：还有生服侧的标签吗？" />
      {ai.loading ? <Thinking step={ai.step} /> : children}
    </>
  )
}
