import { Link } from 'react-router-dom';
import { SignUp } from '@clerk/react';
import { useAuthContext } from '../contexts/AuthContext';

export default function SignUpPage() {
  const { isClerkEnabled } = useAuthContext();

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-teal-50/30 flex items-center justify-center p-4">
      {isClerkEnabled ? (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="font-display text-3xl font-semibold text-stone-800 mb-2">
              Invoice<span className="text-teal-600">Maker</span>
            </h1>
            <p className="text-stone-600">Create your account</p>
          </div>
          <div className="bg-white rounded-2xl shadow-soft border border-stone-200 p-3">
            <SignUp
              path="/sign-up"
              routing="path"
              forceRedirectUrl="/onboarding"
              signInUrl="/sign-in"
              appearance={{
                elements: {
                  card: 'shadow-none border-0 bg-transparent',
                  rootBox: 'w-full',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  socialButtonsBlockButton:
                    'border-stone-300 hover:bg-stone-50 text-stone-700 shadow-none',
                  formButtonPrimary: 'bg-teal-600 hover:bg-teal-700 shadow-none',
                  footerActionLink: 'text-teal-700 hover:text-teal-800',
                  formFieldInput:
                    'border-stone-300 focus:border-teal-500 focus:ring-teal-500 rounded-xl',
                  formFieldLabel: 'text-stone-700',
                },
              }}
            />
          </div>
        </div>
      ) : (
        <div className="max-w-md w-full bg-white rounded-2xl shadow-soft p-8 text-center">
          <h1 className="font-display text-2xl font-semibold text-stone-800 mb-3">InvoiceMaker</h1>
          <p className="text-stone-600 mb-4">
            Clerk is not configured locally, so auth is bypassed in development mode.
          </p>
          <Link
            to="/chat"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            Continue to App
          </Link>
        </div>
      )}
    </div>
  );
}
