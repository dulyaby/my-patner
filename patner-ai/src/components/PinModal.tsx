import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, Delete } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin: string;
  title?: string;
  description?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  correctPin,
  title = "PIN ya Meneja Inahitajika",
  description = "Tafadhali ingiza tarakimu 4 za PIN ili kuruhusu kitendo hiki."
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);

      if (newPin.length === 4) {
        if (newPin === correctPin) {
          onSuccess();
          setPin('');
          onClose();
        } else {
          setError(true);
          // Haptic feedback simulation or shake animation
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 600);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white/90 backdrop-blur-2xl rounded-[48px] shadow-2xl w-full max-w-sm overflow-hidden relative z-10 border border-white/40"
          >
            <div className="p-10 text-center">
              <div className="flex justify-end absolute top-6 right-6">
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-black/5 rounded-full transition-colors text-[#8E8E93]"
                >
                  <X size={24} />
                </button>
              </div>
              
              <motion.div 
                animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
                className="mx-auto w-20 h-20 bg-[#007AFF]/10 rounded-[28px] flex items-center justify-center mb-6"
              >
                <Lock size={36} className="text-[#007AFF]" />
              </motion.div>
              
              <h3 className="text-2xl font-sans font-black text-black mb-2 tracking-tight">{title}</h3>
              <p className="text-gray-600 font-medium text-[15px] leading-relaxed mb-10">{description}</p>

              <div className="flex justify-center gap-6 mb-12">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    animate={pin.length > i ? { scale: 1.2 } : { scale: 1 }}
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      error ? 'bg-[#FF3B30]' : 
                      pin.length > i ? 'bg-[#007AFF] shadow-[0_0_15px_rgba(0,122,255,0.5)]' : 'bg-[#E5E5EA]'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-6 max-w-[280px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num.toString())}
                    className="h-16 w-16 rounded-full bg-black/[0.03] text-2xl font-bold text-black hover:bg-black/[0.08] active:scale-90 transition-all flex items-center justify-center"
                  >
                    {num}
                  </button>
                ))}
                <div />
                <button
                  onClick={() => handleNumberClick('0')}
                  className="h-16 w-16 rounded-full bg-black/[0.03] text-2xl font-bold text-black hover:bg-black/[0.08] active:scale-90 transition-all flex items-center justify-center"
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  className="h-16 w-16 rounded-full text-[#FF3B30] hover:bg-[#FF3B30]/10 active:scale-90 transition-all flex items-center justify-center"
                >
                  <Delete size={28} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
