import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAxyVy7etMXZoKPZpA7MGPspU5bsZecDow",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dentalmangement.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dentalmangement",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dentalmangement.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "694881374396",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:694881374396:web:b562364a1d40fd641e80b9",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-HZ4W5M2H7S",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function makeAdmin() {
  try {
    console.log('Querying users...');
    const snapshot = await getDocs(collection(db, 'users'));
    let found = false;
    
    for (const d of snapshot.docs) {
      const data = d.data();
      if ((data.email || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com') {
        console.log(`Found user! ID: ${d.id}`);
        await updateDoc(doc(db, 'users', d.id), {
          isSuperAdmin: true
        });
        console.log('Successfully set isSuperAdmin = true for sudhanshu18k@gmail.com');
        found = true;
      }
    }
    
    if (!found) {
      console.log('User sudhanshu18k@gmail.com not found in the database. Are they logged in?');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

makeAdmin();
