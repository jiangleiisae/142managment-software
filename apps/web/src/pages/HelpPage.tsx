import { Alert, Collapse, Typography } from 'antd'

const { Title, Paragraph, Text } = Typography

/// 静态帮助页, 不调用任何接口。菜单项对所有登录账户开放 (不受模块权限限制), 与 Kiosk 页一致。
export function HelpPage() {
  return (
    <div style={{ maxWidth: 900 }}>
      <Title level={3}>使用说明</Title>
      <Paragraph type="secondary">
        本系统帮助航空训练机构(ATO)按 EASA Part-ORA / Part-FCL 等规章要求管理培训运行、安全管理体系(SMS)、模拟机(FSTD)合规性、备件与人员资质等事务。以下按左侧菜单顺序说明各模块的用途和典型操作。
      </Paragraph>

      <Title level={4}>快速开始</Title>
      <Paragraph>
        <ol style={{ paddingLeft: 20 }}>
          <li>
            首次使用请在登录页点击"注册新机构", 填写租户名称、邮箱、密码。注册成功的账户自动成为该租户的 <Text code>OWNER</Text>, 拥有全部模块的完全访问权限。
          </li>
          <li>
            登录后先进入"机构与证书", 创建至少一个组织(Organization) —— 系统里绝大多数数据(模拟机、库存、人员任命等)都挂在某个组织下, 没有组织无法开始录入其他数据。
          </li>
          <li>
            如需多人协作, 由 OWNER/ADMIN 账户在"用户与权限"里创建其他登录账户, 并按需勾选各模块的访问权限(STAFF 账户按权限逐项授予; OWNER/ADMIN 账户默认拥有全部模块权限)。
          </li>
        </ol>
      </Paragraph>

      <Alert
        style={{ marginBottom: 24 }}
        type="info"
        showIcon
        message="关于权限"
        description="左侧菜单只显示当前账户有权限访问的模块。如果发现某个模块没有出现在菜单里, 请联系机构内的 OWNER/ADMIN 账户在「用户与权限」里为你的账户补充授权。"
      />

      <Title level={4}>各模块说明</Title>
      <Collapse
        items={[
          {
            key: 'organizations',
            label: '机构与证书',
            children: (
              <Paragraph>
                管理培训机构的基本信息、运行证书(AOC/ATO证书等)及有效期、是否为"复杂机构"判定(AMC1 ORA.GEN.200(b))。是否勾选"复杂机构"会影响系统里其他模块的部分合规要求(例如是否需要安全评审委员会)。同时提供"年度机构自查清单"功能, 对照 GM2 ORA.GEN.200(c) 的自查条目逐项记录。
              </Paragraph>
            ),
          },
          {
            key: 'management-system',
            label: '管理体系 SMS/QMS',
            children: (
              <Paragraph>
                安全管理体系(SMS)与合规监督体系的核心模块, 包含多个闭环流程:
                <ul style={{ paddingLeft: 20 }}>
                  <li><Text strong>组织角色任命</Text>: 任命安全经理(SAFETY MANAGER)、合规监督责任人等关键岗位, 并记录任命文件编号。</li>
                  <li><Text strong>事件报告</Text>: 登记强制/自愿事件报告。强制性事件报告有72小时法定上报时限(ORA.GEN.160), 超时未上报会自动生成提醒(见"通知"说明)。</li>
                  <li><Text strong>风险管理</Text>: 危险源登记 → 风险评估(概率×严重度矩阵) → 缓解措施, 是 SMS 的核心闭环。</li>
                  <li><Text strong>安全政策</Text>: 版本化管理, 新版本生效后须由负责人(Accountable Manager)重新签署。</li>
                  <li><Text strong>变更管理(MOC)</Text>: 重大变更须先完成风险评估才能进入实施阶段, 实施后须验证效果, 状态机为 草案→已评估风险→已实施→已验证。</li>
                  <li><Text strong>应急响应计划(ERP)</Text>: 版本化预案与年度应急演练记录。</li>
                  <li><Text strong>安全绩效指标(SPI/SPT)</Text>: 设定可量化的安全指标和目标值, 定期录入采集值。</li>
                  <li><Text strong>安全评审委员会(SRB)</Text>: 适用于"复杂机构", 记录会议纪要与行动项跟踪。</li>
                  <li><Text strong>承包活动管理</Text>: 登记外包/承包的运行活动(ORA.GEN.205), 标注是否纳入内部审计范围。</li>
                  <li><Text strong>合规监督</Text>: 审计计划 → 审计任务 → 发现项 → 纠正措施的闭环跟踪(ORA.GEN.200)。</li>
                </ul>
              </Paragraph>
            ),
          },
          {
            key: 'fstds',
            label: '模拟机(FSTD)',
            children: (
              <Paragraph>
                模拟机/训练器合规性管理, 覆盖面最广的模块, 包含:
                <ul style={{ paddingLeft: 20 }}>
                  <li>设备基本信息、周期性评估(资质续期)、FCS能力矩阵与训练矩阵(哪些科目可以在该设备上训练)</li>
                  <li>缺陷报告与纠正(3.3.7), 以及"故障保留分级"——对暂不影响安全运行的 MMI 缺陷可设置保留分级, 解除对相关训练科目排课的阻断</li>
                  <li>常规维护(PM)排程: 配置检查单模板、登记维护任务、双人复核(执行人不能审核自己登记的任务)</li>
                  <li>QTG/MQTG 文档版本管理与季度滚动运行记录(3.3.4)</li>
                  <li>ESL装备规格清单、年度安全设施检查(3.3.8)、逐月性能指标登记</li>
                </ul>
                模拟机的排课会自动校验：设备是否具备该训练科目的资质、是否存在未解除的 MMI 缺陷。
              </Paragraph>
            ),
          },
          {
            key: 'inventory',
            label: '备件/工具管理',
            children: (
              <Paragraph>
                备件与工具的全生命周期管理, 页面内按标签页分为 11 个子模块: 备件库存、工具校准、采购订单、故障件管理、报废管理、备件需求、备件盘点、仓库管理(支持多仓库/寄售仓库)、借用管理、备件检测、备件信息配置(自定义备件类型字典)。
                所有影响库存数量的操作(入库/出库/报废/盘点调整/借出归还)都会生成库存流水记录, 可追溯。报废与盘点差异调整都需要指定审批人。
              </Paragraph>
            ),
          },
          {
            key: 'personnel',
            label: '人员资质',
            children: (
              <Paragraph>
                人员档案、资质记录(到期提醒)、教员档案(FI/TRI/SFI/理论教员/考试员)管理。人员档案是"组织角色任命""PM任务执行人/审核人"等其他模块的基础数据, 建议优先录入。
              </Paragraph>
            ),
          },
          {
            key: 'courses',
            label: '课程管理',
            children: (
              <Paragraph>
                课程与培训大纲管理, 包含课程科目要求(requirements)登记。课程须经审批(isApproved)后才能在学员训练记录中正式使用。
              </Paragraph>
            ),
          },
          {
            key: 'students',
            label: '学员记录',
            children: (
              <Paragraph>
                学员档案、课程报名、训练记录登记。训练记录可与课程科目要求关联, 用于跟踪学员的完成进度。
              </Paragraph>
            ),
          },
          {
            key: 'bookings',
            label: '排班预订',
            children: (
              <Paragraph>
                模拟机/教室等资源的预约排课。创建预约时系统会自动校验资源是否具备对应训练科目的资质、是否存在未解除的 MMI 缺陷, 不满足条件会被拒绝。
              </Paragraph>
            ),
          },
          {
            key: 'kiosk',
            label: '缺陷报告 Kiosk',
            children: (
              <Paragraph>
                面向任何在场人员开放的简化缺陷报告入口(不受模块权限限制, 适合放在设备旁的公共终端上), 用于快速登记模拟机缺陷, 数据会同步到"模拟机"模块的缺陷列表里。
              </Paragraph>
            ),
          },
          {
            key: 'isms',
            label: '信息安全 ISMS',
            children: (
              <Paragraph>
                信息资产登记、信息安全风险评估(可能性×影响矩阵)与缓解措施、信息安全事件的登记/遏制/解决流程, 与"管理体系"模块里的安全风险管理是独立的两套流程(一个针对运行安全, 一个针对信息安全)。
              </Paragraph>
            ),
          },
          {
            key: 'notifications',
            label: '通知(顶部铃铛图标)',
            children: (
              <Paragraph>
                系统会定时(默认每小时)扫描是否有强制事件报告已超过72小时法定时限仍未上报, 并通知该机构任命的安全经理。未读通知会在右上角铃铛图标上显示数字角标, 点击铃铛可查看最近的通知列表, 点击某条通知即标记为已读。OWNER/ADMIN 账户额外可以点击"立即检查到期提醒"手动触发一次扫描, 不必等下一次整点。
                <br />
                <Text type="secondary">注: 目前这一提醒机制只接入了"事件报告超时"这一个场景, 后续可以用同样的模式扩展到 PM任务、ERP演练、资质到期等其他场景。</Text>
              </Paragraph>
            ),
          },
          {
            key: 'users',
            label: '用户与权限 (仅 OWNER/ADMIN 可见)',
            children: (
              <Paragraph>
                管理本租户下的登录账户。OWNER 账户在注册时自动生成, 拥有全部模块权限且不可被修改/停用; ADMIN 与 STAFF 账户由 OWNER/ADMIN 创建, 其中只有 OWNER 能创建/修改 ADMIN 账户。STAFF 账户的模块访问权限需要逐项勾选。此处也可以重置其他账户的密码、停用账户。
              </Paragraph>
            ),
          },
          {
            key: 'audit-logs',
            label: '审计轨迹 (仅 OWNER/ADMIN 可见)',
            children: (
              <Paragraph>
                全系统统一的审计日志(ORA.GEN.220), 记录所有创建/更新/状态变更类操作的操作人、操作时间、变更前后的数据快照, 可按实体类型/ID筛选, 用于合规追溯"谁在何时改了什么"。密码等敏感信息不会出现在审计日志里。
              </Paragraph>
            ),
          },
        ]}
      />

      <Title level={4} style={{ marginTop: 32 }}>
        常见问题
      </Title>
      <Collapse
        items={[
          {
            key: 'faq-menu-missing',
            label: '为什么左侧菜单里少了某个模块?',
            children: <Paragraph>菜单项按账户权限动态显示。请让机构的 OWNER/ADMIN 账户去「用户与权限」里为你补充对应模块的访问权限。</Paragraph>,
          },
          {
            key: 'faq-booking-blocked',
            label: '为什么排班预订时系统提示被阻止?',
            children: (
              <Paragraph>
                常见原因: 所选模拟机没有该训练科目的资质(未在训练矩阵里登记), 或该设备存在未解除的 MMI 缺陷且没有设置"故障保留分级"。可以去"模拟机"模块检查对应设备的资质和缺陷状态。
              </Paragraph>
            ),
          },
          {
            key: 'faq-notification-not-received',
            label: '为什么该收到通知的人没有收到?',
            children: (
              <Paragraph>
                站内通知需要该人员的登录账户与其人员档案(Personnel)存在关联; 短信通知需要该人员档案填写了手机号, 且系统管理员在部署时配置了真实的短信服务商。如果都没配置, 系统默认只会把通知内容记录在服务器日志里, 不会真正送达。
              </Paragraph>
            ),
          },
        ]}
      />
    </div>
  )
}
