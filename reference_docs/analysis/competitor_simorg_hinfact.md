# 竞品调研：SIMORG（Gözen Digital Aviation）与 HINFACT

来源：simorg.aero、hinfact.com 官网公开的产品模块页面（无公开完整版"说明书"/用户手册，以下为官网模块功能页整理，可视为功能层面的产品说明）。

## SIMORG（土耳其 Gözen Digital Aviation，面向"模拟机中心/ATO"，偏重 FSTD 技术运行）

定位：一体化培训中心管理软件，7大模块 40+ 子模块，强调"全合规（FAA/EASA/Part-ORA/ARINC 433-2）"。

### 1. Planning & Scheduling（计划与排班）
- 所有FSTD单一看板展示，支持多基地
- 可用时段展示、实时预订
- 客户需求/备注管理、客户培训统计
- 按设备/客户定义计价策略
- 一键生成完整培训日志（training log）
- 时段屏蔽（masking）功能

### 2. Technics（模拟机技术维护）—— 与FAA/EASA模拟机资质法规直接对应
- **Maintenance**：按周期或按计数器（小时数）定义每台FSTD的维护任务；年/季/日维护计划生成；维护需求（Maintenance Requirement）按设备定义与列表；任务关联维护检查单（checklist）；日历视图；技师工时（man-hour）跟踪
- **Service Request（缺陷/故障处理）**：分钟级监控模拟机缺陷；打印缺陷信息/维修计划；服务请求跟踪；拖拽方式变更设备状态；按资质规则自动分配技师
- **FSTD Terminal/Kiosk**：培训中舱内终端，技术人员和客户均可直接报告问题、打分、记录培训损失时间；生成/打印FSTD电子技术日志（e-tech log）
- **Technical Dashboard**：按人员/流程分组的任务消息面板，历史数据可查
- **QTG Management**：QTG（Qualification Test Guide）任务计划、复测/评估/最终批准日期跟踪，可加自定义步骤，供当局检查随时调取——**与FAA Part60/EASA CS-FSTD的QTG持续鉴定要求完全对应**

### 3. Training（培训管理）
- **Enrollments**：按大纲组合课程、日历视图、班级/教员/设备按资质与可用性自动匹配与预订、自动发日历邀请
- **Training Planning**：定义培训大纲并关联课程、教员可用时长定义与监控、教员月度日历、课程资源需求定义（教室/设备/教员）、学员跟踪与证书生成
- **Qualification Management**：跟踪学员/教员/设备的资质合规状态，按时间/年龄/职位定义到期规则，证书到期提醒机制——**对应EASA ORA.ATO人员/设备资质有效期管理需求**
- **Training Forecast**：基于历史数据预测下一年度资源需求，图形化展示年度产能 vs. 需求

### 4. Compliance（合规/审计）—— 直接对标法规
- **Audit Planning**：按 **FAA/EASA、Part-ORA、ARINC 433-2** 规则组织审计计划；内外部审计程序与检查单；日历视图；文档管理；实时状态跟踪；一键生成提交当局的报告
- **CPARs（纠正预防措施）**：定义优先级、指派到部门/个人、生成CPAR状态报告、流程化CAPA管理、邮件提醒

### 5. Inventory & Tool（备件与工具库存）
- 备件按配置树（configuration tree）关联使用类型；库存报表；最低库存量定义与预警
- 工具：FSTD校准计划管理、按位置/用途分类、移动记录跟踪
- 采购单：供应商管理与分类、审批流程、到货提醒

### 6. Finance（财务）
- 月度分解、自动售价计算、导出Excel、按培训类型/时长的客户统计、自动取消费计算
- 发票：已付/未付展示、账龄分析、发票跟踪、按客户导出FSTD预订清单

### 7. Reports（报表）
- 销售/市场报表（按客户、时间、机型、设备）
- 技术报表：缺陷报表、工时报表、合规报表、技术评估报表

**对系统设计的启示**：SIMORG把"模拟机技术档案+QTG+维护+备件+校准"当作核心竞争力单独建一整套模块群，说明模拟机管理不能只是一张"设备表"，需要维护计划、缺陷工单、QTG生命周期、备件/工具关联这几个子系统联动。

---

## HINFACT（法国Toulouse，被Air France-KLM选用，偏重"培训记录/资质/CBTA-EBT合规"，不强调FSTD硬件维护）

定位：新一代航空培训管理系统（ATMS），三条产品线：
- **ETR**（Electronic Training Records，电子培训记录）：Instructor App + Records Keeping + Training Design Tool
- **TMS**（Training Management System，面向航司/大型培训机构）：上述 + LMS e-learning + QMS + Advanced Analytics
- **FSMS**（Flight School Management System，面向飞行学校）：上述 + Planning & Scheduling + Resources Tracking

### 通用模块清单
- **Planning & Scheduling**：培训排期、资源（模拟机/飞机/教员）实时可用性可视化
- **Instructor App**：教员端App，用于课堂/讲评（debriefing）省时记录
- **Records Keeping**：资源与培训记录跟踪
- **Analytics（Essential / Advanced）**：数据采集导出（Essential）、全量培训数据分析（Advanced），服务于培训与安全部门的数据决策
- **Training Design Tool**：培训大纲/课程设计与编排工具
- **QMS（Qualification Management System）**：教员/学员资质与到期日一览
- **DMS（Document Management System）**：培训相关文档集中管理
- **LMS e-learning**：内容创建投放、学员参与监控、成绩评估
- **Automated Flows / High Customization（Smart版本）**：AI驱动的自动化工作流、高度定制

### 核心卖点：CBTA / EBT（基于能力的训练与评估 / 循证培训）合规
- 明确定位"从传统培训转向 Competency-Based Training & Assessment（CBTA）"
- 支持 IATA/ICAO 合规、Evidence-Based Training（EBT）评分标准化
- 实施流程：需求梳理→产品演示（真实模拟机环境）→方案定制→系统配置→历史数据迁移→培训经理培训→教员标准化（EBT评分对齐）→上线1年后开放高级分析

**对系统设计的启示**：HINFACT几乎不涉及模拟机硬件维护/QTG，而是把"能力/胜任力评估模型（CBTA/EBT，对应EASA的Evidence-Based Training要求）+ 教员评分标准化 + 培训记录电子化"作为核心，这与Simorg形成互补——如果要设计"全面"的培训中心系统，需要同时覆盖：
1. Simorg式的模拟机技术资质与维护管理（对应FAA Part60/EASA CS-FSTD）
2. Hinfact式的人员能力/资质与培训记录电子化管理（对应EASA ORA.ATO人员与课程要求、CBTA/EBT评分体系）

---

## 两者对比速览

| 维度 | Simorg | Hinfact |
|---|---|---|
| 核心基因 | 模拟机中心/制造商背景，重技术运行 | 培训记录/学习管理背景，重人员能力评估 |
| 模拟机维护(QTG/校准/备件) | 强（独立Technics+Inventory模块群） | 未见 |
| 合规审计(Part-ORA/FAA/ARINC433-2) | 有专门Compliance模块+CPAR | 强调IATA/ICAO/CBTA合规，机制不同 |
| 教员/学员资质到期管理 | 有(Qualification Management) | 有(QMS)，且更强调CBTA胜任力模型 |
| 排班/预订 | 强，多基地FSTD看板 | 有，但更聚焦飞行学校资源 |
| 财务/发票 | 有独立Finance模块 | 未见公开介绍 |
| e-learning | 未见 | 有(LMS) |
| AI自动化流程 | 未强调 | Smart版本主打AI自动化工作流 |
