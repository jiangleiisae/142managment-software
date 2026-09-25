# FAA Part 141 / Part 142 / AC 61-136B 培训中心管理软件需求提炼

> 来源文档：14 CFR Part 141《Pilot Schools》(2025)、14 CFR Part 142《Training Centers》(2025)、AC 61-136B《FAA Approval of Aviation Training Devices》(2018)
> 本文档面向"培训中心管理软件"系统设计，按 数据字段 / 业务流程 / 141 vs 142 差异对比 三部分组织。

---

## 一、数据字段（Data Fields）

### 1. 机构/课程审批（Course & Curriculum Approval）

**机构主档 (Organization Master)**
- 机构类型：Part 141 Pilot School / Provisional Pilot School / Part 142 Training Center
- 证书编号（Certificate Number）
- 证书状态：有效 / 暂停 / 吊销 / 已过期 / Provisional
- 证书签发日期、到期日期（141：签发月起24个自然月；142：境内无固定到期，境外12个月一续）
- 主营业地址（Principal Business Office，141/142 均要求实体地址，不可与其他学校共用）
- 卫星训练基地列表（Satellite Base / Satellite Training Center：名称、地址、批准的课程范围、负责的助理主任教员/管理人员）
- 训练协议关联（Training Agreement）：与哪个 Part 142 Training Center 或 Part 141 School 存在训练/测试/检查转包协议

**课程/大纲档 (Course / Curriculum Master)**
- 课程类型（141 Appendix A–M：Recreational/Private/Instrument/Commercial/ATP/CFI/CFII/Ground Instructor/Type Rating/Special Prep/Ground School/Combined Private+Instrument）
- 142 课程分类：Core Curriculum（认证必需，跨卫星中心通用） / Specialty Curriculum（客户专属）
- 课程审批状态：Initial 审批中 / 已批准 / Final approval（141 减时数课程的最终批准） / 修订中
- 审批文件版本号、提交日期、生效日期（141 要求提前30天提交；142 要求提前120天新课程/60天修订，一式两份）
- 最低地面/飞行训练时数要求（按 Appendix 对应，是否为"reduced hour"课程）
- Examining Authority 标记（是否持有考试授权，141专属，见差异表）
- 课程大纲结构化字段：先修条件、课程目标、分阶段标准、Stage Check/End-of-course Test 定义、学时分配
- 使用的训练设备清单（关联飞机/FFS/FTD/ATD 编号）
- 训练教室/设施描述（房间尺寸、最大学生数，网络课程可豁免物理教室要求）
- 变更记录（Amendment History）：变更类型、变更内容摘要、通知FAA日期、生效日期（141网课课程的minor editorial change需30天内通知即可，无需预批）

**教学协议 (Training Specifications / TCO 相关，142专属)**
- Training Specifications 文档号
- 授权的课程/训练类型清单
- 授权使用的飞机类别/级别/型号
- 每台 FFS/FTD 的机型、qualification level、FAA识别号
- 授权的偏离/豁免（Deviation/Waiver）清单及理由

### 2. 人员资质管理（Personnel）

**教员档 (Instructor Master)**
- 角色类型（141）：Chief Instructor / Assistant Chief Instructor / Check Instructor / 普通 Flight/Ground Instructor
- 角色类型（142）：Instructor / Evaluator
- 持有证照：Commercial/ATP Pilot Certificate、CFI/CFII/Ground Instructor Certificate、对应 category/class/instrument rating
- 飞行经历字段：PIC总时数、教学时数、仪表时数（按课程类型对应141.35/141.36/141.37的具体小时门槛，如私照类1000hr PIC+2年500hr教学，其它类2000hr PIC+3年1000hr教学）
- 资质考试记录：knowledge test 成绩、proficiency test 成绩、考核人、日期
- 初始指定文件（Designation Letter，含指定日期、课程范围、chief instructor签字）
- 年度/周期复训记录（Recurrency）：
  - 141：每12个自然月一次 proficiency check（§141.79(d)）、chief/assistant chief instructor每12个月完成培训大纲或CFI refresher（§141.79(c)）
  - 142：初始指定前 + 每12个自然月一次知识/技能复训与考核（§142.53），含地面课程(learning process/teaching elements/instructor duties/training policies/CRM/evaluation)与设备操作训练
  - 到期日、逾期状态标记（提前/延后一个月内完成视为按时，用于滚动计算下次到期）
- 每日/每24小时教学工时上限跟踪（142：不含briefing不超过8小时/24小时）
- 英语读写说话能力确认（142 §142.13(d) 强制字段）
- 前FAA雇员冲突审查标记（141.34 / 142.14：过去2年是否曾任监察员并直接负责监督该机构）

**Evaluator 档（142专属）**
- Evaluator 批准状态（FAA approved）
- 授权的检查/测试范围（认证、加签、资质考核）
- 培训记录（duties/methods/pilot performance evaluation/不合格处理，12个月周期）
- ATP训练项目专属资质（§142.54：ATP+多发等级、2年PIC经历等）

**Check Instructor 档（141专属）**
- 资格测试记录（by chief instructor：教学法、AIM、Part 61/91/141相关规定、课程标准）
- 授权范围：能否评定其曾担任主教员的学生（禁止利益冲突，§141.37(c)）
- 学校最低学生规模门槛（enrollment≥10人才能设立check instructor）

### 3. 培训设备要求（Aircraft / FFS-FTD / ATD）

**飞机档 (Aircraft Master)**
- 适航证类型（Standard / Primary / Light-Sport 或外国等效证）
- 维护大纲合规状态（Part 91 Subpart E + 批准的维护检查大纲）
- 双人位/双操纵配置标记
- IFR设备状态（是否配备IFR/是否满足课程要求）
- 关联课程清单（哪些课程批准使用此飞机）

**FFS/FTD 档 (Full Flight Simulator / Flight Training Device)**
- Part 60 Qualification Level
- 代表机型（make/model/series 或 set of aircraft）
- FAA分配的识别编号
- 每日功能预检记录（daily functional preflight check，142必需字段）
- 缺陷日志（discrepancy log：每次训练结束后教员/考官记录）
- 维护记录与"conform to aircraft modification"变更追踪

**ATD 档 (Aviation Training Device — AC 61-136B)**
- ATD 分类：BATD（Basic） / AATD（Advanced）
- 制造商、型号名称、代表的机型/机种配置（category/class/M&M）
- LOA（Letter of Authorization）编号、签发日期、**有效期5年**、到期日
- QAG（Qualification and Approval Guide）版本号及关联文档（部件清单、设计标准逐条对照、机型配置图、性能表、ATD Checklist）
- 授权用途范围（私照/仪表等级/仪表经验与时间/商照/ATP/CFI，按 BATD 与 AATD 权限不同）
- 训练学分上限规则字段：
  - 仪表等级训练总学分（BATD/AATD/FTD/FFS组合）不超过 §61.65 及 Part141 Appendix C 规定的 50%
  - 141课程内 FFS/FTD/ATD 学分比例上限（因课程而异，如私照20%、商照30%、ATP50%、CFI10%等，需按 Appendix B/C/D/E/F/G/J/K/M 精确记录）
- 部件/软件变更记录（是否需要重新提交QAG评估；"minor change" vs 需FAA重新评估的变更）
- 使用限制标记：不可用于实机型别等级培训、实践考试(practical test)、特定机型专项培训
- 自检（startup self-test）执行记录字段（由授权教员观察确认）
- Part 141 学校专属：该ATD是否已获得所属FSDO/POI 在 TCO 中的单独批准

**训练课时/学时记录（ATD专属日志规则）**
- 记录类型必须为 Dual Instruction Received / Instrument Time / Total Time（不可计入"飞行时间"列）
- 需记录 ATD 型号识别信息（§61.51(b)(1)(iv)）
- 是否为模拟仪表气象条件(IMC)下训练（决定能否计入仪表经验）

### 4. 学员/学员记录管理（Student Records）

**学员档 (Student Master)**
- 姓名、联系方式、飞行员证照复印件、体检证复印件（142 §142.73(a)(2)强制）
- 入学信息（141 §141.93）：入学课程名称、入学日期、Enrollment Certificate、培训大纲副本、学校安全操作规程副本（内含天气标准/滑行/消防/复飞/设备检查等10项）
- 月度在读学生名单（monthly enrollment listing，141要求维护）
- 学分转移记录（Transfer Credit）：原学校名称、原课程性质（是否Part141/142批准课程）、可转学分上限（141.67(b)：同为141学校最高50%；141.77(c)：141/142→141按50%，其他来源→141按25%）
- 培训记录（Training Record）逐课时字段：
  - 入学日期、出勤日志、科目、飞行操作内容
  - 各阶段测试成绩（stage check / end-of-course test）及考核人
  - 毕业/终止/转学日期及原因
  - 附加训练时数（142：unsatisfactory practical test后补训时数记录）
- 保存期限：至少1年（141 §141.101、142 §142.73均为1年，从毕业/终止/转学之日起算）
- 学员申请材料记录（Examining Authority场景，141专属）：临时证照签发日期、考试执行人、成绩、永久证照申请送出日期

**毕业证书 (Graduation Certificate，141专属)**
- 学校名称及证书编号、学员姓名、课程名称、毕业日期
- 各阶段完成声明及测试通过声明、主任教员签字确认
- 跨国飞行训练完成情况声明
- 网络课程毕业证唯一字母数字编码（141.95(b)(8)）

### 5. 质量管理/合规监督（Quality & Oversight）

- 内部质量控制措施描述（142 §142.11(b)(9) 申请材料必填项）
- 通过率统计字段（141专属，用于证书续期/Examining Authority资格）：
  - 首次考试通过率（知识测试/实操测试/结业测试），141.5(d)要求≥80%
  - Examining Authority维持要求：≥90%首次通过率、近24个月至少培训10名学生
- FAA检查记录（Inspection Log）：检查日期、检查范围（人员/设施/设备/记录）、发现问题、整改状态
- 证书暂停/吊销/终止事件记录及原因分类（如60天内未指定主任教员、连续5年内曾被吊销等触发条件）
- 广告合规检查项（是否清晰区分已批准/未批准课程，证书失效后是否已撤除相关标识）
- Line Operational Simulation/AQP 相关质量评估记录（142专属，适用于航司训练场景）

---

## 二、业务流程（Business Processes）

### 1. 机构/课程审批流程

**Part 141 Pilot School 认证流程**
1. 提交 Pilot School Certificate 申请（表单化申请 + 一式两份课程大纲）
2. 满足条件：过去24个月内完成申请、（若非首次）曾持有 Provisional Certificate、满足Subpart A-C人员/飞机/设施要求、首次通过率≥80%、已有≥10名学生从批准课程毕业
3. 不满足"近期培训活跃度"要求的，可先取得 Provisional Pilot School Certificate（有效期24个月，不可续期，仅可转正或180天后重新申请）
4. 证书到期前30天内可申请续期（续期同样审核人员/飞机/设施/培训记录/培训质量）
5. 触发证书自动失效的事件：所有权变更（未在30日内申请变更并保持设施人员课程不变）、经营场地变更、60天内未维持某课程所需设施/飞机/人员

**Part 141 课程大纲审批流程**
1. 提交课程大纲申请（一式两份）至责任 Flight Standards 办公室，至少提前30天
2. 课程需包含：教室描述、教具描述、模拟机/训练设备描述、起降机场清单及简报区域、飞机机型及特设设备、教员最低资质、教学大纲（先修条件/逐课时目标标准/阶段考核方式）
3. 不满足最低学时要求的课程可申请"减时数"路径：
   - Initial approval（最长24个月，需学校已持证满24个月，且考试须由FAA督察员或非本校雇员的考官执行，不得同时申请Examining Authority）
   - Final approval（需已获Initial approval满24个月、近24个月培训≥10人、首次通过率≥80%）
4. 网络课程（internet-based）大纲审批附加要求：修订须按页/日期/屏幕编号标识，需提供FAA远程登录监控通道，须具备完整性/身份认证/保密性/可用性/访问控制安全措施
5. 特殊课程（Special Curricula，无预设Appendix大纲）需证明可达到同等培训水平后单独审批

**Part 141 Examining Authority（考试授权）申请流程**
1. 前提：已持有对应课程评级满24个月、近24个月培训≥10人并推荐取证、首次通过率≥90%（由FAA督察员或非本校雇员考官执行）
2. 获得后可自行签发临时证照，无需学生参加FAA知识/实操考试
3. 持续维持要求：定期续期申请、维持课程评级、不得为"减时数"课程
4. 限制：若已知或被通知考题泄露，须停止使用该测试；须保存临时证照签发记录1年

**Part 142 Training Center 认证流程**
1. 至少提前120天提交申请（表单化）至责任 Flight Standards 办公室
2. 申请材料需含：管理岗位资质证明、拟批准的训练权限与训练规范（Training Specifications）、评估授权、训练设备描述、设施与人员描述、课程大纲(syllabi/outline/courseware)、记录保存系统说明、质量控制措施说明、减时数课程的能力证明方法
3. FAA现场核验设施/设备后签发 Training Center Certificate + Training Specifications（含授权课程、飞机类型、FFS/FTD清单及FAA编号、卫星中心清单、偏离/豁免清单）
4. 修改课程/新增课程需提前60天申请修订（Amendment），FAA可要求30天内整改，逾期可能导致证书暂停/吊销

**Part 142 卫星训练中心（Satellite Training Center）设立流程**
1. 满足与主中心相同的设施/设备/人员/课程要求
2. 教员/考官须受主中心管理人员直接监督
3. 至少提前60天书面通知FAA
4. Training Specifications 中登记卫星中心名称地址及授权课程

**Part 141 与 Part 142 之间的训练转包（Training Agreement）**
- 141学校可将培训、测试、检查外包给142培训中心执行（须签署书面协议，141学校须为包含142部分的完整课程大纲取得FAA批准，142完成后学员记录副本须转回141学校归档）
- 反向：142培训中心也可用141学校提供的训练测试检查（141学校需为141部分单独获批课程大纲）

### 2. 人员资质管理流程

**教员任命与复训（141）**
1. Chief Instructor 任命：核实资质（证照、PIC时数、教学经验分级门槛）→ 知识测试+教学法实操测试 → 正式书面指定
2. Assistant Chief Instructor / Check Instructor：类似流程，门槛减半或更低，Check Instructor须由Chief Instructor出题考核并获责任Flight Standards办公室批准
3. 教员上岗前：审核briefing与课程标准 + 首次机型 proficiency check
4. 每12个自然月：recurrency proficiency check（提前或延后1个月内完成视为按时）
5. Chief Instructor 变更处理：立即书面通知FAA → 60天内可无主任教员运营（由助理/check instructor/FAA督察员/考官代行阶段考核）→ 60天后仍未指定则须停训并交回证书 → 满足条件后可申请恢复

**教员任命与复训（142）**
1. 教员资格分级判定：普通训练 vs 型别等级FFS/FTD训练（后者门槛更高，按§61.159/161/163）
2. 初始指定前完成8小时地面培训（教学法/培训政策/学习原理/职责权限/模拟器操作/环境面板/仿真限制/最低设备要求/课程修订/CRM）+ 笔试
3. 每12个自然月：知识笔试 + 年度熟练检查（proficiency check），含设备操作与代表性课程片段的实操
4. 特殊要求（ATP训练项目 §142.54）：教员须持ATP+多发等级、2年PIC经历、接受专项初训、若涉及FFS还需完成机型评定+过去12月内的维护评估培训
5. Evaluator 批准与复训：FAA批准 + 遵从§142.47/49/53 + 每12个月复训（职责/方法/评估/不合格处理）
6. 教学工时管控：系统需校验单个教员24小时内教学时数（不含briefing）不超过8小时

### 3. 培训设备管理流程

**飞机/FFS/FTD 合规运营流程（142）**
1. 新增设备须在 Training Specifications 中登记（型号、qualification level、FAA识别号）
2. 每日使用前功能预检（functional preflight check）并记录
3. 每次训练结束记录缺陷日志（discrepancy log）
4. 设备被批准的动作项(maneuver/procedure)需与课程大纲逐一对应，不得超范围使用
5. 若代表机型发生改装且影响性能/功能特性，须同步更新FFS/FTD配置并重新评估

**ATD 审批与使用流程（AC 61-136B）**
1. 制造商准备 QAG（含部件清单/设计标准逐条核对/机型配置图片/性能表/训练任务清单）+ 操作手册 + 申请信，提前90-120天提交至 FAA General Aviation and Commercial Division
2. 提交演示视频供FAA初审
3. FAA进行现场功能评估（operational evaluation），核实典型训练场景执行能力
4. 评估通过 → 签发 LOA（有效期5年，含到期日）
5. 设备变更处理：
   - 影响功能/接口的变更（新航电、物理面板变化）→ 须提交修订版QAG重新评估
   - 不影响功能的minor change（如处理器升级、软件补丁）→ 无需重新审批
6. LOA到期前120天内可申请续期（重新提交申请信+QAG确认仍满足最新标准）
7. 使用侧流程：
   - 每次使用前完成 startup self-test，若用于取证/经验积累须由授权教员观察确认
   - 训练中设备故障须停止训练，修复后重新执行self-test
   - LOA、QAG、机型性能资料须可供学员与教员随时查阅（电子版可）
   - Part 141 学校使用ATD须单独获得所属FSDO/POI在TCO中的批准
   - 使用方每年向FAA（自愿性质）报告ATD使用情况（机构信息、地址、使用课程、型号与LOA到期日、变更/停用通知）
8. 学时记录流程：仅可记为Dual/Instrument/Total Time，须注明设备型号，仿真IMC条件下方可计入仪表经验；不可用于满足cross-country/solo/night/takeoff-landing等必须实机完成的经验要求

### 4. 学员/学员记录管理流程

**入学流程（141）**
1. 学员入学时发放：Enrollment Certificate（课程名+入学日期）、培训大纲副本、学校安全操作规程副本（网络课程除外）
2. 学校维护月度在读名单

**培训记录维护流程（141 & 142）**
1. 逐课时记录出勤、科目、操作内容、测试成绩
2. 阶段考核（stage check）与结业测试（end-of-course test）成绩录入，注明考核人
3. 学员毕业/终止/转学时，由Chief Instructor（141）或对应管理人员确认记录并归档
4. 记录须至少保存1年（从毕业/终止/转学之日起算），学员可随时申请复印

**学分转移流程（141）**
1. 接收学校对转入学员执行知识/技能测试以核定可转学分
2. 按来源课程性质（是否141/142批准课程）适用不同学分上限（50% vs 25%）
3. 原学校须出具经管理层认证的培训记录（含培训种类/时数/各阶段测试结果）
4. 接收学校保留原学校记录副本

**毕业与证照签发流程（141）**
1. 确认学员完成全部课程要求并通过所有必测项
2. 签发 Graduation Certificate（含固定字段：学校名/证书号/学员/课程/日期/阶段完成声明/主任教员签字/跨国飞行完成情况声明）
3. 若学校持有 Examining Authority：直接推荐颁发临时证照（无需FAA考试）→ 归档临时证照记录（含考核人、类型、日期）→ 将学员申请材料与培训记录提交FAA换发正式证照

### 5. 质量管理/合规监督流程

1. FAA不定期检查（Part 141 §141.21、Part 142 §142.29）：核实人员/设施/设备/记录合规性 → 系统需支持随时导出对应记录包
2. 质量异常触发的证书行动：
   - 141：培训质量未达标（如首次通过率跌破80%阈值）→ 可能导致证书暂停/吊销
   - 142：未按批准的训练大纲执行 → FAA可要求30天内整改，逾期暂停/吊销/终止证书
3. FAA可要求学校/中心对在训学员执行FAA主导的knowledge/practical/stage/end-of-course测试抽查
4. 证书吊销/暂停/终止后：5个工作日内交回证书、撤除所有"已认证"广告标识、通知所有广告代理停止相关宣传
5. 前FAA雇员利益冲突审查：招聘/委任管理岗位时系统提示核查候选人过去2年是否曾任监督该机构的FAA督察员

---

## 三、Part 141 vs Part 142 关键差异对比表

| 维度 | Part 141（Pilot School） | Part 142（Training Center） |
|---|---|---|
| **法规定位** | 面向个人飞行员的"学校"，直接向学员颁发结业证书、可自带 Examining Authority 向FAA推荐颁证 | 面向"培训中心"，以合同/协议方式为其他持证人（航空公司、Part 121/135运营人、其他学校、机组人员等）提供训练/测试/检查，功能上接近ATO |
| **适用对象** | 私人飞行员培养全流程（从Recreational到ATP、CFI、机型等级等） | 主要服务对象是航司/运营人机组的合格审定训练（Part 61/63/65/91/121/125/135/137均可通过Part142完成），也可服务GA飞行员 |
| **证书有效期** | 24个自然月，需主动续期；Provisional证书24个月且不可续期 | 无固定到期（境内），除非主动交回或被吊销/暂停/终止；境外中心12个自然月到期需续期 |
| **课程审批严格度** | 每门课程须对照 Appendix A–M 规定的**最低地面/飞行学时**逐项达标，减时数课程需额外走 Initial→Final 两阶段审批并满足通过率门槛 | **不预设最低学时**，由申请人自行提出课程大纲(syllabus/curriculum)，FAA基于Training Specifications逐案批准，更灵活，适配企业定制化机组训练 |
| **课程分类** | 按证照/等级类型分（私照、商照、仪表、ATP、CFI、类型等级等固定Appendix） | 分 Core Curriculum（认证必需，可跨卫星中心共用）与 Specialty Curriculum（客户专属定制） |
| **人员角色体系** | Chief Instructor / Assistant Chief Instructor / Check Instructor 三级体系，均有明确飞行小时数门槛（按课程类型1000–2000+小时PIC不等） | Instructor / Evaluator 两类角色，门槛依训练设备/机型复杂度浮动（型别等级FFS训练要求更高的§61.159/161/163经验） |
| **教员复训周期** | 每12个自然月1次proficiency check；Chief/Assistant每12个月完成培训大纲或CFI refresher | 每12个自然月1次知识测试+熟练检查，另有8小时初始地面培训要求；ATP训练项目教员另有专项要求(§142.54) |
| **Examining Authority（免考推荐颁证）** | 141专属机制：学校满足严格通过率(≥90%)与培训量(≥10人/24月)后，可自行签发临时证照 | 无此机制；142的Evaluator经FAA批准后直接执行认证测试并签发结果，但不构成"examining authority"式的整体豁免 |
| **训练设备管理** | §141.41 规定FFS/FTD须Part60合格+FAA批准科目；ATD须经评估批准；教具需与课程相关 | §142.57–142.59 更严格且系统化：设备须逐项列入 Training Specifications，含FAA识别号、每日功能预检、缺陷日志、维护记录联动改装追踪 |
| **卫星机构** | Satellite Base，需助理主任教员驻场或可即时联络，超过连续7天需书面通知FAA | Satellite Training Center，需主中心管理人员直接监督，设立前至少60天书面通知 |
| **学员记录保存期** | 至少1年（毕业/终止/转学起算） | 至少1年（含学员记录、教员/考官资质记录，考官在职期间的资质记录需保留至离职后1年） |
| **变更申请提前期** | 课程新增/修订：至少提前30天；地址变更：至少提前30天 | 新设培训项目：至少提前120天；已批准项目修订：至少提前60天 |
| **广告/公开信息义务** | 须清晰区分已批准/未批准课程；证书失效后须撤除认证标识 | 同样禁止未经批准课程的宣传；证书失效后须撤除标识并通知广告代理停止宣传 |
| **对系统"机构类型"字段设计的启示** | 建议枚举：`PART141_PILOT_SCHOOL` / `PART141_PROVISIONAL` | 建议枚举：`PART142_TRAINING_CENTER` / `PART142_SATELLITE`；且141/142机构间存在"Training Agreement"关联关系，系统应支持机构间的训练外包记录与学员记录互转 |

---

## 附：AC 61-136B（ATD审批）要点速览

| 项目 | BATD | AATD |
|---|---|---|
| 适用范围 | 私照、仪表等级、仪表经验/时间 | 私照、仪表等级、商照、ATP、CFI、IPC |
| 座舱设计要求 | 功能可识别的物理飞控（不可用键鼠/摇杆操纵飞机），基础仪表/开关配置 | 在BATD基础上叠加：仿真座舱(开放或封闭)、数字航电面板、GPS+移动地图、双轴自动驾驶(如原厂标配)、独立可视系统、固定可调座椅、独立教员站等 |
| LOA有效期 | **5年**，到期前120天内可申请续期 | 同左 |
| 审批流程 | 制造商提交QAG+操作手册+申请信（提前90–120天）→ FAA文档初审 → 提交演示视频 → 现场功能评估 → 签发LOA | 同左，但需额外满足Appendix C全部附加设计标准 |
| 学分限制 | 与AATD/FTD/FFS合并使用于仪表等级时，总学分不超过§61.65及Part141 Appendix C规定的50%上限 | 同左；同时141各Appendix对FFS/FTD/ATD单项学分比例有更细的百分比上限（10%–50%不等，按课程等级） |
| 变更管理 | 影响功能/界面的改装须重新提交QAG评审；不影响功能的小改动（处理器升级等）无需重批 | 同左 |
| Part 141集成 | 须获得所属FSDO/POI在TCO中的单独批准方可计入141课程学分 | 同左 |
