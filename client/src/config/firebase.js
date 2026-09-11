import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDkocfYK_jeDXJccrfLfJ9MWTk8Fw3a4BE",
  authDomain: "desichowrastha-adminpanel.firebaseapp.com",
  projectId: "desichowrastha-adminpanel",
  storageBucket: "desichowrastha-adminpanel.appspot.com",
  messagingSenderId: "569234932568",
  appId: "1:569234932568:web:e240e0eee9bd8cc9ef5b2d",
  measurementId: "G-JP589H1PVW"
};


firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const firestore = firebase.firestore();

// Older browsers such as Amazon Silk (Fire tablets / Fire TV) don't reliably
// support Firestore's default streaming WebChannel transport, so reads can stall
// silently and data never appears. Auto-detect long polling falls back to plain
// HTTP long-polling on those clients while keeping the faster transport where it
// works. Must be set before any Firestore call.
try {
  firestore.settings({ experimentalAutoDetectLongPolling: true, merge: true });
} catch (e) {
  // settings() throws if called after Firestore is already in use — safe to ignore.
}

export const storage = firebase.storage();

export default firebase;
