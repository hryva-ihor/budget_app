import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  User as FirebaseUser,
  GoogleAuthProvider
} from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  BarChart, 
  Wallet, 
  Users, 
  TrendingUp, 
  Settings as SettingsIcon, 
  Coins, 
  Target, 
  Sparkles,
  ArrowDownRight,
  TrendingDown,
  Loader2,
  Lock,
  Moon,
  Sun,
  Menu,
  X
} from 'lucide-react';
import { auth, db, googleProvider, getOrCreateUserProfile, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, Account, Category, Transaction, SavingGoal } from './types';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Accounts } from './components/Accounts';
import { CategoriesManager } from './components/CategoriesManager';
import { SavingGoals } from './components/SavingGoals';
import { Settings } from './components/Settings';
import { QuickActionMenu } from './components/QuickActionMenu';

type ActiveTab = 'dashboard' | 'transactions' | 'accounts' | 'categories' | 'goals' | 'settings';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [familyId, setFamilyId] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // Real-time collections database states
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingGoal[]>([]);

  // Navigation and aesthetics states
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Apply dark mode theme setting on save
  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Auth observer initialization
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const profile = await getOrCreateUserProfile(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName || 'Користувач',
            firebaseUser.photoURL || ''
          );
          setUserProfile(profile);
          setFamilyId(profile.familyId);
        } catch (err) {
          console.error("Failed to seed user profile:", err);
        }
      } else {
        setUserProfile(null);
        setFamilyId('');
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time user profile sync
  useEffect(() => {
    if (!user || !user.uid) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        setUserProfile(profile);
        setFamilyId(profile.familyId);
      }
    }, (err) => {
      console.error('Error synchronizing active profile sync:', err);
    });

    return () => unsubProfile();
  }, [user]);

  // Multi-collection Joint family real-time tracking query listeners
  useEffect(() => {
    if (!familyId) return;

    // Accounts listener
    const unsubAccounts = onSnapshot(
      query(collection(db, 'accounts'), where('familyId', '==', familyId)),
      (snap) => {
        const data: Account[] = [];
        snap.forEach(d => data.push(d.data() as Account));
        setAccounts(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'accounts')
    );

    // Categories listener
    const unsubCategories = onSnapshot(
      query(collection(db, 'categories'), where('familyId', '==', familyId)),
      (snap) => {
        const data: Category[] = [];
        snap.forEach(d => data.push(d.data() as Category));
        setCategories(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    // Transactions listener
    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), where('familyId', '==', familyId)),
      (snap) => {
        const data: Transaction[] = [];
        snap.forEach(d => {
          const item = d.data();
          data.push({
            ...item,
            date: item.date?.toDate ? item.date.toDate() : new Date(item.date)
          } as Transaction);
        });
        setTransactions(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
    );

    // Goals listener
    const unsubGoals = onSnapshot(
      query(collection(db, 'goals'), where('familyId', '==', familyId)),
      (snap) => {
        const data: SavingGoal[] = [];
        snap.forEach(d => data.push(d.data() as SavingGoal));
        setGoals(data);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'goals')
    );

    return () => {
      unsubAccounts();
      unsubCategories();
      unsubTransactions();
      unsubGoals();
    };
  }, [familyId]);

  // Handle Google Login setup popup
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Authentication popup failed:", err);
    }
  };

  // Navigations selector mapping
  const menuItems = [
    { id: 'dashboard', label: 'Дашборд', icon: BarChart },
    { id: 'transactions', label: 'Транзакції', icon: Coins },
    { id: 'accounts', label: 'Рахунки', icon: Wallet },
    { id: 'categories', label: 'Категорії', icon: Sparkles },
    { id: 'goals', label: 'Спільні цілі', icon: Target },
    { id: 'settings', label: 'Налаштування', icon: SettingsIcon },
  ];

  if (isAuthLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors ${
        isDark ? 'bg-neutral-950 text-white' : 'bg-neutral-50 text-neutral-900'
      }`}>
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={36} />
          <p className="text-xs font-medium text-neutral-400">Завантажуємо сімейну базу даних...</p>
        </div>
      </div>
    );
  }

  // Not logged in UI - sleek minimalist landing page
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
        isDark 
          ? 'bg-neutral-950 text-white selection:bg-indigo-500/30' 
          : 'bg-neutral-50 text-neutral-900 selection:bg-indigo-100'
      }`}>
        <div className={`w-full max-w-sm p-8 rounded-3xl border text-center transition-all duration-300 ${
          isDark 
            ? 'bg-neutral-900/40 border-neutral-850 hover:border-neutral-800' 
            : 'bg-white border-neutral-200 shadow-xl shadow-neutral-100'
        }`}>
          {/* Logo Header */}
          <div className="mb-6 flex justify-center">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-2xl flex items-center justify-center">
              <Wallet size={24} />
            </div>
          </div>

          <h2 className={`text-xl font-bold tracking-tight mb-2 ${isDark ? 'text-white' : 'text-neutral-950'}`}>
            Сімейний Бюджет
          </h2>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-6">
            Спільний трекінг витрат, накопичень на цілі та надходжень в реальному часі для Вас та Вашої дружини.
          </p>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide cursor-pointer text-white bg-indigo-500 hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            <Lock size={14} />
            Увійти через Google акаунт
          </button>

          <p className="text-[10px] text-neutral-400/80 mt-5 leading-relaxed bg-neutral-500/5 p-3 rounded-xl border border-neutral-550/10">
            Для безпечної синхронізації між вашими пристроями задіяна хмарна база Firebase Firestore
          </p>
        </div>
      </div>
    );
  }

  // Main interactive application with tabs switching
  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
      isDark ? 'bg-neutral-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      
      {/* Dynamic Header */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md px-6 py-4 flex items-center justify-between transition-colors ${
        isDark ? 'bg-neutral-950/80 border-neutral-850' : 'bg-white/80 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl text-white shadow-sm">
            <Wallet size={18} />
          </div>
          <span className={`text-base font-extrabold tracking-tight font-display uppercase ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Сімейний Бюджет
          </span>
          <span className={`hidden sm:flex text-xs font-semibold px-2.5 py-1 rounded-full items-center gap-1.5 ${
            isDark 
              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' 
              : 'bg-emerald-50 text-emerald-700 border border-emerald-250/30'
          }`}>
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Синхронізовано
          </span>
        </div>

        {/* User profile identifier bar with mock stacked spouse avatar */}
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2 items-center">
            {/* User Avatar Initials */}
            <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-xs ${
              isDark ? 'border-neutral-900 bg-neutral-800 text-neutral-200' : 'border-white bg-slate-200 text-slate-700'
            }`}>
              {userProfile?.displayName ? userProfile.displayName.substring(0, 2).toUpperCase() : 'OK'}
            </div>
            {/* Spouse second avatar */}
            <div 
              title="Інеса Степанова (Дружина)"
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center font-bold text-xs shadow-xs cursor-help ${
                isDark ? 'border-neutral-900 bg-indigo-950 text-indigo-400' : 'border-white bg-indigo-100 text-indigo-700 font-semibold'
              }`}
            >
              ІС
            </div>
          </div>

          <div className="hidden md:block text-left">
            <p className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {userProfile?.displayName}
            </p>
            <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider">Сімейний Спейс</p>
          </div>
          
          {/* Mobile Menu Toggler button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`p-1.5 rounded-lg md:hidden ${isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-slate-100 text-neutral-600'}`}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Primary Area Container */}
      <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto px-4 md:px-6 py-6 gap-6">
        
        {/* Sidebar desktop navigation */}
        <aside className="hidden md:flex flex-col w-[200px] shrink-0 space-y-1">
          {menuItems.map(item => {
            const IconComp = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as ActiveTab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-xs tracking-tight transition-all pointer-events-auto cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100/30 dark:shadow-none' 
                    : isDark 
                    ? 'text-neutral-400 hover:bg-neutral-900 hover:text-white' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <IconComp size={15} />
                {item.label}
              </button>
            );
          })}
        </aside>

        {/* Mobile Navigation Dropdown dialog */}
        {isMobileMenuOpen && (
          <div className="md:hidden flex flex-col space-y-1 p-3 bg-neutral-900/10 border-b border-neutral-500/10 rounded-xl">
            {menuItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as ActiveTab);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold ${
                    isActive 
                      ? 'bg-indigo-600 text-white' 
                      : isDark ? 'text-neutral-400 hover:bg-neutral-800' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <IconComp size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Dynamic page switches block */}
        <main className="flex-1 min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard 
              accounts={accounts} 
              transactions={transactions} 
              categories={categories} 
              goals={goals} 
              isDark={isDark} 
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'transactions' && (
            <Transactions 
              accounts={accounts} 
              transactions={transactions} 
              categories={categories} 
              familyId={familyId} 
              isDark={isDark} 
            />
          )}
          {activeTab === 'accounts' && (
            <Accounts 
              accounts={accounts} 
              familyId={familyId} 
              isDark={isDark} 
            />
          )}
          {activeTab === 'categories' && (
            <CategoriesManager 
              categories={categories} 
              familyId={familyId} 
              isDark={isDark} 
            />
          )}
          {activeTab === 'goals' && (
            <SavingGoals 
              goals={goals} 
              familyId={familyId} 
              isDark={isDark} 
            />
          )}
          {activeTab === 'settings' && (
            <Settings 
              userProfile={userProfile} 
              isDark={isDark} 
              setIsDark={setIsDark} 
            />
          )}
        </main>

      </div>

      {/* Floating Interactive Quick Actions Button Menu */}
      <QuickActionMenu 
        familyId={familyId} 
        userId={user?.uid || ''}
        accounts={accounts} 
        categories={categories} 
        isDark={isDark} 
      />
    </div>
  );
}
