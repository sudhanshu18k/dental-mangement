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
