import { useEffect, useRef, useState } from 'react'
import { Button } from '@ecom/aurora'
import { TAGS, visibility } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import { assetState } from '../flows/application-model.mjs'

/* AI 标签智能搜索 · 交互演示：按关键词给出固定的标签组合，不调用模型 */
export const AI_EXAMPLES = [
  ['新品推广', '给波司登找近 90 天买过服饰、中高消费、对羽绒服感兴趣的用户'],
  ['老客召回', '召回近 60 天没有下单的美妆老客'],
  ['门店获客', '为上海一家火锅门店找周边的潜在到店用户'],
  ['跨域高价值', '找电商消费一般、但生服消费很高的跨域高价值用户'],
]
const RULES = [
  { test: /召回|流失|沉默|没有下单|没下单|未购/, scene: '老客召回',
    core: [[14533, '识别最近不活跃的用户'], [14520, '限定历史买过目标品类']],
    extra: [[14678, '按流失风险排序，先触达高风险'], [14578, '对优惠敏感的人优先发券']],
    exclude: [[14560, '高退货退款用户不建议召回']] },
  { test: /到店|门店|火锅|生服|商圈/, scene: '门店获客',
    core: [[14618, '到店品类偏好匹配门店品类'], [14624, '常驻商圈限定门店服务范围']],
    extra: [[14580, '到店频次区分新客与老客'], [14612, '团购券核销率高的人更容易转化']], exclude: [] },
  { test: /跨域|高价值|双域/, scene: '跨域高价值发现',
    core: [[14660, '两域消费力融合打分'], [14501, '电商侧消费分层']],
    extra: [[14606, '生服侧客单价分层'], [14666, '跨域生命周期阶段']], exclude: [] },
  { test: /./, scene: '品牌营销 · 新品推广',
    core: [[14520, '找到近期买过目标品类的人'], [14501, '对应需求中的"中高消费"']],
    extra: [[14572, '加购收藏体现近期兴趣'], [14610, '补充 LLM 侧写的品类兴趣'], [14578, '大促期间可按敏感度分批']],
    exclude: [[14560, '排除高退货退款用户']] },
]
export function recommend(V, query) {
  const rule = RULES.find((r) => r.test.test(query))
  const pick = (rows) => rows.map(([id, reason]) => ({ tag: TAGS.find((t) => t.id === id), reason }))
    .filter((x) => x.tag && visibility(V, x.tag).visible)
  const groups = [
    { key: 'core', title: '核心标签', hint: '建议必选，直接决定圈谁', items: pick(rule.core) },
    { key: 'extra', title: '可选补充', hint: '按需加入，用于收窄或排序', items: pick(rule.extra) },
    { key: 'exclude', title: '建议排除', hint: '作为排除条件使用', items: pick(rule.exclude) },
  ].filter((g) => g.items.length)
  const visible = TAGS.filter((t) => visibility(V, t).visible).length
  const count = groups.reduce((n, g) => n + g.items.length, 0)
  return {
    query, scene: rule.scene, groups, at: new Date().toTimeString().slice(0, 5),
    steps: [
      `理解业务场景：识别为「${rule.scene}」`,
      `匹配标签目录：在你可见的 ${visible} 个标签中找到 ${count} 个相关标签`,
      `组合标签方案：${groups.map((g) => `${g.title} ${g.items.length} 个`).join('，')}`,
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

/* 推荐结果卡：两个方案共用；标签可查看详情、加入待选择清单或直接去使用 */
export function AiRecommendation({ V, myapply, rec, pending, onAdd, onOpen, onUse, onBasket }) {
  const addable = (tag) => assetState(V, tag, myapply).selectable && !pending.includes(tag.id)
  const coreIds = (rec.groups.find((g) => g.key === 'core')?.items || []).map((x) => x.tag).filter(addable).map((t) => t.id)
  const inBasket = rec.groups.flatMap((g) => g.items).filter((x) => pending.includes(x.tag.id)).length
  return (
    <div className="ai-rec">
      <div className="ai-rec-head"><b>推荐标签组合</b><span className="ai-scene">{rec.scene}</span></div>
      {rec.groups.map((g) => (
        <section key={g.key} className={`ai-group ai-group-${g.key}`}>
          <h4>{g.title}<small>{g.hint}</small></h4>
          {g.items.map(({ tag, reason }) => {
            const st = assetState(V, tag, myapply)
            return (
              <div key={tag.id} className="ai-tag-row">
                <div className="ai-tag-main">
                  <div className="ai-tag-title"><button type="button" className="ai-tag-name" onClick={() => onOpen(tag.id)}>{tag.name}</button><LevelChip level={visibility(V, tag).eff} /></div>
                  <p>{reason}<span> · {tag.src}</span></p>
                </div>
                <div className="ai-tag-action">
                  {st.code === 'active' ? <Button type="link" size="small" className="asset-use-link" onClick={onUse}>去使用</Button>
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
        <span>{inBasket ? `已有 ${inBasket} 个在待选择清单中` : '挑好的标签加入待选择清单，最后统一提交申请'}</span>
        <div>
          {onBasket && <button type="button" className="ai-link" onClick={onBasket}>去待选择清单提交 →</button>}
          <Button type="primary" size="small" disabled={!coreIds.length} onClick={() => onAdd(coreIds)}>{coreIds.length ? `核心标签加入待选择清单（${coreIds.length}）` : '核心标签已处理'}</Button>
        </div>
      </div>
    </div>
  )
}

function Thinking({ step }) {
  return (
    <div className="ai-steps is-live" role="status">
      {['理解业务场景', '匹配标签目录', '组合标签方案'].map((s, i) => (
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
      <textarea rows={hero ? 3 : 2} value={text} placeholder={placeholder} aria-label="描述业务场景"
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
            <p>描述业务场景，我会推荐可申请的标签组合，并说明每个标签的用途。</p>
            <Composer ai={ai} hero placeholder="例如：给某品牌找近 90 天买过服饰、中高消费、对羽绒服感兴趣的用户" />
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
                        <p>已理解你的需求，推荐以下标签组合。先看核心标签是否符合业务口径：</p>
                        <details className="ai-steps"><summary>查看分析过程 {t.rec.steps.length}/{t.rec.steps.length}</summary><ol>{t.rec.steps.map((s) => <li key={s}>{s}</li>)}</ol></details>
                        {renderRec(t.rec)}
                      </> : <><p>正在分析你的需求…</p><Thinking step={ai.step} /></>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ai-dock"><div className="ai-col"><Composer ai={ai} placeholder="继续补充或调整，例如：换成召回老客的场景，排除高退货用户" /><p className="ai-note">演示推荐 · 按关键词匹配，不代表模型能力；是否可用以标签详情中的口径为准</p></div></div>
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
      <Composer ai={ai} placeholder="继续补充或调整需求" />
      {ai.loading ? <Thinking step={ai.step} /> : children}
    </>
  )
}
