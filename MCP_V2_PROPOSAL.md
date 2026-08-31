# AInvest MCP v2 改版方案

> 版本：方案稿，2026-08-31
> 口径：`当前` 来自 AInvest 官方文档、线上 MCP 协议实测和仓库内两项 skill；`建议` 尚未上线，不代表现网能力。

## 一句话结论

现网 MCP（一期）只直接覆盖官方 OpenAPI 的 **10/24（41.7%）**，另有 1 个派生工具。二期不再把一期的 `docsmcp → OpenAPI` 链路当作数据上游：外部 AI 仍通过 OAuth/PAT 访问 Hosted MCP，但 MCP 服务端直接复用 quote skill 的 **B 端调用协议**，按 endpoint family 选择 `index-api` 或 `quoteag` 应用密钥，并统一添加 `X-Auth-ProgId: 7080`。B 端私网地址和 `apikey` 只存在于服务端。官方 24 项仍作为能力合同与迁移清单；没有已批准 B 端等价路由的操作，不得伪装成已迁移。

## 1. 当前事实

| 能力 | 当前证据 | 结论 |
| --- | --- | --- |
| 官方 REST | 官方 OpenAPI 规格共 **24 个 GET**；文档导航只展示 23 个，`GET /securities/stock/profile` 仅出现在 Securities YAML | 规格、导航和聚合入口不一致 |
| 线上 MCP | `ainvest-mcp-server` v1.0.0，`tools/list` 返回 **11 个工具** | 其中 10 个直接对应 REST，1 个 `get-analyst-ratings-firms` 为派生工具 |
| 直接覆盖率 | 10 / 24 = **41.7%** | 尚缺 14 个官方操作 |
| 内部 marketcode skill | 可解析证券/行业；可枚举股票、ETF、债券、指数、加密现货、期货/永续和 1—4 级行业成分；当前数据源不含期权代码，实测为 0 | 应作为统一 instrument resolver；期权需另接可靠 resolver，不能把 quote 层“支持期权”误写成目录已覆盖 |
| 内部 quote skill | 已封装 5 类 B 端端点：`snapshot`、`series`、`relation_list`、`multi_kline`、`single_tick` | 二期直接复用其 POST body、B 端 APISIX 路由与请求头规则；内部认证不向外暴露 |
| 内部场景 | **36/36** 请求模板通过本地校验 | 36 是场景模板，不是 36 个独立 API，不应变成 36 个 MCP 工具 |
| 指标目录 | 本地元数据 **1,537 行**：snapshot 1,125、series 412 | 当前是约 82 天前的快照；只能称“本地快照”，需建立自动刷新后才能称实时目录 |
| 基础行情原始协议 | 13 个端点：2 个已封装、8 个被内部文档标为 active 但尚未完成运行/授权验证、3 个文档明确不可用 | 8 个候选端点需逐个做授权、稳定性和字段审查；不可用端点不得伪装上线 |

### 线上 MCP 协议实测问题

1. **目录与鉴权边界不清。** 无 `Authorization` 也能完成 `initialize` 和 `tools/list`。若工具目录属于授权后能力，应在初始化或目录层强制鉴权；若允许公开，文档必须明确，并且目录不能泄露租户专属能力。
2. **幂等标注错误。** 11 个工具均标为 `readOnlyHint=true`，却同时标为 `idempotentHint=false`；当前 GET/查询型工具应为 `true`。
3. **没有结构化输出契约。** 11/11 工具均无 `outputSchema`，结果把 JSON 字符串放在 `content[].text`；AI 难以校验字段或稳定编排下一步。
4. **未授权错误不一致。** Analyst 把上游 4011 当普通文本且不设 `isError`；Search/Calendar 返回空数组，无法区分“无数据”和“无权限”；OAuth 两个 `.well-known` 发现地址均为 405。
5. **参数被 MCP 丢失或改义。** `get-marketdata-candles` 缺少 REST 的 `session`、`adjustment`，把 REST 可默认的 `to` 改成必填，且 `interval` 没有枚举约束。
6. **新闻工具存在真实路由漂移。** `get-news-headlines` 未暴露 REST 的 `tab`、`start_id`，并把行业限制为固定 14 项；现网实测还请求了错误路径 `/news/v1/wire/page`，返回 404，官方路径是 `/news/v1/wire/page/history`。
7. **约束没有完整下沉。** Ownership 工具缺少 REST 中的默认值和最小值约束，容易把参数错误推给上游。
8. **版本治理不足。** 线上 server 只报 `1.0.0`；官方 changelog 最后列出的更新为 2025-10，且当时新闻内容接口从 `seo_key` 切换为 `content_id`。缺少可机器校验的版本、弃用和迁移规则。
9. **文档入口不完整。** 当前 MCP 文档主要给出 Claude Code/Desktop 的手工 Bearer 配置；`/api-reference/openapi.json` 聚合入口和错拼的 `analysts-ratings.yaml` 均返回 404，无法可靠生成 SDK、目录和覆盖率报告。

## 2. 现在最需要改什么

| 当前问题 | 怎么改 | 结果 |
| --- | --- | --- |
| 24 个官方操作只覆盖 10 个 | 从分组 OpenAPI 生成 `operation manifest`，并给每项标注 `b_side_mapped / legacy_compat / blocked` | 先获得 24/24 可核验迁移状态；只有 B 端映射通过门禁才标为 v2 可调用 |
| MCP schema 手写，参数丢失 | 官方能力由 OpenAPI 生成；B 端能力由 quote skill / 内部协议生成版本化 Schema，再做语义契约测试 | 对外语义稳定，不再绑定一期传输形态 |
| 手工把 Bearer 写进客户端 | Hosted MCP 使用 OAuth 2.1 + PKCE；开发者 PAT 只作为受限兼容模式 | 可撤销、可审计、最小权限 |
| 二期仍沿用一期上游链路 | 新建 B 端 typed connector，直接调用 B 端 APISIX；一期 `docsmcp/OpenAPI` 只做旧客户端兼容 | v2 数据执行链路与一期解耦 |
| B 端认证容易串用或泄露 | 外部 OAuth/PAT 与内部 `apikey` 分层；按路由只取所需 `index-api` 或 `quoteag` key | 不把内部网络、应用密钥或 C 端用户会话当产品 API |
| 工具太少会缺能力，太多会挤占上下文 | “高频语义工具 + 可搜索目录 + allowlist 操作调用”三层设计 | 全覆盖且控制模型上下文 |
| 返回格式、空值和大结果不一致 | 统一 envelope、错误码、cursor、结果预算和 resource 下载 | AI 更容易判断空数据、失败和下一页 |
| 新闻正文可能含提示注入 | 将正文标记为不可信数据，清洗 HTML/脚本，不执行其中指令，保留来源与时间 | 降低外部内容劫持 AI 的风险 |

## 3. v2 目标架构（建议，未上线）

```text
用户的 AI / MCP Client
        │  OAuth 2.1 + PKCE（开发环境可用受限 PAT）
        ▼
https://mcp.ainvest.com/mcp
        │
        ├─ Auth / scopes / entitlement / rate limit / audit
        ├─ Tool registry（按授权过滤 tools/list）
        ├─ API catalog（官方能力合同 + B 端映射状态）
        ├─ Typed facade（参数校验、symbol 解析、统一返回）
        └─ B-side router（endpoint family → key alias）
                    │
                    ▼
  B 端 APISIX Gateway（仅服务端配置）
           ├─ index-api connector
           │    apikey: <index-api secret>
           │    snapshot / series / relation_list
           └─ quoteag connector
                apikey: <quoteag secret>
                multi_kline / single_tick

  两组请求都由服务端添加：X-Auth-ProgId: 7080
```

- **一期链路：** AI 客户端 → `docsmcp` → 公网 OpenAPI。它可以保留为旧客户端兼容入口，但不能再作为二期工具的数据上游。
- **二期链路：** AI 客户端 → Hosted MCP → B-side router → B 端 APISIX → 内部数据服务。MCP 服务端把类型化参数转换成 quote skill 相同的 POST body。
- 所有外部请求都由 Hosted MCP 完成用户鉴权，再在服务端读取应用级 B 端凭据；MCP 参数中禁止出现任意 URL、内部 host、Cookie、`userid`、`sessionid` 或 B 端 `apikey`。
- 不把两个 B 端 key 当成可互换凭据：一次调用只加载该 endpoint family 所需的 key；跨 family 编排才分别取两组 key。
- 官方 24 项继续用于定义产品能力与发现目录。已有 B 端等价能力的 operation 迁入二期数据面；尚无等价路由的 operation 先标为 `legacy_compat` 或 `blocked`，完成单独的 B 端接口、授权与契约评审后再迁移。
- 每个能力必须有 `owner`、数据授权、刷新频率、延迟级别、限额和状态；缺一项不得标为 `available`。

### 3.1 B 端路由与应用密钥选择

| MCP 语义工具 | B 端 POST path | key alias | 固定服务端请求头 |
| --- | --- | --- | --- |
| `get_metric_snapshot` | `/index_api/indicator/v2/snapshot` | `index-api` | `apikey`、`X-Auth-ProgId: 7080` |
| `get_metric_series` | `/index_api/indicator/v2/series` | `index-api` | `apikey`、`X-Auth-ProgId: 7080` |
| `list_relations` | `/index_api/relation/v1/list` | `index-api` | `apikey`、`X-Auth-ProgId: 7080` |
| `get_bars` | `/quote/v2/multi_kline` | `quoteag` | `apikey`、`X-Auth-ProgId: 7080` |
| `get_trades` | `/quote/v2/single_tick` | `quoteag` | `apikey`、`X-Auth-ProgId: 7080` |

默认同时发送 `Content-Type: application/json` 与 `Accept-Language: en`。路由表和 key alias 是服务端配置，不进入对外 JSON Schema。

按当前已确认的等价关系，官方 24 项中只有 `getCandles → multiKline`、`getTrades → singleTick`、`getEtfHoldings → relationList` 可标为 `b_side_mapped`；8 项一期已有覆盖但尚无 B 端等价路由，标为 `legacy_compat`；其余 13 项标为 `blocked`。`legacy_compat` 只表示旧客户端可继续使用一期入口，不会进入 v2 `tools/list` 或成为 v2 上游。

## 4. 工具与目录策略

### 4.1 二期首发工具面

二期 `tools/list` 只发布已经获得 B 端映射的执行工具，以及不调用一期上游的本地目录/解析工具：

- B 端执行工具：`get_bars`、`get_trades`、`get_metric_snapshot`、`get_metric_series`、`list_relations`。
- 本地解析与目录：`resolve_instrument`、`list_instruments`、`list_industries`、`list_industry_components`、`search_metrics`、`describe_metric`、`search_api_catalog`。
- 受控路由：`call_api_operation`，但只接受 manifest 中 `b_side_mapped` 的 operation id。

`get_instrument_profile`、`get_financials`、`get_calendar_events`、`get_news`、`get_news_content`、`get_ownership`、`get_analyst_ratings`、`get_quotes`、`get_fund_flow`、`rank_instruments` 等仍可保留为产品候选名，但在获得 B 端等价路由、所属应用 key、授权和契约前，不进入 v2 `tools/list`。一期已存在同名或近似能力不能自动视为二期可调用。

### 4.2 全能力兜底

- `search_api_catalog(query, scope, status)`：按自然语言、资产、字段或 operation 搜索当前可用能力。
- `call_api_operation(operation_id, params)`：只接受目录中状态为 `b_side_mapped` 的 allowlist `operation_id`，参数按对应 schema 校验，并同时要求 `catalog.read`、目标 operation 的域 scope 与数据 entitlement；`legacy_compat` 与 `blocked` 一律拒绝执行，且**不接受**任意 URL、method、headers 或 raw body。
- `tools/list` 在登录后按 scopes 和数据 entitlement 过滤；大而低频的操作只通过目录发现，避免一次性把全部 schema 塞给模型。
- 36 个内部模板作为目录示例和契约测试夹具；不注册为 36 个工具。

这套设计保证：官方 24 项全部有可核验迁移状态，已批准的 B 端 operation 可调用，同时不牺牲常用工具的可发现性。目录完整不等于底层路由已经迁移；`legacy_compat` 与 `blocked` 必须在发现结果中明确显示。

## 5. 认证、授权与安全

建议 scopes：

| Scope | 能力 |
| --- | --- |
| `securities.read` | 证券搜索、Profile、财务、ETF |
| `calendar.read` | 财报、分红、经济、IPO、公司行动日历 |
| `marketdata.read` | K 线、逐笔与已批准基础行情 |
| `news.read` | 新闻列表与正文 |
| `ownership.read` | Insider、Congress |
| `ratings.read` | 分析师评级与历史 |
| `advanced_quote.read` | snapshot、series、relations、内部指标 |
| `catalog.read` | API、指标、标的和行业目录 |

这些 scope 是稳定的权限命名空间，不代表对应候选工具已经上线；只有 `b_side_mapped` operation 才能被执行。

安全规则：

- Hosted MCP：OAuth 2.1、PKCE、短期 access token、refresh token 轮换、按租户撤销。
- 外部 PAT：仅用于开发兼容，可设 scopes、IP/域名、配额和到期时间；不提供全能永久 token。
- B 端 `apikey`：仅存放在服务端 secret store；`index-api` 与 `quoteag` 分开授权、轮换和审计，不接受客户端传入或覆盖。
- B 端请求：固定添加 `X-Auth-ProgId: 7080`；禁止回退到 C 端 Cookie，也禁止让 v2 connector 代理一期 `docsmcp/OpenAPI`。
- Token、Cookie 和内部 key 全程脱敏；日志只保存 `request_id`、租户、operation、耗时、结果规模和错误码。
- 新闻与第三方正文是 `untrusted_content`；清洗可执行内容，禁止把正文内文本当系统/工具指令。
- 数据 entitlement 与 OAuth scope 分开判断：有 `marketdata.read` 不代表自动获得所有实时交易所数据。

## 6. 统一返回、错误与分页

建议成功返回：

```json
{
  "data": {},
  "meta": {
    "request_id": "req_...",
    "operations": ["multiKline"],
    "source_operation": "bside.quoteag.multi_kline",
    "as_of": "2026-08-31T10:00:00Z",
    "timezone": "America/New_York",
    "currency": "USD",
    "delayed": false,
    "catalog_version": "2026-08-31",
    "next_cursor": null
  },
  "warnings": [],
  "error": null
}
```

建议错误返回：

```json
{
  "data": null,
  "meta": {
    "request_id": "req_...",
    "operations": ["multiKline"]
  },
  "warnings": [],
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "interval is not supported",
    "retryable": false,
    "field_errors": [{ "field": "interval", "reason": "enum" }]
  }
}
```

- 统一错误码：`INVALID_ARGUMENT`、`UNAUTHENTICATED`、`PERMISSION_DENIED`、`NOT_ENTITLED`、`NOT_FOUND`、`RATE_LIMITED`、`UPSTREAM_UNAVAILABLE`、`PAYLOAD_TOO_LARGE`、`STALE_CATALOG`。
- 空数组、null 指标或无交易数据是成功结果，不自动变成错误；通过 `warnings` 解释。
- 列表统一 cursor；同时保留底层 limit 上限。`multi_kline` 继续执行最多 16 个 symbol、最多 2,000 行等已知约束。
- 超过 MCP 结果预算时返回摘要和 `ainvest://result/{request_id}` resource URI；不得截断 JSON 后假装完整。
- 百分比、价格、币种和时区保留原始值，并在元数据写明 unit/scale，避免客户端猜测。

## 7. 分阶段实施

### P0：建立二期 B 端数据面

1. 建立 24 个官方 operation 的机器清单，并为每项标注 `b_side_mapped / legacy_compat / blocked`；不能把目录条目直接等同于已迁移能力。
2. 实现 B-side connector、secret store 与 endpoint-family key router；`index-api` 管 3 条指标/关系路由，`quoteag` 管 2 条行情路由。
3. 固化 POST body schema、`apikey` 注入、`X-Auth-ProgId: 7080`、超时、重试、脱敏日志与统一错误映射。
4. 上线 OAuth 2.1、scope、entitlement、统一 envelope、cursor、request id 和来源元数据。
5. 对 5 条现成 B 端路由建立 contract tests，并验证二期调用不经过一期 `docsmcp/OpenAPI` 上游。

### P1：迁移已封装能力并开放给外部 AI

1. 把 marketcode resolver 和 5 类 quote endpoint 全部接入 B 端 typed facade。
2. 按 3 条 `index-api`、2 条 `quoteag` 的固定映射做真实集成、权限与故障隔离测试。
3. 将 1,537 行指标快照改成带 `generated_at/source/status` 的自动刷新目录；过期时明确返回 stale。
4. 将 36 个模板用于 schema 示例、回归和 B 端 smoke test，不再以一期 OpenAPI 作为这些工具的执行上游。
5. 提供 client-neutral MCP 配置；客户端只配置 Hosted MCP 与 OAuth/PAT，不配置 B 端 host 或 key。

### P2：验证并开放其余合格内部基础行情

1. 对 8 个“内部文档标为 active、尚未包装”的候选端点逐个完成运行验证、owner、数据授权、SLO、字段字典、限额和压测审查。
2. 审查通过后加入 B 端 typed facade，并为每个新路由明确所属应用与 key alias；目标是 10/10 候选基础行情端点通过门禁后可调用（含已封装的 2 个）。
3. 3 个文档明确不可用端点只在目录中标为 `not_available`，说明替代能力；重新上线必须走新一轮协议和授权评审。
4. 加入缓存、批量任务、资源下载、用量看板和弃用通知。

## 8. 验收门禁

- **官方迁移状态：** manifest 覆盖 24/24，且当前为 3 项 `b_side_mapped`、8 项 `legacy_compat`、13 项 `blocked`；只有存在已批准 B 端路由的项目才能标为 `b_side_mapped`。
- **协议正确：** 所有只读查询工具（包括 POST-backed B 端查询）均为 `readOnlyHint=true`、`idempotentHint=true`；JSON Schema、错误码和分页契约测试通过。
- **B 端路由：** 5 类 skill endpoint 均由二期 connector 直连 B 端；3 条 `index-api` 与 2 条 `quoteag` 映射逐项通过 contract test，且只读取实际所需 key。
- **链路隔离：** 二期 5 类 endpoint 的追踪记录中没有一期 `docsmcp/OpenAPI` hop，也没有 C 端 Cookie 回退。
- **内部覆盖：** 5 类 skill endpoint 均有公网 typed facade；36/36 模板通过 schema 回归与 B 端 smoke test。
- **基础行情：** 13 个端点均有明确状态；10 个候选端点全部通过运行、授权与契约门禁，或给出带 owner/原因/日期的发布阻断；3 个不可用端点不能被调用。
- **目录新鲜度：** 指标目录展示 `generated_at`；超出约定刷新窗口自动标 stale，禁止把旧快照描述为当前数据。
- **安全：** 外部 schema、日志、示例和返回中扫描不到 B-side host、内部 `apikey`、C-side Cookie、`userid`、`sessionid`；新闻提示注入测试通过。
- **权限：** 每个 operation 至少绑定一个 scope 和一个 entitlement 策略；越权返回 `PERMISSION_DENIED` 或 `NOT_ENTITLED`。
- **兼容：** 现有 `docsmcp` 客户端完成回归，但其兼容链路不会成为 v2 上游；至少一个 OAuth 客户端和一个受限 PAT 客户端端到端成功。
- **可观测：** 每次调用有 request id、operation、来源、数据时间、耗时、结果规模和可重试标记。

## 附录 A：官方 OpenAPI 24 个 GET 与现网 MCP 状态

| # | Group | Official operation/path | 当前 MCP 状态 |
| ---: | --- | --- | --- |
| 1 | Securities | `GET /securities/search` | 已直接映射：`securities-search` |
| 2 | Securities | `GET /securities/stock/profile` | **缺失**；且未出现在文档导航 |
| 3 | Securities | `GET /securities/stock/financials` | **缺失** |
| 4 | Securities | `GET /securities/stock/financials/statements` | **缺失** |
| 5 | Securities | `GET /securities/stock/financials/earnings` | **缺失** |
| 6 | Securities | `GET /securities/stock/financials/dividends` | **缺失** |
| 7 | Securities | `GET /securities/etf/profile` | **缺失** |
| 8 | Securities | `GET /securities/etf/holdings` | **缺失** |
| 9 | Calendar | `GET /calendar/earnings` | 已直接映射：`get-calendar-earnings` |
| 10 | Calendar | `GET /calendar/earnings/backtesting` | **缺失** |
| 11 | Calendar | `GET /calendar/dividends` | 已直接映射：`get-calendar-dividends` |
| 12 | Calendar | `GET /calendar/economics` | **缺失** |
| 13 | Calendar | `GET /calendar/ipo` | **缺失** |
| 14 | Calendar | `GET /calendar/corporateactions` | **缺失** |
| 15 | Market Data | `GET /marketdata/candles` | 已直接映射：`get-marketdata-candles`；schema 不完整 |
| 16 | Market Data | `GET /marketdata/trades` | 已直接映射：`get-marketdata-trades` |
| 17 | News | `GET /news/v1/wire/page/history` | 已直接映射：`get-news-headlines`；schema 不完整 |
| 18 | News | `GET /news/v1/wire/info/{content_id}` | **缺失** |
| 19 | News | `GET /news/v1/article/page/history` | **缺失** |
| 20 | News | `GET /news/v1/article/info/{content_id}` | **缺失** |
| 21 | Ownership | `GET /ownership/insider` | 已直接映射：`get-ownership-insider`；约束不完整 |
| 22 | Ownership | `GET /ownership/congress` | 已直接映射：`get-ownership-congress`；约束不完整 |
| 23 | Analyst Ratings | `GET /analysis-ratings/consensus` | 已直接映射：`get-analyst-ratings` |
| 24 | Analyst Ratings | `GET /analysis-ratings/history` | 已直接映射：`get-analyst-ratings-history` |

补充：`get-analyst-ratings-firms` 是现网第 11 个 MCP 工具，为派生能力，不对应独立官方 REST operation，因此不计入 10/24 直接覆盖率。

## 附录 B：内部基础行情 13 个端点状态

以下状态来自仓库内 `gms-http-v2.md` 与当前 quote skill。`文档 active` 只表示文档状态，不等于运行可用、授权合规或已获准对外销售。

| # | Internal path | 当前状态 | v2 处理 |
| ---: | --- | --- | --- |
| 1 | `POST /quote/v2/last_snapshot` | 文档 active；运行/授权待验证，未被当前 skill 封装 | 门禁通过后由 typed facade 开放 |
| 2 | `POST /quote/v2/last_calc` | 文档 active；运行/授权待验证，未封装 | 门禁通过后开放 |
| 3 | `POST /quote/v2/last_stats` | 文档 active；运行/授权待验证，未封装 | 门禁通过后开放 |
| 4 | `POST /quote/v2/real_fund_flow` | 文档 active；运行/授权待验证，未封装 | 验证 UUS 覆盖与授权后开放 |
| 5 | `POST /quote/v2/single_kline` | 文档 active；运行/授权待验证，未封装 | 门禁通过后开放；与 bars 语义统一 |
| 6 | `POST /quote/v2/multi_kline` | **当前 skill 已封装** | P1 由 `quoteag` connector 直连 B 端；保留 16 symbols/2,000 rows 限制 |
| 7 | `POST /quote/v2/single_days_kline` | 文档 active；运行/授权待验证，未封装 | 门禁通过后开放；与 bars 分页统一 |
| 8 | `POST /quote/v2/single_tick` | **当前 skill 已封装** | P1 由 `quoteag` connector 直连 B 端；保持单 symbol 约束 |
| 9 | `POST /quote/v2/single_trend` | 文档明确“暂不提供” | `not_available`；用分钟 `multi_kline` 替代 |
| 10 | `POST /quote/v2/code_status` | 文档 active；运行/授权待验证，未封装 | 门禁通过后开放 |
| 11 | `POST /quote/v2/trade_hours` | 文档明确“暂不支持” | `not_available` |
| 12 | `POST /quote/v2/code_info` | 文档删除线/不可用 | `not_available`；优先使用 marketcode/profile |
| 13 | `POST /quote/v2/sort` | 文档 active；运行/授权待验证，未封装 | 验证字段与配额后开放 |

## 附录 C：当前 skill 的其他内部能力

除上表已经包含的 `multi_kline`、`single_tick` 外，quote skill 还封装了 3 个内部端点：

| Internal path | 当前状态 | v2 处理 |
| --- | --- | --- |
| `POST /index_api/indicator/v2/snapshot` | skill 已封装；23 个模板场景 | `index-api` connector → `get_metric_snapshot` / allowlist operation |
| `POST /index_api/indicator/v2/series` | skill 已封装；4 个模板场景 | `index-api` connector → `get_metric_series` / allowlist operation |
| `POST /index_api/relation/v1/list` | skill 已封装；7 个模板场景 | `index-api` connector → `list_relations` / allowlist operation |

marketcode skill 不对应单一 HTTP endpoint；v2 应把其解析、枚举、行业层级和成分能力服务化。上述所有内部能力在服务端沿用 B 端调用方式，对外只暴露产品语义与公网契约，不能透传 B-side host/apikey 或 C-side Cookie。

## 证据来源

- AInvest 官方 [Quickstart](https://docs.ainvest.com/docs/quickstart) 与分组 OpenAPI 规格。
- AInvest 官方 MCP 文档及 `https://docsmcp.ainvest.com` 的 2026-08-31 协议实测。
- AInvest 官方 [`llms.txt`](https://docs.ainvest.com/llms.txt)；其中列出的聚合 OpenAPI 入口当前返回 404。
- 仓库内 `skills/ainvest-marketcode/SKILL.md`、`skills/ainvest-openapi-quote/SKILL.md`、请求模板、生成指标目录与 `references/gms-http-v2.md`。
