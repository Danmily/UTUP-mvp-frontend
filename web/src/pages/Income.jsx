import { useState, useMemo, useRef } from 'react'
import {
  Button, Card, Input, Select, Table, Form, Checkbox, Tag, Space, Typography, message,
} from '@ecom/aurora'
import { TAGS } from '../data.js'
import { LevelChip, DocCell } from '../mvp-ui.jsx'

const SCENES = ['人群圈选', '用户360', '模型特征', '营销投放', '数据分析']

function timeStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Income({ income, addIncome, pushAudit }) {
  const assets = useMemo(() => TAGS.filter((t) => t.domain === '电商'), [])
  const [selected, setSelected] = useState([])
  const [scene, setScene] = useState('人群圈选')
  const [incomeText, setIncomeText] = useState('')
  const [doc, setDoc] = useState(null)
  const [link, setLink] = useState('')
  const fileRef = useRef(null)

  const toggleAsset = (name) =>
    setSelected((list) => (list.includes(name) ? list.filter((x) => x !== name) : [...list, name]))

  function onFile(e) {
    const f = e.target.files && e.target.files[0]
    if (f) {
      setDoc({ name: f.name, url: '' })
      setLink('')
    }
  }

  function onLink(val) {
    setLink(val)
    const v = val.trim()
    if (v) {
      setDoc({ name: v.split('/').pop() || '飞书文档', url: v })
    } else {
      if (fileRef.current) fileRef.current.value = ''
      setDoc(null)
    }
  }

  function reset() {
    setSelected([])
    setScene('人群圈选')
    setIncomeText('')
    setDoc(null)
    setLink('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function save() {
    if (!selected.length) {
      message.warning('请至少选择 1 个数据资产')
      return
    }
    if (!doc) {
      message.warning('请上传或粘贴 1 份飞书文档作为佐证')
      return
    }
    addIncome({
      assets: selected,
      scene,
      income: incomeText.trim() || '（未填写）',
      doc: doc.name,
      docUrl: doc.url,
      by: 'user',
      at: timeStamp(),
    })
    pushAudit(`录入消费收益：${selected.join('、')} · ${scene}`)
    message.success('收益录入已保存，供给方可同步查看')
    reset()
  }

  const columns = [
    {
      title: '数据资产',
      dataIndex: 'assets',
      render: (v, r) => (
        <span>{(v || [r.tag]).map((a) => <Tag key={a} style={{ margin: 2 }}>{a}</Tag>)}</span>
      ),
    },
    { title: '场景', dataIndex: 'scene' },
    { title: '收益说明', dataIndex: 'income' },
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
          <Form.Item label="数据资产（单选 / 多选）">
            <div className="asset-picker">
              {assets.map((g) => {
                const on = selected.includes(g.name)
                return (
                  <div
                    key={g.id}
                    className={`asset-chk${on ? ' on' : ''}`}
                    onClick={() => toggleAsset(g.name)}
                  >
                    <Checkbox checked={on} onChange={() => {}}>
                      <span className="asset-chk-name">{g.name}</span>
                    </Checkbox>
                    <LevelChip level={g.level} />
                  </div>
                )
              })}
            </div>
          </Form.Item>
          <div className="form-grid-2">
            <Form.Item label="消费场景">
              <Select
                value={scene}
                onChange={(v) => setScene(v)}
                options={SCENES.map((s) => ({ label: s, value: s }))}
              />
            </Form.Item>
            <Form.Item label="收益说明">
              <Input
                placeholder="如 ROI +12% / CTR +5.3%"
                value={incomeText}
                onChange={(v) => setIncomeText(v)}
              />
            </Form.Item>
          </div>
          <Form.Item label="佐证飞书文档（仅可上传 1 份）">
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
