'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Plus,
  Trash2,
  FileText,
  Copy,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    keyword: '',
    type: 'text',
    content: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates');
      if (response.data.status) {
        setTemplates(response.data.result);
      }
    } catch (error) {
      toast.error('Failed to fetch templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/templates', formData);
      toast.success('Template created');
      setIsModalOpen(false);
      setFormData({ keyword: '', type: 'text', content: '' });
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const deleteTemplate = async (keyword: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${keyword}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Content copied to clipboard');
  };

  const filtered = templates.filter((t: any) =>
    t.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-full">Loading templates...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Message Templates</h2>
          <p className="text-gray-600">Reusable content for quick replies and broadcasts</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 hover:bg-primary-dark transition-all"
        >
          <Plus size={20} />
          <span>New Template</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center space-x-3">
        <Search className="text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search templates by keyword or content..."
          className="flex-1 border-none focus:ring-0 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((template: any) => (
          <div key={template.keyword} className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <FileText size={16} className="text-primary" />
                <span className="font-bold text-gray-700">{template.keyword}</span>
              </div>
              <button
                onClick={() => deleteTemplate(template.keyword)}
                className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="p-4 flex-1">
              <p className="text-sm text-gray-600 line-clamp-4 italic bg-gray-50 p-3 rounded border">
                {template.content || 'No content'}
              </p>
            </div>
            <div className="p-3 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => copyToClipboard(template.content)}
                className="text-primary text-xs font-bold flex items-center space-x-1 hover:underline"
              >
                <Copy size={12} />
                <span>Copy Content</span>
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && templates.length > 0 && (
          <div className="col-span-full py-10 text-center text-gray-500">
            No templates matching your search.
          </div>
        )}

        {templates.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No templates created yet.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b bg-gray-50">
              <h3 className="text-xl font-bold">New Template</h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Template Keyword</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g. welcome_msg"
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Content</label>
                <textarea
                  required
                  className="mt-1 block w-full px-4 py-2 border rounded-lg h-40"
                  placeholder="Write your message here..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark font-bold"
                >
                  Create Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
