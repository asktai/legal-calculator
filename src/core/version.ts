/**
 * 版本信息（单一来源）
 *
 * 网页端、CLI、技能包文档统一读取此处，避免版本号散落多处不一致。
 * 修改版本号时同步更新：
 *   1. package.json 的 version
 *   2. skill/SKILL.md 的 frontmatter version
 *   3. skill/VERSION.md 的 版本沿革 表
 *   4. skill/LICENSE.md 头部的版本行
 */
export const VERSION = '1.5.1';

/** 发布日期（YYYY-MM-DD） */
export const RELEASE_DATE = '2026-10-20';

/** 版本状态：Stable / Beta / RC / Draft */
export const RELEASE_CHANNEL = 'Stable';

/** 兼容的最低技能运行时版本 */
export const MIN_RUNTIME = '1.0.0';

/** 许可类型标识（完整条款见 skill/LICENSE.md） */
export const LICENSE = '专有许可';

/** 一句话许可摘要 */
export const LICENSE_SUMMARY = '专有作品、非开源；个人自用授权，商业使用须事先取得作者书面授权';

/** 作者 / 版权主体 */
export const AUTHOR = '胡皓';

/** 产品全称 */
export const PRODUCT_NAME = '法律计算器大全';

/** 技能 slug（技术标识）：包内顶层目录、四段式包名第三段、平台索引用；中文名见 PRODUCT_NAME */
export const SLUG = 'legal-calculator';

/** 中文显示名（技能卡片用） */
export const DISPLAY_NAME = '法律计算器大全 · 一站式诉讼测算';

/** 卡片一句话简介 */
export const CARD_TAGLINE = '45 个计算器 · 7 大类 · 输入参数即出结果，可导出 MD/Excel/Word/HTML';

/** 单行版本串，供 --version 输出 */
export const VERSION_LINE = `${PRODUCT_NAME} V${VERSION}（${RELEASE_DATE}，${RELEASE_CHANNEL}）· ${LICENSE}`;
