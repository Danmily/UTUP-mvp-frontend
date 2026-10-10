import { useState, useMemo, useEffect } from 'react'
import {
  Button, Card, Input, Select, Checkbox, Table, Modal, Descriptions, Alert,
  Tag, Space, Typography, message,
} from '@ecom/aurora'
import {
  TAGS, CATALOG, LEVEL_ORDER, SOON_DAYS, levelLabel, visibility,
  complianceOf, livePerm, isActive, isExpired,
} from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText } from '../mvp-ui.jsx'
import { useApplyFlow } from '../flows/ApplyFlow.jsx'
export { useApplyFlow } from '../flows/ApplyFlow.jsx'
import { assetState, displayStatus, togglePageSelection, mergePending, parsePending, pendingKey as pendingKeyOf, PENDING_MAX, PENDING_PAGE_SIZE } from '../flows/application-model.mjs'
import { LoadFailed, EmptyState, jumpExternal } from '../mvp-fallback.jsx'
import { useAiSearch, AiSearchPage, AiSidePanel, AiRecommendation } from './AiTagSearch.jsx'

const AI_VARIANT_KEY = 'utup.ai-search-variant'
/* 待选择清单：挑好的标签先放进来，统一填写申请（原「待申请清单」） */
export const BASKET = '待选择清单'

export default function Market({ V, myapply, addApply, pushAudit, goMyPerm, demo = 'normal', setDemo, fromAgent = false, backToAgent }) {
  const [filters, setFilters] = useState({ q: '', srcs: [], lvls: [], st: '' })
  const [detailId, setDetailId] = useState(null)
  /* 顶部标签页：标签广场 / AI 智能搜索（方案 A）/ 待选择清单，切换整个内容区 */
  const [view,setView]=useState(fromAgent?'basket':'market'), [page,setPage]=useState(1)
  const pendingKey = pendingKeyOf(V)
  const [pending, setPending] = useState(() => {try{return parsePending(localStorage.getItem(pendingKey),TAGS.map(t=>t.id))}catch{return []}})
  const [storageNotice,setStorageNotice]=useState('')
  /* AI 智能检索：两种入口方案并存，评审时切换对比 */
  const [aiVariant,setAiVariant]=useState(()=>{try{return localStorage.getItem(AI_VARIANT_KEY)==='B'?'B':'A'}catch{return 'A'}})
  const [searchMode,setSearchMode]=useState('plain'), [aiDraft,setAiDraft]=useState(''), [aiPanel,setAiPanel]=useState(false)
  const ai = useAiSearch(V)
  function chooseVariant(v){setAiVariant(v);if(view==='ai')setView('market');setAiPanel(false);setSearchMode('plain');try{localStorage.setItem(AI_VARIANT_KEY,v)}catch{}}
  function runSideSearch(){if(!aiDraft.trim())return;ai.run(aiDraft);setAiPanel(true)}
  useEffect(()=>{try{setPending(parsePending(localStorage.getItem(pendingKey),TAGS.map(t=>t.id)))}catch{setPending([])}},[pendingKey])
  function updatePending(change) {
    setPending(previous=>{const next=typeof change==='function'?change(previous):change;try{localStorage.setItem(pendingKey,JSON.stringify(next))}catch{setStorageNotice('浏览器暂时无法保存清单，离开页面后可能丢失。')}return next})
  }
  function removePending(id){updatePending(old=>old.filter(x=>x!==id))}
  const pageSize=20 // 4 列 × 5 行
  const [sel, setSel] = useState([]) // 批量申请选中的标签 id
  const [viewMode, setViewMode] = useState('card') // card | list
  /* 批量勾选只在列表视图提供（10/8 评审：卡片保持干净，不做勾选） */
  const batchMode = viewMode === 'list'
  function exitBatch() { setSel([]) }
  const applyFlow = useApplyFlow({ V, myapply, addApply, pushAudit, goMyPerm, backToAgent: fromAgent ? backToAgent : null, onRemoveTag:(id)=>{removePending(id);setSel(old=>old.filter(x=>x!==id))}, onDone: (ids) => { setSel(old=>old.filter(id=>!ids.includes(id)));updatePending(old=>old.filter(id=>!ids.includes(id)));setBasketSel(old=>old.filter(id=>!ids.includes(id))) } })
  useEffect(()=>setPage(1),[filters,demo])

  const applyStatus = tag => displayStatus(assetState(V,tag,myapply)).code
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
  const [basketSel,setBasketSel]=useState([]) // 清单页勾选：批量申请 / 批量移除
  const pendingPages=Math.max(1,Math.ceil(pendingTags.length/PENDING_PAGE_SIZE)), pendingPageNow=Math.min(pendingPage,pendingPages)
  const pendingSlice=pendingTags.slice((pendingPageNow-1)*PENDING_PAGE_SIZE,pendingPageNow*PENDING_PAGE_SIZE)
  function toggleSelAll() {setSel(s=>togglePageSelection(s,selectableList.map(t=>t.id)))}
  const startSelection=()=>{if(!pendingTags.length||blockedPending.length)return;applyFlow.start(pendingTags.map(t=>t.id))}
  function mergeIntoPending(ids){const eligible=ids.filter(id=>{const tag=TAGS.find(t=>t.id===id);return tag&&selectable(tag)});updatePending(old=>{const merged=mergePending(old,eligible);if(merged.length>PENDING_MAX){setStorageNotice(`${BASKET}最多 ${PENDING_MAX} 个标签，超出的 ${merged.length-PENDING_MAX} 个没有加入，先提交或移除一些再继续。`);return merged.slice(0,PENDING_MAX)}setStorageNotice('');return merged})}
  /* 加入后留在当前页，提示里给一个去清单的入口 */
  function notifyAdded(ids){const n=ids.filter(id=>{const t=TAGS.find(x=>x.id===id);return t&&selectable(t)&&!pending.includes(id)}).length;message.success(<span className="added-toast">已加入 {n} 个标签<button type="button" onClick={()=>setView('basket')}>去查看清单 →</button></span>)}
  function addPending(ids){notifyAdded(ids);mergeIntoPending(ids);setSel([]);setDetailId(null)}
  function addQuiet(ids){notifyAdded(ids);mergeIntoPending(ids)}


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

  function basketPage() {
    /* 下架标签来自资产接入（status = off）；其余能进清单的默认可申请 */
    const offline=(()=>{try{return new Set((JSON.parse(localStorage.getItem('utup.assets.v1'))||[]).filter(a=>a.status==='off').map(a=>a.tag_id))}catch{return new Set()}})()
    const canApply=t=>!offline.has('tag_'+t.id)&&selectable(t)
    const pageIds=pendingSlice.map(t=>t.id), live=basketSel.filter(id=>pending.includes(id))
    const allOn=pageIds.length>0&&pageIds.every(id=>live.includes(id))
    const chosen=pendingTags.filter(t=>live.includes(t.id)), chosenBlocked=chosen.filter(t=>!canApply(t))
    const toggle=id=>setBasketSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])
    const toggleAll=()=>setBasketSel(s=>togglePageSelection(s,pageIds))
    const removeChosen=()=>{updatePending(old=>old.filter(id=>!live.includes(id)));setBasketSel([]);message.success(`已从${BASKET}删除 ${live.length} 个标签`)}
    const applyChosen=()=>{if(!chosen.length||chosenBlocked.length)return;applyFlow.start(chosen.map(t=>t.id))}
    return (
      <Card>
        <div className="basket-head">
          <div><h2>{BASKET}<span>{pendingTags.length} / {PENDING_MAX}</span></h2></div>
          <Space>{fromAgent&&backToAgent&&<Button onClick={backToAgent}>返回圈人 Agent</Button>}<Button onClick={()=>setView('market')}>继续挑选</Button></Space>
        </div>
        {fromAgent&&<Alert type="info" showIcon message={`圈人 Agent 执行前发现这些标签还没有权限，已放进${BASKET}`} description="提交申请后返回圈人 Agent，对话会停在原来的位置继续执行。"/>}
        {storageNotice&&<Alert type="warning" message={storageNotice}/>}
        {pendingTags.length?<>
          <div className="basket-toolbar">
            <span>已选择 <b>{live.length}</b> 个标签{chosenBlocked.length>0&&<em>，其中 {chosenBlocked.length} 个不可申请</em>}</span>
            <Space><Button size="small" disabled={!live.length} onClick={removeChosen}>批量删除</Button><Button size="small" type="primary" disabled={!chosen.length||!!chosenBlocked.length} onClick={applyChosen}>一键批量申请（{chosen.length}）</Button></Space>
          </div>
          <table className="basket-table">
            <thead><tr><th className="c"><input type="checkbox" aria-label="选择本页全部标签" checked={allOn} onChange={toggleAll}/></th><th>标签名称</th><th>分级</th><th>口径描述</th><th>来源于</th><th>状态</th></tr></thead>
            <tbody>{pendingSlice.map(t=>{const ok=canApply(t),down=offline.has('tag_'+t.id);return <tr key={t.id} className={`${live.includes(t.id)?'is-on':''}${ok?'':' is-blocked'}`}>
              <td className="c"><input type="checkbox" aria-label={`选择 ${t.name}`} checked={live.includes(t.id)} onChange={()=>toggle(t.id)}/></td>
              <td><button type="button" className="basket-name" onClick={()=>openTag(t.id)}>{t.name}</button></td>
              <td><LevelChip level={visibility(V,t).eff}/></td>
              <td className="basket-desc" title={t.desc}>{t.desc}</td>
              <td>{t.src}</td>
              <td>{ok?<Tag color="success">可申请</Tag>:<span className="basket-off"><Tag>不可申请</Tag><small>{down?'标签已下架':assetState(V,t,myapply).code==='active'?'已有权限':'审批中'}</small></span>}</td>
            </tr>})}</tbody>
          </table>
          <div className="pending-pager"><span>第 {pendingPageNow} / {pendingPages} 页 · 共 {pendingTags.length} 个标签</span><Space><Button size="small" disabled={pendingPageNow===1} onClick={()=>setPendingPage(pendingPageNow-1)}>上一页</Button><Button size="small" disabled={pendingPageNow===pendingPages} onClick={()=>setPendingPage(pendingPageNow+1)}>下一页</Button></Space></div>
        </>:<div className="pending-list-empty"><b>{BASKET}还是空的</b><p>在标签详情里加入，或在列表视图中勾选后批量加入；也可以用 AI 智能搜索一次推荐一组。</p><Button onClick={()=>setView('market')}>去挑标签</Button></div>}
      </Card>
    )
  }

  return (
    <>
      <div className="page-head ai-page-head">
        <nav className="market-tabs" aria-label="标签广场导航">
          {[['market','标签广场'],...(aiVariant==='A'?[['ai','✦ AI 智能搜索']]:[]),['basket',BASKET]].map(([k,l])=>(
            <button key={k} type="button" className={`${view===k?'on':''}${k==='ai'?' is-ai':''}`} aria-current={view===k?'page':undefined} onClick={()=>setView(k)}>{l}{k==='basket'&&<b>{pendingTags.length}</b>}</button>
          ))}
        </nav>
        <div className="ai-variant-switch" role="group" aria-label="AI 智能检索方案对比"><span>评审对比 · 智能检索入口</span>{[['A','方案 A 独立入口'],['B','方案 B 搜索切换']].map(([k,l])=><button key={k} type="button" className={aiVariant===k?'on':''} aria-pressed={aiVariant===k} onClick={()=>chooseVariant(k)}>{l}</button>)}</div>
      </div>
      {view==='ai'&&aiVariant==='A' ? (
        <AiSearchPage ai={ai} renderRec={rec=><AiRecommendation V={V} myapply={myapply} rec={rec} pending={pending} onAdd={addQuiet} onOpen={openTag} onBasket={()=>setView('basket')}/>}/>
      ) : view==='basket' ? basketPage() : <>
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
              placeholder="描述业务需求，回车后在右侧推荐标签，例如：想看用户的消费能力，用哪些标签？"
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
              { label: '可申请', value: 'apply' },
              { label: '已申请', value: 'applied' },
              { label: '可使用', value: 'active' },
            ]}
          />
          </>}
        </div>
        <div className="market-tools">
          <div className="market-tools-title">标签目录 <span>{list.length} 个标签</span></div>
          <div className="market-tools-actions">
            <div className="view-switch market-view-switch" role="group" aria-label="展示方式">
              {[['card', '卡片'], ['list', '列表']].map(([k, label]) => (
                <button key={k} type="button" className={viewMode === k ? 'on' : ''} title={`切换为${label}展示`}
                  aria-pressed={viewMode === k} onClick={() => { setViewMode(k); if (k === 'card') setSel([]) }}>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{k==='card'?<><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/></>:<><path d="M7 5h10M7 10h10M7 15h10"/><path d="M3 5h.5M3 10h.5M3 15h.5"/></>}</svg>{label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {batchMode && <div className="list-batch-bar" role="region" aria-label="批量选择">
          <span className="list-batch-title"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="m6.5 10 2.3 2.3 4.7-4.8"/></svg>批量选择 · 已选 <b>{sel.length}</b> 个<small>勾选可申请的标签；已申请、可使用或已在清单中的不可勾选</small></span>
          <Space>
            <Button size="small" disabled={!selectableList.length} onClick={toggleSelAll}>{selectableList.length>0&&selectableList.every(t=>sel.includes(t.id))?'取消本页选择':`选择本页可申请（${selectableList.length}）`}</Button>
            {sel.length>0&&<Button size="small" onClick={exitBatch}>清空</Button>}
            <Button size="small" type="primary" disabled={!sel.length} onClick={()=>addPending(sel)}>加入{BASKET}（{sel.length}）</Button>
          </Space>
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
            onRow={r=>openTag(r.id)}
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
                  const st=displayStatus(assetState(V,r,myapply))
                  return <Tag color={st.code==='active'?'success':st.code==='applied'?'primary':undefined}>{st.label}</Tag>
                },
              },
              {
                title: '操作',
                key: 'op',
                width: 150,
                render: (v, r) => (
                  isActive(livePerm(r.id)) ? (
                    <span className="op-none">—</span>
                  ) : selectable(r) ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      {pending.includes(r.id)
                        ? <span className="pending-row-label">已加入</span>
                        : <Button type="link" size="small" onClick={() => addPending([r.id])}>加入待选择清单</Button>}
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
                  {/* 角标只有斜挂的蓝色「已申请」；右下角不放操作（有权限的标签不做跳转）（点卡片即看详情） */}
                  {applied && <span className="tc-ribbon">已申请</span>}
                  <div className="tc-top">
                    {/* 外层只拦截冒泡（避免打开详情），勾选交给 Checkbox 自己，
                        否则点在勾选框正中间会触发两次、相互抵消 */}
                    {batchMode && canSel && (
                      <span className="tc-check" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onChange={() => toggleSel(c.id)}><span className="portal-sr-only">选择 {c.name}</span></Checkbox>
                      </span>
                    )}
                    <div className="tc-name" title={c.name}>{c.name}</div>{pending.includes(c.id)&&<span className="pending-row-label">已在待选择清单</span>}
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      <div className="market-pagination"><span>共 {list.length} 个标签 · 第 {currentPage} / {pageCount} 页</span><Space><Button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</Button><Button disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>下一页</Button></Space></div>
      </>}
      {aiVariant==='B'&&aiPanel&&<Modal open placement="right" width={560} title="✦ AI 推荐标签" onCancel={()=>setAiPanel(false)} footer={<div className="pending-list-footer"><span>挑好的标签加入{BASKET}，最后统一申请</span><Space><Button onClick={()=>setAiPanel(false)}>关闭</Button><Button type="primary" onClick={()=>{setAiPanel(false);setView('basket')}}>查看{BASKET}（{pendingTags.length}）</Button></Space></div>}>
        <AiSidePanel key={ai.current?.query||'new'} ai={ai}>{ai.current&&<AiRecommendation V={V} myapply={myapply} rec={ai.current} pending={pending} onAdd={addQuiet} onOpen={openTag}/>}</AiSidePanel>
      </Modal>}
      {batchMode && sel.length>0 && <><div className="batch-bar selection-bar" role="region" aria-label="搜索结果批量选择"><div className="batch-info"><b>已选 {sel.length} 个标签</b><div className="selection-chips">{selTags.slice(0,2).map(t=><span key={t.id}>{t.name}<button aria-label={`取消选择 ${t.name}`} onClick={()=>toggleSel(t.id)}>×</button></span>)}{sel.length>2&&<small>等 {sel.length} 个标签</small>}</div></div><Space><Button onClick={exitBatch}>取消选择</Button><Button type="primary" disabled={!sel.length} onClick={()=>addPending(sel)}>加入{BASKET}（{sel.length}）</Button></Space></div><div className="selection-spacer"/></>}
      {view==='market'&&!(batchMode&&sel.length>0)&&<button type="button" className={`pending-list-launcher${batchMode?' above-batch':''}`} onClick={()=>setView('basket')} aria-label={`${BASKET}，${pendingTags.length} 个标签`}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M6 4h11v13H3V4h3m0 0V2h7v4H6V4ZM6 10h8m-8 4h8"/></svg><span>{BASKET}</span><b>{pendingTags.length}</b></button>}
      {detailTag && (
        <TagDetailModal
          V={V}
          tag={detailTag}
          applies={myapply.filter((a) => a.tagId === detailTag.id)}
          inPending={pending.includes(detailTag.id)}
          onAdd={()=>addPending([detailTag.id])}
          onViewPending={()=>{setDetailId(null);setView('basket')}}
          onClose={() => setDetailId(null)}
          onApply={() => { setDetailId(null); applyFlow.start([detailTag.id]) }}
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
            {active ? null : assetState(V,tag,applies).selectable ? (
              <><Button onClick={inPending?onViewPending:onAdd}>{inPending?`已加入 · 查看${BASKET}`:`加入${BASKET}`}</Button><Button type="primary" onClick={onApply}>直接申请</Button></>
            ) : (
              <Button disabled>{assetState(V,tag,applies).label}</Button>
            )}
          </Space>
        </div>
      }
    >
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        tag_id: {tag.id} · {tag.src}
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
