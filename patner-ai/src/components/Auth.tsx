import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInAnonymously,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, collection, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { toast } from 'react-hot-toast';
import { triggerScreenFlash } from './ScreenFlash';
import { LogIn, UserPlus, Store, Chrome, ArrowRight, Mail, Lock, User as UserIcon, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';

export const Auth: React.FC = () => {
  const { user, profile } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  useEffect(() => {
    // Handle the result of a redirect login (essential for iframes)
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          triggerScreenFlash('success');
          toast.success('Karibu! Umeingia kupitia Redirect.');
        }
      } catch (error: any) {
        console.error('Redirect Result Error:', error);
        // If assertion failed happened here, we need to notify user
        if (error.message?.includes('INTERNAL ASSERTION FAILED')) {
          toast.error('Hitilafu ya Browser. Tafadhali tumia "App Safi" kurekebisha.');
        }
      }
    };
    checkRedirect();

    if (user && !profile) {
      setNeedsProfile(true);
    } else {
      setNeedsProfile(false);
    }
  }, [user, profile]);

  const handleDemoLogin = () => {
    // Only for preview/demo purposes to unblock the user
    toast.success('Umeingia kama Mkurugenzi wa Maonyesho (Demo)');
    // In a real app, we would have a specific demo account, 
    // but here we just show the app UI if they can't login via Google.
    window.open(window.location.href, '_blank');
  };

  const handleAnonymousLogin = async () => {
    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      
      // Check if profile exists
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (!docSnap.exists()) {
        const businessId = doc(collection(db, 'businesses')).id;
        await setDoc(doc(db, 'businesses', businessId), {
          id: businessId,
          name: 'Biashara ya Maonyesho',
          ownerUid: user.uid,
          createdAt: new Date().toISOString(),
        });

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: 'guest@partner.ai',
          displayName: 'Mtumiaji wa Maonyesho',
          role: 'owner',
          businessId,
          createdAt: new Date().toISOString(),
        });
      }
      
      triggerScreenFlash('success');
      toast.success('Karibu kwenye Maonyesho (Guest Access)!');
    } catch (error: any) {
      console.error('Anonymous Login Error:', error);
      toast.error('Imeshindikana kuingia kama mgeni.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLoginWithRedirect = async () => {
    if (!navigator.onLine) {
      toast.error('Huna internet. Tafadhali kagua muunganisho wako.');
      return;
    }

    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      // Redirect is often more reliable in problematic browsers
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error('Google Redirect Login Error:', error);
      toast.error('Imeshindikana kuanzisha Login. Jaribu "App Safi".');
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!navigator.onLine) {
      toast.error('Huna internet. Tafadhali kagua muunganisho wako.');
      return;
    }

    setLoading(true);
    // Safety timeout to reset loading state if Firebase hangs
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      toast.error('Mchakato unachukua muda mrefu. Tafadhali jaribu "Fungua App Safi"');
    }, 15000);

    try {
      // Clear any pending state by signing out first (to fix INTERNAL ASSERTION FAILED)
      await auth.signOut().catch(() => {});
      
      const provider = new GoogleAuthProvider();
      // Add custom parameter to force account selection if needed
      provider.setCustomParameters({ prompt: 'select_account' });
      
      await signInWithPopup(auth, provider);
      clearTimeout(safetyTimeout);
      triggerScreenFlash('success');
      toast.success('Umeingia kwa mafanikio!');
    } catch (error: any) {
      clearTimeout(safetyTimeout);
      console.error('Google Login Error:', error);
      triggerScreenFlash('warning');
      
      // Handle specific Firebase Auth error codes
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Dirisha limefungwa. Ikiwa kosa linaendelea, bofya "Fungua App Safi" hapa chini.');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Browser imezuia dirisha jipya. Ruhusu pop-ups au fungua kwenye Tab mpya.');
      } else if (error.code === 'auth/network-request-failed' || (error.message && error.message.includes('INTERNAL ASSERTION FAILED'))) {
        toast.error('Connection Blocked. Tafadhali bonyeza "Fungua App Safi" ili ku-login nje ya preview.');
      } else {
        toast.error('Imeshindikana kuingia na Google. Jaribu tena au tumia email.');
      }
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const businessId = doc(collection(db, 'businesses')).id;
      await setDoc(doc(db, 'businesses', businessId), {
        id: businessId,
        name: businessName,
        ownerUid: user.uid,
        createdAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || displayName,
        role: 'owner',
        businessId,
        createdAt: new Date().toISOString(),
      });

      triggerScreenFlash('success');
      toast.success('Wasifu na Biashara imekamilika!');
    } catch (error: any) {
      triggerScreenFlash();
      toast.error('Imeshindikana kukamilisha wasifu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const safetyTimeout = setTimeout(() => setLoading(false), 15000);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        clearTimeout(safetyTimeout);
        triggerScreenFlash('success');
        toast.success('Karibu tena!');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        await updateProfile(newUser, { displayName });

        const businessId = doc(collection(db, 'businesses')).id;
        await setDoc(doc(db, 'businesses', businessId), {
          id: businessId,
          name: businessName,
          ownerUid: newUser.uid,
          createdAt: new Date().toISOString(),
        });

        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          email: newUser.email,
          displayName,
          role: 'owner',
          businessId,
          createdAt: new Date().toISOString(),
        });

        triggerScreenFlash('success');
        toast.success('Akaunti na Biashara imesajiliwa!');
      }
    } catch (error: any) {
      console.error(error);
      triggerScreenFlash();
      if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/Password login haijawezeshwa. Tafadhali tumia Google Login.');
      } else {
        toast.error(error.message || 'Kuna tatizo limetokea');
      }
    } finally {
      setLoading(false);
    }
  };

  if (needsProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] p-6 font-sans">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#007AFF]/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5856D6]/5 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white/80 backdrop-blur-2xl p-10 rounded-[48px] shadow-2xl max-w-md w-full border border-white/40 relative z-10"
        >
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-[28px] flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-[#007AFF]/20">
              <Building2 size={36} />
            </div>
            <h2 className="text-3xl font-sans font-black text-black tracking-tight">Kamilisha Usajili</h2>
            <p className="text-gray-600 font-medium mt-2">Karibu! Tafadhali jaza jina la biashara yako ili kuanza.</p>
          </div>

          <form onSubmit={handleCompleteProfile} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[13px] font-bold text-black uppercase tracking-widest ml-1">Jina la Biashara</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#007AFF] transition-colors">
                  <Store size={20} />
                </div>
                <input
                  type="text"
                  required
                  className="apple-input pl-12"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Mfano: Juma Grocery"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full apple-button-primary py-5 text-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Kamilisha Usajili</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-6 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#007AFF]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#5856D6]/10 rounded-full blur-[150px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-2xl p-10 md:p-12 rounded-[56px] shadow-2xl max-w-lg w-full border border-white/40 relative z-10"
      >
        <div className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-24 h-24 bg-gradient-to-br from-[#007AFF] to-[#5856D6] rounded-[32px] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-[#007AFF]/30"
          >
            <Store size={44} />
          </motion.div>
          
          <h2 className="text-4xl font-sans font-black text-black tracking-tight mb-3">
            {isLogin ? 'Karibu Tena' : 'Anza Biashara'}
          </h2>
          <p className="text-gray-600 font-medium text-lg">
            {isLogin ? 'Ingia kwenye mfumo wako wa POS' : 'Sajili biashara yako leo'}
          </p>
        </div>

        <div className="space-y-8">
          {/* Instructions Box */}
          <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-[32px] p-6 space-y-4 luxury-card-glow transition-all duration-500 hover:scale-[1.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center text-white font-black text-xs">!</div>
              <h4 className="text-[12px] font-black text-[#007AFF] uppercase tracking-[0.2em]">Hatua Muhimu ya Preview</h4>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed font-medium">
              Ili login ya Google ifanye kazi hapa, tafadhali andikisha (copy/paste) domain hii kwenye 
              <strong> Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains</strong>:
            </p>
            <div className="flex items-center gap-2 p-3 bg-white/50 rounded-2xl border border-[#007AFF]/10">
              <code className="text-[10px] text-[#007AFF] font-mono break-all flex-1">
                {window.location.hostname}
              </code>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.hostname);
                  toast.success('Domain imekopwa!');
                }}
                className="text-[9px] font-black text-[#007AFF] uppercase border border-[#007AFF]/20 px-3 py-1.5 rounded-xl hover:bg-[#007AFF] hover:text-white transition-all"
              >
                Copy
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-[9px] text-gray-500 italic">Ikiwa huna uwezo wa kufanya hivi sasa, tumia moja ya njia zilizo hapa chini:</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border border-black/[0.1] text-black py-5 rounded-[28px] font-bold hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-4 shadow-sm active:scale-[0.98] relative overflow-hidden group disabled:opacity-70"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {loading ? (
                <div className="w-6 h-6 border-3 border-[#4285F4] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Chrome size={24} className="text-[#4285F4]" />
              )}
              <span className="text-lg">Google (Pop-up)</span>
            </button>

            <button
              onClick={handleGoogleLoginWithRedirect}
              disabled={loading}
              className="w-full bg-[#4285F4] text-white py-5 rounded-[28px] font-bold hover:shadow-2xl hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-4 shadow-sm active:scale-[0.98] relative overflow-hidden group disabled:opacity-70"
            >
              <Chrome size={24} />
              <span className="text-lg">Google (Redirect)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[28px] bg-[#5856D6]/10 border border-[#5856D6]/20 text-[#5856D6] hover:bg-[#5856D6]/20 transition-all group"
            >
              <LogIn size={20} className="group-hover:translate-y-[-2px] transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-wider">Tab Mpya</span>
            </a>

            <button
              onClick={handleAnonymousLogin}
              disabled={loading}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-[28px] bg-black/5 border border-black/10 text-black/60 hover:bg-black/10 transition-all group"
            >
              <UserIcon size={20} className="group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-wider">Guest Login</span>
            </button>
          </div>

          <div className="relative flex items-center gap-6 py-2">
            <div className="flex-1 h-px bg-black/[0.05]"></div>
            <span className="text-[10px] text-gray-600 uppercase font-bold tracking-[0.3em]">au tumia email</span>
            <div className="flex-1 h-px bg-black/[0.05]"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6 overflow-hidden"
                >
                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-black uppercase tracking-widest ml-1">Jina Lako</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#007AFF] transition-colors">
                        <UserIcon size={20} />
                      </div>
                      <input
                        type="text"
                        required
                        className="apple-input pl-12"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Mfano: Juma Hamisi"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-black uppercase tracking-widest ml-1">Jina la Biashara</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#007AFF] transition-colors">
                        <Building2 size={20} />
                      </div>
                      <input
                        type="text"
                        required
                        className="apple-input pl-12"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Mfano: Juma Grocery"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-black uppercase tracking-widest ml-1">Barua Pepe (Email)</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#007AFF] transition-colors">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  required
                  className="apple-input pl-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mfano@gmail.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-black uppercase tracking-widest ml-1">Neno la Siri</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#007AFF] transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  className="apple-input pl-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full apple-button-primary py-5 text-lg flex items-center justify-center gap-3 mt-4"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn size={22} /> : <UserPlus size={22} />}
                  <span>{isLogin ? 'Ingia Sasa' : 'Sajili Akaunti'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-[#007AFF] font-bold text-[15px] hover:underline underline-offset-8 transition-all"
          >
            {isLogin ? 'Huna akaunti? Jisajili hapa' : 'Tayari una akaunti? Ingia hapa'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
