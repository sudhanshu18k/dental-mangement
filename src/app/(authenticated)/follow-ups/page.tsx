'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/store';
import {
  Bell, CheckCircle, XCircle, MessageCircle, Clock, AlertTriangle,
  CalendarCheck, Stethoscope, Phone, Plus, X, Edit2, Trash2,
  Send, Filter, FileText, RefreshCw, Eye, Zap
} from 'lucide-react';
import { FollowUp, FollowUpTemplate, FollowUpType, FollowUpStatus } from '@/types';

type TabFilter = 'all' | FollowUpType;
type StatusFilter = 'all' | FollowUpStatus;

export default function FollowUpsPage() {
  const {
    patients, appointments, followUps, followUpTemplates, activeClinic,
    updateFollowUp, deleteFollowUp,
    addFollowUpTemplate, updateFollowUpTemplate, deleteFollowUpTemplate,
    generateFollowUpsForAppointment,
  } = useStore();

  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selectedTemplate, setSelectedTemplate] = useState<Record<string, string>>({});

  // Template modal state
  const [templateModal, setTemplateModal] = useState<'list' | 'add' | 'edit' | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<FollowUpTemplate>>({});

  // Preview modal
  const [previewFollowUp, setPreviewFollowUp] = useState<FollowUp | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Filter follow-ups
  const filtered = useMemo(() => {
    let list = [...followUps];
    if (activeTab !== 'all') list = list.filter(f => f.type === activeTab);
    if (statusFilter !== 'all') list = list.filter(f => f.status === statusFilter);
    // Sort: overdue first, then by due date
    list.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
    return list;
  }, [followUps, activeTab, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const dueToday = followUps.filter(f => f.dueDate <= today && f.status === 'pending').length;
    const pending = followUps.filter(f => f.status === 'pending').length;
    const sent = followUps.filter(f => f.status === 'sent').length;
    const overdue = followUps.filter(f => f.dueDate < today && f.status === 'pending').length;
    return { dueToday, pending, sent, overdue };
  }, [followUps, today]);

  // Get patient info
  const getPatient = (id: string) => patients.find(p => p.id === id);
  const getAppointment = (id: string) => appointments.find(a => a.id === id);

  // Type labels & colors
  const typeConfig: Record<FollowUpType, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    post_treatment: { label: 'Post Treatment', color: '#e11d48', bg: '#fff1f2', icon: Stethoscope },
    routine_checkup: { label: 'Routine Checkup', color: '#d97706', bg: '#fef9c3', icon: CalendarCheck },
    missed_appointment: { label: 'Missed Appointment', color: '#2563eb', bg: '#eff6ff', icon: Phone },
  };

  const statusConfig: Record<FollowUpStatus, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: '#d97706', bg: '#fef3c7' },
    sent: { label: 'Sent', color: '#059669', bg: '#d1fae5' },
    dismissed: { label: 'Dismissed', color: '#6b7280', bg: '#f3f4f6' },
  };

  // Build WhatsApp message from template
  const buildMessage = (followUp: FollowUp, templateId?: string) => {
    const patient = getPatient(followUp.patientId);
    const appt = getAppointment(followUp.appointmentId);
    const template = followUpTemplates.find(t => t.id === (templateId || selectedTemplate[followUp.id]));

    if (!template || !patient) return '';

    const clinicName = activeClinic?.name || 'Our Clinic';

    const msg = template.message
      .replace(/\{\{patientName\}\}/g, patient.name)
      .replace(/\{\{clinicName\}\}/g, clinicName)
      .replace(/\{\{treatmentType\}\}/g, followUp.treatmentType || appt?.treatmentType || 'your treatment')
      .replace(/\{\{appointmentDate\}\}/g, appt?.date ? new Date(appt.date).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '')
      .replace(/\{\{followUpDate\}\}/g, new Date(followUp.dueDate).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));

    return msg;
  };

  // Send WhatsApp
  const sendWhatsApp = (followUp: FollowUp) => {
    const patient = getPatient(followUp.patientId);
    if (!patient?.phone) {
      alert('This patient has no phone number on file.');
      return;
    }

    const templateId = selectedTemplate[followUp.id];
    // Auto-pick a template of the matching type if none selected
    const finalTemplateId = templateId || followUpTemplates.find(t => t.type === followUp.type)?.id;
    if (!finalTemplateId) {
      alert('No template found. Please create a template first.');
      return;
    }

    const message = buildMessage(followUp, finalTemplateId);
    const cleanPhone = patient.phone.replace(/[^0-9+]/g, '');
    const whatsappPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : (cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone);
    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, '_blank');

    // Mark as sent
    updateFollowUp(followUp.id, { status: 'sent', sentAt: new Date().toISOString(), templateId: finalTemplateId });
  };

  // Mark sent / dismiss
  const markSent = (id: string) => updateFollowUp(id, { status: 'sent', sentAt: new Date().toISOString() });
  const dismiss = (id: string) => updateFollowUp(id, { status: 'dismissed', dismissedAt: new Date().toISOString() });

  // Generate follow-ups for all recent completed/cancelled appointments
  const generateAll = () => {
    const relevantAppts = appointments.filter(a => a.status === 'Completed' || a.status === 'Cancelled');
    if (relevantAppts.length === 0) {
      alert('No completed or cancelled appointments to generate follow-ups for.');
      return;
    }
    relevantAppts.forEach(a => generateFollowUpsForAppointment(a));
  };

  // Template CRUD
  const openAddTemplate = () => {
    setEditingTemplate({ type: 'post_treatment', message: '', name: '', isDefault: false });
    setTemplateModal('add');
  };
  const openEditTemplate = (t: FollowUpTemplate) => {
    setEditingTemplate({ ...t });
    setTemplateModal('edit');
  };
  const saveTemplate = () => {
    if (!editingTemplate.name || !editingTemplate.message) return;
    if (templateModal === 'add') {
      addFollowUpTemplate({
        ...(editingTemplate as FollowUpTemplate),
        id: '',
        createdAt: new Date().toISOString(),
      });
    } else if (templateModal === 'edit' && editingTemplate.id) {
      updateFollowUpTemplate(editingTemplate.id, editingTemplate);
    }
    setTemplateModal('list');
    setEditingTemplate({});
  };

  // Preview message modal
  const previewMessage = (followUp: FollowUp) => {
    const templateId = selectedTemplate[followUp.id] || followUpTemplates.find(t => t.type === followUp.type)?.id;
    if (!templateId) {
      alert('Select a template first.');
      return;
    }
    setPreviewFollowUp(followUp);
  };

  // Insert placeholder into template message
  const insertPlaceholder = (placeholder: string) => {
    setEditingTemplate(prev => ({
      ...prev,
      message: (prev.message || '') + placeholder,
    }));
  };

  const tabs: { key: TabFilter; label: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'All', icon: Filter },
    { key: 'post_treatment', label: 'Post Treatment', icon: Stethoscope },
    { key: 'routine_checkup', label: 'Routine Checkup', icon: CalendarCheck },
    { key: 'missed_appointment', label: 'Missed', icon: Phone },
  ];

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p className="page-subtitle">{followUps.length} total follow-ups</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }} onClick={() => setTemplateModal('list')}>
            <FileText size={17} /> Templates
          </button>
          <button className="btn" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)' }} onClick={generateAll}>
            <RefreshCw size={17} /> Generate
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-4 gap-6 mb-12">
        {[
          { title: 'Due Today', value: stats.dueToday, icon: Bell, accent: '#0ea5e9' },
          { title: 'Pending', value: stats.pending, icon: Clock, accent: '#d97706' },
          { title: 'Sent', value: stats.sent, icon: CheckCircle, accent: '#059669' },
          { title: 'Overdue', value: stats.overdue, icon: AlertTriangle, accent: '#e11d48' },
        ].map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: stat.accent }}>
              <stat.icon size={24} strokeWidth={2.5} color="white" />
            </div>
            <div className="stat-content">
              <p className="stat-label">{stat.title}</p>
              <h3 className="stat-value">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Status Filter */}
      <div className="followup-controls">
        <div className="followup-tabs">
          {tabs.map(tab => (
            <button
              key={tab.key}
              className={`followup-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="followup-status-filter">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="followup-status-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Follow-up List */}
      <div className="followup-list">
        {filtered.length === 0 ? (
          <div className="followup-empty card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Bell size={64} strokeWidth={1} style={{ color: 'var(--primary)', opacity: 0.2, marginBottom: '1.5rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>All Caught Up!</h3>
            <p style={{ color: 'var(--on-surface-variant)', marginBottom: '2rem' }}>No follow-ups match your current filters.</p>
            <button className="btn btn-primary" onClick={generateAll}>
              <RefreshCw size={16} /> Generate Follow-ups
            </button>
          </div>
        ) : (
          filtered.map(fu => {
            const patient = getPatient(fu.patientId);
            const tc = typeConfig[fu.type];
            const sc = statusConfig[fu.status];
            const isOverdue = fu.dueDate < today && fu.status === 'pending';
            const TypeIcon = tc.icon;

            return (
              <div key={fu.id} className={`followup-card ${isOverdue ? 'followup-card-overdue' : ''}`}>
                <div className="followup-card-left">
                  <div className="followup-patient-header">
                    <div className="followup-type-badge" style={{ background: tc.bg, color: tc.color }}>
                      <TypeIcon size={14} />
                      {tc.label}
                    </div>
                    <div className="followup-patient-name">{patient?.name || 'Unknown Patient'}</div>
                    
                    {fu.notes && (
                      <div style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        padding: '0.25rem 0.6rem',
                        background: 'var(--info-bg)',
                        borderRadius: '0.5rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}>
                        <Zap size={10} fill="currentColor" /> {fu.notes}
                      </div>
                    )}
                  </div>

                  <div className="followup-meta">
                    <div className="followup-meta-item">
                      <Phone size={14} /> {patient?.phone || 'No phone'}
                    </div>
                    {fu.treatmentType && (
                      <div className="followup-meta-item">
                        <Stethoscope size={14} /> {fu.treatmentType}
                      </div>
                    )}
                    <div className={`followup-meta-item followup-due ${isOverdue ? 'overdue' : ''}`}>
                      <Clock size={14} /> 
                      {new Date(fu.dueDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && <span className="overdue-badge">OVERDUE</span>}
                    </div>
                  </div>
                </div>

                <div className="followup-card-right">
                  {fu.status === 'pending' && (
                    <>
                      <select
                        className="followup-template-select"
                        value={selectedTemplate[fu.id] || ''}
                        onChange={e => setSelectedTemplate(prev => ({ ...prev, [fu.id]: e.target.value }))}
                      >
                        <option value="">Choose template...</option>
                        {followUpTemplates.filter(t => t.type === fu.type).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                        <option disabled>───────────</option>
                        {followUpTemplates.filter(t => t.type !== fu.type).map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({typeConfig[t.type]?.label})</option>
                        ))}
                      </select>

                      <button
                        className="followup-action-btn followup-preview-btn"
                        onClick={() => previewMessage(fu)}
                        title="Preview Message"
                      >
                        <Eye size={18} />
                      </button>

                      <button
                        className="followup-action-btn followup-whatsapp-btn"
                        onClick={() => sendWhatsApp(fu)}
                      >
                        <MessageCircle size={18} />
                        <span>Send WhatsApp</span>
                      </button>

                      <button
                        className="followup-action-btn followup-sent-btn"
                        onClick={() => markSent(fu.id)}
                        title="Mark as Sent"
                      >
                        <CheckCircle size={18} />
                      </button>

                      <button
                        className="followup-action-btn followup-dismiss-btn"
                        onClick={() => dismiss(fu.id)}
                        title="Dismiss"
                      >
                        <XCircle size={18} />
                      </button>
                    </>
                  )}

                  {fu.status !== 'pending' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <span className="followup-status-badge" style={{ background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                      <button
                        className="followup-action-btn"
                        onClick={() => deleteFollowUp(fu.id)}
                        title="Delete"
                        style={{ color: '#ef4444', border: 'none', background: 'transparent' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ═══ Preview Modal ═══ */}
      {previewFollowUp && (
        <div className="modal-overlay" onClick={() => setPreviewFollowUp(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title"><Eye size={20} /> Message Preview</h2>
              <button className="btn btn-icon" onClick={() => setPreviewFollowUp(null)}><X size={20} /></button>
            </div>
            <div className="followup-preview-box">
              <div className="followup-preview-header">
                <MessageCircle size={16} color="#25D366" />
                <span>WhatsApp Message</span>
              </div>
              <div className="followup-preview-body">
                {buildMessage(previewFollowUp, selectedTemplate[previewFollowUp.id] || followUpTemplates.find(t => t.type === previewFollowUp.type)?.id)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-whatsapp" style={{ flex: 1 }} onClick={() => { sendWhatsApp(previewFollowUp); setPreviewFollowUp(null); }}>
                <Send size={16} /> Send via WhatsApp
              </button>
              <button className="btn" style={{ background: '#f1f5f9' }} onClick={() => setPreviewFollowUp(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Templates Modal ═══ */}
      {templateModal && (
        <div className="modal-overlay" onClick={() => { setTemplateModal(null); setEditingTemplate({}); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '100%' }}>
            {templateModal === 'list' && (
              <>
                <div className="modal-header">
                  <h2 className="modal-title"><FileText size={20} /> Message Templates</h2>
                  <button className="btn btn-icon" onClick={() => setTemplateModal(null)}><X size={20} /></button>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={openAddTemplate}>
                    <Plus size={14} /> New Template
                  </button>
                </div>
                <div className="followup-template-list">
                  {followUpTemplates.length === 0 ? (
                    <div className="followup-empty" style={{ padding: '2rem' }}>
                      <FileText size={32} strokeWidth={1} />
                      <p>No templates yet. Create one to get started!</p>
                    </div>
                  ) : (
                    followUpTemplates.map(t => (
                      <div key={t.id} className="followup-template-item">
                        <div className="followup-template-item-left">
                          <div className="followup-template-name">{t.name}</div>
                          <div className="followup-type-badge" style={{
                            background: typeConfig[t.type]?.bg || '#f3f4f6',
                            color: typeConfig[t.type]?.color || '#6b7280',
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.5rem',
                          }}>
                            {typeConfig[t.type]?.label || t.type}
                          </div>
                          <div className="followup-template-preview">{t.message.slice(0, 100)}...</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                          <button className="btn btn-icon" style={{ color: 'var(--warning)' }} onClick={() => openEditTemplate(t)}>
                            <Edit2 size={15} />
                          </button>
                          {!t.isDefault && (
                            <button className="btn btn-icon" style={{ color: '#ef4444' }} onClick={() => { if (confirm('Delete this template?')) deleteFollowUpTemplate(t.id); }}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {(templateModal === 'add' || templateModal === 'edit') && (
              <>
                <div className="modal-header">
                  <h2 className="modal-title"><FileText size={20} /> {templateModal === 'add' ? 'New' : 'Edit'} Template</h2>
                  <button className="btn btn-icon" onClick={() => setTemplateModal('list')}><X size={20} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); saveTemplate(); }}>
                  <div className="form-group">
                    <label className="form-label">Template Name</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Post Extraction Follow-up"
                      value={editingTemplate.name || ''}
                      onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={editingTemplate.type || 'post_treatment'}
                      onChange={e => setEditingTemplate(prev => ({ ...prev, type: e.target.value as FollowUpType }))}
                    >
                      <option value="post_treatment">Post Treatment</option>
                      <option value="routine_checkup">Routine Checkup</option>
                      <option value="missed_appointment">Missed Appointment</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Treatment Type (Optional)</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Root Canal, Extraction (leave blank for all)"
                      value={editingTemplate.treatmentType || ''}
                      onChange={e => setEditingTemplate(prev => ({ ...prev, treatmentType: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message Template</label>
                    <div className="followup-placeholder-bar">
                      {['{{patientName}}', '{{clinicName}}', '{{treatmentType}}', '{{appointmentDate}}', '{{followUpDate}}'].map(p => (
                        <button key={p} type="button" className="followup-placeholder-btn" onClick={() => insertPlaceholder(p)}>
                          {p.replace(/\{\{|\}\}/g, '')}
                        </button>
                      ))}
                    </div>
                    <textarea
                      className="form-textarea"
                      rows={5}
                      placeholder="Type your message template here..."
                      value={editingTemplate.message || ''}
                      onChange={e => setEditingTemplate(prev => ({ ...prev, message: e.target.value }))}
                      required
                      style={{ marginTop: '0.5rem' }}
                    />
                  </div>

                  {/* Live Preview */}
                  {editingTemplate.message && (
                    <div className="followup-preview-box" style={{ marginBottom: '1.5rem' }}>
                      <div className="followup-preview-header">
                        <Eye size={14} />
                        <span>Live Preview</span>
                      </div>
                      <div className="followup-preview-body">
                        {(editingTemplate.message || '')
                          .replace(/\{\{patientName\}\}/g, 'Rajesh Kumar')
                          .replace(/\{\{clinicName\}\}/g, activeClinic?.name || 'SmileSync Dental')
                          .replace(/\{\{treatmentType\}\}/g, 'Root Canal')
                          .replace(/\{\{appointmentDate\}\}/g, 'Monday, April 25, 2026')
                          .replace(/\{\{followUpDate\}\}/g, 'Tuesday, April 26, 2026')}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                      {templateModal === 'add' ? 'Create Template' : 'Save Changes'}
                    </button>
                    <button type="button" className="btn" style={{ background: '#f1f5f9' }} onClick={() => setTemplateModal('list')}>
                      Back
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
