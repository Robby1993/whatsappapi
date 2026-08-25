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
  Clock,
  Smartphone,
  Image as ImageIcon,
  X,
  Loader2
} from 'lucide-react';

interface Contact {
  name: string;
  number: string;
  status: string;
}

export default function BroadcastPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [manualNumbers, setManualNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

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
          name: row.Name || row.name || 'Imported',
          number: String(row.Number || row.number || '').replace(/\D/g, ''),
          status: row.Status || row.status || 'Active'
        })).filter(c => c.number.length >= 10);

        if (formattedContacts.length === 0) {
          toast.error('No valid numbers found in the Excel sheet');
          return;
        }

        setContacts(prev => [...prev, ...formattedContacts]);
        toast.success(`Imported ${formattedContacts.length} contacts`);
      } catch (error) {
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddManualNumbers = () => {
    const numbers = manualNumbers.split(/[\n,]/)
      .map(n => n.trim().replace(/\D/g, ''))
      .filter(n => n.length >= 10);

    if (numbers.length === 0) {
      toast.error('Please enter valid phone numbers');
      return;
    }

    const newContacts: Contact[] = numbers.map(num => ({
      name: 'Manual',
      number: num,
      status: 'Active'
    }));

    setContacts(prev => [...prev, ...newContacts]);
    setManualNumbers('');
    toast.success(`Added ${newContacts.length} manual contacts`);
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const type = file.type.split('/')[0];
      setMediaType(type === 'application' ? 'document' : type);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setMediaPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setMediaPreview(null);
      }
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleSendBroadcast = async () => {
    if (contacts.length === 0) {
      toast.error('Please add some recipients first');
      return;
    }
    if (!message && !mediaFile) {
      toast.error('Please enter a message or select media');
      return;
    }

    setLoading(true);
    try {
      let mediaUrl = null;
      if (mediaFile) {
        const formData = new FormData();
        formData.append('file', mediaFile);
        const uploadRes = await api.post('/whatsapp/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        mediaUrl = uploadRes.data.result.url;
      }

      const numbers = contacts.map(c => c.number);
      const response = await api.post('/whatsapp/broadcast', {
        numbers,
        message,
        mediaUrl,
        mediaType: mediaFile ? mediaType : null
      });

      if (response.data.status) {
        toast.success('Broadcast started successfully!');
        setContacts([]);
        setMessage('');
        removeMedia();
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
          <p className="text-gray-600">Send mass messages using Excel or manual input</p>
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
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <FileUp size={18} className="text-primary" />
                  Import from Excel
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark cursor-pointer border rounded-lg p-1 bg-white"
                />
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Smartphone size={18} className="text-primary" />
                  Add Manual Numbers
                </label>
                <textarea
                  rows={3}
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none text-xs"
                  placeholder="919876543210, 919988776655..."
                  value={manualNumbers}
                  onChange={(e) => setManualNumbers(e.target.value)}
                />
                <button
                  onClick={handleAddManualNumbers}
                  className="mt-3 w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-xs font-bold transition-colors"
                >
                  Add Numbers
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" />
                Message Content
              </label>
              <textarea
                rows={5}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none text-sm"
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <ImageIcon size={18} className="text-primary" />
                Add Media (Gallery)
              </label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-xs font-bold"
                >
                  {mediaFile ? 'Change File' : 'Pick File'}
                </button>
                <input
                  type="file"
                  ref={mediaInputRef}
                  onChange={handleMediaChange}
                  className="hidden"
                  accept="image/*,video/*,audio/*,application/*"
                />
                {mediaFile && (
                  <button onClick={removeMedia} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <X size={18} />
                  </button>
                )}
              </div>
              {mediaPreview && (
                <div className="mt-3 relative aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                  <img src={mediaPreview} alt="Preview" className="w-full h-full object-contain" />
                </div>
              )}
            </div>

            <button
              onClick={handleSendBroadcast}
              disabled={loading || contacts.length === 0}
              className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-black transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send size={20} />
                  <span>Send Broadcast</span>
                </>
              )}
            </button>
          </div>
        </div>

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
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Type</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Phone Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((contact, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                          contact.name === 'Manual' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {contact.name === 'Manual' ? 'Manual' : 'Excel'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-gray-900 text-sm">{contact.name || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-600">+{contact.number}</span>
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <Users size={48} className="mb-4" />
                          <p className="font-bold">No contacts imported</p>
                          <p className="text-sm">Add manual numbers or upload Excel</p>
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
