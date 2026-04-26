import React, { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const OnlineStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [show, setShow] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShow(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShow(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Show initial status for a moment
    setShow(true);
    
    isInitialMount.current = false;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setShow(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, isOnline]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            "fixed top-24 left-1/2 -translate-x-1/2 z-[100] text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-4 text-[15px] font-bold backdrop-blur-xl border border-white/20",
            isOnline ? "bg-[#34C759]/90 shadow-[#34C759]/20" : "bg-[#FF3B30]/90 shadow-[#FF3B30]/20"
          )}
        >
          {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
          <span>
            {isOnline 
              ? "Upo Online - Mfumo umeshikamana" 
              : "Upo Offline - Mauzo yatahifadhiwa kwenye kifaa"}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
