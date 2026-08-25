'use client';

import React, { useState, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Send, Smartphone, MessageSquare, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { countries } from '@/lib/countries';

export default function SendMessagePage() {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState('image');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const type = file.type.split('/')[0];
      setMediaType(type === 'application' ? 'document' : type);

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setMediaPreview(null);
      }
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || (!message && !mediaFile)) {
      toast.error('Please provide a number and a message or media');
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

      const fullNumber = countryCode.replace('+', '') + phoneNumber.replace(/\D/g, '');
      const response = await api.post('/whatsapp/send-message', {
        phone: fullNumber,
        message: message,
        mediaUrl,
        mediaType: mediaFile ? mediaType : null
      });

      if (response.data.status) {
        toast.success('Message sent successfully!');
        setPhoneNumber('');
        setMessage('');
        removeMedia();
      } else {
        toast.error(response.data.message || 'Failed to send message');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Send Single Message</h2>
        <p className="text-gray-600">Quickly send a WhatsApp message with media</p>
      </div>

      <div className="bg-white p-8 rounded-2xl border shadow-sm">
        <form onSubmit={handleSendMessage} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Smartphone size={16} className="text-primary" />
              Recipient Number
            </label>
            <div className="flex">
              <select
                className="block w-32 px-3 py-3 border border-gray-300 rounded-l-lg border-r-0 focus:ring-primary focus:border-primary bg-gray-50 text-sm"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              >
                {countries.map((c) => (
                  <option key={c.name + c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                className="block w-full px-4 py-3 border border-gray-300 rounded-r-lg focus:ring-primary focus:border-primary"
                placeholder="Mobile Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <MessageSquare size={16} className="text-primary" />
              Message Content
            </label>
            <textarea
              rows={4}
              className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <ImageIcon size={16} className="text-primary" />
              Add Media (Optional)
            </label>
            <div className="mt-1 flex items-center space-x-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                {mediaFile ? 'Change Media' : 'Choose from Gallery'}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*,audio/*,application/*"
              />
              {mediaFile && (
                <button
                  type="button"
                  onClick={removeMedia}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {mediaPreview && (
              <div className="mt-4 relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                <img src={mediaPreview} alt="Preview" className="w-full h-full object-contain" />
              </div>
            )}

            {mediaFile && !mediaPreview && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border flex items-center space-x-3">
                <div className="bg-primary/10 p-2 rounded">
                  <ImageIcon size={20} className="text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{mediaFile.name}</p>
                  <p className="text-xs text-gray-500 font-mono uppercase">{mediaType}</p>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-primary-dark transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>Send Message</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
