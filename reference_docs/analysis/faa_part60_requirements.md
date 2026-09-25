# FAA 14 CFR Part 60（FSTD初始与持续鉴定及使用）—— 面向"模拟机资质与检查管理"软件设计的需求提炼

来源文件：`reference_docs/FAA/14_CFR_Part_60_FSTD_Qualification_2025.pdf`（2025-01-01版，14 CFR Ch. I）
阅读方式：使用 `pdftotext -layout` 提取全文（约457页）逐页阅读分析。正文 §60.1–§60.37、附录E（QMS）、附录F（定义与缩写）的文字内容已完整提取核对；附录A/B/C/D中的"分级能力矩阵大表"（如Table A1A，FFS Level A/B/C/D逐项能力对照表）在源PDF中是**图形/图片对象**，文本层无法抽取，下文Level A–D的能力描述部分基于条文中可提取的相关段落（如Table A1B任务-等级对照表、FSTD Directive示例等）以及该表格在业界的公开通行理解整理，已在对应条目标注"（通用行业知识，非逐字摘录）"。FTD Level 4–7的定义是**原文逐段提取**，可直接作为软件的分级字典数据。

---

## 0. 核心概念速查（用于建模的"实体字典"）

| 术语 | 缩写 | 定义要点（用于软件字段/枚举） |
|---|---|---|
| Sponsor（赞助人） | - | 持有/申请Part 119/141/142合格证或Part 63飞行工程师课程批准的人，负责为某台FSTD申请并维持资质，并对该部Part下规定的行为负责。一台FSTD同一时间只能有**一个**Sponsor。 |
| Flight Simulation Training Device | FSTD | 上位概念 = FFS 或 FTD |
| Full Flight Simulator | FFS | 特定机型的复现体，含运动系统（≥3自由度等效感觉）、视景系统、全部机载系统能力 |
| Flight Training Device | FTD | 无需运动系统/完整视景的机型部件复现体，Level 4–7 |
| Qualification Level | - | NSPM（National Simulator Program Manager，现多称"responsible Flight Standards office"/Flight Standards Service）基于设备技术与运行能力认定的等级 |
| Qualification Basis（鉴定基础） | - | 某FSTD被评定合格时所依据的标准版本（含grandfathering特定时期标准、已批准的deviation、FSTD Directive等），是与该设备绑定的"合规基线" |
| Qualification Performance Standard | QPS | 附录A–F，规定客观/主观测试与合格标准的集合 |
| Qualification Test Guide | QTG | 用于评估某FSTD的主参考文件，含测试结果、SOC等 |
| Master Qualification Test Guide | MQTG | 首次鉴定发证后，QTG + FAA见证测试结果 = MQTG，是该设备的"活档案"，此后所有变更、缺陷、指令均需归档于此 |
| Electronic MQTG | eMQTG | MQTG的电子化版本 |
| Statement of Qualification | SOQ | FAA颁发的资质证书，含Sponsor、机型/机型组、构型、FFS或FTD属性、等级、已鉴定任务清单（List of Qualified Tasks）、豁免/偏离说明 |
| Management Representative | MR | Sponsor为每台FSTD指定的责任人，负责监督持续鉴定、QMS运行、向管理层汇报 |
| Training Program Approval Authority | TPAA | 批准该FSTD所用训练大纲的人/机构 |
| Quality Management System | QMS | Sponsor必须建立并经责任监察机构批准的质量管理体系 |
| Discrepancy（缺陷） | - | FSTD与被模拟飞机不符的任何方面，含MMI（缺失/故障/失效部件）及文档错误（如MQTG缺项） |
| MMI | - | Missing, Malfunctioning, or Inoperative component |
| FSTD Directive | - | FAA因安全原因强制要求的改装指令，会修改该设备的"鉴定基础" |
| Downgrade（降级） | - | 永久性地将FSTD等级调低 |
| Upgrade（升级） | - | 为达到更高等级而做的改进（属于Modification的一种） |
| Update（更新） | - | 不影响鉴定等级的改进/现代化 |
| Modification（改装） | §60.23 | 影响SOQ或MQTG的软硬件变更 |
| Special Evaluation | - | 非初始/升级/持续鉴定目的的评估（如设备搬迁、可能影响性能的软硬件更新） |
| Training Restriction | - | MMI存在期间的临时限制：设备仍可在SOQ标注等级使用，但不能做依赖该MMI部件的任务 |
| Interim Qualification | §60.21 | 针对新机型/新型号、数据包尚未最终定型时的临时资质，最长2年 |
| Grandfathering | - | 按设备制造/鉴定时生效的标准版本固化其鉴定基础的做法 |
| BASA / SIP | §60.37 | 双边航空安全协定 / 模拟机实施程序，用于采认外国适航当局的鉴定结果 |

---

## 1. FSTD分级体系

### 1.1 数据字段
- `fstd_category`：FFS ／ FTD
- `aircraft_category`：Airplane ／ Helicopter（对应附录A/C为FFS，B/D为FTD）
- `qualification_level`：
  - FFS：Level A / B / C / D（Helicopter FFS**无Level A**，条文明确"there are no Level A Helicopter simulators"）
  - FTD：Level 4 / 5 / 6 / 7
- `level_capability_matrix`：等级→可鉴定任务的映射（见1.3，用Table A1B结构建模）
- `visual_system_required`：布尔 + 分辨率/视场角等参数（Level 7 FTD要求出舱视野≥180°水平×40°垂直，直升机Level 7为146°×36°并含振动模拟）
- `motion_system_dof`：FFS要求至少等效三自由度运动系统的"cue"，Level区分见下

### 1.2 FTD Level 4–7 能力定义（原文逐段提取，可直接做为分级字典）
| 等级 | 座舱 | 空气动力学建模 | 系统 | 操纵负荷 | 显示/操纵件 | 视景 |
|---|---|---|---|---|---|---|
| Level 4 | 开放式或封闭式机型专用座舱，至少1个运行系统 | 不要求（仅需空/地逻辑） | 至少1个运行系统 | 不要求 | 显示可为平板/LCD或实物；操纵件可触屏 | 无 |
| Level 5 | 开放式或封闭式机型专用座舱 | 通用（generic）空气动力学模型 | 至少1个运行系统 | 仅需在进近速度/构型下代表性 | 主/辅飞控（舵、副翼、升降舵、襟翼、扰流板、发动机操纵、起落架、方向舵配平、刹车）须为实物；其他可触屏 | 无 |
| Level 6 | 封闭式机型专用座舱 | 机型专用空气动力学模型 | 全部适用系统运行 | 全飞行/地面包线内代表性 | 全部操纵件须实物复制 | 无（不要求出舱视景） |
| Level 7 | 封闭式机型专用座舱 | 机型专用空气动力学模型 | 全部适用系统运行 | 全飞行/地面包线内代表性+显著音效 | 全部操纵件须实物复制 | 要求出舱视景，双人同时可视，≥180°水平×40°垂直（直升机版为146°×36°+振动提示） |

（直升机FTD Level 4–7定义与固定翼几乎一一对应，仅将"airplane"替换为"helicopter"，Level 7额外要求振动提示系统。）

### 1.3 FFS Level A–D（**通用行业知识补充，非逐字摘录**，因源表Table A1A为图片对象无法抽取）
- Level A：最低等级运动/视景要求，历史上多用于早期机型，现行规则下已较少用于新机型初始鉴定
- Level B：在A基础上视景/运动有限提升
- Level C：昼间/微光视景、6自由度运动，可用于大部分训练/检查科目及正常起降训练
- Level D：最高等级，含夜间/黄昏视景与最严格容差，是唯一允许"零飞行时间"（ZFT）训练科目（新机型首次型别等级培训无需真机飞行）的等级
- 需与FAA复核确认具体逐项差异（视景分辨率、运动包线、声音、动态失速建模等），建议后续从FAA官网AC 120-40或QPS附件原始PDF（图片页）做OCR后补全逐项矩阵表。

### 1.4 任务-等级对照（Table A1B，原文可提取，是"与培训课程关联"的核心依据）
条文用 `X`=该等级必须能执行该任务才可获得该等级鉴定；`R`=该任务仅在**持续鉴定**中可选获得资质；`A`=只要相应飞机系统被模拟且工作正常即可考核。示例（节选，完整任务清单见附表）：
- 正常/侧风起飞、正常/侧风进近与着陆、精密/非精密进近落地、盘旋进近落地、无襟翼落地：仅 **C/D级标记X**，A/B级标记为**R**（即A/B级FFS不能作为起降科目的初始/继续培训直接判据，只能在持续鉴定里用于其已获得的科目）
- Upset Prevention & Recovery Training (UPRT)：仅 **C/D级**
- Full Stall（完全失速）训练：仅**C/D级**，且需SOQ专门标注"qualified to conduct full stall training tasks"
- 其余（滑行以外的正常检查单、仪表程序、系统故障处置、应急程序等）：A/B/C/D**普遍要求X**

→ 软件设计启示：每台FSTD应维护一份"已鉴定任务清单（List of Qualified Tasks）"，与SOQ绑定，并与培训课程/科目大纲关联，用于自动校验"某训练科目是否可在该设备上完成"。

---

## 2. 初始鉴定（Initial Qualification, §60.15）流程

### 2.1 数据字段
- 申请编号、申请日期
- 拟申请等级（level requested）
- 责任监察机构（responsible Flight Standards office）
- TPAA确认函（concurring letter）状态
- 验证数据包（validation data package）来源：飞机制造商飞行试验数据 / 其他数据供应商数据（需符合飞行试验方法与计划）/ 预测数据 / 工程仿真数据 / 飞行员手册数据 / 公开数据源（需经责任机构认可）
- 指定飞行员（confirming pilot）姓名、资质（须由Sponsor指定，且满足条件：熟悉被模拟机型，或对于无型号合格证的新机型/未运行过的机型，满足"相似尺寸构型飞机"条件）
- 三项确认声明（Statement内容）：
  1. 性能与操纵品质在正常包线内代表被模拟飞机（飞行员确认）
  2. 系统/子系统功能代表飞机（飞行员或经培训人员确认）
  3. 座舱构型代表机型/机型组构型（飞行员或经培训人员确认）
  例外项需记录（exceptions noted），确认人姓名须可供责任机构查询
- 客观测试结果（objective test results）
- 偏离/豁免申请（deviation request）：编号、依据、批准状态，一经批准即成为该设备"永久鉴定基础"的一部分并记入SOQ
- QTG → 评估通过后更新为MQTG
- SOQ字段：Sponsor身份、机型/机型组、构型（发动机型号、仪表、导航系统等）、FFS/FTD属性声明、鉴定等级、已鉴定任务清单及例外声明、已批准偏离清单

### 2.2 流程（状态机）
```
[申请人资格确认 §60.7]
   └─(持证/QMS已批准/MR已确认)→
[提交初始鉴定申请 + 同步发送TPAA确认函请求] (§60.15a)
   └─→ [责任机构受理] 
        └─→ [Sponsor组织指定飞行员完成主观确认三项声明] (§60.15b)
        └─→ [Sponsor提供设备访问权限，责任机构现场客观+主观测试] (§60.15f)
        └─→ [如数据不足，责任机构可要求追加客观数据/飞行试验] (§60.13e)
   └─→ 通过 → [责任机构签发SOQ] (§60.15g)
   └─→ [Sponsor依据FAA见证测试结果更新QTG] (§60.15h)
   └─→ [QTG →归档为MQTG，成为该设备终身档案起点] (§60.15i)
   └─→ 未通过 → 返回补正/重新安排评估
```
特殊分支：
- **新机型/型号数据未最终定型** → 可申请 **Interim Qualification（§60.21）**：需提供制造商预测数据+有限飞行试验数据验证、预测方法说明、QTG测试结果；有效期最长2年（责任机构可酌情延长）；须在最终数据包发布后12个月内（不超过发证后2年）转为正式初始鉴定。
- **搬迁场地** 视为资质自动失效（见第3节），需按初始鉴定流程重新评估（除非责任机构认定不需要）。
- **标准变更过渡期规则**：FAA发布新标准/标准修订后，Sponsor若在30天内通报"已下单订购"该FSTD，可在90天内申请沿用下单时的旧标准，但评估须在标准变更公布后24个月内完成。

---

## 3. 持续鉴定/定期评估（Continuing Qualification, §60.19, §60.27, §60.29）

### 3.1 数据字段
- 上次持续鉴定日期、下次到期日（责任机构在SOQ中指定的评估频率/周期，典型为**年度**）
- 宽限期规则：在应评估月份前后**3个自然月**内完成，视为在应评估月份完成（不算逾期）
- 年度客观测试（Attachment 2 objective tests）完成记录：QMS要求"每年至少4次均匀分布的检查"（quarterly-like，四次/年）
- **功能性飞行前检查（functional preflight check）**：每次使用前**24小时内**须完成一次，需记录
- 责任机构现场持续鉴定评估结果（最近3次或近2年的记录，以覆盖时间更长者为准）
- Sponsor每年一次向责任机构提前**60天**申请安排评估
- FSTD使用记录：是否在Sponsor的FAA批准训练大纲中于规定周期内实际使用（§60.7(b)(5)/(6)，关系到Sponsor资格是否被"forfeit"）
- 维护记录（corrective/preventive maintenance）

### 3.2 状态机：资质维持 / 降级 / 失效 / 恢复
```
[已持有SOQ，持续使用中]
  ├─ 正常路径：按周期完成年度客观测试(≥4次/年) + 每日/每次使用前24h功能检查 + 按SOQ规定频率通过责任机构持续鉴定评估
  │
  ├─ 【自动丧失资质 Automatic Loss, §60.27(a)】触发条件（任一）：
  │     1) 未按§60.7(b)(5)/(6)在训练大纲中实际使用，且未取得年度飞行员书面确认声明
  │     2) 未按§60.19完成检查
  │     3) 设备物理搬迁到新地点（不论距离）
  │     4) MQTG缺失且30天内未补齐替代件
  │   → 恢复路径：
  │     a) 通过（全部或部分）初始鉴定评估 §60.15/§60.17(c)，或
  │     b) 责任机构认定无需重新评估
  │     c) 判定所需测试范围时考虑：错过的持续鉴定次数、错过的季度检查次数、设备维护状况
  │     d) 若资质在丧失后<2年内恢复：沿用原鉴定基础；若≥2年未恢复：需按恢复申请时"现行"标准重新鉴定
  │
  ├─ 【其他方式丧失资质 Other Losses, §60.29】（责任机构主动认定设备不再达标）：
  │     通知Sponsor(书面) → 给予≥7天陈述期 → 责任机构裁定 → 生效（≥30天后，除非涉及紧急安全情形可立即生效或Sponsor在30天内向Executive Director申诉冻结生效）
  │   → 恢复：需通过初始鉴定评估（全部或部分，由责任机构判定）
  │
  ├─ 【降级 Downgrade, §60.16(e)】：Sponsor可主动申请永久降级，责任机构可不经初始评估直接降级，后续持续鉴定沿用（修改后的）既有MQTG
  │
  └─ 【升级/追加资质 §60.16】：需提交MQTG修改内容、设备改装说明、指定飞行员补充主观评估确认书 → 通过评估（全套或部分初始评估要素，由责任机构判定）→ 责任机构颁发修订版SOQ
```

---

## 4. 配置管理（Modifications, §60.23）

### 4.1 数据字段
- 变更记录：变更类型（硬件加装/移除、软硬件影响飞行或地面动力学、影响性能操纵品质如运动/视景/操纵负荷/声音系统、MQTG变更）
- 是否构成"Modification"的判定标志（不影响客观测试结果/验证数据的MQTG文字性变更**不算**Modification）
- FSTD Directive记录：编号、发布机构（FAA）、适用范围、强制生效日期、合规状态、归档位置（须归档于MQTG的"designated FSTD Directive Section"）、并在"Index of Effective FSTD Directives chart"中登记
- 通知记录：通知责任机构与TPAA的日期、21天等待规则的计时器状态
- 用户通知：SOQ临时插页（addendum）发布/撤销记录，直至正式更新版SOQ发布
- MQTG更新记录：受影响的客观测试项、数据来源、修改完成记录

### 4.2 流程（状态机）
```
[Sponsor识别到拟变更是否构成Modification]（依据§60.23(a)定义）
   ├─ 若由FSTD Directive触发（安全强制）：
   │     [FAA发布FSTD Directive] → [Sponsor必须执行改装，不论原鉴定基础] 
   │     → [归档Directive到MQTG + 登记Index of Effective FSTD Directives]
   │
   └─ 若为Sponsor主动变更：
         [通知责任机构 + TPAA意图变更] 
         → 等待期规则（三选一触发"可投入使用"）：
             a) 21天无任何一方响应
             b) 21天内一方批准、另一方未响应
             c) 双方均在21天内批准（可提前生效）
             d) 或完成责任机构要求的（全部/部分）初始鉴定评估后方可使用
         → [使用改装后FSTD前必须满足上述条件之一]
         → [发布SOQ addendum直至正式修订版SOQ发布]
         → [更新MQTG：更新受影响客观测试结果与数据 + 归档变更完成记录]
```
关联：改装后如涉及"移机/换址安装"，属于自动丧失资质情形（§60.27(a)(3)），需走恢复评估流程，与本节联动。

---

## 5. 记录保存要求（Recordkeeping, §60.31 & 附录E表E1）

### 5.1 数据字段与保存期限
| 记录类型 | 保存期限/规则 |
|---|---|
| MQTG及历次修订 | 永久保存（设备资质存续期间） |
| 自原始SOQ签发以来的全部Modification记录（§60.23） | 永久保存 |
| 初始鉴定及历次升级评估结果副本 | 自原始SOQ签发以来永久保存 |
| §60.19(a)年度客观测试结果 | 保存**2年** |
| 最近三次持续鉴定评估结果，或近**2年**内的全部持续鉴定评估记录（取覆盖时间更长者） | 见左 |
| 依据§60.9(b)收到的用户书面意见/评论 | 保存**至少90天** |
| 缺陷日志（discrepancy log）历史记录 | 保存**2年**，含：缺失/故障/失效部件清单、纠正措施、纠正日期、认定纠正完成人身份 |
| 年度飞行员书面确认声明（性能/操纵品质代表性，§60.7(d)(2)） | 保存**最近两份** |
| QMS内部审核/评估记录 | 按QMS周期保存（见下） |

- 记录形式：可用明文或编码形式，但编码形式须能被责任机构接受地保存与检索（防篡改要求，尤见FTD软件变更记录条款：须含"软件名称、气动/发动机模型变更、变更日期、变更摘要、变更原因"）
- 责任主体：**Sponsor**（非设备制造商、非培训机构本身，除非二者身份重合）
- QMS周期性评估：Sponsor自评每6个月一段（segment），整套QMS体系须每24个月完整评估一次；责任机构现场QMS评估间隔≤24个月

---

## 6. 缺陷/故障处理（Discrepancy / MMI, §60.20, §60.25）

### 6.1 数据字段
- 缺陷日志（discrepancy log）条目：发现人（教员/检查员/FAA代表/做飞行前检查的人）、发现时间（须在飞行前检查或使用session结束时记录）、缺陷描述、是否MMI类型
- 纠正措施描述、执行人身份、纠正完成日期
- MMI组件清单（当前有效）：须在设备内/旁可查（电子终端亦可）
- 30天修复时限：MMI组件须在**30个日历日**内修复或更换，除非责任机构另有批准或要求
- Training Restriction标志：MMI存在期间，设备仍可按SOQ等级使用，但不得用于依赖该失效部件的科目/任务
- 缺陷优先级分类系统（若Sponsor采用"已批准的discrepancy prioritization system"，可用它替代逐项30天追踪，但需说明分级、处置措施与超期上报机制）

### 6.2 流程（状态机）
```
[使用/飞行前检查中发现缺陷] 
  → [记录人须在session结束前写入discrepancy log]（无论是否为MMI）
  → 判定：是否为"MMI"（缺失/失效且为完成某任务所必需）
       ├─ 是 → 加入MMI清单（对外公示） 
       │      → 是否已修复？
       │           ├─ 30天内修复/更换 → 从MMI清单移除，日志标注纠正信息
       │           └─ 超30天未修复 → 需责任机构批准/授权延期，否则不得使用相关任务
       │      → 使用限制：期间可继续用于其他不依赖该部件的任务（Training Restriction）
       └─ 否（非MMI，如文档错误等）→ 仍需记录整改并归档
  → 缺陷记录保存2年（见第5节）
```
关联：若设备因MMI未修复或日志缺失影响到MQTG完整性达30天，触发§60.27自动丧失资质（第3节）。

---

## 7. 人员要求

### 7.1 Sponsor侧内部人员
- **Management Representative (MR)**：
  - 每台FSTD必须指定**唯一一名**MR（可一人兼多台设备，但一台设备不能有多个MR）
  - 须为Sponsor雇员，具监督/修改QMS政策与流程的权限
  - 职责：监督在鉴定持续性、确保QMS建立与维护、定期向管理层汇报
  - 可将部分职责（§60.9(c)(2)(3)）委托给各场所的具体个人，但责任不转移
  - QMS附录E补充：Director of Operations（Part 119）/ Chief Instructor（Part 141）/ 对应角色（Part 142或飞行工程师学校）负责**指定**MR
- **指定确认飞行员（§60.15(d)）**：由Sponsor指定，须熟悉被模拟机型或（新机型/未运行过机型）满足"相似尺寸构型飞机"经验条件，用于完成初始鉴定三项主观确认声明
- **QMS内部审核员/评估人（assessor）**：条文仅要求"应具备FSTD相关的充分知识，并为责任机构可接受"，未设更细颗粒度证照要求
- **技术/维护人员**：条文要求Sponsor建立"提供适当FSTD硬件软件测试与维护能力的维护设施"及"具备充足人手覆盖FSTD运行时段的常规维护及QTG测试执行"能力，但未规定具体证照
- **反馈来源人员类别**（QMS要求建立接收机制）：近期完训人员、使用该FSTD进行训练/检查/经历飞行的教员与检查员、FSTD技术/维护人员

### 7.2 外部（FAA侧）
- **responsible Flight Standards office**（现行文本中的责任监察机构，历史上/部分条款仍称NSPM = National Simulator Program Manager）：负责初始/持续鉴定评估、QMS评估、资质裁定与恢复决定
- **TPAA（Training Program Approval Authority）**：审批该FSTD所属训练大纲，需与责任机构共同收到改装通知并给出意见
- **POI/TCPM**：条文中出现（Principal Operations Inspector / Training Center Program Manager），涉及机场模型分类等具体审批场景的抄送对象

---

## 8. 与培训课程的关联

### 8.1 数据字段
- SOQ内"List of Qualified Tasks"（已鉴定任务清单）——与Table A1B的任务分类体系一致，建议按其编号体系（1. Preflight Procedures … 8. Postflight Procedures，各含子项a/b/c…）建表
- 每个任务的适用标记：`X`（该等级鉴定要求必须具备）/ `R`（仅持续鉴定可选获得，如各类起降科目对A/B级）/ `A`（相应系统被模拟且工作正常即可考核）
- 特别授权类科目（需在SOQ中特别标注）：Full Stall Training、UPRT（Upset Prevention & Recovery Training）、Circling Approach（需特别授权）、Windshear Training（附录A Attachment 5，专门QPS要求：SOC、至少2种强度风切变模型、演示留档MQTG）
- Configuration List（构型清单）：机型/机型组、发动机型号、航电/导航系统构型等，决定该设备可模拟的具体机型状态
- 与外部训练大纲的关联：TPAA批准的训练大纲编号、Sponsor的Operations Specifications/Training Specifications授权的机型/机型组

### 8.2 流程/校验逻辑（供软件实现"训练科目-设备资质"匹配校验）
```
[排课/科目分配时] 
  → 读取该FSTD当前SOQ的Qualification Level + List of Qualified Tasks 
  → 校验拟安排科目是否在清单内、是否需要"特别授权"标记（如Full Stall/UPRT/Circling Approach）
  → 若为新增科目需求且当前SOQ未覆盖 → 触发"§60.16 Additional Qualification"流程（见第3节升级分支）
  → 校验当前是否存在有效Training Restriction（MMI导致）覆盖该科目所需部件 → 若存在则阻止排课
```

---

## 9. 建议的核心数据表（软件ER模型草案）

- **FSTD**：设备编号、序列号、机型/机型组、FSTD类别（FFS/FTD）、鉴定等级、当前Sponsor、当前MR、安装地点、投产日期、当前SOQ版本号
- **Sponsor**：证书类型（Part 119/141/142/63）、证书号、QMS批准状态、QMS批准日期
- **SOQ（资质证书）**：版本号、颁发日期、责任机构、机型/构型、等级、已鉴定任务清单、已批准偏离清单、生效/失效日期、状态（有效/暂停/失效/降级后）
- **QualificationBasis（鉴定基础）**：标准版本号、grandfathering区间、已批准deviation列表、已适用FSTD Directive列表
- **MQTG**：关联FSTD、版本/修订历史、客观测试结果集、FAA见证测试记录、FSTD Directive归档区、Index of Effective FSTD Directives
- **ContinuingQualificationEvent（持续鉴定事件）**：计划日期、实际完成日期、责任机构评估人、结果（通过/不通过/部分）、下次到期日
- **ObjectiveTestRecord**：测试项编号（对应各附录Attachment 2表）、测试日期、结果、容差、保存期限计时（2年）
- **DiscrepancyLogEntry**：发现人、发现时间、描述、是否MMI、纠正措施、纠正人、纠正日期、状态（open/corrected）、关联Training Restriction
- **ModificationRecord**：变更描述、类型（硬件/软件/影响动力学等）、是否触发Directive、通知责任机构/TPAA日期、21天计时器状态、批准状态、MQTG更新记录关联
- **FSTDDirective**：编号、发布日期、强制生效日期、适用范围、合规状态、归档记录
- **QMSAssessment**：分段编号（segment）、评估周期（6/12/24个月）、评估人、结果、不符合项与整改记录
- **TrainingTaskCatalog**：任务编号（Table A1B体系）、任务名称、要求等级映射（X/R/A规则）、是否需要特别授权
- **PersonnelRecord**：角色（MR/指定确认飞行员/QMS评估员/维护技术员）、姓名、资质证明、授权范围、生效日期

---

## 10. 尚未能从PDF文本层直接核实、建议后续补充确认的内容

1. **附录A Table A1A（FFS Level A/B/C/D逐项能力矩阵）**——源PDF中为图片对象，本次未能提取文字，建议后续对该PDF相应页（正文页码29–46附近）做截图+OCR或直接参考FAA官网HTML版14 CFR Part 60、AC 120-40C（草案）获取完整逐项表格。
2. **附录C/D（直升机FFS/FTD）中FFS Level B/C/D的图片化能力矩阵**——同上原因未提取，仅确认"无Level A直升机FFS"及Level 4-7 FTD定义与固定翼版本高度一致。
3. **各附录Attachment 4的SOQ/QTG样例表单**（Figure A4E等）为图片，样表具体版式未获取，但§60.15(g)已提供SOQ法定必备字段清单，足以支撑表单设计。
4. 建议后续按需专项阅读：附录A Attachment 2/3（客观测试与主观评估详表，用于自动化测试记录模块字段设计）、附录E完整QMS要素表（本次已提取Table E1核心内容，可直接映射QMS检查清单模块）。
