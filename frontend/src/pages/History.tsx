/**
 * Invoice history page with filters.
 * Mobile-optimized with responsive table and touch-friendly UI.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { invoicesApi, clientsApi } from '../services/api';
import type { Invoice, Client, InvoiceStatus } from '../types';

export default function History() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(!!searchParams.get('client'));
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);

  // Filters - initialize from URL params
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [startDate, setStartDate] = useState(searchParams.get('start') || '');
  const [endDate, setEndDate] = useState(searchParams.get('end') || '');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setStatusMenuOpen(null);
    if (statusMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [statusMenuOpen]);

  useEffect(() => {
    loadInvoices();
  }, [clientFilter, statusFilter, startDate, endDate, showArchived]);

  const loadData = async () => {
    try {
      const [invoicesData, clientsData] = await Promise.all([
        invoicesApi.list({ include_archived: showArchived }),
        clientsApi.list(),
      ]);
      setInvoices(invoicesData);
      setClients(clientsData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const params: Record<string, string | boolean> = {};
      if (clientFilter) params.client_id = clientFilter;
      if (statusFilter) params.status = statusFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (showArchived) params.include_archived = true;

      const data = await invoicesApi.list(params);
      setInvoices(data);
    } catch (err) {
      setError('Failed to load invoices');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      await invoicesApi.delete(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      setError('Failed to delete invoice');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await invoicesApi.archive(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      setError('Failed to archive invoice');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await invoicesApi.restore(id);
      // Remove from list if not showing archived
      if (!showArchived) {
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      } else {
        // Update archived status in list
        setInvoices((prev) => prev.map((inv) => 
          inv.id === id ? { ...inv, archived: false } : inv
        ));
      }
    } catch (err) {
      setError('Failed to restore invoice');
    }
  };

  const handleDuplicate = (invoice: Invoice) => {
    // Navigate to dashboard with invoice data in state for pre-filling
    navigate('/', { 
      state: { 
        duplicateInvoice: {
          client_id: invoice.client_id,
          hours_entries: invoice.hours_entries,
          line_items: invoice.line_items,
          notes: invoice.notes,
        }
      } 
    });
  };

  const handleDownloadPdf = (id: string) => {
    window.open(invoicesApi.getPdfUrl(id), '_blank');
  };

  const getClientName = (clientId: string): string => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Unknown';
  };

  // Get filtered client name for header display
  const filteredClientName = clientFilter 
    ? clients.find((c) => c.id === clientFilter)?.name 
    : null;

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'generated':
        return 'bg-blue-100 text-blue-800';
      case 'sent':
        return 'bg-yellow-100 text-yellow-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      await invoicesApi.update(invoiceId, { status: newStatus });
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, status: newStatus } : inv
        )
      );
      setStatusMenuOpen(null);
    } catch (err) {
      setError('Failed to update status');
    }
  };

  const statusOptions: { value: InvoiceStatus; label: string; color: string }[] = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    { value: 'generated', label: 'Generated', color: 'bg-blue-100 text-blue-800' },
    { value: 'sent', label: 'Sent', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
  ];

  const clearFilters = () => {
    setClientFilter('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setSearchParams({});
  };

  const hasActiveFilters = clientFilter || statusFilter || startDate || endDate;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {filteredClientName ? `${filteredClientName} - Invoices` : 'Invoice History'}
              </h1>
              {filteredClientName && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-teal-600 hover:text-teal-800 mt-1"
                >
                  ← View all invoices
                </button>
              )}
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden sm:flex space-x-4">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <nav className="sm:hidden mt-4 pb-2 border-t border-gray-200 pt-4">
              <Link
                to="/"
                className="block text-gray-600 hover:text-gray-900 px-3 py-3 rounded-md text-base font-medium min-h-[44px] flex items-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-800 font-semibold"
            >
              ×
            </button>
          </div>
        )}

        {/* Filters - Collapsible on Mobile */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 mb-4 sm:mb-6">
          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden w-full flex items-center justify-between py-2 min-h-[44px]"
          >
            <span className="font-medium text-stone-700">
              Filters {hasActiveFilters && <span className="text-teal-600 ml-1">●</span>}
            </span>
            <svg
              className={`h-5 w-5 text-stone-400 transform transition-transform ${showFilters ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Filter Fields - Always visible on desktop, toggleable on mobile */}
          <div className={`${showFilters ? 'block' : 'hidden'} sm:block mt-4 sm:mt-0`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="generated">Generated</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                />
              </div>
            </div>
            
            {/* Show Archived toggle */}
            <div className="mt-4 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <span className="text-sm text-gray-600">Show archived invoices</span>
              </label>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-primary-600 hover:text-primary-800 min-h-[44px] px-2"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Table - Desktop */}
        <div className="hidden md:block bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/invoices/${invoice.id}`}
                        className="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {getClientName(invoice.client_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {formatDate(invoice.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusMenuOpen(statusMenuOpen === invoice.id ? null : invoice.id);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 transition-all ${getStatusBadgeClass(
                          invoice.status
                        )}`}
                      >
                        {invoice.status}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {/* Status Dropdown */}
                      {statusMenuOpen === invoice.id && (
                        <div 
                          className="absolute z-10 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {statusOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleStatusChange(invoice.id, opt.value)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                invoice.status === opt.value ? 'bg-gray-50' : ''
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`}></span>
                              {opt.label}
                              {invoice.status === opt.value && (
                                <svg className="w-4 h-4 ml-auto text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                        className="text-primary-600 hover:text-primary-800 mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(invoice.id)}
                        className="text-green-600 hover:text-green-800 mr-3"
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => handleDuplicate(invoice)}
                        className="text-teal-600 hover:text-teal-800 mr-3"
                      >
                        Duplicate
                      </button>
                      {invoice.archived ? (
                        <button
                          onClick={() => handleRestore(invoice.id)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => handleArchive(invoice.id)}
                          className="text-stone-500 hover:text-stone-700 mr-3"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Invoice Cards - Mobile */}
        <div className="md:hidden space-y-3">
          {invoices.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 text-center text-stone-500">
              No invoices found
            </div>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link
                      to={`/invoices/${invoice.id}`}
                      className="text-teal-600 hover:text-teal-800 font-bold text-base"
                    >
                      {invoice.invoice_number}
                    </Link>
                    <p className="text-stone-600 text-sm mt-0.5">
                      {getClientName(invoice.client_id)}
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusMenuOpen(statusMenuOpen === invoice.id ? null : invoice.id);
                      }}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(
                        invoice.status
                      )}`}
                    >
                      {invoice.status}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {/* Mobile Status Dropdown */}
                    {statusMenuOpen === invoice.id && (
                      <div 
                        className="absolute right-0 z-10 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statusOptions.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => handleStatusChange(invoice.id, opt.value)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                              invoice.status === opt.value ? 'bg-gray-50' : ''
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`}></span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-stone-500 text-sm">{formatDate(invoice.date)}</span>
                  <span className="text-stone-900 font-bold text-lg">
                    {formatCurrency(invoice.total_amount)}
                  </span>
                </div>

                {/* Mobile Action Buttons - 5 columns to fit all buttons on one row */}
                <div className="grid grid-cols-5 gap-2 pt-3 border-t border-stone-100">
                  <button
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className="flex flex-col items-center py-2 text-primary-600 hover:bg-primary-50 rounded min-h-[44px]"
                  >
                    <svg className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-xs">View</span>
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(invoice.id)}
                    className="flex flex-col items-center py-2 text-green-600 hover:bg-green-50 rounded min-h-[44px]"
                  >
                    <svg className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs">PDF</span>
                  </button>
                  <button
                    onClick={() => handleDuplicate(invoice)}
                    className="flex flex-col items-center py-2 text-teal-600 hover:bg-teal-50 rounded min-h-[44px]"
                  >
                    <svg className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">Copy</span>
                  </button>
                  {invoice.archived ? (
                    <button
                      onClick={() => handleRestore(invoice.id)}
                      className="flex flex-col items-center py-2 text-blue-600 hover:bg-blue-50 rounded min-h-[44px]"
                    >
                      <svg className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="text-xs">Restore</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleArchive(invoice.id)}
                      className="flex flex-col items-center py-2 text-stone-500 hover:bg-stone-50 rounded min-h-[44px]"
                    >
                      <svg className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span className="text-xs">Archive</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="flex flex-col items-center py-2 text-red-600 hover:bg-red-50 rounded min-h-[44px]"
                  >
                    <svg className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="text-xs">Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
