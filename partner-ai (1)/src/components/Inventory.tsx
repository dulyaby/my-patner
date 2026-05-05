import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Product, StockAdjustment } from '../types';
import { Plus, Edit2, Trash2, Package, Search, Database, Upload, AlertTriangle, FileDown, Settings2, Camera, Loader2, Wand2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { triggerScreenFlash } from './ScreenFlash';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { scanProductsFromImage, ExtractedProduct } from '../services/geminiService';

export const Inventory: React.FC = () => {
  const { profile, activeBusiness } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [importing, setImporting] = useState(false);

  // Stock Adjustment State
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockValue, setNewStockValue] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState<'correction' | 'damage' | 'found' | 'expired' | 'other'>('correction');
  const [adjustmentNote, setAdjustmentNote] = useState('');

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct || !activeBusiness?.id || !profile?.uid) return;

    const newStock = Number(newStockValue);
    const difference = newStock - adjustingProduct.stock;

    try {
      const adjustmentData: Omit<StockAdjustment, 'id'> = {
        productId: adjustingProduct.id,
        productName: adjustingProduct.name,
        previousStock: adjustingProduct.stock,
        newStock: newStock,
        difference: difference,
        reason: adjustmentReason,
        note: adjustmentNote,
        userId: profile.uid,
        businessId: activeBusiness.id,
        timestamp: new Date().toISOString()
      };

      await addDoc(collection(db, 'stockAdjustments'), adjustmentData);
      await updateDoc(doc(db, 'products', adjustingProduct.id), {
        stock: newStock,
        updatedAt: new Date().toISOString()
      });

      triggerScreenFlash('success');
      toast.success('Stock imerekebishwa!');
      setIsAdjustingStock(false);
      setAdjustingProduct(null);
      setNewStockValue('');
      setAdjustmentNote('');
    } catch (error) {
      triggerScreenFlash();
      toast.error('Imeshindikana kurekebisha stock');
    }
  };

  const openAdjustmentModal = (product: Product) => {
    setAdjustingProduct(product);
    setNewStockValue(product.stock.toString());
    setIsAdjustingStock(true);
  };

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // AI Feature State
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ExtractedProduct[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setIsAiModalOpen(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const results = await scanProductsFromImage(base64);
          setScannedItems(results);
          if (results.length === 0) {
            toast.error("AI haijapata bidhaa yoyote kwenye picha.");
          } else {
            toast.success(`AI imegundua bidhaa ${results.length}!`);
          }
        } catch (err) {
          toast.error("Hitilafu ya AI. Jaribu tena.");
          setIsAiModalOpen(false);
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsScanning(false);
      setIsAiModalOpen(false);
    }
  };

  const saveScannedItems = async () => {
    if (!activeBusiness?.id || scannedItems.length === 0) return;
    
    setIsSaving(true);
    const loadingToast = toast.loading('Inahifadhi bidhaa za AI...');
    
    try {
      const promises = scannedItems.map(item => 
        addDoc(collection(db, 'products'), {
          ...item,
          businessId: activeBusiness.id,
          updatedAt: new Date().toISOString()
        })
      );
      
      await Promise.all(promises);
      triggerScreenFlash('success');
      toast.success(`${scannedItems.length} zimeongezwa stoo kwa mafanikio!`, { id: loadingToast });
      setIsAiModalOpen(false);
      setScannedItems([]);
    } catch (err) {
      toast.error('Imeshindikana kuhifadhi bidhaa', { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!activeBusiness?.id) return;

    const q = query(
      collection(db, 'products'),
      where('businessId', '==', activeBusiness.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach((doc) => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
    });

    return () => unsubscribe();
  }, [activeBusiness?.id]);

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeBusiness?.id) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        console.log("Imported JSON Data:", jsonData);

        if (jsonData.length === 0) {
          triggerScreenFlash('warning');
          toast.error('Faili haina data yoyote au karatasi (sheet) ya kwanza ni tupu!');
          setImporting(false);
          return;
        }

        const promises = jsonData.map((row: any, index: number) => {
          // Normalize keys: lowercase and trim to find matches easily
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim()] = row[key];
          });

          // Expanded aliases for better matching
          const name = normalizedRow.name || normalizedRow.jina || normalizedRow['jina la bidhaa'] || 
                       normalizedRow['product name'] || normalizedRow.bidhaa || normalizedRow.item || 
                       normalizedRow.description || normalizedRow.maelezo;

          const price = normalizedRow.price || normalizedRow.bei || normalizedRow['bei ya kuuza'] || 
                        normalizedRow['selling price'] || normalizedRow.retail || normalizedRow['unit price'];

          const costPrice = normalizedRow.costprice || normalizedRow.gharama || normalizedRow['bei ya kununua'] || 
                            normalizedRow['cost price'] || normalizedRow.cost || normalizedRow.buying || 
                            normalizedRow['unit cost'];

          const stock = normalizedRow.stock || normalizedRow.idadi || normalizedRow['kiasi'] || 
                        normalizedRow['quantity'] || normalizedRow.stock_level || normalizedRow.qty || 
                        normalizedRow.amount;

          const category = normalizedRow.category || normalizedRow.kundi || normalizedRow['aina'] || 
                           normalizedRow.type || normalizedRow.group || normalizedRow.idara;

          if (!name || String(name).trim() === "") {
            console.warn(`Row ${index + 1} skipped: Missing name`, row);
            return null;
          }

          return addDoc(collection(db, 'products'), {
            name: String(name).trim(),
            price: Number(price) || 0,
            costPrice: Number(costPrice) || 0,
            stock: Number(stock) || 0,
            category: String(category || 'General').trim(),
            businessId: activeBusiness.id,
            updatedAt: new Date().toISOString()
          });
        }).filter(p => p !== null);

        if (promises.length === 0) {
          triggerScreenFlash();
          toast.error('Hakuna bidhaa halali zilizopatikana. Hakikisha safu ya "Jina" au "Bidhaa" ipo.');
          setImporting(false);
          return;
        }

        await Promise.all(promises);
        triggerScreenFlash('success');
        toast.success(`Bidhaa ${promises.length} zimeingizwa!`);
      } catch (error) {
        console.error("Import error:", error);
        triggerScreenFlash();
        toast.error('Imeshindikana kuingiza bidhaa. Hakikisha faili ipo sahihi.');
      } finally {
        setImporting(false);
        // Reset input
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLoadDemoData = async () => {
    if (!activeBusiness?.id) return;
    if (!window.confirm('Je, unataka kuongeza bidhaa 50 za demo (Vinywaji, Vyakula, Nyama, Usafi) kwa ajili ya majaribio?')) return;
    
    setLoadingDemo(true);
    const loadingToast = toast.loading('Inatengeneza bidhaa 50 za demo...');

    const demoProducts = [
      { name: "Coca Cola 500ml", price: 1000, costPrice: 850, stock: 48, category: "Vinywaji" },
      { name: "Pepsi 500ml", price: 1000, costPrice: 850, stock: 36, category: "Vinywaji" },
      { name: "Fanta Orange 500ml", price: 1000, costPrice: 850, stock: 24, category: "Vinywaji" },
      { name: "Sprite 500ml", price: 1000, costPrice: 850, stock: 12, category: "Vinywaji" },
      { name: "Kilimanjaro Water 500ml", price: 600, costPrice: 400, stock: 120, category: "Vinywaji" },
      { name: "Afya Water 500ml", price: 600, costPrice: 400, stock: 100, category: "Vinywaji" },
      { name: "Azam Mango Juice 1L", price: 2500, costPrice: 2100, stock: 15, category: "Vinywaji" },
      { name: "Azam Embe Juice 250ml", price: 600, costPrice: 450, stock: 48, category: "Vinywaji" },
      { name: "Red Bull 250ml", price: 3500, costPrice: 2800, stock: 24, category: "Vinywaji" },
      { name: "Sayona Twist 500ml", price: 700, costPrice: 500, stock: 30, category: "Vinywaji" },
      { name: "Mchele Kyela (Grade 1) - 1kg", price: 3500, costPrice: 2800, stock: 50, category: "Vyakula" },
      { name: "Sukari ya Kilombero - 1kg", price: 3000, costPrice: 2600, stock: 100, category: "Vyakula" },
      { name: "Chumvi ya Mawe - 1kg", price: 800, costPrice: 500, stock: 40, category: "Vyakula" },
      { name: "Unga wa Ngano (Azam) - 1kg", price: 2200, costPrice: 1800, stock: 60, category: "Vyakula" },
      { name: "Unga wa Dona - 1kg", price: 1500, costPrice: 1200, stock: 80, category: "Vyakula" },
      { name: "Mafuta ya Alizeti (Safise) - 1L", price: 5500, costPrice: 4800, stock: 20, category: "Vyakula" },
      { name: "Mafuta ya Korie - 1L", price: 5000, costPrice: 4400, stock: 25, category: "Vyakula" },
      { name: "Tambi (Pasta) - 500g", price: 1800, costPrice: 1400, stock: 30, category: "Vyakula" },
      { name: "Maharage ya Mbeya - 1kg", price: 2800, costPrice: 2200, stock: 40, category: "Vyakula" },
      { name: "Choroko - 1kg", price: 3000, costPrice: 2400, stock: 15, category: "Vyakula" },
      { name: "Njere - 1kg", price: 3200, costPrice: 2600, stock: 12, category: "Vyakula" },
      { name: "Blueband 250g", price: 2500, costPrice: 2000, stock: 24, category: "Vyakula" },
      { name: "Majani ya Chai (Chai Bora) - 50g", price: 1200, costPrice: 900, stock: 50, category: "Vyakula" },
      { name: "Kahawa (Africafe) - 100g", price: 4500, costPrice: 3800, stock: 10, category: "Vyakula" },
      { name: "Maziwa ya Unga (Nido) - 400g", price: 12000, costPrice: 10500, stock: 5, category: "Vyakula" },
      { name: "Kuku wa Kienyeji (Mzima)", price: 18000, costPrice: 14000, stock: 10, category: "Nyama" },
      { name: "Kuku wa Kisasa (Mzima)", price: 12000, costPrice: 9500, stock: 20, category: "Nyama" },
      { name: "Nyama ya Ng'ombe (Mguu) - 1kg", price: 10000, costPrice: 8500, stock: 30, category: "Nyama" },
      { name: "Nyama ya Ng'ombe (Rungu) - 1kg", price: 9000, costPrice: 7500, stock: 25, category: "Nyama" },
      { name: "Nyama ya Mbuzi - 1kg", price: 12000, costPrice: 10000, stock: 15, category: "Nyama" },
      { name: "Maini - 1kg", price: 12000, costPrice: 9500, stock: 10, category: "Nyama" },
      { name: "Mapafu - 1kg", price: 6000, costPrice: 4500, stock: 8, category: "Nyama" },
      { name: "Kichwa cha Ng'ombe", price: 15000, costPrice: 12000, stock: 4, category: "Nyama" },
      { name: "Miguu ya Ng'ombe (Seti)", price: 8000, costPrice: 6000, stock: 6, category: "Nyama" },
      { name: "Nyama ya Kondoo - 1kg", price: 13000, costPrice: 11000, stock: 5, category: "Nyama" },
      { name: "Omo detergent - 500g", price: 3500, costPrice: 2900, stock: 20, category: "Usafi" },
      { name: "Sabuni ya Kipande (Jamaa)", price: 1500, costPrice: 1200, stock: 100, category: "Usafi" },
      { name: "Sabuni ya Maji - 500ml", price: 2000, costPrice: 1500, stock: 30, category: "Usafi" },
      { name: "Whitedent Toothpaste - 150g", price: 2500, costPrice: 2000, stock: 24, category: "Usafi" },
      { name: "Dettol Bar Soap - 100g", price: 1800, costPrice: 1400, stock: 48, category: "Usafi" },
      { name: "Jik Bleach - 500ml", price: 2800, costPrice: 2200, stock: 15, category: "Usafi" },
      { name: "Steal Wire (Dodoma)", price: 500, costPrice: 300, stock: 50, category: "Usafi" },
      { name: "Toilet Paper (Flora)", price: 800, costPrice: 500, stock: 144, category: "Usafi" },
      { name: "Pedi (Always)", price: 2500, costPrice: 2000, stock: 30, category: "Usafi" },
      { name: "Kiwis Shoe Polish", price: 2000, costPrice: 1600, stock: 12, category: "Usafi" },
      { name: "Betri (Panasonic) - AA", price: 1000, costPrice: 700, stock: 48, category: "Vinginevyo" },
      { name: "Betri (Panasonic) - AAA", price: 1000, costPrice: 700, stock: 48, category: "Vinginevyo" },
      { name: "Misitu (Matches)", price: 100, costPrice: 50, stock: 200, category: "Vinginevyo" },
      { name: "Mafuta ya Taa - 1L", price: 3000, costPrice: 2600, stock: 20, category: "Vinginevyo" },
      { name: "Mkaa - Gunia ndogo", price: 15000, costPrice: 12000, stock: 10, category: "Vinginevyo" }
    ];

    try {
      const promises = demoProducts.map(p => 
        addDoc(collection(db, 'products'), {
          ...p,
          businessId: activeBusiness.id,
          updatedAt: new Date().toISOString()
        })
      );
      await Promise.all(promises);
      triggerScreenFlash('success');
      toast.success('Bidhaa 50 za demo zimeingizwa stoo!', { id: loadingToast });
    } catch (err) {
      toast.error('Imeshindikana kutengeneza demo data', { id: loadingToast });
    } finally {
      setLoadingDemo(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Jina la Bidhaa": "Mfano wa Bidhaa",
        "Bei ya Kuuza": 1000,
        "Bei ya Kununua": 800,
        "Idadi (Stock)": 50,
        "Kundi (Category)": "Vinywaji"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Biashara_Smart_Template.xlsx");
    triggerScreenFlash('success');
    toast.success('Template imepakuliwa!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBusiness?.id || isSaving) return;

    setIsSaving(true);
    const productData = {
      name,
      price: Number(price),
      costPrice: Number(costPrice),
      stock: Number(stock),
      category,
      expiryDate: expiryDate || null,
      lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 10,
      businessId: activeBusiness.id,
      updatedAt: new Date().toISOString()
    };

    try {
      const docPromise = editingProduct
        ? updateDoc(doc(db, 'products', editingProduct.id), productData)
        : addDoc(collection(db, 'products'), productData);

      // Close modal immediately for "fast" feel
      closeModal();
      
      docPromise.then(() => {
        triggerScreenFlash('success');
        toast.success(editingProduct ? 'Bidhaa imerekebishwa!' : 'Bidhaa mpya imeongezwa!');
      }).catch((error) => {
        console.error("Save error:", error);
        toast.error('Imeshindikana kuhifadhi bidhaa');
      }).finally(() => {
        setIsSaving(false);
      });

    } catch (error) {
      console.error("Submit error:", error);
      toast.error('Imeshindikana kuhifadhi bidhaa');
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setProductToDelete(id);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    
    const id = productToDelete;
    setProductToDelete(null); // Close confirmation immediately
    
    try {
      await deleteDoc(doc(db, 'products', id));
      triggerScreenFlash('success');
      toast.success('Bidhaa imefutwa!');
    } catch (error) {
      console.error("Delete error:", error);
      toast.error('Imeshindikana kufuta bidhaa');
    }
  };

  const handleDeleteAll = async () => {
    if (!activeBusiness?.id || products.length === 0) return;
    
    setIsDeletingAll(false);
    const loadingToast = toast.loading('Inafuta bidhaa zote...');
    
    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      products.forEach(p => {
        batch.delete(doc(db, 'products', p.id));
      });
      
      await batch.commit();
      triggerScreenFlash('success');
      toast.success('Bidhaa zote zimefutwa!', { id: loadingToast });
    } catch (error) {
      console.error("Delete all error:", error);
      toast.error('Imeshindikana kufuta bidhaa zote', { id: loadingToast });
    }
  };

  const openModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setPrice(product.price.toString());
      setCostPrice(product.costPrice.toString());
      setStock(product.stock.toString());
      setCategory(product.category);
      setExpiryDate(product.expiryDate || '');
      setLowStockThreshold(product.lowStockThreshold?.toString() || '10');
    } else {
      setEditingProduct(null);
      setName('');
      setPrice('');
      setCostPrice('');
      setStock('');
      setCategory('');
      setExpiryDate('');
      setLowStockThreshold('10');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-10 font-sans pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-4xl font-sans font-black text-black tracking-tight">Stoo ya Bidhaa</h2>
          <p className="text-gray-600 font-medium mt-1">Simamia bidhaa na kiasi kilichopo stoo</p>
        </motion.div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={downloadTemplate}
            className="apple-button-secondary flex items-center gap-2.5"
          >
            <FileDown size={18} />
            Template
          </button>
          <label className="apple-button-secondary flex items-center gap-2.5 cursor-pointer">
            <Upload size={18} />
            {importing ? 'Inapakia...' : 'Pakia Excel'}
            <input 
              type="file" 
              accept=".csv, .xlsx, .xls, .ods" 
              className="hidden" 
              onChange={handleBulkImport} 
              disabled={importing} 
            />
          </label>
          <button
            onClick={handleLoadDemoData}
            disabled={loadingDemo}
            className="apple-button-secondary flex items-center gap-2.5 disabled:opacity-50"
          >
            <Database size={18} />
            Demo Data
          </button>
          <button
            onClick={() => setIsDeletingAll(true)}
            disabled={products.length === 0}
            className="px-6 py-3.5 rounded-2xl font-bold text-[#FF3B30] bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 transition-all flex items-center gap-2.5 disabled:opacity-30"
          >
            <Trash2 size={18} />
            Futa Zote
          </button>
          <button
            onClick={() => openModal()}
            className="apple-button-primary flex items-center gap-2.5"
          >
            <Plus size={20} />
            Ingiza Bidhaa
          </button>
          <label className="apple-button-primary bg-black text-white hover:bg-black/90 flex items-center gap-2.5 cursor-pointer shadow-lg shadow-black/20">
            <Camera size={20} />
            AI Scanner
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              onChange={handleImageCapture}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Jumla ya Bidhaa', value: products.length, icon: Package, color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
          { label: 'Bidhaa Zilizo Chini', value: products.filter(p => p.stock <= (p.lowStockThreshold || 10)).length, icon: AlertTriangle, color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10' },
          { label: 'Thamani ya Stoo', value: `Tsh ${products.reduce((sum, p) => sum + (p.costPrice * p.stock), 0).toLocaleString()}`, icon: Database, color: 'text-[#5856D6]', bg: 'bg-[#5856D6]/10' },
          { label: 'Thamani ya Mauzo', value: `Tsh ${products.reduce((sum, p) => sum + (p.price * p.stock), 0).toLocaleString()}`, icon: Package, color: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.label}
            className="apple-card p-8"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <p className="text-[13px] text-gray-600 font-bold uppercase tracking-widest mb-1.5">{stat.label}</p>
            <h4 className={cn("text-2xl font-sans font-black tracking-tight", stat.color)}>{stat.value}</h4>
          </motion.div>
        ))}
      </div>

      <div className="apple-card overflow-hidden">
        <div className="p-8 border-b border-black/[0.05] bg-white/30 backdrop-blur-md">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
            <input
              type="text"
              placeholder="Tafuta bidhaa kwa jina au kundi..."
              className="apple-input w-full pl-14 py-4 bg-white/40 backdrop-blur-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-gray-600 border-b border-black/[0.03]">
                <th className="px-8 py-5 font-bold">Bidhaa</th>
                <th className="px-8 py-5 font-bold">Kundi</th>
                <th className="px-8 py-5 font-bold">Gharama</th>
                <th className="px-8 py-5 font-bold">Bei</th>
                <th className="px-8 py-5 font-bold">Faida</th>
                <th className="px-8 py-5 font-bold">Stoo</th>
                <th className="px-8 py-5 font-bold">Expire Date</th>
                <th className="px-8 py-5 font-bold text-right">Vitendo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.02]">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="group hover:bg-black/[0.01] transition-all duration-300">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#F2F2F7] rounded-2xl flex items-center justify-center text-gray-600 group-hover:bg-[#007AFF]/10 group-hover:text-[#007AFF] transition-all duration-300">
                        <Package size={22} />
                      </div>
                      <span className="font-bold text-black text-[15px] tracking-tight">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[13px] font-semibold text-gray-600 bg-[#F2F2F7] px-3 py-1 rounded-full">{product.category}</span>
                  </td>
                  <td className="px-8 py-6 text-[14px] font-medium text-gray-600">Tsh {product.costPrice.toLocaleString()}</td>
                  <td className="px-8 py-6 font-bold text-black text-[15px]">Tsh {product.price.toLocaleString()}</td>
                  <td className="px-8 py-6">
                    <span className="text-[#34C759] font-bold text-[14px]">
                      + Tsh {(product.price - product.costPrice).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1.5">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[11px] font-bold w-fit shadow-sm transition-all duration-500",
                        product.stock > (product.lowStockThreshold || 10) 
                          ? "bg-[#34C759]/10 text-[#34C759]" 
                          : product.stock === 0
                            ? "bg-[#FF3B30] text-white apple-error-glow"
                            : "bg-[#FF3B30]/10 text-[#FF3B30]"
                      )}>
                        {product.stock === 0 ? 'Imeisha!' : `${product.stock} ipo`}
                      </span>
                      {product.stock <= (product.lowStockThreshold || 10) && (
                        <div className="text-[10px] text-[#FF3B30] font-bold uppercase tracking-wider flex items-center gap-1 ml-1">
                          <AlertTriangle size={10} /> {product.stock === 0 ? 'Imeisha!' : 'Ipo Chini!'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    {product.expiryDate ? (
                      <div className="flex flex-col gap-1.5">
                        <span className={cn(
                          "text-[13px] font-semibold",
                          (() => {
                            const days = differenceInDays(parseISO(product.expiryDate), new Date());
                            if (days < 0) return "text-[#FF3B30]";
                            if (days <= 10) return "text-[#FF9500]";
                            return "text-gray-600";
                          })()
                        )}>
                          {format(parseISO(product.expiryDate), 'dd MMM, yyyy')}
                        </span>
                        {(() => {
                          const days = differenceInDays(parseISO(product.expiryDate), new Date());
                          if (days < 0) return (
                            <span className="flex items-center gap-1 text-[10px] text-[#FF3B30] font-bold uppercase tracking-widest">
                              <AlertTriangle size={10} /> Imeisha
                            </span>
                          );
                          if (days <= 10) return (
                            <span className="flex items-center gap-1 text-[10px] text-[#FF9500] font-bold uppercase tracking-widest">
                              <AlertTriangle size={10} /> Inakaribia
                            </span>
                          );
                          return null;
                        })()}
                      </div>
                    ) : (
                      <span className="text-[#D1D1D6] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-3 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300">
                      <button 
                        onClick={() => openAdjustmentModal(product)}
                        className="p-2.5 text-black hover:bg-black/[0.05] rounded-xl transition-all"
                        title="Adjust Stock"
                      >
                        <Settings2 size={18} />
                      </button>
                      <button 
                        onClick={() => openModal(product)}
                        className="p-2.5 text-[#007AFF] hover:bg-[#007AFF]/10 rounded-xl transition-all"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(product.id)}
                        className="p-2.5 text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-xl transition-all"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Scan Modal */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[110] backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-white rounded-[48px] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-white/40"
            >
              <div className="p-8 border-b border-black/[0.05] flex justify-between items-center bg-black text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Wand2 className="text-[#007AFF]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">AI Product Scanner</h3>
                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-0.5">Partner AI inasoma picha yako</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAiModalOpen(false)}
                  className="p-3 hover:bg-white/10 rounded-full transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {isScanning ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-6">
                    <Loader2 className="w-16 h-16 text-[#007AFF] animate-spin" />
                    <div className="text-center">
                      <p className="text-xl font-bold text-black tracking-tight">AI Inatambua Bidhaa...</p>
                      <p className="text-gray-500 mt-2">Hii itachukua sekunde chache, tafadhali subiri.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-gray-600 font-medium">Bidhaa {scannedItems.length} zimepatikana. Unaweza kurekebisha idadi (Units) hapa chini:</p>
                    </div>
                    {scannedItems.map((item, idx) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx} 
                        className="bg-[#F2F2F7] p-6 rounded-[32px] grid grid-cols-1 md:grid-cols-4 gap-6 items-center border border-black/[0.03]"
                      >
                        <div className="md:col-span-2">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Jina na Kundi</p>
                          <input 
                            className="bg-transparent font-black text-lg text-black w-full outline-none focus:text-[#007AFF] transition-colors"
                            value={item.name}
                            onChange={(e) => {
                              const newItems = [...scannedItems];
                              newItems[idx].name = e.target.value;
                              setScannedItems(newItems);
                            }}
                          />
                          <p className="text-xs text-gray-400 font-medium mt-1">{item.category}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Bei (Tsh)</p>
                          <input 
                            type="number"
                            className="bg-transparent font-bold text-black w-full outline-none focus:text-[#007AFF]"
                            value={item.price}
                            onChange={(e) => {
                              const newItems = [...scannedItems];
                              newItems[idx].price = Number(e.target.value);
                              setScannedItems(newItems);
                            }}
                          />
                        </div>
                        <div className="bg-white/50 p-4 rounded-2xl border border-black/[0.05]">
                          <p className="text-[10px] text-[#007AFF] font-bold uppercase tracking-widest mb-1">Units / Stock</p>
                          <input 
                            type="number"
                            className="bg-transparent font-black text-xl text-[#007AFF] w-full outline-none"
                            value={item.stock}
                            onChange={(e) => {
                              const newItems = [...scannedItems];
                              newItems[idx].stock = Number(e.target.value);
                              setScannedItems(newItems);
                            }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {!isScanning && scannedItems.length > 0 && (
                <div className="p-8 border-t border-black/[0.05] flex gap-4 bg-white/50 backdrop-blur-md">
                  <button 
                    onClick={() => setIsAiModalOpen(false)}
                    className="flex-1 py-5 rounded-[24px] font-bold text-gray-600 bg-black/5 hover:bg-black/10 transition-all uppercase tracking-widest text-[13px]"
                  >
                    Ghairi
                  </button>
                  <button 
                    onClick={saveScannedItems}
                    disabled={isSaving}
                    className="flex-[2] apple-button-primary flex items-center justify-center gap-3 py-5"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Plus size={20} />
                    )}
                    <span>Hifadhi Bidhaa Zote ({scannedItems.length})</span>
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Adjustment Modal */}
      <AnimatePresence>
        {isAdjustingStock && adjustingProduct && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[100] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[40px] max-w-md w-full shadow-2xl border border-white/20"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-[#007AFF]/10 text-[#007AFF] rounded-[20px] flex items-center justify-center shadow-sm">
                  <Settings2 size={28} />
                </div>
                <div>
                <h3 className="text-2xl font-sans font-black text-black">Rekebisha Stock</h3>
                  <p className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">{adjustingProduct.name}</p>
                </div>
              </div>

              <form onSubmit={handleStockAdjustment} className="space-y-8">
                <div className="grid grid-cols-2 gap-5">
                  <div className="bg-[#F2F2F7] p-5 rounded-[24px] border border-black/[0.01]">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-2">Sasa</p>
                    <p className="text-2xl font-bold text-black">{adjustingProduct.stock}</p>
                  </div>
                  <div className="bg-[#007AFF]/5 p-5 rounded-[24px] border border-[#007AFF]/10">
                    <p className="text-[10px] text-[#007AFF] font-bold uppercase tracking-widest mb-2">Mpya</p>
                    <input
                      type="number"
                      required
                      className="w-full bg-transparent text-2xl font-bold text-[#007AFF] outline-none"
                      value={newStockValue}
                      onChange={(e) => setNewStockValue(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-4 px-1">Sababu ya Marekebisho</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'correction', label: 'Masahihisho' },
                      { id: 'damage', label: 'Imeharibika' },
                      { id: 'found', label: 'Imepatikana' },
                      { id: 'expired', label: 'Imeisha Muda' },
                      { id: 'other', label: 'Nyingine' }
                    ].map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setAdjustmentReason(r.id as any)}
                        className={cn(
                          "px-4 py-3 rounded-[16px] text-[13px] font-bold border transition-all duration-300",
                          adjustmentReason === r.id 
                            ? "bg-[#1C1C1E] text-white border-[#1C1C1E] shadow-lg" 
                            : "bg-[#F2F2F7] text-gray-600 border-transparent hover:bg-[#E5E5EA]"
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-1">Maelezo (Optional)</label>
                  <textarea
                    className="apple-input w-full min-h-[100px] py-4"
                    placeholder="Andika maelezo zaidi hapa..."
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAdjustingStock(false)}
                    className="flex-1 apple-button-secondary"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    className="flex-1 apple-button-primary"
                  >
                    Hifadhi
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[100] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[40px] max-w-lg w-full shadow-2xl border border-white/20"
            >
              <h3 className="text-3xl font-sans font-black text-black mb-8 tracking-tight">
                {editingProduct ? 'Rekebisha Bidhaa' : 'Bidhaa Mpya'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">Jina la Bidhaa</label>
                    <input
                      type="text"
                      required
                      className="apple-input w-full py-4"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mfano: Coca Cola 500ml"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">Bei ya Kununua</label>
                    <input
                      type="number"
                      required
                      className="apple-input w-full py-4"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">Bei ya Kuuza</label>
                    <input
                      type="number"
                      required
                      className="apple-input w-full py-4"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">Idadi (Stock)</label>
                    <input
                      type="number"
                      required
                      className="apple-input w-full py-4"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">Kundi (Category)</label>
                    <input
                      type="text"
                      required
                      className="apple-input w-full py-4"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Mfano: Vinywaji"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">Tarehe ya Kuisha</label>
                    <input
                      type="date"
                      className="apple-input w-full py-4"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">Kiwango cha Chini</label>
                    <input
                      type="number"
                      className="apple-input w-full py-4"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
                
                <div className="flex gap-4 mt-10">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 apple-button-secondary"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 apple-button-primary disabled:opacity-50"
                  >
                    {isSaving ? 'Inahifadhi...' : (editingProduct ? 'Hifadhi' : 'Ongeza Bidhaa')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[110] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[40px] max-w-sm w-full shadow-2xl text-center border border-white/20"
            >
              <div className="w-20 h-20 bg-[#FF3B30]/10 text-[#FF3B30] rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Trash2 size={36} />
              </div>
              <h3 className="text-2xl font-sans font-black text-[#1C1C1E] mb-3 tracking-tight">Futa Bidhaa?</h3>
              <p className="text-[#8E8E93] font-medium mb-10 leading-relaxed">Una uhakika unataka kufuta bidhaa hii? Kitendo hiki hakiwezi kurudishwa.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 apple-button-secondary"
                >
                  Hapana
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-[#FF3B30] text-white font-bold rounded-2xl px-6 py-4 shadow-lg shadow-[#FF3B30]/20 hover:bg-[#D70015] transition-all active:scale-[0.97]"
                >
                  Ndiyo, Futa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete All Confirmation Modal */}
      <AnimatePresence>
        {isDeletingAll && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[110] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-10 rounded-[40px] max-w-sm w-full shadow-2xl text-center border border-white/20"
            >
              <div className="w-20 h-20 bg-[#FF3B30]/10 text-[#FF3B30] rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-sm">
                <AlertTriangle size={36} />
              </div>
              <h3 className="text-2xl font-sans font-black text-[#1C1C1E] mb-3 tracking-tight">Futa Zote?</h3>
              <p className="text-[#8E8E93] font-medium mb-10 leading-relaxed">Una uhakika unataka kufuta bidhaa ZOTE kwenye stoo? Kitendo hiki ni hatari na hakiwezi kurudishwa.</p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeletingAll(false)}
                  className="flex-1 apple-button-secondary"
                >
                  Ghairi
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="flex-1 bg-[#FF3B30] text-white font-bold rounded-2xl px-6 py-4 shadow-lg shadow-[#FF3B30]/20 hover:bg-[#D70015] transition-all active:scale-[0.97]"
                >
                  Futa Zote
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
