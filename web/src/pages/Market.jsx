import { useState, useMemo, useEffect } from 'react'
import {
  Button, Card, Input, Select, Checkbox, Table, Modal, Descriptions, Alert,
  Tag, Space, Typography,
} from '@ecom/aurora'
import {
  TAGS, CATALOG, LEVEL_ORDER, SOON_DAYS, levelLabel, visibility,
  complianceOf, livePerm, isActive, isExpired,
} from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText } from '../mvp-ui.jsx'
import { useApplyFlow } from '../flows/ApplyFlow.jsx'
export { useApplyFlow } from '../flows/ApplyFlow.jsx'
import { assetState, togglePageSelection, mergePending, parsePending, pendingKey as pendingKeyOf, PENDING_MAX, PENDING_PAGE_SIZE } from '../flows/application-model.mjs'
import { LoadFailed, EmptyState, jumpExternal } from '../mvp-fallback.jsx'
import { useAiSearch, AiSearchPage, AiSidePanel, AiRecommendation } from './AiTagSearch.jsx'

const AI_VARIANT_KEY = 'utup.ai-search-variant'

export default function Market({ V, myapply, addApply, pushAudit, goMyPerm, demo = 'normal', setDemo, fromAgent = false, backToAgent }) {
  const [filters, setFilters] = useState({ q: '', srcs: [], lvls: [], st: '' })
  const [detailId, setDetailId] = useState(null)
  const [selectionOpen,setSelectionOpen]=useState(fromAgent), [detailFromList,setDetailFromList]=useState(false), [page,setPage]=useState(1)
  const pendingKey = pendingKeyOf(V)
  const [pending, setPending] = useState(() => {try{return parsePending(localStorage.getItem(pendingKey),TAGS.map(t=>t.id))}catch{return []}})
  const [storageNotice,setStorageNotice]=useState('')
  /* AI 智能检索：两种入口方案并存，评审时切换对比 */
  const [aiVariant,setAiVariant]=useState(()=>{try{return localStorage.getItem(AI_VARIANT_KEY)==='B'?'B':'A'}catch{return 'A'}})
  const [aiPage,setAiPage]=useState(false), [searchMode,setSearchMode]=useState('plain'), [aiDraft,setAiDraft]=useState(''), [aiPanel,setAiPanel]=useState(false)
  const ai = useAiSearch(V)
  function chooseVariant(v){setAiVariant(v);setAiPage(false);setAiPanel(false);setSearchMode('plain');try{localStorage.setItem(AI_VARIANT_KEY,v)}catch{}}
  function runSideSearch(){if(!aiDraft.trim())return;ai.run(aiDraft);setAiPanel(true)}
  useEffect(()=>{try{setPending(parsePending(localStorage.getItem(pendingKey),TAGS.map(t=>t.id)))}catch{setPending([])}},[pendingKey])
  function updatePending(change) {
    setPending(previous=>{const next=typeof change==='function'?change(previous):change;try{localStorage.setItem(pendingKey,JSON.stringify(next))}catch{setStorageNotice('浏览器暂时无法保存清单，离开页面后可能丢失。')}return next})
  }
  function removePending(id){updatePending(old=>old.filter(x=>x!==id))}
  const pageSize=9
  const [sel, setSel] = useState([]) // 批量申请选中的标签 id
  const [viewMode, setViewMode] = useState('card') // card | list
  /* 批量模式：默认关闭，卡片保持干净；开启后才出现勾选框，点卡片即选中 */
  const [batchMode, setBatchMode] = useState(false)
  function exitBatch() {
    setBatchMode(false)
    setSel([])
  }
  const applyFlow = useApplyFlow({ V, myapply, addApply, pushAudit, goMyPerm, backToAgent: fromAgent ? backToAgent : null, onRemoveTag:(id)=>{removePending(id);setSel(old=>old.filter(x=>x!==id))}, onDone: (ids) => { setSel(old=>old.filter(id=>!ids.includes(id)));updatePending(old=>old.filter(id=>!ids.includes(id)));setSelectionOpen(false) } })
  useEffect(()=>setPage(1),[filters,demo])
  useEffect(()=>{if(!filters.q.trim()){setBatchMode(false);setSel([])}},[filters.q])

  const applyStatus = tag => assetState(V,tag,myapply).code
  const list = useMemo(() => (demo === 'empty' ? [] : TAGS).filter((c) => {
    const vis = visibility(V, c)
    if (!vis.visible) return false
    if (filters.q && !(c.name.includes(filters.q) || c.desc.includes(filters.q))) return false
    if (filters.srcs.length && !filters.srcs.includes(c.src)) return false
    if (filters.lvls.length && !filters.lvls.includes(c.level)) return false
    if (filters.st && applyStatus(c) !== filters.st) return false
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [V, filters, myapply, demo])

  function openTag(id) {
    const tag = TAGS.find((t) => t.id === id)
    if (tag) {
      pushAudit('查看标签详情：' + tag.name, tag.level)
      setDetailId(id)
    }
  }

  /* 批量申请：只有可申请、且当前无权限的标签能被选中 */
  const selectable = tag => assetState(V,tag,myapply).selectable
  function toggleSel(id) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const pageCount=Math.max(1,Math.ceil(list.length/pageSize)), currentPage=Math.min(page,pageCount)
  const pageList=list.slice((currentPage-1)*pageSize,currentPage*pageSize)
  const selectableList = pageList.filter(t=>selectable(t)&&!pending.includes(t.id))
  const selTags = sel.map((id) => TAGS.find((t) => t.id === id)).filter(Boolean)
  const pendingTags=pending.map(id=>TAGS.find(t=>t.id===id)).filter(t=>t&&visibility(V,t).visible)
  const blockedPending=pendingTags.filter(t=>!selectable(t))
  /* 清单抽屉分页：每页 10 个，移除后页码自动回收 */
  const [pendingPage,setPendingPage]=useState(1)
  const pendingPages=Math.max(1,Math.ceil(pendingTags.length/PENDING_PAGE_SIZE)), pendingPageNow=Math.min(pendingPage,pendingPages)
  const pendingSlice=pendingTags.slice((pendingPageNow-1)*PENDING_PAGE_SIZE,pendingPageNow*PENDING_PAGE_SIZE)
  function toggleSelAll() {setSel(s=>togglePageSelection(s,selectableList.map(t=>t.id)))}
  const startSelection=()=>{if(!pendingTags.length||blockedPending.length)return;setSelectionOpen(false);applyFlow.start(pendingTags.map(t=>t.id))}
  function mergeIntoPending(ids){const eligible=ids.filter(id=>{const tag=TAGS.find(t=>t.id===id);return tag&&selectable(tag)});updatePending(old=>{const merged=mergePending(old,eligible);if(merged.length>PENDING_MAX){setStorageNotice(`待申请清单最多 ${PENDING_MAX} 个标签，超出的 ${merged.length-PENDING_MAX} 个没有加入，先提交或移除一些再继续。`);return merged.slice(0,PENDING_MAX)}setStorageNotice('');return merged})}
  function addPending(ids){mergeIntoPending(ids);setSel([]);setBatchMode(false);setDetailId(null);setDetailFromList(false);setSelectionOpen(true)}
  function viewPendingDetail(id){setSelectionOpen(false);setDetailFromList(true);openTag(id)}


  const detailTag = detailId ? TAGS.find((t) => t.id === detailId) : null
  const hasFilter = !!filters.q || filters.srcs.length > 0 || filters.lvls.length > 0 || !!filters.st
  const clearFilters = () => setFilters({ q: '', srcs: [], lvls: [], st: '' })

  /* A-08：到期与过期在标签广场做全局提醒，详情与「我的申请」再给具体状态 */
  const expiring = useMemo(() => {
    const ids = [...new Set(myapply.map((a) => a.tagId))]
    const soon = ids.filter((id) => {
      const p = livePerm(id)
      return isActive(p) && p.valid !== '永久' && p.days <= SOON_DAYS
    })
    const gone = ids.filter((id) => isExpired(livePerm(id)))
    return { soon, gone }
  }, [myapply])

  return (
    <>
      <div className="page-head ai-page-head"><div className="market-title-row"><div className="page-title">标签广场</div><button type="button" className="pending-head-entry" onClick={()=>setSelectionOpen(true)} aria-label={`查看待申请清单，${pendingTags.length} 个标签`}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4h11v13H3V4h3m0 0V2h7v4H6V4ZM6 10h8m-8 4h8"/></svg>待申请清单<b>{pendingTags.length}</b></button></div>
        <div className="ai-variant-switch" role="group" aria-label="AI 智能检索方案对比"><span>评审对比 · 智能检索入口</span>{[['A','方案 A 独立入口'],['B','方案 B 搜索切换']].map(([k,l])=><button key={k} type="button" className={aiVariant===k?'on':''} aria-pressed={aiVariant===k} onClick={()=>chooseVariant(k)}>{l}</button>)}</div>
      </div>
      {aiVariant==='A'&&aiPage ? (
        <AiSearchPage ai={ai} onBack={()=>setAiPage(false)}>
          {ai.current ? <AiRecommendation V={V} myapply={myapply} rec={ai.current} pending={pending} onAdd={mergeIntoPending} onOpen={openTag} onUse={()=>jumpExternal('风神平台', demo !== 'fail')}/> : <div className="ai-empty">输入业务场景，或点一个示例开始。</div>}
        </AiSearchPage>
      ) : <>
      {aiVariant==='A'&&<div className="ai-entry-row">
        <div className="ai-entry is-current"><b>标签广场</b><p>按目录浏览、搜索和筛选标签</p><span>当前页面</span></div>
        <button type="button" className="ai-entry is-ai" onClick={()=>setAiPage(true)}><b><i>✦</i>AI 标签智能搜索</b><p>描述业务场景，推荐可申请的标签组合，支持历史搜索记录</p><span>去试试 →</span></button>
      </div>}
      {(expiring.soon.length > 0 || expiring.gone.length > 0) && (
        <>
          <Alert
            type="warning"
            showIcon
            message={
              <span>
                你有 {expiring.soon.length} 个标签即将到期、{expiring.gone.length} 个已过期，过期后相关实验与投放会中断。
                {goMyPerm && (
                  <Button type="link" size="small" onClick={goMyPerm}>去我的申请处理 →</Button>
                )}
              </span>
            }
          />
          <div style={{ height: 12 }} />
        </>
      )}
      <div className="kpi-row">
        {CATALOG.map((c) => (
          <div
            key={c.d}
            className={`kpi domain-kpi src-kpi${filters.srcs.includes(c.d) ? ' kpi-on' : ''}`}
            onClick={() => setFilters((d) => ({
              ...d,
              srcs: d.srcs.includes(c.d) ? d.srcs.filter((x) => x !== c.d) : [...d.srcs, c.d],
            }))}
          >
            <div className="src-name">{c.d}</div>
            <div className="src-sub">{c.n.toLocaleString()} 个标签 · 点击筛选</div>
          </div>
        ))}
      </div>
      <Card>
        <div className={`search-bar${aiVariant==='B'?' has-mode':''}${searchMode==='ai'?' is-ai':''}`}>
          {aiVariant==='B'&&<div className="search-mode" role="group" aria-label="搜索方式">{[['plain','普通搜索'],['ai','✦ AI 搜索']].map(([k,l])=><button key={k} type="button" className={searchMode===k?'on':''} aria-pressed={searchMode===k} onClick={()=>setSearchMode(k)}>{l}</button>)}</div>}
          {searchMode==='ai' ? (
            <Input
              prefix="✦"
              placeholder="描述业务场景，回车后在右侧推荐标签组合，例如：召回近 60 天没有下单的美妆老客"
              value={aiDraft}
              onChange={setAiDraft}
              onPressEnter={runSideSearch}
              style={{ paddingRight: 64 }}
              suffix={<button type="button" className="ai-inline-send" disabled={!aiDraft.trim()} onClick={runSideSearch}>推荐</button>}
            />
          ) : (
          <Input
            prefix="🔍"
            placeholder="搜索标签名 / 口径…"
            value={filters.q}
            onChange={(v) => setFilters((d) => ({ ...d, q: v }))}
          />
          )}
          {/* 来源域与分级支持多选：跨域场景常常要同时看多个域 */}
          {searchMode!=='ai'&&<>
          <Select
            mode="multiple"
            value={filters.srcs}
            placeholder="全部来源域"
            onChange={(v) => setFilters((d) => ({ ...d, srcs: v }))}
            options={CATALOG.map((c) => ({ label: c.d, value: c.d }))}
          />
          <Select
            mode="multiple"
            value={filters.lvls}
            placeholder="全部分级"
            onChange={(v) => setFilters((d) => ({ ...d, lvls: v }))}
            options={LEVEL_ORDER.map((x) => ({ label: levelLabel(x), value: x }))}
          />
          <Select
            value={filters.st}
            onChange={(v) => setFilters((d) => ({ ...d, st: v || '' }))}
            options={[
              { label: '全部使用状态', value: '' },
              { label: '可使用', value: 'active' },
              { label: '已过期', value: 'expired' },
              { label: '已申请', value: 'applied' },
              { label: '可申请', value: 'apply' },
            ]}
          />
          </>}
        </div>
        <div className="market-tools">
          <div className="market-tools-title">标签目录 <span>{list.length} 个标签</span></div>
          <div className="market-tools-actions">
            {!!filters.q.trim() && !batchMode && <Button className="market-batch-entry" onClick={() => setBatchMode(true)}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="m6.5 10 2.3 2.3 4.7-4.8"/></svg>批量选择</Button>}
            <div className="view-switch market-view-switch" role="group" aria-label="展示方式">
              {[['card', '卡片'], ['list', '列表']].map(([k, label]) => (
                <button key={k} type="button" className={viewMode === k ? 'on' : ''} title={`切换为${label}展示`}
                  aria-pressed={viewMode === k} onClick={() => setViewMode(k)}>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{k==='card'?<><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/></>:<><path d="M7 5h10M7 10h10M7 15h10"/><path d="M3 5h.5M3 10h.5M3 15h.5"/></>}</svg>{label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {batchMode && <div className="market-selection-mode" role="region" aria-label="批量选择模式">
          <div className="market-selection-caption"><span className="market-selection-mark" aria-hidden="true">✓</span><div><strong>选择要加入清单的标签</strong><p>已选 {sel.length} 个 · 待申请清单中的标签无需重复选择</p></div></div>
          <div className="market-selection-actions"><Button type="link" size="small" disabled={!selectableList.length} onClick={toggleSelAll}>{selectableList.length>0&&selectableList.every(t=>sel.includes(t.id))?'取消本页选择':`选择本页可申请（${selectableList.length}）`}</Button><span aria-hidden="true" className="market-action-divider"/><Button type="text" size="small" onClick={exitBatch}>取消选择</Button></div>
        </div>}
        {demo === 'fail' ? (
          <LoadFailed what="标签列表" onRetry={() => setDemo?.('normal')} />
        ) : list.length === 0 ? (
          hasFilter ? (
            <EmptyState
              title="没有符合当前筛选条件的标签"
              desc="可以放宽来源域或分级，再看看其他标签"
              action={<Button size="small" onClick={clearFilters}>清空筛选条件</Button>}
            />
          ) : (
            <EmptyState
              title="当前没有你可见的标签"
              desc="受控级或跨域的用数需求，请走本域 POC 入口申请"
            />
          )
        ) : viewMode === 'list' ? (
          /* 列表视图：去掉恒定值（覆盖率）与重复信息（团队），把宽度留给名称与口径 */
          <Table
            dataSource={pageList}
            rowKey="id"
            pagination={false}
            onRow={r=>batchMode?(selectable(r)&&!pending.includes(r.id)&&toggleSel(r.id)):openTag(r.id)}
            columns={[
              ...(batchMode ? [{
                title: (
                  <Checkbox
                    checked={selectableList.length > 0 && selectableList.every((t) => sel.includes(t.id))}
                    onChange={toggleSelAll}
                    disabled={!selectableList.length}
                  ><span className="portal-sr-only">选择本页全部可申请标签</span></Checkbox>
                ),
                key: 'sel',
                width: 40,
                render: (v, r) => (
                  selectable(r)&&!pending.includes(r.id) ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={sel.includes(r.id)} onChange={() => toggleSel(r.id)}><span className="portal-sr-only">选择 {r.name}</span></Checkbox>
                    </span>
                  ) : pending.includes(r.id)?<span className="pending-row-label">已加入</span>:null
                ),
              }] : []),
              {
                title: '标签名称',
                dataIndex: 'name',
                render: (v, r) => (
                  <span className="lt-name" title={v}>
                    {v}
                    {visibility(V, r).cross && <> <CrossBadge>跨域</CrossBadge></>}
                  </span>
                ),
              },
              { title: '统一分级', dataIndex: 'level', width: 118, render: (v) => <LevelChip level={v} /> },
              {
                title: '口径描述',
                dataIndex: 'desc',
                render: (v, r) => (
                  v && v !== r.name
                    ? <span className="lt-desc" title={v}>{v}</span>
                    : <span className="tc-desc-empty">暂无口径说明</span>
                ),
              },
              { title: '来源域', dataIndex: 'src', width: 112 },
              { title: '更新频率', dataIndex: 'freq', width: 92 },
              {
                title: '我的状态',
                key: 'st',
                width: 104,
                render: (v, r) => {
                  const st=assetState(V,r,myapply)
                  return <Tag color={st.code==='active'?'success':st.code==='applied'?'primary':undefined}>{st.label}</Tag>
                },
              },
              {
                title: '操作',
                key: 'op',
                width: 150,
                render: (v, r) => (
                  isActive(livePerm(r.id)) ? (
                    <Button type="link" size="small" className="asset-use-link"
                      onClick={(e) => { e.stopPropagation(); jumpExternal('风神平台', demo !== 'fail') }}>
                      去使用
                    </Button>
                  ) : selectable(r) ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      {pending.includes(r.id)
                        ? <span className="pending-row-label">已加入</span>
                        : <Button type="link" size="small" onClick={() => addPending([r.id])}>加入清单</Button>}
                      <Button type="link" size="small" onClick={() => applyFlow.start([r.id])}>直接申请</Button>
                    </span>
                  ) : <span style={{ color: 'var(--mute2)' }}>—</span>
                ),
              },
            ]}
          />
        ) : (
          <div className="tag-cards">
            {pageList.map((c) => {
              const vis = visibility(V, c)
              const state=assetState(V,c,myapply)
              const applied = state.code === 'applied'
              const canSel = selectable(c)&&!pending.includes(c.id)
              const checked = sel.includes(c.id)
              return (
                <div
                  key={c.id}
                  className={`tag-card${applied ? ' is-applied' : ''}${checked ? ' is-checked' : ''}`
                    + (batchMode && !canSel && !pending.includes(c.id) && state.code !== 'active' ? ' is-disabled' : '')}
                  onClick={() => (batchMode ? canSel && toggleSel(c.id) : openTag(c.id))}
                >
                  {/* 角标只表达「已申请」；已有权限由右下角「去使用」表达，其余状态不打角标 */}
                  {applied && <span className="tc-ribbon">已申请</span>}
                  <div className="tc-top">
                    {/* 外层只拦截冒泡（避免打开详情），勾选交给 Checkbox 自己，
                        否则点在勾选框正中间会触发两次、相互抵消 */}
                    {batchMode && canSel && (
                      <span className="tc-check" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onChange={() => toggleSel(c.id)}><span className="portal-sr-only">选择 {c.name}</span></Checkbox>
                      </span>
                    )}
                    <div className="tc-name" title={c.name}>{c.name}</div>{pending.includes(c.id)&&<span className="pending-row-label">已加入清单</span>}
                  </div>
                  {/* 字段顺序：名称 → 分级 → 业务含义 → 来源与更新频率 */}
                  <div className="tc-tags">
                    <LevelChip level={c.level} />
                    {vis.cross && <CrossBadge />}
                  </div>
                  <div className="tc-desc">
                    {c.desc && c.desc !== c.name
                      ? c.desc
                      : <span className="tc-desc-empty">暂无口径说明，可联系 {c.owner.split(' · ')[0]} 补充</span>}
                  </div>
                  {batchMode&&!canSel&&!pending.includes(c.id)&&state.code!=='active'&&<p className="selection-reason">{state.reason}</p>}
                  <div className="tc-foot">
                    <span>{c.src} · 更新 {c.freq}</span>
                    {state.code === 'active' && (
                      <Button type="link" size="small" className="asset-use-link"
                        onClick={(e) => { e.stopPropagation(); jumpExternal('风神平台', demo !== 'fail') }}>
                        去使用
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      <div className="market-pagination"><span>共 {list.length} 个标签 · 第 {currentPage} / {pageCount} 页</span><Space><Button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</Button><Button disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>下一页</Button></Space></div>
      </>}
      {aiVariant==='B'&&aiPanel&&<Modal open placement="right" width={560} title="✦ AI 推荐标签组合" onCancel={()=>setAiPanel(false)} footer={<div className="pending-list-footer"><span>挑好的标签加入清单，最后统一申请</span><Space><Button onClick={()=>setAiPanel(false)}>关闭</Button><Button type="primary" onClick={()=>{setAiPanel(false);setSelectionOpen(true)}}>查看待申请清单（{pendingTags.length}）</Button></Space></div>}>
        <AiSidePanel key={ai.current?.query||'new'} ai={ai}>{ai.current&&<AiRecommendation V={V} myapply={myapply} rec={ai.current} pending={pending} onAdd={mergeIntoPending} onOpen={openTag} onUse={()=>jumpExternal('风神平台', demo !== 'fail')}/>}</AiSidePanel>
      </Modal>}
      {batchMode && <><div className="batch-bar selection-bar" role="region" aria-label="搜索结果批量选择"><div className="batch-info"><b>已选 {sel.length} 个标签</b><div className="selection-chips">{selTags.slice(0,2).map(t=><span key={t.id}>{t.name}<button aria-label={`取消选择 ${t.name}`} onClick={()=>toggleSel(t.id)}>×</button></span>)}{sel.length>2&&<small>等 {sel.length} 个标签</small>}</div></div><Button type="primary" disabled={!sel.length} onClick={()=>addPending(sel)}>加入待申请清单（{sel.length}）</Button></div><div className="selection-spacer"/></>}
      <button type="button" className={`pending-list-launcher${batchMode?' above-batch':''}`} onClick={()=>setSelectionOpen(true)} aria-label={`待申请清单，${pendingTags.length} 个标签`}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4h11v13H3V4h3m0 0V2h7v4H6V4ZM6 10h8m-8 4h8"/></svg><span>待申请清单</span><b>{pendingTags.length}</b></button>
      {selectionOpen&&<Modal open placement="right" width={520} title={`待申请清单 · ${pendingTags.length} / ${PENDING_MAX}`} onCancel={()=>setSelectionOpen(false)} footer={<div className="pending-list-footer"><span>加入清单不会提交申请</span><Space>{fromAgent&&backToAgent&&<Button onClick={backToAgent}>返回圈人 Agent</Button>}<Button onClick={()=>setSelectionOpen(false)}>继续浏览</Button><Button type="primary" disabled={!pendingTags.length||!!blockedPending.length} onClick={startSelection}>填写申请（{pendingTags.length}）</Button></Space></div>}>
        {fromAgent&&<Alert type="info" showIcon message="圈人 Agent 执行前发现这些标签还没有权限，已加入清单" description="提交申请后返回圈人 Agent，对话会停在原来的位置继续执行。"/>}<p className="pending-list-intro">先看看标签是否合适，再统一申请。可查看详情或移除，关闭清单后继续挑选。</p>
        <p className="apply-muted">清单保存在当前浏览器，切换页面或刷新后仍保留。</p>
        {storageNotice&&<Alert type="warning" message={storageNotice}/>}
        {blockedPending.length>0&&<Alert type="warning" message="部分标签状态已变化，请先移除不可申请项；已有权限的标签可直接去使用。"/>}
        <div className="pending-tag-list">{pendingTags.length?pendingSlice.map((t,j)=>{const i=(pendingPageNow-1)*PENDING_PAGE_SIZE+j;const state=assetState(V,t,myapply);return <article key={t.id}><div className="pending-tag-heading"><span>{i+1}</span><strong>{t.name}</strong><LevelChip level={visibility(V,t).eff}/></div><p>{t.desc}</p><div className="pending-tag-source">{t.src} · 更新 {t.freq}</div>{!state.selectable&&<p className="apply-caution">{state.reason}</p>}<div className="pending-tag-actions"><Button type="link" size="small" onClick={()=>viewPendingDetail(t.id)}>查看详情</Button>{state.code==='active'&&<Button type="link" className="asset-use-link" onClick={()=>jumpExternal('风神平台',demo!=='fail')}>去使用</Button>}<Button type="link" size="small" onClick={()=>removePending(t.id)}>移除</Button></div></article>}) : <div className="pending-list-empty"><b>还没有待申请的标签</b><p>查看标签详情后加入清单，或搜索后批量选择。</p><Button onClick={()=>setSelectionOpen(false)}>去找标签</Button></div>}</div>
      {pendingPages>1&&<div className="pending-pager"><span>第 {pendingPageNow} / {pendingPages} 页 · 共 {pendingTags.length} 个</span><Space><Button size="small" disabled={pendingPageNow===1} onClick={()=>setPendingPage(pendingPageNow-1)}>上一页</Button><Button size="small" disabled={pendingPageNow===pendingPages} onClick={()=>setPendingPage(pendingPageNow+1)}>下一页</Button></Space></div>}
      </Modal>}
      {detailTag && (
        <TagDetailModal
          V={V}
          tag={detailTag}
          applies={myapply.filter((a) => a.tagId === detailTag.id)}
          inPending={pending.includes(detailTag.id)}
          onAdd={()=>addPending([detailTag.id])}
          onViewPending={()=>{setDetailId(null);setDetailFromList(false);setSelectionOpen(true)}}
          onClose={() => {setDetailId(null);if(detailFromList){setDetailFromList(false);setSelectionOpen(true)}}}
          onApply={() => { setDetailId(null);setDetailFromList(false); applyFlow.start([detailTag.id]) }}
        />
      )}
      {applyFlow.modal}
    </>
  )
}

function TagDetailModal({ V, tag, applies, onClose, onApply, onAdd, inPending, onViewPending }) {
  const vis = visibility(V, tag)
  const comp = complianceOf(tag)
  // 进详情时实时查「本人 × 标签」权限；申请状态取门户自记录
  const perm = livePerm(tag.id)
  const active = isActive(perm)
  const lastApply = [...applies].sort((a, b) => b.at.localeCompare(a.at))[0]
  const masked = (tag.level === '高敏' || tag.level === '受控') && !vis.real && !active
  const title = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {tag.name}
      {vis.cross ? (
        <>
          <LevelChip level={tag.level} />
          <span style={{ color: 'var(--mute)' }}>→</span>
          <LevelChip level={vis.eff} />
          <CrossBadge>跨域升档</CrossBadge>
        </>
      ) : (
        <LevelChip level={tag.level} />
      )}
    </span>
  )
  return (
    <Modal
      open
      width={760}
      title={title}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            本次查看已记入审计日志
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>关闭</Button>
            {active ? (
              <Button type="link" className="asset-use-link" onClick={()=>jumpExternal('风神平台')}>去使用</Button>
            ) : assetState(V,tag,applies).selectable ? (
              <><Button onClick={inPending?onViewPending:onAdd}>{inPending?'已加入 · 查看清单':'加入待申请清单'}</Button><Button type="primary" onClick={onApply}>直接申请</Button></>
            ) : (
              <Button disabled>{assetState(V,tag,applies).label}</Button>
            )}
          </Space>
        </div>
      }
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        tag_id: {tag.id} · {tag.src} · {tag.callType === 'psm' ? '系统间调用' : '人消费标签'}
      </Typography.Text>
      <div style={{ height: 12 }} />
      <Descriptions
        title="📋 元信息"
        bordered
        column={1}
        items={[
          { label: '口径描述', children: tag.desc },
          { label: '更新频率', children: tag.freq },
          { label: '来源域 / 表', children: <span>{tag.src} · <code>{tag.table}</code></span> },
          { label: 'Owner / 团队', children: tag.owner },
          { label: '覆盖率', children: tag.cov ? `${tag.cov}%` : '—' },
          {
            label: '统一分级',
            children: (
              <span>
                <LevelChip level={tag.level} />{' '}
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  由供给方判定
                </Typography.Text>
              </span>
            ),
          },
        ]}
      />
      <div style={{ height: 14 }} />
      <Descriptions
        title="🔑 我的权限（实时查询）"
        bordered
        column={1}
        items={[
          {
            label: '申请状态',
            children: lastApply ? (
              <span>
                <ApplyTag />{' '}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  最近 {lastApply.at}{applies.length > 1 ? ` · 共 ${applies.length} 次` : ''}
                </Typography.Text>
              </span>
            ) : <Typography.Text type="secondary">未申请</Typography.Text>,
          },
          { label: '生效状态', children: <EffectTag perm={perm} applied={applies.length > 0} /> },
          ...(perm ? [{ label: '有效期', children: <ValidText perm={perm} /> }] : []),
        ]}
      />
      <div style={{ height: 14 }} />
      <Descriptions
        title="🔢 枚举值 / 示例值（动态查询）"
        bordered
        column={1}
        items={[
          {
            label: '枚举值',
            children: masked ? (
              <Alert
                type="warning"
                showIcon
                message="*** （授权后可见真实值）"
                description="未获授权时只展示元信息，数据值以 *** 脱敏；授权通过后自动显示真实值。"
              />
            ) : (
              <span>{tag.enums.map((a) => <Tag key={a} style={{ margin: 2 }}>{a}</Tag>)}</span>
            ),
          },
        ]}
      />
      <div style={{ height: 14 }} />
      <Descriptions
        title="📄 数据使用合规说明"
        bordered
        column={1}
        items={[
          {
            label: '合规说明',
            children: (
              <Typography.Text type="secondary" style={{ fontSize: 12, lineHeight: 1.8 }}>
                {comp.note}
              </Typography.Text>
            ),
          },
          {
            label: '合规文档',
            children: <Typography.Link href={comp.url} target="_blank">📄 {comp.title}</Typography.Link>,
          },
        ]}
      />
      {tag.callType==='psm'&&<Alert type="info" message="系统间实时调用请联系来源方产品提需求，跨域调用方案待确认，当前不提供自助建单入口。"/>}
      {(tag.level === '高敏' || vis.cross) && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={`${vis.cross ? '跨域' : '高敏'}场景：需按来源方的合规流程审批，请提前准备合规材料。`}
        />
      )}
    </Modal>
  )
}
