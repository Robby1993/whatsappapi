'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Users,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
  Settings,
  MoreVertical
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats')
      ]);

      if (usersRes.data.status) setUsers(usersRes.data.result);
      if (statsRes.data.status) setStats(statsRes.data.result);
    } catch (error) {
      toast.error('Failed to fetch admin data');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (number: string, currentStatus: boolean, validDays: number) => {
    try {
      await api.post('/admin/update-user', {
        number,
        isActive: !currentStatus,
        validDays
      });
      toast.success('User status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const updateValidDays = async (number: string, isActive: boolean, currentDays: number) => {
    const newDays = prompt('Enter new valid days:', currentDays.toString());
    if (newDays === null) return;

    try {
      await api.post('/admin/update-user', {
        number,
        isActive,
        validDays: parseInt(newDays)
      });
      toast.success('Subscription updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update subscription');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Loading admin panel...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Admin Panel</h2>
        <p className="text-gray-600">Global user management and system health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">Total Users</p>
          <p className="text-2xl font-black">{stats?.totalUsers || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">Active Accounts</p>
          <p className="text-2xl font-black text-green-600">{stats?.activeUsers || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">Total Messages</p>
          <p className="text-2xl font-black text-blue-600">{stats?.totalMessages || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-xs text-gray-500 font-bold uppercase mb-1">Campaigns</p>
          <p className="text-2xl font-black text-purple-600">{stats?.totalCampaigns || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center space-x-2">
            <Users size={20} className="text-primary" />
            <span>User Management</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">User</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Subscription</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{u.name}</span>
                      <span className="text-xs text-gray-500">+{u.number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                      u.userType === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {u.userType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.isActive ? (
                      <span className="flex items-center text-green-600 text-sm font-bold">
                        <CheckCircle2 size={14} className="mr-1" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center text-red-500 text-sm font-bold">
                        <XCircle size={14} className="mr-1" /> Blocked
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Calendar size={14} className="text-gray-400" />
                      <span className="text-sm font-medium">{u.validDays} Days</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleUserStatus(u.number, u.isActive, u.validDays)}
                        className={`p-2 rounded-lg transition-colors ${
                          u.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={u.isActive ? 'Block User' : 'Unblock User'}
                      >
                        <ShieldAlert size={18} />
                      </button>
                      <button
                        onClick={() => updateValidDays(u.number, u.isActive, u.validDays)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Extend Subscription"
                      >
                        <Settings size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
