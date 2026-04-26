import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  doc, 
  runTransaction, 
  increment 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Product } from '../types';
import { useProducts } from '../context/ProductContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  ShoppingCart, 
  Trash2, 
  Edit2, 
  FileSpreadsheet, 
  Loader2, 
  Wand2, 
  Camera, 
  Keyboard, 
  History,
  TrendingUp,
  AlertCircle,
  XCircle,
  Save,
  CheckCircle2,
  Mic,
  MicOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'react-hot-toast';
import fuzzysort from 'fuzzysort';
import * as XLSX from 'xlsx';
import { triggerScreenFlash } from './ScreenFlash';
import { 
  scanReceiptForPurchases, 
  detectSpreadsheetColumns, 
  ExtractedProduct 
} from '../services/geminiService';
import { processVoiceTranscript } from '../services/partnerAIService';

interface PurchaseItem extends ExtractedProduct {
  confidence?: number;
  productId?: string;
  isNew?: boolean;
  expiryDate?: string;
}

export const Purchase: React.FC = () => {
  const { activeBusiness } = useAuth();
  const { products } = useProducts();
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseItem[]>([]);
  const [quickText, setQuickText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [expiringProducts, setExpiringProducts] = useState<Product[]>([]);
  
  // Partner AI state
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Monitor Expiry on load
  useEffect(() => {
    if (products.length > 0) {
      const soon = products.filter(p => {
        if (!p.expiryDate) return false;
        const days = (new Date(p.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
        return days > 0 && days <= 15; // Expiring in next 15 days
      });
      setExpiringProducts(soon);
    }
  }, [products]);

  // Profit Margin - Suggesting 20% by default if cost is detected
  const suggestPrice = (cost: number) => Math.ceil((cost * 1.2) / 100) * 100;

  // Fuzzy Search & Unit Detection Logic
  useEffect(() => {
    const lines = quickText.split('\n');
    const lastLine = lines[lines.length - 1].trim();

    if (lastLine.length > 1) {
      // Regex: Name followed by Number (Units)
      // Supports: "Kuku 50", "Maziwa 10.5", "Sukari 5"
      const match = lastLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      
      const searchName = match ? match[1] : lastLine;
      
      const results = fuzzysort.go(searchName, products, { 
        key: 'name',
        limit: 5,
        threshold: -1500 // More lenient to catch very bad typos
      });

      const bestMatch = results[0];
      
      // Auto-selection if confidence is high (score > -200)
      if (bestMatch && bestMatch.score > -200 && match) {
        // Auto-select and move to history
        const product = bestMatch.obj as Product;
        const units = Number(match[2]);
        addItemToHistory(product, units);
        
        // Remove the line and keep focusing
        const newLines = [...lines];
        newLines.pop();
        setQuickText(newLines.join('\n') + (newLines.length > 0 ? '\n' : ''));
        setSuggestions([]);
        return;
      }

      setSuggestions(results.map(r => r.obj as Product));
    } else {
      setSuggestions([]);
    }
  }, [quickText, products]);

  const addItemToHistory = (product: Product, units: number) => {
    const newItem: PurchaseItem = {
      name: product.name,
      category: product.category,
      price: product.price,
      costPrice: product.costPrice,
      stock: units,
      productId: product.id,
      isNew: false
    };
    setPurchaseHistory(prev => [newItem, ...prev]);
    toast.success(`Imeongezwa: ${product.name} (${units})`);
    triggerScreenFlash('success');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const lines = quickText.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      
      const match = lastLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      if (match) {
        const name = match[1];
        const units = Number(match[2]);
        
        // Priority 1: Use top suggestion (handles typos)
        if (suggestions.length > 0) {
          addItemToHistory(suggestions[0], units);
        } else {
          // Priority 2: If no matches at all, don't just accept random spelling.
          // In a high-speed environment, random text is usually a mistake.
          toast.error(`"${name}" haipo stoo! Angalia spelling au ongeza kama bidhaa mpya kwa kubonyeza kitufe cha (+) Inventory.`);
          triggerScreenFlash('error');
          return;
        }
        
        const newLines = [...lines];
        newLines.pop();
        setQuickText(newLines.join('\n') + (newLines.length > 0 ? '\n' : ''));
      }
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        if (jsonData.length === 0) {
          toast.error('Sheet haina data!');
          return;
        }

        // Intelligent Column Detection
        const columnMap = await detectSpreadsheetColumns(jsonData.slice(0, 5));
        
        const newItems: PurchaseItem[] = jsonData.map((row: any) => {
          const name = String(row[columnMap.name] || '').trim();
          const units = Number(row[columnMap.stock] || 0);
          const cost = Number(row[columnMap.costPrice] || 0);
          const expiry = columnMap.expiryDate ? String(row[columnMap.expiryDate] || '') : undefined;
          
          if (!name) return null;

          const results = fuzzysort.go(name, products, { key: 'name', limit: 1 });
          const best = results[0];

          const itemBase = {
            name,
            costPrice: cost,
            stock: units,
            expiryDate: expiry
          };

          if (best && best.score > -500) {
            const p = best.obj as Product;
            return {
              ...itemBase,
              name: p.name,
              category: p.category,
              price: p.price,
              costPrice: cost || p.costPrice,
              productId: p.id,
              isNew: false
            };
          }

          return {
            ...itemBase,
            category: 'General',
            price: suggestPrice(cost),
            isNew: true
          };
        }).filter(Boolean) as PurchaseItem[];

        setPurchaseHistory(prev => [...newItems, ...prev]);
        toast.success(`Bidhaa ${newItems.length} zimeingizwa kutoka Excel!`);
      } catch (err) {
        toast.error('Excel format haijaeleweka');
      } finally {
        setIsAiProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleEditItem = (idx: number) => {
    const item = purchaseHistory[idx];
    setQuickText(`${item.name} ${item.stock}`);
    setPurchaseHistory(prev => prev.filter((_, i) => i !== idx));
    textareaRef.current?.focus();
    toast.success('Imebeba kwenye Smart Input');
  };

  const startVoiceAssistant = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Browser yako haisupport voice input.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'sw-TZ,en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      handleVoiceTranscript(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast.error('Ruhusu ufikiaji wa microphone kwenye browser yako.');
      } else if (event.error === 'network') {
        toast.error('Hitilafu ya intaneti. Angalia connection yako.');
      } else if (event.error === 'no-speech') {
        toast('Hakuna sauti iliyosikika.', { icon: '😶' });
      } else {
        toast.error('Voice input imeshindwa.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleVoiceTranscript = async (transcript: string) => {
    setIsProcessingAI(true);
    try {
      const result = await processVoiceTranscript(transcript);
      if (!result) {
        toast.error('Partner AI imeshindwa kuelewa...');
        return;
      }

      if (result.action === 'ADD_ITEM') {
        let addedCount = 0;
        result.data.forEach(entry => {
          const searchResults = fuzzysort.go(entry.raw_input, products, { key: 'name', limit: 1 });
          if (searchResults.length > 0) {
            const product = searchResults[0].obj;
            if (entry.confidence_score > 0.7 || entry.raw_input.toLowerCase() === product.name.toLowerCase()) {
              addItemToHistory(product, entry.qty);
              addedCount++;
            } else {
              setQuickText(prev => prev + (prev ? '\n' : '') + `${entry.raw_input} ${entry.qty}`);
              toast(`Je, ulimaanisha ${product.name}?`, { icon: '🤔' });
            }
          } else {
            // Add as new product if not found
            const newItem: PurchaseItem = {
              name: entry.raw_input,
              category: 'General',
              stock: entry.qty,
              price: 1000, // Placeholder
              costPrice: 0,
              isNew: true
            };
            setPurchaseHistory(prev => [newItem, ...prev]);
            addedCount++;
            toast.success(`Hii ni bidhaa mpya: ${entry.raw_input}`);
          }
        });
        
        if (addedCount > 0) {
          toast.success(`Imeingizwa ${addedCount} bidhaa kwa sauti`);
        }
      } else if (result.action === 'PROCESS_PAYMENT') {
        if (purchaseHistory.length > 0) {
          saveAllItems();
        } else {
          toast.error('Orodha ni tupu!');
        }
      }
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const results = await scanReceiptForPurchases(base64);
        
        const processed = results.map(item => {
          const fs = fuzzysort.go(item.name, products, { key: 'name', limit: 1 });
          if (fs[0] && fs[0].score > -300) {
            const p = fs[0].obj as Product;
            return { ...item, name: p.name, productId: p.id, isNew: false };
          }
          return { ...item, isNew: true };
        });

        setPurchaseHistory(prev => [...processed, ...prev]);
        toast.success(`AI imegundua bidhaa ${results.length}!`);
        setIsAiProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('AI imeshindwa kusoma picha');
      setIsAiProcessing(false);
    }
  };

  const saveAllItems = async () => {
    if (!activeBusiness?.id || purchaseHistory.length === 0) return;
    
    setIsSaving(true);
    const loadingToast = toast.loading('Inahifadhi mzigo stoo...');

    try {
      await runTransaction(db, async (transaction) => {
        // Create Purchase Log
        const logRef = doc(collection(db, 'purchases'));
        transaction.set(logRef, {
          businessId: activeBusiness.id,
          items: purchaseHistory,
          timestamp: new Date().toISOString(),
          total: purchaseHistory.reduce((sum, item) => sum + (item.costPrice * item.stock), 0)
        });

        for (const item of purchaseHistory) {
          const updateData: any = {
            stock: increment(item.stock),
            costPrice: item.costPrice,
            price: item.price,
            updatedAt: new Date().toISOString()
          };
          
          if (item.expiryDate) {
            updateData.expiryDate = item.expiryDate;
          }

          if (item.productId) {
            // Update Existing
            const pRef = doc(db, 'products', item.productId);
            transaction.update(pRef, updateData);
          } else {
            // Create New
            const pColl = collection(db, 'products');
            const newPRef = doc(pColl);
            transaction.set(newPRef, {
              name: item.name,
              category: item.category,
              price: item.price,
              costPrice: item.costPrice,
              stock: item.stock,
              expiryDate: item.expiryDate || null,
              businessId: activeBusiness.id,
              updatedAt: new Date().toISOString()
            });
          }
        }
      });

      setPurchaseHistory([]);
      toast.success('Mzigo umehifadhiwa kikamilifu!', { id: loadingToast });
      triggerScreenFlash('success');
    } catch (err) {
      toast.error('Imeshindikana kuhifadhi', { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn(
      "space-y-10 font-sans pb-10 transition-colors duration-500 rounded-[48px] -m-10 p-10 min-h-screen",
      isDarkMode ? "bg-[#1C1C1E] text-white" : "bg-transparent text-black"
    )}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 className={cn("text-4xl font-black tracking-tight", isDarkMode ? "text-white" : "text-black")}>Manunuzi (Purchase)</h2>
          <p className={isDarkMode ? "text-gray-400" : "text-gray-600"}>Ingiza mzigo mpya kwa kutumia AI, Excel, au Voice</p>
        </motion.div>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "apple-button-secondary flex items-center gap-2.5",
              isDarkMode && "bg-white/10 text-white border-white/10"
            )}
          >
            {isDarkMode ? "Light Mode" : "Premium Dark Mode"}
          </button>

          <label className={cn(
            "apple-button-secondary flex items-center gap-2.5 cursor-pointer",
            isDarkMode && "bg-white/10 text-white border-white/10"
          )}>
            <FileSpreadsheet size={18} />
            Smart Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
          </label>
          
          <label className={cn(
            "apple-button-secondary flex items-center gap-2.5 cursor-pointer",
            isDarkMode && "bg-white/10 text-white border-white/10"
          )}>
            <Camera size={18} />
            Scan Receipt
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageCapture} />
          </label>

          <button 
            disabled={purchaseHistory.length === 0 || isSaving}
            onClick={saveAllItems}
            className="apple-button-primary bg-[#007AFF] text-white flex items-center gap-2.5 disabled:opacity-30"
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            Hifadhi Mzigo
          </button>
        </div>
      </div>

      {/* Main UI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[calc(100vh-280px)] min-h-[600px]">
        
        {/* Input Area */}
        <div className="lg:col-span-5 flex flex-col space-y-6 h-full">
          <div className={cn(
            "apple-card flex-1 p-8 flex flex-col relative overflow-hidden transition-colors",
            isDarkMode ? "bg-white/5 border-white/10 shadow-none" : "bg-white"
          )}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#007AFF]/10 text-[#007AFF] rounded-xl flex items-center justify-center">
                  <Keyboard size={20} />
                </div>
                <h3 className={cn("text-xl font-black tracking-tight uppercase tracking-[0.1em] text-[12px] font-bold", isDarkMode ? "text-white" : "text-black")}>Smart Input</h3>
              </div>
              <div className={cn(
                "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                isDarkMode ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-400"
              )}>
                Enter to Add
              </div>
            </div>

            <div className="flex-1 flex flex-col relative">
              <textarea
                ref={textareaRef}
                autoFocus
                className={cn(
                  "w-full flex-1 bg-transparent text-xl font-bold placeholder-gray-300 outline-none resize-none leading-relaxed pb-12",
                  isDarkMode ? "text-white" : "text-black",
                  isProcessingAI && "opacity-50 pointer-events-none"
                )}
                placeholder="Mfano: Sukari 50&#10;Kuku 12"
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              
              <div className="absolute right-0 bottom-0 flex items-center gap-3">
                <button
                  onClick={startVoiceAssistant}
                  disabled={isProcessingAI}
                  className={cn(
                    "p-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 font-bold",
                    isListening 
                      ? "bg-[#FF3B30] text-white animate-pulse" 
                      : isDarkMode ? "bg-white/10 text-white" : "bg-[#007AFF] text-white",
                    isProcessingAI && "opacity-50"
                  )}
                >
                  {isProcessingAI ? <Loader2 className="animate-spin" size={20} /> : (isListening ? <MicOff size={20} /> : <Mic size={20} />)}
                  <span className="hidden sm:inline">{isListening ? "Listening..." : "Partner AI"}</span>
                </button>
              </div>

              {/* Status Overlay */}
              {isProcessingAI && (
                <div className="absolute inset-0 bg-black/5 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-50">
                  <div className="bg-white p-4 rounded-2xl shadow-2xl flex items-center gap-3">
                    <Loader2 className="animate-spin text-[#007AFF]" />
                    <span className="font-bold text-gray-600">Partner AI Processing...</span>
                  </div>
                </div>
              )}
              
              {/* Intelligent Suggestions */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={cn(
                      "absolute left-0 right-0 bottom-0 shadow-2xl rounded-[28px] border p-2 flex flex-col z-10",
                      isDarkMode ? "bg-[#2C2C2E] border-white/10" : "bg-white border-black/[0.05]"
                    )}
                  >
                    {suggestions.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          const lines = quickText.split('\n');
                          const last = lines.pop()?.trim() || '';
                          const match = last.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
                          const units = match ? Number(match[2]) : 0;
                          addItemToHistory(p, units);
                          setQuickText(lines.join('\n') + (lines.length > 0 ? '\n' : ''));
                          textareaRef.current?.focus();
                        }}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl transition-all group",
                          isDarkMode ? "hover:bg-white/5" : "hover:bg-[#007AFF]/5"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            isDarkMode ? "bg-white/10 text-gray-400" : "bg-gray-100 text-gray-500"
                          )}>
                            <Plus size={18} />
                          </div>
                          <div className="text-left">
                            <p className={cn("font-bold text-[15px]", isDarkMode ? "text-white" : "text-black")}>{p.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">{p.category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-[#007AFF]">Tsh {p.price.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Stoo: {p.stock}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* AI Processing Overlay */}
            <AnimatePresence>
              {isAiProcessing && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "absolute inset-0 backdrop-blur-md flex flex-col items-center justify-center z-20",
                    isDarkMode ? "bg-[#1C1C1E]/80" : "bg-white/80"
                  )}
                >
                  <Wand2 className="w-16 h-16 text-[#007AFF] animate-pulse mb-4" />
                  <p className={cn("text-xl font-black", isDarkMode ? "text-white" : "text-black")}>Partner AI Inafikiria...</p>
                  <p className="text-sm text-gray-500 mt-2">Inatambua bidhaa na makundi</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* History / Review Area */}
        <div className="lg:col-span-7 flex flex-col space-y-6 h-full border-l border-black/[0.05] pl-10">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              isDarkMode ? "bg-white/5 text-white/40" : "bg-black/5 text-black/60"
            )}>
              <History size={20} />
            </div>
            <h3 className={cn("text-xl font-black tracking-tight uppercase tracking-[0.1em] text-[12px] font-bold", isDarkMode ? "text-white" : "text-black")}>Review Goods ({purchaseHistory.length})</h3>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-4">
            {purchaseHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 opacity-50">
                <ShoppingCart size={64} strokeWidth={1} />
                <p className="text-lg font-bold">Orodha yako iko tupu</p>
                <p className="text-sm">Tumia Smart Input au Scan kuanza</p>
              </div>
            ) : (
              purchaseHistory.map((item, idx) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={idx}
                  className={cn(
                    "apple-card p-6 flex items-center justify-between group hover:shadow-xl transition-all border",
                    isDarkMode ? "bg-white/5 border-white/10 shadow-none" : "bg-white border-black/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm",
                      item.isNew ? "bg-[#34C759]/10 text-[#34C759]" : "bg-[#007AFF]/10 text-[#007AFF]"
                    )}>
                      {item.isNew ? <Plus size={24} /> : <CheckCircle2 size={24} />}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-lg font-black", isDarkMode ? "text-white" : "text-black")}>{item.name}</span>
                        {item.isNew && (
                          <span className="text-[10px] font-black uppercase tracking-widest bg-[#34C759] text-white px-2 py-0.5 rounded-full">New</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-500 font-bold bg-[#F2F2F7] px-2 py-0.5 rounded-md uppercase tracking-widest">{item.category}</span>
                        <div className="flex items-center gap-1.5 text-xs text-[#007AFF] font-bold">
                          <TrendingUp size={12} /> Sug: Tsh {suggestPrice(item.costPrice).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Units</p>
                      <input 
                        type="number"
                        className={cn(
                          "bg-transparent font-black text-2xl w-24 text-right outline-none focus:text-[#007AFF] transition-colors",
                          isDarkMode ? "text-white" : "text-black"
                        )}
                        value={item.stock}
                        onChange={(e) => {
                          const newHistory = [...purchaseHistory];
                          newHistory[idx].stock = Number(e.target.value);
                          setPurchaseHistory(newHistory);
                        }}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Gharama</p>
                      <input 
                        type="number"
                        className={cn(
                          "bg-transparent font-black text-xl w-32 text-right outline-none focus:text-[#007AFF] transition-colors",
                          isDarkMode ? "text-white" : "text-black"
                        )}
                        value={item.costPrice}
                        onChange={(e) => {
                          const newHistory = [...purchaseHistory];
                          newHistory[idx].costPrice = Number(e.target.value);
                          newHistory[idx].price = suggestPrice(Number(e.target.value));
                          setPurchaseHistory(newHistory);
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleEditItem(idx)}
                        className="p-3 text-gray-300 hover:text-[#007AFF] hover:bg-[#007AFF]/10 rounded-2xl transition-all"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button 
                        onClick={() => setPurchaseHistory(prev => prev.filter((_, i) => i !== idx))}
                        className="p-3 text-gray-300 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-2xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bonus Features: Voice & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-10 border-t border-black/[0.05]">
        <div className={cn(
          "apple-card p-6 flex items-center gap-6 group hover:translate-y-[-4px] transition-all",
          isDarkMode ? "bg-white/5 border-white/10" : "bg-black text-white"
        )}>
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-[#FFD60A] group-hover:scale-110 transition-transform">
            <AlertCircle size={28} />
          </div>
          <div>
            <h4 className="text-lg font-black uppercase tracking-widest text-[12px] text-[#FFD60A]">Expiry Alerts</h4>
            {expiringProducts.length > 0 ? (
              <p className={isDarkMode ? "text-white/60 text-sm mt-1" : "text-white/60 text-sm mt-1"}>
                Bidhaa {expiringProducts.length} zinakaribia kuisha muda. Zikague sasa!
              </p>
            ) : (
              <p className={isDarkMode ? "text-white/60 text-sm mt-1" : "text-white/60 text-sm mt-1"}>
                Stoo iko salama. Hakuna bidhaa inayokaribia kuharibika.
              </p>
            )}
          </div>
        </div>
        
        <div className="apple-card p-6 bg-[#007AFF] text-white flex items-center justify-between group hover:translate-y-[-4px] transition-all overflow-hidden relative">
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-2xl animate-pulse">🎤</span>
            </div>
            <div>
              <h4 className="text-lg font-black uppercase tracking-widest text-[12px] text-white/80">Voice to Purchase</h4>
              <p className="text-white text-sm font-bold mt-1">"Ingiza Kuku 20 wa laki tano..."</p>
            </div>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full relative z-10">V2 Coming Soon</div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12 blur-2xl" />
        </div>
      </div>
    </div>
  );
};
