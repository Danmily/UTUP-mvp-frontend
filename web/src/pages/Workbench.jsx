import { useState, useMemo } from 'react'
import {
  Button, Card, Select, Table, Tabs, Tag, Statistic, Space, Typography, message,
} from '@ecom/aurora'
import {
  TAGS, APPROVALS, CATALOG, LEVEL_ORDER, levelLabel, upgrade, srcsOfIncome, domainPermRows, isActive, isExpired,
} from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, DocCell } from '../mvp-ui.jsx'

/* 申请状态 Tab（0918 改版）：按申请单展示。
 * Triton 流转状态拿不到，申请状态只有「已申请」，进度跳 Triton 查看；
 * 一单可含多个标签，点击「展开」看每个标签的分级；分级筛选只要单内任一标签命中即返回。
 * KPI：申请单数 ｜ 已生效 ｜ 已过期（后两者按「申请人 × 标签」实时权限统计） */
const TICKETS = APPROVALS.map((a) => {
  const tags = a.tagIds.map((id) => {
    const t = TAGS.find((x) => x.id === id)
    return { id, name: t.name, src: t.src, level: a.cross ? upgrade(t.level) : t.level }
  })
  const top = tags.reduce((m, t) => (LEVEL_ORDER.indexOf(t.level) > LEVEL_ORDER.indexOf(m) ? t.level : m), tags[0].level)
  return { ...a, tags, top, srcs: [...new Set(tags.map((t) => t.src))] }
}).sort((a, b) => b.at.localeCompare(a.at))
const PERM_ROWS = domainPermRows()

export default function Workbench({ V, income }) {
  const [filters, setFilters] = useState({ lvl: '', src: '' })
  const [open, setOpen] = useState({}) // 展开的申请单
  /* 供给方 Owner 只看本来源域；平台管理员不限域，可用下拉在来源域之间切换 */
  const isPlatform = !V.ownSrc
  const activeSrc = isPlatform ? filters.src : V.ownSrc

  const scopedTickets = useMemo(
    () => (activeSrc ? TICKETS.filter((m) => m.srcs.includes(activeSrc)) : TICKETS),
    [activeSrc],
  )
  const scopedIncome = useMemo(
    () => (activeSrc ? income.filter((v) => srcsOfIncome(v).includes(activeSrc)) : income),
    [income, activeSrc],
  )

  const stats = useMemo(() => {
    const perms = activeSrc ? PERM_ROWS.filter((m) => m.src === activeSrc) : PERM_ROWS
    return {
      tickets: scopedTickets.length,
      active: perms.filter((m) => isActive(m.perm)).length,
      expired: perms.filter((m) => isExpired(m.perm)).length,
    }
  }, [scopedTickets, activeSrc])
  const filtered = scopedTickets.filter((m) => !filters.lvl || m.tags.some((t) => t.level === filters.lvl))
  const harvest = useMemo(() => {
    const assetSet = new Set()
    scopedIncome.forEach((v) => (v.assets || [v.tag]).forEach((w) => assetSet.add(w)))
    const sceneSet = new Set(scopedIncome.map((v) => v.scene))
    return { assetSet, sceneSet }
  }, [scopedIncome])
  const scopeLabel = activeSrc || '全部来源域'

  const apprColumns = [
    {
      title: '申请时间',
      dataIndex: 'at',
      width: 140,
      render: (v) => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{v}</span>,
    },
    { title: '申请人', dataIndex: 'applicant' },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (v, r) => (
        <div>
          <span>
            {v[0].name}
            {r.cross && <> <CrossBadge>跨域</CrossBadge></>}
          </span>
          {v.length > 1 && (
            <>
              {' '}
              <Button
                type="link"
                size="small"
                onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [r.ticket]: !o[r.ticket] })) }}
              >
                {open[r.ticket] ? '收起' : `展开 · 共 ${v.length} 个`}
              </Button>
              {open[r.ticket] && (
                <div className="tag-expand">
                  {v.map((t) => (
                    <div key={t.id} className="tag-expand-row">
                      <span>{t.name}</span>
                      <LevelChip level={t.level} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
    {
      title: '分级',
      dataIndex: 'top',
      render: (v, r) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <LevelChip level={v} />
          {r.tags.length > 1 && <span className="row-sub">最高分级，展开看全部</span>}
        </span>
      ),
    },
    { title: '场景', dataIndex: 'scene' },
    { title: '申请状态', key: 'apply', render: () => <ApplyTag /> },
    {
      title: '操作',
      key: 'op',
      width: 130,
      render: (v, r) => (
        <Button
          type="link"
          size="small"
          onClick={() => message.info('已在新页面打开 Triton 申请详情')}
        >
          在 Triton 查看 →
        </Button>
      ),
    },
  ]

  const incomeColumns = [
    {
      title: '数据资产（可多个）',
      dataIndex: 'assets',
      render: (v, r) => (
        <span>{(v || [r.tag]).map((a) => <Tag key={a} style={{ margin: 2 }}>{a}</Tag>)}</span>
      ),
    },
    { title: '场景', dataIndex: 'scene' },
    { title: '收益说明', dataIndex: 'income' },
    { title: '佐证飞书文档', dataIndex: 'doc', render: (v, r) => <DocCell record={r} /> },
    {
      title: '录入人',
      dataIndex: 'by',
      render: (v) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Typography.Text>,
    },
    {
      title: '录入时间',
      dataIndex: 'at',
      render: (v) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Typography.Text>,
    },
  ]

  /* 来源域选择器：放在页头右上角，与页面标题同一行，统一控制「申请状态」
   * 和「效果回收」两个 Tab，而不是作为其中一个 Tab 的筛选项重复出现 */
  const srcSwitcher = isPlatform && (
    <div className="wb-scope">
      <span className="wb-scope-label">来源域</span>
      <Select
        value={filters.src || undefined}
        placeholder="全部来源域"
        allowClear
        style={{ width: 180 }}
        onChange={(m) => setFilters((h) => ({ ...h, src: m || '' }))}
        options={CATALOG.map((m) => ({ label: m.d, value: m.d }))}
      />
    </div>
  )

  const statusView = (
    <>
      <div className="kpi-row kpi-row-3">
        <div className="kpi">
          <Statistic title="📝 申请单数" value={stats.tickets} />
          <div className="kpi-trend">经门户提交</div>
        </div>
        <div className="kpi">
          <Statistic title="✅ 已生效" value={stats.active} valueStyle={{ color: 'var(--ok)' }} />
          <div className="kpi-trend">申请人 × 标签，当前有权限</div>
        </div>
        <div className="kpi">
          <Statistic title="⌛ 已过期" value={stats.expired} valueStyle={{ color: 'var(--err)' }} />
          <div className="kpi-trend">申请人 × 标签，权限已过期</div>
        </div>
      </div>
      <Card title="待审批 / 历史审批入口">
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          门户只提供入口，通过 / 拒绝 / 补充材料等操作都在 Triton 完成。门户拿不到审批流转状态，申请单进度请在 Triton 查看。
        </Typography.Text>
        <Space wrap>
          <Button type="primary" onClick={() => message.info('已在新页面打开 Triton 待审批列表')}>
            去 Triton 审批 →
          </Button>
          <Button onClick={() => message.info('已在新页面打开 Triton 历史审批')}>
            查看历史审批 →
          </Button>
        </Space>
      </Card>
      <div style={{ height: 14 }} />
      <Card
        title="申请单明细"
        extra={
          <Space>
            <Select
              value={filters.lvl || undefined}
              placeholder="全部分级"
              allowClear
              style={{ width: 130 }}
              onChange={(m) => setFilters((h) => ({ ...h, lvl: m || '' }))}
              options={LEVEL_ORDER.map((m) => ({ label: levelLabel(m), value: m }))}
            />
          </Space>
        }
      >
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          一单可含多个标签，点「展开」查看每个标签的分级；按分级筛选时，单内任一标签符合即显示。
        </Typography.Text>
        <Table dataSource={filtered} columns={apprColumns} rowKey="ticket" pagination={false} />
      </Card>
    </>
  )

  const harvestView = (
    <>
      <div className="kpi-row">
        <div className="kpi">
          <Statistic title="💰 收益记录数" value={scopedIncome.length} />
          <div className="kpi-trend up">消费方手工录入</div>
        </div>
        <div className="kpi">
          <Statistic title="🏷️ 涉及资产数" value={harvest.assetSet.size} />
          <div className="kpi-trend">去重统计</div>
        </div>
        <div className="kpi">
          <Statistic title="🎯 覆盖场景数" value={harvest.sceneSet.size} />
          <div className="kpi-trend">{[...harvest.sceneSet].join(' / ') || '—'}</div>
        </div>
        <div className="kpi">
          <Statistic title="📄 佐证文档" value={scopedIncome.filter((m) => m.docUrl).length} />
          <div className="kpi-trend">含飞书文档链接</div>
        </div>
      </div>
      <Card title={isPlatform ? `消费收益明细 · ${scopeLabel}` : '本域消费收益明细'}>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          同步展示消费方录入的场景、收益说明与佐证文档；一条记录可关联多个标签。
        </Typography.Text>
        <Table dataSource={scopedIncome} columns={incomeColumns} rowKey={(r, i) => i} pagination={false} />
      </Card>
    </>
  )

  return (
    <>
      <div className="page-head">
        <div className="page-title">供给方工作台</div>
        {srcSwitcher}
      </div>
      <Tabs
        items={[
          { key: 'status', label: isPlatform ? '📋 申请状态' : '📋 本域申请状态', children: statusView },
          { key: 'harvest', label: '💰 效果回收', children: harvestView },
        ]}
      />
    </>
  )
}
