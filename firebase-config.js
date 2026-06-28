/**
 * Firebase project configuration.
 * Replace the placeholder values below with your own from the Firebase Console.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDoLtCMKaSPZDSx6F2f2blUwkqPmj736bs",
  authDomain: "habbittracker-38a9b.firebaseapp.com",
  databaseURL: "https://habbittracker-38a9b-default-rtdb.firebaseio.com",
  projectId: "habbittracker-38a9b",
  storageBucket: "habbittracker-38a9b.firebasestorage.app",
  messagingSenderId: "941051334664",
  appId: "1:941051334664:web:bc11758533bdac950b81bd",
  measurementId: "G-EE3G58VTT3"
};

export function isFirebaseConfigured() {
  const { apiKey, projectId, databaseURL } = firebaseConfig;
  return Boolean(
    apiKey &&
    projectId &&
    databaseURL &&
    !apiKey.startsWith('YOUR_') &&
    !projectId.startsWith('YOUR_') &&
    !databaseURL.includes('YOUR_PROJECT_ID')
  );
}
