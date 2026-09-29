import { useRef, useState } from 'react'
import { Button } from '@ecom/aurora'
import { TAGS, visibility } from '../data.js'
import { LevelChip } from '../mvp-ui.jsx'
import { assetState } from '../flows/application-model.mjs'

/* AI 标签智能搜索 · 交互演示：按关键词给出固定的标签组合，不调用模型 */
export const AI_EXAMPLES = [
  '给波司登找近 90 天买过服饰、中高消费、对羽绒服感兴趣的用户',
  '召回近 60 天没有下单的美妆老客',
  '为上海一家火锅门店找周边的潜在到店用户',
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
  return { query, scene: rule.scene, groups, at: new Date().toTimeString().slice(0, 5) }
}

const STEPS = ['理解业务场景', '匹配标签目录', '组合标签方案']
export function useAiSearch(V) {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [history, setHistory] = useState([])
  const [current, setCurrent] = useState(null)
  const timers = useRef([])
  function run(query) {
    const q = query.trim()
    if (!q || loading) return
    timers.current.forEach(clearTimeout)
    setLoading(true); setStep(0); setCurrent(null)
    timers.current = STEPS.map((_, i) => setTimeout(() => {
      if (i < STEPS.length - 1) { setStep(i + 1); return }
      const rec = recommend(V, q)
      setCurrent(rec); setHistory((h) => [rec, ...h.filter((x) => x.query !== q)].slice(0, 8)); setLoading(false)
    }, 450 * (i + 1)))
  }
  return { loading, step, history, current, setCurrent, run }
}

export function AiThinking({ step }) {
  return (
    <div className="ai-thinking" role="status">
      {STEPS.map((s, i) => (
        <span key={s} className={i < step ? 'done' : i === step ? 'on' : ''}>{i < step ? '✓' : i === step ? '◌' : '○'} {s}</span>
      ))}
    </div>
  )
}

/* 推荐结果：每个标签可查看详情 / 加入清单；已有权限的直接去使用 */
export function AiRecommendation({ V, myapply, rec, pending, onAdd, onOpen, onUse }) {
  const addable = (tag) => assetState(V, tag, myapply).selectable && !pending.includes(tag.id)
  const coreIds = (rec.groups.find((g) => g.key === 'core')?.items || []).map((x) => x.tag.id).filter((id) => addable(TAGS.find((t) => t.id === id)))
  return (
    <div className="ai-result">
      <div className="ai-result-head">
        <div>
          <span className="ai-scene">{rec.scene}</span>
          <p>根据「{rec.query}」推荐 {rec.groups.reduce((n, g) => n + g.items.length, 0)} 个标签，先看核心标签是否符合业务口径。</p>
        </div>
        <Button type="primary" size="small" disabled={!coreIds.length} onClick={() => onAdd(coreIds)}>
          {coreIds.length ? `核心标签加入清单（${coreIds.length}）` : '核心标签已处理'}
        </Button>
      </div>
      {rec.groups.map((g) => (
        <section key={g.key} className={`ai-group ai-group-${g.key}`}>
          <h4>{g.title}<small>{g.hint}</small></h4>
          {g.items.map(({ tag, reason }) => {
            const st = assetState(V, tag, myapply)
            return (
              <div key={tag.id} className="ai-tag-row">
                <div className="ai-tag-main">
                  <button type="button" className="ai-tag-name" onClick={() => onOpen(tag.id)}>{tag.name}</button>
                  <LevelChip level={visibility(V, tag).eff} />
                  <p>{reason}<span> · {tag.src}</span></p>
                </div>
                <div className="ai-tag-action">
                  {st.code === 'active' ? <Button type="link" size="small" className="asset-use-link" onClick={onUse}>去使用</Button>
                    : pending.includes(tag.id) ? <span className="pending-row-label">已加入清单</span>
                      : st.selectable ? <Button size="small" onClick={() => onAdd([tag.id])}>加入清单</Button>
                        : <span className="ai-tag-state">{st.label}</span>}
                </div>
              </div>
            )
          })}
        </section>
      ))}
      <p className="ai-foot">演示推荐 · 按关键词匹配，不代表模型能力；是否可用以标签详情中的口径为准。</p>
    </div>
  )
}

function AiComposer({ ai, compact }) {
  const [text, setText] = useState(ai.current?.query || '')
  return (
    <div className={`ai-composer${compact ? ' compact' : ''}`}>
      <textarea rows={compact ? 2 : 3} value={text} placeholder="描述你的业务场景，例如：给某品牌找近 90 天买过服饰、中高消费的用户"
        aria-label="描述业务场景"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ai.run(text) } }} />
      <div className="ai-composer-foot">
        <div className="ai-examples">{AI_EXAMPLES.map((x) => <button type="button" key={x} onClick={() => { setText(x); ai.run(x) }}>{x}</button>)}</div>
        <Button type="primary" disabled={!text.trim() || ai.loading} onClick={() => ai.run(text)}>推荐标签</Button>
      </div>
    </div>
  )
}

/* 方案 A：独立的 AI 智能搜索页，左侧保留搜索记录 */
export function AiSearchPage({ ai, onBack, children }) {
  return (
    <div className="ai-page">
      <aside className="ai-history">
        <button type="button" className="ai-back" onClick={onBack}>← 返回标签广场</button>
        <b>搜索记录</b>
        {ai.history.length ? ai.history.map((h) => (
          <button type="button" key={h.query} className={ai.current?.query === h.query ? 'on' : ''} onClick={() => ai.setCurrent(h)}>
            <span>{h.query}</span><small>{h.scene} · {h.at}</small>
          </button>
        )) : <p>还没有搜索记录</p>}
      </aside>
      <main className="ai-main">
        <div className="ai-main-head"><span className="ai-spark">✦</span><div><h2>AI 标签智能搜索</h2><p>说出业务场景，推荐可申请的标签组合。挑好的标签加入待申请清单，统一提交。</p></div></div>
        <AiComposer ai={ai} />
        {ai.loading ? <AiThinking step={ai.step} /> : children}
      </main>
    </div>
  )
}

/* 方案 B：搜索框切到 AI 后，结果出现在右侧栏 */
export function AiSidePanel({ ai, children }) {
  return (
    <>
      <AiComposer ai={ai} compact />
      {ai.loading ? <AiThinking step={ai.step} /> : children}
    </>
  )
}
