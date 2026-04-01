# AI Code Map（AI 代码地图）

一个交互式代码可视化工具，通过 UML 风格的类图和调用链追踪，帮助你**理解大型代码库** —— 由 AI 和 [React Flow](https://reactflow.dev/) 驱动。

> 与一次性绘制整个仓库的工具不同，AI Code Map 是**问题驱动的** —— 你针对代码的某个部分提问，它会构建一个聚焦的、可交互的可视化答案。

[English](README.md)

## 💡 设计理念

大多数代码可视化工具一次性绘制**整个**仓库 —— 对于大型项目来说会产生无法阅读的混乱图形。AI Code Map 采用不同的方法：

1. **问题驱动**：你问"认证是怎么工作的？" —— 而不是"把所有东西都给我看"
2. **增量构建**：地图随着探索逐步增长，一步步建立理解
3. **双层分离**：结构（地图）和行为（追踪）是独立的关注点
4. **可视化**：输出是可交互的图像，而非大段文字

## ✨ 功能特性

### 🗺️ 地图模式 — 代码结构
- **UML 风格的类节点**，包含构造类型、公开属性、方法和文件路径
- **文件夹容器** 按目录分组类
- **结构性连线** 遵循 UML 规范（继承、实现、依赖、组合、聚合）
- **增量累积** —— 随着探索的深入，地图逐步增长。除非代码被删除，节点永远不会被移除。

### 🔍 追踪模式 — 调用链
- **带编号的调用栈** 叠加在地图上，就像在真实地图上画路线
- **步骤编号内联显示** 在 UML 节点内对应方法旁边
- **左侧边栏** 列出所有追踪步骤，包含方法名和描述
- **红色追踪线** 带箭头连接每个步骤
- **多条命名追踪** 可以共存（如 `startup`、`get-versions`、`auth-flow`）

### 🤖 AI 驱动（通过 Copilot CLI / LLM）
- 针对仓库提问 → AI 分析代码 → 生成 `map.json` 和 `traces/{name}.json`
- AI 遵循 `AGENTS.md` 中定义的严格规则，确保输出一致且符合 UML 规范
- 问题驱动的范围：只显示相关的类，而非整个仓库

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
   ```

## 📁 项目结构

```
web/                             # React Flow 查看器应用
  src/
    App.tsx                      # 主查看器（含 UML 节点）
  vite.config.ts                 # 开发服务器 + projects/ 文件服务
projects/                        # .gitignored — 按仓库存储的用户数据
  {repo-name}/
    project.json                 # 项目配置（仓库路径、名称）
    map.json                     # 持久化的代码结构地图
    traces/
      {name}.json                # 命名的调用链追踪
AGENTS.md                        # AI 生成图表的规则
```

## 📐 数据格式

### project.json

```json
{
  "name": "my-project",
  "repoPath": "C:\\path\\to\\repo",
  "description": "项目简短描述"
}
```

### map.json

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

### traces/{name}.json

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

## 🎨 UML 连线类型

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
- **AI（Copilot CLI）** — 代码分析和 JSON 生成

## License

MIT

