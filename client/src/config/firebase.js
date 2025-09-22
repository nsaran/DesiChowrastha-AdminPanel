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
export const storage = firebase.storage();

export default firebase;
