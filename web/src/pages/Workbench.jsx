import { useState, useMemo } from 'react'
import {
  Button, Card, Select, Table, Tabs, Tag, Statistic, Space, Typography, message,
} from '@ecom/aurora'
import { APPROVALS, LEVEL_ORDER } from '../data.js'
import { LevelChip, CrossBadge, StatusTag, DocCell } from '../mvp-ui.jsx'

export default function Workbench({ income }) {
  const [filters, setFilters] = useState({ st: '', lvl: '' })
  const stats = useMemo(() => ({
    inProg: APPROVALS.filter((m) => m.status === '审批中').length,
    pass: APPROVALS.filter((m) => m.status === '已通过').length,
    rej: APPROVALS.filter((m) => m.status === '已拒绝').length,
    cross: APPROVALS.filter((m) => m.cross).length,
  }), [])
  const filtered = APPROVALS.filter(
    (m) => (!filters.st || m.status === filters.st) && (!filters.lvl || m.level === filters.lvl),
  )
  const harvest = useMemo(() => {
    const assetSet = new Set()
    income.forEach((v) => (v.assets || [v.tag]).forEach((w) => assetSet.add(w)))
    const sceneSet = new Set(income.map((v) => v.scene))
    return { assetSet, sceneSet }
  }, [income])

  const apprColumns = [
    { title: '申请单号', dataIndex: 'id', width: 110, render: (v) => <code style={{ fontSize: 11 }}>{v}</code> },
    { title: '申请人', dataIndex: 'applicant' },
    {
      title: '标签（可多个）',
      dataIndex: 'tags',
      render: (v, r) => {
        const list = v || [r.tag]
        return (
          <span>
            {list.length > 1 ? (
              <>
                {list[0]}{' '}
                <Tag title={list.join(' / ')}>+{list.length - 1}</Tag>
              </>
            ) : list[0]}
            {r.cross && <> <CrossBadge>⚡ {r.up || '跨域'}</CrossBadge></>}
          </span>
        )
      },
    },
    { title: '分级', dataIndex: 'level', render: (v) => <LevelChip level={v} /> },
    { title: '场景', dataIndex: 'scene' },
    {
      title: '提交时间',
      dataIndex: 'at',
      render: (v) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v}</Typography.Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v, r) => (
        <span>
          <StatusTag status={v} />
          {r.reject && (
            <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{r.reject}</div>
          )}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'op',
      width: 130,
      render: () => (
        <Button
          type="link"
          size="small"
          onClick={() => message.info('已在新页面打开 Triton 工单详情')}
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

  const statusView = (
    <>
      <div className="kpi-row">
        <div className="kpi domain-kpi" onClick={() => setFilters((m) => ({ ...m, st: '审批中' }))}>
          <Statistic title="⏳ 审批中" value={stats.inProg} valueStyle={{ color: 'var(--warn)' }} />
          <div className="kpi-trend">经门户提交</div>
        </div>
        <div className="kpi domain-kpi" onClick={() => setFilters((m) => ({ ...m, st: '已通过' }))}>
          <Statistic title="✅ 已通过" value={stats.pass} valueStyle={{ color: 'var(--ok)' }} />
          <div className="kpi-trend">同步自 Triton</div>
        </div>
        <div className="kpi domain-kpi" onClick={() => setFilters((m) => ({ ...m, st: '已拒绝' }))}>
          <Statistic title="✕ 已拒绝" value={stats.rej} valueStyle={{ color: 'var(--err)' }} />
          <div className="kpi-trend">同步自 Triton</div>
        </div>
        <div className="kpi">
          <Statistic title="⚡ 跨域升档" value={stats.cross} valueStyle={{ color: 'var(--p)' }} />
          <div className="kpi-trend">按高分级审批</div>
        </div>
      </div>
      <Card title="待审批 / 历史审批入口">
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          门户只提供入口，通过 / 拒绝 / 补充材料等操作都在 Triton 完成；返回后列表状态会按同步周期刷新。
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
        title="申请状态明细"
        extra={
          <Space>
            <Select
              value={filters.st || undefined}
              placeholder="全部状态"
              style={{ width: 130 }}
              onChange={(m) => setFilters((h) => ({ ...h, st: m || '' }))}
              options={['审批中', '已通过', '已拒绝'].map((m) => ({ label: m, value: m }))}
            />
            <Select
              value={filters.lvl || undefined}
              placeholder="全部分级"
              style={{ width: 130 }}
              onChange={(m) => setFilters((h) => ({ ...h, lvl: m || '' }))}
              options={LEVEL_ORDER.map((m) => ({ label: m, value: m }))}
            />
            {(filters.st || filters.lvl) && (
              <Button size="small" onClick={() => setFilters({ st: '', lvl: '' })}>清空筛选</Button>
            )}
          </Space>
        }
      >
        <Table dataSource={filtered} columns={apprColumns} rowKey="id" pagination={false} />
      </Card>
    </>
  )

  const harvestView = (
    <>
      <div className="kpi-row">
        <div className="kpi">
          <Statistic title="💰 收益记录数" value={income.length} />
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
          <Statistic title="📄 佐证文档" value={income.filter((m) => m.docUrl).length} />
          <div className="kpi-trend">含飞书文档链接</div>
        </div>
      </div>
      <Card title="本域消费收益明细">
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          同步展示消费方录入的场景、收益说明与佐证文档；一条记录可关联多个标签。
        </Typography.Text>
        <Table dataSource={income} columns={incomeColumns} rowKey={(r, i) => i} pagination={false} />
      </Card>
    </>
  )

  return (
    <>
      <div className="page-head"><div className="page-title">供给方工作台</div></div>
      <Tabs
        items={[
          { key: 'status', label: '📋 本域申请状态', children: statusView },
          { key: 'harvest', label: '💰 效果回收', children: harvestView },
        ]}
      />
    </>
  )
}
