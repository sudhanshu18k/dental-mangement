'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/store';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, User, AlertCircle,
  FileText, IndianRupee, CalendarDays, Clock, Stethoscope,
  ArrowRight, CheckCircle2, Timer, FileDown,
  Receipt, Activity, CreditCard, Shield, StickyNote, Save,
  X, Plus, Printer, Link as LinkIcon
} from 'lucide-react';
import { Invoice, Appointment, RxItem } from '@/types';
import ToothChart from '@/components/ToothChart';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const { patients, appointments, invoices, updateInvoice, updatePatient, updateAppointment } = useStore();

  const patient = patients.find(p => p.id === patientId);

  // Doctor notes local state
  const [notesText, setNotesText] = useState<string | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const displayNotes = notesText !== null ? notesText : (patient?.notes || '');

  const handleSaveNotes = () => {
    if (!patient) return;
    updatePatient(patient.id, { notes: displayNotes });
    setNotesSaved(true);
    setNotesText(null);
    setTimeout(() => setNotesSaved(false), 2000);
  };

  // Prescription Modal State
  const [prescriptionModal, setPrescriptionModal] = useState<string | null>(null);
  const [rxItems, setRxItems] = useState<RxItem[]>([]);
  const [rxNotes, setRxNotes] = useState('');
  const [rxDiagnosis, setRxDiagnosis] = useState('');

  const patientAppointments = useMemo(() =>
    [...appointments.filter(a => a.patientId === patientId)]
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
    [patientId, appointments]
  );

  const recentPrescriptionAppt = useMemo(() => {
    return [...patientAppointments]
      .filter(a => a.status === 'Completed' && ((a.prescription && a.prescription.length > 0) || a.diagnosis || a.notes))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [patientAppointments]);

  const openPrescription = (appt: Appointment) => {
    setPrescriptionModal(appt.id);
    setRxItems(appt.prescription || []);
    setRxNotes(appt.notes || '');
    setRxDiagnosis(appt.diagnosis || '');
  };

  const addRxItem = () => {
    setRxItems([...rxItems, { medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }]);
  };

  const updateRxItem = (idx: number, field: keyof RxItem, val: string) => {
    const updated = [...rxItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setRxItems(updated);
  };

  const removeRxItem = (idx: number) => {
    setRxItems(rxItems.filter((_, i) => i !== idx));
  };

  const handleSavePrescription = () => {
    if (!prescriptionModal) return;
    updateAppointment(prescriptionModal, { prescription: rxItems, notes: rxNotes, diagnosis: rxDiagnosis });
    setPrescriptionModal(null);
  };

  const generatePrescriptionPDF = (appt: Appointment) => {
    if (!patient) return;

    const doc = new jsPDF();
    const docWidth = doc.internal.pageSize.getWidth();

    // Clinic Branding
    let clinicName = 'SmileSync Dental';
    let clinicAddress = '';
    let clinicPhone = '';
    try {
      const saved = localStorage.getItem('smilesync_clinic');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.clinicName) clinicName = data.clinicName;
        if (data.clinicAddress) clinicAddress = data.clinicAddress;
        if (data.clinicPhone) clinicPhone = data.clinicPhone;
      }
    } catch { /* fallback */ }

    doc.setFontSize(22);
    doc.setTextColor(14, 165, 233); // primary
    doc.text(clinicName.toUpperCase(), 15, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(clinicAddress || 'Address not set', 15, 32);
    doc.text(`Phone: ${clinicPhone || 'Not set'}`, 15, 37);
    
    doc.setDrawColor(14, 165, 233);
    doc.setFontSize(24);
    doc.setTextColor(14, 165, 233); // var(--primary)
    doc.setFont('helvetica', 'bold');
    doc.text(clinicName.toUpperCase(), 15, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(clinicAddress || 'Address not set', 15, 31);
    doc.text(`Contact: ${clinicPhone || 'Not set'}`, 15, 36);
    
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(0.8);
    doc.line(15, 42, docWidth - 15, 42);

    // ── Patient Info ──
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Patient Name:`, 15, 52);
    doc.text(`Age / Gender:`, 15, 57);
    doc.text(`Date & Time:`, docWidth - 70, 52);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(patient.name, 45, 52);
    
    // Calculate age from DOB
    const birthDate = new Date(patient.dob);
    const today = new Date();
    let age: string | number = 'N/A';
    if (!isNaN(birthDate.getTime())) {
      age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    }

    doc.text(`${age} yrs / ${patient.gender}`, 45, 57);
    doc.text(`${new Date(appt.date).toLocaleDateString('en-IN')} ${appt.time}`, docWidth - 42, 52);
    
    doc.setDrawColor(240, 240, 240);
    doc.line(15, 65, docWidth - 15, 65);

    let currentY = 75;

    if (appt.diagnosis) {
      doc.setFontSize(11);
      doc.setTextColor(14, 165, 233);
      doc.setFont('helvetica', 'bold');
      doc.text('DIAGNOSIS', 15, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      const splitDiag = doc.splitTextToSize(appt.diagnosis, docWidth - 30);
      doc.text(splitDiag, 15, currentY + 7);
      currentY += doc.getTextDimensions(splitDiag).h + 15;
    }

    // ── Prescription (Rx) Symbol ──
    doc.setFontSize(32);
    doc.setTextColor(14, 165, 233);
    doc.setFont('helvetica', 'bold');
    doc.text('Rx', 15, currentY + 5);

    // ── Medicines Table ──
    autoTable(doc, {
      startY: currentY + 10,
      head: [['Medicine', 'Dosage', 'Frequency', 'Duration', 'Instructions']],
      body: (appt.prescription || []).map(item => [
        item.medicineName,
        item.dosage,
        item.frequency,
        item.duration,
        item.instructions
      ]),
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4, textColor: [50, 50, 50] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        4: { cellWidth: 50 }
      }
    });

    // ── Notes ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalTableY = (doc as any).lastAutoTable.finalY;
    if (appt.notes) {
      const notesY = finalTableY + 15;
      doc.setFontSize(11);
      doc.setTextColor(14, 165, 233);
      doc.setFont('helvetica', 'bold');
      doc.text('CLINICAL NOTES', 15, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      const splitNotes = doc.splitTextToSize(appt.notes, docWidth - 30);
      doc.text(splitNotes, 15, notesY + 7);
    }

    // ── Signature Line ──
    const signatureY = doc.internal.pageSize.getHeight() - 45;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(docWidth - 75, signatureY, docWidth - 15, signatureY);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Doctor\'s Signature', docWidth - 75, signatureY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('(Seal & Signature)', docWidth - 75, signatureY + 11);

    // ── Footer ──
    doc.setFontSize(8);
    doc.setTextColor(170, 170, 170);
    doc.text('Digital Identity: This is a computer-generated document, valid without a physical signature.', 15, doc.internal.pageSize.getHeight() - 15);
    doc.text(`Generated by SmileSync • ${new Date().toLocaleDateString('en-IN')}`, docWidth - 65, doc.internal.pageSize.getHeight() - 15);

    doc.save(`Prescription_${patient.name.replace(/\s+/g, '_')}_${appt.date}.pdf`);
  };

  // Patient invoices
  const patientInvoices = useMemo(() =>
    invoices.filter(i => i.patientId === patientId),
    [patientId, invoices]
  );

  // Stats
  const stats = useMemo(() => {
    const completed = patientAppointments.filter(a => a.status === 'Completed').length;
    const scheduled = patientAppointments.filter(a => a.status === 'Scheduled').length;
    const totalBilled = patientInvoices.reduce((s, i) => s + i.finalAmount, 0);
    const totalPaid = patientInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.finalAmount, 0);
    const allTreatments = patientAppointments.flatMap(a => a.treatments || []);
    const treatmentCost = allTreatments.reduce((s, t) => s + (t.cost || 0), 0);
    const today = new Date().toISOString().split('T')[0];
    const upcomingFollowUps = allTreatments.filter(t => t.followUpDate && t.followUpDate >= today).length;

    return {
      totalVisits: patientAppointments.length,
      completed,
      scheduled,
      cancelled: patientAppointments.filter(a => a.status === 'Cancelled').length,
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid,
      treatmentCost,
      totalTreatments: allTreatments.length,
      upcomingFollowUps,
    };
  }, [patientAppointments, patientInvoices]);

  // Patient age
  const age = useMemo(() => {
    if (!patient?.dob) return null;
    const dob = new Date(patient.dob);
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - dob.getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  }, [patient?.dob]);

  // First visit date (patient since)
  const patientSince = useMemo(() => {
    if (patientAppointments.length === 0) return null;
    const earliest = [...patientAppointments].sort((a, b) => a.date.localeCompare(b.date))[0];
    return earliest.date;
  }, [patientAppointments]);

  // Tooth chart data
  const toothChartData = useMemo(() =>
    patientAppointments.flatMap(app =>
      (app.treatments || []).map(t => ({
        toothNumber: t.toothNumber,
        notes: t.notes,
        cost: t.cost,
        date: app.date,
        status: app.status as 'Completed' | 'Scheduled' | 'Cancelled',
      }))
    ),
    [patientAppointments]
  );

  // PDF download (same as billing page)
  const handleDownloadPDF = async (inv: Invoice) => {
    const appt = appointments.find(a => a.id === inv.appointmentId);
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(14, 165, 233);
    doc.text('SmileSync', 14, 25);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Dental Care & Aesthetics', 15, 31);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('123 Healthcare Avenue', 195, 20, { align: 'right' });
    doc.text('Medical District, City Center', 195, 25, { align: 'right' });
    doc.text('Phone: +91 98765 43210', 195, 30, { align: 'right' });
    doc.text('Email: hello@smilesync.clinic', 195, 35, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 195, 40);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('INVOICE', 14, 52);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text('Invoice No:', 120, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`#INV-${inv.id.slice(-6).toUpperCase()}`, 155, 50);
    doc.setFont("helvetica", "bold");
    doc.text('Date:', 120, 56);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(inv.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }), 155, 56);
    doc.setFont("helvetica", "bold");
    doc.text('Status:', 120, 62);
    const sc = inv.status === 'Paid' ? [16, 185, 129] : [245, 158, 11];
    doc.setTextColor(sc[0], sc[1], sc[2]);
    doc.text(inv.status.toUpperCase(), 155, 62);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text('Bill To:', 14, 65);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(patient?.name || 'Unknown', 14, 71);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    if (patient?.phone) doc.text(`Phone: ${patient.phone}`, 14, 76);
    if (patient?.email) doc.text(`Email: ${patient.email}`, 14, 81);

    const tableData = appt?.treatments.map((t, i) => [
      i + 1, `Tooth #${t.toothNumber} - ${t.notes}`, `₹${t.cost.toLocaleString('en-IN')}`
    ]) || [[1, 'General Dental Treatment', `₹${inv.treatmentCost.toLocaleString('en-IN')}`]];

    autoTable(doc, {
      startY: 90,
      head: [['#', 'Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 2: { cellWidth: 40, halign: 'right' } },
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 5, lineColor: [226, 232, 240] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Subtotal:', 135, cY);
    doc.text(`₹${inv.treatmentCost.toLocaleString('en-IN')}`, 195, cY, { align: 'right' });
    cY += 7;
    if (inv.discount > 0) {
      const da = (inv.treatmentCost * inv.discount) / 100;
      doc.text(`Discount (${inv.discount}%):`, 135, cY);
      doc.setTextColor(16, 185, 129);
      doc.text(`- ₹${da.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 195, cY, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      cY += 7;
    }
    if (inv.tax > 0) {
      const ta = ((inv.treatmentCost - (inv.treatmentCost * inv.discount / 100)) * inv.tax) / 100;
      doc.text(`Tax (${inv.tax}%):`, 135, cY);
      doc.text(`+ ₹${ta.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 195, cY, { align: 'right' });
      cY += 7;
    }
    cY += 2;
    doc.setFillColor(14, 165, 233);
    doc.rect(130, cY, 65, 12, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Total:', 135, cY + 8);
    doc.text(`₹${inv.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 190, cY + 8, { align: 'right' });

    // UPI QR
    cY += 22;
    const upiUrl = `upi://pay?pa=smilesync@upi&pn=${encodeURIComponent('SmileSync Dental')}&am=${inv.finalAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice INV-${inv.id.slice(-6).toUpperCase()}`)}`;
    try {
      const qr = await QRCode.toDataURL(upiUrl, { width: 200, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, cY, 85, 72, 3, 3, 'FD');
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Scan to Pay', 56.5, cY + 8, { align: 'center' });
      doc.addImage(qr, 'PNG', 32, cY + 12, 48, 48);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('UPI: smilesync@upi', 56.5, cY + 66, { align: 'center' });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) { /* fallback silently */ }

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 280, 195, 280);
    doc.text('SmileSync Dental Care Management - Owner Edition', 105, 287, { align: 'center' });
    doc.save(`SmileSync_Invoice_${inv.id.slice(-6).toUpperCase()}.pdf`);
  };

  // Format date
  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  };

  // If patient not found
  if (!patient) {
    return (
      <div>
        <button className="btn" onClick={() => router.push('/patients')} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Back to Patients
        </button>
        <div className="card empty-state" style={{ padding: '3rem' }}>
          <User size={48} style={{ opacity: 0.25, marginBottom: '1rem' }} />
          <h2>Patient Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>This patient record does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Back navigation */}
      <button className="profile-back-btn" onClick={() => router.push('/patients')}>
        <ArrowLeft size={16} /> Back to Patients
      </button>

      {/* ═══════════ PROFILE HEADER ═══════════ */}
      <div className="profile-header-card">
        <div className="profile-header-top">
          <div className="profile-avatar-lg">
            {patient.name.charAt(0).toUpperCase()}
          </div>
          <div className="profile-header-info">
            <div className="profile-name-row">
              <h1 className="profile-name">{patient.name}</h1>
              <div className="profile-badges">
                {patient.gender && (
                  <span className="badge badge-primary">{patient.gender}</span>
                )}
                {age !== null && (
                  <span className="badge" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--secondary)' }}>{age} yrs</span>
                )}
                {patient.allergies && patient.allergies !== 'None' && (
                  <span className="badge badge-danger">
                    <AlertCircle size={11} /> Allergies
                  </span>
                )}
              </div>
            </div>

            <div className="profile-contact-grid">
              {patient.phone && (
                <div className="profile-contact-item">
                  <Phone size={14} />
                  <span>{patient.phone}</span>
                </div>
              )}
              {patient.email && (
                <div className="profile-contact-item">
                  <Mail size={14} />
                  <span>{patient.email}</span>
                </div>
              )}
              {patient.address && (
                <div className="profile-contact-item">
                  <MapPin size={14} />
                  <span>{patient.address}</span>
                </div>
              )}
              {patient.dob && (
                <div className="profile-contact-item">
                  <Calendar size={14} />
                  <span>DOB: {fmt(patient.dob)}</span>
                </div>
              )}
            </div>

            {patientSince && (
              <div className="profile-since">
                <Clock size={12} />
                Patient since {fmt(patientSince)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ STATS ROW ═══════════ */}
      <div className="profile-stats-row">
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--primary)' }}>
            <CalendarDays size={20} />
          </div>
          <div>
            <span className="profile-stat-value">{stats.totalVisits}</span>
            <span className="profile-stat-label">Total Visits</span>
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="profile-stat-value">{stats.completed}</span>
            <span className="profile-stat-label">Completed</span>
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Timer size={20} />
          </div>
          <div>
            <span className="profile-stat-value">{stats.scheduled}</span>
            <span className="profile-stat-label">Scheduled</span>
          </div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-icon" style={{ background: 'rgba(168,85,247,0.1)', color: 'var(--secondary)' }}>
            <IndianRupee size={20} />
          </div>
          <div>
            <span className="profile-stat-value">₹{stats.totalBilled.toLocaleString()}</span>
            <span className="profile-stat-label">Total Billed</span>
          </div>
        </div>
      </div>

      {/* ═══════════ MAIN CONTENT GRID ═══════════ */}
      <div className="profile-grid">
        {/* Left Column */}
        <div className="profile-col-left">

          {/* ═══ Prominent Recent Prescription ═══ */}
          {recentPrescriptionAppt ? (
            <div className="card profile-section" style={{ border: '1px solid #e0f2fe', background: '#f8fafc' }}>
              <h3 className="profile-section-title" style={{ color: '#0369a1' }}>
                <LinkIcon size={16} /> Recent Prescription
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                  {fmt(recentPrescriptionAppt.date)}
                </span>
              </h3>
              
              {recentPrescriptionAppt.diagnosis && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Diagnosis</div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{recentPrescriptionAppt.diagnosis}</div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.05em' }}>Medications</div>
                {(recentPrescriptionAppt.prescription || []).slice(0, 3).map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#334155', background: 'white', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 600 }}>{item.medicineName}</span>
                    <span style={{ color: '#64748b' }}>{item.dosage} • {item.frequency}</span>
                  </div>
                ))}
                {(recentPrescriptionAppt.prescription || []).length > 3 && (
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>+ {(recentPrescriptionAppt.prescription || []).length - 3} more items</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-sm" 
                  onClick={() => openPrescription(recentPrescriptionAppt)}
                  style={{ flex: 1, background: '#e0f2fe', color: '#0ea5e9', fontWeight: 700, borderRadius: '0.75rem', border: 'none' }}
                >
                  <FileText size={14} /> Edit Rx
                </button>
                <button 
                  className="btn btn-sm" 
                  onClick={() => generatePrescriptionPDF(recentPrescriptionAppt)}
                  style={{ flex: 1, background: 'white', color: '#64748b', border: '1px solid #e2e8f0', fontWeight: 600, borderRadius: '0.75rem' }}
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>
          ) : (
            <div className="card profile-section" style={{ border: '1px dashed #e2e8f0', background: 'rgba(255,255,255,0.5)', opacity: 0.8 }}>
               <h3 className="profile-section-title" style={{ opacity: 0.6 }}>
                <LinkIcon size={16} /> No Recent Rx
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', margin: '1rem 0' }}>
                No prescriptions recorded yet.
              </p>
            </div>
          )}


          {/* Medical Details */}
          {(patient.medicalHistory || (patient.allergies && patient.allergies !== 'None')) && (
            <div className="card profile-section">
              <h3 className="profile-section-title">
                <Shield size={16} /> Medical Details
              </h3>
              {patient.allergies && patient.allergies !== 'None' && (
                <div className="profile-medical-alert">
                  <AlertCircle size={15} />
                  <div>
                    <strong>Allergies</strong>
                    <span>{patient.allergies}</span>
                  </div>
                </div>
              )}
              {patient.medicalHistory && (
                <div className="profile-medical-note">
                  <FileText size={15} />
                  <div>
                    <strong>Medical History</strong>
                    <span>{patient.medicalHistory}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Doctor's Notes */}
          <div className="card profile-section">
            <h3 className="profile-section-title">
              <StickyNote size={16} /> Doctor&apos;s Notes
              {notesSaved && (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
            </h3>
            <textarea
              className="form-textarea"
              rows={5}
              placeholder="Jot down general observations, visit remarks, or any notes about this patient..."
              value={displayNotes}
              onChange={e => { setNotesText(e.target.value); setNotesSaved(false); }}
              style={{
                width: '100%',
                resize: 'vertical',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(0,0,0,0.05)',
                padding: '1rem 1.15rem',
                fontSize: '0.92rem',
                lineHeight: '1.7',
                minHeight: '120px',
                background: '#fdfdfe',
                color: 'var(--on-surface)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            />
            {notesText !== null && notesText !== (patient?.notes || '') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveNotes}
                  style={{
                    padding: '0.6rem 1.5rem',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Save size={15} /> Save Notes
                </button>
              </div>
            )}
          </div>

          {/* Billing Summary */}
          <div className="card profile-section">
            <h3 className="profile-section-title">
              <CreditCard size={16} /> Billing Summary
            </h3>
            <div className="profile-billing-grid">
              <div className="profile-billing-item">
                <span className="profile-billing-label">Total Invoiced</span>
                <span className="profile-billing-value">₹{stats.totalBilled.toLocaleString()}</span>
              </div>
              <div className="profile-billing-item">
                <span className="profile-billing-label">Total Paid</span>
                <span className="profile-billing-value" style={{ color: 'var(--success)' }}>₹{stats.totalPaid.toLocaleString()}</span>
              </div>
              <div className="profile-billing-item">
                <span className="profile-billing-label">Outstanding</span>
                <span className="profile-billing-value" style={{ color: stats.outstanding > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  ₹{stats.outstanding.toLocaleString()}
                </span>
              </div>
              <div className="profile-billing-item">
                <span className="profile-billing-label">Treatment Cost</span>
                <span className="profile-billing-value">₹{stats.treatmentCost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Tooth Chart */}
          <div className="card profile-section">
            <h3 className="profile-section-title">
              <Activity size={16} /> Dental Chart
            </h3>
            <ToothChart treatments={toothChartData} />
          </div>
        </div>

        {/* Right Column */}
        <div className="profile-col-right">

          {/* Treatment Timeline */}
          <div className="card profile-section">
            <h3 className="profile-section-title">
              <Stethoscope size={16} /> Treatment Timeline
              {stats.upcomingFollowUps > 0 && (
                <span className="badge badge-primary" style={{ marginLeft: 'auto', fontSize: '0.72rem' }}>
                  {stats.upcomingFollowUps} follow-up{stats.upcomingFollowUps > 1 ? 's' : ''}
                </span>
              )}
            </h3>

            {patientAppointments.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <Stethoscope size={32} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                <p>No appointments yet.</p>
              </div>
            ) : (
              <div className="timeline">
                {patientAppointments.map((app, idx) => {
                  const apptCost = (app.treatments || []).reduce((s, t) => s + (t.cost || 0), 0);
                  const linkedInv = patientInvoices.find(i => i.appointmentId === app.id);

                  return (
                    <div key={app.id} className="timeline-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                      <div className="timeline-indicator">
                        <div className={`timeline-dot timeline-dot-${app.status === 'Completed' ? 'success' : app.status === 'Cancelled' ? 'danger' : 'primary'}`} />
                        {idx < patientAppointments.length - 1 && <div className="timeline-line" />}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <div>
                            <div className="timeline-date">
                              <CalendarDays size={13} />
                              {fmt(app.date)}
                              <span className="timeline-time"><Clock size={12} /> {app.time}</span>
                            </div>
                            <h4 className="timeline-title">{app.treatmentType || 'General Checkup'}</h4>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {app.status === 'Completed' && (
                              <div style={{ display: 'flex', gap: '0.5rem', marginRight: '0.5rem' }}>
                                <button 
                                  className="btn btn-sm" 
                                  onClick={() => openPrescription(app)} 
                                  title="Write or Edit Prescription" 
                                  style={{ 
                                    color: '#0ea5e9', 
                                    background: '#e0f2fe', 
                                    padding: '0.4rem 0.85rem',
                                    borderRadius: '2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <LinkIcon size={14} />
                                  {((app.prescription && app.prescription.length > 0) || app.notes || app.diagnosis) ? 'View Rx' : 'Rx'}
                                </button>
                                {((app.prescription && app.prescription.length > 0) || app.notes || app.diagnosis) && (
                                  <button
                                    className="btn btn-icon btn-sm"
                                    onClick={() => generatePrescriptionPDF(app)}
                                    title="Download Rx PDF"
                                    style={{
                                      color: '#64748b',
                                      background: 'var(--surface-container-high)',
                                      border: '1px solid var(--outline-variant)',
                                      borderRadius: '50%',
                                      width: '32px',
                                      height: '32px'
                                    }}
                                  >
                                    <FileDown size={14} />
                                  </button>
                                )}
                              </div>
                            )}
                            {apptCost > 0 && <span className="timeline-cost">₹{apptCost.toLocaleString()}</span>}
                            <span className={`badge badge-${app.status === 'Completed' ? 'success' : app.status === 'Cancelled' ? 'danger' : 'primary'}`}>
                              {app.status}
                            </span>
                          </div>
                        </div>

                        {app.treatments && app.treatments.length > 0 ? (
                          <div className="timeline-treatments">
                            {app.treatments.map(t => (
                              <div key={t.id} className="treatment-card">
                                <div className="treatment-card-header">
                                  <span className="treatment-tooth">🦷 Tooth #{t.toothNumber}</span>
                                  <span className="treatment-cost-tag">₹{t.cost.toLocaleString()}</span>
                                </div>
                                <p className="treatment-notes">{t.notes}</p>
                                {t.followUpDate && (
                                  <div className="treatment-followup">
                                    <ArrowRight size={12} /> Follow-up: {fmt(t.followUpDate)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="timeline-no-treatments">No treatments recorded.</p>
                        )}

                        {linkedInv && (
                          <div className="timeline-invoice-tag">
                            <IndianRupee size={12} />
                            Invoice #{linkedInv.id.slice(-6)} —{' '}
                            <span style={{ color: linkedInv.status === 'Paid' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                              {linkedInv.status}
                            </span>
                            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>₹{linkedInv.finalAmount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invoices Panel */}
          <div className="card profile-section">
            <h3 className="profile-section-title">
              <Receipt size={16} /> Invoices
              <span className="badge" style={{ marginLeft: 'auto', fontSize: '0.72rem', background: 'var(--info-bg)', color: 'var(--primary)' }}>
                {patientInvoices.length}
              </span>
            </h3>

            {patientInvoices.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <Receipt size={28} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
                <p>No invoices generated yet.</p>
              </div>
            ) : (
              <div className="profile-invoices-list">
                {patientInvoices.map(inv => {
                  const appt = appointments.find(a => a.id === inv.appointmentId);
                  return (
                    <div key={inv.id} className="profile-invoice-item">
                      <div className="profile-invoice-top">
                        <div>
                          <span className="profile-invoice-id">#INV-{inv.id.slice(-6).toUpperCase()}</span>
                          <span className="profile-invoice-date">{fmt(inv.date)}</span>
                        </div>
                        <span className="profile-invoice-amount">₹{inv.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {appt && (
                        <div className="profile-invoice-desc">
                          {appt.treatmentType || 'General Treatment'} — {appt.treatments.length} procedure{appt.treatments.length !== 1 ? 's' : ''}
                        </div>
                      )}
                      <div className="profile-invoice-actions">
                        <select
                          className="form-select profile-invoice-status-select"
                          value={inv.status}
                          onChange={e => updateInvoice(inv.id, { status: e.target.value as Invoice['status'] })}
                        >
                          <option value="Pending">⏳ Pending</option>
                          <option value="Paid">✅ Paid</option>
                        </select>
                        <button className="btn btn-icon" title="Download PDF" onClick={() => handleDownloadPDF(inv)}>
                          <FileDown size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Prescription Modal ═══ */}
      {prescriptionModal && (
        <div className="modal-overlay" onClick={() => setPrescriptionModal(null)}>
          <div className="modal-content" style={{ width: '800px', maxWidth: '95vw', padding: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '1.5rem', borderBottom: '1px solid var(--outline-variant)' }}>
              <div>
                <h2 className="modal-title">Prescription & Clinical Notes</h2>
                <p className="modal-subtitle">Add medications and visit details</p>
              </div>
              <button className="btn btn-icon" onClick={() => setPrescriptionModal(null)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.5rem' }}>
              
              {/* Diagnosis */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Stethoscope size={18} style={{ color: 'var(--primary)' }} /> Diagnosis
                </h3>
                <input
                  className="form-input"
                  style={{ borderRadius: '0.75rem', background: 'white' }}
                  value={rxDiagnosis}
                  onChange={e => setRxDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Pulpitis, Dental Caries, Gingivitis"
                />
              </div>

              {/* Prescription Items */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} style={{ color: 'var(--primary)' }} /> Medicines
                  </h3>
                  <button className="btn btn-sm btn-outline" onClick={addRxItem}>
                    <Plus size={14} /> Add Medicine
                  </button>
                </div>

                <div className="table-wrapper" style={{ border: '1px solid var(--outline-variant)', borderRadius: '0.75rem', overflowX: 'auto', background: 'white' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '750px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-container-low)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 0.5rem', width: '50px', textAlign: 'center' }}></th>
                        <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, width: '28%', color: 'var(--on-surface-variant)' }}>MEDICINE NAME</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, width: '15%', color: 'var(--on-surface-variant)' }}>DOSAGE</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, width: '15%', color: 'var(--on-surface-variant)' }}>FREQ</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, width: '12%', color: 'var(--on-surface-variant)' }}>DUR</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem', fontWeight: 800, width: '25%', color: 'var(--on-surface-variant)' }}>NOTES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rxItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '0.88rem', background: 'white' }}>
                            No medicines added. Click &quot;Add Medicine&quot; to start.
                          </td>
                        </tr>
                      ) : (
                        rxItems.map((item, idx) => (
                          <tr key={idx} style={{ background: 'white', borderTop: '1px solid var(--outline-variant)' }}>
                            <td style={{ padding: '0.35rem', textAlign: 'center' }}>
                              <button 
                                type="button"
                                onClick={() => removeRxItem(idx)}
                                style={{ 
                                  width: '28px',
                                  height: '28px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: 'rgba(239, 68, 68, 0.1)', 
                                  color: 'var(--danger)', 
                                  border: '1px solid rgba(239, 68, 68, 0.2)',
                                  borderRadius: '0.4rem',
                                  cursor: 'pointer',
                                }}
                                title="Remove row"
                              >
                                <X size={14} strokeWidth={3} />
                              </button>
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <input className="form-input" style={{ width: '100%', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', fontSize: '0.8rem', height: '2.4rem', padding: '0 0.5rem' }} value={item.medicineName} onChange={e => updateRxItem(idx, 'medicineName', e.target.value)} placeholder="Medicine Name" />
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <input className="form-input" style={{ width: '100%', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', fontSize: '0.8rem', height: '2.4rem', padding: '0 0.5rem' }} value={item.dosage} onChange={e => updateRxItem(idx, 'dosage', e.target.value)} placeholder="1 tab" />
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <input className="form-input" style={{ width: '100%', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', fontSize: '0.8rem', height: '2.4rem', padding: '0 0.5rem' }} value={item.frequency} onChange={e => updateRxItem(idx, 'frequency', e.target.value)} placeholder="1-0-1" />
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <input className="form-input" style={{ width: '100%', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', fontSize: '0.8rem', height: '2.4rem', padding: '0 0.5rem' }} value={item.duration} onChange={e => updateRxItem(idx, 'duration', e.target.value)} placeholder="5d" />
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              <input className="form-input" style={{ width: '100%', border: '1px solid var(--outline-variant)', background: 'var(--surface-container-low)', fontSize: '0.8rem', height: '2.4rem', padding: '0 0.5rem' }} value={item.instructions} onChange={e => updateRxItem(idx, 'instructions', e.target.value)} placeholder="Eat after food" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: 'var(--primary)' }} /> Clinical Notes
                </h3>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={rxNotes}
                  onChange={e => setRxNotes(e.target.value)}
                  placeholder="Record diagnosis, observations, or general advice for the patient..."
                  style={{ borderRadius: '0.75rem', background: 'white' }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--outline-variant)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', background: 'var(--surface-container-lowest)', borderBottomLeftRadius: '1.5rem', borderBottomRightRadius: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    const appt = appointments.find(a => a.id === prescriptionModal);
                    if (appt) generatePrescriptionPDF({ ...appt, prescription: rxItems, notes: rxNotes, diagnosis: rxDiagnosis });
                  }}
                  disabled={rxItems.length === 0 && !rxNotes && !rxDiagnosis}
                >
                  <Printer size={16} /> Print Prescription
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-ghost" onClick={() => setPrescriptionModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSavePrescription}>Save Rx & Notes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
