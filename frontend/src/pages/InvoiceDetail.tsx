/**
 * Invoice detail page.
 * Mobile-optimized with responsive layouts and touch-friendly UI.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoicesApi, clientsApi } from '../services/api';
import type { Invoice, Client } from '../types';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadInvoice(id);
    }
  }, [id]);

  const loadInvoice = async (invoiceId: string) => {
    try {
      const invoiceData = await invoicesApi.get(invoiceId);
      setInvoice(invoiceData);

      const clientData = await clientsApi.get(invoiceData.client_id);
      setClient(clientData);
    } catch (err) {
      setError('Failed to load invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (invoice) {
      window.open(invoicesApi.getPdfUrl(invoice.id), '_blank');
    }
  };

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Invoice not found'}</p>
          <button
            onClick={() => navigate('/history')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg min-h-[44px]"
          >
            Back to History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <button
                onClick={() => navigate(-1)}
                className="text-gray-600 hover:text-gray-900 min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
                aria-label="Go back"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                  {invoice.invoice_number}
                </h1>
              </div>
              <span
                className={`hidden sm:inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${getStatusBadgeClass(
                  invoice.status
                )}`}
              >
                {invoice.status}
              </span>
            </div>
            
            {/* Desktop Download Button */}
            <button
              onClick={handleDownloadPdf}
              className="hidden sm:flex px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors items-center min-h-[44px]"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>

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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
          </div>

          {/* Mobile Actions Menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-4 pb-2 border-t border-gray-200 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(
                    invoice.status
                  )}`}
                >
                  {invoice.status}
                </span>
              </div>
              <button
                onClick={handleDownloadPdf}
                className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors min-h-[44px]"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Invoice Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">
                  Bill To
                </h3>
                <p className="text-lg font-semibold text-gray-900">
                  {client?.name}
                </p>
                {client?.address && (
                  <p className="text-gray-600 whitespace-pre-line text-sm">
                    {client.address}
                  </p>
                )}
                {client?.email && (
                  <p className="text-gray-600 text-sm">{client.email}</p>
                )}
              </div>
              <div className="sm:text-right">
                <div className="mb-2">
                  <span className="text-sm text-gray-500">Invoice Date: </span>
                  <span className="text-gray-900">
                    {formatDate(invoice.date)}
                  </span>
                </div>
                {invoice.service_period_start && invoice.service_period_end && (
                  <div>
                    <span className="text-sm text-gray-500">
                      Service Period:{' '}
                    </span>
                    <span className="text-gray-900">
                      {formatShortDate(invoice.service_period_start)} -{' '}
                      {formatShortDate(invoice.service_period_end)}
                    </span>
                  </div>
                )}
                {/* Mobile Status Badge */}
                <div className="sm:hidden mt-3">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(
                      invoice.status
                    )}`}
                  >
                    {invoice.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Hours Entries */}
          {invoice.hours_entries.length > 0 && (
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-4">
                Hours Worked
              </h3>
              
              {/* Desktop Table */}
              <table className="hidden sm:table min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">
                      Date
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">
                      Hours
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">
                      Rate
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.hours_entries.map((entry) => {
                    const hours = parseFloat(entry.hours);
                    const rate = parseFloat(entry.rate);
                    const amount = hours * rate;
                    return (
                      <tr key={entry.id} className="border-b border-gray-100">
                        <td className="py-2 text-gray-900">
                          {formatDate(entry.date)}
                        </td>
                        <td className="py-2 text-right text-gray-900">
                          {hours}
                        </td>
                        <td className="py-2 text-right text-gray-900">
                          {formatCurrency(rate)}
                        </td>
                        <td className="py-2 text-right text-gray-900 font-medium">
                          {formatCurrency(amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {invoice.hours_entries.map((entry) => {
                  const hours = parseFloat(entry.hours);
                  const rate = parseFloat(entry.rate);
                  const amount = hours * rate;
                  return (
                    <div key={entry.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-gray-900 font-medium">
                          {formatShortDate(entry.date)}
                        </span>
                        <span className="text-gray-900 font-bold">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {hours} hrs × {formatCurrency(rate)}/hr
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Line Items */}
          {invoice.line_items.length > 0 && (
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-4">
                Line Items
              </h3>
              
              {/* Desktop Table */}
              <table className="hidden sm:table min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">
                      Description
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">
                      Qty
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">
                      Rate
                    </th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.line_items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{item.description}</td>
                      <td className="py-2 text-right text-gray-900">
                        {item.quantity}
                      </td>
                      <td className="py-2 text-right text-gray-900">
                        {formatCurrency(item.rate)}
                      </td>
                      <td className="py-2 text-right text-gray-900 font-medium">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3">
                {invoice.line_items.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-gray-900 font-medium flex-1 mr-2">
                        {item.description}
                      </span>
                      <span className="text-gray-900 font-bold">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.quantity} × {formatCurrency(item.rate)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="p-4 sm:p-6 bg-gray-50">
            <div className="flex justify-between sm:justify-end">
              <div className="w-full sm:w-64">
                <div className="flex justify-between py-2 text-lg sm:text-xl font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="p-4 sm:p-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
              <p className="text-gray-700 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Mobile Floating Download Button */}
        <div className="sm:hidden fixed bottom-4 left-4 right-4">
          <button
            onClick={handleDownloadPdf}
            className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg shadow-lg hover:bg-primary-700 transition-colors min-h-[48px]"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        </div>

        {/* Spacer for mobile floating button */}
        <div className="sm:hidden h-20"></div>
      </main>
    </div>
  );
}
