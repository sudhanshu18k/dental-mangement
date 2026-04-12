'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { CalendarDays, Plus, Edit2, Trash2, X, Stethoscope, ChevronLeft, ChevronRight, Clock, User, MessageCircle, Send, Search, ChevronDown, UserPlus, FileText, Printer, Trash } from 'lucide-react';
import { Appointment, Treatment, RxItem } from '@/types';
import ToothSelector from '@/components/ToothSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* Temp fields for the initial treatment when creating */
interface ModalState extends Partial<Appointment> {
  tempTeeth?: string[];
  tempCost?: number;
  tempFollowUpDate?: string;
}

/* ─── helpers ─── */
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number) { return n.toString().padStart(2, '0'); }
function toDateStr(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function isToday(y: number, m: number, d: number) {
  const t = new Date();
  return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d;
}

export default function AppointmentsPage() {
  const { patients, appointments, addPatient, addAppointment, updateAppointment, deleteAppointment } = useStore();

  /* ── Calendar state ── */
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(now.getFullYear(), now.getMonth(), now.getDate()));

  /* ── Modal state ── */
  const [apptModal, setApptModal] = useState<'add' | 'edit' | null>(null);
  const [current, setCurrent] = useState<ModalState>({});
  const [treatmentModal, setTreatmentModal] = useState<string | null>(null);
  const [newTreatment, setNewTreatment] = useState<Partial<Treatment>>({});

  /* ── Patient search combobox state ── */
  const [patientSearch, setPatientSearch] = useState('');
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [inlineNewName, setInlineNewName] = useState('');
  const [inlineNewPhone, setInlineNewPhone] = useState('');

  /* ── Prescription State ── */
  const [prescriptionModal, setPrescriptionModal] = useState<string | null>(null);
  const [rxItems, setRxItems] = useState<RxItem[]>([]);
  const [rxNotes, setRxNotes] = useState('');

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  /* ── Calendar grid ── */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const pm = viewMonth === 0 ? 11 : viewMonth - 1;
      const py = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day: daysInPrevMonth - i, month: pm, year: py, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true });
    }
    // Next month leading days (fill to 42 = 6 rows)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nm = viewMonth === 11 ? 0 : viewMonth + 1;
      const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ day: d, month: nm, year: ny, isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  /* ── Map dates → appointment counts for dots ── */
  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  /* ── Selected day appointments ── */
  const dayAppointments = useMemo(() => {
    return (apptsByDate[selectedDate] || []).sort((a, b) => a.time.localeCompare(b.time));
  }, [apptsByDate, selectedDate]);

  /* ── Nav ── */
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear()); setViewMonth(t.getMonth());
    setSelectedDate(toDateStr(t.getFullYear(), t.getMonth(), t.getDate()));
  };

  const openAdd = (date?: string) => {
    setCurrent({ status: 'Scheduled', treatments: [], date: date || selectedDate });
    setPatientSearch('');
    setPatientDropdownOpen(false);
    setApptModal('add');
  };
  const openEdit = (a: Appointment) => {
    setCurrent(a);
    const p = patients.find(p => p.id === a.patientId);
    setPatientSearch(p ? `${p.name} (${p.phone})` : '');
    setPatientDropdownOpen(false);
    setApptModal('edit');
  };
  const closeAppt = () => { setApptModal(null); setCurrent({}); setPatientSearch(''); setPatientDropdownOpen(false); setShowInlineAdd(false); };

  const handleAddNewPatient = () => {
    const name = inlineNewName.trim() || patientSearch.trim();
    if (!name) return;
    const newId = 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
    const newPatient: any = {
      id: newId,
      name,
      phone: inlineNewPhone.trim(),
      email: '',
      address: '',
      gender: 'Other',
      age: '',
      medicalHistory: '',
      bloodGroup: '',
      createdAt: new Date().toISOString()
    };
    addPatient(newPatient);
    setCurrent({ ...current, patientId: newId });
    setPatientSearch(`${newPatient.name} (${newPatient.phone || 'New'})`);
    setPatientDropdownOpen(false);
    setShowInlineAdd(false);
    setInlineNewName('');
    setInlineNewPhone('');
  };

  const openPrescription = (appt: Appointment) => {
    setPrescriptionModal(appt.id);
    setRxItems(appt.prescription || []);
    setRxNotes(appt.notes || '');
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
    updateAppointment(prescriptionModal, { prescription: rxItems, notes: rxNotes });
    setPrescriptionModal(null);
  };

  const generatePrescriptionPDF = (appt: Appointment) => {
    const patient = patients.find(p => p.id === appt.patientId);
    if (!patient) return;

    const doc = new jsPDF();
    const docWidth = doc.internal.pageSize.getWidth();

    // ── Clinic Branding ──
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
    doc.setTextColor(14, 165, 233); // var(--primary)
    doc.text(clinicName.toUpperCase(), 15, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(clinicAddress || 'Address not set', 15, 32);
    doc.text(`Phone: ${clinicPhone || 'Not set'}`, 15, 37);
    
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(0.5);
    doc.line(15, 42, docWidth - 15, 42);

    // ── Patient Info ──
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFO', 15, 52);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Name: ${patient.name}`, 15, 58);
    // Calculate age from DOB
    const birthDate = new Date(patient.dob);
    const today = new Date();
    let age: string | number = 'N/A';
    if (!isNaN(birthDate.getTime())) {
      age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    }

    doc.text(`Age/Sex: ${age} / ${patient.gender}`, 15, 63);
    doc.text(`Date: ${new Date(appt.date).toLocaleDateString('en-IN')}`, docWidth - 50, 58);
    
    doc.setDrawColor(230, 230, 230);
    doc.line(15, 68, docWidth - 15, 68);

    // ── Prescription (Rx) Symbol ──
    doc.setFontSize(28);
    doc.setTextColor(14, 165, 233);
    doc.text('Rx', 15, 80);

    // ── Medicines Table ──
    autoTable(doc, {
      startY: 85,
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
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        4: { cellWidth: 50 }
      }
    });

    // ── Notes ──
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    if (appt.notes) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CLINICAL NOTES:', 15, finalY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitNotes = doc.splitTextToSize(appt.notes, docWidth - 30);
      doc.text(splitNotes, 15, finalY + 7);
    }

    // ── Footer ──
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('Digital Signature: This is an electronically generated prescription.', 15, doc.internal.pageSize.getHeight() - 15);
    doc.text(`Generated by SmileSync on ${new Date().toLocaleString()}`, docWidth - 85, doc.internal.pageSize.getHeight() - 15);

    doc.save(`Prescription_${patient.name.replace(/\s+/g, '_')}_${appt.date}.pdf`);
  };

  const handleSaveAppt = (e: React.FormEvent) => {
    e.preventDefault();
    const treatmentsToSave = current.treatments || [];

    if (apptModal === 'add' && current.tempTeeth && current.tempTeeth.length > 0 && current.treatmentType) {
      const totalCost = current.tempCost || 0;
      const teethCount = current.tempTeeth.length;
      const costPerTooth = Math.floor(totalCost / teethCount);
      const remainder = totalCost - costPerTooth * teethCount;

      current.tempTeeth.forEach((tooth, idx) => {
        treatmentsToSave.push({
          id: 't' + Date.now() + idx,
          toothNumber: tooth,
          notes: current.treatmentType!,
          cost: costPerTooth + (idx === teethCount - 1 ? remainder : 0),
          followUpDate: current.tempFollowUpDate || ''
        });
      });
    }

    const apptData: Appointment = {
      id: current.id || 'a' + Date.now(),
      patientId: current.patientId!,
      date: current.date!,
      time: current.time!,
      treatmentType: current.treatmentType || '',
      status: current.status || 'Scheduled',
      treatments: treatmentsToSave
    };

    if (apptModal === 'edit' && current.id) {
      updateAppointment(current.id, apptData);
    } else {
      addAppointment(apptData);
    }
    closeAppt();
  };

  const handleSaveTreatment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treatmentModal) return;
    const appt = appointments.find(a => a.id === treatmentModal);
    if (appt) {
      const t: Treatment = { ...newTreatment, id: 't' + Date.now(), cost: Number(newTreatment.cost) } as Treatment;
      updateAppointment(treatmentModal, { treatments: [...appt.treatments, t] });
    }
    setTreatmentModal(null);
    setNewTreatment({});
  };

  /* ── WhatsApp Reminder ── */
  const sendWhatsAppReminder = (appt: Appointment) => {
    const patient = patients.find(p => p.id === appt.patientId);
    if (!patient?.phone) {
      alert('This patient has no phone number on file.');
      return;
    }

    // Read clinic name and address from localStorage
    let clinicLabel = 'SmileSync Dental';
    let clinicAddress = '';
    try {
      const saved = localStorage.getItem('smilesync_clinic');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.clinicName) clinicLabel = data.clinicName;
        if (data.clinicAddress) clinicAddress = data.clinicAddress;
      }
    } catch { /* fallback */ }

    // Format date nicely
    const dateObj = new Date(appt.date + 'T00:00:00');
    const dateLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Format time to 12h
    const [h, m] = appt.time.split(':');
    const hour = parseInt(h);
    const timeLabel = `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;

    const message = [
      `*APPOINTMENT REMINDER*`,
      `--------------------------`,
      `Hello ${patient.name},`,
      ``,
      `Your dental visit at *${clinicLabel}* is scheduled for:`,
      ``,
      `📅  ${dateLabel}`,
      `⏰  ${timeLabel}`,
      appt.treatmentType ? `🦷  ${appt.treatmentType}` : '',
      ``,
      `📍 *Location:* ${clinicAddress || 'Our Clinic'}`,
      ``,
      `Please try to arrive 5–10 minutes early. We look forward to seeing you! ✨`,
      `--------------------------`,
      `_Reply to this message if you need to reschedule._`
    ].filter(Boolean).join('\n');

    // Clean phone number and open WhatsApp
    const cleanPhone = patient.phone.replace(/[^0-9+]/g, '');
    const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : (cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone);
    const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const sendAllReminders = () => {
    const scheduled = dayAppointments.filter(a => a.status === 'Scheduled');
    if (scheduled.length === 0) {
      alert('No scheduled appointments to remind for this day.');
      return;
    }
    if (!confirm(`Send WhatsApp reminders to ${scheduled.length} patient${scheduled.length > 1 ? 's' : ''}?`)) return;
    scheduled.forEach((a, i) => {
      // Stagger window opens to avoid popup blockers
      setTimeout(() => sendWhatsAppReminder(a), i * 800);
    });
  };

  /* ── Format selected date for panel header ── */
  const selParts = selectedDate.split('-');
  const selDateObj = new Date(+selParts[0], +selParts[1] - 1, +selParts[2]);
  const selLabel = selDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">{appointments.length} total appointments</p>
        </div>
        <button className="btn btn-primary" onClick={() => openAdd()}>
          <Plus size={18} /> New Appointment
        </button>
      </div>

      {/* Calendar + Side panel layout */}
      <div className="cal-layout">
        {/* ═══ Calendar Card ═══ */}
        <div className="cal-card">
          {/* Month nav */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft size={20} /></button>
            <h2 className="cal-nav-title">{MONTH_NAMES[viewMonth]} {viewYear}</h2>
            <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight size={20} /></button>
            <button className="cal-today-btn" onClick={goToday}>Today</button>
          </div>

          {/* Weekday headers */}
          <div className="cal-grid cal-weekdays">
            {WEEKDAYS.map(w => (
              <div key={w} className="cal-weekday">{w}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="cal-grid cal-days">
            {calendarDays.map((cell, i) => {
              const dateStr = toDateStr(cell.year, cell.month, cell.day);
              const appts = apptsByDate[dateStr] || [];
              const isSel = dateStr === selectedDate;
              const isTod = isToday(cell.year, cell.month, cell.day);

              return (
                <button
                  key={i}
                  className={`cal-day ${!cell.isCurrentMonth ? 'cal-day-outside' : ''} ${isSel ? 'cal-day-selected' : ''} ${isTod ? 'cal-day-today' : ''}`}
                  onClick={() => setSelectedDate(dateStr)}
                  onDoubleClick={() => { setSelectedDate(dateStr); openAdd(dateStr); }}
                >
                  <span className="cal-day-num">{cell.day}</span>
                  {appts.length > 0 && (
                    <div className="cal-day-dots">
                      {appts.slice(0, 3).map((a, j) => (
                        <span key={j} className={`cal-dot cal-dot-${a.status === 'Completed' ? 'green' : a.status === 'Cancelled' ? 'red' : 'blue'}`} />
                      ))}
                      {appts.length > 3 && <span className="cal-dot-more">+{appts.length - 3}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Right Side Panel — Selected Day ═══ */}
        <div className="cal-side">
          <div className="cal-side-header">
            <h3 className="cal-side-title">{selLabel}</h3>
            <div className="cal-side-actions" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
              {dayAppointments.filter(a => a.status === 'Scheduled').length > 0 && (
                <button
                  className="btn btn-sm btn-whatsapp"
                  onClick={sendAllReminders}
                  title="Send WhatsApp reminders to all scheduled patients"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }}
                >
                  <MessageCircle size={14} strokeWidth={2.5} /> Remind
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => openAdd()} style={{ padding: '0.4rem 0.8rem' }}>
                <Plus size={14} /> Book
              </button>
            </div>
          </div>

          {dayAppointments.length === 0 ? (
            <div className="cal-side-empty">
              <CalendarDays size={40} strokeWidth={1} />
              <p>No appointments for this day</p>
              <button className="btn btn-primary btn-sm" onClick={() => openAdd()}>
                <Plus size={14} /> Schedule one
              </button>
            </div>
          ) : (
            <div className="cal-side-list">
              {dayAppointments.map(a => {
                const patient = patients.find(p => p.id === a.patientId);
                const statusColor = a.status === 'Completed' ? 'var(--success)' : a.status === 'Cancelled' ? 'var(--danger)' : 'var(--primary)';
                const statusBg = a.status === 'Completed' ? 'var(--success-bg)' : a.status === 'Cancelled' ? 'var(--danger-bg)' : 'var(--info-bg)';
                return (
                  <div key={a.id} className="cal-appt-card" style={{ borderLeftColor: statusColor }}>
                    <div className="cal-appt-top">
                      <div className="cal-appt-time">
                        <Clock size={14} /> {a.time}
                      </div>
                      <select
                        className="cal-appt-status-chip"
                        style={{ 
                          background: statusBg, 
                          color: statusColor,
                          border: `1px solid ${statusColor}22`
                        }}
                        value={a.status}
                        onChange={e => updateAppointment(a.id, { status: e.target.value as Appointment['status'] })}
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="cal-appt-info">
                      <div className="cal-appt-patient">
                        {patient?.name || 'Unknown Patient'}
                      </div>
                      {a.treatmentType && (
                        <div className="cal-appt-treatment">
                          <Stethoscope size={13} style={{ opacity: 0.7 }} /> {a.treatmentType}
                        </div>
                      )}
                    </div>

                    <div className="cal-appt-actions">
                      <button className="btn btn-icon btn-sm" onClick={() => openEdit(a)} title="Edit">
                        <Edit2 size={15} />
                      </button>
                      <button className="btn btn-icon btn-sm" onClick={() => setTreatmentModal(a.id)} title="Add treatment">
                        <Plus size={16} />
                      </button>
                      <button className="btn btn-icon btn-sm" onClick={() => openPrescription(a)} title="Prescription / Notes" style={{ color: 'var(--primary)' }}>
                        <FileText size={15} />
                      </button>
                      {a.status === 'Scheduled' && patient?.phone && (
                        <button
                          className="btn btn-icon btn-sm btn-whatsapp-glass"
                          onClick={() => sendWhatsAppReminder(a)}
                          title="Send WhatsApp Reminder"
                          style={{ borderRadius: '10px' }}
                        >
                          <Send size={15} strokeWidth={2.5} />
                        </button>
                      )}
                      <button className="btn btn-icon btn-sm btn-danger" onClick={() => { if (confirm('Delete this appointment?')) deleteAppointment(a.id); }} title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Appointment Modal ═══ */}
      {apptModal && (
        <div className="modal-overlay" onClick={closeAppt}>
          <div className="appt-modal" onClick={e => e.stopPropagation()}>
            <div className="appt-modal-header">
              <div>
                <h2 className="appt-modal-title">
                  {apptModal === 'edit' ? 'Edit Appointment' : 'New Appointment'}
                </h2>
                <p className="appt-modal-subtitle">Fill in the details to schedule</p>
              </div>
              <button className="btn btn-icon" onClick={closeAppt}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveAppt} className="appt-modal-body">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="appt-label">Patient</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{
                    position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--on-surface-variant)', opacity: 0.45, pointerEvents: 'none',
                  }} />
                  <input
                    className="form-input"
                    placeholder="Search by name or phone..."
                    value={patientSearch}
                    onChange={e => {
                      setPatientSearch(e.target.value);
                      setPatientDropdownOpen(true);
                      setShowInlineAdd(false);
                      if (current.patientId) {
                        const sel = patients.find(p => p.id === current.patientId);
                        if (sel && e.target.value !== `${sel.name} (${sel.phone})`) {
                          setCurrent({ ...current, patientId: '' });
                        }
                      }
                    }}
                    onFocus={() => setPatientDropdownOpen(true)}
                    style={{
                      paddingLeft: '2.5rem',
                      paddingRight: '2rem',
                      borderColor: current.patientId ? 'var(--success)' : undefined,
                      transition: 'border-color 0.2s',
                    }}
                  />
                  <ChevronDown size={16} style={{
                    position: 'absolute', right: '0.85rem', top: '50%', transform: `translateY(-50%) rotate(${patientDropdownOpen ? 180 : 0}deg)`,
                    color: 'var(--on-surface-variant)', opacity: 0.4, pointerEvents: 'none', transition: 'transform 0.2s',
                  }} />
                  {/* Hidden required input for form validation */}
                  <input type="text" required value={current.patientId || ''} onChange={() => {}} style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} tabIndex={-1} />
                </div>

                {/* Dropdown */}
                {patientDropdownOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setPatientDropdownOpen(false); setShowInlineAdd(false); }} />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0, right: 0,
                      marginTop: '0.3rem',
                      background: 'white',
                      border: '1px solid var(--outline-variant)',
                      borderRadius: '0.875rem',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
                      maxHeight: '320px',
                      overflowY: 'auto',
                      zIndex: 100,
                    }}>
                      {/* Patient list */}
                      {filteredPatients.length === 0 && patientSearch && (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
                          No patients found
                        </div>
                      )}
                      {filteredPatients.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setCurrent({ ...current, patientId: p.id });
                            setPatientSearch(`${p.name} (${p.phone})`);
                            setPatientDropdownOpen(false);
                            setShowInlineAdd(false);
                          }}
                          style={{
                            padding: '0.65rem 1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            transition: 'background 0.15s',
                            background: current.patientId === p.id ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                            borderBottom: '1px solid rgba(0,0,0,0.04)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14, 165, 233, 0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = current.patientId === p.id ? 'rgba(14, 165, 233, 0.08)' : 'transparent')}
                        >
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--primary), var(--secondary, #a855f7))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                          }}>
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--on-surface)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)' }}>{p.phone || 'No phone'}</div>
                          </div>
                          {current.patientId === p.id && (
                            <div style={{ color: 'var(--success)', flexShrink: 0, fontWeight: 700 }}>✓</div>
                          )}
                        </div>
                      ))}

                      {/* ── Always-visible "Add new patient" ── */}
                      {!showInlineAdd ? (
                        <div
                          onClick={() => { setShowInlineAdd(true); setInlineNewName(patientSearch); setInlineNewPhone(''); }}
                          style={{
                            padding: '0.75rem 1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            borderTop: '1px solid var(--outline-variant)',
                            color: 'var(--on-surface-variant)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14, 165, 233, 0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <UserPlus size={16} style={{ color: 'var(--primary)' }} />
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>Add new patient</span>
                        </div>
                      ) : (
                        <div style={{
                          padding: '0.85rem 1rem',
                          borderTop: '1px solid var(--outline-variant)',
                          background: 'rgba(14, 165, 233, 0.03)',
                        }}>
                          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <UserPlus size={14} /> Quick Add Patient
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <input
                              className="form-input"
                              placeholder="Patient name"
                              value={inlineNewName}
                              onChange={e => setInlineNewName(e.target.value)}
                              autoFocus
                              style={{ height: '2.2rem', fontSize: '0.85rem', borderRadius: '0.5rem' }}
                            />
                            <input
                              className="form-input"
                              placeholder="Phone number (optional)"
                              value={inlineNewPhone}
                              onChange={e => setInlineNewPhone(e.target.value)}
                              style={{ height: '2.2rem', fontSize: '0.85rem', borderRadius: '0.5rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                              <button
                                type="button"
                                onClick={() => setShowInlineAdd(false)}
                                style={{
                                  flex: 1, padding: '0.45rem', border: '1px solid var(--outline-variant)',
                                  borderRadius: '0.5rem', background: 'white', cursor: 'pointer',
                                  fontWeight: 600, fontSize: '0.8rem', color: 'var(--on-surface-variant)',
                                }}
                              >Cancel</button>
                              <button
                                type="button"
                                onClick={handleAddNewPatient}
                                disabled={!inlineNewName.trim()}
                                style={{
                                  flex: 1, padding: '0.45rem', border: 'none',
                                  borderRadius: '0.5rem', background: 'var(--primary)', cursor: 'pointer',
                                  fontWeight: 700, fontSize: '0.8rem', color: 'white',
                                  opacity: inlineNewName.trim() ? 1 : 0.5,
                                }}
                              >Add & Select</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <label className="appt-label">Date</label>
                  <input type="date" required className="form-input" value={current.date || ''} onChange={e => setCurrent({ ...current, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="appt-label">Time</label>
                  <input type="time" required className="form-input" value={current.time || ''} onChange={e => setCurrent({ ...current, time: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="appt-label">Treatment Type</label>
                <select className="form-select" value={current.treatmentType || ''} onChange={e => setCurrent({ ...current, treatmentType: e.target.value })}>
                  <option value="">Select treatment...</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Filling">Filling</option>
                  <option value="Root Canal">Root Canal</option>
                  <option value="Extraction">Extraction</option>
                  <option value="Crown">Crown</option>
                  <option value="Consultation">Consultation</option>
                </select>
              </div>

              {apptModal === 'add' && (
                <>
                  <div className="form-group">
                    <label className="appt-label">Select Teeth</label>
                    <div className="appt-tooth-chart-wrap">
                      <ToothSelector
                        selectedTeeth={current.tempTeeth}
                        onSelect={(num) => {
                          const currentTeeth = current.tempTeeth || [];
                          setCurrent({
                            ...current,
                            tempTeeth: currentTeeth.includes(num)
                              ? currentTeeth.filter(t => t !== num)
                              : [...currentTeeth, num],
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-2 gap-4">
                    <div className="form-group">
                      <label className="appt-label">Total Cost (₹)</label>
                      <input type="number" min="0" className="form-input" placeholder="0" value={current.tempCost || ''} onChange={e => setCurrent({ ...current, tempCost: Number(e.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="appt-label">Follow-up</label>
                      <input type="date" className="form-input" value={current.tempFollowUpDate || ''} onChange={e => setCurrent({ ...current, tempFollowUpDate: e.target.value })} />
                    </div>
                  </div>
                </>
              )}

              <div className="appt-modal-footer">
                <button type="button" className="btn" onClick={closeAppt}>Cancel</button>
                <button type="submit" className="btn btn-primary">{apptModal === 'edit' ? 'Update' : 'Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Add Treatment Modal ═══ */}
      {treatmentModal && (
        <div className="modal-overlay" onClick={() => { setTreatmentModal(null); setNewTreatment({}); }}>
          <div className="appt-modal" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="appt-modal-header">
              <h2 className="appt-modal-title"><Stethoscope size={22} color="var(--primary)" /> Add Treatment</h2>
              <button className="btn btn-icon" onClick={() => { setTreatmentModal(null); setNewTreatment({}); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveTreatment} className="appt-modal-body">
              <div className="form-group">
                <label className="appt-label">Tooth Number</label>
                <input required className="form-input" placeholder="e.g. 14, 26" value={newTreatment.toothNumber || ''} onChange={e => setNewTreatment({ ...newTreatment, toothNumber: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="appt-label">Treatment Notes</label>
                <textarea required className="form-textarea" rows={3} placeholder="Describe the treatment procedure..." value={newTreatment.notes || ''} onChange={e => setNewTreatment({ ...newTreatment, notes: e.target.value })} />
              </div>
              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <label className="appt-label">Cost (₹)</label>
                  <input type="number" required min="0" className="form-input" placeholder="1000" value={newTreatment.cost || ''} onChange={e => setNewTreatment({ ...newTreatment, cost: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label className="appt-label">Follow-up Date</label>
                  <input type="date" className="form-input" value={newTreatment.followUpDate || ''} onChange={e => setNewTreatment({ ...newTreatment, followUpDate: e.target.value })} />
                </div>
              </div>
              <div className="appt-modal-footer">
                <button type="button" className="btn" onClick={() => { setTreatmentModal(null); setNewTreatment({}); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Treatment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Prescription Modal ═══ */}
      {prescriptionModal && (
        <div className="modal-overlay" onClick={() => setPrescriptionModal(null)}>
          <div className="modal-content" style={{ width: '800px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Prescription & Clinical Notes</h2>
                <p className="modal-subtitle">Add medications and visit details</p>
              </div>
              <button className="btn btn-icon" onClick={() => setPrescriptionModal(null)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.5rem' }}>
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

                <div className="table-wrapper" style={{ border: '1px solid var(--outline-variant)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-container-low)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>Medicine Name</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>Dosage</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>Frequency</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>Duration</th>
                        <th style={{ padding: '0.75rem', fontSize: '0.75rem', fontWeight: 700 }}>Instructions</th>
                        <th style={{ padding: '0.75rem', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rxItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '0.88rem', background: 'white' }}>
                            No medicines added. Click "Add Medicine" to start.
                          </td>
                        </tr>
                      ) : (
                        rxItems.map((item, idx) => (
                          <tr key={idx} style={{ background: 'white', borderTop: '1px solid var(--outline-variant)' }}>
                            <td style={{ padding: '0.5rem' }}>
                              <input className="form-input" style={{ border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.85rem' }} value={item.medicineName} onChange={e => updateRxItem(idx, 'medicineName', e.target.value)} placeholder="Amoxicillin 500mg" />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input className="form-input" style={{ border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.85rem' }} value={item.dosage} onChange={e => updateRxItem(idx, 'dosage', e.target.value)} placeholder="1 tab" />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input className="form-input" style={{ border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.85rem' }} value={item.frequency} onChange={e => updateRxItem(idx, 'frequency', e.target.value)} placeholder="1-0-1 (After Food)" />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input className="form-input" style={{ border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.85rem' }} value={item.duration} onChange={e => updateRxItem(idx, 'duration', e.target.value)} placeholder="5 days" />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <input className="form-input" style={{ border: 'none', background: 'var(--surface-container-lowest)', fontSize: '0.85rem' }} value={item.instructions} onChange={e => updateRxItem(idx, 'instructions', e.target.value)} placeholder="Avoid cold drinks" />
                            </td>
                            <td style={{ padding: '0.5rem' }}>
                              <button className="btn btn-icon btn-sm btn-danger" onClick={() => removeRxItem(idx)}><Trash size={14} /></button>
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

            <div className="modal-footer" style={{ borderTop: '1px solid var(--outline-variant)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', background: 'var(--surface-container-lowest)' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    const appt = appointments.find(a => a.id === prescriptionModal);
                    if (appt) generatePrescriptionPDF({ ...appt, prescription: rxItems, notes: rxNotes });
                  }}
                  disabled={rxItems.length === 0 && !rxNotes}
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
