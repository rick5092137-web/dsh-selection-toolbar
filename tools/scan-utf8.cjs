#!/usr/bin/env node
/*
 * UTF-8 safe needle scan for app.asar.
 *
 * The Chinese needles used with scan-asar.cjs came back as mojibake (0 hits),
 * so this variant reads the needle from a UTF-8 file instead of argv.
 *
 * usage: node scan-utf8.cjs <asar> <needleFile> [before] [after] [maxHits] [outFile]
 */
const fs = require("fs");

const [, , asarPath, needleFile, beforeArg, afterArg, maxArg, outFile] = process.argv;
if (!asarPath || !needleFile) {
	console.error("usage: node scan-utf8.cjs <asar> <needleFile> [before] [after] [maxHits] [outFile]");
	process.exit(2);
}

const before = Number(beforeArg || 300);
const after = Number(afterArg || 500);
const maxHits = Number(maxArg || 8);
const needle = fs.readFileSync(needleFile, "utf8").replace(/\r?\n$/, "");
const buf = fs.readFileSync(asarPath);
const pattern = Buffer.from(needle, "utf8");

const chunks = [];
let from = 0;
let hits = 0;
while (hits < maxHits) {
	const at = buf.indexOf(pattern, from);
	if (at < 0) break;
	hits += 1;
	const start = Math.max(0, at - before);
	const end = Math.min(buf.length, at + pattern.length + after);
	chunks.push(
		"### hit " + hits + " @" + at + "\n" + buf.slice(start, end).toString("utf8") + "\n",
	);
	from = at + pattern.length;
}

const report =
	"needle=" + needle + " hits=" + hits + " size=" + buf.length + "\n\n" + chunks.join("\n");
if (outFile) fs.writeFileSync(outFile, report, "utf8");
process.stdout.write("needle=" + needle + " hits=" + hits + (outFile ? " -> " + outFile : "") + "\n");
if (!outFile) process.stdout.write(report);
