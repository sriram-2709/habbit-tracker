/**
 * Firebase Realtime Database service — database-based auth, load, save, realtime sync
 */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
  set,
  onValue
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const DATA_PATH = 'habitTracker';

let app = null;
let db = null;
let currentUser = null;
let unsubscribeSnapshot = null;
let lastLocalSaveAt = 0;
let isApplyingRemote = false;
let syncReady = false;
let authReadyPromise = null;
let onRemoteUpdate = null;
let onAuthChange = null;
let onSyncStatusChange = null;

export function firebaseIsReady() {
  return isFirebaseConfigured() && app !== null && db !== null;
}

export function getCurrentUser() {
  if (!currentUser) {
    const userJson = sessionStorage.getItem('currentUser');
    if (userJson) {
      try {
        currentUser = JSON.parse(userJson);
      } catch (e) {
        currentUser = null;
      }
    }
  }
  return currentUser;
}

export function setRemoteUpdateHandler(fn) {
  onRemoteUpdate = fn;
}

export function setAuthChangeHandler(fn) {
  onAuthChange = fn;
}

export function setSyncStatusHandler(fn) {
  onSyncStatusChange = fn;
}

/** Enable realtime listener updates after initial load completes */
export function enableRealtimeSync() {
  syncReady = true;
}

function setSyncStatus(status, message) {
  if (onSyncStatusChange) onSyncStatusChange(status, message);
}

function getUserDataRef(uid) {
  // Each user gets their own isolated data path - no collision possible
  return ref(db, `users/${uid}/habitTracker`);
}

function subscribeToUserData(uid) {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  const dataRef = getUserDataRef(uid);

  unsubscribeSnapshot = onValue(
    dataRef,
    (snapshot) => {
      if (!syncReady || isApplyingRemote) return;

      const data = snapshot.val();
      if (!data) return;

      const remoteUpdatedAt = data.updatedAt || 0;
      if (remoteUpdatedAt <= lastLocalSaveAt) return;

      isApplyingRemote = true;
      try {
        if (onRemoteUpdate) onRemoteUpdate(data);
        setSyncStatus('synced', 'Synced from cloud');
      } catch (err) {
        console.error('Remote update handler failed:', err);
      } finally {
        isApplyingRemote = false;
      }
    },
    (err) => {
      console.error('Realtime Database listener error:', err);
      setSyncStatus('error', 'Sync error');
    }
  );
}

export async function initFirebase() {
  if (!isFirebaseConfigured()) {
    setSyncStatus('offline', 'Firebase not configured');
    return false;
  }

  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve) => {
    try {
      app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      db = getDatabase(app);
      syncReady = false;

      // Get current user from session
      currentUser = getCurrentUser();
      
      if (currentUser && currentUser.userId) {
        subscribeToUserData(currentUser.userId);
        if (onAuthChange) onAuthChange(currentUser);
        setSyncStatus('synced', 'Connected');
      }

      resolve(true);
    } catch (err) {
      console.error('Firebase init failed:', err);
      setSyncStatus('error', 'Firebase init failed');
      resolve(false);
    }
  });

  return authReadyPromise;
}

export async function loadFromDatabase() {
  if (!firebaseIsReady()) return null;
  
  const user = getCurrentUser();
  if (!user || !user.userId) return null;

  try {
    setSyncStatus('syncing', 'Loading…');
    const snapshot = await get(getUserDataRef(user.userId));
    const data = snapshot.val();

    if (!data) {
      setSyncStatus('synced', 'Ready');
      return null;
    }

    setSyncStatus('synced', 'Loaded from cloud');
    return data;
  } catch (err) {
    console.error('Realtime Database load failed:', err);
    setSyncStatus('error', 'Load failed');
    return null;
  }
}

export async function saveToDatabase(state) {
  if (!firebaseIsReady() || isApplyingRemote) return false;
  
  const user = getCurrentUser();
  if (!user || !user.userId) return false;

  try {
    setSyncStatus('syncing', 'Saving…');
    lastLocalSaveAt = Date.now();

    const payload = {
      month: state.month,
      year: state.year,
      theme: state.theme,
      notes: state.notes,
      journal: state.journal,
      dailyHabits: state.dailyHabits,
      weeklyHabits: state.weeklyHabits,
      updatedAt: lastLocalSaveAt
    };

    await set(getUserDataRef(user.userId), payload);

    setSyncStatus('synced', 'Saved to cloud');
    return true;
  } catch (err) {
    console.error('Realtime Database save failed:', err);
    setSyncStatus('error', 'Save failed');
    return false;
  }
}

export async function signInWithEmail(email, password) {
  if (!auth) throw new Error('Firebase not initialized');
  syncReady = false;
  setSyncStatus('syncing', 'Signing in…');

  // Sign out any existing user first to prevent data collision
  if (auth.currentUser) {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  setSyncStatus('synced', 'Signed in');
  return credential.user;
}

export async function signUpWithEmail(email, password) {
  if (!auth) throw new Error('Firebase not initialized');
  setSyncStatus('syncing', 'Creating account…');

  const user = auth.currentUser;
  if (user && user.isAnonymous) {
    // Link anonymous account data to new email account
    const credential = EmailAuthProvider.credential(email, password);
    const linked = await linkWithCredential(user, credential);
    setSyncStatus('synced', 'Account created');
    return linked.user;
  }

  // Create new account - will automatically get isolated data path
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  setSyncStatus('synced', 'Account created');
  return credential.user;
}

export async function signOutUser() {
  if (!auth) return;
  syncReady = false;
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  await signOut(auth);
  currentUser = null;
  setSyncStatus('offline', 'Signed out');
  await signInAnonymously(auth);
}
