export type AccountType = 'cash' | 'card' | 'other';
export type TransactionType = 'expense' | 'income';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  familyId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Account {
  id: string;
  familyId: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  currency?: 'UAH' | 'USD' | 'EUR';
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id: string;
  familyId: string;
  name: string;
  icon: string; // Lucide icon name
  color: string; // Hex color code or Tailwind color class prefix
  type: TransactionType;
  createdAt: any;
  updatedAt: any;
}

export interface Transaction {
  id: string;
  familyId: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  description: string;
  currency?: 'UAH' | 'USD' | 'EUR';
  isConversion?: boolean;
  conversionPairId?: string; // connects the two transfer legs
  targetAccountId?: string;  // destination account if conversion
  exchangeRate?: number;     // rate used
  convertedAmount?: number;  // amount in the other currency
  date: any; // JS Date or Firestore Timestamp
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface SavingGoal {
  id: string;
  familyId: string;
  name: string;
  targetAmount: number;
  currentAmount: number; // calculated dynamically from transactions if we want, or updated manually. The user says: "прогресу накопичення на спільні цілі", updating manually or through saving deposits is great!
  deadline: string; // YYYY-MM-DD
  createdAt: any;
  updatedAt: any;
}
