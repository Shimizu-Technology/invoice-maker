import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { accountApi } from '../services/api';
import { useAuthContext } from './AuthContext';
import type { BusinessProfile, MeResponse } from '../types';

interface AccountContextType {
  me: MeResponse | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setBusinessProfile: (profile: BusinessProfile) => void;
}

const AccountContext = createContext<AccountContextType>({
  me: null,
  isLoading: true,
  error: null,
  refresh: async () => {},
  setBusinessProfile: () => {},
});

// eslint-disable-next-line react-refresh/only-export-components
export function useAccountContext() {
  return useContext(AccountContext);
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { isLoading: authLoading, isSignedIn } = useAuthContext();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const data = await accountApi.me();
      setMe(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account');
      setMe(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isSignedIn) {
      setMe(null);
      setIsLoading(false);
      return;
    }
    void refresh();
  }, [authLoading, isSignedIn]);

  const value = useMemo(
    () => ({
      me,
      isLoading: authLoading || isLoading,
      error,
      refresh,
      setBusinessProfile: (profile: BusinessProfile) => {
        setMe((prev) =>
          prev
            ? {
                ...prev,
                business_profile: profile,
                needs_onboarding: false,
                workspace: {
                  ...prev.workspace,
                  name: profile.company_name,
                  onboarding_completed: true,
                },
              }
            : prev
        );
      },
    }),
    [authLoading, isLoading, error, me]
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
