import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Sale } from '../types';
import { startOfDay, endOfDay, isWithinInterval, parseISO, format } from 'date-fns';
import { AlertCircle, CheckCircle, Save, Edit2, Clock, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface CashEntry {
  id: string;
  amount: number;
  expected: number;
  difference: number;
  timestamp: string;
}

export const CashControl: React.FC = () => {
  const { activeBusiness } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [cashPresent, setCashPresent] = useState<string>('');
  const [history, setHistory] = useState<CashEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  useEffect(() => {
    if (!activeBusiness) return;

    const salesQ = query(
      collection(db, 'sales'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      const s: Sale[] = [];
      snapshot.forEach((doc) => s.push({ id: doc.id, ...doc.data() } as Sale));
      setSales(s);
    });

    const historyQ = query(
      collection(db, 'cash_history'),
      where('businessId', '==', activeBusiness.id),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubHistory = onSnapshot(historyQ, (snapshot) => {
      const h = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashEntry));
      setHistory(h);
      setLoadingHistory(false);
    });

    return () => {
      unsubSales();
      unsubHistory();
    };
  }, [activeBusiness?.id]);

  const today = new Date();
  const todaySales = sales.filter(s => 
    isWithinInterval(parseISO(s.timestamp), { start: startOfDay(today), end: endOfDay(today) })
  );

  const cashExpected = todaySales.reduce((sum, s) => sum + s.total, 0);
  const present = parseFloat(cashPresent) || 0;
  const difference = present - cashExpected;

  const handleUpload = async () => {
    if (!activeBusiness) return;
    if (!cashPresent) return;

    try {
      await addDoc(collection(db, 'cash_history'), {
        amount: present,
        expected: cashExpected,
        difference: difference,
        businessId: activeBusiness.id,
        timestamp: new Date().toISOString()
      });
      setCashPresent('');
      toast.success('Cash imehifadhiwa kwenye historia!');
    } catch (error) {
      toast.error('Imeshindikana kuhifadhi cash.');
    }
  };

  const getDifferenceColor = () => {
    if (present > cashExpected) return 'bg-red-50 border-red-100 text-red-600'; // Cash exceeds system
    if (present < cashExpected) return 'bg-[#007AFF]/10 border-[#007AFF]/20 text-[#007AFF]'; // System exceeds cash (Blue)
    return 'bg-yellow-50 border-yellow-100 text-yellow-600'; // Equal (Yellow)
  };

  return (
    <div className="space-y-8 font-sans pb-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="apple-card p-8"
      >
        <h2 className="text-3xl font-sans font-black text-black mb-8">Cash Control</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#F2F2F7] p-6 rounded-[24px]">
            <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-2">Cash Expected (System)</p>
            <p className="text-3xl font-bold text-black">Tsh {cashExpected.toLocaleString()}</p>
          </div>
          
          <div className="bg-[#F2F2F7] p-6 rounded-[24px]">
            <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-2">Cash Iliyopo</p>
            <div className="flex gap-2">
              <input 
                type="number"
                value={cashPresent}
                onChange={(e) => setCashPresent(e.target.value)}
                className="w-full bg-white p-4 rounded-xl text-xl font-bold text-black border border-black/[0.05] focus:ring-2 focus:ring-[#007AFF] outline-none"
                placeholder="Ingiza kiasi kilichopo..."
              />
              <button 
                onClick={handleUpload}
                disabled={!cashPresent}
                className="px-6 bg-[#007AFF] text-white rounded-xl hover:bg-[#0051A8] transition-all active:scale-[0.98] flex items-center justify-center gap-2 font-bold text-sm disabled:opacity-50"
              >
                <Save size={18} />
                Save Cash
              </button>
            </div>
          </div>
        </div>

        <div className={cn(
          "p-8 rounded-[32px] text-center border transition-colors duration-300 mb-10",
          getDifferenceColor()
        )}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2">Difference</p>
          <p className="text-5xl font-sans font-black">
            Tsh {Math.abs(difference).toLocaleString()}
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 font-bold">
            {present > cashExpected && <><AlertCircle size={20} /> <span>Ziada!</span></>}
            {present < cashExpected && <><AlertCircle size={20} /> <span>Upungufu!</span></>}
            {present === cashExpected && <><CheckCircle size={20} /> <span>Sawa!</span></>}
          </div>
        </div>

        {/* Cash History Section */}
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#007AFF]/10 text-[#007AFF] rounded-xl flex items-center justify-center">
              <History size={22} />
            </div>
            <h3 className="text-2xl font-black text-black tracking-tight">Historia ya Cash Control</h3>
          </div>

          <div className="space-y-4">
            {loadingHistory ? (
              <div className="p-10 text-center text-gray-500 font-bold tracking-widest uppercase text-xs">Inapakia...</div>
            ) : history.length === 0 ? (
              <div className="p-10 text-center bg-[#F2F2F7] rounded-[32px] text-gray-400 font-bold tracking-widest uppercase text-xs">Hakuna historia bado</div>
            ) : (
              <AnimatePresence>
                {history.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex flex-col md:flex-row justify-between items-center p-6 bg-white border border-black/[0.05] rounded-[24px] hover:shadow-lg hover:shadow-black/[0.02] transition-all"
                  >
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                      <div className="w-10 h-10 bg-[#F2F2F7] rounded-xl flex items-center justify-center text-gray-500">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black">
                          {format(parseISO(item.timestamp), 'dd MMM yyyy')}
                        </p>
                        <p className="text-[11px] text-[#007AFF] font-bold uppercase tracking-widest">
                          {format(parseISO(item.timestamp), 'HH:mm')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-8 text-center md:text-right">
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Expected</p>
                        <p className="text-sm font-bold text-black">Tsh {item.expected.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Present</p>
                        <p className="text-sm font-bold text-black">Tsh {item.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Difference</p>
                        <p className={cn(
                          "text-sm font-black",
                          item.difference > 0 ? "text-red-600" : item.difference < 0 ? "text-[#007AFF]" : "text-yellow-600"
                        )}>
                          {item.difference > 0 ? '+' : ''}{item.difference.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
