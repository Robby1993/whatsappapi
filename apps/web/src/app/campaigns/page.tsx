'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import {
  Plus,
  Trash2,
  Database,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  Image as ImageIcon,
  X,
  FileUp,
  FileText,
  Layout,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    name: '',
    message: '',
    numbers: '',
    scheduledAt: '',
    mediaUrl: '',
    mediaType: 'image',
    mediaFile: null as File | null
  });

  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.split('/')[0];
      setFormData({
        ...formData,
        mediaFile: file,
        mediaType: type === 'application' ? 'document' : type
      });
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        const extractedNumbers = data
          .map((row: any) => String(row.Number || row.number || '').replace(/\D/g, ''))
          .filter(n => n.length >= 10);

        if (extractedNumbers.length === 0) {
          toast.error('No valid numbers found in the Excel sheet');
          return;
        }

        const existingNumbers = formData.numbers.split(/[\n,]/).filter(n => n.trim().length > 0);
        const combinedNumbers = [...new Set([...existingNumbers, ...extractedNumbers])].join('\n');

        setFormData({ ...formData, numbers: combinedNumbers });
        toast.success(`Imported ${extractedNumbers.length} unique contacts`);
      } catch (error) {
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchCampaigns = async () => {
    try {
      const response = await api.get('/campaigns');
      if (response.data.status) {
        setCampaigns(response.data.result);
      }
    } catch (error) {
      toast.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      let finalMediaUrl = formData.mediaUrl;

      if (formData.mediaFile) {
        const uploadData = new FormData();
        uploadData.append('file', formData.mediaFile);
        const uploadRes = await api.post('/whatsapp/upload', uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalMediaUrl = uploadRes.data.result.url;
      }

      const numbersList = formData.numbers
        .split(/[\n,]/)
        .map(n => n.trim())
        .filter(n => n.length > 0 && !isNaN(Number(n.replace(/\D/g, ''))));

      if (numbersList.length === 0) {
        toast.error('Please enter valid phone numbers');
        setSubmitting(false);
        return;
      }

      await api.post('/campaigns', {
        name: formData.name,
        message: formData.message,
        numbers: numbersList,
        scheduledAt: formData.scheduledAt || null,
        mediaUrl: finalMediaUrl || null,
        mediaType: formData.mediaType
      });

      toast.success('Campaign created successfully!');
      closeModal();
      fetchCampaigns();
    } catch (error) {
      toast.error('Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentStep(1);
    setFormData({ name: '', message: '', numbers: '', scheduledAt: '', mediaUrl: '', mediaType: 'image', mediaFile: null });
  };

  const nextStep = () => {
    if (currentStep === 1 && !formData.name) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (currentStep === 3 && !formData.numbers) {
      toast.error('Please add at least one recipient');
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);

  const deleteCampaign = async (id: number) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await api.delete(`/campaigns/${id}`);
      toast.success('Campaign deleted');
      fetchCampaigns();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleString();
  };

  const getStatusBadge = (status: string, scheduledAt?: string) => {
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center"><Clock size={10} className="mr-1" /> Scheduled</span>;
    }
    switch (status) {
      case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Completed</span>;
      case 'processing': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center"><Loader2 size={10} className="animate-spin mr-1" /> Processing</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-[10px] font-bold uppercase">Pending</span>;
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <Loader2 size={40} className="text-primary animate-spin" />
      <p className="text-gray-500 font-medium">Syncing your campaigns...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Campaigns</h2>
          <p className="text-gray-500 font-medium">Track and manage your bulk messaging performance</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-8 py-4 rounded-2xl font-black flex items-center space-x-2 hover:bg-primary-dark transition-all shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)] hover:-translate-y-0.5 active:scale-95"
        >
          <Plus size={24} strokeWidth={3} />
          <span>NEW CAMPAIGN</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {campaigns.map((campaign: any) => (
          <div key={campaign.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
            <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center space-x-3">
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-primary transition-colors">{campaign.name}</h3>
                  {getStatusBadge(campaign.status, campaign.scheduledAt)}
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-full text-xs font-bold text-gray-500">
                    <Clock size={14} className="mr-1.5 text-primary" /> {formatDate(campaign.createdAt)}
                  </div>
                  <div className="flex items-center bg-gray-50 px-3 py-1.5 rounded-full text-xs font-bold text-gray-500">
                    <Users size={14} className="mr-1.5 text-primary" /> {campaign.totalContacts} Contacts
                  </div>
                  {campaign.mediaUrl && (
                    <div className="flex items-center bg-purple-50 px-3 py-1.5 rounded-full text-xs font-bold text-purple-600">
                      <ImageIcon size={14} className="mr-1.5" /> Media Attachment
                    </div>
                  )}
                  {campaign.scheduledAt && (
                    <div className="flex items-center bg-yellow-50 px-3 py-1.5 rounded-full text-xs font-bold text-yellow-600 border border-yellow-100">
                      <Calendar size={14} className="mr-1.5" /> Scheduled for: {formatDate(campaign.scheduledAt)}
                    </div>
                  )}
                </div>

                <div className="relative">
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-100 rounded-full" />
                   <p className="pl-4 text-gray-600 font-medium leading-relaxed italic">
                    "{campaign.message || 'No text message'}"
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-12 bg-gray-50/50 p-6 rounded-3xl border border-gray-100/50">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Delivered</p>
                  <p className="text-3xl font-black text-green-600">{campaign.sentCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Failed</p>
                  <p className="text-3xl font-black text-red-500">{campaign.failedCount}</p>
                </div>
                <div className="h-12 w-px bg-gray-200 hidden md:block" />
                <button
                  onClick={() => deleteCampaign(campaign.id)}
                  className="p-4 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                  title="Delete Campaign"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            </div>

            <div className="h-2.5 bg-gray-50 w-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                style={{ width: `${(campaign.sentCount / campaign.totalContacts) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="py-24 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
            <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Database size={48} className="text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No campaigns found</h3>
            <p className="text-gray-500 font-medium max-w-sm mx-auto">Click the button above to launch your first bulk messaging campaign.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="bg-primary/10 p-3 rounded-2xl">
                  <Layout className="text-primary" size={24} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">New Bulk Campaign</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                          currentStep >= step ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={24} strokeWidth={3} />
              </button>
            </div>

            <div className="p-8 min-h-[450px]">
              {/* STEP 1: BASIC INFO */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <FileText size={16} className="text-primary" /> Campaign Name
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-bold text-lg"
                        placeholder="e.g. Festival Special Offer 2026"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <MessageSquare size={16} className="text-primary" /> Message Content
                      </label>
                      <textarea
                        required
                        className="w-full px-6 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-4 focus:ring-primary/20 transition-all font-medium h-48 resize-none text-lg leading-relaxed"
                        placeholder="Type your WhatsApp message here..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      />
                      <div className="flex justify-between mt-2 px-2">
                         <span className="text-[10px] text-gray-400 font-bold uppercase">Characters: {formData.message.length}</span>
                         <span className="text-[10px] text-gray-400 font-bold uppercase italic">Tip: Use emojis to boost engagement 🚀</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: MEDIA */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                   <div className="bg-purple-50 p-8 rounded-[2rem] border-2 border-dashed border-purple-200">
                      <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                           <ImageIcon className="text-purple-500" size={36} />
                        </div>
                        <h4 className="text-xl font-black text-purple-900">Add Visual Impact</h4>
                        <p className="text-purple-600 font-medium">Attached media gets 3x more engagement than text alone.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => mediaInputRef.current?.click()}
                          className={`flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all ${
                            formData.mediaFile ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-white text-gray-600 hover:border-purple-300'
                          }`}
                        >
                          <FileUp size={24} className={formData.mediaFile ? 'text-white' : 'text-purple-500'} />
                          <span className="mt-2 font-bold text-sm">{formData.mediaFile ? 'File Selected' : 'Upload File'}</span>
                          {formData.mediaFile && <span className="text-[10px] truncate max-w-full px-2">{formData.mediaFile.name}</span>}
                        </button>
                        <input type="file" ref={mediaInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*,application/*" />

                        <div className="relative">
                          <input
                            type="text"
                            className="w-full h-full pl-6 pr-12 py-4 bg-white border-2 border-white rounded-3xl focus:ring-4 focus:ring-purple-200 transition-all font-bold text-sm text-gray-600 placeholder:text-gray-400"
                            placeholder="Or paste media URL..."
                            value={formData.mediaUrl}
                            onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                          />
                          <Layout className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-300" size={20} />
                        </div>
                      </div>

                      {(formData.mediaUrl || formData.mediaFile) && (
                        <div className="mt-6">
                           <label className="block text-[10px] font-black text-purple-900 uppercase tracking-widest mb-2 ml-4">Confirm Media Type</label>
                           <div className="flex bg-white/50 p-1.5 rounded-2xl border border-white">
                              {['image', 'video', 'audio', 'document'].map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setFormData({...formData, mediaType: type})}
                                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase transition-all ${
                                    formData.mediaType === type ? 'bg-purple-600 text-white shadow-lg' : 'text-purple-400 hover:bg-white'
                                  }`}
                                >
                                  {type}
                                </button>
                              ))}
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              )}

              {/* STEP 3: RECIPIENTS */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                           <Smartphone size={16} className="text-primary" /> Manual Entry
                        </label>
                        <span className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded text-gray-500">
                           {formData.numbers.split(/[\n,]/).filter(n => n.trim()).length} LOADED
                        </span>
                      </div>
                      <textarea
                        required
                        className="w-full px-6 py-4 bg-gray-50 border-0 rounded-3xl focus:ring-4 focus:ring-primary/20 transition-all font-mono text-xs h-[280px] resize-none"
                        placeholder="919876543210&#10;919988776655&#10;..."
                        value={formData.numbers}
                        onChange={(e) => setFormData({ ...formData, numbers: e.target.value })}
                      />
                    </div>

                    <div className="space-y-6">
                      <div className="bg-green-50 p-8 rounded-[2rem] border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-center">
                         <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                            <FileUp className="text-green-500" size={28} />
                         </div>
                         <h4 className="text-lg font-black text-green-900">Excel Smart Import</h4>
                         <p className="text-green-600 text-xs font-medium mb-6">Drop your .xlsx file here to bulk load thousands of contacts instantly.</p>

                         <input type="file" ref={fileInputRef} onChange={handleExcelUpload} className="hidden" accept=".xlsx, .xls" />
                         <button
                           type="button"
                           onClick={() => fileInputRef.current?.click()}
                           className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-green-700 transition-all active:scale-95"
                         >
                           CHOOSE EXCEL FILE
                         </button>
                         <p className="mt-4 text-[10px] text-green-400 font-bold">Column name must be "Number"</p>
                      </div>

                      <div className="bg-blue-50 p-6 rounded-[2rem] border-2 border-blue-100">
                         <h5 className="text-xs font-black text-blue-900 uppercase tracking-widest mb-2">Instructions</h5>
                         <ul className="text-[10px] text-blue-600 font-bold space-y-2">
                           <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Include Country Code (e.g. 91)</li>
                           <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Numbers can be on new lines or comma-separated</li>
                           <li className="flex items-center gap-2"><CheckCircle2 size={12} /> Invalid numbers will be skipped automatically</li>
                         </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: SUMMARY & SCHEDULE */}
              {currentStep === 4 && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                           <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Scheduling</h4>
                           <div className="relative">
                              <input
                                type="datetime-local"
                                className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-primary rounded-2xl transition-all font-bold"
                                value={formData.scheduledAt}
                                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                              />
                              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={20} />
                           </div>
                           <p className="mt-3 text-[10px] text-gray-500 font-bold italic px-2">
                              {formData.scheduledAt ? 'Campaign will launch at selected time.' : 'Campaign will start IMMEDIATELY after creation.'}
                           </p>
                        </div>

                        <div className="bg-primary/5 p-6 rounded-3xl border border-primary/10">
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Summary</h4>
                            <div className="space-y-3">
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-gray-400">Total Recipients:</span>
                                  <span className="text-gray-900">{formData.numbers.split(/[\n,]/).filter(n => n.trim()).length}</span>
                               </div>
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-gray-400">Attachments:</span>
                                  <span className="text-gray-900">{formData.mediaFile || formData.mediaUrl ? 'YES' : 'NONE'}</span>
                               </div>
                               <div className="flex justify-between items-center text-sm font-bold">
                                  <span className="text-gray-400">Estimated Delivery:</span>
                                  <span className="text-gray-900">~{Math.ceil(formData.numbers.split(/[\n,]/).filter(n => n.trim()).length * 3 / 60)} min</span>
                               </div>
                            </div>
                        </div>
                      </div>

                      <div className="bg-[#E7F8F2] rounded-[2.5rem] p-8 relative overflow-hidden flex flex-col h-full border border-[#D1F1E8]">
                         <div className="absolute top-0 left-0 right-0 h-14 bg-white/50 backdrop-blur-sm border-b border-white/30 flex items-center px-6">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3 shadow-sm">
                               <Smartphone size={16} className="text-white" />
                            </div>
                            <span className="font-black text-xs text-green-900">WHATSAPP PREVIEW</span>
                         </div>

                         <div className="mt-12 flex-1 flex flex-col justify-center">
                            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm relative self-start max-w-[90%]">
                               {formData.mediaFile || formData.mediaUrl ? (
                                 <div className="aspect-video bg-gray-100 rounded-xl mb-3 overflow-hidden flex items-center justify-center border">
                                    {formData.mediaFile && formData.mediaFile.type.startsWith('image/') ? (
                                      <img src={URL.createObjectURL(formData.mediaFile)} className="w-full h-full object-cover" />
                                    ) : (
                                      <ImageIcon size={32} className="text-gray-300" />
                                    )}
                                 </div>
                               ) : null}
                               <p className="text-xs text-gray-800 leading-relaxed font-medium break-words">
                                 {formData.message || 'Type a message to see preview...'}
                               </p>
                               <span className="text-[8px] text-gray-400 mt-2 block text-right font-black uppercase">10:45 AM</span>
                            </div>
                         </div>
                         <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-green-400/10 rounded-full blur-2xl" />
                      </div>
                   </div>
                </div>
              )}
            </div>

            <div className="p-8 border-t bg-gray-50/50 flex justify-between items-center">
              <button
                type="button"
                onClick={currentStep === 1 ? closeModal : prevStep}
                className="px-8 py-4 border-2 border-gray-200 rounded-2xl hover:bg-gray-100 font-black text-gray-500 transition-all flex items-center gap-2 active:scale-95"
              >
                <ChevronLeft size={20} />
                {currentStep === 1 ? 'CANCEL' : 'PREVIOUS'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={currentStep === 4 ? handleCreate : nextStep}
                className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center space-x-3 hover:bg-black transition-all shadow-xl disabled:opacity-50 active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>LAUNCHING...</span>
                  </>
                ) : (
                  <>
                    <span>{currentStep === 4 ? 'START CAMPAIGN' : 'NEXT STEP'}</span>
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
