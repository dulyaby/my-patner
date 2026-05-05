import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Sale, Expense, Product, VoidLog, AuditLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Heart, 
  Bell, 
  Zap, 
  BarChart3, 
  ShieldCheck, 
  Clock, 
  Package, 
  DollarSign, 
  Users,
  ShieldAlert,
  CheckCircle2,
  Info,
  Plus
} from 'lucide-react';
import { format, startOfDay, isAfter, subHours, subDays } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import confetti from 'canvas-confetti';
import ReactMarkdown from 'react-markdown';

interface PartnerMessage {
  id: string;
  type: 'alert' | 'success' | 'info' | 'motivation';
  title: string;
  body: string;
  timestamp: Date;
  icon: React.ElementType;
  color: string;
}

export const BossAI: React.FC = () => {
  const { activeBusiness, profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [voidLogs, setVoidLogs] = useState<VoidLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [greeting, setGreeting] = useState('');
  
  const lastProcessedSaleId = useRef<string | null>(null);
  const lastProcessedVoidId = useRef<string | null>(null);
  const lastProcessedAuditId = useRef<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Check if already installed
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!isStandaloneMode);
    };
    checkStandalone();
    
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Dynamic Greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Habari ya asubuhi Bosi, kila kitu kiko salama leo.');
    else if (hour < 17) setGreeting('Habari ya mchana Bosi, biashara inaendelea vizuri.');
    else setGreeting('Habari ya jioni Bosi, nakupa muhtasari wa leo.');
  }, []);

  // Fetch Data
  useEffect(() => {
    if (!activeBusiness?.id) return;

    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(new Date(), 1));

    const salesQ = query(
      collection(db, 'sales'),
      where('businessId', '==', activeBusiness.id),
      where('timestamp', '>=', yesterday.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const productsQ = query(
      collection(db, 'products'),
      where('businessId', '==', activeBusiness.id)
    );

    const voidsQ = query(
      collection(db, 'voidLogs'),
      where('businessId', '==', activeBusiness.id),
      where('timestamp', '>=', today.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const auditQ = query(
      collection(db, 'auditLogs'),
      where('businessId', '==', activeBusiness.id),
      where('timestamp', '>=', today.toISOString()),
      orderBy('timestamp', 'desc')
    );

    const unsubSales = onSnapshot(salesQ, (snap) => {
      const s: Sale[] = [];
      snap.forEach(doc => s.push({ id: doc.id, ...doc.data() } as Sale));
      setSales(s);
    }, (error) => console.error("Sales Error:", error));

    const unsubProducts = onSnapshot(productsQ, (snap) => {
      const p: Product[] = [];
      snap.forEach(doc => p.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(p);
    }, (error) => console.error("Products Error:", error));

    const unsubVoids = onSnapshot(voidsQ, (snap) => {
      const v: VoidLog[] = [];
      snap.forEach(doc => v.push({ id: doc.id, ...doc.data() } as VoidLog));
      setVoidLogs(v);
    }, (error) => console.error("Voids Error:", error));

    const unsubAudit = onSnapshot(auditQ, (snap) => {
      const a: AuditLog[] = [];
      snap.forEach(doc => a.push({ id: doc.id, ...doc.data() } as AuditLog));
      setAuditLogs(a);
    }, (error) => console.error("Audit Error:", error));

    return () => {
      unsubSales();
      unsubProducts();
      unsubVoids();
      unsubAudit();
    };
  }, [activeBusiness?.id]);

  // Proactive Watchdog & Intelligence Logic
  useEffect(() => {
    if (sales.length === 0 && voidLogs.length === 0) return;

    const newMessages: PartnerMessage[] = [];

    // 1. Void Alert (Digital Watchdog)
    const latestVoid = voidLogs[0];
    if (latestVoid && latestVoid.id !== lastProcessedVoidId.current) {
      lastProcessedVoidId.current = latestVoid.id;
      newMessages.push({
        id: `void-${latestVoid.id}`,
        type: 'alert',
        title: 'Instant Void Alert!',
        body: `Keshia amefuta ${latestVoid.productName} kwenye kapu. Sababu: "${latestVoid.reason}"`,
        timestamp: new Date(latestVoid.timestamp),
        icon: ShieldAlert,
        color: 'text-[#FF3B30]'
      });
      triggerVibration('heavy');
    }

    // 2. Milestone Cheers
    const totalSales = sales.reduce((sum, s) => sum + s.netTotal, 0);
    if (totalSales > 0 && totalSales % 100000 < 5000 && sales.length > 0) {
      const milestone = Math.floor(totalSales / 100000) * 100000;
      if (milestone > 0) {
        newMessages.push({
          id: `milestone-${milestone}`,
          type: 'success',
          title: 'Hongera Bosi! 🎉',
          body: `Tumefikisha mauzo ya Tsh ${milestone.toLocaleString()}! Biashara inapaa.`,
          timestamp: new Date(),
          icon: Zap,
          color: 'text-[#34C759]'
        });
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#007AFF', '#5856D6', '#FFD700']
        });
        triggerVibration('smooth');
      }
    }

    // 3. Stock Intelligence (Run-out Timer)
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 5));
    if (lowStock.length > 0 && Math.random() > 0.8) { // Randomly alert to not overwhelm
      const p = lowStock[0];
      newMessages.push({
        id: `stock-${p.id}-${Date.now()}`,
        type: 'info',
        title: 'Stock Intelligence',
        body: `Bosi, kulingana na kasi ya leo, ${p.name} itatupa mkono hivi karibuni. Agiza sasa.`,
        timestamp: new Date(),
        icon: Package,
        color: 'text-[#FF9500]'
      });
    }

    // 4. Price Change Alert (Security Watchdog)
    const latestAudit = auditLogs[0];
    if (latestAudit && latestAudit.id !== lastProcessedAuditId.current) {
      lastProcessedAuditId.current = latestAudit.id;
      if (latestAudit.type === 'price_change') {
        newMessages.push({
          id: `audit-${latestAudit.id}`,
          type: 'alert',
          title: 'Security Alert: Price Override',
          body: `Bosi, keshia amebadilisha bei ya ${latestAudit.productName} kutoka ${latestAudit.originalPrice?.toLocaleString()} hadi ${latestAudit.newPrice?.toLocaleString()}.`,
          timestamp: new Date(latestAudit.timestamp),
          icon: ShieldAlert,
          color: 'text-[#FF3B30]'
        });
        triggerVibration('heavy');
      }
    }

    if (newMessages.length > 0) {
      setMessages(prev => [...newMessages, ...prev].slice(0, 20));
    }
  }, [sales, voidLogs, products, auditLogs]);

  const triggerVibration = (type: 'heavy' | 'smooth') => {
    if ('vibrate' in navigator) {
      if (type === 'heavy') {
        navigator.vibrate([200, 100, 200]);
      } else {
        navigator.vibrate(300);
      }
    }
  };

  const generateMorningBriefing = async () => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const today = startOfDay(new Date());
      const todaySales = sales.filter(s => isAfter(new Date(s.timestamp), today));
      const yesterdaySales = sales.filter(s => !isAfter(new Date(s.timestamp), today));
      
      const totalToday = todaySales.reduce((sum, s) => sum + s.netTotal, 0);
      const totalYesterday = yesterdaySales.reduce((sum, s) => sum + s.netTotal, 0);
      
      const prompt = `
        Role: Act as 'Partner', a high-level Business Intelligence Consultant for a CEO.
        Tone: Executive, concise, data-driven, and formal.
        Constraints:
        1. NEVER use technical jargon like 'Secure Persistent Session'.
        2. Avoid conversational filler.
        3. Use professional Swahili (Sanifu/Kibiashara).
        4. If yesterday's revenue was 0, phrase it as "Hakuna rekodi ya miamala" or "Siku ya mapumziko" instead of "Tsh 0".
        5. DO NOT use asterisks (***) or horizontal lines for separation. Use double line breaks (empty lines) between sections instead.
        6. BOLD the Header (Report name and Date) using markdown syntax: **[RIPOTI YA UTENDAJI | DATE]**.
        7. BOLD all currency figures (e.g., **Tsh 70,000**) using markdown syntax.

        Data for analysis:
        - Jina la biashara: ${activeBusiness?.name || 'Biashara'}
        - Tarehe ya leo: ${format(new Date(), 'dd MMMM')}
        - Mapato ya jana: ${totalYesterday === 0 ? '0' : `Tsh ${totalYesterday.toLocaleString()}`}
        - Mapato ya leo (muda huu): Tsh ${totalToday.toLocaleString()}
        - Idadi ya miamala leo: ${todaySales.length}

        Structure:
        Header: [RIPOTI YA UTENDAJI | DATE]
        Section 1: Muhtasari wa Mapato (Comparison of yesterday vs today's current progress).
        Section 2: Tathmini ya Mwenendo (Brief insight on the flow of transactions).
        Section 3: Makadirio na Malengo (Clear target for the day).
        Sign-off: ${activeBusiness?.name || 'Biashara'}, Partner.

        Keep it concise and professional.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const msg: PartnerMessage = {
        id: `briefing-${Date.now()}`,
        type: 'motivation',
        title: 'Morning Briefing',
        body: response.text || 'Maandalizi ya siku yamekamilika. Kila la kheri katika ujenzi wa ufanisi.',
        timestamp: new Date(),
        icon: Sparkles,
        color: 'text-[#5856D6]'
      };
      setMessages(prev => [msg, ...prev]);
      triggerVibration('smooth');
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto font-sans pb-32 pt-4 px-4">
      {/* PWA Install Prompt for Android */}
      {!isStandalone && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-6 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-[32px] text-white shadow-2xl shadow-[#007AFF]/30 border border-white/20"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#007AFF] shrink-0 shadow-lg">
              <Plus size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black leading-tight">Install Partner AI</h3>
              <p className="text-xs opacity-90 mt-1 font-medium">Ili kupata notifications na kuitumia kama App halisi ya simu.</p>
              
              {deferredPrompt ? (
                <button
                  onClick={handleInstallClick}
                  className="mt-4 px-6 py-2.5 bg-white text-[#007AFF] rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Install Now
                </button>
              ) : (
                <div className="mt-4 p-4 bg-black/20 rounded-2xl border border-white/10">
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-2 opacity-70">Mwongozo wa Android:</p>
                  <ol className="text-xs space-y-2 opacity-90 list-decimal ml-4 font-medium">
                    <li>Hakikisha umefungua link hii kwenye <b>Chrome</b> (sio ndani ya WhatsApp).</li>
                    <li>Bonyeza zile <b>nukta tatu (⋮)</b> juu kulia mwa Chrome.</li>
                    <li>Chagua <b>"Install app"</b> au <b>"Add to Home screen"</b>.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* The "Partner" Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-10"
      >
        <div className="w-16 h-16 bg-black rounded-[22px] flex items-center justify-center shadow-2xl shadow-black/20 border border-white/10 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
          <Sparkles className="text-white relative z-10 group-hover:scale-110 transition-transform" size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-black tracking-tight leading-none">Partner AI</h2>
          <p className="text-sm text-gray-500 font-medium mt-1.5">{greeting}</p>
        </div>
      </motion.header>

      {/* The Pulse Cards */}
      <div className="grid grid-cols-1 gap-4 mb-10">
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="apple-card p-6 bg-black text-white relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16" />
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-xl">
                <DollarSign size={20} className="text-[#FFD700]" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Mauzo Leo</span>
            </div>
            <h3 className="text-2xl font-black tracking-tight">
              Tsh {sales.filter(s => isAfter(new Date(s.timestamp), startOfDay(new Date()))).reduce((sum, s) => sum + s.netTotal, 0).toLocaleString()}
            </h3>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-[#34C759] font-bold">
              <TrendingUp size={10} />
              <span>+12.5% vs jana</span>
            </div>
          </motion.div>

          <motion.div 
            whileTap={{ scale: 0.98 }}
            className="apple-card p-6 bg-white border border-black/[0.05]"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-[#007AFF]/10 rounded-xl">
                <Users size={20} className="text-[#007AFF]" />
              </div>
              <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Wateja</span>
            </div>
            <h3 className="text-2xl font-black text-black tracking-tight">
              {sales.length}
            </h3>
            <p className="text-[10px] text-gray-500 font-bold mt-2">Waliohudumiwa leo</p>
          </motion.div>
        </div>

        <motion.div 
          whileTap={{ scale: 0.98 }}
          className="apple-card p-6 bg-white border border-black/[0.05] flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-2xl",
              products.some(p => p.stock <= 5) ? "bg-[#FF3B30]/10 text-[#FF3B30]" : "bg-[#34C759]/10 text-[#34C759]"
            )}>
              <Package size={24} />
            </div>
            <div>
              <h4 className="font-black text-black">Hali ya Stoo</h4>
              <p className="text-xs text-gray-500 font-medium">
                {products.some(p => p.stock <= 5) ? 'Kuna bidhaa zinaisha!' : 'Kila kitu kipo sawa'}
              </p>
            </div>
          </div>
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            products.some(p => p.stock <= 5) ? "bg-[#FF3B30]" : "bg-[#34C759]"
          )} />
        </motion.div>
      </div>

      {/* The Activity Feed (Timeline) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-black text-black flex items-center gap-2">
            <Bell size={18} className="text-black" />
            Activity Feed
          </h3>
          <button 
            onClick={generateMorningBriefing}
            disabled={isGenerating}
            className="text-[11px] font-black text-[#007AFF] uppercase tracking-widest hover:opacity-70 transition-opacity"
          >
            {isGenerating ? 'Analyzing...' : 'Get Briefing'}
          </button>
        </div>

        <div className="space-y-4 relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-black/[0.03] -z-10" />

          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center"
              >
                <div className="w-16 h-16 bg-[#F2F2F7] rounded-[24px] flex items-center justify-center text-gray-300 mx-auto mb-4">
                  <Info size={32} />
                </div>
                <p className="text-sm text-gray-400 font-medium">Hakuna ujumbe mpya kwa sasa.</p>
              </motion.div>
            ) : (
              messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex gap-4 group"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-black/[0.02] bg-white transition-transform group-hover:scale-110",
                    msg.color
                  )}>
                    <msg.icon size={22} />
                  </div>
                  <div className="flex-1 apple-card p-5 bg-white border border-black/[0.03] shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-1">
                      <h5 className={cn("font-black text-sm", msg.color)}>{msg.title}</h5>
                      <span className="text-[10px] text-gray-400 font-bold">{format(msg.timestamp, 'HH:mm')}</span>
                    </div>
                    <div className="text-[14px] text-black font-medium leading-relaxed markdown-body">
                      <ReactMarkdown>{msg.body}</ReactMarkdown>
                    </div>
                    {msg.type === 'motivation' && (
                      <button 
                        onClick={() => window.print()}
                        className="mt-4 flex items-center gap-2 text-[10px] font-black text-[#007AFF] uppercase tracking-widest hover:opacity-70 transition-opacity"
                      >
                        <BarChart3 size={12} />
                        Download Full Report (PDF)
                      </button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
