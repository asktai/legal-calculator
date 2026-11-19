/**
 * 一之二、诉讼其他费用类计算器
 * 公告费 / 公证费 / 鉴定费 / 评估费
 *
 * 共同依据：《诉讼费用交纳办法》第十二条 —— 诉讼过程中因鉴定、公告、勘验、翻译、
 * 评估、拍卖等发生的依法应当由当事人负担的费用，人民法院按「谁主张、谁负担」原则，
 * 决定由当事人**直接支付给有关机构**，人民法院不得代收代付。
 * 因此这类费用不属于「案件受理费」，无法在立案时一并预交，需单独向第三方机构结算。
 */
import type { CalculatorDef, CalcOutput, StepRow, ResultBlock } from '../types';
import { money, round, toNum, toStr, moneyToChinese } from '../format';
import {
  progressive,
  ASSET_APPRAISAL_TIERS,
  REAL_ESTATE_TIERS,
  LAND_APPRAISAL_TIERS,
  NOTARY_INHERITANCE_TIERS,
  NOTARY_CONTRACT_TIERS,
} from '../progressive';

/** 全部计算器共享的收费原则依据 */
const FEE_BASIS = [
  {
    law: '《诉讼费用交纳办法》',
    article: '第十二条',
    text: '诉讼过程中因鉴定、公告、勘验、翻译、评估、拍卖、变卖、仓储、保管、运输、船舶监管等发生的依法应当由当事人负担的费用，人民法院根据谁主张、谁负担的原则，决定由当事人直接支付给有关机构或者单位，人民法院不得代收代付。',
  },
];

/** 公告类型参考单价（人民法院报 / 法院公告网，各地略有差异） */
const ANNOUNCEMENT_PRICE: Record<string, { label: string; price: number; note: string }> = {
  service: { label: '起诉状副本及开庭传票送达公告', price: 300, note: '最常见，一般合并刊登一次' },
  judgment: { label: '判决书 / 裁定书送达公告', price: 300, note: '同上，按次计费' },
  execution: { label: '执行公告', price: 300, note: '含执行通知、查封公告等' },
  bankruptcy: { label: '破产 / 强制清算公告', price: 1500, note: '篇幅长、多需连续刊登，费用较高' },
  missing: { label: '宣告失踪 / 宣告死亡公告', price: 500, note: '宣告失踪公告期 3 个月，宣告死亡 1 年' },
  public: { label: '公示催告 / 票据公告', price: 600, note: '公示催告期间由法院确定，不少于 60 日' },
  other: { label: '其他公告（认领财产、送达涉外文书等）', price: 300, note: '涉外公告自发出之日起满 3 个月视为送达' },
};

/** 司法鉴定类型参考单价（按件） */
const EXPERTISE_PRICE: Record<string, { label: string; price: number; note: string }> = {
  handwriting: { label: '笔迹 / 印章 / 文书真伪鉴定', price: 4000, note: '常见区间 3000—8000 元/件，样本每增加一份加收' },
  timing: { label: '文书形成时间鉴定', price: 12000, note: '技术难度大，常见 10000—20000 元' },
  clinical: { label: '法医临床（伤残等级 / 伤病关系）', price: 1200, note: '各省收费标准不同，常见 700—2000 元/例' },
  medical: { label: '医疗损害 / 医疗过错鉴定', price: 10000, note: '常见 8000—15000 元' },
  psych: { label: '精神疾病 / 民事行为能力鉴定', price: 3000, note: '常见 2000—5000 元' },
  dna: { label: '亲子鉴定（三联体）', price: 3000, note: '常见 2400—3600 元/例' },
  electronic: { label: '电子数据司法鉴定', price: 12000, note: '常见 8000—30000 元，按数据量与恢复难度' },
  product: { label: '产品质量 / 机动车技术鉴定', price: 8000, note: '常见 3000—20000 元' },
  accounting: { label: '司法会计鉴定', price: 0, note: '多按标的额比例或计时收费' },
  engineering: { label: '工程造价鉴定', price: 0, note: '多按标的额累进计费，常见 1%—3%' },
  other: { label: '其他专门性问题鉴定', price: 5000, note: '以鉴定机构报价为准' },
};

export const otherFeeCalculators: CalculatorDef[] = [
  /* ── 公告费 ── */
  {
    id: 'announcement-fee',
    name: '公告费',
    category: 'litigation',
    glyph: '告',
    summary: '送达、开庭、执行、破产等公告的刊登费用测算（法院不代收，由当事人直接支付媒体）',
    keywords: ['公告费', '公告送达', '刊登', '人民法院报', '破产公告', '公示催告'],
    fields: [
      {
        key: 'annoType',
        label: '公告类型',
        type: 'select',
        defaultValue: 'service',
        options: Object.entries(ANNOUNCEMENT_PRICE).map(([value, v]) => ({ label: v.label, value })),
      },
      {
        key: 'times',
        label: '刊登次数',
        type: 'number',
        unit: '次',
        defaultValue: 1,
        min: 1,
        step: 1,
        hint: '一般送达公告刊登 1 次即可；破产、清算类公告常需连续刊登 2—3 次',
      },
      {
        key: 'unitPrice',
        label: '单次刊登单价',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '填 0 时自动采用所选公告类型的参考价；有实际报价时直接填写（人民法院报 / 法院公告网）',
      },
      {
        key: 'extra',
        label: '其他支出（加急、翻译、邮寄等）',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        group: '其他',
      },
    ],
    calc(values): CalcOutput {
      const type = toStr(values.annoType, 'service');
      const ref = ANNOUNCEMENT_PRICE[type] ?? ANNOUNCEMENT_PRICE.other;
      const times = Math.max(1, Math.round(toNum(values.times, 1)));
      const custom = toNum(values.unitPrice);
      // 单价留空（0）时自动采用该公告类型的参考价
      const unitPrice = custom > 0 ? custom : ref.price;
      const extra = toNum(values.extra);

      const subtotal = round(unitPrice * times, 2);
      const total = round(subtotal + extra, 2);

      const steps: StepRow[] = [
        { label: '公告类型', value: ref.label, note: ref.note },
        {
          label: '单次刊登单价',
          value: `${money(unitPrice)} 元`,
          note: custom > 0 ? '按用户填写的单价' : `未填写单价，采用参考价 ${money(ref.price)} 元/次`,
        },
        { label: `刊登 ${times} 次`, value: `${money(unitPrice)} × ${times} = ${money(subtotal)} 元`, emphasis: true },
      ];
      if (extra > 0) {
        steps.push({ label: '其他支出', value: `${money(extra)} 元` });
        steps.push({ label: '合计', value: `${money(subtotal)} + ${money(extra)} = ${money(total)} 元`, emphasis: true });
      }

      const effectText =
        type === 'missing'
          ? '宣告失踪 3 个月 / 宣告死亡 1 年'
          : type === 'public'
            ? '不少于 60 日'
            : type === 'bankruptcy'
              ? '以法院公告载明为准'
              : type === 'other'
                ? '涉外公告 3 个月'
                : '30 日';

      return {
        main: { label: '公告费合计', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '公告类型', value: ref.label },
          { label: '刊登次数', value: `${times} 次` },
          { label: '公告生效期间', value: effectText, sub: '自发出公告之日起算' },
        ],
        steps,
        basis: [
          ...FEE_BASIS,
          {
            law: '《民事诉讼法》',
            article: '第九十五条',
            text: '受送达人下落不明，或者用本节规定的其他方式无法送达的，公告送达。自发出公告之日起，经过三十日，即视为送达。公告送达，应当在案卷中记明原因和经过。',
          },
        ],
        tips: [
          '公告费不属于案件受理费，法院不代收代付，需由申请方直接支付给人民法院报社或法院公告网。',
          '公告送达是「最后手段」，启动前须先完成直接送达、邮寄送达、电子送达等，并留存送达不能的凭证。',
          '公告送达仅适用于受送达人下落不明或其他方式无法送达的情形，滥用公告送达可能被认定为程序违法。',
          '破产、强制清算类公告费用高且需连续刊登，应在预算中单独列支。',
        ],
      };
    },
  },

  /* ── 公证费 ── */
  {
    id: 'notarization-fee',
    name: '公证费',
    category: 'litigation',
    glyph: '证',
    summary: '强制执行公证、继承赠与、合同、保全证据、提存等公证事项的收费测算',
    keywords: ['公证费', '强制执行公证', '赋强公证', '保全证据', '提存', '继承公证'],
    fields: [
      {
        key: 'notaryType',
        label: '公证事项',
        type: 'select',
        defaultValue: 'enforcement',
        options: [
          { label: '赋予债权文书强制执行效力公证', value: 'enforcement' },
          { label: '财产继承 / 赠与 / 接受遗赠公证', value: 'inheritance' },
          { label: '合同（协议）公证', value: 'contract' },
          { label: '保全证据公证（网页、现场、聊天记录等）', value: 'evidence' },
          { label: '文本相符 / 影印本与原本相符公证', value: 'copy' },
          { label: '提存公证', value: 'deposit' },
        ],
      },
      {
        key: 'amount',
        label: '涉及金额',
        type: 'money',
        unit: '元',
        emphasis: true,
        defaultValue: 1000000,
        hint: '强制执行公证填债务总额；继承赠与填受益额；合同公证填标的额；提存填提存额',
        visibleWhen: (v) => ['enforcement', 'inheritance', 'contract', 'deposit'].includes(toStr(v.notaryType)),
      },
      {
        key: 'pieces',
        label: '公证件数',
        type: 'number',
        unit: '件',
        defaultValue: 1,
        min: 1,
        step: 1,
        visibleWhen: (v) => ['evidence', 'copy'].includes(toStr(v.notaryType)),
      },
      {
        key: 'unitPrice',
        label: '每件收费',
        type: 'money',
        unit: '元',
        defaultValue: 1200,
        hint: '保全证据公证常见 1000—2000 元/件；文本相符公证常见 100—300 元/件，以公证处报价为准',
        visibleWhen: (v) => ['evidence', 'copy'].includes(toStr(v.notaryType)),
      },
      {
        key: 'minFee',
        label: '最低收费',
        type: 'money',
        unit: '元',
        defaultValue: 200,
        hint: '多数公证事项设有单件最低收费',
        group: '其他',
      },
      {
        key: 'extra',
        label: '其他支出（副本、翻译、差旅、光盘等）',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        group: '其他',
      },
    ],
    calc(values): CalcOutput {
      const type = toStr(values.notaryType, 'enforcement');
      const amount = toNum(values.amount);
      const pieces = Math.max(1, Math.round(toNum(values.pieces, 1)));
      const unitPrice = toNum(values.unitPrice);
      const minFee = toNum(values.minFee);
      const extra = toNum(values.extra);

      const steps: StepRow[] = [];
      let base = 0;
      let mainLabel = '公证费';

      if (type === 'enforcement') {
        base = round(amount * 0.003, 2);
        mainLabel = '赋予强制执行效力公证费';
        steps.push({ label: '按债务总额 0.3% 计收', value: `${money(amount)} × 0.3% = ${money(base)} 元`, note: '行业通行标准，以公证处报价为准' });
      } else if (type === 'deposit') {
        base = round(amount * 0.003, 2);
        mainLabel = '提存公证费';
        steps.push({ label: '按提存额 0.3% 计收', value: `${money(amount)} × 0.3% = ${money(base)} 元`, note: '提存物的保管费另按实际计收' });
      } else if (type === 'inheritance') {
        const r = progressive(amount, NOTARY_INHERITANCE_TIERS);
        base = r.total;
        mainLabel = '继承 / 赠与 / 受遗赠公证费';
        r.lines.forEach((l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} 元` }));
        steps.push({ label: '分段累计', value: `${money(base)} 元`, emphasis: true, note: '按受益额累进' });
      } else if (type === 'contract') {
        const r = progressive(amount, NOTARY_CONTRACT_TIERS);
        base = r.total;
        mainLabel = '合同（协议）公证费';
        r.lines.forEach((l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} 元` }));
        steps.push({ label: '分段累计', value: `${money(base)} 元`, emphasis: true, note: '按合同标的额累进' });
      } else {
        base = round(unitPrice * pieces, 2);
        mainLabel = type === 'evidence' ? '保全证据公证费' : '文本相符公证费';
        steps.push({ label: `每件 ${money(unitPrice)} 元 × ${pieces} 件`, value: `${money(base)} 元`, emphasis: true });
      }

      if (minFee > 0 && base < minFee) {
        steps.push({ label: '低于最低收费，按最低收费计收', value: `${money(minFee)} 元`, emphasis: true });
        base = minFee;
      }

      const total = round(base + extra, 2);
      if (extra > 0) steps.push({ label: '加计其他支出', value: `${money(base)} + ${money(extra)} = ${money(total)} 元`, emphasis: true });

      const blocks: ResultBlock[] = [
        { label: '公证费', value: money(base), unit: '元' },
        { label: '其他支出', value: money(extra), unit: '元' },
      ];
      if (type === 'enforcement') {
        blocks.push({ label: '可省去的诉讼成本', value: '一审受理费 + 保全费', sub: '债权文书可直接申请执行，无需诉讼' });
      }

      return {
        main: { label: mainLabel, value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          {
            law: '《公证法》',
            article: '第四十六条',
            text: '公证费的收费标准由国务院财政部门、价格主管部门会同国务院司法行政部门制定。',
          },
          {
            law: '《公证法》',
            article: '第三十七条',
            text: '对经公证的以给付为内容并载明债务人愿意接受强制执行承诺的债权文书，债务人不履行或者履行不适当的，债权人可以依法向有管辖权的人民法院申请执行。',
          },
          ...FEE_BASIS,
        ],
        tips: [
          '赋予强制执行效力的债权文书公证是性价比最高的风控手段：0.3% 的公证费可省去一审受理费、保全费与漫长周期，直接进入执行程序。',
          '办理强制执行公证必须同时满足三个要件：债权文书以给付为内容、载明债务人愿意接受强制执行的承诺、公证书中载明"赋予强制执行效力"。',
          '保全证据公证是知识产权、网络侵权案件的常规操作，应在发现侵权后第一时间办理，避免证据灭失或被篡改。',
          '公证收费标准由各省级价格主管部门与司法行政部门制定，多数事项已实行市场调节价，务必事前取得公证处书面报价。',
        ],
      };
    },
  },

  /* ── 鉴定费 ── */
  {
    id: 'expertise-fee',
    name: '司法鉴定费',
    category: 'litigation',
    glyph: '鉴',
    summary: '笔迹、医疗损害、工程造价、司法会计等各类司法鉴定的费用测算（按件或按标的额）',
    keywords: ['鉴定费', '司法鉴定', '笔迹鉴定', '医疗鉴定', '工程造价鉴定', '司法会计', '伤残鉴定'],
    fields: [
      {
        key: 'expType',
        label: '鉴定事项',
        type: 'select',
        defaultValue: 'handwriting',
        options: Object.entries(EXPERTISE_PRICE).map(([value, v]) => ({ label: v.label, value })),
      },
      {
        key: 'method',
        label: '计费方式',
        type: 'select',
        defaultValue: 'bycase',
        options: [
          { label: '按件计费', value: 'bycase' },
          { label: '按标的额比例计费', value: 'byamount' },
        ],
        hint: '工程造价、司法会计鉴定多按标的额累进；其余多为按件计费',
      },
      {
        key: 'unitPrice',
        label: '每件收费',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '填 0 时自动采用所选鉴定事项的参考价；有机构报价时直接填写',
        visibleWhen: (v) => toStr(v.method, 'bycase') === 'bycase',
      },
      {
        key: 'count',
        label: '鉴定件数 / 例数',
        type: 'number',
        unit: '件',
        defaultValue: 1,
        min: 1,
        step: 1,
        visibleWhen: (v) => toStr(v.method, 'bycase') === 'bycase',
      },
      {
        key: 'amount',
        label: '鉴定标的额',
        type: 'money',
        unit: '元',
        emphasis: true,
        defaultValue: 3000000,
        visibleWhen: (v) => toStr(v.method, 'bycase') === 'byamount',
      },
      {
        key: 'rate',
        label: '费率',
        type: 'percent',
        unit: '%',
        defaultValue: 1.5,
        step: 0.1,
        hint: '工程造价鉴定常见 1%—3%；司法会计鉴定常见 0.5%—2%',
        visibleWhen: (v) => toStr(v.method, 'bycase') === 'byamount',
      },
      {
        key: 'courtFee',
        label: '鉴定人出庭费用',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '含交通费、住宿费、生活费与误工补贴，由申请方垫付，最终由败诉方负担',
        group: '其他',
      },
      {
        key: 'extra',
        label: '其他支出（差旅、加急、补充材料检测）',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        group: '其他',
      },
    ],
    calc(values): CalcOutput {
      const type = toStr(values.expType, 'handwriting');
      const ref = EXPERTISE_PRICE[type] ?? EXPERTISE_PRICE.other;
      const method = toStr(values.method, 'bycase');
      const custom = toNum(values.unitPrice);
      // 单价留空（0）时自动采用该鉴定事项的参考价
      const unitPrice = custom > 0 ? custom : ref.price || 5000;
      const count = Math.max(1, Math.round(toNum(values.count, 1)));
      const amount = toNum(values.amount);
      const rate = toNum(values.rate, 1.5) / 100;
      const courtFee = toNum(values.courtFee);
      const extra = toNum(values.extra);

      const steps: StepRow[] = [{ label: '鉴定事项', value: ref.label, note: ref.note }];
      let base = 0;

      if (method === 'byamount') {
        base = round(amount * rate, 2);
        steps.push({ label: '标的额 × 费率', value: `${money(amount)} × ${toNum(values.rate, 1.5)}% = ${money(base)} 元`, emphasis: true });
      } else {
        base = round(unitPrice * count, 2);
        steps.push({
          label: `每件 ${money(unitPrice)} 元 × ${count} 件`,
          value: `${money(base)} 元`,
          emphasis: true,
          note: custom > 0 ? '按用户填写的单价' : `未填写单价，采用参考价 ${money(unitPrice)} 元/件`,
        });
      }

      const total = round(base + courtFee + extra, 2);
      if (courtFee > 0) steps.push({ label: '鉴定人出庭费用', value: `${money(courtFee)} 元` });
      if (extra > 0) steps.push({ label: '其他支出', value: `${money(extra)} 元` });
      steps.push({ label: '鉴定费合计', value: `${money(total)} 元`, emphasis: true });

      const blocks: ResultBlock[] = [
        { label: '鉴定费', value: money(base), unit: '元' },
        { label: '出庭费用', value: money(courtFee), unit: '元' },
      ];
      if (method === 'byamount') {
        blocks.push({ label: '占标的额比例', value: `${(base / Math.max(amount, 1) * 100).toFixed(2)}%` });
      }

      return {
        main: { label: '司法鉴定费合计', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks,
        steps,
        basis: [
          ...FEE_BASIS,
          {
            law: '《民事诉讼法》',
            article: '第七十九条',
            text: '当事人可以就查明事实的专门性问题向人民法院申请鉴定。当事人申请鉴定的，由双方当事人协商确定具备资格的鉴定人；协商不成的，由人民法院指定。',
          },
          {
            law: '《诉讼费用交纳办法》',
            article: '第六条',
            text: '当事人应当向人民法院交纳的诉讼费用包括：（一）案件受理费；（二）申请费；（三）证人、鉴定人、翻译人员、理算人员在人民法院指定日期出庭发生的交通费、住宿费、生活费和误工补贴。',
          },
        ],
        tips: [
          '鉴定费由申请方垫付，最终由败诉方负担，但法院通常要求申请方先行预交，金额较大时应在预算中提前安排。',
          '申请鉴定应在举证期限届满前提出，逾期可能被法院不予准许，导致主张因缺乏证据而不被支持。',
          '对鉴定意见有异议的，应在法院指定期限内以书面形式提出，并申请鉴定人出庭作证或申请重新鉴定。',
          '工程造价与司法会计鉴定标的额大、周期长，可要求鉴定机构先出具费用预算，再决定是否启动。',
        ],
      };
    },
  },

  /* ── 评估费 ── */
  {
    id: 'valuation-fee',
    name: '评估费',
    category: 'litigation',
    glyph: '估',
    summary: '资产评估、房地产估价、土地估价按评估值累进计费，含市场折扣与最低收费',
    keywords: ['评估费', '资产评估', '房地产估价', '土地评估', '司法评估', '拍卖评估'],
    fields: [
      {
        key: 'valType',
        label: '评估类型',
        type: 'select',
        defaultValue: 'asset',
        options: [
          { label: '资产评估（股权、设备、无形资产等）', value: 'asset' },
          { label: '房地产估价', value: 'realestate' },
          { label: '土地价格评估', value: 'land' },
        ],
      },
      {
        key: 'value',
        label: '评估值 / 标的额',
        type: 'money',
        unit: '元',
        emphasis: true,
        defaultValue: 10000000,
        hint: '司法评估按评估对象价值；股权评估按被评估企业净资产或股权价值',
      },
      {
        key: 'discount',
        label: '折扣率',
        type: 'percent',
        unit: '%',
        defaultValue: 60,
        hint: '评估收费已放开为市场调节价，实务中多按标准价的 5—8 折收取，填 100 表示不打折',
      },
      {
        key: 'minFee',
        label: '最低收费',
        type: 'money',
        unit: '元',
        defaultValue: 1000,
        hint: '小额评估通常设单笔最低收费',
        group: '其他',
      },
      {
        key: 'extra',
        label: '其他支出（现场勘察差旅、加急）',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        group: '其他',
      },
    ],
    calc(values): CalcOutput {
      const type = toStr(values.valType, 'asset');
      const value = toNum(values.value);
      const discount = toNum(values.discount, 100) / 100;
      const minFee = toNum(values.minFee);
      const extra = toNum(values.extra);

      const tiers =
        type === 'realestate' ? REAL_ESTATE_TIERS : type === 'land' ? LAND_APPRAISAL_TIERS : ASSET_APPRAISAL_TIERS;
      const typeName = type === 'realestate' ? '房地产估价' : type === 'land' ? '土地价格评估' : '资产评估';

      const { total: standard, lines } = progressive(value, tiers);
      const steps: StepRow[] = [{ label: '评估类型', value: typeName, note: '按评估值差额定率累进计费（行业参考标准）' }];
      lines.forEach((l) => steps.push({ label: l.desc, value: `${money(l.base)} ${l.rateText} = ${money(l.amount)} 元` }));
      steps.push({ label: '标准价合计', value: `${money(standard)} 元`, emphasis: true });

      let base = round(standard * discount, 2);
      if (discount < 1) {
        steps.push({
          label: `市场折扣（${toNum(values.discount, 100)}%）`,
          value: `${money(standard)} × ${toNum(values.discount, 100)}% = ${money(base)} 元`,
        });
      }
      if (minFee > 0 && base < minFee) {
        steps.push({ label: '低于最低收费，按最低收费计收', value: `${money(minFee)} 元`, emphasis: true });
        base = minFee;
      }

      const total = round(base + extra, 2);
      if (extra > 0) steps.push({ label: '加计其他支出', value: `${money(base)} + ${money(extra)} = ${money(total)} 元`, emphasis: true });

      return {
        main: { label: `${typeName}费`, value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '标准价（未折扣）', value: money(standard), unit: '元' },
          { label: '实际评估费', value: money(base), unit: '元' },
          { label: '占评估值比例', value: `${((base / Math.max(value, 1)) * 100).toFixed(3)}%` },
        ],
        steps,
        basis: [
          ...FEE_BASIS,
          {
            law: '《民事诉讼法》',
            article: '第二百五十五条',
            text: '被执行人未按执行通知履行法律文书确定的义务，人民法院有权查封、扣押、冻结、拍卖、变卖被执行人应当履行义务部分的财产。',
          },
          {
            law: '《最高人民法院关于人民法院民事执行中拍卖、变卖财产的规定》',
            article: '第四条',
            text: '对拟拍卖的财产，人民法院应当委托具有相应资质的评估机构进行价格评估。',
          },
        ],
        tips: [
          '评估收费已放开为市场调节价，上表为行业通行的累进参考标准，实际成交价通常为标准的 5—8 折，务必货比三家。',
          '司法处置中的评估费由申请执行人先行垫付，最终从拍卖款中优先扣除，属于执行费用的一部分。',
          '对评估报告有异议的，可在收到后 10 日内以书面形式向法院提出，申请复核评估或重新评估。',
          '评估值直接决定起拍价与清偿顺序，评估过高易流拍、过低损害被执行人利益，均为常见争议点。',
        ],
      };
    },
  },
];
