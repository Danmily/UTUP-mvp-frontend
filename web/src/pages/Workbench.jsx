import { useState, useMemo } from 'react'
import {
  Button, Card, Select, Table, Tabs, Tag, Statistic, Space, Typography, message,
} from '@ecom/aurora'
import { CATALOG, LEVEL_ORDER, srcsOfIncome, domainPermRows } from '../data.js'
import { LevelChip, CrossBadge, ApplyTag, EffectTag, ValidText, DocCell } from '../mvp-ui.jsx'

/* 申请状态 Tab（0917 改版）：Triton 审批单状态门户拿不到，改为「申请人 × 标签」维度；
 * 申请状态取门户记录，生效状态按申请人 × 标签实时查权限。多标签申请单拆行，同人同标签多次申请合并。 */
const ALL_ROWS = domainPermRows()

export default function Workbench({ V, income }) {
  const [filters, setFilters] = useState({ st: '', lvl: '', src: '' })
  /* 供给方 Owner 只看本来源域；平台管理员不限域，可用下拉在来源域之间切换 */
  const isPlatform = !V.ownSrc
  const activeSrc = isPlatform ? filters.src : V.ownSrc

  const scopedRows = useMemo(
    () => (activeSrc ? ALL_ROWS.filter((m) => m.src === activeSrc) : ALL_ROWS),
    [activeSrc],
  )
  const scopedIncome = useMemo(
    () => (activeSrc ? income.filter((v) => srcsOfIncome(v).includes(activeSrc)) : income),
    [income, activeSrc],
  )

  const stats = useMemo(() => {
    const active = scopedRows.filter((m) => m.perm).length
    return {
      applied: scopedRows.length,
      active,
      inactive: scopedRows.length - active,
      cross: scopedRows.filter((m) => m.cross).length,
    }
  }, [scopedRows])
  const filtered = scopedRows.filter(
    (m) => (!filters.st || (filters.st === 'active' ? !!m.perm : !m.perm))
      && (!filters.lvl || m.level === filters.lvl),
  )
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
      dataIndex: 'last',
      width: 150,
      render: (v, r) => (
        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {v.at}
          <span className="row-sub">
            <code style={{ fontSize: 11 }}>{v.ticket}</code>
            {r.apps.length > 1 && ` · 共 ${r.apps.length} 次`}
          </span>
        </span>
      ),
    },
    { title: '申请人', dataIndex: 'applicant' },
    {
      title: '标签',
      dataIndex: 'tag',
      render: (v, r) => (
        <span>
          {v}
          {r.cross && <> <CrossBadge>⚡ 跨域</CrossBadge></>}
        </span>
      ),
    },
    { title: '分级', dataIndex: 'level', render: (v) => <LevelChip level={v} /> },
    { title: '场景', dataIndex: 'last', key: 'scene', render: (v) => v.scene },
    { title: '申请状态', key: 'apply', render: () => <ApplyTag /> },
    { title: '生效状态', dataIndex: 'perm', render: (v) => <EffectTag perm={v} /> },
    { title: '有效期 / 剩余', dataIndex: 'perm', key: 'valid', render: (v) => <ValidText perm={v} /> },
    {
      title: '操作',
      key: 'op',
      width: 130,
      render: (v, r) => (
        <Button
          type="link"
          size="small"
          onClick={() => message.info(`已在新页面打开 Triton 申请单 ${r.last.ticket}`)}
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
      <div className="kpi-row">
        <div className={`kpi domain-kpi${!filters.st ? ' kpi-on' : ''}`} onClick={() => setFilters((m) => ({ ...m, st: '' }))}>
          <Statistic title="📝 已申请" value={stats.applied} />
          <div className="kpi-trend">申请人 × 标签，经门户提交</div>
        </div>
        <div className={`kpi domain-kpi${filters.st === 'active' ? ' kpi-on' : ''}`} onClick={() => setFilters((m) => ({ ...m, st: 'active' }))}>
          <Statistic title="✅ 生效中" value={stats.active} valueStyle={{ color: 'var(--ok)' }} />
          <div className="kpi-trend">实时查询权限</div>
        </div>
        <div className={`kpi domain-kpi${filters.st === 'inactive' ? ' kpi-on' : ''}`} onClick={() => setFilters((m) => ({ ...m, st: 'inactive' }))}>
          <Statistic title="⏸ 已申请未生效" value={stats.inactive} valueStyle={{ color: 'var(--err)' }} />
          <div className="kpi-trend">待审批 / 被拒 / 已过期</div>
        </div>
        <div className="kpi">
          <Statistic title="⚡ 跨域升档" value={stats.cross} valueStyle={{ color: 'var(--p)' }} />
          <div className="kpi-trend">按高分级审批</div>
        </div>
      </div>
      <Card title="待审批 / 历史审批入口">
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          门户只提供入口，通过 / 拒绝 / 补充材料等操作都在 Triton 完成。门户不显示审批单状态，生效状态按「申请人 × 标签」实时查询权限。
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
        title="申请明细"
        extra={
          <Space>
            <Select
              value={filters.st || undefined}
              placeholder="全部生效状态"
              style={{ width: 140 }}
              onChange={(m) => setFilters((h) => ({ ...h, st: m || '' }))}
              options={[{ label: '生效中', value: 'active' }, { label: '未生效', value: 'inactive' }]}
            />
            <Select
              value={filters.lvl || undefined}
              placeholder="全部分级"
              style={{ width: 130 }}
              onChange={(m) => setFilters((h) => ({ ...h, lvl: m || '' }))}
              options={LEVEL_ORDER.map((m) => ({ label: m, value: m }))}
            />
            {(filters.st || filters.lvl) && (
              <Button size="small" onClick={() => setFilters((h) => ({ ...h, st: '', lvl: '' }))}>清空筛选</Button>
            )}
          </Space>
        }
      >
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          一行对应一位申请人的一个标签：多标签申请单会拆开，同一人对同一标签的多次申请会合并。
        </Typography.Text>
        <Table dataSource={filtered} columns={apprColumns} rowKey="key" pagination={false} />
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
