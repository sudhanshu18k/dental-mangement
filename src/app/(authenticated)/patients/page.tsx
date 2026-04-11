'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store';
import { Search, UserPlus, Edit2, Trash2, FileText, X, Phone, Mail, CalendarDays, IndianRupee, Clock, Stethoscope, TrendingUp, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { Patient } from '@/types';
import ToothChart from '@/components/ToothChart';

export default function PatientsPage() {
  const { patients, addPatient, updatePatient, deletePatient, appointments, invoices } = useStore();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<Patient>>({});
  const [historyId, setHistoryId] = useState<string | null>(null);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search)
  );

  const openAdd = () => { setCurrent({}); setModal('add'); };
  const openEdit = (p: Patient) => { setCurrent(p); setModal('edit'); };
  const closeModal = () => { setModal(null); setCurrent({}); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (modal === 'edit' && current.id) {
      updatePatient(current.id, current);
    } else {
      addPatient({ ...current, id: 'p' + Date.now() } as Patient);
    }
    closeModal();
  };

  const historyPatient = patients.find(p => p.id === historyId);

  // Enriched history data sorted by date descending
  const patientHistory = useMemo(() => {
    if (!historyId) return [];
    return [...appointments.filter(a => a.patientId === historyId)]
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  }, [historyId, appointments]);

  // Patient summary stats
  const patientStats = useMemo(() => {
    if (!historyId) return { totalVisits: 0, completedVisits: 0, totalSpent: 0, totalTreatments: 0, lastVisit: null as string | null, upcomingFollowUps: 0 };
    const patientAppts = appointments.filter(a => a.patientId === historyId);
    const completedAppts = patientAppts.filter(a => a.status === 'Completed');
    const allTreatments = patientAppts.flatMap(a => a.treatments || []);
    const totalSpent = allTreatments.reduce((sum, t) => sum + (t.cost || 0), 0);
    const sortedDates = patientAppts.map(a => a.date).sort((a, b) => b.localeCompare(a));
    const today = new Date().toISOString().split('T')[0];
    const upcomingFollowUps = allTreatments.filter(t => t.followUpDate && t.followUpDate >= today).length;

    return {
      totalVisits: patientAppts.length,
      completedVisits: completedAppts.length,
      totalSpent,
      totalTreatments: allTreatments.length,
      lastVisit: sortedDates[0] || null,
      upcomingFollowUps,
    };
  }, [historyId, appointments]);

  // Patient invoices
  const patientInvoices = useMemo(() => {
    if (!historyId) return [];
    return invoices.filter(i => i.patientId === historyId);
  }, [historyId, invoices]);

  const totalBilled = patientInvoices.reduce((sum, i) => sum + i.finalAmount, 0);
  const totalPaid = patientInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.finalAmount, 0);

  // Format date nicely
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Patients Directory</h1>
          <p className="page-subtitle">{patients.length} patients registered</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <UserPlus size={18} /> Add New Patient
        </button>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Search by name or phone number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Contact</th>
                <th>DOB</th>
                <th>Gender</th>
                <th>Allergies</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No patients found.</td></tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div
                        style={{ fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={() => router.push(`/patients/${p.id}`)}
                        title="View Profile"
                      >
                        {p.name}
                        <ExternalLink size={12} style={{ opacity: 0.5 }} />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}><Phone size={13} /> {p.phone}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}><Mail size={12} /> {p.email}</div>
                    </td>
                    <td>{p.dob}</td>
                    <td>{p.gender}</td>
                    <td><span className={p.allergies && p.allergies !== 'None' ? 'badge badge-warning' : 'badge badge-success'}>{p.allergies || 'None'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-icon" title="View Profile" style={{ color: 'var(--primary)' }} onClick={() => router.push(`/patients/${p.id}`)}><ExternalLink size={16} /></button>
                        <button className="btn btn-icon" title="History" onClick={() => setHistoryId(p.id)}><FileText size={16} /></button>
                        <button className="btn btn-icon" style={{ color: 'var(--warning)' }} title="Edit" onClick={() => openEdit(p)}><Edit2 size={16} /></button>
                        <button className="btn btn-icon btn-danger" title="Delete" onClick={() => { if(confirm('Delete this patient?')) deletePatient(p.id); }}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ width: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{modal === 'edit' ? 'Edit Patient' : 'Add New Patient'}</h2>
              <button className="btn btn-icon" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="grid grid-2 gap-4">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Full Name</label>
                  <input required className="form-input" value={current.name || ''} onChange={e => setCurrent({...current, name: e.target.value})} placeholder="Patient name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input required className="form-input" value={current.phone || ''} onChange={e => setCurrent({...current, phone: e.target.value})} placeholder="9876543210" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={current.email || ''} onChange={e => setCurrent({...current, email: e.target.value})} placeholder="patient@email.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input type="date" className="form-input" value={current.dob || ''} onChange={e => setCurrent({...current, dob: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={current.gender || ''} onChange={e => setCurrent({...current, gender: e.target.value})}>
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <input className="form-input" value={current.address || ''} onChange={e => setCurrent({...current, address: e.target.value})} placeholder="Full address" />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Medical History</label>
                  <textarea className="form-textarea" rows={2} value={current.medicalHistory || ''} onChange={e => setCurrent({...current, medicalHistory: e.target.value})} placeholder="Pre-existing conditions..." />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Allergies</label>
                  <input className="form-input" value={current.allergies || ''} onChange={e => setCurrent({...current, allergies: e.target.value})} placeholder="Known allergies" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
         DETAILED TREATMENT HISTORY MODAL
         ═══════════════════════════════════════ */}
      {historyId && (
        <div className="modal-overlay" onClick={() => setHistoryId(null)}>
          <div className="modal-content history-modal" onClick={e => e.stopPropagation()}>
            {/* Header with patient info */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div className="history-avatar">
                  {historyPatient?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h2 className="modal-title" style={{ marginBottom: '0.15rem' }}>
                    {historyPatient?.name}&apos;s Treatment History
                  </h2>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {historyPatient?.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={12} /> {historyPatient.phone}</span>}
                    {historyPatient?.email && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={12} /> {historyPatient.email}</span>}
                  </div>
                </div>
              </div>
              <button className="btn btn-icon" onClick={() => setHistoryId(null)}><X size={20} /></button>
            </div>

            {/* Patient Medical Info */}
            {(historyPatient?.medicalHistory || (historyPatient?.allergies && historyPatient.allergies !== 'None')) && (
              <div className="history-medical-banner">
                {historyPatient?.allergies && historyPatient.allergies !== 'None' && (
                  <div className="history-alert">
                    <AlertCircle size={14} />
                    <span><strong>Allergies:</strong> {historyPatient.allergies}</span>
                  </div>
                )}
                {historyPatient?.medicalHistory && (
                  <div className="history-note">
                    <FileText size={14} />
                    <span><strong>Medical History:</strong> {historyPatient.medicalHistory}</span>
                  </div>
                )}
              </div>
            )}

            {/* Summary Stats */}
            <div className="history-stats-grid">
              <div className="history-stat">
                <div className="history-stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--primary)' }}>
                  <CalendarDays size={18} />
                </div>
                <div>
                  <span className="history-stat-value">{patientStats.totalVisits}</span>
                  <span className="history-stat-label">Total Visits</span>
                </div>
              </div>
              <div className="history-stat">
                <div className="history-stat-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--secondary)' }}>
                  <Stethoscope size={18} />
                </div>
                <div>
                  <span className="history-stat-value">{patientStats.totalTreatments}</span>
                  <span className="history-stat-label">Treatments</span>
                </div>
              </div>
              <div className="history-stat">
                <div className="history-stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                  <IndianRupee size={18} />
                </div>
                <div>
                  <span className="history-stat-value">₹{patientStats.totalSpent.toLocaleString()}</span>
                  <span className="history-stat-label">Total Cost</span>
                </div>
              </div>
              <div className="history-stat">
                <div className="history-stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                  <TrendingUp size={18} />
                </div>
                <div>
                  <span className="history-stat-value">₹{totalPaid.toLocaleString()}</span>
                  <span className="history-stat-label">Paid of ₹{totalBilled.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Upcoming follow-ups alert */}
            {patientStats.upcomingFollowUps > 0 && (
              <div className="history-follow-up-banner">
                <Clock size={15} />
                <span>{patientStats.upcomingFollowUps} upcoming follow-up{patientStats.upcomingFollowUps > 1 ? 's' : ''} scheduled</span>
              </div>
            )}

            {/* Interactive Tooth Chart */}
            <ToothChart
              treatments={
                patientHistory.flatMap(app =>
                  (app.treatments || []).map(t => ({
                    toothNumber: t.toothNumber,
                    notes: t.notes,
                    cost: t.cost,
                    date: app.date,
                    status: app.status as 'Completed' | 'Scheduled' | 'Cancelled',
                  }))
                )
              }
            />

            {/* Timeline */}
            {patientHistory.length === 0 ? (
              <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
                <Stethoscope size={36} style={{ marginBottom: '0.75rem', opacity: 0.3 }} />
                <p>No treatment history found for this patient.</p>
                <p style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Appointments will appear here once created.</p>
              </div>
            ) : (
              <div className="timeline">
                {patientHistory.map((app, idx) => {
                  const apptCost = (app.treatments || []).reduce((sum, t) => sum + (t.cost || 0), 0);
                  const linkedInvoice = patientInvoices.find(i => i.appointmentId === app.id);

                  return (
                    <div key={app.id} className="timeline-item" style={{ animationDelay: `${idx * 0.06}s` }}>
                      {/* Timeline dot & line */}
                      <div className="timeline-indicator">
                        <div className={`timeline-dot timeline-dot-${app.status === 'Completed' ? 'success' : app.status === 'Cancelled' ? 'danger' : 'primary'}`} />
                        {idx < patientHistory.length - 1 && <div className="timeline-line" />}
                      </div>

                      {/* Content */}
                      <div className="timeline-content">
                        {/* Header */}
                        <div className="timeline-header">
                          <div>
                            <div className="timeline-date">
                              <CalendarDays size={13} />
                              {formatDate(app.date)}
                              <span className="timeline-time">
                                <Clock size={12} /> {app.time}
                              </span>
                            </div>
                            <h4 className="timeline-title">{app.treatmentType || 'General Checkup'}</h4>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {apptCost > 0 && (
                              <span className="timeline-cost">₹{apptCost.toLocaleString()}</span>
                            )}
                            <span className={`badge badge-${app.status === 'Completed' ? 'success' : app.status === 'Cancelled' ? 'danger' : 'primary'}`}>
                              {app.status}
                            </span>
                          </div>
                        </div>

                        {/* Treatment Cards */}
                        {app.treatments && app.treatments.length > 0 ? (
                          <div className="timeline-treatments">
                            {app.treatments.map(t => (
                              <div key={t.id} className="treatment-card">
                                <div className="treatment-card-header">
                                  <span className="treatment-tooth">
                                    🦷 Tooth #{t.toothNumber}
                                  </span>
                                  <span className="treatment-cost-tag">₹{t.cost.toLocaleString()}</span>
                                </div>
                                <p className="treatment-notes">{t.notes}</p>
                                {t.followUpDate && (
                                  <div className="treatment-followup">
                                    <ArrowRight size={12} />
                                    Follow-up: {formatDate(t.followUpDate)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="timeline-no-treatments">No treatments were recorded for this visit.</p>
                        )}

                        {/* Invoice link if exists */}
                        {linkedInvoice && (
                          <div className="timeline-invoice-tag">
                            <IndianRupee size={12} />
                            Invoice #{linkedInvoice.id.slice(-6)} — 
                            <span style={{ color: linkedInvoice.status === 'Paid' ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                              {linkedInvoice.status}
                            </span>
                            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>₹{linkedInvoice.finalAmount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
