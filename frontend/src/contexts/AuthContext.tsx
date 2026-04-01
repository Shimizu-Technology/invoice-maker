import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth as useClerkAuth } from '@clerk/react';
import { setAuthTokenGetter } from '../services/api';

interface AuthContextType {
  isClerkEnabled: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isClerkEnabled: false,
  isSignedIn: false,
  isLoading: true,
});

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  return useContext(AuthContext);
}

function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useClerkAuth();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch (error) {
        console.error('Error getting auth token', error);
        return null;
      }
    });
  }, [getToken]);

  return (
    <AuthContext.Provider
      value={{
        isClerkEnabled: true,
        isSignedIn: isSignedIn ?? false,
        isLoading: !isLoaded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function NoAuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    setAuthTokenGetter(async () => null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isClerkEnabled: false,
        isSignedIn: true,
        isLoading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({
  children,
  isClerkEnabled,
}: {
  children: ReactNode;
  isClerkEnabled: boolean;
}) {
  if (isClerkEnabled) {
    return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
  }
  return <NoAuthProvider>{children}</NoAuthProvider>;
}
