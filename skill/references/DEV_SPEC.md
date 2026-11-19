# 工程规格与开发纪律（DEV SPEC）

> 本文件是**写给开发与维护者执行的规范**，平时不进上下文，升级/发版时按需加载。
> 与《文档合规审查技能》同一套工程规格，对齐 WorkBuddy 官方 Skills 开发规范（workbuddy.cn/docs/ide/Features/Skills）。

---

## 一、WorkBuddy 官方规范对照（自查基准）

| 官方要求 | 本技能现状 | 状态 |
| --- | --- | --- |
| `SKILL.md` 必需，frontmatter 必含 `name` + `description` | `name: legal-calculator`；`description` 详列 45 个计算器触发场景 | ✅ |
| `description` 具体说明功能与使用场景 | 覆盖全部计算器名 + 报告导出场景，含触发词 | ✅ |
| `scripts/` 放可执行代码 | cli / version / audit / check / smoke / core-loader / make-assets 共 7 个（`.ts` 6 ＋ `.py` 1；计数口径同 `version.ts`，不含 `.mjs` 打包脚本） | ✅ |
| `assets/` 放输出用资源 | icon.png / icon-128.png / icon.svg / banner.png | ✅ |
| `references/` 放按需加载的长文档 | DEV_SPEC.md（本文件）；VERSION.md 沿革外置 | ✅ |
| 渐进式披露：SKILL.md 正文 < 5k 词 | 约 1,500 词，正文只保留操作手册 | ✅ |
| 指令性语言，避免论文式行文 | 命令块 + 表格 + 分步说明 | ✅ |
| 信息不重复：SKILL.md 与引用文件不两处维护 | 卡片详情在 CARD.md、沿革在 VERSION.md、许可在 LICENSE.md，SKILL.md 只留摘要与链接 | ✅ |
| 长文档不塞进 SKILL.md | 本文件与逐条计算规则按需加载 | ✅ |

**结论：完全合规。** 新增内容时按本表逐项复检。

## 二、版本锚点同步纪律（改版本必查清单）

版本号的**单一事实源**是 `src/core/version.ts` 的 `VERSION`。其余全部是**必须人工同步的字面量锚点**——共 15 处，缺一处即失同步：

| # | 位置 | 锚点 |
| --- | --- | --- |
| 1 | `src/core/version.ts` | `VERSION`（单一事实源，改这里起头） |
| 2 | `package.json` | `version` |
| 3 | `skill/SKILL.md` | frontmatter `version:` |
| 4 | `skill/SKILL.md` | 卡片表「版本 / 作者」行 |
| 5–6 | `skill/SKILL.md` | 版本信息节（首行 + 表内「当前版本」） |
| 7 | `skill/SKILL.md` | 版本沿革表新增行 |
| 8 | `skill/SKILL.md` | 授权节署名行 |
| 9 | `skill/SKILL.md` | 页脚版本行 |
| 10 | `skill/VERSION.md` | 头部「当前 Vx.y.z」 |
| 11 | `skill/VERSION.md` | 沿革表新增行 |
| 12 | `skill/CARD.md` | 卡片表「版本」行 |
| 13 | `skill/CARD.md` | YAML 注册块 `version:` |
| 14 | `skill/LICENSE.md` | 头部「Vx.y.z ｜ 作者」 |
| 15 | `README.md` | 当前版本行 + 沿革表新增行 |

**派生引用（自动同步，禁止写字面量）**：`src/components/Sidebar.tsx`、`skill/scripts/cli.ts --version` 均从 `version.ts` import；release zip 文件名随打包生成。

**发版核验（机器判定，退出码 0 才放行）**：

```bash
npx tsx skill/scripts/check.ts --anchors
```

`check.ts` 直接读取本清单对应的规则：任何锚点行出现非当前版本号即 FAIL；`VERSION.md` 沿革表历史行、`Vxxx 起`式事实陈述、SemVer／运行时／依赖等非本产品版本号自动豁免——**不再需要人眼甄别**。同时校验 frontmatter `version`、`package.json` 与 `src/core/version.ts` 三者同源，以及文中"计算器 N 个 / 脚本 N 个"与实际文件数一致、SKILL.md 示例引用的计算器 id 真实存在。

同步纪律：**先改 version.ts，再按上表 2→15 顺序同步，最后跑 `check.ts --anchors`。** 任何一处漏改即视为未完成发版。

## 三、开发侧与分发包分离纪律

- **开发侧**：`/workspace/legal-calculator/`（`src/` + `skill/` + 根配置）。所有修改只在这里做。
- **分发包**：`release/` 下按**四段式命名规范**生成的包。**禁止直接改包内文件**；包永远由打包命令从开发侧整体重建。

**四段式包名规范**（对齐 `DEV-RULES 20.1`）：`中文产品名_版本号_日期_(技能ID).封装格式`，
段间用**下划线** `_` 分隔、版本号前缀**小写 `v`**、技能 ID 用**半角括号**包裹，
日期取打包当天（YYYYMMDD），封装格式默认 **SKILL**：

| 封装格式 | 文件名（示例） | 内容 | 顶层目录 |
| --- | --- | --- | --- |
| **SKILL**（默认） | `法律计算器大全_v1.5.0_20261020_(legal-calculator).skill` | `skill/` 全部（SKILL/CARD/VERSION/LICENSE/references/scripts/assets） | 技能 ID：`legal-calculator/` |
| HTML（单文件应用） | `法律计算器大全_v1.5.0_20261020_(legal-calculator).html` | 自包含单文件网页版（JS/CSS/xlsx 全内联，双击即用、file:// 可开、无需部署） | — |
| ZIP（完整工程） | `法律计算器大全_v1.5.0_20261020_(legal-calculator).zip` | dist + src + skill + examples + 根配置 | 与包名相同的工程目录 |

**打包命令**（改版本号后执行）：

```bash
cd /workspace/legal-calculator
PRODUCT="法律计算器大全"; VER="1.5.0"; SKILL_ID="legal-calculator"
DATE=$(date +%Y%m%d)
NAME="${PRODUCT}_v${VER}_${DATE}_(${SKILL_ID})"   # 20.1：下划线 ＋ 小写 v ＋ 括号 slug
rm -rf /tmp/stage && mkdir -p /tmp/stage/skill/legal-calculator "/tmp/stage/full/${NAME}"
# 1) HTML 单文件版（自包含网页应用）
npx vite build                          # 常规多文件构建 → dist/
SINGLE=1 npx vite build                 # 单文件构建 → dist-single/index.html
cp dist-single/index.html "release/${NAME}.html"
# 2) SKILL 技能包
cp -r skill/. /tmp/stage/skill/legal-calculator/
(cd /tmp/stage/skill && zip -qr "/workspace/legal-calculator/release/${NAME}.skill" legal-calculator)
# 3) 完整工程包（ZIP 格式，按需）
for item in dist examples skill src index.html package.json pnpm-lock.yaml README.md tsconfig.json vite.config.ts; do cp -r "$item" "/tmp/stage/full/${NAME}/"; done
(cd /tmp/stage/full && zip -qr "/workspace/legal-calculator/release/${NAME}.zip" "${NAME}")
cd release && sha256sum *.skill *.zip *.html > SHA256SUMS.txt
```

- **`NAME` 只在这一处拼**——`check.ts` 的 `packageName()` 是同一口径的代码侧真源，
  两者须一致；**不得在别处另拼包名字符串**（`DEV-RULES 20.4.2`）。
- HTML 单文件版验收：`grep -c '<script[^>]*src=' 产物` 必须为 0（无外链脚本）；Chromium `--headless --dump-dom` 渲染须出现 7 大类文本（挂载成功）。
- .skill 本质是 zip 容器（平台按扩展名识别为技能封装格式）；`skill/` 内容**不含** examples，`examples/` 永不随包分发、升级时也永不覆盖。
- ZIP 完整工程包**排除** node_modules / release / .git。
- 包重建后必须：`unzip -t` 完整性 + `version.ts --check <包>` 识别 + `sha256sum -c SHA256SUMS.txt` + `check.ts --package`（逐字节比对包与源码）。

### 包内脚本自足（`lib/` 派生物，出包前必跑）

`scripts/*.ts` 在开发侧引用 `../../src/core/`；**技能包只发 `skill/`，不含 `src/`**，
因此包内必须有自足的核心副本，否则装到任何技能目录后 CLI／冒烟／审计全部报
`Cannot find module '../../src/core/calculators'`。

```bash
node skill/scripts/build-skill-bundles.mjs    # 必须在上面的 zip 之前执行
```

产出（随 `skill/` 一起打包）：

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `skill/lib/calculators.mjs` | 计算器注册表 ＋ 默认值 ＋ 检索 | `src/core/calculators/index.ts` 打包 |
| `skill/lib/report.mjs` | 报告模型与七格式导出 | `src/core/report.ts` 打包 |
| `skill/lib/version.mjs` | 版本常量 | **依 `SKILL.md` frontmatter 生成**，不读 `src/` |

- **`lib/` 是派生物，不是新真源**：改口径只改 `src/core`，然后重跑本脚本；手改 `lib/` 下次出包即被覆盖。
- 加载顺序（`scripts/core-loader.ts`）：**先包内 `lib/`，再开发侧 `src/`**；只吞"模块不存在"，
  模块内部抛出的真实错误一律照抛，不把算错伪装成"回落成功"。
- 装包后 `check.ts` 自动切到**包内自检**（结构完整 / SKILL.md ＝ CARD.md ＝ `lib/version.mjs` 三处版本一致 /
  45 个计算器可载入并试算一个已知值）；版本锚点与"包与源码逐字节比对"只在开发侧有意义。
- 验收（每次出包）：把 `.skill` 解到**临时目录**（不是软链、不在开发仓库内）后跑
  `tsx scripts/check.ts`、`smoke.ts`、`audit.ts`、`cli.ts --list`，四项全绿才算包可用。
- **`xlsx` 是唯一无法内联的依赖**（`.xlsx` 生成需它的完整模块树）：包内 Excel 导出要求
  技能目录执行 `npm i xlsx`；缺依赖时 CLI 给出明确指引，其余格式照常导出。
  这是"装完就能算"与"装完就能导 Excel"的差别，验收时要分别确认。

## 三·五、技能命名纪律（中文化）

**三个名字、各司其职、各有一个真源**（`src/core/version.ts`；铁律 21.1 / 12.3.4）：

| 字段 | 值 | 用途 | 真源 |
| --- | --- | --- | --- |
| frontmatter `name` | **法律计算器大全**（中文） | **WorkBuddy 面板显示**、对外称谓 | `PRODUCT_NAME` |
| frontmatter `slug` | `legal-calculator` | **技术标识**：包内顶层目录、四段式包名第三段、平台索引 | `SLUG` |
| frontmatter `display_name` | 法律计算器大全 · 一站式诉讼测算 | 卡片全称（名称＋定位语） | `DISPLAY_NAME` |

### name 与 slug 的分工

- **`name` 支持中文**（官方规范允许，WorkBuddy 面板直接读它显示）——**推荐**用中文产品名，
  面板与对话里都读得懂；ASCII 名称仍可用，但**不作推荐**（面板会显示英文）。
- **`slug` 必须是 kebab-case**（官方规范硬要求）：`^[a-z0-9]+(-[a-z0-9]+)*$`——
  小写字母数字、连字符分隔；**不得**出现下划线（`legal_calc`）、大写、首尾或连续连字符。
- **`slug` 必填，`name` 与 `slug` 不得互换混用**：`name` 写成 slug → 面板显示英文；
  `slug` 写成中文 → 目录与包名第三段出现非 ASCII，跨平台解压会出问题。
- **slug 一旦发布不得更改**：它同时是包内顶层目录名与四段式包名第三段，改名等于换一个技能
  （老用户的更新源对不上）。中文 `name` 可随产品定位调整，slug 不动。

### 现有技能迁移到中文名称

三处同改，缺一处即被守卫拦下：

1. `src/core/version.ts`：`PRODUCT_NAME` 改中文（`SLUG` 保持原值不动）；
2. `skill/SKILL.md` 的 frontmatter：`name:` 改中文、**新增** `slug:`（填原 ASCII 名）；
3. `skill/CARD.md` 的注册块与卡片表同步（名称 / 技术 ID 分两行写清）。

目录名与包名第三段**不随 name 改**——它们跟 slug 走。

### 表述与守卫

- **凡面向使用者的文案**（卡片、报告落款、页脚、文档叙述）一律用中文产品名；
  裸 slug 只许出现在三个技术标识位（frontmatter `slug` / 包内顶层目录 / 包名第三段），
  中英混排以中文名为主称谓，slug 至多以「技术 ID」标注形式出现在括号里。
- **改名只改 `version.ts` 一处**，其余全部引用；守卫会指出所有未同步点。
- **守卫**（`check.ts`，机器判定，开发侧与安装形态双侧比对）：
  开发侧 `name` ≡ `PRODUCT_NAME`、`slug` ≡ `SLUG` 且为 kebab-case、`display_name` ≡ `DISPLAY_NAME`；
  安装形态同法比对 `lib/version.mjs`。出包链（`build-skill-bundles.mjs`）读到非 kebab slug
  或 name 与 slug 雷同**直接中止**。
- **守卫自验**：注入测试改坏任一字段 → FAIL 并指出真源（见 DEVLOG 2026-10-30 补记 2、3）。

## 四、自检闭环（改动后与升级后必跑）

```bash
npx tsc --noEmit                            # 1. 类型零错误
npx tsx skill/scripts/smoke.ts              # 2. 45 个计算器全量冒烟，失败 0
npx tsx skill/scripts/audit.ts              # 3. 70 个法定口径用例回归（45 个计算器全覆盖），失败 0（退出码 0）
npx tsx skill/scripts/check.ts              # 4. 一致性：版本锚点 + 包与源码逐字节比对 + 数据时效
npx vite build                              # 5. 网页端可构建
npx tsx skill/scripts/version.ts            # 6. 版本身份证与规模自检
npx tsx maint/tools/check-dev-rules.ts      # 7. 铁律自检：(1)(2)(3)(3b)(4)(5)(9)(11)(13)(14) 逐项断言（仅开发侧）
```

- **前后两份脚本的归属不同**：1–6 在 `skill/scripts/`（**随包分发**，安装形态也跑得起来）；
  第 7 份在 `maint/tools/`（**只在开发侧**，永不进包）——它校验的是铁律文档自身与全库文档纪律，
  包内没有 `dev/`，故安装形态**不跑也不该跑**（`check.ts` 安装分支已自动跳过对应维度）。
- **第 7 步的守护范围须分半看**（铁律 24.1：不得笼统称"已闭合"）：现已落地 **(1)(2)(3)(3b)(4)(5)(9)(11)(13)(14)**——
  条号连续、章区间、目录锚点、跨文件条号引用、各级连号、禁用字符、本文件内引用真实性、行首加粗带编号、
  24.3 表登记、底线断言；**(6)(7)(8)(10)(12) 仍为缺口**（扩展名小写、铁律版本串、跨侧哈希、绝对编号引用、
  元规则归属），跑绿**不代表**这几维已比过。
- **第 7 步何时必跑**：改了任何 `.md`（尤其 `dev/`、`maint/`、`skill/*.md`）或新增条款时——
  它管的是"文档结构、编号连号、禁用字符、引用真实性、落点登记"这些**机器判得了的表述纪律**，
  `check.ts` 一概不管。改完代码不跑它没有损失，改完文档不跑则等于没验（铁律 24.2）。
- **升级闭环**：`version.ts --upgrade --apply` 完成后，对升级产物重跑 1–6（第 7 步在目标侧不适用）；
  `audit.ts` 或 `check.ts` 不过则该版本禁止分发。
- **新增计算器**：除上述 7 步外，必须在 `audit.ts` 增加至少 1 个"法条手算期望值"用例，再更新 SKILL.md 计算器清单与规模数（规模数已由 `check.ts` 自动比对，改错会 FAIL）。
- **改了数据没改版本**：`check.ts --statutory` 会按 FRESHNESS 清单在复核期到达时 WARN（工亡基数、LPR、社保基数、节假日、四费参考价）。

## 五、升级保护规则（version.ts 内建，不得绕过）

1. `examples/` 永不覆盖（本地示例与数据属使用者资产）。
2. 目标目录独有文件一律保留。
3. 升级前整目录备份：`<目标>_bak-V<版本>-<时间戳>`。
4. 不带 `--apply` 永远只是预演；自动替使用者升级是被明确排除的行为。
5. 更新源登记信息存在 `~/.legal-calculator-updates/`（技能目录之外），不污染分发包。

## 六、历史失同步案例（引以为戒）

| 版本 | 案例 | 教训 |
| --- | --- | --- |
| V1.2.0 | SKILL.md 署名行残留 V1.1.0 | 署名行在锚点清单 #8，发版核验命令可查出 |
| V1.2.0 | LICENSE.md 头部残留 V1.1.0 | LICENSE.md 也是锚点（#14），改版本时别只顾 SKILL.md |
| V1.2.0 | SKILL.md"脚本 4 个"未随新增 audit.ts 更新 | 规模数字（计算器数/脚本数）属于软锚点，新增文件时同步 |
