# AInvest MCP 方案原型

**连接更简单，数据更完整，内部与外部共用一套 MCP。**

面向内部方案评审，文档和网页用四部分说明：当前问题、连接体验、统一 MCP、推进步骤。最终目标是开放全部 Index API 能力，内外共用数据调用协议；skills 如保留，只负责分析流程编排。

- [阅读方案](./MCP_V2_PROPOSAL.md)
- [在线查看原型](https://emeryxu1-blip.github.io/AinvestMCP/)

## 演示说明

三步连接流程使用固定示例，支持正常连接、密钥错误、服务异常。不收集真实密钥，不调用真实服务，演示成功不代表真实账号已连接。

当前实测：2026-09-15，证券查询可用，返回 11 个工具；分析师评级查询返回服务端 500。网页中的统一 MCP 和全量 Index API 覆盖属于未来目标，后端改造不在本次交付中。

## 本地预览与检查

在 `prototype` 目录运行：

```sh
npm install
npm run dev
```

生产构建与现有托管检查：

```sh
npm run build
npm run test:sites
```
