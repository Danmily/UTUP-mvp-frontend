# 统一交易画像门户 · UTUP MVP Frontend

Unified Transaction User Profile Portal —— 面向交易域的统一标签 / 画像门户 MVP 前端。

> 当前交付物为 `web/` 下的 **React + Vite + @ecom/aurora** 工程，视觉与交互对齐线上 MVP 收敛版（3 视角 / 字节蓝 #3370FF / 玻璃拟态顶栏）。
> 仓库根目录的 `index.html`、`mvp.html` 为早期单文件 HTML 原型，仅作参考，不再维护。

## 技术栈

- React 18 + Vite 5
- 内部 UI 组件库 **@ecom/aurora**（Aurora Design 4.0，AntD 风格 API）
- ECharts（分级分布等可视化按需引入）
- 全部可见控件均使用 Aurora 组件（Layout / Menu / Breadcrumb / Button / Form / Card / Table / Tabs / Tag / Statistic / Modal / Steps / Select / Checkbox 等），页面样式文件只保留品牌骨架与 Design Token，不重写组件交互。

## 三个视角

| 视角 | 主要能力 |
| --- | --- |
| 消费方 | 标签广场（来源域 KPI / 四维筛选 / 详情脱敏）、申请智能助手（Doc 解析预填 + 分级审批路由）、我的申请 / 权限、消费与收益录入、审计日志 |
| 供给方 · Owner | 供给方工作台（本域申请状态 + 效果回收双 Tab）、配置中心、资产接入、审计日志 |
| 平台管理员 | 消费方 + 供给方全部入口、占位入口、审计日志 |

- **分级规范**：开放(L2) / 通用(L3-基础) / 受控(L3-高) / 高敏(L4)，跨来源域调用按「就高」升档。
- **审批路由**：人消费标签走 Triton、系统间调用(PSM) 走 DMP/LDMP；门户只做路由与预填，不落工单。
- **占位入口**：「双 QI 看板」「LLM 侧写标签」等 V1 规划能力在侧栏以**灰色占位 + 「占位」标签**呈现，点击弹出「V1 规划中 · 暂未开放」弹窗，不跳转、不真实开发。

## 快速开始

```bash
cd web
npm install

# 公网 / 本地预览（使用内置 aurora-fallback，外观与真实组件一致）
npm run dev

# 公司内网（已完成 bnpm SSO 登录）渲染真实 @ecom/aurora 组件
USE_REAL_AURORA=1 npm run dev:real

# 生产构建
npm run build
```

> `@ecom/aurora` 为字节内网包（源：`https://bnpm.bytedance.net`，需 SSO）。公网环境通过 Vite 别名透明切换到本地 `src/aurora-fallback/`，业务代码零改动；内网设置 `USE_REAL_AURORA=1` 即切回真实组件库。

## 目录结构

```
web/
├── index.html
├── vite.config.js          # 别名：@ecom/aurora → aurora-fallback（USE_REAL_AURORA=1 时切真实库）
├── package.json
└── src/
    ├── main.jsx            # 入口：ConfigProvider 注入品牌色 token，挂载 App
    ├── App.jsx             # 顶栏 / 分组侧栏 / 视角状态 / 占位 V1 弹窗 / 审计留痕
    ├── data.js             # 3 视角导航、标签目录、分级/跨域规则、可见性矩阵、初始数据
    ├── mvp-ui.jsx          # LevelChip / CrossBadge / StatusTag / RiskTag / DocCell
    ├── mvp.css             # 品牌骨架 + Design Token（不覆盖 Aurora 组件交互）
    ├── aurora-fallback/    # 公网兜底组件（与 @ecom/aurora 同名同 API）
    └── pages/
        ├── Login.jsx       # 3 视角选择 + 飞书 SSO
        ├── Market.jsx      # 标签广场 + 详情脱敏 + 申请智能助手
        ├── MyPerm.jsx      # 我的申请 / 权限
        ├── Income.jsx      # 消费与收益录入
        ├── Workbench.jsx   # 供给方工作台（申请状态 / 效果回收）
        ├── Audit.jsx       # 审计日志
        └── Placeholder.jsx # 配置中心 / 资产接入占位页
```

## 说明

- 数据为前端内置 mock（`src/data.js`），用于演示动线与权限矩阵；接入真实后端时替换数据层即可，页面与组件无需改动。
- 登录与所有操作均有审计留痕（审计日志页可查）。
