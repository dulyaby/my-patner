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
import { Expense } from '../types';
import { Plus, Receipt, Trash2, Wallet, Calendar, X, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

export const Expenses: React.FC = () => {
  const { profile, activeBusiness } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Mengineyo');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const q = query(
      collection(db, 'expenses'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exps: Expense[] = [];
      snapshot.forEach((doc) => {
        exps.push({ id: doc.id, ...doc.data() } as Expense);
      });
      // Sort by date descending
      exps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setExpenses(exps);
    });

    return () => unsubscribe();
  }, [activeBusiness?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id) return;
    setIsSaving(true);

    try {
      await addDoc(collection(db, 'expenses'), {
        description,
        amount: Number(amount),
        category,
        businessId: activeBusiness.id,
        timestamp: new Date().toISOString()
      });
      toast.success('Matumizi yamehifadhiwa!');
      setIsModalOpen(false);
      setDescription('');
      setAmount('');
      setCategory('Mengineyo');
    } catch (error) {
      toast.error('Imeshindikana kuhifadhi matumizi');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete));
      toast.success('Rekodi imefutwa!');
      setExpenseToDelete(null);
    } catch (error) {
      toast.error('Imeshindikana kufuta rekodi');
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Matumizi (Expenses)</h2>
          <p className="text-gray-600 font-medium mt-1">Rekodi gharama zote za uendeshaji wa biashara yako</p>
        </motion.div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="apple-button-primary w-fit"
        >
          <Plus size={20} />
          Rekodi Matumizi
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="apple-card p-8 bg-[#FF3B30]/5 border-[#FF3B30]/10"
        >
          <div className="w-12 h-12 bg-[#FF3B30]/10 text-[#FF3B30] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <Wallet size={24} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-2">Jumla ya Matumizi</p>
          <h4 className="text-3xl font-sans font-black text-black tracking-tight">Tsh {totalExpenses.toLocaleString()}</h4>
          <p className="text-[11px] font-medium text-gray-600/60 mt-2">Gharama zote zilizorekodiwa</p>
        </motion.div>
      </div>

      <div className="apple-card overflow-hidden">
        <div className="p-8 border-b border-black/[0.05] bg-white/50 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-sans font-black text-black tracking-tight">Orodha ya Matumizi</h3>
            <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mt-1">Rekodi za hivi karibuni</p>
          </div>
          <div className="bg-[#F2F2F7] px-4 py-2 rounded-full flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-widest">
            <Receipt size={14} />
            <span>{expenses.length} Rekodi</span>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-gray-600 border-b border-black/[0.03]">
                <th className="px-8 py-5 font-bold">Maelezo</th>
                <th className="px-8 py-5 font-bold">Kundi</th>
                <th className="px-8 py-5 font-bold">Tarehe</th>
                <th className="px-8 py-5 font-bold">Kiasi</th>
                <th className="px-8 py-5 font-bold text-right">Vitendo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.02]">
              {expenses.map((expense) => (
                <tr key={expense.id} className="group hover:bg-black/[0.01] transition-all duration-300">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#F2F2F7] rounded-xl flex items-center justify-center text-gray-600 group-hover:bg-[#FF3B30]/10 group-hover:text-[#FF3B30] transition-all">
                        <Receipt size={18} />
                      </div>
                      <span className="font-bold text-black text-[15px]">{expense.description}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-[#F2F2F7] text-gray-600 rounded-full text-[11px] font-bold uppercase tracking-wider">
                      {expense.category}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-gray-600 font-medium text-[13px]">
                      <Calendar size={14} />
                      {format(parseISO(expense.timestamp), 'dd MMM, yyyy')}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-[15px] font-black text-black">Tsh {expense.amount.toLocaleString()}</td>
                  <td className="px-8 py-6 text-right">
                    <button 
                      onClick={() => setExpenseToDelete(expense.id)}
                      className="p-2 text-gray-600 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="w-20 h-20 bg-[#F2F2F7] rounded-[24px] flex items-center justify-center mx-auto mb-6 text-gray-600">
                      <Receipt size={32} />
                    </div>
                    <p className="text-gray-600 font-medium">Hakuna rekodi za matumizi bado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                <h3 className="text-2xl font-sans font-black text-black tracking-tight">Rekodi Matumizi</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-[#F2F2F7] rounded-full transition-all">
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Maelezo ya Matumizi</label>
                  <input
                    type="text"
                    required
                    className="apple-input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mfano: Umeme wa mwezi huu"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Kiasi (Tsh)</label>
                  <input
                    type="number"
                    required
                    className="apple-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600 ml-1">Kundi (Category)</label>
                  <select
                    className="apple-input cursor-pointer"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Mishahara">Mishahara</option>
                    <option value="Kodi">Kodi</option>
                    <option value="Umeme/Maji">Umeme/Maji</option>
                    <option value="Usafiri">Usafiri</option>
                    <option value="Chakula">Chakula</option>
                    <option value="Mengineyo">Mengineyo</option>
                  </select>
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
                    {isSaving ? 'Inahifadhi...' : 'Hifadhi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {expenseToDelete && (
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
              <h3 className="text-2xl font-sans font-black text-black mb-3 tracking-tight">Futa Rekodi?</h3>
              <p className="text-gray-600 font-medium mb-10 leading-relaxed">Una uhakika unataka kufuta rekodi hii ya matumizi? Kitendo hiki hakiwezi kurudishwa.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setExpenseToDelete(null)}
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
