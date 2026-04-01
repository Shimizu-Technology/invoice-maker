import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { AccountProvider } from './contexts/AccountContext'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isClerkEnabled = Boolean(
  PUBLISHABLE_KEY && PUBLISHABLE_KEY !== 'YOUR_PUBLISHABLE_KEY'
)

// eslint-disable-next-line react-refresh/only-export-components
function Root() {
  const app = (
    <AuthProvider isClerkEnabled={isClerkEnabled}>
      <AccountProvider>
        <App />
      </AccountProvider>
    </AuthProvider>
  )

  if (isClerkEnabled) {
    return (
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignOutUrl="/sign-in"
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        signInFallbackRedirectUrl="/chat"
        signUpFallbackRedirectUrl="/onboarding"
      >
        {app}
      </ClerkProvider>
    )
  }

  return app
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
