# 统一交易画像门户 (UTUP)

Unified Transaction User Profile Portal — 单文件 HTML 演示项目。

## 项目简介

面向字节跳动交易域的统一用户画像门户，覆盖：

- **画像集市**：6 大域 · 7,500+ 标签的统一目录，支持横向滚动富信息 KPI 卡片、智能场景包推荐、画像标签列表
- **用户画像查询**：五步动线（身份认证 → 输入 → 权限校验 → 分级脱敏渲染 → 审计落库）
- **能力接入中心**：Owner Center 双通道 A1-A8 接入流水线
- **权限治理**：分级申请审批流、标签订阅、有效期与续期
- **数据资产盘点**：ECharts 可视化的各域标签资产分级分布

## 技术栈

- 单文件 HTML + CSS + 原生 JS（无构建）
- ECharts 5（CDN 引入）
- ByteDance 前端设计规范：Arco / Semi Design 色板 + 玻璃拟态 + 微交互

## 本地预览

```bash
# 任选一种方式启动本地静态服务
python3 -m http.server 8000
# 或
npx serve .
```

打开 http://localhost:8000 即可访问。

## 部署

推荐使用 GitHub Pages / Vercel / Netlify 部署，均为零配置。
