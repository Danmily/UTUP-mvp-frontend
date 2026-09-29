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
import { assetState, togglePageSelection } from '../flows/application-model.mjs'
import { LoadFailed, EmptyState, jumpExternal } from '../mvp-fallback.jsx'

export default function Market({ V, myapply, addApply, pushAudit, goMyPerm, demo = 'normal', setDemo, onAudience }) {
  const [filters, setFilters] = useState({ q: '', srcs: [], lvls: [], st: '' })
  const [detailId, setDetailId] = useState(null)
  const [selectionOpen,setSelectionOpen]=useState(false), [exitOpen,setExitOpen]=useState(false), [page,setPage]=useState(1)
  const pageSize=9
  const [sel, setSel] = useState([]) // 批量申请选中的标签 id
  const [viewMode, setViewMode] = useState('card') // card | list
  /* 批量模式：默认关闭，卡片保持干净；开启后才出现勾选框，点卡片即选中 */
  const [batchMode, setBatchMode] = useState(false)
  function exitBatch() {
    setBatchMode(false)
    setSel([])
  }
  const applyFlow = useApplyFlow({ V, myapply, addApply, pushAudit, goMyPerm, onTagsChange:setSel, onDone: (ids) => { setSel(old=>old.filter(id=>!ids.includes(id)));setSelectionOpen(false) } })
  const requestExit=()=>sel.length?setExitOpen(true):exitBatch()
  useEffect(()=>setPage(1),[filters,demo])

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
  const selectableList = pageList.filter(selectable)
  const selTags = sel.map((id) => TAGS.find((t) => t.id === id)).filter(Boolean)
  const selNames = selTags.map((t) => t.name)
  function toggleSelAll() {setSel(s=>togglePageSelection(s,selectableList.map(t=>t.id)))}
  const startSelection=()=>{setSelectionOpen(false);applyFlow.start(sel)}

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
      <div className="page-head"><div className="page-title">标签广场</div></div>
      {onAudience && <div className="aud-market-cta"><div><strong>从业务目标出发，找到合适的人群</strong><p>带入这里的资产，在对话中整理需求、生成策略并评估结果。</p></div><button type="button" onClick={() => onAudience()}>开始圈人 ↗</button></div>}
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
        <div className="search-bar">
          <Input
            prefix="🔍"
            placeholder="搜索标签名 / 口径…"
            value={filters.q}
            onChange={(v) => setFilters((d) => ({ ...d, q: v }))}
          />
          {/* 来源域与分级支持多选：跨域场景常常要同时看多个域 */}
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
        </div>
        <div className="market-tools">
          <div className="market-tools-title">标签目录 <span>{list.length} 个标签</span></div>
          <div className="market-tools-actions">
            {!batchMode && <Button className="market-batch-entry" onClick={() => setBatchMode(true)}><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="m6.5 10 2.3 2.3 4.7-4.8"/></svg>批量申请</Button>}
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
          <div className="market-selection-caption"><span className="market-selection-mark" aria-hidden="true">✓</span><div><strong>选择要申请的标签</strong><p>已选 {sel.length} 个 · 翻页和筛选后仍保留</p></div></div>
          <div className="market-selection-actions"><Button type="link" size="small" disabled={!selectableList.length} onClick={toggleSelAll}>{selectableList.length>0&&selectableList.every(t=>sel.includes(t.id))?'取消本页选择':`选择本页可申请（${selectableList.length}）`}</Button><span aria-hidden="true" className="market-action-divider"/><Button type="text" size="small" onClick={requestExit}>取消选择</Button></div>
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
            onRow={r=>batchMode?(selectable(r)&&toggleSel(r.id)):openTag(r.id)}
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
                  selectable(r) ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={sel.includes(r.id)} onChange={() => toggleSel(r.id)}><span className="portal-sr-only">选择 {r.name}</span></Checkbox>
                    </span>
                  ) : null
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
                width: 96,
                render: (v, r) => (
                  isActive(livePerm(r.id)) ? (
                    <Button type="link" size="small" className="asset-use-link"
                      onClick={(e) => { e.stopPropagation(); jumpExternal('风神平台', demo !== 'fail') }}>
                      去使用
                    </Button>
                  ) : selectable(r) ? (
                    <Button type="link" size="small"
                      onClick={(e) => { e.stopPropagation(); applyFlow.start([r.id]) }}>
                      申请
                    </Button>
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
              const canSel = selectable(c)
              const checked = sel.includes(c.id)
              return (
                <div
                  key={c.id}
                  className={`tag-card${applied ? ' is-applied' : ''}${checked ? ' is-checked' : ''}`
                    + (batchMode && !canSel && state.code !== 'active' ? ' is-disabled' : '')}
                  onClick={() => (batchMode ? canSel && toggleSel(c.id) : openTag(c.id))}
                >
                  {/* 已有权限由蓝色使用入口表达；仅未生效申请保留状态角标。 */}
                  {applied && <span className="tc-ribbon">{state.label}</span>}
                  <div className="tc-top">
                    {/* 外层只拦截冒泡（避免打开详情），勾选交给 Checkbox 自己，
                        否则点在勾选框正中间会触发两次、相互抵消 */}
                    {batchMode && canSel && (
                      <span className="tc-check" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onChange={() => toggleSel(c.id)}><span className="portal-sr-only">选择 {c.name}</span></Checkbox>
                      </span>
                    )}
                    <div className="tc-name" title={c.name}>{c.name}</div>
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
                  {batchMode&&!canSel&&state.code!=='active'&&<p className="selection-reason">{state.reason}</p>}
                  <div className="tc-foot">
                    <span>{c.src} · 更新 {c.freq}</span>
                    {state.code === 'active' ? (
                      <Button type="link" size="small" className="asset-use-link"
                        onClick={(e) => { e.stopPropagation(); jumpExternal('风神平台', demo !== 'fail') }}>
                        去使用
                      </Button>
                    ) : (
                      <Button type="link" size="small" onClick={e=>{e.stopPropagation();openTag(c.id)}}>查看详情</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      <div className="market-pagination"><span>共 {list.length} 个标签 · 第 {currentPage} / {pageCount} 页</span><Space><Button disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>上一页</Button><Button disabled={currentPage===pageCount} onClick={()=>setPage(currentPage+1)}>下一页</Button></Space></div>
      {batchMode && <>
        <div className="batch-bar selection-bar" role="region" aria-label="已选标签操作栏"><div className="batch-info"><b>已选 {sel.length} 个标签</b><div className="selection-chips">{selTags.slice(0,2).map(t=><span key={t.id} title={t.name}>{t.name}<button aria-label={`移除 ${t.name}`} onClick={()=>toggleSel(t.id)}>×</button></span>)}{sel.length>2&&<button className="selection-more" title={selNames.join('、')} onClick={()=>setSelectionOpen(true)}>还有 {sel.length-2} 个 · 查看全部</button>}{!sel.length&&<small>请从列表中选择需要申请的标签</small>}</div></div><Space><Button disabled={!sel.length} onClick={()=>setSelectionOpen(true)}>管理已选（{sel.length}）</Button><Button type="primary" disabled={!sel.length} onClick={startSelection}>填写申请（{sel.length}）</Button></Space></div><div className="selection-spacer"/>
      </>}
      {selectionOpen&&<Modal open width={720} title={`管理已选标签 · ${sel.length} 个`} onCancel={()=>setSelectionOpen(false)} footer={<Space><Button disabled={!sel.length} onClick={()=>setSel([])}>清空已选</Button><Button onClick={()=>setSelectionOpen(false)}>继续选择</Button><Button type="primary" disabled={!sel.length} onClick={startSelection}>填写申请（{sel.length}）</Button></Space>}><p className="apply-muted">按选择顺序排列；可直接移除，不必返回原页寻找卡片。</p><div className="selected-tag-list">{selTags.length?selTags.map((t,i)=><div key={t.id}><span>{i+1}</span><div><strong>{t.name}</strong><p>{t.src} · {pageList.some(p=>p.id===t.id)?'当前页':'当前页以外'}</p></div><LevelChip level={visibility(V,t).eff}/><Button type="link" onClick={()=>toggleSel(t.id)}>移除</Button></div>):<p>已选清单为空，可以返回继续选择。</p>}</div></Modal>}
      {exitOpen&&<Modal open title="取消本次选择？" onCancel={()=>setExitOpen(false)} footer={<Space><Button onClick={()=>setExitOpen(false)}>继续选择</Button><Button type="primary" onClick={()=>{exitBatch();setExitOpen(false)}}>取消并清空选择</Button></Space>}><p>将清空当前选择的 {sel.length} 个标签，尚未提交任何申请。</p></Modal>}
      {detailTag && (
        <TagDetailModal
          V={V}
          tag={detailTag}
          onAudience={onAudience ? () => { setDetailId(null); onAudience(detailTag) } : undefined}
          applies={myapply.filter((a) => a.tagId === detailTag.id)}
          onClose={() => setDetailId(null)}
          onApply={() => { setDetailId(null); applyFlow.start([detailTag.id]) }}
        />
      )}
      {applyFlow.modal}
    </>
  )
}

function TagDetailModal({ V, tag, applies, onClose, onApply, onAudience }) {
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
            {onAudience && <Button onClick={onAudience}>带入圈人任务 →</Button>}
            {active ? (
              <Button type="link" className="asset-use-link" onClick={()=>jumpExternal('风神平台')}>去使用</Button>
            ) : assetState(V,tag,applies).selectable ? (
              <Button type="primary" onClick={onApply}>{applies.length ? '再次申请 →' : '申请权限 →'}</Button>
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
