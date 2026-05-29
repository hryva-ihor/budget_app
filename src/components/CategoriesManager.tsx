import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Check, 
  X,
  PlusCircle
} from 'lucide-react';
import { Category, TransactionType } from '../types';
import { IconRenderer, AVAILABLE_ICONS, AVAILABLE_COLORS } from './IconRenderer';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

interface CategoriesManagerProps {
  categories: Category[];
  familyId: string;
  isDark: boolean;
}

export function CategoriesManager({ categories, familyId, isDark }: CategoriesManagerProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [icon, setIcon] = useState('ShoppingBag');
  const [color, setColor] = useState('#ef4444');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Введіть назву категорії');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const categoryId = `cat_${familyId}_${Date.now()}`;
      const newCatRef = doc(db, 'categories', categoryId);

      await setDoc(newCatRef, {
        id: categoryId,
        familyId,
        name: name.trim(),
        icon,
        color,
        type,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Reset
      setName('');
      setIcon('ShoppingBag');
      setColor('#ef4444');
      setIsOpenForm(false);
    } catch (err) {
      setErrorMessage('Сталася помилка створення категорії.');
      handleFirestoreError(err, OperationType.WRITE, 'categories');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (catId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цю категорію? Повязані транзакції залишаться без своєї назви.')) return;
    try {
      await deleteDoc(doc(db, 'categories', catId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${catId}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Категорії витрат та доходів
          </h2>
          <p className="text-xs text-neutral-400">
            Ви можете створювати будь-які власні категорії з унікальними назвами, іконками та кольорами.
          </p>
        </div>

        <button
          onClick={() => setIsOpenForm(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 hover:bg-opacity-90 transition-all font-semibold rounded-xl bg-indigo-500 text-white text-xs shadow-md cursor-pointer"
        >
          <Plus size={16} />
          Створити категорію
        </button>
      </div>

      {/* Grid List */}
      <div className="space-y-4">
        <div>
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Витрати (-)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.filter(c => c.type === 'expense').map(cat => (
              <div 
                key={cat.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                  isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div 
                    className="p-2 rounded-lg text-white shrink-0"
                    style={{ backgroundColor: cat.color }}
                  >
                    <IconRenderer name={cat.icon} size={15} />
                  </div>
                  <span className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                    {cat.name}
                  </span>
                </div>

                <button
                  onClick={() => handleDelete(cat.id)}
                  className={`p-1 rounded-lg hover:text-rose-500 hover:bg-neutral-500/10 transition-all cursor-pointer ${
                    isDark ? 'text-neutral-600' : 'text-neutral-400'
                  }`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <h3 className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Доходи (+)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.filter(c => c.type === 'income').map(cat => (
              <div 
                key={cat.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-2.5 transition-colors ${
                  isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div 
                    className="p-2 rounded-lg text-white shrink-0"
                    style={{ backgroundColor: cat.color }}
                  >
                    <IconRenderer name={cat.icon} size={15} />
                  </div>
                  <span className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                    {cat.name}
                  </span>
                </div>

                <button
                  onClick={() => handleDelete(cat.id)}
                  className={`p-1 rounded-lg hover:text-rose-500 hover:bg-neutral-500/10 transition-all cursor-pointer ${
                    isDark ? 'text-neutral-600' : 'text-neutral-400'
                  }`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Adding Modal */}
      {isOpenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsOpenForm(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />

          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-xl ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
          }`}>
            
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                Створити категорію операцій
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
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Назва категорії*</label>
                <input
                  type="text"
                  placeholder="Наприклад: Кафе дитяче, Бензин, Податки"
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

              {/* Type Switcher */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Тип бюджету</label>
                <div className="flex rounded-lg p-0.5 bg-neutral-200/50 dark:bg-neutral-950 border border-neutral-500/10">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 flex justify-center items-center gap-1 py-1.5 font-bold rounded-md text-[10px] transition-all cursor-pointer ${
                      type === 'expense'
                        ? 'bg-rose-500 text-white'
                        : 'text-neutral-400 hover:text-neutral-500'
                    }`}
                  >
                    Витрата (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 flex justify-center items-center gap-1 py-1.5 font-bold rounded-md text-[10px] transition-all cursor-pointer ${
                      type === 'income'
                        ? 'bg-emerald-500 text-white'
                        : 'text-neutral-400 hover:text-neutral-500'
                    }`}
                  >
                    Надходження (+)
                  </button>
                </div>
              </div>

              {/* Color list selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Колір візуалізації</label>
                <div className="flex flex-wrap gap-2.5 p-1">
                  {AVAILABLE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110 active:scale-95 cursor-pointer relative"
                      style={{ backgroundColor: c }}
                    >
                      {color === c && (
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                          <Check size={12} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icon Grid Picker */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Оберіть іконку</label>
                <div className="grid grid-cols-6 gap-2 max-h-[140px] overflow-y-auto p-1.5 border border-neutral-500/10 rounded-xl custom-scrollbar">
                  {AVAILABLE_ICONS.map(ic => (
                    <button
                      key={ic.name}
                      type="button"
                      onClick={() => setIcon(ic.name)}
                      className={`p-2 rounded-lg flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer ${
                        icon === ic.name 
                          ? 'bg-indigo-505 text-indigo-500 bg-indigo-500/10 border-indigo-500/20' 
                          : isDark ? 'bg-neutral-950 text-neutral-400' : 'bg-neutral-50 text-neutral-600'
                      }`}
                      title={ic.label}
                    >
                      <IconRenderer name={ic.name} size={15} />
                    </button>
                  ))}
                </div>
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
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
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
