/**
 * 法定口径回归审计（评估工具 · 全业务覆盖版）
 *
 * 每个用例均为"按法条/官方费率手算"的期望值，与 src/core 纯函数结果逐项比对。
 * 覆盖要求：全部 45 个计算器至少 1 条用例，核心分支（封顶 / 兜底 / 顺延 / 价税分离等）单独加测。
 * 运行：npx tsx skill/scripts/audit.ts
 * 退出码：0 全部通过且无覆盖缺口；1 存在失败或缺口。
 */
import type { CalcValues } from '../../src/core/types';
import { loadFirst, CORE_CANDIDATES } from './core-loader';

const { getCalculator, defaultValues, ALL_CALCULATORS } = loadFirst<typeof import('../../src/core/calculators')>(
  CORE_CANDIDATES('calculators'),
);

interface Case {
  id: string;
  over: CalcValues;
  /** 期望主结果（已格式化字符串） */
  expect: string;
  /** 期望分项：[label, value] */
  expectBlocks?: Array<[string, string]>;
  /** 口径说明（法条 / 手算过程） */
  basis: string;
}

const CASES: Case[] = [
  // ── 诉讼费用 ──
  {
    id: 'civil-fee',
    over: { amount: 10000 },
    expect: '50.00',
    basis: '《诉讼费用交纳办法》第13条：不超过1万元每件50元',
  },
  {
    id: 'civil-fee',
    over: { amount: 1000000 },
    expect: '13,800.00',
    basis: '50+9万×2.5%+10万×2%+30万×1.5%+50万×1%=13800',
  },
  {
    id: 'civil-fee',
    over: { amount: 1000000, half: 'simple' },
    expect: '6,900.00',
    basis: '第16条：简易程序减半 → 13800/2',
  },
  {
    id: 'preservation-fee',
    over: { amount: 10000000 },
    expect: '5,000.00',
    basis: '第14条第(三)项：30+990+990万×0.5%=50520 → 封顶5000',
  },
  {
    id: 'preservation-fee',
    over: { amount: 500000 },
    expect: '3,020.00',
    basis: '第14条第(三)项：30+990+40万×0.5%=3020（未封顶）',
  },
  {
    id: 'preservation-guarantee-fee',
    over: { amount: 10000000, guarantee: 'insurance', guaranteeRate: 0.8, years: 1, minPremium: 500 },
    expect: '8,000.00',
    basis: '商业费率：1000万×0.8‰/年×1年=8000（非法定收费，按市场报价）',
  },
  {
    id: 'preservation-guarantee-fee',
    over: { amount: 10000000, guarantee: 'cash', years: 1 },
    expect: '0.00',
    basis: '现金担保不产生外部费用（冻结资金，成本为机会成本）',
  },
  {
    id: 'execution-fee',
    over: { amount: 1000000 },
    expect: '12,400.00',
    basis: '第14条：50+49万×1.5%+50万×1%=12400',
  },
  {
    id: 'non-property-fee',
    over: { caseType: 'divorce', propertyAmount: 500000 },
    expect: '1,700.00',
    basis: '第13条第2项：离婚每件50~300按中位200；财产超20万部分30万×0.5%=1500；合计1700',
  },
  {
    id: 'non-property-fee',
    over: { caseType: 'personality', propertyAmount: 200000 },
    expect: '1,300.00',
    basis: '第13条第3项：中位300；5万—10万部分5万×1%=500；超10万部分10万×0.5%=500；合计1300',
  },
  {
    id: 'application-fee',
    over: {},
    expect: '1,433.33',
    basis: '第14条：支付令比照财产案件受理费1/3；20万标准费4300÷3=1433.33',
  },
  {
    id: 'application-fee',
    over: { appType: 'bankruptcy', amount: 100000000 },
    expect: '270,900.00',
    basis: '第14条：1亿受理费541800（含1000万—2000万段0.6%）÷2=270900，未达30万封顶据实减半',
  },
  {
    id: 'application-fee',
    over: { appType: 'bankruptcy', amount: 200000000 },
    expect: '300,000.00',
    basis: '第14条：2亿受理费1441800÷2=720900 → 30万封顶',
  },
  {
    id: 'lawyer-fee',
    over: {},
    expect: '50,000.00',
    expectBlocks: [['有效费率', '5.00%']],
    basis: '100万×5%=5万 ≥ 最低收费5000 → 按5万；有效费率5%',
  },
  {
    id: 'lawyer-fee',
    over: { mode: 'contingency' },
    expect: '140,000.00',
    expectBlocks: [
      ['法定上限（标的额 30%）', '300,000.00'],
      ['占实际回款比例', '17.5%'],
    ],
    basis: '收费办法第13条：基础2万+回款80万×15%=12万=14万；30%上限=30万未超；占回款17.5%',
  },
  // ── 利息与违约金 ──
  {
    id: 'delay-interest',
    over: { principal: 1000000, hasGeneral: false, startDate: '2025-01-01', endDate: '2026-01-01' },
    expect: '63,875.00',
    basis: '法释〔2014〕8号：100万×0.0175%×365天=63875',
  },
  {
    id: 'lpr-interest',
    over: { principal: 500000, agreedRate: 24, lpr: 3, days: 365 },
    expect: '60,833.33',
    expectBlocks: [
      ['司法保护上限（年化）', '12%'],
      ['约定利率是否超限', '⚠ 已超限'],
      ['本息合计', '560,833.33'],
    ],
    basis: '民间借贷规定第25条：LPR3%×4=12%上限；50万×12%×365/360=60833.33（约定24%超限按上限核减）',
  },
  {
    id: 'lpr-interest',
    over: { principal: 100000, agreedRate: 10, lpr: 3.5, days: 360, cutHead: true, cutAmount: 10000 },
    expect: '9,000.00',
    expectBlocks: [
      ['司法保护上限（年化）', '14%'],
      ['本息合计', '99,000.00'],
    ],
    basis: '民法典第670条砍头息：实际本金10万−1万=9万；9万×10%×360/360=9000；10%≤14%未超限',
  },
  {
    id: 'general-interest',
    over: {},
    expect: '182,666.67',
    basis: '单利360基数：差值法1096天（2023→2026，2024闰年366）÷360=3.0444年；100万×6%×3.0444=182666.67',
  },
  {
    id: 'general-interest',
    over: { mode: 'compound' },
    expect: '194,192.04',
    basis: '年复利：3整年100万×1.06³=1191016；余数0.0444年单利+71460.96×0.0444=3176.04；利息=1191016+3176.04−100万=194192.04',
  },
  {
    id: 'contract-penalty',
    over: { principal: 10000000, mode: 'daily', dailyRate: 5, startDate: '2025-01-01', endDate: '2026-06-30' },
    expect: '2,725,000.00',
    basis: '《民法典》第201条起始日不计入 → 545天；1000万×5‰×545/10=272.5万',
  },
  {
    id: 'contract-penalty',
    over: { principal: 10000000, mode: 'daily', dailyRate: 5, startDate: '2025-01-01', endDate: '2027-12-31' },
    expect: '3,000,000.00',
    basis: '上限条款：占本金30%封顶 → 300万（违约金过高调整规则）',
  },
  {
    id: 'penalty-adjust',
    over: {},
    expect: '325,000.00',
    expectBlocks: [
      ['损失 130% 参考线', '260,000.00'],
      ['是否构成"过分高于"', '是（超过损失 30%）'],
      ['调减幅度', '35.00%'],
    ],
    basis: '通则解释第65条：故意+15%、已履行50%±0、商事+10% → 系数1.25；20万×130%×1.25=32.5万；min(50万, 32.5万)',
  },
  {
    id: 'loan-compliance',
    over: { contractAmount: 1000000, cutAmount: 100000, interestRate: 12, serviceFee: 50000, term: 12, lpr: 3.5 },
    expect: '17.5556%',
    expectBlocks: [
      ['实际可用本金', '900,000.00'],
      ['法院可支持成本', '126,000.00'],
      ['到期应还总额（合规口径）', '1,026,000.00'],
    ],
    basis: '第670条砍头息：实际本金90万；利息10.8万+服务费5万=15.8万；综合年化15.8万÷90万=17.5556%＞LPR3.5%×4=14%；按上限支持90万×14%=12.6万',
  },
  {
    id: 'occupation-loss',
    over: {},
    expect: '45,000.00',
    expectBlocks: [
      ['适用年利率', '4.500%'],
      ['本息合计', '1,045,000.00'],
    ],
    basis: '买卖合同解释第18条：LPR3%×(1+50%)=4.5%；100万×4.5%×365/365=4.5万（365天基数）',
  },
  // ── 劳动争议 ──
  {
    id: 'overtime-pay',
    over: { monthlySalary: 21750, weekdayHours: 8, restDayHours: 16, holidayHours: 8, restDayComp: false, months: 1 },
    expect: '8,500.00',
    expectBlocks: [
      ['工作日加班费', '1,500.00'],
      ['休息日加班费', '4,000.00'],
      ['法定节假日加班费', '3,000.00'],
    ],
    basis: '《劳动法》第44条：小时工资125元；8h×1.5=1500；16h×2=4000；8h×3=3000',
  },
  {
    id: 'severance',
    over: { startDate: '2019-03-01', endDate: '2026-01-31', avgSalary: 18000 },
    expect: '126,000.00',
    basis: '《劳动合同法》第47条：6年11个月→7个月；18000×7=126000',
  },
  {
    id: 'severance',
    over: { startDate: '2019-03-01', endDate: '2026-01-31', avgSalary: 18000, reason: 'resign' },
    expect: '0',
    basis: '第46条：劳动者主动辞职无经济补偿',
  },
  {
    id: 'severance',
    over: { startDate: '2019-03-01', endDate: '2026-01-31', avgSalary: 90000, localAvg: 12000 },
    expect: '252,000.00',
    basis: '第47条：月工资超社平3倍按3倍封顶 → 12000×3=36000；36000×7=252000',
  },
  {
    id: 'illegal-termination',
    over: { startDate: '2021-06-15', endDate: '2026-01-31', avgSalary: 15000 },
    expect: '150,000.00',
    basis: '第48、87条：4年7.5个月→N=5；2N=15000×5×2=150000',
  },
  {
    id: 'annual-leave-pay',
    over: {},
    expect: '11,034.40',
    expectBlocks: [
      ['法定应休天数', '5 天'],
      ['日工资', '551.72'],
      ['本年度 300% 总额', '8,275.80'],
    ],
    basis: '年休假条例第3/5条：工龄8年应休5天；日工资12000÷21.75=551.72；另付200%×5天×2年=11034.40',
  },
  {
    id: 'double-wage',
    over: {},
    expect: '132,000.00',
    expectBlocks: [
      ['可主张月数', '11 个月'],
      ['是否已超最长期间', '是（已达 11 个月上限）'],
    ],
    basis: '劳动合同法第82条+实施条例第7条：宽限期2025-02-01至满一年共11个月封顶；12000×11=132000',
  },
  {
    id: 'double-wage',
    over: { status: 'signed' },
    expect: '72,000.00',
    basis: '已补签：计算至补签日2025-08-01，自宽限期届满2025-02-01起6个月；12000×6=72000',
  },
  {
    id: 'work-injury',
    over: {},
    expect: '230,000.00',
    expectBlocks: [
      ['一次性伤残补助金', '90,000.00'],
      ['一次性工伤医疗补助金', '60,000.00'],
      ['一次性伤残就业补助金', '80,000.00'],
    ],
    basis: '工伤保险条例第37条：9级9个月×1万=9万；解除劳动关系时医疗6个月+就业8个月=14万；合计23万',
  },
  {
    id: 'work-injury',
    over: { level: '4', salary: 40000, localAvg: 9000, terminate: false },
    expect: '567,000.00',
    expectBlocks: [
      ['一次性伤残补助金', '567,000.00'],
      ['伤残津贴（按月）', '20,250.00'],
    ],
    basis: '第64条：4万＞社平9千×300%=2.7万按2.7万计；第35条4级21个月×2.7万=56.7万；津贴75%=月2.025万',
  },
  {
    id: 'work-death',
    over: {},
    expect: '1,184,040.00',
    expectBlocks: [
      ['丧葬补助金', '54,000.00'],
      ['一次性工亡补助金', '1,130,040.00'],
    ],
    basis: '《工伤保险条例》第39条：丧葬=9000×6=54000；一次性=56502×20=1130040（2025年度城镇居民人均可支配收入，国家统计局 2026-01-19 发布）',
  },
  {
    id: 'non-compete',
    over: {},
    expect: '144,000.00',
    expectBlocks: [
      ['月补偿标准', '6,000.00'],
      ['占离职前工资比例', '30%'],
    ],
    basis: '劳动争议司法解释（一）：未约定补偿标准按前12月平均工资30%=6000/月；24个月×6000=144000',
  },
  {
    id: 'non-compete',
    over: { avgSalary: 5000, months: 36, agreed: true, monthlyAmount: 2000, minWage: 2500 },
    expect: '60,000.00',
    basis: '劳动合同法第24条：约定36个月超2年部分无效按24个月计；约定2000低于最低工资2500补足；2500×24=60000',
  },
  // ── 税务 ──
  {
    id: 'stamp-duty',
    over: { item: 'sale', amount: 50000000, copies: 2 },
    expect: '30,000.00',
    basis: '《印花税法》：买卖合同万分之三；5000万×0.03%=15000×2份=30000',
  },
  {
    id: 'personal-income-tax',
    over: {},
    expect: '10,680.00',
    expectBlocks: [
      ['月均税负', '890.00'],
      ['税后月均收入', '21,110.00'],
      ['全年综合所得', '300,000.00'],
    ],
    basis: '个税法第6条：30万−6万−社保3.6万−专项附加7.2万（子女2.4+赡养3.6+房贷1.2）=13.2万；13.2万×10%−2520=10680',
  },
  {
    id: 'personal-income-tax',
    over: { monthlySalary: 80000, bonus: 200000, socialMonthly: 8000, children: 2, elderly: true, housing: 'rent1500', infant: 1 },
    expect: '221,380.00',
    basis: '116万−6万−社保9.6万−专项附加12.6万（子女4.8+赡养3.6+租金1.8+婴幼儿2.4）=87.8万；87.8万×35%−85920=221380',
  },
  {
    id: 'labor-remuneration-tax',
    over: {},
    expect: '600.00',
    expectBlocks: [
      ['单次预扣税额', '25,000.00'],
      ['年度预扣合计', '25,000.00'],
      ['劳务报酬税后净额', '99,400.00'],
    ],
    basis: '预扣：10万×80%=8万→40%档8万×40%−7000=2.5万；汇算：8万+0−6万=2万×3%=600；应退税24400',
  },
  {
    id: 'penalty-tax',
    over: {},
    expect: '173,318.58',
    expectBlocks: [
      ['增值税', '57,522.12'],
      ['附加税费', '6,902.65'],
      ['企业所得税', '108,893.81'],
    ],
    basis: '增值税细则第12条价外费用需价税分离：50万÷1.13×13%=57522.12；附加12%=6902.65；所得税(50万−两项)×25%=108893.81',
  },
  {
    id: 'penalty-tax',
    over: { receiver: 'buyer' },
    expect: '125,000.00',
    expectBlocks: [
      ['增值税', '0.00'],
      ['企业所得税', '125,000.00'],
    ],
    basis: '守约方收取违约金未发生销售行为不征增值税；50万×25%=12.5万',
  },
  {
    id: 'social-insurance',
    over: {},
    expect: '20,655.00',
    expectBlocks: [
      ['单位社保公积金（月）', '5,655.00'],
      ['个人社保公积金（月）', '3,375.00'],
      ['员工实发（未扣个税）', '11,625.00'],
      ['年度用工成本（12 个月）', '247,860.00'],
    ],
    basis: '单位16+8+0.5+0.4+0.8+12=37.7%→5655；个人8+2+0.5+12=22.5%→3375；1.5万+5655=20655；×12=247860',
  },
  // ── 时效与期限 ──
  {
    id: 'limitation-period',
    over: {},
    expect: '2026-06-01',
    expectBlocks: [
      ['星期', '星期一'],
      ['二十年最长保护期', '2043-01-01'],
    ],
    basis: '民法典第188条：知道受损日2023-06-01+3年=2026-06-01（周一，非休假日不顺延）；最长保护期自损害日2023-01-01+20年=2043-01-01',
  },
  {
    id: 'limitation-period',
    over: { type: 'maritime' },
    expect: '2024-06-03',
    expectBlocks: [['星期', '星期一']],
    basis: '第203条：海上货运1年时效，2023-06-01+1年=2024-06-01为周六 → 越过周日顺延至2024-06-03（周一）',
  },
  {
    id: 'period-calc',
    over: {},
    expect: '2026-02-04',
    expectBlocks: [
      ['起算日', '2026-01-21'],
      ['是否顺延', '否'],
      ['自然日数', '15 天'],
    ],
    basis: '民法典第201条当日不计入：01-20次日01-21起算第15日=02-04（周三）',
  },
  {
    id: 'period-calc',
    over: { baseDate: '2026-01-31' },
    expect: '2026-02-23',
    expectBlocks: [
      ['起算日', '2026-02-01'],
      ['是否顺延', '是（顺延 8 天）'],
    ],
    basis: '第203条：02-01起算第15日名义届满02-15，恰在2026春节假期02-15—02-22内 → 顺延8天至02-23',
  },
  {
    id: 'appeal-deadline',
    over: {},
    expect: '2026-02-04',
    expectBlocks: [
      ['法定期间', '15 日'],
      ['起算日', '2026-01-21'],
      ['是否顺延', '否'],
    ],
    basis: '民诉法：判决上诉期15日；01-20送达，次日01-21起算第15日=02-04（周三）',
  },
  {
    id: 'appeal-deadline',
    over: { serveDate: '2026-01-30' },
    expect: '2026-02-14',
    expectBlocks: [['是否顺延', '否']],
    basis: '01-31起算第15日=02-14（周六）；02-14为2026春节调休上班日，不属于休假日 → 届满日不顺延',
  },
  {
    id: 'execution-apply',
    over: {},
    expect: '2026-06-01',
    expectBlocks: [
      ['法定期间', '2 年'],
      ['起算日', '2024-06-02'],
    ],
    basis: '民诉法第246条：履行期间最后一日2024-06-01+2年=2026-06-01（周一）',
  },
  {
    id: 'execution-apply',
    over: { staged: true },
    expect: '2027-06-01',
    expectBlocks: [['起算日', '2025-06-02']],
    basis: '分期履行自最后一期届满日2025-06-01起算+2年=2027-06-01（周二）',
  },
  {
    id: 'retrial-deadline',
    over: {},
    expect: '2025-12-01',
    expectBlocks: [
      ['法定期间', '6 个月'],
      ['适用起算点', '裁判生效之日'],
    ],
    basis: '民诉法第205条：生效日2025-06-01+6个月=2025-12-01（周一）',
  },
  {
    id: 'retrial-deadline',
    over: { special: true },
    expect: '2026-07-01',
    expectBlocks: [['适用起算点', '知道特殊事由之日']],
    basis: '特殊事由自知道之日2026-01-01+6个月=2026-07-01，晚于生效日起算的2025-12-01 → 取较晚者',
  },
  {
    id: 'arbitration-limitation',
    over: {},
    expect: '2026-06-01',
    expectBlocks: [
      ['法定时效', '1 年'],
      ['起算基准', '劳动关系终止之日'],
    ],
    basis: '调解仲裁法第27条第4款：拖欠劳动报酬自劳动关系终止日2025-06-01起算1年=2026-06-01',
  },
  {
    id: 'arbitration-limitation',
    over: { disputeType: 'termination' },
    expect: '2026-01-05',
    expectBlocks: [
      ['起算基准', '知道或应当知道权利被侵害之日'],
      ['起算日', '2025-01-02'],
    ],
    basis: '一般争议自知道之日2025-01-01起算1年=2026-01-01恰逢元旦假期（01-01—01-03）→ 越过周日顺延至01-05',
  },
  // ── 法务成本 ──
  {
    id: 'case-cost',
    over: {},
    expect: '196,800.00',
    expectBlocks: [
      ['外部支出', '172,800.00'],
      ['内部人力成本', '24,000.00'],
      ['净收益', '1,203,200.00'],
      ['月度成本', '16,400.00'],
    ],
    basis: '受理费自动测算200万标的=22800；外部=律师15万+受理2.28万=17.28万；内部80h×300=2.4万；总19.68万；回款140万−19.68万=净120.32万',
  },
  {
    id: 'counsel-compare',
    over: { scenario: 'pessimistic' },
    expect: 'C 风险代理',
    expectBlocks: [
      ['方案 C 风险代理', '138,000.00'],
      ['推荐方案', 'C 风险代理'],
    ],
    basis: '悲观回款30%：90万；C=基础3万+90万×12%=13.8万＜A固定20万＜B计时30万 → 最优C',
  },
  {
    id: 'dispute-decision',
    over: {},
    expect: '调解 / 和解',
    expectBlocks: [
      ['诉讼（一审 + 可能二审）', '589,300.00'],
      ['仲裁（一裁终局）', '509,166.67'],
      ['调解 / 和解', '144,166.67'],
    ],
    basis: '受理费46800+律师25万+内部3万=32.68万+资金占用17.5万×1.5年=58.93万；仲裁费11.25万（25万×4%+75万×3%+400万×2%）+28万+11.67万=50.92万；调解10万+1.5万+2.92万=14.42万最优',
  },
  {
    id: 'legal-dept-roi',
    over: {},
    expect: '6,000,000.00',
    expectBlocks: [
      ['投入产出比', '316.67%'],
      ['单案件平均成本', '50,000.00'],
      ['人均管理争议金额', '10,000,000.00'],
    ],
    basis: '8人×50万+外部150万+诉讼30万+系统20万=600万；ROI=(2500万−600万)÷600万=316.67%；600万÷120件=5万/件；8000万÷8人=1000万/人',
  },
  // ── 差旅费用 ──
  {
    id: 'travel-allowance',
    over: {},
    expect: '4,080.00',
    expectBlocks: [
      ['住宿费', '3,000.00'],
      ['伙食补助费', '600.00'],
      ['市内交通费', '480.00'],
      ['人均 / 每天', '680.00'],
    ],
    basis: '差旅办法第17/18条：北京其他人员住宿500×3天×2人=3000；伙食100×6人次天=600；市内交通80×6=480',
  },
  {
    id: 'travel-reimburse',
    over: {},
    expect: '4,540.00',
    expectBlocks: [
      ['需个人承担', '960.00'],
      ['住宿费标准上限', '1,500.00'],
    ],
    basis: '上海其他人员500/天×3天=1500上限，实住1800超300自理；包干伙食300+市内交通240；城际交通2500据实；可报2500+1500+300+240=4540；自理=超标300+餐票600+超包干交通60=960',
  },
  {
    id: 'travel-budget',
    over: {},
    expect: '453,000.00',
    expectBlocks: [
      ['单次人均成本', '3,775.00'],
      ['预计可节约', '67,950.00'],
    ],
    basis: '120人次×2.5天=300人天；交通264000+住宿135000+伙食30000+市内24000=453000；降本15%=67950',
  },
  // ── 其他诉讼费用 ──
  {
    id: 'announcement-fee',
    over: { annoType: 'service', times: 1 },
    expect: '300.00',
    basis: '市场公示价：诉讼文书送达公告300元/次（第12条：当事人直接支付）',
  },
  {
    id: 'notarization-fee',
    over: { notaryType: 'enforcement', amount: 10000000 },
    expect: '30,000.00',
    basis: '赋强公证：标的额×0.3% → 1000万×0.3%=30000',
  },
  {
    id: 'expertise-fee',
    over: { expType: 'handwriting', method: 'bycase' },
    expect: '4,000.00',
    basis: '文书鉴定按件参考价4000元/件',
  },
  {
    id: 'valuation-fee',
    over: { valType: 'asset', value: 10000000, discount: 100 },
    expect: '28,500.00',
    basis: '资产评估计件分档：100万以下0.6%+900万×0.25%=6000+22500=28500',
  },
  {
    id: 'valuation-fee',
    over: { valType: 'asset', value: 10000000, discount: 60 },
    expect: '17,100.00',
    basis: '市场折扣：28500×60%=17100',
  },
  // ── 综合测算 ──
  {
    id: 'litigation-total',
    over: { amount: 5000000, lawyerFee: 200000, preserve: true },
    expect: '253,400.00',
    basis: '受理费46800+律师200000+保全(5000封顶+200万×0.8‰=1600)=253400',
  },
];

let fail = 0;
console.log(`法定口径回归审计 · 共 ${CASES.length} 个用例\n`);
for (const c of CASES) {
  const def = getCalculator(c.id);
  if (!def) {
    console.log(`FAIL ${c.id} :: 计算器不存在`);
    fail++;
    continue;
  }
  try {
    const out = def.calc({ ...defaultValues(def), ...c.over });
    const problems: string[] = [];
    if (out.main.value !== c.expect) {
      problems.push(`主结果 ${out.main.value} ≠ 期望 ${c.expect}`);
    }
    for (const [label, val] of c.expectBlocks ?? []) {
      const b = (out.blocks ?? []).find((x) => x.label === label);
      if (!b) problems.push(`缺少分项「${label}」`);
      else if (b.value !== val) problems.push(`分项「${label}」${b.value} ≠ 期望 ${val}`);
    }
    if (problems.length) {
      fail++;
      console.log(`FAIL ${c.id} ${JSON.stringify(c.over)}`);
      for (const p of problems) console.log(`     - ${p}`);
      console.log(`     口径：${c.basis}`);
    } else {
      console.log(`OK   ${c.id.padEnd(22)} ${out.main.value}${out.main.unit ? ' ' + out.main.unit : ''}  ← ${c.basis}`);
    }
  } catch (e) {
    fail++;
    console.log(`FAIL ${c.id} :: 抛出异常 ${String(e)}`);
  }
}

// 全业务覆盖断言：每个计算器至少 1 条用例，缺一即 FAIL
const covered = new Set(CASES.map((c) => c.id));
const missing = ALL_CALCULATORS.filter((d) => !covered.has(d.id));
if (missing.length) {
  fail += missing.length;
  console.log(`\nFAIL 覆盖缺口（${missing.length} 个计算器无用例）：${missing.map((m) => m.id).join(', ')}`);
} else {
  console.log(`\n覆盖校验：全部 ${ALL_CALCULATORS.length} 个计算器均有法定口径用例。`);
}

console.log(`\n合计 ${CASES.length} 个用例，通过 ${CASES.length - fail} 个，失败 ${fail} 个。`);
process.exit(fail ? 1 : 0);
