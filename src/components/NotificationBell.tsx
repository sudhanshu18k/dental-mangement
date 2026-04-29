'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Megaphone, Check, CheckCheck } from 'lucide-react';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStore } from '@/store';
import { InAppNotification } from '@/types';

export default function NotificationBell() {
  const { activeClinicId } = useStore();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const ref = useRef<HTMLDivElement>(null);

  // Listen to clinic notifications
  useEffect(() => {
    if (!activeClinicId) return;
    const unsub = onSnapshot(
      collection(db, 'clinics', activeClinicId, 'notifications'),
      (snap) => {
        const items = snap.docs.map(d => ({ ...(d.data() as InAppNotification), id: d.id }));
        setNotifications(items.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()));
      }
    );
    return () => unsub();
  }, [activeClinicId]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    if (!activeClinicId) return;
    await updateDoc(doc(db, 'clinics', activeClinicId, 'notifications', id), {
      isRead: true,
      readAt: new Date().toISOString(),
    });
  };

  const markAllRead = async () => {
    if (!activeClinicId) return;
    const unread = notifications.filter(n => !n.isRead);
    await Promise.all(
      unread.map(n =>
        updateDoc(doc(db, 'clinics', activeClinicId, 'notifications', n.id), {
          isRead: true,
          readAt: new Date().toISOString(),
        })
      )
    );
  };

  const timeAgo = (dateStr: string) => {
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: 1000 }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          background: open ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
          border: '1px solid rgba(0,0,0,0.03)',
          borderRadius: '14px',
          width: '42px',
          height: '42px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          color: open ? '#6366f1' : 'var(--on-surface-variant)',
          boxShadow: open ? '0 4px 12px rgba(99,102,241,0.15)' : 'none',
        }}
        className="hover-lift"
        title="Notifications"
      >
        <Bell size={22} strokeWidth={2.2} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            minWidth: '18px',
            height: '18px',
            padding: '0 4px',
            borderRadius: '10px',
            background: '#ef4444',
            color: '#fff',
            fontSize: '0.65rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 3px #fff, 0 4px 8px rgba(239,68,68,0.3)',
            animation: 'pulse 2s ease-in-out infinite',
            zIndex: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 12px)',
          right: '-10px',
          width: '400px',
          maxHeight: '520px',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'notif-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Megaphone size={16} color="#6366f1" />
              <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--on-surface)' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  background: '#ede9fe', color: '#6366f1', padding: '0.1rem 0.5rem',
                  borderRadius: '999px', fontSize: '0.68rem', fontWeight: 800,
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 700, color: '#6366f1',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                  }}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} /> Read all
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: '0.1rem' }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                <Bell size={36} style={{ opacity: 0.15, marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600, fontSize: '0.88rem' }}>No notifications yet</p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Admin announcements will appear here.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid #f8fafc',
                    background: n.isRead ? '#fff' : '#faf5ff',
                    cursor: n.isRead ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                  }}
                  onClick={() => { if (!n.isRead) markAsRead(n.id); }}
                >
                  {/* Indicator */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: n.isRead ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '0.1rem',
                  }}>
                    <Megaphone size={16} color={n.isRead ? '#94a3b8' : '#fff'} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{
                        fontWeight: n.isRead ? 600 : 800,
                        fontSize: '0.88rem',
                        color: 'var(--on-surface)',
                        lineHeight: 1.3,
                      }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {timeAgo(n.sentAt)}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '0.8rem',
                      color: n.isRead ? '#94a3b8' : '#64748b',
                      lineHeight: 1.5,
                      marginTop: '0.25rem',
                      whiteSpace: 'pre-wrap',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {n.message}
                    </p>

                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        style={{
                          marginTop: '0.4rem',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '0.72rem', fontWeight: 700, color: '#6366f1',
                          display: 'flex', alignItems: 'center', gap: '0.2rem', padding: 0,
                        }}
                      >
                        <Check size={12} /> Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes notif-slide-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
