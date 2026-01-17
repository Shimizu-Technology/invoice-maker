/**
 * Dashboard page with Chat and Manual tabs.
 * Mobile-first design with responsive layouts and touch-friendly UI.
 * Tab state is managed via URL routes for proper browser history support.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import InvoiceForm from '../components/InvoiceForm';

type Tab = 'chat' | 'manual';

// Determine active tab from current URL path
function getTabFromPath(pathname: string): Tab {
  if (pathname.startsWith('/chat')) return 'chat';
  if (pathname === '/manual') return 'manual';
  return 'chat'; // Default to chat
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams<{ sessionId?: string }>();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Derive active tab from URL
  const activeTab = getTabFromPath(location.pathname);

  // Navigate to tab route
  const handleTabChange = (tab: Tab) => {
    switch (tab) {
      case 'chat':
        navigate('/chat');
        break;
      case 'manual':
        navigate('/manual');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-teal-50/30">
      {/* Header - Glassmorphism style */}
      <header className="sticky top-0 z-50 glass border-b border-stone-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link 
              to="/chat" 
              className="flex items-center gap-2 group"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:shadow-teal-500/30 transition-shadow">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-display text-lg sm:text-xl font-semibold text-stone-800 group-hover:text-teal-700 transition-colors">
                Invoice<span className="text-teal-600">Maker</span>
              </span>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden sm:flex items-center gap-2">
              <Link
                to="/clients"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Clients
              </Link>
              <Link
                to="/history"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <nav className="sm:hidden mt-3 pb-1 pt-3 border-t border-stone-200 animate-fadeIn space-y-1">
              <Link
                to="/clients"
                className="flex items-center gap-3 text-stone-600 hover:text-stone-900 px-3 py-3 rounded-lg text-base font-medium min-h-[44px] hover:bg-stone-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Clients
              </Link>
              <Link
                to="/history"
                className="flex items-center gap-3 text-stone-600 hover:text-stone-900 px-3 py-3 rounded-lg text-base font-medium min-h-[44px] hover:bg-stone-100 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Invoice History
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        {/* Tab Navigation - Pills style */}
        <div className="flex gap-1 p-1 bg-stone-200/60 backdrop-blur-sm rounded-xl mb-4 sm:mb-6 max-w-xs">
          <button
            onClick={() => handleTabChange('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              activeTab === 'chat'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Chat</span>
          </button>
          <button
            onClick={() => handleTabChange('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
              activeTab === 'manual'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Manual</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="relative">
          {activeTab === 'chat' && (
            <div className="h-[calc(100vh-160px)] sm:h-[calc(100vh-180px)] animate-fadeIn">
              <ChatInterface sessionIdFromUrl={sessionId} />
            </div>
          )}
          {activeTab === 'manual' && (
            <div className="animate-fadeIn">
              <InvoiceForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
