# moeblack/prompt-studio

Prompt Studio 的插件分发形态。插件在对话页注册 **Prompt Studio** 标签页，用于增删、启停、排序和编辑用户自定义的 system prompt 内容块，也可覆盖、关闭或恢复内置内容块，并实时预览按最终顺序拼接的完整模板。

服务端持有 `prompt-studio` 配置段：用户内容块通过 `ctx.systemPrompt.section(...)` 增量注册；内置内容块的覆盖通过带顺序的标记块进入注册表，再在 `system-prompt/assemble` 组装流水线中替换或移除原内容块。浏览器端通过配置接口携带版本号保存 `sections` 与 `overrides`，数据由宿主的 `settings.yaml` 持久化。

## 文件

| 文件 | 作用 |
|---|---|
| `dsh.plugin.json` | 插件清单：插件身份、兼容范围、服务端/浏览器端入口 |
| `index.mjs` | 服务端构建产物：配置段、用户内容块绑定、内置覆盖流水线 |
| `client.js` | 浏览器端构建产物；以 `moeblack/prompt-studio` 登记到 `window.__ModuleLoader__` |
| `client.js.map` | 浏览器端构建源码映射 |
| `src/` | 服务端、浏览器端、共享类型与内置内容块清单源码 |
| `tsdown.config.ts` | 使用 DSH 官方 `clientBundle` 预设的双端构建配置 |
| `scripts/` | DSH 源码树定位、构建与测试脚本 |
| `tests/` | 服务端、数据、界面、注册、样式与分发产物测试 |

## 安装与启用

```sh
export DSH_HOME=/path/to/dsh-data
/path/to/dsh/bin/dsh plugin install /path/to/dsh-prompt-studio
/path/to/dsh/bin/dsh plugin enable moeblack/prompt-studio
/path/to/dsh/bin/dsh plugin list
```

安装后默认禁用；`enable` 将其写入启用索引。命令行与正在运行的 Web 进程不共享内存，因此通过命令行启用后需重启 `dsh web`，再刷新浏览器。启用成功后，`dsh plugin list` 显示 `enabled moeblack/prompt-studio@0.1.0`。

若当前 DSH 组合仍加载 monorepo 内的 `@deepseek-ai/dsh-client-ui-prompt-studio`，请先把对应 Loader 行设为 `disabled: true`。两种分发形态拥有同一个配置段与同一个对话页视图编号，不能同时挂载；原包可以保留在源码树中作为回退。

## 使用

1. 打开任意对话，选择 **Prompt Studio** 标签页。
2. 在 **User sections** 中新增、编辑、启停、调整顺序或移除自定义内容块。
3. 展开 **Built-in sections**，编辑内置内容块的顺序和文本，关闭该内容块，或选择 **Restore default** 恢复原值。
4. 在 **Complete preview** 中确认启用项的最终顺序与未解析模板。
5. 选择 **Save changes**。保存成功后，后续组装立即使用新配置。

## 构建

构建依赖一个已安装依赖并完成构建的 DSH 源码树。脚本临时连接 DSH 的 TypeScript、tsdown、工作区类型与平台模块表，完成后删除这些临时连接；不会修改 DSH 源码树。

```sh
DSH_ROOT=/path/to/dsh node scripts/build.mjs
```

也可通过 package script 执行：

```sh
DSH_ROOT=/path/to/dsh pnpm run build
```

构建先运行 TypeScript 项目检查，再由 `tsdown` 生成自包含的服务端 ESM 与浏览器端 bundle，最后把可分发产物写到插件根目录：

- `index.mjs`
- `client.js`
- `client.js.map`

浏览器端构建沿用 DSH 的 `CLIENT_EXTERNALS` 与 bundle 纯净度检查；React、runtime、web-react 等平台模块由宿主模块表提供，CSS Modules 由官方预设编译并内联注入。

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

- `dsh.plugin.json`、`client.js` 的模块加载器编号均为 `moeblack/prompt-studio`。
- 服务端导出 Cordis 的命名 `apply` / `inject` 表面；浏览器端 bundle 同样导出 `apply` / `inject`。
- `client.inject` 是启动图元数据；浏览器端实际等待的服务由 bundle 内 `inject = ['slots', 'conversation', 'connection']` 决定。
- `contributes.tools` 与 `contributes.skills` 均为空；本插件只通过既有配置、system-prompt 与界面接缝工作。
- `prompt-studio` 配置段使用保存后立即生效；已有会话历史不会因后续编辑而改写。
