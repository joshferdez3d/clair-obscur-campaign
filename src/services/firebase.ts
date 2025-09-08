import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC6ik2ATqgJA9lKRVaRdtnjYRbjhZvG_2w",
  authDomain: "clair-obscur-campaign.firebaseapp.com",
  projectId: "clair-obscur-campaign",
  storageBucket: "clair-obscur-campaign.firebasestorage.app",
  messagingSenderId: "947015340920",
  appId: "1:947015340920:web:0102550b94effca5906e8d",
  measurementId: "G-DQ5Z54NDPQ"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);


export default app;