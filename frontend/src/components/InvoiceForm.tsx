/**
 * Invoice form component for manual invoice creation.
 */

import { useState, useEffect } from 'react';
import { clientsApi, invoicesApi } from '../services/api';
import type { Client, TemplateType } from '../types';

interface HoursEntryInput {
  date: string;
  hours: string;
  rate: string;
}

interface LineItemInput {
  description: string;
  quantity: string;
  rate: string;
}

export default function InvoiceForm() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('hourly');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Hours entries (for hourly invoices)
  const [hoursEntries, setHoursEntries] = useState<HoursEntryInput[]>([
    { date: new Date().toISOString().split('T')[0], hours: '', rate: '' },
  ]);

  // Line items (for project/tuition invoices)
  const [lineItems, setLineItems] = useState<LineItemInput[]>([
    { description: '', quantity: '1', rate: '' },
  ]);

  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, []);

  // Update template type when client changes
  useEffect(() => {
    const client = clients.find((c) => c.id === selectedClientId);
    if (client) {
      setTemplateType(client.template_type);
      // Auto-fill rate for hours entries
      if (client.template_type === 'hourly') {
        setHoursEntries((prev) =>
          prev.map((entry) => ({
            ...entry,
            rate: entry.rate || client.default_rate,
          }))
        );
      }
    }
  }, [selectedClientId, clients]);

  const loadClients = async () => {
    try {
      const data = await clientsApi.list();
      setClients(data);
    } catch (err) {
      setError('Failed to load clients');
    }
  };

  const addHoursEntry = () => {
    const client = clients.find((c) => c.id === selectedClientId);
    setHoursEntries((prev) => [
      ...prev,
      {
        date: new Date().toISOString().split('T')[0],
        hours: '',
        rate: client?.default_rate || '',
      },
    ]);
  };

  const removeHoursEntry = (index: number) => {
    setHoursEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateHoursEntry = (
    index: number,
    field: keyof HoursEntryInput,
    value: string
  ) => {
    setHoursEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { description: '', quantity: '1', rate: '' }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (
    index: number,
    field: keyof LineItemInput,
    value: string
  ) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const calculateTotal = (): number => {
    if (templateType === 'hourly') {
      return hoursEntries.reduce((sum, entry) => {
        const hours = parseFloat(entry.hours) || 0;
        const rate = parseFloat(entry.rate) || 0;
        return sum + hours * rate;
      }, 0);
    } else {
      return lineItems.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        return sum + quantity * rate;
      }, 0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const invoiceData: any = {
        client_id: selectedClientId,
        invoice_number: invoiceNumber,
        date: invoiceDate,
        service_period_start: periodStart || null,
        service_period_end: periodEnd || null,
        notes: notes || null,
        hours_entries: [],
        line_items: [],
      };

      if (templateType === 'hourly') {
        invoiceData.hours_entries = hoursEntries
          .filter((e) => e.hours && e.rate)
          .map((e) => ({
            date: e.date,
            hours: parseFloat(e.hours),
            rate: parseFloat(e.rate),
          }));
      } else {
        invoiceData.line_items = lineItems
          .filter((i) => i.description && i.rate)
          .map((i) => ({
            description: i.description,
            quantity: parseFloat(i.quantity),
            rate: parseFloat(i.rate),
          }));
      }

      const invoice = await invoicesApi.create(invoiceData);
      setSuccess(`Invoice ${invoice.invoice_number} created successfully!`);

      // Reset form
      setInvoiceNumber('');
      setNotes('');
      setHoursEntries([
        { date: new Date().toISOString().split('T')[0], hours: '', rate: '' },
      ]);
      setLineItems([{ description: '', quantity: '1', rate: '' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-6">Create Invoice</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Client
          </label>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select a client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} ({client.template_type})
              </option>
            ))}
          </select>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Number
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              required
              placeholder={`INV-${new Date().getFullYear()}-001`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Invoice Date
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Service Period */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Period Start
            </label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Period End
            </label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Hours Entries (for hourly invoices) */}
        {templateType === 'hourly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hours Entries
            </label>
            <div className="space-y-3">
              {hoursEntries.map((entry, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center p-3 sm:p-0 bg-gray-50 sm:bg-transparent rounded-lg sm:rounded-none">
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => updateHoursEntry(index, 'date', e.target.value)}
                    className="flex-1 px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={entry.hours}
                      onChange={(e) => updateHoursEntry(index, 'hours', e.target.value)}
                      placeholder="Hours"
                      step="0.5"
                      min="0"
                      className="flex-1 sm:w-24 px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                    />
                    <input
                      type="number"
                      value={entry.rate}
                      onChange={(e) => updateHoursEntry(index, 'rate', e.target.value)}
                      placeholder="Rate"
                      step="0.01"
                      min="0"
                      className="flex-1 sm:w-24 px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                    />
                    {hoursEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHoursEntry(index)}
                        className="p-2 text-red-600 hover:text-red-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addHoursEntry}
                className="text-sm text-primary-600 hover:text-primary-800 min-h-[44px] px-2"
              >
                + Add Entry
              </button>
            </div>
          </div>
        )}

        {/* Line Items (for project/tuition invoices) */}
        {(templateType === 'project' || templateType === 'tuition') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Line Items
            </label>
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center p-3 sm:p-0 bg-gray-50 sm:bg-transparent rounded-lg sm:rounded-none">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(index, 'description', e.target.value)
                    }
                    placeholder="Description"
                    className="flex-1 px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      step="1"
                      min="1"
                      className="flex-1 sm:w-20 px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                    />
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                      placeholder="Rate"
                      step="0.01"
                      min="0"
                      className="flex-1 sm:w-24 px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
                    />
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-2 text-red-600 hover:text-red-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addLineItem}
                className="text-sm text-primary-600 hover:text-primary-800 min-h-[44px] px-2"
              >
                + Add Item
              </button>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes for the invoice..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Total */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-right">
            <span className="text-gray-600">Total: </span>
            <span className="text-2xl font-bold text-gray-800">
              {formatCurrency(calculateTotal())}
            </span>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !selectedClientId || !invoiceNumber}
            className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {isSubmitting ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
