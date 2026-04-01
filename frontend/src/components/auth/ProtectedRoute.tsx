import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';
import { useAccountContext } from '../../contexts/AccountContext';

export default function ProtectedRoute({
  children,
  allowIncompleteOnboarding = false,
}: {
  children: ReactNode;
  allowIncompleteOnboarding?: boolean;
}) {
  const location = useLocation();
  const { isClerkEnabled, isSignedIn, isLoading: authLoading } = useAuthContext();
  const { me, isLoading: accountLoading } = useAccountContext();

  if (authLoading || accountLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-teal-50/30 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (isClerkEnabled && !isSignedIn) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (!me) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (!allowIncompleteOnboarding && me.needs_onboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (allowIncompleteOnboarding && !me.needs_onboarding) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}
