import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Sale, Adjustment } from '../types';
import { 
  Search, 
  History, 
  ChevronRight, 
  AlertCircle, 
  RotateCcw, 
  CheckCircle2,
  Calendar,
  User,
  Package,
  ArrowLeft,
  X,
  FileText,
  Clock,
  Minus,
  Plus,
  Filter,
  FilterX,
  ChevronDown,
  DollarSign
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { AdjustmentController } from '../api/adjustmentController';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export const SalesHistory: React.FC = () => {
  const { profile, activeBusiness } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCashier, setSelectedCashier] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [cashiers, setCashiers] = useState<{ uid: string; displayName: string }[]>([]);

  useEffect(() => {
    if (!activeBusiness) return;

    // Fetch cashiers/users for this business
    const usersQ = query(
      collection(db, 'users'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubUsers = onSnapshot(usersQ, (snapshot) => {
      const u = snapshot.docs.map(d => ({ uid: d.id, displayName: d.data().displayName || 'Unknown' }));
      setCashiers(u);
    });

    return () => unsubUsers();
  }, [activeBusiness]);

  // Adjustment form state
  const [adjReason, setAdjReason] = useState<'return' | 'error' | 'discount' | 'other'>('return');
  const [adjNote, setAdjNote] = useState('');
  const [adjItems, setAdjItems] = useState<{ productId: string; quantity: number; name: string; price: number }[]>([]);

  useEffect(() => {
    if (!activeBusiness) return;

    const q = query(
      collection(db, 'sales'),
      where('businessId', '==', activeBusiness.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSales(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Sale)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    return () => unsubscribe();
  }, [activeBusiness]);

  useEffect(() => {
    if (selectedSale) {
      fetchAdjustments(selectedSale.id);
    }
  }, [selectedSale?.id]);

  const fetchAdjustments = async (saleId: string) => {
    const result = await AdjustmentController.getSaleWithAdjustments(saleId);
    if (result.success && result.data) {
      setAdjustments(result.data.adjustments);
      setSelectedSale(result.data.sale);
    }
  };

  const handleStartAdjustment = () => {
    if (!selectedSale) return;
    setAdjItems(selectedSale.items.map(item => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: 0 // Start with 0 to adjust
    })));
    setIsAdjusting(true);
  };

  const handleCreateAdjustment = async () => {
    if (!profile || !selectedSale) return;

    const itemsToAdjust = adjItems.filter(i => i.quantity !== 0);
    if (itemsToAdjust.length === 0 && adjReason !== 'discount') {
      toast.error('Tafadhali chagua bidhaa za kurekebisha au weka punguzo.');
      return;
    }

    setIsSaving(true);
    // Calculate adjustment amount (negative for returns/discounts)
    const amount = itemsToAdjust.reduce((sum, i) => sum - (i.price * i.quantity), 0);

    const result = await AdjustmentController.createAdjustment(profile, {
      saleId: selectedSale.id,
      amount,
      reason: adjReason,
      note: adjNote,
      items: itemsToAdjust
    });

    if (result.success) {
      toast.success('Marekebisho yamehifadhiwa!');
      setIsAdjusting(false);
      fetchAdjustments(selectedSale.id);
      setAdjNote('');
    } else {
      toast.error(result.error || 'Imeshindikana kuhifadhi marekebisho');
    }
    setIsSaving(false);
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCashier = !selectedCashier || s.cashierId === selectedCashier;
    
    // Date filtering (YYYY-MM-DD comparison works for ISO strings)
    const saleDate = s.timestamp.split('T')[0];
    const matchesDateRange = (!startDate || saleDate >= startDate) && 
                            (!endDate || saleDate <= endDate);
    
    const matchesAmount = (!minAmount || s.total >= Number(minAmount)) &&
                         (!maxAmount || s.total <= Number(maxAmount));

    return matchesSearch && matchesCashier && matchesDateRange && matchesAmount;
  });

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedCashier('');
    setMinAmount('');
    setMaxAmount('');
    setSearchTerm('');
  };

  if (selectedSale) {
    return (
      <div className="space-y-10 font-sans pb-10">
        <motion.button 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setSelectedSale(null)}
          className="flex items-center gap-2.5 text-gray-600 font-bold hover:text-black transition-all group"
        >
          <div className="p-2 bg-white rounded-xl shadow-sm group-hover:bg-[#F2F2F7] transition-all">
            <ArrowLeft size={20} />
          </div>
          Rudi kwenye Orodha
        </motion.button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Sale Details */}
          <div className="lg:col-span-2 space-y-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="apple-card p-10"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-[#007AFF]/10 text-[#007AFF] rounded-xl flex items-center justify-center">
                      <FileText size={22} />
                    </div>
                    <h3 className="text-3xl font-sans font-black text-black tracking-tight">Maelezo ya Mauzo</h3>
                  </div>
                  <p className="text-gray-600 font-mono text-xs ml-13">
                    ID: {selectedSale.saleNumber ? selectedSale.saleNumber.toString().padStart(6, '0') : selectedSale.id}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 font-bold uppercase tracking-widest mb-1">Jumla ya Mauzo</p>
                  <p className="text-4xl font-sans font-black text-black tracking-tight">
                    Tsh {selectedSale.total.toLocaleString()}
                  </p>
                  {selectedSale.adjustedTotal !== undefined && selectedSale.adjustedTotal !== selectedSale.total && (
                    <div className="mt-2 inline-block px-3 py-1 bg-[#FF3B30]/10 rounded-full">
                      <p className="text-xs font-bold text-[#FF3B30]">
                        Baada ya marekebisho: Tsh {selectedSale.adjustedTotal.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="flex items-center gap-4 p-5 bg-[#F2F2F7] rounded-[24px] border border-black/[0.01]">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-600 shadow-sm">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-0.5">Tarehe & Muda</p>
                    <p className="text-sm font-bold text-black">{format(parseISO(selectedSale.timestamp), 'dd MMM yyyy, HH:mm')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-5 bg-[#F2F2F7] rounded-[24px] border border-black/[0.01]">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-600 shadow-sm">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-0.5">Cashier</p>
                    <p className="text-sm font-bold text-black">{selectedSale.cashierId.slice(0, 8)}...</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 border-t border-black/[0.05] pt-10">
                <h4 className="font-bold text-black text-lg mb-6 flex items-center gap-3">
                  <Package size={22} className="text-[#007AFF]" />
                  Bidhaa Zilizouzwa
                </h4>
                <div className="space-y-4">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-6 bg-[#F2F2F7] rounded-[28px] border border-black/[0.01] hover:bg-white hover:shadow-md transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-600 shadow-sm">
                          <Package size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-black text-[17px]">{item.name}</p>
                          <p className="text-[13px] text-gray-600 font-bold mt-0.5">{item.quantity} x Tsh {item.price.toLocaleString()}</p>
                        </div>
                      </div>
                      <p className="font-bold text-black text-lg">Tsh {(item.quantity * item.price).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Adjustments History */}
            {adjustments.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="apple-card p-10"
              >
                <h3 className="text-2xl font-sans font-black text-black mb-8 flex items-center gap-3 tracking-tight">
                  <History size={24} className="text-[#007AFF]" />
                  Historia ya Marekebisho
                </h3>
                <div className="space-y-6">
                  {adjustments.map((adj) => (
                    <div key={adj.id} className="p-8 border border-[#FF3B30]/10 bg-[#FF3B30]/5 rounded-[32px] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF3B30]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6 relative z-10">
                        <div>
                          <span className="inline-block px-3.5 py-1.5 bg-[#FF3B30]/10 text-[#FF3B30] rounded-full text-[11px] font-bold uppercase tracking-widest mb-3">
                            {adj.reason}
                          </span>
                          <div className="flex items-center gap-2 text-gray-600 text-[13px] font-medium">
                            <Clock size={14} />
                            <span>{format(parseISO(adj.createdAt), 'dd MMM yyyy, HH:mm')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1">Kiasi Kilichopunguzwa</p>
                          <p className="text-2xl font-sans font-black text-[#FF3B30] tracking-tight">Tsh {adj.amount.toLocaleString()}</p>
                        </div>
                      </div>
                      {adj.note && (
                        <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-black/[0.02] mb-6">
                          <p className="text-sm text-black font-medium italic leading-relaxed">"{adj.note}"</p>
                        </div>
                      )}
                      {adj.items.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-2 px-1">Bidhaa Zilizoathirika</p>
                          {adj.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-3 bg-white/40 rounded-xl border border-black/[0.01]">
                              <span className="text-[13px] font-bold text-black">{item.name} (x{item.quantity})</span>
                              <span className="text-[13px] font-bold text-[#FF3B30]">Tsh {(item.quantity * item.price).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-8">
            {(profile?.role === 'owner' || profile?.role === 'manager') && (
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleStartAdjustment}
                className="w-full apple-button-primary py-6 rounded-[32px] flex flex-col items-center justify-center gap-3 shadow-2xl shadow-[#007AFF]/20 group"
              >
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-500">
                  <RotateCcw size={28} />
                </div>
                <span className="text-lg">Fanya Marekebisho</span>
              </motion.button>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#FF9500]/5 p-8 rounded-[40px] border border-[#FF9500]/10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF9500]/10 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
              <div className="flex items-center gap-3 text-[#FF9500] mb-4 relative z-10">
                <AlertCircle size={24} />
                <span className="font-bold text-lg tracking-tight">Kumbuka</span>
              </div>
              <p className="text-sm text-[#FF9500]/80 font-medium leading-relaxed relative z-10">
                Marekebisho haya hayatafuta mauzo ya awali. Badala yake, yataongeza muamala mpya wa kurekebisha stoo na mapato.
              </p>
            </motion.div>
          </div>
        </div>

        {/* Adjustment Modal */}
        <AnimatePresence>
          {isAdjusting && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white/90 backdrop-blur-xl rounded-[40px] p-10 w-full max-w-2xl shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-3xl font-sans font-black text-[#1C1C1E] tracking-tight">Marekebisho ya Mauzo</h3>
                  <button onClick={() => setIsAdjusting(false)} className="p-2.5 bg-[#F2F2F7] hover:bg-white rounded-full transition-all shadow-sm">
                    <X size={20} className="text-[#8E8E93]" />
                  </button>
                </div>
                
                <div className="space-y-10">
                  <div className="space-y-4">
                    <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93] ml-1">Sababu ya Marekebisho</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(['return', 'error', 'discount', 'other'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setAdjReason(r)}
                          className={cn(
                            "py-4 rounded-2xl font-bold text-[13px] transition-all duration-300 active:scale-[0.95] shadow-sm",
                            adjReason === r 
                              ? 'bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/25' 
                              : 'bg-[#F2F2F7] text-[#8E8E93] hover:bg-white hover:text-[#1C1C1E]'
                          )}
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93] ml-1">Bidhaa za Kurekebisha (Return)</label>
                    <div className="space-y-4">
                      {adjItems.map((item, idx) => {
                        const originalItem = selectedSale.items.find(i => i.productId === item.productId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-6 bg-[#F2F2F7] rounded-[28px] border border-black/[0.01] hover:bg-white hover:shadow-md transition-all duration-300">
                            <div className="flex-1 pr-4">
                              <p className="font-bold text-[#1C1C1E] text-[15px]">{item.name}</p>
                              <p className="text-[11px] text-[#8E8E93] font-bold uppercase tracking-widest mt-1">Max: {originalItem?.quantity || 0} Bidhaa</p>
                            </div>
                            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-black/[0.02]">
                              <button 
                                onClick={() => {
                                  const newItems = [...adjItems];
                                  newItems[idx].quantity = Math.max(0, item.quantity - 1);
                                  setAdjItems(newItems);
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-[#F2F2F7] hover:bg-[#007AFF]/10 hover:text-[#007AFF] rounded-xl font-bold transition-all active:scale-[0.8]"
                              >
                                <Minus size={18} />
                              </button>
                              <span className="w-10 text-center font-bold text-lg text-[#1C1C1E]">{item.quantity}</span>
                              <button 
                                onClick={() => {
                                  const newItems = [...adjItems];
                                  newItems[idx].quantity = Math.min(originalItem?.quantity || 0, item.quantity + 1);
                                  setAdjItems(newItems);
                                }}
                                className="w-10 h-10 flex items-center justify-center bg-[#F2F2F7] hover:bg-[#007AFF]/10 hover:text-[#007AFF] rounded-xl font-bold transition-all active:scale-[0.8]"
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93] ml-1">Maelezo ya Ziada</label>
                    <textarea
                      value={adjNote}
                      onChange={(e) => setAdjNote(e.target.value)}
                      className="apple-input min-h-[120px] py-5 resize-none"
                      placeholder="Weka maelezo kwanini marekebisho yanafanyika..."
                    />
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button
                      onClick={() => setIsAdjusting(false)}
                      className="flex-1 apple-button-secondary"
                    >
                      Ghairi
                    </button>
                    <button
                      onClick={handleCreateAdjustment}
                      disabled={isSaving}
                      className="flex-1 apple-button-primary"
                    >
                      {isSaving ? 'Inahifadhi...' : 'Kamilisha Marekebisho'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Historia ya Mauzo</h2>
          <p className="text-gray-600 font-medium mt-1">Angalia na urekebishe miamala ya mauzo ya duka lako</p>
        </motion.div>

        <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full lg:w-[450px] group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-[#007AFF]" size={22} />
            <input
              type="text"
              placeholder="Tafuta kwa ID au bidhaa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-5 rounded-[24px] bg-white border border-black/[0.05] shadow-sm focus:ring-4 focus:ring-[#007AFF]/10 focus:border-[#007AFF]/20 outline-none transition-all text-lg font-medium placeholder:text-gray-600"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-5 rounded-[24px] border transition-all flex items-center justify-center gap-3 font-bold",
              showFilters 
                ? "bg-[#007AFF] text-white border-[#007AFF] shadow-lg shadow-[#007AFF]/20" 
                : "bg-white text-gray-600 border-black/[0.05] shadow-sm hover:bg-[#F2F2F7]"
            )}
          >
            <Filter size={24} />
            <span className="md:hidden lg:inline text-lg">Vichujio</span>
            {(startDate || endDate || selectedCashier || minAmount || maxAmount) && (
              <span className="w-2.5 h-2.5 bg-[#FF3B30] rounded-full" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="overflow-hidden"
          >
            <div className="apple-card p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-4">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93] ml-1 flex items-center gap-2">
                  <Calendar size={14} />
                  Kuanzia Tarehe
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="apple-input py-4 text-base"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93] ml-1 flex items-center gap-2">
                  <Calendar size={14} />
                  Mpaka Tarehe
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="apple-input py-4 text-base"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93] ml-1 flex items-center gap-2">
                  <User size={14} />
                  Cashier
                </label>
                <div className="relative">
                  <select
                    value={selectedCashier}
                    onChange={(e) => setSelectedCashier(e.target.value)}
                    className="apple-input py-4 pr-12 appearance-none text-base font-bold bg-white"
                  >
                    <option value="">Wote</option>
                    {cashiers.map(c => (
                      <option key={c.uid} value={c.uid}>{c.displayName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93] ml-1 flex items-center gap-2">
                  <DollarSign size={14} />
                  Kiasi cha Mauzo (Range)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="apple-input py-4 text-base w-full"
                  />
                  <span className="text-gray-400 font-bold">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="apple-input py-4 text-base w-full"
                  />
                </div>
              </div>
              
              <div className="lg:col-span-4 flex justify-end pt-4 border-t border-black/[0.05]">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#FF3B30]/10 text-[#FF3B30] font-bold hover:bg-[#FF3B30]/20 transition-all text-sm"
                >
                  <FilterX size={18} />
                  Ondoa Vichujio
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="apple-card overflow-hidden"
      >
        {loading ? (
          <div className="p-32 flex flex-col items-center justify-center gap-6">
            <div className="w-14 h-14 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#8E8E93] font-bold uppercase tracking-[0.2em] text-xs">Inapakia historia...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-32 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-[#F2F2F7] rounded-[32px] flex items-center justify-center text-[#8E8E93] mb-8">
              <History size={48} className="opacity-40" />
            </div>
            <h4 className="text-xl font-sans font-black text-[#1C1C1E] mb-2">Hakuna mauzo yaliyopatikana</h4>
            <p className="text-[#8E8E93] font-medium">Jaribu kutafuta kwa maneno mengine au fanya mauzo mapya.</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left bg-[#F2F2F7]/50">
                  <th className="p-8 font-bold text-gray-600 text-[11px] uppercase tracking-[0.2em]">Tarehe</th>
                  <th className="p-8 font-bold text-gray-600 text-[11px] uppercase tracking-[0.2em]">Sale ID</th>
                  <th className="p-8 font-bold text-gray-600 text-[11px] uppercase tracking-[0.2em]">Cashier</th>
                  <th className="p-8 font-bold text-gray-600 text-[11px] uppercase tracking-[0.2em]">Bidhaa</th>
                  <th className="p-8 font-bold text-gray-600 text-[11px] uppercase tracking-[0.2em]">Jumla</th>
                  <th className="p-8 font-bold text-gray-600 text-[11px] uppercase tracking-[0.2em]">Hali</th>
                  <th className="p-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03]">
                {filteredSales.map((sale, i) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    key={sale.id} 
                    onClick={() => setSelectedSale(sale)}
                    className="group hover:bg-[#F2F2F7]/40 transition-all cursor-pointer"
                  >
                    <td className="p-8">
                      <p className="font-bold text-black text-[15px]">{format(parseISO(sale.timestamp), 'dd MMM, HH:mm')}</p>
                      <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mt-1">{format(parseISO(sale.timestamp), 'yyyy')}</p>
                    </td>
                    <td className="p-8">
                      <div className="bg-[#F2F2F7] px-3 py-1.5 rounded-xl border border-black/[0.02] inline-block">
                        <p className="font-mono text-[11px] font-bold text-gray-600">
                          {sale.saleNumber ? sale.saleNumber.toString().padStart(6, '0') : sale.id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-[10px] font-bold">
                          {cashiers.find(c => c.uid === sale.cashierId)?.displayName.charAt(0).toUpperCase() || '?'}
                        </div>
                        <p className="font-bold text-black text-[13px]">
                          {cashiers.find(c => c.uid === sale.cashierId)?.displayName || 'Unknown'}
                        </p>
                      </div>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#007AFF]/5 text-[#007AFF] rounded-xl flex items-center justify-center group-hover:bg-[#007AFF]/10 transition-all">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-black text-[15px]">{sale.items.length} Bidhaa</p>
                          <p className="text-[12px] text-gray-600 font-medium truncate max-w-[180px] mt-0.5">
                            {sale.items.map(i => i.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-8">
                      <p className="font-bold text-black text-lg tracking-tight">Tsh {sale.total.toLocaleString()}</p>
                    </td>
                    <td className="p-8">
                      <div className="flex items-center gap-2.5 bg-[#34C759]/10 px-4 py-2 rounded-full w-fit">
                        <CheckCircle2 size={16} className="text-[#34C759]" />
                        <span className="text-[11px] font-bold text-[#34C759] uppercase tracking-widest">Kamilifu</span>
                      </div>
                    </td>
                    <td className="p-8 text-right">
                      <div className="w-10 h-10 bg-[#F2F2F7] rounded-full flex items-center justify-center text-gray-600 group-hover:bg-[#007AFF] group-hover:text-white transition-all duration-300 shadow-sm">
                        <ChevronRight size={20} />
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};
