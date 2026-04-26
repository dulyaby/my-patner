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
import { VoidLog } from '../types';
import { ShieldAlert, Clock, User, Package, AlertCircle, History } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'motion/react';

export const Logs: React.FC = () => {
  const { activeBusiness } = useAuth();
  const [logs, setLogs] = useState<VoidLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const q = query(
      collection(db, 'voidLogs'),
      where('businessId', '==', activeBusiness.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const l: VoidLog[] = [];
      snapshot.forEach((doc) => {
        l.push({ id: doc.id, ...doc.data() } as VoidLog);
      });
      setLogs(l);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeBusiness?.id]);

  return (
    <div className="space-y-10 font-sans pb-10">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <h2 className="text-4xl font-sans font-black text-black tracking-tight">Anti-Cheat Logs</h2>
        <p className="text-gray-600 font-medium mt-1">Rekodi za bidhaa zilizofutwa kwenye kapu kabla ya malipo</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="apple-card overflow-hidden"
      >
        <div className="p-8 border-b border-black/[0.03] bg-[#FF3B30]/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF3B30]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-4 text-[#FF3B30] relative z-10">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <ShieldAlert size={28} />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight">Ulinzi wa Pesa (Surveillance)</span>
              <p className="text-[11px] font-bold uppercase tracking-widest opacity-70 mt-0.5">Mfumo unarekodi kila bidhaa inayotolewa</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-black/[0.03]">
          {loading ? (
            <div className="p-32 flex flex-col items-center justify-center gap-6">
              <div className="w-14 h-14 border-4 border-[#FF3B30] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 font-bold uppercase tracking-[0.2em] text-xs">Inapakia rekodi...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-32 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-[#F2F2F7] rounded-[32px] flex items-center justify-center text-gray-600 mb-8">
                <History size={48} className="opacity-40" />
              </div>
              <h4 className="text-xl font-sans font-black text-black mb-2">Hakuna rekodi za kutiliwa shaka</h4>
              <p className="text-gray-600 font-medium">Mfumo haujarekodi bidhaa yoyote iliyofutwa kwenye kapu.</p>
            </div>
          ) : (
            logs.map((log, i) => (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-8 flex flex-col md:flex-row md:items-center gap-8 hover:bg-[#F2F2F7]/40 transition-all duration-300 group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#F2F2F7] text-gray-600 rounded-xl flex items-center justify-center group-hover:bg-[#FF3B30]/10 group-hover:text-[#FF3B30] transition-all duration-300">
                      <Package size={20} />
                    </div>
                    <span className="font-bold text-black text-lg tracking-tight">{log.productName}</span>
                    <span className="text-[10px] bg-[#FF3B30]/10 text-[#FF3B30] px-3 py-1 rounded-full font-bold uppercase tracking-widest">Voided</span>
                  </div>
                  <div className="flex items-start gap-2 bg-[#F2F2F7] p-4 rounded-2xl border border-black/[0.01] group-hover:bg-white transition-all">
                    <AlertCircle size={14} className="text-gray-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-black font-medium leading-relaxed italic">"{log.reason}"</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 shrink-0">
                  <div className="flex items-center gap-3 px-4 py-2 bg-[#F2F2F7] rounded-xl border border-black/[0.01] group-hover:bg-white transition-all">
                    <User size={16} className="text-gray-600" />
                    <span className="text-[13px] font-bold text-black">Cashier: {log.cashierId.slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 bg-[#F2F2F7] rounded-xl border border-black/[0.01] group-hover:bg-white transition-all">
                    <Clock size={16} className="text-gray-600" />
                    <span className="text-[13px] font-bold text-black">{format(parseISO(log.timestamp), 'dd MMM, HH:mm')}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
