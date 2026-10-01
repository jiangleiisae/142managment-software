import { Alert, Collapse, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

const { Title, Paragraph, Text } = Typography

/// 静态帮助页, 不调用任何接口。菜单项对所有登录账户开放 (不受模块权限限制), 与 Kiosk 页一致。
export function HelpPage() {
  const { t } = useTranslation()

  return (
    <div style={{ maxWidth: 900 }}>
      <Title level={3}>{t('help.title')}</Title>
      <Paragraph type="secondary">{t('help.intro')}</Paragraph>

      <Title level={4}>{t('help.quickStartTitle')}</Title>
      <Paragraph>
        <ol style={{ paddingLeft: 20 }}>
          <li>{t('help.quickStart1')}</li>
          <li>{t('help.quickStart2')}</li>
          <li>{t('help.quickStart3')}</li>
        </ol>
      </Paragraph>

      <Alert
        style={{ marginBottom: 24 }}
        type="info"
        showIcon
        message={t('help.permissionsAlertTitle')}
        description={t('help.permissionsAlertDesc')}
      />

      <Title level={4}>{t('help.modulesTitle')}</Title>
      <Collapse
        items={[
          {
            key: 'organizations',
            label: t('help.modules.organizations.label'),
            children: <Paragraph>{t('help.modules.organizations.body')}</Paragraph>,
          },
          {
            key: 'management-system',
            label: t('help.modules.managementSystem.label'),
            children: (
              <Paragraph>
                {t('help.modules.managementSystem.intro')}
                <ul style={{ paddingLeft: 20 }}>
                  <li><Text strong>{t('help.modules.managementSystem.orgRolesLabel')}</Text>: {t('help.modules.managementSystem.orgRolesDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.occurrenceLabel')}</Text>: {t('help.modules.managementSystem.occurrenceDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.riskLabel')}</Text>: {t('help.modules.managementSystem.riskDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.policyLabel')}</Text>: {t('help.modules.managementSystem.policyDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.mocLabel')}</Text>: {t('help.modules.managementSystem.mocDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.erpLabel')}</Text>: {t('help.modules.managementSystem.erpDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.spiLabel')}</Text>: {t('help.modules.managementSystem.spiDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.srbLabel')}</Text>: {t('help.modules.managementSystem.srbDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.contractedLabel')}</Text>: {t('help.modules.managementSystem.contractedDesc')}</li>
                  <li><Text strong>{t('help.modules.managementSystem.complianceLabel')}</Text>: {t('help.modules.managementSystem.complianceDesc')}</li>
                </ul>
              </Paragraph>
            ),
          },
          {
            key: 'fstds',
            label: t('help.modules.fstds.label'),
            children: (
              <Paragraph>
                {t('help.modules.fstds.intro')}
                <ul style={{ paddingLeft: 20 }}>
                  <li>{t('help.modules.fstds.item1')}</li>
                  <li>{t('help.modules.fstds.item2')}</li>
                  <li>{t('help.modules.fstds.item3')}</li>
                  <li>{t('help.modules.fstds.item4')}</li>
                  <li>{t('help.modules.fstds.item5')}</li>
                </ul>
                {t('help.modules.fstds.outro')}
              </Paragraph>
            ),
          },
          {
            key: 'inventory',
            label: t('help.modules.inventory.label'),
            children: <Paragraph>{t('help.modules.inventory.body')}</Paragraph>,
          },
          {
            key: 'personnel',
            label: t('help.modules.personnel.label'),
            children: <Paragraph>{t('help.modules.personnel.body')}</Paragraph>,
          },
          {
            key: 'courses',
            label: t('help.modules.courses.label'),
            children: <Paragraph>{t('help.modules.courses.body')}</Paragraph>,
          },
          {
            key: 'students',
            label: t('help.modules.students.label'),
            children: <Paragraph>{t('help.modules.students.body')}</Paragraph>,
          },
          {
            key: 'bookings',
            label: t('help.modules.bookings.label'),
            children: <Paragraph>{t('help.modules.bookings.body')}</Paragraph>,
          },
          {
            key: 'kiosk',
            label: t('help.modules.kiosk.label'),
            children: <Paragraph>{t('help.modules.kiosk.body')}</Paragraph>,
          },
          {
            key: 'isms',
            label: t('help.modules.isms.label'),
            children: <Paragraph>{t('help.modules.isms.body')}</Paragraph>,
          },
          {
            key: 'notifications',
            label: t('help.modules.notifications.label'),
            children: (
              <Paragraph>
                {t('help.modules.notifications.body')}
                <br />
                <Text type="secondary">{t('help.modules.notifications.note')}</Text>
              </Paragraph>
            ),
          },
          {
            key: 'users',
            label: t('help.modules.users.label'),
            children: <Paragraph>{t('help.modules.users.body')}</Paragraph>,
          },
          {
            key: 'audit-logs',
            label: t('help.modules.auditLogs.label'),
            children: <Paragraph>{t('help.modules.auditLogs.body')}</Paragraph>,
          },
        ]}
      />

      <Title level={4} style={{ marginTop: 32 }}>
        {t('help.faqTitle')}
      </Title>
      <Collapse
        items={[
          {
            key: 'faq-menu-missing',
            label: t('help.faq.menuMissing.label'),
            children: <Paragraph>{t('help.faq.menuMissing.body')}</Paragraph>,
          },
          {
            key: 'faq-booking-blocked',
            label: t('help.faq.bookingBlocked.label'),
            children: <Paragraph>{t('help.faq.bookingBlocked.body')}</Paragraph>,
          },
          {
            key: 'faq-notification-not-received',
            label: t('help.faq.notificationNotReceived.label'),
            children: <Paragraph>{t('help.faq.notificationNotReceived.body')}</Paragraph>,
          },
        ]}
      />
    </div>
  )
}
