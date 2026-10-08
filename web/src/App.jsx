import { useState, useCallback } from 'react'
import { Button, Tag, Menu, Breadcrumb, Modal } from '@ecom/aurora'
import {
  VIEWS, NAV, NAV_LABELS,
  INITIAL_MYAPPLY, INITIAL_INCOME, INITIAL_AUDIT, nowStamp, TAGS,
} from './data.js'
import { assetState, displayStatus, pendingKey, parsePending, mergePending, PENDING_MAX } from './flows/application-model.mjs'
import Login from './pages/Login.jsx'
import Market from './pages/Market.jsx'
import MyPerm from './pages/MyPerm.jsx'
import Income from './pages/Income.jsx'
import Workbench from './pages/Workbench.jsx'
import Audit from './pages/Audit.jsx'
import Placeholder from './pages/Placeholder.jsx'
import AssetIn from './pages/AssetIn.jsx'
import Audience from './pages/Audience.jsx'

/* 占位入口：灰色不可用态 + 「V1 规划中」弹窗（本期不真实开发） */
const SOON_MAP = {
  dualq: {
    icon: '📊',
    title: '双 QI 看板',
    tagline: '跨域质量指数（双 QI）看板',
    desc: 'V1 版本将纳入双 Q 业务达成情况与跨域数据质量监控：',
    points: [
      '双 Q 业务达成与目标追踪',
      '核心指标趋势（GMV / 订单 / 复购）',
      '渠道贡献与投放效果对比',
      '跨域数据质量指数（QI）监控',
    ],
  },
  llm: {
    icon: '🤖',
    title: 'LLM 侧写标签',
    tagline: '大模型语义化用户标签',
    desc: 'V1 版本将接入由大模型自动挖掘的语义化标签：',
    points: [
      'LLM 自动生成兴趣 / 意图 / 内容偏好标签',
      '侧写标签置信度与覆盖率展示',
      '受控 / 高敏侧写标签的申请与合规通道',
      '与标签广场检索 / 申请动线打通',
    ],
  },
}

export default function App() {
  const [viewKey, setViewKey] = useState(null)
  const [nav, setNav] = useState('market')
  const [audienceSeed, setAudienceSeed] = useState(null)
  const [fromAgent, setFromAgent] = useState(false) // 从圈人 Agent 带着缺权限标签来到标签广场
  const [myapply, setMyapply] = useState(INITIAL_MYAPPLY)
  const [income, setIncome] = useState(INITIAL_INCOME)
  const [audit, setAudit] = useState(INITIAL_AUDIT)
  const [soon, setSoon] = useState(null)
  const [newApply, setNewApply] = useState(false) // 申请成功后在「我的申请」菜单上打红点
  const [demo, setDemo] = useState('normal') // 演示态：normal | empty | fail，用于评审时查看兜底页面

  const pushAudit = useCallback((what, lvl) => {
    setAudit((list) => [
      { time: nowStamp(), who: 'user', what, lvl: lvl || '—', risk: '记录' },
      ...list,
    ].slice(0, 200))
  }, [])
  const addApply = useCallback((a) => { setMyapply((list) => [a, ...list]); setNewApply(true) }, [])
  const addIncome = useCallback((r) => setIncome((list) => [r, ...list]), [])

  function handleLogin(key) {
    const v = VIEWS[key]
    setViewKey(key)
    const requested = window.location.hash.slice(1)
    const permitted = NAV[v.role].flatMap(g => g.items).some(it => it.key === requested)
    setNav(permitted ? requested : NAV[v.role][0].items[0].key)
    pushAudit(`登录成功 · 视角=${v.name}`)
  }

  if (!viewKey) return <Login onLogin={handleLogin} />

  const view = VIEWS[viewKey]
  const menuItems = NAV[view.role].map((g) => ({
    type: 'group',
    label: g.group,
    children: g.items.map((it) => (
      it.soon
        ? {
            key: it.key,
            label: (
              <span className="soon-nav-label">
                {it.label}
                <Tag className="soon-nav-tag">占位</Tag>
              </span>
            ),
          }
        : {
            key: it.key,
            label: (
              <span className="nav-label">
                {it.label}
                {it.key === 'myperm' && newApply && <span className="nav-dot" aria-label="有新的申请" />}
              </span>
            ),
          }
    )),
  }))

  function onMenuSelect(item) {
    const found = NAV[view.role].flatMap((g) => g.items).find((it) => it.key === item.key)
    if (found && found.soon) {
      setSoon(SOON_MAP[item.key] || {
        title: item.key,
        tagline: 'V1 规划中',
        desc: 'V1 版本开放。',
        points: [],
      })
      pushAudit(`访问占位入口：${found.label}（V1 规划中）`)
      return
    }
    setAudienceSeed(null)
    setFromAgent(false)
    if (item.key === 'myperm') setNewApply(false)
    setNav(item.key)
  }

  /* 圈人 Agent ↔ 标签广场：Agent 按门户口径查标签状态，缺权限的标签进入同一个待选择清单 */
  const agentBridge = {
    tagState: (id) => {
      const tag = TAGS.find((t) => t.id === id)
      if (!tag) return null
      const st = assetState(view, tag, myapply)
      return { ...st, label: displayStatus(st).label }
    },
    applyTags: (ids) => {
      const key = pendingKey(view)
      const eligible = ids.filter((id) => { const tag = TAGS.find((t) => t.id === id); return tag && assetState(view, tag, myapply).selectable })
      try {
        const current = parsePending(localStorage.getItem(key), TAGS.map((t) => t.id))
        localStorage.setItem(key, JSON.stringify(mergePending(current, eligible).slice(0, PENDING_MAX)))
      } catch { /* 存储不可用时仍打开清单 */ }
      pushAudit(`圈人 Agent 带入待选择清单：${eligible.length} 个标签`)
      setFromAgent(true)
      setNav('market')
    },
  }

  function renderView() {
    switch (nav) {
      case 'audience':
      case 'audiences':
        return <Audience mode={nav} seed={audienceSeed} onPermission={() => { setAudienceSeed(null); setNav('myperm') }} onMarket={() => setNav('market')} portal={agentBridge} />
      case 'market':
        return <Market V={view} myapply={demo === 'empty' ? [] : myapply} addApply={addApply} pushAudit={pushAudit} demo={demo} setDemo={setDemo} goMyPerm={() => { setNewApply(false); setFromAgent(false); setNav('myperm') }} fromAgent={fromAgent} backToAgent={() => { setFromAgent(false); setNav('audience') }} />
      case 'myperm':
        return <MyPerm V={view} myapply={demo === 'empty' ? [] : myapply} addApply={addApply} pushAudit={pushAudit} demo={demo} setDemo={setDemo} goMarket={() => setNav('market')} />
      case 'income':
        return <Income V={view} income={demo === 'empty' ? [] : income} addIncome={addIncome} pushAudit={pushAudit} myapply={demo === 'empty' ? [] : myapply} demo={demo} />
      case 'workbench':
        return <Workbench V={view} income={demo === 'empty' ? [] : income} demo={demo} setDemo={setDemo} />
      case 'cfg':
        return <Placeholder kind="cfg" />
      case 'assetin':
        return <AssetIn V={view} pushAudit={pushAudit} />
      case 'audit':
        return <Audit audit={audit} />
      default:
        return <Market V={view} myapply={demo === 'empty' ? [] : myapply} addApply={addApply} pushAudit={pushAudit} demo={demo} setDemo={setDemo} goMyPerm={() => { setNewApply(false); setNav('myperm') }} />
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">UTUP · MVP</div>
        <div className="breadcrumb">
          <Breadcrumb items={[{ title: '统一交易画像门户' }, { title: NAV_LABELS[nav] || nav }]} />
        </div>
        <div className="topbar-right">
          {/* 演示态开关：便于评审时查看空数据与接口异常的兜底页面 */}
          <div className="demo-switch" role="group" aria-label="演示态" style={{ display: ['audience', 'audiences'].includes(nav) ? 'none' : undefined }}>
            {[['normal', '正常'], ['empty', '空数据'], ['fail', '接口异常']].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={demo === k ? 'on' : ''}
                aria-pressed={demo === k}
                onClick={() => setDemo(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <Tag color="primary">{view.name}</Tag>
          <div className="user-info">
            <div className="avatar">U</div>
            <div>
              <div style={{ fontSize: 12 }}>user</div>
              <div style={{ fontSize: 10, color: 'var(--mute)' }}>本域：{view.domain}</div>
            </div>
          </div>
          <Button type="text" danger size="small" onClick={() => setViewKey(null)}>退出</Button>
        </div>
      </div>
      <div className="sidebar">
        <Menu
          items={menuItems}
          selectedKeys={[nav]}
          onSelect={onMenuSelect}
          style={{ border: 'none', background: 'transparent' }}
        />
      </div>
      <div className="main">{renderView()}</div>
      {soon && (
        <Modal
          open
          width={520}
          title={<span>{soon.icon} {soon.title}</span>}
          onCancel={() => setSoon(null)}
          footer={<Button type="primary" onClick={() => setSoon(null)}>我知道了</Button>}
        >
          <div className="soon-modal">
            <div className="soon-modal-badge">V1 规划中 · 暂未开放</div>
            <div className="soon-modal-tagline">{soon.tagline}</div>
            <p className="soon-modal-desc">{soon.desc}</p>
            <ul className="soon-modal-list">
              {soon.points.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}
