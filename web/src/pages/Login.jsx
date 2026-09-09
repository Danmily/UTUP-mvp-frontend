import { useState } from 'react'
import { Button, Typography } from '@ecom/aurora'
import { VIEWS } from '../data.js'

export default function Login({ onLogin }) {
  const [viewKey, setViewKey] = useState('consumer')
  return (
    <div className="login">
      <div className="login-card">
        <h1>🛡️ 统一交易画像门户</h1>
        <p className="sub" style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 12 }}>请选择视角</p>
        <div className="role-grid">
          {Object.entries(VIEWS).map(([key, v]) => (
            <div
              key={key}
              className={`role-card${key === viewKey ? ' selected' : ''}`}
              onClick={() => setViewKey(key)}
            >
              <div className="role-icon">{v.icon}</div>
              <div className="role-name">{v.name}</div>
            </div>
          ))}
        </div>
        <Button
          type="primary"
          size="large"
          block
          className="login-btn"
          onClick={() => onLogin(viewKey)}
        >
          飞书 SSO 登录 →
        </Button>
        <Typography.Paragraph
          style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--mute)' }}
        >
          白名单账号 · 登录与操作全程审计留痕
        </Typography.Paragraph>
      </div>
    </div>
  )
}
