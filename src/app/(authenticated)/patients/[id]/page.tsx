'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/store';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, User, AlertCircle,
  FileText, IndianRupee, CalendarDays, Clock, Stethoscope,
  ArrowRight, CheckCircle2, Timer, FileDown,
  Receipt, Activity, CreditCard, Shield,
} from 'lucide-react';
import { Invoice } from '@/types';
import ToothChart from '@/components/ToothChart';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export default function PatientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const { patients, appointments, invoices, updateInvoice } = useStore();

  const patient = patients.find(p => p.id === patientId);

  // All appointments for this patient (sorted newest first)
  const patientAppointments = useMemo(() =>
    [...appointments.filter(a => a.patientId === patientId)]
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)),
    [patientId, appointments]
  );

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
    </div>
  );
}
