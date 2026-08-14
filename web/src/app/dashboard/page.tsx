'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Send,
  MessageSquare,
  Users,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalSent: 0,
    recentLogs: [],
    profile: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/users/dashboard');
      if (response.data.status) {
        setStats(response.data.result);
      }
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
      <div className={`p-3 rounded-lg ${color} text-white`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-gray-600 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold">{value}</h3>
      </div>
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-full">Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600">Overview of your WhatsApp automation activity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Sent"
          value={stats.totalSent}
          icon={Send}
          color="bg-blue-500"
        />
        <StatCard
          title="Valid Days"
          value={stats.profile?.validDays || 0}
          icon={Clock}
          color="bg-green-500"
        />
        <StatCard
          title="ChatFlows"
          value="-"
          icon={MessageSquare}
          color="bg-purple-500"
        />
        <StatCard
          title="Status"
          value={stats.profile?.isActive ? 'Active' : 'Inactive'}
          icon={Users}
          color="bg-orange-500"
        />
      </div>

      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-bold">Recent Message Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-gray-600">Receiver</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-600">Message</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-600">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats.recentLogs.map((log: any, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900">{log.receiver}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">{log.message}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(Number(log.timestamp)).toLocaleString()}
                  </td>
                </tr>
              ))}
              {stats.recentLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">
                    No recent logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
