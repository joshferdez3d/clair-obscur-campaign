import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase';

export async function testFirebaseConnection() {
  try {
    console.log('Testing Firebase connection...');
    
    // Try to write a test document
    const testRef = doc(db, 'test', 'connection');
    await setDoc(testRef, {
      message: 'Firebase is working!',
      timestamp: new Date()
    });
    
    // Try to read it back
    const docSnap = await getDoc(testRef);
    if (docSnap.exists()) {
      console.log('✅ Firebase connection successful!', docSnap.data());
      return true;
    } else {
      console.log('❌ Could not read test document');
      return false;
    }
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return false;
  }
}