'use client';

import { useUser } from '@clerk/nextjs';
import { useStore } from '@/store';
import { Users, CalendarDays, IndianRupee, Clock, ArrowUpRight, Plus } from 'lucide-react';
import { format, isToday } from 'date-fns';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useUser();
  const { patients, appointments, invoices } = useStore();

  const totalPatients = patients.length;
  const todayAppointments = appointments.filter(a => isToday(new Date(a.date + 'T00:00:00')));
  const monthlyRevenue = invoices
    .filter(i => new Date(i.date).getMonth() === new Date().getMonth() && i.status === 'Paid')
    .reduce((acc, curr) => acc + curr.finalAmount, 0);
  const pendingPayments = invoices
    .filter(i => i.status === 'Pending')
    .reduce((acc, curr) => acc + curr.finalAmount, 0);

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
    { title: 'Total Patients', value: totalPatients, icon: Users },
    { title: "Today's Appointments", value: todayAppointments.length, icon: CalendarDays },
    { title: 'Monthly Revenue', value: `₹${monthlyRevenue.toLocaleString()}`, icon: IndianRupee },
    { title: 'Pending Payments', value: `₹${pendingPayments.toLocaleString()}`, icon: Clock },
  ];

  const displayName = user?.fullName || user?.firstName || 'Clinic Owner';

  return (
    <div className="animate-fade-in">
      {/* Dashboard Header from Image */}
      <section className="flex justify-between items-start mb-10">
        <div>
          <h1 className="headline-lg" style={{ fontSize: '2.2rem', marginBottom: '0.25rem' }}>
            Good morning, {displayName}! 👋
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '1rem' }}>
            Here&apos;s your clinic overview for today
          </p>
        </div>
        <Link href="/appointments" className="btn btn-primary">
          <Plus size={18} strokeWidth={3} /> Book Appointment
        </Link>
      </section>

      {/* Metric Grid: Row layout from image */}
      <div className="grid grid-4 gap-6 mb-10">
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon">
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
        {/* Upcoming Appointments Layout */}
        <div className="card">
          <header className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <CalendarDays size={20} className="text-primary" />
              <h2 className="card-title mb-0">Upcoming Appointments</h2>
            </div>
          </header>

          <div className="flex flex-col gap-3">
            {todayAppointments.length === 0 ? (
              <div className="empty-state">No upcoming appointments.</div>
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
                    <span className={`badge badge-${app.status === 'Completed' ? 'success' : 'primary'}`}>
                      {app.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups Layout */}
        <div className="card">
          <header className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <CalendarDays size={20} className="text-primary" />
              <h2 className="card-title mb-0">Upcoming Follow-ups</h2>
            </div>
          </header>

          <div className="flex flex-col gap-3">
            {upcomingFollowUps.length === 0 ? (
              <div className="empty-state">System clear. No pending follow-ups.</div>
            ) : (
              upcomingFollowUps.slice(0, 4).map((fu, i) => (
                <div key={i} className="schedule-item">
                  <div>
                    <div style={{ fontWeight: 700 }}>{fu.patientName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>{fu.treatmentNotes}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                    {fu.followUpDate}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
