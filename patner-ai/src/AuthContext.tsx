import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Business } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  businesses: Business[];
  activeBusiness: Business | null;
  setActiveBusiness: (business: Business) => void;
  loading: boolean;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  businesses: [],
  activeBusiness: null,
  setActiveBusiness: () => {},
  loading: true,
  isAuthReady: false,
});

const MOCK_USER: any = {
  uid: 'system-admin-user',
  email: 'admin@partner.ai',
  displayName: 'Mkurugenzi Mkuu',
  emailVerified: true,
};

const MOCK_PROFILE: UserProfile = {
  uid: 'system-admin-user',
  email: 'admin@partner.ai',
  displayName: 'Mkurugenzi Mkuu',
  role: 'owner',
  businessId: 'main-business-001',
  createdAt: new Date().toISOString(),
};

const MOCK_BUSINESS: Business = {
  id: 'main-business-001',
  name: 'Biashara Yangu',
  ownerUid: 'system-admin-user',
  createdAt: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(MOCK_USER);
  const [profile, setProfile] = useState<UserProfile | null>(MOCK_PROFILE);
  const [businesses, setBusinesses] = useState<Business[]>([MOCK_BUSINESS]);
  const [activeBusiness, setActiveBusiness] = useState<Business | null>(MOCK_BUSINESS);
  const [loading, setLoading] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(true);

  useEffect(() => {
    // Ensure default data exists in Firestore for the mock user
    const ensureDefaultData = async () => {
      try {
        const busDoc = await getDoc(doc(db, 'businesses', MOCK_BUSINESS.id));
        if (!busDoc.exists()) {
          await setDoc(doc(db, 'businesses', MOCK_BUSINESS.id), MOCK_BUSINESS);
          
          // Also create the mock user profile in Firestore
          await setDoc(doc(db, 'users', MOCK_PROFILE.uid), MOCK_PROFILE);
          
          // Add a sample product so the POS isn't empty
          const sampleProduct = {
            id: 'sample-prod-001',
            name: 'Bidhaa ya Majaribio',
            price: 5000,
            costPrice: 3500,
            stock: 100,
            category: 'Vinywaji',
            businessId: MOCK_BUSINESS.id,
            updatedAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'products', sampleProduct.id), sampleProduct);
        }
      } catch (err) {
        console.error("Error creating default mock data:", err);
      }
    };
    
    ensureDefaultData();

    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeBusinesses: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Clean up previous profile listener if it exists
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        if (unsubscribeBusinesses) {
          unsubscribeBusinesses();
          unsubscribeBusinesses = null;
        }

        // Listen to profile changes in real-time
        const docRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData);
            
            // Listen to businesses owned by this user or where they work
            const businessesQ = query(
              collection(db, 'businesses'),
              where('ownerUid', '==', firebaseUser.uid)
            );
            
            unsubscribeBusinesses = onSnapshot(businessesQ, (snapshot) => {
              const b: Business[] = [];
              snapshot.forEach((doc) => b.push({ id: doc.id, ...doc.data() } as Business));
              setBusinesses(b);
              
              if (b.length > 0) {
                const currentActive = b.find(biz => biz.id === profileData.businessId) || b[0];
                setActiveBusiness(currentActive);
              }
              setLoading(false);
            });
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeBusinesses) unsubscribeBusinesses();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, businesses, activeBusiness, setActiveBusiness, loading, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
