import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AgChartsEnterpriseModule } from 'ag-charts-enterprise'
import './index.css'
import App from './App.jsx'

AgChartsEnterpriseModule.setup()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
