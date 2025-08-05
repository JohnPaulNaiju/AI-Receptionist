// Test script to verify Firebase connection
import { auth, db } from '../utils';
import { collection, getDocs } from 'firebase/firestore';

const testFirebaseConnection = async () => {
  console.log('Testing Firebase connection...');
  
  try {
    // Test Firestore connection
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`Successfully connected to Firestore. Found ${usersSnapshot.size} users.`);
    
    // Test Authentication state
    console.log('Current auth state:', auth.currentUser ? 'Logged in' : 'Not logged in');
    
    console.log('Firebase connection test completed successfully!');
  } catch (error) {
    console.error('Firebase connection test failed:', error);
  }
};

export default testFirebaseConnection;
