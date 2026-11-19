/**
 * 七、法务成本类计算器
 * 用于企业法务部门与外部律师管理的成本测算、方案比选与投入产出分析。
 * 依据：《诉讼费用交纳办法》《律师服务收费管理办法》《仲裁法》及各仲裁机构收费办法
 *
 * 说明：各仲裁机构收费标准差异较大且时有调整，内置的仲裁费档位为常见区间近似值，
 *       正式报价请向选定仲裁机构核实。
 */
import type { CalculatorDef, CalcOutput, StepRow, ResultBlock } from '../types';
import { money, round, toNum, toStr, moneyToChinese } from '../format';
import { CIVIL_FEE_TIERS, progressive } from '../progressive';

/** 仲裁费参考档位（超额累进，各机构标准不一，仅作估算） */
const ARBITRATION_TIERS = [
  { upTo: 250000, rate: 0.04, desc: '25 万元以下部分' },
  { upTo: 1000000, rate: 0.03, desc: '25 万—100 万元部分' },
  { upTo: 5000000, rate: 0.02, desc: '100 万—500 万元部分' },
  { upTo: 10000000, rate: 0.012, desc: '500 万—1000 万元部分' },
  { upTo: 50000000, rate: 0.008, desc: '1000 万—5000 万元部分' },
  { upTo: Infinity, rate: 0.005, desc: '5000 万元以上部分' },
];
const ARBITRATION_MIN = 5000;

export const legalCostCalculators: CalculatorDef[] = [
  /* ── 单案件法务成本 ── */
  {
    id: 'case-cost',
    name: '单案件法务成本',
    category: 'legalcost',
    glyph: '案',
    summary: '外部律师费、诉讼费与内部人力时间成本的完整归集',
    keywords: ['案件成本', '法务成本', '诉讼预算', '内部人力'],
    fields: [
      { key: 'amount', label: '争议标的额', type: 'money', unit: '元', emphasis: true, defaultValue: 2000000 },
      { key: 'lawyerFee', label: '外部律师费', type: 'money', unit: '元', defaultValue: 150000 },
      { key: 'courtFee', label: '法院收取费用（受理费 + 保全费等）', type: 'money', unit: '元', defaultValue: 0, hint: '填 0 时按标的额自动测算受理费' },
      { key: 'arbitrationFee', label: '仲裁费（如走仲裁）', type: 'money', unit: '元', defaultValue: 0 },
      { key: 'otherFee', label: '鉴定、公证、翻译等费用', type: 'money', unit: '元', defaultValue: 0 },
      { key: 'travelFee', label: '差旅费', type: 'money', unit: '元', defaultValue: 0 },
      { key: 'internalHours', label: '内部法务投入小时数', type: 'number', unit: '小时', defaultValue: 80 },
      { key: 'hourlyCost', label: '内部法务小时成本', type: 'money', unit: '元/小时', defaultValue: 300, hint: '按年薪折算的小时成本，用于量化内部资源占用' },
      { key: 'duration', label: '案件周期', type: 'number', unit: '月', defaultValue: 12 },
      {
        key: 'recoveryRate',
        label: '预期回款率',
        type: 'percent',
        unit: '%',
        defaultValue: 70,
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const lawyerFee = toNum(values.lawyerFee);
      let courtFee = toNum(values.courtFee);
      const arbFee = toNum(values.arbitrationFee);
      const otherFee = toNum(values.otherFee);
      const travelFee = toNum(values.travelFee);
      const hours = toNum(values.internalHours);
      const hourlyCost = toNum(values.hourlyCost);
      const months = Math.max(1, toNum(values.duration));
      const recoveryRate = toNum(values.recoveryRate) / 100;

      const steps: StepRow[] = [];

      if (courtFee === 0) {
        const r = progressive(amount, CIVIL_FEE_TIERS);
        courtFee = r.total;
        steps.push({ label: '案件受理费（自动测算）', value: `标的额 ${money(amount)} → ${money(courtFee)} 元` });
      } else {
        steps.push({ label: '法院收取费用', value: `${money(courtFee)} 元` });
      }

      steps.push({ label: '外部律师费', value: `${money(lawyerFee)} 元` });
      if (arbFee > 0) steps.push({ label: '仲裁费', value: `${money(arbFee)} 元` });
      if (otherFee > 0) steps.push({ label: '鉴定 / 公证等其他费用', value: `${money(otherFee)} 元` });
      if (travelFee > 0) steps.push({ label: '差旅费', value: `${money(travelFee)} 元` });

      const internalCost = round(hours * hourlyCost, 2);
      steps.push({
        label: '内部法务人力成本',
        value: `${hours} 小时 × ${money(hourlyCost)} = ${money(internalCost)} 元`,
        note: '内部资源占用常被低估，量化后可更真实比较自行处理与外包的性价比',
      });

      const external = round(lawyerFee + courtFee + arbFee + otherFee + travelFee, 2);
      const total = round(external + internalCost, 2);
      steps.push({ label: '外部支出小计', value: `${money(external)} 元` });
      steps.push({ label: '案件总成本', value: `${money(total)} 元`, emphasis: true });

      const recovery = round(amount * recoveryRate, 2);
      const net = round(recovery - total, 2);
      const roi = round((net / Math.max(total, 1)) * 100, 2);
      steps.push({ label: '预期回款', value: `${money(amount)} × ${toNum(values.recoveryRate)}% = ${money(recovery)} 元` });
      steps.push({
        label: '净收益与投入产出比',
        value: `${money(net)} 元 / ${money(total)} 元 = ${roi}%`,
        emphasis: true,
        note: net < 0 ? '⚠ 成本大于预期收益，建议优先调解或商业止损' : '具备诉讼经济性',
      });

      const monthlyBurn = round(total / months, 2);
      steps.push({ label: `月度成本消耗（${months} 个月）`, value: `${money(monthlyBurn)} 元/月` });

      return {
        main: { label: '案件总成本', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '外部支出', value: money(external), unit: '元', sub: `${((external / Math.max(total, 1)) * 100).toFixed(1)}%` },
          { label: '内部人力成本', value: money(internalCost), unit: '元', sub: `${((internalCost / Math.max(total, 1)) * 100).toFixed(1)}%` },
          { label: '成本占标的额比', value: `${((total / Math.max(amount, 1)) * 100).toFixed(2)}%` },
          { label: '净收益', value: money(net), unit: '元', sub: `ROI ${roi}%` },
          { label: '月度成本', value: money(monthlyBurn), unit: '元/月' },
        ],
        steps,
        basis: [
          {
            law: '《诉讼费用交纳办法》',
            article: '第十三条',
            text: '财产案件根据诉讼请求的金额或者价额，按照分段累计标准交纳案件受理费。',
          },
        ],
        tips: [
          '内部法务的人力成本是最容易被忽略的隐性支出，量化后往往占到案件总成本的 15%—30%。',
          '案件周期越长，内部人力与机会成本越高，评估诉讼经济性时务必把周期纳入考量。',
          '胜诉后受理费可申请退还，律师费除非有约定或法定情形否则难以转嫁，测算时应保守处理。',
        ],
      };
    },
  },

  /* ── 律师计费方案比选 ── */
  {
    id: 'counsel-compare',
    name: '律师计费方案比选',
    category: 'legalcost',
    glyph: '选',
    summary: '固定费、计时、风险代理三种方案的场景化对比与盈亏平衡点',
    keywords: ['律师费比选', '风险代理', '计时收费', '计费方案'],
    fields: [
      { key: 'amount', label: '争议标的额', type: 'money', unit: '元', emphasis: true, defaultValue: 3000000 },
      { key: 'fixedFee', label: '方案 A：固定费用', type: 'money', unit: '元', defaultValue: 200000 },
      { key: 'hours', label: '方案 B：预计工作小时', type: 'number', unit: '小时', defaultValue: 120 },
      { key: 'hourlyRate', label: '方案 B：小时费率', type: 'money', unit: '元/小时', defaultValue: 2500 },
      { key: 'contingencyBase', label: '方案 C：风险代理基础费', type: 'money', unit: '元', defaultValue: 30000 },
      { key: 'contingencyRate', label: '方案 C：风险提成比例', type: 'percent', unit: '%', defaultValue: 12 },
      {
        key: 'recoveryRate',
        label: '预计回款率',
        type: 'percent',
        unit: '%',
        defaultValue: 70,
      },
      {
        key: 'scenario',
        label: '对比场景',
        type: 'select',
        defaultValue: 'expected',
        options: [
          { label: '按预计回款率测算', value: 'expected' },
          { label: '悲观情景（回款 30%）', value: 'pessimistic' },
          { label: '乐观情景（回款 100%）', value: 'optimistic' },
          { label: '败诉（回款 0%）', value: 'lose' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const fixedFee = toNum(values.fixedFee);
      const hours = toNum(values.hours);
      const hourlyRate = toNum(values.hourlyRate);
      const base = toNum(values.contingencyBase);
      const cRate = toNum(values.contingencyRate) / 100;
      const scenario = toStr(values.scenario, 'expected');
      const inputRate = toNum(values.recoveryRate) / 100;

      const rate = scenario === 'pessimistic' ? 0.3 : scenario === 'optimistic' ? 1 : scenario === 'lose' ? 0 : inputRate;
      const recovery = round(amount * rate, 2);

      const steps: StepRow[] = [
        { label: '对比场景', value: `回款率 ${(rate * 100).toFixed(0)}%` },
        { label: '预计回款金额', value: `${money(recovery)} 元` },
      ];

      const hourlyFee = round(hours * hourlyRate, 2);
      const contingencyFee = round(base + recovery * cRate, 2);

      steps.push({ label: '方案 A 固定费', value: `${money(fixedFee)} 元`, note: '无论结果如何均需支付' });
      steps.push({ label: '方案 B 计时收费', value: `${hours} 小时 × ${money(hourlyRate)} = ${money(hourlyFee)} 元` });
      steps.push({
        label: '方案 C 风险代理',
        value: `${money(base)} + ${money(recovery)} × ${toNum(values.contingencyRate)}% = ${money(contingencyFee)} 元`,
        note: '回款为零时仅需支付基础费',
      });

      const options = [
        { name: 'A 固定费用', fee: fixedFee },
        { name: 'B 计时收费', fee: hourlyFee },
        { name: 'C 风险代理', fee: contingencyFee },
      ];

      const sorted = [...options].sort((a, b) => a.fee - b.fee);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      steps.push({ label: '最优方案', value: `${best.name}（${money(best.fee)} 元）`, emphasis: true });
      steps.push({ label: '最劣方案', value: `${worst.name}（${money(worst.fee)} 元）` });
      steps.push({ label: '方案价差', value: `${money(round(worst.fee - best.fee, 2))} 元`, emphasis: true });

      // 盈亏平衡点：固定费 = 基础费 + 回款 × 提成比例
      const breakEvenRecovery = cRate > 0 ? round((fixedFee - base) / cRate, 2) : Infinity;
      if (Number.isFinite(breakEvenRecovery)) {
        const breakEvenRate = round((breakEvenRecovery / Math.max(amount, 1)) * 100, 2);
        steps.push({
          label: '固定费 vs 风险代理盈亏平衡点',
          value: `回款达到 ${money(breakEvenRecovery)} 元（回款率 ${breakEvenRate}%）时两者费用相当`,
          note: breakEvenRate < rate * 100 ? '当前情景下风险代理更贵，固定费更划算' : '当前情景下风险代理更划算',
          emphasis: true,
        });
      }

      const blocks: ResultBlock[] = [
        { label: '方案 A 固定费用', value: money(fixedFee), unit: '元' },
        { label: '方案 B 计时收费', value: money(hourlyFee), unit: '元' },
        { label: '方案 C 风险代理', value: money(contingencyFee), unit: '元' },
        { label: '推荐方案', value: best.name, sub: money(best.fee) },
      ];
      if (Number.isFinite(breakEvenRecovery)) {
        blocks.push({
          label: '盈亏平衡回款率',
          value: `${round((breakEvenRecovery / Math.max(amount, 1)) * 100, 2)}%`,
          sub: '低于此值选固定费',
        });
      }

      return {
        main: { label: '最优方案', value: best.name, sub: `${money(best.fee)} 元，较次优方案省 ${money(round(sorted[1].fee - best.fee, 2))} 元` },
        blocks,
        steps,
        basis: [
          {
            law: '《律师服务收费管理办法》',
            article: '第十三条',
            text: '实行风险代理收费，最高收费金额不得高于收费合同约定标的额的30%。',
          },
          {
            law: '《律师服务收费管理办法》',
            article: '第十条',
            text: '律师服务收费可以根据不同的服务内容，采取计件收费、按标的额比例收费和计时收费等方式。',
          },
        ],
        tips: [
          '回款预期低、执行难度大的案件，风险代理对委托人更有利；标的清晰、胜诉概率高的案件，固定费通常更省。',
          '风险代理的提成基数务必明确是"实际回款"还是"标的额"——法定 30% 上限是以标的额为基数，签约时两者差异极大。',
          '计时收费最大的风险是小时数失控，建议约定小时上限与阶段性报告义务。',
          '下列案件禁止风险代理：刑事诉讼、行政诉讼、国家赔偿、群体性诉讼、婚姻继承、劳动报酬等。',
        ],
      };
    },
  },

  /* ── 争议解决方式对比 ── */
  {
    id: 'dispute-decision',
    name: '争议解决方式对比',
    category: 'legalcost',
    glyph: '争',
    summary: '诉讼、仲裁、调解三种路径的成本与周期综合对比',
    keywords: ['诉讼', '仲裁', '调解', '争议解决', '成本对比'],
    fields: [
      { key: 'amount', label: '争议标的额', type: 'money', unit: '元', emphasis: true, defaultValue: 5000000 },
      { key: 'lawyerFee', label: '律师费（各路径大致相同）', type: 'money', unit: '元', defaultValue: 250000 },
      {
        key: 'litigationMonths',
        label: '诉讼预计周期',
        type: 'number',
        unit: '月',
        defaultValue: 18,
        hint: '含一审、可能的二审与执行',
      },
      {
        key: 'arbitrationMonths',
        label: '仲裁预计周期',
        type: 'number',
        unit: '月',
        defaultValue: 8,
      },
      {
        key: 'mediationMonths',
        label: '调解预计周期',
        type: 'number',
        unit: '月',
        defaultValue: 2,
      },
      {
        key: 'internalHours',
        label: '内部法务投入小时',
        type: 'number',
        unit: '小时',
        defaultValue: 100,
      },
      { key: 'hourlyCost', label: '内部法务小时成本', type: 'money', unit: '元/小时', defaultValue: 300 },
      {
        key: 'recoveryRate',
        label: '预期回款率',
        type: 'percent',
        unit: '%',
        defaultValue: 70,
      },
      {
        key: 'capitalRate',
        label: '资金占用年成本率',
        type: 'percent',
        unit: '%',
        defaultValue: 5,
        hint: '回款延迟的机会成本，按企业资金成本填写',
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const lawyerFee = toNum(values.lawyerFee);
      const internalCost = round(toNum(values.internalHours) * toNum(values.hourlyCost), 2);
      const recoveryRate = toNum(values.recoveryRate) / 100;
      const capitalRate = toNum(values.capitalRate) / 100;

      const { total: courtFee } = progressive(amount, CIVIL_FEE_TIERS);
      let arbFee = 0;
      {
        let lower = 0;
        for (const t of ARBITRATION_TIERS) {
          if (amount <= lower) break;
          arbFee += (Math.min(amount, t.upTo) - lower) * t.rate;
          lower = t.upTo;
        }
        arbFee = Math.max(round(arbFee, 2), ARBITRATION_MIN);
      }

      const paths = [
        {
          name: '诉讼（一审 + 可能二审）',
          fee: round(courtFee + lawyerFee + internalCost, 2),
          months: toNum(values.litigationMonths),
          note: `受理费 ${money(courtFee)} 元，两审终审 + 执行周期长`,
        },
        {
          name: '仲裁（一裁终局）',
          fee: round(arbFee + lawyerFee + internalCost, 2),
          months: toNum(values.arbitrationMonths),
          note: `仲裁费约 ${money(arbFee)} 元（参考估算），一裁终局、周期短、保密性强`,
        },
        {
          name: '调解 / 和解',
          fee: round(lawyerFee * 0.4 + internalCost * 0.5, 2),
          months: toNum(values.mediationMonths),
          note: '律师费按 40% 折算，通常需要以一定金额折让换取快速回款',
        },
      ];

      const steps: StepRow[] = [{ label: '争议标的额', value: `${money(amount)} 元` }];

      const results = paths.map((p) => {
        const capitalCost = round(amount * recoveryRate * capitalRate * (p.months / 12), 2);
        const total = round(p.fee + capitalCost, 2);
        steps.push({
          label: p.name,
          value: `直接成本 ${money(p.fee)} + 资金占用 ${money(capitalCost)} = ${money(total)} 元（${p.months} 个月）`,
          note: p.note,
        });
        return { ...p, capitalCost, total };
      });

      const sorted = [...results].sort((a, b) => a.total - b.total);
      const best = sorted[0];
      steps.push({ label: '综合成本最优', value: `${best.name}（${money(best.total)} 元）`, emphasis: true });

      const recovery = round(amount * recoveryRate, 2);
      steps.push({
        label: '最优路径净收益',
        value: `${money(recovery)} − ${money(best.total)} = ${money(round(recovery - best.total, 2))} 元`,
        emphasis: true,
      });

      return {
        main: {
          label: '推荐路径',
          value: best.name,
          sub: `综合成本 ${money(best.total)} 元，周期 ${best.months} 个月`,
        },
        blocks: results.map((r) => ({
          label: r.name,
          value: money(r.total),
          unit: '元',
          sub: `直接成本 ${money(r.fee)} + 资金占用 ${money(r.capitalCost)}，${r.months} 个月`,
        })),
        steps,
        basis: [
          {
            law: '《诉讼费用交纳办法》',
            article: '第十三条',
            text: '财产案件根据诉讼请求的金额或者价额分段累计交纳案件受理费。',
          },
          {
            law: '《仲裁法》',
            article: '第九条',
            text: '仲裁实行一裁终局的制度。裁决作出后，当事人就同一纠纷再申请仲裁或者向人民法院起诉的，仲裁委员会或者人民法院不予受理。',
          },
          {
            law: '《民事诉讼法》',
            article: '第九条',
            text: '人民法院审理民事案件，应当根据自愿和合法的原则进行调解；调解不成的，应当及时判决。',
          },
        ],
        tips: [
          '仲裁费用高于诉讼受理费，但一裁终局可节省大量时间成本；金额大、周期敏感的商业争议通常更划算。',
          '诉讼时效内先行调解的成本极低，且调解书可直接申请强制执行，是性价比最高的路径。',
          '资金占用成本常被忽略：5000 万标的拖延一年，按 5% 年成本计即达 175 万元，往往超过律师费本身。',
          '仲裁费档位为常见区间近似值，正式决策前请向选定仲裁机构核实最新收费办法。',
        ],
        disclaimer: '仲裁费为按常见档位的估算值，各仲裁机构收费标准差异较大，正式决策前请向选定机构核实。',
      };
    },
  },

  /* ── 法务部门投入产出 ── */
  {
    id: 'legal-dept-roi',
    name: '法务部门投入产出',
    category: 'legalcost',
    glyph: '产',
    summary: '年度法务总成本与风险减损、争议挽回金额的 ROI 分析',
    keywords: ['法务部门', 'ROI', '投入产出', '法务预算'],
    fields: [
      { key: 'headcount', label: '法务团队人数', type: 'number', unit: '人', defaultValue: 8 },
      { key: 'avgSalary', label: '人均年度人力成本', type: 'money', unit: '元', defaultValue: 500000, hint: '含工资、社保、公积金、奖金' },
      { key: 'externalFee', label: '年度外部律师费', type: 'money', unit: '元', defaultValue: 1500000 },
      { key: 'litigationFee', label: '年度诉讼 / 仲裁费用', type: 'money', unit: '元', defaultValue: 300000 },
      { key: 'systemFee', label: '系统工具与培训费用', type: 'money', unit: '元', defaultValue: 200000 },
      { key: 'cases', label: '年度处理案件数', type: 'number', unit: '件', defaultValue: 120 },
      { key: 'disputeAmount', label: '年度涉及争议总金额', type: 'money', unit: '元', defaultValue: 80000000 },
      { key: 'recovered', label: '年度挽回 / 避免损失金额', type: 'money', unit: '元', defaultValue: 25000000 },
      {
        key: 'contractValue',
        label: '年度审核合同涉及金额',
        type: 'money',
        unit: '元',
        defaultValue: 300000000,
        hint: '用于计算法务对业务规模的支撑效率',
      },
    ],
    calc(values): CalcOutput {
      const headcount = Math.max(1, toNum(values.headcount));
      const avgSalary = toNum(values.avgSalary);
      const external = toNum(values.externalFee);
      const litigation = toNum(values.litigationFee);
      const system = toNum(values.systemFee);
      const cases = Math.max(1, toNum(values.cases));
      const dispute = toNum(values.disputeAmount);
      const recovered = toNum(values.recovered);
      const contractValue = toNum(values.contractValue);

      const steps: StepRow[] = [];
      const internal = round(headcount * avgSalary, 2);
      steps.push({ label: '内部人力成本', value: `${headcount} 人 × ${money(avgSalary)} = ${money(internal)} 元` });
      steps.push({ label: '外部律师费', value: `${money(external)} 元` });
      steps.push({ label: '诉讼 / 仲裁费用', value: `${money(litigation)} 元` });
      steps.push({ label: '系统工具与培训', value: `${money(system)} 元` });

      const total = round(internal + external + litigation + system, 2);
      steps.push({ label: '年度法务总成本', value: `${money(total)} 元`, emphasis: true });

      const roi = round(((recovered - total) / Math.max(total, 1)) * 100, 2);
      steps.push({
        label: '投入产出比',
        value: `(${money(recovered)} − ${money(total)}) ÷ ${money(total)} = ${roi}%`,
        emphasis: true,
        note: recovered > total ? '法务创造的价值高于成本' : '⚠ 账面 ROI 为负，需复核挽回金额的统计口径',
      });

      const perCase = round(total / cases, 2);
      steps.push({ label: '单案件平均成本', value: `${money(total)} ÷ ${cases} = ${money(perCase)} 元` });

      const perHeadDispute = round(dispute / headcount, 2);
      steps.push({ label: '人均管理争议金额', value: `${money(perHeadDispute)} 元` });

      const costRate = round((total / Math.max(contractValue, 1)) * 100, 4);
      steps.push({
        label: '法务成本占合同规模比',
        value: `${money(total)} ÷ ${money(contractValue)} = ${costRate}%`,
        note: costRate < 0.1 ? '处于较低水平，可评估是否投入不足' : costRate > 0.5 ? '占比较高，可考虑优化外部律师使用策略' : '处于常见区间',
      });

      const externalRatio = round((external / Math.max(total, 1)) * 100, 2);
      steps.push({ label: '外部律师费占比', value: `${externalRatio}%`, note: externalRatio > 50 ? '外部依赖度高，可考虑补充内部力量或采用固定年费制' : '内外配比相对均衡' });

      return {
        main: { label: '年度法务总成本', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '投入产出比', value: `${roi}%`, sub: recovered > total ? '价值创造为正' : 'ROI 为负' },
          { label: '单案件平均成本', value: money(perCase), unit: '元' },
          { label: '人均管理争议金额', value: money(perHeadDispute), unit: '元' },
          { label: '法务成本占合同规模', value: `${costRate}%` },
          { label: '外部律师费占比', value: `${externalRatio}%` },
        ],
        steps,
        basis: [
          {
            law: '《律师服务收费管理办法》',
            article: '第十条',
            text: '律师服务收费可以根据不同的服务内容，采取计件收费、按标的额比例收费和计时收费等方式。',
          },
        ],
        tips: [
          '"挽回损失"的统计口径决定了 ROI 的可信度，建议只计入有书面依据（胜诉判决、执行到位、谈判降价）的金额。',
          '法务成本占合同规模 0.1%—0.5% 是多数行业的常见区间，显著低于该区间往往意味着合规风险敞口偏大。',
          '外部律师费占比超过 50% 时，通常可通过常年法律顾问（年度固定费）替代个案委托，显著降低成本。',
          '除挽回金额外，法务的"风险避免"价值（未发生的诉讼、未签下的风险合同）同样重要，建议在报告中单独列示。',
        ],
      };
    },
  },
];
