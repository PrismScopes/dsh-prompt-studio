# moeblack/prompt-studio

Prompt Studio 的插件分发形态。插件在对话页注册 **Prompt Studio** 标签页，以同一组件列表展示运行时原生提示词和用户补充，并提供编辑、原生覆盖与完整请求预览。

## 组件模型

每个编排项使用同一结构：

```ts
interface PromptComponent {
  id: string
  kind: 'native' | 'supplement'
  role: 'system' | 'user' | 'assistant'
  position: 'after_system' | 'anchored' | 'tail'
  order: number
  enabled: boolean
  template: string
  origin?: string
}
```

这些字段分别描述不同维度，不以 `kind` 代替位置、角色或用途：

- `kind` 只区分来源：`native` 是 Host 在运行时发现的只读组件；`supplement` 是用户可编排并持久化的补充组件。
- `role` 是模型所见的独立消息角色，可以是 `system`、`user` 或 `assistant`。
- `position` 是独立插入位置：
  - `after_system`：独立 system 槽之后、第一条原生会话消息之前；
  - `anchored`：最后一条真实用户消息之后，找不到锚点时跳过；
  - `tail`：原生消息序列末尾。
- `origin` 只用于覆盖。补充组件未设置 `origin` 时是普通注入；设置为某个原生组件 id 时，同一个补充组件即覆盖该原生组件，不存在单独的覆盖 kind。

同一位置的补充组件按 `order` 升序排列；`order` 相同时保留设置中的声明顺序。

## 原生覆盖

覆盖仍使用有序 marker section 和 `system-prompt/assemble` waterfall，不依赖静态原生目录：

1. `origin` 指向当前组装中存在的原生组件时，waterfall 移除原始组件。
2. 覆盖组件启用时，其替换文本与普通补充完全一样，按自身 `role`、`position`、`order` 进入消息序列。
3. 覆盖组件设为 `enabled=false` 时只移除原始组件，相当于关闭该原生组件。
4. `origin` 在本次组装中不存在时，不会凭空生成替换内容。

## 运行时组装

配置集合由 `ComponentPipeline` 激活。每次设置变更先调用旧组合效果的 disposer，再把新集合施加为一个 Cordis 生成器效果；marker、覆盖映射与补充消息映射分别返回原子逆，组合逆由 `ctx.effect()` 按结构生成。

原生目录在运行时动态发现。插件监听 `system-prompt/change` 并重新执行真实 `systemPrompt.assemble()`；waterfall 在覆盖前捕获原生 name、text 与组装次序，在覆盖后捕获实际 system 槽序列。浏览器通过同源 `GET /prompt-studio/state` 读取该单值快照。

补充消息在 system-prompt 组装时冻结本轮组件与活变量，再通过 `llm/stream` 的既有扩展接缝生成一次性请求副本。它们只进入本次模型请求，不写入会话记录。

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
2. 选择 **新增补充**，分别编辑标识、顺序、位置、角色、可选覆盖目标与模板。
3. 如需覆盖原生组件，也可在对应原生行选择 **创建覆盖**；生成的仍是 `kind=supplement` 组件，只是带有 `origin`。
4. 在 **完整预览** 中检查 system 槽序列和各位置的补充消息。
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
