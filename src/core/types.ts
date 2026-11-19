/**
 * 法律计算器 —— 核心类型契约
 *
 * 该文件不依赖任何 UI 框架，可被网页端、命令行（CLI）、后端服务或 AI 技能包直接复用。
 * 新增一个计算器只需：写一个满足 CalculatorDef 的对象，并注册进 registry。
 */

/** 计算器所属大类 */
export type CategoryId =
  | 'litigation' // 诉讼费用
  | 'interest' // 利息与违约金
  | 'labor' // 劳动争议
  | 'limitation' // 时效与期限
  | 'tax' // 税务
  | 'travel' // 差旅费用
  | 'legalcost'; // 法务成本

export interface Category {
  id: CategoryId;
  name: string;
  desc: string;
  accent: string;
}

/** 表单字段类型 */
export type FieldType = 'money' | 'number' | 'percent' | 'select' | 'date' | 'switch';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FieldDef {
  /** 取值键名，计算结果输入对象中的 key */
  key: string;
  label: string;
  type: FieldType;
  /** 单位后缀，如 元 / 天 / % */
  unit?: string;
  placeholder?: string;
  /** 输入框下方的浅色说明 */
  hint?: string;
  defaultValue?: string | number | boolean;
  /** type 为 select 时必填 */
  options?: FieldOption[];
  /** 数值步长 */
  step?: number;
  min?: number;
  max?: number;
  /** 条件显隐：返回 false 时该字段不渲染、不参与计算 */
  visibleWhen?: (values: CalcValues) => boolean;
  /**
   * 方案比对中「固定不变」的字段（项目身份参数，如工资基数、标的额）：
   * 比对页只在这一栏填一次，各方案共用；不标则每个方案各填各的。
   */
  shared?: boolean;
  /** 分组标题，同组字段渲染为一个 section */
  group?: string;
  /**
   * 强调该字段：渲染为红色加粗的显著样式。
   * 只用于「主入口量」——争议标的额这类被本计算器多个分支反复取用的字段，
   * 不是给普通字段随便加重的样式开关。
   */
  emphasis?: boolean;
}

/**
 * 跨计算器复用的「主金额」键：争议标的额、本金、财产／知识产权争议金额、鉴定与评估标的。
 * 值在浏览器本地暂存，换计算器仍带着；不纳入保全财产数额、申请执行金额、月工资——
 * 口径各不相同，混用只会把数填错。
 */
export const REUSABLE_AMOUNT_KEYS: readonly string[] = [
  'amount',
  'principal',
  'propertyAmount',
  'ipAmount',
  'value',
];

/**
 * 主金额的五个快捷档位（元）。
 *
 * 用途不是「精确填写」，而是**先把量级摸清**：换了标的额，受理费、保全费、
 * 律师费的档位差异往往比小数点更重要。所以五档刻意跨越几个费率断点——
 * 1 万（小额诉讼区间）、10 万（保全费 0.5% 起征点即 10 万以上部分）、
 * 50 万与 100 万（受理费累进换档区间）、1000 万（保全费封顶早已触发）。
 *
 * 只给**金额型**字段提供快捷档位；百分比、天数、工资等量级完全不同的字段不适用。
 */
export const QUICK_AMOUNT_PRESETS: readonly { value: number; label: string }[] = [
  { value: 10_000, label: '1 万' },
  { value: 100_000, label: '10 万' },
  { value: 500_000, label: '50 万' },
  { value: 1_000_000, label: '100 万' },
  { value: 10_000_000, label: '1000 万' },
];

/** 同一案件的多套主张 / 测算方案（供报告与比对导出使用） */
export interface CalcOption {
  /** 方案名，如「方案 A 全额主张」 */
  name: string;
  /** 一句话口径说明，写进对比表 */
  note?: string;
  /** 该方案的参数 */
  values: CalcValues;
}

/** 用户输入的原始值集合：key -> 值 */
export type CalcValues = Record<string, string | number | boolean | undefined>;

/** 分步计算明细中的一行 */
export interface StepRow {
  label: string;
  /** 已格式化好的展示值 */
  value: string;
  note?: string;
  /** 是否为关键中间量（加粗高亮） */
  emphasis?: boolean;
}

/** 主结果区块 */
export interface ResultBlock {
  label: string;
  /** 已格式化的展示值 */
  value: string;
  unit?: string;
  /** 次级说明 */
  sub?: string;
}

/** 法条依据引用 */
export interface LegalBasis {
  law: string;
  article?: string;
  text: string;
}

/** 计算器统一输出结构 */
export interface CalcOutput {
  /** 主结果（大号数字展示） */
  main: ResultBlock;
  /** 附加结果区块，如各项赔偿分项 */
  blocks?: ResultBlock[];
  /** 分步计算明细 */
  steps: StepRow[];
  /** 法条依据 */
  basis: LegalBasis[];
  /** 实务提示 */
  tips?: string[];
  /** 免责声明覆盖文案（不填则用全局默认） */
  disclaimer?: string;
}

/** 计算器定义 */
export interface CalculatorDef {
  id: string;
  name: string;
  category: CategoryId;
  /** 一句话说明，用于卡片列表 */
  summary: string;
  /** 单字图标，用于卡片 */
  glyph: string;
  fields: FieldDef[];
  /** 纯函数计算：输入值 -> 输出结构 */
  calc: (values: CalcValues) => CalcOutput;
  /** 关键词，供搜索 */
  keywords?: string[];
}
