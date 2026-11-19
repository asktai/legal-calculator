/**
 * 核心模块装载器（scripts/core-loader.ts）
 * =========================================
 * `scripts/*.ts` 的两套运行环境：
 *   · **开发侧**：`src/core/` 就在旁边，直接 import 源码——源码是唯一真源。
 *   · **装进技能包**：包里只有 `skill/`，没有 `src/`，源码 import 必失败；
 *     改读随包分发的 `lib/*.mjs`（由 `build-skill-bundles.mjs` 从同一份源码打出）。
 *
 * 为什么用 `createRequire` 而不是 `await import()`：`tsx` 会把 ts 转成 CJS 执行，
 * 顶层 await 在 CJS 输出下直接报错（"Top-level await is currently not supported"）。
 * `require()` 是同步的，而 `lib/*.mjs` 虽是 ESM，Node 22+ 允许对纯 ESM 做同步 require
 * （无 TLA 时），因此两条路径写法一致、调用处不用 await。
 *
 * 失败判定只认"模块不存在"（ERR_MODULE_NOT_FOUND / MODULE_NOT_FOUND）；
 * 模块内部抛出的真实错误**一律照抛**，避免把计算错误伪装成"回落成功"。
 */
import { createRequire } from 'node:module';

const CAN_MISS = /ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|Cannot find module|Cannot find package/;

/** 依次试 candidates，第一个能加载的就用它；全都"不存在"则抛出说明性错误 */
export function loadFirst<T>(candidates: Array<[label: string, spec: string]>): T & { __from: string } {
  const req = createRequire(import.meta.url);
  const misses: string[] = [];
  for (const [label, spec] of candidates) {
    try {
      const mod = req(spec);
      return Object.assign({}, mod, { __from: label }) as T & { __from: string };
    } catch (e) {
      if (!CAN_MISS.test(String(e))) throw e;
      misses.push(`${label}（${spec}）`);
    }
  }
  throw new Error(
    `核心模块装载失败：${misses.join('、')} 都不存在。\n` +
      `开发侧请确认 src/core/ 完整；技能包内请确认 lib/ 已随包分发（重出包时跑 build-skill-bundles.mjs）。`,
  );
}

/** 包内优先，回落开发侧源码 */
export const CORE_CANDIDATES = (name: string): Array<[string, string]> => [
  [`lib/${name}.mjs`, `../lib/${name}.mjs`],
  [`src/core/${name}`, `../../src/core/${name}`],
];
