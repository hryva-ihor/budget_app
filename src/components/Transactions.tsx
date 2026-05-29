import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Filter, 
  Calendar as CalendarIcon, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  X,
  CreditCard,
  Check,
  ArrowRightLeft,
  RefreshCw
} from 'lucide-react';
import { Account, Transaction, Category } from '../types';
import { IconRenderer } from './IconRenderer';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

interface TransactionsProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  familyId: string;
  isDark: boolean;
}

export function Transactions({ accounts, transactions, categories, familyId, isDark }: TransactionsProps) {
  // Modal visibility
  const [isOpenForm, setIsOpenForm] = useState(false);

  // Form states
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Exchange/Conversion form states
  const [isOpenExchangeForm, setIsOpenExchangeForm] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [sourceAmount, setSourceAmount] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [rateIsManual, setRateIsManual] = useState(false);
  const [isExchanging, setIsExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState('');

  // Filtering states
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all'); // all, expense, income
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Default dropdown selections on load
  React.useEffect(() => {
    if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts]);

  // Set default category according to chosen type (expense vs income)
  React.useEffect(() => {
    const filteredCats = categories.filter(c => c.type === type);
    if (filteredCats.length > 0) {
      setCategoryId(filteredCats[0].id);
    } else {
      setCategoryId('');
    }
  }, [type, categories]);

  // Set default exchange accounts
  React.useEffect(() => {
    if (accounts.length > 0) {
      if (!fromAccountId) {
        setFromAccountId(accounts[0].id);
      }
      if (!toAccountId) {
        if (accounts.length > 1) {
          setToAccountId(accounts[1].id);
        } else {
          setToAccountId(accounts[0].id);
        }
      }
    }
  }, [accounts, fromAccountId, toAccountId]);

  // Handle dynamic conversion calculations
  React.useEffect(() => {
    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);
    if (!fromAcc || !toAcc || rateIsManual) return;

    const fromCurr = fromAcc.currency || 'UAH';
    const toCurr = toAcc.currency || 'UAH';

    if (fromCurr === toCurr) {
      setCustomRate('1');
      if (sourceAmount) {
        setTargetAmount(sourceAmount);
      }
      return;
    }

    // Default rates
    let rate = 1;
    if (fromCurr === 'UAH' && toCurr === 'USD') rate = 1 / 41.0;
    else if (fromCurr === 'USD' && toCurr === 'UAH') rate = 41.0;
    else if (fromCurr === 'UAH' && toCurr === 'EUR') rate = 1 / 44.0;
    else if (fromCurr === 'EUR' && toCurr === 'UAH') rate = 44.0;
    else if (fromCurr === 'USD' && toCurr === 'EUR') rate = 1 / 1.08;
    else if (fromCurr === 'EUR' && toCurr === 'USD') rate = 1.08;

    setCustomRate(rate.toFixed(4));
    if (sourceAmount) {
      const calculated = Number(sourceAmount) * rate;
      setTargetAmount(calculated.toFixed(2));
    } else {
      setTargetAmount('');
    }
  }, [fromAccountId, toAccountId, sourceAmount, rateIsManual, accounts]);

  // Filtered transactions list compilation
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Account filter
      if (filterAccount !== 'all' && t.accountId !== filterAccount) return false;
      
      // 2. Category filter
      if (filterCategory !== 'all' && t.categoryId !== filterCategory) return false;
      
      // 3. Type filter
      if (filterType !== 'all' && t.type !== filterType) return false;
      
      // 4. Date ranges
      if (startDate) {
        const transDate = t.date instanceof Date ? t.date : (t.date?.toDate ? t.date.toDate() : new Date(t.date));
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (transDate < sDate) return false;
      }
      if (endDate) {
        const transDate = t.date instanceof Date ? t.date : (t.date?.toDate ? t.date.toDate() : new Date(t.date));
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        if (transDate > eDate) return false;
      }
      
      // 5. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!t.description.toLowerCase().includes(query)) return false;
      }
      
      return true;
    }).sort((a, b) => {
      // Sort newest first
      const dateA = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
      const dateB = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
      return dateB.getTime() - dateA.getTime();
    });
  }, [transactions, filterAccount, filterCategory, filterType, startDate, endDate, searchQuery]);

  // Handles adding transaction with full database security standards
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setErrorMessage('Введіть коректну суму операції');
      return;
    }
    if (!accountId) {
      setErrorMessage('Оберіть рахунок збереження');
      return;
    }
    if (!categoryId) {
      setErrorMessage('Оберіть категорію');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const selectedAcc = accounts.find(a => a.id === accountId);
      const txCurrency = selectedAcc?.currency || 'UAH';

      const transactionId = `tx_${familyId}_${Date.now()}`;
      const payloadDate = new Date(dateStr);
      payloadDate.setHours(12, 0, 0, 0); // avoid offset timezone drift

      const newTxRef = doc(db, 'transactions', transactionId);
      await setDoc(newTxRef, {
        id: transactionId,
        familyId,
        accountId,
        categoryId,
        amount: Number(amount),
        type,
        currency: txCurrency,
        description: description.trim() || 'Без опису',
        date: Timestamp.fromDate(payloadDate),
        createdBy: auth.currentUser?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Clear fields and close
      setAmount('');
      setDescription('');
      setDateStr(new Date().toISOString().split('T')[0]);
      setIsOpenForm(false);
    } catch (err) {
      setErrorMessage('Помилка авторизації бази даних.');
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handles currency exchange submission
  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId) {
      setExchangeError('Оберіть обидва рахунки');
      return;
    }
    if (fromAccountId === toAccountId) {
      setExchangeError('Оберіть різні рахунки для обміну');
      return;
    }
    const srcAmt = Number(sourceAmount);
    const dstAmt = Number(targetAmount);
    const rateVal = Number(customRate);

    if (!srcAmt || srcAmt <= 0 || !dstAmt || dstAmt <= 0) {
      setExchangeError('Введіть коректні суми операції');
      return;
    }

    setIsExchanging(true);
    setExchangeError('');

    try {
      const fromAcc = accounts.find(a => a.id === fromAccountId)!;
      const toAcc = accounts.find(a => a.id === toAccountId)!;
      const fromCurr = fromAcc.currency || 'UAH';
      const toCurr = toAcc.currency || 'UAH';

      const parentTxId = `tx_${familyId}_conv_src_${Date.now()}`;
      const childTxId = `tx_${familyId}_conv_dst_${Date.now()}`;
      
      const payloadDate = new Date(dateStr);
      payloadDate.setHours(12, 0, 0, 0); // avoid offset timezone drift

      // Search for Category 'Інші витрати' (or any expense) & 'Активи / Спільно' (or any income)
      const expenseCat = categories.find(c => c.type === 'expense' && c.name.toLowerCase().includes('конверт')) ||
                         categories.find(c => c.type === 'expense' && c.name.toLowerCase().includes('інші')) ||
                         categories.find(c => c.type === 'expense') || 
                         { id: 'cat_default_expense' };

      const incomeCat = categories.find(c => c.type === 'income' && c.name.toLowerCase().includes('конверт')) ||
                        categories.find(c => c.type === 'income' && c.name.toLowerCase().includes('активи')) ||
                        categories.find(c => c.type === 'income') || 
                        { id: 'cat_default_income' };

      // 1. Create the outward/expense transaction
      await setDoc(doc(db, 'transactions', parentTxId), {
        id: parentTxId,
        familyId,
        accountId: fromAccountId,
        categoryId: expenseCat.id,
        amount: srcAmt,
        type: 'expense',
        description: `Конвертація валюти: ${fromCurr} ➔ ${toCurr} (на рахунок ${toAcc.name})`,
        currency: fromCurr,
        isConversion: true,
        conversionPairId: childTxId,
        targetAccountId: toAccountId,
        exchangeRate: rateVal,
        convertedAmount: dstAmt,
        createdBy: auth.currentUser?.uid || '',
        date: Timestamp.fromDate(payloadDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Create the inward/income transaction
      await setDoc(doc(db, 'transactions', childTxId), {
        id: childTxId,
        familyId,
        accountId: toAccountId,
        categoryId: incomeCat.id,
        amount: dstAmt,
        type: 'income',
        description: `Конвертація валюти: отримано від ${fromAcc.name} за курсом ${rateVal.toFixed(4)}`,
        currency: toCurr,
        isConversion: true,
        conversionPairId: parentTxId,
        targetAccountId: fromAccountId,
        exchangeRate: rateVal,
        convertedAmount: srcAmt,
        createdBy: auth.currentUser?.uid || '',
        date: Timestamp.fromDate(payloadDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Reset exchange panel
      setSourceAmount('');
      setTargetAmount('');
      setRateIsManual(false);
      setIsOpenExchangeForm(false);
    } catch (err) {
      setExchangeError('Помилка під час конвертації валют.');
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    } finally {
      setIsExchanging(false);
    }
  };

  // Handles deletion
  const handleDelete = async (txId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цю транзакцію?')) return;
    try {
      const targetTx = transactions.find(t => t.id === txId);
      await deleteDoc(doc(db, 'transactions', txId));

      if (targetTx && targetTx.isConversion && targetTx.conversionPairId) {
        // Delete matched conversion leg
        await deleteDoc(doc(db, 'transactions', targetTx.conversionPairId));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `transactions/${txId}`);
    }
  };

  // Mapping details
  const accountsMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Date format localized
  const formatTxDate = (firebaseDate: any) => {
    const rawDate = firebaseDate instanceof Date 
      ? firebaseDate 
      : (firebaseDate?.toDate ? firebaseDate.toDate() : new Date(firebaseDate));
    return rawDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Helper to resolve creator initials and displayName
  const getCreatorInitialsAndName = (createdBy?: string) => {
    const currentUid = auth.currentUser?.uid;
    const currentName = auth.currentUser?.displayName || 'Я';
    
    if (!createdBy) {
      return { initials: 'ВИ', name: 'Ви' };
    }
    
    if (createdBy === currentUid) {
      const parts = currentName.trim().split(/\s+/);
      const initials = parts.map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'ВИ';
      return { initials, name: 'Ви' };
    }
    
    return { initials: 'ІС', name: 'Інеса Степанова' };
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Filtering & Quick Adder Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Транзакції спільних бюджетів
          </h2>
          <p className="text-xs text-neutral-400">
            Знайдено {filteredTransactions.length} операцій
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsOpenExchangeForm(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 hover:bg-teal-700 transition-all font-semibold rounded-xl bg-teal-600 text-white text-xs shadow-md shadow-teal-500/10 cursor-pointer"
          >
            <ArrowRightLeft size={14} />
            Конвертувати валюту
          </button>

          <button
            onClick={() => setIsOpenForm(true)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 hover:bg-opacity-90 transition-all font-semibold rounded-xl bg-indigo-500 text-white text-xs shadow-md shadow-indigo-500/10 cursor-pointer"
          >
            <Plus size={16} />
            Додати транзакцію
          </button>
        </div>
      </div>

      {/* 2. Interactive Filtering controls */}
      <div className={`p-4 rounded-xl border space-y-4 ${
        isDark ? 'bg-neutral-900/30 border-neutral-800/80' : 'bg-white border-neutral-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400">
          <Filter size={14} />
          <span>Фільтри та сортування операцій</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Searching */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Пошук опису</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 text-neutral-400" size={14} />
              <input
                type="text"
                placeholder="Введіть ключове слово..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full py-1.5 pl-8 pr-3 rounded-lg border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                  isDark 
                    ? 'bg-neutral-950 border-neutral-800 text-white' 
                    : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                }`}
              />
            </div>
          </div>

          {/* Filter by target type */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Тип операції</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                isDark 
                  ? 'bg-neutral-950 border-neutral-800 text-white' 
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900'
              }`}
            >
              <option value="all">Усі (витрати й надходження)</option>
              <option value="expense">Лише Витрати (-)</option>
              <option value="income">Лише Надходження (+)</option>
            </select>
          </div>

          {/* Account Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">За рахунком</label>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                isDark 
                  ? 'bg-neutral-950 border-neutral-800 text-white' 
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900'
              }`}
            >
              <option value="all">Усі збереження</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* Categories Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Категорія</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                isDark 
                  ? 'bg-neutral-950 border-neutral-800 text-white' 
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900'
              }`}
            >
              <option value="all">Усі категорії</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.type === 'income' ? '➕' : '➖'} {cat.name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Date Ranges filters picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-neutral-500/10">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Початкова дата</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs outline-none ${
                isDark 
                  ? 'bg-neutral-950 border-neutral-800 text-white' 
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900'
              }`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Кінцева дата</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs outline-none ${
                isDark 
                  ? 'bg-neutral-950 border-neutral-800 text-white' 
                  : 'bg-neutral-50 border-neutral-300 text-neutral-900'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 3. Transaction Lists Grid */}
      <div className="space-y-3">
        {filteredTransactions.length > 0 ? (
          <div className="overflow-hidden border border-neutral-500/10 rounded-xl divide-y divide-neutral-500/10">
            {filteredTransactions.map(t => {
              const account = accountsMap.get(t.accountId);
              const category = categoriesMap.get(t.categoryId);

              return (
                <div 
                  key={t.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    isDark 
                      ? 'bg-neutral-900/10 hover:bg-neutral-900/30' 
                      : 'bg-white hover:bg-neutral-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Category styled Icon container */}
                    {t.isConversion ? (
                      <div className="p-2.5 rounded-xl text-white shrink-0 bg-teal-600">
                        <ArrowRightLeft size={18} />
                      </div>
                    ) : (
                      <div 
                        className="p-2.5 rounded-xl text-white shrink-0"
                        style={{ backgroundColor: category?.color || '#6b7280' }}
                      >
                        <IconRenderer name={category?.icon || 'CircleHelp'} size={18} />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${
                        isDark ? 'text-white' : 'text-neutral-900'
                      }`}>
                        {t.isConversion ? 'Обмін валюти' : (category?.name || 'Видалена категорія')}
                      </p>
                      <p className="text-[10px] text-neutral-400 truncate max-w-[200px] sm:max-w-md mt-0.5">
                        {t.description}
                      </p>
                      
                      {/* Asset associated tag */}
                      <span className={`inline-block text-[8px] tracking-wide uppercase px-1.5 py-0.5 rounded-md font-bold mt-1.5 ${
                        isDark 
                          ? 'bg-neutral-800 text-neutral-300 border border-neutral-700/50' 
                          : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                      }`}>
                        {account?.name || 'Невідомий рахунок'} ({t.currency || account?.currency || 'UAH'})
                      </span>
                    </div>
                  </div>

                  {/* Operational values and Delete */}
                  <div className="flex items-center gap-4">
                    {/* User initials indicator */}
                    {(() => {
                      const creator = getCreatorInitialsAndName(t.createdBy);
                      return (
                        <div 
                          title={`Додав/ла: ${creator.name}`}
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[8px] tracking-wider shrink-0 border uppercase cursor-help select-none ${
                            creator.initials === 'ІС' || creator.name === 'Інеса Степанова'
                              ? (isDark ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/20' : 'bg-indigo-100 text-indigo-700 border-indigo-200 font-semibold')
                              : (isDark ? 'bg-neutral-850/85 text-neutral-300 border-neutral-700' : 'bg-neutral-100 text-neutral-600 border-neutral-200')
                          }`}
                        >
                          {creator.initials}
                        </div>
                      );
                    })()}

                    <div className="text-right">
                      <p className={`text-xs font-mono font-bold tracking-tight ${
                        t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString('uk-UA')} {t.currency === 'USD' ? '$' : t.currency === 'EUR' ? '€' : '₴'}
                      </p>
                      <p className="text-[9px] text-neutral-400 mt-1">
                        {formatTxDate(t.date)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleDelete(t.id)}
                      className={`p-1.5 hover:text-rose-500/90 rounded-lg transition-colors cursor-pointer ${
                        isDark ? 'text-neutral-600 hover:bg-neutral-800/60' : 'text-neutral-400 hover:bg-neutral-100'
                      }`}
                      title="Видалити"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className={`p-8 text-center rounded-xl border border-dashed ${
            isDark ? 'border-neutral-800 bg-neutral-900/10' : 'border-neutral-300 bg-neutral-50/50'
          }`}>
            <p className="text-xs text-neutral-400">Жодної транзакції за обраними фільтрами не знайдено.</p>
          </div>
        )}
      </div>

      {/* 4. Transactions Adding Modal dialog */}
      {isOpenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop screen */}
          <div 
            onClick={() => setIsOpenForm(false)} 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />

          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-xl ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
          }`}>
            
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold tracking-tight ${
                isDark ? 'text-white' : 'text-neutral-900'
              }`}>
                Нова фінансова операція
              </h3>
              <button 
                onClick={() => setIsOpenForm(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
              >
                <X size={16} />
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg mb-4 bg-rose-500/15 border border-rose-500/30 text-rose-500 text-[10px] font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Selector Type: Expense or Income */}
              <div className="flex rounded-lg p-0.5 bg-neutral-200/50 dark:bg-neutral-950 border border-neutral-500/10">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 flex justify-center items-center gap-1 py-1.5 font-bold rounded-md text-[10px] transition-all cursor-pointer ${
                    type === 'expense'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-500'
                  }`}
                >
                  <TrendingDown size={12} />
                  Витрата (-)
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 flex justify-center items-center gap-1 py-1.5 font-bold rounded-md text-[10px] transition-all cursor-pointer ${
                    type === 'income'
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-500'
                  }`}
                >
                  <TrendingUp size={12} />
                  Надходження (+)
                </button>
              </div>

              {/* Amount form input */}
              {(() => {
                const activeFormAcc = accounts.find(a => a.id === accountId);
                const activeCurrencySymbol = activeFormAcc?.currency === 'USD' ? '$' : activeFormAcc?.currency === 'EUR' ? '€' : '₴';
                return (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Сума ({activeCurrencySymbol})*</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="0.01"
                      required
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-white' 
                          : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                      }`}
                    />
                  </div>
                );
              })()}

              {/* Account Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Рахунок збереження*</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  required
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.type})</option>
                  ))}
                </select>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Категорія*</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                >
                  <option value="" disabled>Оберіть категорію...</option>
                  {categories.filter(c => c.type === type).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Дата операції*</label>
                <input
                  type="date"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                />
              </div>

              {/* Short description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Опис / коментар</label>
                <input
                  type="text"
                  placeholder="Наприклад: сільпо, комуналка, подарунок"
                  value={description}
                  maxLength={150}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenForm(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                    isDark 
                      ? 'border-neutral-850 hover:bg-neutral-800 text-neutral-300' 
                      : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
                  } transition-colors cursor-pointer`}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  {isSubmitting ? 'Збереження...' : (
                    <>
                      <Check size={14} />
                      Зберегти
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 5. Currency Converter Form Modal */}
      {isOpenExchangeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setIsOpenExchangeForm(false)} 
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
          />

          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-xl ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
          }`}>
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500">
                  <ArrowRightLeft size={16} />
                </div>
                <h3 className={`text-sm font-bold tracking-tight ${
                  isDark ? 'text-white' : 'text-neutral-900'
                }`}>
                  Конвертація / Обмін валют
                </h3>
              </div>
              <button 
                onClick={() => setIsOpenExchangeForm(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
              >
                <X size={16} />
              </button>
            </div>

            {exchangeError && (
              <div className="p-2.5 rounded-lg mb-4 bg-rose-500/15 border border-rose-500/30 text-rose-500 text-[10px] font-medium">
                {exchangeError}
              </div>
            )}

            <form onSubmit={handleExchangeSubmit} className="space-y-4">
              
              {/* Account списання */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Списати з рахунку (Джерело)*</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => {
                    setFromAccountId(e.target.value);
                    setRateIsManual(false);
                  }}
                  required
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency || 'UAH'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Account зарахування */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Зарахувати на рахунок (Отримувач)*</label>
                <select
                  value={toAccountId}
                  onChange={(e) => {
                    setToAccountId(e.target.value);
                    setRateIsManual(false);
                  }}
                  required
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency || 'UAH'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Amount */}
              <div className="space-y-1">
                {(() => {
                  const fromAcc = accounts.find(a => a.id === fromAccountId);
                  const symbol = fromAcc?.currency === 'USD' ? '$' : fromAcc?.currency === 'EUR' ? '€' : '₴';
                  return (
                    <>
                      <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                        Сума до списання ({symbol})*
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        required
                        min="0.01"
                        value={sourceAmount}
                        onChange={(e) => setSourceAmount(e.target.value)}
                        className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                          isDark 
                            ? 'bg-neutral-950 border-neutral-800 text-white' 
                            : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                        }`}
                      />
                    </>
                  );
                })()}
              </div>

              {/* Exchange Rate */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                    Курс обміну
                  </label>
                  {rateIsManual && (
                    <button 
                      type="button" 
                      onClick={() => setRateIsManual(false)} 
                      className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
                    >
                      Скинути на стандартний
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="Введіть курс..."
                  step="0.0001"
                  required
                  min="0.0001"
                  value={customRate}
                  onChange={(e) => {
                    setCustomRate(e.target.value);
                    setRateIsManual(true);
                    if (sourceAmount && e.target.value) {
                      const calculated = Number(sourceAmount) * Number(e.target.value);
                      setTargetAmount(calculated.toFixed(2));
                    }
                  }}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                />
              </div>

              {/* Target Amount */}
              <div className="space-y-1">
                {(() => {
                  const toAcc = accounts.find(a => a.id === toAccountId);
                  const symbol = toAcc?.currency === 'USD' ? '$' : toAcc?.currency === 'EUR' ? '€' : '₴';
                  return (
                    <>
                      <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                        Сума до зарахування ({symbol})*
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        required
                        min="0.01"
                        value={targetAmount}
                        onChange={(e) => {
                          setTargetAmount(e.target.value);
                          if (sourceAmount && Number(sourceAmount) > 0) {
                            const calRate = Number(e.target.value) / Number(sourceAmount);
                            setCustomRate(calRate.toFixed(4));
                            setRateIsManual(true);
                          }
                        }}
                        className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                          isDark 
                            ? 'bg-neutral-950 border-neutral-800 text-white' 
                            : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                        }`}
                      />
                    </>
                  );
                })()}
              </div>

              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Дата конвертації*</label>
                <input
                  type="date"
                  required
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                />
              </div>

              {/* Help Tip */}
              <div className="p-2.5 rounded-lg text-[9px] leading-relaxed text-neutral-400 bg-teal-500/5 border border-teal-500/10">
                Калькулятор конвертує валюти за типовим або вашим власним курсом. Після натискання кнопки «Конвертувати» буде створено дві зв’язані транзакції в історії (списання та зарахування), що збалансують рахунки.
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpenExchangeForm(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                    isDark 
                      ? 'border-neutral-850 hover:bg-neutral-800 text-neutral-300' 
                      : 'border-neutral-300 hover:bg-neutral-100 text-neutral-700'
                  } transition-colors cursor-pointer`}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  disabled={isExchanging}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  {isExchanging ? 'Конвертація...' : (
                    <>
                      <Check size={14} />
                      Конвертувати
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
