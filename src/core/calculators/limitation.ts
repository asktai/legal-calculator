/**
 * 四、时效与期限类计算器
 * 依据：《民法典》第188条—第204条
 *      《民事诉讼法》关于上诉期限、申请再审期限、申请执行期间的规定
 *      《劳动争议调解仲裁法》第27条
 *
 * 注：民事诉讼法的条文序号随历次修正变动较大，本文件引用的是条文内容；
 *     条文序号以 2021 年修正文本为参考，使用时请对照现行版本核对。
 */
import type { CalculatorDef, CalcOutput, StepRow } from '../types';
import { toNum, toStr } from '../format';
import { parseDate, ymd, weekdayCn, calcPeriod, isHoliday, addDays } from '../dateUtils';

export const limitationCalculators: CalculatorDef[] = [
  /* ── 诉讼时效 ── */
  {
    id: 'limitation-period',
    name: '诉讼时效届满日',
    category: 'limitation',
    glyph: '效',
    summary: '三年普通时效的起算、中断、中止与二十年最长保护期',
    keywords: ['诉讼时效', '三年', '二十年', '中断', '中止'],
    fields: [
      {
        key: 'type',
        label: '时效类型',
        type: 'select',
        defaultValue: 'general',
        options: [
          { label: '普通诉讼时效（3 年）', value: 'general' },
          { label: '分期履行债务（自最后一期届满起算）', value: 'installment' },
          { label: '国际货物买卖 / 技术进出口合同（4 年）', value: 'intl' },
          { label: '海上货物运输赔偿（1 年）', value: 'maritime' },
          { label: '环境污染损害赔偿（3 年，另有特别规定）', value: 'env' },
        ],
      },
      { key: 'startDate', label: '知道或应当知道权利受损之日', type: 'date', defaultValue: '2023-06-01' },
      {
        key: 'damageDate',
        label: '权利实际受到损害之日',
        type: 'date',
        defaultValue: '2023-01-01',
        hint: '用于二十年最长保护期的判断',
      },
      {
        key: 'interrupt',
        label: '是否发生时效中断',
        type: 'switch',
        defaultValue: false,
        hint: '起诉、提出履行请求、义务人同意履行等',
      },
      {
        key: 'interruptDate',
        label: '最近一次中断事由发生日',
        type: 'date',
        defaultValue: '2025-01-01',
        visibleWhen: (v) => v.interrupt === true || v.interrupt === 'true',
      },
    ],
    calc(values): CalcOutput {
      const type = toStr(values.type, 'general');
      const start = parseDate(values.startDate) ?? new Date();
      const damage = parseDate(values.damageDate) ?? start;
      const interrupted = values.interrupt === true || values.interrupt === 'true';
      const iDate = parseDate(values.interruptDate);

      const years = type === 'intl' ? 4 : type === 'maritime' ? 1 : 3;
      const typeLabel =
        type === 'general' ? '普通诉讼时效 3 年' : type === 'installment' ? '分期履行债务 3 年' : type === 'intl' ? '涉外合同 4 年' : type === 'maritime' ? '海上货物运输 1 年' : '环境损害赔偿 3 年';

      const steps: StepRow[] = [{ label: '适用时效', value: typeLabel }];

      let base = start;
      steps.push({ label: '起算日', value: `${ymd(start)}（${weekdayCn(start)}）`, note: '《民法典》第188条：自权利人知道或应当知道权利受到损害及义务人之日起算' });

      if (interrupted && iDate) {
        base = iDate;
        steps.push({
          label: '时效中断',
          value: `${ymd(iDate)} 发生中断事由，时效重新计算`,
          note: '《民法典》第195条：从中断、有关程序终结时起，诉讼时效期间重新计算',
          emphasis: true,
        });
      }

      const p = calcPeriod(base, years, 'year');
      steps.push({ label: `加上 ${years} 年`, value: `${ymd(p.rawEnd)}（${weekdayCn(p.rawEnd)}）` });
      if (p.postponed) {
        steps.push({
          label: '法定休假日顺延',
          value: `${p.postponedDays.join('、')} 为休假日，顺延至 ${ymd(p.finalEnd)}`,
          note: '《民法典》第203条：期间的最后一日是法定休假日的，以法定休假日结束的次日为期间届满日',
          emphasis: true,
        });
      }
      steps.push({ label: '时效届满日', value: `${ymd(p.finalEnd)}（${weekdayCn(p.finalEnd)}）`, emphasis: true });

      const maxP = calcPeriod(damage, 20, 'year');
      const maxLabel = `${ymd(maxP.finalEnd)}（${weekdayCn(maxP.finalEnd)}）`;
      steps.push({
        label: '二十年最长保护期届满',
        value: maxLabel,
        note: '《民法典》第188条第2款：自权利受到损害之日起超过二十年的，人民法院不予保护；不适用中止、中断',
      });

      const now = new Date();
      const remainDays = Math.round((p.finalEnd.getTime() - now.getTime()) / 86400000);
      const expired = remainDays <= 0;

      return {
        main: {
          label: '诉讼时效届满日',
          value: ymd(p.finalEnd),
          sub: expired ? `⚠ 距今日已过 ${Math.abs(remainDays)} 天，时效可能已届满` : `距今日尚有 ${remainDays} 天`,
        },
        blocks: [
          { label: '星期', value: weekdayCn(p.finalEnd) },
          { label: '二十年最长保护期', value: ymd(maxP.finalEnd) },
          { label: '剩余天数', value: expired ? '已届满' : `${remainDays} 天` },
        ],
        steps,
        basis: [
          {
            law: '《民法典》',
            article: '第一百八十八条',
            text: '向人民法院请求保护民事权利的诉讼时效期间为三年。法律另有规定的，依照其规定。诉讼时效期间自权利人知道或者应当知道权利受到损害以及义务人之日起计算。法律另有规定的，依照其规定。但是，自权利受到损害之日起超过二十年的，人民法院不予保护，有特殊情况的，人民法院可以根据权利人的申请决定延长。',
          },
          {
            law: '《民法典》',
            article: '第一百九十五条',
            text: '有下列情形之一的，诉讼时效中断，从中断、有关程序终结时起，诉讼时效期间重新计算：（一）权利人向义务人提出履行请求；（二）义务人同意履行义务；（三）权利人提起诉讼或者申请仲裁；（四）与提起诉讼或者申请仲裁具有同等效力的其他情形。',
          },
          {
            law: '《民法典》',
            article: '第一百九十四条',
            text: '在诉讼时效期间的最后六个月内，因不可抗力等障碍，不能行使请求权的，诉讼时效中止。自中止时效的原因消除之日起满六个月，诉讼时效期间届满。',
          },
        ],
        tips: [
          '诉讼时效届满仅丧失胜诉权（产生抗辩权），实体权利并不消灭，义务人自愿履行的不得请求返还。',
          '时效抗辩必须由当事人在诉讼中主动提出，法院不得主动适用，也不得释明。',
          '中止只发生在最后六个月内，且中止原因消除后一律补足六个月，而非继续计算剩余期间。',
          '二十年最长保护期不适用中止、中断，仅在"特殊情况"下可由法院决定延长。',
        ],
      };
    },
  },

  /* ── 法定期间推算 ── */
  {
    id: 'period-calc',
    name: '法定期间推算',
    category: 'limitation',
    glyph: '期',
    summary: '通用期间计算工具，自动处理节假日顺延与月末对应日',
    keywords: ['期间', '顺延', '届满日', '期限计算'],
    fields: [
      { key: 'baseDate', label: '起算基准日', type: 'date', defaultValue: '2026-01-20', hint: '如送达日、签收日、事故发生日' },
      { key: 'value', label: '期间长度', type: 'number', defaultValue: 15 },
      {
        key: 'unit',
        label: '单位',
        type: 'select',
        defaultValue: 'day',
        options: [
          { label: '日', value: 'day' },
          { label: '月', value: 'month' },
          { label: '年', value: 'year' },
        ],
      },
      {
        key: 'countRule',
        label: '起算规则',
        type: 'select',
        defaultValue: 'next',
        options: [
          { label: '开始的当日不计入，自次日起算（民事通用）', value: 'next' },
          { label: '自当日起算（如部分行政、合同约定期限）', value: 'same' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const base = parseDate(values.baseDate) ?? new Date();
      const value = Math.max(0, Math.round(toNum(values.value, 15)));
      const unit = toStr(values.unit, 'day') as 'day' | 'month' | 'year';
      const rule = toStr(values.countRule, 'next');

      const p = calcPeriod(base, value, unit);
      const steps: StepRow[] = [];

      steps.push({ label: '起算基准日', value: `${ymd(base)}（${weekdayCn(base)}）` });

      if (rule === 'next') {
        steps.push({
          label: '起算规则',
          value: `开始当日不计入，自次日 ${ymd(p.startFrom)}（${weekdayCn(p.startFrom)}）起算`,
          note: '《民法典》第201条',
        });
      } else {
        steps.push({ label: '起算规则', value: `自当日 ${ymd(base)} 起算（合同约定或特别规定）` });
      }

      steps.push({
        label: `期间长度`,
        value: `${value} ${unit === 'day' ? '日' : unit === 'month' ? '月' : '年'}`,
      });

      steps.push({
        label: '名义届满日',
        value: `${ymd(p.rawEnd)}（${weekdayCn(p.rawEnd)}）`,
        note: unit === 'month' || unit === 'year' ? '《民法典》第202条：到期月的对应日为最后一日；没有对应日的，月末日为最后一日' : '',
      });

      if (isHoliday(p.rawEnd)) {
        steps.push({
          label: '⚠ 名义届满日为法定休假日',
          value: p.postponedDays.join('、'),
          emphasis: true,
        });
        steps.push({
          label: '顺延后届满日',
          value: `${ymd(p.finalEnd)}（${weekdayCn(p.finalEnd)}）`,
          note: '《民法典》第203条第1款',
          emphasis: true,
        });
      } else {
        steps.push({ label: '届满日', value: `${ymd(p.finalEnd)}（${weekdayCn(p.finalEnd)}）`, emphasis: true });
      }

      steps.push({ label: '期间自然日总数', value: `${p.totalDays} 天` });

      return {
        main: {
          label: '期间届满日',
          value: ymd(p.finalEnd),
          sub: `${weekdayCn(p.finalEnd)}${p.postponed ? '（已顺延）' : ''}`,
        },
        blocks: [
          { label: '起算日', value: ymd(p.startFrom) },
          { label: '是否顺延', value: p.postponed ? `是（顺延 ${p.postponedDays.length} 天）` : '否' },
          { label: '自然日数', value: `${p.totalDays} 天` },
        ],
        steps,
        basis: [
          {
            law: '《民法典》',
            article: '第二百零一条',
            text: '按照年、月、日计算期间的，开始的当日不算入，从下一日开始计算。按照小时计算期间的，自法律规定或者当事人约定的时间开始计算。',
          },
          {
            law: '《民法典》',
            article: '第二百零二条',
            text: '按照年、月计算期间的，到期月的对应日为期间的最后一日；没有对应日的，月末日为期间的最后一日。',
          },
          {
            law: '《民法典》',
            article: '第二百零三条',
            text: '期间的最后一日是法定休假日的，以法定休假日结束的次日为期间届满日。期间的最后一日截止时间为二十四时；有业务时间的，停止业务活动的时间为截止时间。',
          },
        ],
        tips: [
          '期间不包括在途时间：诉讼文书在期满前交邮的，不算过期（《民法典》第204条精神，《民事诉讼法》亦有规定）。',
          '本工具内置 2024—2027 年节假日表，其中 2026 年为按常规规则推定，国务院办公厅正式通知发布后请以官方为准。',
          '"法定休假日"指国家统一放假的节日和休息日，各地自行安排的地方性假期通常不属于此列。',
        ],
      };
    },
  },

  /* ── 上诉期与答辩期 ── */
  {
    id: 'appeal-deadline',
    name: '上诉期 / 答辩期',
    category: 'limitation',
    glyph: '上',
    summary: '判决 15 日、裁定 10 日的上诉期与答辩期届满日推算',
    keywords: ['上诉期', '答辩期', '十五日', '十日', '送达'],
    fields: [
      {
        key: 'docType',
        label: '文书类型',
        type: 'select',
        defaultValue: 'judgment',
        options: [
          { label: '判决书（上诉期 15 日）', value: 'judgment' },
          { label: '裁定书（上诉期 10 日）', value: 'ruling' },
          { label: '起诉状副本（答辩期 15 日）', value: 'complaint' },
          { label: '支付令（异议期 15 日）', value: 'payment' },
        ],
      },
      { key: 'serveDate', label: '送达 / 收到之日', type: 'date', defaultValue: '2026-01-20' },
      {
        key: 'serveWay',
        label: '送达方式',
        type: 'select',
        defaultValue: 'direct',
        options: [
          { label: '直接送达 / 留置送达', value: 'direct' },
          { label: '邮寄送达（以签收日为准）', value: 'mail' },
          { label: '公告送达（另计 30 日）', value: 'public' },
          { label: '电子送达（以到达系统日为准）', value: 'electronic' },
        ],
      },
      {
        key: 'parties',
        label: '当事人是否各自分别送达',
        type: 'switch',
        defaultValue: false,
        hint: '各方上诉期分别计算，以各自送达日为准',
      },
    ],
    calc(values): CalcOutput {
      const docType = toStr(values.docType, 'judgment');
      const serve = parseDate(values.serveDate) ?? new Date();
      const way = toStr(values.serveWay, 'direct');

      const config: Record<string, { days: number; label: string; note: string }> = {
        judgment: { days: 15, label: '判决书上诉期', note: '不服一审判决的上诉期为 15 日' },
        ruling: { days: 10, label: '裁定书上诉期', note: '不服一审裁定的上诉期为 10 日' },
        complaint: { days: 15, label: '答辩期', note: '被告应在收到起诉状副本之日起 15 日内提出答辩状' },
        payment: { days: 15, label: '支付令异议期', note: '债务人应在收到支付令之日起 15 日内清偿或提出书面异议' },
      };
      const cfg = config[docType] ?? config.judgment;

      const steps: StepRow[] = [
        { label: '文书类型', value: cfg.label },
        { label: '送达 / 收到日', value: `${ymd(serve)}（${weekdayCn(serve)}）` },
      ];

      let base = serve;
      if (way === 'public') {
        base = addDays(serve, 30);
        steps.push({
          label: '公告送达',
          value: `公告发出之日起经过 30 日视为送达 → ${ymd(base)}`,
          note: '《民事诉讼法》关于公告送达的规定',
          emphasis: true,
        });
      } else if (way === 'electronic') {
        steps.push({ label: '电子送达', value: '以送达信息到达受送达人特定系统的日期为送达日' });
      } else if (way === 'mail') {
        steps.push({ label: '邮寄送达', value: '以签收日为送达日，请以实际签收日期填写' });
      }

      const p = calcPeriod(base, cfg.days, 'day');
      steps.push({ label: '开始当日不计入', value: `自 ${ymd(p.startFrom)}（${weekdayCn(p.startFrom)}）起算`, note: '《民法典》第201条' });
      steps.push({ label: `第 ${cfg.days} 日`, value: `${ymd(p.rawEnd)}（${weekdayCn(p.rawEnd)}）` });

      if (p.postponed) {
        steps.push({
          label: '休假日顺延',
          value: `${p.postponedDays.join('、')} → 顺延至 ${ymd(p.finalEnd)}（${weekdayCn(p.finalEnd)}）`,
          emphasis: true,
        });
      }

      steps.push({ label: `${cfg.label}届满日`, value: `${ymd(p.finalEnd)}（${weekdayCn(p.finalEnd)}）`, emphasis: true });

      const now = new Date();
      const remain = Math.round((p.finalEnd.getTime() - now.getTime()) / 86400000);

      return {
        main: {
          label: `${cfg.label}届满日`,
          value: ymd(p.finalEnd),
          sub: remain <= 0 ? `⚠ 已过 ${Math.abs(remain)} 天` : `距今日 ${remain} 天`,
        },
        blocks: [
          { label: '法定期间', value: `${cfg.days} 日` },
          { label: '起算日', value: ymd(p.startFrom) },
          { label: '是否顺延', value: p.postponed ? '是' : '否' },
          { label: '剩余天数', value: remain <= 0 ? '已届满' : `${remain} 天` },
        ],
        steps,
        basis: [
          {
            law: '《民事诉讼法》',
            article: '第一百七十一条（2021年修正条文号）',
            text: '当事人不服地方人民法院第一审判决的，有权在判决书送达之日起十五日内向上一级人民法院提起上诉。当事人不服地方人民法院第一审裁定的，有权在裁定书送达之日起十日内向上一级人民法院提起上诉。',
          },
          {
            law: '《民事诉讼法》',
            article: '第一百二十八条（2021年修正条文号）',
            text: '人民法院应当在立案之日起五日内将起诉状副本发送被告，被告应当在收到之日起十五日内提出答辩状。',
          },
        ],
        tips: [
          '上诉期自"送达之次日"起算，节假日顺延；上诉状在期满前交邮的，不算过期。',
          '各方当事人的上诉期分别计算，以各自收到裁判文书的日期为准，不因他人已上诉而统一。',
          '支付令异议只需在 15 日内提出书面异议即可使其失效，法院不审查异议是否成立，是债务人低成本阻断程序的关键节点。',
          '民事上诉期不可延长也不可申请恢复，错过即丧失上诉权，只能申请再审。',
        ],
      };
    },
  },

  /* ── 申请执行期 ── */
  {
    id: 'execution-apply',
    name: '申请执行期间',
    category: 'limitation',
    glyph: '行',
    summary: '二年申请执行期间的起算、中止与中断',
    keywords: ['申请执行', '二年', '执行时效', '履行期届满'],
    fields: [
      { key: 'dueDate', label: '法律文书确定的履行期间最后一日', type: 'date', defaultValue: '2024-06-01' },
      {
        key: 'staged',
        label: '是否分期履行',
        type: 'switch',
        defaultValue: false,
        hint: '分期履行的，从最后一期履行期限届满之日起计算',
      },
      {
        key: 'lastDue',
        label: '最后一期履行期限届满日',
        type: 'date',
        defaultValue: '2025-06-01',
        visibleWhen: (v) => v.staged === true || v.staged === 'true',
      },
      {
        key: 'interrupt',
        label: '是否发生时效中断',
        type: 'switch',
        defaultValue: false,
        hint: '如债权人主张权利、债务人同意履行、申请执行等',
      },
      {
        key: 'interruptDate',
        label: '最近一次中断事由发生日',
        type: 'date',
        defaultValue: '2025-01-01',
        visibleWhen: (v) => v.interrupt === true || v.interrupt === 'true',
      },
    ],
    calc(values): CalcOutput {
      const due = parseDate(values.dueDate) ?? new Date();
      const staged = values.staged === true || values.staged === 'true';
      const lastDue = parseDate(values.lastDue);
      const interrupted = values.interrupt === true || values.interrupt === 'true';
      const iDate = parseDate(values.interruptDate);

      const steps: StepRow[] = [];
      let base = due;
      steps.push({ label: '履行期间最后一日', value: `${ymd(due)}（${weekdayCn(due)}）` });

      if (staged && lastDue) {
        base = lastDue;
        steps.push({ label: '分期履行', value: `自最后一期届满日 ${ymd(lastDue)} 起算`, emphasis: true, note: '《民事诉讼法》第246条第2款' });
      }

      if (interrupted && iDate) {
        base = iDate;
        steps.push({ label: '时效中断', value: `自 ${ymd(iDate)} 重新计算`, emphasis: true });
      }

      const p = calcPeriod(base, 2, 'year');
      steps.push({ label: '加二年', value: `${ymd(p.rawEnd)}（${weekdayCn(p.rawEnd)}）` });
      if (p.postponed) {
        steps.push({ label: '休假日顺延', value: `${p.postponedDays.join('、')} → ${ymd(p.finalEnd)}`, emphasis: true });
      }
      steps.push({ label: '申请执行期间届满日', value: `${ymd(p.finalEnd)}（${weekdayCn(p.finalEnd)}）`, emphasis: true });

      const now = new Date();
      const remain = Math.round((p.finalEnd.getTime() - now.getTime()) / 86400000);

      return {
        main: {
          label: '申请执行期间届满日',
          value: ymd(p.finalEnd),
          sub: remain <= 0 ? `⚠ 已过 ${Math.abs(remain)} 天，申请可能不被受理` : `距今日 ${remain} 天`,
        },
        blocks: [
          { label: '法定期间', value: '2 年' },
          { label: '起算日', value: ymd(p.startFrom) },
          { label: '剩余天数', value: remain <= 0 ? '已届满' : `${remain} 天` },
        ],
        steps,
        basis: [
          {
            law: '《民事诉讼法》',
            article: '第二百四十六条（2021年修正条文号）',
            text: '申请执行的期间为二年。申请执行时效的中止、中断，适用法律有关诉讼时效中止、中断的规定。前款规定的期间，从法律文书规定履行期间的最后一日起计算；法律文书规定分期履行的，从最后一期履行期限届满之日起计算；法律文书未规定履行期间的，从法律文书生效之日起计算。',
          },
        ],
        tips: [
          '申请执行期间适用诉讼时效中止、中断的规定，这一点与上诉期等不变期间完全不同。',
          '超过申请执行期间提出申请，法院仍应受理；被执行人提出异议且成立的，裁定不予执行。',
          '实务建议：判决生效后及时申请执行，即使暂无财产可供执行，法院终本后发现的财产仍可随时恢复执行。',
        ],
      };
    },
  },

  /* ── 再审申请期 ── */
  {
    id: 'retrial-deadline',
    name: '再审申请期限',
    category: 'limitation',
    glyph: '再',
    summary: '判决生效后六个月再审申请期，及特殊事由的知道之日起六个月',
    keywords: ['再审', '六个月', '申请再审', '生效'],
    fields: [
      { key: 'effectiveDate', label: '判决 / 裁定生效之日', type: 'date', defaultValue: '2025-06-01' },
      {
        key: 'special',
        label: '是否属于特殊事由',
        type: 'switch',
        defaultValue: false,
        hint: '如出现新证据、原裁判依据的法律文书被撤销、审判人员枉法裁判等',
      },
      {
        key: 'knowDate',
        label: '知道 / 应当知道特殊事由之日',
        type: 'date',
        defaultValue: '2026-01-01',
        visibleWhen: (v) => v.special === true || v.special === 'true',
      },
    ],
    calc(values): CalcOutput {
      const eff = parseDate(values.effectiveDate) ?? new Date();
      const special = values.special === true || values.special === 'true';
      const know = parseDate(values.knowDate);

      const steps: StepRow[] = [
        { label: '裁判生效日', value: `${ymd(eff)}（${weekdayCn(eff)}）` },
      ];

      const p1 = calcPeriod(eff, 6, 'month');
      steps.push({ label: '加六个月', value: `${ymd(p1.rawEnd)}（${weekdayCn(p1.rawEnd)}）` });
      if (p1.postponed) {
        steps.push({ label: '休假日顺延', value: `${p1.postponedDays.join('、')} → ${ymd(p1.finalEnd)}`, emphasis: true });
      }
      steps.push({ label: '一般情形届满日', value: `${ymd(p1.finalEnd)}（${weekdayCn(p1.finalEnd)}）`, emphasis: true });

      let finalEnd = p1.finalEnd;
      if (special && know) {
        const p2 = calcPeriod(know, 6, 'month');
        steps.push({
          label: '特殊事由',
          value: `自知道之日 ${ymd(know)}（${weekdayCn(know)}）起算六个月`,
          note: '包括：有新的证据足以推翻原裁判、原裁判依据的法律文书被撤销或变更、审判人员有枉法裁判行为等',
          emphasis: true,
        });
        steps.push({ label: '特殊情形届满日', value: `${ymd(p2.finalEnd)}（${weekdayCn(p2.finalEnd)}）`, emphasis: true });
        finalEnd = p2.finalEnd > finalEnd ? p2.finalEnd : finalEnd;
        steps.push({ label: '取较晚者', value: `${ymd(finalEnd)}（${weekdayCn(finalEnd)}）`, emphasis: true });
      }

      const now = new Date();
      const remain = Math.round((finalEnd.getTime() - now.getTime()) / 86400000);

      return {
        main: {
          label: '再审申请期限届满日',
          value: ymd(finalEnd),
          sub: remain <= 0 ? `⚠ 已过 ${Math.abs(remain)} 天` : `距今日 ${remain} 天`,
        },
        blocks: [
          { label: '法定期间', value: '6 个月' },
          { label: '适用起算点', value: special && know ? '知道特殊事由之日' : '裁判生效之日' },
          { label: '剩余天数', value: remain <= 0 ? '已届满' : `${remain} 天` },
        ],
        steps,
        basis: [
          {
            law: '《民事诉讼法》',
            article: '第二百零五条（2021年修正条文号）',
            text: '当事人申请再审，应当在判决、裁定发生法律效力后六个月内提出；有本法第二百零七条第一项、第三项、第十二项、第十三项规定情形的，自知道或者应当知道之日起六个月内提出。',
          },
        ],
        tips: [
          '六个月是不变期间，不适用中止、中断、延长，逾期申请的再审事由将不予审查。',
          '同一案件一般只能申请再审一次，被驳回后可向检察院申请检察建议或抗诉。',
          '再审不停止原判决的执行，但涉及追索赡养费、扶养费、抚养费、抚恤金、医疗费用、劳动报酬等案件，可以裁定中止执行。',
        ],
      };
    },
  },

  /* ── 劳动仲裁时效 ── */
  {
    id: 'arbitration-limitation',
    name: '劳动仲裁时效',
    category: 'limitation',
    glyph: '裁',
    summary: '一年仲裁时效，劳动报酬争议自劳动关系终止起算',
    keywords: ['劳动仲裁', '仲裁时效', '一年', '劳动报酬'],
    fields: [
      {
        key: 'disputeType',
        label: '争议类型',
        type: 'select',
        defaultValue: 'wage',
        options: [
          { label: '拖欠劳动报酬（存续期间不受限制）', value: 'wage' },
          { label: '违法解除赔偿金 / 经济补偿', value: 'termination' },
          { label: '未签劳动合同二倍工资', value: 'double' },
          { label: '工伤待遇', value: 'injury' },
          { label: '其他劳动争议', value: 'other' },
        ],
      },
      { key: 'knowDate', label: '知道或应当知道权利被侵害之日', type: 'date', defaultValue: '2025-01-01' },
      {
        key: 'endDate',
        label: '劳动关系终止之日',
        type: 'date',
        defaultValue: '2025-06-01',
        hint: '劳动报酬争议自劳动关系终止之日起算一年',
        visibleWhen: (v) => toStr(v.disputeType) === 'wage',
      },
      {
        key: 'interrupt',
        label: '是否发生时效中断',
        type: 'switch',
        defaultValue: false,
        hint: '向对方主张权利、向有关部门请求救济、对方同意履行等',
      },
      {
        key: 'interruptDate',
        label: '最近一次中断事由发生日',
        type: 'date',
        defaultValue: '2025-03-01',
        visibleWhen: (v) => v.interrupt === true || v.interrupt === 'true',
      },
    ],
    calc(values): CalcOutput {
      const type = toStr(values.disputeType, 'wage');
      const know = parseDate(values.knowDate) ?? new Date();
      const end = parseDate(values.endDate);
      const interrupted = values.interrupt === true || values.interrupt === 'true';
      const iDate = parseDate(values.interruptDate);

      const steps: StepRow[] = [];
      let base = know;
      let baseLabel = '知道或应当知道权利被侵害之日';

      if (type === 'wage' && end) {
        base = end;
        baseLabel = '劳动关系终止之日';
        steps.push({
          label: '劳动报酬争议特别规则',
          value: '劳动关系存续期间因拖欠劳动报酬发生争议的，不受一年仲裁时效限制',
          note: '《劳动争议调解仲裁法》第27条第4款',
          emphasis: true,
        });
        steps.push({ label: '劳动关系终止日', value: `${ymd(end)}（${weekdayCn(end)}）` });
        steps.push({ label: '起算点', value: '自劳动关系终止之日起算一年', emphasis: true });
      } else {
        steps.push({ label: '起算点', value: `${ymd(know)}（${weekdayCn(know)}）` });
      }

      if (interrupted && iDate) {
        base = iDate;
        baseLabel = '中断事由发生日';
        steps.push({ label: '时效中断', value: `自 ${ymd(iDate)} 重新计算`, emphasis: true });
      }

      const p = calcPeriod(base, 1, 'year');
      steps.push({ label: '加一年', value: `${ymd(p.rawEnd)}（${weekdayCn(p.rawEnd)}）` });
      if (p.postponed) {
        steps.push({ label: '休假日顺延', value: `${p.postponedDays.join('、')} → ${ymd(p.finalEnd)}`, emphasis: true });
      }
      steps.push({ label: '仲裁时效届满日', value: `${ymd(p.finalEnd)}（${weekdayCn(p.finalEnd)}）`, emphasis: true });

      const now = new Date();
      const remain = Math.round((p.finalEnd.getTime() - now.getTime()) / 86400000);

      return {
        main: {
          label: '劳动仲裁时效届满日',
          value: ymd(p.finalEnd),
          sub: remain <= 0 ? `⚠ 已过 ${Math.abs(remain)} 天` : `距今日 ${remain} 天`,
        },
        blocks: [
          { label: '法定时效', value: '1 年' },
          { label: '起算基准', value: baseLabel },
          { label: '起算日', value: ymd(p.startFrom) },
          { label: '剩余天数', value: remain <= 0 ? '已届满' : `${remain} 天` },
        ],
        steps,
        basis: [
          {
            law: '《劳动争议调解仲裁法》',
            article: '第二十七条',
            text: '劳动争议申请仲裁的时效期间为一年。仲裁时效期间从当事人知道或者应当知道其权利被侵害之日起计算。前款规定的仲裁时效，因当事人一方向对方当事人主张权利，或者向有关部门请求权利救济，或者对方当事人同意履行义务而中断。从中断时起，仲裁时效期间重新计算。因不可抗力或者有其他正当理由，当事人不能在本条第一款规定的仲裁时效期间申请仲裁的，仲裁时效中止。劳动关系存续期间因拖欠劳动报酬发生争议的，劳动者申请仲裁不受本条第一款规定的仲裁时效期间的限制；但是，劳动关系终止的，应当自劳动关系终止之日起一年内提出。',
          },
        ],
        tips: [
          '劳动仲裁是诉讼的前置程序，未经仲裁直接起诉的，法院不予受理。',
          '劳动报酬争议的时效起算点是"劳动关系终止之日"，在职期间不受一年限制，这是劳动者最有利的规则之一。',
          '二倍工资差额的仲裁时效各地裁判口径不一，部分地区按"应当订立书面合同期满之次日"起算一年，需查询当地裁审口径。',
          '仲裁裁决后 15 日内可向法院起诉，逾期裁决书生效。',
        ],
      };
    },
  },
];
