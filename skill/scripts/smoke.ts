/**
 * 冒烟测试：用默认值遍历全部计算器，确保每个都能产出主结果、计算明细与法律依据。
 * 运行（开发侧）：npx tsx skill/scripts/smoke.ts
 * 运行（装包后）：npx tsx scripts/smoke.ts —— 走随包的 lib/calculators.mjs，不依赖 src/
 */
import type { CalcOutput } from '../../src/core/types';
import { loadFirst, CORE_CANDIDATES } from './core-loader';

const { ALL_CALCULATORS, defaultValues } = loadFirst<typeof import('../../src/core/calculators')>(
  CORE_CANDIDATES('calculators'),
);

let fail = 0;
for (const c of ALL_CALCULATORS) {
  try {
    const out: CalcOutput = c.calc(defaultValues(c));
    const v = out.main.value;
    if (v === undefined || v === null || v === '' || v === 'NaN') throw new Error('主结果为空: ' + v);
    if (!out.steps || out.steps.length === 0) throw new Error('缺少计算明细');
    if (!out.basis || out.basis.length === 0) throw new Error('缺少法律依据');
    const id = c.id + ' '.repeat(Math.max(0, 22 - c.id.length));
    const name = c.name + ' '.repeat(Math.max(0, 18 - c.name.length * 2));
    console.log(`OK   ${id} ${name} => ${v}${out.main.unit ? ' ' + out.main.unit : ''}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ${c.id} :: ${String(e)}`);
  }
}
console.log(`\n合计 ${ALL_CALCULATORS.length} 个计算器，失败 ${fail} 个。`);
process.exit(fail ? 1 : 0);
