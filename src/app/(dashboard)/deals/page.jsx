'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/Toast';

export default function DealsPage() {
  const toast = useToast();
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({
    stage: 'all',
    assignee: 'all',
    dateRange: 'all',
    valueRange: 'all',
  });

  const [formData, setFormData] = useState({
    name: '',
    value: '',
    stage: 'lead',
    contactId: '',
    expectedCloseDate: '',
    notes: '',
  });

  useEffect(() => {
    fetchDeals();
    fetchContacts();
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const res = await fetch('/api/team/users');
      const data = await res.json();
      setTeamMembers(data.users || []);
    } catch (e) {
      console.error('Failed to fetch team members:', e);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch (e) {
      console.error('Failed to fetch contacts:', e);
    }
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return null;
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
  };

  const getAssigneeName = (assigneeId) => {
    const member = teamMembers.find(m => m.id === assigneeId);
    if (!member) return null;
    return `${member.firstName} ${member.lastName}`.trim();
  };

  const getAssigneeInitials = (assigneeId) => {
    const member = teamMembers.find(m => m.id === assigneeId);
    if (!member) return null;
    return `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();
  };

  const fetchDeals = async () => {
    try {
      // Fetch all team deals for team-wide view
      const res = await fetch('/api/deals?team=true');
      const data = await res.json();
      setDeals(data.deals || []);
    } catch (e) {
      console.error('Failed to fetch deals:', e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingDeal(null);
    setFormData({
      name: '',
      value: '',
      stage: 'lead',
      contactId: '',
      expectedCloseDate: '',
      notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (deal) => {
    setEditingDeal(deal);
    setFormData({
      name: deal.name || '',
      value: deal.value?.toString() || '',
      stage: deal.stage || 'lead',
      contactId: deal.contactId || '',
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toISOString().split('T')[0] : '',
      notes: deal.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        value: formData.value ? parseFloat(formData.value) : null,
      };

      if (editingDeal) {
        await fetch('/api/deals', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingDeal.id, ...payload }),
        });
        toast.success('Deal updated');
      } else {
        await fetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast.success('Deal created');
      }
      setShowModal(false);
      fetchDeals();
    } catch (e) {
      console.error('Failed to save deal:', e);
      toast.error('Failed to save deal');
    }
  };

  const handleDelete = async (dealId) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    try {
      await fetch(`/api/deals?id=${dealId}`, { method: 'DELETE' });
      fetchDeals();
      toast.success('Deal deleted');
    } catch (e) {
      console.error('Failed to delete deal:', e);
      toast.error('Failed to delete deal');
    }
  };

  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

  // Check if date is within range
  const isDateInRange = (dateStr, range) => {
    if (!dateStr || range === 'all') return true;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const quarterEnd = new Date(today);
    quarterEnd.setMonth(quarterEnd.getMonth() + 3);

    switch (range) {
      case 'week':
        return date <= weekEnd;
      case 'month':
        return date <= monthEnd;
      case 'quarter':
        return date <= quarterEnd;
      default:
        return true;
    }
  };

  // Check if value is within range
  const isValueInRange = (value, range) => {
    if (range === 'all') return true;
    const v = value || 0;
    switch (range) {
      case 'small': return v < 25000;
      case 'medium': return v >= 25000 && v < 100000;
      case 'large': return v >= 100000;
      default: return true;
    }
  };

  // Filter deals
  const filteredDeals = deals.filter(d => {
    // Stage filter
    if (filters.stage !== 'all' && d.stage !== filters.stage) return false;

    // Assignee filter
    if (filters.assignee !== 'all' && d.assignedTo !== filters.assignee) return false;

    // Date range filter
    if (!isDateInRange(d.expectedCloseDate, filters.dateRange)) return false;

    // Value range filter
    if (!isValueInRange(d.value, filters.valueRange)) return false;

    return true;
  });

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

  const clearFilters = () => {
    setFilters({
      stage: 'all',
      assignee: 'all',
      dateRange: 'all',
      valueRange: 'all',
    });
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'lead': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'qualified': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'proposal': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'negotiation': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'won': return 'bg-green-50 text-green-700 border-green-200';
      case 'lost': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getStageDot = (stage) => {
    switch (stage) {
      case 'lead': return 'bg-slate-400';
      case 'qualified': return 'bg-blue-500';
      case 'proposal': return 'bg-amber-500';
      case 'negotiation': return 'bg-orange-500';
      case 'won': return 'bg-green-500';
      case 'lost': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const totalPipeline = filteredDeals
    .filter(d => !['won', 'lost'].includes(d.stage))
    .reduce((sum, d) => sum + (d.value || 0), 0);

  const wonDeals = filteredDeals.filter(d => d.stage === 'won');
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

  const activeDeals = filteredDeals.filter(d => !['won', 'lost'].includes(d.stage));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500 mt-0.5">{deals.length} total deals</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Deal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Pipeline Value</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{formatCurrency(totalPipeline)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Deals Won</p>
          <p className="text-2xl font-semibold text-green-600 mt-1">{formatCurrency(wonValue)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Active Deals</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{activeDeals.length}</p>
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-white text-slate-900 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear all
          </button>
        )}

        <div className="flex-1" />

        <span className="text-sm text-slate-500">
          {filteredDeals.length} of {deals.length} deals
        </span>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Stage Filter */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Stage</label>
                  <select
                    value={filters.stage}
                    onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="all">All Stages</option>
                    {stages.map((stage) => (
                      <option key={stage} value={stage} className="capitalize">{stage}</option>
                    ))}
                  </select>
                </div>

                {/* Assignee Filter */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Assigned To</label>
                  <select
                    value={filters.assignee}
                    onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="all">All Team Members</option>
                    {teamMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Close Date Filter */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Expected Close</label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="all">Any Date</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </select>
                </div>

                {/* Value Range Filter */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Deal Size</label>
                  <select
                    value={filters.valueRange}
                    onChange={(e) => setFilters({ ...filters, valueRange: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="all">Any Value</option>
                    <option value="small">Small (&lt; $25k)</option>
                    <option value="medium">Medium ($25k - $100k)</option>
                    <option value="large">Large ($100k+)</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-4 animate-pulse">
              <div className="h-5 bg-slate-100 rounded w-1/3 mb-2" />
              <div className="h-4 bg-slate-100 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : filteredDeals.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-medium text-slate-900 mb-1">No deals yet</h3>
          <p className="text-sm text-slate-500 mb-4">Create your first deal to start tracking</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Deal
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {filteredDeals.map((deal) => (
            <div
              key={deal.id}
              className="p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStageDot(deal.stage)}`} />
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">{deal.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={`text-xs px-1.5 py-0.5 rounded border inline-block capitalize ${getStageColor(deal.stage)}`}>
                        {deal.stage}
                      </p>
                      {deal.contactId && getContactName(deal.contactId) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {getContactName(deal.contactId)}
                        </span>
                      )}
                      {deal.assignedTo && getAssigneeName(deal.assignedTo) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                          <span className="w-4 h-4 rounded-full bg-slate-500 text-white text-[10px] flex items-center justify-center">
                            {getAssigneeInitials(deal.assignedTo)}
                          </span>
                          {getAssigneeName(deal.assignedTo)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(deal.value)}</p>
                    {deal.expectedCloseDate && (
                      <p className="text-xs text-slate-500">
                        Close: {new Date(deal.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(deal)}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(deal.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingDeal ? 'Edit Deal' : 'New Deal'}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Deal Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      placeholder="Enterprise License"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Value ($)</label>
                      <input
                        type="number"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                        placeholder="10000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
                      <select
                        value={formData.stage}
                        onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      >
                        {stages.map((stage) => (
                          <option key={stage} value={stage} className="capitalize">{stage}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contact</label>
                      <select
                        value={formData.contactId}
                        onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      >
                        <option value="">No contact</option>
                        {contacts.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Expected Close</label>
                      <input
                        type="date"
                        value={formData.expectedCloseDate}
                        onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      {editingDeal ? 'Save Changes' : 'Create Deal'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
