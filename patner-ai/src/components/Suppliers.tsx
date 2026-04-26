import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Supplier } from '../types';
import { Plus, Phone, Calendar, Trash2, UserCheck, AlertCircle, X, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { format, isAfter, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

export const Suppliers: React.FC = () => {
  const { profile, activeBusiness } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const q = query(
      collection(db, 'suppliers'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sups: Supplier[] = [];
      snapshot.forEach((doc) => {
        sups.push({ id: doc.id, ...doc.data() } as Supplier);
      });
      setSuppliers(sups);
    });

    return () => unsubscribe();
  }, [activeBusiness?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id) return;
    setIsSaving(true);

    try {
      await addDoc(collection(db, 'suppliers'), {
        name,
        phone,
        debtAmount: Number(debtAmount),
        dueDate,
        businessId: activeBusiness.id,
      });
      toast.success('Supplier ameongezwa!');
      setIsModalOpen(false);
      setName('');
      setPhone('');
      setDebtAmount('');
      setDueDate('');
    } catch (error) {
      toast.error('Imeshindikana kuongeza supplier');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteDoc(doc(db, 'suppliers', supplierToDelete));
      toast.success('Supplier amefutwa!');
      setSupplierToDelete(null);
    } catch (error) {
      toast.error('Imeshindikana kufuta supplier');
    }
  };

  const totalDebt = suppliers.reduce((sum, s) => sum + s.debtAmount, 0);

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Wasambazaji (Suppliers)</h2>
          <p className="text-gray-600 font-medium mt-1">Simamia madeni na mawasiliano ya wasambazaji wako</p>
        </motion.div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="apple-button-primary w-fit"
        >
          <Plus size={20} />
          Sajili Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="apple-card p-8 bg-[#FF3B30]/5 border-[#FF3B30]/10"
        >
          <div className="w-12 h-12 bg-[#FF3B30]/10 text-[#FF3B30] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <AlertCircle size={24} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">Jumla ya Madeni</p>
          <h4 className="text-3xl font-sans font-black text-[#FF3B30] tracking-tight">Tsh {totalDebt.toLocaleString()}</h4>
          <p className="text-[11px] font-medium text-gray-600/60 mt-2">Deni unalodaiwa na wasambazaji</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="apple-card p-8 bg-[#007AFF]/5 border-[#007AFF]/10"
        >
          <div className="w-12 h-12 bg-[#007AFF]/10 text-[#007AFF] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <Users size={24} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">Wasambazaji</p>
          <h4 className="text-3xl font-sans font-black text-[#007AFF] tracking-tight">{suppliers.length}</h4>
          <p className="text-[11px] font-medium text-gray-600/60 mt-2">Wasambazaji waliosajiliwa</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {suppliers.map((supplier, i) => {
          const isOverdue = supplier.dueDate && isAfter(new Date(), parseISO(supplier.dueDate));
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              key={supplier.id}
              className="apple-card p-8 relative group hover:scale-[1.02] transition-all duration-300"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 bg-[#F2F2F7] rounded-2xl flex items-center justify-center text-gray-600 group-hover:bg-[#007AFF]/10 group-hover:text-[#007AFF] transition-all">
                  <UserCheck size={28} />
                </div>
                <div>
                  <h3 className="font-bold text-black text-xl tracking-tight">{supplier.name}</h3>
                  <div className="flex items-center gap-2 text-gray-600 text-[13px] font-medium mt-1">
                    <Phone size={14} className="text-[#007AFF]" />
                    <span>{supplier.phone || 'Hana namba'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[11px] text-gray-600 uppercase font-bold tracking-[0.2em] mb-2">Deni Linalodaiwa</p>
                    <p className="text-2xl font-sans font-black text-[#FF3B30] tracking-tight">Tsh {supplier.debtAmount.toLocaleString()}</p>
                  </div>
                  {supplier.dueDate && (
                    <div className="text-right">
                      <p className="text-[11px] text-gray-600 uppercase font-bold tracking-[0.2em] mb-2">Tarehe ya Kulipa</p>
                      <div className={cn(
                        "flex items-center gap-1.5 font-bold text-[13px]",
                        isOverdue ? "text-[#FF3B30]" : "text-black"
                      )}>
                        <Calendar size={14} />
                        <span>{format(parseISO(supplier.dueDate), 'dd MMM, yyyy')}</span>
                      </div>
                    </div>
                  )}
                </div>

                {isOverdue && (
                  <div className="bg-[#FF3B30]/10 text-[#FF3B30] p-4 rounded-2xl flex items-center gap-3 text-[13px] font-bold">
                    <AlertCircle size={18} />
                    <span>Deni hili limechelewa kulipwa!</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setSupplierToDelete(supplier.id)}
                className="absolute top-6 right-6 p-2 text-[#8E8E93] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </motion.div>
          );
        })}
        {suppliers.length === 0 && (
          <div className="col-span-full py-20 text-center apple-card">
            <div className="w-20 h-20 bg-[#F2F2F7] rounded-[24px] flex items-center justify-center mx-auto mb-6 text-gray-600">
              <Users size={32} />
            </div>
            <p className="text-gray-600 font-medium">Hakuna wasambazaji waliosajiliwa bado.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white/90 backdrop-blur-xl p-10 rounded-[40px] max-w-md w-full shadow-2xl border border-white/20"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-sans font-black text-black tracking-tight">Sajili Supplier Mpya</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#F2F2F7] rounded-full transition-all">
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Jina la Supplier</label>
                  <input
                    type="text"
                    required
                    className="apple-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mfano: Kiwanda cha Soda"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Namba ya Simu</label>
                  <input
                    type="tel"
                    className="apple-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712 345 678"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Deni (Tsh)</label>
                  <input
                    type="number"
                    required
                    className="apple-input"
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Tarehe ya Kulipa</label>
                  <input
                    type="date"
                    className="apple-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 apple-button-secondary"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 apple-button-primary"
                  >
                    {isSaving ? 'Inahifadhi...' : 'Sajili'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {supplierToDelete && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white/90 backdrop-blur-xl p-10 rounded-[40px] max-w-sm w-full shadow-2xl border border-white/20 text-center"
            >
              <div className="w-20 h-20 bg-[#FF3B30]/10 text-[#FF3B30] rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-sm">
                <AlertCircle size={36} />
              </div>
              <h3 className="text-2xl font-sans font-black text-[#1C1C1E] mb-3 tracking-tight">Futa Supplier?</h3>
              <p className="text-[#8E8E93] font-medium mb-10 leading-relaxed">Una uhakika unataka kufuta supplier huyu? Kitendo hiki hakiwezi kurudishwa.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setSupplierToDelete(null)}
                  className="flex-1 apple-button-secondary"
                >
                  Hapana
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-[#FF3B30] text-white font-bold rounded-2xl px-6 py-4 shadow-lg shadow-[#FF3B30]/20 hover:bg-[#D70015] transition-all active:scale-[0.97]"
                >
                  Futa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
