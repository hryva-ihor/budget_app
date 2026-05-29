import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  Coins, 
  Target, 
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  RotateCcw,
  GripVertical
} from 'lucide-react';
import { Account, Transaction, Category, SavingGoal } from '../types';
import { IconRenderer } from './IconRenderer';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: SavingGoal[];
  isDark: boolean;
  setActiveTab?: (tab: any) => void;
}

export function Dashboard({ accounts, transactions, categories, goals, isDark, setActiveTab }: DashboardProps) {
  const [dashboardCurrency, setDashboardCurrency] = useState<'UAH' | 'USD' | 'EUR'>('UAH');
  
  // Widget rearrangeable layout states
  const DEFAULT_WIDGET_ORDER = ['balance', 'goals', 'stats', 'categories', 'recent'];
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_widget_order');
    return saved ? JSON.parse(saved) : DEFAULT_WIDGET_ORDER;
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<string | null>(null);

  // Drag and drop event handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWidget(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedWidget && draggedWidget !== id) {
      setDragOverWidget(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverWidget(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverWidget(null);
    if (!draggedWidget || draggedWidget === targetId) return;

    const sourceIndex = widgetOrder.indexOf(draggedWidget);
    const targetIndex = widgetOrder.indexOf(targetId);

    const updatedOrder = [...widgetOrder];
    updatedOrder[sourceIndex] = targetId;
    updatedOrder[targetIndex] = draggedWidget;

    setWidgetOrder(updatedOrder);
    localStorage.setItem('dashboard_widget_order', JSON.stringify(updatedOrder));
    setDraggedWidget(null);
  };
  
  // 1. Calculate balance for each account dynamically
  const accountBalances = useMemo(() => {
    return accounts.map(account => {
      let balance = account.initialBalance || 0;
      
      transactions.forEach(t => {
        if (t.accountId === account.id) {
          if (t.type === 'income') {
            balance += t.amount;
          } else {
            balance -= t.amount;
          }
        }
      });
      
      return {
        ...account,
        balance
      };
    });
  }, [accounts, transactions]);

  // 2. Compute category total assets summary separately for each currency
  const currencyTotals = useMemo(() => {
    const map = {
      UAH: { cash: 0, card: 0, other: 0, overall: 0 },
      USD: { cash: 0, card: 0, other: 0, overall: 0 },
      EUR: { cash: 0, card: 0, other: 0, overall: 0 }
    };

    accountBalances.forEach(acc => {
      const curr = (acc.currency || 'UAH') as 'UAH' | 'USD' | 'EUR';
      if (!map[curr]) {
        map[curr] = { cash: 0, card: 0, other: 0, overall: 0 };
      }
      if (acc.type === 'cash') map[curr].cash += acc.balance;
      else if (acc.type === 'card') map[curr].card += acc.balance;
      else map[curr].other += acc.balance;
    });

    (Object.keys(map) as Array<'UAH' | 'USD' | 'EUR'>).forEach(curr => {
      map[curr].overall = map[curr].cash + map[curr].card + map[curr].other;
    });

    return map;
  }, [accountBalances]);

  // 3. Compute dynamic expense summary by category (for active currency - no normalization, current month only)
  const expenseChartData = useMemo(() => {
    const expensesByCategory: Record<string, { id: string; name: string; value: number; color: string; count: number; icon: string }> = {};
    
    // Create mapping of categoryId to details
    const catMap = new Map<string, Category>();
    categories.forEach(c => catMap.set(c.id, c));

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    transactions.forEach(t => {
      if (t.type === 'expense') {
        if (t.isConversion) return; // skip internal conversions from statistics

        // Verify current month check
        const tDate = t.date instanceof Date ? t.date : (t.date?.toDate ? t.date.toDate() : new Date(t.date));
        if (tDate.getFullYear() !== curYear || tDate.getMonth() !== curMonth) {
          return;
        }

        const acc = accounts.find(a => a.id === t.accountId);
        const currency = t.currency || acc?.currency || 'UAH';

        // Only count matching currency
        if (currency !== dashboardCurrency) return;

        const cat = catMap.get(t.categoryId);
        const catId = t.categoryId || 'other';
        const catName = cat ? cat.name : 'Інше';
        const catColor = cat ? cat.color : '#6b7280';
        const catIcon = cat ? cat.icon : 'Sparkles';

        if (!expensesByCategory[catId]) {
          expensesByCategory[catId] = {
            id: catId,
            name: catName,
            value: 0,
            color: catColor,
            count: 0,
            icon: catIcon
          };
        }
        expensesByCategory[catId].value += t.amount;
        expensesByCategory[catId].count += 1;
      }
    });

    return Object.values(expensesByCategory).sort((a, b) => b.value - a.value);
  }, [transactions, categories, accounts, dashboardCurrency]);

  // 4. Monthly Statistics: Income vs Expenses (for active currency - no normalization, current month only)
  const monthlyStats = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    transactions.forEach(t => {
      if (t.isConversion) return; // skip internal conversions from statistics

      // Verify current month check
      const tDate = t.date instanceof Date ? t.date : (t.date?.toDate ? t.date.toDate() : new Date(t.date));
      if (tDate.getFullYear() !== curYear || tDate.getMonth() !== curMonth) {
        return;
      }

      const acc = accounts.find(a => a.id === t.accountId);
      const currency = t.currency || acc?.currency || 'UAH';

      // Only count matching currency
      if (currency !== dashboardCurrency) return;

      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
      }
    });

    return {
      totalIncome,
      totalExpense,
      netSavings: totalIncome - totalExpense
    };
  }, [transactions, accounts, dashboardCurrency]);

  // 5. Dynamic spent percentage indicator
  const spendPercentage = useMemo(() => {
    if (monthlyStats.totalIncome === 0) {
      return monthlyStats.totalExpense > 0 ? 100 : 0;
    }
    return Math.min(Math.round((monthlyStats.totalExpense / monthlyStats.totalIncome) * 100), 100);
  }, [monthlyStats]);

  // 6. Recent transactions
  const recentTransactions = useMemo(() => {
    const catMap = new Map<string, Category>();
    categories.forEach(c => catMap.set(c.id, c));
    const accMap = new Map<string, Account>();
    accounts.forEach(a => accMap.set(a.id, a));

    return [...transactions]
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : (a.date?.toDate ? a.date.toDate() : new Date(a.date));
        const dateB = b.date instanceof Date ? b.date : (b.date?.toDate ? b.date.toDate() : new Date(b.date));
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 4)
      .map(t => ({
        ...t,
        category: catMap.get(t.categoryId),
        account: accMap.get(t.accountId)
      }));
  }, [transactions, categories, accounts]);

  // SVG Circle stroke calculation (r=50 -> circumference = 314.16)
  const strokeCircumference = 314.16;
  const strokeDashoffset = strokeCircumference * (1 - spendPercentage / 100);

  // Time format
  const formatTxDateTime = (firebaseDate: any) => {
    const rawDate = firebaseDate instanceof Date 
      ? firebaseDate 
      : (firebaseDate?.toDate ? firebaseDate.toDate() : new Date(firebaseDate));
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = rawDate.toDateString() === today.toDateString();
    const isYesterday = rawDate.toDateString() === yesterday.toDateString();

    let prefix = '';
    if (isToday) prefix = 'Сьогодні';
    else if (isYesterday) prefix = 'Вчора';
    else prefix = rawDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

    return `${prefix}, ${rawDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Welcome & Dashboard Currency Switcher / Layout settings */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-lg font-extrabold tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Огляд Ваших фінансів
          </h2>
          <p className="text-[11px] text-neutral-400">
            Окремі баланси та деталізована статистика для кожної валюти.
          </p>
        </div>

        {/* Controls: Layout Customization and Currency Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Dynamic Drag-and-Drop Widget Layout Configurator */}
          <div className={`p-1 rounded-xl flex items-center gap-1 border ${
            isDark ? 'bg-neutral-950 border-neutral-800/80' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isEditMode 
                  ? (isDark ? 'bg-amber-600 text-white shadow-md' : 'bg-amber-500 text-white shadow-xs')
                  : (isDark ? 'text-neutral-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')
              }`}
              title="Пересунути або поміняти віджети місцями"
            >
              <Sliders size={12} className={isEditMode ? "animate-spin" : ""} />
              <span>{isEditMode ? 'Завершити' : 'Налаштувати вигляд'}</span>
            </button>

            {isEditMode && (
              <button
                onClick={() => {
                  setWidgetOrder(DEFAULT_WIDGET_ORDER);
                  localStorage.setItem('dashboard_widget_order', JSON.stringify(DEFAULT_WIDGET_ORDER));
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isDark ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10' : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                }`}
                title="Скинути віджети до початкового стану"
              >
                <RotateCcw size={12} />
                <span>Скинути</span>
              </button>
            )}
          </div>

          {/* Currency Switcher */}
          <div className={`p-1 rounded-xl flex items-center gap-1 border ${
            isDark ? 'bg-neutral-950 border-neutral-800/80' : 'bg-slate-100 border-slate-200'
          }`}>
            {(['UAH', 'USD', 'EUR'] as const).map((curr) => {
              const isActive = dashboardCurrency === curr;
              const hasAccounts = accounts.some(a => (a.currency || 'UAH') === curr);
              const currencySymbols = { UAH: '₴', USD: '$', EUR: '€' };
              return (
                <button
                  key={curr}
                  onClick={() => setDashboardCurrency(curr)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive 
                      ? (isDark ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-700 shadow-xs')
                      : (isDark ? 'text-neutral-400 hover:text-white' : 'text-slate-500 hover:text-slate-800')
                  }`}
                >
                  <span className="text-[10px] opacity-75">{currencySymbols[curr]}</span>
                  <span>{curr}</span>
                  {!hasAccounts && curr !== 'UAH' && (
                    <span className="text-[8px] opacity-50 px-1.5 py-0.2 bg-black/10 rounded-full font-normal">
                      0
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {widgetOrder.map((widgetId) => {
          const isDraggingThis = draggedWidget === widgetId;
          const isDragOverThis = dragOverWidget === widgetId;

          // Resolve responsive col span based on widget ID
          let colSpanClass = 'md:col-span-4';
          if (widgetId === 'balance') colSpanClass = 'md:col-span-4';
          else if (widgetId === 'goals') colSpanClass = 'md:col-span-5';
          else if (widgetId === 'stats') colSpanClass = 'md:col-span-3';
          else if (widgetId === 'categories') colSpanClass = 'md:col-span-7';
          else if (widgetId === 'recent') colSpanClass = 'md:col-span-5';

          return (
            <div
              key={widgetId}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, widgetId)}
              onDragOver={(e) => handleDragOver(e, widgetId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, widgetId)}
              className={`${colSpanClass} relative group transition-all duration-300 ${
                isDraggingThis ? 'opacity-35 scale-[0.97]' : 'opacity-100'
              } ${
                isDragOverThis 
                  ? 'ring-2 ring-dashed ring-teal-500 scale-[1.01] bg-teal-500/5' 
                  : ''
              } ${
                isEditMode ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-500/40 rounded-3xl' : ''
              }`}
            >
              {/* Drag Indicator Overlay for Layout settings */}
              {isEditMode && (
                <div className={`absolute top-3.5 right-3.5 z-40 p-1.5 rounded-xl border flex items-center gap-1 shadow-md backdrop-blur-md transition-all ${
                  isDark 
                    ? 'bg-neutral-900/95 border-neutral-800 text-neutral-400 group-hover:text-white' 
                    : 'bg-white/95 border-slate-200 text-slate-500 group-hover:text-slate-800'
                }`}>
                  <GripVertical size={12} className="text-teal-500 animate-pulse" />
                  <span className="text-[8px] font-extrabold uppercase tracking-widest select-none pr-0.5">Впорядкувати</span>
                </div>
              )}

              {/* Widget 1: Total Balance / Assets Summary */}
              {widgetId === 'balance' && (
                <div className={`w-full h-full rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between min-h-[220px] ${
                  isDark 
                    ? 'bg-neutral-900/60 border-neutral-800/80 shadow-md shadow-neutral-950/20' 
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold tracking-wider uppercase ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                        Баланс ({dashboardCurrency})
                      </span>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {dashboardCurrency === 'USD' ? '$ Долар' : dashboardCurrency === 'EUR' ? '€ Євро' : '₴ Гривня'}
                      </span>
                    </div>
                    <h2 className={`text-3xl font-extrabold tracking-tight mt-2 font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {currencyTotals[dashboardCurrency].overall.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {
                        dashboardCurrency === 'USD' ? '$' : dashboardCurrency === 'EUR' ? '€' : '₴'
                      }
                    </h2>
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                        <span className={isDark ? 'text-neutral-300' : 'text-slate-600'}>Картки</span>
                      </div>
                      <span className={`font-bold ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
                        {currencyTotals[dashboardCurrency].card.toLocaleString('uk-UA')} {dashboardCurrency === 'USD' ? '$' : dashboardCurrency === 'EUR' ? '€' : '₴'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                        <span className={isDark ? 'text-neutral-300' : 'text-slate-600'}>Готівка</span>
                      </div>
                      <span className={`font-bold ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
                        {currencyTotals[dashboardCurrency].cash.toLocaleString('uk-UA')} {dashboardCurrency === 'USD' ? '$' : dashboardCurrency === 'EUR' ? '€' : '₴'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                        <span className={isDark ? 'text-neutral-300' : 'text-slate-600'}>Інше</span>
                      </div>
                      <span className={`font-bold ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
                        {currencyTotals[dashboardCurrency].other.toLocaleString('uk-UA')} {dashboardCurrency === 'USD' ? '$' : dashboardCurrency === 'EUR' ? '€' : '₴'}
                      </span>
                    </div>
                  </div>

                  {/* Quick list of other balances to give full-visibility */}
                  <div className={`mt-3.5 pt-3 border-t flex items-center justify-between text-[10px] ${
                    isDark ? 'border-neutral-800/80 text-neutral-400' : 'border-slate-100 text-slate-500'
                  }`}>
                    <span className="font-semibold text-neutral-400">Інші валюти:</span>
                    <div className="flex items-center gap-2.5 font-bold">
                      {(['UAH', 'USD', 'EUR'] as const).filter(c => c !== dashboardCurrency).map(c => {
                        const total = currencyTotals[c].overall;
                        const symbol = c === 'USD' ? '$' : c === 'EUR' ? '€' : '₴';
                        return (
                          <span 
                            key={c} 
                            className="hover:underline cursor-pointer opacity-80 hover:opacity-100 flex items-center gap-0.5" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDashboardCurrency(c);
                            }}
                          >
                            <span>{symbol}</span>
                            <span>{total.toLocaleString('uk-UA')}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Widget 2: Savings Goals */}
              {widgetId === 'goals' && (
                <div className={`w-full h-full rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-between min-h-[220px] transition-all duration-300 ${
                  isDark 
                    ? 'bg-gradient-to-br from-indigo-950 to-indigo-900 border border-indigo-850/60' 
                    : 'bg-indigo-600 border border-indigo-700 shadow-md shadow-indigo-200/50'
                }`}>
                  <div className="relative z-10 flex-grow">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold tracking-wide uppercase text-indigo-200 flex items-center gap-1.5 font-display">
                        <Target size={14} />
                        Спільні цілі
                      </h3>
                      <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">
                        {goals.length} активні
                      </span>
                    </div>

                    {goals.length > 0 ? (
                      <div className="space-y-4 max-h-[140px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {goals.slice(0, 2).map((goal) => {
                          const percentage = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
                          return (
                            <div key={goal.id} className="space-y-1.5">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className="truncate max-w-[170px]">{goal.name}</span>
                                <span>{percentage}%</span>
                              </div>
                              <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                              </div>
                              <p className="text-[10px] text-indigo-100 flex justify-between">
                                <span>{goal.currentAmount.toLocaleString('uk-UA')} / {goal.targetAmount.toLocaleString('uk-UA')} ₴</span>
                                <span className="opacity-70">До: {goal.deadline}</span>
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-[120px] flex flex-col items-center justify-center text-center">
                        <Sparkles size={24} className="text-indigo-200 mb-1 animate-pulse" />
                        <p className="text-xs text-indigo-100">Поки немає активних цілей</p>
                        <p className="text-[10px] text-indigo-200/80 mt-1">Додайте цілі у відповідному розділі</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="absolute -right-6 -bottom-6 opacity-10">
                    <svg width="140" height="140" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                </div>
              )}

              {/* Widget 3: Quick Stats Circle */}
              {widgetId === 'stats' && (
                <div className={`w-full h-full rounded-3xl p-6 border transition-all duration-300 flex flex-col items-center justify-center text-center min-h-[220px] ${
                  isDark 
                    ? 'bg-neutral-900/60 border-neutral-800/80 shadow-md shadow-neutral-950/20' 
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                      {/* Outer gauge circle */}
                      <circle cx="60" cy="60" r="50" stroke={isDark ? "#262626" : "#f1f5f9"} strokeWidth="10" fill="transparent" />
                      {/* Colored active fill circle */}
                      <circle 
                        cx="60" 
                        cy="60" 
                        r="50" 
                        stroke="#e11d48" 
                        strokeWidth="10" 
                        strokeDasharray={`${strokeCircumference}`} 
                        strokeDashoffset={strokeDashoffset} 
                        fill="transparent" 
                        strokeLinecap="round" 
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className={`text-2xl font-extrabold font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>{spendPercentage}%</span>
                      <span className={`text-[8px] uppercase font-bold tracking-wider ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>Витрачено</span>
                    </div>
                  </div>
                  
                  <p className={`mt-3 text-[10px] font-medium leading-relaxed px-1 ${isDark ? 'text-neutral-400' : 'text-slate-500'}`}>
                    {monthlyStats.totalExpense > 0 ? (
                      <>Ви використали {monthlyStats.totalExpense.toLocaleString('uk-UA')} {dashboardCurrency === 'USD' ? '$' : dashboardCurrency === 'EUR' ? '€' : '₴'} із загальних надходжень {monthlyStats.totalIncome.toLocaleString('uk-UA')} {dashboardCurrency === 'USD' ? '$' : dashboardCurrency === 'EUR' ? '€' : '₴'} за цей місяць у вибраній валюті ({dashboardCurrency}).</>
                    ) : (
                      <>Надходження та витрати збалансовані. Додайте транзакції у вибраній валюті ({dashboardCurrency}) за цей місяць для побудови графіка.</>
                    )}
                  </p>
                </div>
              )}

              {/* Widget 4: Category Analysis Grid */}
              {widgetId === 'categories' && (
                <div className={`w-full h-full rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between min-h-[340px] ${
                  isDark 
                    ? 'bg-neutral-900/60 border-neutral-800/80 shadow-md shadow-neutral-950/20' 
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className={`text-sm font-bold tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Витрати за категоріями
                      </h3>
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-md">
                        Цей місяць LIVE
                      </span>
                    </div>

                    {expenseChartData.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                        {expenseChartData.map((entry) => (
                          <div 
                            key={entry.id} 
                            className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${
                              isDark ? 'bg-neutral-950/50 border-neutral-850/60' : 'bg-slate-50 border-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div 
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                                style={{ backgroundColor: entry.color }}
                              >
                                <IconRenderer name={entry.icon} size={15} />
                              </div>
                              <div className="min-w-0">
                                <div className={`text-xs font-bold truncate ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
                                  {entry.name}
                                </div>
                                <div className="text-[9px] text-neutral-400 mt-0.5 font-medium">
                                  {entry.count} {entry.count === 1 ? 'операція' : entry.count < 5 ? 'операції' : 'операцій'}
                                </div>
                              </div>
                            </div>
                            <div className={`text-xs font-bold font-mono shrink-0 pl-1 ${isDark ? 'text-neutral-100' : 'text-slate-900'}`}>
                              {entry.value.toLocaleString('uk-UA')} {dashboardCurrency === 'USD' ? '$' : dashboardCurrency === 'EUR' ? '€' : '₴'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-[200px] flex flex-col items-center justify-center text-center">
                        <div className="p-3 bg-neutral-500/15 text-indigo-500 rounded-full mb-2">
                          <Sparkles size={24} />
                        </div>
                        <p className="text-xs text-neutral-400">Поки що немає витрат у базі даних.</p>
                        <p className="text-[10px] text-neutral-400/75 mt-1">Додайте нову витрату в розділі Транзакцій.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Widget 5: Recent Transactions */}
              {widgetId === 'recent' && (
                <div className={`w-full h-full rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between min-h-[340px] ${
                  isDark 
                    ? 'bg-neutral-900/60 border-neutral-800/80 shadow-md shadow-neutral-950/20' 
                    : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  <div className="w-full flex-grow flex flex-col justify-between">
                    <div>
                      <h3 className={`text-sm font-bold tracking-tight font-display mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        Останні операції
                      </h3>

                      {recentTransactions.length > 0 ? (
                        <div className="space-y-3">
                          {recentTransactions.map((t) => {
                            const isIncome = t.type === 'income';
                            return (
                              <div 
                                key={t.id} 
                                className={`flex items-center justify-between pb-3 border-b last:border-0 last:pb-0 ${
                                  isDark ? 'border-neutral-800/50' : 'border-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div 
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 font-bold text-[10px] shadow-xs"
                                    style={{ backgroundColor: t.category?.color || '#a3a3a3' }}
                                  >
                                    <IconRenderer name={t.category?.icon || 'Coins'} size={15} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className={`text-xs font-bold truncate ${isDark ? 'text-neutral-200' : 'text-slate-800'}`}>
                                      {t.category?.name || 'Інше'}
                                    </div>
                                    <div className="text-[9px] text-neutral-400 mt-0.5 font-medium truncate max-w-[150px]">
                                      {formatTxDateTime(t.date)} • {t.account?.name || 'Рахунок'}
                                    </div>
                                  </div>
                                </div>

                                <div className={`text-xs font-extrabold font-mono shrink-0 pl-2 ${
                                  isIncome ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                  {isIncome ? '+' : '-'}{t.amount.toLocaleString('uk-UA')} {t.currency === 'USD' ? '$' : t.currency === 'EUR' ? '€' : '₴'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-[180px] flex flex-col items-center justify-center text-center">
                          <div className="p-3 bg-neutral-500/15 text-indigo-500 rounded-full mb-2">
                            <Coins size={22} />
                          </div>
                          <p className="text-xs text-neutral-400">Нічого не додано.</p>
                          <p className="text-[10px] text-neutral-400/80 mt-1">Всі останні операції відобразяться тут.</p>
                        </div>
                      )}
                    </div>

                    {setActiveTab && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('transactions');
                        }}
                        className={`w-full mt-4 py-2.5 rounded-xl text-xs font-extrabold transition-all uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer ${
                          isDark 
                            ? 'bg-neutral-950 text-indigo-400 hover:bg-neutral-900 border border-neutral-800/60' 
                            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                        }`}
                      >
                        <span>Переглянути всю історію</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Real-time Accounts state section below Bento */}
      <div className="space-y-4 pt-1">
        <h3 className={`text-sm font-extrabold tracking-tight font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Стан Ваших рахунків у реальному часі
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {accountBalances.map((acc) => {
            const isNegative = acc.balance < 0;
            return (
              <div 
                key={acc.id}
                className={`p-4.5 rounded-2xl border flex items-center gap-3.5 transition-all bento-card ${
                  isDark 
                    ? 'bg-neutral-900/30 border-neutral-800/80 hover:bg-neutral-900/50' 
                    : 'bg-white border-slate-200/85 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${
                  acc.type === 'cash' 
                    ? 'bg-amber-500/10 text-amber-500' 
                    : acc.type === 'card'
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-teal-500/10 text-teal-500'
                }`}>
                  {acc.type === 'cash' ? <Coins size={18} /> : acc.type === 'card' ? <CreditCard size={18} /> : <Wallet size={18} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {acc.name}
                  </p>
                  <p className="text-[10px] capitalize text-neutral-400 font-semibold">
                    {acc.type === 'cash' ? 'Готівка' : acc.type === 'card' ? 'Картка' : 'Інше'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className={`text-xs font-mono font-extrabold tracking-tight ${
                    isNegative ? 'text-rose-500' : 'text-indigo-500'
                  }`}>
                    {acc.balance.toLocaleString('uk-UA')} {acc.currency === 'USD' ? '$' : acc.currency === 'EUR' ? '€' : '₴'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
