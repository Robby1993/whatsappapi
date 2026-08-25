'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Plus,
  Trash2,
  Edit3,
  Zap,
  MessageCircle,
  Type,
  Image as ImageIcon,
  List as ListIcon,
  PlaySquare,
  ChevronDown,
  ChevronUp,
  X,
  Smartphone,
  Save,
  ArrowRight,
  MousePointer2,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface FlowStep {
  type: string;
  message: string;
  mediaUrl?: string;
  wait: boolean;
  key?: string;
}

export default function ChatFlowsPage() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    triggerKeywords: [] as string[],
    steps: [] as FlowStep[],
    botPhone: '',
    isActive: true
  });

  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    fetchFlows();
  }, []);

  const fetchFlows = async () => {
    try {
      const response = await api.get('/chatflows');
      if (response.data.status) {
        setFlows(response.data.result);
      }
    } catch (error) {
      toast.error('Failed to fetch chat flows');
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    const newStep: FlowStep = {
      type: 'text',
      message: '',
      mediaUrl: '',
      wait: false,
      key: ''
    };
    setFormData({ ...formData, steps: [...formData.steps, newStep] });
  };

  const removeStep = (index: number) => {
    const newSteps = [...formData.steps];
    newSteps.splice(index, 1);
    setFormData({ ...formData, steps: newSteps });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setFormData({ ...formData, steps: newSteps });
  };

  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    if (formData.triggerKeywords.includes(keywordInput.trim().toLowerCase())) {
      setKeywordInput('');
      return;
    }
    setFormData({
      ...formData,
      triggerKeywords: [...formData.triggerKeywords, keywordInput.trim().toLowerCase()]
    });
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setFormData({
      ...formData,
      triggerKeywords: formData.triggerKeywords.filter(k => k !== kw)
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.triggerKeywords.length === 0) {
      toast.error('Please add at least one trigger keyword');
      return;
    }
    if (formData.steps.length === 0) {
      toast.error('Please add at least one step');
      return;
    }

    try {
      if (editingId) {
        await api.put(`/chatflows/${editingId}`, formData);
        toast.success('ChatFlow updated');
      } else {
        await api.post('/chatflows', formData);
        toast.success('ChatFlow created');
      }
      closeModal();
      fetchFlows();
    } catch (error) {
      toast.error('Failed to save ChatFlow');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      name: '',
      triggerKeywords: [],
      steps: [],
      botPhone: '',
      isActive: true
    });
    setKeywordInput('');
  };

  const deleteFlow = async (id: number) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    try {
      await api.delete(`/chatflows/${id}`);
      toast.success('ChatFlow deleted');
      fetchFlows();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const editFlow = (flow: any) => {
    setEditingId(flow.id);
    setFormData({
      name: flow.name || '',
      triggerKeywords: flow.triggerKeywords || [],
      steps: flow.steps || [],
      botPhone: flow.botPhone || '',
      isActive: flow.isActive
    });
    setIsModalOpen(true);
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'text': return <Type size={14} />;
      case 'image': return <ImageIcon size={14} />;
      case 'video': return <PlaySquare size={14} />;
      default: return <MessageCircle size={14} />;
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <Loader2 size={32} className="text-primary animate-spin" />
      <p className="text-gray-500 text-sm font-medium">Syncing ChatFlows...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-2xl border shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">ChatBots (Flows)</h2>
          <p className="text-gray-500 text-sm font-medium">Create interactive automated conversations</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-primary-dark transition-all shadow-md active:scale-95"
        >
          <Plus size={20} />
          <span>CREATE CHATBOT</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flows.map((flow: any) => (
          <div key={flow.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all relative group flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
               <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                 <Zap size={20} fill="currentColor" />
               </div>
               <div className="flex items-center gap-2">
                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${flow.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                   {flow.isActive ? 'Live' : 'Off'}
                 </span>
                 <button onClick={() => editFlow(flow)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all">
                    <Edit3 size={16} />
                 </button>
               </div>
            </div>

            <div className="flex-1 space-y-3">
              <h3 className="font-bold text-gray-900 line-clamp-1">{flow.name || 'Untitled Bot'}</h3>

              <div className="flex flex-wrap gap-1.5">
                {flow.triggerKeywords.slice(0, 3).map((kw: string) => (
                  <span key={kw} className="text-[10px] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg font-bold text-gray-500 italic">#{kw}</span>
                ))}
                {flow.triggerKeywords.length > 3 && <span className="text-[10px] text-gray-300 font-bold">+{flow.triggerKeywords.length - 3} more</span>}
              </div>

              <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                 <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                   <span>Conversation Path</span>
                   <span>{flow.steps.length} Steps</span>
                 </p>
                 <div className="space-y-1.5">
                    {flow.steps.slice(0, 2).map((step: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-gray-600">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                         <span className="truncate">{step.message || 'Media content'}</span>
                      </div>
                    ))}
                    {flow.steps.length > 2 && <p className="text-[10px] text-gray-400 font-medium pl-3.5">...and {flow.steps.length - 2} more actions</p>}
                 </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
               <div className="flex items-center gap-1.5 text-gray-400">
                  <Smartphone size={12} />
                  <span className="text-[10px] font-bold">{flow.botPhone || 'All Bots'}</span>
               </div>
               <button onClick={() => deleteFlow(flow.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 size={16} />
               </button>
            </div>
          </div>
        ))}

        {flows.length === 0 && (
          <div className="col-span-full py-24 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
               <MessageCircle size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-bold text-lg mb-1">No chatbots active</p>
            <p className="text-gray-400 text-sm max-w-xs mx-auto">Create keywords and response paths to handle your customers 24/7.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-xl">
                  <Zap className="text-primary" size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">{editingId ? 'Refine ChatBot' : 'New Interactive Bot'}</h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Logic & Conversation Builder</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-gray-200 rounded-xl transition-colors text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Triggers */}
                <div className="lg:col-span-1 space-y-6">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Internal Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm"
                      placeholder="e.g. Sales Assistant"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Assign to Bot (Optional)</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm"
                      placeholder="91XXXXXXXXXX or leave empty for all"
                      value={formData.botPhone}
                      onChange={(e) => setFormData({ ...formData, botPhone: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Trigger Keywords</label>
                    <div className="flex gap-2 mb-3">
                       <input
                         type="text"
                         className="flex-1 px-4 py-2 bg-gray-50 border border-gray-100 rounded-lg outline-none text-xs font-bold"
                         placeholder="Type keyword..."
                         value={keywordInput}
                         onChange={(e) => setKeywordInput(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                       />
                       <button type="button" onClick={addKeyword} className="bg-gray-900 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                       {formData.triggerKeywords.map(kw => (
                         <span key={kw} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-[11px] font-bold group border border-blue-100">
                           {kw}
                           <X size={12} className="cursor-pointer hover:text-rose-500" onClick={() => removeKeyword(kw)} />
                         </span>
                       ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t">
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border">
                       <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${formData.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                          <span className="text-xs font-bold text-gray-700">Bot Status: {formData.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                       </div>
                       <div
                         onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                         className={`w-10 h-5 rounded-full relative cursor-pointer transition-all ${formData.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                       >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${formData.isActive ? 'right-0.5' : 'left-0.5'}`} />
                       </div>
                    </div>
                  </div>
                </div>

                {/* Right: Flow Steps */}
                <div className="lg:col-span-2 space-y-6">
                   <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Conversation Path Steps</label>
                      <button type="button" onClick={addStep} className="text-primary font-black text-[11px] uppercase flex items-center gap-1 hover:underline">
                         <Plus size={14} /> Add Step
                      </button>
                   </div>

                   <div className="space-y-4">
                      {formData.steps.map((step, index) => (
                        <div key={index} className="bg-gray-50/50 rounded-2xl border border-gray-100 p-5 relative group/step animate-in slide-in-from-bottom-2 duration-300">
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[10px] font-black">
                                   {index + 1}
                                 </div>
                                 <select
                                   className="bg-white border-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-tight outline-none focus:ring-2 focus:ring-primary/20"
                                   value={step.type}
                                   onChange={(e) => updateStep(index, 'type', e.target.value)}
                                 >
                                    <option value="text">Text Message</option>
                                    <option value="image">Send Image</option>
                                    <option value="video">Send Video</option>
                                    <option value="audio">Send Audio</option>
                                    <option value="document">Send Doc</option>
                                 </select>
                              </div>
                              <button onClick={() => removeStep(index)} className="text-rose-400 hover:text-rose-600 transition-colors">
                                 <Trash2 size={16} />
                              </button>
                           </div>

                           <div className="grid grid-cols-1 gap-4">
                              <textarea
                                className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                rows={2}
                                placeholder={step.type === 'text' ? "What should the bot say?" : "Add a caption (optional)"}
                                value={step.message}
                                onChange={(e) => updateStep(index, 'message', e.target.value)}
                              />

                              {step.type !== 'text' && (
                                <input
                                  type="text"
                                  className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold outline-none"
                                  placeholder="Enter Media URL (https://...)"
                                  value={step.mediaUrl || ''}
                                  onChange={(e) => updateStep(index, 'mediaUrl', e.target.value)}
                                />
                              )}

                              <div className="flex items-center justify-between pt-2">
                                 <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                       <div
                                         onClick={() => updateStep(index, 'wait', !step.wait)}
                                         className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${step.wait ? 'bg-primary border-primary' : 'bg-white border-gray-200 group-hover:border-primary'}`}
                                       >
                                          {step.wait && <X size={10} className="text-white" strokeWidth={5} />}
                                       </div>
                                       <span className="text-[10px] font-black text-gray-500 uppercase tracking-tight">Wait for user input</span>
                                    </label>

                                    {step.wait && (
                                      <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                                         <span className="text-[10px] font-black text-gray-300 uppercase italic">Save to key:</span>
                                         <input
                                           type="text"
                                           className="w-20 px-2 py-1 bg-white border border-gray-100 rounded text-[10px] font-bold outline-none uppercase"
                                           placeholder="e.g. name"
                                           value={step.key || ''}
                                           onChange={(e) => updateStep(index, 'key', e.target.value)}
                                         />
                                      </div>
                                    )}
                                 </div>
                              </div>
                           </div>
                        </div>
                      ))}

                      {formData.steps.length === 0 && (
                        <div onClick={addStep} className="py-12 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-gray-300 cursor-pointer hover:bg-gray-50 transition-all hover:border-primary/30">
                           <Plus size={32} />
                           <p className="text-xs font-black uppercase tracking-widest mt-2">Start Building the path</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50/50 flex justify-between items-center px-8">
               <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Complexity</span>
                     <div className="flex gap-0.5 mt-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className={`h-1 w-4 rounded-full ${i <= formData.steps.length ? 'bg-blue-400' : 'bg-gray-200'}`} />
                        ))}
                     </div>
                  </div>
               </div>

               <div className="flex gap-3">
                  <button onClick={closeModal} className="px-6 py-3 rounded-xl text-[11px] font-black uppercase text-gray-400 hover:bg-gray-100 transition-all">Discard</button>
                  <button onClick={handleSave} className="bg-gray-900 text-white px-8 py-3 rounded-xl text-[11px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-black active:scale-95 transition-all">
                     <Save size={16} />
                     <span>{editingId ? 'Update Bot' : 'Save ChatBot'}</span>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
