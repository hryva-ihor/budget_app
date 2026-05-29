import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  Coins, 
  CreditCard, 
  Sparkles, 
  Target, 
  Loader2, 
  PlusCircle, 
  Check 
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Account, Category, AccountType, TransactionType } from '../types';
import { IconRenderer } from './IconRenderer';

interface QuickActionMenuProps {
  familyId: string;
  userId: string;
  accounts: Account[];
  categories: Category[];
  isDark: boolean;
}

type ActiveQuickModal = 'none' | 'transaction' | 'account' | 'category' | 'goal';

const ICON_PRESETS = [
  'ShoppingBag', 'Home', 'Car', 'HeartPulse', 
  'GlassWater', 'Shirt', 'Wifi', 'Briefcase', 
  'Coins', 'Apple', 'Gift', 'PiggyBank', 'CircleHelp'
];

const COLOR_PRESETS = [
  { hex: '#10b981', name: 'Смарагдовий' },
  { hex: '#3b82f6', name: 'Синій' },
  { hex: '#ef4444', name: 'Червоний' },
  { hex: '#f59e0b', name: 'Бурштиновий' },
  { hex: '#8b5cf6', name: 'Фіолетовий' },
  { hex: '#ec4899', name: 'Рожевий' },
  { hex: '#06b6d4', name: 'Блакитний' },
  { hex: '#14b8a6', name: 'Бірюзовий' },
  { hex: '#6b7280', name: 'Сірий' }
];

export function QuickActionMenu({ familyId, userId, accounts, categories, isDark }: QuickActionMenuProps) {
  const [isOpenMenu, setIsOpenMenu] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveQuickModal>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states - Transaction
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txAmount, setTxAmount] = useState('');
  const [txAccountId, setTxAccountId] = useState('');
  const [txCategoryId, setTxCategoryId] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);

  // Form states - Account
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('card');
  const [accCurrency, setAccCurrency] = useState<'UAH' | 'USD' | 'EUR'>('UAH');
  const [accInitialBalance, setAccInitialBalance] = useState('');

  // Form states - Category
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catColor, setCatColor] = useState('#10b981');
  const [catIcon, setCatIcon] = useState('ShoppingBag');

  // Form states - Saving Goal
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  // Handle outside clicks to close the expanded menu
  useEffect(() => {
    if (!isOpenMenu) return;

    const handleOutsideClick = () => {
      setIsOpenMenu(false);
    };

    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpenMenu]);

  // Handle modal defaults on open
  useEffect(() => {
    if (activeModal === 'transaction') {
      if (accounts.length > 0) {
        setTxAccountId(accounts[0].id);
      }
      const filteredCats = categories.filter(c => c.type === txType);
      if (filteredCats.length > 0) {
        setTxCategoryId(filteredCats[0].id);
      } else {
        setTxCategoryId('');
      }
    }
  }, [activeModal, accounts, categories, txType]);

  // Handle specific filtered categories when transaction type switches
  useEffect(() => {
    const filteredCats = categories.filter(c => c.type === txType);
    if (filteredCats.length > 0) {
      setTxCategoryId(filteredCats[0].id);
    } else {
      setTxCategoryId('');
    }
  }, [txType, categories]);

  const closeForm = () => {
    setActiveModal('none');
    setIsSubmitting(false);
    setErrorMsg('');
    
    // Clear transaction inputs
    setTxAmount('');
    setTxDescription('');
    setTxDate(new Date().toISOString().split('T')[0]);

    // Clear account inputs
    setAccName('');
    setAccType('card');
    setAccCurrency('UAH');
    setAccInitialBalance('');

    // Clear category inputs
    setCatName('');
    setCatType('expense');
    setCatColor('#10b981');
    setCatIcon('ShoppingBag');

    // Clear target inputs
    setGoalName('');
    setGoalTarget('');
    setGoalCurrent('');
    setGoalDeadline('');
  };

  // Submit Quick Transaction Form
  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) {
      setErrorMsg('Будь ласка, вкажіть дійсну суму більше нуля');
      return;
    }
    if (!txAccountId) {
      setErrorMsg('Будь ласка, оберіть рахунок для транзакції');
      return;
    }
    if (!txCategoryId) {
      setErrorMsg('Будь ласка, оберіть категорію витрати чи доходу');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const selectedAcc = accounts.find(a => a.id === txAccountId);
      const currency = selectedAcc?.currency || 'UAH';

      const parsedDate = new Date(txDate);
      parsedDate.setHours(12, 0, 0, 0); // avoid timezone offset issues

      const txId = `tx_${familyId}_quick_${Date.now()}`;
      await setDoc(doc(db, 'transactions', txId), {
        id: txId,
        familyId,
        accountId: txAccountId,
        categoryId: txCategoryId,
        amount: Number(txAmount),
        type: txType,
        description: txDescription.trim() || 'Швидка транзакція',
        currency,
        date: Timestamp.fromDate(parsedDate),
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      closeForm();
    } catch (err) {
      setErrorMsg('Не вдалося зберегти транзакцію. Спробуйте пізніше.');
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Account Form
  const handleAccSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setErrorMsg('Будь ласка, вкажіть назву рахунку');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const accId = `acc_${familyId}_quick_${Date.now()}`;
      await setDoc(doc(db, 'accounts', accId), {
        id: accId,
        familyId,
        name: accName.trim(),
        type: accType,
        currency: accCurrency,
        initialBalance: Number(accInitialBalance) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      closeForm();
    } catch (err) {
      setErrorMsg('Не вдалося створити рахунок.');
      handleFirestoreError(err, OperationType.WRITE, 'accounts');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Category Form
  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setErrorMsg('Будь ласка, вкажіть назву категорії');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const catId = `cat_${familyId}_quick_${Date.now()}`;
      await setDoc(doc(db, 'categories', catId), {
        id: catId,
        familyId,
        name: catName.trim(),
        type: catType,
        color: catColor,
        icon: catIcon,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      closeForm();
    } catch (err) {
      setErrorMsg('Не вдалося створити категорію.');
      handleFirestoreError(err, OperationType.WRITE, 'categories');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Quick Saving Goal Form
  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) {
      setErrorMsg('Будь ласка, вкажіть назву цілі');
      return;
    }
    if (!goalTarget || Number(goalTarget) <= 0) {
      setErrorMsg('Вкажіть коректну фінансову ціль');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const goalId = `goal_${familyId}_quick_${Date.now()}`;
      await setDoc(doc(db, 'goals', goalId), {
        id: goalId,
        familyId,
        name: goalName.trim(),
        targetAmount: Number(goalTarget),
        currentAmount: Number(goalCurrent) || 0,
        deadline: goalDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      closeForm();
    } catch (err) {
      setErrorMsg('Не вдалося створити спільну ціль.');
      handleFirestoreError(err, OperationType.WRITE, 'goals');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Centered Floating Control Menu */}
      <div 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Expanded Options List */}
        {isOpenMenu && (
          <div className="mb-4 flex flex-col gap-2.5 items-center transition-all duration-300 animate-slide-up">
            {/* Action 1: Add transaction */}
            <button
              onClick={() => {
                setActiveModal('transaction');
                setIsOpenMenu(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-lg border border-indigo-500/10 backdrop-blur-md bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95 transition-all text-left"
            >
              <Coins size={14} className="animate-pulse" />
              <span>Швидка транзакція</span>
            </button>

            {/* Action 2: Add Account */}
            <button
              onClick={() => {
                setActiveModal('account');
                setIsOpenMenu(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-lg border border-teal-500/10 backdrop-blur-md bg-teal-600 hover:bg-teal-700 text-white hover:scale-105 active:scale-95 transition-all"
            >
              <CreditCard size={14} />
              <span>Новий Рахунок</span>
            </button>

            {/* Action 3: Add Category */}
            <button
              onClick={() => {
                setActiveModal('category');
                setIsOpenMenu(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-lg border border-fuchsia-500/10 backdrop-blur-md bg-fuchsia-600 hover:bg-fuchsia-700 text-white hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles size={14} />
              <span>Нова Категорія</span>
            </button>

            {/* Action 4: Add Saving Goal */}
            <button
              onClick={() => {
                setActiveModal('goal');
                setIsOpenMenu(false);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold shadow-lg border border-amber-500/10 backdrop-blur-md bg-amber-500 hover:bg-amber-600 text-white hover:scale-105 active:scale-95 transition-all"
            >
              <Target size={14} />
              <span>Спільна Ціль</span>
            </button>
          </div>
        )}

        {/* Primary Circular Trigger FAB */}
        <button
          onClick={() => setIsOpenMenu(!isOpenMenu)}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 transform active:scale-90 select-none bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 border-2 ${
            isDark ? 'border-neutral-800' : 'border-white'
          }`}
          title="Швидкі операції"
        >
          <div className={`transition-transform duration-300 ${isOpenMenu ? 'rotate-135' : ''}`}>
            {isOpenMenu ? <X size={26} /> : <Plus size={26} />}
          </div>
        </button>
      </div>

      {/* BACKDROP BLUR SHIELD ON MODALS ACTIVE */}
      {activeModal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div 
            className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl relative transition-colors duration-300 ${
              isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-100 text-slate-800'
            }`}
          >
            {/* Top exit cross button */}
            <button 
              onClick={closeForm}
              className={`absolute top-4 right-4 p-1.5 rounded-xl transition-colors ${
                isDark ? 'hover:bg-neutral-850 text-neutral-400' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X size={18} />
            </button>

            {/* Header titles */}
            <div className="mb-5">
              <h3 className={`text-base font-extrabold flex items-center gap-2 font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeModal === 'transaction' && (
                  <><Coins size={18} className="text-indigo-500" />Швидка транзакція</>
                )}
                {activeModal === 'account' && (
                  <><CreditCard size={18} className="text-teal-500" />Новий фінансовий рахунок</>
                )}
                {activeModal === 'category' && (
                  <><Sparkles size={18} className="text-fuchsia-500" />Нова категорія витрат/доходів</>
                )}
                {activeModal === 'goal' && (
                  <><Target size={18} className="text-amber-500" />Нова спільна ціль</>
                )}
              </h3>
              <p className="text-[10px] text-neutral-400 mt-1">Швидке збереження змін у вашу спільну сімейну базу</p>
            </div>

            {/* Error alerts */}
            {errorMsg && (
              <div className="mb-4 text-xs font-semibold p-3 rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-500">
                {errorMsg}
              </div>
            )}

            {/* SUB FORM - 1. QUICK TRANSACTION */}
            {activeModal === 'transaction' && (
              <form onSubmit={handleTxSubmit} className="space-y-4">
                {/* Transaction Type Slider Toggle */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Тип операції</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-black/15 rounded-xl border border-neutral-750/10">
                    <button
                      type="button"
                      onClick={() => setTxType('expense')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        txType === 'expense' 
                          ? 'bg-rose-600 text-white shadow-xs' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Витрата
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('income')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        txType === 'income' 
                          ? 'bg-emerald-600 text-white shadow-xs' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Дохід
                    </button>
                  </div>
                </div>

                {/* Amount input block with reactive prefix currency marker */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                    Сума ({accounts.find(a => a.id === txAccountId)?.currency || 'UAH'})
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className={`w-full pl-4 pr-10 py-2.5 rounded-xl text-base font-bold font-mono outline-hidden border ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-white focus:border-indigo-500' 
                          : 'bg-slate-50 border-slate-200 focus:border-indigo-500'
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-neutral-400">
                      {accounts.find(a => a.id === txAccountId)?.currency === 'USD' ? '$' : 
                       accounts.find(a => a.id === txAccountId)?.currency === 'EUR' ? '€' : '₴'}
                    </span>
                  </div>
                </div>

                {/* Select Account */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Рахунок списання/надходження</label>
                  {accounts.length > 0 ? (
                    <select
                      value={txAccountId}
                      onChange={(e) => setTxAccountId(e.target.value)}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl outline-hidden border ${
                        isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.currency || 'UAH'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[10px] text-amber-500 font-bold bg-amber-500/10 p-2.5 rounded-xl">Потрібно спочатку створити рахунок</p>
                  )}
                </div>

                {/* Select Category */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Категорія</label>
                  {categories.filter(c => c.type === txType).length > 0 ? (
                    <select
                      value={txCategoryId}
                      onChange={(e) => setTxCategoryId(e.target.value)}
                      className={`w-full px-3 py-2 text-xs font-bold rounded-xl outline-hidden border ${
                        isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      {categories.filter(c => c.type === txType).map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[10px] text-rose-400 font-semibold bg-rose-500/10 p-2.5 rounded-xl">Поки немає категорій для цього типу операцій</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Опис</label>
                  <input
                    type="text"
                    placeholder="Наприклад: Сільпо продукти, АТБ, Аванс"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Transaction Date */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Дата транзакції</label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Submit button bar */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || accounts.length === 0}
                    className="w-full py-2.5 rounded-xl font-extrabold text-xs tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>Зберегти транзакцію</>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* SUB FORM - 2. QUICK ACCOUNT */}
            {activeModal === 'account' && (
              <form onSubmit={handleAccSubmit} className="space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Назва рахунку</label>
                  <input
                    type="text"
                    required
                    placeholder="Наприклад: Монобанк Чорна, Готівка Сейф"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Account Type Toggle */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Тип рахунку</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-black/15 rounded-xl border border-neutral-750/10">
                    <button
                      type="button"
                      onClick={() => setAccType('card')}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        accType === 'card' 
                          ? 'bg-teal-600 text-white shadow-xs' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Картка
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccType('cash')}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        accType === 'cash' 
                          ? 'bg-teal-600 text-white shadow-xs' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Готівка
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccType('other')}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        accType === 'other' 
                          ? 'bg-teal-600 text-white shadow-xs' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Інше
                    </button>
                  </div>
                </div>

                {/* Account Currency Selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Валюта рахунку</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['UAH', 'USD', 'EUR'] as const).map(curr => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setAccCurrency(curr)}
                        className={`py-2 text-xs font-bold border rounded-xl transition-all ${
                          accCurrency === curr 
                            ? 'bg-teal-600 border-teal-500 text-white' 
                            : isDark ? 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {curr === 'USD' ? '$ USD' : curr === 'EUR' ? '€ EUR' : '₴ UAH'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Initial balance */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Початковий баланс (на рахунку зараз)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={accInitialBalance}
                    onChange={(e) => setAccInitialBalance(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold font-mono rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white focus:border-teal-500' : 'bg-slate-50 border-slate-200 focus:border-teal-500'
                    }`}
                  />
                </div>

                {/* Submits account */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl font-extrabold text-xs tracking-wider bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>Почати рахунок</>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* SUB FORM - 3. QUICK CATEGORY */}
            {activeModal === 'category' && (
              <form onSubmit={handleCatSubmit} className="space-y-4">
                {/* Category Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Назва категорії</label>
                  <input
                    type="text"
                    required
                    placeholder="Наприклад: Розваги, Таксі, Подарунки"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Category Type (expense or income) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Призначення категорії</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-black/15 rounded-xl border border-neutral-750/10">
                    <button
                      type="button"
                      onClick={() => setCatType('expense')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        catType === 'expense' 
                          ? 'bg-fuchsia-600 text-white shadow-xs' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Для витрат
                    </button>
                    <button
                      type="button"
                      onClick={() => setCatType('income')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                        catType === 'income' 
                          ? 'bg-fuchsia-600 text-white shadow-xs' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Для доходів
                    </button>
                  </div>
                </div>

                {/* Color presets selection */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Прекрасна палітра кольору</label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {COLOR_PRESETS.map(c => {
                      const isSelected = catColor === c.hex;
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setCatColor(c.hex)}
                          className="w-7 h-7 rounded-full border relative flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                          style={{ backgroundColor: c.hex, borderColor: isSelected ? '#ffffff' : 'transparent' }}
                          title={c.name}
                        >
                          {isSelected && <Check size={12} className="text-white drop-shadow-md" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preset Vector Lucide Icons picker */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">Оберіть векторну іконку</label>
                  <div className="grid grid-cols-6 gap-2 p-2 rounded-xl bg-black/10 select-none max-h-[110px] overflow-y-auto">
                    {ICON_PRESETS.map(iconName => {
                      const isSelected = catIcon === iconName;
                      return (
                        <button
                          key={iconName}
                          type="button"
                          onClick={() => setCatIcon(iconName)}
                          className={`p-2.5 rounded-lg border text-sm flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-fuchsia-600/20 border-fuchsia-550 text-fuchsia-400' 
                              : isDark ? 'border-neutral-800 text-neutral-400 hover:text-white' : 'border-slate-100 text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <IconRenderer name={iconName} size={15} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Submit quick category */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl font-extrabold text-xs tracking-wider bg-fuchsia-600 hover:bg-fuchsia-700 text-white transition-colors flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>Зберегти категорію</>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* SUB FORM - 4. QUICK SAVING GOAL */}
            {activeModal === 'goal' && (
              <form onSubmit={handleGoalSubmit} className="space-y-4">
                {/* Goal Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Опис / Назва цілі спільного збору</label>
                  <input
                    type="text"
                    required
                    placeholder="Наприклад: Поїздка на море, Власний гараж"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Target Amount */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Цільова потрібна сума (₴)</label>
                  <input
                    type="number"
                    required
                    placeholder="Приклад: 50000"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold font-mono rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Current accumulated amount */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Скільки вже зібрано / накопичено зараз (₴)</label>
                  <input
                    type="number"
                    placeholder="Наприклад: 10000"
                    value={goalCurrent}
                    onChange={(e) => setGoalCurrent(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold font-mono rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Орієнтовний термін / дедлайн</label>
                  <input
                    type="date"
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-bold font-mono rounded-xl outline-hidden border ${
                      isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                </div>

                {/* Submit target */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl font-extrabold text-xs tracking-wider bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center justify-center gap-1.5 uppercase cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>Запустити збір</>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </>
  );
}
