import { useState, useMemo } from 'react'
import {
  Button, Card, Input, Select, Checkbox, Table, Modal, Descriptions, Alert, Steps,
  Form, Tag, Empty, Space, Typography, message,
} from '@ecom/aurora'
import {
  TAGS, CATALOG, LEVELS, LEVEL_ORDER, SCENES, SOON_DAYS, levelLabel, visibility, applyPath,
  complianceOf, livePerm, isActive, isExpired, nowStamp,
} from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText } from '../mvp-ui.jsx'
import { LoadFailed, EmptyState, jumpExternal } from '../mvp-fallback.jsx'

export default function Market({ V, myapply, addApply, pushAudit, goMyPerm, demo = 'normal', setDemo }) {
  const [filters, setFilters] = useState({ q: '', srcs: [], lvls: [], st: '' })
  const [detailId, setDetailId] = useState(null)
  const [sel, setSel] = useState([]) // 批量申请选中的标签 id
  const [viewMode, setViewMode] = useState('card') // card | list
  const applyFlow = useApplyFlow({ V, addApply, pushAudit, goMyPerm, onDone: () => setSel([]) })

  /* 列表只看门户自记录的申请状态，不逐卡实时查权限；是否生效进详情再查 */
  const applyStatus = (tag) =>
    myapply.some((a) => a.tagId === tag.id)
      ? 'applied'
      : visibility(V, tag).canApply ? 'apply' : 'visible'

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
  const selectable = (tag) => visibility(V, tag).canApply && !isActive(livePerm(tag.id))
  function toggleSel(id) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const selectableList = list.filter(selectable)
  const selTags = sel.map((id) => TAGS.find((t) => t.id === id)).filter(Boolean)
  const selNames = selTags.map((t) => t.name)
  /* 批量申请按其中最高分级走流程，先在操作条上告知，避免提交后才发现要走法务加签 */
  const selTopLevel = selTags.length
    ? selTags.map((t) => visibility(V, t).eff)
      .reduce((m, l) => (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(m) ? l : m), '开放')
    : null
  const restSelectable = selectableList.filter((t) => !sel.includes(t.id)).length
  function toggleSelAll() {
    const ids = selectableList.map((t) => t.id)
    const all = ids.length > 0 && ids.every((id) => sel.includes(id))
    setSel((s) => (all ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])]))
  }

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
              { label: '全部申请状态', value: '' },
              { label: '已申请', value: 'applied' },
              { label: '可申请', value: 'apply' },
            ]}
          />
        {/* 视图切换：卡片用于浏览发现，列表用于按条件快速比对（C-10） */}
        <div className="view-switch" role="group" aria-label="视图">
          {[['card', '⊞ 卡片'], ['list', '☰ 列表']].map(([k, label]) => (
            <button key={k} type="button" className={viewMode === k ? 'on' : ''}
              aria-pressed={viewMode === k} onClick={() => setViewMode(k)}>
              {label}
            </button>
          ))}
        </div>
        </div>
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
            dataSource={list}
            rowKey="id"
            pagination={false}
            onRow={(r) => openTag(r.id)}
            columns={[
              {
                title: (
                  <Checkbox
                    checked={selectableList.length > 0 && selectableList.every((t) => sel.includes(t.id))}
                    onChange={toggleSelAll}
                  />
                ),
                key: 'sel',
                width: 40,
                render: (v, r) => (
                  selectable(r) ? (
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={sel.includes(r.id)} onChange={() => toggleSel(r.id)} />
                    </span>
                  ) : null
                ),
              },
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
                  const perm = livePerm(r.id)
                  if (isActive(perm)) return <Tag color="success">生效中</Tag>
                  if (isExpired(perm)) return <Tag color="danger">已过期</Tag>
                  return applyStatus(r) === 'applied' ? <ApplyTag /> : <span style={{ color: 'var(--mute2)' }}>—</span>
                },
              },
              {
                title: '操作',
                key: 'op',
                width: 96,
                render: (v, r) => (
                  isActive(livePerm(r.id)) ? (
                    <Button type="link" size="small" style={{ color: 'var(--ok)' }}
                      onClick={(e) => { e.stopPropagation(); jumpExternal('风神平台', demo !== 'fail') }}>
                      去使用
                    </Button>
                  ) : visibility(V, r).canApply ? (
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
            {list.map((c) => {
              const vis = visibility(V, c)
              const applied = applyStatus(c) === 'applied'
              const perm = livePerm(c.id)
              const canSel = selectable(c)
              const checked = sel.includes(c.id)
              return (
                <div
                  key={c.id}
                  className={`tag-card${applied ? ' is-applied' : ''}${checked ? ' is-checked' : ''}`}
                  onClick={() => openTag(c.id)}
                >
                  {/* 已申请用角标表达，不再占用一个 tag 位；可申请为默认态，不额外标记 */}
                  {applied && <span className="tc-ribbon">已申请</span>}
                  <div className="tc-top">
                    {/* 外层只拦截冒泡（避免打开详情），勾选交给 Checkbox 自己，
                        否则点在勾选框正中间会触发两次、相互抵消 */}
                    {canSel && (
                      <span className="tc-check" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={checked} onChange={() => toggleSel(c.id)} />
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
                  <div className="tc-foot">
                    <span>{c.src} · 更新 {c.freq}</span>
                    {isActive(perm) && (
                      <Button
                        type="link"
                        size="small"
                        style={{ color: 'var(--ok)' }}
                        onClick={(e) => { e.stopPropagation(); jumpExternal('风神平台', demo !== 'fail') }}
                      >
                        去使用 →
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
      {sel.length > 0 && (
        /* 批量操作条：固定在视口底部，选中后始终可见，不用滚到页尾找按钮 */
        <div className="batch-bar" role="region" aria-label="批量申请">
          <div className="batch-count"><b>{sel.length}</b></div>
          <div className="batch-info">
            <div className="batch-title">
              已选 {sel.length} 个标签
              {selTopLevel && (
                <>
                  <span className="batch-sep">·</span>
                  按最高分级 <LevelChip level={selTopLevel} /> 审批
                </>
              )}
            </div>
            <div className="batch-names" title={selNames.join('、')}>{selNames.join('、')}</div>
          </div>
          <div className="batch-actions">
            {restSelectable > 0 && (
              <Button size="small" onClick={toggleSelAll}>全选当前 {selectableList.length} 个</Button>
            )}
            <Button size="small" onClick={() => setSel([])}>清空</Button>
            <Button type="primary" onClick={() => applyFlow.start(sel)}>批量申请 {sel.length} 个 →</Button>
          </div>
        </div>
      )}
      {detailTag && (
        <TagDetailModal
          V={V}
          tag={detailTag}
          applies={myapply.filter((a) => a.tagId === detailTag.id)}
          onClose={() => setDetailId(null)}
          onApply={() => { setDetailId(null); applyFlow.start([detailTag.id]) }}
        />
      )}
      {applyFlow.modal}
    </>
  )
}

/* 申请流程（智能助手预填 → 跳 Triton 建单）：标签广场与「我的申请 / 权限」共用
 * 支持单个与批量：门户为每个标签各记一条申请记录，不追踪 Triton 单据状态 */
/* 批量申请拆单：同一来源域 + 同一生效分级的标签合成一张单，
 * 不同分级不混装——一张单里混了高敏，整单都要等法务加签，会拖慢本可自动通过的标签 */
function splitTickets(V, tags) {
  const map = new Map()
  tags.forEach((t) => {
    const eff = visibility(V, t).eff
    const key = `${t.src}|${eff}`
    if (!map.has(key)) map.set(key, { src: t.src, eff, cross: false, tags: [] })
    const g = map.get(key)
    g.tags.push(t)
    g.cross = g.cross || visibility(V, t).cross
  })
  return [...map.values()].sort((a, b) => LEVEL_ORDER.indexOf(b.eff) - LEVEL_ORDER.indexOf(a.eff))
}

export function useApplyFlow({ V, addApply, pushAudit, goMyPerm, onDone }) {
  const [apply, setApply] = useState(null)
  const [done, setDone] = useState(null)

  function start(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).map((id) => TAGS.find((t) => t.id === id)).filter(Boolean)
    if (!list.length) return
    setApply({
      tags: list,
      fields: list.map((t) => t.name).join('、'),
      applicant: `user（${V.name} · ${V.domain}）`,
      scene: '',
      err: '',
      parsedFile: null,
      parsing: false,
    })
  }

  function onParse() {
    if (!apply || apply.parsing) return
    setApply((d) => ({ ...d, parsing: true }))
    const first = apply.tags[0]
    setTimeout(() => {
      const scene = SCENES[first.id % SCENES.length]
      setApply((p) => ({
        ...p,
        parsing: false,
        scene,
        err: '',
        parsedFile: `PRD_${first.name}.docx`,
      }))
      pushAudit(`智能小助手解析文档并预填申请字段：${apply.tags.map((t) => t.name).join('、')}`, visibility(V, first).eff)
      message.success(`已解析文档并预填申请字段、申请人、使用场景（${scene}），请核对后提交`)
    }, 500)
  }

  function onSubmit() {
    if (!apply) return
    if (!apply.scene) {
      setApply((d) => ({ ...d, err: '请选择使用场景' }))
      message.warning('请先选择使用场景，或上传文档自动预填')
      return
    }
    const at = nowStamp().slice(0, 16)
    const groups = splitTickets(V, apply.tags)
    groups.forEach((g, gi) => {
      const ticket = `APP-${24400 + Math.floor(Math.random() * 400) + gi}`
      g.tags.forEach((tag) => {
        const vis = visibility(V, tag)
        const path = applyPath(tag)
        addApply({ ticket, tagId: tag.id, at, scene: apply.scene })
        pushAudit(`去 ${path.target} 申请（智能小助手预填）：${tag.name}${vis.cross ? '（跨域升档）' : ''}`, vis.eff)
      })
      pushAudit(`申请提交成功：${g.src} · ${levelLabel(g.eff)} · ${g.tags.length} 个标签（场景=${apply.scene}）`, g.eff)
    })
    const names = apply.tags.map((t) => t.name)
    setApply(null)
    setDone({ names, scene: apply.scene, groups })
    onDone?.()
  }

  const modal = (
    <>
      {apply && (
        <ApplyGuideModal
          V={V}
          apply={apply}
          setApply={setApply}
          onClose={() => setApply(null)}
          onParse={onParse}
          onSubmit={onSubmit}
        />
      )}
      {done && (
        <Modal
          open
          width={460}
          title="✅ 申请已提交"
          onCancel={() => setDone(null)}
          footer={
            <Space>
              <Button onClick={() => setDone(null)}>知道了</Button>
              {goMyPerm && (
                <Button type="primary" onClick={() => { setDone(null); goMyPerm() }}>
                  去我的申请查看 →
                </Button>
              )}
            </Space>
          }
        >
          <Typography.Text>
            已提交 {done.names.length} 个标签的申请，使用场景「{done.scene}」
            {done.groups && done.groups.length > 1 && <>，按来源域与分级拆成 <b>{done.groups.length}</b> 张申请单并行审批</>}。
          </Typography.Text>
          <div style={{ height: 8 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {done.names.join('、')}
          </Typography.Text>
          <div style={{ height: 12 }} />
          <Alert
            type="info"
            showIcon
            message="审批需要一定时间，可在「我的申请 / 权限」查看生效状态；生效后即可去风神平台使用。"
          />
        </Modal>
      )}
    </>
  )
  return { start, modal }
}

function TagDetailModal({ V, tag, applies, onClose, onApply }) {
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
              <Button disabled>✓ 已有权限</Button>
            ) : vis.canApply ? (
              <Button type="primary" onClick={onApply}>{applies.length ? '再次申请 →' : '申请权限 →'}</Button>
            ) : (
              <Button disabled>{V.wl ? '暂不可申请' : '需走本域 POC 申请'}</Button>
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

function ApplyGuideModal({ V, apply, setApply, onClose, onParse, onSubmit }) {
  const tags = apply.tags
  const multi = tags.length > 1
  /* 批量时按最高分级预判审批链路：一单里只要有高敏，整体就走高敏流程 */
  const eff = tags
    .map((t) => visibility(V, t).eff)
    .reduce((m, l) => (LEVEL_ORDER.indexOf(l) > LEVEL_ORDER.indexOf(m) ? l : m), '开放')
  const cross = tags.some((t) => visibility(V, t).cross)
  const strict = eff === '受控' || eff === '高敏'
  const steps = eff === '开放'
    ? [{ title: '发起（消费方）' }, { title: '免审批 · 留痕' }]
    : eff === '通用'
      ? [{ title: '发起（消费方）' }, { title: '平台自动通过' }]
      : eff === '受控'
        ? [{ title: '发起（消费方）' }, { title: '申请方 +1' }, { title: 'Owner 审批' }]
        : [
            { title: '发起（消费方）' },
            { title: '申请方 +2' },
            { title: 'Owner（UG 收口）' },
            { title: '法务 + 合规加签' },
          ]
  const comp = complianceOf(tags[0])
  const groups = splitTickets(V, tags)
  return (
    <Modal
      open
      width={720}
      title={
        <span>
          {multi ? `批量申请 · ${tags.length} 个标签` : '申请智能助手'}
          <Tag color="warning" style={{ marginLeft: 8 }}>规划中</Tag>
        </span>
      }
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            门户不生成工单，最终建单在 Triton 完成
          </Typography.Text>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={onSubmit}>去 Triton 申请 →</Button>
          </Space>
        </div>
      }
    >
      <Alert
        type="info"
        showIcon
        message="🤖 智能小助手：表单智能预填"
        description="自动带出申请字段、申请人和使用场景；上传 PRD / 需求单 / 收益测算文档后会自动解析并回填，确认无误后一键跳转 Triton 建单。"
      />
      {multi && (
        /* 提交前预检：让申请人看清会拆成几张单、各自走什么审批，而不是提交后才知道 */
        <div className="precheck">
          <div className="precheck-head">
            提交预检 · {tags.length} 个标签将拆成 <b>{groups.length}</b> 张申请单
            <span className="precheck-tip">按「来源域 × 分级」拆分，各单并行审批，高敏不拖慢其他标签</span>
          </div>
          {groups.map((g) => (
            <div key={`${g.src}|${g.eff}`} className="precheck-row">
              <span className="precheck-src">{g.src}</span>
              <LevelChip level={g.eff} />
              {g.cross && <CrossBadge>跨域升档</CrossBadge>}
              <span className="precheck-n">{g.tags.length} 个标签</span>
              <span className="precheck-approve">{LEVELS[g.eff].approve}</span>
            </div>
          ))}
        </div>
      )}
      {cross && (
        <Alert
          style={{ marginTop: 10 }}
          type="warning"
          showIcon
          message={`跨域申请：密级将升档为 ${levelLabel(eff)}，审批方式为「${LEVELS[eff].approve}」，审批更严格。`}
        />
      )}
      <div
        className="route-box"
        onClick={onParse}
        style={{ cursor: 'pointer', textAlign: 'center', padding: 18, marginTop: 14 }}
      >
        <div style={{ fontSize: 22 }}>📄⬆️</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>
          <b>{apply.parsing ? '解析中…' : apply.parsedFile ? '解析完成，可重新上传替换' : '点击上传 PRD / 需求单 / 收益测算文档'}</b>
        </div>
        <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 4 }}>
          将自动解析并预填申请字段、申请人和使用场景
        </div>
      </div>
      {apply.parsedFile && (
        <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 8 }}>
          已解析 {apply.parsedFile}，字段已预填，请核对后提交。
        </div>
      )}
      <Form layout="vertical" style={{ marginTop: 14 }}>
        <Form.Item label="申请字段">
          <Input value={apply.fields} onChange={(v) => setApply((d) => ({ ...d, fields: v }))} />
        </Form.Item>
        <Form.Item label="申请人">
          <Input value={apply.applicant} onChange={(v) => setApply((d) => ({ ...d, applicant: v }))} />
        </Form.Item>
        <Form.Item label={<span><span className="req-star">*</span>使用场景</span>}>
          <Select
            value={apply.scene || undefined}
            placeholder="请选择，或上传文档自动预填"
            onChange={(v) => setApply((d) => ({ ...d, scene: v || '', err: '' }))}
            options={SCENES.map((s) => ({ label: s, value: s }))}
          />
          {apply.err && <div className="field-err">{apply.err}</div>}
        </Form.Item>
      </Form>
      {strict && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="受控 / 高敏标签还需提供 PRD 链接、Meego 需求单和收益测算，可由上传的文档一并解析。"
        />
      )}
      <div className="flow-title">预计审批链路</div>
      <Steps items={steps} current={steps.length - 1} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 10 }}>
        有效期：{LEVELS[eff].valid} · 审批人：{LEVELS[eff].approver} · 预填内容仅供参考，实际必填项与校验以 Triton 表单为准
      </Typography.Text>
      <div style={{ marginTop: 14 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>合规依据：</Typography.Text>{' '}
        <Typography.Link href={comp.url} target="_blank">📄 {comp.title}</Typography.Link>
      </div>
    </Modal>
  )
}
