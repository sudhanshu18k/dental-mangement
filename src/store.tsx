'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Patient, Appointment, Invoice } from '@/types';
import { useAuth } from '@clerk/nextjs';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface StoreState {
  patients: Patient[];
  appointments: Appointment[];
  invoices: Invoice[];
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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Sync with Firestore when logged in
  useEffect(() => {
    if (!userId) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setPatients([]);
      setAppointments([]);
      setInvoices([]);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    const unsubPatients = onSnapshot(collection(db, 'users', userId, 'patients'), snap => {
      setPatients(snap.docs.map(d => ({ ...(d.data() as Patient), id: d.id })));
    });

    const unsubAppointments = onSnapshot(collection(db, 'users', userId, 'appointments'), snap => {
      setAppointments(snap.docs.map(d => ({ ...(d.data() as Appointment), id: d.id })));
    });

    const unsubInvoices = onSnapshot(collection(db, 'users', userId, 'invoices'), snap => {
      setInvoices(snap.docs.map(d => ({ ...(d.data() as Invoice), id: d.id })));
    });

    return () => {
      unsubPatients();
      unsubAppointments();
      unsubInvoices();
    };
  }, [userId]);

  // Firestore actions
  const addPatient = useCallback((p: Patient) => {
    if (!userId) return;
    const ref = doc(collection(db, 'users', userId, 'patients'));
    setDoc(ref, { ...p, id: ref.id });
  }, [userId]);

  const updatePatient = useCallback((id: string, p: Partial<Patient>) => {
    if (!userId) return;
    setDoc(doc(db, 'users', userId, 'patients', id), p, { merge: true });
  }, [userId]);

  const deletePatient = useCallback((id: string) => {
    if (!userId) return;
    deleteDoc(doc(db, 'users', userId, 'patients', id));
  }, [userId]);

  const addAppointment = useCallback((a: Appointment) => {
    if (!userId) return;
    const ref = doc(collection(db, 'users', userId, 'appointments'));
    setDoc(ref, { ...a, id: ref.id });
  }, [userId]);

  const updateAppointment = useCallback((id: string, a: Partial<Appointment>) => {
    if (!userId) return;
    setDoc(doc(db, 'users', userId, 'appointments', id), a, { merge: true });
  }, [userId]);

  const deleteAppointment = useCallback((id: string) => {
    if (!userId) return;
    deleteDoc(doc(db, 'users', userId, 'appointments', id));
  }, [userId]);

  const addInvoice = useCallback((i: Invoice) => {
    if (!userId) return;
    const ref = doc(collection(db, 'users', userId, 'invoices'));
    setDoc(ref, { ...i, id: ref.id });
  }, [userId]);

  const updateInvoice = useCallback((id: string, i: Partial<Invoice>) => {
    if (!userId) return;
    setDoc(doc(db, 'users', userId, 'invoices', id), i, { merge: true });
  }, [userId]);

  const deleteInvoice = useCallback((id: string) => {
    if (!userId) return;
    deleteDoc(doc(db, 'users', userId, 'invoices', id));
  }, [userId]);

  return (
    <StoreContext.Provider value={{
      patients, appointments, invoices,
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
