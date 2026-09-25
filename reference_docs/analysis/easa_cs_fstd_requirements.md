# EASA 模拟机（FSTD）资质与检查管理 — 需求提炼

> 来源文档：
> 1. `Easy_Access_Rules_CS-FSTD_A_Issue_2_2020.pdf`（现行技术规范，Issue 2，2019/2020）
> 2. `CS-FSTD_Issue_1_2026.pdf`（新一代基于FCS的技术规范，2026年7月发布，2028-04-30生效）
> 3. `Explanatory_Note_ED_Decisions_2026-006-007-008.pdf`（新旧体系差异说明）
> 4. 补充核对：`Easy_Access_Rules_for_Aircrew_2025-11.pdf` 中 Annex VI (Part-ARA) Subpart FSTD 与 Annex VII (Part-ORA) Subpart FSTD（现行运营人/主管机关职责、记录保存条款——CS-FSTD(A)/(H) 本身不含这些运营层条款，须与 Part-ORA/ARA 配合阅读）
>
> 说明：CS-FSTD Issue 1 全文约630页，技术性objective test/tolerance条款未逐条摘录，本清单聚焦"系统需要建模的数据字段与业务流程"，而非完整的适航技术标准。

---

## 0. 顶层法规关系速览

```
Regulation (EU) 2026/781（2026-04-08通过）
  → 修订 Aircrew Regulation No 1178/2011（Part-FCL / Part-ARA / Part-ORA）
  → 修订 Air OPS Regulation No 965/2012（Part-ORO Subpart FC）
  → 引入 FCS 框架 + task-to-tool 方法论
  → 适用日期 = CS-FSTD Issue 1 生效日 = 2028-04-30（三份ED Decision同日生效）

现行体系（今天—2028-04-30，之后仍长期并存于存量机队）：
  CS-FSTD(A) Issue 2（技术规范：等级） + Part-ARA/ORA Subpart FSTD（Amendment 14，运营/监管流程）

新体系（2028-04-30起，新初始鉴定强制使用；存量设备可自愿/渐进过渡）：
  CS-FSTD Issue 1（技术规范：FCS，飞机+直升机合并） + Part-ARA/ORA Subpart FSTD（Amendment 15，已随本次ED Decision同步修订）
```

关键结论：**2028-04-30之后，新FSTD只能以FCS方式获得初始鉴定**；但存量“legacy FSTD”不会被强制退役或重新鉴定，可继续按原等级运行，也可选择被"assigned FCS"（指定等效能力签名）纳入新框架，因此系统必须**长期双轨并存**，不是简单的迁移开关。

---

## 1. 旧体系（CS-FSTD(A) Issue 2 + Part-ARA/ORA Subpart FSTD）

### 1.1 FSTD 分级定义（数据字典）

CS-FSTD(A) Subpart B（CS FSTD(A).200）定义的设备大类：

| 大类 | 全称 | 关键特征 |
|---|---|---|
| FFS | Full Flight Simulator | 全尺寸复制驾驶舱 + 视景系统 + 力反馈运动系统 |
| FTD | Flight Training Device | 全尺寸仪表/面板/操纵，可开放式或封闭式驾驶舱，不强制视景/运动 |
| FNPT | Flight & Navigation Procedures Trainer | 代表某机型或某机型class的驾驶舱环境 |
| BITD | Basic Instrument Training Device | 代表某class飞机的单座训练台，屏幕化仪表+弹簧加载操纵 |
| OTD | Other Training Device | 不需要鉴定，非完整驾驶舱环境的训练辅助设备 |

等级（Level）矩阵（Appendix 8 to AMC1 FSTD(A).300，节选技术要点）：

| 设备类型 | 等级 | 核心要求摘要 |
|---|---|---|
| FFS | A | 最低复杂度；全尺寸驾驶舱复制；class-specific数据允许；通用地面效应模型；视野≥45°水平/30°垂直；控制响应延迟≤300ms |
| FFS | B/C | 在A基础上：须用飞行试验数据（validation flight test data）建立性能/操纵特性及地面操纵/空气动力学 |
| FFS | C | 在B基础上：日/暮/夜视景，180°水平/40°垂直连续准直视场；六自由度运动；风切变模拟；UPRT IOS反馈；响应延迟≤150ms |
| FFS | D | 在C基础上：扩展的声音与运动抖振测试集（最高保真度） |
| FTD | 1 | 机型专用，至少一个系统完整体现；开放式或封闭式驾驶舱 |
| FTD | 2 | 机型专用，全部适用系统完整体现；封闭驾驶舱+机载教员站；机型专用或通用飞行动力学 |
| FNPT | I | 封闭驾驶舱环境；至少5个欧洲机场完整导航数据（3个月内更新）；失速警告装置 |
| FNPT | II | 在I基础上：封闭驾驶舱含教员站；座椅可调至设计视点；断路器功能正确；结冰/偏航滚转建模；通用地面操纵模型；视野≥45°/30° |
| FNPT | II MCC | 在II基础上：增加多机组协作(MCC)训练所需仪表/指示器 |
| BITD | — | 代表某class飞机学员站；导航数据库≥3机场；失速警告装置 |

### 1.2 核心术语字段（CS FSTD(A).200 / AMC1）

| 字段/术语 | 定义要点 | 系统建模建议 |
|---|---|---|
| FSTD operator | 直接对主管机关负责、申请并维持某FSTD鉴定的组织 | `organization` 外键 |
| FSTD user | 请求使用FSTD进行训练/测试/检查的组织或个人 | 训练排班中的使用方 |
| FSTD qualification | FSTD的技术能力等级（在合规文件中定义） | 鉴定证书实体 |
| QTG（Qualification Test Guide） | 证明FSTD性能与飞机数据在允许公差内一致的文档，含飞机数据+FSTD数据 | 文档实体，版本化 |
| MQTG（Master QTG） | 经主管机关批准、含见证测试结果的QTG，作为后续评估基准 | QTG的"已批准/基准"状态 |
| SOC（Statement of Compliance） | 声明某项要求已被满足的说明 | 逐条要求-合规声明表 |
| Grandfather rights | 运营人保留此前法规下已获等级的权利；用户保留已获训练/测试学分的权利 | 布尔标记+法规版本快照 |
| Convertible FSTD | 硬件软件可切换代表不同机型/变体的FSTD | 多机型配置关联表 |
| Update vs Upgrade | Update=保持原等级的改进；Upgrade=提升鉴定等级或训练学分，须按最新标准重新初始鉴定 | 变更类型枚举 |

### 1.3 初始鉴定（Initial Qualification）业务流程与所需文件

1. **申请**（ORA.FSTD.200 / AMC1）：BITD由制造商申请，其余由运营组织申请；须提交如何满足要求的文件，含配置管理体系说明（对应ORA.FSTD.230程序）。申请信模板字段：设备类型、拟申请等级、机型/机型组、拟评估日期等。
2. **QTG提交**：运营人需提交完整QTG（含标题页、设备信息页——含配置号/机型/空气动力学-发动机-飞控数据来源/机载计算机ID/视景运动系统制造商等、目录、有效页清单与修订记录、术语表、SOC、每项验证测试的：标题/目的/演示程序/参考文献/初始条件/人工测试程序/自动测试程序/评估准则/预期结果（含公差）/测试结果/源数据/结果比对）。
3. **现场评估前**：可在制造商现场完成部分验证测试，运至最终地点后须重复至少1/3验证测试并提交。
4. **评估团队与主管机关审查**：主管机关审查QTG缺陷需在现场评估前解决；评估通过后QTG成为MQTG。
5. **鉴定基础锁定**（CS FSTD(A).001(b) / ORA.FSTD.210）：初始鉴定使用的CS-FSTD版本将持续适用于后续周期性鉴定，除非重新分类（recategorised）。

### 1.4 周期性评估（Recurrent Evaluation）频率与科目

| 设备类型 | 标准评估周期 | 可延长周期 | 延长条件 |
|---|---|---|---|
| FFS / FTD / FNPT | 每12个月（以初始鉴定月末为起点，评估窗口：周期开始前60天至后30天） | 可延至24或36个月 | 连续36个月合规记录；已完成初始+至少一次周期性评估；主管机关每12个月审计管理体系要素；运营人建立ORA.FSTD.225(b)所需程序（指定合格人员/团队自行完成客观测试审查+主观测试并报告） |
| BITD | 每3年 | — | — |

**QTG滚动运行要求（AMC1 FSTD(A).300(a)(9)）**：运营人须在每次年度评估之间运行完整QTG（含validation + functions & subjective tests），至少分4个约3个月一段的区块贯穿全年运行，覆盖不同类型测试；结果须注明日期并保留；**不允许**在年度评估前临时突击运行完整QTG。

评估团队构成（AMC2 ARA.FSTD.120）：与初始评估相同；特定条件下（非首次+不涉及BITD）可缩减为"主管机关飞行检查员 + 主用户的机型/等级教员"，但须满足7项前提（非连续两次评估使用缩减团队、无重大变更/升级、无搬迁等）。

### 1.5 构型管理（Configuration Management / Control）

- CS FSTD(A).300(a)(7)："应建立并维持构型控制体系，以确保硬件软件持续保持初始鉴定时的完整性"。
- ORA.FSTD.105(c) / ARA.FSTD.120(a)(3)：构型控制体系是维持鉴定有效性的强制条件之一，主管机关持续监督。
- AMC1 ORA.FSTD.110：运营人须建立差异清单（differences list），跟踪适航指令(AD)、机型服务通告对FSTD的影响；建立内部变更接受流程。

### 1.6 故障/降级与变更处理流程

| 变更类型 | 触发条件 | 处理流程 |
|---|---|---|
| Update（更新） | 不改变既有鉴定等级的硬件/软件变化 | 可通过下一次周期性检查或额外检查确认；按初始鉴定时适用的要求执行 |
| Upgrade（升级） | 提升鉴定等级或增加训练学分（recategorisation） | 须按最新CS-FSTD版本重新做完整初始鉴定，不得复用既往评估结果 |
| Major modification（重大改装） | 影响操纵特性/性能/系统运行，或运动/视景系统重大改装 | 评估对原鉴定标准的影响→制定受影响验证测试修订方案→重新测试→提前告知主管机关→主管机关决定是否需专项评估 |
| Relocation（搬迁） | 设备物理位置变更 | 提前告知主管机关及活动计划→恢复运行前完成至少1/3验证测试+功能与主观测试→测试文档随FSTD记录留存供审查→主管机关可要求搬迁后评估（按原鉴定基础） |
| Deactivation（停用/长期封存） | 计划长期不使用 | 通知主管机关；与其约定停用期控制、储存与恢复计划，确保可恢复至原鉴定等级 |
| Transferability（运营人变更） | FSTD转手给新运营组织 | 新运营人提前通知主管机关，约定转移计划；主管机关可按原鉴定基础评估；若已不再符合原鉴定基础，须重新申请鉴定证书 |
| 安全设施检查 | ORA.FSTD.115(b) | 紧急停止/应急照明等安全设施至少每年检查一次并记录 |

### 1.7 运营人职责（Sponsor/Operator Responsibilities — EASA体系无"Sponsor"术语，对应"FSTD Operator"）

- **管理体系**（ORA.FSTD.100(a)）：须证明依据ORA.GEN Section II建立管理体系，具备（自行或委托）维持FSTD性能/功能/特性及安装控制能力。
- **合规监控体系（Compliance Monitoring Programme, CMP）**：需覆盖组织架构、维护程序、技术状态、监督、手册日志记录、缺陷延迟处理、人员培训、飞机改装影响评估、FSTD构型管理等审计范围；须有Accountable Manager与Compliance Monitoring Manager（可合并，小型组织）；文档应包含CM手册+程序手册两级；记录须可双向追溯。
- **FSTD性能指标**（AMC2 ORA.FSTD.100）：建议参照ARINC 433，度量单机及机队FSTD表现。
- **安全责任**（ORA.FSTD.115）：确保安装环境安全、人员安全简报、符合当地健康安全法规。
- **飞行外场检查（fly-out）人员资质**：应为机型TRI/TRE资质并有主管机关模拟机评估经验。

### 1.8 记录保存要求（Record-Keeping, ORA.FSTD.240）

| 记录类型 | 保存期限 |
|---|---|
| 初始鉴定的MQTG、鉴定证书、初始评估报告 | **设备全生命周期** |
| 周期性QTG运行记录、周期性评估报告、内部功能与主观测试报告、技术日志(technical log)、CMS报告、审计计划(audit schedule)、评估大纲(evaluation programme)、管理层评估报告、已作废的程序与表格 | **至少5年**（纸质或电子均可） |

主管机关侧（ARA.FSTD.140，未展开摘录）另有独立记录保存义务，系统若需支持监管方视角可另行补充。

---

## 2. 新体系（CS-FSTD Issue 1 / FCS 框架）

### 2.1 FCS 的构成要素

**FCS（FSTD Capability Signature，飞行模拟训练装置能力签名）** = 一组"仿真特征(feature)"及其各自"保真度等级(fidelity level)"的组合，外加每个特征对应的**被模拟飞机范围**（具体机型+改型 / 机型 / 机型组）。FCS 定义于 Regulation (EU) No 1178/2011 Article 2（基础法规层面），CS-FSTD Issue 1 提供其技术实现标准。

**14个FSTD仿真特征，分3大类**（CS FSTD.GEN.005）：

| 分类 | 代码 | 特征名称 | 说明要点 |
|---|---|---|---|
| 飞机仿真 (Aircraft simulation) | FDK | Flight deck layout and structure 驾驶舱布局与结构 | 驾驶舱封闭程度、物理/感知结构、仪表布局、座椅 |
| | CLH | Flight control forces and hardware 飞控力与硬件 | 操纵机构外观、行程、触感、力反馈 |
| | CLO | Flight control systems operation 飞控系统运行 | 舵面位移、飞控系统模式/逻辑、包线保护功能、驾驶舱信息 |
| | SYS | Aircraft systems 飞机系统 | 仪表/通信/导航/自动驾驶/液压/电气/燃油/座舱压力/动力装置/告警/结冰防护/监视系统等 |
| | GND | Performance and handling on ground 地面性能与操纵 | 加速/减速/转弯/刹车/风（含侧风） |
| | IGE | Performance and handling in-ground effect 地面效应内性能操纵 | 空气动力/飞行动力学/升力推力（地效范围=翼展或旋翼直径） |
| | OGE | Performance and handling out-of-ground effect 地面效应外性能操纵 | 离地效应外的空气动力/飞行动力学/升力推力系统特性 |
| 感知仿真 (Cueing simulation) | SND | Sound cueing 声音提示 | 发动机、空气动力、旋翼、跑道、天气、系统等声音 |
| | VIB | Vibration cueing 振动提示 | 机身抖振、操纵面抖振、发动机/桨叶/传动振动 |
| | MTN | Motion cueing 运动提示 | 加速度引起的运动感 |
| | VIS | Visual cueing 视觉提示 | 外景显示类型（准直/非准直）及视场角 |
| 环境仿真 (Environment simulation) | NAV | Navigation 导航 | 导航/通信/监视数据交换及ATC交互 |
| | ATM | Atmosphere and weather 大气与天气 | 温度气压到雷暴建模的复杂度 |
| | OST | Operating sites and terrain 运行场地与地形 | 机场/直升机场/起降点及地形建模复杂度与细节 |

**4级保真度（CS FSTD.GEN.010）**：

| 代码 | 名称 | 定义 |
|---|---|---|
| S | Specific 专用 | 该特征最高保真度，复现特定机型+改型的外观/触感/系统运行/性能操纵 |
| R | Representative 代表 | 中等保真度，代表某机型（可含同机型不同改型元素） |
| G | Generic 通用 | 最低保真度，代表某"机型组"（可含同组不同机型元素） |
| N | None 无 | 未安装/不可用于训练，或已安装但非必需（不得干扰其他特征使用） |

### 2.2 如何记录与展示一个FSTD的"能力矩阵"

- **FCS的本质是一个"特征→保真度等级→模拟范围"的矩阵**（14行，每行取值{N,G,R,S} + 模拟对象颗粒度）。系统应以此为最小建模单元，而非单一"等级"字段。
- **飞机系统(SYS)特征例外**：其内部各子系统（自动驾驶、FMS、液压等）可以有不同保真度等级，需要在FCS文档中逐一列明（QB.010(a)(1)-(3)）；因此SYS特征在数据模型中应可展开为"子系统清单"。
- **最低FCS门槛**（CS FSTD.QB.005 Table 1）：要构成一台可鉴定的FSTD，至少需满足：
  | 特征 | 最低等级 |
  |---|---|
  | FDK | G |
  | CLH | N |
  | CLO | G |
  | SYS | （至少含基本飞行仪表/告警系统/动力装置系统，见QB.010(b)） |
  | GND | G（注：若训练不涉及地面操作可为N） |
  | IGE / OGE | N / N（注：视训练范围可调整，OGE通常为训练基本项） |
  | SND | G |
  | VIB / MTN / VIS | N / N / N |
  | NAV | N |
  | ATM | G |
  | OST | N |
- **UPRT专用最低FCS**（Table 2）：除SND(R)/VIB(R)/VIS(R)外，其余11项特征均须≥S/S的高保真度组合（FDK/CLH/CLO/SYS/GND/IGE/OGE/NAV/ATM/OST=S，MTN=S）。
- **SOJ（Statement of Justification，取代旧体系SOC）**：针对CS FSTD.GEN.015定义的每条通用要求，运营方须提交依编号对应的合规说明，须注明信息来源、合规推理、公式/参数、结论；不适用项须写明"n/a"并解释；须随设备改装同步修订；作为MQTG/工程报告(ER)的一部分。
- **QTG/MQTG结构**（CS FSTD.QB.030）：在旧体系基础上新增关键字段——每个"飞机仿真特征"对应的**被模拟对象颗粒度（机型组/机型/机型+改型）**、验证数据路线图(VDR)、工程报告(ER)、SOJ集合。
- **ESL（Equipment Specification List，装备规格清单）**：所有FSTD鉴定证书（除legacy BITD外）都须配套ESL；ESL按"FSTD特征"组织，逐条列明已安装设备/规格/能力，是运营人和FSTD用户判断设备是否适配某训练任务的主要工具；须随ORA.FSTD.110变更管理同步更新；可标注该特征的局限性。

### 2.3 FSTD 状态分类（新框架下的三种设备状态）

| 状态 | 说明 |
|---|---|
| FSTD with FCS | 依据CS-FSTD Issue 1完成初始鉴定/改装鉴定，原生获得FCS的设备 |
| FSTD with assigned FCS | Legacy FSTD由主管机关"指定"一个等效FCS（无需按Issue 1完整重新鉴定），从而可被纳入task-to-tool训练大纲使用 |
| Legacy FSTD | 仍按CS-FSTD(A)/(H) Issue 2等旧版本维持等级鉴定，未被assigned FCS的设备 |

系统需要为每台FSTD维护"当前状态"及可能的状态迁移历史（Legacy → assigned FCS → 原生FCS，或长期停留在Legacy）。

### 2.4 训练课程与FSTD等级/能力的关联（Task-to-Tool方法论）

- **新体系（Appendix 9 to Part-FCL 训练矩阵）**：以"训练矩阵"表联接训练任务与FCS——**行=Appendix 9训练科目，列=FSTD特征**；每个科目单元格给出两档FCS要求：
  - **T（Training）**：可开始该训练任务所需的最低FCS（或assigned FCS）；
  - **TP（Training to Proficiency）**：完成该训练任务并计入最低FSTD训练时间所需的最低FCS（或assigned FCS）。
  - 规则：训练任务可用 FCS≥T 的设备开始，须用 FCS≥TP 的设备完成。
  - 训练矩阵**不能单独作为设备是否适用的判定工具**，须结合AMC5 ORA.ATO.125训练课程设计流程一并使用。
- **ISD原则（Instructional Systems Design，GM2 ORA.ATO.125）**：以ADDIE模型（Analyse分析-Design设计-Develop开发-Implement实施-Evaluate评估）指导训练课程设计；影响可用FSTD的选择。
- **旧体系**：训练课程要求以"设备等级"直接挂钩（如：多机组机型改装最低16小时FFS训练时间，AMC2 ORA.ATO.125），无逐科目FCS矩阵。新体系允许通过合理ISD课程设计，用低于16小时FFS当量时间完成训练。
- **训练组织的选择权**：训练组织可自愿采用FCS框架；可混用legacy FSTD、FCS设备、assigned FCS设备；**但task-to-tool方式设计的课程只能使用FCS或assigned FCS设备**，不能用未指定FCS的legacy设备。
- **运营人经常性训练**（Part-ORO Subpart FC / AMC1 ORO.FC.145(d)）：同样允许使用FCS或assigned FCS设备，飞机与直升机分别有单独判定安排。

### 2.5 过渡期安排（今天 → 2028-04-30）

| 维度 | 安排 |
|---|---|
| 现有存量设备 | 无需强制重新鉴定；保留原CS-FSTD(A)/(H) Issue 2等级（grandfather rights类似机制），可继续用于现有课程 |
| 新FSTD初始鉴定 | 2028-04-30起，只能以FCS方式做初始鉴定（"After the applicability of the new CS-FSTD Issue 1, an FSTD will be initially qualified only with FCS"） |
| 存量设备升级新框架 | 可选：(a) 保持legacy不变；(b) 申请assigned FCS（主管机关指定映射，无需完整重鉴定）；(c) 主动按CS-FSTD Issue 1申请FCS原生鉴定 |
| 重大改装的选择权（AMC1 ORA.FSTD.110） | 已获assigned FCS的设备做重大改装时，运营人可选择：①在不影响assigned FCS及原鉴定基础前提下完成改装；②改用改装时有效的鉴定基础（如CS-FSTD Issue 1）申请FCS |
| 训练组织采用意愿 | 完全自愿；FCS框架与task-to-tool方法论不强制替代现有课程设计方式 |
| ESL适用范围 | 除legacy BITD外，所有FSTD（含legacy设备）鉴定证书均须配ESL——即ESL先于FCS全面铺开，是过渡期"设备说明"的统一载体 |
| 特殊条件/新颖机型 | 若CS-FSTD Issue 1无法覆盖某新颖FSTD（如eVTOL/倾转旋翼），主管机关可依ORA.FSTD.210引入special conditions |
| 支持任务 | EASA将启动IST.0007任务，专门支持FCS框架落地（细则见EPAS 2026） |

**结论：系统不是"迁移到新schema"，而是需要长期支持三态并存**（legacy等级 / assigned FCS / 原生FCS），且同一台设备的状态可能随时间演化。

---

## 3. 新旧体系对比及系统设计建议

### 3.1 核心概念映射表

| 旧体系（CS-FSTD(A)/(H) Issue 2） | 新体系（CS-FSTD Issue 1） | 差异要点 |
|---|---|---|
| 固定等级 Level A/B/C/D（FFS）、1/2（FTD）、I/II/IIMCC（FNPT）、BITD | FCS = 14特征 × 4保真度（N/G/R/S）的矩阵 + 每特征模拟范围 | 从"单一枚举值"变为"多维能力向量"，且允许同一设备不同特征保真度不同（如飞控力反馈N + 系统运行S的混合体） |
| SOC（Statement of Compliance） | SOJ（Statement of Justification） | 命名与内容要求更强调"合规推理链条"，且逐特征逐保真度提交 |
| QTG含"FSTD Standards"合规表 | QTG含SOJ + VDR + ER + 逐特征模拟范围声明 | 数据字段更细颗粒度 |
| 无ESL强制要求（早期版本） | ESL强制配套（除legacy BITD） | 新增独立文档实体，按特征组织 |
| 训练课程与"等级"直接挂钩（如16h FFS） | 训练矩阵：科目 × 特征 → (T, TP) 两档FCS | 训练需求从"设备等级"降解到"逐科目-逐特征"颗粒度 |
| 飞机、直升机分别成册（CS-FSTD(A)、CS-FSTD(H)） | 合并为单一CS-FSTD | 需要设备分类字段支持aeroplane/rotorcraft并存于同一规范版本下 |
| Convertible FSTD（可切换机型） | Multi-configuration devices（QB.140，含各自MQTG要求） | 概念延续但文档要求更明确 |
| Interim FSTD qualification（新机型早期数据不足时的临时鉴定，仅涉及特定特征） | 同名机制延续（CS FSTD.ENG.060），适用于R/S级别，仅限9个"飞机仿真+感知"类特征 | 与"过渡期"是两个不同概念，注意不要混淆：interim qualification处理的是"新机型数据不足"，与"新旧规范过渡"无关 |

### 3.2 数据库/系统设计建议

**建议采用"双轨并存 + 版本化鉴定基础"的设计，而不是新增字段覆盖旧字段。**

1. **FSTD主实体** `fstd`
   - `id`, `operator_org_id`, `aircraft_category`（aeroplane/rotorcraft）, `physical_device_no`, `manufacture_date`, `location`, `status`（active/deactivated/relocating/decommissioned）
   - `qualification_basis_type`（枚举：`legacy_level` / `assigned_fcs` / `native_fcs`）——**核心分流字段**，决定该设备走哪套详情表
   - `qualification_basis_version`（如 `CS-FSTD(A) Issue 2`、`CS-FSTD Issue 1`）+ `qualification_basis_date`（初始鉴定时锁定的版本，供后续周期性评估复用，对应CS FSTD(A).001(b) / ORA.FSTD.210）

2. **旧体系等级详情表** `fstd_legacy_level`（当`qualification_basis_type=legacy_level`时填充）
   - `fstd_id`, `device_type`（FFS/FTD/FNPT/BITD）, `level`（A/B/C/D 或 1/2 或 I/II/IIMCC）, `simulated_aircraft_type_or_class`
   - `grandfather_rights_flag`, `recurrent_period_months`（12，BITD为36，可延至24/36）

3. **FCS能力矩阵表** `fstd_capability_signature`（当`qualification_basis_type IN (assigned_fcs, native_fcs)`时填充；assigned_fcs的记录额外打标`is_assigned=true`并关联主管机关指定文号）
   - `fstd_id`, `feature_code`（FDK/CLH/CLO/SYS/GND/IGE/OGE/SND/VIB/MTN/VIS/NAV/ATM/OST，14行/设备）, `fidelity_level`（N/G/R/S）, `simulated_scope_type`（type_and_variant / type / group）, `simulated_scope_value`（如 "A320-214" / "A320" / "single-engine turboprop"）
   - SYS特征允许一对多展开：`fstd_capability_signature_subsystem`（fstd_id, subsystem_name, fidelity_level）
   - 唯一约束：(fstd_id, feature_code) 在主表中唯一，除非该feature为SYS且使用子表

4. **文档实体**
   - `qtg_document`（区分legacy QTG字段集 vs Issue1 QTG字段集，或用JSON扩展字段承载差异部分；`status`: draft/submitted/accepted_as_mqtg）
   - `esl_document`（新体系强制，legacy BITD例外；按`feature_code`组织行项）
   - `soc_soj_statement`（`statement_type`: SOC（旧）/SOJ（新）；`requirement_ref`；`justification_text`；`applicable_fidelity_level`；`is_not_applicable`布尔+说明）
   - `engineering_report`（新体系ER，QB.020(d)引用）
   - `validation_data_roadmap`（VDR）

5. **鉴定证书与变更流程**
   - `qualification_certificate`（fstd_id, cert_type: initial/upgrade/recategorisation, issued_date, basis_version_snapshot）
   - `fstd_change_request`（change_type: update/upgrade/major_modification/relocation/deactivation/transfer；触发的通知/审批工作流状态机；关联受影响的`fstd_capability_signature`或`fstd_legacy_level`记录，用于变更前后对比）

6. **周期性评估**
   - `recurrent_evaluation`（fstd_id, period_start, period_end, evaluation_type: standard/extended, evaluation_team_composition, qtg_blocks_completed（4象限勾选，对应旧体系季度滚动要求）, result）
   - `evaluation_extension_eligibility`（跟踪ARA.FSTD.120(c)四项延期条件是否满足，供24/36个月延期判断）

7. **记录保存策略引擎** `record_retention_policy`
   - 按`document_type`映射保留规则：`lifetime`（MQTG/初始鉴定证书/初始评估报告）vs `min_5_years`（周期性QTG运行、评估报告、技术日志、CMS报告、审计计划等）；系统应有自动化归档/禁止误删的保护逻辑，而非仅UI提示。

8. **训练课程—设备能力映射**
   - 旧体系：`course_requirement_legacy`（course_id, required_device_type, required_level, min_hours）
   - 新体系：`training_matrix_entry`（course_id, appendix9_task_id, feature_code, min_fcs_for_T, min_fcs_for_TP）——**这是训练排课引擎在新体系下需要查询的核心表**：给定一门课程的某训练科目，遍历14个feature_code分别取T/TP阈值，再与候选FSTD的`fstd_capability_signature`逐特征比对，取"设备该特征等级 ≥ 阈值"全部成立才算合格设备。
   - 建议同时支持"legacy等级→约等效FCS阈值"的换算表（`legacy_to_fcs_equivalence`），便于排课引擎在过渡期对legacy/assigned_fcs/native_fcs三类设备做统一比较，即便官方并未提供精确换算公式，也需要业务侧维护一份内部近似映射以支撑跨体系排课。

9. **UI/报表层建议**
   - 设备详情页应能"总览徽章"展示：legacy等级（如有）+ FCS矩阵雷达图/条形图（14特征×4级）+ 当前状态（legacy/assigned/native）+ 有效鉴定基础版本。
   - 排课引擎报错信息应能精确指出"因为某训练科目在NAV特征上要求TP=R，而该设备NAV=N"，而不是笼统提示"设备等级不足"。
   - 变更管理工作流页面应显示：变更类型→受影响的feature/等级字段→通知/审批状态→测试完成度（如搬迁要求的1/3验证测试完成度）。

### 3.3 需要业务确认/持续跟踪的开放问题

- CS-FSTD Issue 1本身未在读到的章节中给出新体系下的"周期性评估频率"条款（该内容按惯例应在对应的Part-ARA/ORA Amendment 15文本中，Explanatory Note提及AMC已修订但具体频率数值需另行查证最终发布的Part-ARA/ORA Amendment 15正式文本，目前判断大概率延续12个月/BITD 3年的框架，但需要在正式文本发布后复核）。
- "assigned FCS"的具体判定方法与换算规则（legacy等级 → FCS矩阵的官方对照表）未见于当前三份文档，可能在IST.0007任务或后续AMC/GM细则中发布，建议系统设计预留可配置映射表而非硬编码。
- SATCE（合成空中交通环境）在新体系中不作为强制FSTD feature，但作为可选能力存在，如客户有相关训练场景可预留`additional_capability`标签字段（QB.017 Additional functionality机制）。
