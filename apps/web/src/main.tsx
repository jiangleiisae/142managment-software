import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN}>
      {/* antd的 message/Modal/notification 静态方法(message.success()等, 全站119处调用)脱离React渲染树,
          在当前 React 19 环境下完全不渲染任何提示(已实测确认)。<AntdApp> 提供的上下文能让这些静态方法
          重新挂载到正确的React根上, 不需要逐个改写成 App.useApp() hook。*/}
      <AntdApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
