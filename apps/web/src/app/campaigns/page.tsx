'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Plus,
  Trash2,
  Database,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    numbers: '',
    scheduledAt: ''
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns');
      if (response.data.status) {
        setCampaigns(response.data.result);
      }
    } catch (error) {
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Improved parsing: split by newline OR comma
      const numbersList = formData.numbers
        .split(/[\n,]/)
        .map(n => n.trim())
        .filter(n => n.length > 0 && !isNaN(Number(n.replace(/\D/g, ''))));

      if (numbersList.length === 0) {
        toast.error('Please enter valid phone numbers');
        setSubmitting(false);
        return;
      }

      await api.post('/campaigns', {
        name: formData.name,
        message: formData.message,
        numbers: numbersList,
        scheduledAt: formData.scheduledAt || null
      });

      toast.success('Campaign created and queued');
      setIsModalOpen(false);
      setFormData({ name: '', message: '', numbers: '', scheduledAt: '' });
      fetchCampaigns();
    } catch (error) {
      toast.error('Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCampaign = async (id: number) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleString();
  };

  const getStatusBadge = (status: string, scheduledAt?: string) => {
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold uppercase flex items-center"><Clock size={12} className="mr-1" /> Scheduled</span>;
    }
    switch (status) {
      case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold uppercase">Completed</span>;
      case 'processing': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase flex items-center"><Loader2 size={12} className="animate-spin mr-1" /> Processing</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase">Pending</span>;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading campaigns...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Campaigns</h2>
          <p className="text-gray-600">Manage bulk messaging tasks and status</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 hover:bg-primary-dark transition-all shadow-lg"
        >
          <Plus size={20} />
          <span>New Campaign</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {campaigns.map((campaign: any) => (
          <div key={campaign.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-bold text-gray-900">{campaign.name}</h3>
                  {getStatusBadge(campaign.status, campaign.scheduledAt)}
                </div>
                <p className="text-gray-500 text-sm italic line-clamp-1">"{campaign.message}"</p>
                <div className="flex items-center space-x-4 text-xs text-gray-400">
                  <span className="flex items-center"><Clock size={12} className="mr-1" /> {formatDate(campaign.createdAt)}</span>
                  {campaign.scheduledAt && (
                    <span className="flex items-center text-primary font-medium">
                      <Clock size={12} className="mr-1" />
                      Scheduled: {formatDate(campaign.scheduledAt)}
                    </span>
                  )}
                  <span className="flex items-center"><Users size={12} className="mr-1" /> {campaign.totalContacts} Contacts</span>
                </div>
              </div>

              <div className="flex items-center space-x-8">
                <div className="text-center">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Sent</p>
                  <p className="text-2xl font-black text-green-600">{campaign.sentCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">Failed</p>
                  <p className="text-2xl font-black text-red-500">{campaign.failedCount}</p>
                </div>
                <div className="h-12 w-px bg-gray-100 hidden md:block" />
                <button
                  onClick={() => deleteCampaign(campaign.id)}
                  className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="h-2 bg-gray-100 w-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${(campaign.sentCount / campaign.totalContacts) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <Database size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No bulk campaigns started yet.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="text-xl font-bold">New Bulk Campaign</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Campaign Name</label>
                    <input
                      type="text"
                      required
                      className="mt-1 block w-full px-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                      placeholder="e.g. Summer Sale 2026"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Message Content</label>
                    <textarea
                      required
                      className="mt-1 block w-full px-4 py-2 border rounded-lg h-32 focus:ring-primary focus:border-primary"
                      placeholder="Enter your message..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Schedule Start (Optional)</label>
                    <input
                      type="datetime-local"
                      className="mt-1 block w-full px-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                      value={formData.scheduledAt}
                      onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    />
                    <p className="mt-1 text-xs text-gray-400">Leave empty to start immediately.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Numbers (One per line)</label>
                    <textarea
                      required
                      className="mt-1 block w-full px-4 py-2 border rounded-lg h-[264px] focus:ring-primary focus:border-primary font-mono text-sm"
                      placeholder="919876543210&#10;919988776655&#10;..."
                      value={formData.numbers}
                      onChange={(e) => setFormData({ ...formData, numbers: e.target.value })}
                    />
                    <p className="mt-2 text-xs text-gray-400">Total lines: {formData.numbers.split('\n').filter(n => n.trim()).length}</p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border rounded-xl hover:bg-gray-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark font-bold flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      <span>Start Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
