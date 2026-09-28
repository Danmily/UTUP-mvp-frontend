import { useState, useMemo, useRef } from 'react'
import {
  Button, Card, Input, Select, Table, Form, Checkbox, Alert, Tag, Space, Typography, message,
} from '@ecom/aurora'
import { TAGS, SCENES, METRICS, METRIC_UNITS, DIRECTIONS, incomeText } from '../data.js'
import { LevelChip, DocCell } from '../mvp-ui.jsx'

function timeStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* 收益指标展示：提升为绿、下降为红，带方向箭头 */
export function IncomeValue({ record }) {
  const down = record.direction === '下降'
  if (!record.metric) return <span>{record.income || '—'}</span>
  return (
    <span className="income-val" style={{ color: down ? 'var(--err)' : 'var(--ok)' }}>
      {record.metric} {down ? '↓' : '↑'} {record.value}{record.unit}
    </span>
  )
}

export default function Income({ income, addIncome, pushAudit, myapply = [] }) {
  /* E-05：只列已申请过的标签，并带出该标签最近一次申请填的消费场景，减少事后回忆 */
  const applied = useMemo(() => {
    const latest = new Map()
    myapply.forEach((a) => {
      const prev = latest.get(a.tagId)
      if (!prev || a.at > prev.at) latest.set(a.tagId, a)
    })
    return [...latest.values()]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((a) => ({ apply: a, tag: TAGS.find((t) => t.id === a.tagId) }))
      .filter((x) => x.tag)
  }, [myapply])

  const [selected, setSelected] = useState([])
  const [scene, setScene] = useState('')
  const [metric, setMetric] = useState('')
  const [direction, setDirection] = useState('提升')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('%')
  const [note, setNote] = useState('')
  const [err, setErr] = useState({})
  const [doc, setDoc] = useState(null)
  const [link, setLink] = useState('')
  const fileRef = useRef(null)

  function toggleAsset(item) {
    const name = item.tag.name
    setSelected((list) => {
      const next = list.includes(name) ? list.filter((x) => x !== name) : [...list, name]
      // 勾选第一个标签时，自动带出它申请时填的消费场景
      if (!list.includes(name) && !scene) setScene(item.apply.scene)
      return next
    })
    setErr((e) => ({ ...e, assets: '' }))
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0]
    if (f) {
      setDoc({ name: f.name, url: '' })
      setLink('')
      setErr((x) => ({ ...x, doc: '' }))
    }
  }

  function onLink(val) {
    setLink(val)
    const v = val.trim()
    if (v) {
      setDoc({ name: v.split('/').pop() || '飞书文档', url: v })
      setErr((x) => ({ ...x, doc: '' }))
    } else {
      if (fileRef.current) fileRef.current.value = ''
      setDoc(null)
    }
  }

  function reset() {
    setSelected([])
    setScene('')
    setMetric('')
    setDirection('提升')
    setValue('')
    setUnit('%')
    setNote('')
    setErr({})
    setDoc(null)
    setLink('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function save() {
    const next = {}
    if (!selected.length) next.assets = '请至少选择 1 个数据资产'
    if (!scene) next.scene = '请选择消费场景'
    if (!metric) next.metric = '请选择收益指标'
    if (!String(value).trim()) next.value = '请填写数值'
    else if (Number.isNaN(Number(value))) next.value = '数值只能填数字'
    if (!doc) next.doc = '请上传或粘贴 1 份飞书文档作为佐证'
    setErr(next)
    if (Object.keys(next).length) {
      message.warning('请补齐必填项')
      return
    }
    addIncome({
      assets: selected,
      scene,
      metric,
      direction,
      value: String(value).trim(),
      unit,
      note: note.trim(),
      doc: doc.name,
      docUrl: doc.url,
      by: 'user',
      at: timeStamp(),
    })
    pushAudit(`录入消费收益：${selected.join('、')} · ${scene} · ${metric}${direction === '下降' ? '-' : '+'}${value}${unit}`)
    message.success('收益录入已保存，供给方可同步查看')
    reset()
  }

  const columns = [
    {
      title: '收益',
      key: 'income',
      width: 150,
      render: (v, r) => (
        <span>
          <IncomeValue record={r} />
          {r.note && <span className="row-sub">{r.note}</span>}
        </span>
      ),
    },
    {
      title: '数据资产',
      dataIndex: 'assets',
      render: (v, r) => (
        <span>{(v || [r.tag]).map((a) => <Tag key={a} style={{ margin: 2 }}>{a}</Tag>)}</span>
      ),
    },
    { title: '场景', dataIndex: 'scene' },
    { title: '佐证飞书文档', dataIndex: 'doc', render: (v, r) => <DocCell record={r} /> },
    {
      title: '录入时间',
      dataIndex: 'at',
      render: (v) => <Typography.Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Typography.Text>,
    },
  ]

  return (
    <>
      <div className="page-head"><div className="page-title">消费与收益录入</div></div>
      <Card title="新增收益录入">
        <Form layout="vertical">
          <Form.Item label={<span><span className="req-star">*</span>数据资产（来自你的申请记录，可多选）</span>}>
            {applied.length === 0 ? (
              <Alert type="info" showIcon message="你还没有申请记录。先到标签广场申请标签，这里会自动带出可录入的资产。" />
            ) : (
              <div className="asset-picker">
                {applied.map((item) => {
                  const on = selected.includes(item.tag.name)
                  return (
                    <div
                      key={item.tag.id}
                      className={`asset-chk${on ? ' on' : ''}`}
                      onClick={() => toggleAsset(item)}
                    >
                      <Checkbox checked={on} onChange={() => {}}>
                        <span className="asset-chk-name">{item.tag.name}</span>
                      </Checkbox>
                      <LevelChip level={item.tag.level} />
                    </div>
                  )
                })}
              </div>
            )}
            {err.assets && <div className="field-err">{err.assets}</div>}
          </Form.Item>
          <div className="form-grid-2">
            <Form.Item label={<span><span className="req-star">*</span>消费场景</span>}>
              <Select
                value={scene || undefined}
                placeholder="勾选资产后自动带出，可修改"
                onChange={(v) => { setScene(v || ''); setErr((e) => ({ ...e, scene: '' })) }}
                options={SCENES.map((s) => ({ label: s, value: s }))}
              />
              {err.scene && <div className="field-err">{err.scene}</div>}
            </Form.Item>
            <Form.Item label={<span><span className="req-star">*</span>收益指标</span>}>
              {/* E-01：结构化填写，避免各人写法不一导致无法汇总 */}
              <div className="metric-row">
                <Select
                  style={{ flex: '1 1 120px' }}
                  value={metric || undefined}
                  placeholder="指标"
                  onChange={(v) => { setMetric(v || ''); setErr((e) => ({ ...e, metric: '' })) }}
                  options={METRICS.map((m) => ({ label: m, value: m }))}
                />
                <Select
                  style={{ flex: '0 0 92px' }}
                  value={direction}
                  onChange={(v) => setDirection(v || '提升')}
                  options={DIRECTIONS.map((m) => ({ label: m, value: m }))}
                />
                <Input
                  style={{ flex: '1 1 90px' }}
                  placeholder="数值"
                  value={value}
                  onChange={(v) => { setValue(v); setErr((e) => ({ ...e, value: '' })) }}
                />
                <Select
                  style={{ flex: '0 0 84px' }}
                  value={unit}
                  onChange={(v) => setUnit(v || '%')}
                  options={METRIC_UNITS.map((m) => ({ label: m, value: m }))}
                />
              </div>
              {(err.metric || err.value) && <div className="field-err">{err.metric || err.value}</div>}
            </Form.Item>
          </div>
          <Form.Item label="补充说明（选填）">
            <Input
              placeholder="如：618 大促期间，对比同期自然流量"
              value={note}
              onChange={(v) => setNote(v)}
            />
          </Form.Item>
          <Form.Item label={<span><span className="req-star">*</span>佐证飞书文档（仅可上传 1 份）</span>}>
            <input
              type="file"
              ref={fileRef}
              accept=".doc,.docx,.pdf"
              style={{ display: 'none' }}
              onChange={onFile}
            />
            <Space wrap>
              <Button icon="📎" onClick={() => fileRef.current?.click()}>选择飞书文档</Button>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {doc ? '已选择：' + doc.name : '未选择文档'}
              </Typography.Text>
            </Space>
            <div style={{ height: 8 }} />
            <Input
              placeholder="或粘贴飞书文档链接：https://bytedance.larkoffice.com/docx/..."
              value={link}
              onChange={onLink}
            />
            {err.doc && <div className="field-err">{err.doc}</div>}
          </Form.Item>
          <Space>
            <Button type="primary" onClick={save}>保存录入</Button>
            <Button onClick={reset}>重置</Button>
          </Space>
        </Form>
      </Card>
      <div style={{ height: 14 }} />
      <Card title="我的收益录入记录">
        <Table dataSource={income} columns={columns} rowKey={(r, i) => i} pagination={false} />
      </Card>
    </>
  )
}
