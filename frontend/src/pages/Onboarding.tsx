import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountApi } from '../services/api';
import { useAccountContext } from '../contexts/AccountContext';
import AuthUserControl from '../components/auth/AuthUserControl';

export default function Onboarding() {
  const navigate = useNavigate();
  const { me, setBusinessProfile } = useAccountContext();
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    setCompanyName(me.business_profile?.company_name || '');
    setCompanyEmail(me.business_profile?.company_email || me.user.email || '');
    setCompanyAddress(me.business_profile?.company_address || '');
    setCompanyPhone(me.business_profile?.company_phone || '');
  }, [me]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const profile = await accountApi.updateBusinessProfile({
        company_name: companyName,
        company_email: companyEmail || null,
        company_address: companyAddress || null,
        company_phone: companyPhone || null,
      });
      setBusinessProfile(profile);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save business profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-teal-50/30">
      <header className="sticky top-0 z-50 glass border-b border-stone-200/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-semibold text-stone-800">Set Up Your Workspace</h1>
            <p className="text-sm text-stone-500">Tell InvoiceMaker what should appear on your invoices.</p>
          </div>
          <AuthUserControl />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-soft border border-stone-200 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Company Name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Your business name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Company Email</label>
              <input
                type="email"
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="billing@yourcompany.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Company Address</label>
              <textarea
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="123 Main St, City, State ZIP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Company Phone</label>
              <input
                value={companyPhone}
                onChange={(e) => setCompanyPhone(e.target.value)}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="(555) 555-5555"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors font-medium"
              >
                {isSaving ? 'Saving...' : 'Save and Continue'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
