import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Product, Transfer, SaleItem } from '../types';
import { Send, ArrowRightLeft, Package, CheckCircle2, XCircle, Clock, Plus, Search, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const Transfers: React.FC = () => {
  const { user, businesses, activeBusiness } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [targetBusinessId, setTargetBusinessId] = useState('');
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!activeBusiness) return;

    const transfersQ = query(
      collection(db, 'transfers'),
      where('fromBusinessId', '==', activeBusiness.id)
    );
    const incomingQ = query(
      collection(db, 'transfers'),
      where('toBusinessId', '==', activeBusiness.id)
    );

    const productsQ = query(
      collection(db, 'products'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubTransfers = onSnapshot(transfersQ, (snapshot) => {
      const t: Transfer[] = [];
      snapshot.forEach((doc) => t.push({ id: doc.id, ...doc.data() } as Transfer));
      setTransfers(prev => [...prev.filter(x => x.toBusinessId === activeBusiness.id), ...t]);
    });

    const unsubIncoming = onSnapshot(incomingQ, (snapshot) => {
      const t: Transfer[] = [];
      snapshot.forEach((doc) => t.push({ id: doc.id, ...doc.data() } as Transfer));
      setTransfers(prev => [...prev.filter(x => x.fromBusinessId === activeBusiness.id), ...t]);
    });

    const unsubProducts = onSnapshot(productsQ, (snapshot) => {
      const p: Product[] = [];
      snapshot.forEach((doc) => p.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(p);
    });

    return () => {
      unsubTransfers();
      unsubIncoming();
      unsubProducts();
    };
  }, [activeBusiness?.id]);

  const handleAddItem = (product: Product) => {
    const existing = selectedItems.find(item => item.productId === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setSelectedItems([...selectedItems, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      }]);
    }
  };

  const handleAddAllItems = () => {
    const itemsToAdd: SaleItem[] = products
      .filter(p => p.stock > 0)
      .map(p => ({
        productId: p.id,
        name: p.name,
        price: p.price,
        quantity: p.stock
      }));
    
    if (itemsToAdd.length === 0) {
      toast.error('Hakuna bidhaa zenye stoo za kuhamisha.');
      return;
    }

    setSelectedItems(itemsToAdd);
    toast.success(`Bidhaa ${itemsToAdd.length} zimeongezwa kwenye orodha.`);
  };

  const handleTransfer = async () => {
    if (!user || !activeBusiness || !targetBusinessId || selectedItems.length === 0) return;

    try {
      const batch = writeBatch(db);
      
      const transferData = {
        fromBusinessId: activeBusiness.id,
        toBusinessId: targetBusinessId,
        items: selectedItems,
        status: 'pending',
        timestamp: new Date().toISOString(),
        senderId: user.uid
      };
      
      const transferRef = doc(collection(db, 'transfers'));
      batch.set(transferRef, transferData);

      for (const item of selectedItems) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock;
          batch.update(productRef, { stock: currentStock - item.quantity });
        }
      }

      await batch.commit();
      toast.success('Ombi la uhamisho limetumwa!');
      setIsAdding(false);
      setSelectedItems([]);
      setTargetBusinessId('');
    } catch (error) {
      toast.error('Imeshindikana kutuma uhamisho.');
    }
  };

  const handleAcceptTransfer = async (transfer: Transfer) => {
    if (!activeBusiness) return;

    try {
      const batch = writeBatch(db);

      const transferRef = doc(db, 'transfers', transfer.id);
      batch.update(transferRef, { status: 'completed', receiverId: user?.uid });

      for (const item of transfer.items) {
        const productRef = doc(collection(db, 'products'));
        batch.set(productRef, {
          name: item.name,
          price: item.price,
          costPrice: 0,
          stock: item.quantity,
          category: 'Transferred',
          businessId: activeBusiness.id,
          updatedAt: new Date().toISOString()
        });
      }

      await batch.commit();
      toast.success('Uhamisho umepokelewa na stoo imesasishwa!');
    } catch (error) {
      toast.error('Imeshindikana kupokea uhamisho.');
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Uhamisho wa Stoo</h2>
          <p className="text-gray-600 font-medium mt-1">Hamisha bidhaa kati ya maduka yako kwa urahisi</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="apple-button-primary px-8 py-4 flex items-center justify-center gap-3 self-start md:self-auto"
        >
          <Send size={20} />
          <span>Hamisha Bidhaa</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Outgoing Transfers */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="apple-card overflow-hidden"
        >
          <div className="p-8 border-b border-black/[0.05] bg-[#007AFF]/5">
            <h3 className="text-xl font-sans font-black text-[#007AFF] flex items-center gap-3">
              <Clock size={24} />
              Uhamisho Uliotuma
            </h3>
          </div>
          <div className="divide-y divide-black/[0.05]">
            {transfers.filter(t => t.fromBusinessId === activeBusiness?.id).length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-4">
                  <ArrowRightLeft size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-600 font-medium">Hakuna uhamisho uliotuma bado.</p>
              </div>
            ) : (
              transfers.filter(t => t.fromBusinessId === activeBusiness?.id).map((t) => (
                <div key={t.id} className="p-8 hover:bg-black/[0.01] transition-colors">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="font-bold text-black text-lg">
                        Kwenda: {businesses.find(b => b.id === t.toBusinessId)?.name || 'Duka Lingine'}
                      </p>
                      <p className="text-sm text-gray-600 font-medium mt-1">
                        {format(parseISO(t.timestamp), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                      t.status === 'completed' ? 'bg-[#34C759]/10 text-[#34C759]' : 
                      t.status === 'pending' ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'
                    )}>
                      {t.status}
                    </span>
                  </div>
                  <div className="space-y-3 bg-black/[0.02] p-4 rounded-2xl">
                    {t.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-[15px]">
                        <span className="text-black font-medium">{item.name}</span>
                        <span className="font-bold text-gray-600">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Incoming Transfers */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="apple-card overflow-hidden"
        >
          <div className="p-8 border-b border-black/[0.05] bg-[#34C759]/5">
            <h3 className="text-xl font-sans font-black text-[#34C759] flex items-center gap-3">
              <Package size={24} />
              Uhamisho Unaokuja
            </h3>
          </div>
          <div className="divide-y divide-black/[0.05]">
            {transfers.filter(t => t.toBusinessId === activeBusiness?.id).length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-600 font-medium">Hakuna uhamisho unaokuja kwa sasa.</p>
              </div>
            ) : (
              transfers.filter(t => t.toBusinessId === activeBusiness?.id).map((t) => (
                <div key={t.id} className="p-8 hover:bg-black/[0.01] transition-colors">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="font-bold text-black text-lg">
                        Kutoka: {businesses.find(b => b.id === t.fromBusinessId)?.name || 'Duka Lingine'}
                      </p>
                      <p className="text-sm text-gray-600 font-medium mt-1">
                        {format(parseISO(t.timestamp), 'dd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                    <span className={cn(
                      "px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider",
                      t.status === 'completed' ? 'bg-[#34C759]/10 text-[#34C759]' : 
                      t.status === 'pending' ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'bg-[#FF3B30]/10 text-[#FF3B30]'
                    )}>
                      {t.status}
                    </span>
                  </div>
                  <div className="space-y-3 bg-black/[0.02] p-4 rounded-2xl mb-6">
                    {t.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-[15px]">
                        <span className="text-black font-medium">{item.name}</span>
                        <span className="font-bold text-gray-600">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  {t.status === 'pending' && (
                    <button
                      onClick={() => handleAcceptTransfer(t)}
                      className="w-full py-4 bg-[#34C759] text-white rounded-2xl font-bold hover:bg-[#28A745] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#34C759]/20 active:scale-[0.98]"
                    >
                      <CheckCircle2 size={20} />
                      <span>Pokea Bidhaa Hizi</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-2xl rounded-[48px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col relative z-10 border border-white/40"
            >
              <div className="p-8 md:p-10 border-b border-black/[0.05] flex justify-between items-center">
                <div>
                  <h3 className="text-3xl font-sans font-black text-black tracking-tight">Hamisha Bidhaa</h3>
                  <p className="text-gray-600 font-medium mt-1">Chagua duka na bidhaa za kuhamisha</p>
                </div>
                <button 
                  onClick={() => setIsAdding(false)} 
                  className="p-3 hover:bg-black/5 rounded-full transition-colors text-[#8E8E93]"
                >
                  <XCircle size={32} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
                {/* Product Selection */}
                <div className="p-8 md:p-10 flex flex-col overflow-hidden border-r border-black/[0.05]">
                  <div className="space-y-6 mb-8">
                    <div className="space-y-2">
                      <label className="text-[12px] font-bold text-black uppercase tracking-widest ml-1">Duka la Kupokea</label>
                      <select
                        value={targetBusinessId}
                        onChange={(e) => setTargetBusinessId(e.target.value)}
                        className="apple-input"
                      >
                        <option value="">-- Chagua Duka Lililo Karibu --</option>
                        {businesses.filter(b => b.id !== activeBusiness?.id).map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={handleAddAllItems}
                        className="flex flex-col items-center justify-center gap-2 p-5 rounded-[28px] bg-[#007AFF]/5 border border-[#007AFF]/20 text-[#007AFF] hover:bg-[#007AFF]/10 transition-all group"
                      >
                        <ArrowRightLeft size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Hamisha Zote</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedItems([]);
                          toast.success('Orodha imesafishwa. Chagua moja moja sasa.');
                        }}
                        className="flex flex-col items-center justify-center gap-2 p-5 rounded-[28px] bg-black/5 border border-black/10 text-black/60 hover:bg-black/10 transition-all group"
                      >
                        <Plus size={24} className="group-hover:rotate-90 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Moja Moja</span>
                      </button>
                    </div>

                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#007AFF] transition-colors">
                        <Search size={20} />
                      </div>
                      <input
                        type="text"
                        placeholder="Tafuta bidhaa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="apple-input pl-12"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {filteredProducts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleAddItem(p)}
                        className="w-full p-5 flex items-center justify-between bg-black/[0.02] rounded-3xl hover:bg-[#007AFF]/5 hover:border-[#007AFF]/20 border border-transparent transition-all group text-left"
                      >
                        <div>
                          <p className="font-bold text-black text-lg">{p.name}</p>
                          <p className="text-sm text-gray-600 font-medium mt-0.5">Stoo iliyopo: {p.stock}</p>
                        </div>
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-[#007AFF] group-hover:text-white transition-colors">
                          <Plus size={20} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transfer List */}
                <div className="p-8 md:p-10 flex flex-col overflow-hidden bg-black/[0.01]">
                  <h4 className="text-xl font-sans font-black text-black mb-6 flex items-center gap-3">
                    <Package size={24} className="text-[#007AFF]" />
                    Bidhaa za Kuhamisha
                  </h4>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 mb-8 custom-scrollbar">
                    {selectedItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-10">
                        <div className="w-20 h-20 bg-black/[0.03] rounded-full flex items-center justify-center mb-4">
                          <Plus size={32} className="text-gray-600" />
                        </div>
                        <p className="text-gray-600 font-medium text-lg">Chagua bidhaa kutoka upande wa kushoto ili kuanza</p>
                      </div>
                    ) : (
                      selectedItems.map((item, i) => (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={i} 
                          className="flex items-center justify-between bg-white p-5 rounded-[28px] shadow-sm border border-black/[0.03]"
                        >
                          <span className="font-bold text-black text-lg">{item.name}</span>
                          <div className="flex items-center gap-4">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => setSelectedItems(selectedItems.map(si => 
                                si.productId === item.productId ? { ...si, quantity: parseInt(e.target.value) || 1 } : si
                              ))}
                              className="w-20 px-3 py-2 bg-black/[0.03] rounded-xl text-center font-bold text-black focus:ring-2 focus:ring-[#007AFF] outline-none"
                            />
                            <button
                              onClick={() => setSelectedItems(selectedItems.filter(si => si.productId !== item.productId))}
                              className="w-10 h-10 rounded-full flex items-center justify-center text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
                            >
                              <XCircle size={24} />
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={handleTransfer}
                    disabled={!targetBusinessId || selectedItems.length === 0}
                    className="apple-button-primary py-5 text-xl flex items-center justify-center gap-4 mt-auto"
                  >
                    <ArrowRightLeft size={24} />
                    <span>Kamilisha Uhamisho</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
