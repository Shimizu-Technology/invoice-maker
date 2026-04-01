import { UserButton } from '@clerk/react';
import { useAuthContext } from '../../contexts/AuthContext';

export default function AuthUserControl() {
  const { isClerkEnabled } = useAuthContext();

  if (!isClerkEnabled) return null;

  return (
    <div className="flex items-center">
      <UserButton />
    </div>
  );
}
