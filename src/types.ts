export type Patient = {
  id: string;
  name: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  address: string;
  medicalHistory: string;
  allergies: string;
  notes?: string;
};

export type RxItem = {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

export type Treatment = {
  id: string;
  toothNumber: string;
  notes: string;
  cost: number;
  followUpDate: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  date: string;
  time: string;
  treatmentType: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  treatments: Treatment[];
  prescription?: RxItem[];
  diagnosis?: string;
  notes?: string;
};

export type InvoiceItem = {
  description: string;
  amount: number;
};

export type Invoice = {
  id: string;
  appointmentId?: string;
  patientId: string;
  treatmentCost: number;
  discount: number;
  tax: number;
  finalAmount: number;
  status: 'Paid' | 'Pending';
  date: string;
  items?: InvoiceItem[];
  notes?: string;
};

export type ClinicRole = 'owner' | 'admin' | 'staff';

export type SubscriptionPlan = {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  duration: number;
  maxPatients?: number;
  maxAppointments?: number;
  isActive: boolean;
  createdAt: string;
};

export type Clinic = {
  id: string;
  name: string;
  joinCode?: string;
  primaryColor?: string;
  logoUrl?: string;
  subscriptionStatus: 'manual' | 'active' | 'inactive' | 'trial' | 'expired' | 'locked' | 'pending';
  subscriptionPlan?: string;
  subscriptionPlanId?: string;
  subscriptionEndDate?: string;
  subscriptionStartDate?: string;
  trialStartDate?: string;
};

export type UserData = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  isSuperAdmin?: boolean;
  isLocked?: boolean;
  clinics: {
    clinicId: string;
    name: string;
    role: ClinicRole;
  }[];
};

export type SubscriptionHistoryEntry = {
  id: string;
  clinicId: string;
  email: string;
  action: 'plan_assigned' | 'activated' | 'deactivated' | 'locked' | 'expired' | 'trial_started' | 'plan_created' | 'plan_deleted';
  planName?: string;
  amount?: number;
  cycle?: string;
  note?: string;
  timestamp: string;
  performedBy: string;
};

export type SupportTicket = {
  id: string;
  clinicId: string;
  clinicName: string;
  userEmail: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
};

export type FollowUpType = 'post_treatment' | 'routine_checkup' | 'missed_appointment';
export type FollowUpStatus = 'pending' | 'sent' | 'dismissed';

export type FollowUp = {
  id: string;
  patientId: string;
  appointmentId: string;
  type: FollowUpType;
  dueDate: string;
  status: FollowUpStatus;
  treatmentType?: string;
  notes?: string;
  createdAt: string;
  sentAt?: string;
  dismissedAt?: string;
  templateId?: string;
};

export type FollowUpTemplate = {
  id: string;
  name: string;
  type: FollowUpType;
  treatmentType?: string;
  message: string;
  isDefault: boolean;
  createdAt: string;
};