/**
 * 二、利息与违约金类计算器
 * 依据：《民法典》第577条、第585条、第670条、第680条
 *      《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》（2020修正）
 *      《最高人民法院关于执行程序中计算迟延履行期间的债务利息适用法律若干问题的解释》（法释〔2014〕8号）
 *      《民法典合同编通则司法解释》（法释〔2023〕13号）第65条
 */
import type { CalculatorDef, CalcOutput, StepRow, ResultBlock } from '../types';
import { money, round, toNum, toStr, moneyToChinese } from '../format';
import { parseDate, ymd } from '../dateUtils';

/** 加倍部分债务利息日利率 */
const DOUBLE_RATE_DAILY = 0.000175; // 日万分之一点七五

/** 当前一年期 LPR 参考值，用户可自行修改 */
export const LPR_DEFAULT = 3.0;

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export const interestCalculators: CalculatorDef[] = [
  /* ── 民间借贷利息（司法保护上限） ── */
  {
    id: 'lpr-interest',
    name: '民间借贷利息与上限',
    category: 'interest',
    glyph: '息',
    summary: '按约定利率计息，并以一年期 LPR 四倍校验司法保护上限',
    keywords: ['LPR', '民间借贷', '四倍', '利息上限'],
    fields: [
      { key: 'principal', label: '借款本金', type: 'money', unit: '元', emphasis: true, defaultValue: 500000 },
      {
        key: 'agreedRate',
        label: '约定年利率',
        type: 'percent',
        unit: '%',
        defaultValue: 15,
        hint: '年化利率，如月息 2 分请填 24',
      },
      {
        key: 'lpr',
        label: '合同成立时一年期 LPR',
        type: 'percent',
        unit: '%',
        defaultValue: LPR_DEFAULT,
        hint: '每月 20 日由全国银行间同业拆借中心公布，务必核对当期值',
      },
      { key: 'days', label: '借款天数', type: 'number', unit: '天', defaultValue: 365 },
      {
        key: 'startDate',
        label: '借款发放日',
        type: 'date',
        hint: '选填，用于展示计息区间',
      },
      {
        key: 'cutHead',
        label: '是否存在砍头息',
        type: 'switch',
        defaultValue: false,
        hint: '预先在本金中扣除利息的，按实际借款数额计算',
      },
      {
        key: 'cutAmount',
        label: '预先扣除的利息',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        visibleWhen: (v) => v.cutHead === true || v.cutHead === 'true',
      },
    ],
    calc(values): CalcOutput {
      const rawPrincipal = toNum(values.principal);
      const agreedRate = toNum(values.agreedRate) / 100;
      const lpr = toNum(values.lpr) / 100;
      const days = toNum(values.days);
      const cut = (values.cutHead === true || values.cutHead === 'true') ? toNum(values.cutAmount) : 0;

      const cap = round(lpr * 4 * 100, 4);
      const effectivePrincipal = round(rawPrincipal - cut, 2);

      const steps: StepRow[] = [];
      if (cut > 0) {
        steps.push({
          label: '砍头息调整本金',
          value: `${money(rawPrincipal)} − ${money(cut)} = ${money(effectivePrincipal)} 元`,
          note: '《民法典》第670条：利息预先在本金中扣除的，按实际借款数额返还并计息',
        });
      }
      steps.push({
        label: '司法保护上限',
        value: `${toNum(values.lpr)}% × 4 = ${cap}%`,
        note: '一年期 LPR 四倍',
        emphasis: true,
      });

      const agreedInterest = round(effectivePrincipal * agreedRate * (days / 360), 2);
      steps.push({
        label: '约定利息',
        value: `${money(effectivePrincipal)} × ${toNum(values.agreedRate)}% × ${days}/360 = ${money(agreedInterest)} 元`,
      });

      const over = agreedRate > lpr * 4;
      const cappedInterest = over
        ? round(effectivePrincipal * lpr * 4 * (days / 360), 2)
        : agreedInterest;
      if (over) {
        steps.push({
          label: '超出上限，按上限计息',
          value: `${money(effectivePrincipal)} × ${cap}% × ${days}/360 = ${money(cappedInterest)} 元`,
          emphasis: true,
        });
        steps.push({
          label: '不予支持部分',
          value: `${money(round(agreedInterest - cappedInterest, 2))} 元`,
          note: '法院对超出部分不予支持；已自愿支付且未损害国家、集体和第三人利益的，一般不得请求返还',
        });
      }

      const start = parseDate(values.startDate);
      if (start) {
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        end.setDate(end.getDate() + days);
        steps.push({ label: '计息区间', value: `${ymd(start)} 至 ${ymd(end)}` });
      }

      return {
        main: {
          label: '法院支持的利息',
          value: money(cappedInterest),
          unit: '元',
          sub: over ? `约定 ${money(agreedInterest)} 元，已按 ${cap}% 上限核减` : moneyToChinese(cappedInterest),
        },
        blocks: [
          { label: '司法保护上限（年化）', value: `${cap}%`, sub: `LPR ${toNum(values.lpr)}% × 4` },
          { label: '约定利率是否超限', value: over ? '⚠ 已超限' : '未超限' },
          { label: '本息合计', value: money(round(effectivePrincipal + cappedInterest, 2)), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》',
            article: '第二十五条',
            text: '出借人请求借款人按照合同约定利率支付利息的，人民法院应予支持，但是双方约定的利率超过合同成立时一年期贷款市场报价利率四倍的除外。',
          },
          {
            law: '《民法典》',
            article: '第六百七十条',
            text: '借款的利息不得预先在本金中扣除。利息预先在本金中扣除的，应当按照实际借款数额返还借款并计算利息。',
          },
        ],
        tips: [
          '上限判断的时点是"合同成立时"的 LPR，而非起诉时或还款时，务必核对签约日当月的公布值。',
          'LPR 每月 20 日更新，2025 年 5 月起一年期 LPR 为 3.0%，本工具默认值为参考，请自行核对最新公布值。',
          '自然人之间的借款合同，未约定利息或约定不明的，视为不支付利息。',
        ],
      };
    },
  },

  /* ── 迟延履行期间加倍债务利息 ── */
  {
    id: 'delay-interest',
    name: '迟延履行加倍利息',
    category: 'interest',
    glyph: '延',
    summary: '生效文书迟延履行的一般债务利息 + 加倍部分债务利息',
    keywords: ['迟延履行', '加倍利息', '万分之一点七五', '执行'],
    fields: [
      { key: 'principal', label: '未清偿金钱债务本金', type: 'money', unit: '元', emphasis: true, defaultValue: 1000000 },
      {
        key: 'hasGeneral',
        label: '生效文书是否确定一般债务利息',
        type: 'switch',
        defaultValue: true,
      },
      {
        key: 'generalRate',
        label: '一般债务利息年利率',
        type: 'percent',
        unit: '%',
        defaultValue: 6,
        visibleWhen: (v) => v.hasGeneral === true || v.hasGeneral === 'true',
      },
      { key: 'startDate', label: '履行期间届满日', type: 'date', defaultValue: '2025-01-01' },
      { key: 'endDate', label: '实际清偿日', type: 'date', defaultValue: '2026-01-01' },
      {
        key: 'partial',
        label: '期间内是否分期清偿',
        type: 'switch',
        defaultValue: false,
        hint: '分期清偿需分段计算，此处按全额未清偿简化',
      },
    ],
    calc(values): CalcOutput {
      const principal = toNum(values.principal);
      const hasGeneral = values.hasGeneral === true || values.hasGeneral === 'true';
      const gr = toNum(values.generalRate) / 100;
      const start = parseDate(values.startDate) ?? new Date();
      const end = parseDate(values.endDate) ?? new Date();
      const days = Math.max(0, daysBetween(start, end));

      const steps: StepRow[] = [
        { label: '迟延期间', value: `${ymd(start)} 至 ${ymd(end)}，共 ${days} 天` },
      ];

      let general = 0;
      if (hasGeneral) {
        general = round(principal * gr * (days / 360), 2);
        steps.push({
          label: '一般债务利息',
          value: `${money(principal)} × ${toNum(values.generalRate)}% × ${days}/360 = ${money(general)} 元`,
          note: '按生效法律文书确定的方法计算；文书未确定的不予计算',
        });
      } else {
        steps.push({ label: '一般债务利息', value: '0 元', note: '生效文书未确定一般债务利息' });
      }

      const doubled = round(principal * DOUBLE_RATE_DAILY * days, 2);
      steps.push({
        label: '加倍部分债务利息',
        value: `${money(principal)} × 0.0175% × ${days} 天 = ${money(doubled)} 元`,
        note: '日万分之一点七五，不因一般债务利息的有无而变化',
        emphasis: true,
      });

      const total = round(general + doubled, 2);
      steps.push({ label: '迟延履行期间债务利息合计', value: `${money(total)} 元`, emphasis: true });

      const annualized = round(DOUBLE_RATE_DAILY * 365 * 100, 4);
      return {
        main: { label: '迟延履行期间债务利息', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '一般债务利息', value: money(general), unit: '元' },
          { label: '加倍部分债务利息', value: money(doubled), unit: '元' },
          { label: '加倍部分折合年化', value: `${annualized}%`, sub: '日万分之一点七五 × 365' },
          { label: '本息合计', value: money(round(principal + total, 2)), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《最高人民法院关于执行程序中计算迟延履行期间的债务利息适用法律若干问题的解释》',
            article: '第一条',
            text: '迟延履行期间的债务利息包括迟延履行期间的一般债务利息和加倍部分债务利息。加倍部分债务利息的计算方法为：加倍部分债务利息＝债务人尚未清偿的生效法律文书确定的除一般债务利息之外的金钱债务×日万分之一点七五×迟延履行期间。',
          },
          {
            law: '《民事诉讼法》',
            article: '第二百六十四条',
            text: '被执行人未按判决、裁定和其他法律文书指定的期间履行给付金钱义务的，应当加倍支付迟延履行期间的债务利息。',
          },
          {
            law: '《迟延履行利息解释》',
            article: '第四条',
            text: '被执行人的财产不足以清偿全部债务的，应当先清偿生效法律文书确定的金钱债务，再清偿加倍部分债务利息，但当事人对清偿顺序另有约定的除外。',
          },
        ],
        tips: [
          '加倍部分债务利息的计息基数不含一般债务利息，仅以"金钱债务本金"为基数，这是实务中最常见的计算错误。',
          '起点：履行期间届满之日；分期履行的自每期届满日起算；未确定履行期间的自法律文书生效之日起算。',
          '财产不足清偿全部债务时，清偿顺序为：本金 → 一般债务利息 → 加倍部分利息（当事人另有约定除外）。',
        ],
      };
    },
  },

  /* ── 一般债务利息（单利/复利） ── */
  {
    id: 'general-interest',
    name: '一般债务利息',
    category: 'interest',
    glyph: '利',
    summary: '单利 / 复利两种口径的利息计算，支持分段利率',
    keywords: ['单利', '复利', '利息', '年利率'],
    fields: [
      { key: 'principal', label: '本金', type: 'money', unit: '元', emphasis: true, defaultValue: 1000000 },
      { key: 'rate', label: '年利率', type: 'percent', unit: '%', defaultValue: 6 },
      {
        key: 'mode',
        label: '计息方式',
        type: 'select',
        defaultValue: 'simple',
        options: [
          { label: '单利', value: 'simple' },
          { label: '复利（年复利）', value: 'compound' },
        ],
      },
      { key: 'startDate', label: '起息日', type: 'date', defaultValue: '2023-01-01' },
      { key: 'endDate', label: '截止日', type: 'date', defaultValue: '2026-01-01' },
      {
        key: 'dayBase',
        label: '年天数基数',
        type: 'select',
        defaultValue: '360',
        options: [
          { label: '360 天（金融惯例）', value: '360' },
          { label: '365 天（司法常用）', value: '365' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const p = toNum(values.principal);
      const r = toNum(values.rate) / 100;
      const mode = toStr(values.mode, 'simple');
      const start = parseDate(values.startDate) ?? new Date();
      const end = parseDate(values.endDate) ?? new Date();
      const base = toNum(values.dayBase, 360);
      const days = Math.max(0, daysBetween(start, end));
      const years = days / base;

      const steps: StepRow[] = [{ label: '计息期间', value: `${ymd(start)} 至 ${ymd(end)}，共 ${days} 天（${years.toFixed(4)} 年）` }];

      let interest = 0;
      if (mode === 'simple') {
        interest = round(p * r * years, 2);
        steps.push({ label: '单利计算', value: `${money(p)} × ${toNum(values.rate)}% × ${years.toFixed(4)} = ${money(interest)} 元` });
      } else {
        const n = Math.floor(years);
        const frac = years - n;
        const full = round(p * Math.pow(1 + r, n), 2);
        interest = round(full + full * r * frac - p, 2);
        steps.push({ label: `复利 ${n} 个完整年度`, value: `${money(p)} × (1 + ${toNum(values.rate)}%)^${n} = ${money(full)} 元` });
        if (frac > 0) {
          steps.push({ label: `余数 ${frac.toFixed(4)} 年按单利`, value: `+ ${money(round(full * r * frac, 2))} 元` });
        }
        steps.push({ label: '利息合计', value: `${money(interest)} 元`, emphasis: true });
      }

      return {
        main: { label: '利息金额', value: money(interest), unit: '元', sub: moneyToChinese(interest) },
        blocks: [
          { label: '本息合计', value: money(round(p + interest, 2)), unit: '元' },
          { label: '实际年化成本', value: `${((interest / Math.max(p, 1) / Math.max(years, 0.0001)) * 100).toFixed(3)}%` },
        ],
        steps,
        basis: [
          {
            law: '《民法典》',
            article: '第六百八十条',
            text: '借款合同对支付利息没有约定的，视为没有利息。借款合同对支付利息约定不明确，当事人不能达成补充协议的，按照当地或者当事人的交易方式、交易习惯、市场利率等因素确定利息。',
          },
        ],
        tips: [
          '司法实务中"复利"受严格限制：仅在借款期限届满后经双方确认将前期利息计入后期本金，且前期利率未超上限时，方可部分支持。',
          '法院判决利息通常按 365 天为年基数，金融合同常约定 360 天，两者在长周期下差异明显。',
        ],
      };
    },
  },

  /* ── 逾期付款违约金 ── */
  {
    id: 'contract-penalty',
    name: '违约金计算器',
    category: 'interest',
    glyph: '违',
    summary: '按日万分之X 或固定金额计算逾期违约金，并同步校验司法保护上限',
    keywords: ['违约金', '逾期付款', '日万分之', '违约'],
    fields: [
      { key: 'principal', label: '违约所涉价款 / 本金', type: 'money', unit: '元', emphasis: true, defaultValue: 1000000 },
      {
        key: 'mode',
        label: '违约金约定方式',
        type: 'select',
        defaultValue: 'daily',
        options: [
          { label: '按日计算（日万分之X）', value: 'daily' },
          { label: '一次性固定金额', value: 'fixed' },
          { label: '按未付款比例', value: 'proportion' },
        ],
      },
      {
        key: 'dailyRate',
        label: '日违约金率',
        type: 'number',
        unit: '‱（万分之）',
        defaultValue: 5,
        hint: '常见约定为日万分之三至万分之五',
        visibleWhen: (v) => toStr(v.mode) === 'daily',
      },
      {
        key: 'fixedAmount',
        label: '约定违约金金额',
        type: 'money',
        unit: '元',
        defaultValue: 100000,
        visibleWhen: (v) => toStr(v.mode) === 'fixed',
      },
      {
        key: 'propRate',
        label: '违约金比例',
        type: 'percent',
        unit: '%',
        defaultValue: 20,
        visibleWhen: (v) => toStr(v.mode) === 'proportion',
      },
      { key: 'startDate', label: '违约行为发生日', type: 'date', defaultValue: '2025-01-01' },
      { key: 'endDate', label: '计算截止日', type: 'date', defaultValue: '2026-01-01' },
      {
        key: 'capRate',
        label: '合同约定的违约金上限',
        type: 'percent',
        unit: '%',
        defaultValue: 30,
        hint: '填 0 表示合同未约定上限',
      },
      {
        key: 'actualLoss',
        label: '实际损失（用于调减审查）',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '填 0 表示暂不审查',
      },
    ],
    calc(values): CalcOutput {
      const p = toNum(values.principal);
      const mode = toStr(values.mode, 'daily');
      const start = parseDate(values.startDate) ?? new Date();
      const end = parseDate(values.endDate) ?? new Date();
      const days = Math.max(0, daysBetween(start, end));
      const capRate = toNum(values.capRate) / 100;
      const actualLoss = toNum(values.actualLoss);

      const steps: StepRow[] = [
        { label: '违约持续期间', value: `${ymd(start)} 至 ${ymd(end)}，共 ${days} 天` },
      ];

      let raw = 0;
      let rateDesc = '';
      if (mode === 'daily') {
        const d = toNum(values.dailyRate) / 10000;
        raw = round(p * d * days, 2);
        rateDesc = `日万分之 ${toNum(values.dailyRate)}`;
        steps.push({ label: `按日计算`, value: `${money(p)} × ${toNum(values.dailyRate)}‱ × ${days} 天 = ${money(raw)} 元` });
        steps.push({ label: '折合年化', value: `${(d * 365 * 100).toFixed(2)}%` });
      } else if (mode === 'fixed') {
        raw = toNum(values.fixedAmount);
        rateDesc = '固定金额';
        steps.push({ label: '约定固定违约金', value: `${money(raw)} 元` });
      } else {
        const pr = toNum(values.propRate) / 100;
        raw = round(p * pr, 2);
        rateDesc = `未付款的 ${toNum(values.propRate)}%`;
        steps.push({ label: '按比例计算', value: `${money(p)} × ${toNum(values.propRate)}% = ${money(raw)} 元` });
      }

      let capped = raw;
      if (capRate > 0) {
        const cap = round(p * capRate, 2);
        if (raw > cap) {
          capped = cap;
          steps.push({
            label: '触发合同违约金上限',
            value: `${money(p)} × ${toNum(values.capRate)}% = ${money(cap)} 元`,
            emphasis: true,
            note: '合同约定上限优先于按日累计结果',
          });
        } else {
          steps.push({ label: '合同上限校验', value: `上限 ${money(cap)} 元，未触发` });
        }
      }

      const blocks: ResultBlock[] = [
        { label: '违约金计算口径', value: rateDesc },
        { label: '占本金比例', value: `${((capped / Math.max(p, 1)) * 100).toFixed(2)}%` },
      ];

      if (actualLoss > 0) {
        const threshold = round(actualLoss * 1.3, 2);
        const excessive = capped > threshold;
        steps.push({
          label: '司法调减审查（损失 × 130%）',
          value: `${money(actualLoss)} × 130% = ${money(threshold)} 元`,
          emphasis: true,
        });
        steps.push({
          label: '审查结论',
          value: excessive ? '⚠ 超过损失 30%，一般可认定为"过分高于造成的损失"' : '未超过损失 30%，通常予以支持',
          note: '《民法典合同编通则司法解释》第65条',
        });
        blocks.push({
          label: '预估调减后金额',
          value: excessive ? money(threshold) : money(capped),
          unit: '元',
          sub: excessive ? '以损失 130% 为参考上限' : '无需调减',
        });
      }

      return {
        main: { label: '违约金金额', value: money(capped), unit: '元', sub: moneyToChinese(capped) },
        blocks,
        steps,
        basis: [
          {
            law: '《民法典》',
            article: '第五百八十五条',
            text: '当事人可以约定一方违约时应当根据违约情况向对方支付一定数额的违约金，也可以约定因违约产生的损失赔偿额的计算方法。约定的违约金低于造成的损失的，人民法院或者仲裁机构可以根据当事人的请求予以增加；约定的违约金过分高于造成的损失的，人民法院或者仲裁机构可以根据当事人的请求予以适当减少。',
          },
          {
            law: '《民法典合同编通则司法解释》',
            article: '第六十五条',
            text: '约定的违约金超过造成损失的百分之三十的，人民法院一般可以认定为民法典第五百八十五条第二款规定的"过分高于造成的损失"。',
          },
        ],
        tips: [
          '违约金调减以"当事人请求"为前提，法院一般不主动调整，被告需明确提出抗辩。',
          '主张违约金过高的一方应承担初步举证责任，之后由主张违约金的一方举证实际损失。',
          '日万分之五折合年化 18.25%，在长周期逾期中极易被调减，建议同步约定 30% 总额上限以提高稳定性。',
        ],
      };
    },
  },

  /* ── 违约金司法调减 ── */
  {
    id: 'penalty-adjust',
    name: '违约金司法调整',
    category: 'interest',
    glyph: '调',
    summary: '以实际损失为基准，测算法院可能调增 / 调减后的违约金区间',
    keywords: ['违约金调减', '违约金过高', '损失30%', '司法调整'],
    fields: [
      { key: 'agreed', label: '约定违约金金额', type: 'money', unit: '元', defaultValue: 500000 },
      { key: 'loss', label: '守约方实际损失', type: 'money', unit: '元', defaultValue: 200000 },
      {
        key: 'fault',
        label: '违约方过错程度',
        type: 'select',
        defaultValue: 'intentional',
        options: [
          { label: '故意违约', value: 'intentional' },
          { label: '重大过失', value: 'gross' },
          { label: '一般过失', value: 'ordinary' },
          { label: '无过错（不可抗力等）', value: 'none' },
        ],
      },
      {
        key: 'performed',
        label: '合同已履行比例',
        type: 'percent',
        unit: '%',
        defaultValue: 50,
        hint: '已履行比例越高，违约金越容易被调减',
      },
      {
        key: 'partyType',
        label: '守约方主体类型',
        type: 'select',
        defaultValue: 'enterprise',
        options: [
          { label: '企业（商事主体）', value: 'enterprise' },
          { label: '消费者 / 自然人', value: 'consumer' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const agreed = toNum(values.agreed);
      const loss = toNum(values.loss);
      const fault = toStr(values.fault, 'intentional');
      const performed = toNum(values.performed) / 100;
      const partyType = toStr(values.partyType, 'enterprise');

      const steps: StepRow[] = [
        { label: '基础损失', value: `${money(loss)} 元` },
        { label: '约定违约金', value: `${money(agreed)} 元` },
      ];

      // 酌定系数：过错程度
      const faultCoef = fault === 'intentional' ? 0.15 : fault === 'gross' ? 0.08 : fault === 'ordinary' ? 0 : -0.08;
      const faultLabel =
        fault === 'intentional' ? '故意违约 +15%' : fault === 'gross' ? '重大过失 +8%' : fault === 'ordinary' ? '一般过失 ±0%' : '无过错 −8%';
      steps.push({ label: '过错程度调整', value: faultLabel, note: '《民法典合同编通则司法解释》第65条列举的衡量因素' });

      // 履行情况：已履行比例越高，惩罚性越弱
      const perfCoef = round((performed - 0.5) * -0.1, 4);
      steps.push({
        label: '履行情况调整',
        value: `已履行 ${toNum(values.performed)}% → ${perfCoef >= 0 ? '+' : ''}${(perfCoef * 100).toFixed(1)}%`,
      });

      // 主体类型：商事主体意思自治空间更大
      const partyCoef = partyType === 'enterprise' ? 0.1 : -0.05;
      steps.push({
        label: '主体类型调整',
        value: partyType === 'enterprise' ? '商事主体 +10%（尊重意思自治）' : '消费者 −5%（倾斜保护）',
      });

      const coef = round(1 + faultCoef + perfCoef + partyCoef, 4);
      const estimated = round(loss * 1.3 * coef, 2);
      const threshold = round(loss * 1.3, 2);

      steps.push({ label: '综合系数', value: `${coef.toFixed(3)}` });
      steps.push({
        label: '酌定支持金额',
        value: `${money(loss)} × 130% × ${coef.toFixed(3)} = ${money(estimated)} 元`,
        emphasis: true,
      });

      const final = Math.min(agreed, estimated);
      steps.push({
        label: '与约定金额比较取低',
        value: `min(${money(agreed)}, ${money(estimated)}) = ${money(final)} 元`,
        emphasis: true,
      });

      const excessive = agreed > threshold;
      return {
        main: {
          label: '预估法院支持金额',
          value: money(final),
          unit: '元',
          sub: final < agreed ? `较约定金额调减 ${money(round(agreed - final, 2))} 元` : moneyToChinese(final),
        },
        blocks: [
          { label: '损失 130% 参考线', value: money(threshold), unit: '元' },
          { label: '是否构成"过分高于"', value: excessive ? '是（超过损失 30%）' : '否' },
          {
            label: '调减幅度',
            value: final < agreed ? `${(((agreed - final) / Math.max(agreed, 1)) * 100).toFixed(2)}%` : '0%',
          },
        ],
        steps,
        basis: [
          {
            law: '《民法典合同编通则司法解释》',
            article: '第六十五条',
            text: '当事人主张约定的违约金过高请求予以适当减少的，人民法院应当以违约造成的损失为基础，兼顾合同主体、交易类型、合同的履行情况、当事人的过错程度、履约背景等因素，遵循公平原则和诚信原则进行衡量，并作出裁判。',
          },
        ],
        tips: [
          '本工具为基于裁量因素的估算模型，个案裁判结果受法官自由裁量影响，仅供谈判与预期管理参考。',
          '违约金兼具补偿性与惩罚性，"超过损失 30%"只是一般参考线，并非绝对红线，商事合同中较高约定被支持的案例并不少见。',
          '守约方应重点举证实际损失（含可得利益损失），损失举证越充分，调减空间越小。',
        ],
      };
    },
  },

  /* ── 借款利率合规体检 ── */
  {
    id: 'loan-compliance',
    name: '借款利率合规体检',
    category: 'interest',
    glyph: '检',
    summary: '砍头息还原、综合费率测算与超上限风险预警',
    keywords: ['砍头息', '综合费率', '合规', '利率上限', '服务费'],
    fields: [
      { key: 'contractAmount', label: '合同载明借款金额', type: 'money', unit: '元', defaultValue: 1000000 },
      { key: 'cutAmount', label: '预先扣除款项（砍头息）', type: 'money', unit: '元', defaultValue: 0 },
      { key: 'interestRate', label: '约定年利率', type: 'percent', unit: '%', defaultValue: 12 },
      { key: 'serviceFee', label: '服务费 / 咨询费（一次性）', type: 'money', unit: '元', defaultValue: 0 },
      { key: 'otherFee', label: '其他费用（担保费、保险费等）', type: 'money', unit: '元', defaultValue: 0 },
      { key: 'term', label: '借款期限', type: 'number', unit: '月', defaultValue: 12 },
      {
        key: 'lpr',
        label: '合同成立时一年期 LPR',
        type: 'percent',
        unit: '%',
        defaultValue: LPR_DEFAULT,
      },
    ],
    calc(values): CalcOutput {
      const contract = toNum(values.contractAmount);
      const cut = toNum(values.cutAmount);
      const rate = toNum(values.interestRate) / 100;
      const service = toNum(values.serviceFee);
      const other = toNum(values.otherFee);
      const months = Math.max(1, toNum(values.term));
      const lpr = toNum(values.lpr) / 100;

      const actual = round(contract - cut, 2);
      const steps: StepRow[] = [];

      if (cut > 0) {
        steps.push({
          label: '砍头息还原本金',
          value: `${money(contract)} − ${money(cut)} = ${money(actual)} 元`,
          note: '《民法典》第670条：按实际借款数额返还并计息',
          emphasis: true,
        });
      } else {
        steps.push({ label: '实际到账本金', value: `${money(actual)} 元` });
      }

      const interest = round(actual * rate * (months / 12), 2);
      steps.push({ label: '约定利息', value: `${money(actual)} × ${toNum(values.interestRate)}% × ${months}/12 = ${money(interest)} 元` });

      const allCost = round(interest + service + other, 2);
      steps.push({ label: '借款人全部成本', value: `${money(interest)} + ${money(service)} + ${money(other)} = ${money(allCost)} 元` });

      // 综合年化成本（以实际到账金额为基数）
      const comprehensive = round((allCost / Math.max(actual, 1)) * (12 / months) * 100, 4);
      steps.push({
        label: '综合年化成本率',
        value: `${comprehensive}%`,
        note: '将利息、服务费、担保费等全部计入，除以实际到账本金',
        emphasis: true,
      });

      const cap = round(lpr * 4 * 100, 4);
      steps.push({ label: '司法保护上限（LPR 四倍）', value: `${cap}%` });

      const over = comprehensive > cap;
      const supported = over ? round(actual * lpr * 4 * (months / 12), 2) : allCost;
      if (over) {
        steps.push({
          label: '超限部分不予支持',
          value: `按上限计算可支持成本 ${money(supported)} 元，超出 ${money(round(allCost - supported, 2))} 元`,
          emphasis: true,
        });
      }

      return {
        main: {
          label: '综合年化成本率',
          value: `${comprehensive}%`,
          sub: over ? `⚠ 已超 LPR 四倍上限 ${cap}%` : `未超上限（${cap}%）`,
        },
        blocks: [
          { label: '实际可用本金', value: money(actual), unit: '元' },
          { label: '法院可支持成本', value: money(supported), unit: '元' },
          { label: '到期应还总额（合规口径）', value: money(round(actual + supported, 2)), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《最高人民法院关于审理民间借贷案件适用法律若干问题的规定》',
            article: '第二十五条',
            text: '双方约定的利率超过合同成立时一年期贷款市场报价利率四倍的，人民法院不予支持。',
          },
          {
            law: '《最高人民法院关于进一步加强金融审判工作的若干意见》',
            text: '金融借款合同的借款人以贷款人同时主张的利息、复利、罚息、违约金和其他费用过高显著背离实际损失为由，请求对总计超过年利率24%的部分予以调减的，应予支持。',
          },
        ],
        tips: [
          '实务中法院会将服务费、咨询费、担保费等变相利息合并计算，判断综合融资成本是否突破上限，拆分收费无法规避。',
          '砍头息是民间借贷高频争议点，务必按"实际到账金额"而非"合同金额"作为计息本金与还款基数。',
          '金融机构借贷不适用 LPR 四倍规则，但受年利率 24% 的司法调减约束，两者标准不同。',
        ],
      };
    },
  },

  /* ── 资金占用损失 ── */
  {
    id: 'occupation-loss',
    name: '资金占用损失',
    category: 'interest',
    glyph: '占',
    summary: '未约定逾期付款违约金时，按 LPR 加计 30%—50% 主张损失',
    keywords: ['资金占用', '逾期付款损失', 'LPR加计', '买卖合同'],
    fields: [
      { key: 'principal', label: '欠付价款 / 款项', type: 'money', unit: '元', emphasis: true, defaultValue: 1000000 },
      { key: 'startDate', label: '应付款日', type: 'date', defaultValue: '2025-01-01' },
      { key: 'endDate', label: '实际清偿日', type: 'date', defaultValue: '2026-01-01' },
      {
        key: 'lpr',
        label: '违约行为发生时一年期 LPR',
        type: 'percent',
        unit: '%',
        defaultValue: LPR_DEFAULT,
      },
      {
        key: 'addRate',
        label: '加计比例',
        type: 'select',
        defaultValue: '50',
        options: [
          { label: '加计 30%', value: '30' },
          { label: '加计 40%', value: '40' },
          { label: '加计 50%', value: '50' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const p = toNum(values.principal);
      const start = parseDate(values.startDate) ?? new Date();
      const end = parseDate(values.endDate) ?? new Date();
      const lpr = toNum(values.lpr) / 100;
      const add = toNum(values.addRate, 50) / 100;
      const days = Math.max(0, daysBetween(start, end));

      const effective = round(lpr * (1 + add), 6);
      const loss = round(p * effective * (days / 365), 2);

      const steps: StepRow[] = [
        { label: '逾期期间', value: `${ymd(start)} 至 ${ymd(end)}，共 ${days} 天` },
        { label: '适用利率', value: `${toNum(values.lpr)}% × (1 + ${toNum(values.addRate)}%) = ${(effective * 100).toFixed(3)}%`, emphasis: true },
        {
          label: '资金占用损失',
          value: `${money(p)} × ${(effective * 100).toFixed(3)}% × ${days}/365 = ${money(loss)} 元`,
          emphasis: true,
        },
      ];

      return {
        main: { label: '资金占用损失', value: money(loss), unit: '元', sub: moneyToChinese(loss) },
        blocks: [
          { label: '适用年利率', value: `${(effective * 100).toFixed(3)}%` },
          { label: '本息合计', value: money(round(p + loss, 2)), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《最高人民法院关于审理买卖合同纠纷案件适用法律问题的解释》',
            article: '第十八条',
            text: '买卖合同没有约定逾期付款违约金或者该违约金的计算方法，出卖人以买受人违约为由主张赔偿逾期付款损失，违约行为发生在2019年8月20日之后的，人民法院可以违约行为发生时中国人民银行授权全国银行间同业拆借中心公布的一年期贷款市场报价利率（LPR）标准为基础，加计30—50%计算逾期付款损失。',
          },
          {
            law: '《民法典》',
            article: '第五百七十七条',
            text: '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
          },
        ],
        tips: [
          '这是"合同没约定违约金"时的兜底主张路径，几乎所有金钱债务都可援引，实务价值极高。',
          '加计 30%—50% 属法院裁量区间，逾期时间长、违约方恶意明显的，主张 50% 更易获支持。',
          '该类损失按 365 天为年基数计算，与金融合同的 360 天口径不同。',
        ],
      };
    },
  },
];
