'use client';

import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store';
import { Users, CalendarDays, IndianRupee, Clock, Plus, Send, MessageCircle, Bell } from 'lucide-react';
import { isToday } from 'date-fns';
import Link from 'next/link';
import { useMemo } from 'react';

export default function DashboardPage() {
  const { user } = useUser();
  const { patients, appointments, invoices, followUps } = useStore();

  const totalPatients = patients.length;
  const todayAppointments = appointments.filter(a => isToday(new Date(a.date + 'T00:00:00')));
  const monthlyRevenue = invoices
    .filter(i => new Date(i.date).getMonth() === new Date().getMonth() && i.status === 'Paid')
    .reduce((acc, curr) => acc + curr.finalAmount, 0);
  const pendingPayments = invoices
    .filter(i => i.status === 'Pending')
    .reduce((acc, curr) => acc + curr.finalAmount, 0);

  // Follow-ups due today or overdue
  const today = new Date().toISOString().split('T')[0];
  const pendingFollowUps = useMemo(() => {
    return followUps
      .filter(f => f.status === 'pending' && f.dueDate <= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  }, [followUps, today]);

  const totalPendingFollowUps = followUps.filter(f => f.status === 'pending').length;

  const stats = [
    { title: 'Total Patients', value: totalPatients, icon: Users },
    { title: "Today's Appointments", value: todayAppointments.length, icon: CalendarDays },
    { title: 'Monthly Revenue', value: `₹${monthlyRevenue.toLocaleString()}`, icon: IndianRupee },
    { title: 'Pending Payments', value: `₹${pendingPayments.toLocaleString()}`, icon: Clock },
  ];

  const displayName = user?.fullName || user?.firstName || 'Clinic Owner';

  /* ── WhatsApp Reminder ── */
  const sendWhatsAppReminder = (app: typeof todayAppointments[0]) => {
    const patient = patients.find(p => p.id === app.patientId);
    if (!patient?.phone) return;
    let clinicLabel = 'SmileSync Dental';
    let clinicAddress = '';
    try {
      const saved = localStorage.getItem('smilesync_clinic');
      if (saved) { 
        const d = JSON.parse(saved); 
        if (d.clinicName) clinicLabel = d.clinicName; 
        if (d.clinicAddress) clinicAddress = d.clinicAddress;
      }
    } catch { /* fallback */ }
    const dateObj = new Date(app.date + 'T00:00:00');
    const dateLabel = dateObj.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
    const [h, m] = app.time.split(':');
    const hour = parseInt(h);
    const timeLabel = `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    
    const msg = [
      `*APPOINTMENT REMINDER*`,
      `--------------------------`,
      `Hello ${patient.name},`,
      ``,
      `Your dental visit at *${clinicLabel}* is scheduled for:`,
      ``,
      `📅  ${dateLabel}`,
      `⏰  ${timeLabel}`,
      app.treatmentType ? `🦷  ${app.treatmentType}` : '',
      ``,
      `📍 *Location:* ${clinicAddress || 'Our Clinic'}`,
      ``,
      `Please try to arrive 5–10 minutes early. We look forward to seeing you! ✨`,
      `--------------------------`,
      `_Reply to this message if you need to reschedule._`
    ].filter(Boolean).join('\n');

    let phone = patient.phone.replace(/[\s-()]/g, '');
    if (!phone.startsWith('+')) phone = phone.startsWith('91') ? phone : '91' + phone;
    else phone = phone.substring(1);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const typeLabels: Record<string, { label: string; color: string; bg: string }> = {
    post_treatment: { label: 'Post Treatment', color: '#e11d48', bg: '#fff1f2' },
    routine_checkup: { label: 'Routine Checkup', color: '#d97706', bg: '#fef9c3' },
    missed_appointment: { label: 'Missed Appt', color: '#2563eb', bg: '#eff6ff' },
  };

  return (
    <div className="animate-fade-in pb-10">
      {/* Dashboard Header */}
      <section className="flex flex-wrap justify-between items-start mb-8 gap-4">
        <div>
          <h1 className="headline-lg" style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>
            Good morning, {displayName}! 👋
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '1rem' }}>
            Here&apos;s your clinic overview for today
          </p>
        </div>
        <Link href="/appointments" className="btn btn-primary shadow-lg border-2 border-white/20">
          <Plus size={18} strokeWidth={3} /> Book Appointment
        </Link>
      </section>

      {/* Metric Grid */}
      <div className="grid grid-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon shadow-md">
              <stat.icon size={24} strokeWidth={2.5} />
            </div>
            <div className="stat-content">
              <p className="stat-label">{stat.title}</p>
              <h3 className="stat-value">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2 gap-8">
        {/* Upcoming Appointments */}
        <div className="card shadow-md">
          <header className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <CalendarDays size={20} className="text-primary" />
              <h2 className="card-title mb-0">Upcoming Appointments</h2>
            </div>
            {todayAppointments.filter(a => a.status === 'Scheduled').length > 0 && (
              <button
                className="btn btn-sm btn-whatsapp"
                onClick={() => {
                  const scheduled = todayAppointments.filter(a => a.status === 'Scheduled');
                  if (confirm(`Send WhatsApp reminders to ${scheduled.length} patient(s)?`)) {
                    scheduled.forEach((a, i) => setTimeout(() => sendWhatsAppReminder(a), i * 800));
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem' }}
                title="Send WhatsApp reminders to all scheduled patients"
              >
                <MessageCircle size={14} strokeWidth={2.5} /> Remind All
              </button>
            )}
          </header>

          <div className="flex flex-col gap-3">
            {todayAppointments.length === 0 ? (
              <div className="empty-state p-8 text-center text-on-surface-variant opacity-60 bg-surface-container-low rounded-xl">
                No upcoming appointments.
              </div>
            ) : (
              todayAppointments.slice(0, 5).map(app => {
                const patient = patients.find(p => p.id === app.patientId);
                return (
                  <div key={app.id} className="schedule-item">
                    <div className="flex gap-4 items-center">
                      <div className="schedule-time">{app.time}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{patient?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>{app.treatmentType}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {app.status === 'Scheduled' && patient?.phone && (
                        <button
                          className="btn btn-icon btn-sm btn-whatsapp-glass"
                          onClick={() => sendWhatsAppReminder(app)}
                          title="Send WhatsApp Reminder"
                          style={{ padding: '0.35rem', borderRadius: '8px' }}
                        >
                          <Send size={14} strokeWidth={2.5} />
                        </button>
                      )}
                      <span className={`badge badge-${app.status === 'Completed' ? 'success' : 'primary'}`}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Follow-ups Due Today */}
        <div className="card shadow-md">
          <header className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Bell size={20} className="text-primary" />
              <h2 className="card-title mb-0">Follow-ups Due</h2>
            </div>
            {totalPendingFollowUps > 0 && (
              <Link href="/follow-ups" className="btn btn-sm" style={{ background: '#f0f9ff', color: 'var(--primary)', fontWeight: 700 }}>
                View All ({totalPendingFollowUps})
              </Link>
            )}
          </header>

          <div className="flex flex-col gap-3">
            {pendingFollowUps.length === 0 ? (
              <div className="empty-state p-8 text-center text-on-surface-variant opacity-60 bg-surface-container-low rounded-xl">
                System clear. No pending follow-ups.
              </div>
            ) : (
              pendingFollowUps.map((fu) => {
                const patient = patients.find(p => p.id === fu.patientId);
                const tl = typeLabels[fu.type] || { label: fu.type, color: '#6b7280', bg: '#f3f4f6' };
                const isOverdue = fu.dueDate < today;
                return (
                  <div key={fu.id} className="schedule-item" style={{ borderLeft: isOverdue ? '3px solid #e11d48' : undefined }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{patient?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {fu.treatmentType || 'General'}
                        <span style={{
                          background: tl.bg,
                          color: tl.color,
                          padding: '0.1rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}>
                          {tl.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: isOverdue ? '#e11d48' : 'var(--on-surface-variant)' }}>
                      {new Date(fu.dueDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {isOverdue && <span style={{ marginLeft: '0.35rem', fontWeight: 800 }}>⚠️</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
