import { App as AntdApp, ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import './i18n'
import './index.css'

// antd的 message/Modal/notification 静态方法(message.success()等, 全站曾有119处调用)脱离React渲染树,
// 在当前 React 19 环境下完全不渲染任何提示(已用DOM MutationObserver实测确认, 见对应git提交记录)。
// <AntdApp> 本身不足以解决这个问题 - 光包一层不够, 必须配合各组件内 const { message } = App.useApp()
// 才能让这些调用重新挂载到正确的React根上, 这个包裹是那个hook能生效的前提条件。
function Root() {
  const { i18n } = useTranslation()
  const antdLocale = i18n.language === 'en' ? enUS : zhCN

  return (
    <ConfigProvider locale={antdLocale}>
      <AntdApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
