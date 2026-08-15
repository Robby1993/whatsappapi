'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import {
  Smartphone,
  QrCode,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  Hash
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ConnectionsPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pairingCode, setPairingCode] = useState('');
  const [qrCode, setQrCode] = useState('');

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkStatus = async () => {
    try {
      const response = await api.get('/whatsapp/session-status');
      if (response.data.status) {
        setStatus(response.data.result);
      }
    } catch (error) {
      console.error('Status check failed');
    } finally {
      setLoading(false);
    }
  };

  const connectQR = async () => {
    setPairingCode('');
    setQrCode('');
    toast.loading('Initializing QR Code...');
    try {
      const response = await api.post('/whatsapp/connect-qr', {});
      if (response.data.status && response.data.result?.qr) {
        setQrCode(response.data.result.qr);
        toast.dismiss();
      }
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate QR');
    }
  };

  const connectPair = async () => {
    setPairingCode('');
    setQrCode('');
    toast.loading('Generating Pairing Code...');
    try {
      const response = await api.post('/whatsapp/connect-pair', {});
      if (response.data.status && response.data.result?.pairingCode) {
        setPairingCode(response.data.result.pairingCode);
        toast.dismiss();
      }
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate code');
    }
  };

  const logout = async () => {
    if (!confirm('Are you sure you want to logout from WhatsApp?')) return;
    try {
      await api.post('/whatsapp/logout', {});
      setStatus({ status: 'not_connected' });
      setQrCode('');
      setPairingCode('');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Checking connection...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 text-center">WhatsApp Connection</h2>
        <p className="text-gray-600 text-center mt-2">Connect your device to start automating messages</p>
      </div>

      <div className="bg-white p-8 rounded-2xl border shadow-sm text-center">
        <div className="flex justify-center mb-6">
          {status?.status === 'connected' ? (
            <div className="bg-green-100 p-4 rounded-full text-green-600">
              <CheckCircle2 size={64} />
            </div>
          ) : (
            <div className="bg-gray-100 p-4 rounded-full text-gray-400">
              <Smartphone size={64} />
            </div>
          )}
        </div>

        <h3 className="text-2xl font-bold mb-2">
          {status?.status === 'connected' ? 'Connected' : 'Disconnected'}
        </h3>
        <p className="text-gray-500 mb-8">
          {status?.status === 'connected'
            ? `Your WhatsApp (${status.phone}) is active and ready.`
            : 'Scan the QR code or use the pairing code to link your account.'}
        </p>

        {status?.status !== 'connected' && !qrCode && !pairingCode && (
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={connectQR}
              className="flex items-center justify-center space-x-2 px-8 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all transform hover:scale-105"
            >
              <QrCode size={20} />
              <span>Connect via QR Code</span>
            </button>
            <button
              onClick={connectPair}
              className="flex items-center justify-center space-x-2 px-8 py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all transform hover:scale-105"
            >
              <Hash size={20} />
              <span>Connect via Pairing Code</span>
            </button>
          </div>
        )}

        {qrCode && status?.status !== 'connected' && (
          <div className="flex flex-col items-center space-y-6">
            <div className="bg-white p-4 border-4 border-gray-100 rounded-xl shadow-inner">
              <QRCodeSVG value={qrCode} size={256} />
            </div>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Open WhatsApp on your phone {'>'} Settings {'>'} Linked Devices {'>'} Link a Device
            </p>
            <button onClick={connectQR} className="text-primary font-bold flex items-center space-x-1">
              <RefreshCcw size={16} />
              <span>Refresh QR</span>
            </button>
          </div>
        )}

        {pairingCode && status?.status !== 'connected' && (
          <div className="flex flex-col items-center space-y-6">
            <div className="bg-gray-50 px-12 py-6 border-2 border-dashed border-gray-200 rounded-2xl">
              <span className="text-5xl font-black tracking-widest text-primary font-mono">{pairingCode}</span>
            </div>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Enter this code on your phone to link MsgPilot to your WhatsApp account.
            </p>
            <button onClick={connectPair} className="text-primary font-bold flex items-center space-x-1">
              <RefreshCcw size={16} />
              <span>Regenerate Code</span>
            </button>
          </div>
        )}

        {status?.status === 'connected' && (
          <button
            onClick={logout}
            className="px-8 py-3 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100 transition-colors border border-red-200"
          >
            Logout Device
          </button>
        )}
      </div>
    </div>
  );
}
