'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Plus,
  Trash2,
  Edit3,
  Zap,
  MessageCircle,
  Type,
  Image as ImageIcon,
  List as ListIcon,
  PlaySquare
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatFlowsPage() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    triggerKeyword: '',
    responseType: 'text',
    responseText: '',
    mediaUrl: '',
    isActive: true
  });

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      const response = await api.get('/chatflows');
      if (response.data.status) {
        setFlows(response.data.result);
      }
    } catch (error) {
      toast.error('Failed to fetch chat flows');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/chatflows/${editingId}`, formData);
        toast.success('ChatFlow updated');
      } else {
        await api.post('/chatflows', formData);
        toast.success('ChatFlow created');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({
        triggerKeyword: '',
        responseType: 'text',
        responseText: '',
        mediaUrl: '',
        isActive: true
      });
      fetchFlows();
    } catch (error) {
      toast.error('Failed to save ChatFlow');
    }
  };

  const deleteFlow = async (id: number) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    try {
      await api.delete(`/chatflows/${id}`);
      toast.success('ChatFlow deleted');
      fetchFlows();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const editFlow = (flow: any) => {
    setEditingId(flow.id);
    setFormData({
      triggerKeyword: flow.triggerKeyword,
      responseType: flow.responseType,
      responseText: flow.responseText || '',
      mediaUrl: flow.mediaUrl || '',
      isActive: flow.isActive
    });
    setIsModalOpen(true);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type size={18} />;
      case 'image': return <ImageIcon size={18} />;
      case 'video': return <PlaySquare size={18} />;
      case 'list': return <ListIcon size={18} />;
      default: return <MessageCircle size={18} />;
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading chat flows...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">ChatFlows</h2>
          <p className="text-gray-600">Automated responses triggered by keywords</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              triggerKeyword: '',
              responseType: 'text',
              responseText: '',
              mediaUrl: '',
              isActive: true
            });
            setIsModalOpen(true);
          }}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 hover:bg-primary-dark transition-all"
        >
          <Plus size={20} />
          <span>New ChatFlow</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flows.map((flow: any) => (
          <div key={flow.id} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            {!flow.isActive && <div className="absolute top-0 right-0 bg-gray-200 text-gray-600 px-3 py-1 text-xs font-bold rounded-bl-lg">Inactive</div>}

            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Zap size={20} fill="currentColor" />
              </div>
              <h3 className="font-bold text-lg truncate flex-1">/{flow.triggerKeyword}</h3>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center text-sm text-gray-600 space-x-2">
                {getIcon(flow.responseType)}
                <span className="capitalize">{flow.responseType} Response</span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-3 bg-gray-50 p-3 rounded-lg border italic">
                {flow.responseText || 'No text content'}
              </p>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => editFlow(flow)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={() => deleteFlow(flow.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        {flows.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
            <MessageCircle size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No automated flows created yet.</p>
            <p className="text-gray-400 text-sm">Click "New ChatFlow" to create your first automation.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b bg-gray-50">
              <h3 className="text-xl font-bold">{editingId ? 'Edit ChatFlow' : 'Create ChatFlow'}</h3>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Trigger Keyword</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full px-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                  placeholder="e.g. hello, help, price"
                  value={formData.triggerKeyword}
                  onChange={(e) => setFormData({ ...formData, triggerKeyword: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Response Type</label>
                <select
                  className="mt-1 block w-full px-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                  value={formData.responseType}
                  onChange={(e) => setFormData({ ...formData, responseType: e.target.value })}
                >
                  <option value="text">Text Message</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Response Message</label>
                <textarea
                  className="mt-1 block w-full px-4 py-2 border rounded-lg focus:ring-primary focus:border-primary h-24"
                  placeholder="Enter the automated response text..."
                  value={formData.responseText}
                  onChange={(e) => setFormData({ ...formData, responseText: e.target.value })}
                />
              </div>

              {formData.responseType !== 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Media URL</label>
                  <input
                    type="url"
                    className="mt-1 block w-full px-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                    placeholder="https://example.com/image.jpg"
                    value={formData.mediaUrl}
                    onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-primary focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Enabled</label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-bold"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
