'use client';

import React, { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Send, Smartphone, MessageSquare } from 'lucide-react';
import { countries } from '@/lib/countries';

export default function SendMessagePage() {
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !message) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const fullNumber = countryCode.replace('+', '') + phoneNumber.replace(/\D/g, '');
      const response = await api.post('/whatsapp/send-message', {
        phone: fullNumber,
        message: message
      });

      if (response.data.status) {
        toast.success('Message sent successfully!');
        setPhoneNumber('');
        setMessage('');
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
        <p className="text-gray-600">Quickly send a WhatsApp message to any number</p>
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
              required
              rows={6}
              className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary resize-none"
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-primary-dark transition-all shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <span>Sending...</span>
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
