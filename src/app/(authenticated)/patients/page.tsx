'use client';

import React, { useState } from 'react';
import { useStore } from '@/store';
import { Search, UserPlus, Edit2, Trash2, FileText, X, Phone, Mail } from 'lucide-react';
import { Patient } from '@/types';

export default function PatientsPage() {
  const { patients, addPatient, updatePatient, deletePatient, appointments } = useStore();
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

  const patientHistory = appointments.filter(a => a.patientId === historyId);
  const historyPatient = patients.find(p => p.id === historyId);

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
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
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

      {/* History Modal */}
      {historyId && (
        <div className="modal-overlay" onClick={() => setHistoryId(null)}>
          <div className="modal-content" style={{ width: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{historyPatient?.name}&apos;s Treatment History</h2>
              <button className="btn btn-icon" onClick={() => setHistoryId(null)}><X size={20} /></button>
            </div>
            {patientHistory.length === 0 ? (
              <div className="empty-state">No treatment history found for this patient.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {patientHistory.map(app => (
                  <div key={app.id} style={{
                    background: 'rgba(255,255,255,0.45)', padding: '1rem', borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--glass-border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <strong style={{ fontSize: '0.92rem' }}>📅 {app.date} at {app.time} — {app.treatmentType}</strong>
                      <span className={`badge badge-${app.status === 'Completed' ? 'success' : app.status === 'Cancelled' ? 'danger' : 'primary'}`}>{app.status}</span>
                    </div>
                    {app.treatments.length > 0 ? (
                      <div className="table-wrapper" style={{ marginTop: '0.5rem' }}>
                        <table>
                          <thead><tr><th>Tooth #</th><th>Notes</th><th>Cost</th><th>Follow-up</th></tr></thead>
                          <tbody>
                            {app.treatments.map(t => (
                              <tr key={t.id}><td>{t.toothNumber}</td><td>{t.notes}</td><td>₹{t.cost.toLocaleString()}</td><td>{t.followUpDate || '—'}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No treatments recorded.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
