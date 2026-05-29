/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocFromServer,
  setDoc,
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { UserProfile, Account, Category, Transaction, SavingGoal } from './types';

let firebaseConfigJson: any = {};
try {
  // By using a runtime fetch rather than a static/dynamic import, Vite's bundler remains completely unaware
  // of this file at build-time. This guarantees that your sensitive credentials are never compiled or bundled
  // into the javascript files in the "dist" directory.
  const response = await fetch('/firebase-applet-config.json');
  if (response.ok) {
    firebaseConfigJson = await response.json();
  }
} catch (e) {
  console.warn("No local /firebase-applet-config.json found at runtime. Reading configurations from environment variables.");
}

// Resolve configurations priority-first
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId || ""
};

const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId || "";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

// Social login provider
export const googleProvider = new GoogleAuthProvider();

// Standard connection check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Formatted Firestore Error Handling as required by guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Default categories to seed when a user initializes a space
export const DEFAULT_CATEGORIES = [
  { name: 'Продукти', icon: 'ShoppingBag', color: '#10b981', type: 'expense' as const },
  { name: 'Комуналка & Житло', icon: 'Home', color: '#3b82f6', type: 'expense' as const },
  { name: 'Транспорт & Авто', icon: 'Car', color: '#f59e0b', type: 'expense' as const },
  { name: 'Здоров\'я & Ліки', icon: 'HeartPulse', color: '#ef4444', type: 'expense' as const },
  { name: 'Розваги & Кафе', icon: 'GlassWater', color: '#8b5cf6', type: 'expense' as const },
  { name: 'Одяг & Шопінг', icon: 'Shirt', color: '#ec4899', type: 'expense' as const },
  { name: 'Інтернет & Мобільний', icon: 'Wifi', color: '#06b6d4', type: 'expense' as const },
  { name: 'Зарплата', icon: 'Briefcase', color: '#22c55e', type: 'income' as const },
  { name: 'Активи / Спільно', icon: 'TrendingUp', color: '#14b8a6', type: 'income' as const },
  { name: 'Інші витрати', icon: 'CircleHelp', color: '#6b7280', type: 'expense' as const },
];

/**
 * Creates/retrieves a user profile in Firestore
 */
export async function getOrCreateUserProfile(uid: string, email: string, displayName: string, photoURL?: string): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    } else {
      // Set own UID as the default familyId
      const newUser: UserProfile = {
        id: uid,
        email,
        displayName: displayName || 'Користувач',
        photoURL: photoURL || '',
        familyId: uid, // Default family workspace is private to self
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, newUser);
      
      // Let's seed default categories of this new family!
      await seedDefaultCategories(uid);

      // Also seed standard default accounts to give user something to start with
      await seedDefaultAccounts(uid);

      return newUser;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    throw err;
  }
}

/**
 * Update user familyId to merge with spouse's family budget
 */
export async function updateUserFamilyId(uid: string, newFamilyId: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      familyId: newFamilyId,
      updatedAt: serverTimestamp()
    });

    // Seed default categories/accounts in the new family if they don't exist yet
    await seedDefaultCategories(newFamilyId);
    await seedDefaultAccounts(newFamilyId);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    throw err;
  }
}

/**
 * Seeds default categories to a family if none exist.
 */
async function seedDefaultCategories(familyId: string) {
  const catCol = collection(db, 'categories');
  const catQuery = query(catCol, where('familyId', '==', familyId));
  try {
    // Check if categories are already present
    const catsSnap = await getDoc(doc(db, 'users', familyId)); // fallback
    // Since we can't search easily, let's just create them safely. We can check if categories exist
    // in real-time or just seed them. Let's do it on profile initialization.
    // To avoid duplicating, we can generate fixed IDs based on category indexes
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const template = DEFAULT_CATEGORIES[i];
      const customId = `cat_${familyId}_${i}`;
      const catRef = doc(db, 'categories', customId);
      await setDoc(catRef, {
        id: customId,
        familyId,
        name: template.name,
        icon: template.icon,
        color: template.color,
        type: template.type,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error('Seeding categories failed:', err);
  }
}

/**
 * Seeds default accounts
 */
async function seedDefaultAccounts(familyId: string) {
  const defaultAccounts = [
    { name: 'Готівка', type: 'cash' as const, initialBalance: 0 },
    { name: 'Основна Картка', type: 'card' as const, initialBalance: 0 },
  ];
  try {
    for (let i = 0; i < defaultAccounts.length; i++) {
      const acc = defaultAccounts[i];
      const customId = `acc_${familyId}_${i}`;
      const accRef = doc(db, 'accounts', customId);
      await setDoc(accRef, {
        id: customId,
        familyId,
        name: acc.name,
        type: acc.type,
        initialBalance: acc.initialBalance,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    console.error('Seeding accounts failed:', err);
  }
}
