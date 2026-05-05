import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { cn } from '../lib/utils';
import { Sale, Expense, Product, Supplier, Business } from '../types';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Store,
  ArrowRight,
  Package,
  Users
} from 'lucide-react';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  subDays,
  isWithinInterval
} from 'date-fns';
import { motion } from 'motion/react';

type TimeRange = 'today' | 'week' | 'month' | 'year';

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line,
  Cell
} from 'recharts';

export const Reports: React.FC = () => {
  const { profile, businesses } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');

  // ... (keep existing logic)

  const isOwner = profile?.role === 'owner';
  const businessIds = isOwner ? businesses.map(b => b.id) : [profile?.businessId].filter(Boolean) as string[];

  useEffect(() => {
    if (businessIds.length === 0) return;

    // Firestore 'in' query limit is 10
    const limitedIds = businessIds.slice(0, 10);

    const unsubSales = onSnapshot(
      query(collection(db, 'sales'), where('businessId', 'in', limitedIds), orderBy('timestamp', 'desc')),
      (s) => setSales(s.docs.map(d => ({ id: d.id, ...d.data() } as Sale)))
    );

    const unsubExpenses = onSnapshot(
      query(collection(db, 'expenses'), where('businessId', 'in', limitedIds)),
      (e) => setExpenses(e.docs.map(d => ({ id: d.id, ...d.data() } as Expense)))
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('businessId', 'in', limitedIds)),
      (p) => setProducts(p.docs.map(d => ({ id: d.id, ...d.data() } as Product)))
    );

    const unsubSuppliers = onSnapshot(
      query(collection(db, 'suppliers'), where('businessId', 'in', limitedIds)),
      (s) => setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)))
    );

    return () => {
      unsubSales();
      unsubExpenses();
      unsubProducts();
      unsubSuppliers();
    };
  }, [JSON.stringify(businessIds)]);

  // Filter data based on selected business and time range
  const getInterval = () => {
    const now = new Date();
    switch (timeRange) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfWeek(now), end: endOfWeek(now) };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year': return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
    }
  };

  const interval = getInterval();

  const filteredSales = sales.filter(s => {
    const matchesBusiness = selectedBusinessId === 'all' || s.businessId === selectedBusinessId;
    const date = parseISO(s.timestamp);
    return matchesBusiness && isWithinInterval(date, interval);
  });

  const filteredExpenses = expenses.filter(e => {
    const matchesBusiness = selectedBusinessId === 'all' || e.businessId === selectedBusinessId;
    const date = parseISO(e.timestamp);
    return matchesBusiness && isWithinInterval(date, interval);
  });

  const filteredProducts = products.filter(p => 
    selectedBusinessId === 'all' || p.businessId === selectedBusinessId
  );

  const filteredSuppliers = suppliers.filter(s => 
    selectedBusinessId === 'all' || s.businessId === selectedBusinessId
  );

  // Calculations
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalCOGS = filteredSales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      return itemSum + ((product?.costPrice || 0) * item.quantity);
    }, 0);
  }, 0);

  const grossProfit = totalRevenue - totalCOGS;
  const totalExp = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossProfit - totalExp;
  const totalStockValue = filteredProducts.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);

  // Branch Comparison Data
  const branchMetrics = businesses.map(biz => {
    const bizSales = sales.filter(s => s.businessId === biz.id && isWithinInterval(parseISO(s.timestamp), interval));
    const bizExpenses = expenses.filter(e => e.businessId === biz.id && isWithinInterval(parseISO(e.timestamp), interval));
    const bizProducts = products.filter(p => p.businessId === biz.id);
    
    const revenue = bizSales.reduce((sum, s) => sum + s.total, 0);
    const exp = bizExpenses.reduce((sum, e) => sum + e.amount, 0);
    const stockVal = bizProducts.reduce((sum, p) => sum + (p.stock * p.costPrice), 0);
    
    return {
      id: biz.id,
      name: biz.name,
      revenue,
      expenses: exp,
      profit: revenue - exp, // Simplified profit for comparison
      stockValue: stockVal,
      supplierCount: suppliers.filter(s => s.businessId === biz.id).length
    };
  });

  // Chart Data Preparation
  const daysInInterval = eachDayOfInterval(interval);
  const trendData = daysInInterval.map(day => {
    const daySales = filteredSales.filter(s => isSameDay(parseISO(s.timestamp), day));
    const dayExpenses = filteredExpenses.filter(e => isSameDay(parseISO(e.timestamp), day));
    
    const revenue = daySales.reduce((sum, s) => sum + (s.netTotal || s.total), 0);
    const exp = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    return {
      date: format(day, 'dd MMM'),
      revenue,
      expenses: exp,
      profit: revenue - exp
    };
  });

  const branchComparisonData = branchMetrics.map(b => ({
    name: b.name,
    revenue: b.revenue,
    profit: b.profit,
    expenses: b.expenses
  }));

  // Top Selling Products Calculation
  const productSales = filteredSales.reduce((acc: { [key: string]: { name: string, quantity: number, revenue: number } }, sale) => {
    sale.items.forEach(item => {
      if (!acc[item.productId]) {
        acc[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
      }
      acc[item.productId].quantity += item.quantity;
      acc[item.productId].revenue += item.price * item.quantity;
    });
    return acc;
  }, {});

  const topProducts = (Object.entries(productSales) as [string, { name: string, quantity: number, revenue: number }][])
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5);

  const COLORS = ['#007AFF', '#34C759', '#FF3B30', '#5856D6', '#FF9500', '#AF52DE'];

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Ripoti za Biashara</h2>
          <p className="text-gray-600 font-medium mt-1">Uchambuzi wa kina wa utendaji wa maduka yako</p>
        </motion.div>

        <div className="flex flex-wrap items-center gap-3">
          {isOwner && (
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-black/[0.05] shadow-sm hover:border-black/[0.1] transition-all">
              <Store size={18} className="text-[#007AFF]" />
              <select 
                value={selectedBusinessId}
                onChange={(e) => setSelectedBusinessId(e.target.value)}
                className="bg-transparent outline-none font-bold text-[13px] text-black cursor-pointer"
              >
                <option value="all">Maduka Yote</option>
                {businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-black/[0.05] shadow-sm hover:border-black/[0.1] transition-all">
            <Calendar size={18} className="text-[#007AFF]" />
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="bg-transparent outline-none font-bold text-[13px] text-black cursor-pointer"
            >
              <option value="today">Leo</option>
              <option value="week">Wiki Hii</option>
              <option value="month">Mwezi Huu</option>
              <option value="year">Mwaka Huu</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Mauzo', value: `Tsh ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10', sub: 'Jumla ya mapato' },
          { label: 'Matumizi', value: `Tsh ${totalExp.toLocaleString()}`, icon: TrendingDown, color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10', sub: 'Gharama za uendeshaji' },
          { label: 'Faida Halisi', value: `Tsh ${netProfit.toLocaleString()}`, icon: DollarSign, color: 'text-white', bg: 'bg-[#1C1C1E]', sub: 'Baada ya kutoa gharama', dark: true },
          { label: 'Thamani ya Stoo', value: `Tsh ${totalStockValue.toLocaleString()}`, icon: Package, color: 'text-[#5856D6]', bg: 'bg-[#5856D6]/10', sub: 'Thamani ya bidhaa' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "apple-card p-8 flex flex-col h-full",
              stat.dark && "bg-[#1C1C1E] border-none shadow-2xl shadow-black/20"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm",
              stat.bg,
              !stat.dark && stat.color
            )}>
              <stat.icon size={24} />
            </div>
            <p className={cn(
              "text-[11px] font-bold uppercase tracking-[0.2em] mb-2",
              stat.dark ? "text-white/50" : "text-gray-600"
            )}>{stat.label}</p>
            <h4 className={cn(
              "text-2xl font-sans font-black tracking-tight",
              stat.dark ? "text-white" : "text-black"
            )}>{stat.value}</h4>
            <div className="mt-4">
              <div className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit border",
                stat.dark 
                  ? "bg-white/5 text-white/50 border-white/10" 
                  : "bg-black/[0.03] text-gray-600 border-black/[0.01]"
              )}>
                {stat.sub}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Branch Comparison Table */}
      {isOwner && selectedBusinessId === 'all' && (
        <div className="apple-card overflow-hidden">
          <div className="p-8 border-b border-black/[0.05] bg-white/50 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-sans font-black text-black tracking-tight">Ulinganifu wa Maduka</h3>
              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mt-1">Utendaji kwa kila duka</p>
            </div>
            <div className="bg-[#F2F2F7] px-4 py-2 rounded-full flex items-center gap-2 text-[11px] font-bold text-gray-600 uppercase tracking-widest">
              <Store size={14} />
              <span>{businesses.length} Maduka</span>
            </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-gray-600 border-b border-black/[0.03]">
                  <th className="px-8 py-5 font-bold">Duka</th>
                  <th className="px-8 py-5 font-bold">Mauzo</th>
                  <th className="px-8 py-5 font-bold">Matumizi</th>
                  <th className="px-8 py-5 font-bold">Faida</th>
                  <th className="px-8 py-5 font-bold">Stock Value</th>
                  <th className="px-8 py-5 font-bold">Suppliers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.02]">
                {branchMetrics.map((biz) => (
                  <tr key={biz.id} className="group hover:bg-black/[0.01] transition-all duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F2F2F7] rounded-xl flex items-center justify-center text-gray-600 group-hover:bg-[#007AFF]/10 group-hover:text-[#007AFF] transition-all">
                          <Store size={18} />
                        </div>
                        <span className="font-bold text-black text-[15px]">{biz.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-[14px] font-medium text-black">Tsh {biz.revenue.toLocaleString()}</td>
                    <td className="px-8 py-6 text-[14px] font-medium text-[#FF3B30]">Tsh {biz.expenses.toLocaleString()}</td>
                    <td className="px-8 py-6">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[11px] font-bold",
                        biz.profit >= 0 ? "bg-[#34C759]/10 text-[#34C759]" : "bg-[#FF3B30]/10 text-[#FF3B30]"
                      )}>
                        Tsh {biz.profit.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-[14px] font-medium text-[#5856D6]">Tsh {biz.stockValue.toLocaleString()}</td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-1.5 text-gray-600 font-bold text-[13px]">
                        <Users size={14} />
                        <span>{biz.supplierCount}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-8">
        {/* Revenue vs Expenses Trend */}
        <div className="apple-card p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-sans font-black text-black tracking-tight">Mwenendo wa Kifedha</h3>
              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-1.5">Mapato vs Matumizi</p>
            </div>
          </div>
          
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F2F2F7" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#4B5563' }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#4B5563' }}
                  tickFormatter={(value) => `Tsh ${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1)',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    padding: '15px'
                  }}
                  cursor={{ stroke: '#F2F2F7', strokeWidth: 2 }}
                />
                <Legend 
                  verticalAlign="top" 
                  align="right" 
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '30px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Mapato"
                  stroke="#007AFF" 
                  strokeWidth={4}
                  dot={{ r: 0 }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#007AFF' }}
                  animationDuration={2000}
                />
                <Line 
                  type="monotone" 
                  dataKey="expenses" 
                  name="Matumizi"
                  stroke="#FF3B30" 
                  strokeWidth={4}
                  dot={{ r: 0 }}
                  activeDot={{ r: 8, strokeWidth: 0, fill: '#FF3B30' }}
                  animationDuration={2000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Branch Comparison Chart */}
        {isOwner && selectedBusinessId === 'all' && (
          <div className="apple-card p-10">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-sans font-black text-black tracking-tight">Ulinganifu wa Maduka</h3>
                <p className="text-[11px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-1.5">Utendaji kwa kila duka</p>
              </div>
            </div>
            
            <div className="h-[450px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchComparisonData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F2F2F7" />
                  <XAxis 
                    type="number"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 600, fill: '#4B5563' }}
                    tickFormatter={(value) => `Tsh ${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
                    dy={15}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fontWeight: 700, fill: '#000000' }}
                    width={120}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '20px', 
                      border: 'none', 
                      boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.1)',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      padding: '15px'
                    }}
                    cursor={{ fill: '#F2F2F7' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '30px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    name="Mapato" 
                    fill="#007AFF" 
                    radius={[0, 10, 10, 0]} 
                    barSize={24}
                    animationDuration={2000}
                  />
                  <Bar 
                    dataKey="profit" 
                    name="Faida" 
                    fill="#34C759" 
                    radius={[0, 10, 10, 0]} 
                    barSize={24}
                    animationDuration={2000}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Selling Products Section */}
        <div className="apple-card p-10">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-sans font-black text-black tracking-tight">Bidhaa Zinazouza Sana</h3>
              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-1.5">Bidhaa 5 bora kwa idadi ya mauzo</p>
            </div>
          </div>

          <div className="space-y-6">
            {topProducts.length === 0 ? (
              <div className="text-center py-10 text-gray-500 font-medium">Hakuna data ya mauzo kwa kipindi hiki</div>
            ) : (
              topProducts.map(([id, data], index) => (
                <div key={id} className="flex items-center justify-between p-4 rounded-2xl bg-black/[0.02] hover:bg-black/[0.04] transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center font-bold text-[#007AFF] shadow-sm border border-black/[0.03]">
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-black">{data.name}</h4>
                        {index === 0 && (
                          <span className="bg-[#007AFF] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            TOP BRAND
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                        {data.quantity} zimeuzwa
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-black">Tsh {data.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Mapato</p>
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
