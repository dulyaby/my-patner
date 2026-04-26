import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Receipt, 
  History, 
  LogOut,
  Menu,
  X,
  TrendingDown,
  Store,
  ArrowRightLeft,
  DollarSign,
  ShoppingBag,
  ChevronDown,
  Bell,
  Search,
  Plus,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { auth } from '../firebase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, activeBusiness, businesses, setActiveBusiness } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBizMenuOpen, setIsBizMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  React.useEffect(() => {
    if (activeTab === 'pos' || activeTab === 'purchase') {
      setIsCollapsed(true);
    }
  }, [activeTab]);

  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const menuItems = [
    { id: 'boss_ai', label: 'Partner AI', icon: Sparkles, roles: ['owner'] },
    { id: 'pos', label: 'Mauzo (POS)', icon: ShoppingCart, roles: ['owner', 'manager', 'cashier'] },
    { id: 'sales_history', label: 'Historia ya Mauzo', icon: History, roles: ['owner', 'manager', 'cashier'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'manager'] },
    { id: 'inventory', label: 'Stoo (Stock)', icon: Package, roles: ['owner', 'manager'] },
    { id: 'transfers', label: 'Uhamisho (Transfers)', icon: ArrowRightLeft, roles: ['owner', 'manager'] },
    { id: 'suppliers', label: 'Suppliers', icon: Users, roles: ['owner', 'manager'] },
    { id: 'expenses', label: 'Matumizi', icon: TrendingDown, roles: ['owner', 'manager'] },
    { id: 'purchase', label: 'Ingiza Mzigo (AI)', icon: ShoppingBag, roles: ['owner', 'manager'] },
    { id: 'cash_control', label: 'Cash Control', icon: DollarSign, roles: ['owner', 'manager'] },
    { id: 'reports', label: 'Ripoti', icon: Receipt, roles: ['owner', 'manager'] },
    { id: 'branches', label: 'Maduka (Branches)', icon: Store, roles: ['owner'] },
    { id: 'logs', label: 'Void Logs', icon: History, roles: ['owner'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(profile?.role || ''));

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="min-h-screen bg-transparent flex font-sans text-black">
      {/* Sidebar Desktop */}
      <motion.aside 
        initial={false}
        animate={{ width: isCollapsed ? 100 : 288 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="hidden md:flex flex-col bg-white/40 backdrop-blur-2xl border-r border-white/20 p-4 m-4 rounded-[32px] shadow-2xl shadow-black/[0.03] relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#007AFF]/10 to-transparent pointer-events-none" />
        
        <div className={cn("flex items-center mb-10 px-2 relative z-10", isCollapsed ? "justify-center" : "gap-3.5")}>
          <div className="w-12 h-12 bg-gradient-to-br from-black to-[#3A3A3C] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/30 shrink-0">
            <Sparkles size={26} />
          </div>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <h1 className="font-sans text-xl text-black font-black tracking-tight leading-none">Partner</h1>
              <p className="text-[10px] text-[#007AFF] font-black uppercase tracking-[0.2em] mt-1">Smart AI</p>
            </motion.div>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-6 -right-1 w-8 h-8 bg-white rounded-full border border-black/[0.05] flex items-center justify-center text-gray-600 hover:text-[#007AFF] shadow-md z-50 transition-all hover:scale-110 active:scale-95"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {/* Business Switcher */}
        <div className="relative mb-8 px-1 z-20">
          <button 
            onClick={() => !isCollapsed && setIsBizMenuOpen(!isBizMenuOpen)}
            className={cn(
              "w-full p-3 bg-black/[0.03] rounded-2xl border border-black/[0.02] flex items-center transition-all active:scale-[0.98] group",
              isCollapsed ? "justify-center" : "justify-between"
            )}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform shrink-0">
                <Store size={14} className="text-[#007AFF]" />
              </div>
              {!isCollapsed && (
                <span className="font-bold text-sm text-black truncate">{activeBusiness?.name || 'Chagua Duka'}</span>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown size={16} className={cn("text-gray-600 transition-transform duration-300", isBizMenuOpen && "rotate-180")} />
            )}
          </button>
          
          <AnimatePresence>
            {!isCollapsed && isBizMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="absolute top-full left-0 right-0 mt-3 bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-black/[0.05] py-3 z-50 overflow-hidden"
              >
                <div className="px-4 py-2 mb-1">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Maduka Yako</p>
                </div>
                {businesses.map((biz) => (
                  <button
                    key={biz.id}
                    onClick={() => {
                      setActiveBusiness(biz);
                      setIsBizMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-5 py-3 text-left text-sm font-bold transition-all flex items-center justify-between group",
                      activeBusiness?.id === biz.id ? "text-[#007AFF] bg-[#007AFF]/5" : "text-black hover:bg-black/[0.03]"
                    )}
                  >
                    <span>{biz.name}</span>
                    {activeBusiness?.id === biz.id && <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />}
                  </button>
                ))}
                <div className="border-t border-black/[0.05] mt-2 pt-2 px-3">
                  <button
                    onClick={() => {
                      setActiveTab('branches');
                      setIsBizMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-xs font-bold text-[#007AFF] hover:bg-[#007AFF]/5 rounded-2xl transition-all flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Ongeza Duka Jipya
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar relative z-10">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center rounded-2xl transition-all duration-300 group relative overflow-hidden",
                isCollapsed ? "justify-center p-4" : "gap-4 px-4 py-4",
                activeTab === item.id 
                  ? "bg-[#007AFF] text-white shadow-xl shadow-[#007AFF]/25" 
                  : "text-gray-600 hover:bg-black/[0.03] hover:text-black"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon size={20} className={cn("transition-all duration-300 group-hover:scale-110 shrink-0", activeTab === item.id ? "text-white" : "text-gray-600")} />
              {!isCollapsed && (
                <span className="font-black text-[15px] tracking-tight truncate">{item.label}</span>
              )}
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTabGlow"
                  className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent pointer-events-none"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-black/[0.05] relative z-10">
          <div className={cn("flex items-center mb-6 px-2 bg-black/[0.02] p-3 rounded-2xl border border-black/[0.01]", isCollapsed ? "justify-center" : "gap-4")}>
            <div className="w-11 h-11 bg-gradient-to-br from-[#1C1C1E] to-[#3A3A3C] rounded-full flex items-center justify-center text-white font-black shadow-lg border border-white/10 shrink-0">
              {profile?.displayName?.charAt(0) || 'U'}
            </div>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-[14px] font-black text-black truncate leading-tight">{profile?.displayName}</p>
                <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-0.5">{profile?.role}</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center rounded-2xl text-[#FF3B30] font-bold hover:bg-[#FF3B30]/10 transition-all active:scale-[0.98] group",
              isCollapsed ? "justify-center p-4" : "gap-4 px-4 py-4"
            )}
            title={isCollapsed ? "Ondoka" : undefined}
          >
            <div className={cn("rounded-xl bg-[#FF3B30]/10 flex items-center justify-center group-hover:scale-110 transition-transform", isCollapsed ? "w-8 h-8" : "w-10 h-10")}>
              <LogOut size={isCollapsed ? 16 : 20} />
            </div>
            {!isCollapsed && <span>Ondoka</span>}
          </button>

          {/* PWA Install Badge */}
          <AnimatePresence>
            {deferredPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4"
              >
                <button
                  onClick={handleInstall}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 bg-[#007AFF]/10 text-[#007AFF] rounded-2xl border border-[#007AFF]/20 hover:bg-[#007AFF]/20 transition-all group",
                    isCollapsed && "justify-center"
                  )}
                >
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                    <Plus size={16} />
                  </div>
                  {!isCollapsed && (
                    <div className="text-left">
                      <p className="text-[11px] font-bold leading-none">Install App</p>
                      <p className="text-[9px] font-medium opacity-70 mt-0.5">Kwa matumizi bora</p>
                    </div>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-black/[0.05] h-18 flex items-center justify-between px-6 z-[60]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#007AFF]/20">
            <Sparkles size={20} />
          </div>
          <div>
            <span className="font-sans font-black text-black text-lg leading-none block">Partner</span>
            <span className="text-[9px] font-black text-[#007AFF] uppercase tracking-widest">Smart AI</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2.5 bg-black/[0.03] rounded-full text-black">
            <Bell size={20} />
          </button>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2.5 bg-black/[0.03] rounded-full text-black">
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-md z-[70] md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-80 bg-white z-[80] p-8 flex flex-col md:hidden rounded-r-[48px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#007AFF]/20">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <span className="font-sans font-black text-black text-xl leading-none block">Partner</span>
                    <span className="text-[10px] font-black text-[#007AFF] uppercase tracking-widest">Smart AI</span>
                  </div>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2.5 bg-black/[0.03] rounded-full">
                  <X size={22} />
                </button>
              </div>

              <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4.5 rounded-2xl transition-all font-black text-[16px]",
                      activeTab === item.id 
                        ? "bg-[#007AFF] text-white shadow-xl shadow-[#007AFF]/20" 
                        : "text-gray-600 hover:bg-black/[0.03]"
                    )}
                  >
                    <item.icon size={22} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-8 pt-8 border-t border-black/[0.05]">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-4 px-5 py-4.5 rounded-2xl text-[#FF3B30] font-bold hover:bg-[#FF3B30]/10 transition-all active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center">
                    <LogOut size={22} />
                  </div>
                  <span>Ondoka</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pt-20 md:pt-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};
