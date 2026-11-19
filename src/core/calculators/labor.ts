/**
 * 三、劳动争议类计算器
 * 依据：《劳动法》第44条
 *      《劳动合同法》第47条、第82条、第87条
 *      《劳动合同法实施条例》第27条
 *      《工伤保险条例》第35—39条、第64条
 *      《职工带薪年休假条例》第3条、第5条
 */
import type { CalculatorDef, CalcOutput, StepRow, ResultBlock } from '../types';
import { money, round, toNum, toStr, moneyToChinese } from '../format';
import { parseDate, ymd } from '../dateUtils';

/** 月计薪天数：(365 − 104 休息日) ÷ 12 */
export const MONTH_WORK_DAYS = 21.75;

/** 一次性伤残补助金月数（1—10 级） */
export const DISABILITY_GRANT_MONTHS = [27, 25, 23, 21, 18, 16, 13, 11, 9, 7];

/** 伤残津贴比例（1—6 级，按月支付） */
export const DISABILITY_PENSION_RATE = [0.9, 0.85, 0.8, 0.75, 0.7, 0.6];

/** 上一年度全国城镇居民人均可支配收入（用于一次性工亡补助金）。2025 年度 56,502 元（国家统计局 2026-01-19 发布） */
export const URBAN_INCOME_DEFAULT = 56502;

function monthsBetween(a: Date, b: Date): number {
  const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  return b.getDate() < a.getDate() ? months - 1 : months;
}

export const laborCalculators: CalculatorDef[] = [
  /* ── 经济补偿金 ── */
  {
    id: 'severance',
    name: '经济补偿金（N）',
    category: 'labor',
    glyph: '补',
    summary: '按工作年限与月平均工资计算解除/终止劳动合同的经济补偿',
    keywords: ['经济补偿金', 'N', '裁员', '解除劳动合同'],
    fields: [
      { key: 'startDate', label: '入职日期', type: 'date', defaultValue: '2018-03-01' },
      { key: 'endDate', label: '解除 / 终止日期', type: 'date', defaultValue: '2026-01-31' },
      { key: 'avgSalary', label: '离职前 12 个月平均工资', type: 'money', unit: '元', defaultValue: 15000, hint: '按应得工资计算，含奖金、津贴、补贴' },
      { key: 'localAvg', label: '当地上年度职工月平均工资', type: 'money', unit: '元', defaultValue: 12000, hint: '用于判断三倍封顶，填 0 表示不封顶' },
      {
        key: 'reason',
        label: '解除 / 终止情形',
        type: 'select',
        defaultValue: 'mutual',
        options: [
          { label: '协商一致解除（单位提出）', value: 'mutual' },
          { label: '单位依法裁员 / 无过失性辞退', value: 'layoff' },
          { label: '劳动合同期满终止', value: 'expire' },
          { label: '单位破产、吊销执照等', value: 'bankrupt' },
          { label: '劳动者主动辞职（无补偿）', value: 'resign' },
          { label: '单位违法解除（应适用 2N）', value: 'illegal' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const start = parseDate(values.startDate) ?? new Date();
      const end = parseDate(values.endDate) ?? new Date();
      const avg = toNum(values.avgSalary);
      const localAvg = toNum(values.localAvg);
      const reason = toStr(values.reason, 'mutual');

      const steps: StepRow[] = [];

      if (reason === 'resign') {
        return {
          main: { label: '经济补偿金', value: '0', unit: '元', sub: '劳动者主动辞职，用人单位无需支付经济补偿' },
          steps: [{ label: '结论', value: '《劳动合同法》第46条列举的情形之外，单位无需支付经济补偿' }],
          basis: [
            {
              law: '《劳动合同法》',
              article: '第四十六条',
              text: '有下列情形之一的，用人单位应当向劳动者支付经济补偿：（一）劳动者依照本法第三十八条规定解除劳动合同的；（二）用人单位依照本法第三十六条规定向劳动者提出解除劳动合同并与劳动者协商一致解除劳动合同的；……',
            },
          ],
          tips: [
            '例外：若单位存在未缴社保、未足额支付工资、未提供劳动条件等《劳动合同法》第38条情形，劳动者被迫解除仍可主张经济补偿。',
          ],
        };
      }

      const totalMonths = Math.max(0, monthsBetween(start, end));
      const years = Math.floor(totalMonths / 12);
      const restMonths = totalMonths % 12;

      steps.push({
        label: '工作年限',
        value: `${ymd(start)} 至 ${ymd(end)}，共 ${totalMonths} 个月（${years} 年 ${restMonths} 个月）`,
      });

      // 六个月以上不满一年按一年计算；不满六个月按半个月
      let n: number;
      if (restMonths === 0) {
        n = years;
        steps.push({ label: '折算补偿月数', value: `${years} 年 → ${n} 个月` });
      } else if (restMonths >= 6) {
        n = years + 1;
        steps.push({
          label: '折算补偿月数',
          value: `${years} 年 + 余 ${restMonths} 个月（六个月以上按一年算）= ${n} 个月`,
          note: '《劳动合同法》第47条',
        });
      } else {
        n = years + 0.5;
        steps.push({
          label: '折算补偿月数',
          value: `${years} 年 + 余 ${restMonths} 个月（不满六个月按半年算）= ${n} 个月`,
          note: '《劳动合同法》第47条',
        });
      }

      const cap3 = localAvg > 0 ? localAvg * 3 : Infinity;
      let usedSalary = avg;
      let capped = false;
      let cappedYears = false;

      if (localAvg > 0 && avg > cap3) {
        usedSalary = cap3;
        capped = true;
        steps.push({
          label: '月工资三倍封顶',
          value: `当地月均 ${money(localAvg)} × 3 = ${money(cap3)} 元，实际 ${money(avg)} 元 → 按 ${money(cap3)} 元计`,
          note: '《劳动合同法》第47条第2款',
          emphasis: true,
        });
      }

      if (capped && n > 12) {
        n = 12;
        cappedYears = true;
        steps.push({
          label: '年限封顶',
          value: '工资超三倍的，支付年限最高不超过 12 年 → 按 12 个月计',
          note: '《劳动合同法》第47条第2款',
          emphasis: true,
        });
      }

      const amount = round(usedSalary * n, 2);
      steps.push({ label: '经济补偿金', value: `${money(usedSalary)} × ${n} = ${money(amount)} 元`, emphasis: true });

      const isIllegal = reason === 'illegal';
      if (isIllegal) {
        steps.push({
          label: '⚠ 提示',
          value: '该情形应适用赔偿金（2N），请使用"违法解除赔偿金"计算器',
        });
      }

      return {
        main: { label: '经济补偿金（N）', value: money(amount), unit: '元', sub: moneyToChinese(amount) },
        blocks: [
          { label: '补偿月数', value: `${n} 个月` },
          { label: '计算基数月工资', value: money(usedSalary), unit: '元', sub: capped ? '已适用三倍封顶' : '未封顶' },
          { label: '是否年限封顶', value: cappedYears ? '是（12 年）' : '否' },
        ],
        steps,
        basis: [
          {
            law: '《劳动合同法》',
            article: '第四十七条',
            text: '经济补偿按劳动者在本单位工作的年限，每满一年支付一个月工资的标准向劳动者支付。六个月以上不满一年的，按一年计算；不满六个月的，向劳动者支付半个月工资的经济补偿。劳动者月工资高于用人单位所在直辖市、设区的市级人民政府公布的本地区上年度职工月平均工资三倍的，向其支付经济补偿的标准按职工月平均工资三倍的数额支付，向其支付经济补偿的年限最高不超过十二年。',
          },
          {
            law: '《劳动合同法实施条例》',
            article: '第二十七条',
            text: '经济补偿的月工资按照劳动者应得工资计算，包括计时工资或者计件工资以及奖金、津贴和补贴等货币性收入。劳动者工作不满12个月的，按照实际工作的月数计算平均工资。',
          },
        ],
        tips: [
          '月工资基数按"应得工资"计算，含奖金、津贴、补贴和加班工资，不是基本工资，也不是实发工资。',
          '2008 年 1 月 1 日前后经济补偿规则不同，涉老案工龄需分段适用当时规定，本工具按现行统一规则计算。',
          '劳动者非因本人原因被安排到新单位的，原单位工作年限合并计算。',
        ],
      };
    },
  },

  /* ── 违法解除赔偿金 ── */
  {
    id: 'illegal-termination',
    name: '违法解除赔偿金（2N）',
    category: 'labor',
    glyph: '赔',
    summary: '单位违法解除或终止劳动合同的二倍赔偿金',
    keywords: ['赔偿金', '2N', '违法解除', '违法辞退'],
    fields: [
      { key: 'startDate', label: '入职日期', type: 'date', defaultValue: '2018-03-01' },
      { key: 'endDate', label: '违法解除日期', type: 'date', defaultValue: '2026-01-31' },
      { key: 'avgSalary', label: '离职前 12 个月平均工资', type: 'money', unit: '元', defaultValue: 15000 },
      { key: 'localAvg', label: '当地上年度职工月平均工资', type: 'money', unit: '元', defaultValue: 12000 },
      {
        key: 'remedy',
        label: '劳动者诉求',
        type: 'select',
        defaultValue: 'compensation',
        options: [
          { label: '要求支付赔偿金（2N，不要求继续履行）', value: 'compensation' },
          { label: '要求继续履行劳动合同', value: 'reinstate' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const start = parseDate(values.startDate) ?? new Date();
      const end = parseDate(values.endDate) ?? new Date();
      const avg = toNum(values.avgSalary);
      const localAvg = toNum(values.localAvg);
      const remedy = toStr(values.remedy, 'compensation');

      const steps: StepRow[] = [];
      const totalMonths = Math.max(0, monthsBetween(start, end));
      const years = Math.floor(totalMonths / 12);
      const restMonths = totalMonths % 12;
      steps.push({ label: '工作年限', value: `${totalMonths} 个月（${years} 年 ${restMonths} 个月）` });

      let n = restMonths === 0 ? years : restMonths >= 6 ? years + 1 : years + 0.5;
      steps.push({ label: '经济补偿月数 N', value: `${n} 个月` });

      const cap3 = localAvg > 0 ? localAvg * 3 : Infinity;
      let usedSalary = avg;
      if (localAvg > 0 && avg > cap3) {
        usedSalary = cap3;
        if (n > 12) n = 12;
        steps.push({ label: '三倍封顶 + 12 年年限封顶', value: `月工资按 ${money(cap3)} 元，N 按 ${n} 个月`, emphasis: true });
      }

      const economic = round(usedSalary * n, 2);
      steps.push({ label: '经济补偿（N）', value: `${money(usedSalary)} × ${n} = ${money(economic)} 元` });

      if (remedy === 'reinstate') {
        const wageLoss = round(avg * totalMonths * 0 + avg * n, 2);
        steps.push({
          label: '选择继续履行',
          value: '法院判决继续履行的，单位应补发违法解除决定作出至恢复劳动关系期间的工资损失',
          note: '《劳动合同法》第48条',
          emphasis: true,
        });
        steps.push({ label: '参考工资损失（按 N 个月估算）', value: `${money(wageLoss)} 元`, note: '实际以诉讼周期长短为准，通常远高于 N 个月' });
        return {
          main: { label: '继续履行方案', value: '恢复劳动关系', sub: `另可主张工资损失（参考 ${money(wageLoss)} 元）` },
          blocks: [
            { label: '对比：赔偿金方案（2N）', value: money(round(economic * 2, 2)), unit: '元' },
            { label: '工资损失估算', value: money(wageLoss), unit: '元' },
          ],
          steps,
          basis: [
            {
              law: '《劳动合同法》',
              article: '第四十八条',
              text: '用人单位违反本法规定解除或者终止劳动合同，劳动者要求继续履行劳动合同的，用人单位应当继续履行；劳动者不要求继续履行劳动合同或者劳动合同已经不能继续履行的，用人单位应当依照本法第八十七条规定支付赔偿金。',
            },
          ],
          tips: [
            '选择权在劳动者：继续履行与赔偿金二选一，不能同时主张。',
            '诉讼周期越长，继续履行方案下的工资损失越大，长周期案件中继续履行往往更有利。',
            '岗位已被替代、信任基础丧失的，法院可能认定"劳动合同已不能继续履行"，转而判赔赔偿金。',
          ],
        };
      }

      const compensation = round(economic * 2, 2);
      steps.push({ label: '赔偿金（2N）', value: `${money(economic)} × 2 = ${money(compensation)} 元`, emphasis: true });

      return {
        main: { label: '违法解除赔偿金（2N）', value: money(compensation), unit: '元', sub: moneyToChinese(compensation) },
        blocks: [
          { label: '经济补偿（N）', value: money(economic), unit: '元' },
          { label: '赔偿倍数', value: '2 倍' },
          { label: '计算基数', value: money(usedSalary), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《劳动合同法》',
            article: '第八十七条',
            text: '用人单位违反本法规定解除或者终止劳动合同的，应当依照本法第四十七条规定的经济补偿标准的二倍向劳动者支付赔偿金。',
          },
        ],
        tips: [
          '赔偿金的计算基数是"经济补偿金"，再乘二倍，即 2N，不是 N+1。',
          '"N+1"中的 +1 是未提前 30 日书面通知的代通知金，仅适用于《劳动合同法》第40条的无过失性辞退，不适用于违法解除。',
          '违法解除常见情形：无证据辞退、辞退三期女职工、辞退工伤职工、未走工会程序等。',
        ],
      };
    },
  },

  /* ── 加班费 ── */
  {
    id: 'overtime-pay',
    name: '加班费',
    category: 'labor',
    glyph: '加',
    summary: '工作日 / 休息日 / 法定节假日三类加班工资计算',
    keywords: ['加班费', '150%', '200%', '300%', '法定节假日'],
    fields: [
      { key: 'monthlySalary', label: '月工资（加班费计算基数）', type: 'money', unit: '元', defaultValue: 10000, hint: '不得低于当地最低工资标准；有约定的从约定' },
      { key: 'weekdayHours', label: '工作日延时加班小时数', type: 'number', unit: '小时', defaultValue: 40 },
      { key: 'restDayHours', label: '休息日加班小时数', type: 'number', unit: '小时', defaultValue: 16 },
      {
        key: 'restDayComp',
        label: '休息日是否已安排补休',
        type: 'switch',
        defaultValue: false,
        hint: '已安排补休的可不支付 200% 加班费',
      },
      { key: 'holidayHours', label: '法定节假日加班小时数', type: 'number', unit: '小时', defaultValue: 8 },
      {
        key: 'months',
        label: '追索月数',
        type: 'number',
        unit: '月',
        defaultValue: 12,
        hint: '加班费仲裁时效为一年，通常按 12 个月追索',
      },
    ],
    calc(values): CalcOutput {
      const monthly = toNum(values.monthlySalary);
      const wd = toNum(values.weekdayHours);
      const rd = toNum(values.restDayHours);
      const hd = toNum(values.holidayHours);
      const months = Math.max(1, toNum(values.months));
      const compensated = values.restDayComp === true || values.restDayComp === 'true';

      const daily = round(monthly / MONTH_WORK_DAYS, 2);
      const hourly = round(daily / 8, 2);

      const steps: StepRow[] = [
        { label: '日工资', value: `${money(monthly)} ÷ 21.75 = ${money(daily)} 元`, note: '月计薪天数 21.75 天' },
        { label: '小时工资', value: `${money(daily)} ÷ 8 = ${money(hourly)} 元` },
      ];

      const wdPay = round(hourly * wd * 1.5, 2);
      steps.push({ label: '工作日延时加班（150%）', value: `${money(hourly)} × ${wd} 小时 × 150% = ${money(wdPay)} 元`, note: '《劳动法》第44条第（一）项' });

      let rdPay = 0;
      if (compensated) {
        steps.push({ label: '休息日加班（200%）', value: '已安排补休，无需支付', note: '《劳动法》第44条第（二）项' });
      } else {
        rdPay = round(hourly * rd * 2, 2);
        steps.push({ label: '休息日加班（200%）', value: `${money(hourly)} × ${rd} 小时 × 200% = ${money(rdPay)} 元`, note: '《劳动法》第44条第（二）项' });
      }

      const hdPay = round(hourly * hd * 3, 2);
      steps.push({ label: '法定节假日加班（300%）', value: `${money(hourly)} × ${hd} 小时 × 300% = ${money(hdPay)} 元`, note: '《劳动法》第44条第（三）项，不可用补休替代' });

      const monthTotal = round(wdPay + rdPay + hdPay, 2);
      steps.push({ label: '单月加班费合计', value: `${money(monthTotal)} 元`, emphasis: true });

      const total = round(monthTotal * months, 2);
      steps.push({ label: `追索 ${months} 个月`, value: `${money(monthTotal)} × ${months} = ${money(total)} 元`, emphasis: true });

      return {
        main: { label: '加班费总额', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '小时工资基数', value: money(hourly), unit: '元' },
          { label: '工作日加班费', value: money(wdPay), unit: '元' },
          { label: '休息日加班费', value: money(rdPay), unit: '元' },
          { label: '法定节假日加班费', value: money(hdPay), unit: '元' },
          { label: '单月合计', value: money(monthTotal), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《劳动法》',
            article: '第四十四条',
            text: '有下列情形之一的，用人单位应当按照下列标准支付高于劳动者正常工作时间工资的工资报酬：（一）安排劳动者延长工作时间的，支付不低于工资的百分之一百五十的工资报酬；（二）休息日安排劳动者工作又不能安排补休的，支付不低于工资的百分之二百的工资报酬；（三）法定休假日安排劳动者工作的，支付不低于工资的百分之三百的工资报酬。',
          },
          {
            law: '《关于职工全年月平均工作时间和工资折算问题的通知》',
            text: '月计薪天数＝（365天－104天）÷12月＝21.75天。',
          },
        ],
        tips: [
          '法定节假日加班费不可用补休替代，必须支付 300%；休息日加班则可以优先安排补休。',
          '加班费计算基数有约定的从约定，但不得低于当地最低工资标准；无约定的通常按正常工作时间工资确定。',
          '加班事实的举证责任原则上由劳动者承担，但用人单位保有的考勤记录、工资表应由单位提供，拒不提供可采信劳动者主张。',
        ],
      };
    },
  },

  /* ── 未休年休假工资 ── */
  {
    id: 'annual-leave-pay',
    name: '未休年休假工资',
    category: 'labor',
    glyph: '假',
    summary: '按 300% 日工资计算应休未休年休假的工资报酬（另付 200%）',
    keywords: ['年休假', '未休年假', '300%', '带薪休假'],
    fields: [
      {
        key: 'workYears',
        label: '累计工作年限',
        type: 'number',
        unit: '年',
        defaultValue: 8,
        hint: '含在其他单位的工作年限，非仅本单位',
      },
      { key: 'monthlySalary', label: '月工资（剔除加班费）', type: 'money', unit: '元', defaultValue: 12000 },
      { key: 'entitled', label: '本年度应休天数', type: 'number', unit: '天', defaultValue: 5, hint: '系统自动按工龄预填，可手动调整' },
      { key: 'taken', label: '已休天数', type: 'number', unit: '天', defaultValue: 0 },
      {
        key: 'years',
        label: '追索年数',
        type: 'number',
        unit: '年',
        defaultValue: 2,
        hint: '实务中一般支持追索两年',
      },
    ],
    calc(values): CalcOutput {
      const wy = toNum(values.workYears);
      const monthly = toNum(values.monthlySalary);
      const entitled = toNum(values.entitled);
      const taken = toNum(values.taken);
      const years = Math.max(1, toNum(values.years));

      const statutory = wy >= 20 ? 15 : wy >= 10 ? 10 : wy >= 1 ? 5 : 0;
      const daily = round(monthly / MONTH_WORK_DAYS, 2);
      const untaken = Math.max(0, entitled - taken);

      const steps: StepRow[] = [
        { label: '法定年休假天数', value: statutory > 0 ? `${statutory} 天` : '0 天（累计工作不满 1 年）', note: wy >= 20 ? '累计工作满 20 年' : wy >= 10 ? '满 10 年不满 20 年' : '满 1 年不满 10 年' },
        { label: '应休未休天数', value: `${entitled} − ${taken} = ${untaken} 天` },
        { label: '日工资', value: `${money(monthly)} ÷ 21.75 = ${money(daily)} 元` },
      ];

      const total300 = round(daily * untaken * 3, 2);
      const extra200 = round(daily * untaken * 2, 2);
      steps.push({
        label: '300% 工资报酬',
        value: `${money(daily)} × ${untaken} 天 × 300% = ${money(total300)} 元`,
        note: '《职工带薪年休假条例》第5条',
        emphasis: true,
      });
      steps.push({
        label: '其中需另行支付部分',
        value: `${money(extra200)} 元`,
        note: '300% 中已包含正常工作期间的一倍工资，实际另行支付 200%',
        emphasis: true,
      });

      const multi = round(extra200 * years, 2);
      if (years > 1) steps.push({ label: `追索 ${years} 年`, value: `${money(extra200)} × ${years} = ${money(multi)} 元`, emphasis: true });

      return {
        main: {
          label: `应另行支付的未休年假工资（${years > 1 ? years + ' 年' : '本年度'}）`,
          value: money(years > 1 ? multi : extra200),
          unit: '元',
          sub: moneyToChinese(years > 1 ? multi : extra200),
        },
        blocks: [
          { label: '法定应休天数', value: `${statutory} 天` },
          { label: '未休天数', value: `${untaken} 天` },
          { label: '日工资', value: money(daily), unit: '元' },
          { label: '本年度 300% 总额', value: money(total300), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《职工带薪年休假条例》',
            article: '第三条',
            text: '职工累计工作已满1年不满10年的，年休假5天；已满10年不满20年的，年休假10天；已满20年的，年休假15天。',
          },
          {
            law: '《职工带薪年休假条例》',
            article: '第五条',
            text: '单位因工作需要不能安排职工休年休假的，经职工本人同意，可以不安排休年休假。对职工应休未休的年休假天数，单位应当按照该职工日工资收入的300%支付年休假工资报酬。',
          },
          {
            law: '《企业职工带薪年休假实施办法》',
            article: '第十条',
            text: '用人单位经职工同意不安排年休假或者安排职工年休假天数少于应休天数，应当在本年度内对职工应休未休年休假天数，按照其日工资收入的300%支付未休年休假工资报酬，其中包含用人单位支付职工正常工作期间的工资收入。',
          },
        ],
        tips: [
          '计算基数应剔除加班工资，按前 12 个月平均月工资除以 21.75 折算日工资。',
          '最易踩的坑：300% 中包含已发的正常工资，实际只需另行支付 200%，主张时应明确是"差额"。',
          '年休假天数按"累计工作年限"计算，包含在其他单位的工作年限，不限于本单位。',
        ],
      };
    },
  },

  /* ── 未签劳动合同二倍工资 ── */
  {
    id: 'double-wage',
    name: '未签劳动合同二倍工资',
    category: 'labor',
    glyph: '双',
    summary: '用工满一个月未签书面合同的二倍工资差额',
    keywords: ['二倍工资', '未签合同', '书面劳动合同', '第82条'],
    fields: [
      { key: 'startDate', label: '用工之日', type: 'date', defaultValue: '2025-01-01' },
      { key: 'signDate', label: '补签书面合同之日', type: 'date', defaultValue: '2025-08-01', hint: '至今未签的填计算截止日' },
      { key: 'monthlySalary', label: '月工资', type: 'money', unit: '元', defaultValue: 12000 },
      {
        key: 'status',
        label: '合同签订状态',
        type: 'select',
        defaultValue: 'unsigned',
        options: [
          { label: '至今未签', value: 'unsigned' },
          { label: '已补签', value: 'signed' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const start = parseDate(values.startDate) ?? new Date();
      const sign = parseDate(values.signDate) ?? new Date();
      const salary = toNum(values.monthlySalary);
      const status = toStr(values.status, 'unsigned');

      const graceEnd = new Date(start.getFullYear(), start.getMonth() + 1, start.getDate()); // 满一个月
      const capDate = new Date(start.getFullYear(), start.getMonth() + 12, start.getDate()); // 满一年

      const steps: StepRow[] = [
        { label: '用工之日', value: ymd(start) },
        { label: '一个月宽限期届满', value: ymd(graceEnd), note: '《劳动合同法》第10条：已建立劳动关系，应自用工之日起一个月内订立书面合同' },
        { label: '视为订立无固定期限合同之日', value: ymd(capDate), note: '《劳动合同法》第14条第3款：用工满一年不签，视为已订立无固定期限劳动合同' },
      ];

      const end = status === 'signed' ? (sign < capDate ? sign : capDate) : capDate;
      const m = Math.max(0, monthsBetween(graceEnd, end));
      const eligible = Math.min(m, 11);

      steps.push({
        label: '可主张期间',
        value: `${ymd(graceEnd)} 至 ${ymd(end)}，共 ${eligible} 个月`,
        note: status === 'unsigned' ? '未签状态最长计算至满一年（11 个月）' : '计算至补签日',
        emphasis: true,
      });

      const diff = round(salary * eligible, 2);
      steps.push({
        label: '二倍工资差额',
        value: `${money(salary)} × ${eligible} 个月 = ${money(diff)} 元`,
        note: '二倍工资指"再付一倍"，即差额为月工资 × 月数',
        emphasis: true,
      });

      return {
        main: { label: '二倍工资差额', value: money(diff), unit: '元', sub: moneyToChinese(diff) },
        blocks: [
          { label: '可主张月数', value: `${eligible} 个月`, sub: '法定最长 11 个月' },
          { label: '月工资基数', value: money(salary), unit: '元' },
          { label: '是否已超最长期间', value: eligible >= 11 ? '是（已达 11 个月上限）' : '否' },
        ],
        steps,
        basis: [
          {
            law: '《劳动合同法》',
            article: '第八十二条',
            text: '用人单位自用工之日起超过一个月不满一年未与劳动者订立书面劳动合同的，应当向劳动者每月支付二倍的工资。',
          },
          {
            law: '《劳动合同法实施条例》',
            article: '第七条',
            text: '用人单位自用工之日起满一年未与劳动者订立书面劳动合同的，自用工之日起满一个月的次日至满一年的前一日应当依照劳动合同法第八十二条的规定向劳动者每月支付两倍的工资，并视为自用工之日起满一年的当日已经与劳动者订立无固定期限劳动合同。',
          },
        ],
        tips: [
          '二倍工资的仲裁时效为一年，从"应当订立书面劳动合同期满之日的次日"起算，逾期主张存在被驳回风险，各地裁判口径有差异。',
          '月工资基数有争议时，一般按劳动者应得月工资确定，包含奖金、津贴。',
          '倒签劳动合同（把签约日期倒签至用工之日）能否免责，各地裁判不一，但多数法院对真实补签持宽容态度。',
        ],
      };
    },
  },

  /* ── 工伤伤残赔偿 ── */
  {
    id: 'work-injury',
    name: '工伤伤残赔偿',
    category: 'labor',
    glyph: '伤',
    summary: '1—10 级伤残的一次性伤残补助金、伤残津贴及两项一次性补助金',
    keywords: ['工伤', '伤残', '一次性伤残补助金', '伤残津贴'],
    fields: [
      {
        key: 'level',
        label: '伤残等级',
        type: 'select',
        defaultValue: '9',
        options: Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1} 级`, value: String(i + 1) })),
      },
      { key: 'salary', label: '本人工资（月缴费工资）', type: 'money', unit: '元', defaultValue: 10000, hint: '工伤前 12 个月平均月缴费工资' },
      { key: 'localAvg', label: '统筹地区职工月平均工资', type: 'money', unit: '元', defaultValue: 9000, hint: '用于 60%—300% 的保底封顶，填 0 跳过' },
      {
        key: 'terminate',
        label: '是否解除 / 终止劳动关系',
        type: 'switch',
        defaultValue: true,
        hint: '5—10 级解除或终止合同时，可主张一次性工伤医疗补助金和伤残就业补助金',
      },
      {
        key: 'medicalMonths',
        label: '一次性工伤医疗补助金（月数）',
        type: 'number',
        unit: '月',
        defaultValue: 6,
        hint: '由省级政府规定，请按当地标准填写',
        visibleWhen: (v) => (v.terminate === true || v.terminate === 'true') && Number(toStr(v.level)) >= 5,
      },
      {
        key: 'employmentMonths',
        label: '一次性伤残就业补助金（月数）',
        type: 'number',
        unit: '月',
        defaultValue: 8,
        hint: '由省级政府规定，请按当地标准填写',
        visibleWhen: (v) => (v.terminate === true || v.terminate === 'true') && Number(toStr(v.level)) >= 5,
      },
      {
        key: 'medicalCare',
        label: '医疗费、康复费等已支出费用',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '符合工伤保险目录的由基金支付',
      },
    ],
    calc(values): CalcOutput {
      const level = Math.max(1, Math.min(10, Math.round(toNum(values.level, 9))));
      let salary = toNum(values.salary);
      const localAvg = toNum(values.localAvg);
      const terminate = values.terminate === true || values.terminate === 'true';
      const medicalMonths = toNum(values.medicalMonths);
      const employmentMonths = toNum(values.employmentMonths);
      const medicalCare = toNum(values.medicalCare);

      const steps: StepRow[] = [];

      if (localAvg > 0) {
        const low = localAvg * 0.6;
        const high = localAvg * 3;
        if (salary < low) {
          steps.push({ label: '本人工资低于统筹地区 60%', value: `按 ${money(low)} 元计`, note: '《工伤保险条例》第64条' });
          salary = low;
        } else if (salary > high) {
          steps.push({ label: '本人工资高于统筹地区 300%', value: `按 ${money(high)} 元计`, note: '《工伤保险条例》第64条' });
          salary = high;
        } else {
          steps.push({ label: '本人工资', value: `${money(salary)} 元`, note: '在 60%—300% 区间内，据实计算' });
        }
      } else {
        steps.push({ label: '本人工资', value: `${money(salary)} 元` });
      }

      const grantMonths = DISABILITY_GRANT_MONTHS[level - 1];
      const grant = round(salary * grantMonths, 2);
      steps.push({
        label: `一次性伤残补助金（${level} 级 = ${grantMonths} 个月）`,
        value: `${money(salary)} × ${grantMonths} = ${money(grant)} 元`,
        note: '《工伤保险条例》第35—37条，由工伤保险基金支付',
        emphasis: true,
      });

      let pensionMonthly = 0;
      if (level <= 6) {
        const rate = DISABILITY_PENSION_RATE[level - 1];
        pensionMonthly = round(salary * rate, 2);
        steps.push({
          label: `伤残津贴（${level} 级 = ${rate * 100}%）`,
          value: `每月 ${money(pensionMonthly)} 元`,
          note: level <= 4 ? '保留劳动关系、退出工作岗位，由基金按月支付' : '单位难以安排工作的，由单位按月支付',
        });
      }

      let medicalGrant = 0;
      let employmentGrant = 0;
      if (terminate && level >= 5) {
        medicalGrant = round(salary * medicalMonths, 2);
        employmentGrant = round(salary * employmentMonths, 2);
        steps.push({
          label: `一次性工伤医疗补助金（${medicalMonths} 个月）`,
          value: `${money(salary)} × ${medicalMonths} = ${money(medicalGrant)} 元`,
          note: '由工伤保险基金支付，标准由省级政府规定',
        });
        steps.push({
          label: `一次性伤残就业补助金（${employmentMonths} 个月）`,
          value: `${money(salary)} × ${employmentMonths} = ${money(employmentGrant)} 元`,
          note: '由用人单位支付，标准由省级政府规定',
        });
      }

      const lumpSum = round(grant + medicalGrant + employmentGrant + medicalCare, 2);
      steps.push({
        label: '一次性项目合计',
        value: `${money(lumpSum)} 元`,
        emphasis: true,
        note: medicalCare > 0 ? '含已支出的医疗费、康复费' : '',
      });

      const blocks: ResultBlock[] = [
        { label: '一次性伤残补助金', value: money(grant), unit: '元' },
        { label: '一次性工伤医疗补助金', value: money(medicalGrant), unit: '元' },
        { label: '一次性伤残就业补助金', value: money(employmentGrant), unit: '元' },
      ];
      if (pensionMonthly > 0) {
        blocks.push({ label: '伤残津贴（按月）', value: money(pensionMonthly), unit: '元/月' });
      }
      if (medicalCare > 0) blocks.push({ label: '医疗康复费', value: money(medicalCare), unit: '元' });

      return {
        main: { label: '一次性赔偿合计', value: money(lumpSum), unit: '元', sub: moneyToChinese(lumpSum) },
        blocks,
        steps,
        basis: [
          {
            law: '《工伤保险条例》',
            article: '第三十五条至第三十七条',
            text: '职工因工致残被鉴定为一级至十级伤残的，从工伤保险基金按伤残等级支付一次性伤残补助金，标准为：一级27个月、二级25个月、三级23个月、四级21个月、五级18个月、六级16个月、七级13个月、八级11个月、九级9个月、十级7个月的本人工资。',
          },
          {
            law: '《工伤保险条例》',
            article: '第六十四条',
            text: '本人工资高于统筹地区职工平均工资300%的，按照统筹地区职工平均工资的300%计算；本人工资低于统筹地区职工平均工资60%的，按照统筹地区职工平均工资的60%计算。',
          },
        ],
        tips: [
          '一次性工伤医疗补助金与一次性伤残就业补助金的具体月数由各省、自治区、直辖市人民政府规定，务必查询当地实施办法。',
          '用人单位未缴纳工伤保险的，全部工伤保险待遇由用人单位支付，这是实务中最常见的高额索赔来源。',
          '伤残津贴实际金额低于当地最低工资标准的，由工伤保险基金补足差额。',
          '工伤认定申请时效：单位 30 日内提出，职工方 1 年内提出，切勿逾期。',
        ],
      };
    },
  },

  /* ── 工亡赔偿 ── */
  {
    id: 'work-death',
    name: '工亡赔偿',
    category: 'labor',
    glyph: '亡',
    summary: '丧葬补助金、供养亲属抚恤金与一次性工亡补助金',
    keywords: ['工亡', '一次性工亡补助金', '抚恤金', '丧葬补助金'],
    fields: [
      { key: 'localAvg', label: '统筹地区上年度职工月平均工资', type: 'money', unit: '元', defaultValue: 9000 },
      {
        key: 'urbanIncome',
        label: '上一年度全国城镇居民人均可支配收入',
        type: 'money',
        unit: '元',
        defaultValue: URBAN_INCOME_DEFAULT,
        hint: '国家统计局公布，用于一次性工亡补助金（×20）',
      },
      { key: 'deceasedSalary', label: '工亡职工生前月工资', type: 'money', unit: '元', defaultValue: 10000 },
      {
        key: 'dependents',
        label: '供养亲属人数',
        type: 'number',
        unit: '人',
        defaultValue: 2,
        hint: '含配偶、父母、子女等符合条件的亲属',
      },
      {
        key: 'hasSpouse',
        label: '是否含配偶',
        type: 'switch',
        defaultValue: true,
        hint: '配偶每月 40%，其他亲属每人每月 30%',
      },
      {
        key: 'isOrphan',
        label: '是否含孤寡老人或孤儿',
        type: 'switch',
        defaultValue: false,
        hint: '每人每月在上述标准基础上增加 10%',
      },
    ],
    calc(values): CalcOutput {
      const localAvg = toNum(values.localAvg);
      const urban = toNum(values.urbanIncome);
      const salary = toNum(values.deceasedSalary);
      const dependents = Math.max(0, Math.round(toNum(values.dependents)));
      const hasSpouse = values.hasSpouse === true || values.hasSpouse === 'true';
      const isOrphan = values.isOrphan === true || values.isOrphan === 'true';

      const funeral = round(localAvg * 6, 2);
      const lumpSum = round(urban * 20, 2);

      const steps: StepRow[] = [
        {
          label: '丧葬补助金',
          value: `${money(localAvg)} × 6 = ${money(funeral)} 元`,
          note: '《工伤保险条例》第39条第（一）项，6 个月统筹地区上年度职工月平均工资',
        },
        {
          label: '一次性工亡补助金',
          value: `${money(urban)} × 20 = ${money(lumpSum)} 元`,
          note: '《工伤保险条例》第39条第（三）项，上一年度全国城镇居民人均可支配收入的 20 倍',
          emphasis: true,
        },
      ];

      const others = Math.max(0, dependents - (hasSpouse ? 1 : 0));
      let monthlyRate = 0;
      if (hasSpouse) monthlyRate += 0.4 + (isOrphan ? 0.1 : 0);
      monthlyRate += others * (0.3 + (isOrphan ? 0.1 : 0));

      let pensionMonthly = round(salary * monthlyRate, 2);
      const capped = pensionMonthly > salary;
      if (capped) pensionMonthly = salary;

      steps.push({
        label: '供养亲属构成',
        value: (hasSpouse ? `配偶 1 人（${(40 + (isOrphan ? 10 : 0)).toFixed(0)}%）` : '无配偶') + (others > 0 ? ` + 其他亲属 ${others} 人（每人 ${(30 + (isOrphan ? 10 : 0)).toFixed(0)}%）` : ''),
      });
      steps.push({
        label: '抚恤金合计比例',
        value: `${(monthlyRate * 100).toFixed(0)}%`,
        note: capped ? '⚠ 已超过生前工资，按生前工资总额封顶' : '',
      });
      steps.push({
        label: '供养亲属抚恤金（按月）',
        value: `${money(salary)} × ${(monthlyRate * 100).toFixed(0)}% = ${money(pensionMonthly)} 元/月`,
        note: capped ? '《工伤保险条例》第39条第（二）项：核定的各供养亲属抚恤金之和不应高于工亡职工生前工资' : '《工伤保险条例》第39条第（二）项',
        emphasis: true,
      });

      const total = round(funeral + lumpSum, 2);
      steps.push({ label: '一次性赔偿合计', value: `${money(total)} 元`, emphasis: true });

      return {
        main: { label: '一次性工亡赔偿合计', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '丧葬补助金', value: money(funeral), unit: '元' },
          { label: '一次性工亡补助金', value: money(lumpSum), unit: '元' },
          { label: '供养亲属抚恤金', value: money(pensionMonthly), unit: '元/月', sub: capped ? '已按生前工资封顶' : `占生前工资 ${(monthlyRate * 100).toFixed(0)}%` },
          { label: '抚恤金年度金额', value: money(round(pensionMonthly * 12, 2)), unit: '元/年' },
        ],
        steps,
        basis: [
          {
            law: '《工伤保险条例》',
            article: '第三十九条',
            text: '职工因工死亡，其近亲属按照下列规定从工伤保险基金领取丧葬补助金、供养亲属抚恤金和一次性工亡补助金：（一）丧葬补助金为6个月的统筹地区上年度职工月平均工资；（二）供养亲属抚恤金按照职工本人工资的一定比例发给由因工死亡职工生前提供主要生活来源、无劳动能力的亲属。标准为：配偶每月40%，其他亲属每人每月30%，孤寡老人或者孤儿每人每月在上述标准的基础上增加10%。核定的各供养亲属的抚恤金之和不应高于因工死亡职工生前的工资；（三）一次性工亡补助金标准为上一年度全国城镇居民人均可支配收入的20倍。',
          },
        ],
        tips: [
          '一次性工亡补助金全国统一标准，不因地区而异，每年随国家统计局公布的城镇居民人均可支配收入调整。',
          '供养亲属抚恤金总额不得超过工亡职工生前工资，亲属人数多时会自动触顶。',
          '伤残职工在停工留薪期内因工伤导致死亡的，其近亲属同样享受上述全部待遇。',
        ],
      };
    },
  },

  /* ── 竞业限制补偿金 ── */
  {
    id: 'non-compete',
    name: '竞业限制补偿金',
    category: 'labor',
    glyph: '竞',
    summary: '竞业限制期内的月度补偿金与总额，含最低标准校验',
    keywords: ['竞业限制', '竞业禁止', '补偿金', '保密协议'],
    fields: [
      { key: 'avgSalary', label: '离职前 12 个月平均工资', type: 'money', unit: '元', defaultValue: 20000 },
      { key: 'months', label: '竞业限制期限', type: 'number', unit: '月', defaultValue: 24, hint: '法定最长不超过 2 年' },
      {
        key: 'agreed',
        label: '是否约定了补偿标准',
        type: 'switch',
        defaultValue: false,
      },
      {
        key: 'monthlyAmount',
        label: '约定的月补偿金额',
        type: 'money',
        unit: '元',
        defaultValue: 6000,
        visibleWhen: (v) => v.agreed === true || v.agreed === 'true',
      },
      { key: 'minWage', label: '劳动合同履行地最低工资标准', type: 'money', unit: '元', defaultValue: 2500 },
    ],
    calc(values): CalcOutput {
      const avg = toNum(values.avgSalary);
      let months = toNum(values.months);
      const agreed = values.agreed === true || values.agreed === 'true';
      const monthlyAmount = toNum(values.monthlyAmount);
      const minWage = toNum(values.minWage);

      const steps: StepRow[] = [];
      if (months > 24) {
        steps.push({ label: '期限超限', value: '约定的 24 个月以上部分无效，按 24 个月计', note: '《劳动合同法》第24条', emphasis: true });
        months = 24;
      }

      const statutoryMonthly = round(avg * 0.3, 2);
      steps.push({
        label: '法定参考标准（前 12 个月平均工资 30%）',
        value: `${money(avg)} × 30% = ${money(statutoryMonthly)} 元/月`,
        note: '《劳动争议司法解释（一）》相关规定：未约定补偿标准的，可按此主张',
      });

      let monthly = agreed ? monthlyAmount : statutoryMonthly;
      steps.push({ label: '适用月补偿标准', value: `${money(monthly)} 元/月`, emphasis: true });

      if (monthly < minWage) {
        steps.push({
          label: '低于最低工资标准',
          value: `不足 ${money(minWage)} 元，应补足至最低工资`,
          note: '补偿标准不得低于劳动合同履行地最低工资',
          emphasis: true,
        });
        monthly = minWage;
      }

      const total = round(monthly * months, 2);
      steps.push({ label: '补偿金总额', value: `${money(monthly)} × ${months} 个月 = ${money(total)} 元`, emphasis: true });

      const ratio = round((monthly / Math.max(avg, 1)) * 100, 2);
      return {
        main: { label: '竞业限制补偿金总额', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '月补偿标准', value: money(monthly), unit: '元/月' },
          { label: '占离职前工资比例', value: `${ratio}%`, sub: ratio < 30 ? '⚠ 低于 30% 参考线' : '不低于 30% 参考线' },
          { label: '竞业期限', value: `${months} 个月` },
        ],
        steps,
        basis: [
          {
            law: '《劳动合同法》',
            article: '第二十三条',
            text: '用人单位与劳动者可以在劳动合同中约定保守用人单位的商业秘密和与知识产权相关的保密事项。对负有保密义务的劳动者，用人单位可以在劳动合同或者保密协议中与劳动者约定竞业限制条款，并约定在解除或者终止劳动合同后，在竞业限制期限内按月给予劳动者经济补偿。',
          },
          {
            law: '《劳动合同法》',
            article: '第二十四条',
            text: '竞业限制期限不得超过二年。',
          },
        ],
        tips: [
          '用人单位未按月支付补偿金达 3 个月，劳动者可请求解除竞业限制约定，实务中法院普遍支持。',
          '竞业限制补偿金应在解除或终止劳动合同后"按月"支付，约定在职期间工资已包含的，一般不被认可。',
          '劳动者违反竞业限制约定的，应返还已领取的补偿金并按约定支付违约金，违约金过高可请求调减。',
        ],
      };
    },
  },
];
