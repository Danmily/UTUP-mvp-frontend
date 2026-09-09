import { createRoot } from 'react-dom/client'
import { ConfigProvider } from '@ecom/aurora'
import App from './App.jsx'
import './mvp.css'

createRoot(document.getElementById('root')).render(
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: '#3370FF',
        colorSuccess: '#00B42A',
        colorWarning: '#FF7D00',
        colorError: '#F53F3F',
        borderRadius: 6,
      },
    }}
  >
    <App />
  </ConfigProvider>,
)
