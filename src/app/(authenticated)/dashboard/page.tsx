'use client';

import { useStore } from '@/store';
import { Users, CalendarDays, IndianRupee, Clock, ArrowUpRight } from 'lucide-react';
import { format, isToday } from 'date-fns';
import Link from 'next/link';

export default function DashboardPage() {
  const { patients, appointments, invoices } = useStore();

  const totalPatients = patients.length;
  const todayAppointments = appointments.filter(a => isToday(new Date(a.date + 'T00:00:00')));
  const monthlyRevenue = invoices
    .filter(i => new Date(i.date).getMonth() === new Date().getMonth() && i.status === 'Paid')
    .reduce((acc, curr) => acc + curr.finalAmount, 0);
  const pendingPayments = invoices.filter(i => i.status === 'Pending').length;

  const upcomingFollowUps = appointments.flatMap(a =>
    a.treatments
      .filter(t => t.followUpDate && new Date(t.followUpDate) >= new Date())
      .map(t => ({
        patientName: patients.find(p => p.id === a.patientId)?.name || 'Unknown',
        followUpDate: t.followUpDate,
        treatmentNotes: t.notes,
      }))
  );

  const stats = [
    { title: 'Total Patients', value: totalPatients, icon: Users, color: 'var(--primary)', bg: 'var(--info-bg)' },
    { title: "Today's Appointments", value: todayAppointments.length, icon: CalendarDays, color: 'var(--success)', bg: 'var(--success-bg)' },
    { title: 'Monthly Revenue', value: `₹${monthlyRevenue.toLocaleString()}`, icon: IndianRupee, color: 'var(--warning)', bg: 'var(--warning-bg)' },
    { title: 'Pending Payments', value: pendingPayments, icon: Clock, color: 'var(--danger)', bg: 'var(--danger-bg)' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Dashboard</h1>
          <p className="page-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-4 gap-5" style={{ marginBottom: '1.75rem' }}>
        {stats.map((stat, i) => (
          <div key={i} className="card stat-card">
            <div className="stat-icon" style={{ background: stat.bg, color: stat.color }}>
              <stat.icon size={26} />
            </div>
            <div>
              <p className="stat-label">{stat.title}</p>
              <h3 className="stat-value">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2 gap-5">
        {/* Today's Schedule */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <CalendarDays size={20} color="var(--primary)" /> Today&apos;s Schedule
            </h3>
            <Link href="/appointments" className="btn btn-sm" style={{ textDecoration: 'none' }}>
              View All <ArrowUpRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {todayAppointments.length === 0 ? (
              <div className="empty-state">No appointments scheduled for today.</div>
            ) : (
              todayAppointments.slice(0, 5).map(app => {
                const patient = patients.find(p => p.id === app.patientId);
                return (
                  <div key={app.id} className="schedule-item">
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div className="schedule-time">{app.time}</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{patient?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{app.treatmentType || 'General'}</div>
                      </div>
                    </div>
                    <span className={`badge badge-${app.status === 'Completed' ? 'success' : app.status === 'Cancelled' ? 'danger' : 'primary'}`}>
                      {app.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column — Quick Actions + Follow-ups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Quick Actions */}
          <div className="card">
            <h3 className="card-title"><ArrowUpRight size={20} color="var(--primary)" /> Quick Actions</h3>
            <div className="grid grid-3 gap-4" style={{ marginTop: '0.5rem' }}>
              <Link href="/patients" className="quick-action">
                <Users size={26} color="var(--primary)" />
                <span>Add Patient</span>
              </Link>
              <Link href="/appointments" className="quick-action">
                <CalendarDays size={26} color="var(--success)" />
                <span>Book Appt</span>
              </Link>
              <Link href="/billing" className="quick-action">
                <IndianRupee size={26} color="#d97706" />
                <span>New Invoice</span>
              </Link>
            </div>
          </div>

          {/* Upcoming Follow-ups */}
          <div className="card" style={{ flex: 1 }}>
            <h3 className="card-title"><Clock size={20} color="var(--warning)" /> Upcoming Follow-ups</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {upcomingFollowUps.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>No upcoming follow-ups.</div>
              ) : (
                upcomingFollowUps.slice(0, 4).map((fu, i) => (
                  <div key={i} className="schedule-item">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{fu.patientName}</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fu.treatmentNotes}</div>
                    </div>
                    <span className="badge badge-warning">{fu.followUpDate}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
