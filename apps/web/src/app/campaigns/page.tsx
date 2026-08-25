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
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getStatusBadge = (status: string, scheduledAt?: string) => {
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      return <span className="bg-amber-100 text-yellow-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center"><Clock size={10} className="mr-1" /> Scheduled</span>;
    }
    switch (status) {
      case 'completed': return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Completed</span>;
      case 'processing': return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center"><Loader2 size={10} className="animate-spin mr-1" /> Processing</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Pending</span>;
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <Loader2 size={32} className="text-primary animate-spin" />
      <p className="text-gray-500 text-sm font-medium">Loading campaigns...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Campaigns</h2>
          <p className="text-gray-500 text-sm font-medium">Monitor your bulk messaging performance</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-primary-dark transition-all shadow-md active:scale-95"
        >
          <Plus size={20} />
          <span>NEW CAMPAIGN</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {campaigns.map((campaign: any) => (
          <div key={campaign.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group">
            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                  {getStatusBadge(campaign.status, campaign.scheduledAt)}
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center bg-gray-50 px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-500 border border-gray-100">
                    <Clock size={12} className="mr-1.5 text-primary" /> {formatDate(campaign.createdAt)}
                  </div>
                  <div className="flex items-center bg-gray-50 px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-500 border border-gray-100">
                    <Users size={12} className="mr-1.5 text-primary" /> {campaign.totalContacts} Contacts
                  </div>
                  {campaign.mediaUrl && (
                    <div className="flex items-center bg-purple-50 px-2.5 py-1 rounded-lg text-[11px] font-bold text-purple-600 border border-purple-100">
                      <ImageIcon size={12} className="mr-1.5" /> Media Included
                    </div>
                  )}
                  {campaign.scheduledAt && new Date(campaign.scheduledAt) > new Date() && (
                    <div className="flex items-center bg-amber-50 px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-600 border border-amber-100">
                      <Calendar size={12} className="mr-1.5" /> {formatDate(campaign.scheduledAt)}
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-500 line-clamp-1 italic bg-gray-50/50 p-2 rounded-lg border border-dashed border-gray-200">
                  "{campaign.message || 'No text message'}"
                </p>
              </div>

              <div className="flex items-center gap-8 bg-gray-50/30 p-4 rounded-xl border border-gray-100/50">
                <div className="text-center">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Delivered</p>
                  <p className="text-2xl font-bold text-emerald-600 leading-none">{campaign.sentCount}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-1">Failed</p>
                  <p className="text-2xl font-bold text-rose-500 leading-none">{campaign.failedCount}</p>
                </div>
                <div className="h-10 w-px bg-gray-200 hidden md:block" />
                <button
                  onClick={() => deleteCampaign(campaign.id)}
                  className="p-2.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                  title="Delete Campaign"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <div className="h-1.5 bg-gray-50 w-full">
              <div
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${(campaign.sentCount / (campaign.totalContacts || 1)) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {campaigns.length === 0 && (
          <div className="py-20 text-center bg-white rounded-2xl border-2 border-dashed border-gray-100">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database size={32} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No campaigns yet</h3>
            <p className="text-gray-500 text-sm font-medium">Click "New Campaign" to get started</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <Layout className="text-primary" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">New Bulk Campaign</h3>
                  <div className="flex items-center space-x-1.5 mt-1">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1 w-6 rounded-full transition-all duration-300 ${
                          currentStep >= step ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 min-h-[400px]">
              {/* STEP 1: BASIC INFO */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <FileText size={14} className="text-primary" /> Campaign Name
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-base"
                        placeholder="e.g. Monthly Newsletter"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-primary" /> Message Content
                      </label>
                      <textarea
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium h-40 resize-none text-base"
                        placeholder="Hello {{name}}, check our latest offer!"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      />
                      <div className="flex justify-between mt-2 px-1">
                         <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Characters: {formData.message.length}</span>
                         <span className="text-[10px] text-gray-400 font-bold uppercase italic">Tip: Use emojis for better engagement 🚀</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: MEDIA */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
                   <div className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100 border-dashed">
                      <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-purple-50">
                           <ImageIcon className="text-purple-500" size={24} />
                        </div>
                        <h4 className="text-base font-bold text-purple-900">Add Visual Media</h4>
                        <p className="text-purple-600 text-xs font-medium">Images and videos get more attention.</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <button
                          type="button"
                          onClick={() => mediaInputRef.current?.click()}
                          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                            formData.mediaFile ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-white border-purple-100 text-gray-600 hover:bg-purple-50'
                          }`}
                        >
                          <FileUp size={18} />
                          <div className="text-left flex-1 overflow-hidden">
                            <p className="text-sm font-bold">{formData.mediaFile ? 'Media Selected' : 'Upload from Device'}</p>
                            {formData.mediaFile && <p className="text-[10px] truncate opacity-80">{formData.mediaFile.name}</p>}
                          </div>
                          {formData.mediaFile && <X size={16} className="text-white/80" onClick={(e) => {e.stopPropagation(); setFormData({...formData, mediaFile: null})}} />}
                        </button>
                        <input type="file" ref={mediaInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*,application/*" />

                        <div className="relative">
                          <input
                            type="text"
                            className="w-full pl-4 pr-10 py-4 bg-white border border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-200 outline-none transition-all font-medium text-sm"
                            placeholder="Or paste direct media URL..."
                            value={formData.mediaUrl}
                            onChange={(e) => setFormData({ ...formData, mediaUrl: e.target.value })}
                          />
                          <Layout className="absolute right-3.5 top-1/2 -translate-y-1/2 text-purple-300" size={16} />
                        </div>
                      </div>

                      {(formData.mediaUrl || formData.mediaFile) && (
                        <div className="mt-5 pt-5 border-t border-purple-100">
                           <label className="block text-[10px] font-bold text-purple-900 uppercase tracking-widest mb-2 ml-1">Media Type</label>
                           <div className="flex bg-white p-1 rounded-xl border border-purple-100">
                              {['image', 'video', 'audio', 'document'].map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setFormData({...formData, mediaType: type})}
                                  className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                    formData.mediaType === type ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-400 hover:bg-purple-50'
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
                <div className="space-y-5 animate-in slide-in-from-right-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                           <Smartphone size={14} className="text-primary" /> Recipient Numbers
                        </label>
                        <span className="text-[9px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                           {formData.numbers.split(/[\n,]/).filter(n => n.trim()).length} LOADED
                        </span>
                      </div>
                      <textarea
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-mono text-[11px] h-[260px] resize-none"
                        placeholder="919876543210&#10;919988776655&#10;..."
                        value={formData.numbers}
                        onChange={(e) => setFormData({ ...formData, numbers: e.target.value })}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 border-dashed text-center">
                         <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-3 mx-auto shadow-sm border border-emerald-50">
                            <FileUp className="text-emerald-500" size={20} />
                         </div>
                         <h4 className="text-sm font-bold text-emerald-900">Excel Import</h4>
                         <p className="text-emerald-600 text-[10px] font-medium mb-4 leading-relaxed">Import contacts from a spreadsheet instantly.</p>

                         <input type="file" ref={fileInputRef} onChange={handleExcelUpload} className="hidden" accept=".xlsx, .xls" />
                         <button
                           type="button"
                           onClick={() => fileInputRef.current?.click()}
                           className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-[11px] shadow-sm hover:bg-emerald-700 transition-all active:scale-95 w-full"
                         >
                           CHOOSE EXCEL FILE
                         </button>
                         <p className="mt-3 text-[9px] text-emerald-400 font-bold uppercase tracking-tight">Requires "Number" column</p>
                      </div>

                      <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                         <h5 className="text-[10px] font-bold text-blue-900 uppercase tracking-widest mb-3">Checklist</h5>
                         <ul className="text-[10px] text-blue-600 font-medium space-y-2.5">
                           <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-blue-500" /> Include Country Code (91)</li>
                           <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-blue-500" /> New lines or commas</li>
                           <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-blue-500" /> Duplicates auto-removed</li>
                         </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: SUMMARY & PREVIEW */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Schedule Launch</h4>
                           <div className="relative">
                              <input
                                type="datetime-local"
                                className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-primary outline-none rounded-xl transition-all font-bold text-sm"
                                value={formData.scheduledAt}
                                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                              />
                              <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" size={16} />
                           </div>
                           <p className="mt-2.5 text-[10px] text-gray-500 font-bold italic px-1 leading-relaxed">
                              {formData.scheduledAt ? 'Campaign will launch at the selected date & time.' : 'Campaign will start IMMEDIATELY after you click start.'}
                           </p>
                        </div>

                        <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10">
                            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3 ml-1">Quick Overview</h4>
                            <div className="space-y-2.5">
                               <div className="flex justify-between items-center text-[12px] font-bold">
                                  <span className="text-gray-400">Total Recipients:</span>
                                  <span className="text-gray-900">{formData.numbers.split(/[\n,]/).filter(n => n.trim()).length}</span>
                               </div>
                               <div className="flex justify-between items-center text-[12px] font-bold">
                                  <span className="text-gray-400">Media Attached:</span>
                                  <span className="text-gray-900">{formData.mediaFile || formData.mediaUrl ? 'YES' : 'NO'}</span>
                               </div>
                               <div className="flex justify-between items-center text-[12px] font-bold border-t border-primary/10 pt-2 mt-2">
                                  <span className="text-gray-400 font-black">Est. Delivery:</span>
                                  <span className="text-primary">~{Math.ceil(formData.numbers.split(/[\n,]/).filter(n => n.trim()).length * 2.5 / 60)} Minutes</span>
                               </div>
                            </div>
                        </div>
                      </div>

                      <div className="bg-[#E7F8F2]/60 rounded-3xl p-6 relative overflow-hidden flex flex-col border border-[#D1F1E8]">
                         <div className="flex items-center mb-4 bg-white/60 p-2 rounded-xl border border-white/50 backdrop-blur-sm">
                            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center mr-2 shadow-sm">
                               <Smartphone size={14} className="text-white" />
                            </div>
                            <span className="font-bold text-[10px] text-emerald-900 uppercase tracking-tight">WhatsApp Live Preview</span>
                         </div>

                         <div className="flex-1 flex flex-col justify-center pb-4">
                            <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm relative self-start max-w-full border border-gray-100">
                               {(formData.mediaFile || formData.mediaUrl) && (
                                 <div className="aspect-square bg-gray-50 rounded-lg mb-2.5 overflow-hidden flex items-center justify-center border border-gray-50">
                                    {formData.mediaFile && formData.mediaFile.type.startsWith('image/') ? (
                                      <img src={URL.createObjectURL(formData.mediaFile)} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="text-center p-4">
                                        <ImageIcon size={24} className="text-gray-300 mx-auto mb-1" />
                                        <p className="text-[9px] text-gray-400 font-bold">{formData.mediaType.toUpperCase()}</p>
                                      </div>
                                    )}
                                 </div>
                               )}
                               <p className="text-[12px] text-gray-800 leading-relaxed font-medium break-words whitespace-pre-wrap">
                                 {formData.message || 'Type a message to see how it looks...'}
                               </p>
                               <span className="text-[8px] text-gray-400 mt-2 block text-right font-bold">12:30 PM</span>
                            </div>
                         </div>
                         <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-emerald-400/10 rounded-full blur-2xl" />
                      </div>
                   </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50/50 flex justify-between items-center">
              <button
                type="button"
                onClick={currentStep === 1 ? closeModal : prevStep}
                className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-100 font-bold text-xs text-gray-500 transition-all flex items-center gap-2 active:scale-95"
              >
                <ChevronLeft size={16} />
                {currentStep === 1 ? 'CANCEL' : 'PREVIOUS'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={currentStep === 4 ? handleCreate : nextStep}
                className="bg-gray-900 text-white px-8 py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 hover:bg-black transition-all shadow-lg shadow-gray-200 disabled:opacity-50 active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>LAUNCHING...</span>
                  </>
                ) : (
                  <>
                    <span>{currentStep === 4 ? 'START CAMPAIGN' : 'NEXT STEP'}</span>
                    <ChevronRight size={16} />
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
