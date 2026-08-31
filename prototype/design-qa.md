# AInvest MCP v2 改版原型 · QA

> 验收日期：2026-08-31
> 结论范围：静态方案原型与方案口径通过；不代表拟议 MCP 域名、OAuth 或新增 API 已上线。

## 验收基线

- 视觉基线：沿用旧原型的绿 / 蓝 / 白企业设计语言、Noto Sans SC 和 Phosphor 图标；本次重构信息架构，不做旧页面逐像素复刻。
- 核心用户任务：先看懂“现在的问题 / 怎么改”，再核对完整能力目录、目标工具面、权限、上线顺序和接入示意。
- 桌面视口：`1280 × 720`。
- 移动视口：`390 × 844`。
- 本地预览：`http://127.0.0.1:5173/`。

## 事实与覆盖检查

| 声明 | 验收结果 |
| --- | --- |
| 官方 OpenAPI 24 项 | `OFFICIAL_API_OPERATIONS.length === 24` |
| 现网直接映射 10 / 24 | 6 项 full + 4 项 partial；覆盖率 41.7% |
| 现网完全缺失 14 项 | 14 项 `currentMcp=missing` |
| 官方能力 v2 迁移状态 | 3 项 `b_side_mapped`、8 项 `legacy_compat`、13 项 `blocked` |
| 二期 B 端直连 | `B_SIDE_ROUTES.length === 5`；3 条 `index-api` + 2 条 `quoteag` |
| B 端固定传输 | `apikey` + `X-Auth-ProgId: 7080`；JSON body；具体私网 base 不进入前端 bundle |
| 内部数据候选 13 项 | 5 项 implemented + 8 项“文档 active、运行/授权待验证” |
| 不可用 / 废弃 3 项 | 单独目录展示，均无 targetTool，不可调用 |
| 内部场景模板 | `validate_templates.py`：36 / 36 通过 |
| 指标目录 | 明确写为 2026-06-09 本地快照；1,537 行、1,279 个唯一指标，不声称实时 |

已运行 Node 目录断言，验证 40 个目录条目 ID 唯一；官方 24 项与内部 13 项都有独立 v2 迁移状态。另验证 5 条 B 端路由 ID 唯一、endpoint family 与 key alias 固定对应，且只有 `b_side_mapped` 能进入 v2 执行面。

## 浏览器交互检查

- 首屏明确区分现网与 v2 目标；拟议地址显示 `status: proposed`。
- 架构区明确展示“一期兼容层 / 二期主数据面”，二期链路为 Hosted MCP → B 端路由器 → APISIX，不再经过一期 OpenAPI。
- B 端路由表完整展示 5 条 POST path、3 / 2 key 分组和 `X-Auth-ProgId: 7080`，并标明“仅服务端”。
- 目录搜索 `candles` 后显示 `1 / 24`，详情弹窗同时展示一期参数漂移与 v2 `b_side_mapped` 状态。
- 切换“内部数据候选”并选择“只看缺口”后显示 `8 / 13`；这些项不会进入 v2 `tools/list`。
- 官方 / 内部 / 不可用三个 tab 使用 `tablist/tab/tabpanel`、`aria-selected`、roving `tabIndex`，并支持方向键、Home 与 End。
- 详情弹窗支持可访问名称、Esc、关闭按钮、Tab / Shift+Tab 焦点循环、焦点返还和背景滚动锁。
- 客户端切换到 DeepSeek 后，function bridge 示例调用已映射的 `multiKline`，默认已选择所需 `catalog.read + marketdata.read`，不再调用阻塞的 `getStockProfile`。
- 复制配置后显示 live status；配置只包含外部 OAuth/PAT 结构，不含 B 端 key、Cookie、userid 或 sessionid。
- 桌面和移动端都无页面级横向溢出：`pageScrollWidth === clientWidth`。
- 最终浏览器 console：0 条 error / warn。

## 视觉检查

- 桌面首屏覆盖声明、主标题和行动按钮层级清楚；修复了“完整、安全”被拆成单字换行的问题。
- “现在 / 怎么改”卡片能并排比较，P0 / P1 优先级和证据行不抢主文案。
- 能力目录在桌面使用表格，在移动端改成完整卡片行；说明和目标工具未被隐藏。
- 工具面只展示 B 端已映射工具、本地 resolver/catalog 和受控 B 端 router；官方候选工具保留在目录但不进入 `tools/list`。
- 目标架构、统一返回、路线图和接入配置都有清晰的 current / proposed 边界。
- 390px 移动端顶栏、首屏、目录、客户端卡和筛选控件无遮挡。
- 图标全部来自同一 Phosphor 系列；没有 emoji、手工 SVG、CSS 假图或占位资产。
- 支持键盘 focus ring、skip link 与 `prefers-reduced-motion`。

## 构建与测试

- `npm run build`：通过；生成 `dist/client/index.html`、`dist/server/index.js` 和 `dist/.openai/hosting.json`。
- `npm run test:sites`：4 / 4 通过。
- API catalog 计数与唯一性断言：通过。
- B 端 transport / route / key-family 断言：通过。
- `skills/ainvest-openapi-quote/scripts/validate_templates.py`：36 / 36 通过。

## 已修复问题

- [P1] 首屏强调词在 1280px 下被拆成单字换行：为强调短语增加不可拆分规则。
- [P1] 官方 API 详情的 scope 曾由中文分组自动拼接成 `市场数据.read`：改为显式 group → OAuth scope 映射。
- [P1] 一期 `currentMcp` 曾被误用为二期可调用状态：已新增独立 `v2Migration` 并以其控制筛选、徽标和注册结果。
- [P1] 前端曾包含具体 B 端私网 base：现已从 bundle 移除，只显示抽象的“B 端 APISIX”。
- [P1] Function Bridge 曾示例调用阻塞的 `getStockProfile`：已改为 `b_side_mapped` 的 `multiKline`。
- [P2] 旧 QA 仍描述“10 个 MVP 工具”和旧接入向导：本文件已按 v2 方案完全重写。

## 仍属生产阻塞项

- 刷新并去重指标目录，修复 171 个双端点指标被压成单 endpoint 的生成逻辑。
- 为期权补独立 resolver；当前 marketcode 数据源的期权枚举为 0。
- 补齐 PyYAML 等依赖清单、live contract tests、交易所日历和确定性 catalog 生成。
- 完成数据许可、entitlement、OAuth、限流、SLO 和正式公网域名评审。
- 逐项验证 8 个 legacy active_unwrapped 接口；未通过门禁前只能标为“待验证”，不能宣称已对外上线。
- 为 8 个 `legacy_compat` 与 13 个 `blocked` 官方 operation 补齐获批 B 端等价路由；完成前不得进入二期执行面。

## 最终结论

`passed`：静态 v2 方案原型已改为 B 端直连决策，交互、响应式布局、5 条路由映射与 current / proposed 边界通过。生产 MCP 实现仍需按 P0–P2 路线图建设。
