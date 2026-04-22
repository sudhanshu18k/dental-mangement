import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './lib/firebase';

async function check() {
  const snap = await getDocs(collection(db, 'users'));
  console.log(`Found ${snap.docs.length} users.`);
  snap.docs.forEach(async (d) => {
    const data = d.data();
    console.log(`- Email: "${data.email}", isSuperAdmin: ${data.isSuperAdmin}`);
    if (data.email && data.email.toLowerCase().includes('sudhanshu')) {
      if (!data.isSuperAdmin) {
        console.log(`  -> Making ${data.email} a super admin...`);
        await updateDoc(doc(db, 'users', d.id), { isSuperAdmin: true });
        console.log(`  -> Done.`);
      }
    }
  });
}

check().catch(console.error);
