/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Patient, Appointment, Invoice, UserData, Clinic } from '@/types';
import { useAuth, useUser } from '@clerk/nextjs';
import { collection, doc, setDoc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface StoreState {
  patients: Patient[];
  appointments: Appointment[];
  invoices: Invoice[];
  userData: UserData | null;
  activeClinic: Clinic | null;
  activeClinicId: string | null;
  setActiveClinicId: (id: string) => void;
  isLoading: boolean;
  isReadOnly: boolean;
  subscriptionDaysLeft: number | null;
  addPatient: (p: Patient) => void;
  updatePatient: (id: string, p: Partial<Patient>) => void;
  deletePatient: (id: string) => void;
  addAppointment: (a: Appointment) => void;
  updateAppointment: (id: string, a: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  addInvoice: (i: Invoice) => void;
  updateInvoice: (id: string, i: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
}

const StoreContext = createContext<StoreState | undefined>(undefined);

// Helper: calculate days left until a date
function calcDaysLeft(endDateStr?: string): number | null {
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [activeClinicId, setActiveClinicId] = useState<string | null>(null);
  const [activeClinic, setActiveClinic] = useState<Clinic | null>(null);
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showReadOnlyToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const isPending = activeClinic?.subscriptionStatus === 'pending';
    const msg = isPending
      ? '⏳ Your account is pending admin approval. Please wait for activation.'
      : '🔒 Subscription expired — app is in read-only mode. Contact admin to renew.';
    setToastMessage(msg);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }, [activeClinic]);

  // Derived subscription state
  const isReadOnly = useMemo(() => {
    if (!activeClinic) return false;
    // Super admins are never read-only
    if (userData?.isSuperAdmin || (userData?.email || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com') return false;
    const status = activeClinic.subscriptionStatus;
    if (status === 'expired' || status === 'locked' || status === 'pending') return true;
    // Check if end date has passed
    if (activeClinic.subscriptionEndDate) {
      const daysLeft = calcDaysLeft(activeClinic.subscriptionEndDate);
      if (daysLeft !== null && daysLeft < 0) return true;
    }
    return false;
  }, [activeClinic, userData]);

  const subscriptionDaysLeft = useMemo(() => {
    if (!activeClinic?.subscriptionEndDate) return null;
    return calcDaysLeft(activeClinic.subscriptionEndDate);
  }, [activeClinic]);

  // 1. Fetch UserData and handle Onboarding
  useEffect(() => {
    if (!userId) {
      setUserData(null);
      setActiveClinicId(null);
      setActiveClinic(null);
      setPatients([]);
      setAppointments([]);
      setInvoices([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubUser = onSnapshot(doc(db, 'users', userId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserData;
        if ((data.email || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com' || ((user?.primaryEmailAddress?.emailAddress || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com')) {
          data.isSuperAdmin = true;
        }
        setUserData(data);

        if (!data.clinics || data.clinics.length === 0) {
          // Auto create clinic in pending state (admin must approve for trial)
          const clinicRef = doc(collection(db, 'clinics'));
          const now = new Date().toISOString();
          const newClinic = {
            id: clinicRef.id,
            name: `${user?.fullName || 'My'} Clinic`,
            ownerId: userId,
            joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            subscriptionStatus: 'pending',
            subscriptionStartDate: now,
            subscriptionPlan: 'Pending Approval',
          };
          await setDoc(clinicRef, newClinic);
          
          const updatedUser = { ...data, clinics: [{ clinicId: clinicRef.id, name: newClinic.name, role: 'owner' as const }] };
          await setDoc(doc(db, 'users', userId), updatedUser);
          setUserData(updatedUser);
          setActiveClinicId(clinicRef.id);
          router.push('/dashboard');
          setIsLoading(false);
        } else {
          // If no active clinic selected, pick the first one
          if (!activeClinicId) {
            setActiveClinicId(data.clinics[0].clinicId);
          }
        }
      } else {
        // New user - auto create a default clinic with 7-day trial
        if (user?.emailAddresses[0]?.emailAddress) {
          const newEmail = user.emailAddresses[0].emailAddress;
          
          const clinicRef = doc(collection(db, 'clinics'));
          const now = new Date().toISOString();
          const newClinic = {
            id: clinicRef.id,
            name: `${user.fullName || 'My'} Clinic`,
            ownerId: userId,
            joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            subscriptionStatus: 'pending',
            subscriptionStartDate: now,
            subscriptionPlan: 'Pending Approval',
          };
          await setDoc(clinicRef, newClinic);

          const newUserData: UserData = {
            id: userId,
            email: newEmail,
            clinics: [{ clinicId: clinicRef.id, name: newClinic.name, role: 'owner' }],
            isSuperAdmin: (newEmail || '').toLowerCase().trim() === 'sudhanshu18k@gmail.com'
          };
          await setDoc(doc(db, 'users', userId), newUserData);
          setUserData(newUserData);
          setActiveClinicId(clinicRef.id);
          router.push('/dashboard');
        }
        setIsLoading(false);
      }
    }, (error) => {
      console.error("Database Error (users):", error);
      alert("Database Error: " + error.message + "\n\nThis usually means your Firestore 'Test Mode' security rules have expired after 30 days. Please update your Firebase Rules.");
      setIsLoading(false);
    });

    return () => unsubUser();
  }, [userId, user, activeClinicId, router]);

  // 2. Fetch Active Clinic details + auto-expire check
  useEffect(() => {
    if (!activeClinicId) {
      setActiveClinic(null);
      return;
    }

    const unsubClinic = onSnapshot(doc(db, 'clinics', activeClinicId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Clinic;
        if (!data.joinCode) {
           const code = Math.random().toString(36).substring(2, 8).toUpperCase();
           await updateDoc(doc(db, 'clinics', activeClinicId), { joinCode: code });
        }

        // Auto-expire check: if endDate has passed and status is still trial/active
        if (data.subscriptionEndDate && (data.subscriptionStatus === 'trial' || data.subscriptionStatus === 'active')) {
          const daysLeft = calcDaysLeft(data.subscriptionEndDate);
          if (daysLeft !== null && daysLeft < 0) {
            await updateDoc(doc(db, 'clinics', activeClinicId), { subscriptionStatus: 'expired' });
            data.subscriptionStatus = 'expired';
          }
        }

        setActiveClinic({ ...data, id: snap.id });
      }
    }, (error) => {
      console.error("Database Error (clinics):", error);
    });

    return () => unsubClinic();
  }, [activeClinicId]);

  // 3. Sync Clinic Data (Patients, Appointments, Invoices)
  useEffect(() => {
    if (!activeClinicId) {
      setPatients([]);
      setAppointments([]);
      setInvoices([]);
      return;
    }

    const unsubPatients = onSnapshot(collection(db, 'clinics', activeClinicId, 'patients'), snap => {
      setPatients(snap.docs.map(d => ({ ...(d.data() as Patient), id: d.id })));
    });

    const unsubAppointments = onSnapshot(collection(db, 'clinics', activeClinicId, 'appointments'), snap => {
      setAppointments(snap.docs.map(d => ({ ...(d.data() as Appointment), id: d.id })));
    });

    const unsubInvoices = onSnapshot(collection(db, 'clinics', activeClinicId, 'invoices'), snap => {
      setInvoices(snap.docs.map(d => ({ ...(d.data() as Invoice), id: d.id })));
      setIsLoading(false);
    });

    return () => {
      unsubPatients();
      unsubAppointments();
      unsubInvoices();
    };
  }, [activeClinicId]);

  // Firestore actions tied to activeClinicId — guarded by isReadOnly + toast
  const addPatient = useCallback((p: Patient) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    const ref = doc(collection(db, 'clinics', activeClinicId, 'patients'));
    setDoc(ref, { ...p, id: ref.id });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const updatePatient = useCallback((id: string, p: Partial<Patient>) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    setDoc(doc(db, 'clinics', activeClinicId, 'patients', id), p, { merge: true });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const deletePatient = useCallback((id: string) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    deleteDoc(doc(db, 'clinics', activeClinicId, 'patients', id));
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const addAppointment = useCallback((a: Appointment) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    const ref = doc(collection(db, 'clinics', activeClinicId, 'appointments'));
    setDoc(ref, { ...a, id: ref.id });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const updateAppointment = useCallback((id: string, a: Partial<Appointment>) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    setDoc(doc(db, 'clinics', activeClinicId, 'appointments', id), a, { merge: true });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const deleteAppointment = useCallback((id: string) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    deleteDoc(doc(db, 'clinics', activeClinicId, 'appointments', id));
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const addInvoice = useCallback((i: Invoice) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    const ref = doc(collection(db, 'clinics', activeClinicId, 'invoices'));
    setDoc(ref, { ...i, id: ref.id });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const updateInvoice = useCallback((id: string, i: Partial<Invoice>) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    setDoc(doc(db, 'clinics', activeClinicId, 'invoices', id), i, { merge: true });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const deleteInvoice = useCallback((id: string) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    deleteDoc(doc(db, 'clinics', activeClinicId, 'invoices', id));
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  return (
    <StoreContext.Provider value={{
      patients, appointments, invoices,
      userData, activeClinic, activeClinicId, setActiveClinicId, isLoading,
      isReadOnly, subscriptionDaysLeft,
      addPatient, updatePatient, deletePatient,
      addAppointment, updateAppointment, deleteAppointment,
      addInvoice, updateInvoice, deleteInvoice,
    }}>
      {children}
      {/* Read-only toast notification */}
      {toastMessage && (
        <div className="readonly-toast" onClick={() => setToastMessage(null)}>
          {toastMessage}
        </div>
      )}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
