import React, { useState } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Business } from '../types';
import { Plus, Store, MapPin, Phone, Trash2, Edit2, CheckCircle2, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export const Branches: React.FC = () => {
  const { user, businesses, activeBusiness, setActiveBusiness } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Business | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    managerPin: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      if (editingBranch) {
        await updateDoc(doc(db, 'businesses', editingBranch.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        toast.success('Duka limehaririwa!');
      } else {
        await addDoc(collection(db, 'businesses'), {
          ...formData,
          ownerUid: user.uid,
          createdAt: new Date().toISOString(),
          isMain: businesses.length === 0
        });
        toast.success('Duka jipya limeongezwa!');
      }
      setIsAdding(false);
      setEditingBranch(null);
      setFormData({ name: '', address: '', phone: '', managerPin: '' });
    } catch (error) {
      toast.error('Imeshindikana kuhifadhi duka.');
    }
  };

  const handleDelete = async (id: string) => {
    if (businesses.length <= 1) {
      toast.error('Huwezi kufuta duka lako pekee.');
      return;
    }
    if (!window.confirm('Una uhakika unataka kufuta duka hili?')) return;

    try {
      await deleteDoc(doc(db, 'businesses', id));
      toast.success('Duka limefutwa!');
    } catch (error) {
      toast.error('Imeshindikana kufuta duka.');
    }
  };

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Maduka Yako</h2>
          <p className="text-gray-600 font-medium mt-1">Simamia matawi yako yote sehemu moja</p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setIsAdding(true)}
          className="apple-button-primary px-8 py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-[#007AFF]/20 group"
        >
          <div className="p-1 bg-white/20 rounded-lg group-hover:rotate-90 transition-all duration-500">
            <Plus size={20} />
          </div>
          <span className="text-lg">Duka Jipya</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {businesses.map((biz, i) => (
          <motion.div
            key={biz.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`apple-card p-8 transition-all duration-500 relative overflow-hidden group ${
              activeBusiness?.id === biz.id ? 'ring-2 ring-[#007AFF] shadow-2xl shadow-[#007AFF]/10' : 'hover:shadow-xl'
            }`}
          >
            {activeBusiness?.id === biz.id && (
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#007AFF]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            )}
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                activeBusiness?.id === biz.id ? 'bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/30' : 'bg-[#F2F2F7] text-gray-600'
              }`}>
                <Store size={28} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingBranch(biz);
                    setFormData({ 
                      name: biz.name, 
                      address: biz.address || '', 
                      phone: biz.phone || '',
                      managerPin: biz.managerPin || ''
                    });
                    setIsAdding(true);
                  }}
                  className="p-2.5 bg-[#F2F2F7] text-gray-600 hover:bg-white hover:text-[#007AFF] hover:shadow-md rounded-xl transition-all duration-300"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(biz.id)}
                  className="p-2.5 bg-[#F2F2F7] text-gray-600 hover:bg-[#FF3B30]/10 hover:text-[#FF3B30] hover:shadow-md rounded-xl transition-all duration-300"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <h3 className="text-2xl font-sans font-black text-black mb-4 tracking-tight group-hover:text-[#007AFF] transition-colors">{biz.name}</h3>
            
            <div className="space-y-3 mb-8 relative z-10">
              <div className="flex items-center gap-3 text-gray-600 font-medium">
                <div className="w-8 h-8 bg-[#F2F2F7] rounded-lg flex items-center justify-center">
                  <MapPin size={16} />
                </div>
                <span className="text-sm">{biz.address || 'Haikuwekwa'}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 font-medium">
                <div className="w-8 h-8 bg-[#F2F2F7] rounded-lg flex items-center justify-center">
                  <Phone size={16} />
                </div>
                <span className="text-sm">{biz.phone || 'Haikuwekwa'}</span>
              </div>
            </div>

            <button
              onClick={() => setActiveBusiness(biz)}
              disabled={activeBusiness?.id === biz.id}
              className={`w-full py-4 rounded-2xl font-bold transition-all duration-500 flex items-center justify-center gap-3 relative z-10 ${
                activeBusiness?.id === biz.id
                  ? 'bg-[#34C759]/10 text-[#34C759] cursor-default'
                  : 'bg-[#F2F2F7] text-black hover:bg-white hover:shadow-lg active:scale-[0.98]'
              }`}
            >
              {activeBusiness?.id === biz.id ? (
                <>
                  <CheckCircle2 size={20} />
                  Duka Amilifu
                </>
              ) : (
                'Tumia Duka Hili'
              )}
            </button>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-xl rounded-[40px] p-10 w-full max-w-md shadow-2xl border border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-3xl font-sans font-black text-black tracking-tight">
                  {editingBranch ? 'Hariri Duka' : 'Duka Jipya'}
                </h3>
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingBranch(null);
                  }}
                  className="p-2 bg-[#F2F2F7] hover:bg-white rounded-full transition-all shadow-sm"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Jina la Duka</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="apple-input"
                    placeholder="Mf. Duka la Kariakoo"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Mahali (Address)</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="apple-input"
                    placeholder="Mf. Mtaa wa Aggrey"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Namba ya Simu</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="apple-input"
                    placeholder="Mf. 0712345678"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Manager PIN (Namba 4)</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={formData.managerPin}
                    onChange={(e) => setFormData({ ...formData, managerPin: e.target.value.replace(/\D/g, '') })}
                    className="apple-input tracking-[0.5em] text-center text-2xl"
                    placeholder="••••"
                  />
                  <div className="flex items-start gap-2 mt-3 p-3 bg-[#F2F2F7] rounded-2xl border border-black/[0.02]">
                    <AlertCircle size={14} className="text-gray-600 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-gray-600 font-medium leading-relaxed italic">
                      PIN hii itatumika na Cashier kufanya miamala nyeti kama kutoa bidhaa kwenye kapu au kutoa punguzo.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingBranch(null);
                    }}
                    className="flex-1 apple-button-secondary"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    className="flex-1 apple-button-primary"
                  >
                    {editingBranch ? 'Hifadhi' : 'Ongeza'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
