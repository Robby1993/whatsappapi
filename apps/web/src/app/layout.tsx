'use client';

import React, { useEffect } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { useAuthStore } from '@/store/authStore';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { init, user, initialized } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    init();
  }, [init]);

  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(pathname);

  useEffect(() => {
    if (initialized && !user && !isAuthPage) {
      router.push('/login');
    }
  }, [user, pathname, router, initialized, isAuthPage]);

  if (!initialized) {
    return (
      <html lang="en">
        <body className={inter.className}>
          <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster position="top-right" />
        {isAuthPage ? (
          children
        ) : (
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8">
              {children}
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
