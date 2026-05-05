import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  doc, 
  updateDoc, 
  increment,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Product, SaleItem } from '../types';
import { useProducts } from '../context/ProductContext';
import { Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle, AlertTriangle, X, Receipt, Share2, Percent, Printer, Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { triggerScreenFlash } from './ScreenFlash';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { differenceInDays, parseISO, format } from 'date-fns';
import { PinModal } from './PinModal';
import fuzzysort from 'fuzzysort';
import { processVoiceTranscript } from '../services/partnerAIService';

import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

export const POS: React.FC = () => {
  const { profile, activeBusiness } = useAuth();
  const { products } = useProducts();
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [detectedItem, setDetectedItem] = useState<{ product: Product; quantity: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  
  // Partner AI state
  const [isListening, setIsListening] = useState(false);
  const [isAIListening, setIsAIListening] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiTranscript, setAiTranscript] = useState('');

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [parkedCarts, setParkedCarts] = useState<{ id: string; items: SaleItem[]; timestamp: Date }[]>([]);

  // Security state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'remove' | 'discount' | 'void' | 'price_override', data?: any } | null>(null);

  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [todaySales, setTodaySales] = useState(0);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, 'sales'),
      where('businessId', '==', activeBusiness.id),
      where('timestamp', '>=', startOfDay.toISOString())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      snapshot.forEach((doc) => {
        total += doc.data().netTotal || 0;
      });
      setTodaySales(total);
    }, (error) => {
      console.error("Error fetching today sales:", error);
    });

    return () => unsubscribe();
  }, [activeBusiness?.id]);

  const playPopSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.error("Audio feedback failed:", e);
    }
  };

  const handlePrint58mm = () => {
    if (!lastSale || !activeBusiness) return;

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      toast.error('Tafadhali ruhusu pop-ups ili kuprint risiti');
      return;
    }

    const receiptHtml = `
      <html>
        <head>
          <title>Risiti - ${activeBusiness.name}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 58mm; 
              margin: 0; 
              padding: 5mm; 
              font-size: 12px;
              line-height: 1.2;
              color: #000;
              background: #fff;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .header { margin-bottom: 15px; }
            .footer { margin-top: 20px; font-size: 10px; }
            .logo { font-size: 32px; color: #007AFF; margin-bottom: 8px; }
            .business-name { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
            .item-list { margin: 10px 0; }
            .total-section { margin-top: 10px; }
            .success-badge { 
              display: inline-block; 
              padding: 2px 8px; 
              background: #007AFF; 
              color: white; 
              font-weight: bold; 
              border-radius: 4px;
              margin-top: 10px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="center header">
            <div class="logo">★</div>
            <div class="business-name">${activeBusiness.name}</div>
            <div>${activeBusiness.address || 'Tanzania'}</div>
            <div>Tel: ${activeBusiness.phone || ''}</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="flex">
            <span>Cashier:</span>
            <span class="bold">${profile?.displayName || 'N/A'}</span>
          </div>
          <div class="flex">
            <span>Date:</span>
            <span>${format(new Date(lastSale.timestamp), 'dd/MM/yy HH:mm')}</span>
          </div>
          <div class="flex">
            <span>ID:</span>
            <span>${lastSale.id.slice(-8).toUpperCase()}</span>
          </div>
          
          <div class="divider"></div>
          
          <div class="bold flex">
            <span>Item</span>
            <span>Total</span>
          </div>
          
          <div class="item-list">
            ${lastSale.items.map((item: any) => `
              <div class="flex">
                <span>${item.name} x${item.quantity}</span>
                <span>${(item.quantity * item.price).toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="divider"></div>
          
          <div class="total-section">
            <div class="flex">
              <span>Subtotal:</span>
              <span>${lastSale.total.toLocaleString()}</span>
            </div>
            ${lastSale.discount > 0 ? `
              <div class="flex">
                <span>Discount:</span>
                <span>-${lastSale.discount.toLocaleString()}</span>
              </div>
            ` : ''}
            <div class="flex bold" style="font-size: 14px; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px;">
              <span>TOTAL:</span>
              <span>Tsh ${lastSale.netTotal.toLocaleString()}</span>
            </div>
          </div>
          
          <div class="center footer">
            <div class="success-badge">SUCCESS</div>
            <p style="margin-top: 15px; font-weight: bold;">Thank you for coming.<br>We are appreciate your sale</p>
            <p style="font-size: 8px; margin-top: 10px;">Powered by Biashara Smart</p>
          </div>
          
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  const addToCart = (product: Product) => {
    addToCartWithQuantity(product, 1);
  };

  const addToCartWithQuantity = (product: Product, quantity: number) => {
    if (product.stock <= 0) {
      triggerScreenFlash('warning');
      toast.error('Bidhaa imeisha stoo!');
      return;
    }

    playPopSound();
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 1000);

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: quantity 
      }];
    });
  };

  const removeFromCart = (productId: string, name: string) => {
    // Samsung Pillar: Manager PIN required for removal if not owner/manager
    if (profile?.role === 'cashier' && activeBusiness?.managerPin) {
      setPendingAction({ type: 'remove', data: { productId, name } });
      setPinModalOpen(true);
      return;
    }
    executeRemoveFromCart(productId, name);
  };

  const executeRemoveFromCart = (productId: string, name: string) => {
    addDoc(collection(db, 'voidLogs'), {
      productId,
      productName: name,
      cashierId: profile?.uid,
      businessId: profile?.businessId,
      timestamp: new Date().toISOString(),
      reason: 'Manual removal from cart'
    }).catch(e => console.error("Error logging void:", e));

    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleDiscount = () => {
    if (profile?.role === 'cashier' && activeBusiness?.managerPin) {
      setPendingAction({ type: 'discount' });
      setPinModalOpen(true);
      return;
    }
    const amount = prompt('Weka kiasi cha punguzo (Tsh):');
    if (amount && !isNaN(Number(amount))) {
      setDiscount(Number(amount));
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    playPopSound();
    setLastAddedId(productId);
    setTimeout(() => setLastAddedId(null), 800);
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        
        // Samsung Pillar: Manager PIN required for reducing quantity if cashier
        if (delta < 0 && item.quantity > 1 && profile?.role === 'cashier' && activeBusiness?.managerPin) {
          setPendingAction({ type: 'void', data: { productId, delta, name: item.name } });
          setPinModalOpen(true);
          return item;
        }

        if (delta < 0 && item.quantity > 1) {
          addDoc(collection(db, 'voidLogs'), {
            productId,
            productName: item.name,
            cashierId: profile?.uid,
            businessId: profile?.businessId,
            timestamp: new Date().toISOString(),
            reason: `Quantity reduced from ${item.quantity} to ${newQty}`
          }).catch(e => console.error("Error logging void:", e));
        }
        
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = Math.max(0, subtotal - discount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!activeBusiness?.id) {
      triggerScreenFlash('warning');
      toast.error('Tafadhali chagua duka kwanza...');
      return;
    }
    setLoading(true);

    try {
      const batch = writeBatch(db);
      const bizRef = doc(db, 'businesses', activeBusiness.id);
      const bizDoc = await getDoc(bizRef);
      
      let nextSaleNumber = 1;

      if (bizDoc.exists()) {
        const currentLast = bizDoc.data()?.lastSaleNumber || 0;
        nextSaleNumber = currentLast + 1;
        batch.update(bizRef, { lastSaleNumber: nextSaleNumber });
      }

      const saleRef = doc(collection(db, 'sales'));
      const saleData = {
        items: cart,
        total: subtotal,
        discount,
        netTotal: total,
        cashierId: profile?.uid,
        businessId: activeBusiness.id,
        timestamp: new Date().toISOString(),
        saleNumber: nextSaleNumber
      };

      batch.set(saleRef, saleData);

      cart.forEach(item => {
        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, {
          stock: increment(-item.quantity),
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit();

      setLastSale({ ...saleData, id: saleRef.id });
      setShowReceipt(true);
      setCart([]);
      setDiscount(0);
      triggerScreenFlash('success');
      toast.success('Malipo yamekamilika!');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'sales/checkout');
    } finally {
      setLoading(false);
    }
  };

  const parkCart = () => {
    if (cart.length === 0) return;
    setParkedCarts(prev => [...prev, { id: Date.now().toString(), items: cart, timestamp: new Date() }]);
    setCart([]);
    setDiscount(0);
    toast.success('Gari imehifadhiwa!');
  };

  const recallCart = (parkedCart: { id: string; items: SaleItem[] }) => {
    setCart(parkedCart.items);
    setParkedCarts(prev => prev.filter(c => c.id !== parkedCart.id));
    toast.success('Gari imerejeshwa!');
  };

  const handlePinSuccess = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'remove') {
      executeRemoveFromCart(pendingAction.data.productId, pendingAction.data.name);
    } else if (pendingAction.type === 'discount') {
      const amount = prompt('Weka kiasi cha punguzo (Tsh):');
      if (amount && !isNaN(Number(amount))) {
        setDiscount(Number(amount));
      }
    } else if (pendingAction.type === 'void') {
      const { productId, delta, name } = pendingAction.data;
      const item = cart.find(i => i.productId === productId);
      if (item) {
        const newQty = Math.max(1, item.quantity + delta);
        addDoc(collection(db, 'auditLogs'), {
          type: 'void',
          productId,
          productName: name,
          cashierId: profile?.uid,
          businessId: activeBusiness?.id,
          timestamp: new Date().toISOString(),
          details: `Quantity reduced from ${item.quantity} to ${newQty}`
        }).catch(e => console.error("Error logging void:", e));

        setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: newQty } : i));
      }
    } else if (pendingAction.type === 'price_override') {
      const { productId, name, originalPrice } = pendingAction.data;
      const amount = prompt(`Weka bei mpya ya ${name} (Bei ya sasa: Tsh ${originalPrice.toLocaleString()}):`);
      if (amount && !isNaN(Number(amount))) {
        const newPrice = Number(amount);
        addDoc(collection(db, 'auditLogs'), {
          type: 'price_change',
          productId,
          productName: name,
          originalPrice,
          newPrice,
          cashierId: profile?.uid,
          businessId: activeBusiness?.id,
          timestamp: new Date().toISOString(),
          details: `Price changed from ${originalPrice} to ${newPrice}`
        }).catch(e => console.error("Error logging price change:", e));

        setCart(prev => prev.map(i => i.productId === productId ? { ...i, price: newPrice } : i));
      }
    }
    setPendingAction(null);
  };

  const startVoiceAssistant = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Browser yako haisupport voice input.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'sw-TZ,en-US';
    recognition.continuous = true; // Stay active
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setAiTranscript('Sikiliza... (Sema jina la bidhaa, "Cash", au "Delete")');
    };

    recognition.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const transcript = event.results[lastResultIndex][0].transcript.toLowerCase();
      setAiTranscript(transcript);
      processVoiceCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        toast.error('Ruhusu ufikiaji wa microphone kwenye browser yako.');
        setIsListening(false);
      } else if (event.error === 'network') {
        toast.error('Hitilafu ya intaneti. Angalia connection yako.');
        setIsListening(false);
      } else if (event.error !== 'no-speech') {
        toast.error('Voice input imeshindwa.');
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Re-start if still listening mode
      if (isListening) {
        try { recognition.start(); } catch (e) { console.error(e); }
      }
    };

    recognition.start();
    (window as any).currentRecognition = recognition;
  };

  const startAIVoiceAssistant = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Browser yako haisupport voice input.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'sw-TZ,en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsAIListening(true);
      toast.loading('Partner AI inasikiliza...', { id: 'ai-listen' });
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      toast.dismiss('ai-listen');
      const processingToast = toast.loading('Inachakata...');
      
      try {
        const aiResponse = await processVoiceTranscript(transcript);
        
        toast.dismiss(processingToast);
        
        if (aiResponse) {
          switch (aiResponse.action) {
            case 'PROCESS_PAYMENT':
              handleCheckout();
              break;
            case 'ADD_ITEM':
              aiResponse.data.forEach(item => {
                if (!item.raw_input) return;
                const results = fuzzysort.go(item.raw_input, products, { key: 'name', limit: 1 });
                if (results.length > 0) addToCartWithQuantity(results[0].obj, item.qty || 1);
              });
              break;
            case 'REMOVE_ITEM':
              aiResponse.data.forEach(item => {
                if (item.raw_input) removeFromCart(item.raw_input, item.raw_input);
              });
              break;
            case 'SELL_SPECIFIC':
              aiResponse.data.forEach(item => {
                if (!item.raw_input) return;
                const results = fuzzysort.go(item.raw_input, products, { key: 'name', limit: 1 });
                if (results.length > 0) {
                  addToCartWithQuantity(results[0].obj, item.qty || 1);
                  handleCheckout();
                }
              });
              break;
            case 'APPLY_DISCOUNT':
              aiResponse.data.forEach(item => {
                if (item.value) {
                  const discountAmount = (subtotal * item.value) / 100;
                  setDiscount(discountAmount);
                  toast.success(`Discount ya ${item.value}% imewekwa!`);
                }
              });
              break;
          }
        } else {
          toast.error('AI imeshindwa kuelewa.');
        }
      } catch (error: any) {
        toast.dismiss(processingToast);
        if (error.message === 'QUOTA_EXCEEDED') {
          toast.error('AI quota imejaa. Tafadhali jaribu tena baadae.');
        } else {
          toast.error('Hitilafu imetokea kwenye AI.');
        }
      }
    };

    recognition.onend = () => {
      if (isAIListening) recognition.start();
    };

    recognition.start();
    (window as any).currentAIRecognition = recognition;
  };

  const stopVoiceAssistant = () => {
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
      (window as any).currentRecognition = null;
    }
    setIsListening(false);
  };

  const stopAIVoiceAssistant = () => {
    if ((window as any).currentAIRecognition) {
      (window as any).currentAIRecognition.stop();
      (window as any).currentAIRecognition = null;
    }
    setIsAIListening(false);
  };

  const processVoiceCommand = (transcript: string) => {
    const rawT = transcript.toLowerCase().trim();
    
    // 1. Precise command detection (Exact Match Priority)
    const commands = {
      pay: ['cash', 'lipa', 'malipo'],
      del: ['delete', 'futa', 'ondoa']
    };

    if (commands.pay.includes(rawT)) {
      if (cart.length > 0) { handleCheckout(); return; }
      else { toast.error('Gari ni tupu!'); return; }
    }
    
    if (commands.del.includes(rawT)) {
      if (cart.length > 0) {
        const lastItem = cart[cart.length - 1];
        removeFromCart(lastItem.productId, lastItem.name);
        toast.success(`Imeondolewa: ${lastItem.name}`);
        return;
      }
    }

    // 2. Product Detection (Strip command words if present)
    let searchName = rawT;
    commands.pay.forEach(cmd => searchName = searchName.replace(cmd, ''));
    commands.del.forEach(cmd => searchName = searchName.replace(cmd, ''));
    
    // Identify quantity (e.g., "3 kuku")
    const qtyMatch = searchName.match(/(\d+)\s*([a-z\s]+)/) || searchName.match(/([a-z\s]+)\s*(\d+)/);
    
    let qty = 1;
    if (qtyMatch) {
      if (!isNaN(Number(qtyMatch[1]))) { qty = Number(qtyMatch[1]); searchName = qtyMatch[2]; }
      else if (!isNaN(Number(qtyMatch[2]))) { qty = Number(qtyMatch[2]); searchName = qtyMatch[1]; }
    }
    
    searchName = searchName.trim();
    if (!searchName) return;

    // 3. Priority Scoring (Same as before)
    const sortedProducts = [...products].sort((a, b) => {
      const aPriority = (a.stock <= (a.lowStockThreshold || 10) ? 10 : 0) + (a.expiryDate ? 5 : 0);
      const bPriority = (b.stock <= (b.lowStockThreshold || 10) ? 10 : 0) + (b.expiryDate ? 5 : 0);
      return bPriority - aPriority;
    });

    const results = fuzzysort.go(searchName, sortedProducts, { key: 'name', limit: 1 });
    
    if (results.length > 0) {
      const product = results[0].obj;
      addToCartWithQuantity(product, qty);
      toast.success(`${product.name} (${qty})`);
    } else {
      toast(`Sijaelewa: ${searchName}`, { icon: '🤔' });
    }
  };

  const processBulkSales = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split('\n');
    let addedCount = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const match = trimmed.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      const name = match ? match[1].trim() : trimmed;
      const qty = match ? Number(match[2]) : 1;

      const results = fuzzysort.go(name, products, { key: 'name', limit: 1 });
      if (results.length > 0) {
        const product = results[0].obj;
        addToCartWithQuantity(product, qty);
        addedCount++;
      } else {
        toast.error(`"${name}" haipo!`, { duration: 1500 });
      }
    });

    if (addedCount > 0) {
      toast.success(`Imeongezwa bidhaa ${addedCount}`);
      setBulkText('');
      setIsBulkMode(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setDetectedItem(null);
      return;
    }

    // Regex: name + quantity + unit (optional)
    const match = searchQuery.match(/^([a-zA-Z\s]+?)(\d+(?:\.\d+)?)\s*(kg|g|liter|l|ml|pcs)?$/i);
    
    let nameToSearch = searchQuery;
    let quantity = 1;

    if (match) {
      nameToSearch = match[1].trim();
      quantity = Number(match[2]);
    }

    // Fuzzy matching
    const results = fuzzysort.go(nameToSearch, products, { 
      key: 'name',
      limit: 5,
      threshold: -1000 
    });

    const bestMatches = results.map(r => r.obj as Product);
    setSuggestions(bestMatches);

    if (bestMatches.length > 0 && match) {
      setDetectedItem({ product: bestMatches[0], quantity });
    } else {
      setDetectedItem(null);
    }
  }, [searchQuery, products]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (detectedItem) {
        addToCartWithQuantity(detectedItem.product, detectedItem.quantity);
        setSearchQuery('');
      } else if (suggestions.length > 0) {
        addToCart(suggestions[0]);
        setSearchQuery('');
      }
    }
  };

  const handleSuggestionClick = (product: Product) => {
    addToCart(product);
    setSearchQuery('');
    setSuggestions([]);
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full font-sans">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Daily Insight Header */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex-1 flex items-center gap-4 glass p-4 rounded-[24px] border-white/40 shadow-sm">
            <div className="w-12 h-12 bg-[#34C759]/10 rounded-2xl flex items-center justify-center text-[#34C759]">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Mauzo ya Leo</p>
              <h3 className="text-xl font-sans font-black text-black">Tsh {todaySales.toLocaleString()}</h3>
            </div>
          </div>
          
          {/* Partner AI Feedback Area */}
          <div className={cn(
            "flex-1 flex items-center gap-4 p-4 rounded-[24px] border-2 transition-all duration-500",
            isListening ? "bg-[#FF3B30]/5 border-[#FF3B30]/20" : 
            isProcessingAI ? "bg-[#007AFF]/5 border-[#007AFF]/20" : 
            aiTranscript ? "bg-black/5 border-black/5" : "bg-transparent border-transparent"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              isListening ? "bg-[#FF3B30] text-white" : "bg-black/10 text-gray-600"
            )}>
              {isProcessingAI ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Partner AI Voice Feedback</p>
              <p className={cn(
                "text-sm font-black truncate transition-all duration-300",
                isListening ? "text-[#FF3B30] animate-pulse scale-105 origin-left" : "text-black"
              )}>
                {isListening ? "Listening..." : isProcessingAI ? "Chakichakata..." : (aiTranscript ? `"${aiTranscript}"` : "Anasikiliza...")}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 space-y-6">
          <div className="relative group flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsBulkMode(!isBulkMode)}
                className={cn(
                  "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2",
                  isBulkMode ? "bg-[#007AFF] text-white" : "bg-black/[0.05] text-gray-600 hover:bg-black/[0.08]"
                )}
              >
                <Plus size={14} />
                Multiple Sales
              </button>
              {isBulkMode && (
                <span className="text-[10px] font-bold text-[#007AFF] uppercase tracking-widest animate-pulse">Bulk Entry Mode Active</span>
              )}
            </div>

            <div className="flex gap-2 mb-2">
              <button
                onClick={isListening ? stopVoiceAssistant : startVoiceAssistant}
                className={cn(
                  "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95",
                  isListening 
                    ? "bg-[#FF3B30] text-white animate-pulse" 
                    : "bg-[#007AFF] text-white hover:bg-[#0051A8]"
                )}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                {isListening ? "Simamisha Sauti" : "Washa Sauti (Voice)"}
              </button>

              <button
                onClick={isAIListening ? stopAIVoiceAssistant : startAIVoiceAssistant}
                className={cn(
                  "px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95 text-white",
                  isAIListening 
                    ? "bg-[#FF3B30] animate-pulse" 
                    : "bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600"
                )}
              >
                {isAIListening ? <MicOff size={16} /> : <Sparkles size={16} />}
                {isAIListening ? "Simamisha AI" : "Partner AI Voice"}
              </button>
            </div>

            <div className="relative">
              {isBulkMode ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    autoFocus
                    placeholder="Weka bidhaa nyingi (mfano: Sukari 5&#10;Chumvi 2)..."
                    className="w-full p-6 rounded-[24px] bg-white border border-black/[0.05] shadow-sm focus:ring-4 focus:ring-[#007AFF]/10 focus:border-[#007AFF]/20 outline-none transition-all text-lg font-medium placeholder:text-gray-400 min-h-[150px] resize-none"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                  />
                  <div className="flex justify-end pr-2">
                    <button
                      onClick={processBulkSales}
                      disabled={!bulkText.trim()}
                      className="px-8 py-3 bg-[#007AFF] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#0051A8] transition-all active:scale-95 disabled:opacity-50"
                    >
                      Ongeza kwa Gari
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-[#007AFF]" size={22} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Tafuta bidhaa (mfano: Sukari 5)..."
                    className={cn(
                      "w-full pl-14 pr-24 py-5 rounded-[24px] bg-white border border-black/[0.05] shadow-sm focus:ring-4 focus:ring-[#007AFF]/10 focus:border-[#007AFF]/20 outline-none transition-all text-lg font-medium placeholder:text-gray-600",
                      isProcessingAI && "opacity-50 pointer-events-none"
                    )}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                </>
              )}
              
              <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {!isBulkMode && searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-gray-600 hover:text-black p-1.5 bg-black/[0.03] rounded-full transition-all"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* AI Status Indicator */}
            {isListening && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-14 -bottom-8 flex items-center gap-2"
              >
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1 h-1 bg-[#FF3B30] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-[#FF3B30] uppercase tracking-widest">Partner AI Listening...</span>
              </motion.div>
            )}

            {isProcessingAI && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-14 -bottom-8 flex items-center gap-2"
              >
                <Loader2 size={12} className="animate-spin text-[#007AFF]" />
                <span className="text-[10px] font-bold text-[#007AFF] uppercase tracking-widest">Partner AI Processing...</span>
              </motion.div>
            )}
            
            {/* Suggestions Dropdown */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 right-0 top-full mt-2 bg-white rounded-[24px] shadow-2xl border border-black/[0.05] overflow-hidden z-50 p-2"
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSuggestionClick(s)}
                      className="w-full text-left p-4 hover:bg-[#007AFF]/5 rounded-xl transition-all flex justify-between items-center group"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-black group-hover:text-[#007AFF]">{s.name}</span>
                        <span className="text-xs text-gray-500">{s.category}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-[#007AFF]">Tsh {s.price.toLocaleString()}</span>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.stock} ipo</p>
                      </div>
                    </button>
                  ))}
                  {detectedItem && (
                    <div className="p-3 bg-[#34C759]/10 border-t border-black/[0.05] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#34C759] uppercase tracking-widest">Auto-Detect: {detectedItem.quantity} units</span>
                      <span className="text-[10px] text-gray-500">Press Enter to add</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-6 py-3 rounded-2xl text-[15px] font-bold whitespace-nowrap transition-all active:scale-[0.95]",
                !selectedCategory 
                  ? "bg-[#007AFF] text-white shadow-xl shadow-[#007AFF]/30" 
                  : "glass text-gray-600 hover:bg-white/60"
              )}
            >
              Zote
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-6 py-3 rounded-2xl text-[15px] font-bold whitespace-nowrap transition-all active:scale-[0.95]",
                  selectedCategory === cat
                    ? "bg-[#007AFF] text-white shadow-xl shadow-[#007AFF]/30" 
                    : "glass text-gray-600 hover:bg-white/60"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 overflow-y-auto pb-6 custom-scrollbar pr-1">
          {filteredProducts.map((product) => (
            <motion.button
              whileHover={{ y: -6, boxShadow: "0 25px 30px -5px rgb(0 0 0 / 0.15), 0 12px 15px -6px rgb(0 0 0 / 0.1)" }}
              whileTap={{ scale: 0.95 }}
              key={product.id}
              onClick={() => addToCart(product)}
              className="apple-card p-6 text-center flex flex-col h-full relative group overflow-hidden border-2 border-transparent hover:border-[#007AFF]/10"
            >
              {/* Badges */}
              <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                {product.stock > 0 && product.stock <= (product.lowStockThreshold || 5) && (
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="bg-[#FF9500] text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg flex items-center gap-1 uppercase tracking-tighter"
                  >
                    <AlertTriangle size={10} /> Stock Ndogo
                  </motion.div>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center pt-4">
                <div className="relative mb-3">
                  <h3 className="font-bold text-black text-[18px] leading-tight group-hover:text-[#007AFF] transition-colors px-2">{product.name}</h3>
                  {product.expiryDate && (() => {
                    const days = differenceInDays(parseISO(product.expiryDate), new Date());
                    if (days < 0) return <div className="absolute -top-2 -right-6 p-1.5 bg-red-50 rounded-full shadow-sm border border-red-100"><AlertTriangle size={14} className="text-red-500" /></div>;
                    if (days <= 10) return <div className="absolute -top-2 -right-6 p-1.5 bg-orange-50 rounded-full shadow-sm border border-orange-100"><AlertTriangle size={14} className="text-orange-500" /></div>;
                    return null;
                  })()}
                </div>
                
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest bg-black/[0.03] px-3 py-1 rounded-full border border-black/[0.01] mb-4">
                  {product.category}
                </span>

                {/* Stock Badge - Centered and Prominent */}
                <div className="flex-1 flex items-center justify-center w-full my-2">
                  <div className={cn(
                    "px-5 py-2.5 rounded-2xl font-bold text-[13px] uppercase tracking-wider border transition-all duration-500 shadow-sm",
                    product.stock > (product.lowStockThreshold || 10) 
                      ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/10" 
                      : product.stock === 0
                        ? "bg-[#FF3B30] text-white apple-error-glow"
                        : "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/10"
                  )}>
                    {product.stock === 0 ? 'Imeisha!' : `${product.stock} ipo`}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-black/[0.03] w-full">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-none mb-2">Bei ya Kuuza</span>
                  <div className="bg-[#007AFF]/5 px-4 py-2 rounded-2xl border border-[#007AFF]/10 w-full">
                    <span className="text-[#007AFF] font-bold text-[17px]">Tsh {product.price.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 bg-[#007AFF] rounded-full flex items-center justify-center text-white shadow-lg">
                  <Plus size={18} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Review Area (Cart Section) */}
      <div className="w-full lg:w-[450px] glass rounded-[40px] border border-white/40 flex flex-col shadow-2xl overflow-hidden m-0 lg:m-2">
        <div className="p-8 border-b border-black/[0.05] flex items-center justify-between bg-white/30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#007AFF]/10 rounded-xl flex items-center justify-center text-[#007AFF]">
              <ShoppingCart size={22} />
            </div>
            <div>
              <h2 className="text-xl font-sans font-black text-black tracking-tight uppercase">Review Order</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Partner AI Review Area</p>
            </div>
          </div>
          <motion.span 
            key={cart.length}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="bg-[#007AFF] text-white px-3.5 py-1 rounded-full text-xs font-bold shadow-lg shadow-[#007AFF]/20"
          >
            {cart.length} bidhaa
          </motion.span>
        </div>

        <div className="p-8 bg-white/40 border-b border-black/[0.05] space-y-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-600">Jumla Ndogo</span>
              <span className="text-black">Tsh {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex justify-between text-sm font-bold text-[#FF3B30]"
              >
                <span className="flex items-center gap-1.5">
                  <Percent size={14} /> Punguzo
                </span>
                <span>- Tsh {discount.toLocaleString()}</span>
              </motion.div>
            )}
            <div className="flex justify-between pt-4 border-t border-black/[0.05]">
              <span className="text-gray-600 font-bold text-sm uppercase tracking-widest">Jumla Kuu</span>
              <span className="text-3xl font-sans font-black text-[#007AFF]">
                Tsh {total.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDiscount}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-black/[0.05] bg-white text-black hover:bg-black/[0.02] transition-all text-[13px] font-bold disabled:opacity-50 active:scale-[0.95]"
            >
              <Percent size={16} className="text-[#007AFF]" /> Punguzo
            </button>
            <button
              onClick={() => {
                setCart([]);
                setDiscount(0);
              }}
              disabled={cart.length === 0}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl border border-[#FF3B30]/10 bg-[#FF3B30]/5 text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all text-[13px] font-bold disabled:opacity-50 active:scale-[0.95]"
            >
              <Trash2 size={16} /> Futa Zote
            </button>
            <button
              onClick={parkCart}
              disabled={cart.length === 0}
              className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-2xl border border-black/[0.05] bg-black/[0.05] text-black hover:bg-black/[0.08] transition-all text-[13px] font-bold disabled:opacity-50 active:scale-[0.95]"
            >
               Hifadhi Gari ({parkedCarts.length})
            </button>
          </div>

          {parkedCarts.length > 0 && (
            <div className="mt-4 p-4 bg-black/[0.03] rounded-2xl border border-black/[0.05]">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Zilizohifadhiwa</p>
              <div className="space-y-2">
                {parkedCarts.map(pc => (
                  <button 
                    key={pc.id}
                    onClick={() => recallCart(pc)}
                    className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-black/[0.05] hover:border-[#007AFF]/30 transition-all text-xs font-bold"
                  >
                    <span>{format(pc.timestamp, 'HH:mm')} - ({pc.items.length} bidhaa)</span>
                    <span className="text-[#007AFF]">Rejesha</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className={cn(
              "w-full py-6 rounded-[28px] font-black text-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-2xl active:scale-[0.96] relative overflow-hidden group",
              cart.length > 0 
                ? "bg-gradient-to-br from-[#007AFF] via-[#0055FF] to-[#0040DD] text-white shadow-[#007AFF]/40" 
                : "bg-gray-100 text-gray-400 shadow-none"
            )}
          >
            {loading ? (
              <div className="w-7 h-7 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <motion.div 
                className="flex items-center gap-3"
                animate={cart.length > 0 ? { scale: [1, 1.03, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <CheckCircle size={26} />
                LIPA (CASH)
              </motion.div>
            )}
            {/* Shimmer effect */}
            {cart.length > 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-5 custom-scrollbar">
          <AnimatePresence initial={false}>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 py-10 text-center">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-24 h-24 bg-black/[0.03] rounded-full flex items-center justify-center mb-6"
                >
                  <ShoppingCart size={48} className="text-gray-300" />
                </motion.div>
                <h3 className="font-bold text-lg text-black mb-2">Kapu ni tupu</h3>
                <p className="text-sm text-gray-500 max-w-[200px]">Chagua bidhaa upande wa kushoto ili kuanza mauzo</p>
                <div className="mt-8 p-4 bg-[#007AFF]/5 rounded-2xl border border-[#007AFF]/10">
                  <p className="text-[11px] font-bold text-[#007AFF] uppercase tracking-widest">Tip</p>
                  <p className="text-[12px] text-gray-600 mt-1">Tumia search bar kutafuta bidhaa haraka zaidi!</p>
                </div>
              </div>
            ) : (
              cart.map((item) => (
                <motion.div
                  key={item.productId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    scale: lastAddedId === item.productId ? [1, 1.05, 1] : 1,
                    backgroundColor: lastAddedId === item.productId ? 'rgba(0, 122, 255, 0.1)' : 'rgba(255, 255, 255, 0.4)'
                  }}
                  transition={{
                    scale: { duration: 0.3 },
                    backgroundColor: { duration: 0.5 }
                  }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "flex items-center gap-4 group p-4 rounded-2xl border border-black/[0.02] transition-all",
                    lastAddedId === item.productId ? "ring-2 ring-[#007AFF]/20" : "bg-white/40 hover:bg-white/60"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-black truncate text-[15px]">{item.name}</h4>
                    <button 
                      onClick={() => {
                        setPendingAction({ 
                          type: 'price_override', 
                          data: { productId: item.productId, name: item.name, originalPrice: item.price } 
                        });
                        setPinModalOpen(true);
                      }}
                      className="text-[16px] text-[#007AFF] font-black hover:underline decoration-dotted"
                    >
                      Tsh {item.price.toLocaleString()}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/[0.05] rounded-xl p-1">
                    <button 
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg transition-all active:scale-[0.8]"
                    >
                      <Minus size={14} className="text-black" />
                    </button>
                    <span className="w-7 text-center font-bold text-[13px] text-black">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg transition-all active:scale-[0.8]"
                    >
                      <Plus size={14} className="text-black" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.productId, item.name)}
                    className="w-9 h-9 flex items-center justify-center text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* PIN Modal */}
      <PinModal
        isOpen={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handlePinSuccess}
        correctPin={activeBusiness?.managerPin || '0000'}
      />

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && lastSale && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
            >
              <div className="p-8 border-b border-black/[0.05] flex justify-between items-center bg-white/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#34C759]/10 rounded-xl flex items-center justify-center text-[#34C759]">
                    <CheckCircle size={24} />
                  </div>
                  <h3 className="text-xl font-sans font-black text-[#1C1C1E]">Malipo Tayari</h3>
                </div>
                <button onClick={() => setShowReceipt(false)} className="p-2.5 bg-black/[0.03] hover:bg-black/[0.06] rounded-full transition-all">
                  <X size={20} className="text-[#8E8E93]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar" id="receipt-content">
                <div className="text-center mb-10">
                  <div className="w-24 h-24 bg-[#007AFF] rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#007AFF]/20 border-4 border-white">
                    <Receipt className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-3xl font-sans font-black text-[#007AFF] tracking-tight uppercase">{activeBusiness?.name}</h2>
                  <div className="h-1 w-12 bg-[#007AFF] mx-auto my-4 rounded-full" />
                  <p className="text-[#8E8E93] text-sm font-bold mt-1 uppercase tracking-widest">{activeBusiness?.address || 'Tanzania'}</p>
                  <p className="text-[#007AFF] text-sm font-bold mt-1">{activeBusiness?.phone}</p>
                </div>

                <div className="bg-[#007AFF]/5 rounded-[24px] p-6 mb-8 border border-[#007AFF]/10">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest mb-1">Cashier</p>
                      <p className="text-sm font-bold text-[#1C1C1E]">{profile?.displayName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest mb-1">ID ya Mauzo</p>
                      <p className="text-sm font-bold text-[#1C1C1E]">
                        {lastSale.saleNumber ? lastSale.saleNumber.toString().padStart(6, '0') : lastSale.id.slice(-8).toUpperCase()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest mb-1">Tarehe</p>
                      <p className="text-sm font-bold text-[#1C1C1E]">{format(new Date(lastSale.timestamp), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest mb-1">Muda</p>
                      <p className="text-sm font-bold text-[#1C1C1E]">{format(new Date(lastSale.timestamp), 'HH:mm')}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 mb-10">
                  <div className="flex justify-between items-center pb-2 border-b-2 border-[#007AFF]/10">
                    <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest">Bidhaa</span>
                    <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest">Bei</span>
                  </div>
                  {lastSale.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-start group">
                      <div className="flex-1 pr-4">
                        <p className="font-bold text-[#1C1C1E] text-[16px] group-hover:text-[#007AFF] transition-colors">{item.name}</p>
                        <p className="text-[13px] text-[#8E8E93] font-bold">{item.quantity} x {item.price.toLocaleString()}</p>
                      </div>
                      <span className="font-bold text-[#1C1C1E] text-lg">{(item.quantity * item.price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 bg-white rounded-[24px] p-6 shadow-sm border border-black/[0.03]">
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-[#8E8E93]">Jumla</span>
                    <span className="text-[#1C1C1E]">Tsh {lastSale.total.toLocaleString()}</span>
                  </div>
                  {lastSale.discount > 0 && (
                    <div className="flex justify-between text-sm font-bold text-[#FF3B30]">
                      <span>Punguzo</span>
                      <span>- Tsh {lastSale.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="h-px bg-black/[0.05] my-2" />
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-[#34C759] font-bold uppercase tracking-widest mb-1">Status</p>
                      <div className="flex items-center gap-1.5 text-[#34C759]">
                        <CheckCircle size={14} />
                        <span className="text-xs font-bold uppercase tracking-wider">Success</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#8E8E93] font-bold uppercase tracking-widest mb-1">Jumla Kuu</p>
                      <p className="text-3xl font-sans font-black text-[#007AFF]">Tsh {lastSale.netTotal.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 text-center">
                  <div className="inline-block px-6 py-2 bg-[#007AFF] text-white rounded-full mb-4 shadow-lg shadow-[#007AFF]/20">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em]">Thank you for coming</p>
                  </div>
                  <p className="text-[#1C1C1E] text-[13px] font-bold">We are appreciate your sale</p>
                  <div className="mt-6 flex justify-center gap-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#007AFF]/20" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-white border-t border-black/[0.05] grid grid-cols-2 gap-4">
                <button
                  onClick={handlePrint58mm}
                  className="bg-[#007AFF] text-white py-4 rounded-[20px] font-bold hover:bg-[#0062CC] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#007AFF]/20 active:scale-[0.97]"
                >
                  <Printer size={20} />
                  Print 58mm
                </button>
                <button
                  onClick={() => {
                    const text = `*${activeBusiness?.name} Receipt*\n\n` +
                      `Cashier: ${profile?.displayName}\n` +
                      `Date: ${format(new Date(lastSale.timestamp), 'dd/MM/yyyy HH:mm')}\n` +
                      `ID: ${lastSale.id.slice(-8).toUpperCase()}\n\n` +
                      `*Items:*\n` +
                      lastSale.items.map((i: any) => `- ${i.name} (${i.quantity}x): Tsh ${(i.quantity * i.price).toLocaleString()}`).join('\n') +
                      `\n\n*Subtotal:* Tsh ${lastSale.total.toLocaleString()}` +
                      (lastSale.discount > 0 ? `\n*Discount:* - Tsh ${lastSale.discount.toLocaleString()}` : '') +
                      `\n*Total:* Tsh ${lastSale.netTotal.toLocaleString()}\n\n` +
                      `Thank you for coming. We are appreciate your sale.\n` +
                      `*SUCCESS*`;
                    
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="bg-[#25D366] text-white py-4 rounded-[20px] font-bold hover:bg-[#128C7E] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 active:scale-[0.97]"
                >
                  <Share2 size={20} />
                  WhatsApp
                </button>
                <button
                  onClick={() => setShowReceipt(false)}
                  className="col-span-2 bg-[#F2F2F7] text-[#1C1C1E] py-4 rounded-[20px] font-bold hover:bg-[#E5E5EA] transition-all active:scale-[0.97]"
                >
                  Funga
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
