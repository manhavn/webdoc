import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ContentProvider } from './lib/ContentContext'
import { ThemeProvider } from './theme/ThemeContext'
import { I18nProvider } from './i18n/I18nContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <ContentProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </ContentProvider>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
)
