# dsh-selection-toolbar

![license](https://img.shields.io/badge/license-MIT-blue.svg)
![npm](https://img.shields.io/npm/v/dsh-selection-toolbar.svg)

在 DeepSeek Harness 桌面端的 Web UI 里**选中文本或图片**时，选区旁边弹出一个浮动工具栏，提供三个动作。

Esc、滚动、缩放、点击空白处都会收起工具栏。

## 功能

| 按钮 | 行为 |
| --- | --- |
| 添加到对话 | 文本：先弹出一个单行**可选评论框**（回车或 ✓ 确认，Esc / 跳过 取消），确认后把选区以 Markdown 引用（`> …`）追加到**选区所在那个对话**的输入框草稿，并在输入框卡片正上方留一枚「N 条注释」药丸；图片：合成一次 paste 事件把图片插入输入框，失败则复制图片到剪贴板并提示粘贴 |
| 更多详情 | 就地展开详情卡：类型判定、字符 / 词 / 行 / 段统计、来源（助手回复 / 用户消息 / 工具调用）、全文、复制文本、复制引用、复制图片、保存图片；卡内主按钮**让 DeepSeek 详解（网页版，免费）**把选中内容写进剪贴板，然后在右栏的 `browser` tab 里打开免费网页版 DeepSeek |
| 在侧边聊天中提问 | 打开右栏的「侧边聊天」tab：里面是一个**真会话**（fork 自当前会话，继承主对话的上下文），把选区预填进它的输入框，等你确认后发送 |

「N 条注释」药丸：注释按**目标会话 id** 分开存，药丸读自己这个会话的注释，摘要作 tooltip，`×` 清除。挂在宿主的全宽 `conversation.input.dock` 席位（`order: 30`；宿主自己的 `todo` / `goal` / `queue` 药丸也在这一区，卡片内部那条轨道是单个固定席位、`composer.dock` 又渲染在卡片下方，所以这里是唯一能落在输入区里的位置）。两侧输入框各有自己的药丸，外层容器常驻挂载，靠挂载位置判断自己属于哪个会话。

## 安装

插件以 profile bundle 的形式安装：在 DSH 会话里调用 `plugin_manager` 工具（`target` 是它的参数），本地 checkout 和 npm registry 两种目标走同一条路。安装会落到 `<profile>/node_modules/<包名>` 下；换版本时先 `remove_bundle` 再装一次。

```text
# 本地 checkout（开发时用）
plugin_manager  install_bundle  target="file:C:/path/to/dsh-selection-toolbar"

# npm registry 上的已发布版本
plugin_manager  install_bundle  target="dsh-selection-toolbar"
```

要点：

* 改过代码后必须**重新安装**这个插件，再在宿主里按 **Ctrl+R** 刷新页面 —— 客户端插件是随页面启动图注入的，重装后不刷新不会生效。
* 包名必须能被 `createRequire(ctx.baseUrl).resolve('<包名>/package.json')` 解析，所以 `exports` 里显式导出了 `"./package.json"` 与 `"./cordis.patch.yml"`；缺了客户端模块系统会**静默跳过**这个包。
* 发布到 npm 的 tarball 里 `package.json` 是正常的公开包，不使用 `file:` 本地链接（那是本机开发时的安装方式，不会出现在发布产物里）。

## 使用

### 添加到对话

在正文里选中文本 → 工具栏 → 「添加到对话」→ 可选地写一句评论 → 回车。选区会以 Markdown 引用块追加到该对话输入框里已有的草稿后面，插入位置在评论框确认之后由插件自己决定。

选中的是图片时，插件合成一次 paste 事件把图片插入输入框；合成失败则改为复制图片到剪贴板，你在输入框里直接粘贴即可。

### 更多详情

「更多详情」就地展开一张卡，列出类型、统计、来源和全文，并提供复制/保存。卡内的主按钮 **让 DeepSeek 详解（网页版，免费）** 会：

1. 把**选中的内容本身**写进剪贴板（不带任何预置提问）；
2. 在右栏的 `browser` tab 里打开 `chat.deepseek.com`；右栏没有 browser 类型或不可用时，退回系统浏览器新标签；
3. 到了页面按一次 `Ctrl+A` 再 `Ctrl+V`（装了附带用户脚本则自动填入），问题自己打。

### 在侧边聊天中提问

「在侧边聊天中提问」打开右栏的原生「侧边聊天」tab，选区预填进该会话的输入框草稿（不会覆盖你已经打的字），你确认后按发送。tab 里的输入区、模型选择、权限模式、专家选择、麦克风、发送全部由宿主提供。

## 工作原理

### 选在哪，就写回哪

「添加到对话」要写当前会话的输入框草稿，但 `ctx.get('sessions')` 这个服务面既没有 `list`、也没有任何 current-session getter，所以"当前会话 id"只能从**会话作用域槽位**拿。插件注册了第二个条目 `conversation.input.right`（session 作用域，id `selection-toolbar-bridge`）作为 composer 桥：渲染器会给它 `sessionId` 与公开的 `inputActions`，它把自己登记进 `bridgeSeats`（`sessionId → 座位`）后渲染 `null`。

写入按三级降级，任何一级成功即止：

1. 服务面：`sessions.scope(targetId)` → `conversation.input.for(actx)` → `SessionInput.setDraft(next)`；
2. 桥面：该 zone 对应的座位 `actions.setDraft(next)`；
3. DOM：聚焦真实输入框、光标放到末尾、`document.execCommand('insertText')`，失败则用原型上的原生 `value` setter + `input` 事件（React 受控输入可感知）。

三级全失败时不再只是报错：内容自动复制到剪贴板，并提示可以直接粘贴。

**桥必须按会话外壳绑定，不能只留一个全局槽。** 侧边聊天是一个完整的会话外壳，页面里同时存在两个输入框（两个 `[data-input-scroll]`），`document.querySelector` 只会拿到先出现的那个。早期实现让后挂载的桥覆盖先挂载的，于是主聊天里选中的内容被写进了侧边聊天的输入框。现在 `bridgeSeats` 同时保留每个外壳的座位：`mainBridgeSeat()` 供主聊天与 `currentSessionId()` 使用，`sideBridgeSeat()` 供侧边聊天使用，座位只在所属外壳卸载时移除。取选区时记下 zone（`node.closest('.dsa-tab-body') ? 'side' : 'main'`），写入目标、DOM 兜底和注释归属全部按 zone 解析。

### 侧边聊天是右栏的原生 tab

面板不是自画浮层，而是宿主右栏里一个真正的 tab：

* 用 `ctx.sidebarRightTabs.register({ id, kind, title, guide })` 注册 tab 类型（`guide` 里的那一项会出现在右栏「+」引导页上），再用 `ctx.slots.register` 占住 `sidebar.right.pane.tab` 与 `sidebar.right.pane.tab.title` 两个 keyed 席位（`key` 必须等于 tab 的 `id`，`guide[].id` 也是必填）。
* 打开它用 `ctx.sidebarRight.openTab("<kind>", {})`；「让 DeepSeek 详解」用的是宿主自己的 `ctx.sidebarRight.openTab("browser", { params: { url } })`。
* tab 体渲染宿主的 `conversation.content` Factory（与官方子代理 tab 同一配方），所以输入区、模型选择、权限模式、专家、麦克风、发送都是宿主原生的，插件不解析事件流、也不调 `session.prompt`。

### fork 与「只记不印」

侧边聊天是 `sessions.fork({ sessionId, increaseTitle: false })`（不带 `atSeq`）出来的**分支会话**，因此它**真的**继承了主对话已有的全部问答记录 —— 这正是它的记忆，也是打开那一刻上下文开销的来源。

面板只打印侧边聊天**自己**的问答：宿主 Chat 视图的行带 `data-chat-turn="<轮号>"`，fork 时记下边界轮号（`sideBoundary[子会话 id]`，内存 Map，另镜像进 `localStorage` 的 `dsh.selectionToolbar.sideBoundary`），凡是 `data-chat-turn <= 边界` 的行加上 `data-dsa-inherited` 由 CSS 隐藏。**边界未知时什么都不隐藏** —— 宁可重印，也不能吃掉侧边聊天自己的回答。

隐藏只加 DOM 属性，不改会话、不删节点，会话本身的记忆分毫不动。宿主会虚拟化/重渲染 transcript，所以面板存活期间会周期性 + 用 `MutationObserver` 反复修补标记。

## 已知限制

* 图片插入依赖 `new ClipboardEvent('paste', { clipboardData })`，Chromium 内核可用，其他内核会退化到剪贴板复制。
* 跨域图片无法 `fetch` 成 Blob，此时「添加到对话」只能提示失败。
* `chat.deepseek.com` 会把用户**没有发送**的草稿持久化，重新打开该站也会还原。插件在自己的源里读不到也改不了另一个源的草稿，所以框里若还躺着旧文字，第一次需要手动 `Ctrl+A` → `Delete` 清掉。
* 侧边聊天用的是 fork 出来的分支会话：它出现在左侧会话列表里；同一次页面加载内重复打开复用同一个分支，刷新页面后第一次打开会再 fork 一个。tab 关闭时不主动 `release()` 这个 `SessionReference`（同一分支可能被另一个 tab 复用），它的 event window 会保留到刷新页面为止。
* 若 `SessionProvider` / `renderSlot` 没有被注入（宿主改版），tab 里会显示一行说明文字而不是空白；fork 失败则显示「无法开始侧边聊天」。
* 引导页的副标题只在条目总数 ≤ 4 时显示（宿主 `MAX_DESCRIBED_ENTRIES = 4`）。本插件加了一行之后总数变成 5，所有胶囊都只剩标题 + 图标；更想保留官方四行的副标题，可以把 `installTab()` 里的 `guide` 数组清空（工具栏按钮仍会照常打开 tab）。

## 开发

Host 半体（`lib/index.js`）是一个空插件：没有 Config、没有 Service、没有路由，它存在只是为了让 Loader 有一条真实条目，从而让客户端模块系统把 `./client` 打进启动图（`package.json` 的 `dsh.client.platform = "web"`）。全部功能在 `client/client.js`。

```powershell
# 从源码装（改完代码后重跑，再到宿主里 Ctrl+R）
plugin_manager install_bundle target="file:C:/path/to/dsh-selection-toolbar"
```

验证方式：在会话里选中文本，依次试三个按钮，确认写入落在正确的输入框、侧边聊天 tab 正常打开、继承行被隐藏。开发期用过的临时诊断通道已经移除，代码里不再有探针，也不会有对应的宿主读取手段。

## 发布（维护者）

```powershell
npm run check        # node --check lib/index.js 与 client/client.js
npm pack --dry-run   # 确认 tarball 只含 lib/ client/ userscript/ cordis.patch.yml README CHANGELOG LICENSE package.json
npm publish          # 包名未占用；非 scope 包，默认就是公开的
```

`package.json` 里保留 `"private": true` 会让 `npm publish` 直接失败（发布版已经去掉）；`tools/` 下的 asar 取证脚本只在 `files` 之外，永远不会进 tarball。

## 许可

MIT

## Summary (English)

`dsh-selection-toolbar` is a DSH client plugin. Selecting text or an image in the desktop web UI pops up a floating toolbar with three actions: **Add to chat** (appends the selection as a Markdown quote, with an optional comment, to the composer of the conversation the selection came from), **More details** (a details card whose main button copies the selection and opens the free DeepSeek web app), and **Ask in a side chat** (opens a real fork of the current session in the right-hand column's native tab, with the inherited rows hidden by a turn boundary).

All logic lives in the client half; the host half is an empty plugin entry that only puts the browser bundle into the boot graph. The side chat reuses the host's own conversation shell, so its input box, model picker, permission mode and send button are all native. The web-app path relies on the clipboard as the real transport plus a unique `&t=` timestamp in the URL, because the host cannot inject text across origins. Licensed MIT.
