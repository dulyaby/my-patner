import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { ProductProvider } from './context/ProductContext';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { POS } from './components/POS';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Suppliers } from './components/Suppliers';
import { Expenses } from './components/Expenses';
import { Purchase } from './components/Purchase';
import { CashControl } from './components/CashControl';
import { Logs } from './components/Logs';
import { Reports } from './components/Reports';
import { Branches } from './components/Branches';
import { Transfers } from './components/Transfers';
import { SalesHistory } from './components/SalesHistory';
import { BossAI } from './components/BossAI';
import { OnlineStatus } from './components/OnlineStatus';
import { ScreenFlash } from './components/ScreenFlash';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('pos');

  React.useEffect(() => {
    if (user && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="w-12 h-12 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Removed mandatory auth screen to allow direct access
  
  const renderContent = () => {
    switch (activeTab) {
      case 'pos': return <POS />;
      case 'sales_history': return <SalesHistory />;
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />;
      case 'inventory': return <Inventory />;
      case 'transfers': return <Transfers />;
      case 'suppliers': return <Suppliers />;
      case 'expenses': return <Expenses />;
      case 'purchase': return <Purchase />;
      case 'cash_control': return <CashControl />;
      case 'reports': return <Reports />;
      case 'branches': return <Branches />;
      case 'logs': return <Logs />;
      case 'boss_ai': return <BossAI />;
      default: return <POS />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <OnlineStatus />
      <ScreenFlash />
      {renderContent()}
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ProductProvider>
      {/* Luxury Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] bg-[#F8F8FB]">
        {/* Main Luxury Glow (Bottom Right) */}
        <div className="luxury-bg-glow -bottom-[10%] -right-[10%] w-[90%] h-[90%] bg-[#007AFF]/50" />
        
        {/* Secondary Accent (Top Left) */}
        <div className="luxury-bg-glow -top-[10%] -left-[10%] w-[70%] h-[70%] bg-[#5856D6]/30" style={{ animationDelay: '-5s' }} />
        
        {/* Vibrant Middle Highlight */}
        <div className="luxury-bg-glow top-[20%] left-[20%] w-[50%] h-[50%] bg-[#007AFF]/20 blur-[180px]" style={{ animationDelay: '-12s' }} />
        
        {/* Glass Grain Overlay */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
        
        {/* Additional Luxury Mesh Layer */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#007AFF]/5 via-transparent to-[#5856D6]/5" />
      </div>
      
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
      <Toaster 
        position="top-right" 
        toastOptions={{
          error: {
            className: 'toast-error-glow',
            duration: 4000,
            style: {
              borderRadius: '24px',
              padding: '16px 24px',
              fontWeight: 'bold',
            }
          },
          success: {
            className: 'toast-success-glow',
            duration: 3000,
            style: {
              borderRadius: '24px',
              padding: '16px 24px',
              fontWeight: 'bold',
            }
          }
        }}
      />
    </ProductProvider>
    </AuthProvider>
  );
}
