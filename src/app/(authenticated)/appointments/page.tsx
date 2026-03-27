'use client';

import React, { useState } from 'react';
import { useStore } from '@/store';
import { CalendarDays, Plus, Edit2, Trash2, X, Stethoscope, Filter } from 'lucide-react';
import { Appointment, Treatment } from '@/types';

export default function AppointmentsPage() {
  const { patients, appointments, addAppointment, updateAppointment, deleteAppointment } = useStore();
  const [filterDate, setFilterDate] = useState('');
  const [apptModal, setApptModal] = useState<'add' | 'edit' | null>(null);
  const [current, setCurrent] = useState<Partial<Appointment>>({});
  const [treatmentModal, setTreatmentModal] = useState<string | null>(null);
  const [newTreatment, setNewTreatment] = useState<Partial<Treatment>>({});

  const filtered = filterDate
    ? appointments.filter(a => a.date === filterDate)
    : [...appointments].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const openAdd = () => { setCurrent({ status: 'Scheduled', treatments: [] }); setApptModal('add'); };
  const openEdit = (a: Appointment) => { setCurrent(a); setApptModal('edit'); };
  const closeAppt = () => { setApptModal(null); setCurrent({}); };

  const handleSaveAppt = (e: React.FormEvent) => {
    e.preventDefault();
    if (apptModal === 'edit' && current.id) {
      updateAppointment(current.id, current);
    } else {
      addAppointment({ ...current, id: 'a' + Date.now(), treatments: [] } as Appointment);
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">{appointments.length} total appointments</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <CalendarDays size={18} /> Book Appointment
        </button>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, width: '250px' }}>
            <label className="form-label"><Filter size={14} /> Filter by Date</label>
            <input type="date" className="form-input" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          {filterDate && (
            <button className="btn btn-sm" onClick={() => setFilterDate('')} style={{ marginBottom: '0.25rem' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Date & Time</th>
                <th>Treatment Type</th>
                <th>Status</th>
                <th>Treatments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">No appointments found.</td></tr>
              ) : (
                filtered.map(a => {
                  const patient = patients.find(p => p.id === a.patientId);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{patient?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{patient?.phone}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <CalendarDays size={14} color="var(--primary)" /> {a.date}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.time}</div>
                      </td>
                      <td>{a.treatmentType || '—'}</td>
                      <td>
                        <select
                          className={`status-select badge-${a.status === 'Completed' ? 'success' : a.status === 'Cancelled' ? 'danger' : 'primary'}`}
                          style={{ background: a.status === 'Completed' ? 'var(--success-bg)' : a.status === 'Cancelled' ? 'var(--danger-bg)' : 'var(--info-bg)', color: a.status === 'Completed' ? 'var(--success)' : a.status === 'Cancelled' ? 'var(--danger)' : 'var(--primary)' }}
                          value={a.status}
                          onChange={e => updateAppointment(a.id, { status: e.target.value as Appointment['status'] })}
                        >
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{a.treatments?.length || 0} recorded</span>
                          <button className="btn btn-sm" onClick={() => setTreatmentModal(a.id)}>
                            <Plus size={12} /> Add
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="btn btn-icon" style={{ color: 'var(--warning)' }} onClick={() => openEdit(a)}><Edit2 size={16} /></button>
                          <button className="btn btn-icon btn-danger" onClick={() => { if(confirm('Delete?')) deleteAppointment(a.id); }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Appointment Modal */}
      {apptModal && (
        <div className="modal-overlay" onClick={closeAppt}>
          <div className="modal-content" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{apptModal === 'edit' ? 'Edit Appointment' : 'Book Appointment'}</h2>
              <button className="btn btn-icon" onClick={closeAppt}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAppt}>
              <div className="form-group">
                <label className="form-label">Patient</label>
                <select required className="form-select" value={current.patientId || ''} onChange={e => setCurrent({...current, patientId: e.target.value})}>
                  <option value="">Select patient...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}
                </select>
              </div>
              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" required className="form-input" value={current.date || ''} onChange={e => setCurrent({...current, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input type="time" required className="form-input" value={current.time || ''} onChange={e => setCurrent({...current, time: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Treatment Type</label>
                <input className="form-input" placeholder="e.g. Root Canal, Cleaning..." value={current.treatmentType || ''} onChange={e => setCurrent({...current, treatmentType: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={current.status || 'Scheduled'} onChange={e => setCurrent({...current, status: e.target.value as Appointment['status']})}>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn" onClick={closeAppt}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Appointment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Treatment Modal */}
      {treatmentModal && (
        <div className="modal-overlay" onClick={() => { setTreatmentModal(null); setNewTreatment({}); }}>
          <div className="modal-content" style={{ width: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><Stethoscope size={22} color="var(--primary)" /> Add Treatment</h2>
              <button className="btn btn-icon" onClick={() => { setTreatmentModal(null); setNewTreatment({}); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveTreatment}>
              <div className="form-group">
                <label className="form-label">Tooth Number</label>
                <input required className="form-input" placeholder="e.g. 14, 26" value={newTreatment.toothNumber || ''} onChange={e => setNewTreatment({...newTreatment, toothNumber: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Treatment Notes</label>
                <textarea required className="form-textarea" rows={3} placeholder="Describe the treatment procedure..." value={newTreatment.notes || ''} onChange={e => setNewTreatment({...newTreatment, notes: e.target.value})} />
              </div>
              <div className="grid grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Cost (₹)</label>
                  <input type="number" required min="0" className="form-input" placeholder="1000" value={newTreatment.cost || ''} onChange={e => setNewTreatment({...newTreatment, cost: Number(e.target.value)})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Follow-up Date</label>
                  <input type="date" className="form-input" value={newTreatment.followUpDate || ''} onChange={e => setNewTreatment({...newTreatment, followUpDate: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => { setTreatmentModal(null); setNewTreatment({}); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Treatment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
