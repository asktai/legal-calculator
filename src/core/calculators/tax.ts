/**
 * 五、税务类计算器（法务场景相关）
 * 依据：《印花税法》（2022年7月1日施行）
 *      《个人所得税法》及其实施条例
 *      《个人所得税扣缴申报管理办法（试行）》（国家税务总局公告2018年第61号）
 *      《企业所得税法》
 */
import type { CalculatorDef, CalcOutput, StepRow } from '../types';
import { money, round, toNum, toStr, moneyToChinese } from '../format';

/** 印花税税目税率表（《印花税法》附件） */
export interface StampItem {
  label: string;
  /** 税率，万分比（‰） */
  rate: number;
  note: string;
}

export const STAMP_ITEMS: Record<string, StampItem> = {
  loan: { label: '借款合同', rate: 0.05, note: '借款金额' },
  lease_finance: { label: '融资租赁合同', rate: 0.05, note: '租金' },
  sale: { label: '买卖合同', rate: 0.3, note: '价款' },
  contract_work: { label: '承揽合同', rate: 0.3, note: '报酬' },
  construction: { label: '建设工程合同', rate: 0.3, note: '价款' },
  transport: { label: '运输合同', rate: 0.3, note: '运输费用' },
  technology: { label: '技术合同', rate: 0.3, note: '价款、报酬或使用费' },
  lease: { label: '租赁合同', rate: 1, note: '租金' },
  storage: { label: '仓储合同', rate: 1, note: '仓储费' },
  safekeeping: { label: '保管合同', rate: 1, note: '保管费' },
  insurance: { label: '财产保险合同', rate: 1, note: '保险费' },
  land_transfer: { label: '土地使用权出让 / 转让书据', rate: 0.5, note: '价款' },
  house_transfer: { label: '房屋等建筑物所有权转让书据', rate: 0.5, note: '价款' },
  equity_transfer: { label: '股权转让书据（非上市）', rate: 0.5, note: '价款' },
  ip_transfer: { label: '商标 / 著作权 / 专利权转让书据', rate: 0.3, note: '价款' },
  capital_book: { label: '营业账簿（实收资本 + 资本公积）', rate: 0.25, note: '合计金额' },
};

/** 综合所得个人所得税年度税率表 */
const IIT_TIERS = [
  { upTo: 36000, rate: 0.03, deduct: 0 },
  { upTo: 144000, rate: 0.1, deduct: 2520 },
  { upTo: 300000, rate: 0.2, deduct: 16920 },
  { upTo: 420000, rate: 0.25, deduct: 31920 },
  { upTo: 660000, rate: 0.3, deduct: 52920 },
  { upTo: 960000, rate: 0.35, deduct: 85920 },
  { upTo: Infinity, rate: 0.45, deduct: 181920 },
];

/** 劳务报酬预扣预缴税率表 */
const LABOR_TIERS = [
  { upTo: 20000, rate: 0.2, deduct: 0 },
  { upTo: 50000, rate: 0.3, deduct: 2000 },
  { upTo: Infinity, rate: 0.4, deduct: 7000 },
];

function tieredTax(taxable: number, tiers: typeof IIT_TIERS) {
  for (const t of tiers) {
    if (taxable <= t.upTo) {
      return { tax: Math.max(0, round(taxable * t.rate - t.deduct, 2)), rate: t.rate, deduct: t.deduct };
    }
  }
  return { tax: 0, rate: 0, deduct: 0 };
}

export const taxCalculators: CalculatorDef[] = [
  /* ── 印花税 ── */
  {
    id: 'stamp-duty',
    name: '合同印花税',
    category: 'tax',
    glyph: '印',
    summary: '按《印花税法》税目税率表计算各类合同应缴印花税',
    keywords: ['印花税', '合同税', '股权转让', '借款合同'],
    fields: [
      {
        key: 'item',
        label: '税目',
        type: 'select',
        defaultValue: 'sale',
        options: Object.entries(STAMP_ITEMS).map(([k, v]) => ({ label: v.label, value: k })),
      },
      { key: 'amount', label: '计税金额', type: 'money', unit: '元', defaultValue: 10000000, hint: '不含增值税；未列明增值税的按全额计征' },
      {
        key: 'vatIncluded',
        label: '金额是否含增值税',
        type: 'switch',
        defaultValue: false,
        hint: '应税合同的计税依据不含列明的增值税税款',
      },
      {
        key: 'vat',
        label: '合同列明的增值税额',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        visibleWhen: (v) => v.vatIncluded === true || v.vatIncluded === 'true',
      },
      {
        key: 'copies',
        label: '合同份数（各方均需贴花）',
        type: 'number',
        unit: '份',
        defaultValue: 2,
        hint: '同一合同由各方分别纳税，每份金额相同',
      },
      {
        key: 'smallScale',
        label: '是否享受小规模纳税人减半优惠',
        type: 'switch',
        defaultValue: false,
        hint: '小规模纳税人、小微企业、个体工商户可减半征收（现行优惠政策）',
      },
    ],
    calc(values): CalcOutput {
      const item = STAMP_ITEMS[toStr(values.item, 'sale')] ?? STAMP_ITEMS.sale;
      let amount = toNum(values.amount);
      const vat = (values.vatIncluded === true || values.vatIncluded === 'true') ? toNum(values.vat) : 0;
      const copies = Math.max(1, Math.round(toNum(values.copies, 2)));
      const halved = values.smallScale === true || values.smallScale === 'true';

      const steps: StepRow[] = [];
      let base = amount;
      if (vat > 0) {
        base = round(amount - vat, 2);
        steps.push({
          label: '扣除列明的增值税',
          value: `${money(amount)} − ${money(vat)} = ${money(base)} 元`,
          note: '《印花税法》第五条第（一）项：应税合同的计税依据为合同所列金额，不包括列明的增值税税款',
        });
      } else {
        steps.push({ label: '计税依据', value: `${money(amount)} 元`, note: `按${item.note}确定` });
      }

      steps.push({ label: '适用税率', value: `${item.rate}‰`, note: `${item.label}` });

      const perCopy = round((base * item.rate) / 1000, 2);
      steps.push({
        label: '单份应纳税额',
        value: `${money(base)} × ${item.rate}‰ = ${money(perCopy)} 元`,
      });

      if (halved) {
        steps.push({ label: '减半优惠', value: `${money(perCopy)} ÷ 2 = ${money(round(perCopy / 2, 2))} 元`, emphasis: true });
      }

      const perAfter = halved ? round(perCopy / 2, 2) : perCopy;
      const total = round(perAfter * copies, 2);
      steps.push({ label: `共 ${copies} 份（各方分别纳税）`, value: `${money(perAfter)} × ${copies} = ${money(total)} 元`, emphasis: true });

      return {
        main: { label: '印花税合计', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '单份应纳税额', value: money(perAfter), unit: '元' },
          { label: '适用税目', value: item.label, sub: `${item.rate}‰` },
          { label: '实际税负率', value: `${((total / Math.max(amount, 1)) * 100).toFixed(4)}%` },
        ],
        steps,
        basis: [
          {
            law: '《印花税法》',
            article: '第五条',
            text: '应税合同的计税依据，为合同所列的金额，不包括列明的增值税税款。',
          },
          {
            law: '《印花税法》',
            article: '第四条',
            text: '印花税的税目、税率，依照本法所附《印花税税目税率表》执行。',
          },
          {
            law: '《印花税税目税率表》',
            text: '借款合同按借款金额的万分之零点五；买卖合同按价款的万分之三；租赁合同按租金的千分之一；股权转让书据按价款的万分之五；营业账簿按实收资本与资本公积合计金额的万分之二点五。',
          },
        ],
        tips: [
          '同一合同由各方当事人分别纳税，实务中双方各缴一次，不要误认为只缴一份。',
          '合同金额在履约中增加的，应就增加部分补缴印花税；减少的，已缴税款不予退还。',
          '未列明增值税税款的合同，按合同全额计征，签订合同时务必单独列明税额。',
          '应税凭证应当在书立时或领受时贴花，境外签订的境内使用合同同样应税。',
        ],
      };
    },
  },

  /* ── 工资薪金个人所得税 ── */
  {
    id: 'personal-income-tax',
    name: '工资薪金个人所得税',
    category: 'tax',
    glyph: '税',
    summary: '年度综合所得汇算与月度累计预扣的个税测算',
    keywords: ['个税', '个人所得税', '专项附加扣除', '汇算'],
    fields: [
      { key: 'monthlySalary', label: '月工资收入（税前）', type: 'money', unit: '元', defaultValue: 25000 },
      { key: 'bonus', label: '年度奖金', type: 'money', unit: '元', defaultValue: 0, hint: '并入综合所得口径计算' },
      { key: 'socialMonthly', label: '每月三险一金个人部分', type: 'money', unit: '元', defaultValue: 3000 },
      { key: 'children', label: '子女教育（人数 × 2000 元/月）', type: 'number', unit: '人', defaultValue: 1 },
      { key: 'elderly', label: '赡养老人（独生子女 3000 元/月）', type: 'switch', defaultValue: true },
      { key: 'housing', label: '住房贷款利息 / 租金', type: 'select', defaultValue: 'loan', options: [
        { label: '住房贷款利息（1000 元/月）', value: 'loan' },
        { label: '住房租金（1500 元/月）', value: 'rent1500' },
        { label: '住房租金（1100 元/月）', value: 'rent1100' },
        { label: '无', value: 'none' },
      ] },
      { key: 'infant', label: '3 岁以下婴幼儿照护（人数 × 2000 元/月）', type: 'number', unit: '人', defaultValue: 0 },
      { key: 'other', label: '其他扣除（商业健康险等，年）', type: 'money', unit: '元', defaultValue: 0 },
    ],
    calc(values): CalcOutput {
      const salary = toNum(values.monthlySalary);
      const bonus = toNum(values.bonus);
      const social = toNum(values.socialMonthly);
      const children = toNum(values.children);
      const elderly = values.elderly === true || values.elderly === 'true';
      const housing = toStr(values.housing, 'loan');
      const infant = toNum(values.infant);
      const other = toNum(values.other);

      const steps: StepRow[] = [];

      const grossAnnual = round(salary * 12 + bonus, 2);
      steps.push({ label: '年度收入总额', value: `${money(salary)} × 12${bonus > 0 ? ` + ${money(bonus)}` : ''} = ${money(grossAnnual)} 元` });

      const basicDeduction = 60000;
      steps.push({ label: '基本减除费用', value: `${money(basicDeduction)} 元（5000 元 × 12 个月）` });

      const socialAnnual = round(social * 12, 2);
      steps.push({ label: '专项扣除（三险一金）', value: `${money(social)} × 12 = ${money(socialAnnual)} 元` });

      let childrenDed = children * 2000 * 12;
      let infantDed = infant * 2000 * 12;
      let elderlyDed = elderly ? 3000 * 12 : 0;
      let housingDed = housing === 'loan' ? 1000 * 12 : housing === 'rent1500' ? 1500 * 12 : housing === 'rent1100' ? 1100 * 12 : 0;

      steps.push({
        label: '专项附加扣除',
        value: [
          childrenDed > 0 ? `子女教育 ${money(childrenDed)}` : '',
          elderlyDed > 0 ? `赡养老人 ${money(elderlyDed)}` : '',
          housingDed > 0 ? `住房 ${money(housingDed)}` : '',
          infantDed > 0 ? `婴幼儿照护 ${money(infantDed)}` : '',
        ].filter(Boolean).join(' + ') + ` = ${money(childrenDed + elderlyDed + housingDed + infantDed)} 元`,
      });

      const specialAdd = round(childrenDed + elderlyDed + housingDed + infantDed, 2);
      if (other > 0) steps.push({ label: '其他扣除', value: `${money(other)} 元` });

      const taxable = Math.max(0, round(grossAnnual - basicDeduction - socialAnnual - specialAdd - other, 2));
      steps.push({
        label: '应纳税所得额',
        value: `${money(grossAnnual)} − ${money(basicDeduction)} − ${money(socialAnnual)} − ${money(specialAdd)}${other > 0 ? ` − ${money(other)}` : ''} = ${money(taxable)} 元`,
        emphasis: true,
      });

      const { tax, rate, deduct } = tieredTax(taxable, IIT_TIERS);
      steps.push({
        label: '适用税率与速算扣除数',
        value: `${(rate * 100).toFixed(0)}%，速算扣除 ${money(deduct)} 元`,
      });
      steps.push({
        label: '应纳税额',
        value: `${money(taxable)} × ${(rate * 100).toFixed(0)}% − ${money(deduct)} = ${money(tax)} 元`,
        emphasis: true,
      });

      const netAnnual = round(grossAnnual - socialAnnual - tax, 2);
      steps.push({ label: '税后年收入', value: `${money(netAnnual)} 元` });

      return {
        main: { label: '全年应纳个人所得税', value: money(tax), unit: '元', sub: moneyToChinese(tax) },
        blocks: [
          { label: '月均税负', value: money(round(tax / 12, 2)), unit: '元/月' },
          { label: '有效税率', value: `${((tax / Math.max(grossAnnual, 1)) * 100).toFixed(2)}%`, sub: `边际税率 ${(rate * 100).toFixed(0)}%` },
          { label: '税后月均收入', value: money(round(netAnnual / 12, 2)), unit: '元' },
          { label: '全年综合所得', value: money(grossAnnual), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《个人所得税法》',
            article: '第六条',
            text: '居民个人的综合所得，以每一纳税年度的收入额减除费用六万元以及专项扣除、专项附加扣除和依法确定的其他扣除后的余额，为应纳税所得额。',
          },
          {
            law: '《个人所得税法》',
            article: '第三条',
            text: '综合所得，适用百分之三至百分之四十五的超额累进税率。',
          },
        ],
        tips: [
          '本工具采用"并入综合所得"口径。全年一次性奖金单独计税优惠政策在 2027 年 12 月 31 日前仍可选择，高收入者建议两种口径分别测算后择优。',
          '专项附加扣除标准近年多次提高，填报前请核对当年最新标准及本人实际享受条件。',
          '住房贷款利息与住房租金只能二选一，不能同时享受。',
          '年终奖"税收临界点"效应显著（如 36000、144000 元附近多发一元可能多缴上千元），发放时应避开跳档区间。',
        ],
      };
    },
  },

  /* ── 劳务报酬所得税 ── */
  {
    id: 'labor-remuneration-tax',
    name: '劳务报酬所得税',
    category: 'tax',
    glyph: '劳',
    summary: '律师费、顾问费、稿酬等劳务报酬的预扣预缴与年度汇算',
    keywords: ['劳务报酬', '预扣预缴', '律师费个税', '顾问费'],
    fields: [
      { key: 'income', label: '单次劳务报酬金额', type: 'money', unit: '元', defaultValue: 100000 },
      {
        key: 'times',
        label: '年度内支付次数',
        type: 'number',
        unit: '次',
        defaultValue: 1,
        hint: '按次预扣，年度终了并入综合所得汇算',
      },
      {
        key: 'otherIncome',
        label: '年度其他综合所得（工资薪金等）',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '用于年度汇算的整体测算',
      },
      {
        key: 'otherDeduction',
        label: '年度可扣除项合计',
        type: 'money',
        unit: '元',
        defaultValue: 60000,
        hint: '基本减除 60000 + 专项扣除 + 专项附加扣除',
      },
    ],
    calc(values): CalcOutput {
      const income = toNum(values.income);
      const times = Math.max(1, Math.round(toNum(values.times, 1)));
      const otherIncome = toNum(values.otherIncome);
      const otherDed = toNum(values.otherDeduction);

      const steps: StepRow[] = [{ label: '单次劳务报酬', value: `${money(income)} 元` }];

      // 预扣预缴：减除费用
      let expense = income <= 4000 ? 800 : round(income * 0.2, 2);
      steps.push({
        label: '减除费用',
        value: income <= 4000 ? '收入 ≤ 4000 元，减除 800 元' : `${money(income)} × 20% = ${money(expense)} 元`,
        note: '《个人所得税法》第六条：劳务报酬所得每次收入不超过四千元的，减除费用八百元；四千元以上的，减除百分之二十的费用',
      });

      const taxableOnce = Math.max(0, round(income - expense, 2));
      steps.push({ label: '单次应纳税所得额', value: `${money(taxableOnce)} 元` });

      const t = tieredTax(taxableOnce, LABOR_TIERS);
      steps.push({ label: '预扣预缴税率', value: `${(t.rate * 100).toFixed(0)}%，速算扣除 ${money(t.deduct)} 元` });
      const withholdOnce = t.tax;
      steps.push({
        label: '单次预扣税额',
        value: `${money(taxableOnce)} × ${(t.rate * 100).toFixed(0)}% − ${money(t.deduct)} = ${money(withholdOnce)} 元`,
        emphasis: true,
      });

      const withholdTotal = round(withholdOnce * times, 2);
      steps.push({ label: `年度预扣合计（${times} 次）`, value: `${money(withholdOnce)} × ${times} = ${money(withholdTotal)} 元` });

      // 年度汇算
      const laborAnnual = round(income * times, 2);
      const laborIncomeAmount = round(laborAnnual * 0.8, 2); // 收入额 = 收入 × (1-20%)
      steps.push({ label: '年度劳务收入额', value: `${money(laborAnnual)} × 80% = ${money(laborIncomeAmount)} 元（不再扣 800 元）` });

      const totalIncomeAmount = round(laborIncomeAmount + otherIncome, 2);
      const taxableYear = Math.max(0, round(totalIncomeAmount - otherDed, 2));
      steps.push({ label: '年度综合所得应纳税所得额', value: `${money(taxableYear)} 元`, emphasis: true });

      const y = tieredTax(taxableYear, IIT_TIERS);
      steps.push({
        label: '年度汇算应纳税额',
        value: `${money(taxableYear)} × ${(y.rate * 100).toFixed(0)}% − ${money(y.deduct)} = ${money(y.tax)} 元`,
        emphasis: true,
      });

      const diff = round(y.tax - withholdTotal, 2);
      steps.push({
        label: diff >= 0 ? '应补税额' : '应退税额',
        value: `${money(Math.abs(diff))} 元`,
        note: diff >= 0 ? '预扣不足，汇算时需补税' : '预扣超额，汇算时可申请退税',
        emphasis: true,
      });

      const net = round(laborAnnual - y.tax, 2);
      return {
        main: {
          label: '年度汇算应纳税额',
          value: money(y.tax),
          unit: '元',
          sub: diff >= 0 ? `需补税 ${money(diff)} 元` : `可退税 ${money(Math.abs(diff))} 元`,
        },
        blocks: [
          { label: '单次预扣税额', value: money(withholdOnce), unit: '元' },
          { label: '年度预扣合计', value: money(withholdTotal), unit: '元' },
          { label: '劳务报酬税后净额', value: money(net), unit: '元' },
          { label: '综合税负率', value: `${((y.tax / Math.max(laborAnnual, 1)) * 100).toFixed(2)}%` },
        ],
        steps,
        basis: [
          {
            law: '《个人所得税法》',
            article: '第六条',
            text: '劳务报酬所得、稿酬所得、特许权使用费所得，每次收入不超过四千元的，减除费用八百元；四千元以上的，减除百分之二十的费用，其余额为应纳税所得额。',
          },
          {
            law: '《个人所得税扣缴申报管理办法（试行）》',
            article: '第八条',
            text: '扣缴义务人向居民个人支付劳务报酬所得时，应当按照以下方法按次预扣预缴税款：劳务报酬所得适用个人所得税预扣率表二。',
          },
          {
            law: '《个人所得税法》',
            article: '第十一条',
            text: '居民个人取得综合所得，按年计算个人所得税；有扣缴义务人的，由扣缴义务人按月或者按次预扣预缴税款；需要办理汇算清缴的，应当在取得所得的次年三月一日至六月三十日内办理汇算清缴。',
          },
        ],
        tips: [
          '劳务报酬预扣税率（20%/30%/40%）远高于汇算时的实际税负，单次金额大、年度收入低的，通常能在汇算时获得退税，务必办理汇算。',
          '支付方是法定扣缴义务人，未依法扣缴的将面临应扣未扣税款 50%—3 倍的罚款。',
          '企业支付律师费、顾问费、讲师费、设计费等均属劳务报酬，需索取发票并代扣个税。',
          '汇算办理时间为次年 3 月 1 日至 6 月 30 日。',
        ],
      };
    },
  },

  /* ── 违约金涉税测算 ── */
  {
    id: 'penalty-tax',
    name: '违约金 / 赔偿金涉税',
    category: 'tax',
    glyph: '金',
    summary: '违约金收入的增值税、附加税费与企业所得税 / 个税测算',
    keywords: ['违约金', '赔偿金', '增值税', '价外费用', '涉税'],
    fields: [
      { key: 'amount', label: '违约金 / 赔偿金金额', type: 'money', unit: '元', defaultValue: 500000 },
      {
        key: 'receiver',
        label: '收取方',
        type: 'select',
        defaultValue: 'seller',
        options: [
          { label: '销售方（随货款收取，属价外费用）', value: 'seller' },
          { label: '采购方 / 守约方（未发生销售行为）', value: 'buyer' },
          { label: '个人（如劳动者、消费者）', value: 'individual' },
        ],
      },
      {
        key: 'vatRate',
        label: '适用增值税税率',
        type: 'select',
        defaultValue: '13',
        options: [
          { label: '13%（销售货物等）', value: '13' },
          { label: '9%（交通运输、建筑等）', value: '9' },
          { label: '6%（现代服务、无形资产等）', value: '6' },
          { label: '3%（小规模纳税人征收率）', value: '3' },
          { label: '1%（小规模优惠征收率）', value: '1' },
          { label: '不征增值税', value: '0' },
        ],
        visibleWhen: (v) => toStr(v.receiver) === 'seller',
      },
      {
        key: 'citRate',
        label: '企业所得税税率',
        type: 'select',
        defaultValue: '25',
        options: [
          { label: '25%（一般企业）', value: '25' },
          { label: '20%（小型微利企业实际税负）', value: '20' },
          { label: '15%（高新技术企业）', value: '15' },
        ],
        visibleWhen: (v) => toStr(v.receiver) !== 'individual',
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const receiver = toStr(values.receiver, 'seller');
      const vatRate = toNum(values.vatRate, 13) / 100;
      const citRate = toNum(values.citRate, 25) / 100;

      const steps: StepRow[] = [{ label: '违约金金额', value: `${money(amount)} 元` }];

      let vat = 0;
      let surcharge = 0;
      let cit = 0;

      if (receiver === 'seller' && vatRate > 0) {
        // 价外费用：视为含税，需价税分离
        vat = round((amount / (1 + vatRate)) * vatRate, 2);
        steps.push({
          label: '增值税（价外费用需价税分离）',
          value: `${money(amount)} ÷ (1 + ${(vatRate * 100).toFixed(0)}%) × ${(vatRate * 100).toFixed(0)}% = ${money(vat)} 元`,
          note: '《增值税暂行条例实施细则》第十二条：价外费用包括违约金、延期付款利息等，应并入销售额征税',
          emphasis: true,
        });
        surcharge = round(vat * 0.12, 2);
        steps.push({
          label: '附加税费（城建 7% + 教育费附加 3% + 地方教育附加 2%）',
          value: `${money(vat)} × 12% = ${money(surcharge)} 元`,
        });
      } else if (receiver === 'buyer') {
        steps.push({
          label: '增值税',
          value: '不征收',
          note: '守约方收取的违约金未发生销售行为，不属于增值税应税范围，无需开票，凭合同与收款凭证入账',
          emphasis: true,
        });
      } else {
        steps.push({ label: '增值税', value: '不涉及（个人收取）' });
      }

      if (receiver !== 'individual') {
        const base = round(amount - vat - surcharge, 2);
        cit = round(base * citRate, 2);
        steps.push({
          label: '企业所得税应纳税所得额',
          value: `${money(amount)} − ${money(vat)} − ${money(surcharge)} = ${money(base)} 元`,
        });
        steps.push({
          label: '企业所得税',
          value: `${money(base)} × ${(citRate * 100).toFixed(0)}% = ${money(cit)} 元`,
          emphasis: true,
        });
      } else {
        steps.push({
          label: '个人所得税',
          value: '一般不属于征税范围',
          note: '个人因合同解除取得的违约金、赔偿金，通常不属于个人所得税应税所得；但因任职受雇关系取得的，应按工资薪金计税',
        });
      }

      const totalTax = round(vat + surcharge + cit, 2);
      const net = round(amount - totalTax, 2);
      steps.push({ label: '税费合计', value: `${money(totalTax)} 元`, emphasis: true });
      steps.push({ label: '税后净额', value: `${money(net)} 元`, emphasis: true });

      return {
        main: { label: '税费合计', value: money(totalTax), unit: '元', sub: `税后净额 ${money(net)} 元` },
        blocks: [
          { label: '增值税', value: money(vat), unit: '元' },
          { label: '附加税费', value: money(surcharge), unit: '元' },
          { label: '企业所得税', value: money(cit), unit: '元' },
          { label: '综合税负率', value: `${((totalTax / Math.max(amount, 1)) * 100).toFixed(2)}%` },
        ],
        steps,
        basis: [
          {
            law: '《增值税暂行条例实施细则》',
            article: '第十二条',
            text: '条例第六条第一款所称价外费用，包括价外向购买方收取的手续费、补贴、基金、集资费、返还利润、奖励费、违约金、滞纳金、延期付款利息、赔偿金、代收款项、代垫款项、包装费、包装物租金、储备费、优质费、运输装卸费以及其他各种性质的价外收费。',
          },
          {
            law: '《企业所得税法》',
            article: '第六条',
            text: '企业以货币形式和非货币形式从各种来源取得的收入，为收入总额。包括：销售货物收入；提供劳务收入；转让财产收入；股息、红利等权益性投资收益；利息收入；租金收入；特许权使用费收入；接受捐赠收入；其他收入。',
          },
        ],
        tips: [
          '关键区分：销售方收取的违约金是"价外费用"需缴增值税并开票；采购方收取的违约金因无销售行为不征增值税，可开具收款收据。',
          '支付方取得违约金支出税前扣除时，应备齐合同、付款凭证、收款方收据或发票等资料。',
          '增值税价外费用需做价税分离，直接用违约金乘税率会多缴税。',
        ],
      };
    },
  },

  /* ── 社保公积金与用工成本 ── */
  {
    id: 'social-insurance',
    name: '社保公积金与用工成本',
    category: 'tax',
    glyph: '保',
    summary: '五险一金单位与个人负担测算，得出企业实际用工总成本',
    keywords: ['社保', '公积金', '用工成本', '五险一金'],
    fields: [
      { key: 'salary', label: '月工资（应发）', type: 'money', unit: '元', defaultValue: 15000 },
      { key: 'base', label: '社保缴费基数', type: 'money', unit: '元', defaultValue: 15000, hint: '按当地上下限核定，填 0 表示同工资' },
      { key: 'pensionE', label: '养老保险单位比例', type: 'percent', unit: '%', defaultValue: 16 },
      { key: 'medicalE', label: '医疗保险单位比例', type: 'percent', unit: '%', defaultValue: 8 },
      { key: 'unemployE', label: '失业保险单位比例', type: 'percent', unit: '%', defaultValue: 0.5 },
      { key: 'injuryE', label: '工伤保险单位比例', type: 'percent', unit: '%', defaultValue: 0.4 },
      { key: 'maternityE', label: '生育保险单位比例', type: 'percent', unit: '%', defaultValue: 0.8 },
      { key: 'fundE', label: '住房公积金单位比例', type: 'percent', unit: '%', defaultValue: 12 },
      { key: 'fundP', label: '住房公积金个人比例', type: 'percent', unit: '%', defaultValue: 12 },
      { key: 'months', label: '计算月数', type: 'number', unit: '月', defaultValue: 12 },
    ],
    calc(values): CalcOutput {
      const salary = toNum(values.salary);
      let base = toNum(values.base) || salary;
      const months = Math.max(1, toNum(values.months, 12));

      const items = [
        { name: '养老保险', e: toNum(values.pensionE), p: 8 },
        { name: '医疗保险', e: toNum(values.medicalE), p: 2 },
        { name: '失业保险', e: toNum(values.unemployE), p: 0.5 },
        { name: '工伤保险', e: toNum(values.injuryE), p: 0 },
        { name: '生育保险', e: toNum(values.maternityE), p: 0 },
        { name: '住房公积金', e: toNum(values.fundE), p: toNum(values.fundP) },
      ];

      const steps: StepRow[] = [{ label: '缴费基数', value: `${money(base)} 元` }];

      let eTotal = 0;
      let pTotal = 0;
      items.forEach((it) => {
        const e = round(base * (it.e / 100), 2);
        const p = round(base * (it.p / 100), 2);
        eTotal = round(eTotal + e, 2);
        pTotal = round(pTotal + p, 2);
        steps.push({
          label: it.name,
          value: `单位 ${money(e)}（${it.e}%）+ 个人 ${money(p)}（${it.p}%）= ${money(round(e + p, 2))} 元`,
        });
      });

      steps.push({ label: '单位负担合计（月）', value: `${money(eTotal)} 元`, emphasis: true });
      steps.push({ label: '个人负担合计（月）', value: `${money(pTotal)} 元`, emphasis: true });

      const employerCost = round(salary + eTotal, 2);
      steps.push({
        label: '企业实际用工成本（月）',
        value: `${money(salary)} + ${money(eTotal)} = ${money(employerCost)} 元`,
        emphasis: true,
      });

      const netPay = round(salary - pTotal, 2);
      steps.push({ label: '员工实发（未扣个税）', value: `${money(salary)} − ${money(pTotal)} = ${money(netPay)} 元`, note: '尚未扣减个人所得税' });

      const yearCost = round(employerCost * months, 2);
      steps.push({ label: `年度用工成本（${months} 个月）`, value: `${money(yearCost)} 元`, emphasis: true });

      return {
        main: { label: '企业月用工总成本', value: money(employerCost), unit: '元', sub: moneyToChinese(employerCost) },
        blocks: [
          { label: '单位社保公积金（月）', value: money(eTotal), unit: '元' },
          { label: '个人社保公积金（月）', value: money(pTotal), unit: '元' },
          { label: '员工实发（未扣个税）', value: money(netPay), unit: '元' },
          { label: '五险一金占工资比（单位侧）', value: `${((eTotal / Math.max(salary, 1)) * 100).toFixed(2)}%` },
          { label: `年度用工成本（${months} 个月）`, value: money(yearCost), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《社会保险法》',
            article: '第五十八条',
            text: '用人单位应当自用工之日起三十日内为其职工向社会保险经办机构申请办理社会保险登记。未办理社会保险登记的，由社会保险经办机构核定其应当缴纳的社会保险费。',
          },
          {
            law: '《住房公积金管理条例》',
            article: '第十六条',
            text: '职工住房公积金的月缴存额为职工本人上一年度月平均工资乘以职工住房公积金缴存比例。单位为职工缴存的住房公积金的月缴存额为职工本人上一年度月平均工资乘以单位住房公积金缴存比例。',
          },
        ],
        tips: [
          '各地社保费率、缴费基数上下限差异较大，请按参保地当年公布的参数调整。',
          '生育保险在多数地区已并入医疗保险，合并计算即可，不必单独填列。',
          '用工成本通常比名义工资高出 30%—45%，裁员赔偿、招聘预算测算时务必按全口径成本计算。',
          '未足额缴纳社保的，劳动者可据此被迫解除劳动合同并主张经济补偿，是高频败诉风险点。',
        ],
      };
    },
  },
];
