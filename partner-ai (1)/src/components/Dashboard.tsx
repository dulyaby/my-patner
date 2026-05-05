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
import { Sale, Expense, Product } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Plus,
  ShoppingCart,
  Receipt,
  Share2
} from 'lucide-react';
import { format, parseISO, startOfDay, isWithinInterval, endOfDay, subDays, isAfter } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { BrainCircuit, AlertCircle, TrendingUp as TrendingUpIcon, Store, ChevronRight } from 'lucide-react';

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const Dashboard: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  const { profile, activeBusiness, businesses } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isConsolidated, setIsConsolidated] = useState(false);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);

  // Chart Data Preparation
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), i);
    return format(d, 'yyyy-MM-dd');
  }).reverse();

  const salesTrendData = last7Days.map(date => {
    const daySales = sales.filter(s => s.timestamp.startsWith(date));
    return {
      date: format(parseISO(date), 'EEE'),
      amount: daySales.reduce((sum, s) => sum + (s.netTotal || s.total), 0),
      count: daySales.length
    };
  });

  const categoryData = Object.entries(
    products.reduce((acc: Record<string, number>, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const COLORS = ['#5A5A40', '#8B8B6B', '#A8A88F', '#C5C5B3', '#E2E2D7'];

  useEffect(() => {
    if (!profile?.businessId || !activeBusiness) return;

    const businessIds = isConsolidated ? businesses.map(b => b.id) : [activeBusiness.id];

    // Firestore 'in' query has a limit of 10, which is fine for most small businesses
    const salesQ = query(
      collection(db, 'sales'),
      where('businessId', 'in', businessIds),
      orderBy('timestamp', 'desc')
    );

    const expensesQ = query(
      collection(db, 'expenses'),
      where('businessId', 'in', businessIds)
    );

    const productsQ = query(
      collection(db, 'products'),
      where('businessId', 'in', businessIds)
    );

    const unsubSales = onSnapshot(salesQ, (snapshot) => {
      const s: Sale[] = [];
      snapshot.forEach((doc) => s.push({ id: doc.id, ...doc.data() } as Sale));
      setSales(s);
    });

    const unsubExpenses = onSnapshot(expensesQ, (snapshot) => {
      const e: Expense[] = [];
      snapshot.forEach((doc) => e.push({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(e);
    });

    const unsubProducts = onSnapshot(productsQ, (snapshot) => {
      const p: Product[] = [];
      snapshot.forEach((doc) => p.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(p);
    });

    return () => {
      unsubSales();
      unsubExpenses();
      unsubProducts();
    };
  }, [profile?.businessId, activeBusiness?.id, isConsolidated, businesses.length]);

  // Calculations
  const today = new Date();
  const todaySales = sales.filter(s => 
    isWithinInterval(parseISO(s.timestamp), { start: startOfDay(today), end: endOfDay(today) })
  );

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  
  // Calculate Gross Profit (Revenue - Cost of Goods Sold)
  const totalCOGS = sales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      return itemSum + ((product?.costPrice || 0) * item.quantity);
    }, 0);
  }, 0);

  const totalGrossProfit = totalRevenue - totalCOGS;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalGrossProfit - totalExpenses;

  const lowStockProducts = products.filter(p => p.stock <= (p.lowStockThreshold || 10));

  // Smart Re-Ordering Logic
  const fourteenDaysAgo = subDays(today, 14);
  const recentSales = sales.filter(s => isAfter(parseISO(s.timestamp), fourteenDaysAgo));
  
  const productSalesStats = recentSales.reduce((acc: Record<string, number>, sale) => {
    sale.items.forEach(item => {
      acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
    });
    return acc;
  }, {});

  const predictions = products.map(product => {
    const totalSold = productSalesStats[product.id] || 0;
    const dailyAvg = totalSold / 14;
    const daysRemaining = dailyAvg > 0 ? Math.floor(product.stock / dailyAvg) : Infinity;
    
    return {
      ...product,
      dailyAvg,
      daysRemaining
    };
  }).filter(p => p.daysRemaining <= 7)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  // Branch Performance
  const branchStats = businesses.map(biz => {
    const bizSales = sales.filter(s => s.businessId === biz.id);
    const bizRevenue = bizSales.reduce((sum, s) => sum + s.total, 0);
    return {
      name: biz.name,
      revenue: bizRevenue,
      salesCount: bizSales.length
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const stats = [
    { 
      label: 'Mauzo ya Leo', 
      value: `Tsh ${todayRevenue.toLocaleString()}`, 
      icon: TrendingUp, 
      color: 'text-green-600', 
      bg: 'bg-green-50',
      trend: todaySales.length > 0 ? `${todaySales.length} risiti` : 'Hakuna mauzo'
    },
    { 
      label: 'Jumla ya Mapato', 
      value: `Tsh ${totalRevenue.toLocaleString()}`, 
      icon: DollarSign, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      trend: 'Tangu kuanza'
    },
    { 
      label: 'Faida Halisi (Net)', 
      value: `Tsh ${netProfit.toLocaleString()}`, 
      icon: ArrowUpRight, 
      color: netProfit >= 0 ? 'text-[#5A5A40]' : 'text-red-600', 
      bg: 'bg-[#5A5A40]/5',
      trend: 'Baada ya kutoa gharama'
    },
    { 
      label: 'Bidhaa Stoo', 
      value: products.length.toString(), 
      icon: Package, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50',
      trend: `${lowStockProducts.length} zimepungua`
    },
  ];

  const quickActions = [
    { label: 'Fanya Mauzo', icon: ShoppingCart, page: 'pos', color: 'bg-blue-600' },
    { label: 'Ingiza Bidhaa', icon: Plus, page: 'inventory', color: 'bg-[#5A5A40]' },
    { label: 'Rekodi Gharama', icon: TrendingDown, page: 'expenses', color: 'bg-red-600' },
    { label: 'Angalia Ripoti', icon: Receipt, page: 'reports', color: 'bg-purple-600' },
  ];

  const generateDailyReport = () => {
    setIsDailyReportOpen(true);
  };

  const dailyReportStats = {
    revenue: todayRevenue,
    expenses: expenses.filter(e => isWithinInterval(parseISO(e.timestamp), { start: startOfDay(today), end: endOfDay(today) })).reduce((sum, e) => sum + e.amount, 0),
    salesCount: todaySales.length,
    topProducts: Object.entries(
      todaySales.reduce((acc: Record<string, number>, s) => {
        s.items.forEach(item => {
          acc[item.name] = (acc[item.name] || 0) + item.quantity;
        });
        return acc;
      }, {})
    ).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5)
  };

  const shareDailyReport = () => {
    const text = `📊 *RIPOTI YA LEO - ${format(today, 'dd/MM/yyyy')}*\n\n` +
      `🏪 Duka: ${activeBusiness?.name}\n` +
      `💰 Mauzo: Tsh ${dailyReportStats.revenue.toLocaleString()}\n` +
      `📉 Matumizi: Tsh ${dailyReportStats.expenses.toLocaleString()}\n` +
      `📈 Faida: Tsh ${(dailyReportStats.revenue - dailyReportStats.expenses).toLocaleString()}\n` +
      `🧾 Idadi ya Mauzo: ${dailyReportStats.salesCount}\n\n` +
      `🔥 *Bidhaa Zilizoongoza:*\n` +
      dailyReportStats.topProducts.map(([name, qty]) => `• ${name}: ${qty}`).join('\n') +
      `\n\n_Imetengenezwa na Biashara Smart POS_`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Habari, {profile?.displayName}!</h2>
          <p className="text-gray-600 font-medium mt-1">
            {isConsolidated ? 'Muhtasari wa maduka yote' : `Hali ya duka la ${activeBusiness?.name}`}
          </p>
        </motion.div>
        <div className="flex flex-col md:flex-row gap-4">
          {profile?.role === 'owner' && (
            <button
              onClick={generateDailyReport}
              className="apple-button-primary flex items-center justify-center gap-2.5"
            >
              <Receipt size={20} />
              Ripoti ya Leo
            </button>
          )}
          {profile?.role === 'owner' && businesses.length > 1 && (
            <div className="flex glass p-1.5 rounded-[20px] border border-white/20 shadow-inner">
              <button
                onClick={() => setIsConsolidated(false)}
                className={cn(
                  "px-5 py-2 rounded-[14px] text-[13px] font-bold transition-all duration-300",
                  !isConsolidated ? "bg-white text-[#007AFF] shadow-sm" : "text-gray-600 hover:text-black"
                )}
              >
                Duka Hili
              </button>
              <button
                onClick={() => setIsConsolidated(true)}
                className={cn(
                  "px-5 py-2 rounded-[14px] text-[13px] font-bold transition-all duration-300",
                  isConsolidated ? "bg-white text-[#007AFF] shadow-sm" : "text-gray-600 hover:text-black"
                )}
              >
                Maduka Yote
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Daily Report Modal */}
      <AnimatePresence>
        {isDailyReportOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[100] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[40px] max-w-md w-full shadow-2xl border border-white/20"
            >
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-[#007AFF]/10 text-[#007AFF] rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <TrendingUp size={36} />
                </div>
                <h3 className="text-2xl font-sans font-black text-black">Ripoti ya Leo</h3>
                <p className="text-gray-600 font-semibold mt-1">{format(today, 'EEEE, dd MMMM yyyy')}</p>
              </div>

              <div className="space-y-8 mb-10">
                <div className="grid grid-cols-2 gap-5">
                  <div className="bg-[#F2F2F7] p-5 rounded-[24px] border border-black/[0.02]">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">Mauzo</p>
                    <p className="text-xl font-bold text-black">Tsh {dailyReportStats.revenue.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#F2F2F7] p-5 rounded-[24px] border border-black/[0.02]">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">Matumizi</p>
                    <p className="text-xl font-bold text-[#FF3B30]">Tsh {dailyReportStats.expenses.toLocaleString()}</p>
                  </div>
                </div>

                <div className="bg-[#007AFF]/5 p-8 rounded-[32px] text-center border border-[#007AFF]/10">
                  <p className="text-[11px] text-[#007AFF] font-bold uppercase tracking-[0.2em] mb-2">Faida ya Leo</p>
                  <p className="text-4xl font-sans font-black text-[#007AFF]">
                    Tsh {(dailyReportStats.revenue - dailyReportStats.expenses).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-4 px-2">Bidhaa Zilizoongoza</p>
                  <div className="space-y-3">
                    {dailyReportStats.topProducts.map(([name, qty]) => (
                      <div key={name} className="flex justify-between items-center px-5 py-3.5 bg-[#F2F2F7] rounded-[20px] border border-black/[0.01]">
                        <span className="text-sm font-bold text-black">{name}</span>
                        <span className="text-sm font-bold text-[#007AFF] bg-white px-3 py-1 rounded-full shadow-sm">{qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setIsDailyReportOpen(false)}
                  className="flex-1 apple-button-secondary"
                >
                  Funga
                </button>
                <button
                  onClick={shareDailyReport}
                  className="flex-1 bg-[#25D366] text-white font-bold rounded-2xl px-6 py-4 shadow-lg shadow-[#25D366]/20 hover:bg-[#128C7E] transition-all flex items-center justify-center gap-2 active:scale-[0.97]"
                >
                  <Share2 size={20} />
                  WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Insights Section */}
      {predictions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#007AFF]/10 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
                <BrainCircuit size={28} className="text-[#007AFF]" />
              </div>
              <div>
                <h3 className="font-sans font-black text-2xl tracking-tight">Utabiri wa Stock</h3>
                <p className="text-white/50 text-sm font-medium">Uchambuzi wa AI kulingana na mauzo yako</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {predictions.slice(0, 3).map((p) => (
                <div key={p.id} className="bg-white/5 backdrop-blur-md p-6 rounded-[28px] border border-white/10 hover:bg-white/10 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-lg truncate pr-2">{p.name}</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0",
                      p.daysRemaining <= 2 ? "bg-[#FF3B30] shadow-lg shadow-[#FF3B30]/30" : "bg-[#FF9500] shadow-lg shadow-[#FF9500]/30"
                    )}>
                      {p.daysRemaining === 0 ? 'Itaisha Leo' : `Siku ${p.daysRemaining} zimebaki`}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mb-5 leading-relaxed">
                    Kulingana na mauzo, bidhaa hii itaisha baada ya siku {p.daysRemaining}. Agiza sasa!
                  </p>
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#007AFF] bg-white/5 w-fit px-3 py-1.5 rounded-full">
                    <TrendingUpIcon size={14} />
                    <span>Wastani: {p.dailyAvg.toFixed(1)} / siku</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate(action.page)}
            className="apple-card flex flex-col items-center justify-center p-6 group h-full min-h-[160px]"
          >
            <div className={cn("w-14 h-14 rounded-[20px] flex items-center justify-center text-white mb-4 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-xl", action.color)}>
              <action.icon size={28} />
            </div>
            <span className="font-bold text-black text-[14px] tracking-tight text-center px-1 line-clamp-2 leading-tight">{action.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="apple-card p-8 flex flex-col h-full"
          >
            <div className="flex items-center justify-between mb-6">
              <div className={cn("w-14 h-14 rounded-[20px] flex items-center justify-center shadow-sm", stat.bg, stat.color)}>
                <stat.icon size={28} />
              </div>
              <div className="p-2 bg-black/[0.02] rounded-full">
                <ChevronRight size={16} className="text-gray-600" />
              </div>
            </div>
            <p className="text-[13px] text-gray-600 font-bold uppercase tracking-widest mb-1.5">{stat.label}</p>
            <p className={cn("text-2xl font-sans font-black mb-3 tracking-tight", stat.color)}>{stat.value}</p>
            <div className="mt-auto pt-4 border-t border-black/[0.03]">
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border border-black/[0.02] w-fit",
                stat.bg.replace('/10', '/5')
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", stat.color.replace('text-', 'bg-'))} />
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">{stat.trend}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Sales Trend Chart */}
        <div className="xl:col-span-2 apple-card p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="font-sans font-black text-2xl text-black tracking-tight">Mwenendo wa Mauzo</h3>
              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-1.5">Siku 7 zilizopita</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-[#F2F2F7] px-3 py-1.5 rounded-full">
                <div className="w-2.5 h-2.5 rounded-full bg-[#007AFF] shadow-[0_0_8px_rgba(0,122,255,0.5)]" />
                <span className="text-[10px] font-bold text-black uppercase tracking-wider">MAPATO</span>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={salesTrendData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007AFF" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F2F7" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#8E8E93' }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: '#8E8E93' }}
                  tickFormatter={(value) => `Tsh ${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    padding: '16px'
                  }}
                  cursor={{ stroke: '#007AFF', strokeWidth: 1, strokeDasharray: '4 4' }}
                  formatter={(value: number) => [`Tsh ${value.toLocaleString()}`, 'Mapato']}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#007AFF" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorAmount)" 
                  animationDuration={2000}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#007AFF' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="apple-card p-10 flex flex-col">
          <h3 className="font-sans font-black text-2xl text-[#1C1C1E] tracking-tight mb-2">Mchanganuo</h3>
          <p className="text-[11px] text-[#8E8E93] font-bold uppercase tracking-[0.2em] mb-8">Kwa Makundi</p>
          
          <div className="h-[280px] w-full relative flex-1 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                  animationDuration={2000}
                  stroke="none"
                >
                  {categoryData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={['#007AFF', '#5856D6', '#FF2D55', '#AF52DE', '#FF9500'][index % 5]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 15px 30px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-4xl font-sans font-black text-[#1C1C1E] leading-none">{products.length}</span>
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest mt-2">Bidhaa</span>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {categoryData.slice(0, 4).map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-3 bg-[#F2F2F7] p-3 rounded-2xl border border-black/[0.01]">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: ['#007AFF', '#5856D6', '#FF2D55', '#AF52DE', '#FF9500'][i % 5] }} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider leading-none mb-1 truncate max-w-[80px]">{cat.name}</span>
                  <span className="text-sm font-bold text-[#1C1C1E]">{cat.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Recent Sales or Branch Performance */}
        <div className="xl:col-span-2 space-y-8">
          {isConsolidated ? (
            <div className="apple-card overflow-hidden">
              <div className="p-8 border-b border-black/[0.05] flex items-center justify-between bg-white/50">
                <h3 className="font-sans font-black text-xl text-[#1C1C1E] tracking-tight">Utendaji wa Maduka</h3>
                <div className="p-2 bg-[#007AFF]/10 rounded-xl text-[#007AFF]">
                  <Store size={22} />
                </div>
              </div>
              <div className="p-10 space-y-8">
                {branchStats.map((biz, i) => (
                  <div key={biz.name} className="space-y-3">
                    <div className="flex justify-between text-[15px] font-bold">
                      <span className="text-[#1C1C1E]">{biz.name}</span>
                      <span className="text-[#007AFF]">Tsh {biz.revenue.toLocaleString()}</span>
                    </div>
                    <div className="h-4 bg-[#F2F2F7] rounded-full overflow-hidden p-1">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(biz.revenue / (branchStats[0].revenue || 1)) * 100}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-[#007AFF] to-[#5856D6] rounded-full shadow-sm"
                      />
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2.5 py-1 bg-[#007AFF]/5 text-[#007AFF] text-[9px] font-bold uppercase tracking-widest rounded-lg border border-[#007AFF]/10">
                        {biz.salesCount} Mauzo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="apple-card overflow-hidden">
              <div className="p-8 border-b border-black/[0.05] flex items-center justify-between bg-white/50">
                <h3 className="font-sans font-black text-xl text-[#1C1C1E] tracking-tight">Mauzo ya Karibuni</h3>
                <button className="text-[13px] text-[#007AFF] font-bold hover:underline transition-all underline-offset-4">Ona yote</button>
              </div>
              <div className="divide-y divide-black/[0.03]">
                {sales.slice(0, 10).map((sale) => (
                  <div key={sale.id} className="p-6 pr-8 flex items-center justify-between hover:bg-black/[0.01] transition-all group border-b border-black/[0.03] last:border-none">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-[#F2F2F7] rounded-2xl flex items-center justify-center text-[#8E8E93] group-hover:bg-[#007AFF]/10 group-hover:text-[#007AFF] transition-all duration-300">
                        <Clock size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-[#1C1C1E] text-[15px]">
                            #{sale.saleNumber ? sale.saleNumber.toString().padStart(6, '0') : sale.id.slice(-4).toUpperCase()} • {sale.items.length} Bidhaa
                          </p>
                          {isConsolidated && (
                            <span className="text-[10px] bg-[#007AFF]/5 text-[#007AFF] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                              {businesses.find(b => b.id === sale.businessId)?.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#8E8E93] font-medium mt-0.5">{format(parseISO(sale.timestamp), 'dd MMM, HH:mm')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-black/[0.02] p-2 rounded-[20px] border border-black/[0.01]">
                      <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-black/[0.02]">
                        <p className="font-bold text-[#1C1C1E] text-[15px]">Tsh {sale.total.toLocaleString()}</p>
                      </div>
                      <div className="pr-2 hidden sm:block">
                        <p className="text-[9px] text-[#8E8E93] uppercase font-bold tracking-widest leading-none">Cashier</p>
                        <p className="text-[11px] text-[#1C1C1E] font-bold mt-0.5">{sale.cashierId.slice(0, 5)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="apple-card overflow-hidden flex flex-col">
          <div className="p-8 border-b border-black/[0.05] bg-[#FF9500]/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF9500]/10 rounded-xl flex items-center justify-center text-[#FF9500]">
                <AlertCircle size={22} />
              </div>
              <h3 className="font-sans font-black text-xl text-[#1C1C1E] tracking-tight">Tahadhari ya Stoo</h3>
            </div>
          </div>
          <div className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            {lowStockProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#8E8E93] opacity-40 py-10">
                <Package size={48} className="mb-4" />
                <p className="font-semibold">Bidhaa zote zipo za kutosha</p>
              </div>
            ) : (
              lowStockProducts.slice(0, 10).map((product) => (
                <div key={product.id} className="flex items-center justify-between p-4 pr-6 bg-[#F2F2F7] rounded-[24px] border border-black/[0.01] hover:bg-white hover:shadow-lg hover:translate-x-1 transition-all duration-300 group">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-[#1C1C1E] truncate text-[15px]">{product.name}</p>
                    <p className="text-[11px] text-[#8E8E93] uppercase font-bold tracking-widest mt-0.5">
                      {isConsolidated ? businesses.find(b => b.id === product.businessId)?.name : product.category}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-black/[0.02] p-1.5 rounded-[20px] border border-black/[0.01]">
                    <div className={cn(
                      "px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border shadow-sm transition-all duration-500",
                      product.stock === 0 
                        ? "bg-[#FF3B30] text-white apple-error-glow" 
                        : "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/10"
                    )}>
                      {product.stock === 0 ? 'Imeisha!' : `${product.stock} ipo`}
                    </div>
                    <button className="px-4 py-2 bg-[#007AFF] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-[#007AFF]/20 active:scale-95 transition-all">
                      Ongeza
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
