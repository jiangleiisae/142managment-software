import { Alert, Button, Card, Form, Input, Select, Typography } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { setLanguage, type SupportedLanguage } from '../i18n'
import feikenLogo from '../assets/feiken-logo.png'

export function LoginPage() {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email: string; password: string }) => {
    setError(undefined)
    setLoading(true)
    try {
      await login(values.email, values.password)
      navigate('/organizations')
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err.response?.data?.message ?? t('auth.login.genericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Select<SupportedLanguage>
        size="small"
        style={{ position: 'absolute', top: 16, right: 16, width: 90 }}
        value={i18n.language === 'en' ? 'en' : 'zh'}
        onChange={setLanguage}
        options={[
          { value: 'zh', label: t('language.zh') },
          { value: 'en', label: t('language.en') },
        ]}
      />
      <Card style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <img src={feikenLogo} alt="Feiken Aviation" style={{ height: 72 }} />
        </div>
        <Typography.Title level={4} style={{ textAlign: 'center', marginTop: 0 }}>
          {t('auth.login.title')}
        </Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label={t('auth.login.email')} rules={[{ required: true, type: 'email' }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label={t('auth.login.password')} rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {t('auth.login.submit')}
          </Button>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.registerLink')}</Link>
        </div>
      </Card>
    </div>
  )
}
