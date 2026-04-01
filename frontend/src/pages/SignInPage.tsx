import { Link } from 'react-router-dom';
import { SignIn } from '@clerk/react';
import { useAuthContext } from '../contexts/AuthContext';

export default function SignInPage() {
  const { isClerkEnabled } = useAuthContext();

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-teal-50/30 flex items-center justify-center p-4">
      {isClerkEnabled ? (
        <SignIn forceRedirectUrl="/chat" signUpUrl="/sign-up" />
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
