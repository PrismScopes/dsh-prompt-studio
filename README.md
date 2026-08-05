# moeblack/prompt-studio

Prompt Studio 的官方 registry 分发形态。插件在对话页注册 `conversation.view` 的 **Prompt Studio** 标签页，用于增删、启停、排序和编辑用户 system-prompt section，也可覆盖、关闭或恢复内置 section，并实时预览按最终顺序拼接的完整模板。

Node half 持有 `prompt-studio` settings namespace：用户 section 通过 `ctx.systemPrompt.section(...)` 增量注册；内置覆盖通过带顺序的 marker section 进入 registry，再在 `system-prompt/assemble` waterfall 中替换或移除原 section。浏览器 half 通过 settings API 携带 revision 原子保存 `sections` 与 `overrides`，数据由宿主的 `settings.yaml` provider 持久化。

## 文件

| 文件 | 作用 |
|---|---|
| `dsh.plugin.json` | registry 清单：插件身份、兼容范围、Node/client 入口 |
| `index.mjs` | Node half 构建产物：settings namespace、用户 section 绑定、内置覆盖 waterfall |
| `client.js` | 浏览器 bundle 构建产物；以 `moeblack/prompt-studio` 登记到 `window.__ModuleLoader__` |
| `client.js.map` | 浏览器 bundle sourcemap |
| `src/` | Node half、client half、共享类型与内置 section inventory 源码 |
| `tsdown.config.ts` | 使用 DSH 官方 `clientBundle` preset 的双端构建配置 |
| `scripts/` | DSH checkout 定位、构建与测试脚本 |
| `tests/` | Host、store、view、slot 注册、样式与分发产物测试 |

## 安装与启用

```sh
export DSH_HOME=/path/to/dsh-data
/path/to/dsh/bin/dsh plugin install /path/to/dsh-prompt-studio
/path/to/dsh/bin/dsh plugin enable moeblack/prompt-studio
/path/to/dsh/bin/dsh plugin list
```

安装后默认禁用；`enable` 将其写入启用索引。CLI 与正在运行的 Web 进程不共享内存，因此通过 CLI 启用后需重启 `dsh web`，再刷新浏览器。启用成功后，`dsh plugin list` 显示 `enabled moeblack/prompt-studio@0.1.0`。

若当前 DSH composition 仍加载 monorepo 内的 `@deepseek-ai/dsh-client-ui-prompt-studio`，请先把对应 Loader row 设为 `disabled: true`。两种分发形态拥有同一个 settings namespace 与同一个 conversation view id，不能同时挂载；原 package 可以保留在 checkout 中作为回退。

## 使用

1. 打开任意 conversation，选择 **Prompt Studio** 标签页。
2. 在 **User sections** 中新增、编辑、启停、调整顺序或移除自定义 section。
3. 展开 **Built-in sections**，编辑内置 section 的顺序和文本，关闭该 section，或选择 **Restore default** 恢复 package 原值。
4. 在 **Complete preview** 中确认启用项的最终顺序与未解析模板。
5. 选择 **Save changes**。保存成功后，后续 system-prompt assembly 立即使用新配置。

## 构建

构建依赖一个已安装依赖并完成构建的 DSH checkout。脚本临时连接 DSH 的 TypeScript、tsdown、workspace 类型与平台模块表，完成后删除这些临时连接；不会修改 DSH checkout。

```sh
DSH_ROOT=/path/to/dsh node scripts/build.mjs
```

也可通过 package script 执行：

```sh
DSH_ROOT=/path/to/dsh pnpm run build
```

构建先运行 TypeScript project check，再由 `tsdown` 生成自包含 Node ESM 与浏览器 CJS factory，最后把可分发产物写到插件根目录：

- `index.mjs`
- `client.js`
- `client.js.map`

浏览器构建沿用 DSH 的 `CLIENT_EXTERNALS` 与 bundle purity gate；React、runtime、web-react 等平台模块由宿主 module table 提供，CSS Modules 由官方 preset 编译并内联注入。

## 测试

先构建产物，再运行测试：

```sh
DSH_ROOT=/path/to/dsh pnpm run check
```

或分别执行：

```sh
DSH_ROOT=/path/to/dsh node scripts/build.mjs
DSH_ROOT=/path/to/dsh node scripts/test.mjs
```

## 契约要点

- `dsh.plugin.json`、`client.js` 的 module-loader id 均为 `moeblack/prompt-studio`。
- Node half 导出 Cordis 的命名 `apply` / `inject` 表面；浏览器 bundle 同样导出 `apply` / `inject`。
- `client.inject` 是 boot graph 元数据；浏览器 fiber 的实际服务等待由 bundle 内 `inject = ['slots', 'conversation', 'connection']` 决定。
- `contributes.tools` 与 `contributes.skills` 均为空；本插件只通过既有 settings、system-prompt 与 UI slot 接缝工作。
- `prompt-studio` namespace 使用 `applies: 'live'`；已有 session history 不会因后续编辑而改写。
