/**
 * 六、差旅费用类计算器
 * 依据：《中央和国家机关差旅费管理办法》（财行〔2013〕531号，财行〔2016〕71号调整）
 *      《中央和国家机关工作人员赴地方差旅住宿费标准明细表》
 *
 * 说明：企业差旅标准可自行制定，本工具以中央和国家机关标准为参考基线，
 *       实务中常用于核验报销合理性、测算外派人员成本及诉讼出差预算。
 */
import type { CalculatorDef, CalcOutput, StepRow } from '../types';
import { money, round, toNum, toStr, moneyToChinese } from '../format';

/** 住宿费标准（元/人/天）：[部级, 司局级, 其他人员] */
export const LODGING_STANDARD: Record<string, [number, number, number]> = {
  北京: [1100, 650, 500],
  上海: [1100, 600, 500],
  广州: [900, 550, 450],
  深圳: [900, 550, 450],
  天津: [800, 480, 380],
  重庆: [800, 480, 370],
  南京: [900, 490, 380],
  杭州: [900, 500, 400],
  成都: [750, 470, 370],
  武汉: [800, 480, 350],
  西安: [800, 460, 350],
  济南: [800, 480, 380],
  青岛: [800, 490, 380],
  福州: [800, 480, 380],
  厦门: [800, 490, 400],
  郑州: [800, 480, 380],
  长沙: [800, 450, 350],
  合肥: [800, 460, 350],
  沈阳: [800, 480, 350],
  大连: [800, 490, 350],
  石家庄: [800, 450, 350],
  昆明: [800, 480, 380],
  南昌: [800, 470, 350],
  南宁: [800, 470, 350],
  太原: [800, 460, 350],
  贵阳: [750, 450, 350],
  哈尔滨: [750, 450, 350],
  长春: [750, 450, 350],
  兰州: [700, 450, 330],
  呼和浩特: [700, 450, 350],
  乌鲁木齐: [700, 450, 350],
  海口: [800, 500, 350],
  拉萨: [800, 500, 350],
  西宁: [700, 450, 350],
  银川: [700, 450, 350],
  其他地区: [700, 450, 330],
};

/** 伙食补助费标准 */
export const MEAL_ALLOWANCE = 100;
/** 市内交通费标准 */
export const LOCAL_TRANSPORT = 80;

const CITY_OPTIONS = Object.keys(LODGING_STANDARD).map((c) => ({ label: c, value: c }));
const LEVEL_OPTIONS = [
  { label: '部级 / 相当职务人员', value: '0' },
  { label: '司局级 / 相当职务人员', value: '1' },
  { label: '其他人员', value: '2' },
];

export const travelCalculators: CalculatorDef[] = [
  /* ── 差旅补贴标准 ── */
  {
    id: 'travel-allowance',
    name: '差旅补贴标准',
    category: 'travel',
    glyph: '差',
    summary: '伙食补助 + 市内交通 + 住宿标准的每日补贴测算',
    keywords: ['差旅费', '出差补贴', '伙食补助', '住宿标准'],
    fields: [
      { key: 'city', label: '出差目的地', type: 'select', defaultValue: '北京', options: CITY_OPTIONS },
      { key: 'level', label: '人员级别', type: 'select', defaultValue: '2', options: LEVEL_OPTIONS },
      { key: 'days', label: '出差天数', type: 'number', unit: '天', defaultValue: 3 },
      { key: 'people', label: '出差人数', type: 'number', unit: '人', defaultValue: 2 },
      {
        key: 'provideMeal',
        label: '接待单位是否安排用餐',
        type: 'switch',
        defaultValue: false,
        hint: '由接待单位统一安排用餐的，不再发放伙食补助',
      },
      {
        key: 'provideTransport',
        label: '是否由接待单位提供交通工具',
        type: 'switch',
        defaultValue: false,
        hint: '由接待单位提供交通工具的，不再发放市内交通费',
      },
      {
        key: 'customLodging',
        label: '自定义住宿标准（元/天）',
        type: 'money',
        unit: '元',
        defaultValue: 0,
        hint: '填 0 表示适用内置标准；企业自定标准请填此栏',
      },
    ],
    calc(values): CalcOutput {
      const city = toStr(values.city, '北京');
      const levelIdx = Math.min(2, Math.max(0, Math.round(toNum(values.level, 2))));
      const days = Math.max(0, toNum(values.days));
      const people = Math.max(1, toNum(values.people));
      const provideMeal = values.provideMeal === true || values.provideMeal === 'true';
      const provideTransport = values.provideTransport === true || values.provideTransport === 'true';
      const custom = toNum(values.customLodging);

      const std = LODGING_STANDARD[city] ?? LODGING_STANDARD['其他地区'];
      const lodgingPerDay = custom > 0 ? custom : std[levelIdx];

      const steps: StepRow[] = [
        { label: '目的地与级别', value: `${city} / ${LEVEL_OPTIONS[levelIdx].label}` },
        { label: '住宿费标准', value: custom > 0 ? `${money(lodgingPerDay)} 元/天（自定义）` : `${money(lodgingPerDay)} 元/天（内置标准）` },
      ];

      const lodging = round(lodgingPerDay * days * people, 2);
      steps.push({ label: '住宿费小计', value: `${money(lodgingPerDay)} × ${days} 天 × ${people} 人 = ${money(lodging)} 元` });

      const meal = provideMeal ? 0 : round(MEAL_ALLOWANCE * days * people, 2);
      steps.push({
        label: '伙食补助费',
        value: provideMeal ? '0 元（接待单位已安排用餐）' : `${MEAL_ALLOWANCE} × ${days} 天 × ${people} 人 = ${money(meal)} 元`,
      });

      const transport = provideTransport ? 0 : round(LOCAL_TRANSPORT * days * people, 2);
      steps.push({
        label: '市内交通费',
        value: provideTransport ? '0 元（接待单位已提供交通工具）' : `${LOCAL_TRANSPORT} × ${days} 天 × ${people} 人 = ${money(transport)} 元`,
      });

      const total = round(lodging + meal + transport, 2);
      steps.push({ label: '差旅补贴合计', value: `${money(total)} 元`, emphasis: true });

      const perPerson = round(total / people, 2);
      steps.push({ label: '人均标准', value: `${money(perPerson)} 元` });

      return {
        main: { label: '差旅补贴合计', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '住宿费', value: money(lodging), unit: '元' },
          { label: '伙食补助费', value: money(meal), unit: '元' },
          { label: '市内交通费', value: money(transport), unit: '元' },
          { label: '人均 / 每天', value: money(round(total / Math.max(days * people, 1), 2)), unit: '元' },
        ],
        steps,
        basis: [
          {
            law: '《中央和国家机关差旅费管理办法》',
            article: '第十七条',
            text: '伙食补助费按出差自然（日历）天数计算，按规定标准包干使用。',
          },
          {
            law: '《中央和国家机关差旅费管理办法》',
            article: '第十八条',
            text: '市内交通费按出差自然（日历）天数计算，每人每天80元包干使用。',
          },
        ],
        tips: [
          '伙食补助费与市内交通费按"出差自然天数"包干发放，不需要提供票据，这是最容易漏算的部分。',
          '由接待单位安排用餐或提供交通工具的，相应补助不予发放，如实申报可避免违规风险。',
          '企业可自行制定差旅标准，标准内且取得合规发票的支出可全额税前扣除。',
        ],
      };
    },
  },

  /* ── 差旅报销核算 ── */
  {
    id: 'travel-reimburse',
    name: '差旅报销核算',
    category: 'travel',
    glyph: '报',
    summary: '实际支出与标准对比，识别超标准不予报销部分',
    keywords: ['报销', '差旅报销', '超标准', '费用审核'],
    fields: [
      { key: 'city', label: '出差目的地', type: 'select', defaultValue: '上海', options: CITY_OPTIONS },
      { key: 'level', label: '人员级别', type: 'select', defaultValue: '2', options: LEVEL_OPTIONS },
      { key: 'days', label: '出差天数', type: 'number', unit: '天', defaultValue: 3 },
      { key: 'intercity', label: '城市间交通费（往返）', type: 'money', unit: '元', defaultValue: 2500 },
      { key: 'actualLodging', label: '实际住宿费总额', type: 'money', unit: '元', defaultValue: 1800 },
      { key: 'actualMeal', label: '实际餐费支出', type: 'money', unit: '元', defaultValue: 600, hint: '包干补助制下此项通常不予另行报销' },
      { key: 'actualLocal', label: '实际市内交通支出', type: 'money', unit: '元', defaultValue: 300 },
      {
        key: 'policy',
        label: '报销政策',
        type: 'select',
        defaultValue: 'standard',
        options: [
          { label: '住宿据实报销（不超标准）+ 补贴包干', value: 'standard' },
          { label: '住宿与餐费均据实报销（不发包干补助）', value: 'actual' },
          { label: '全部包干（按标准发放，不审票据）', value: 'lumpsum' },
        ],
      },
    ],
    calc(values): CalcOutput {
      const city = toStr(values.city, '上海');
      const levelIdx = Math.min(2, Math.max(0, Math.round(toNum(values.level, 2))));
      const days = Math.max(0, toNum(values.days));
      const intercity = toNum(values.intercity);
      const actualLodging = toNum(values.actualLodging);
      const actualMeal = toNum(values.actualMeal);
      const actualLocal = toNum(values.actualLocal);
      const policy = toStr(values.policy, 'standard');

      const std = LODGING_STANDARD[city] ?? LODGING_STANDARD['其他地区'];
      const lodgingPerDay = std[levelIdx];
      const lodgingCap = round(lodgingPerDay * days, 2);

      const steps: StepRow[] = [
        { label: '目的地与住宿标准', value: `${city} / ${money(lodgingPerDay)} 元/天` },
        { label: '住宿费上限', value: `${money(lodgingPerDay)} × ${days} 天 = ${money(lodgingCap)} 元` },
      ];

      let reimbursable = 0;
      let selfPaid = 0;

      // 城市间交通费：据实报销
      reimbursable = round(reimbursable + intercity, 2);
      steps.push({ label: '城市间交通费（据实）', value: `${money(intercity)} 元` });

      if (policy === 'lumpsum') {
        const lodging = Math.min(actualLodging, lodgingCap);
        const meal = MEAL_ALLOWANCE * days;
        const local = LOCAL_TRANSPORT * days;
        reimbursable = round(reimbursable + lodging + meal + local, 2);
        selfPaid = round(Math.max(0, actualLodging - lodgingCap) + Math.max(0, actualMeal - meal) + Math.max(0, actualLocal - local), 2);
        steps.push({ label: '全部包干模式', value: `住宿 ${money(lodging)} + 伙食 ${money(meal)} + 市内交通 ${money(local)} 元` });
      } else if (policy === 'actual') {
        const lodging = Math.min(actualLodging, lodgingCap);
        const meal = Math.min(actualMeal, MEAL_ALLOWANCE * days);
        reimbursable = round(reimbursable + lodging + meal, 2);
        selfPaid = round(Math.max(0, actualLodging - lodgingCap) + Math.max(0, actualMeal - MEAL_ALLOWANCE * days) + actualLocal, 2);
        steps.push({ label: '据实报销模式', value: `住宿 ${money(lodging)}（上限 ${money(lodgingCap)}）+ 餐费 ${money(meal)}（上限 ${money(MEAL_ALLOWANCE * days)}）` });
        steps.push({ label: '市内交通', value: `${money(actualLocal)} 元（据实模式下市内交通通常并入餐费标准或不予报销）` });
      } else {
        const lodging = Math.min(actualLodging, lodgingCap);
        const meal = MEAL_ALLOWANCE * days;
        const local = LOCAL_TRANSPORT * days;
        reimbursable = round(reimbursable + lodging + meal + local, 2);
        selfPaid = round(Math.max(0, actualLodging - lodgingCap) + actualMeal + Math.max(0, actualLocal - local), 2);
        steps.push({ label: '住宿（据实，不超标准）', value: `${money(lodging)} 元`, note: actualLodging > lodgingCap ? `实际 ${money(actualLodging)} 元，超标准部分自理` : '未超标准' });
        steps.push({ label: '伙食补助（包干）', value: `${money(meal)} 元`, note: '包干发放后餐费票据不再报销' });
        steps.push({ label: '市内交通（包干）', value: `${money(local)} 元` });
      }

      const actualTotal = round(intercity + actualLodging + actualMeal + actualLocal, 2);
      steps.push({ label: '实际支出总额', value: `${money(actualTotal)} 元` });
      steps.push({ label: '可报销金额', value: `${money(reimbursable)} 元`, emphasis: true });
      steps.push({
        label: '需个人承担',
        value: `${money(selfPaid)} 元`,
        note: selfPaid > 0 ? '主要为超标准住宿及包干外票据' : '无超标准支出',
        emphasis: true,
      });

      return {
        main: { label: '可报销金额', value: money(reimbursable), unit: '元', sub: moneyToChinese(reimbursable) },
        blocks: [
          { label: '实际支出总额', value: money(actualTotal), unit: '元' },
          { label: '需个人承担', value: money(selfPaid), unit: '元', sub: `${((selfPaid / Math.max(actualTotal, 1)) * 100).toFixed(2)}%` },
          { label: '住宿费标准上限', value: money(lodgingCap), unit: '元' },
          { label: '报销比例', value: `${((reimbursable / Math.max(actualTotal, 1)) * 100).toFixed(2)}%` },
        ],
        steps,
        basis: [
          {
            law: '《中央和国家机关差旅费管理办法》',
            article: '第十二条',
            text: '差旅费开支范围包括城市间交通费、住宿费、伙食补助费和市内交通费。',
          },
          {
            law: '《中央和国家机关差旅费管理办法》',
            article: '第十四条',
            text: '出差人员应当在职务级别对应的住宿费标准限额内，选择安全、经济、便捷的宾馆住宿。',
          },
        ],
        tips: [
          '最常见的报销争议是"住宿超标准"，出差前应先确认目的地当季限价，旺季可上浮的地区需提前报批。',
          '包干制下伙食补助与市内交通无需票据，但票据报销与包干补助不能重复享受。',
          '企业差旅标准高于国家机关标准的，超出部分的税前扣除仍以"合理支出"为限，建议制度中明确标准。',
        ],
      };
    },
  },

  /* ── 年度差旅预算 ── */
  {
    id: 'travel-budget',
    name: '年度差旅预算',
    category: 'travel',
    glyph: '预',
    summary: '按出差频次与人均标准测算年度差旅费总额与降本空间',
    keywords: ['差旅预算', '年度预算', '差旅成本', '降本'],
    fields: [
      { key: 'trips', label: '年度出差人次', type: 'number', unit: '人次', defaultValue: 120 },
      { key: 'avgDays', label: '人均每次天数', type: 'number', unit: '天', defaultValue: 2.5 },
      { key: 'avgIntercity', label: '人均往返交通费', type: 'money', unit: '元', defaultValue: 2200 },
      { key: 'avgLodging', label: '人均住宿费（元/天）', type: 'money', unit: '元', defaultValue: 450 },
      { key: 'mealStd', label: '伙食补助（元/天）', type: 'money', unit: '元', defaultValue: 100 },
      { key: 'localStd', label: '市内交通（元/天）', type: 'money', unit: '元', defaultValue: 80 },
      {
        key: 'optimize',
        label: '测算降本方案',
        type: 'switch',
        defaultValue: true,
      },
      {
        key: 'optRate',
        label: '预期降本比例',
        type: 'percent',
        unit: '%',
        defaultValue: 15,
        hint: '通过协议酒店、提前购票、线上会议替代等方式',
        visibleWhen: (v) => v.optimize === true || v.optimize === 'true',
      },
    ],
    calc(values): CalcOutput {
      const trips = Math.max(0, toNum(values.trips));
      const avgDays = toNum(values.avgDays);
      const intercity = toNum(values.avgIntercity);
      const lodgingPerDay = toNum(values.avgLodging);
      const meal = toNum(values.mealStd);
      const local = toNum(values.localStd);
      const optimize = values.optimize === true || values.optimize === 'true';
      const optRate = toNum(values.optRate) / 100;

      const totalDays = round(trips * avgDays, 2);
      const steps: StepRow[] = [{ label: '年度出差总天数', value: `${trips} 人次 × ${avgDays} 天 = ${totalDays} 天` }];

      const intercityTotal = round(trips * intercity, 2);
      steps.push({ label: '城市间交通费', value: `${trips} × ${money(intercity)} = ${money(intercityTotal)} 元` });

      const lodgingTotal = round(totalDays * lodgingPerDay, 2);
      steps.push({ label: '住宿费', value: `${totalDays} 天 × ${money(lodgingPerDay)} = ${money(lodgingTotal)} 元` });

      const mealTotal = round(totalDays * meal, 2);
      steps.push({ label: '伙食补助', value: `${totalDays} 天 × ${money(meal)} = ${money(mealTotal)} 元` });

      const localTotal = round(totalDays * local, 2);
      steps.push({ label: '市内交通费', value: `${totalDays} 天 × ${money(local)} = ${money(localTotal)} 元` });

      const total = round(intercityTotal + lodgingTotal + mealTotal + localTotal, 2);
      steps.push({ label: '年度差旅费总额', value: `${money(total)} 元`, emphasis: true });

      const perTrip = round(total / Math.max(trips, 1), 2);
      steps.push({ label: '单次人均成本', value: `${money(perTrip)} 元` });

      let saving = 0;
      if (optimize) {
        saving = round(total * optRate, 2);
        steps.push({
          label: `降本测算（${toNum(values.optRate)}%）`,
          value: `${money(total)} × ${toNum(values.optRate)}% = ${money(saving)} 元`,
          emphasis: true,
        });
        steps.push({ label: '优化后预算', value: `${money(round(total - saving, 2))} 元`, emphasis: true });
      }

      return {
        main: { label: '年度差旅费预算', value: money(total), unit: '元', sub: moneyToChinese(total) },
        blocks: [
          { label: '单次人均成本', value: money(perTrip), unit: '元' },
          { label: '年度出差总天数', value: `${totalDays} 天` },
          { label: '住宿费占比', value: `${((lodgingTotal / Math.max(total, 1)) * 100).toFixed(2)}%` },
          { label: '交通费占比', value: `${(((intercityTotal + localTotal) / Math.max(total, 1)) * 100).toFixed(2)}%` },
          ...(optimize ? [{ label: '预计可节约', value: money(saving), unit: '元', sub: `优化后 ${money(round(total - saving, 2))} 元` }] : []),
        ],
        steps,
        basis: [
          {
            law: '《中央和国家机关差旅费管理办法》',
            article: '第三条',
            text: '差旅费是指工作人员临时到常驻地以外地区公务出差所发生的城市间交通费、住宿费、伙食补助费和市内交通费。',
          },
        ],
        tips: [
          '住宿费通常是最大成本项（占比 40%—55%），签订协议酒店是见效最快的降本手段。',
          '提前 15—30 天预订机票、选择高铁替代短途航班，通常可压缩交通费 10%—20%。',
          '差旅制度应明确审批流程、标准上限与超标处理规则，既是成本控制手段，也是税务合规与廉洁风险防控的依据。',
        ],
      };
    },
  },
];
