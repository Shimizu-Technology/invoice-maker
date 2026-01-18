/**
 * Clients management page.
 * CRUD operations for managing clients/contracts.
 * Mobile-optimized with responsive layouts.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clientsApi } from '../services/api';
import type { Client, TemplateType } from '../types';

interface ClientFormData {
  name: string;
  email: string;
  address: string;
  default_rate: string;
  template_type: TemplateType;
  invoice_prefix: string;
  next_invoice_number: string;
  company_context: string;
  payment_terms: string;
}

const emptyFormData: ClientFormData = {
  name: '',
  email: '',
  address: '',
  default_rate: '0',
  template_type: 'hourly',
  invoice_prefix: 'INV',
  next_invoice_number: '',
  company_context: '',
  payment_terms: '',
};

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(emptyFormData);
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setIsLoading(true);
      const data = await clientsApi.list();
      setClients(data);
      setError(null);
    } catch (err) {
      setError('Failed to load clients');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData(emptyFormData);
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      address: client.address || '',
      default_rate: client.default_rate,
      template_type: client.template_type,
      invoice_prefix: client.invoice_prefix,
      next_invoice_number: client.next_invoice_number?.toString() || '',
      company_context: client.company_context || '',
      payment_terms: client.payment_terms || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email || null,
        address: formData.address || null,
        default_rate: formData.default_rate,
        template_type: formData.template_type,
        invoice_prefix: formData.invoice_prefix,
        next_invoice_number: formData.next_invoice_number ? parseInt(formData.next_invoice_number) : null,
        company_context: formData.company_context || null,
        payment_terms: formData.payment_terms || null,
      };

      if (editingClient) {
        await clientsApi.update(editingClient.id, payload);
      } else {
        await clientsApi.create(payload);
      }

      setShowModal(false);
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
      await clientsApi.delete(clientId);
      setDeleteConfirm(null);
      await loadClients();
    } catch (err) {
      setError('Failed to delete client. It may have associated invoices.');
    }
  };

  const formatCurrency = (amount: string | number) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getTemplateLabel = (type: TemplateType) => {
    switch (type) {
      case 'hourly': return 'Hourly Contract';
      case 'project': return 'Project-Based';
      case 'tuition': return 'Tuition/Fixed';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-teal-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-stone-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link to="/chat" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-display text-lg sm:text-xl font-semibold text-stone-800">
                Invoice<span className="text-teal-600">Maker</span>
              </span>
            </Link>
            
            <nav className="flex items-center gap-2">
              <Link
                to="/clients"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-100 text-teal-700 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Clients
              </Link>
              <Link
                to="/history"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-stone-800">Clients</h1>
            <p className="text-stone-500 mt-1">Manage your clients and their billing settings</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium shadow-sm min-h-[44px]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : clients.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200">
            <svg className="w-12 h-12 mx-auto text-stone-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-stone-700 mb-2">No clients yet</h3>
            <p className="text-stone-500 mb-4">Create your first client to get started</p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Add Client
            </button>
          </div>
        ) : (
          /* Client Cards - Uniform height with visual depth */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 sm:p-6 hover:shadow-md transition-shadow flex flex-col h-full"
              >
                {/* Header - Fixed */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-stone-800 truncate">{client.name}</h3>
                    <p className="text-sm text-stone-400 truncate mt-0.5">
                      {client.email || <span className="italic">No email</span>}
                    </p>
                  </div>
                  <span className="ml-2 px-2.5 py-1 text-xs font-medium rounded-full bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
                    {getTemplateLabel(client.template_type)}
                  </span>
                </div>

                {/* Content - Grows to fill space */}
                <div className="space-y-2 text-sm flex-1">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Default Rate:</span>
                    <span className="font-medium text-stone-700">{formatCurrency(client.default_rate)}/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Invoice Prefix:</span>
                    <span className="font-medium text-stone-700">{client.invoice_prefix}</span>
                  </div>
                  <div className="pt-2 border-t border-stone-100">
                    <span className="text-stone-500">Notes:</span>
                    <p className="text-stone-600 mt-1 line-clamp-2 min-h-[2.5rem]">
                      {client.company_context || <span className="text-stone-400 italic">No notes</span>}
                    </p>
                  </div>
                </div>

                {/* Actions - Always at bottom */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
                  <Link
                    to={`/history?client=${client.id}`}
                    className="flex-1 px-3 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors min-h-[44px] flex items-center justify-center"
                  >
                    Invoices
                  </Link>
                  <button
                    onClick={() => openEditModal(client)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-teal-600 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors min-h-[44px]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(client.id)}
                    className="px-3 py-2 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors min-h-[44px]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-800">
                {editingClient ? 'Edit Client' : 'New Client'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
                  placeholder="e.g., Acme Corporation"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
                  placeholder="billing@example.com"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="123 Main St, City, State 12345"
                />
              </div>

              {/* Template Type & Rate Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Invoice Type</label>
                  <select
                    value={formData.template_type}
                    onChange={(e) => setFormData({ ...formData, template_type: e.target.value as TemplateType })}
                    className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
                  >
                    <option value="hourly">Hourly Contract</option>
                    <option value="project">Project-Based</option>
                    <option value="tuition">Tuition/Fixed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Default Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.default_rate}
                      onChange={(e) => setFormData({ ...formData, default_rate: e.target.value })}
                      className="w-full pl-7 pr-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice Prefix */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Invoice Prefix</label>
                <input
                  type="text"
                  value={formData.invoice_prefix}
                  onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value.toUpperCase() })}
                  maxLength={20}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
                  placeholder="INV"
                />
                <p className="text-xs text-stone-400 mt-1">Invoice numbers: {formData.invoice_prefix || 'INV'}-2026-001, {formData.invoice_prefix || 'INV'}-2026-002, etc.</p>
              </div>

              {/* Next Invoice Number Override */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Next Invoice Number</label>
                <input
                  type="number"
                  value={formData.next_invoice_number}
                  onChange={(e) => setFormData({ ...formData, next_invoice_number: e.target.value })}
                  min={1}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
                  placeholder="Auto (based on existing invoices)"
                />
                <p className="text-xs text-stone-400 mt-1">Leave empty for auto-numbering, or set to override the next invoice's sequence number</p>
              </div>

              {/* Company Context / Notes */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Billing Context / Notes
                </label>
                <textarea
                  value={formData.company_context}
                  onChange={(e) => setFormData({ ...formData, company_context: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="e.g., Contract work - bi-weekly invoicing"
                />
                <p className="text-xs text-stone-400 mt-1">
                  This appears on invoices and helps the AI understand how to bill this client
                </p>
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-h-[44px]"
                  placeholder="e.g., Net 30, Due on receipt"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors font-medium min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.name}
                  className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    editingClient ? 'Save Changes' : 'Create Client'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-stone-800 mb-2">Delete Client?</h3>
              <p className="text-stone-500 mb-6">
                This will permanently delete this client. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors font-medium min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium min-h-[44px]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
