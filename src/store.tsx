/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
        if (data.email === 'sudhanshu18k@gmail.com' || (user?.primaryEmailAddress?.emailAddress === 'sudhanshu18k@gmail.com')) {
          data.isSuperAdmin = true;
        }
        setUserData(data);

        if (!data.clinics || data.clinics.length === 0) {
          // Auto create missing clinic
          const clinicRef = doc(collection(db, 'clinics'));
          const newClinic = {
            id: clinicRef.id,
            name: `${user?.fullName || 'My'} Clinic`,
            ownerId: userId,
            joinCode: Math.random().toString(36).substring(2, 8).toUpperCase()
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
        // New user - auto create a default clinic
        if (user?.emailAddresses[0]?.emailAddress) {
          const newEmail = user.emailAddresses[0].emailAddress;
          
          const clinicRef = doc(collection(db, 'clinics'));
          const newClinic = {
            id: clinicRef.id,
            name: `${user.fullName || 'My'} Clinic`,
            ownerId: userId,
            joinCode: Math.random().toString(36).substring(2, 8).toUpperCase()
          };
          await setDoc(clinicRef, newClinic);

          const newUserData: UserData = {
            id: userId,
            email: newEmail,
            clinics: [{ clinicId: clinicRef.id, name: newClinic.name, role: 'owner' }],
            isSuperAdmin: newEmail === 'sudhanshu18k@gmail.com'
          };
          await setDoc(doc(db, 'users', userId), newUserData);
          setUserData(newUserData);
          setActiveClinicId(clinicRef.id);
          router.push('/dashboard');
        }
        setIsLoading(false);
      }
    });

    return () => unsubUser();
  }, [userId, user, activeClinicId, router]);

  // 2. Fetch Active Clinic details
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
        setActiveClinic({ ...data, id: snap.id });
      }
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

  // Firestore actions tied to activeClinicId
  const addPatient = useCallback((p: Patient) => {
    if (!activeClinicId) return;
    const ref = doc(collection(db, 'clinics', activeClinicId, 'patients'));
    setDoc(ref, { ...p, id: ref.id });
  }, [activeClinicId]);

  const updatePatient = useCallback((id: string, p: Partial<Patient>) => {
    if (!activeClinicId) return;
    setDoc(doc(db, 'clinics', activeClinicId, 'patients', id), p, { merge: true });
  }, [activeClinicId]);

  const deletePatient = useCallback((id: string) => {
    if (!activeClinicId) return;
    deleteDoc(doc(db, 'clinics', activeClinicId, 'patients', id));
  }, [activeClinicId]);

  const addAppointment = useCallback((a: Appointment) => {
    if (!activeClinicId) return;
    const ref = doc(collection(db, 'clinics', activeClinicId, 'appointments'));
    setDoc(ref, { ...a, id: ref.id });
  }, [activeClinicId]);

  const updateAppointment = useCallback((id: string, a: Partial<Appointment>) => {
    if (!activeClinicId) return;
    setDoc(doc(db, 'clinics', activeClinicId, 'appointments', id), a, { merge: true });
  }, [activeClinicId]);

  const deleteAppointment = useCallback((id: string) => {
    if (!activeClinicId) return;
    deleteDoc(doc(db, 'clinics', activeClinicId, 'appointments', id));
  }, [activeClinicId]);

  const addInvoice = useCallback((i: Invoice) => {
    if (!activeClinicId) return;
    const ref = doc(collection(db, 'clinics', activeClinicId, 'invoices'));
    setDoc(ref, { ...i, id: ref.id });
  }, [activeClinicId]);

  const updateInvoice = useCallback((id: string, i: Partial<Invoice>) => {
    if (!activeClinicId) return;
    setDoc(doc(db, 'clinics', activeClinicId, 'invoices', id), i, { merge: true });
  }, [activeClinicId]);

  const deleteInvoice = useCallback((id: string) => {
    if (!activeClinicId) return;
    deleteDoc(doc(db, 'clinics', activeClinicId, 'invoices', id));
  }, [activeClinicId]);

  return (
    <StoreContext.Provider value={{
      patients, appointments, invoices,
      userData, activeClinic, activeClinicId, setActiveClinicId, isLoading,
      addPatient, updatePatient, deletePatient,
      addAppointment, updateAppointment, deleteAppointment,
      addInvoice, updateInvoice, deleteInvoice,
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};
