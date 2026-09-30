# tools/

开发期用来读 `app.asar` 的小工具，**不随 npm 包发布**（`package.json` 的 `files` 只含 `lib`、`client`、`userscript`、`cordis.patch.yml`、`README.md`、`CHANGELOG.md`）。

DeepSeek Harness 的宿主代码（包括 UI 的客户端半体）打包在单个 asar 归档里，没有源码目录可读，所以只能对归档做字节级检索。

默认目标归档：

```
C:\Users\ROG\AppData\Local\Programs\DeepSeek Harness\resources\app.asar
```

## asar.cjs

把 asar 当普通归档用（读取内嵌的 node_modules 包文件）。

```powershell
node asar.cjs list  <regex>                  # 列出路径匹配的条目
node asar.cjs cat   <path> [start] [end]     # 打印某个文件（可按行区间截取）
node asar.cjs grep  <regex> <pathRegex> [max] # 在匹配的文件里搜内容，带行号
```

## scan-asar.cjs

在归档的原始字节流里搜 ASCII 串，命中处前后各输出一段上下文——用来定位某个 API 名、属性名或事件名到底出现在哪里。

```powershell
node scan-asar.cjs <needle> [before] [after] [maxHits] [outFile]
```

## scan-utf8.cjs

同上，但 needle 从 UTF-8 文件读。中文 needle 走命令行参数会变成乱码、命中数为 0，所以中文一律用这个变体。

```powershell
node scan-utf8.cjs <asar> <needleFile> [before] [after] [maxHits] [outFile]
```

## dumps/

历史上的扫描输出（`asar-*.txt`）。已被 `.gitignore` 忽略，只是留档，删掉不影响任何东西。
