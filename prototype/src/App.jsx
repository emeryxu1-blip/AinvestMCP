import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, ArrowCounterClockwise, Check, CheckCircle, Code,
  Database, FileText, Globe, PlugsConnected, Stack,
  WarningCircle, ShieldCheck, Buildings, MagnifyingGlass,
} from "@phosphor-icons/react";

const PROBLEMS = [
  { title: "第一次连接，卡在开始之前", Icon: PlugsConnected,
    now: "找密钥、拼配置、排查错误；看到工具，也不一定查得到数据。",
    next: "引导完成连接，用第一条成功查询确认可用。" },
  { title: "文档能打开，AI 却用不好", Icon: FileText,
    now: "接入说明、工具描述与实际接口不一致，AI 需要反复尝试。",
    next: "统一能力目录、参数和示例，随服务一起更新。" },
  { title: "内部已有的数据，外部还用不到", Icon: Database,
    now: "外部 MCP 的能力覆盖落后于内部 Index API。",
    next: "逐步开放全部 Index API，让完整数据可发现、可调用。" },
  { title: "同一份能力，需要维护两遍", Icon: Stack,
    now: "内部 skills、外部 MCP 分别适配数据，更新与修复难同步。",
    next: "内外统一走 MCP，新增一次、修复一次，两边受益。" },
];
const STEPS = ["选择客户端", "完成连接", "首次查询"];
const CLIENTS = ["Codex", "Claude", "Cursor"];
const SCENARIOS = [
  { id: "success", label: "正常连接" },
  { id: "key-error", label: "密钥错误" },
  { id: "service-error", label: "服务异常" },
];
const ROADMAP = [
  { title: "先让连接顺畅", text: "改善接入引导、错误提示与 AI 可读文档。", outcome: "用户能独立完成第一次查询" },
  { title: "再统一内外调用", text: "内部数据调用迁入 MCP，文档与能力同步维护。", outcome: "一套数据能力，内外共同使用" },
  { title: "持续补齐全部能力", text: "扩展至全部 Index API，持续更新数据目录。", outcome: "完整开放成为终点，新增能力持续同步" },
];

function SectionHeading({ number, label, title, children }) {
  return <div className="section-heading">
    <p className="eyebrow"><span>{number}</span>{label}</p>
    <h2>{title}</h2>
    {children && <p className="section-description">{children}</p>}
  </div>;
}

function ConnectionDemo() {
  const [scenario, setScenario] = useState("success");
  const [client, setClient] = useState("Codex");
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("idle");
  const headingRef = useRef(null);
  const feedbackRef = useRef(null);
  const focusRequested = useRef(false);

  useEffect(() => {
    if (!focusRequested.current) return;
    (feedbackRef.current ?? headingRef.current)?.focus({ preventScroll: true });
    focusRequested.current = false;
  }, [step, status, scenario]);

  function reset(nextScenario = scenario, moveFocus = true) {
    focusRequested.current = moveFocus;
    setScenario(nextScenario);
    setStep(0);
    setStatus("idle");
  }
  function connect() {
    focusRequested.current = true;
    if (scenario === "key-error") {
      setStatus("auth-error");
    } else {
      setStep(2);
      setStatus("ready");
    }
  }
  function query() {
    focusRequested.current = true;
    setStatus(scenario === "service-error" ? "query-error" : "success");
  }
  function recoverKey() {
    focusRequested.current = true;
    setScenario("success");
    setStep(2);
    setStatus("ready");
  }
  function recoverService() {
    focusRequested.current = true;
    setScenario("success");
    setStatus("success");
  }
  function previous() {
    focusRequested.current = true;
    setStep((value) => Math.max(0, value - 1));
    setStatus("idle");
  }

  return <div className="demo" aria-label="MCP 连接体验演示">
    <div className="demo-toolbar">
      <span className="demo-label"><PlugsConnected size={18} aria-hidden="true" /> 未来体验 · 固定示例</span>
      <button className="reset-button" onClick={() => reset()} aria-label="重新开始演示"><ArrowCounterClockwise size={17} aria-hidden="true" /><span>重来</span></button>
    </div>
    <fieldset className="scenario-picker">
      <legend>体验不同情况</legend>
      <div className="scenario-options">
        {SCENARIOS.map((item) => <label key={item.id} className={scenario === item.id ? "selected" : ""}>
          <input type="radio" name="scenario" value={item.id} checked={scenario === item.id} onChange={() => reset(item.id, false)} />
          {item.label}
        </label>)}
      </div>
    </fieldset>
    <ol className="steps" aria-label="连接步骤">
      {STEPS.map((title, index) => {
        const complete = index < step || status === "success";
        return <li key={title} className={complete ? "complete" : index === step ? "active" : ""} aria-current={index === step ? "step" : undefined}>
          <span className="step-number">{complete ? <Check size={15} weight="bold" aria-hidden="true" /> : index + 1}</span>
          <span>{title}</span>
        </li>;
      })}
    </ol>
    <div className="demo-body" aria-live="polite" aria-atomic="true">
      {step === 0 && <div className="step-content">
        <p className="step-kicker">第 1 步 / 选择客户端</p>
        <h3 ref={headingRef} tabIndex={-1}>你想在哪个 AI 里使用？</h3>
        <p className="muted">选择你熟悉的客户端，接入引导会随之匹配。</p>
        <fieldset className="client-picker">
          <legend className="sr-only">选择 AI 客户端</legend>
          {CLIENTS.map((name) => <label key={name} className={client === name ? "selected" : ""}>
            <input type="radio" name="client" value={name} checked={client === name} onChange={() => setClient(name)} />
            <Code size={24} aria-hidden="true" /><span>{name}</span>
            {client === name && <CheckCircle className="client-check" size={17} weight="fill" aria-hidden="true" />}
          </label>)}
        </fieldset>
        <button className="button button-primary" onClick={() => { focusRequested.current = true; setStep(1); }}>继续连接 <ArrowRight size={17} aria-hidden="true" /></button>
      </div>}
      {step === 1 && <div className="step-content">
        <p className="step-kicker">第 2 步 / 完成连接</p>
        <h3 ref={headingRef} tabIndex={-1}>将 AInvest 连接到 {client}</h3>
        <p className="muted">完成认证后，再试一次查询，确认数据可以使用。</p>
        <div className="connection-summary"><ShieldCheck size={26} aria-hidden="true" /><div><strong>读取可用金融数据</strong><span>具体数据范围以账号权限为准</span></div><span className="sample-tag">示例账号</span></div>
        {status === "auth-error" ? <>
          <div className="notice notice-error" role="alert" ref={feedbackRef} tabIndex={-1}><WarningCircle size={21} aria-hidden="true" /><div><strong>密钥无效，尚未完成认证</strong><p>请检查密钥，或在开发者中心重新获取。发现工具不代表认证成功。</p></div></div>
          <button className="button button-primary" onClick={recoverKey}>更换示例密钥并重试 <ArrowRight size={17} aria-hidden="true" /></button>
        </> : <button className="button button-primary" onClick={connect}><PlugsConnected size={18} aria-hidden="true" />连接 AInvest</button>}
        <button className="text-button" onClick={previous}>返回选择客户端</button>
      </div>}
      {step === 2 && <div className="step-content">
        <p className="step-kicker">第 3 步 / 首次查询</p>
        <h3 ref={headingRef} tabIndex={-1}>{status === "success" ? "第一条数据，查询成功" : "连上之后，查一次才放心"}</h3>
        <p className="connection-status"><CheckCircle size={16} weight="fill" aria-hidden="true" /> {client} · 示例认证已通过</p>
        <div className="query-prompt"><MagnifyingGlass size={19} aria-hidden="true" /><span>查找苹果公司的股票代码和交易所</span></div>
        {status === "ready" && <>
          <p className="muted query-note">连接已建立，数据查询仍待验证。</p>
          <button className="button button-primary" onClick={query}>查询 AAPL <ArrowRight size={17} aria-hidden="true" /></button>
        </>}
        {status === "query-error" && <>
          <div className="notice notice-warning" role="alert" ref={feedbackRef} tabIndex={-1}><WarningCircle size={21} aria-hidden="true" /><div><strong>查询服务暂时不可用</strong><p>认证已通过，但服务端返回 500。请稍后重试；这不是“没有数据”。</p></div></div>
          <button className="button button-primary" onClick={recoverService}>模拟服务恢复后重试 <ArrowCounterClockwise size={17} aria-hidden="true" /></button>
        </>}
        {status === "success" && <>
          <div className="result-card">
            <div className="result-heading"><CheckCircle size={19} weight="fill" aria-hidden="true" /><strong>已找到 Apple</strong><span className="sample-tag">固定示例</span></div>
            <dl><div><dt>股票代码</dt><dd>AAPL</dd></div><div><dt>交易所</dt><dd>NASDAQ</dd></div><div><dt>证券类型</dt><dd>股票</dd></div></dl>
          </div>
          <p className="completion-note">连接与查询均已验证，可以继续探索数据。</p>
          <button className="text-button" onClick={() => reset()}>重新体验连接</button>
        </>}
        {status !== "success" && <button className="text-button" onClick={previous}>返回连接设置</button>}
      </div>}
    </div>
    <p className="demo-footnote">仅演示目标流程，不收集真实密钥、不发起真实请求。</p>
  </div>;
}

export function App() {
  return <>
    <a className="skip-link" href="#main">跳到主要内容</a>
    <header className="topbar">
      <div className="container topbar-inner">
        <a className="brand" href="#main" aria-label="AInvest MCP 首页">AInvest <span>MCP</span></a>
        <nav aria-label="方案章节">
          <a href="#problems">当前问题</a><a href="#experience">连接体验</a><a href="#unified">统一 MCP</a><a href="#roadmap">推进步骤</a>
        </nav>
        <span className="review-label">内部评审 · v2</span>
      </div>
    </header>
    <main id="main">
      <div className="hero">
        <div className="container hero-inner">
          <div>
            <p className="eyebrow">AINVEST MCP / 产品改版方案</p>
            <h1>连接更简单，<br /><em>数据更完整。</em></h1>
            <p className="hero-subtitle">内部与外部，共用一套 MCP。</p>
            <p className="hero-description">让用户把时间用在研究上，<span>让团队把能力只维护一次。</span></p>
            <a className="button button-primary" href="#experience">体验三步连接 <ArrowRight size={18} aria-hidden="true" /></a>
          </div>
          <aside className="hero-note" aria-label="改版目标">
            <span className="tag">改版目标</span>
            <p>从“能接上”<br />走到“用得好”</p>
            <ul><li><Check size={17} aria-hidden="true" />第一次连接就知道下一步</li><li><Check size={17} aria-hidden="true" />AI 能找到并用对数据</li><li><Check size={17} aria-hidden="true" />新增能力，内外同步获得</li></ul>
          </aside>
        </div>
      </div>
      <div className="evidence-strip"><div className="container evidence-inner"><span className="tag">当前实测 · 2026.09.15</span><p>证券查询可用，返回 11 个工具；分析师评级查询仍返回服务端 500。</p></div></div>

      <section className="section container" id="problems" aria-labelledby="problems-title">
        <div className="section-heading"><p className="eyebrow"><span>01</span>当前问题</p><h2 id="problems-title">让用户少折腾，让 AI 少猜测。</h2><p className="section-description">从第一次连接，到长期使用，四个体验缺口值得优先解决。</p></div>
        <div className="problem-grid">
          {PROBLEMS.map(({ title, Icon, now, next }, index) => <article className="problem" key={title}>
            <div className="problem-top"><Icon size={23} aria-hidden="true" /><span>0{index + 1}</span></div>
            <h3>{title}</h3><p className="problem-now">{now}</p>
            <p className="problem-next"><ArrowRight size={17} aria-hidden="true" /><span>{next}</span></p>
          </article>)}
        </div>
        <p className="source-note"><FileText size={15} aria-hidden="true" />官网已有 <a href="https://docs.ainvest.com/llms.txt" target="_blank" rel="noreferrer">llms.txt</a> 和 Markdown 入口；需要补齐的是与实际能力一致的 AI 接入体验。</p>
      </section>

      <section className="section section-tinted" id="experience" aria-labelledby="experience-title">
        <div className="container experience-grid">
          <div className="experience-intro"><p className="eyebrow"><span>02</span>连接体验</p><h2 id="experience-title">三步，拿到<br />第一条数据。</h2><p className="section-description">每一步都有明确反馈。用户知道连接到了哪里、是否通过认证，以及查询是否真正成功。</p>
            <ol className="experience-points"><li><strong>选熟悉的 AI</strong><span>按客户端给出对应接入指引</span></li><li><strong>清楚地完成连接</strong><span>错误说明原因，也给出下一步</span></li><li><strong>用一次查询确认</strong><span>拿到结果，才算真正开始使用</span></li></ol>
            <p className="future-note"><span className="tag">未来目标</span>可交互连接流程演示</p>
          </div>
          <ConnectionDemo />
        </div>
      </section>

      <section className="section container" id="unified" aria-label="统一 MCP">
        <SectionHeading number="03" label="统一 MCP" title="一套能力，服务内外两边。">让内部 AI 和外部客户端使用同一套数据调用协议，能力与文档一起更新。</SectionHeading>
        <div className="architecture" role="img" aria-label="未来目标：内部 AI 和外部 AI，通过同一套 MCP，按账号权限访问 Index API 等底层数据服务。">
          <div className="architecture-clients"><div><Buildings size={23} aria-hidden="true" /><strong>内部 AI</strong><span>内部产品与分析流程</span></div><div><Globe size={23} aria-hidden="true" /><strong>外部 AI</strong><span>用户自己的客户端</span></div></div>
          <ArrowRight className="architecture-arrow" size={25} aria-hidden="true" />
          <div className="architecture-hub"><PlugsConnected size={29} aria-hidden="true" /><strong>同一套 MCP</strong><span>统一发现 · 统一调用 · 同步更新</span></div>
          <ArrowRight className="architecture-arrow" size={25} aria-hidden="true" />
          <div className="architecture-data"><Database size={28} aria-hidden="true" /><strong>Index API</strong><span>等底层数据服务</span></div>
        </div>
        <div className="unified-details"><p><strong>完整开放是目标。</strong>逐步覆盖全部 Index API：指标、历史变化、行业成分、ETF 持仓等，按账号权限提供。</p><p><strong>数据能力只维护一次。</strong>skills 如需保留，只负责编排分析流程，数据调用统一通过 MCP。</p></div>
        <div className="benefit-line"><CheckCircle size={20} weight="fill" aria-hidden="true" /><strong>新增一次，修复一次，内外同步受益。</strong><span className="tag">未来目标</span></div>
      </section>

      <section className="section section-tinted" id="roadmap" aria-label="推进步骤">
        <div className="container"><SectionHeading number="04" label="推进步骤" title="先用起来，再统一，持续补齐。" />
          <div className="roadmap-grid">{ROADMAP.map((item, index) => <article className="roadmap-item" key={item.title}><span className="roadmap-number">0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p><div><ArrowRight size={16} aria-hidden="true" />{item.outcome}</div></article>)}</div>
          <p className="roadmap-note">本次交付为方案与前端演示；统一 MCP 后端和 Index API 全量开放属于后续建设。</p>
        </div>
      </section>
    </main>
    <footer className="container footer"><div><a className="brand" href="#main">AInvest <span>MCP</span></a><p>连接更简单，数据更完整。</p></div><div className="footer-links"><a href="https://docs.ainvest.com/docs/mcp-servers" target="_blank" rel="noreferrer">现有 MCP 文档 <ArrowRight size={14} aria-hidden="true" /></a><span>方案原型 · 2026.09.15</span></div></footer>
  </>;
}
