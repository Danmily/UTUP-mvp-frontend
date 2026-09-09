import { Card, Table } from '@ecom/aurora'
import { LevelChip, RiskTag } from '../mvp-ui.jsx'

export default function Audit({ audit }) {
  const columns = [
    {
      title: '时间',
      dataIndex: 'time',
      width: 170,
      render: (v) => (
        <span style={{ fontSize: 12, fontFamily: "'SF Mono',Menlo,Consolas,monospace", whiteSpace: 'nowrap' }}>
          {v}
        </span>
      ),
    },
    { title: '操作人（who）', dataIndex: 'who', width: 130 },
    { title: '动作（what）', dataIndex: 'what' },
    {
      title: '涉及分级',
      dataIndex: 'lvl',
      width: 130,
      render: (v) => (v === '—' ? <span style={{ color: 'var(--mute)' }}>—</span> : <LevelChip level={v} />),
    },
    {
      title: '风险',
      dataIndex: 'risk',
      width: 90,
      render: (v) => <RiskTag risk={v} />,
    },
  ]
  return (
    <>
      <div className="page-head"><div className="page-title">审计日志</div></div>
      <Card title="审计记录">
        <Table dataSource={audit} columns={columns} rowKey={(r, i) => i} pagination={{ pageSize: 12 }} />
      </Card>
    </>
  )
}
