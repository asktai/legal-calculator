/** 超额累进（分段累计）计费引擎 —— 诉讼费、保全费、执行费通用 */

export interface Tier {
  /** 该档上限（含），Infinity 表示封顶档 */
  upTo: number;
  /** 该档费率，0 表示定额 */
  rate: number;
  /** 该档定额（rate 为 0 时使用） */
  flat?: number;
  /** 该档描述 */
  desc?: string;
}

export interface TierLine {
  desc: string;
  /** 该档计税基数 */
  base: number;
  rateText: string;
  amount: number;
}

export interface ProgressiveResult {
  total: number;
  lines: TierLine[];
}

/**
 * 超额累进计算。tiers 必须按 upTo 升序排列，最后一档 upTo 为 Infinity。
 */
export function progressive(amount: number, tiers: Tier[]): ProgressiveResult {
  const lines: TierLine[] = [];
  let total = 0;
  let lower = 0;

  for (const t of tiers) {
    if (amount <= lower) break;
    const base = Math.min(amount, t.upTo) - lower;
    if (base <= 0) {
      lower = t.upTo;
      continue;
    }
    const seg = t.rate > 0 ? base * t.rate : (t.flat ?? 0);
    total += seg;
    lines.push({
      desc: t.desc ?? `超过 ${lower} 元部分`,
      base,
      rateText: t.rate > 0 ? `× ${(t.rate * 100).toFixed(t.rate * 100 % 1 === 0 ? 0 : 2)}%` : '定额',
      amount: seg,
    });
    lower = t.upTo;
  }

  return { total, lines };
}

/** 把累进明细转为展示行 */
export function describeTierLines(lines: TierLine[], fmt: (n: number) => string): string[] {
  return lines.map(
    (l) => `${l.desc}：${fmt(l.base)} ${l.rateText} = ${fmt(l.amount)} 元`,
  );
}

/** —— 各类收费档位表（依据《诉讼费用交纳办法》2007 施行）—— */

/** 财产案件受理费 */
export const CIVIL_FEE_TIERS: Tier[] = [
  { upTo: 10000, rate: 0, flat: 50, desc: '1 万元以下' },
  { upTo: 100000, rate: 0.025, desc: '1 万—10 万元部分' },
  { upTo: 200000, rate: 0.02, desc: '10 万—20 万元部分' },
  { upTo: 500000, rate: 0.015, desc: '20 万—50 万元部分' },
  { upTo: 1000000, rate: 0.01, desc: '50 万—100 万元部分' },
  { upTo: 2000000, rate: 0.009, desc: '100 万—200 万元部分' },
  { upTo: 5000000, rate: 0.008, desc: '200 万—500 万元部分' },
  { upTo: 10000000, rate: 0.007, desc: '500 万—1000 万元部分' },
  { upTo: 20000000, rate: 0.006, desc: '1000 万—2000 万元部分' },
  { upTo: Infinity, rate: 0.005, desc: '2000 万元以上部分' },
];

/** 申请保全费（最高不超过 5000 元） */
export const PRESERVATION_TIERS: Tier[] = [
  { upTo: 1000, rate: 0, flat: 30, desc: '1000 元以下或不涉及财产数额' },
  { upTo: 100000, rate: 0.01, desc: '1000 元—10 万元部分' },
  { upTo: Infinity, rate: 0.005, desc: '10 万元以上部分' },
];
export const PRESERVATION_CAP = 5000;

/** 执行申请费 */
export const EXECUTION_TIERS: Tier[] = [
  { upTo: 10000, rate: 0, flat: 50, desc: '1 万元以下' },
  { upTo: 500000, rate: 0.015, desc: '1 万—50 万元部分' },
  { upTo: 5000000, rate: 0.01, desc: '50 万—500 万元部分' },
  { upTo: 10000000, rate: 0.005, desc: '500 万—1000 万元部分' },
  { upTo: Infinity, rate: 0.001, desc: '1000 万元以上部分' },
];

/** 破产案件申请费：按财产案件标准减半，最高 30 万元 */
export const BANKRUPTCY_CAP = 300000;

/** —— 评估 / 公证类参考档位表（行业通行标准，现多为市场调节价，以机构报价为准）—— */

/** 资产评估收费（原《资产评估收费管理暂行办法》差额定率累进，行业参考） */
export const ASSET_APPRAISAL_TIERS: Tier[] = [
  { upTo: 1000000, rate: 0.006, desc: '100 万元以下部分' },
  { upTo: 10000000, rate: 0.0025, desc: '100 万—1000 万元部分' },
  { upTo: 50000000, rate: 0.0008, desc: '1000 万—5000 万元部分' },
  { upTo: 100000000, rate: 0.0005, desc: '5000 万—1 亿元部分' },
  { upTo: Infinity, rate: 0.0001, desc: '1 亿元以上部分' },
];

/** 房地产估价收费（计价格〔1995〕971 号，行业参考） */
export const REAL_ESTATE_TIERS: Tier[] = [
  { upTo: 1000000, rate: 0.005, desc: '100 万元以下部分' },
  { upTo: 10000000, rate: 0.0025, desc: '100 万—1000 万元部分' },
  { upTo: 20000000, rate: 0.0015, desc: '1000 万—2000 万元部分' },
  { upTo: 50000000, rate: 0.0008, desc: '2000 万—5000 万元部分' },
  { upTo: 100000000, rate: 0.0005, desc: '5000 万—1 亿元部分' },
  { upTo: Infinity, rate: 0.0001, desc: '1 亿元以上部分' },
];

/** 土地价格评估收费（计价格〔1994〕2017 号，行业参考） */
export const LAND_APPRAISAL_TIERS: Tier[] = [
  { upTo: 1000000, rate: 0.004, desc: '100 万元以下部分' },
  { upTo: 2000000, rate: 0.003, desc: '100 万—200 万元部分' },
  { upTo: 10000000, rate: 0.002, desc: '200 万—1000 万元部分' },
  { upTo: 20000000, rate: 0.0015, desc: '1000 万—2000 万元部分' },
  { upTo: 50000000, rate: 0.0008, desc: '2000 万—5000 万元部分' },
  { upTo: 100000000, rate: 0.0004, desc: '5000 万—1 亿元部分' },
  { upTo: Infinity, rate: 0.0002, desc: '1 亿元以上部分' },
];

/** 公证：证明财产继承、赠与、接受遗赠（按受益额累进，行业参考） */
export const NOTARY_INHERITANCE_TIERS: Tier[] = [
  { upTo: 200000, rate: 0.012, desc: '20 万元以下部分' },
  { upTo: 500000, rate: 0.01, desc: '20 万—50 万元部分' },
  { upTo: 5000000, rate: 0.008, desc: '50 万—500 万元部分' },
  { upTo: 10000000, rate: 0.005, desc: '500 万—1000 万元部分' },
  { upTo: Infinity, rate: 0.001, desc: '1000 万元以上部分' },
];

/** 公证：证明合同（协议）/ 经济合同（按标的额累进，行业参考） */
export const NOTARY_CONTRACT_TIERS: Tier[] = [
  { upTo: 500000, rate: 0.003, desc: '50 万元以下部分' },
  { upTo: 5000000, rate: 0.0025, desc: '50 万—500 万元部分' },
  { upTo: 10000000, rate: 0.002, desc: '500 万—1000 万元部分' },
  { upTo: 100000000, rate: 0.0005, desc: '1000 万—1 亿元部分' },
  { upTo: Infinity, rate: 0.0001, desc: '1 亿元以上部分' },
];
