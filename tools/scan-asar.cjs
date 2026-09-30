#!/usr/bin/env node
/**
 * Raw byte scan of the packaged Electron bundle: the app shell (mf) is stored
 * inside a single asar archive, so the only way to read its client code is to
 * search the concatenated blob directly.
 *
 * Usage: node scan-asar.js <needle> [windowBefore] [windowAfter] [maxHits] <outFile>
 */
const fs = require("fs");

const asar =
	process.argv[2] ||
	"C:\\Users\\ROG\\AppData\\Local\\Programs\\DeepSeek Harness\\resources\\app.asar";
const needle = process.argv[3] || "RetainInfo";
const before = Number(process.argv[4] || 600);
const after = Number(process.argv[5] || 1200);
const maxHits = Number(process.argv[6] || 6);
const outFile = process.argv[7] || "C:\\Users\\ROG\\Documents\\DeepSeek\\dsh-selection-toolbar\\tools\\asar-scan.txt";

const buf = fs.readFileSync(asar);
const pat = Buffer.from(needle, "utf8");
const chunks = [];
let index = 0;
let hits = 0;
while (hits < maxHits) {
	index = buf.indexOf(pat, index);
	if (index === -1) break;
	const start = Math.max(0, index - before);
	const end = Math.min(buf.length, index + after);
	chunks.push(
		"\n===== hit " + hits + " at byte " + index + " =====\n" +
			buf.slice(start, end).toString("utf8").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " "),
	);
	index += pat.length;
	hits += 1;
}
fs.writeFileSync(outFile, "needle=" + needle + " hits=" + hits + " size=" + buf.length + "\n" + chunks.join("\n"), "utf8");
console.log("needle=" + needle + " hits=" + hits + " -> " + outFile);
