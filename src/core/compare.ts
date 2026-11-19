/**
 * 多方案比对 —— 同一计算器、多套参数并行测算
 *
 * 场景：同一案件往往有几种主张口径（全额主张 / 让步和解 / 只主张部分期间或部分项目），
 * 需要并排看「差额多少、哪个更划算」，而不是逐次改参数、抄数字。
 *
 * 实现要点：
 * 1. 共用参数（FieldDef.shared === true 或带 visibleWhen）只填一次，各方案共用；
 *    分歧参数每个方案各填各的——两份主张的差别只应体现在分歧项上。
 * 2. 本模块是纯函数，无 DOM / 无框架依赖，网页端与各导出格式共用同一份计算与格式化。
 * 3. 数值型主结果才参与「差额 / 排序 / 标记最优」，非数值（如「A 固定费用」）只并列展示，
 *    不硬比大小——比不了就不比，不给假结论。
 */
import type { CalculatorDef, CalcOption, CalcValues } from './types';
import { money } from './format';

/** 参与比对的单个方案及其测算结果 */
export interface OptionResult {
  index: number;
  name: string;
  note?: string;
  values: CalcValues;
  /** 主结果展示值（已格式化） */
  mainValue: string;
  mainUnit?: string;
  mainLabel: string;
  mainSub?: string;
  /** 主结果的可比数值；非数值型为 null（不参与差额与最优判断） */
  amount: number | null;
  steps: { label: string; value: string }[];
  error?: string;
}

/** 一组方案的比对结论 */
export interface ComparisonResult {
  calcId: string;
  defName: string;
  options: OptionResult[];
  /** 数值型方案里的最小 / 最大金额，用于标「最低 / 最高 / 差额」 */
  min: number | null;
  max: number | null;
  /** 全部方案数值一致（或只有一个方案）时为 true，此时不标最优 */
  uniform: boolean;
  /** 有数值型方案可比 → 对比表展示差额列 */
  comparable: boolean;
}

/**
 * 把共用参数、方案参数、字段默认值合成一份完整取值。
 * 共用参数没填时要退回默认值——否则计算器收到 undefined，会静默算出 0。
 */
export function mergeValues(def: CalculatorDef, shared: CalcValues, own: CalcValues): CalcValues {
  const out: CalcValues = {};
  for (const f of def.fields) {
    const v = own[f.key] !== undefined ? own[f.key] : shared[f.key] !== undefined ? shared[f.key] : f.defaultValue;
    out[f.key] = v ?? (f.type === 'switch' ? false : '');
  }
  for (const k of Object.keys({ ...shared, ...own })) {
    if (!(k in out)) out[k] = own[k] !== undefined ? own[k] : shared[k];
  }
  return out;
}

/** 该字段在各方案之间是否共用（只填一次） */
export function isSharedField(def: CalculatorDef, key: string): boolean {
  const f = def.fields.find((x) => x.key === key);
  if (!f) return false;
  // 带条件显隐的字段多为开关联动，各方案口径可能不同，一律下放到方案内
  return (f.shared === true || !!f.visibleWhen) && !f.emphasis;
}

/** 主结果能否当金额比较：纯数字（允许千分位 / 正负号 / 小数）才算 */
export function parseAmount(value: string): number | null {
  const s = value.replace(/[,，\s元]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** 计算单个方案 */
export function calcOption(def: CalculatorDef, index: number, opt: CalcOption): OptionResult {
  const base = { index, name: opt.name, note: opt.note, values: opt.values };
  try {
    const out = def.calc(opt.values);
    return {
      ...base,
      mainLabel: out.main.label,
      mainValue: out.main.value,
      mainUnit: out.main.unit,
      mainSub: out.main.sub,
      amount: parseAmount(out.main.value),
      steps: out.steps.map((s) => ({ label: s.label, value: s.value })),
    };
  } catch (e) {
    return {
      ...base,
      mainLabel: '计算出错',
      mainValue: '—',
      amount: null,
      steps: [],
      error: String(e),
    };
  }
}

/** 比对一组方案 */
export function compareOptions(def: CalculatorDef, options: CalcOption[]): ComparisonResult {
  const results = options.map((o, i) => calcOption(def, i, o));
  const nums = results.map((r) => r.amount).filter((n): n is number => n !== null);
  const min = nums.length ? Math.min(...nums) : null;
  const max = nums.length ? Math.max(...nums) : null;
  return {
    calcId: def.id,
    defName: def.name,
    options: results,
    min,
    max,
    uniform: min !== null && min === max,
    comparable: nums.length >= 2,
  };
}

/** 方案之间的差异项（只列各方案取值不全相同的分歧参数，供报告里点明「差别在哪」） */
export function differingKeys(def: CalculatorDef, options: CalcOption[]): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  for (const f of def.fields) {
    const vals = options.map((o) => String(o.values[f.key] ?? ''));
    if (new Set(vals).size > 1) out.push({ key: f.key, label: f.label });
  }
  return out;
}

/** 差额用于展示：带正负号与千分位 */
export function diffText(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${money(Math.abs(value))}`;
}
