'use client';

import React, { useState, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Radio,
  FileUp,
  Send,
  Trash2,
  Users,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface Contact {
  name: string;
  number: string;
  status: string;
}

export default function BroadcastPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const formattedContacts: Contact[] = data.map((row: any) => ({
          name: row.Name || row.name || '',
          number: String(row.Number || row.number || '').replace(/\D/g, ''),
          status: row.Status || row.status || 'Pending'
        })).filter(c => c.number.length >= 10);

        if (formattedContacts.length === 0) {
          toast.error('No valid numbers found in the Excel sheet');
          return;
        }

        setContacts(formattedContacts);
        toast.success(`Imported ${formattedContacts.length} contacts`);
      } catch (error) {
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSendBroadcast = async () => {
    if (contacts.length === 0) {
      toast.error('Please upload an Excel sheet with contacts first');
      return;
    }
    if (!message) {
      toast.error('Please enter a message to broadcast');
      return;
    }

    setLoading(true);
    try {
      const numbers = contacts.map(c => c.number);
      const response = await api.post('/whatsapp/broadcast', {
        numbers,
        message
      });

      if (response.data.status) {
        toast.success('Broadcast started successfully!');
        // Update local status based on results if needed
      } else {
        toast.error(response.data.message || 'Failed to start broadcast');
      }
    } catch (error: any) {
      toast.error('Something went wrong during broadcast');
    } finally {
      setLoading(false);
    }
  };

  const clearContacts = () => {
    setContacts([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Broadcast Message</h2>
          <p className="text-gray-600">Send mass messages using an Excel contact list</p>
        </div>
        {contacts.length > 0 && (
          <button
            onClick={clearContacts}
            className="text-red-500 hover:text-red-700 font-bold flex items-center gap-2"
          >
            <Trash2 size={18} />
            <span>Clear List</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <FileUp size={18} className="text-primary" />
                1. Upload Excel Sheet
              </label>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark cursor-pointer border rounded-lg p-2"
              />
              <p className="mt-2 text-xs text-gray-400 font-medium">Format: Name, Number, Status columns</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" />
                2. Message Content
              </label>
              <textarea
                rows={8}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none text-sm"
                placeholder="Type the message you want to broadcast..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button
              onClick={handleSendBroadcast}
              disabled={loading || contacts.length === 0}
              className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-black transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <>
                  <Send size={20} />
                  <span>Send Broadcast</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: List Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden h-[calc(100vh-280px)] flex flex-col">
            <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2 text-gray-700">
                <Users size={18} />
                Recipient List ({contacts.length})
              </h3>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="bg-white border-b sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Phone Number</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((contact, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 text-sm">{contact.name || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-600">+{contact.number}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          contact.status.toLowerCase() === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {contact.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <FileUp size={48} className="mb-4" />
                          <p className="font-bold">No contacts imported</p>
                          <p className="text-sm">Upload an Excel sheet to preview recipients</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
