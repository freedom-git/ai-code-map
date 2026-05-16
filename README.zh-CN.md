# AI Code Insight 工具箱

本仓库包含**两个 Copilot / Claude / OpenCode skill**，用于帮助你理解大型代码库：

| Skill | 作用 | 输出 |
|-------|------|------|
| **`code-insight`** | UML 风格类图 + 带编号的调用追踪，渲染在交互式 [React Flow](https://reactflow.dev/) 查看器中。 | `map.json` + `traces/{name}.json` + 通过 Vite 启动的 Web 查看器（`http://localhost:5173/`） |
| **`code-flow`** | 结构化的代码走查，产出标准化的 `flow.json`。两种模式：`base`（描述一条代码路径）和 `incident`（针对一次具体失败请求，对每一步做日志核对）。 | `flow.json`（外加一份通用的 markdown 渲染）。设计上面向被其他 skill 消费 / 增强（knowledge-base、code-insight、未来其他 skill）。 |

两个 skill 通过一个共享脚本一起注册，也可以使用 `--skill=<name>` 只注册其中一个。

> 与一次性绘制整个仓库的工具或只记录函数名跳转的追踪工具不同，本工具箱是**问题驱动的** —— 你针对代码的某个部分提问，skill 构建一个聚焦的、结构化的答案。

## 💡 设计理念

大多数代码可视化工具一次性绘制**整个**仓库 —— 对于大型项目产生无法阅读的混乱图形。大多数"代码追踪"工具只记录函数名跳转，跳过函数内部真正重要的步骤。本仓库的 skill 采用不同的方法：

1. **问题驱动**：你问"认证是怎么工作的？"或"这次 score 请求为什么失败？" —— 而不是"把所有东西都给我看"
2. **增量构建**：地图随着探索逐步增长；flow 只记录真正重要的步骤
3. **两层独立**：结构（code-insight 地图）和行为（code-insight 追踪、code-flow 走查）是独立的关注点
4. **先结构化，后可视化**：skill 输出 JSON 工件，查看器和消费方按需渲染

## 🗺️ `code-insight` — 交互式代码地图

### 功能特性

#### 地图模式 — 代码结构
- **UML 风格的类节点**，包含构造类型、公开属性、方法和文件路径
- **文件夹容器** 按目录分组类
- **结构性连线** 遵循 UML 规范（继承、实现、依赖、组合、聚合）
- **增量累积** —— 随着探索的深入，地图逐步增长。除非代码被删除，节点永远不会被移除。

#### 追踪模式 — 调用链
- **带编号的调用栈** 叠加在地图上，就像在真实地图上画路线
- **步骤编号内联显示** 在 UML 节点内对应方法旁边
- **左侧边栏** 列出所有追踪步骤，包含方法名和描述
- **红色追踪线** 带箭头连接每个步骤
- **多条命名追踪** 可以共存（如 `startup`、`get-versions`、`auth-flow`）

#### AI 驱动（通过 Copilot CLI / Claude / OpenCode）
- 针对仓库提问 → AI 分析代码 → 生成 `map.json` 和 `traces/{name}.json`
- AI 遵循 `skills/code-insight/AGENTS.md` 中定义的严格规则，确保输出一致且符合 UML 规范
- 问题驱动的范围：只显示相关的类，而非整个仓库

## 🔍 `code-flow` — 结构化代码走查

一个独立的 skill，用于刻画**一条代码路径中每一步真正在做什么** —— 每一个失败点、每一次外部调用、每一处有意义的内部步骤 —— 并输出为标准化的 `flow.json` 工件。

### 两种模式

| 模式 | 作用 | 适用场景 |
|------|------|----------|
| `base` | 走查代码路径，把每一步都列在 `steps[]` 里。不做日志核对，不打 status。 | "描述这条代码路径是怎么工作的" —— 文档、知识共享。 |
| `incident` | 先执行 `base`。然后接收用户提供的事故 ID，针对每一步的 `logAnchor` 去查实际日志，给每一步打 status（`success` / `failure` / `skipped` / `unknown`），把因果链写到 `incident.rootCause`。 | "这次具体的失败请求到底怎么回事？" 需要宿主 agent 具备日志查询工具 + 领域知识；否则 skill 会停下来要求用户先提供。 |

### 如何与 `code-insight` 协作

`flow.json` 是**独立**的 —— 单独一份通用 markdown 渲染就已经很有用。但它也面向被其他 skill 消费：

- **`code-insight`** 可以把 `flow.json` 转成它自己的原生 trace 格式，再画到地图上。这弥补了 `code-insight` 默认追踪粒度过粗（只有函数名跳转）的问题 —— 让粒度更细的 `code-flow` 规则先产出 trace。
- **知识库 skill** 可以拿到 `flow.json` 后再叠加 Kusto 风格的增强（cluster、database、查询模板），无需重新走查代码。

参见 [`skills/code-flow/SKILL.md`](skills/code-flow/SKILL.md)、[`skills/code-flow/RULES.md`](skills/code-flow/RULES.md)、[`skills/code-flow/schema/flow.schema.json`](skills/code-flow/schema/flow.schema.json) 以及 [`examples/`](skills/code-flow/examples/) 文件夹。

## 🚀 快速开始

1. **克隆本仓库**
   ```bash
   git clone https://github.com/freedom-git/ai-code-map.git
   cd ai-code-map
   ```

2. **使用 AI 编码助手打开**（以下任一）：
   ```bash
   copilot          # GitHub Copilot CLI
   claude           # Claude Code
   opencode         # OpenCode
   ```

3. **告诉助手你想理解哪个仓库**
   ```
   我想理解这个仓库：C:\path\to\my-project
   ```

4. **让助手启动查看器**
   ```
   启动 Web 服务
   ```
   然后打开 http://localhost:5173/

5. **针对代码提问**
   ```
   展示认证模块的类结构
   追踪 GET /api/users 被调用时的调用链
   走一遍 score 请求路径，告诉我每一步在哪个文件                         (code-flow base)
   为什么 score 请求 RootActivityId 001f... 失败了？                     (code-flow incident)
   ```

## 🔌 注册为 Skill（可选）

把本仓库注册到 Claude Code 和 / 或 GitHub Copilot CLI，让它们自动识别**两个** skill：

```bash
# 同时注册两个 skill —— 在以下位置创建联接 / 符号链接：
#   ~/.claude/skills/code-insight   →  skills/code-insight
#   ~/.claude/skills/code-flow      →  skills/code-flow
#   ~/.copilot/skills/code-insight  →  skills/code-insight
#   ~/.copilot/skills/code-flow     →  skills/code-flow
node scripts/register.mjs

# 取消所有注册
node scripts/unregister.mjs
```

两个脚本都是纯 Node 实现（零依赖，无需 `npm install`），可在 Windows、macOS、Linux 上运行。在 Windows 上使用目录联接（junction），无需管理员权限或开发者模式。

常用参数：

- `--skill=code-insight` 或 `--skill=code-flow` —— 只注册 / 取消注册一个 skill（默认两个都处理）
- `--target=claude|copilot|both`（默认 `both`） —— 只注册到指定 agent
- `--force` —— 替换指向其他位置的过期链接（仅 `register.mjs` 支持）
- `--dry-run` —— 只打印计划执行的操作，不实际修改

脚本拒绝删除真实目录，也拒绝删除指向其他仓库的链接，可以放心重复执行。

## 📁 项目结构

```
README.md                          # 本文件
scripts/                           # 共享 —— 同时注册两个 skill
  register.mjs
  unregister.mjs
skills/
  code-insight/                    # Skill 1：交互式代码地图
    SKILL.md                       # 清单
    AGENTS.md                      # AI 生成图表的规则
    web/                           # React Flow 查看器应用
      src/App.tsx                  # 主查看器（含 UML 节点）
      vite.config.ts               # 开发服务器 + projects/ 文件服务
    projects/                      # .gitignored —— 按仓库存储的用户数据
      {repo-name}/
        project.json               # 项目配置（仓库路径、名称）
        map.json                   # 持久化的代码结构地图
        traces/
          {name}.json              # 命名的调用链追踪
  code-flow/                       # Skill 2：结构化代码走查
    SKILL.md                       # 清单（含两种模式概述）
    RULES.md                       # 走查的操作规则集
    schema/
      flow.schema.json             # flow.json 的 JSON Schema（v1.0.0）
    examples/
      score-flow.json              # base 模式示例
      score-incident.json          # incident 模式示例
      score-flow.md                # 通用 markdown 渲染
```

## 📐 数据格式

### code-insight：`project.json`

```json
{
  "name": "my-project",
  "repoPath": "C:\\path\\to\\repo",
  "description": "项目简短描述"
}
```

### code-insight：`map.json`

```json
{
  "folders": [
    { "id": "folder-controllers", "label": "src/Controllers" }
  ],
  "nodes": [
    {
      "id": "my-controller",
      "className": "MyController",
      "stereotype": "Controller",
      "group": "controller",
      "filePath": "src/Controllers/MyController.cs",
      "folder": "folder-controllers",
      "attributes": ["+ Route: api/items"],
      "methods": ["+ GetAll(): Task<IActionResult>"]
    }
  ],
  "edges": [
    { "source": "my-controller", "target": "base-controller", "label": "extends", "type": "inherits" }
  ]
}
```

### code-insight：`traces/{name}.json`

```json
{
  "name": "get-items",
  "description": "GET api/items 调用链",
  "steps": [
    { "step": 1, "nodeId": "my-controller", "method": "GetAll()", "description": "入口点" },
    { "step": 2, "nodeId": "item-service", "method": "FetchItems()", "description": "业务逻辑" }
  ]
}
```

### code-flow：`flow.json`

比 `traces/{name}.json` 信息更丰富的工件。每一步都有 `kind`（`failure-point` 或 `call-step`）、指向代码位置的类型化 `entity`、自然语言 `action`，以及可选的 `codeLink` 和 `logAnchor`。Incident 模式还会在顶层多出 `incident` 块（类型化 ID、可选 URL、自由文本描述、根因），并给每一步打 `status`。

完整 schema：[`skills/code-flow/schema/flow.schema.json`](skills/code-flow/schema/flow.schema.json)。示例：[`skills/code-flow/examples/`](skills/code-flow/examples/)。

## 🎨 UML 连线类型（code-insight）

| 类型 | 样式 | 箭头 | 方向 |
|------|------|------|------|
| `inherits` | 绿色实线 | 空心 ▷ | 子类 → 父类 |
| `implements` | 蓝色虚线 | 空心 ▷ | 类 → 接口 |
| `uses` | 灰色虚线 | 空心 → | 依赖方 → 被依赖方 |
| `call` | 琥珀色实线（动画） | 实心 ▶ | 调用方 → 被调用方 |
| `composition` | 紫色实线 | 实心 ▶ | 整体 → 部分 |
| `aggregation` | 紫色实线 | 空心 ▷ | 整体 → 部分 |

## 🏗️ 技术栈

- **React Flow** — 交互式节点图渲染
- **Dagre** — 自动层次化布局
- **Vite + React + TypeScript** — 快速开发体验
- **AI（Copilot CLI / Claude / OpenCode）** — 代码分析和 JSON 生成

## License

MIT

---

[English](README.md)


