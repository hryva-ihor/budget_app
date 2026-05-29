import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Coins, 
  CreditCard, 
  Wallet, 
  PlusCircle, 
  Check, 
  X,
  AlertTriangle 
} from 'lucide-react';
import { Account, AccountType } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

interface AccountsProps {
  accounts: Account[];
  familyId: string;
  isDark: boolean;
}

export function Accounts({ accounts, familyId, isDark }: AccountsProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('card');
  const [currency, setCurrency] = useState<'UAH' | 'USD' | 'EUR'>('UAH');
  const [initialBalance, setInitialBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Введіть назву рахунку');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const accountId = `acc_${familyId}_${Date.now()}`;
      const newAccRef = doc(db, 'accounts', accountId);

      await setDoc(newAccRef, {
        id: accountId,
        familyId,
        name: name.trim(),
        type,
        currency,
        initialBalance: Number(initialBalance) || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Clear layout
      setName('');
      setType('card');
      setCurrency('UAH');
      setInitialBalance('');
      setIsOpenForm(false);
    } catch (err) {
      setErrorMessage('Сталася помилка створення рахунку.');
      handleFirestoreError(err, OperationType.WRITE, 'accounts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (accId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цей рахунок? Всі транзакції прив\'язані до нього можуть збитися.')) return;
    try {
      await deleteDoc(doc(db, 'accounts', accId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `accounts/${accId}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Варіанти збереження (Рахунки)
          </h2>
          <p className="text-xs text-neutral-400">
            Керуйте сімейними накопиченнями, готівкою та різними типами банківських карток.
          </p>
        </div>

        <button
          onClick={() => setIsOpenForm(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 hover:bg-opacity-90 transition-all font-semibold rounded-xl bg-indigo-500 text-white text-xs shadow-md cursor-pointer"
        >
          <Plus size={16} />
          Створити рахунок
        </button>
      </div>

      {/* Accounts List mapping */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.map((acc) => (
          <div 
            key={acc.id}
            className={`p-5 rounded-2xl border flex items-start gap-4 justify-between transition-all ${
              isDark 
                ? 'bg-neutral-900/40 border-neutral-800' 
                : 'bg-white border-neutral-200 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div className={`p-3 rounded-xl text-white ${
                acc.type === 'cash' 
                  ? 'bg-amber-500' 
                  : acc.type === 'card' 
                  ? 'bg-blue-500' 
                  : 'bg-teal-500'
              }`}>
                {acc.type === 'cash' ? <Coins size={20} /> : acc.type === 'card' ? <CreditCard size={20} /> : <Wallet size={20} />}
              </div>

              <div>
                <h4 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                  {acc.name}
                </h4>
                <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mt-0.5">
                  Тип: {acc.type === 'cash' ? 'Готівка' : acc.type === 'card' ? 'Картка' : 'Інший актив'}
                </p>
                <p className="text-[11px] text-neutral-400/80 mt-1">
                  Початковий баланс: {acc.initialBalance.toLocaleString('uk-UA')} {acc.currency === 'USD' ? '$' : acc.currency === 'EUR' ? '€' : '₴'}
                </p>
              </div>
            </div>

            {/* Actions list */}
            <button
              onClick={() => handleDelete(acc.id)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-neutral-600 hover:text-rose-500 hover:bg-neutral-800/80' : 'text-neutral-400 hover:text-rose-600 hover:bg-neutral-100'
              }`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* Advisory section */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 ${
        isDark ? 'bg-amber-500/5 border-amber-500/20 text-neutral-300' : 'bg-amber-500/5 border-amber-200 text-neutral-700'
      }`}>
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div>
          <p className="text-xs font-semibold">Важливе нагадування</p>
          <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">
            При додаванні транзакцій, баланс відповідного рахунку перераховується у реальному часі від значення початкового балансу. Всі внесені сюди зміни миттєво синхронізуються між пристроями вас та вашої дружини.
          </p>
        </div>
      </div>

      {/* Account creation dialog */}
      {isOpenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsOpenForm(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />

          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-xl ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
          }`}>
            
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                Створити новий рахунок збереження
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
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Назва рахунку*</label>
                <input
                  type="text"
                  placeholder="Наприклад: Картка Моно, Готівка Сейф, Заощадження"
                  value={name}
                  required
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Тип рахунку*</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                >
                  <option value="card">Картка</option>
                  <option value="cash">Готівка</option>
                  <option value="other">Інше (крипта, акції, депозити)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Валюта рахунку*</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'UAH' | 'USD' | 'EUR')}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                >
                  <option value="UAH">₴ UAH (Українська гривня)</option>
                  <option value="USD">$ USD (Долар США)</option>
                  <option value="EUR">€ EUR (Євро)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
                  Початковий баланс ({currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₴'})*
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                    isDark 
                      ? 'bg-neutral-950 border-neutral-800 text-white' 
                      : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                  }`}
                />
              </div>

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
                      Створити
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
