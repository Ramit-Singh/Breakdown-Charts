import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise'
import './index.css'
import App from './App'

AgChartsEnterpriseModule.setup()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
