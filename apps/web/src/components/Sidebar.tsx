'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Zap,
  FileText,
  Database,
  ShieldCheck,
  Send,
  Radio
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const Sidebar = () => {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Connections', path: '/connections', icon: Zap },
    { name: 'Send Message', path: '/send-message', icon: Send },
    { name: 'Broadcast', path: '/broadcast', icon: Radio },
    { name: 'ChatFlows', path: '/chatflows', icon: MessageSquare },
    { name: 'Templates', path: '/templates', icon: FileText },
    { name: 'Campaigns', path: '/campaigns', icon: Database },
  ];

  if (user?.userType === 'admin') {
    menuItems.push({ name: 'Admin Panel', path: '/admin', icon: ShieldCheck });
  }

  return (
    <div className="w-64 bg-white h-screen border-r flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-primary">MsgPilot</h1>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={logout}
          className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
