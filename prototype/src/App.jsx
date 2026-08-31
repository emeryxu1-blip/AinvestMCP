import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  Check,
  CheckCircle,
  Circle,
  Cloud,
  Code,
  Copy,
  Database,
  FileCode,
  Funnel,
  Globe,
  Info,
  Key,
  LockKey,
  MagnifyingGlass,
  PlugsConnected,
  Pulse,
  ShieldCheck,
  Stack,
  WarningCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";
import {
  B_SIDE_ROUTES,
  B_SIDE_TRANSPORT,
  IMPROVEMENT_CARDS,
  INTERNAL_ENDPOINTS,
  KEY_METRICS,
  OFFICIAL_API_OPERATIONS,
  ROADMAP,
  SCOPES,
  SEMANTIC_TOOLS,
  UNAVAILABLE_INTERNAL_ENDPOINTS,
} from "./apiCatalog.js";

const CLIENTS = [
  { id: "chatgpt", name: "ChatGPT", note: "目标：Remote MCP + OAuth", Icon: Globe },
  { id: "claude", name: "Claude", note: "现文档已覆盖", Icon: Cloud },
  { id: "developer", name: "Codex / Cursor / VS Code", note: "目标：统一 MCP 配置", Icon: Code },
  { id: "bridge", name: "DeepSeek / 通用 SDK", note: "目标：Function bridge", Icon: FileCode },
];

const DEFAULT_SCOPE_IDS = [
  "catalog.read",
  "marketdata.read",
  "advanced_quote.read",
  "securities.read",
];

const ARCHITECTURE = [
  {
    title: "用户自己的 AI",
    description: "ChatGPT、Claude、Codex、Cursor、VS Code、DeepSeek",
    Icon: Globe,
  },
  {
    title: "AInvest Hosted MCP",
    description: "对外 OAuth 2.1、scope、权益、配额与审计",
    Icon: ShieldCheck,
  },
  {
    title: "B 端路由器",
    description: "类型化 POST body；按 endpoint family 选择应用 key",
    Icon: Stack,
  },
  {
    title: "B 端 APISIX",
    description: "index-api / quoteag；服务端注入 apikey 与 ProgId",
    Icon: Database,
  },
];

const STATUS_META = {
  full: { label: "现网已覆盖", tone: "success" },
  partial: { label: "部分覆盖", tone: "warning" },
  missing: { label: "现网缺失", tone: "danger" },
  route_drift: { label: "路由漂移", tone: "danger" },
  implemented: { label: "skill 已封装", tone: "success" },
  verified: { label: "已验证", tone: "success" },
  active_unwrapped: { label: "文档 active · 待验证", tone: "warning" },
  unwrapped: { label: "文档 active · 待验证", tone: "warning" },
  legacy_unverified: { label: "文档存在·待验证", tone: "warning" },
  unavailable: { label: "不可调用", tone: "muted" },
  deprecated: { label: "已废弃", tone: "muted" },
  b_side_mapped: { label: "v2 · B 端已映射", tone: "success" },
  legacy_compat: { label: "一期兼容", tone: "warning" },
  blocked: { label: "v2 阻塞", tone: "danger" },
};

const GROUP_SCOPES = {
  "分析师评级": "ratings.read",
  "日历": "calendar.read",
  "市场数据": "marketdata.read",
  "新闻": "news.read",
  "持仓与交易": "ownership.read",
  "证券": "securities.read",
};

const SOURCE_LINKS = [
  ["Quickstart", "https://docs.ainvest.com/docs/quickstart"],
  ["MCP servers", "https://docs.ainvest.com/docs/mcp-servers"],
  ["OpenAPI 索引", "https://docs.ainvest.com/llms.txt"],
  ["Changelog", "https://docs.ainvest.com/docs/changelog"],
];

const CATALOG_TABS = [
  ["official", "官方 OpenAPI", OFFICIAL_API_OPERATIONS.length],
  ["internal", "内部数据候选", INTERNAL_ENDPOINTS.length],
  ["unavailable", "不可用 / 废弃", UNAVAILABLE_INTERNAL_ENDPOINTS.length],
];

const RESPONSE_EXAMPLE = `{
  "data": [{ "symbol": "AAPL", "value": 313.45 }],
  "meta": {
    "request_id": "req_…",
    "operations": ["multiKline"],
    "source_operation": "bside.quoteag.multi_kline",
    "as_of": "2026-08-31T10:32:01Z",
    "timezone": "America/New_York",
    "currency": "USD",
    "delayed": null,
    "catalog_version": "2026-08-31",
    "next_cursor": null
  },
  "warnings": [],
  "error": null
}`;

function statusMeta(value) {
  return STATUS_META[value] ?? {
    label: String(value || "待确认").replaceAll("_", " · "),
    tone: "warning",
  };
}

function isReady(item, tab) {
  return tab !== "unavailable" && item.v2Migration === "b_side_mapped";
}

function isUnavailable(item, tab) {
  if (tab === "unavailable") return true;
  const value = item.currentStatus;
  return ["unavailable", "deprecated"].includes(value);
}

function v2State(item, tab) {
  return tab === "unavailable" ? item.currentStatus : item.v2Migration;
}

function currentStateText(item, tab) {
  if (tab === "official") {
    if (item.currentMcp === "missing") return "未进入现网 MCP";
    if (item.currentMcp === "partial" || item.currentMcp === "route_drift") {
      return item.currentTool ? `${item.currentTool} · 有缺口` : "已有工具 · 契约漂移";
    }
    return item.currentTool || "已映射";
  }
  if (tab === "unavailable") return "暂停、废弃或当前不支持";
  if (["implemented", "verified"].includes(item.currentStatus)) return "内部 skill 已封装";
  return "文档 active，运行 / 授权待验证";
}

function trapDialogFocus(event) {
  if (event.key !== "Tab") return;
  const focusable = Array.from(event.currentTarget.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function copyPlainText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  textarea.remove();
  if (!didCopy) throw new Error("copy_not_supported");
}

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="section-lead">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ value }) {
  const meta = statusMeta(value);
  return <span className={`status-badge status-badge--${meta.tone}`}>{meta.label}</span>;
}

function DetailDialog({ item, tab, onClose }) {
  const closeRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!item) return undefined;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [item, onClose]);

  if (!item) return null;
  const state = v2State(item, tab);
  const callableInV2 = isReady(item, tab);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={trapDialogFocus}
      >
        <header className="detail-dialog__header">
          <div>
            <p className="eyebrow">能力详情 · {item.group || item.family}</p>
            <h2 id="detail-title">{item.name}</h2>
          </div>
          <button ref={closeRef} className="icon-button" aria-label="关闭详情" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        <div className="detail-dialog__body">
          <div className="detail-path">
            <span>{item.method || "GET"}</span>
            <code>{item.path}</code>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>v2 状态</dt>
              <dd><StatusBadge value={state} /></dd>
              <small>{currentStateText(item, tab)}</small>
            </div>
            <div>
              <dt>v2 注册结果</dt>
              <dd><code>{callableInV2 ? item.targetTool : "not in v2 tools/list"}</code></dd>
              <small>{tab === "unavailable"
                ? "不注册为可调用工具"
                : item.v2Migration === "legacy_compat"
                  ? "一期可继续兼容，但不能作为二期执行上游"
                  : callableInV2
                    ? `B 端映射：${item.bSideRouteId || item.id}`
                    : `候选工具：${item.targetTool || "未定"}；获得 B 端映射后再注册`}</small>
            </div>
            <div>
              <dt>权限</dt>
              <dd>{item.scope || GROUP_SCOPES[item.group] || "catalog.read"}</dd>
              <small>服务端按用户数据权益再次校验</small>
            </div>
            <div>
              <dt>操作 ID</dt>
              <dd><code>{item.id}</code></dd>
              <small>仅允许注册表中的 operation_id</small>
            </div>
          </dl>
          <div className="detail-note">
            <Info size={20} />
            <p>{item.note || "由 OpenAPI / 内部契约自动生成 Schema，并进入发布门禁。"}</p>
          </div>
          <div className="detail-policy">
            <strong>外放边界</strong>
            <p>开放数据能力和结构化结果，不把私网主机、C-side Cookie、B-side key 或任意 URL 请求能力交给模型。</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function CoverageCatalog() {
  const [tab, setTab] = useState("official");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const source = useMemo(() => {
    if (tab === "official") return OFFICIAL_API_OPERATIONS;
    if (tab === "internal") return INTERNAL_ENDPOINTS;
    return UNAVAILABLE_INTERNAL_ENDPOINTS;
  }, [tab]);

  const groups = useMemo(
    () => [...new Set(source.map((item) => item.group || item.family).filter(Boolean))],
    [source],
  );

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return source.filter((item) => {
      const text = [
        item.id,
        item.name,
        item.path,
        item.group,
        item.family,
        item.targetTool,
        item.currentTool,
        item.note,
      ].join(" ").toLowerCase();
      if (normalizedQuery && !text.includes(normalizedQuery)) return false;
      if (group !== "all" && (item.group || item.family) !== group) return false;
      if (filter === "ready" && !isReady(item, tab)) return false;
      if (filter === "gap" && (isReady(item, tab) || isUnavailable(item, tab))) return false;
      if (filter === "unavailable" && !isUnavailable(item, tab)) return false;
      return true;
    });
  }, [filter, group, query, source, tab]);

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setGroup("all");
    setFilter(nextTab === "unavailable" ? "unavailable" : "all");
    setQuery("");
  };

  const handleTabKeyDown = (event, index) => {
    const lastIndex = CATALOG_TABS.length - 1;
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = index === lastIndex ? 0 : index + 1;
    else if (event.key === "ArrowLeft") nextIndex = index === 0 ? lastIndex : index - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = lastIndex;
    else return;
    event.preventDefault();
    changeTab(CATALOG_TABS[nextIndex][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <section id="catalog" className="section section--catalog">
      <div className="container">
        <SectionHeading
          eyebrow="完整能力目录"
          title="所有能力都可发现；只有通过门禁的能力才可调用"
          description="这里把一期覆盖事实与二期迁移状态分开：只有 b_side_mapped 会进入 v2 tools/list；legacy_compat 和 blocked 只做目录说明。"
          action={<span className="catalog-total">迁移清单 · 37 项数据操作</span>}
        />

        <div className="catalog-shell">
          <div className="catalog-tabs" role="tablist" aria-label="能力来源">
            {CATALOG_TABS.map(([id, label, count], index) => (
              <button
                key={id}
                id={`catalog-tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`catalog-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                className={tab === id ? "active" : ""}
                onClick={() => changeTab(id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {label}<span>{count}</span>
              </button>
            ))}
          </div>

          <div
            id={`catalog-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`catalog-tab-${tab}`}
          >
          <div className="catalog-toolbar">
            <label className="search-field">
              <MagnifyingGlass size={19} />
              <span className="sr-only">搜索能力</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索名称、路径、operation id 或目标工具"
              />
              {query ? (
                <button type="button" aria-label="清除搜索" onClick={() => setQuery("")}><X size={16} /></button>
              ) : null}
            </label>
            <label className="select-field">
              <span className="sr-only">按分组筛选</span>
              <select value={group} onChange={(event) => setGroup(event.target.value)}>
                <option value="all">全部分组</option>
                {groups.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <div className="filter-buttons" aria-label="覆盖状态筛选">
              {[
                ["all", "全部"],
                ["gap", "只看缺口"],
                ["ready", "B 端已映射"],
                ["unavailable", "不可用"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={filter === id ? "active" : ""}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="catalog-summary">
            <span><Funnel size={16} />显示 {rows.length} / {source.length}</span>
            <span>{tab === "official" ? "v2 B 端映射 3 / 24 · 一期覆盖 10 / 24" : tab === "internal" ? "v2 B 端映射 5 · 阻塞 8" : "只展示状态，不提供调用"}</span>
          </div>

          <div className="catalog-table" role="table" aria-label="AInvest 能力覆盖矩阵">
            <div className="catalog-row catalog-row--head" role="row">
              <span role="columnheader">能力</span>
              <span role="columnheader">现在</span>
              <span role="columnheader">v2 注册结果</span>
              <span role="columnheader">v2 状态</span>
              <span role="columnheader" className="sr-only">操作</span>
            </div>
            {rows.map((item) => {
              const state = v2State(item, tab);
              const callableInV2 = isReady(item, tab);
              return (
                <div className="catalog-row" role="row" key={item.id}>
                  <div className="catalog-capability" role="cell">
                    <strong>{item.name}</strong>
                    <code><span>{item.method || "GET"}</span>{item.path}</code>
                  </div>
                  <span className="catalog-current" role="cell">{currentStateText(item, tab)}</span>
                  <code className="catalog-target" role="cell">{callableInV2 ? item.targetTool : "not registered"}</code>
                  <span role="cell"><StatusBadge value={state} /></span>
                  <span className="catalog-action-cell" role="cell">
                    <button className="row-action" onClick={() => setSelected(item)}>详情<ArrowRight size={15} /></button>
                  </span>
                </div>
              );
            })}
            {!rows.length ? (
              <div className="empty-state">
                <MagnifyingGlass size={26} />
                <strong>没有匹配项</strong>
                <p>清除搜索词或换一个筛选条件。</p>
                <button onClick={() => { setQuery(""); setGroup("all"); setFilter("all"); }}>清除筛选</button>
              </div>
            ) : null}
          </div>
          </div>
        </div>
      </div>
      <DetailDialog item={selected} tab={tab} onClose={() => setSelected(null)} />
    </section>
  );
}

function ToolSurface() {
  const publishedTools = useMemo(
    () => SEMANTIC_TOOLS.filter((tool) => tool.v2Availability !== "blocked"),
    [],
  );
  const blockedToolCount = SEMANTIC_TOOLS.length - publishedTools.length;
  const groups = useMemo(() => publishedTools.reduce((accumulator, tool) => {
    const key = tool.domain || "其他";
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key].push(tool);
    return accumulator;
  }, {}), [publishedTools]);

  return (
    <section id="tooling" className="section">
      <div className="container">
        <SectionHeading
          eyebrow="工具面设计"
          title="二期只发布 B 端已映射与本地目录工具"
          description={`首发 tools/list 共 ${publishedTools.length} 项；${blockedToolCount} 个候选工具只有在获得 B 端路由、key family 和契约后才会注册。`}
          action={<span className="catalog-total">published {publishedTools.length} · blocked {blockedToolCount}</span>}
        />
        <div className="tool-layout">
          <div className="tool-groups">
            {Object.entries(groups).map(([domain, tools]) => (
              <section className="tool-group" key={domain}>
                <header><span>{domain}</span><small>{tools.length} tools</small></header>
                <div>
                  {tools.map((tool) => (
                    <article className="tool-item" key={tool.name}>
                      <code>{tool.name}</code>
                      <p>{tool.summary}</p>
                      <span title={tool.scope}>{tool.scope}</span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <aside className="tool-principles">
            <div className="principle-card principle-card--strong">
              <Stack size={24} />
              <strong>1,279 个唯一指标</strong>
              <p>通过 <code>search_metrics</code>、<code>describe_metric</code> 和通用快照 / 序列工具访问，不注册 1,279 个 tools。</p>
            </div>
            <div className="principle-card">
              <LockKey size={22} />
              <strong>只允许 operation_id</strong>
              <p><code>call_api_operation</code> 只接受 <code>b_side_mapped</code>；一期兼容项和阻塞项不可执行，并禁止任意 URL、method、header 或 body。</p>
            </div>
            <div className="principle-card">
              <CheckCircle size={22} />
              <strong>36 / 36 模板继续做测试资产</strong>
              <p>模板是场景、示例和回归契约，不把它们误写成 36 个不同 API。</p>
            </div>
            <div className="principle-card">
              <WarningCircle size={22} />
              <strong>目录需要先刷新</strong>
              <p>本地指标快照停在 2026-06-09；正式发布前要去重、合并来源并改成可复现版本。</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function buildClientConfig(client, scopes) {
  const scopeList = scopes.join(", ");
  if (client === "bridge") {
    return `POST https://api.ainvest.com/ai/functions  # 拟议\nAuthorization: OAuth access token\n\nfunction: call_api_operation\noperation_id: multiKline\nrequired_scopes: catalog.read, marketdata.read\nselected_scopes: ${scopeList}`;
  }
  return JSON.stringify({
    name: "ainvest",
    client,
    url: "https://mcp.ainvest.com/mcp",
    status: "proposed",
    transport: "streamable_http",
    authorization: "oauth_2_1_pkce",
    scopes,
  }, null, 2);
}

function ConnectionPreview({ showToast }) {
  const [client, setClient] = useState("chatgpt");
  const [scopes, setScopes] = useState(DEFAULT_SCOPE_IDS);
  const config = buildClientConfig(client, scopes);

  const toggleScope = (id) => {
    setScopes((current) => current.includes(id)
      ? current.length === 1 ? current : current.filter((scope) => scope !== id)
      : [...current, id]);
  };

  const copyConfig = async () => {
    try {
      await copyPlainText(config);
      showToast("示意配置已复制；其中不包含真实凭据。", "success");
    } catch {
      showToast("浏览器未开放剪贴板权限，请手动复制。", "warning");
    }
  };

  return (
    <section id="connect" className="section section--connect">
      <div className="container">
        <SectionHeading
          eyebrow="接入体验原型"
          title="先选择客户端，再只授权需要的数据域"
          description="这是目标接入结构，不代表拟议地址已上线。一期 docsmcp 仅保留兼容期，不再作为二期 MCP 的数据上游。"
        />
        <div className="connection-layout">
          <div>
            <div className="client-grid" role="radiogroup" aria-label="选择 AI 客户端">
              {CLIENTS.map(({ id, name, note, Icon }) => (
                <button
                  key={id}
                  className={client === id ? "client-card active" : "client-card"}
                  role="radio"
                  aria-checked={client === id}
                  onClick={() => setClient(id)}
                >
                  <span><Icon size={23} /></span>
                  <strong>{name}</strong>
                  <small>{note}</small>
                  {client === id ? <CheckCircle size={18} weight="fill" /> : null}
                </button>
              ))}
            </div>
            <div className="scope-selector">
              <div className="scope-selector__title">
                <div><LockKey size={20} /><strong>只读权限</strong></div>
                <span>{scopes.length} / {SCOPES.length} 已选择</span>
              </div>
              <div className="scope-chips">
                {SCOPES.map((scope) => {
                  const selected = scopes.includes(scope.id);
                  return (
                    <button
                      key={scope.id}
                      className={selected ? "active" : ""}
                      aria-pressed={selected}
                      onClick={() => toggleScope(scope.id)}
                      title={scope.includes}
                    >
                      {selected ? <Check size={14} weight="bold" /> : null}{scope.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="config-card">
            <header>
              <div>
                <span className="status-badge status-badge--warning">拟议</span>
                <strong>目标配置结构</strong>
              </div>
              <button onClick={copyConfig}><Copy size={17} />复制</button>
            </header>
            <pre tabIndex="0">{config}</pre>
            <p><ShieldCheck size={17} />客户端只配置 Hosted MCP 与 OAuth/PAT；B 端 host、index-api / quoteag key 和 ProgId 注入都留在服务端。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.type}`} role="status">
      {toast.type === "warning" ? <WarningCircle size={19} /> : <CheckCircle size={19} weight="fill" />}
      <span>{toast.message}</span>
      <button aria-label="关闭提示" onClick={onDismiss}><X size={15} /></button>
    </div>
  );
}

export function App() {
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => setToast({ message, type });

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">跳到主要内容</a>
      <header className="topbar">
        <div className="container topbar__inner">
          <a className="brand" href="#main" aria-label="AInvest MCP v2 首页">
            <span>AInvest</span><b>MCP v2</b>
          </a>
          <nav aria-label="方案章节">
            <a href="#problems">哪里要改</a>
            <a href="#architecture">怎么改</a>
            <a href="#catalog">能力目录</a>
            <a href="#roadmap">上线顺序</a>
          </nav>
          <a className="topbar-cta" href="#connect"><PlugsConnected size={18} />接入示意</a>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <div className="container hero__grid">
            <div className="hero__copy">
              <div className="hero-kicker"><Circle size={9} weight="fill" />改版方案 · 基于 2026-08-31 实测</div>
              <h1>把 AInvest 的数据能力，<span>完整、安全</span>地交给用户自己的 AI</h1>
              <p>现在的 MCP 只直连 10 / 24 个官方操作。二期保留统一 MCP 接入，但数据执行改为服务端直连 B 端，不再复用一期 docsmcp / OpenAPI 上游链路。</p>
              <div className="hero-actions">
                <a className="button button--primary" href="#problems">先看哪里要改<ArrowRight size={18} /></a>
                <a className="button button--secondary" href="#catalog">浏览全量能力</a>
              </div>
              <p className="hero-boundary"><ShieldCheck size={18} />沿用的是 B 端调用协议，不是把 B 端地址或 apikey 交给用户自己的 AI。</p>
            </div>
            <aside className="coverage-card" aria-label="现网 MCP 覆盖情况">
              <div className="coverage-card__header">
                <span>现网公开 API 直连覆盖</span>
                <b>41.7%</b>
              </div>
              <meter min="0" max="24" value="10">10 / 24</meter>
              <div className="coverage-card__count"><strong>10</strong><span>/ 24 个官方 GET</span></div>
              <ul>
                <li><WarningCircle size={18} /><span><b>14 项</b>完全未进入 MCP</span></li>
                <li><WarningCircle size={18} /><span><b>11 / 11</b>无 outputSchema</span></li>
                <li><WarningCircle size={18} /><span><b>11 / 11</b>错误标记为非幂等</span></li>
                <li><WarningCircle size={18} /><span><b>OAuth discovery</b>当前缺失</span></li>
              </ul>
              <small>另有 1 个派生工具，不计入 REST 直连覆盖。</small>
            </aside>
          </div>
        </section>

        <section className="evidence-strip" aria-label="盘点关键数据">
          <div className="container evidence-grid">
            {KEY_METRICS.map((metric) => (
              <div className={`evidence-item evidence-item--${metric.tone || "default"}`} key={metric.id}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
                <small>{metric.note}</small>
              </div>
            ))}
          </div>
        </section>

        <section id="problems" className="section section--problems">
          <div className="container">
            <SectionHeading
              eyebrow="现在的问题 / 怎么改"
              title="先修可验证的缺口，再扩能力"
              description="以下每一项都有官方规格、现网协议或本地 skills 证据；不把愿景写成现状。"
            />
            <div className="problem-grid">
              {IMPROVEMENT_CARDS.map((card, index) => (
                <article className="problem-card" key={card.id}>
                  <header>
                    <span className="priority-chip">{card.priority}</span>
                    <span className="problem-number">0{index + 1}</span>
                  </header>
                  <h3>{card.title}</h3>
                  <div className="before-after">
                    <div><span>现在</span><p>{card.current}</p></div>
                    <ArrowRight size={18} />
                    <div><span>怎么改</span><p>{card.solution}</p></div>
                  </div>
                  <footer><Info size={16} />{card.evidence}</footer>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="architecture" className="section section--architecture">
          <div className="container">
            <SectionHeading
              eyebrow="目标架构"
              title="二期直接复用 skill 的 B 端调用方式"
              description="对外仍是标准 Hosted MCP；服务端把类型化请求直接路由到 B 端 APISIX，并按 endpoint family 选择应用密钥。"
            />
            <div className="call-path-comparison" aria-label="一期与二期调用链对比">
              <article className="call-path-card call-path-card--legacy">
                <header><span>一期 · 兼容层</span><small>不再作为 v2 上游</small></header>
                <p>AI Client <ArrowRight size={16} /> docsmcp <ArrowRight size={16} /> 公网 OpenAPI</p>
              </article>
              <article className="call-path-card call-path-card--target">
                <header><span>二期 · 主数据面</span><small>目标调用链</small></header>
                <p>AI Client <ArrowRight size={16} /> Hosted MCP <ArrowRight size={16} /> B 端 APISIX</p>
              </article>
            </div>
            <div className="architecture-flow">
              {ARCHITECTURE.map(({ title, description, Icon }, index) => (
                <div className="architecture-step" key={title}>
                  <article>
                    <span className="architecture-icon"><Icon size={26} weight="duotone" /></span>
                    <small>0{index + 1}</small>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                  {index < ARCHITECTURE.length - 1 ? <ArrowRight className="architecture-arrow" size={21} /> : null}
                </div>
              ))}
            </div>
            <div className="bside-route-panel">
              <header>
                <div>
                  <span className="eyebrow">服务端固定映射</span>
                  <h3>5 条现成 B 端路由，严格按应用选 key</h3>
                </div>
                <span className="server-only-badge"><LockKey size={15} />仅服务端</span>
              </header>
              <div className="bside-route-list" role="table" aria-label="B 端路由与密钥映射">
                <div className="bside-route-row bside-route-row--head" role="row">
                  <span role="columnheader">语义工具</span>
                  <span role="columnheader">B 端 POST path</span>
                  <span role="columnheader">应用 key</span>
                </div>
                {B_SIDE_ROUTES.map((route) => (
                  <div className="bside-route-row" role="row" key={route.id}>
                    <span role="cell"><small>{route.family}</small><code>{route.tool}</code></span>
                    <code role="cell">{route.path}</code>
                    <span role="cell" className={`key-alias key-alias--${route.keyRef}`}>{route.keyRef}</span>
                  </div>
                ))}
              </div>
              <footer>
                <span><Key size={17} />每次只读取当前 family 所需 key</span>
                <span><ShieldCheck size={17} /><code>{B_SIDE_TRANSPORT.programHeader}: {B_SIDE_TRANSPORT.programId}</code></span>
                <span><Database size={17} /><code>{B_SIDE_TRANSPORT.gatewayLabel}</code> 地址不进入前端 bundle</span>
              </footer>
            </div>
            <div className="architecture-policy">
              <div><ShieldCheck size={23} /><p><strong>对外：</strong>稳定域名、OAuth、JSON Schema、结构化结果、配额和审计。</p></div>
              <div><LockKey size={23} /><p><strong>服务端：</strong>index-api / quoteag 分钥、私网路由、catalog sync 和缓存。</p></div>
              <div><WarningCircle size={23} /><p><strong>禁止回退：</strong>二期执行不经过一期 OpenAPI，也不使用 C 端 Cookie。</p></div>
            </div>
          </div>
        </section>

        <CoverageCatalog />
        <ToolSurface />

        <section id="contract" className="section section--contract">
          <div className="container contract-grid">
            <div>
              <SectionHeading
                eyebrow="鉴权与契约"
                title="让客户端知道为什么失败，也知道数据从哪里来"
                description="现网的未授权响应可能是普通文本、空数组或 404；v2 必须统一为可机器判断的错误和结构化结果。"
              />
              <div className="contract-points">
                <article><Key size={21} /><div><strong>OAuth 2.1 + PKCE</strong><p>托管 MCP 默认 OAuth；PAT/BYOK 仅作可撤销的开发补充。</p></div></article>
                <article><ShieldCheck size={21} /><div><strong>scope + 数据权益</strong><p>工具可见不等于数据可用；每次调用再校验套餐、市场与字段权益。</p></div></article>
                <article><Wrench size={21} /><div><strong>统一错误 taxonomy</strong><p>401/403/404/429/5xx、isError、retry_after 和 WWW-Authenticate 一致表达。</p></div></article>
                <article><Database size={21} /><div><strong>来源与版本</strong><p>as_of、timezone、currency、delay、source_operation、request_id、catalog_version。</p></div></article>
              </div>
              <div className="scope-list" aria-label="拟议 OAuth scopes">
                {SCOPES.map((scope) => <span key={scope.id} title={scope.includes}>{scope.id}</span>)}
              </div>
            </div>
            <div className="response-card">
              <header>
                <span><FileCode size={19} />统一返回信封</span>
                <small>structuredContent + outputSchema</small>
              </header>
              <pre tabIndex="0">{RESPONSE_EXAMPLE}</pre>
              <footer><CheckCircle size={17} />所有只读查询（含 B 端 POST）标记 <code>readOnlyHint:true</code> 与 <code>idempotentHint:true</code></footer>
            </div>
          </div>
        </section>

        <section id="roadmap" className="section section--roadmap">
          <div className="container">
            <SectionHeading
              eyebrow="上线顺序"
              title="先建 B 端数据面，再逐批迁移能力"
              description="每一阶段都有可自动核验的门禁；目录有条目不等于已迁移，只有 B 端映射通过门禁才可调用。"
            />
            <div className="roadmap-grid">
              {ROADMAP.map((phase, index) => (
                <article className="roadmap-card" key={phase.phase}>
                  <header><span>{phase.phase}</span><small>{phase.time}</small></header>
                  <div className="roadmap-index">0{index + 1}</div>
                  <h3>{phase.title}</h3>
                  <p>{phase.goal}</p>
                  <ul>{phase.deliverables.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
                  <footer><strong>通过条件</strong><span>{phase.acceptance}</span></footer>
                </article>
              ))}
            </div>
            <div className="release-gate">
              <Pulse size={22} />
              <p><strong>最终发布门禁：</strong>5 / 5 现成路由全部直连 B 端，3 条 index-api 与 2 条 quoteag 无串钥，所有请求带 <code>X-Auth-ProgId: 7080</code>；v2 trace 不出现一期 OpenAPI hop 或 C 端 Cookie。其余能力只有获得 B 端路由、授权与契约后才标为可调用。</p>
            </div>
          </div>
        </section>

        <ConnectionPreview showToast={showToast} />

        <section className="sources-section">
          <div className="container sources-layout">
            <div>
              <p className="eyebrow">证据与边界</p>
              <h2>方案数字与 B 端调用规则来自现网协议和本地 skills</h2>
              <p>官方 specs 合计 24 个 GET；quote skill 明确 5 条 B 端 POST 路由、3 / 2 key 分组与 ProgId 规则。内部指标目录仍是 2026-06-09 快照。</p>
            </div>
            <div className="source-links">
              {SOURCE_LINKS.map(([label, href]) => (
                <a href={href} target="_blank" rel="noreferrer" key={href}>{label}<ArrowSquareOut size={15} /></a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="brand"><span>AInvest</span><b>MCP v2</b></div>
          <p>静态方案原型 · 当前与拟议能力已分开标注 · 不包含真实凭据</p>
          <span>2026-08-31</span>
        </div>
      </footer>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
