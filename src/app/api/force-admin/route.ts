import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    let found = false;
    const modifiedIds = [];

    for (const d of snapshot.docs) {
      const data = d.data();
      const email = (data.email || '').toLowerCase().trim();
      
      if (email === 'sudhanshu18k@gmail.com') {
        await updateDoc(doc(db, 'users', d.id), {
          isSuperAdmin: true
        });
        found = true;
        modifiedIds.push(d.id);
      }
    }

    if (found) {
      return NextResponse.json({ success: true, message: `Successfully made sudhanshu18k@gmail.com an admin!`, userIds: modifiedIds });
    } else {
      return NextResponse.json({ success: false, message: `Could not find any user with email sudhanshu18k@gmail.com in the database. Are you sure you are logged in with that exact email?` }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
