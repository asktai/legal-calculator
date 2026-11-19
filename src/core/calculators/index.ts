/**
 * 法律计算器大全 —— 注册表
 * 所有计算器在此汇总。新增计算器只需在对应模块中追加定义，无需改动 UI 代码。
 */
import type { CalculatorDef, Category, CalcValues } from '../types';
import { litigationCalculators } from './litigation';
import { otherFeeCalculators } from './otherfee';
import { interestCalculators } from './interest';
import { laborCalculators } from './labor';
import { limitationCalculators } from './limitation';
import { taxCalculators } from './tax';
import { travelCalculators } from './travel';
import { legalCostCalculators } from './legalcost';

export const CATEGORIES: Category[] = [
  { id: 'litigation', name: '诉讼费用', desc: '案件受理费、保全费与保全担保费、执行费、律师费、公告公证鉴定评估费与总成本测算', accent: '#8b5cf6' },
  { id: 'interest', name: '利息与违约金', desc: 'LPR 利息、迟延履行加倍利息、违约金计算与司法调整', accent: '#ef4444' },
  { id: 'labor', name: '劳动争议', desc: '经济补偿、赔偿金、加班费、工伤工亡与竞业限制补偿', accent: '#f59e0b' },
  { id: 'limitation', name: '时效与期限', desc: '诉讼时效、上诉期、申请执行期与法定期间推算', accent: '#06b6d4' },
  { id: 'tax', name: '税务', desc: '印花税、个人所得税、劳务报酬、违约金涉税与用工成本', accent: '#10b981' },
  { id: 'travel', name: '差旅费用', desc: '差旅补贴标准、报销核算与年度预算测算', accent: '#3b82f6' },
  { id: 'legalcost', name: '法务成本', desc: '单案件成本、律师计费比选、争议路径对比与部门 ROI', accent: '#ec4899' },
];

/** 诉讼成本总览放在诉讼费用类最后一位（受理费 → 保全 → 执行 → 律师费 → 其他费用 → 总览） */
const litigationTotal = litigationCalculators.filter((c) => c.id === 'litigation-total');
const litigationBase = litigationCalculators.filter((c) => c.id !== 'litigation-total');

export const ALL_CALCULATORS: CalculatorDef[] = [
  ...litigationBase,
  ...otherFeeCalculators,
  ...litigationTotal,
  ...interestCalculators,
  ...laborCalculators,
  ...limitationCalculators,
  ...taxCalculators,
  ...travelCalculators,
  ...legalCostCalculators,
];

export function getCalculator(id: string): CalculatorDef | undefined {
  return ALL_CALCULATORS.find((c) => c.id === id);
}

export function getByCategory(id: string): CalculatorDef[] {
  return ALL_CALCULATORS.filter((c) => c.category === id);
}

/** 关键词搜索：匹配名称、摘要、关键词 */
export function searchCalculators(query: string): CalculatorDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_CALCULATORS.filter((c) => {
    const haystack = [c.name, c.summary, ...(c.keywords ?? [])].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

/** 根据字段定义推导默认值集合 */
export function defaultValues(def: CalculatorDef): CalcValues {
  const v: CalcValues = {};
  for (const f of def.fields) {
    v[f.key] = f.defaultValue ?? (f.type === 'select' ? (f.options?.[0]?.value ?? '') : f.type === 'switch' ? false : '');
  }
  return v;
}
