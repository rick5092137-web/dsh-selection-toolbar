#!/usr/bin/env node
/**
 * Minimal asar reader. Usage:
 *   node asar.js list <regex>                    -> list matching internal paths (files)
 *   node asar.js cat  <path> [start] [end]       -> print lines [start,end] (1-based, svc if omitted)
 *   node asar.js grep <regex> <pathRegex> [max]  -> grep file *contents*, print path:line: text
 */
const fs = require("fs");
const ASAR = "C:\\Users\\ROG\\AppData\\Local\\Programs\\DeepSeek Harness\\resources\\app.asar";

let cached = null;
function load() {
	if (cached) return cached;
	const buf = fs.readFileSync(ASAR);
	const headerSize = buf.readUInt32LE(12);
	const headerStr = buf.slice(16, 16 + headerSize).toString("utf8");
	const header = JSON.parse(headerStr);
	const base = 16 + headerSize;
	const out = new Map();
	(function walk(node, prefix) {
		for (const [name, entry] of Object.entries(node.files || {})) {
			const p = prefix + "/" + name;
			if (entry.files) walk(entry, p);
			else if (entry.offset !== undefined) {
				const off = Number(entry.offset);
				out.set(p, buf.slice(base + off, base + off + entry.size));
			}
		}
	})(header, "");
	cached = out;
	return out;
}

const cmd = process.argv[2];
if (cmd === "list") {
	const re = new RegExp(process.argv[3] || ".", "i");
	let n = 0;
	for (const p of load().keys()) if (re.test(p)) { console.log(p); n++; }
	console.log("[" + n + " matches]");
} else if (cmd === "cat") {
	const files = load();
	const key = process.argv[3];
	const hit = files.has(key) ? key : [...files.keys()].find((p) => p.endsWith(key));
	if (!hit) { console.log("NOT FOUND: " + key); process.exit(1); }
	const text = files.get(hit).toString("utf8");
	const lines = text.split("\n");
	const start = Number(process.argv[4] || 1);
	const end = Number(process.argv[5] || lines.length);
	console.log("### " + hit + "  (" + lines.length + " lines, bytes " + files.get(hit).length + ")");
	for (let i = start; i <= Math.min(end, lines.length); i++) console.log(String(i) + "\t" + lines[i - 1]);
} else if (cmd === "grep") {
	const re = new RegExp(process.argv[3], "g");
	const pathRe = new RegExp(process.argv[4] || ".", "i");
	const max = Number(process.argv[5] || 200);
	let n = 0;
	for (const [p, b] of load()) {
		if (!pathRe.test(p)) continue;
		if (b.length > 6 * 1024 * 1024) continue;
		const lines = b.toString("utf8").split("\n");
		for (let i = 0; i < lines.length; i++) {
			re.lastIndex = 0;
			if (re.test(lines[i])) {
				console.log(p + ":" + (i + 1) + ": " + lines[i].slice(0, 300));
				if (++n >= max) { console.log("[hit cap " + max + "]"); process.exit(0); }
			}
		}
	}
	console.log("[" + n + " hits]");
} else {
	console.log("usage: list|cat|grep");
}
