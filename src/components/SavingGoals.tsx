import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Check, 
  X,
  Target,
  Sparkles,
  Award
} from 'lucide-react';
import { SavingGoal } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';

interface SavingGoalsProps {
  goals: SavingGoal[];
  familyId: string;
  isDark: boolean;
}

export function SavingGoals({ goals, familyId, isDark }: SavingGoalsProps) {
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Save quick progress increment states
  const [activeAdjustGoalId, setActiveAdjustGoalId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Введіть назву цілі');
      return;
    }
    if (!targetAmount || Number(targetAmount) <= 0) {
      setErrorMessage('Введіть коректну цільову суму');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const goalId = `goal_${familyId}_${Date.now()}`;
      const newGoalRef = doc(db, 'goals', goalId);

      await setDoc(newGoalRef, {
        id: goalId,
        familyId,
        name: name.trim(),
        targetAmount: Number(targetAmount),
        currentAmount: Number(currentAmount) || 0,
        deadline: deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Clear layout
      setName('');
      setTargetAmount('');
      setCurrentAmount('');
      setDeadline('');
      setIsOpenForm(false);
    } catch (err) {
      setErrorMessage('Сталася помилка створення цілі.');
      handleFirestoreError(err, OperationType.WRITE, 'goals');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustProgress = async (goal: SavingGoal) => {
    if (!adjustAmount || Number(adjustAmount) < 0) return;
    try {
      const goalRef = doc(db, 'goals', goal.id);
      await setDoc(goalRef, {
        ...goal,
        currentAmount: Number(adjustAmount),
        updatedAt: serverTimestamp()
      });
      setActiveAdjustGoalId(null);
      setAdjustAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `goals/${goal.id}`);
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!window.confirm('Ви впевнені, що хочете видалити цю ціль?')) return;
    try {
      await deleteDoc(doc(db, 'goals', goalId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `goals/${goalId}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
            Спільні цілі накопичення
          </h2>
          <p className="text-xs text-neutral-400">
            Організуйте та відстежуйте свій спільний прогрес покупки квартири, авто або відпустки.
          </p>
        </div>

        <button
          onClick={() => setIsOpenForm(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 hover:bg-opacity-90 transition-all font-semibold rounded-xl bg-indigo-500 text-white text-xs shadow-md cursor-pointer"
        >
          <Plus size={16} />
          Створити ціль
        </button>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal) => {
          const percentage = Math.min(Math.round((goal.currentAmount / goal.targetAmount) * 100), 100);
          const isCompleted = percentage >= 100;

          return (
            <div 
              key={goal.id}
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                isDark 
                  ? 'bg-neutral-900/40 border-neutral-800' 
                  : 'bg-white border-neutral-200 shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2 rounded-lg text-white ${
                      isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}>
                      {isCompleted ? <Award size={18} /> : <Target size={18} />}
                    </div>
                    
                    <div className="min-w-0">
                      <h4 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                        {goal.name}
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-medium">Діє до: {goal.deadline}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(goal.id)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isDark ? 'text-neutral-600 hover:text-rose-500 hover:bg-neutral-800' : 'text-neutral-400 hover:text-rose-500 hover:bg-neutral-100'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Progress bar info */}
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 bg-neutral-200/50 dark:bg-neutral-950 border border-neutral-500/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                    <span className="font-semibold">{goal.currentAmount.toLocaleString('uk-UA')} ₴</span>
                    <span>Ціль: {goal.targetAmount.toLocaleString('uk-UA')} ₴ ({percentage}%)</span>
                  </div>
                </div>
              </div>

              {/* Adjust progress panel */}
              <div className="pt-3 mt-4 border-t border-neutral-500/10">
                {activeAdjustGoalId === goal.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Актуальна сума"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className={`flex-1 py-1 px-2 border rounded-lg text-xs outline-none ${
                        isDark ? 'bg-neutral-950 border-neutral-800 text-white' : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                      }`}
                    />
                    <button
                      onClick={() => handleAdjustProgress(goal)}
                      className="px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Оновити
                    </button>
                    <button
                      onClick={() => setActiveAdjustGoalId(null)}
                      className={`p-1 rounded-lg ${isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setActiveAdjustGoalId(goal.id);
                      setAdjustAmount(String(goal.currentAmount));
                    }}
                    className={`w-full py-1 text-center font-bold text-[10px] rounded-lg border border-dashed transition-colors cursor-pointer ${
                      isDark 
                        ? 'border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200' 
                        : 'border-neutral-300 hover:border-neutral-400 text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    Редагувати внесок накопичення
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Goal Add Form */}
      {isOpenForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsOpenForm(false)} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />

          <div className={`relative w-full max-w-md p-6 rounded-2xl border shadow-xl ${
            isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'
          }`}>
            
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                Створити спільну ціль накопичень
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
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Назва цілі*</label>
                <input
                  type="text"
                  placeholder="Наприклад: Поїздка в Карпати, Екофлоу"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Цільова сума (₴)*</label>
                  <input
                    type="number"
                    placeholder="50 000"
                    required
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                      isDark 
                        ? 'bg-neutral-950 border-neutral-800 text-white' 
                        : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Поточна сума (₴)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={currentAmount}
                    onChange={(e) => setCurrentAmount(e.target.value)}
                    className={`w-full py-2 px-3 rounded-xl border text-xs focus:ring-1 focus:ring-indigo-500 outline-none ${
                      isDark 
                        ? 'bg-neutral-950 border-neutral-800 text-white' 
                        : 'bg-neutral-50 border-neutral-300 text-neutral-900'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Кінцевий термін*</label>
                <input
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
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
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isSubmitting ? 'Збереження...' : (
                    <>
                      <Check size={14} />
                      Створити ціль
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
