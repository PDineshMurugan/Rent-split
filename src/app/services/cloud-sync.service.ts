import { Injectable, signal } from '@angular/core';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import {
  FirebaseConfig,
  HouseholdCloudData,
  CloudSyncStatus,
  CloudUserProfile,
} from '../models/cloud.model';
import { CustomPreset } from '../models/expense.model';
import { environment } from '../../environments/environment';

const FIREBASE_CONFIG_KEY = 'splitmate_firebase_config_v1';
const SYNC_CODE_KEY = 'splitmate_cloud_sync_code_v1';
const AUTO_SYNC_KEY = 'splitmate_auto_sync_v1';

@Injectable({
  providedIn: 'root',
})
export class CloudSyncService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private unsubscribeSnapshot: Unsubscribe | null = null;
  private unsubscribeAuth: (() => void) | null = null;

  readonly firebaseConfig = signal<FirebaseConfig | null>(null);
  readonly householdSyncCode = signal<string>('');
  readonly isAutoSync = signal<boolean>(true);
  readonly syncStatus = signal<CloudSyncStatus>('disconnected');
  readonly lastSyncTime = signal<string | null>(null);
  readonly syncError = signal<string | null>(null);

  // Auth signals
  readonly currentUser = signal<CloudUserProfile | null>(null);
  readonly isAuthLoading = signal<boolean>(false);

  constructor() {
    this.loadPersistedConfig();
  }

  private loadPersistedConfig() {
    if (typeof localStorage === 'undefined') return;

    try {
      const savedCode = localStorage.getItem(SYNC_CODE_KEY);
      if (savedCode) {
        this.householdSyncCode.set(savedCode.trim().toUpperCase());
      }

      const savedAuto = localStorage.getItem(AUTO_SYNC_KEY);
      if (savedAuto !== null) {
        this.isAutoSync.set(savedAuto === 'true');
      }

      // Check environment first
      if (environment?.firebase?.apiKey && environment?.firebase?.projectId) {
        const envConfig: FirebaseConfig = environment.firebase;
        this.firebaseConfig.set(envConfig);
        this.initFirebase(envConfig);
        return;
      }

      // Fallback to persisted user custom Firebase config
      const rawConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
      if (rawConfig) {
        const parsed: FirebaseConfig = JSON.parse(rawConfig);
        if (parsed.apiKey && parsed.projectId) {
          this.firebaseConfig.set(parsed);
          this.initFirebase(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load cloud sync config:', e);
    }
  }

  private initFirebase(config: FirebaseConfig): boolean {
    try {
      if (getApps().length === 0) {
        this.app = initializeApp(config);
      } else {
        this.app = getApp();
      }
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);

      // Listen to Auth State
      if (this.unsubscribeAuth) {
        this.unsubscribeAuth();
      }
      this.unsubscribeAuth = onAuthStateChanged(this.auth, (user: User | null) => {
        if (user) {
          this.currentUser.set({
            uid: user.uid,
            displayName: user.displayName || 'Roommate',
            email: user.email,
            photoURL: user.photoURL,
          });
        } else {
          this.currentUser.set(null);
        }
      });

      // Check for redirect result if returned from redirect flow
      if (typeof window !== 'undefined' && this.auth) {
        getRedirectResult(this.auth)
          .then((result) => {
            if (result?.user) {
              this.currentUser.set({
                uid: result.user.uid,
                displayName: result.user.displayName || 'Roommate',
                email: result.user.email,
                photoURL: result.user.photoURL,
              });
            }
          })
          .catch((e) => {
            console.warn('Firebase getRedirectResult error:', e);
          });
      }

      // Initialize Analytics if supported in browser environment
      if (typeof window !== 'undefined' && config.measurementId) {
        isSupported().then((supported) => {
          if (supported && this.app) {
            getAnalytics(this.app);
          }
        }).catch(() => {});
      }

      this.syncStatus.set('connected');
      this.syncError.set(null);
      return true;
    } catch (err: any) {
      console.error('Firebase initialization error:', err);
      this.syncStatus.set('error');
      this.syncError.set(err.message || 'Firebase initialization failed');
      return false;
    }
  }

  isConfigured(): boolean {
    return !!(this.db && this.app);
  }

  saveConfig(config: FirebaseConfig, syncCode?: string): boolean {
    if (!config.apiKey || !config.projectId) {
      this.syncError.set('Firebase API Key and Project ID are required.');
      return false;
    }

    if (syncCode) {
      const cleanCode = syncCode.trim().toUpperCase();
      this.householdSyncCode.set(cleanCode);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SYNC_CODE_KEY, cleanCode);
      }
    }

    const success = this.initFirebase(config);
    if (success) {
      this.firebaseConfig.set(config);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
      }
      return true;
    }
    return false;
  }

  setHouseholdSyncCode(code: string) {
    const clean = code.trim().toUpperCase();
    this.householdSyncCode.set(clean);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SYNC_CODE_KEY, clean);
    }
  }

  toggleAutoSync() {
    const nextVal = !this.isAutoSync();
    this.isAutoSync.set(nextVal);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTO_SYNC_KEY, String(nextVal));
    }
  }

  disconnect() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    if (this.auth) {
      signOut(this.auth).catch(() => {});
    }
    this.currentUser.set(null);
    this.firebaseConfig.set(null);
    this.syncStatus.set('disconnected');
    this.syncError.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FIREBASE_CONFIG_KEY);
    }
  }

  // Google Sign-In (1-Click Popup)
  async signInWithGoogle(): Promise<boolean> {
    if (!this.isConfigured() || !this.auth) {
      this.syncError.set('Firebase is not configured yet. Please configure Firebase settings first.');
      return false;
    }

    this.isAuthLoading.set(true);
    this.syncError.set(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(this.auth, provider);
      const user = result.user;

      this.currentUser.set({
        uid: user.uid,
        displayName: user.displayName || 'Roommate',
        email: user.email,
        photoURL: user.photoURL,
      });

      this.isAuthLoading.set(false);
      return true;
    } catch (err: any) {
      this.isAuthLoading.set(false);
      console.warn('Google sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/popup-blocked') {
        const wantsRedirect =
          typeof window !== 'undefined' &&
          window.confirm(
            'Google Sign-In popup was closed or blocked by browser privacy controls.\n\n' +
              'In Microsoft Edge or Safari, Tracking Prevention frequently blocks cross-origin popup storage.\n\n' +
              'Click OK to sign in via full-page redirect instead.'
          );

        if (wantsRedirect && this.auth) {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await signInWithRedirect(this.auth, provider);
          return false;
        }

        this.syncError.set(
          'Sign-in was not completed. In Microsoft Edge, click the lock/shield icon on the left of your address bar and turn "Tracking prevention for this site" OFF, then try again.'
        );
      } else if (err.code === 'auth/unauthorized-domain') {
        this.syncError.set(
          'Unauthorized Domain: Please add "rentspliter.netlify.app" to Firebase Console -> Authentication -> Settings -> Authorized Domains.'
        );
      } else if (err.code === 'auth/cancelled-popup-request') {
        this.syncError.set('Sign-in was cancelled.');
      } else if (err.code === 'auth/operation-not-allowed') {
        this.syncError.set('Google Sign-In is not enabled yet in your Firebase Console (Authentication -> Sign-in method).');
      } else {
        this.syncError.set(err.message || 'Google Sign-In failed.');
      }
      return false;
    }
  }

  async signOutAccount(): Promise<void> {
    if (this.auth) {
      try {
        await signOut(this.auth);
      } catch (e) {
        console.warn('Sign out error:', e);
      }
    }
    this.currentUser.set(null);
  }

  // Determine target cloud doc path:
  // If user is logged in, default doc is `users/{uid}`, else `households/{code}`
  private getTargetDocPath(): { collection: string; id: string } | null {
    const user = this.currentUser();
    const code = this.householdSyncCode();

    if (code) {
      return { collection: 'households', id: code };
    }

    if (user?.uid) {
      return { collection: 'users', id: user.uid };
    }

    return null;
  }

  // Push all months, expenses, presets & history to Firebase Cloud
  async pushDataToCloud(data: HouseholdCloudData): Promise<boolean> {
    if (!this.db) {
      this.syncError.set('Firebase is not configured yet.');
      return false;
    }

    const target = this.getTargetDocPath();
    if (!target) {
      this.syncError.set('Please sign in with Google or enter a Household Sync Code.');
      return false;
    }

    const user = this.currentUser();
    this.syncStatus.set('syncing');

    try {
      const docRef = doc(this.db, target.collection, target.id);
      const payload: HouseholdCloudData = {
        ...data,
        householdId: target.id,
        ownerUid: user?.uid || null,
        ownerEmail: user?.email || null,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, payload, { merge: true });

      // If user is logged in AND has a household code, also save a backup under user doc for quick restore
      if (user?.uid && target.collection === 'households') {
        const userBackupRef = doc(this.db, 'users', user.uid);
        await setDoc(userBackupRef, payload, { merge: true }).catch(() => {});
      }

      this.syncStatus.set('connected');
      this.lastSyncTime.set(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      this.syncError.set(null);
      return true;
    } catch (err: any) {
      console.error('Firebase push error:', err);
      this.syncStatus.set('error');
      this.syncError.set(err.message || 'Failed to push data to cloud.');
      return false;
    }
  }

  // Pull all months, expenses, presets & history from Firebase Cloud
  async pullDataFromCloud(): Promise<HouseholdCloudData | null> {
    if (!this.db) {
      this.syncError.set('Firebase is not configured yet.');
      return null;
    }

    const target = this.getTargetDocPath();
    if (!target) {
      this.syncError.set('Please sign in with Google or enter a Household Sync Code.');
      return null;
    }

    this.syncStatus.set('syncing');
    try {
      const docRef = doc(this.db, target.collection, target.id);
      let snapshot = await getDoc(docRef);

      // If not found and target was household, check user doc fallback
      const user = this.currentUser();
      if (!snapshot.exists() && user?.uid && target.collection !== 'users') {
        const userDocRef = doc(this.db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          snapshot = userSnap;
        }
      }

      if (snapshot.exists()) {
        const data = snapshot.data() as HouseholdCloudData;
        this.syncStatus.set('connected');
        this.lastSyncTime.set(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
        this.syncError.set(null);
        return data;
      } else {
        this.syncStatus.set('connected');
        this.syncError.set(`No cloud backup found yet. You can push your current data to create it.`);
        return null;
      }
    } catch (err: any) {
      console.error('Firebase pull error:', err);
      this.syncStatus.set('error');
      this.syncError.set(err.message || 'Failed to pull data from cloud.');
      return null;
    }
  }

  // Listen for real-time live updates from other roommates
  subscribeRealtimeUpdates(onUpdate: (data: HouseholdCloudData) => void): boolean {
    if (!this.db) return false;
    const target = this.getTargetDocPath();
    if (!target) return false;

    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }

    try {
      const docRef = doc(this.db, target.collection, target.id);
      this.unsubscribeSnapshot = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as HouseholdCloudData;
            this.lastSyncTime.set(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
            onUpdate(data);
          }
        },
        (error) => {
          console.warn('Firestore live listener error:', error);
          this.syncError.set(error.message);
        }
      );
      return true;
    } catch (e: any) {
      console.warn('Realtime listener subscription error:', e);
      return false;
    }
  }

  // =========================================================================
  // PRESET CLOUD MANAGEMENT (Directly tied to Google User Account)
  // =========================================================================

  // Save a preset to Google Cloud Firestore
  async saveCloudPreset(preset: CustomPreset): Promise<boolean> {
    if (!this.db) {
      this.syncError.set('Firebase is not configured yet.');
      return false;
    }
    const user = this.currentUser();
    if (!user?.uid) {
      this.syncError.set('Please sign in with Google to save this preset to the Cloud.');
      return false;
    }

    try {
      const userRef = doc(this.db, 'users', user.uid);
      const snap = await getDoc(userRef);
      let existingPresets: CustomPreset[] = [];
      if (snap.exists()) {
        const data = snap.data();
        existingPresets = data['customPresets'] || [];
      }

      // Upsert preset with cloud tag
      const taggedPreset: CustomPreset = {
        ...preset,
        storageType: 'cloud',
      };
      const filtered = existingPresets.filter((p) => p.id !== preset.id);
      const updatedPresets = [taggedPreset, ...filtered];

      await setDoc(userRef, { customPresets: updatedPresets }, { merge: true });
      return true;
    } catch (err: any) {
      console.error('Save cloud preset error:', err);
      this.syncError.set(err.message || 'Failed to save preset to Cloud.');
      return false;
    }
  }

  // Fetch all presets saved in Google Cloud for current account
  async fetchCloudPresets(): Promise<CustomPreset[]> {
    if (!this.db) return [];
    const user = this.currentUser();
    if (!user?.uid) return [];

    try {
      const userRef = doc(this.db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const list = (data['customPresets'] as CustomPreset[]) || [];
        return list.map((p) => ({ ...p, storageType: 'cloud' as const }));
      }
      return [];
    } catch (err: any) {
      console.warn('Fetch cloud presets error:', err);
      return [];
    }
  }

  // Delete a preset from Google Cloud
  async deleteCloudPreset(presetId: string): Promise<boolean> {
    if (!this.db) return false;
    const user = this.currentUser();
    if (!user?.uid) return false;

    try {
      const userRef = doc(this.db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const existing: CustomPreset[] = data['customPresets'] || [];
        const updated = existing.filter((p) => p.id !== presetId);
        await setDoc(userRef, { customPresets: updated }, { merge: true });
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn('Delete cloud preset error:', err);
      return false;
    }
  }
}

