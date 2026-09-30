// ==UserScript==
// @name         DeepSeek Web · ?q= auto-fill（配合「选区工具栏」）
// @name:en      DeepSeek Web · ?q= auto-fill (for the selection toolbar)
// @namespace    dsh-selection-toolbar
// @version      1.1.0
// @description  chat.deepseek.com 自己不读 ?q=，而且会把上次没发送的草稿留着。这个小脚本在页面加载时读一次 ?q=，把它**覆盖**进输入框（并在随后几秒里守住，防止站点随后把旧草稿恢复回来），于是工具栏的「让 DeepSeek 详解（网页版，免费）」就变成全自动，不用再按 Ctrl+V。
// @description:en  chat.deepseek.com ignores ?q= on its own and keeps restoring the draft you never sent. This tiny script reads ?q= on load, writes it **over** that draft, and re-asserts for a few seconds so the site cannot restore the stale one — the toolbar's “Explain on the free web app” then lands automatically instead of asking for Ctrl+A + Ctrl+V.
// @author       dsh-selection-toolbar
// @match        https://chat.deepseek.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
	"use strict";

	var q = new URLSearchParams(location.search).get("q");
	if (!q) return;

	/* Consume the parameter, so a reload (or Back) never re-fills an old prompt. */
	try {
		history.replaceState(null, "", location.pathname + location.hash);
	} catch (error) {
		/* a restricted history still lets the fill below happen */
	}

	function setNativeValue(element, value) {
		var proto =
			element instanceof HTMLTextAreaElement
				? HTMLTextAreaElement.prototype
				: element instanceof HTMLInputElement
					? HTMLInputElement.prototype
					: null;
		var descriptor = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
		/* React tracks the last value it wrote; going through the native setter
		   makes the framework see the change and keep its own state in sync. */
		if (descriptor && descriptor.set) descriptor.set.call(element, value);
		else element.value = value;
	}

	function fill(editor) {
		if (editor.isContentEditable) {
			editor.focus();
			var selection = window.getSelection();
			var range = document.createRange();
			range.selectNodeContents(editor);
			selection.removeAllRanges();
			selection.addRange(range);
			var inserted = false;
			try {
				inserted = document.execCommand("insertText", false, q);
			} catch (error) {
				inserted = false;
			}
			if (!inserted) {
				editor.textContent = q;
				editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: q }));
			}
			return;
		}
		setNativeValue(editor, q);
		editor.dispatchEvent(new Event("input", { bubbles: true }));
	}

	function currentText(editor) {
		return editor.isContentEditable ? editor.textContent : editor.value;
	}

	function sameText(a, b) {
		return String(a || "").replace(/\s+/g, " ").trim() === String(b || "").replace(/\s+/g, " ").trim();
	}

	/* The app restores the user's unsent draft once it finishes booting, which can
	   land right after our first fill. Re-assert for a few seconds so the current
	   selection wins over that stale draft — but stop the moment the user types,
	   because from then on the box is theirs. */
	function guard(editor) {
		var checks = 0;
		var timer = setInterval(function () {
			checks += 1;
			if (checks > 12) {
				clearInterval(timer);
				return;
			}
			if (!editor.isConnected || !sameText(currentText(editor), q)) fill(editor);
		}, 250);
		document.addEventListener(
			"keydown",
			function () {
				clearInterval(timer);
			},
			{ once: true, capture: true },
		);
	}

	/* The composer only exists after the app boots, so poll briefly for it. */
	var tries = 0;
	var timer = setInterval(function () {
		tries += 1;
		var editor = document.querySelector("textarea, div[contenteditable='true']");
		if (editor) {
			clearInterval(timer);
			fill(editor);
			guard(editor);
			try {
				editor.dispatchEvent(new Event("change", { bubbles: true }));
			} catch (error) {
				/* optional event: filling already happened */
			}
			return;
		}
		if (tries > 60) clearInterval(timer); /* ~15s, then give up quietly */
	}, 250);
})();
