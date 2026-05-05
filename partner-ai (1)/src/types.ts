export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'manager' | 'cashier';
  businessId: string;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  ownerUid: string;
  address?: string;
  phone?: string;
  createdAt: string;
  isMain?: boolean;
  managerPin?: string; // 4-digit PIN for sensitive actions
  lastSaleNumber?: number;
}

export interface Transfer {
  id: string;
  fromBusinessId: string;
  toBusinessId: string;
  items: SaleItem[];
  status: 'pending' | 'completed' | 'cancelled';
  timestamp: string;
  senderId: string;
  receiverId?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  category: string;
  expiryDate?: string;
  lowStockThreshold?: number;
  businessId: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  discount?: number; // Discount applied at checkout
  netTotal: number; // total - discount
  cashierId: string;
  businessId: string;
  timestamp: string;
  adjustedTotal?: number; // Net total after adjustments
  isVoided?: boolean;
  saleNumber?: number;
}

export interface AdjustmentItem {
  productId: string;
  name: string;
  quantity: number; // Positive for returns (add to stock), negative for errors (remove from stock)
  price: number;
}

export interface Adjustment {
  id: string;
  saleId: string;
  businessId: string;
  amount: number; // The change in total (e.g., -500 for a return)
  reason: 'return' | 'error' | 'discount' | 'other';
  note?: string;
  userId: string;
  createdAt: string;
  items: AdjustmentItem[];
}

export interface VoidLog {
  id: string;
  productId: string;
  productName: string;
  cashierId: string;
  businessId: string;
  timestamp: string;
  reason: string;
}

export interface AuditLog {
  id: string;
  type: 'price_change' | 'manual_discount' | 'void' | 'other';
  productId?: string;
  productName?: string;
  originalPrice?: number;
  newPrice?: number;
  cashierId: string;
  businessId: string;
  timestamp: string;
  details: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  debtAmount: number;
  dueDate?: string;
  businessId: string;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  previousStock: number;
  newStock: number;
  difference: number;
  reason: 'correction' | 'damage' | 'found' | 'expired' | 'other';
  note?: string;
  userId: string;
  businessId: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  businessId: string;
  timestamp: string;
}
