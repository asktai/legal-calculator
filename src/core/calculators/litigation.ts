/**
 * 一、诉讼费用类计算器
 * 依据：《诉讼费用交纳办法》（国务院令第481号，2007年4月1日施行）
 *      《律师服务收费管理办法》（发改价格〔2006〕611号）
 */
import type { CalculatorDef, CalcOutput, StepRow, ResultBlock } from '../types';
import { money, round, toNum, toStr, moneyToChinese } from '../format';
import {
  CIVIL_FEE_TIERS,
  PRESERVATION_TIERS,
  PRESERVATION_CAP,
  EXECUTION_TIERS,
  BANKRUPTCY_CAP,
  progressive,
} from '../progressive';

const HALF_OPTIONS = [
  { label: '不适用减半', value: 'none' },
  { label: '适用简易程序（减半交纳）', value: 'simple' },
  { label: '调解结案或撤诉（减半交纳）', value: 'mediate' },
  { label: '反诉/有独立请求权第三人（减半交纳）', value: 'counterclaim' },
];

const COMMON_BASIS = [
  {
    law: '《诉讼费用交纳办法》',
    article: '第十三条',
    text: '案件受理费分别按照财产案件与非财产案件的标准分段累计交纳。',
  },
  {
    law: '《诉讼费用交纳办法》',
    article: '第十六条',
    text: '适用简易程序审理的案件减半交纳案件受理费。',
  },
  {
    law: '《诉讼费用交纳办法》',
    article: '第十五条',
    text: '以调解方式结案或者当事人申请撤诉的，减半交纳案件受理费。',
  },
];

export const litigationCalculators: CalculatorDef[] = [
  /* ── 财产案件受理费 ── */
  {
    id: 'civil-fee',
    name: '财产案件受理费',
    category: 'litigation',
    glyph: '诉',
    summary: '按诉讼请求金额超额累进计算一、二审案件受理费',
    keywords: ['受理费', '诉讼费', '标的额', '财产案件'],
    fields: [
      {
        key: 'amount',
        label: '诉讼请求金额',
        type: 'money',
        unit: '元',
        defaultValue: 500000,
        placeholder: '如 500000',
        hint: '以起诉状主张的金钱给付总额为准',
        shared: true,
      },
      { key: 'half', label: '减半情形', type: 'select', options: HALF_OPTIONS, defaultValue: 'none' },
      {
        key: 'instance',
        label: '审级',
        type: 'select',
        defaultValue: 'first',
        options: [
          { label: '一审', value: 'first' },
          { label: '二审（上诉，按一审标准交纳）', value: 'second' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const half = toStr(values.half, 'none');
      const instance = toStr(values.instance, 'first');

      const { total, lines } = progressive(amount, CIVIL_FEE_TIERS);
      const discounted = half !== 'none' ? round(total / 2, 2) : total;

      const steps: StepRow[] = lines.map((l) => ({
        label: l.desc,
        value: `${money(l.base)} × ${l.rateText.replace('× ', '')} = ${money(l.amount)} 元`,
      }));
      steps.push({
        label: '分段累计合计',
        value: `${money(total)} 元`,
        emphasis: true,
      });
      if (half !== 'none') {
        const reason =
          half === 'simple'
            ? '适用简易程序'
            : half === 'mediate'
              ? '调解结案 / 撤诉'
              : '反诉或第三人提出独立请求';
        steps.push({
          label: `减半（${reason}）`,
          value: `${money(total)} ÷ 2 = ${money(discounted)} 元`,
          note: '《诉讼费用交纳办法》第十五条、第十六条',
        });
      }
      if (instance === 'second') {
        steps.push({
          label: '审级说明',
          value: '上诉案件受理费按一审标准交纳',
          note: '对不予受理、驳回起诉、管辖权异议裁定上诉的，不交纳受理费',
        });
      }

      return {
        main: {
          label: half !== 'none' ? '应交纳案件受理费（已减半）' : '应交纳案件受理费',
          value: money(discounted),
          unit: '元',
          sub: moneyToChinese(discounted),
        },
        blocks: [
          { label: '原始标准金额', value: money(total), unit: '元' },
          { label: '有效费率', value: `${((discounted / Math.max(amount, 1)) * 100).toFixed(3)}%`, sub: '占标的额比例' },
        ],
        steps,
        basis: COMMON_BASIS,
        tips: [
          '原告自接到缴费通知次日起 7 日内交纳；逾期按自动撤诉处理。',
          '案件审理中增加诉讼请求金额的，按增加后的金额补交差额。',
          '标的额跨档时务必按"分段累计"计算，切勿用总额乘单一费率。',
        ],
      };
    },
  },

  /* ── 非财产案件受理费 ── */
  {
    id: 'non-property-fee',
    name: '非财产案件受理费',
    category: 'litigation',
    glyph: '非',
    summary: '离婚、人格权、劳动争议等非财产案件的受理费标准',
    keywords: ['离婚', '名誉权', '劳动争议', '非财产'],
    fields: [
      {
        key: 'caseType',
        label: '案件类型',
        type: 'select',
        defaultValue: 'divorce',
        options: [
          { label: '离婚案件', value: 'divorce' },
          { label: '侵害人格权案件', value: 'personality' },
          { label: '知识产权民事案件（无争议金额）', value: 'ip' },
          { label: '劳动争议案件', value: 'labor' },
          { label: '其他非财产案件', value: 'other' },
        ],
      },
      {
        key: 'propertyAmount',
        label: '涉及财产争议金额',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '离婚案件为待分割财产总额；人格权案件为赔偿请求额',
        visibleWhen: (v) => toStr(v.caseType) === 'divorce' || toStr(v.caseType) === 'personality',
      },
      {
        key: 'ipAmount',
        label: '知识产权争议金额',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '有争议金额的按财产案件标准交纳；无争议金额填 0',
        visibleWhen: (v) => toStr(v.caseType) === 'ip',
      },
    ],
    calc(values): CalcOutput {
      const type = toStr(values.caseType, 'divorce');
      const pa = toNum(values.propertyAmount);
      const ipa = toNum(values.ipAmount);
      const steps: StepRow[] = [];
      let total = 0;
      let mainLabel = '应交纳案件受理费';

      if (type === 'divorce') {
        total = 200; // 实践常用中位值：50—300 元区间
        steps.push({ label: '基础受理费', value: '50 ~ 300 元（各省在此幅度内确定）', note: '本工具按中位值 200 元估算' });
        if (pa > 200000) {
          const extra = round((pa - 200000) * 0.005, 2);
          total = round(total + extra, 2);
          steps.push({
            label: '财产分割超过 20 万元部分',
            value: `${money(pa - 200000)} × 0.5% = ${money(extra)} 元`,
          });
        } else if (pa > 0) {
          steps.push({ label: '财产分割未超 20 万元', value: '不另行加收', note: '仍按件收取基础受理费' });
        }
        mainLabel = '离婚案件受理费（估算）';
      } else if (type === 'personality') {
        total = 300;
        steps.push({ label: '基础受理费', value: '100 ~ 500 元（各省在此幅度内确定）', note: '本工具按中位值 300 元估算' });
        if (pa > 100000) {
          const s1 = round(50000 * 0.01, 2);
          const s2 = round((pa - 100000) * 0.005, 2);
          total = round(total + s1 + s2, 2);
          steps.push({ label: '损害赔偿 5 万—10 万元部分', value: `50,000 × 1% = ${money(s1)} 元` });
          steps.push({ label: '损害赔偿超过 10 万元部分', value: `${money(pa - 100000)} × 0.5% = ${money(s2)} 元` });
        } else if (pa > 50000) {
          const s1 = round((pa - 50000) * 0.01, 2);
          total = round(total + s1, 2);
          steps.push({ label: '损害赔偿超过 5 万元部分', value: `${money(pa - 50000)} × 1% = ${money(s1)} 元` });
        }
        mainLabel = '人格权案件受理费（估算）';
      } else if (type === 'labor') {
        total = 10;
        steps.push({ label: '劳动争议案件', value: '每件 10 元', note: '《诉讼费用交纳办法》第十三条第（四）项' });
        mainLabel = '劳动争议案件受理费';
      } else if (type === 'ip') {
        if (ipa > 0) {
          const r = progressive(ipa, CIVIL_FEE_TIERS);
          total = r.total;
          steps.push({ label: '有争议金额，按财产案件标准', value: `标的 ${money(ipa)} 元 → ${money(total)} 元` });
          r.lines.forEach((l) =>
            steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} 元` }),
          );
        } else {
          total = 750;
          steps.push({ label: '无争议金额', value: '500 ~ 1000 元（按中位值 750 元估算）' });
        }
        mainLabel = '知识产权案件受理费（估算）';
      } else {
        total = 75;
        steps.push({ label: '其他非财产案件', value: '50 ~ 100 元（按中位值 75 元估算）' });
        mainLabel = '其他非财产案件受理费（估算）';
      }

      return {
        main: { label: mainLabel, value: money(total), unit: '元', sub: moneyToChinese(total) },
        steps,
        basis: [
          {
            law: '《诉讼费用交纳办法》',
            article: '第十三条第（二）项',
            text: '非财产案件按照下列标准交纳：离婚案件每件交纳50元至300元。涉及财产分割，财产总额不超过20万元的，不另行交纳；超过20万元的部分，按照0.5%交纳。',
          },
          {
            law: '《诉讼费用交纳办法》',
            article: '第十三条第（三）项',
            text: '侵害姓名权、名称权、肖像权、名誉权、荣誉权以及其他人格权的案件，每件交纳100元至500元。涉及损害赔偿，赔偿金额不超过5万元的，不另行交纳；超过5万元至10万元的部分，按照1%交纳；超过10万元的部分，按照0.5%交纳。',
          },
          {
            law: '《诉讼费用交纳办法》',
            article: '第十三条第（四）项',
            text: '劳动争议案件每件交纳10元。',
          },
        ],
        tips: [
          '按件收取的具体数额由各省、自治区、直辖市人民政府在法定幅度内确定，办理前请核对当地标准。',
          '劳动争议案件每件仅 10 元，仲裁阶段不收费，维权成本极低。',
        ],
      };
    },
  },

  /* ── 财产保全申请费（法院收） ── */
  {
    id: 'preservation-fee',
    name: '财产保全费',
    category: 'litigation',
    glyph: '保',
    summary: '向法院申请查封、扣押、冻结应交的保全申请费，按实际保全财产数额累进，5,000 元封顶',
    keywords: ['保全费', '保全申请费', '查封', '冻结', '诉前保全', '诉中保全'],
    fields: [
      {
        key: 'amount',
        label: '请求保全的财产数额',
        type: 'money',
        unit: '元',
        defaultValue: 1000000,
        hint: '以申请保全的财产价值或请求金额为限',
        shared: true,
      },
      {
        key: 'type',
        label: '保全类型',
        type: 'select',
        defaultValue: 'normal',
        options: [
          { label: '一般财产保全', value: 'normal' },
          { label: '诉前行为保全（如禁令）', value: 'conduct' },
          { label: '证据保全', value: 'evidence' },
        ],
        hint: '行为保全与证据保全无财产数额，实务中按件收费，以法院通知为准',
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const type = toStr(values.type, 'normal');

      const { total, lines } = progressive(amount, PRESERVATION_TIERS);
      const capped = Math.min(total, PRESERVATION_CAP);
      const steps: StepRow[] = lines.map((l) => ({
        label: l.desc,
        value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} 元`,
      }));
      steps.push({ label: '分段累计', value: `${money(total)} 元`, emphasis: true });
      if (total > PRESERVATION_CAP) {
        steps.push({
          label: '适用封顶',
          value: `超出 ${money(PRESERVATION_CAP)} 元，按 ${money(PRESERVATION_CAP)} 元交纳`,
          note: '《诉讼费用交纳办法》第十四条第（三）项',
          emphasis: true,
        });
        steps.push({
          label: '封顶减负',
          value: `${money(total)} − ${money(PRESERVATION_CAP)} = 少交 ${money(round(total - PRESERVATION_CAP, 2))} 元`,
        });
      }
      if (type !== 'normal') {
        steps.push({
          label: type === 'evidence' ? '证据保全' : '行为保全',
          value: '无财产数额可比，实务中按件收取，以法院通知为准',
          note: '如法院按件收费，本结果仅供参考',
        });
      }

      return {
        main: {
          label: '保全申请费（法院）',
          value: money(capped),
          unit: '元',
          sub: moneyToChinese(capped),
        },
        blocks: [
          { label: '保全财产数额', value: money(amount), unit: '元' },
          { label: '分段累计（未封顶）', value: money(total), unit: '元' },
          {
            label: '是否需要担保',
            value: '需要',
            sub: '担保费用另计，见「财产保全担保费」',
          },
        ],
        steps,
        basis: [
          {
            law: '《诉讼费用交纳办法》',
            article: '第十四条第（三）项',
            text: '申请保全措施的，根据实际保全的财产数额按照下列标准交纳：财产数额不超过1000元或者不涉及财产数额的，每件交纳30元；超过1000元至10万元的部分，按照1%交纳；超过10万元的部分，按照0.5%交纳。但是，当事人申请保全措施交纳的费用最多不超过5000元。',
          },
          {
            law: '《民事诉讼法》',
            article: '第一百零三条',
            text: '人民法院对于可能因当事人一方的行为或者其他原因，使判决难以执行或者造成当事人其他损害的案件，根据对方当事人的申请，可以裁定对其财产进行保全、责令其作出一定行为或者禁止其作出一定行为；当事人没有提出申请的，人民法院在必要时也可以裁定采取保全措施。人民法院采取保全措施，可以责令申请人提供担保，申请人不提供担保的，裁定驳回申请。',
          },
        ],
        tips: [
          '保全申请费 5,000 元封顶：标的额超过约 89 万元后即封顶，此后增加标的额不再多交申请费。',
          '申请费由申请人在提出申请时预交，最终由败诉方负担；部分撤诉或保全错误的情形按实际情况分担。',
          '超标的保全可能被认定为保全错误，需承担赔偿责任，请求保全的数额应与债权额相当。',
          '保全的实际成本大头往往是担保费而非申请费——担保费请用「财产保全担保费」单独测算。',
        ],
      };
    },
  },

  /* ── 财产保全担保费（保险公司 / 银行收） ── */
  {
    id: 'preservation-guarantee-fee',
    name: '财产保全担保费',
    category: 'litigation',
    glyph: '担',
    summary: '法院要求提供担保时，购买保全责任保险或银行保函所付的费用（非法院收取）',
    keywords: ['保全担保费', '保全保险费', '保函费', '保全责任保险', '担保'],
    fields: [
      {
        key: 'amount',
        label: '需担保的保全财产数额',
        type: 'money',
        unit: '元',
        defaultValue: 1000000,
        hint: '通常与保全财产数额一致；法院降低担保比例时按法院要求填',
        shared: true,
        emphasis: true,
      },
      {
        key: 'guarantee',
        label: '担保方式',
        type: 'select',
        defaultValue: 'insurance',
        options: [
          { label: '保险公司保全责任保险（最常见）', value: 'insurance' },
          { label: '银行保函（需付手续费）', value: 'bank' },
          { label: '现金担保（全额冻结，无费用）', value: 'cash' },
          { label: '无需担保（如法院准许免担保）', value: 'none' },
        ],
      },
      {
        key: 'guaranteeRate',
        label: '保函费率',
        type: 'number',
        unit: '‰/年',
        defaultValue: 0.8,
        step: 0.1,
        hint: '市场常见区间 0.5‰—1.5‰/年，按保险公司实际报价填写',
        visibleWhen: (v) => ['insurance', 'bank'].includes(toStr(v.guarantee)),
      },
      {
        key: 'years',
        label: '担保期限',
        type: 'number',
        unit: '年',
        defaultValue: 1,
        step: 0.5,
        hint: '诉前保全 30 日内须起诉；诉中保全一般至判决生效，按实际需要出具保函的年限填写',
        visibleWhen: (v) => ['insurance', 'bank'].includes(toStr(v.guarantee)),
      },
      {
        key: 'minPremium',
        label: '最低保费',
        type: 'money',
        unit: '元',
        defaultValue: 500,
        hint: '多数保险公司设有单笔最低保费，填 0 表示不设下限',
        visibleWhen: (v) => ['insurance', 'bank'].includes(toStr(v.guarantee)),
      },
      {
        key: 'lpr',
        label: '现金担保的资金成本利率',
        type: 'percent',
        unit: '%',
        defaultValue: 3.1,
        step: 0.05,
        hint: '现金被全额冻结的机会成本，按同期一年期 LPR 估算；非现金担保时不生效',
        visibleWhen: (v) => toStr(v.guarantee) === 'cash',
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const guarantee = toStr(values.guarantee, 'insurance');
      const rate = toNum(values.guaranteeRate, 0.8);
      const years = Math.max(0, toNum(values.years, 1));
      const minPremium = toNum(values.minPremium);
      const lpr = toNum(values.lpr, 3.1) / 100;

      const label = guarantee === 'bank' ? '银行保函手续费' : '保全保险费';
      const steps: StepRow[] = [
        { label: '需担保的保全财产数额', value: `${money(amount)} 元` },
      ];

      if (guarantee === 'insurance' || guarantee === 'bank') {
        const raw = round((amount * rate * years) / 1000, 2);
        const premium = Math.max(raw, minPremium);
        steps.push({
          label: `${label}（按 ${rate}‰/年 × ${years} 年）`,
          value: `${money(amount)} × ${rate}‰ × ${years} 年 = ${money(raw)} 元`,
          note: '费率以承保机构实际报价为准',
        });
        if (minPremium > 0 && raw < minPremium) {
          steps.push({
            label: '低于最低保费，按最低保费计收',
            value: `${money(minPremium)} 元`,
            emphasis: true,
          });
        }
        steps.push({
          label: '折算费率',
          value: `占保全数额 ${round((premium / Math.max(amount, 1)) * 100, 3)}%`,
          emphasis: true,
        });
        return {
          main: { label, value: money(premium), unit: '元', sub: moneyToChinese(premium) },
          blocks: [
            { label: '按费率计算', value: money(raw), unit: '元' },
            { label: '需担保的保全财产数额', value: money(amount), unit: '元' },
            { label: '折算费率', value: `${round((premium / Math.max(amount, 1)) * 100, 3)}%`, sub: '占保全数额' },
          ],
          steps,
          basis: [
            {
              law: '《民事诉讼法》',
              article: '第一百零三条',
              text: '人民法院采取保全措施，可以责令申请人提供担保，申请人不提供担保的，裁定驳回申请。',
            },
            {
              law: '《最高人民法院关于人民法院办理财产保全案件若干问题的规定》',
              article: '第五条',
              text: '人民法院依照民事诉讼法第一百条、第一百零一条规定责令申请保全人提供财产保全担保的，担保数额不超过请求保全数额的百分之三十；申请保全的财产系争议标的的，担保数额不超过争议标的价值的百分之三十。',
            },
            {
              law: '《最高人民法院关于人民法院办理财产保全案件若干问题的规定》',
              article: '第八条',
              text: '金融监管部门批准设立的金融机构以独立保函形式为财产保全提供担保的，人民法院应当依法准许。',
            },
          ],
          tips: [
            '担保费不是法院收取的诉讼费，而是付给保险公司或银行的费用，一般不列入案件受理费。',
            '担保数额法定上限为请求保全数额的 30%（争议标的为标的价值的 30%），保函按实际担保数额出具即可，不必按全额。',
            '保全责任保险费属为实现债权支出的合理费用，部分法院支持由败诉方负担，但口径不一，主张时应一并列入诉讼请求。',
            '诉前保全须在采取措施后 30 日内起诉，逾期解除保全且保费一般不退，投保前先确认起诉时点。',
          ],
        };
      }

      if (guarantee === 'cash') {
        const cost = round(amount * lpr * years, 2);
        steps.push({
          label: '现金担保',
          value: `${money(amount)} 元全额冻结`,
          note: '不产生外部费用，但占用资金',
        });
        steps.push({
          label: '资金占用成本（机会成本）',
          value: `${money(amount)} × ${round(lpr * 100, 2)}% × ${years} 年 = ${money(cost)} 元`,
          note: '按同期 LPR 估算，非实际支出',
          emphasis: true,
        });
        return {
          main: { label: '现金担保（外部费用 0 元）', value: '0.00', unit: '元', sub: `冻结 ${money(amount)} 元，占用成本约 ${money(cost)} 元` },
          blocks: [
            { label: '冻结金额', value: money(amount), unit: '元' },
            { label: '资金占用成本', value: money(cost), unit: '元', sub: `按 LPR ${round(lpr * 100, 2)}% 估算` },
          ],
          steps,
          basis: [
            {
              law: '《民事诉讼法》',
              article: '第一百零三条',
              text: '人民法院采取保全措施，可以责令申请人提供担保，申请人不提供担保的，裁定驳回申请。',
            },
          ],
          tips: [
            '现金担保不产生支付给外部的费用，但资金被全额冻结，机会成本往往高于买保函。',
            '资金占用成本按同期 LPR 估算，仅作决策参考，不是实际支出。',
            '现金担保解保后可全额退回，保函费则不予退还。',
          ],
        };
      }

      steps.push({ label: '担保方式', value: '无需担保，不产生费用' });
      return {
        main: { label: '担保费', value: '0.00', unit: '元', sub: '法院准许免担保' },
        blocks: [{ label: '需担保的保全财产数额', value: money(amount), unit: '元' }],
        steps,
        basis: [
          {
            law: '《民事诉讼法》',
            article: '第一百零三条',
            text: '人民法院采取保全措施，可以责令申请人提供担保——即担保并非一律强制，法院可裁量免除。',
          },
        ],
        tips: ['免担保多为追索赡养费、抚养费、抚恤金、医疗费用、劳动报酬等情形，是否准许由法院裁量。'],
      };
    },
  },

  /* ── 执行申请费 ── */
  {
    id: 'execution-fee',
    name: '执行申请费',
    category: 'litigation',
    glyph: '执',
    summary: '按执行金额计算申请强制执行应交费用（执行后由被执行人负担）',
    keywords: ['执行费', '强制执行', '申请执行'],
    fields: [
      {
        key: 'amount',
        label: '申请执行金额',
        type: 'money',
        unit: '元',
        defaultValue: 1000000,
        hint: '含本金、已确定利息及迟延履行利息',
      },
      {
        key: 'hasAmount',
        label: '是否有明确执行金额',
        type: 'switch',
        defaultValue: true,
        hint: '行为给付类执行无金额，按件收取 50—500 元',
      },
      {
        key: 'recovered',
        label: '预计实际执行到位金额',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '用于估算实际回收率，填 0 表示不计',
      },
    ],
    calc(values): CalcOutput {
      const hasAmount = values.hasAmount !== false && values.hasAmount !== 'false';
      const amount = toNum(values.amount);
      const recovered = toNum(values.recovered);
      const steps: StepRow[] = [];
      let total = 0;

      if (hasAmount) {
        const { total: t, lines } = progressive(amount, EXECUTION_TIERS);
        total = t;
        lines.forEach((l) =>
          steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} 元` }),
        );
        steps.push({ label: '分段累计合计', value: `${money(total)} 元`, emphasis: true });
      } else {
        total = 200;
        steps.push({ label: '无执行金额', value: '每件 50 ~ 500 元（按中位值 200 元估算）' });
      }

      steps.push({
        label: '费用负担',
        value: '无需申请人预交，执行后由被执行人负担',
        note: '《诉讼费用交纳办法》第二十条',
      });

      const blocks: ResultBlock[] = [{ label: '申请执行金额', value: money(amount), unit: '元' }];
      if (recovered > 0) {
        blocks.push({
          label: '扣除执行费后实得',
          value: money(round(recovered - Math.min(total, recovered), 2)),
          unit: '元',
          sub: `执行费率 ${((total / Math.max(recovered, 1)) * 100).toFixed(2)}%`,
        });
      }

      return {
        main: { label: '执行申请费', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          {
            law: '《诉讼费用交纳办法》',
            article: '第十四条第（一）项',
            text: '依法申请执行人民法院发生法律效力的判决、裁定、调解书，仲裁机构依法作出的裁决和调解书，公证机构依法赋予强制执行效力的债权文书，按下列标准交纳：没有执行金额或者价额的，每件交纳50元至500元。执行金额或者价额不超过1万元的，每件交纳50元；超过1万元至50万元的部分，按照1.5%交纳；超过50万元至500万元的部分，按照1%交纳；超过500万元至1000万元的部分，按照0.5%交纳；超过1000万元的部分，按照0.1%交纳。',
          },
          {
            law: '《诉讼费用交纳办法》',
            article: '第二十条',
            text: '执行申请费执行后交纳，由被执行人负担。',
          },
        ],
        tips: [
          '执行申请费最大的实务优势是"执行后交纳"，申请人无需垫付，大幅降低维权门槛。',
          '申请执行的期间为二年，适用诉讼时效中止、中断的规定。',
        ],
      };
    },
  },

  /* ── 支付令 / 其他申请费 ── */
  {
    id: 'application-fee',
    name: '支付令及其他申请费',
    category: 'litigation',
    glyph: '申',
    summary: '支付令、公示催告、撤销仲裁裁决等申请的收费标准',
    keywords: ['支付令', '公示催告', '仲裁', '申请费'],
    fields: [
      {
        key: 'appType',
        label: '申请事项',
        type: 'select',
        defaultValue: 'payment',
        options: [
          { label: '申请支付令', value: 'payment' },
          { label: '申请公示催告', value: 'public' },
          { label: '申请撤销仲裁裁决 / 认定仲裁协议效力', value: 'arbitration' },
          { label: '申请承认与执行外国判决、仲裁裁决', value: 'foreign' },
          { label: '申请破产', value: 'bankruptcy' },
        ],
      },
      {
        key: 'amount',
        label: '涉及金额',
        type: 'money',
        unit: '元',
        defaultValue: 200000,
        hint: '支付令按财产案件标准的 1/3；破产按财产总额减半，30 万封顶',
        visibleWhen: (v) => ['payment', 'bankruptcy'].includes(toStr(v.appType)),
      },
    ],
    calc(values): CalcOutput {
      const t = toStr(values.appType, 'payment');
      const amount = toNum(values.amount);
      const steps: StepRow[] = [];
      let total = 0;
      let label = '';

      if (t === 'payment') {
        const { total: full } = progressive(amount, CIVIL_FEE_TIERS);
        total = round(full / 3, 2);
        label = '支付令申请费';
        steps.push({ label: '比照财产案件受理费', value: `标准费用 ${money(full)} 元` });
        steps.push({ label: '按三分之一交纳', value: `${money(full)} ÷ 3 = ${money(total)} 元`, emphasis: true });
      } else if (t === 'public') {
        total = 100;
        label = '公示催告申请费';
        steps.push({ label: '按件收取', value: '每件 100 元' });
      } else if (t === 'arbitration') {
        total = 400;
        label = '申请撤销仲裁裁决 / 认定仲裁协议效力';
        steps.push({ label: '按件收取', value: '每件 400 元', note: '申请认定仲裁协议效力同样为每件 400 元' });
      } else if (t === 'foreign') {
        total = 500;
        label = '承认与执行外国判决、仲裁裁决';
        steps.push({ label: '按件收取', value: '每件 500 元' });
      } else {
        const { total: full } = progressive(amount, CIVIL_FEE_TIERS);
        const half = round(full / 2, 2);
        total = Math.min(half, BANKRUPTCY_CAP);
        label = '破产案件申请费';
        steps.push({ label: '按财产案件受理费标准', value: `${money(full)} 元` });
        steps.push({ label: '减半交纳', value: `${money(full)} ÷ 2 = ${money(half)} 元` });
        if (half > BANKRUPTCY_CAP) {
          steps.push({ label: '适用 30 万元封顶', value: `按 ${money(BANKRUPTCY_CAP)} 元交纳`, emphasis: true });
        }
      }

      return {
        main: { label, value: money(total), unit: '元', sub: moneyToChinese(total) },
        steps,
        basis: [
          {
            law: '《诉讼费用交纳办法》',
            article: '第十四条',
            text: '申请费分别按照下列标准交纳：依法申请支付令的，比照财产案件受理费标准的三分之一交纳；依法申请公示催告的，每件交纳100元；申请撤销仲裁裁决或者认定仲裁协议效力的，每件交纳400元；申请承认和执行外国判决、仲裁裁决的，每件交纳500元。破产案件依据破产财产总额计算，按照财产案件受理费标准减半交纳，但是最高不超过30万元。',
          },
        ],
        tips: [
          '支付令是非诉催款的低成本路径：费用仅为普通诉讼的 1/3，且无需开庭。',
          '支付令发出后，债务人 15 日内提出书面异议即失效，转为诉讼程序，适合债权债务关系清晰无争议的案件。',
        ],
      };
    },
  },

  /* ── 律师费 ── */
  {
    id: 'lawyer-fee',
    name: '律师服务费',
    category: 'litigation',
    glyph: '律',
    summary: '计件、按标的额比例、计时与风险代理四种计费方式测算',
    keywords: ['律师费', '风险代理', '计时收费', '代理费'],
    fields: [
      {
        key: 'mode',
        label: '计费方式',
        type: 'select',
        defaultValue: 'proportion',
        options: [
          { label: '按标的额比例', value: 'proportion' },
          { label: '计件收费', value: 'fixed' },
          { label: '计时收费', value: 'hourly' },
          { label: '风险代理', value: 'contingency' },
        ],
      },
      {
        key: 'amount',
        label: '争议标的额',
        emphasis: true,
        type: 'money',
        unit: '元',
        defaultValue: 1000000,
        visibleWhen: (v) => ['proportion', 'contingency'].includes(toStr(v.mode)),
      },
      {
        key: 'rate',
        label: '约定费率',
        type: 'percent',
        unit: '%',
        defaultValue: 5,
        hint: '常规代理常见区间 3%—8%，各地指导价不同',
        visibleWhen: (v) => toStr(v.mode) === 'proportion',
      },
      {
        key: 'minFee',
        label: '最低收费',
        type: 'money',
        unit: '元',
        defaultValue: 5000,
        visibleWhen: (v) => toStr(v.mode) === 'proportion',
      },
      {
        key: 'fixedFee',
        label: '每件收费',
        type: 'money',
        unit: '元',
        defaultValue: 30000,
        visibleWhen: (v) => toStr(v.mode) === 'fixed',
      },
      {
        key: 'hours',
        label: '预计工作小时',
        type: 'number',
        unit: '小时',
        defaultValue: 60,
        visibleWhen: (v) => toStr(v.mode) === 'hourly',
      },
      {
        key: 'hourlyRate',
        label: '小时费率',
        type: 'money',
        unit: '元/小时',
        defaultValue: 2000,
        visibleWhen: (v) => toStr(v.mode) === 'hourly',
      },
      {
        key: 'baseFee',
        label: '基础代理费（预付）',
        type: 'money',
        unit: '元',
        defaultValue: 20000,
        visibleWhen: (v) => toStr(v.mode) === 'contingency',
      },
      {
        key: 'contingencyRate',
        label: '风险代理提成比例',
        type: 'percent',
        unit: '%',
        defaultValue: 15,
        hint: '法定上限为标的额的 30%',
        visibleWhen: (v) => toStr(v.mode) === 'contingency',
      },
      {
        key: 'recoveryRate',
        label: '预计回款率',
        type: 'percent',
        unit: '%',
        defaultValue: 80,
        visibleWhen: (v) => toStr(v.mode) === 'contingency',
      },
    ],
    calc(values): CalcOutput {
      const mode = toStr(values.mode, 'proportion');
      const amount = toNum(values.amount);
      const steps: StepRow[] = [];
      let total = 0;
      let mainLabel = '律师服务费';
      let blocks: ResultBlock[] = [];

      if (mode === 'proportion') {
        const rate = toNum(values.rate) / 100;
        const minFee = toNum(values.minFee);
        const raw = round(amount * rate, 2);
        total = Math.max(raw, minFee);
        mainLabel = '律师费（按标的额比例）';
        steps.push({ label: '标的额 × 费率', value: `${money(amount)} × ${toNum(values.rate)}% = ${money(raw)} 元` });
        if (raw < minFee) {
          steps.push({ label: '低于最低收费，按最低收费', value: `${money(minFee)} 元`, emphasis: true });
        }
        blocks = [{ label: '有效费率', value: `${((total / Math.max(amount, 1)) * 100).toFixed(2)}%` }];
      } else if (mode === 'fixed') {
        total = toNum(values.fixedFee);
        mainLabel = '律师费（计件）';
        steps.push({ label: '每件固定收费', value: `${money(total)} 元` });
      } else if (mode === 'hourly') {
        const h = toNum(values.hours);
        const r = toNum(values.hourlyRate);
        total = round(h * r, 2);
        mainLabel = '律师费（计时）';
        steps.push({ label: '工作小时 × 小时费率', value: `${h} 小时 × ${money(r)} 元 = ${money(total)} 元` });
        blocks = [{ label: '折合工作日', value: `${(h / 8).toFixed(1)} 天`, sub: '按 8 小时/工作日' }];
      } else {
        const base = toNum(values.baseFee);
        const cr = toNum(values.contingencyRate) / 100;
        const recovery = amount * (toNum(values.recoveryRate) / 100);
        const contingent = round(recovery * cr, 2);
        total = round(base + contingent, 2);
        mainLabel = '律师费（风险代理）';
        steps.push({ label: '预计回款', value: `${money(amount)} × ${toNum(values.recoveryRate)}% = ${money(recovery)} 元` });
        steps.push({ label: '风险提成', value: `${money(recovery)} × ${toNum(values.contingencyRate)}% = ${money(contingent)} 元` });
        steps.push({ label: '合计（基础费 + 提成）', value: `${money(base)} + ${money(contingent)} = ${money(total)} 元`, emphasis: true });

        const cap = round(amount * 0.3, 2);
        const share = round((total / Math.max(recovery, 1)) * 100, 2);
        blocks = [
          { label: '法定上限（标的额 30%）', value: money(cap), unit: '元', sub: total > cap ? '⚠ 已超出上限' : '未超上限' },
          { label: '占实际回款比例', value: `${share}%` },
        ];
      }

      return {
        main: { label: mainLabel, value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          {
            law: '《律师服务收费管理办法》',
            article: '第十三条',
            text: '实行风险代理收费，律师事务所应当与委托人签订风险代理收费合同，约定双方应承担的风险责任、收费方式、收费数额或比例。实行风险代理收费，最高收费金额不得高于收费合同约定标的额的30%。',
          },
          {
            law: '《律师服务收费管理办法》',
            article: '第四条',
            text: '律师服务收费实行政府指导价和市场调节价。',
          },
        ],
        tips: [
          '下列案件不得实行风险代理：婚姻继承、请求社保待遇、赡养抚养抚养、请求支付劳动报酬、刑事诉讼、行政诉讼、国家赔偿、群体性诉讼等。',
          '风险代理 30% 的上限以"合同约定标的额"为基数，不是以实际回款为基数，签约时应明确表述。',
          '律师费由败诉方承担需以合同约定或法律特别规定为前提（如知识产权、不正当竞争案件）。',
        ],
      };
    },
  },

  /* ── 诉讼成本总览 ── */
  {
    id: 'litigation-total',
    name: '诉讼成本总览',
    category: 'litigation',
    glyph: '总',
    summary: '一次性汇总受理费、保全费与保全担保费、律师费与公告费、公证费、鉴定费、评估费等全部投入',
    keywords: ['诉讼成本', '总成本', '起诉预算', '公告费', '公证费', '鉴定费', '评估费'],
    fields: [
      { key: 'amount', label: '争议标的额', type: 'money', unit: '元', emphasis: true, defaultValue: 2000000 },
      { key: 'lawyerFee', label: '律师费', type: 'money', unit: '元', defaultValue: 100000 },
      { key: 'preserve', label: '是否申请财产保全', type: 'switch', defaultValue: true },
      {
        key: 'preserveAmount',
        label: '保全财产数额',
        type: 'money',
        unit: '元',
        defaultValue: 2000000,
        visibleWhen: (v) => v.preserve === true || v.preserve === 'true',
      },
      {
        key: 'guarantee',
        label: '保全担保方式',
        type: 'select',
        defaultValue: 'insurance',
        options: [
          { label: '保险公司保函', value: 'insurance' },
          { label: '现金担保（全额冻结）', value: 'cash' },
          { label: '银行保函', value: 'bank' },
          { label: '无需担保', value: 'none' },
        ],
        visibleWhen: (v) => v.preserve === true || v.preserve === 'true',
      },
      {
        key: 'guaranteeRate',
        label: '保函费率',
        type: 'number',
        unit: '‰/年',
        defaultValue: 0.8,
        step: 0.1,
        hint: '市场常见 0.5‰—1.5‰/年，按保险公司实际报价填写',
        visibleWhen: (v) => (v.preserve === true || v.preserve === 'true') && toStr(v.guarantee) !== 'cash' && toStr(v.guarantee) !== 'none',
      },
      {
        key: 'minPremium',
        label: '保函最低保费',
        type: 'money',
        unit: '元',
        defaultValue: 500,
        hint: '多数保险公司设单笔最低保费，填 0 表示不设下限',
        visibleWhen: (v) => (v.preserve === true || v.preserve === 'true') && toStr(v.guarantee) !== 'cash' && toStr(v.guarantee) !== 'none',
      },
      {
        key: 'announcementFee',
        label: '公告费',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '送达、开庭、执行、破产等公告的刊登费，按实际次数 × 单价填',
        group: '其他诉讼费用',
      },
      {
        key: 'notarizationFee',
        label: '公证费',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '强制执行公证、继承赠与、保全证据等公证事项费用',
        group: '其他诉讼费用',
      },
      {
        key: 'appraisalFee',
        label: '鉴定费',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '笔迹、医疗损害、工程造价、司法会计等司法鉴定费用',
        group: '其他诉讼费用',
      },
      {
        key: 'valuationFee',
        label: '评估费',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '资产评估、房地产估价、土地估价费用',
        group: '其他诉讼费用',
      },
      {
        key: 'winRate',
        label: '预估胜诉及执行到位率',
        type: 'percent',
        unit: '%',
        defaultValue: 60,
      },
    ],
    calc(values): CalcOutput {
      const amount = toNum(values.amount);
      const lawyerFee = toNum(values.lawyerFee);
      const preserve = values.preserve === true || values.preserve === 'true';
      const preserveAmount = toNum(values.preserveAmount);
      const guarantee = toStr(values.guarantee, 'insurance');
      const gr = toNum(values.guaranteeRate) / 1000;
      const minPremium = toNum(values.minPremium);
      // 其他诉讼费用：公告费 / 公证费 / 鉴定费 / 评估费（appraisal 为旧版鉴定费字段，保留兼容）
      const announcementFee = toNum(values.announcementFee);
      const notarizationFee = toNum(values.notarizationFee);
      const appraisalFee = toNum(values.appraisalFee, toNum(values.appraisal));
      const valuationFee = toNum(values.valuationFee);
      const otherFee = round(announcementFee + notarizationFee + appraisalFee + valuationFee, 2);
      const winRate = toNum(values.winRate) / 100;

      const { total: acceptFee } = progressive(amount, CIVIL_FEE_TIERS);
      const steps: StepRow[] = [
        { label: '案件受理费', value: `${money(acceptFee)} 元`, note: `标的额 ${money(amount)} 元分段累计` },
        { label: '律师费', value: `${money(lawyerFee)} 元` },
      ];

      let preserveFee = 0;
      if (preserve) {
        const p = progressive(preserveAmount, PRESERVATION_TIERS);
        preserveFee = Math.min(p.total, PRESERVATION_CAP);
        steps.push({ label: '保全申请费', value: `${money(preserveFee)} 元`, note: '5,000 元封顶' });

        let gCost = 0;
        if (guarantee === 'cash') {
          gCost = 0;
          steps.push({
            label: '现金担保',
            value: `${money(preserveAmount)} 元全额冻结`,
            note: '不产生费用但全额冻结，机会成本按同期 LPR 估算',
          });
        } else if (guarantee !== 'none') {
          const rawPremium = round(preserveAmount * gr, 2);
          gCost = Math.max(rawPremium, minPremium);
          steps.push({
            label: guarantee === 'bank' ? '银行保函手续费' : '保全保险费',
            value: `${money(preserveAmount)} × ${toNum(values.guaranteeRate)}‰ = ${money(rawPremium)} 元${
              gCost > rawPremium ? `，低于最低保费，按 ${money(minPremium)} 元计收` : ''
            }`,
          });
        }
        preserveFee = round(preserveFee + gCost, 2);
      }

      if (announcementFee > 0) steps.push({ label: '公告费', value: `${money(announcementFee)} 元`, note: '由当事人直接支付给法院指定媒体' });
      if (notarizationFee > 0) steps.push({ label: '公证费', value: `${money(notarizationFee)} 元` });
      if (appraisalFee > 0) steps.push({ label: '鉴定费', value: `${money(appraisalFee)} 元` });
      if (valuationFee > 0) steps.push({ label: '评估费', value: `${money(valuationFee)} 元` });
      if (otherFee > 0) {
        steps.push({
          label: '其他诉讼费用小计',
          value: `${money(otherFee)} 元`,
          emphasis: true,
          note: '《诉讼费用交纳办法》第十二条：由当事人直接支付，法院不代收代付',
        });
      }

      const total = round(acceptFee + lawyerFee + preserveFee + otherFee, 2);
      steps.push({ label: '前期投入合计', value: `${money(total)} 元`, emphasis: true });

      const expected = round(amount * winRate, 2);
      const net = round(expected - total, 2);
      const roi = round((net / Math.max(total, 1)) * 100, 2);

      steps.push({
        label: '预期回收',
        value: `${money(amount)} × ${toNum(values.winRate)}% = ${money(expected)} 元`,
      });
      steps.push({
        label: '投入产出比',
        value: `净收益 ${money(net)} 元 / 投入 ${money(total)} 元 = ${roi}%`,
        emphasis: true,
        note: net < 0 ? '⚠ 预期亏损，建议优先考虑调解或债权转让' : '预期为正，具备诉讼经济性',
      });

      return {
        main: { label: '诉讼前期总投入', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '占标的额比例', value: `${((total / Math.max(amount, 1)) * 100).toFixed(2)}%` },
          { label: '其他诉讼费用', value: money(otherFee), unit: '元', sub: '公告 + 公证 + 鉴定 + 评估' },
          { label: '预期回收金额', value: money(expected), unit: '元' },
          {
            label: '净收益',
            value: money(net),
            unit: '元',
            sub: `投入产出比 ${roi}%`,
          },
        ],
        steps,
        basis: [
          ...COMMON_BASIS,
          {
            law: '《诉讼费用交纳办法》',
            article: '第十二条',
            text: '诉讼过程中因鉴定、公告、勘验、翻译、评估、拍卖、变卖、仓储、保管、运输、船舶监管等发生的依法应当由当事人负担的费用，人民法院根据谁主张、谁负担的原则，决定由当事人直接支付给有关机构或者单位，人民法院不得代收代付。',
          },
        ],
        tips: [
          '受理费与保全费由败诉方负担，胜诉后可申请退还，实际净支出通常低于测算值。',
          '公告费、公证费、鉴定费、评估费不属于案件受理费，法院不代收代付，需由当事人直接支付给第三方机构，做预算时必须单独列支——这几项往往是诉讼中最大的现金流出。',
          '律师费除非有约定或法定情形，否则各自承担，是诉讼中最难回收的成本。',
          '净收益为负时，调解、债权转让或商业止损往往比硬打到底更划算。',
        ],
      };
    },
  },
];
