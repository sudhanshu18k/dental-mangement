/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Patient, Appointment, Invoice, UserData, Clinic, FollowUp, FollowUpTemplate } from '@/types';
import { useAuth, useUser } from '@clerk/nextjs';
import { collection, doc, setDoc, deleteDoc, onSnapshot, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface StoreState {
  patients: Patient[];
  appointments: Appointment[];
  invoices: Invoice[];
  followUps: FollowUp[];
  followUpTemplates: FollowUpTemplate[];
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
  addFollowUp: (f: FollowUp) => void;
  updateFollowUp: (id: string, f: Partial<FollowUp>) => void;
  deleteFollowUp: (id: string) => void;
  addFollowUpTemplate: (t: FollowUpTemplate) => void;
  updateFollowUpTemplate: (id: string, t: Partial<FollowUpTemplate>) => void;
  deleteFollowUpTemplate: (id: string) => void;
  generateFollowUpsForAppointment: (appt: Appointment) => void;
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
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpTemplates, setFollowUpTemplates] = useState<FollowUpTemplate[]>([]);
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
      setFollowUps([]);
      setFollowUpTemplates([]);
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

        let needsUpdate = false;
        if (user) {
          if (!data.name && user.fullName) {
            data.name = user.fullName;
            needsUpdate = true;
          }
          if (!data.phone && user.primaryPhoneNumber?.phoneNumber) {
            data.phone = user.primaryPhoneNumber.phoneNumber;
            needsUpdate = true;
          }
        }

        if (needsUpdate || data.isSuperAdmin !== (snap.data() as UserData).isSuperAdmin) {
          const updatePayload: Record<string, string | boolean | null> = { isSuperAdmin: !!data.isSuperAdmin };
          if (data.name !== undefined) updatePayload.name = data.name || null;
          if (data.phone !== undefined) updatePayload.phone = data.phone || null;
          await updateDoc(doc(db, 'users', userId), updatePayload);
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
          if (user.fullName) newUserData.name = user.fullName;
          if (user.primaryPhoneNumber?.phoneNumber) newUserData.phone = user.primaryPhoneNumber.phoneNumber;
          
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
      setFollowUps([]);
      setFollowUpTemplates([]);
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

    const unsubFollowUps = onSnapshot(collection(db, 'clinics', activeClinicId, 'followUps'), snap => {
      setFollowUps(snap.docs.map(d => ({ ...(d.data() as FollowUp), id: d.id })));
    });

    const unsubTemplates = onSnapshot(collection(db, 'clinics', activeClinicId, 'followUpTemplates'), async (snap) => {
      const templates = snap.docs.map(d => ({ ...(d.data() as FollowUpTemplate), id: d.id }));
      if (templates.length === 0) {
        // Seed default templates
        const defaults: Omit<FollowUpTemplate, 'id'>[] = [
          {
            name: 'Post Treatment Follow-up',
            type: 'post_treatment',
            message: 'Hello {{patientName}}, this is a follow-up from *{{clinicName}}*. How are you feeling after your *{{treatmentType}}*? Please let us know if you have any pain or concerns.\n\n📅 *Your next visit is scheduled for:* {{followUpDate}}\n\nPlease reply to confirm or reschedule. 🙏',
            isDefault: true,
            createdAt: new Date().toISOString(),
          },
          {
            name: 'Routine Checkup Reminder',
            type: 'routine_checkup',
            message: 'Hello {{patientName}}, it\'s time for your routine dental checkup at *{{clinicName}}*! 😊\n\n📅 *Suggested visit date:* {{followUpDate}}\n\nRegular checkups help keep your smile healthy. Please reply to book your appointment!',
            isDefault: true,
            createdAt: new Date().toISOString(),
          },
          {
            name: 'Missed Appointment',
            type: 'missed_appointment',
            message: 'Hello {{patientName}}, we noticed you missed your appointment at *{{clinicName}}* on *{{appointmentDate}}*. We\'d love to reschedule at your convenience!\n\n📅 *We suggest visiting on:* {{followUpDate}}\n\nPlease reply or call us to confirm. 📞',
            isDefault: true,
            createdAt: new Date().toISOString(),
          },
        ];
        for (const t of defaults) {
          const ref = doc(collection(db, 'clinics', activeClinicId, 'followUpTemplates'));
          await setDoc(ref, { ...t, id: ref.id });
        }
      } else {
        setFollowUpTemplates(templates);
      }
    });

    return () => {
      unsubPatients();
      unsubAppointments();
      unsubInvoices();
      unsubFollowUps();
      unsubTemplates();
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

  // ── Follow-Up CRUD ──
  const addFollowUp = useCallback((f: FollowUp) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    const ref = doc(collection(db, 'clinics', activeClinicId, 'followUps'));
    setDoc(ref, { ...f, id: ref.id });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const updateFollowUp = useCallback((id: string, f: Partial<FollowUp>) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    setDoc(doc(db, 'clinics', activeClinicId, 'followUps', id), f, { merge: true });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const deleteFollowUp = useCallback((id: string) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    deleteDoc(doc(db, 'clinics', activeClinicId, 'followUps', id));
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  // ── Follow-Up Template CRUD ──
  const addFollowUpTemplate = useCallback((t: FollowUpTemplate) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    const ref = doc(collection(db, 'clinics', activeClinicId, 'followUpTemplates'));
    setDoc(ref, { ...t, id: ref.id });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const updateFollowUpTemplate = useCallback((id: string, t: Partial<FollowUpTemplate>) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    setDoc(doc(db, 'clinics', activeClinicId, 'followUpTemplates', id), t, { merge: true });
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  const deleteFollowUpTemplate = useCallback((id: string) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }
    deleteDoc(doc(db, 'clinics', activeClinicId, 'followUpTemplates', id));
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  // ── Smart Treatment → Follow-Up Interval Map ──
  // Each treatment type maps to an array of follow-ups with specific intervals
  const TREATMENT_FOLLOWUP_MAP: Record<string, { type: FollowUp['type']; daysAfter: number; label: string }[]> = {
    // Surgical / Invasive
    'root canal':       [{ type: 'post_treatment', daysAfter: 7, label: 'Post Root Canal Check' }],
    'extraction':       [{ type: 'post_treatment', daysAfter: 1, label: 'Post Extraction Check' }, { type: 'post_treatment', daysAfter: 7, label: '1-Week Healing Check' }],
    'surgery':          [{ type: 'post_treatment', daysAfter: 1, label: 'Post Surgery Check' }, { type: 'post_treatment', daysAfter: 14, label: '2-Week Healing Review' }],
    'implant':          [{ type: 'post_treatment', daysAfter: 7, label: 'Post Implant Check' }, { type: 'post_treatment', daysAfter: 90, label: '3-Month Implant Review' }],
    'wisdom tooth':     [{ type: 'post_treatment', daysAfter: 2, label: 'Post Wisdom Tooth Extraction' }, { type: 'post_treatment', daysAfter: 7, label: '1-Week Healing Check' }],

    // Restorative
    'filling':          [{ type: 'post_treatment', daysAfter: 14, label: 'Post Filling Sensitivity Check' }],
    'crown':            [{ type: 'post_treatment', daysAfter: 7, label: 'Crown Fit Check' }, { type: 'routine_checkup', daysAfter: 180, label: '6-Month Crown Review' }],
    'bridge':           [{ type: 'post_treatment', daysAfter: 7, label: 'Bridge Fit Check' }, { type: 'routine_checkup', daysAfter: 180, label: '6-Month Bridge Review' }],
    'veneer':           [{ type: 'post_treatment', daysAfter: 7, label: 'Veneer Check' }],
    'denture':          [{ type: 'post_treatment', daysAfter: 3, label: 'Denture Adjustment' }, { type: 'post_treatment', daysAfter: 14, label: '2-Week Denture Review' }],
    'inlay':            [{ type: 'post_treatment', daysAfter: 14, label: 'Inlay/Onlay Check' }],
    'onlay':            [{ type: 'post_treatment', daysAfter: 14, label: 'Inlay/Onlay Check' }],

    // Orthodontics
    'braces':           [{ type: 'post_treatment', daysAfter: 30, label: 'Monthly Braces Adjustment' }],
    'orthodontic':      [{ type: 'post_treatment', daysAfter: 30, label: 'Monthly Orthodontic Check' }],
    'aligner':          [{ type: 'post_treatment', daysAfter: 14, label: 'Aligner Progress Check' }],
    'retainer':         [{ type: 'post_treatment', daysAfter: 90, label: '3-Month Retainer Check' }],

    // Periodontal
    'scaling':          [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Cleaning Recall' }],
    'cleaning':         [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Cleaning Recall' }],
    'polishing':        [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Cleaning Recall' }],
    'deep cleaning':    [{ type: 'post_treatment', daysAfter: 30, label: '1-Month Perio Re-evaluation' }, { type: 'routine_checkup', daysAfter: 90, label: '3-Month Perio Maintenance' }],
    'gum treatment':    [{ type: 'post_treatment', daysAfter: 14, label: '2-Week Gum Check' }, { type: 'routine_checkup', daysAfter: 90, label: '3-Month Perio Review' }],
    'gum surgery':      [{ type: 'post_treatment', daysAfter: 7, label: 'Post Gum Surgery Check' }],

    // Cosmetic
    'whitening':        [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Whitening Touch-up' }],
    'bleaching':        [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Bleaching Review' }],
    'bonding':          [{ type: 'post_treatment', daysAfter: 14, label: 'Bonding Check' }],

    // Pediatric
    'sealant':          [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Sealant Check' }],
    'fluoride':         [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Fluoride Application' }],
    'space maintainer': [{ type: 'post_treatment', daysAfter: 30, label: 'Space Maintainer Check' }],

    // General
    'consultation':     [{ type: 'routine_checkup', daysAfter: 7, label: 'Follow-up Consultation' }],
    'checkup':          [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Routine Checkup' }],
    'check-up':         [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Routine Checkup' }],
    'routine':          [{ type: 'routine_checkup', daysAfter: 180, label: '6-Month Routine Checkup' }],
    'x-ray':            [],
    'xray':             [],
  };

  // Helper: match treatment to follow-up rules
  const getFollowUpRules = (treatmentType: string) => {
    const lower = treatmentType.toLowerCase().trim();
    // Try exact match first
    if (TREATMENT_FOLLOWUP_MAP[lower]) return TREATMENT_FOLLOWUP_MAP[lower];
    // Try partial match
    for (const [key, rules] of Object.entries(TREATMENT_FOLLOWUP_MAP)) {
      if (lower.includes(key) || key.includes(lower)) return rules;
    }
    // Fallback: generic post-treatment at 7 days
    return [{ type: 'post_treatment' as const, daysAfter: 7, label: 'Post Treatment Follow-up' }];
  };

  // ── Auto-generate follow-ups for a completed/cancelled appointment ──
  const generateFollowUpsForAppointment = useCallback(async (appt: Appointment) => {
    if (!activeClinicId) return;
    if (isReadOnly) { showReadOnlyToast(); return; }

    // Check if follow-ups already exist for this appointment
    const existingSnap = await getDocs(
      query(collection(db, 'clinics', activeClinicId, 'followUps'), where('appointmentId', '==', appt.id))
    );
    const existingLabels = existingSnap.docs.map(d => (d.data() as FollowUp).notes || '');

    const now = new Date();

    if (appt.status === 'Completed') {
      const rules = getFollowUpRules(appt.treatmentType || 'general');

      for (const rule of rules) {
        // Skip if a follow-up with same label already exists
        if (existingLabels.includes(rule.label)) continue;

        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + rule.daysAfter);
        const ref = doc(collection(db, 'clinics', activeClinicId, 'followUps'));
        await setDoc(ref, {
          id: ref.id,
          patientId: appt.patientId,
          appointmentId: appt.id,
          type: rule.type,
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'pending',
          treatmentType: appt.treatmentType || '',
          notes: rule.label,
          createdAt: now.toISOString(),
        });
      }
    } else if (appt.status === 'Cancelled') {
      // Missed appointment follow-up (1 day later)
      if (!existingLabels.includes('Missed Appointment')) {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 1);
        const ref = doc(collection(db, 'clinics', activeClinicId, 'followUps'));
        await setDoc(ref, {
          id: ref.id,
          patientId: appt.patientId,
          appointmentId: appt.id,
          type: 'missed_appointment',
          dueDate: dueDate.toISOString().split('T')[0],
          status: 'pending',
          treatmentType: appt.treatmentType || '',
          notes: 'Missed Appointment',
          createdAt: now.toISOString(),
        });
      }
    }
  }, [activeClinicId, isReadOnly, showReadOnlyToast]);

  return (
    <StoreContext.Provider value={{
      patients, appointments, invoices, followUps, followUpTemplates,
      userData, activeClinic, activeClinicId, setActiveClinicId, isLoading,
      isReadOnly, subscriptionDaysLeft,
      addPatient, updatePatient, deletePatient,
      addAppointment, updateAppointment, deleteAppointment,
      addInvoice, updateInvoice, deleteInvoice,
      addFollowUp, updateFollowUp, deleteFollowUp,
      addFollowUpTemplate, updateFollowUpTemplate, deleteFollowUpTemplate,
      generateFollowUpsForAppointment,
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
