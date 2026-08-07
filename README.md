# moeblack/prompt-studio

Prompt Studio 的插件分发形态。插件在对话页注册 **Prompt Studio** 标签页，以同一组件列表展示运行时原生提示词和用户补充，并提供编辑、原生覆盖与完整请求预览。

## 组件模型

每个编排项使用同一结构：

```ts
interface PromptComponent {
  id: string
  kind: 'native' | 'supplement'
  role: 'system' | 'user' | 'assistant'
  position?: 'after_system' | 'anchored' | 'tail'
  order: number
  enabled: boolean
  template: string
  origin?: string
}
```

这些字段分别描述不同维度，不以 `kind` 代替角色或用途：

- `kind` 只区分来源：`native` 是 Host 在运行时发现的只读组件；`supplement` 是用户可编排并持久化的补充组件。
- `role` 决定内容归宿：
  - `system` 一律注册为有序 system section，最终与原生 sections 合并到全局唯一的 `system` 字段；此时不得设置 `position`；
  - `user`、`assistant` 进入消息序列，必须设置 `position`。
- `position` 只描述 user/assistant 消息所处的间隙：
  - `after_system`：全局 system 字段之后、第一条原生会话消息之前；
  - `anchored`：最后一条真实用户消息之后，找不到锚点时跳过；
  - `tail`：原生消息序列末尾。

> `anchored` 与 `tail` 的区别：简单对话中最后一条消息往往就是用户输入，两者重叠；但存在工具调用流（user → tool_call → tool_result → assistant）时完全不同——`anchored` 插在用户输入之后、工具调用流之前，`tail` 插在整个序列最末尾（工具结果与助手回复之后）。需要紧贴用户问题补充指令用 `anchored`，需要模型读完完整上下文再看到的内容用 `tail`。
- `order` 有两种与归宿对应的含义：
  - system 组件的 `order` 是 system section 的全局混排层级，和原生 sections 一起升序排列；约定 `-100` 是身份区、`0` 是 persona、`100–199` 是工具区，其他负值也在 persona 之前；
  - user/assistant 组件的 `order` 只在同一个 `position` 间隙内排序，不参与跨间隙比较。
- `origin` 只用于覆盖。补充组件未设置 `origin` 时是普通注入；设置为某个原生组件 id 时，同一个补充组件即覆盖该原生组件，不存在单独的覆盖 kind。

同一消息间隙的补充组件按 `(order, 声明顺序)` 排列。system sections 由 Host 依 `order` 与原生 sections 全局混排。

## 内容合并与边界

所有 system sections 最终渲染为同一个 `system` 字符串。每段补充内容在该字符串内部保留以下边界，原生内容不加包装：

```xml
<supplement id="supplement:example">
补充提示词正文
</supplement>
```

user/assistant 补充先进入选定间隙。若补充组与间隙左侧或右侧的相邻原生消息 `role` 相同，补充边界块会按先后关系合并进该原生消息的 `content`；若角色不同，则在该间隙创建新消息。相邻且同角色的补充也合并为一条消息，同时保留每个补充各自的 `<supplement>` 边界。

## 原生覆盖

覆盖仍使用有序 marker section 和 `system-prompt/assemble` waterfall，不依赖静态原生目录：

1. `origin` 指向当前组装中存在的原生组件时，waterfall 移除原始组件。
2. 覆盖组件启用时，其替换文本按自身 `role` 归宿：system 覆盖保留 marker 的全局 `order` 并进入唯一 system 字段；user/assistant 覆盖按 `position` 进入消息间隙。
3. 覆盖组件设为 `enabled=false` 时只移除原始组件，相当于关闭该原生组件。
4. `origin` 在本次组装中不存在时，不会凭空生成替换内容。

## 运行时组装

配置集合由 `ComponentPipeline` 激活。每次设置变更先调用旧组合效果的 disposer，再把新集合施加为一个 Cordis 生成器效果；marker、覆盖映射与补充消息映射分别返回原子逆，组合逆由 `ctx.effect()` 按结构生成。

原生目录在运行时动态发现。插件监听 `system-prompt/change` 并重新执行真实 `systemPrompt.assemble()`；waterfall 在覆盖前捕获原生 name、text 与组装次序，在覆盖后捕获实际 system 槽序列。浏览器通过同源 `GET /prompt-studio/state` 读取该单值快照。

system 补充直接通过 `systemPrompt.section()` 参与真实组装，不进入消息计划。user/assistant 补充在 system-prompt 组装时冻结本轮组件与活变量，再通过 `llm/stream` 的既有扩展接缝生成一次性请求副本。消息补充只进入本次模型请求，不写入会话记录。

## 自动捕获注入上下文

请求发出前，插件扫描完整消息序列，自动识别所有「非对话」消息——即生产者注入的上下文（`MessageSource.kind` 既不是 `user`/`model`/`tool`，也不是本插件自己的消息）——并纳入 Prompt Studio 视野，无需预知注入者是谁。任何插件将来注入的新上下文都会自动出现，不需要为它单独加桥。

捕获按消息来源分类（`form`：instructions / catalog / snapshot / notice / relay / recall）。workspace-context 注入的指令（AGENTS.md 基线及其动态增量）会进一步展开为资源条目：每个文件显示路径、动作（set/replace/remove）与内容摘要，`remove` 之外的资源可打开编辑。编辑通过资源读写接口写回文件系统，写回带版本冲突检测——文件在捕获后被修改时会拒绝覆盖并返回冲突，避免与 workspace-context 自身的状态协调（版本缓存、reconcile、字节预算）打架。

捕获是请求级快照：仅当会话发生过模型请求时，面板中才出现捕获条目。

## 模板变量

模板支持以下引用：

- `{{user_input}}`：当前会话最后一条真实用户输入；
- `{{model}}`：当前 Agent 选择的模型；
- `{{cwd}}`：当前会话工作目录。

这些值在每次组装时从 `AssembleContext.agent`、`agent.session` 和当前 Agent 选项读取，不是保存时快照。

## 设置

`settings.yaml` 中只持久化用户补充组件：

```yaml
prompt-studio:
  components:
    - id: supplement:identity
      kind: supplement
      role: system
      order: -200
      enabled: true
      template: 你是一个严谨的工程助手。
    - id: supplement:message
      kind: supplement
      role: user
      position: tail
      order: 100
      enabled: true
      template: 请先复述当前目标。
```

运行时原生组件不写入设置。

## 使用

1. 打开任意对话，选择 **Prompt Studio** 标签页。
2. 选择 **新增补充**，分别编辑标识、角色、顺序、可选覆盖目标与模板；只有 user/assistant 角色显示消息间隙选择器。
3. 如需覆盖原生组件，也可在对应原生行选择 **创建覆盖**；生成的仍是 `kind=supplement` 组件，只是带有 `origin`。
4. 在 **完整预览** 中检查合并后的完整 system 内容及各消息间隙的补充内容。模型内容预览不插入 `[位置 · role · id]` 一类展示标签，补充来源只由实际发送的 `<supplement>` 边界表示。
5. 选择 **保存更改**。设置保存后立即撤销旧组合并施加新组合。

## 安装与启用

```sh
export DSH_HOME=/path/to/dsh-data
/path/to/dsh/bin/dsh plugin install /path/to/dsh-prompt-studio
/path/to/dsh/bin/dsh plugin enable moeblack/prompt-studio
/path/to/dsh/bin/dsh plugin list
```

安装后默认禁用；启用索引由 DSH plugin registry 管理。命令行与已经运行的 Web 进程不共享内存，因此启用或替换插件产物后需重启 `dsh web` 并刷新浏览器。

## 构建

构建依赖一个已安装依赖并完成构建的 DSH 源码树：

```sh
DSH_ROOT=/path/to/dsh node scripts/build.mjs
```

构建先运行 TypeScript 项目检查，再由 `tsdown` 生成自包含的服务端 ESM 与浏览器端 bundle，最后写入插件根目录：

- `index.mjs`
- `client.js`
- `client.js.map`

## 文件

| 文件 | 作用 |
|---|---|
| `dsh.plugin.json` | 插件清单、服务端入口与浏览器端入口 |
| `src/index.ts` | 效果管线、动态目录、原生覆盖与发送前注入 |
| `src/shared.ts` | 二分组件模型、校验、覆盖判定与预览函数 |
| `src/config.ts` | 仅含 `components` 的 settings schema |
| `src/client/` | 统一列表编辑器、运行时目录读取与设置保存 |
| `scripts/build.mjs` | 类型检查和双端构建 |

## 已知前提

浏览器端读写 `prompt-studio` 配置段，需要宿主在 `PRODUCT_SETTINGS_NAMESPACES` 中公开 `'prompt-studio'`。当前 DSH 官方 plugin-registry 集成环境已经包含该项。
