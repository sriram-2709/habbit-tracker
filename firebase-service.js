/**
 * Firebase Realtime Database service — auth, load, save, realtime sync
 */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  linkWithCredential,
  EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
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
let auth = null;
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
  return ref(db, `users/${uid}/${DATA_PATH}`);
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
      auth = getAuth(app);
      db = getDatabase(app);
      syncReady = false;

      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };

      onAuthStateChanged(auth, async (user) => {
        currentUser = user;

        if (user) {
          subscribeToUserData(user.uid);
          if (onAuthChange) onAuthChange(user);
          setSyncStatus('synced', 'Connected');
          finish(true);
          return;
        }

        try {
          setSyncStatus('syncing', 'Signing in…');
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Anonymous sign-in failed:', err);
          setSyncStatus('error', 'Auth failed');
          finish(false);
        }
      }, (err) => {
        console.error('Auth state error:', err);
        setSyncStatus('error', 'Auth error');
        finish(false);
      });
    } catch (err) {
      console.error('Firebase init failed:', err);
      setSyncStatus('error', 'Firebase init failed');
      resolve(false);
    }
  });

  return authReadyPromise;
}

export async function loadFromDatabase() {
  if (!firebaseIsReady() || !currentUser) return null;

  try {
    setSyncStatus('syncing', 'Loading…');
    const snapshot = await get(getUserDataRef(currentUser.uid));
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
  if (!firebaseIsReady() || !currentUser || isApplyingRemote) return false;

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

    await set(getUserDataRef(currentUser.uid), payload);

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

  const credential = await signInWithEmailAndPassword(auth, email, password);
  setSyncStatus('synced', 'Signed in');
  return credential.user;
}

export async function signUpWithEmail(email, password) {
  if (!auth) throw new Error('Firebase not initialized');
  setSyncStatus('syncing', 'Creating account…');

  const user = auth.currentUser;
  if (user && user.isAnonymous) {
    const credential = EmailAuthProvider.credential(email, password);
    const linked = await linkWithCredential(user, credential);
    setSyncStatus('synced', 'Account created');
    return linked.user;
  }

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
