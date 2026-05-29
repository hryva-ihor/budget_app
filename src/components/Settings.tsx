import React, { useState } from 'react';
import { 
  Lock, 
  Share2, 
  Users, 
  Check, 
  Copy, 
  HelpCircle,
  Mail,
  User,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';
import { UserProfile } from '../types';
import { auth, updateUserFamilyId } from '../firebase';
import { signOut } from 'firebase/auth';

interface SettingsProps {
  userProfile: UserProfile | null;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
}

export function Settings({ userProfile, isDark, setIsDark }: SettingsProps) {
  const [spouseFamilyId, setSpouseFamilyId] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  // Copy familyId to clipboard helper
  const handleCopyId = () => {
    if (!userProfile?.familyId) return;
    navigator.clipboard.writeText(userProfile.familyId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Merge family ID with spouse
  const handleMergeBudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spouseFamilyId.trim()) return;
    if (spouseFamilyId.trim() === userProfile?.familyId) {
      alert('Ви вже підключені до цього бюджетного простору.');
      return;
    }

    if (!window.confirm('Ви впевнені, що бажаєте перейти на спільну базу даних з дружиною/чоловіком? Після цього Ви бачитимете та змінюватимете спільний баланс у реальному часі.')) {
      return;
    }

    setIsMerging(true);
    setMergeStatus('idle');

    try {
      if (auth.currentUser?.uid) {
        await updateUserFamilyId(auth.currentUser.uid, spouseFamilyId.trim());
        setMergeStatus('success');
        setSpouseFamilyId('');
      } else {
        setMergeStatus('error');
      }
    } catch (err) {
      console.error(err);
      setMergeStatus('error');
    } finally {
      setIsMerging(false);
    }
  };

  const handleSignOut = () => {
    if (window.confirm('Ви впевнені, що хочете вийти з акаунту?')) {
      signOut(auth);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Profile information */}
      <div className={`p-5 rounded-2xl border ${
        isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
      }`}>
        <h3 className={`text-sm font-semibold tracking-tight mb-4 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
          Профіль користувача
        </h3>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold text-lg shrink-0">
            {userProfile?.displayName ? userProfile.displayName.charAt(0) : 'U'}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              <User size={14} className="text-neutral-400" />
              {userProfile?.displayName}
            </h4>
            <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5 min-w-0 truncate">
              <Mail size={12} />
              {userProfile?.email}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
              isDark 
                ? 'border-neutral-800 hover:bg-neutral-800/80 text-rose-450 hover:text-rose-500' 
                : 'border-neutral-300 hover:bg-neutral-100 text-rose-600'
            }`}
          >
            <LogOut size={13} />
            Вийти
          </button>
        </div>
      </div>

      {/* 2. Family Sync Workspace panel */}
      <div className={`p-5 rounded-2xl border ${
        isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
      }`}>
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <Users size={18} />
          </div>
          <div>
            <h3 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              Співавторство та об'єднання бюджету подржужжя
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Синхронізуйте ваші пристрої з дружиною для спільного спостереження за накопиченнями.
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-4 pt-1">
          <div className={`p-4 rounded-xl border space-y-2.5 ${
            isDark ? 'bg-neutral-950/60 border-neutral-850' : 'bg-neutral-50 border-neutral-250'
          }`}>
            <h4 className={`text-xs font-bold leading-relaxed ${isDark ? 'text-neutral-200' : 'text-neutral-750'}`}>
              Як обрати єдиний сімейний простір:
            </h4>
            
            <ul className="list-disc pl-5 text-[10px] text-neutral-400 space-y-1.5">
              <li>Кожен з вас автоматично має свій приватний простір, підв'язаний під унікальний Ідентифікатор.</li>
              <li>Скопіюйте свій <strong>Ідентифікатор Бюджету</strong> знизу та надішліть його своїй дружині.</li>
              <li>Дружина має просто скопіювати Його, вставити у відповідне поле форми підключення нижче та натиснути кнопку "Об'єднати бюджети".</li>
              <li>Після успішного об'єднання ви обоє матимете спільні збереження, баланс та статистику.</li>
            </ul>
          </div>

          {/* User's workspace copy field */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Ваш Ідентифікатор Бюджету</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={userProfile?.familyId || ''}
                className={`flex-1 py-2 px-3 border rounded-xl text-xs outline-none font-mono tracking-tight select-all ${
                  isDark 
                    ? 'bg-neutral-955 border-neutral-850 text-indigo-400' 
                    : 'bg-neutral-100 border-neutral-300 text-indigo-600 font-semibold'
                }`}
              />
              <button
                onClick={handleCopyId}
                className="px-3.5 flex items-center justify-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Скопійовано' : 'Копіювати ID'}
              </button>
            </div>
          </div>

          {/* Merge Form */}
          <form onSubmit={handleMergeBudge} className="space-y-2 pt-3 border-t border-neutral-500/10">
            <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
              Підключитись до бюджету дружини (Введіть її ID)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Вставте ідентифікатор дружини..."
                required
                value={spouseFamilyId}
                onChange={(e) => setSpouseFamilyId(e.target.value)}
                className={`flex-1 py-2 px-3 border rounded-xl text-xs outline-none ${
                  isDark 
                    ? 'bg-neutral-950 border-neutral-850 text-white' 
                    : 'bg-white border-neutral-300 text-neutral-900'
                }`}
              />
              <button
                type="submit"
                disabled={isMerging}
                className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white hover:opacity-90 rounded-xl text-xs font-semibold shrink-0 cursor-pointer flex items-center justify-center gap-1"
              >
                {isMerging ? 'Об\'єднання...' : 'Об\'єднати бюджети'}
              </button>
            </div>

            {mergeStatus === 'success' && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-550/20 text-emerald-500 text-[10px] font-medium">
                Бюджети успішно об'єднано! Дані синхронізовані у реальному часі.
              </div>
            )}
            {mergeStatus === 'error' && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-550/20 text-rose-500 text-[10px] font-medium">
                Не вдалося провести об'єднання. Перевірте працездатність Firebase.
              </div>
            )}
          </form>

        </div>
      </div>

      {/* 3. Global settings preference styling toggler */}
      <div className={`p-5 rounded-2xl border ${
        isDark ? 'bg-neutral-900/40 border-neutral-800' : 'bg-white border-neutral-200 shadow-sm'
      }`}>
        <h3 className={`text-sm font-semibold tracking-tight mb-3 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
          Візуальні налаштування інтерфейсу
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Тема оформлення</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Оберіть між темним та світлим мінімалізмом</p>
          </div>

          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-bold cursor-pointer transition-colors ${
              isDark 
                ? 'bg-neutral-950 border-neutral-800 text-amber-500' 
                : 'bg-neutral-50 border-neutral-300 text-indigo-500'
            }`}
          >
            {isDark ? (
              <>
                <Sun size={15} />
                <span>Світла тема</span>
              </>
            ) : (
              <>
                <Moon size={15} />
                <span>Темна тема</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
