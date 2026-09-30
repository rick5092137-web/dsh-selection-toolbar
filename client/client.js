window.__ModuleLoader__.load({
	id: "dsh-selection-toolbar",
	factory: (require) => {
		"use strict";

		/**
		 * Client half of `dsh-selection-toolbar`.
		 *
		 * Contributes exactly one entry to the frame-wide `shell.overlay` slot and
		 * renders it through a portal into <body>, so the floating bar is never
		 * clipped by a column, a scroll container or a transformed ancestor.
		 *
		 * Feature mapping
		 *   添加到对话          append the selection to the composer draft (text)
		 *                       or synthesize a paste into the composer (images)
		 *   更多详情            expand an inline dossier: stats, kind, source,
		 *                       full text, copy / save actions
		 *   在侧边聊天中提问    this host exposes no API to open the right sidebar
		 *                       or one of its tabs (`layout.openRightbar` only
		 *                       *reports* the panel's presentation and
		 *                       `rightbar.session` is a single occupied slot), so
		 *                       this starts a NEW session and pre-fills the
		 *                       question there — documented in the package README.
		 */

		const React = require("react");
		const h = React.createElement;

		let createPortal = null;
		try {
			const ReactDOM = require("react-dom");
			if (ReactDOM && typeof ReactDOM.createPortal === "function") createPortal = ReactDOM.createPortal;
		} catch (error) {
			createPortal = null;
		}

		const PLUGIN_ID = "dsh-selection-toolbar";
		const NS = "selection-toolbar";
		const MARK = "data-selection-toolbar";
		/**
		 * Marks *our* floating UI (toolbar, comment box, detail card, notes chip,
		 * toast). It is deliberately separate from `MARK`: `MARK` also sits on the
		 * side-chat pane, and that pane is a normal reading surface — the user
		 * selects text in it and uses 「添加到对话」 on the selection. Only the
		 * floating layer must stay unselectable.
		 */
		const LAYER = "data-dsa-layer";
		/**
		 * Marks a message row the side chat inherited from the main conversation but
		 * deliberately does not print. Display only: the Session keeps the context.
		 * The mark goes on whole *Turns*, matched by the Turn they belong to, so the
		 * side chat's own Turns are never touched (see applyInheritedMask).
		 */
		const INHERITED_ATTR = "data-dsa-inherited";
		/** The Chat view's transcript column; its children are the rows. */
		const CHAT_COLUMN = "[data-chat-flow]";
		/** The Turn a Chat row belongs to — the host reads the same attribute. */
		const CHAT_TURN_ATTR = "data-chat-turn";
		/** Where the inherited/own Turn boundary is remembered across a reload. */
		const SIDE_BOUNDARY_KEY = "dsh.selectionToolbar.sideBoundary";
		const BLOCKED = 'textarea, input, select, [contenteditable="true"], [' + LAYER + ']';
		const MAX_DRAFT = 20000;
		const MAX_IMAGES = 8;
		/**
		 * The right-hand column tab this plugin contributes. `sidebarRight` picks a
		 * tab by *kind*; `sidebarRightTabs` registers the kind and its guide entry,
		 * and `sidebar.right.pane.tab` renders one tab's body by definition id.
		 */
		const SIDE_KIND = "selection-chat";
		/**
		 * Which fork anchor the current side chat was created with. `"full"` means the
		 * fork inherited the source conversation's whole record; anything else is an
		 * older side chat that a fresh open has to replace.
		 */
		const SIDE_ANCHOR = "full";
		/**
		 * The child slot our tab seat declares and fills, exactly like the subagent
		 * tab does: the Kit renders the shipped `conversation.content` Factory in it.
		 */
		const SIDE_SLOT = "selection-toolbar.conversation";

		const ZH = {
			addToChat: "添加到对话",
			details: "更多详情",
			askSide: "在侧边聊天中提问",
			addToChatHint: "把选中的内容添加为引用（可附一句评论）",
			detailsHint: "只复制选中的内容，在免费的网页版 DeepSeek 里打开（优先右侧栏的浏览器标签）",
			askSideHint: "打开侧边聊天面板，就这段内容提问",
			panelTitle: "选中内容详情",
			chars: "字符",
			words: "词",
			lines: "行",
			paragraphs: "段落",
			kind: "类型",
			source: "来源",
			fullText: "全文",
			copyText: "复制文本",
			copyQuote: "复制引用",
			copyImage: "复制图片",
			saveImage: "保存图片",
			copied: "已复制到剪贴板",
			copyFailed: "复制失败，请手动选择复制",
			added: "已添加到输入框",
			addedSide: "已添加到侧边聊天的输入框",
			noComposer: "没有找到可写入的输入框",
			imagesInserted: "已把图片插入输入框（若未出现，请在输入框内直接粘贴）",
			imageCopied: "已复制图片，可在输入框内粘贴",
			imageFailed: "读取图片失败，请改用截图或拖拽插入",
			asking: "正在新建会话…",
			askDone: "已在新会话中预填提问",
			askFallback: "新会话未就绪，已把提问放进当前输入框",
			emptyText: "（没有文本，只有图片）",
			sceneConversation: "会话内容",
			sceneOther: "页面内容",
			zoneSide: "侧边聊天",
			kindCode: "代码",
			kindTable: "表格",
			kindQuote: "引用",
			kindMarkdown: "Markdown",
			kindImage: "图片",
			kindText: "纯文本",
			roleAssistant: "助手回复",
			roleUser: "用户消息",
			roleTool: "工具调用",
			imageLabel: "图片",
			deepDive: "让 DeepSeek 详解（网页版，免费）",
			deepDiveHint: "只把选中的内容复制到剪贴板，并在右侧栏的浏览器标签里打开免费的网页版 DeepSeek（不带任何预置提问；框里若还留着旧草稿，先 Ctrl+A 再 Delete，然后 Ctrl+V 贴入）",
			openWebDone: "已复制选中内容并打开网页版 —— 框里若还留着旧草稿先 Ctrl+A、Delete，再 Ctrl+V 贴入，然后提问",
			openWebSide: "已在右侧栏的浏览器标签里打开 DeepSeek 网页版（选中内容已复制：框里若还留着旧草稿先 Ctrl+A、Delete，再 Ctrl+V 贴入）",
			openWebFailed: "打开网页失败，请手动访问 chat.deepseek.com（选中内容已复制）",
			deepWebNote: "这一段只复制你选中的内容，不附带任何预置指令。网页版会把上一次没发送的草稿一直留着（那是 chat.deepseek.com 自己的数据，插件跨源清不掉），所以如果框里还躺着旧的文字，第一次先 Ctrl+A 再 Delete 清掉它；之后 Ctrl+V 贴入的就是当前选区。装了油猴脚本（userscript/deepseek-q.user.js）则会在页面打开时自动把选区填进去。",
			noComposerCopied: "没有找到可写入的输入框，已复制到剪贴板，可直接粘贴",
			commentPlaceholder: "添加可选评论…",
			commentAdd: "添加",
			commentSkip: "仅引用",
			commentHint: "回车添加，Esc 取消",
			noteSuffix: " 条注释",
			noteClear: "清除注释",
			sideTitle: "侧边聊天",
			sideHint: "侧边聊天是临时对话：它另开一个独立的小会话，用的是同一套输入框，不会影响当前会话；关掉页签后内容仍留在会话列表里。",
			sidePlaceholder: "随心输入",
			sideSend: "发送",
			sideFailed: "提问失败，请稍后重试",
			sideNoSession: "当前没有可用的会话，无法开启侧边聊天",
			sideStarting: "正在准备侧边聊天…",
			sideNoDock: "没有找到打开右侧栏的入口：请先打开右侧栏，再点顶部的 + 选择「侧边聊天」",
			sideAddToChat: "把这段回答添加到对话",
			sideAddedAnswer: "已把这段回答添加到输入框",
			sideCopyAnswer: "复制回答",
			sideWeb: "用免费的网页版详解",
			sideClose: "关闭侧边聊天",
			sideGuideHint: "就选中的内容在本栏开一个会话：继承当前对话已有的问答记录，但之后的新问答不会写回主对话。",
		};

		const EN = {
			addToChat: "Add to chat",
			details: "More details",
			askSide: "Ask in a side chat",
			addToChatHint: "Add the selection as a quote (with an optional comment)",
			detailsHint: "Copy the selection and open it in the free DeepSeek web app (the browser tab in the right-hand column when available)",
			askSideHint: "Open the side chat and ask about this content",
			panelTitle: "Selection details",
			chars: "Chars",
			words: "Words",
			lines: "Lines",
			paragraphs: "Paragraphs",
			kind: "Kind",
			source: "Source",
			fullText: "Full text",
			copyText: "Copy text",
			copyQuote: "Copy quote",
			copyImage: "Copy image",
			saveImage: "Save image",
			copied: "Copied to clipboard",
			copyFailed: "Copy failed — select and copy manually",
			added: "Added to the composer",
			addedSide: "Added to the side chat composer",
			noComposer: "No writable composer found",
			imagesInserted: "Images pasted into the composer (paste manually if nothing appeared)",
			imageCopied: "Image copied — paste it into the composer",
			imageFailed: "Could not read the image; use a screenshot or drag it in",
			asking: "Starting a new chat…",
			askDone: "Question pre-filled in the new chat",
			askFallback: "New chat was not ready; the question went to the current composer",
			emptyText: "(no text, images only)",
			sceneConversation: "Conversation",
			sceneOther: "Page content",
			zoneSide: "Side chat",
			kindCode: "Code",
			kindTable: "Table",
			kindQuote: "Quote",
			kindMarkdown: "Markdown",
			kindImage: "Image",
			kindText: "Plain text",
			roleAssistant: "Assistant reply",
			roleUser: "User message",
			roleTool: "Tool call",
			imageLabel: "Image",
			deepDive: "Explain on the free web app",
			deepDiveHint: "Copy just the selection to the clipboard and open the free DeepSeek web app in the right-hand browser tab (no canned prompt: if an old draft is still in the box, clear it with Ctrl+A then Delete, then paste with Ctrl+V)",
			openWebDone: "Selection copied and the web app is opening — if an old draft is still in the box, clear it with Ctrl+A then Delete, paste with Ctrl+V, then ask your question",
			openWebSide: "Opened the DeepSeek web app in the right-hand browser tab (selection copied: if an old draft is still in the box, clear it with Ctrl+A then Delete, then paste with Ctrl+V)",
			openWebFailed: "Could not open the web app; visit chat.deepseek.com manually (selection copied)",
			deepWebNote: "This action copies only what you selected — no canned instruction. The web app keeps restoring the draft you never sent (that draft lives in chat.deepseek.com's own storage, unreachable from this plugin), so if old text is still sitting in the box, clear it once with Ctrl+A then Delete; after that Ctrl+V pastes the current selection. With the bundled userscript (userscript/deepseek-q.user.js) the selection is filled in automatically when the page opens.",
			noComposerCopied: "No writable composer found — copied to the clipboard instead, just paste",
			commentPlaceholder: "Add an optional comment…",
			commentAdd: "Add",
			commentSkip: "Quote only",
			commentHint: "Enter to add, Esc to cancel",
			noteSuffix: " notes",
			noteClear: "Clear notes",
			sideTitle: "Side chat",
			sideHint: "The side chat is temporary: it opens its own small session with the same composer, so the chat you are in is untouched. Closing the tab keeps it in the session list.",
			sidePlaceholder: "Ask anything",
			sideSend: "Send",
			sideFailed: "The question failed — please try again",
			sideNoSession: "No session available, so the side chat cannot open",
			sideStarting: "Preparing the side chat…",
			sideNoDock: "No way to open the right-hand column: open it first, then use its + control and pick Side chat",
			sideAddToChat: "Add this answer to the chat",
			sideAddedAnswer: "Answer added to the composer",
			sideCopyAnswer: "Copy answer",
			sideWeb: "Explain on the free web app",
			sideClose: "Close the side chat",
			sideGuideHint: "Ask about the selection in this column: it inherits this conversation's record, and its own messages never write back into the main chat.",
		};

		const CSS = [
			".dsa-surface{position:fixed;z-index:2147483000;pointer-events:auto;font-family:inherit;font-size:13px;line-height:1.45;color:var(--dsw-alias-label-primary,#14161a);-webkit-font-smoothing:antialiased;text-align:left}",
			".dsa-card{background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,#fff));border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.16),0 2px 6px rgba(0,0,0,.08);overflow:hidden}",
			".dsa-bar{display:flex;align-items:center;padding:3px}",
			".dsa-btn{appearance:none;border:0;background:transparent;color:inherit;font:inherit;padding:5px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}",
			".dsa-btn:hover{background:rgba(127,127,127,.16)}",
			".dsa-btn[data-active=true]{background:rgba(127,127,127,.2)}",
			".dsa-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}",
			".dsa-sep{width:1px;align-self:stretch;margin:4px 2px;background:var(--dsw-alias-border-l1,rgba(0,0,0,.1))}",
			".dsa-panel{width:min(460px,calc(100vw - 40px));max-height:min(58vh,520px);overflow:auto;padding:10px 12px 12px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1))}",
			".dsa-title{font-weight:600;margin:0 0 6px}",
			".dsa-row{display:flex;gap:8px;align-items:baseline;margin:2px 0}",
			".dsa-k{color:var(--dsw-alias-label-secondary,#6b7280);flex:0 0 56px}",
			".dsa-v{flex:1;min-width:0;word-break:break-word}",
			".dsa-pre{margin:8px 0 0;padding:8px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}",
			".dsa-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}",
			".dsa-note{margin-top:8px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,#6b7280)}",
			".dsa-chip{appearance:none;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));background:transparent;color:inherit;font:inherit;padding:4px 10px;border-radius:999px;cursor:pointer}",
			".dsa-chip:hover{background:rgba(127,127,127,.14)}",
			".dsa-chip[data-primary=true]{border-color:var(--dsw-alias-brand-primary,#4d6bfe);color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:600}",
			".dsa-chip[data-primary=true]:hover{background:rgba(77,107,254,.12)}",
			".dsa-thumb{display:flex;gap:8px;align-items:center;margin-top:6px}",
			".dsa-thumb img{max-width:84px;max-height:60px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));object-fit:cover}",
			".dsa-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:2147483001;background:var(--dsw-alias-bg-overlay,#1f2126);color:var(--dsw-alias-label-primary,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));box-shadow:0 8px 24px rgba(0,0,0,.2);padding:7px 14px;border-radius:999px;font-size:13px;pointer-events:none;max-width:80vw}",
			".dsa-toast[data-kind=error]{color:var(--dsw-alias-state-error-primary,#e5484d)}",
			".dsa-comment{display:flex;gap:4px;align-items:center;padding:5px 6px;border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1))}",
			".dsa-comment input{flex:1;min-width:140px;appearance:none;border:0;background:transparent;color:inherit;font:inherit;padding:4px 4px;outline:none}",
			".dsa-comment input::placeholder{color:var(--dsw-alias-label-secondary,#9aa1ab)}",
			".dsa-icon{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#6b7280);font:inherit;padding:4px 8px;border-radius:8px;cursor:pointer;white-space:nowrap}",
			".dsa-icon:hover{background:rgba(127,127,127,.16);color:inherit}",
			".dsa-icon[data-strong=true]{color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:600}",
			".dsa-side{position:fixed;top:56px;right:14px;bottom:14px;width:min(420px,calc(100vw - 28px));display:flex;flex-direction:column;z-index:2147483000;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.1));border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.2);overflow:hidden;font-family:inherit;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary,#14161a);-webkit-font-smoothing:antialiased;text-align:left}",
			".dsa-side-embedded{position:relative;top:auto;right:auto;bottom:auto;left:auto;width:100%;height:100%;max-height:none;border:0;border-radius:0;box-shadow:none;z-index:auto;min-height:0}",
			".dsa-tab-title{font-weight:600}",
			/*
			 * The embedded pane must hand the Factory a full-height box, exactly as the
			 * shipped right-column chat tab does (`.wrucma_root{width:100%;height:100%;
			 * display:flex}`). `renderSlot` wraps its occupant in an anchor div with
			 * `display:contents`, which creates NO box — so the real conversation root is
			 * the DOM grandchild, and the stretch has to be declared there, not on `>*`.
			 * Without it the message area collapses to zero, leaving the composer alone
			 * at the top of the pane.
			 */
			".dsa-tab-body{width:100%;min-width:0;height:100%;min-height:0;display:flex}",
			".dsa-tab-body>*{min-width:0;min-height:0}",
			".dsa-tab-body>*>*{flex:1 1 auto;min-width:0;min-height:0}",
			/* A blank Session renders no conversation view (only the composer), so the
			 * Fact column would leave the composer alone at the TOP. Bottom-align that
			 * column while the Session is blank, exactly like a conversation that has
			 * content. Harmless once the view exists: it is flex:1 and fills the column. */
			".dsa-tab-body-blank>*>*{justify-content:flex-end}",
			/* The side chat forks the main conversation, so its Session really does
			 * remember every earlier turn — but the panel must not print that record
			 * again. Every row of an inherited Turn is marked (never removed), which
			 * hides it from view while leaving the Session's context untouched. */
			".dsa-tab-body [" + INHERITED_ATTR + "]{display:none !important}",
			".dsa-tab-note{flex:1;display:flex;align-items:center;justify-content:center;padding:18px;text-align:center;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px;line-height:1.6}",
			".dsa-side-head{display:flex;align-items:center;gap:6px;padding:8px 8px 8px 12px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));flex:0 0 auto}",
			".dsa-side-title{font-weight:600;flex:0 0 auto}",
			".dsa-ctx{flex:1;min-width:0;display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px}",
			".dsa-ctx-chip{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12));border-radius:6px;padding:1px 6px}",
			".dsa-side-head .dsa-icon{font-size:12px}",
			".dsa-side-body{flex:1;min-height:0;overflow:auto;padding:12px 12px 2px}",
			".dsa-side-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--dsw-alias-label-secondary,#6b7280)}",
			".dsa-side-badge{width:42px;height:42px;border-radius:50%;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1}",
			".dsa-side-note{max-width:270px;text-align:center;font-size:12px}",
			".dsa-msg{margin:0 0 12px}",
			".dsa-msg-user{display:flex;justify-content:flex-end}",
			".dsa-msg-user>div{max-width:86%;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));border-radius:12px;padding:7px 10px;white-space:pre-wrap;word-break:break-word}",
			".dsa-msg-ai>div{word-break:break-word}",
			".dsa-md p{margin:0 0 8px}",
			".dsa-md ul{margin:0 0 8px;padding-left:20px}",
			".dsa-md li{margin:2px 0}",
			".dsa-md h4{margin:10px 0 6px;font-size:13px;font-weight:600}",
			".dsa-md code{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));border-radius:4px;padding:1px 4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}",
			".dsa-md pre{margin:0 0 8px;padding:8px 10px;overflow:auto;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border-radius:8px}",
			".dsa-md pre code{background:transparent;padding:0}",
			".dsa-caret{display:inline-block;width:7px;height:14px;margin-left:2px;vertical-align:-2px;background:var(--dsw-alias-brand-primary,#4d6bfe);animation:dsa-blink 1s steps(2,start) infinite}",
			"@keyframes dsa-blink{to{visibility:hidden}}",
			".dsa-side-foot{flex:0 0 auto;padding:10px}",
			".dsa-side-input{display:flex;align-items:flex-end;gap:8px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.12));border-radius:12px;padding:6px 8px;background:var(--dsw-alias-bg-layer-1,#fff)}",
			".dsa-side-input:focus-within{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsa-side-input textarea{flex:1;min-width:0;max-height:120px;resize:none;appearance:none;border:0;background:transparent;color:inherit;font:inherit;line-height:1.5;padding:2px 0;outline:none}",
			".dsa-side-input textarea::placeholder{color:var(--dsw-alias-label-secondary,#9aa1ab)}",
			".dsa-send{appearance:none;border:0;width:28px;height:28px;flex:0 0 auto;border-radius:50%;background:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0}",
			".dsa-send[disabled]{opacity:.45;cursor:default}",
			".dsa-err{color:var(--dsw-alias-state-error-primary,#e5484d);font-size:12px;padding:0 12px 8px}",
			".dsa-notes{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);padding:2px}",
			".dsa-notes-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:999px;padding:3px 7px 3px 9px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));max-width:min(620px,72vw)}",
			".dsa-notes-chip svg{flex:0 0 auto;opacity:.7}",
			".dsa-notes-chip .dsa-icon{padding:1px 5px;border-radius:999px}",
		].join("\n");

		/* ---------------------------------------------------------------- store */

		let state = {
			open: false,
			expanded: false,
			commentOpen: false,
			text: "",
			images: [],
			anchor: null,
			source: "",
			/**
			 * Which conversation the current selection came from: `"main"` for the
			 * chat on screen, `"side"` for the side-chat tab. 「添加到对话」 writes
			 * the quote back into the composer the user selected from.
			 */
			zone: "main",
			toast: null,
		};
		const listeners = new Set();

		function getState() {
			return state;
		}

		function setState(patch) {
			state = Object.assign({}, state, patch);
			listeners.forEach(function (fn) {
				try {
					fn();
				} catch (error) {
					/* a broken renderer must not break the store */
				}
			});
		}

		function subscribe(fn) {
			listeners.add(fn);
			return function () {
				listeners.delete(fn);
			};
		}

		/* ------------------------------------------------------------ utilities */

		let rootCtx = null;
		let t = function (key) {
			return ZH[key] || key;
		};
		const timers = new Set();
		let toastToken = 0;

		function later(fn, ms) {
			const id = window.setTimeout(function () {
				timers.delete(id);
				fn();
			}, ms);
			timers.add(id);
			return id;
		}

		/**
		 * Composer bridge, published by the session-scoped entries registered in the
		 * composer's list slots. Those are the only public surfaces that hand a
		 * plugin the live `sessionId` and `inputActions` of the Session on screen —
		 * `ctx.sessions` itself has no list and no current-id getter.
		 */
		let bridge = null;

		/**
		 * Every live composer bridge, keyed by Session. One conversation shell
		 * publishes one seat, and a single shell is not always on screen: the side
		 * chat renders a second shell for its own Session. Keeping only the last
		 * seat let that one (mounted later, same score) displace the main shell, so
		 * `currentSessionId()` reported the side Session and main-chat selections
		 * were written into the side composer. Seats keep both, and callers pick the
		 * one their zone needs.
		 */
		const bridgeSeats = new Map();

		/** Session id seen on any session-scoped composer entry; bridge fallback. */
		let composerSessionId = null;

		/** True from pointerdown inside our own surface until that press settles. */
		let pointerOnPanel = false;
		/** Timestamp of the last press whose action already ran (see routePress). */
		let pressHandledAt = 0;

		function ctxGet(name) {
			if (!rootCtx || typeof rootCtx.get !== "function") return undefined;
			try {
				return rootCtx.get(name);
			} catch (error) {
				return undefined;
			}
		}

		function clamp(value, min, max) {
			if (max < min) return min;
			return Math.min(Math.max(value, min), max);
		}

		function elementOf(node) {
			if (!node) return null;
			if (node.nodeType === 1) return node;
			return node.parentElement || null;
		}

		function isOwn(node) {
			return !!(node && node.closest && node.closest("[" + LAYER + "]"));
		}

		/**
		 * Which conversation a node belongs to. The side-chat tab renders the
		 * shipped conversation shell inside `.dsa-tab-body`, so that class is the
		 * one reliable boundary between "the chat on screen" and "the side chat".
		 */
		function zoneOf(node) {
			const el = elementOf(node);
			return el && el.closest && el.closest(".dsa-tab-body") ? "side" : "main";
		}

		function toast(text, kind, ms) {
			const token = ++toastToken;
			setState({ toast: { text: text, kind: kind || "info" } });
			later(function () {
				if (token !== toastToken) return;
				setState({ toast: null });
			}, ms || 2400);
		}

		/**
		 * Press routing. The floating layer lives in a host overlay whose React
		 * event delegation proved unreliable (the observed "click does nothing"),
		 * so the actual dispatch happens in a `window` capture listener that reads
		 * `data-dsa-act` off the pressed node — window capture runs before any
		 * document-level handler the shell installs. The React handlers are gone on
		 * purpose: one path only, so an action can never run twice.
		 */
		const pressActions = {};

		function routePress(act, event) {
			const handler = pressActions[act];
			if (typeof handler !== "function") return;
			const now = Date.now();
			if (now - pressHandledAt < 900) return;
			pressHandledAt = now;
			if (event && event.preventDefault) event.preventDefault();
			if (event && event.stopPropagation) event.stopPropagation();
			try {
				handler(event);
			} catch (error) {
				console.warn(NS + " the " + act + " action failed", error);
			}
		}

		function pressProps(handler, key, act) {
			const action = act || key;
			pressActions[action] = handler;
			return { key: key, "data-dsa-act": action, type: "button" };
		}

		function hide() {
			if (!state.open && !state.expanded && !state.commentOpen) return;
			setState({ open: false, expanded: false, commentOpen: false, toast: state.toast });
		}

		/* --------------------------------------------------------- selection io */

		function anchorRectOf(range) {
			let rect = null;
			try {
				const rects = range.getClientRects();
				if (rects && rects.length) rect = rects[rects.length - 1];
			} catch (error) {
				rect = null;
			}
			if (!rect || (!rect.width && !rect.height)) {
				try {
					rect = range.getBoundingClientRect();
				} catch (error) {
					rect = null;
				}
			}
			if (!rect) return null;
			if (!rect.width && !rect.height && !rect.top && !rect.left) return null;
			return rect;
		}

		function collectImages(range) {
			const out = [];
			const seen = new Set();
			function push(img) {
				if (!img || seen.has(img)) return;
				if (!img.currentSrc && !img.src) return;
				seen.add(img);
				out.push(img);
			}
			try {
				const fragment = range.cloneContents();
				const found = fragment.querySelectorAll ? fragment.querySelectorAll("img") : [];
				Array.prototype.forEach.call(found, push);
			} catch (error) {
				/* cloneContents can throw on exotic ranges */
			}
			if (!out.length) {
				const whole = elementOf(range.commonAncestorContainer);
				if (whole && whole.tagName === "IMG") push(whole);
			}
			return out.slice(0, MAX_IMAGES);
		}

		function readSelection() {
			let selection = null;
			try {
				selection = window.getSelection();
			} catch (error) {
				return null;
			}
			if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
			let text = "";
			try {
				text = String(selection.toString() || "");
			} catch (error) {
				text = "";
			}
			const range = selection.getRangeAt(0);
			const node = elementOf(range.commonAncestorContainer);
			if (!node || !node.closest) return null;
			if (node.closest(BLOCKED)) {
				return null;
			}
			const images = collectImages(range);
			if (!text.trim() && !images.length) return null;
			const rect = anchorRectOf(range);
			if (!rect) return null;
			return { text: text, images: images, rect: rect, node: node, zone: zoneOf(node) };
		}

		function imageTarget(target) {
			if (!target || !target.closest) return null;
			const img = target.tagName === "IMG" ? target : target.closest("img");
			if (!img || (img.closest && img.closest(BLOCKED))) return null;
			const rect = img.getBoundingClientRect();
			if (!rect.width && !rect.height) return null;
			return img;
		}

		/**
		 * The 「来源」 line of the tool card. It also tells the user *where*
		 * 「添加到对话」 will put the quote: a selection made in the side-chat tab is
		 * labelled as such. */
		function describeSource(node) {
			const inSide = zoneOf(node) === "side";
			const prefix = inSide ? t("zoneSide") + " · " : "";
			try {
				const marker = node.closest(
					"[data-chat-node-kind], [data-chat-node], [data-message-id], [data-role]",
				);
				if (marker && marker.dataset) {
					const ds = marker.dataset;
					const kind = ds.chatNodeKind || ds.chatNode || ds.role;
					if (kind) {
						const map = {
							"assistant-step": t("roleAssistant"),
							user: t("roleUser"),
							"tool-call": t("roleTool"),
						};
						return prefix + (map[kind] || kind);
					}
				}
				if (node.closest("[data-conversation-scroll]")) {
					return inSide ? t("zoneSide") : t("sceneConversation");
				}
			} catch (error) {
				/* fall through to the generic label */
			}
			return inSide ? t("zoneSide") : t("sceneOther");
		}

		function anchorOf(rect) {
			return { cx: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom };
		}

		function showFor(descriptor) {
			setState({
				open: true,
				expanded: false,
				text: descriptor.text,
				images: descriptor.images,
				anchor: anchorOf(descriptor.rect),
				source: describeSource(descriptor.node),
				zone: descriptor.zone || "main",
			});
		}

		function reposition(descriptor) {
			setState({
				text: descriptor.text,
				images: descriptor.images,
				anchor: anchorOf(descriptor.rect),
				source: describeSource(descriptor.node),
				zone: descriptor.zone || "main",
			});
		}

		function refresh(keepExpanded) {
			const descriptor = readSelection();
			if (!descriptor) {
				hide();
				return;
			}
			if (keepExpanded && state.open) reposition(descriptor);
			else showFor(descriptor);
		}

		/* ------------------------------------------------- composer integration */

		/**
		 * True for the Session the side-chat pane renders (its own shell, its own
		 * fork). Those ids must never be mistaken for "the Session on screen".
		 * `dockSessionId` is deliberately absent: slot props hand the pane the
		 * workspace's Session id, which is the main chat.
		 */
		function isSideSession(sessionId) {
			if (typeof sessionId !== "string" || !sessionId) return false;
			return sessionId === sidePaneSessionId || sessionId === side.sessionId;
		}

		/** The bridge of a shell that is not the side pane: the main conversation. */
		function mainBridgeSeat() {
			if (bridge && bridge.sessionId && !isSideSession(bridge.sessionId)) return bridge;
			const seats = Array.from(bridgeSeats.values());
			for (let index = seats.length - 1; index >= 0; index -= 1) {
				if (seats[index] && seats[index].sessionId && !isSideSession(seats[index].sessionId)) {
					return seats[index];
				}
			}
			return null;
		}

		/** The bridge published inside the side-chat pane, if that pane is open. */
		function sideBridgeSeat() {
			const sessionId = sidePaneSessionId || side.sessionId;
			if (!sessionId) return null;
			return bridgeSeats.get(sessionId) || null;
		}

		/** The bridge the given zone should write through. */
		function bridgeSeatFor(zoneName) {
			return zoneName === "side" ? sideBridgeSeat() : mainBridgeSeat();
		}

		function currentSessionId() {
			const main = mainBridgeSeat();
			if (main && main.sessionId) return main.sessionId;
			if (composerSessionId && !isSideSession(composerSessionId)) return composerSessionId;
			const sessions = ctxGet("sessions");
			if (!sessions) return undefined;
			try {
				if (sessions.list && typeof sessions.list.getSnapshot === "function") {
					const snapshot = sessions.list.getSnapshot();
					if (snapshot && snapshot.current) return snapshot.current;
				}
				if (typeof sessions.getSnapshot === "function") {
					const snapshot = sessions.getSnapshot();
					if (snapshot && snapshot.current) return snapshot.current;
				}
			} catch (error) {
				/* the session list may not be projected yet */
			}
			return undefined;
		}

		function inputFor(sessionId) {
			if (!sessionId) return null;
			const sessions = ctxGet("sessions");
			const conversation = ctxGet("conversation");
			if (!sessions || !conversation || !conversation.input) return null;
			try {
				const actx = typeof sessions.scope === "function" ? sessions.scope(sessionId) : undefined;
				if (!actx) return null;
				if (typeof conversation.input.for !== "function") return null;
				return conversation.input.for(actx) || null;
			} catch (error) {
				return null;
			}
		}

		function currentInput() {
			return inputFor(currentSessionId());
		}

		/**
		 * The selection's conversation. `"side"` means the side-chat tab, whose pane
		 * owns its own Session and its own composer.
		 */
		function zone() {
			return state.zone === "side" ? "side" : "main";
		}

		/** The Session 「添加到对话」 must write into for the current selection. */
		function zoneSessionId() {
			if (zone() === "side") {
				/*
				 * Only the pane's own Session is a valid side target. `dockSessionId`
				 * is the workspace id the pane's slot props carry (the main chat), so
				 * falling back to it would write a side selection into the main
				 * composer; an unresolved pane is left to the pane-local DOM tier.
				 */
				return sidePaneSessionId || side.sessionId || undefined;
			}
			return currentSessionId();
		}

		/*
		 * The shipped composer is `div[data-input-scroll]` wrapping a
		 * contenteditable that carries `data-phase` — there is no textarea and no
		 * `data-composer-*` attribute, so the contenteditable selectors must come
		 * first (checked against the packaged ui-conversation markup).
		 */
		const COMPOSER_SELECTORS = [
			"[data-input-scroll] [contenteditable='true']",
			"[data-input-scroll] [data-phase]",
			"textarea[data-input-scroll]",
			"[data-input-scroll] textarea",
			"[data-composer-card] [contenteditable='true']",
			"[data-composer-card] textarea",
			"[data-composer-seat] textarea",
			"[contenteditable='true'][role='textbox']",
		];

		function editorIn(root) {
			if (!root || typeof root.querySelector !== "function") return null;
			for (let i = 0; i < COMPOSER_SELECTORS.length; i += 1) {
				const el = root.querySelector(COMPOSER_SELECTORS[i]);
				if (el) return el;
			}
			return null;
		}

		/**
		 * The main conversation's composer. The side pane is a second conversation
		 * shell in the same document, so picking the first editor in document order
		 * is only safe once the pane's own editors are skipped.
		 */
		function composerTextarea() {
			const pane = sidePane();
			const nodes = document.querySelectorAll(COMPOSER_SELECTORS.join(","));
			for (let i = 0; i < nodes.length; i += 1) {
				if (!pane || !pane.contains(nodes[i])) return nodes[i];
			}
			return editorIn(document);
		}

		/**
		 * The editor the action must target: the side pane's own composer when the
		 * selection came from the side chat, the on-screen composer otherwise.
		 * Document order cannot decide this — the side pane is a second conversation
		 * shell with a second `[data-input-scroll]`.
		 */
		function zoneEditor() {
			if (zone() === "side") {
				const el = editorIn(sidePane());
				if (el) return el;
			}
			return composerTextarea();
		}

		function focusComposer(forcedZone) {
			const want = forcedZone || zone();
			const el = want === "side" ? editorIn(sidePane()) : composerTextarea();
			if (!el) return;
			try {
				el.focus();
			} catch (error) {
				/* focus is best effort */
			}
		}

		function appendDraftInto(input, text) {
			if (!input || typeof input.setDraft !== "function") return false;
			let draft = "";
			try {
				const snapshot = input.state && input.state.getSnapshot ? input.state.getSnapshot() : null;
				if (snapshot && typeof snapshot.draft === "string") draft = snapshot.draft;
			} catch (error) {
				draft = "";
			}
			const trimmed = draft.replace(/\s+$/, "");
			const next = (trimmed ? trimmed + "\n\n" : "") + text;
			try {
				input.setDraft(next.slice(0, MAX_DRAFT));
				return true;
			} catch (error) {
				return false;
			}
		}

		/**
		 * DOM fallback for the composer: focus the real field, put the caret at
		 * the end and insert through the browser's own editing pipeline, so a
		 * controlled React textarea sees a normal `input` event. The field is
		 * passed in, because a selection made in the side chat must land in the
		 * *side* composer, not in whichever composer happens to come first.
		 */
		function appendDraftViaDom(text, editor) {
			const el = editor || zoneEditor();
			if (!el) return false;
			try {
				el.focus();
				const value = typeof el.value === "string" ? el.value : "";
				const prefix = value && !/\s$/.test(value) ? "\n\n" : "";
				const payload = prefix + text;
				if (el.isContentEditable && typeof window.getSelection === "function") {
					const range = document.createRange();
					range.selectNodeContents(el);
					range.collapse(false);
					const selection = window.getSelection();
					selection.removeAllRanges();
					selection.addRange(range);
					/*
					 * The resident composer is a rich editor, not a textarea: a paste
					 * event it handles (preventDefault) is the most faithful insert,
					 * with the browser's own insertText command as the fallback.
					 */
					if (typeof window.ClipboardEvent === "function" && typeof window.DataTransfer === "function") {
						try {
							const transfer = new DataTransfer();
							transfer.setData("text/plain", payload);
							const notHandled = el.dispatchEvent(
								new ClipboardEvent("paste", {
									clipboardData: transfer,
									bubbles: true,
									cancelable: true,
								}),
							);
							if (!notHandled) return true;
						} catch (error) {
							/* fall through to the browser's insert command */
						}
					}
				} else if (typeof el.setSelectionRange === "function") {
					el.setSelectionRange(value.length, value.length);
				}
				if (typeof document.execCommand === "function" && document.execCommand("insertText", false, payload)) {
					return true;
				}
				const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : null;
				const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
				if (!descriptor || typeof descriptor.set !== "function") return false;
				descriptor.set.call(el, value + prefix + text);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				return true;
			} catch (error) {
				return false;
			}
		}

		/**
		 * Service path first, then the composer bridge, then the DOM. Every tier is
		 * resolved for the *zone* the selection came from: the side chat has its own
		 * `conversation.input` scope, its own bridge-less Session shell and its own
		 * editor element.
		 */
		function appendDraft(text) {
			const target = zoneSessionId();
			const editor = zoneEditor();
			if (appendDraftInto(inputFor(target), text)) {
				return true;
			}
			/*
			 * One seat per live conversation shell: take the seat the zone needs and
			 * only use it when it belongs to the Session we resolved above.
			 */
			const seat = bridgeSeatFor(zone());
			const seatSession = seat && seat.sessionId ? seat.sessionId : null;
			const seatFits = !!seat && (!seatSession || !target || seatSession === target);
			if (seatFits && seat.actions && typeof seat.actions.setDraft === "function") {
				try {
					const dom = editor;
					const current = dom
						? typeof dom.value === "string"
							? dom.value
							: typeof dom.textContent === "string"
								? dom.textContent
								: ""
						: "";
					const trimmed = current.replace(/\s+$/, "");
					const next = (trimmed ? trimmed + "\n\n" : "") + text;
					seat.actions.setDraft(next.slice(0, MAX_DRAFT));
					return true;
				} catch (error) {
					/* fall through to the DOM */
				}
			}
			const written = appendDraftViaDom(text, editor);
			return written;
		}

		/**
		 * Never leave the button a dead end: if no composer can be reached, the
		 * text still lands in the clipboard with an explicit instruction.
		 * `forcedZone` pins the write to one conversation for flows that are not
		 * about the current selection (starting a new chat, say).
		 */
		function writeDraftOrCopy(text, forcedZone) {
			const restore = forcedZone && state.zone !== forcedZone ? state.zone : null;
			if (restore) state = Object.assign({}, state, { zone: forcedZone });
			try {
				if (appendDraft(text)) return true;
				const target = zoneSessionId();
				console.warn(NS + " no writable composer", {
					zone: zone(),
					sessionId: target,
					bridge: !!bridgeSeatFor(zone()),
					serviceInput: !!inputFor(target),
					composer: !!zoneEditor(),
				});
				copyText(text).then(
					function (ok) {
						toast(ok ? t("noComposerCopied") : t("noComposer"), ok ? "info" : "error", 4200);
					},
					function () {
						toast(t("noComposer"), "error");
					},
				);
				return false;
			} finally {
				if (restore) state = Object.assign({}, state, { zone: restore });
			}
		}

		function toQuote(text) {
			return String(text)
				.replace(/\r\n?/g, "\n")
				.replace(/\s+$/, "")
				.split("\n")
				.map(function (line) {
					return line ? "> " + line : ">";
				})
				.join("\n");
		}

		/* --------------------------------------------------------- clipboard io */

		async function copyText(text) {
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					await navigator.clipboard.writeText(text);
					return true;
				}
			} catch (error) {
				/* fall back to execCommand */
			}
			try {
				const area = document.createElement("textarea");
				area.value = text;
				area.setAttribute("readonly", "");
				area.style.position = "fixed";
				area.style.top = "-1000px";
				area.style.opacity = "0";
				document.body.appendChild(area);
				area.select();
				const ok = document.execCommand("copy");
				area.remove();
				return ok;
			} catch (error) {
				return false;
			}
		}

		async function imageToFile(img) {
			try {
				const src = img.currentSrc || img.src;
				if (!src) return null;
				const response = await fetch(src, { credentials: "include" });
				if (!response.ok) return null;
				const blob = await response.blob();
				const type = blob.type || "image/png";
				const ext = (type.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "") || "png";
				return new File([blob], "selection-" + Date.now() + "." + ext, { type: type });
			} catch (error) {
				return null;
			}
		}

		async function copyImage(img) {
			try {
				if (!navigator.clipboard || typeof window.ClipboardItem !== "function") return false;
				const file = await imageToFile(img);
				if (!file) return false;
				const item = new window.ClipboardItem({ [file.type]: file });
				await navigator.clipboard.write([item]);
				return true;
			} catch (error) {
				return false;
			}
		}

		function saveImage(img) {
			try {
				const src = img.currentSrc || img.src;
				if (!src) return;
				const anchor = document.createElement("a");
				anchor.href = src;
				anchor.download = "selection-" + Date.now() + ".png";
				anchor.style.display = "none";
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
			} catch (error) {
				/* download is best effort */
			}
		}

		/* -------------------------------------------------------------- actions */

		/*
		 * The toast names the target conversation: with the same button writing into
		 * two different composers, "added" alone cannot tell the user (or a bug
		 * report) which one received the quote.
		 */
		function addedToast() {
			toast(zone() === "side" ? t("addedSide") : t("added"));
		}

		async function addTextToChat() {
			const text = state.text;
			if (!text.trim()) {
				toast(t("emptyText"), "error");
				return;
			}
			if (writeDraftOrCopy(toQuote(text))) {
				addedToast();
				hide();
			}
		}

		async function addImagesToChat() {
			const images = state.images.slice();
			const area = zoneEditor();
			const files = [];
			for (let i = 0; i < images.length; i += 1) {
				/* eslint-disable no-await-in-loop */
				const file = await imageToFile(images[i]);
				if (file) files.push(file);
			}
			if (!files.length || !area) {
				if (await copyImage(images[0])) toast(t("imageCopied"));
				else toast(t("imageFailed"), "error");
				return;
			}
			try {
				const transfer = new DataTransfer();
				files.forEach(function (file) {
					transfer.items.add(file);
				});
				area.focus();
				area.dispatchEvent(
					new ClipboardEvent("paste", {
						clipboardData: transfer,
						bubbles: true,
						cancelable: true,
					}),
				);
				toast(t("imagesInserted"));
				hide();
			} catch (error) {
				if (await copyImage(images[0])) toast(t("imageCopied"));
				else toast(t("imageFailed"), "error");
			}
		}

		function addToChat() {
			const task = state.images.length ? addImagesToChat() : addTextToChat();
			if (task && typeof task.catch === "function") {
				task.catch(function () {
					toast(t("imageFailed"), "error");
				});
			}
		}

		function selectionBody() {
			return state.text.trim()
				? toQuote(state.text)
				: "（选中了 " + state.images.length + " 张" + t("imageLabel") + "）";
		}

		function buildQuestion() {
			return ["关于我选中的这段内容，我想进一步了解：", "", selectionBody(), "", ""].join("\n");
		}

		/**
		 * 「让 DeepSeek 详解」带过去的东西**只有选区本身**（Markdown 引用），没有
		 * 任何预置指令 —— 按用户要求：网页版那边的输入框每次打开都会把上一次没发送的
		 * 草稿还原出来，预置多大一段话，那个框里就会一直躺着多大一段话。问题由用户
		 * 到了页面自己打。
		 */
		function buildDeepDive() {
			return selectionBody();
		}

		/** 侧边聊天头部的 🌐：把同一段选区交给免费的网页版（同样不带预置指令）。 */
		function sideWebVersion() {
			const body = contextBody(side.context) || selectionBody();
			openWebVersion(body);
		}

		/**
		 * Start a fresh chat and pre-fill `question` there, falling back to the
		 * current composer. Shared by 「在侧边聊天中提问」 and 「让 DeepSeek 详解」.
		 */
		function prefillNewSession(question, doneKey) {
			const fallback = function () {
				if (writeDraftOrCopy(question, "main")) toast(t("askFallback"));
				hide();
			};
			const ui = ctxGet("uiWorkspace");
			if (!ui || typeof ui.startSession !== "function") {
				fallback();
				return;
			}
			const before = currentSessionId();
			toast(t("asking"), "info", 1600);
			try {
				ui.startSession();
			} catch (error) {
				fallback();
				return;
			}
			let tries = 0;
			const timer = window.setInterval(function () {
				tries += 1;
				const now = currentSessionId();
				if (now && now !== before) {
					const input = inputFor(now);
					if (input && appendDraftInto(input, question)) {
						window.clearInterval(timer);
						timers.delete(timer);
						focusComposer("main");
						toast(t(doneKey));
						hide();
						return;
					}
				}
				if (tries > 40) {
					window.clearInterval(timer);
					timers.delete(timer);
					fallback();
				}
			}, 150);
			timers.add(timer);
		}

		function askInSideChat() {
			prefillNewSession(buildQuestion(), "askDone");
		}

		/**
		 * Deep dive **without spending this profile's tokens**: the *selection* (no
		 * canned prompt, see `buildDeepDive`) is copied and the free web app opens
		 * in the right-hand browser tab with it in `?q=` — the community convention
		 * a userscript turns into an auto-fill; without one the clipboard carries it
		 * and Ctrl+V finishes the job. The user types the actual question there.
		 */
		function deepDiveOnWeb() {
			openWebVersion(buildDeepDive());
		}

		/**
		 * Is the host's sidebar **browser** tab type registered? (`kind: "browser"`,
		 * the same check ui-chat makes before routing a link into the sidebar.)
		 * Returns `null` when the registry itself cannot be read, so the caller can
		 * still try the column instead of silently falling back to the OS browser.
		 */
		function hasBrowserTabType() {
			try {
				const tabs = ctxGet("sidebarRightTabs");
				if (!tabs || typeof tabs.get !== "function") return null;
				return !!tabs.get("browser");
			} catch (error) {
				return null;
			}
		}

		/**
		 * Close the browser tabs already open in the column. The tab's page
		 * controller consumes its `params.url` **once** (`start(initialUrl)`) and a
		 * page tab is deduplicated within its pane, so re-opening it would only
		 * focus the tab that is already showing the previous question. Ending the
		 * occurrence first makes the next `openTab` a fresh mount with a fresh
		 * controller, which then loads the new URL.
		 */
		function closeBrowserTabs(api) {
			try {
				const inventory = api.openTabs;
				const snapshot = inventory && typeof inventory.getSnapshot === "function" ? inventory.getSnapshot() : null;
				const list = Array.isArray(snapshot) ? snapshot : [];
				list.forEach(function (tab) {
					if (!tab || tab.kind !== "browser") return;
					try {
						api.close(tab.tabId);
					} catch (error) {
						/* a tab we cannot close is not worth failing the open */
					}
				});
			} catch (error) {
				/* no inventory: openTab below still does its best */
			}
		}

		/**
		 * Send the deep-dive question to the **free web app**, preferring the
		 * browser tab inside the app's own right-hand column over the system
		 * browser: the page the user is already signed into stays right next to
		 * the selection, and nothing in this profile's model quota is spent.
		 *
		 * The clipboard copy is the transport that always works — the site never
		 * reads `?q=`, so Ctrl+A / Ctrl+V overwrites whatever draft it restored.
		 * `t=<stamp>` keeps every click a URL the browser has never seen: without
		 * it a tab already sitting on chat.deepseek.com is reused, the single-page
		 * app only changes route client-side, and the box keeps the *previous*
		 * question (which is what "the text is from an older selection" looked
		 * like). The sidebar browser is re-opened fresh (see `closeBrowserTabs`);
		 * the external fallback goes through an anchor click, which the desktop
		 * shell's window-open handler routes to the system browser.
		 */
		function openWebVersion(text) {
			const payload = typeof text === "string" && text.trim() ? text : state.text;
			const ask = payload && payload.trim() ? payload.trim() : "";
			const stamp = String(Date.now());
			const href = ask
				? "https://chat.deepseek.com/?q=" + encodeURIComponent(ask) + "&t=" + stamp
				: "https://chat.deepseek.com/?t=" + stamp;
			const openExternal = function () {
				try {
					const link = document.createElement("a");
					link.href = href;
					link.target = "_blank";
					link.rel = "noreferrer noopener";
					link.style.display = "none";
					document.body.appendChild(link);
					link.click();
					window.setTimeout(function () {
						if (link.parentNode) link.parentNode.removeChild(link);
					}, 0);
					toast(t("openWebDone"), "info", 3600);
				} catch (error) {
					toast(t("openWebFailed"), "error", 3600);
				}
			};
			const open = function () {
				const api = ctxGet("sidebarRight");
				/* `null` means "cannot tell" — still try the column, it may work. */
				const side = !!(api && typeof api.openTab === "function" && hasBrowserTabType() !== false);
				if (side) {
					try {
						closeBrowserTabs(api);
						api.openTab("browser", { params: { url: href } });
						toast(t("openWebSide"), "info", 4800);
						return;
					} catch (error) {
						/* the column refused the tab: fall back to a plain browser tab */
					}
				}
				openExternal();
			};
			if (ask) copyText(ask).then(open, open);
			else open();
		}

		/* ----------------------------------------------------------- statistics */

		function computeStats() {
			const text = state.text || "";
			const lines = text.length ? text.split(/\r\n?|\n/) : [];
			const paragraphs = text.split(/\n\s*\n/).filter(function (part) {
				return part.trim();
			}).length;
			let words = 0;
			try {
				const match = text.match(/[\p{L}\p{N}_'-]+/gu);
				words = match ? match.length : 0;
			} catch (error) {
				const match = text.match(/[A-Za-z0-9_'-]+/g);
				words = match ? match.length : 0;
			}
			return {
				chars: text.length,
				words: words,
				lines: lines.length,
				paragraphs: paragraphs,
				images: state.images.length,
			};
		}

		function kindLabel() {
			const text = state.text || "";
			if (!text.trim() && state.images.length) return t("kindImage");
			if (/^ {4,}\S|^\t/m.test(text) && /[{};=()]/.test(text)) return t("kindCode");
			if (/(^|\n)\s*```/.test(text)) return t("kindCode");
			if (/\b(function|const|let|var|class|def|import|export|return|public|private)\b/.test(text))
				return t("kindCode");
			const rows = text.split(/\r\n?|\n/).filter(function (line) {
				return line.trim();
			});
			if (
				rows.length >= 2 &&
				rows.filter(function (line) {
					return line.indexOf("|") >= 0;
				}).length >= Math.min(2, rows.length)
			)
				return t("kindTable");
			if (/^\s*>/m.test(text)) return t("kindQuote");
			if (/^\s{0,3}#{1,6}\s|^\s*[-*+]\s|^\s*\d+\.\s|\*\*[^*]+\*\*/m.test(text))
				return t("kindMarkdown");
			return t("kindText");
		}

		/* --------------------------------------------------------- side chat io */

		/**
		 * The side chat is its own session (forked from the one on screen) plus a
		 * floating panel docked to the right. It only owns client-side state: the
		 * host keeps the transcript, `sessions.retain` gives us its event window
		 * and `ISession.prompt` puts a question into it.
		 */
		let side = {
			open: false,
			docked: false,
			context: null,
			thread: [],
			busy: false,
			error: "",
			sessionId: null,
			anchor: null,
		};
		const sideListeners = new Set();
		let sideRef = null;
		let sideOff = null;
		let sideBase = 0;
		let sideMessageSeq = 0;
		/** The Session the docked tab belongs to, published by its body. */
		let dockSessionId = null;
		/**
		 * The Session the docked pane's `SessionProvider` actually rendered (its
		 * `reference.sessionId`). This is the authoritative side-chat id: slot props
		 * hand the pane the *workspace's* session id, which is the main chat.
		 */
		let sidePaneSessionId = null;

		function getSide() {
			return side;
		}

		function setSide(patch) {
			side = Object.assign({}, side, patch);
			sideListeners.forEach(function (fn) {
				try {
					fn();
				} catch (error) {
					/* a broken renderer must not break the store */
				}
			});
		}

		function subscribeSide(fn) {
			sideListeners.add(fn);
			return function () {
				sideListeners.delete(fn);
			};
		}

		function useSide() {
			const pair = React.useState(getSide);
			const snapshot = pair[0];
			const setSnapshot = pair[1];
			React.useEffect(function () {
				return subscribeSide(function () {
					setSnapshot(getSide());
				});
			}, []);
			return snapshot;
		}

		function nextMessageId() {
			sideMessageSeq += 1;
			return "sm" + sideMessageSeq;
		}

		/** The quoted block the side chat carries as context, from the pinned selection. */
		function contextBody(context) {
			if (!context) return "";
			const text = String(context.text || "").trim();
			if (text) return toQuote(text);
			const count = (context.images || []).length;
			return count ? "（选中了 " + count + " 张" + t("imageLabel") + "）" : "";
		}

		function contextTitle(context) {
			if (!context) return "";
			const flat = String(context.text || "").replace(/\s+/g, " ").trim();
			if (flat) return flat.slice(0, 56);
			const count = (context.images || []).length;
			return count ? t("imageLabel") + " × " + count : "";
		}

		function pinContext() {
			return {
				text: state.text || "",
				images: (state.images || []).slice(),
				kind: kindLabel(),
			};
		}

		/** The Session the side chat forks from: the docked panel's Session, else the one on screen. */
		function anchorSessionId() {
			return currentSessionId() || dockSessionId;
		}

		/**
		 * Ask the host to show our tab in the right-hand column. `openTab` is the
		 * plugin-facing call documented by ui-sidebar-browser; when the column is
		 * unavailable the floating panel stays as the fallback home.
		 */
		function requestDockedTab() {
			const api = ctxGet("sidebarRight");
			if (!api || typeof api.openTab !== "function") {
				return false;
			}
			try {
				api.openTab(SIDE_KIND, {});
				return true;
			} catch (error) {
				try {
					api.openTab(SIDE_KIND);
					return true;
				} catch (error2) {
					console.warn(NS + " could not open the side chat tab", error2);
					return false;
				}
			}
		}

		/**
		 * Open (or focus) the side chat tab in the right-hand column. The tab
		 * renders a real Session, so nothing is drawn from here; if the column
		 * refuses the tab the user is told, rather than shown a fake panel.
		 */
		function openSide() {
			const context = state.open ? pinContext() : getSide().context;
			setSide({ open: true, docked: true, context: context });
			hide();
			if (!requestDockedTab()) toast(t("sideNoDock"), "error", 4200);
		}

		function closeSide() {
			setSide({ open: false });
			if (sideOff) {
				try {
					sideOff();
				} catch (error) {
					/* the source may be gone already */
				}
				sideOff = null;
			}
			if (sideRef) {
				try {
					sideRef.release();
				} catch (error) {
					/* releasing twice is harmless */
				}
				sideRef = null;
			}
		}

		function focusSideInput() {
			let tries = 0;
			const attempt = function () {
				const el = document.querySelector("[" + MARK + "] [data-side-input]");
				if (el) {
					try {
						el.focus();
					} catch (error) {
						/* focus is best effort */
					}
					return;
				}
				tries += 1;
				if (tries < 12) later(attempt, 80);
			};
			attempt();
		}

		/* session plumbing ------------------------------------------------------ */

		function sideApi() {
			return ctxGet("sessions");
		}

		function maxSeqOf(binding) {
			let max = 0;
			try {
				const source = binding && binding.eventSource;
				const snapshot = source && source.getSnapshot ? source.getSnapshot() : null;
				const entries = snapshot && snapshot.entries ? snapshot.entries : [];
				entries.forEach(function (entry) {
					const event = entry && entry.event;
					if (event && typeof event.seq === "number" && event.seq > max) max = event.seq;
				});
			} catch (error) {
				/* an unreadable window just means "no baseline" */
			}
			return max;
		}

		/**
		 * The seq of the very first event of a session. Kept as a reference for what
		 * the fork anchor could be: the side chat forks with no `atSeq` (inherit the
		 * whole record) and falls back to the constant anchor `1`, which is always at
		 * least as cheap (a trimmed event window would push a computed anchor late
		 * into the log).
		 */
		function firstSeqOf(sessionId) {
			const sessions = sideApi();
			if (!sessions || typeof sessions.binding !== "function") return undefined;
			try {
				const binding = sessions.binding(sessionId);
				const source = binding && binding.eventSource;
				const snapshot = source && source.getSnapshot ? source.getSnapshot() : null;
				const entries = snapshot && snapshot.entries ? snapshot.entries : [];
				for (let i = 0; i < entries.length; i += 1) {
					const entry = entries[i];
					const event = entry && entry.type === "event" ? entry.event : null;
					if (event && typeof event.seq === "number") return event.seq;
				}
			} catch (error) {
				/* fall back to a normal fork */
			}
			return undefined;
		}

		/** `sessions.fork` answers with a SessionId, or a remote result wrapping one. */
		function forkIdOf(result) {
			if (!result) return null;
			if (typeof result === "string") return result;
			if (typeof result.sessionId === "string") return result.sessionId;
			if (result.value && typeof result.value.sessionId === "string") return result.value.sessionId;
			return null;
		}

		/**
		 * The Turn boundary between what a forked side chat inherited from the main
		 * conversation and what the side chat said itself. `sessions.fork` (no
		 * `atSeq`) cuts at the source's last *completed* Turn, so that Turn number is
		 * the boundary: rows whose `data-chat-turn` is at or below it belong to the
		 * inherited record, rows above it are the side chat's own. The value is kept
		 * per child Session in memory and mirrored into localStorage — the pane can
		 * outlive a client reload. An unknown boundary hides nothing, so a missing
		 * record can never eat what the side chat itself answered.
		 */
		const sideBoundary = new Map();
		let sideBoundaryLoaded = false;

		function loadSideBoundaries() {
			if (sideBoundaryLoaded) return;
			sideBoundaryLoaded = true;
			try {
				const raw = window.localStorage.getItem(SIDE_BOUNDARY_KEY);
				const stored = raw ? JSON.parse(raw) : null;
				Object.keys(stored || {}).forEach(function (id) {
					const turn = Number(stored[id]);
					if (Number.isFinite(turn)) sideBoundary.set(id, turn);
				});
			} catch (error) {
				/* storage here is convenience, never a requirement */
			}
		}

		function sideBoundaryOf(id) {
			if (typeof id !== "string" || !id) return null;
			loadSideBoundaries();
			const turn = sideBoundary.get(id);
			return typeof turn === "number" && Number.isFinite(turn) ? turn : null;
		}

		function rememberSideBoundary(id, turn) {
			if (typeof id !== "string" || !id) return;
			if (typeof turn !== "number" || !Number.isFinite(turn)) return;
			loadSideBoundaries();
			sideBoundary.set(id, turn);
			try {
				const out = {};
				Array.from(sideBoundary.keys()).slice(-40).forEach(function (key) {
					out[key] = sideBoundary.get(key);
				});
				window.localStorage.setItem(SIDE_BOUNDARY_KEY, JSON.stringify(out));
			} catch (error) {
				/* unavailable or full storage only costs the reload case */
			}
		}

		function eventTurn(event) {
			const turn = event && event.data ? event.data.turn : undefined;
			return typeof turn === "number" && Number.isFinite(turn) ? turn : null;
		}

		function eventWindowOf(binding) {
			try {
				const source = binding && binding.eventSource;
				const snapshot = source && typeof source.getSnapshot === "function" ? source.getSnapshot() : null;
				return snapshot && Array.isArray(snapshot.entries) ? snapshot.entries : null;
			} catch (error) {
				return null;
			}
		}

		function eventsOf(entries) {
			return (entries || []).map(function (entry) {
				return entry && entry.type === "event" ? entry.event : null;
			});
		}

		/** The highest Turn the window knows about. */
		function lastTurnOf(entries) {
			let found = null;
			eventsOf(entries).forEach(function (event) {
				const turn = eventTurn(event);
				if (turn !== null && (found === null || turn > found)) found = turn;
			});
			return found;
		}

		/** The highest Turn the window has seen *finish* — the fork's cut point. */
		function lastClosedTurnOf(entries) {
			let found = null;
			eventsOf(entries).forEach(function (event) {
				if (!event || event.type !== "turn/end") return;
				const turn = eventTurn(event);
				if (turn !== null && (found === null || turn > found)) found = turn;
			});
			return found;
		}

		function bindingOf(sessions, id) {
			if (!sessions || typeof id !== "string" || !id) return null;
			try {
				if (typeof sessions.binding === "function") {
					const binding = sessions.binding(id);
					if (binding) return binding;
				}
			} catch (error) {
				/* fall through to the scope lookup */
			}
			try {
				if (typeof sessions.scope === "function") {
					const scope = sessions.scope(id);
					if (scope && scope.binding) return scope.binding;
				}
			} catch (error) {
				/* no binding is a normal answer here */
			}
			return null;
		}

		/**
		 * Ask the freshly forked Session itself: right after the fork its window holds
		 * nothing but the inherited record, so its highest Turn *is* the boundary. This
		 * is the authoritative reading; the source's last closed Turn (taken before the
		 * fork) is the fallback when the child's window cannot be read.
		 */
		async function measureChildBoundary(sessions, childId) {
			const ref = sideRef && sideRef.sessionId === childId ? sideRef : retainSideReference(sessions, childId);
			if (!ref) return null;
			if (ref.sessionId === childId) sideRef = ref;
			try {
				await withTimeout(Promise.resolve(ref.ready), 8000, "boundary-ready");
			} catch (error) {
				/* the window is read below whether or not readiness timed out */
			}
			return lastTurnOf(eventWindowOf(ref.binding));
		}

		function recordSideBoundary(sessions, childId, fallback) {
			const remember = function (turn) {
				if (typeof turn !== "number" || !Number.isFinite(turn)) {
					return;
				}
				rememberSideBoundary(childId, turn);
			};
			/*
			 * The child's own reading wins, so the fallback is only spent when the child's
			 * window cannot be read at all. Hiding nothing for a moment beats hiding the
			 * side chat's own first answer: the inherited record is merely reprinted.
			 */
			measureChildBoundary(sessions, childId).then(
				function (turn) {
					remember(typeof turn === "number" ? turn : fallback);
				},
				function () {
					remember(fallback);
				},
			);
		}

		async function createSideSession() {
			const sessions = sideApi();
			const current = anchorSessionId();
			if (!sessions || typeof sessions.fork !== "function") {
				return null;
			}
			if (!current) {
				return null;
			}
			const base = { sessionId: current, increaseTitle: false };
			/*
			 * The fork's cut point, read before forking: the source's last *closed* Turn.
			 * It is the fallback boundary for the pane, used only if the freshly forked
			 * Session cannot be read back (see recordSideBoundary).
			 */
			const parentBoundary = lastClosedTurnOf(eventWindowOf(bindingOf(sessions, current)));
			/*
			 * Inherit the source conversation's whole question/answer record:
			 * omitting `atSeq` forks at the LAST completed turn, so the side chat
			 * opens with everything the main chat has already said — it reads as a
			 * continuation instead of a blank box. `atSeq: 1` (the source's first
			 * turn only — the old behaviour) stays as a last-resort fallback for
			 * logs whose end boundary is not forkable.
			 */
			const attempt = async function (options) {
				let created = null;
				const result = await sessions.fork(
					Object.assign({}, options, {
						onCreated: function (childId) {
							if (typeof childId === "string") created = childId;
						},
					}),
				);
				return created || forkIdOf(result);
			};
			try {
				const full = await withTimeout(attempt(base), 15000, "fork-full");
				if (full) {
					setSide({ anchor: SIDE_ANCHOR });
					recordSideBoundary(sessions, full, parentBoundary);
					return full;
				}
			} catch (error) {
				/* the full fork was refused: the seeded fork below is the last resort */
			}
			try {
				const seed = await withTimeout(attempt(Object.assign({}, base, { atSeq: 1 })), 15000, "fork-at");
				if (seed) {
					setSide({ anchor: SIDE_ANCHOR });
					recordSideBoundary(sessions, seed, 1);
				}
				return seed;
			} catch (error) {
				console.warn(NS + " could not fork a side session", error);
				return null;
			}
		}

		async function sideSession() {
			const sessions = sideApi();
			if (!sessions) return null;
			let id = side.sessionId;
			if (!id) {
				id = await createSideSession();
				if (!id) return null;
				setSide({ sessionId: id });
			}
			if (sideRef && sideRef.sessionId === id && sideRef.binding) return sideRef.binding;
			let ref = null;
			try {
				ref = sessions.retain({ sessionId: id }, { source: "controllerOperation" });
			} catch (error) {
				try {
					ref = sessions.retain(id, { source: "controllerOperation" });
				} catch (error2) {
					ref = null;
				}
			}
			if (!ref) return null;
			try {
				const binding = await ref.ready;
				sideRef = ref;
				return binding || null;
			} catch (error) {
				console.warn(NS + " could not retain the side session", error);
				return null;
			}
		}

		/**
		 * `sessions.retain(target, options)` takes "a known Session id or a
		 * durable direct-parent subagent address" (sessions-service README), so
		 * the plain id is the supported target. An unusable target is not
		 * reported as an error: it resolves to the Controller's absent reference
		 * (empty `sessionId`, no `binding`), which renders a Session area with
		 * no binding, so an absent answer is rejected here instead of being
		 * handed to `SessionProvider`.
		 */
		function retainSideReference(sessions, id) {
			const attempts = [id, { sessionId: id }];
			for (let i = 0; i < attempts.length; i += 1) {
				let ref = null;
				try {
					ref = sessions.retain(attempts[i], { source: "controllerOperation" });
				} catch (error) {
					continue;
				}
				if (ref && ref.sessionId) {
					return ref;
				}
				try {
					if (ref && typeof ref.release === "function") ref.release();
				} catch (error2) {
					/* an absent reference need not be releasable */
				}
			}
			return null;
		}

		/**
		 * The same Session as the `SessionReference` the tab body hands to
		 * `SessionProvider`: one forked Session per side chat, retained for as
		 * long as the tab lives.
		 */
		async function ensureSideReference() {
			const sessions = sideApi();
			if (!sessions || typeof sessions.retain !== "function") {
				return null;
			}
			let id = getSide().sessionId;
			if (id && getSide().anchor !== SIDE_ANCHOR) {
				/*
				 * One-time upgrade: a side chat forked with the old "first turn only"
				 * anchor cannot show the source conversation's record, and it has
				 * nothing of its own worth keeping that early.
				 */
				if (sideRef) {
					try {
						sideRef.release();
					} catch (error) {
						/* releasing twice is harmless */
					}
					sideRef = null;
				}
				setSide({ sessionId: null, thread: [], anchor: SIDE_ANCHOR });
				id = null;
			}
			if (!id) {
				id = await createSideSession();
				if (!id) return null;
				setSide({ sessionId: id });
			}
			if (sideRef && sideRef.sessionId === id && sideRef.binding) {
				return sideRef;
			}
			const ref = retainSideReference(sessions, id);
			if (!ref) {
				return null;
			}
			try {
				await withTimeout(Promise.resolve(ref.ready), 15000, "retain-ready");
			} catch (error) {
				console.warn(NS + " could not retain the side session", error);
				return null;
			}
			sideRef = ref;
			return ref;
		}

		/**
		 * Put the pinned selection into the side Session's own composer, through
		 * the published input face — never the DOM, and never over a draft the
		 * user already started. Retries while the fork's scope comes up.
		 */
		function seedSideChat() {
			const body = contextBody(getSide().context);
			if (!body) return;
			const text = body + "\n\n";
			let tries = 0;
			const attempt = function () {
				tries += 1;
				const id = getSide().sessionId;
				if (id && writeSideDraft(id, text)) return;
				if (tries < 20) later(attempt, 250);
			};
			attempt();
		}

		function writeSideDraft(sessionId, text) {
			const sessions = sideApi();
			const conversation = ctxGet("conversation");
			if (!sessions || !conversation || typeof sessions.scope !== "function") return false;
			try {
				const actx = sessions.scope(sessionId);
				const resolver = conversation.input;
				if (!actx || !resolver || typeof resolver.for !== "function") return false;
				const input = resolver.for(actx);
				if (!input || typeof input.setDraft !== "function") return false;
				const snapshot = input.state && input.state.getSnapshot ? input.state.getSnapshot() : null;
				if (snapshot && String(snapshot.draft || "").trim()) return true;
				input.setDraft(text);
				return true;
			} catch (error) {
				return false;
			}
		}

		/* streaming ------------------------------------------------------------- */

		/** One assistant message's answer text: `text` blocks only, never reasoning. */
		function contentText(message) {
			const content = message && message.content;
			if (!Array.isArray(content)) return "";
			let out = "";
			content.forEach(function (block) {
				if (block && block.type === "text" && typeof block.text === "string") out += block.text;
			});
			return out;
		}

		/** Durable replay records (`assistant/attempt.data.stream`) -> answer text. */
		function streamText(stream) {
			if (!Array.isArray(stream)) return "";
			let out = "";
			stream.forEach(function (record) {
				if (!record) return;
				if (record.type === "text-chunks" && Array.isArray(record.texts)) out += record.texts.join("");
				else if (record.type === "chunk" && record.chunk && record.chunk.type === "text-delta") out += record.chunk.text;
			});
			return out;
		}

		/**
		 * Answer of the newest turn in a session event window.
		 *
		 * The window is read wholesale on every notification: the host drops an
		 * attempt's transient `assistant/live-chunk` entries the moment the durable
		 * `assistant/message` lands, so a wholesale reader never double-prints, and a
		 * `change` delta is only ever an optimisation hint.
		 *
		 * `streaming` means live deltas are newer than the newest durable message.
		 * Turn completion is NOT taken from `SessionSnapshot.running`.
		 */
		function extractTurn(entries) {
			const settled = [];
			const attempts = [];
			let live = null;

			const pushLive = function (data, seq) {
				if (live === null || live.attemptId !== data.attemptId) {
					live = { attemptId: data.attemptId, turn: data.turn, seq: seq, blocks: [] };
				}
				live.turn = data.turn;
				live.seq = seq;
				const chunk = data.chunk;
				if (!chunk || typeof chunk.type !== "string") return;
				if (chunk.type === "block-start") {
					live.blocks[chunk.index] = { type: chunk.blockType, text: "" };
				} else if (chunk.type === "text-delta") {
					const previous = live.blocks[chunk.index];
					live.blocks[chunk.index] = {
						type: "text",
						text: (previous && previous.type === "text" ? previous.text : "") + chunk.text,
					};
				} else if (chunk.type === "reasoning-delta") {
					const previous = live.blocks[chunk.index];
					live.blocks[chunk.index] = {
						type: "reasoning",
						text: (previous && previous.type === "reasoning" ? previous.text : "") + chunk.text,
					};
				} else if (chunk.type === "block-end" && chunk.block) {
					live.blocks[chunk.index] = {
						type: chunk.block.type,
						text: typeof chunk.block.text === "string" ? chunk.block.text : "",
					};
				}
			};

			(entries || []).forEach(function (entry) {
				const event = entry && entry.event;
				if (!event) return;
				if (entry.type === "transient") {
					if (event.type === "assistant/live-chunk" && event.data) pushLive(event.data, event.seq);
					return;
				}
				if (entry.type !== "event" || !event.data) return;
				if (event.type === "assistant/message" && event.data.message) {
					settled.push({ turn: event.data.turn, seq: event.seq, text: contentText(event.data.message) });
				} else if (event.type === "assistant/attempt") {
					attempts.push({ turn: event.data.turn, seq: event.seq, text: streamText(event.data.stream) });
				}
			});

			let liveText = "";
			if (live !== null) {
				live.blocks.forEach(function (block) {
					if (block && block.type === "text") liveText += block.text;
				});
			}
			const lastTurn = Math.max(
				settled.length ? settled[settled.length - 1].turn : -Infinity,
				live === null ? -Infinity : live.turn,
			);
			if (!isFinite(lastTurn)) return { text: "", streaming: false };

			const durable = (settled.length ? settled : attempts).filter(function (record) {
				return record.turn === lastTurn;
			});
			const durableText = durable
				.map(function (record) {
					return record.text;
				})
				.filter(function (text) {
					return text !== "";
				})
				.join("\n");
			let lastDurableSeq = -Infinity;
			durable.forEach(function (record) {
				if (typeof record.seq === "number" && record.seq > lastDurableSeq) lastDurableSeq = record.seq;
			});

			if (live !== null && live.turn === lastTurn && live.seq > lastDurableSeq) {
				return {
					text: durableText === "" ? liveText : durableText + "\n" + liveText,
					streaming: true,
				};
			}
			return { text: durableText, streaming: false };
		}

		/** Answer of the side session, ignoring everything at or below our question's seq. */
		function readAnswer(source, floor) {
			let snapshot = null;
			try {
				snapshot = source && source.getSnapshot ? source.getSnapshot() : null;
			} catch (error) {
				return { text: "", streaming: false };
			}
			const entries = [];
			const min = typeof floor === "number" ? floor : 0;
			((snapshot && snapshot.entries) || []).forEach(function (entry) {
				const event = entry && entry.event;
				const seq = event && typeof event.seq === "number" ? event.seq : null;
				if (seq === null || seq > min) entries.push(entry);
			});
			return extractTurn(entries);
		}

		function sideRunning(binding) {
			try {
				const face = binding && binding.session;
				const snapshot = face && face.getSnapshot ? face.getSnapshot() : null;
				return !!(snapshot && snapshot.running);
			} catch (error) {
				return false;
			}
		}

		function observeSide(binding) {
			if (sideOff) {
				try {
					sideOff();
				} catch (error) {
					/* nothing to detach */
				}
				sideOff = null;
			}
			const sync = function () {
				const answer = readAnswer(binding.eventSource, sideBase);
				const running = sideRunning(binding);
				const text = answer.text || "";
				const streaming = answer.streaming;
				const settled = !streaming && !!text.trim();
				const live = running || streaming;
				const thread = side.thread.slice();
				let index = -1;
				for (let i = thread.length - 1; i >= 0; i -= 1) {
					if (thread[i].role === "assistant" && thread[i].pending) {
						index = i;
						break;
					}
				}
				if (index === -1) {
					if (text.trim() || live) {
						thread.push({
							id: nextMessageId(),
							role: "assistant",
							text: text,
							pending: !settled,
							streaming: streaming,
						});
					}
				} else {
					thread[index] = Object.assign({}, thread[index], {
						text: text || thread[index].text,
						pending: !settled,
						streaming: streaming,
					});
				}
				setSide({ thread: thread, busy: live });
			};
			const source = binding.eventSource;
			const face = binding.session;
			const offSource = source && typeof source.subscribe === "function" ? source.subscribe(sync) : null;
			const offFace = face && typeof face.subscribe === "function" ? face.subscribe(sync) : null;
			sideOff = function () {
				if (typeof offSource === "function") {
					try {
						offSource();
					} catch (error) {
						/* already detached */
					}
				}
				if (typeof offFace === "function") {
					try {
						offFace();
					} catch (error) {
						/* already detached */
					}
				}
			};
			sync();
		}

		async function askSide(question) {
			const text = String(question || "").trim();
			if (!text || side.busy) return;
			const thread = side.thread.slice();
			thread.push({ id: nextMessageId(), role: "user", text: text });
			thread.push({ id: nextMessageId(), role: "assistant", text: "", pending: true, streaming: true });
			setSide({ thread: thread, busy: true, error: "" });
			try {
				const binding = await sideSession();
				if (!binding || !binding.session) throw new Error("no-side-session");
				sideBase = maxSeqOf(binding);
				observeSide(binding);
				const result = await binding.session.prompt([{ type: "text", text: text }], "queue");
				if (result && result.ok === false) throw new Error("prompt-rejected");
			} catch (error) {
				console.warn(NS + " side question failed", error);
				const failed = side.thread.slice();
				const last = failed[failed.length - 1];
				if (last && last.role === "assistant" && last.pending) {
					failed[failed.length - 1] = Object.assign({}, last, { pending: false, streaming: false });
				}
				setSide({
					thread: failed,
					busy: false,
					error: error && error.message === "no-side-session" ? t("sideNoSession") : t("sideFailed"),
				});
			}
		}

		function sideDraftPayload(question) {
			const body = contextBody(side.context);
			return body ? String(question).trim() + "\n\n" + body : String(question).trim();
		}

		function sendSideDraft(question) {
			if (!String(question || "").trim()) return;
			askSide(sideDraftPayload(question));
		}

		function sideAnswerPayload() {
			let answer = "";
			side.thread.forEach(function (message) {
				if (message.role === "assistant" && message.text) answer = message.text;
			});
			if (!answer) return "";
			const body = contextBody(side.context);
			return ["侧边聊天结论：", body, "", answer].filter(Boolean).join("\n");
		}

		function addSideAnswerToChat() {
			const payload = sideAnswerPayload();
			if (!payload) {
				toast(t("noComposer"), "error");
				return;
			}
			if (writeDraftOrCopy(payload)) toast(t("sideAddedAnswer"));
		}

		function copySideAnswer() {
			const payload = sideAnswerPayload();
			if (!payload) return;
			copyText(payload).then(
				function (ok) {
					toast(ok ? t("copied") : t("copyFailed"), ok ? "info" : "error");
				},
				function () {
					toast(t("copyFailed"), "error");
				},
			);
		}

		/**
		 * 「更多详情」: show the detail card and hand the deep-dive question to the
		 * free web app. The side chat is a real Session now, so no tokens are
		 * spent here.
		 */
		function openDetails() {
			setState({ expanded: true, commentOpen: false });
			deepDiveOnWeb();
		}

		/**
		 * 「在侧边聊天中提问」: open the side chat tab and drop the selection into
		 * its own composer, so the user only has to type the question.
		 */
		function openSideForAsk() {
			openSide();
			seedSideChat();
		}

		/* notes ----------------------------------------------------------------- */

		const notes = new Map();
		const noteListeners = new Set();
		/* Notes added while no Session could be resolved still belong to the
		 * composer the user is looking at, so they land under one shared key. */
		const NOTE_ANY = "*";

		function noteCount(sessionId) {
			const list = sessionId ? notes.get(sessionId) : null;
			return list ? list.length : 0;
		}

		/** The key the chip should read: this Session, else the shared key. */
		function noteKey(own, sessionId) {
			/*
			 * Strictly "my conversation, or the bucket for notes whose target
			 * Session could not be resolved". The older shape also fell back to
			 * the *last* note target, which made every other composer show the
			 * comment that had just been added somewhere else — the side chat was
			 * displaying the main chat's pill.
			 */
			return own ? sessionId : NOTE_ANY;
		}

		function noteSummary(sessionId) {
			const list = sessionId ? notes.get(sessionId) : null;
			if (!list) return "";
			return list
				.map(function (note) {
					const comment = String(note.comment || "").trim();
					const text = String(note.text || "").replace(/\s+/g, " ").trim();
					return comment || text.slice(0, 40);
				})
				.join(" · ");
		}

		function notifyNotes() {
			noteListeners.forEach(function (fn) {
				try {
					fn();
				} catch (error) {
					/* a broken renderer must not break the store */
				}
			});
		}

		function addNote(sessionId, note) {
			const key = typeof sessionId === "string" && sessionId ? sessionId : NOTE_ANY;
			const list = (notes.get(key) || []).slice();
			list.push(note);
			notes.set(key, list);
			notifyNotes();
		}

		function clearNotes(sessionId) {
			const key = typeof sessionId === "string" && sessionId ? sessionId : NOTE_ANY;
			if (!notes.has(key)) return;
			notes.delete(key);
			notifyNotes();
		}

		function subscribeNotes(fn) {
			noteListeners.add(fn);
			return function () {
				noteListeners.delete(fn);
			};
		}

		/**
		 * Notes are a plain store, so the snapshot is read **at render time** and the
		 * subscription only forces a re-render. Reading it inside the subscription
		 * callback (the older shape) bound the count to the key captured when the
		 * effect last ran: a freshly added note under a key that only became known
		 * later stayed invisible until the *next* note re-ran the effect — the
		 * reported "one comment shows no chip, two do".
		 */
		function useNotes(sessionId) {
			const pair = React.useState(0);
			const setTick = pair[1];
			React.useEffect(function () {
				return subscribeNotes(function () {
					setTick(function (n) {
						return n + 1;
					});
				});
			}, []);
			return { count: noteCount(sessionId), summary: noteSummary(sessionId) };
		}

		/* 「添加到对话」: quote + an optional one-line comment ---------------------- */

		function openComment() {
			if (!state.text.trim() && !state.images.length) {
				toast(t("emptyText"), "error");
				return;
			}
			setState({ commentOpen: true, expanded: false });
		}

		function confirmAdd(comment) {
			const text = String(state.text || "");
			const trimmed = String(comment || "").trim();
			if (!text.trim()) {
				addToChat();
				return;
			}
			const sessionId = zoneSessionId();
			addNote(sessionId, { text: text, comment: trimmed });
			const payload = toQuote(text) + (trimmed ? "\n\n" + trimmed : "");
			if (writeDraftOrCopy(payload)) addedToast();
			hide();
		}

		/* ------------------------------------------------------------ components */

		function useStore() {
			const pair = React.useState(getState);
			const snapshot = pair[0];
			const setSnapshot = pair[1];
			React.useEffect(function () {
				return subscribe(function () {
					setSnapshot(getState());
				});
			}, []);
			return snapshot;
		}

		function detailsRows(snapshot, stats) {
			return [
				h("div", { className: "dsa-row", key: "kind" }, [
					h("span", { className: "dsa-k", key: "k" }, t("kind")),
					h("span", { className: "dsa-v", key: "v" }, kindLabel()),
				]),
				h("div", { className: "dsa-row", key: "stat" }, [
					h("span", { className: "dsa-k", key: "k" }, t("chars")),
					h(
						"span",
						{ className: "dsa-v", key: "v" },
						stats.chars +
							" · " +
							t("words") +
							" " +
							stats.words +
							" · " +
							t("lines") +
							" " +
							stats.lines +
							" · " +
							t("paragraphs") +
							" " +
							stats.paragraphs +
							(stats.images ? " · " + t("images") + " " + stats.images : ""),
					),
				]),
				h("div", { className: "dsa-row", key: "source" }, [
					h("span", { className: "dsa-k", key: "k" }, t("source")),
					h("span", { className: "dsa-v", key: "v" }, snapshot.source || t("sceneOther")),
				]),
			];
		}

		function detailsThumbs(snapshot) {
			if (!snapshot.images.length) return null;
			return h(
				"div",
				{ className: "dsa-thumb" },
				snapshot.images.map(function (img, index) {
					return h("img", {
						key: index,
						src: img.currentSrc || img.src,
						alt: t("imageLabel") + " " + (index + 1),
					});
				}),
			);
		}

		function Details(props) {
			const snapshot = props.snapshot;
			const stats = computeStats();
			const rows = detailsRows(snapshot, stats);
			const actions = [];
			actions.push(
				h(
					"button",
					Object.assign(
						{
							className: "dsa-chip",
							"data-primary": "true",
							title: t("deepDiveHint"),
						},
						pressProps(deepDiveOnWeb, "deep-dive", "deep-dive"),
					),
					t("deepDive"),
				),
			);
			if (snapshot.text.trim()) {
				actions.push(
					h(
						"button",
						Object.assign(
							{ className: "dsa-chip" },
							pressProps(function () {
								copyText(snapshot.text).then(function (ok) {
									toast(ok ? t("copied") : t("copyFailed"), ok ? "info" : "error");
								});
							}, "copy-text", "copy-text"),
						),
						t("copyText"),
					),
				);
				actions.push(
					h(
						"button",
						Object.assign(
							{ className: "dsa-chip" },
							pressProps(function () {
								copyText(toQuote(snapshot.text)).then(function (ok) {
									toast(ok ? t("copied") : t("copyFailed"), ok ? "info" : "error");
								});
							}, "copy-quote", "copy-quote"),
						),
						t("copyQuote"),
					),
				);
			}
			snapshot.images.forEach(function (img, index) {
				actions.push(
					h(
						"button",
						Object.assign(
							{ className: "dsa-chip" },
							pressProps(function () {
								copyImage(img).then(function (ok) {
									toast(ok ? t("imageCopied") : t("imageFailed"), ok ? "info" : "error");
								});
							}, "copy-image-" + index, "copy-image-" + index),
						),
						t("copyImage") + (snapshot.images.length > 1 ? " " + (index + 1) : ""),
					),
				);
				actions.push(
					h(
						"button",
						Object.assign(
							{ className: "dsa-chip" },
							pressProps(function () {
								saveImage(img);
							}, "save-image-" + index, "save-image-" + index),
						),
						t("saveImage") + (snapshot.images.length > 1 ? " " + (index + 1) : ""),
					),
				);
			});
			return h("div", { className: "dsa-panel" }, [
				h("div", { className: "dsa-title", key: "title" }, t("panelTitle")),
				h("div", { key: "rows" }, rows),
				snapshot.text.trim()
					? h("pre", { className: "dsa-pre", key: "pre" }, snapshot.text)
					: h("div", { className: "dsa-pre", key: "pre" }, t("emptyText")),
				detailsThumbs(snapshot),
				h("div", { className: "dsa-actions", key: "actions" }, actions),
				h("div", { className: "dsa-note", key: "webnote" }, t("deepWebNote")),
			]);
		}

		function Toolbar(props) {
			const snapshot = props.snapshot;
			const size = props.size;
			const anchor = snapshot.anchor;
			const half = Math.max(size.w, 120) / 2;
			const gap = 10;
			const centered = anchor
				? clamp(anchor.cx, half + 12, Math.max(half + 12, window.innerWidth - half - 12))
				: window.innerWidth / 2;
			const above = anchor ? anchor.top - gap - size.h >= 8 : false;
			const style = {
				left: Math.round(centered) + "px",
				top: Math.round(anchor ? (above ? anchor.top - gap : anchor.bottom + gap) : 80) + "px",
				transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
			};
			const bar = h("div", { className: "dsa-bar", key: "bar" }, [
				h(
					"button",
					Object.assign(
						{ className: "dsa-btn", type: "button", title: t("addToChatHint") },
						pressProps(openComment, "add"),
					),
					t("addToChat"),
				),
				h("span", { className: "dsa-sep", key: "sep1" }),
				h(
					"button",
					Object.assign(
						{ className: "dsa-btn", type: "button", title: t("detailsHint") },
						pressProps(openDetails, "details"),
					),
					t("details"),
				),
				h("span", { className: "dsa-sep", key: "sep2" }),
				h(
					"button",
					Object.assign(
						{ className: "dsa-btn", type: "button", title: t("askSideHint") },
						pressProps(openSideForAsk, "ask"),
					),
					t("askSide"),
				),
			]);
			const children = [bar];
			if (snapshot.commentOpen) {
				children.push(h(CommentBox, { key: "comment", onConfirm: confirmAdd, onCancel: hide }));
			}
			if (snapshot.expanded) children.push(h(Details, { key: "details", snapshot: snapshot }));
			return h(
				"div",
				{
					className: "dsa-surface",
					[MARK]: "",
					[LAYER]: "",
					style: style,
					ref: props.innerRef,
					onMouseDown: function (event) {
						pointerOnPanel = true;
						const target = event.target;
						if (target && target.closest && target.closest("input,textarea")) return;
						event.preventDefault();
						event.stopPropagation();
					},
				},
				h("div", { className: "dsa-card" }, children),
			);
		}

		/* Markdown-lite renderer: paragraphs, headings, lists, fenced code, `code`, **bold**. */

		function inlineNodes(text, prefix) {
			const nodes = [];
			const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
			let last = 0;
			let match;
			let index = 0;
			while ((match = pattern.exec(text)) !== null) {
				if (match.index > last) nodes.push(text.slice(last, match.index));
				const token = match[0];
				index += 1;
				if (token.charAt(0) === "`") nodes.push(h("code", { key: prefix + "c" + index }, token.slice(1, -1)));
				else nodes.push(h("strong", { key: prefix + "b" + index }, token.slice(2, -2)));
				last = match.index + token.length;
			}
			if (last < text.length) nodes.push(text.slice(last));
			return nodes;
		}

		function markdownBlocks(text) {
			const blocks = [];
			String(text || "")
				.split(/```/)
				.forEach(function (part, index) {
					if (index % 2 === 1) {
						blocks.push({ type: "code", text: part.replace(/^[A-Za-z0-9+#._-]*\r?\n/, "").replace(/\s+$/, "") });
						return;
					}
					part.split(/\r\n?|\n/).forEach(function (line) {
						const trimmed = line.trim();
						if (!trimmed) return;
						if (/^#{1,6}\s+/.test(trimmed)) {
							blocks.push({ type: "h", text: trimmed.replace(/^#{1,6}\s+/, "") });
							return;
						}
						if (/^([-*+]|\d+[.)])\s+/.test(trimmed)) {
							blocks.push({ type: "li", text: trimmed.replace(/^([-*+]|\d+[.)])\s+/, "") });
							return;
						}
						blocks.push({ type: "p", text: trimmed });
					});
				});
			return blocks;
		}

		function markdownNodes(text) {
			const nodes = [];
			let list = null;
			let listKey = 0;
			const flush = function () {
				if (!list) return;
				listKey += 1;
				nodes.push(h("ul", { key: "ul" + listKey }, list));
				list = null;
			};
			markdownBlocks(text).forEach(function (block, index) {
				if (block.type === "li") {
					if (!list) list = [];
					list.push(h("li", { key: "li" + index }, inlineNodes(block.text, "li" + index)));
					return;
				}
				flush();
				if (block.type === "h") nodes.push(h("h4", { key: "h" + index }, inlineNodes(block.text, "h" + index)));
				else if (block.type === "code") nodes.push(h("pre", { key: "pre" + index }, h("code", null, block.text)));
				else nodes.push(h("p", { key: "p" + index }, inlineNodes(block.text, "p" + index)));
			});
			flush();
			return nodes;
		}

		/** Optional one-line comment for 「添加到对话」 (falls back to a bare quote). */
		function CommentBox(props) {
			const inputRef = React.useRef(null);
			/**
			 * React's events do not reach this overlay, so the input is uncontrolled
			 * and every value is read straight off the node.
			 */
			const readValue = function () {
				const el = inputRef.current;
				return el && typeof el.value === "string" ? el.value : "";
			};
			React.useEffect(function () {
				const el = inputRef.current;
				if (!el) return;
				try {
					el.focus();
				} catch (error) {
					/* focus is best effort */
				}
				const onKey = function (event) {
					if (event.key === "Enter") {
						event.preventDefault();
						props.onConfirm(readValue());
					} else if (event.key === "Escape") {
						event.preventDefault();
						props.onCancel();
					}
				};
				el.addEventListener("keydown", onKey);
				return function () {
					el.removeEventListener("keydown", onKey);
				};
			}, []);
			return h("div", { className: "dsa-comment", [MARK]: "", [LAYER]: "" }, [
				h("input", {
					key: "input",
					ref: inputRef,
					type: "text",
					defaultValue: "",
					placeholder: t("commentPlaceholder"),
					title: t("commentHint"),
				}),
				h(
					"button",
					Object.assign(
						{
							className: "dsa-icon",
							"data-strong": "true",
							title: t("commentAdd"),
						},
						pressProps(function () {
							props.onConfirm(readValue());
						}, "confirm", "confirm"),
					),
					t("commentAdd"),
				),
				h(
					"button",
					Object.assign(
						{ className: "dsa-icon", title: t("commentSkip") },
						pressProps(function () {
							props.onConfirm("");
						}, "skip", "skip"),
					),
					t("commentSkip"),
				),
			]);
		}

		/**
		 * The side chat itself. It has two homes: the right-hand column tab (the
		 * preferred one — see `installTab`) and, when the host gives us no column,
		 * the floating panel that sits beside the toolbar (never inside it: the
		 * toolbar's transform would capture `position: fixed`).
		 */
		function SideView(props) {
			const embedded = !!(props && props.embedded);
			const snapshot = useSide();
			const bodyRef = React.useRef(null);
			const inputRef = React.useRef(null);
			const draftPair = React.useState("");
			const draft = draftPair[0];
			const setDraft = draftPair[1];
			const open = snapshot.open;
			React.useEffect(
				function () {
					if (!embedded) return;
					if (!getSide().open) setSide({ open: true, docked: true });
				},
				[embedded],
			);
			React.useEffect(
				function () {
					const el = bodyRef.current;
					if (!el) return;
					el.scrollTop = el.scrollHeight;
				},
				[snapshot.thread, snapshot.busy],
			);
			React.useEffect(
				function () {
					if (!open) return;
					later(function () {
						const el = inputRef.current;
						if (!el) return;
						try {
							el.focus();
						} catch (error) {
							/* focus is best effort */
						}
					}, 40);
				},
				[open],
			);
			if (!embedded && !open) return null;
			const context = snapshot.context || {};
			const chip = contextTitle(context);
			const messages = snapshot.thread.map(function (message) {
				if (message.role === "user") {
					return h("div", { className: "dsa-msg dsa-msg-user", key: message.id }, h("div", null, message.text));
				}
				const inner = [h("div", { className: "dsa-md", key: "md" }, markdownNodes(message.text))];
				if (message.streaming) inner.push(h("span", { className: "dsa-caret", key: "caret" }));
				return h("div", { className: "dsa-msg dsa-msg-ai", key: message.id }, h("div", null, inner));
			});
			const send = function () {
				const el = inputRef.current;
				const live = el && typeof el.value === "string" ? el.value : draft;
				const text = String(live || "").trim();
				if (!text || snapshot.busy) return;
				if (el) el.value = "";
				setDraft("");
				sendSideDraft(text);
			};
			React.useEffect(function () {
				const el = inputRef.current;
				if (!el) return;
				/* The overlay gets no React events: read keys natively off the node. */
				const onKey = function (event) {
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						send();
					} else if (event.key === "Escape") {
						event.preventDefault();
						closeSide();
					}
				};
				el.addEventListener("keydown", onKey);
				return function () {
					el.removeEventListener("keydown", onKey);
				};
			}, []);
			return h("div", { className: embedded ? "dsa-side dsa-side-embedded" : "dsa-side", [MARK]: "", [LAYER]: "" }, [
				h("div", { className: "dsa-side-head", key: "head" }, [
					h("span", { className: "dsa-side-title", key: "title" }, t("sideTitle")),
					h(
						"span",
						{ className: "dsa-ctx", key: "ctx" },
						chip
							? h("span", { className: "dsa-ctx-chip", title: String(context.text || "").slice(0, 400) }, chip)
							: null,
					),
					h(
						"button",
						Object.assign(
							{ className: "dsa-icon", title: t("sideAddToChat") },
							pressProps(addSideAnswerToChat, "add", "side-add"),
						),
						t("sideAddToChat"),
					),
					h(
						"button",
						Object.assign(
							{ className: "dsa-icon", title: t("sideCopyAnswer") },
							pressProps(copySideAnswer, "copy", "side-copy"),
						),
						"⧉",
					),
					h(
						"button",
						Object.assign(
							{ className: "dsa-icon", title: t("sideWeb") },
							pressProps(sideWebVersion, "web", "side-web"),
						),
						"🌐",
					),
					embedded
						? null
						: h(
								"button",
								Object.assign(
									{ className: "dsa-icon", title: t("sideClose") },
									pressProps(closeSide, "close", "side-close"),
								),
								"×",
							),
				]),
				h(
					"div",
					{ className: "dsa-side-body", key: "body", ref: bodyRef },
					messages.length
						? messages
						: h("div", { className: "dsa-side-empty", key: "empty" }, [
								h("span", { className: "dsa-side-badge", key: "badge" }, "+"),
								h("span", { className: "dsa-side-note", key: "note" }, t("sideHint")),
							]),
				),
				snapshot.error ? h("div", { className: "dsa-err", key: "err" }, snapshot.error) : null,
				h(
					"div",
					{ className: "dsa-side-foot", key: "foot" },
					h("div", { className: "dsa-side-input" }, [
						h("textarea", {
							key: "input",
							ref: inputRef,
							rows: 1,
							"data-side-input": "",
							defaultValue: "",
							placeholder: t("sidePlaceholder"),
						}),
						h(
							"button",
							Object.assign(
								{ className: "dsa-send", title: t("sideSend") },
								pressProps(send, "send", "side-send"),
							),
							"➤",
						),
					]),
				),
			]);
		}

		/** The floating home of the side chat, used only while no tab could be docked. */
		function SidePanel() {
			const snapshot = useSide();
			if (!snapshot.open || snapshot.docked) return null;
			return h(SideView, { embedded: false });
		}

		/**
		 * The tab body must never fail blank: the host's own error boundary renders
		 * nothing, so anything thrown inside the embedded conversation view would
		 * leave an empty column with no explanation. Show the failure instead.
		 */
		class SideBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error: error };
			}
			componentDidCatch(error) {
				console.warn(NS + " the side chat failed to render", error);
			}
			render() {
				const error = this.state.error;
				if (error) {
					const text = String((error && (error.message || error)) || "").replace(/\s+/g, " ").slice(0, 200);
					return h(
						"div",
						{ className: "dsa-tab-body", [MARK]: "" },
						h("div", { className: "dsa-tab-note", [LAYER]: "" }, "侧边聊天渲染失败 · " + text),
					);
				}
				return this.props.children;
			}
		}

		/**
		 * The transcript column of the Chat view the pane embeds: the rows are its
		 * children. A collapsed group nests a column of its own, so only a match that
		 * owns itself counts. Returning null means "the view is not there yet".
		 */
		function chatColumn(pane) {
			if (!pane) return null;
			const columns = pane.querySelectorAll(CHAT_COLUMN);
			for (let i = 0; i < columns.length; i += 1) {
				const column = columns[i];
				try {
					if (column.closest(CHAT_COLUMN) === column) return column;
				} catch (error) {
					return null;
				}
			}
			return null;
		}

		/**
		 * Mark the Turns the side chat inherited from the main conversation, and only
		 * those: a row is hidden when the Turn it belongs to (`data-chat-turn`, the very
		 * attribute the host reads to track the Turn in view) is at or below the fork's
		 * boundary. Matching by Turn instead of by position is what keeps the side
		 * chat's own questions and answers visible — the pane re-renders, virtualises
		 * and scrolls, but a Turn number never moves. Marks are attributes, so the host
		 * keeps owning the DOM, and the Session is never changed: the fork's context
		 * stays whole, it simply stops being reprinted.
		 */
		function applyInheritedMask(pane) {
			if (!pane) return null;
			const boundary = sideBoundaryOf(sidePaneSessionId || getSide().sessionId);
			if (boundary === null) return null;
			const column = chatColumn(pane);
			if (!column) return null;
			let hidden = 0;
			let own = 0;
			const rows = column.children;
			for (let i = 0; i < rows.length; i += 1) {
				const row = rows[i];
				if (!row || row.nodeType !== 1) continue;
				const raw = row.getAttribute(CHAT_TURN_ATTR);
				const turn = raw === null ? NaN : Number(raw);
				if (!Number.isFinite(turn)) continue;
				if (turn <= boundary) {
					if (!row.hasAttribute(INHERITED_ATTR)) row.setAttribute(INHERITED_ATTR, "");
					hidden += 1;
				} else {
					if (row.hasAttribute(INHERITED_ATTR)) row.removeAttribute(INHERITED_ATTR);
					own += 1;
				}
			}
			if (own === 0) {
				/* Nothing of the side chat's own is visible yet: the collapsed rows would
				 * leave the composer alone at the top of the pane. Bottom-anchor it, as for
				 * a blank Session. Never removed — a genuinely blank Session needs it too. */
				pane.classList.add("dsa-tab-body-blank");
			}
			return hidden;
		}

		function sidePane() {
			return document.querySelector(".dsa-tab-body");
		}

		/**
		 * The docked home: the body of our `sidebar.right.pane.tab`. It renders the
		 * Kit's own conversation Factory for the side Session — the recipe
		 * `ui-subagent` uses for a child-session tab — so the side chat gets the
		 * resident composer (attachments, permission, expert, model, mic, send)
		 * and the live transcript instead of a hand-written textarea. The pane is
		 * Session-scoped: `props.sessionId` is the Session the tab belongs to, and
		 * the side chat forks from that one.
		 */
		function SideTabBody(props) {
			const sessionId = props && props.sessionId;
			const SessionProvider = props && props.SessionProvider;
			const renderSlot = props && props.renderSlot;
			/* A blank Session has no conversation view at all, so the composer needs the
			 * bottom-anchored variant of the pane (see .dsa-tab-body-blank). */
			const useSession = typeof props.useSession === "function" ? props.useSession : function () { return undefined; };
			const useSessions = typeof props.useSessions === "function" ? props.useSessions : function () { return undefined; };
			const sessionSnapshot = useSession(function (value) { return value; }) || {};
			const summaryBlank = useSessions(function (state) {
				return state && state.byId && typeof sessionId === "string" ? state.byId[sessionId] : undefined;
			});
			const blankPane = sessionSnapshot.blank === true || summaryBlank === true;
			const pair = React.useState(null);
			const reference = pair[0];
			const setReference = pair[1];
			const failedPair = React.useState(false);
			const failed = failedPair[0];
			const setFailed = failedPair[1];
			const reasonPair = React.useState("");
			const reason = reasonPair[0];
			const setReason = reasonPair[1];
			React.useEffect(
				function () {
					if (typeof sessionId === "string") dockSessionId = sessionId;
				},
				[sessionId],
			);
			React.useEffect(function () {
				let live = true;
				ensureSideReference().then(
					function (ref) {
						if (!live) return;
						setReference(ref || null);
						if (!ref) setReason("no-reference");
					},
					function (error) {
						console.warn(NS + " the side chat could not start", error);
						if (!live) return;
						setFailed(true);
						const raw = error && (error.code || error.message) ? error.code || error.message : error;
						setReason(String(raw || "unknown").replace(/\s+/g, " ").slice(0, 60));
					},
				);
				return function () {
					live = false;
				};
			}, []);
			React.useEffect(
				function () {
					if (!reference) return undefined;
					/*
					 * The pane's own reference — not the slot's `sessionId` (which is the
					 * workspace's, i.e. the main chat) — is what 「添加到对话」 must write
					 * into when the selection came from this pane.
					 */
					sidePaneSessionId = reference.sessionId || null;
					return function () {
						if (sidePaneSessionId === (reference.sessionId || null)) sidePaneSessionId = null;
					};
				},
				[reference],
			);
			/*
			 * Keep the side chat's memory without reprinting it: every row of an inherited
			 * Turn is marked hidden (see applyInheritedMask), and the marks are *repaired*
			 * for as long as the pane lives. Repair is needed, not optional: the host
			 * virtualises the transcript and re-renders rows, so a new row element can
			 * arrive without the mark — and the boundary itself only becomes known once
			 * the forked Session can be read back.
			 */
			React.useEffect(
				function () {
					if (!reference) return undefined;
					let pane = sidePane();
					let interval = null;
					let observer = null;
					const pass = function () {
						if (!pane) pane = sidePane();
						applyInheritedMask(pane);
					};
					interval = setInterval(pass, 250);
					if (pane && typeof MutationObserver === "function") {
						observer = new MutationObserver(function () {
							pass();
						});
						observer.observe(pane, { childList: true, subtree: true });
					}
					pass();
					return function () {
						if (interval) clearInterval(interval);
						if (observer) observer.disconnect();
					};
				},
				[reference],
			);
			const note = function (key, extra) {
				return h("div", { className: "dsa-tab-note", [LAYER]: "" }, extra ? t(key) + " · " + extra : t(key));
			};
			const body =
				!SessionProvider || typeof renderSlot !== "function"
					? note("sideHint")
					: failed
						? note("sideNoSession", reason)
						: !reference
							? note("sideStarting", reason)
							: h(SessionProvider, { session: reference }, renderSlot(SIDE_SLOT, {}));
			return h("div", { className: blankPane ? "dsa-tab-body dsa-tab-body-blank" : "dsa-tab-body", [MARK]: "" }, [
				h(SideBoundary, { key: "body" }, body),
			]);
		}

		/** The one View the embedded Factory may show: the resident Chat view. */
		function SideConversationView(props) {
			if (!props || typeof props.renderSlot !== "function") return null;
			return h(React.Fragment, null, props.renderSlot("conversation.session", { view: "chat" }));
		}

		/**
		 * The occupant of our own child slot: it renders the shipped
		 * `conversation.content` Factory for the side Session with
		 * `variant: "embedded"` and the local View fixed to Chat — the shape the
		 * subagent tab uses, which omits the main conversation's header and width
		 * controls while keeping the resident composer.
		 */
		function SideConversation(props) {
			/*
			 * Derive the embedded Factory's own phase exactly as the shipped right-column
			 * chat panel does. It is layout, not decoration: a blank Session renders no
			 * conversation view at all, so with `active` the composer is the only child
			 * left in the Fact column and it sticks to the TOP of the pane — the reported
			 * "对话框位置不对". `hero` is the host's own blank-state layout, and the pane
			 * pins the composer to the bottom as soon as the Session has content.
			 */
			const useSession = typeof props.useSession === "function" ? props.useSession : function () { return undefined; };
			const useConversation = typeof props.useConversation === "function" ? props.useConversation : function () { return undefined; };
			const useSessions = typeof props.useSessions === "function" ? props.useSessions : function () { return undefined; };
			const session = useSession(function (value) { return value; }) || {};
			const conversation = useConversation(function (value) { return value; }) || {};
			const sessionId = props.sessionId;
			const summaryBlank = useSessions(function (state) {
				return state && state.byId ? state.byId[sessionId] : undefined;
			});
			const live = conversation.activeTargets && conversation.activeTargets.size > 0;
			const shellPhase = live || (!session.blank && !session.awaitingFirstTurn) || session.running ? "active" : "blank";
			const hero = shellPhase === "blank" && (session.openState === "open" || summaryBlank === true);
			if (typeof props.renderFactorySlot !== "function") return null;
			/* Never `settling`: while a freshly retained Session is still "loading" the
			 * host hides the Composer seat with visibility:hidden, which leaves the whole
			 * pane empty; our reference is already ready, so hero/active is correct. */
			return props.renderFactorySlot(
				"conversation.content",
				{ variant: "embedded", phase: hero ? "hero" : "active", hero: hero },
				{ slots: { views: SideConversationView } },
			);
		}

		/** The tab strip's chip for our kind; the definition title is the fallback. */
		function SideTabTitle(props) {
			const info = props && typeof props.useTabInfo === "function" ? props.useTabInfo() : undefined;
			const title = info && info.tab && info.tab.title ? info.tab.title : t("sideTitle");
			return h("span", { className: "dsa-tab-title" }, title);
		}

		/** The glyph the right column shows for our guide entry. */
		function SideIcon(props) {
			const size = (props && props.size) || 22;
			return h(
				"svg",
				{
					className: props && props.className,
					width: size,
					height: size,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.6,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
				},
				[
					h("path", { key: "bubble", d: "M20 12a8 8 0 1 0-3.2 6.4L21 19l-.6-3.2A7.9 7.9 0 0 0 20 12Z" }),
					h("path", { key: "line1", d: "M8.5 10.5h7" }),
					h("path", { key: "line2", d: "M8.5 13.5h4.5" }),
				],
			);
		}

		/** The small note glyph the notes pill shows, matching the reference pill. */
		function NoteGlyph(props) {
			const size = (props && props.size) || 14;
			return h(
				"svg",
				{
					className: props && props.className,
					width: size,
					height: size,
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
				},
				[
					h("rect", { key: "box", x: "2.4", y: "2.4", width: "11.2", height: "11.2", rx: "3" }),
					h("path", { key: "l1", d: "M5.6 6.4h4.8" }),
					h("path", { key: "l2", d: "M5.6 9.4h3" }),
				],
			);
		}

		/**
		 * How many notes this Session carries, as a pill in the full-width dock zone
		 * directly above the resident composer card — the same zone the host uses for
		 * its todo/goal/queue docks, so the count reads as part of the input area.
		 * The pill keeps the first note's text as its tooltip; × clears the store.
		 */
		function NoteChip(props) {
			/*
			 * Which conversation this pill belongs to. The slot props win; when the
			 * host does not hand an id down, the pill decides by where it was
			 * mounted: inside the side tab's body it belongs to that pane's Session,
			 * anywhere else to the main one. The mount check runs in an effect (the
			 * node does not exist before that), so the id stays `null` for the first
			 * pass and the pill simply does not show yet — better than briefly
			 * reading the main chat's notes inside the side pane.
			 */
			const ref = React.useRef(null);
			const seatPair = React.useState(null);
			const seat = seatPair[0];
			const setSeat = seatPair[1];
			const propsId =
				props && typeof props.sessionId === "string" && props.sessionId ? props.sessionId : null;
			const paneId = sidePaneSessionId || getSide().sessionId || null;
			const inPane = seat ? seat.inPane : null;
			const sessionId = propsId || (inPane === null ? null : inPane ? paneId : currentSessionId());
			React.useEffect(function () {
				const el = ref.current;
				const inside = !!(el && el.closest && el.closest(".dsa-tab-body"));
				setSeat(function (prev) {
					if (prev && prev.inPane === inside) return prev;
					return { inPane: inside };
				});
			});
			React.useEffect(
				function () {
					if (propsId && !isSideSession(propsId)) {
						composerSessionId = propsId;
					}
				},
				[propsId],
			);
			const lookup = noteKey(noteCount(sessionId), sessionId);
			const snapshot = useNotes(lookup);
			/*
			 * The wrapper is always mounted (hidden with no notes) so the mount check
			 * above always has a node to look at: a pill that never rendered could
			 * not tell which composer it sits in.
			 */
			const kids = snapshot.count
				? [
						h(
							"span",
							{
								className: "dsa-notes-chip",
								key: "chip",
								title: snapshot.summary,
							},
							[
								h(NoteGlyph, { key: "glyph", size: 14 }),
								h("span", { key: "count" }, snapshot.count + t("noteSuffix")),
								h(
									"button",
									{
										className: "dsa-icon",
										key: "clear",
										type: "button",
										title: t("noteClear"),
										onClick: function () {
											clearNotes(lookup);
										},
									},
									"×",
								),
							],
						),
					]
				: [];
			return h(
				"div",
				{
					className: "dsa-notes",
					ref: ref,
					style: snapshot.count ? undefined : { display: "none" },
					[MARK]: "",
					[LAYER]: "",
				},
				kids,
			);
		}

		function Toast(props) {
			return h(
				"div",
				{ className: "dsa-toast", "data-kind": props.toast.kind || "info", [MARK]: "", [LAYER]: "" },
				props.toast.text,
			);
		}

		function Root() {
			const snapshot = useStore();
			const ref = React.useRef(null);
			const sizePair = React.useState({ w: 300, h: 40 });
			const size = sizePair[0];
			const setSize = sizePair[1];
			React.useLayoutEffect(function () {
				const el = ref.current;
				if (!el) return;
				const rect = el.getBoundingClientRect();
				if (Math.abs(rect.width - size.w) > 1 || Math.abs(rect.height - size.h) > 1) {
					setSize({ w: rect.width, h: rect.height });
				}
			});
			const children = [];
			if (snapshot.open && snapshot.anchor) {
				children.push(h(Toolbar, { key: "bar", snapshot: snapshot, size: size, innerRef: ref }));
			}
			if (snapshot.toast) children.push(h(Toast, { key: "toast", toast: snapshot.toast }));
			if (!children.length) return null;
			const tree = h(React.Fragment, null, children);
			if (createPortal) {
				try {
					return createPortal(tree, document.body);
				} catch (error) {
					/* fall back to in-place rendering */
				}
			}
			return tree;
		}

		/* --------------------------------------------------------------- wiring */

		function installStyles(ctx) {
			try {
				const style = document.createElement("style");
				style.setAttribute("data-plugin", PLUGIN_ID);
				style.textContent = CSS;
				document.head.appendChild(style);
				ctx.effect(function () {
					return function () {
						style.remove();
					};
				}, PLUGIN_ID + ": styles");
			} catch (error) {
				/* styling is best effort */
			}
		}

		function installLocale(ctx) {
			const locale = ctxGet("locale");
			if (locale && typeof locale.register === "function") {
				try {
					locale.register(NS, { zh: ZH, en: EN });
				} catch (error) {
					/* fall back to the built-in dictionary */
				}
			}
			let bound = null;
			if (locale && typeof locale.bind === "function") {
				try {
					bound = locale.bind(NS);
				} catch (error) {
					bound = null;
				}
			}
			t = function (key) {
				if (bound) {
					try {
						const value = bound(key);
						if (value && value !== key) return value;
					} catch (error) {
						/* fall through */
					}
				}
				return ZH[key] || key;
			};
		}

		/**
		 * Headless entry inside the composer. A session-scope list slot hands its
		 * entries the live `sessionId` plus the public `inputActions` face — the one
		 * supported way for a frame-wide overlay to reach the resident composer.
		 */
		function Bridge(props) {
			const sessionId = props && props.sessionId;
			const actions = props && props.inputActions;
			React.useEffect(
				function () {
					const candidate = { sessionId: sessionId, actions: actions };
					const score = function (value) {
						return (
							(value && typeof value.sessionId === "string" ? 2 : 0) +
							(value && value.actions && typeof value.actions.setDraft === "function" ? 1 : 0)
						);
					};
					if (typeof sessionId === "string") bridgeSeats.set(sessionId, candidate);
					if (score(candidate) > 0 && !candidate.sessionId) bridge = candidate;
					/*
					 * `bridge` stays the main conversation's seat: the pane's shell must
					 * never become the fallback the whole frame reads as "on screen".
					 */
					const main = mainBridgeSeat();
					if (main) bridge = main;
					if (typeof sessionId === "string" && !isSideSession(sessionId)) composerSessionId = sessionId;
					return function () {
						if (typeof sessionId === "string" && bridgeSeats.get(sessionId) === candidate) {
							bridgeSeats.delete(sessionId);
						}
						const next = mainBridgeSeat();
						bridge = next && next.sessionId ? next : null;
					};
				},
				[sessionId, actions],
			);
			return null;
		}

		function registerInto(slots, meta, Component) {
			if (typeof slots.inject === "function") {
				try {
					return slots.inject(meta.name, function () {
						return slots.register(meta, Component);
					});
				} catch (error) {
					/* fall through to a direct registration */
				}
			}
			try {
				const off = slots.register(meta, Component);
				return typeof off === "function" ? off : function () {};
			} catch (error) {
				console.warn(NS + " could not register into " + meta.name, error);
				return function () {};
			}
		}

		/** Bound a host promise so a hung stage shows up instead of spinning forever. */
		function withTimeout(promise, ms, label) {
			return new Promise(function (resolve, reject) {
				let settled = false;
				const timer = setTimeout(function () {
					if (settled) return;
					settled = true;
					reject(new Error("timeout:" + label));
				}, ms);
				Promise.resolve(promise).then(
					function (value) {
						if (settled) return;
						settled = true;
						clearTimeout(timer);
						resolve(value);
					},
					function (error) {
						if (settled) return;
						settled = true;
						clearTimeout(timer);
						reject(error);
					},
				);
			});
		}

		function installSlot(ctx) {
			const slots = ctxGet("slots");
			if (!slots) return;
			ctx.effect(function () {
				return registerInto(slots, { name: "shell.overlay", id: "selection-toolbar", order: 900 }, Root);
			}, PLUGIN_ID + ": overlay entry");
			/*
			 * The composer bridge rides several session-scope list slots: the renderer
			 * hands each of them the live `sessionId` and `inputActions`, but not every
			 * slot carries both, so whichever entry has the richest props wins.
			 */
			[
				{ name: "conversation.input.right", id: "selection-toolbar-bridge", order: 900 },
				{ name: "conversation.input.overlay", id: "selection-toolbar-bridge-overlay", order: 900 },
				{ name: "conversation.input.left", id: "selection-toolbar-bridge-left", order: 900 },
			].forEach(function (meta) {
				ctx.effect(function () {
					return registerInto(slots, meta, Bridge);
				}, PLUGIN_ID + ": composer bridge into " + meta.name);
			});
			/*
			 * The notes pill rides the full-width dock zone above the composer card
			 * (the host's own todo/goal/queue docks live here too). The card's inner
			 * rail is a single shipped seat, and `composer.dock` renders below the
			 * card, so this is the only seat that puts the count inside the input area.
			 */
			ctx.effect(function () {
				return registerInto(
					slots,
					{ name: "conversation.input.dock", id: "selection-toolbar-notes", order: 30 },
					NoteChip,
				);
			}, PLUGIN_ID + ": notes chip");
		}

		/**
		 * Contribute「侧边聊天」to the right-hand column: the tab type plus the guide
		 * entry the column's add control lists, and the two keyed seats that draw the
		 * tab itself (its body and its chip). `sidebarRightTabs` is the tab registry;
		 * the seat key must be the definition id, which is why both use `PLUGIN_ID`.
		 */
		function installTab(ctx) {
			const tabs = ctxGet("sidebarRightTabs");
			if (tabs && typeof tabs.register === "function") {
				ctx.effect(function () {
					const disposer = tabs.register({
						id: PLUGIN_ID,
						kind: SIDE_KIND,
						title: function () {
							return t("sideTitle");
						},
						guide: [
							{
								id: PLUGIN_ID,
								order: 40,
								title: function () {
									return t("sideTitle");
								},
								description: function () {
									return t("sideGuideHint");
								},
								icon: SideIcon,
							},
						],
					});
					return typeof disposer === "function" ? disposer : function () {};
				}, PLUGIN_ID + ": side chat tab type");
			} else {
				console.warn(NS + " sidebarRightTabs unavailable — the side chat stays a floating panel");
			}
			const slots = ctxGet("slots");
			if (!slots) return;
			const seat = {
				name: "sidebar.right.pane.tab",
				key: PLUGIN_ID,
				children: {},
			};
			seat.children[SIDE_SLOT] = { kind: "single", scope: "session" };
			ctx.effect(function () {
				return registerInto(slots, seat, SideTabBody);
			}, PLUGIN_ID + ": side chat tab body");
			ctx.effect(function () {
				return registerInto(slots, { name: SIDE_SLOT }, SideConversation);
			}, PLUGIN_ID + ": side chat conversation");
			ctx.effect(function () {
				return registerInto(slots, { name: "sidebar.right.pane.tab.title", key: PLUGIN_ID }, SideTabTitle);
			}, PLUGIN_ID + ": side chat tab chip");
		}

		function installListeners(ctx) {
			const onSelectionChange = function () {
				/* A press inside our own surface must not tear the surface down. */
				if (pointerOnPanel) return;
				if (state.open) refresh(true);
			};
			const onMouseUp = function (event) {
				if (isOwn(event.target)) return;
				const descriptor = readSelection();
				if (descriptor) {
					showFor(descriptor);
					return;
				}
				const img = imageTarget(event.target);
				if (img) {
					showFor({
						text: "",
						images: [img],
						rect: img.getBoundingClientRect(),
						node: img,
						zone: zoneOf(img),
					});
					return;
				}
				hide();
			};
			const onKeyUp = function (event) {
				if (event.key === "Escape") {
					hide();
					return;
				}
				if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) refresh(true);
			};
			const onKeyDown = function (event) {
				if (event.key !== "Escape") return;
				hide();
			};
			const onViewportChange = function () {
				if (pointerOnPanel) return;
				if (state.open) hide();
			};
			/*
			 * Every action button is dispatched here. Window capture runs before any
			 * handler the shell installs on `document`, so a press on our own floating
			 * layer cannot be swallowed before it reaches the action.
			 */
			const onGlobalPress = function (event) {
				const target = event.target;
				if (!target || typeof target.closest !== "function") return;
				/*
				 * A press inside the floating layer must not collapse the selection our
				 * action is about to read — but `MARK` is also on the side-chat tab, which
				 * is a real conversation surface: guarding it there swallowed every press
				 * on its `contenteditable` composer, so the caret could never be placed and
				 * the box could not be typed into. Guard the layer itself, and exempt
				 * everything the browser is supposed to focus on its own.
				 */
				const editable = target.closest("input,textarea,select,[contenteditable]");
				if (!editable && target.closest(".dsa-surface")) {
					pointerOnPanel = true;
					if (event.preventDefault) event.preventDefault();
				}
				const node = target.closest("[data-dsa-act]");
				if (!node) return;
				routePress(node.getAttribute("data-dsa-act"), event);
			};
			window.addEventListener("pointerdown", onGlobalPress, true);
			window.addEventListener("click", onGlobalPress, true);
			/* The press is over: release the guard on the next tick, after mouseup. */
			const onPressRelease = function () {
				if (!pointerOnPanel) return;
				later(function () {
					pointerOnPanel = false;
				}, 0);
			};
			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("mouseup", onMouseUp, true);
			document.addEventListener("pointerup", onPressRelease, true);
			document.addEventListener("mouseup", onPressRelease, true);
			document.addEventListener("keyup", onKeyUp, true);
			document.addEventListener("keydown", onKeyDown, true);
			document.addEventListener("scroll", onViewportChange, true);
			window.addEventListener("resize", onViewportChange);
			ctx.effect(function () {
				return function () {
					document.removeEventListener("selectionchange", onSelectionChange);
					document.removeEventListener("mouseup", onMouseUp, true);
					window.removeEventListener("pointerdown", onGlobalPress, true);
					window.removeEventListener("click", onGlobalPress, true);
					document.removeEventListener("pointerup", onPressRelease, true);
					document.removeEventListener("mouseup", onPressRelease, true);
					document.removeEventListener("keyup", onKeyUp, true);
					document.removeEventListener("keydown", onKeyDown, true);
					document.removeEventListener("scroll", onViewportChange, true);
					window.removeEventListener("resize", onViewportChange);
					timers.forEach(function (id) {
						window.clearTimeout(id);
						window.clearInterval(id);
					});
					timers.clear();
				};
			}, PLUGIN_ID + ": listeners");
		}

		function apply(ctx) {
			rootCtx = ctx;
			try {
				installStyles(ctx);
			} catch (error) {
				console.warn("[selection-toolbar] styles failed", error);
			}
			try {
				installLocale(ctx);
			} catch (error) {
				console.warn("[selection-toolbar] locale failed", error);
			}
			try {
				installSlot(ctx);
			} catch (error) {
				console.warn("[selection-toolbar] slot registration failed", error);
			}
			try {
				installTab(ctx);
			} catch (error) {
				console.warn("[selection-toolbar] side chat tab registration failed", error);
			}
			try {
				installListeners(ctx);
			} catch (error) {
				console.warn("[selection-toolbar] listeners failed", error);
			}
			ctx.effect(function () {
				return function () {
					if (sideOff) {
						try {
							sideOff();
						} catch (error) {
							/* already detached */
						}
						sideOff = null;
					}
					if (sideRef) {
						try {
							sideRef.release();
						} catch (error) {
							/* already released */
						}
						sideRef = null;
					}
					sideListeners.clear();
					noteListeners.clear();
				};
			}, PLUGIN_ID + ": side chat");
		}

		return {
			name: PLUGIN_ID,
			inject: ["slots", "sidebarRightTabs"],
			apply: apply,
		};
	},
});
