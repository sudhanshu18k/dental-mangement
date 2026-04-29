'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/store';
import { IndianRupee, FileDown, Plus, X, Receipt, Trash2, Edit3, Search, SlidersHorizontal, ArrowDown, ArrowUp, ChevronDown, UserPlus, MessageCircle } from 'lucide-react';
import { Invoice, InvoiceItem, Patient } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export default function BillingPage() {
  const { patients, appointments, invoices, addPatient, addInvoice, updateInvoice, deleteInvoice } = useStore();

  /* ── Clinic settings (from Settings → Clinic tab) ── */
  const [clinicName, setClinicName] = useState('SmileSync');
  const [clinicPhone, setClinicPhone] = useState('+91 98765 43210');
  const [clinicAddress, setClinicAddress] = useState('123 Healthcare Avenue, Medical District');
  const [clinicUPI, setClinicUPI] = useState('smilesync@upi');

  useEffect(() => {
    const saved = localStorage.getItem('smilesync_clinic');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.clinicName) setClinicName(data.clinicName);
        if (data.clinicPhone) setClinicPhone(data.clinicPhone);
        if (data.clinicAddress) setClinicAddress(data.clinicAddress);
        if (data.clinicUPI) setClinicUPI(data.clinicUPI);
      } catch { /* ignore */ }
    }
  }, []);

  /* ── Search, Filter, Sort state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  /* ── Modal state ── */
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [modalMode, setModalMode] = useState<'appointment' | 'manual'>('appointment');

  /* ── Appointment-based billing state ── */
  const [selectedApptId, setSelectedApptId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(18);

  /* ── Manual billing state ── */
  const [manualPatientId, setManualPatientId] = useState('');
  const [manualItems, setManualItems] = useState<InvoiceItem[]>([{ description: '', amount: 0 }]);
  const [manualDiscount, setManualDiscount] = useState(0);
  const [manualTax, setManualTax] = useState(18);
  const [manualNotes, setManualNotes] = useState('');

  /* ── Manual Billing Patient Search ── */
  const [manualPatientSearch, setManualPatientSearch] = useState('');
  const [manualPatientDropdownOpen, setManualPatientDropdownOpen] = useState(false);
  const [billingShowInlineAdd, setBillingShowInlineAdd] = useState(false);
  const [billingNewName, setBillingNewName] = useState('');
  const [billingNewPhone, setBillingNewPhone] = useState('');

  const filteredPatients = useMemo(() => {
    if (!manualPatientSearch.trim()) return patients;
    const q = manualPatientSearch.toLowerCase();
    return patients.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.phone || '').toLowerCase().includes(q)
    );
  }, [patients, manualPatientSearch]);

  const handleAddNewPatient = () => {
    const name = billingNewName.trim() || manualPatientSearch.trim();
    if (!name) return;
    const newId = 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
    const newPatient: Patient = {
      id: newId,
      name,
      phone: billingNewPhone.trim(),
      email: '',
      dob: '',
      gender: 'Other',
      address: '',
      medicalHistory: '',
      allergies: '',
      age: '',
      bloodGroup: '',
      createdAt: new Date().toISOString()
    };
    addPatient(newPatient);
    setManualPatientId(newId);
    setManualPatientSearch(`${newPatient.name} (${newPatient.phone || 'New'})`);
    setManualPatientDropdownOpen(false);
    setBillingShowInlineAdd(false);
    setBillingNewName('');
    setBillingNewPhone('');
  };

  /* ── Derived: appointment-based ── */
  const billableAppointments = useMemo(() => 
    appointments.filter(a => a.status === 'Completed' && !invoices.some(i => i.appointmentId === a.id)),
    [appointments, invoices]
  );

  const selectedAppt = appointments.find(a => a.id === selectedApptId);
  const treatmentCost = selectedAppt?.treatments.reduce((acc, t) => acc + t.cost, 0) || 0;
  const discountAmount = treatmentCost * discount / 100;
  const taxAmount = (treatmentCost - discountAmount) * tax / 100;
  const finalAmount = treatmentCost - discountAmount + taxAmount;

  /* ── Derived: manual ── */
  const manualSubtotal = manualItems.reduce((acc, item) => acc + (item.amount || 0), 0);
  const manualDiscountAmt = manualSubtotal * manualDiscount / 100;
  const manualTaxAmt = (manualSubtotal - manualDiscountAmt) * manualTax / 100;
  const manualFinal = manualSubtotal - manualDiscountAmt + manualTaxAmt;

  /* ── Reset modal state ── */
  const resetModal = () => {
    setInvoiceModal(false);
    setModalMode('appointment');
    setSelectedApptId('');
    setDiscount(0);
    setTax(18);
    setManualPatientId('');
    setManualItems([{ description: '', amount: 0 }]);
    setManualDiscount(0);
    setManualTax(18);
    setManualNotes('');
  };

  /* ── Manual: add/remove/update items ── */
  const addManualItem = () => setManualItems([...manualItems, { description: '', amount: 0 }]);
  const removeManualItem = (idx: number) => {
    if (manualItems.length === 1) {
      setManualItems([{ description: '', amount: 0 }]);
      return;
    }
    setManualItems(manualItems.filter((_, i) => i !== idx));
  };
  const updateManualItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...manualItems];
    if (field === 'amount') updated[idx].amount = Number(value);
    else updated[idx].description = value as string;
    setManualItems(updated);
  };

  /* ── Save: appointment-based ── */
  const handleGenerateFromAppt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;
    addInvoice({
      // eslint-disable-next-line react-hooks/purity
      id: 'inv' + Date.now(),
      appointmentId: selectedAppt.id,
      patientId: selectedAppt.patientId,
      treatmentCost,
      discount,
      tax,
      finalAmount,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
    });
    resetModal();
  };

  /* ── Save: manual billing ── */
  const handleGenerateManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPatientId || manualItems.every(i => !i.description && !i.amount)) return;
    addInvoice({
      // eslint-disable-next-line react-hooks/purity
      id: 'inv' + Date.now(),
      patientId: manualPatientId,
      treatmentCost: manualSubtotal,
      discount: manualDiscount,
      tax: manualTax,
      finalAmount: manualFinal,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
      items: manualItems.filter(i => i.description || i.amount > 0),
      notes: manualNotes || undefined,
    });
    resetModal();
  };

  /* ── PDF Download (shared) ── */
  const handleDownloadPDF = async (inv: Invoice) => {
    const patient = patients.find(p => p.id === inv.patientId);
    const appt = inv.appointmentId ? appointments.find(a => a.id === inv.appointmentId) : null;
    
    const doc = new jsPDF();
    
    // ======== HEADER ========
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(14, 165, 233);
    doc.text(clinicName, 14, 25);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Dental Care & Aesthetics', 14, 31);
    
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const addressLines = clinicAddress.split(',').map(s => s.trim());
    doc.text(addressLines[0] || '', 195, 20, { align: 'right' });
    doc.text(addressLines.slice(1).join(', ') || '', 195, 25, { align: 'right' });
    doc.text(`Phone: ${clinicPhone}`, 195, 30, { align: 'right' });
    doc.text(`UPI: ${clinicUPI}`, 195, 35, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 195, 40);

    // ======== INVOICE TITLE & DETAILS ========
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text('INVOICE', 14, 52);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
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
    doc.setFont("helvetica", "bold");
    const statusColor = inv.status === 'Paid' ? [16, 185, 129] : [245, 158, 11];
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(inv.status.toUpperCase(), 155, 62);

    // ======== BILL TO SECTION ========
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text('Bill To:', 14, 65);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(patient?.name || 'Unknown Patient', 14, 71);
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    if (patient?.phone) doc.text(`Phone: ${patient.phone}`, 14, 76);
    if (patient?.email) doc.text(`Email: ${patient.email}`, 14, 81);
    if (appt?.date) {
        let displayDate = appt.date;
        try {
            displayDate = new Date(appt.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch(e) { /* keep original */ }
        doc.text(`Treatment Date: ${displayDate}`, 14, 86);
    }

    // ======== ITEMS TABLE ========
    let tableData: (string | number)[][] = [];

    if (appt) {
      // Appointment-linked invoice
      tableData = appt.treatments.map((t, index) => [
        index + 1,
        `Tooth #${t.toothNumber} - ${t.notes}`, 
        `₹${t.cost.toLocaleString('en-IN')}`
      ]);
    } else if (inv.items && inv.items.length > 0) {
      // Manual invoice with line items
      tableData = inv.items.map((item, index) => [
        index + 1,
        item.description || 'Service',
        `₹${item.amount.toLocaleString('en-IN')}`
      ]);
    } else {
      tableData = [[1, 'General Dental Treatment', `₹${inv.treatmentCost.toLocaleString('en-IN')}`]];
    }

    autoTable(doc, {
      startY: 95,
      head: [['#', 'Description of Services', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [14, 165, 233], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: { 
        0: { cellWidth: 15, halign: 'center' },
        1: { halign: 'left' },
        2: { cellWidth: 40, halign: 'right' } 
      },
      styles: { 
        font: 'helvetica',
        fontSize: 10, 
        cellPadding: 6,
        lineColor: [226, 232, 240]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    // ======== TOTALS SECTION ========
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Thank you for choosing ${clinicName}.`, 14, finalY + 5);
    doc.text('Please feel free to contact us for any queries regarding this invoice.', 14, finalY + 10);

    if (inv.notes) {
      doc.text(`Note: ${inv.notes}`, 14, finalY + 16);
    }

    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    
    let currentY = finalY;
    
    doc.text('Subtotal:', 135, currentY);
    doc.text(`₹${inv.treatmentCost.toLocaleString('en-IN')}`, 195, currentY, { align: 'right' });
    currentY += 8;
    
    if (inv.discount > 0) {
      const discAmt = (inv.treatmentCost * inv.discount) / 100;
      doc.text(`Discount (${inv.discount}%):`, 135, currentY);
      doc.setTextColor(16, 185, 129);
      doc.text(`- ₹${discAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 195, currentY, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      currentY += 8;
    }
    
    if (inv.tax > 0) {
      const taxableAmount = inv.treatmentCost - ((inv.treatmentCost * inv.discount) / 100);
      const taxAmt = (taxableAmount * inv.tax) / 100;
      doc.text(`Taxes (${inv.tax}%):`, 135, currentY);
      doc.text(`+ ₹${taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 195, currentY, { align: 'right' });
      currentY += 8;
    }
    
    currentY += 2;
    doc.setFillColor(14, 165, 233);
    doc.rect(130, currentY, 65, 12, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Total:', 135, currentY + 8);
    doc.text(`₹${inv.finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, currentY + 8, { align: 'right' });
    
    // ======== UPI QR CODE PAYMENT SECTION ========
    currentY += 22;
    
    const upiId = clinicUPI;
    const upiName = clinicName;
    const upiAmount = inv.finalAmount.toFixed(2);
    const upiTxnNote = `Invoice INV-${inv.id.slice(-6).toUpperCase()}`;
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent(upiTxnNote)}`;

    try {
      const qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });

      const qrBoxY = currentY;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, qrBoxY, 85, 72, 3, 3, 'FD');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Scan to Pay', 56.5, qrBoxY + 8, { align: 'center' });
      
      doc.addImage(qrDataUrl, 'PNG', 32, qrBoxY + 12, 48, 48);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`UPI: ${upiId}`, 56.5, qrBoxY + 66, { align: 'center' });
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const instructionX = 108;
      doc.text('Payment Instructions:', instructionX, qrBoxY + 10);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('1. Open any UPI app (Google Pay, PhonePe,', instructionX, qrBoxY + 18);
      doc.text('   Paytm, BHIM, etc.)', instructionX, qrBoxY + 23);
      doc.text('2. Scan the QR code on the left', instructionX, qrBoxY + 31);
      doc.text('3. Verify the amount and merchant name', instructionX, qrBoxY + 39);
      doc.text('4. Complete the payment', instructionX, qrBoxY + 47);
      
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('For any payment issues, contact us at:', instructionX, qrBoxY + 57);
      doc.text(clinicPhone, instructionX, qrBoxY + 62);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Pay via UPI: ${upiId}`, 14, currentY + 5);
      doc.text(`Amount: ₹${inv.finalAmount.toLocaleString('en-IN')}`, 14, currentY + 11);
    }
    
    // ======== FOOTER ========
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 280, 195, 280);
    doc.text(`${clinicName} - Dental Care Management`, 105, 287, { align: 'center' });

    doc.save(`${clinicName.replace(/\s+/g, '_')}_Invoice_${inv.id.slice(-6).toUpperCase()}.pdf`);
  };

  // Summary stats
  const handleSendWhatsApp = (inv: Invoice) => {
    const patient = patients.find(p => p.id === inv.patientId);
    if (!patient || !patient.phone) {
      alert("Patient phone number not found.");
      return;
    }
    
    // Clean phone number (remove spaces, plus, etc.)
    let phoneStr = patient.phone.replace(/[^0-9]/g, '');
    if (phoneStr.length === 10) {
      phoneStr = '91' + phoneStr; // Assuming India as default if 10 digits
    }

    const message = `Hello ${patient.name},

This is regarding your recent visit to ${clinicName}.
Invoice No: #INV-${inv.id.slice(-6).toUpperCase()}
Amount: ₹${inv.finalAmount.toLocaleString('en-IN')}
Status: ${inv.status}

Thank you for choosing ${clinicName}!`;

    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${phoneStr}?text=${encodedMessage}`;
    window.open(url, '_blank');
  };
  const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((a, i) => a + i.finalAmount, 0);
  const totalPending = invoices.filter(i => i.status === 'Pending').reduce((a, i) => a + i.finalAmount, 0);

  /* ── Filtered & sorted invoices ── */
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    // Search by patient name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inv => {
        const patient = patients.find(p => p.id === inv.patientId);
        return (patient?.name || '').toLowerCase().includes(q)
          || inv.id.toLowerCase().includes(q);
      });
    }

    // Filter by status
    if (statusFilter !== 'All') {
      result = result.filter(inv => inv.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else {
        cmp = a.finalAmount - b.finalAmount;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [invoices, patients, searchQuery, statusFilter, sortBy, sortDir]);

  return (
    <div style={{ padding: '0.25rem 0.5rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem', color: 'var(--on-surface)' }}>Billing & Invoices</h1>
          <p className="page-subtitle" style={{ fontSize: '1rem', color: 'var(--on-surface-variant)', opacity: 0.8 }}>
            {clinicName} — {invoices.length} total records
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn" 
            onClick={() => { setModalMode('manual'); setInvoiceModal(true); }}
            style={{ 
              background: 'var(--surface-container-low)', 
              border: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              fontWeight: 700,
              padding: '0.75rem 1.25rem',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px var(--shadow-color, rgba(0,0,0,0.04))',
              transition: 'all 0.2s'
            }}
          >
            <Edit3 size={18} /> Manual Entry
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => { setModalMode('appointment'); setInvoiceModal(true); }}
            style={{ 
              fontWeight: 700,
              padding: '0.75rem 1.5rem',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 8px 16px var(--primary-shadow, rgba(14, 165, 233, 0.2))'
            }}
          >
            <Plus size={20} /> Create Invoice
          </button>
        </div>
      </div>

      {/* ── Stats Section ── */}
      <div className="grid grid-3 gap-6" style={{ marginBottom: '2.5rem' }}>
        {[
          { label: 'Total Revenue', value: totalRevenue, icon: <IndianRupee size={24} />, color: 'var(--success)', bg: 'var(--success-bg)' },
          { label: 'Pending Collections', value: totalPending, icon: <Receipt size={24} />, color: 'var(--warning)', bg: 'var(--warning-bg)' },
          { label: 'Total Issued', value: invoices.length, icon: <FileDown size={24} />, color: 'var(--primary)', bg: 'var(--info-bg)', isCount: true },
        ].map((stat, i) => (
          <div key={i} className="card stat-card" style={{ 
            padding: '1.75rem', 
            borderRadius: '1.5rem', 
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface-container-lowest)',
            display: 'flex', 
            alignItems: 'center', 
            gap: '1.25rem',
            boxShadow: '0 10px 30px -10px var(--shadow-color, rgba(0,0,0,0.05))',
            transition: 'transform 0.2s'
          }}>
            <div className="stat-icon" style={{ 
              background: stat.bg, 
              color: stat.color,
              width: '56px',
              height: '56px',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {stat.icon}
            </div>
            <div>
              <p className="stat-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </p>
              <h3 className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>
                {stat.isCount ? stat.value : `₹${stat.value.toLocaleString()}`}
              </h3>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search / Filter / Sort Toolbar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          flex: '1 1 280px',
          position: 'relative',
          maxWidth: '400px',
        }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--on-surface-variant)',
            opacity: 0.5,
          }} />
          <input
            className="form-input"
            placeholder="Search by patient name or invoice ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '2.75rem',
              borderRadius: '1rem',
              border: '1px solid var(--outline-variant)',
              background: 'white',
              fontSize: '0.9rem',
              height: '2.75rem',
            }}
          />
        </div>

        {/* Status Filter Pills */}
        <div style={{
          display: 'flex',
          gap: '0.35rem',
          background: 'var(--surface-container-low)',
          padding: '0.3rem',
          borderRadius: '0.75rem',
          border: '1px solid var(--outline-variant)',
        }}>
          {(['All', 'Paid', 'Pending'] as const).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                border: 'none',
                padding: '0.45rem 0.85rem',
                borderRadius: '0.5rem',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: statusFilter === status ? 'white' : 'transparent',
                color: statusFilter === status
                  ? (status === 'Paid' ? 'var(--success)' : status === 'Pending' ? 'var(--warning)' : 'var(--on-surface)')
                  : 'var(--on-surface-variant)',
                boxShadow: statusFilter === status ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {status === 'Paid' ? '● Paid' : status === 'Pending' ? '● Unpaid' : 'All'}
            </button>
          ))}
        </div>

        {/* Sort Control */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          marginLeft: 'auto',
        }}>
          <SlidersHorizontal size={15} style={{ color: 'var(--on-surface-variant)', opacity: 0.6 }} />
          <select
            className="form-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as 'date' | 'amount')}
            style={{
              border: '1px solid var(--outline-variant)',
              borderRadius: '0.75rem',
              padding: '0.45rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              minWidth: 'auto',
              width: 'auto',
              height: '2.75rem',
              background: 'white',
              color: 'var(--on-surface)',
            }}
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            className="btn btn-icon btn-sm"
            title={sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '0.75rem',
              background: 'white',
              border: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sortDir === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>

      {/* ── Table Section ── */}
      <div className="card" style={{ 
        padding: 0, 
        overflow: 'hidden', 
        borderRadius: '1.5rem', 
        border: '1px solid var(--outline-variant)',
        background: 'var(--surface-container-lowest)',
        boxShadow: '0 4px 20px var(--shadow-color, rgba(0,0,0,0.03))'
      }}>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead>
              <tr style={{ background: 'var(--surface-container)', borderBottom: '1px solid var(--outline-variant)' }}>
                {['ID', 'Issue Date', 'Patient Name', 'Type', 'Subtotal', 'Discount', 'Payable', 'Status', 'Actions'].map((h, i) => (
                  <th key={i} style={{ 
                    padding: '1.25rem 1.5rem', 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    color: 'var(--on-surface-variant)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    textAlign: 'left'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ fontSize: '0.9rem' }}>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                    <div style={{ opacity: 0.4, marginBottom: '1rem', color: 'var(--on-surface-variant)' }}><Receipt size={48} /></div>
                    <p style={{ fontWeight: 600, color: 'var(--on-surface-variant)' }}>
                      {invoices.length === 0 ? 'No invoice history available.' : 'No invoices match your filters.'}
                    </p>
                    {(searchQuery || statusFilter !== 'All') && invoices.length > 0 && (
                      <button
                        className="btn btn-sm"
                        onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
                        style={{
                          marginTop: '0.75rem',
                          background: 'var(--info-bg)',
                          color: 'var(--primary)',
                          border: '1px solid var(--outline-variant)',
                          fontWeight: 600,
                          borderRadius: '0.75rem',
                        }}
                      >
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const patient = patients.find(p => p.id === inv.patientId);
                  const isManual = !inv.appointmentId;
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--outline-variant)', transition: 'background 0.2s', color: 'var(--on-surface)' }} className="hover-row">
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>#{inv.id.slice(-6).toUpperCase()}</td>
                      <td style={{ padding: '1.25rem 1.5rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>{inv.date}</td>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{patient?.name || 'Unknown'}</td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.75rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: isManual ? 'rgba(139, 92, 246, 0.12)' : 'var(--info-bg)',
                          color: isManual ? '#a78bfa' : 'var(--primary)',
                          border: `1px solid ${isManual ? 'rgba(139, 92, 246, 0.2)' : 'var(--outline-variant)'}`
                        }}>
                          {isManual ? <Plus size={12} /> : <Receipt size={12} />}
                          {isManual ? 'Manual' : 'System'}
                        </span>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 500 }}>₹{inv.treatmentCost.toLocaleString()}</td>
                      <td style={{ padding: '1.25rem 1.5rem', color: inv.discount > 0 ? 'var(--success)' : 'var(--on-surface-variant)', fontWeight: 600 }}>{inv.discount}%</td>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: 800, fontSize: '1rem' }}>₹{inv.finalAmount.toLocaleString()}</td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <select
                          className="status-select"
                          style={{
                            background: inv.status === 'Paid' ? 'var(--success-bg)' : 'var(--warning-bg)',
                            color: inv.status === 'Paid' ? 'var(--success)' : 'var(--warning)',
                            borderRadius: '0.75rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            WebkitAppearance: 'none'
                          }}
                          value={inv.status}
                          onChange={e => updateInvoice(inv.id, { status: e.target.value as Invoice['status'] })}
                        >
                          <option value="Paid">● Paid</option>
                          <option value="Pending">● Unpaid</option>
                        </select>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            className="btn btn-sm btn-icon" 
                            onClick={() => handleDownloadPDF(inv)}
                            style={{ padding: '0.5rem', borderRadius: '0.75rem', background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}
                            title="Download PDF"
                          >
                            <FileDown size={18} />
                          </button>
                          <button 
                            className="btn btn-sm btn-icon" 
                            onClick={() => handleSendWhatsApp(inv)}
                            style={{ padding: '0.5rem', borderRadius: '0.75rem', background: '#dcfce7', color: '#16a34a' }}
                            title="Send to WhatsApp"
                          >
                            <MessageCircle size={18} />
                          </button>
                          <button 
                            className="btn btn-sm btn-icon" 
                            onClick={() => { if (confirm(`Delete invoice #${inv.id.slice(-6).toUpperCase()}? This cannot be undone.`)) deleteInvoice(inv.id); }}
                            style={{ padding: '0.5rem', borderRadius: '0.75rem', background: 'var(--danger-bg, rgba(239,68,68,0.08))', color: 'var(--danger)' }}
                            title="Delete invoice"
                          >
                            <Trash2 size={18} />
                          </button>
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

      <style jsx>{`
        .hover-row:hover {
          background: var(--surface-container-low);
        }
      `}</style>

      {/* ═══ Invoice Modal ═══ */}
      {invoiceModal && (
        <div className="modal-overlay" onClick={resetModal} style={{ background: 'var(--scrim-color, rgba(15, 23, 42, 0.4))', backdropFilter: 'blur(8px)' }}>
          <div className="modal-content" style={{ 
            width: '100%',
            maxWidth: '640px',
            margin: '1rem',
            maxHeight: '92vh', 
            overflow: 'auto', 
            borderRadius: '2rem',
            background: 'var(--surface-container-lowest)',
            boxShadow: '0 40px 120px -20px var(--shadow-color, rgba(0,0,0,0.15))',
            border: '1px solid var(--outline-variant)'
          }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '1.5rem 1.75rem 1.25rem', borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '12px', 
                  background: 'var(--info-bg)', 
                  color: 'var(--primary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)'
                }}>
                  <IndianRupee size={22} />
                </div>
                <div>
                  <h2 className="modal-title" style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>
                    {modalMode === 'manual' ? 'Manual Billing' : 'Create Invoice'}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--on-surface-variant)', opacity: 0.8 }}>
                    {modalMode === 'manual' ? 'Generate a custom bill' : 'Bill from a completed visit'}
                  </p>
                </div>
              </div>
              <button 
                className="btn btn-icon" 
                onClick={resetModal} 
                style={{ 
                  background: 'var(--surface-container-high, #e2e8f0)', 
                  borderRadius: '12px', 
                  padding: '8px' 
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Tab Switcher ── */}
            <div style={{
              display: 'flex',
              gap: '0.35rem',
              borderRadius: '1rem',
              background: 'var(--surface-container, #f1f5f9)',
              padding: '0.4rem',
              margin: '0 1.75rem 1.5rem',
              border: '1px solid var(--outline-variant, #e2e8f0)'
            }}>
              <button
                type="button"
                onClick={() => setModalMode('appointment')}
                style={{
                  flex: 1,
                  padding: '0.8rem 1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: modalMode === 'appointment' ? 'var(--surface-container-lowest, #fff)' : 'transparent',
                  color: modalMode === 'appointment' ? 'var(--primary)' : 'var(--on-surface-variant, #64748b)',
                  boxShadow: modalMode === 'appointment' ? '0 4px 15px rgba(0,0,0,0.06)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Receipt size={16} /> From Visit
              </button>
              <button
                type="button"
                onClick={() => setModalMode('manual')}
                style={{
                  flex: 1,
                  padding: '0.8rem 1rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: modalMode === 'manual' ? 'var(--surface-container-lowest, #fff)' : 'transparent',
                  color: modalMode === 'manual' ? '#8b5cf6' : 'var(--on-surface-variant, #64748b)',
                  boxShadow: modalMode === 'manual' ? '0 4px 15px rgba(139, 92, 246, 0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Plus size={16} /> Manual
              </button>
            </div>

            {/* ═══ Appointment-based form ═══ */}
            {modalMode === 'appointment' && (
              <form onSubmit={handleGenerateFromAppt} style={{ padding: '0 1.75rem 1.75rem' }}>
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ 
                    fontSize: '0.72rem', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.08em', 
                    fontWeight: 800, 
                    color: 'var(--on-surface-variant)',
                    marginBottom: '0.6rem',
                    display: 'block'
                  }}>Select Completed Appointment</label>
                  <select 
                    required 
                    className="form-select" 
                    value={selectedApptId} 
                    onChange={e => setSelectedApptId(e.target.value)} 
                    style={{ 
                      borderRadius: '1rem', 
                      border: '1.5px solid var(--outline-variant)',
                      height: '3.2rem',
                      fontSize: '0.95rem',
                      padding: '0 1rem'
                    }}
                  >
                    <option value="">Search visits...</option>
                    {billableAppointments.map(a => {
                      const patient = patients.find(p => p.id === a.patientId);
                      return <option key={a.id} value={a.id}>{a.date} — {patient?.name} ({a.treatmentType})</option>;
                    })}
                  </select>
                </div>

                {selectedAppt && (
                  <>
                    <div className="invoice-summary" style={{ 
                      margin: '1.5rem 0', 
                      padding: '1.5rem', 
                      background: 'var(--surface-container-lowest)', 
                      borderRadius: '1.25rem', 
                      border: '1px solid var(--outline-variant)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                      <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ color: 'var(--on-surface-variant)', fontWeight: 600 }}>Treatment value ({selectedAppt?.treatments?.length || 0} items)</span>
                        <strong style={{ fontWeight: 800, fontSize: '1.1rem' }}>₹{treatmentCost.toLocaleString()}</strong>
                      </div>

                      <div className="grid grid-2 gap-5" style={{ margin: '1.25rem 0' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--on-surface-variant)' }}>Discount (%)</label>
                          <input type="number" min="0" max="100" className="form-input" value={discount} onChange={e => setDiscount(Number(e.target.value))} style={{ borderRadius: '0.75rem', border: '1.5px solid var(--outline-variant)' }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--on-surface-variant)' }}>Tax (%)</label>
                          <input type="number" min="0" className="form-input" value={tax} onChange={e => setTax(Number(e.target.value))} style={{ borderRadius: '0.75rem', border: '1.5px solid var(--outline-variant)' }} />
                        </div>
                      </div>

                      <div style={{ height: '1.5px', background: 'var(--outline-variant)', margin: '1.25rem 0', opacity: 0.5 }} />

                      {discount > 0 && (
                        <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                          <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.92rem', fontWeight: 500 }}>Discount ({discount}%)</span>
                          <span style={{ color: 'var(--success)', fontWeight: 700 }}>-₹{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.92rem', fontWeight: 500 }}>Govt. Tax ({tax}%)</span>
                        <span style={{ fontWeight: 700 }}>+₹{taxAmount.toFixed(2)}</span>
                      </div>

                      <div className="invoice-row" style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        background: 'linear-gradient(135deg, var(--primary) 0%, #0284c7 100%)', 
                        color: 'white', 
                        padding: '1.25rem', 
                        borderRadius: '1.125rem',
                        boxShadow: '0 8px 30px rgba(14, 165, 233, 0.25)'
                      }}>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Payable Amount</span>
                        <span style={{ fontWeight: 900, fontSize: '1.5rem' }}>₹{finalAmount.toFixed(2)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem' }}>
                      <button type="button" className="btn" onClick={resetModal} style={{ borderRadius: '1rem', fontWeight: 700, padding: '0.8rem 1.75rem', background: 'var(--surface-container)' }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ borderRadius: '1rem', fontWeight: 800, padding: '0.8rem 2.25rem' }}>Confirm & Create</button>
                    </div>
                  </>
                )}

                {!selectedAppt && billableAppointments.length === 0 && (
                  <div className="empty-state" style={{ 
                    padding: '3rem 2rem', 
                    background: 'var(--surface-container-lowest)', 
                    borderRadius: '1.5rem', 
                    border: '2px dashed var(--outline-variant)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{ padding: '1rem', borderRadius: '50%', background: 'var(--surface-container)', color: 'var(--on-surface-variant)', opacity: 0.6 }}>
                      <Receipt size={32} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p style={{ color: 'var(--on-surface)', fontWeight: 700, margin: '0 0 0.4rem', fontSize: '1rem' }}>No ready visits found</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', margin: 0, maxWidth: '240px', lineHeight: 1.5 }}>
                        Only appointments marked as <b>Completed</b> can be billed.
                      </p>
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* ═══ Manual Billing form ═══ */}
            {modalMode === 'manual' && (
              <form onSubmit={handleGenerateManual} style={{ padding: '0 1.5rem 1.5rem' }}>
                {/* Patient select */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--on-surface-variant)' }}>Patient</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{
                      position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                      color: 'var(--on-surface-variant)', opacity: 0.45, pointerEvents: 'none',
                    }} />
                    <input
                      className="form-input"
                      placeholder="Search patient by name or phone..."
                      value={manualPatientSearch}
                      onChange={e => {
                        setManualPatientSearch(e.target.value);
                        setManualPatientDropdownOpen(true);
                        if (manualPatientId) {
                          const sel = patients.find(p => p.id === manualPatientId);
                          if (sel && e.target.value !== `${sel.name} (${sel.phone})`) {
                            setManualPatientId('');
                          }
                        }
                      }}
                      onFocus={() => setManualPatientDropdownOpen(true)}
                      style={{
                        borderRadius: '0.75rem',
                        border: '1.5px solid var(--outline-variant)',
                        paddingLeft: '2.5rem',
                        paddingRight: '2rem',
                        borderColor: manualPatientId ? 'var(--success)' : undefined,
                      }}
                    />
                    <ChevronDown size={16} style={{
                      position: 'absolute', right: '0.85rem', top: '50%', transform: `translateY(-50%) rotate(${manualPatientDropdownOpen ? 180 : 0}deg)`,
                      color: 'var(--on-surface-variant)', opacity: 0.4, pointerEvents: 'none', transition: 'transform 0.2s',
                    }} />
                    <input type="text" required value={manualPatientId || ''} onChange={() => {}} style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} tabIndex={-1} />
                  </div>

                  {/* Dropdown */}
                  {manualPatientDropdownOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setManualPatientDropdownOpen(false); setBillingShowInlineAdd(false); }} />
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
                        {filteredPatients.length === 0 && manualPatientSearch && (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
                            No patients found
                          </div>
                        )}
                        {filteredPatients.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setManualPatientId(p.id);
                              setManualPatientSearch(`${p.name} (${p.phone})`);
                              setManualPatientDropdownOpen(false);
                              setBillingShowInlineAdd(false);
                            }}
                            style={{
                              padding: '0.65rem 1rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              transition: 'background 0.15s',
                              background: manualPatientId === p.id ? 'rgba(14, 165, 233, 0.08)' : 'transparent',
                              borderBottom: '1px solid rgba(0,0,0,0.04)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(14, 165, 233, 0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = manualPatientId === p.id ? 'rgba(14, 165, 233, 0.08)' : 'transparent')}
                          >
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '8px',
                              background: 'linear-gradient(135deg, var(--primary), var(--secondary, #a855f7))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                            }}>{p.name.charAt(0).toUpperCase()}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--on-surface)' }}>{p.name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)' }}>{p.phone || 'No phone'}</div>
                            </div>
                            {manualPatientId === p.id && <div style={{ color: 'var(--success)', fontWeight: 700 }}>✓</div>}
                          </div>
                        ))}

                        {/* ── Always-visible "Add new patient" ── */}
                        {!billingShowInlineAdd ? (
                          <div
                            onClick={() => { setBillingShowInlineAdd(true); setBillingNewName(manualPatientSearch); setBillingNewPhone(''); }}
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
                                value={billingNewName}
                                onChange={e => setBillingNewName(e.target.value)}
                                autoFocus
                                style={{ height: '2.2rem', fontSize: '0.85rem', borderRadius: '0.5rem' }}
                              />
                              <input
                                className="form-input"
                                placeholder="Phone number (optional)"
                                value={billingNewPhone}
                                onChange={e => setBillingNewPhone(e.target.value)}
                                style={{ height: '2.2rem', fontSize: '0.85rem', borderRadius: '0.5rem' }}
                              />
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setBillingShowInlineAdd(false)}
                                  style={{
                                    flex: 1, padding: '0.45rem', border: '1px solid var(--outline-variant)',
                                    borderRadius: '0.5rem', background: 'white', cursor: 'pointer',
                                    fontWeight: 600, fontSize: '0.8rem', color: 'var(--on-surface-variant)',
                                  }}
                                >Cancel</button>
                                <button
                                  type="button"
                                  onClick={handleAddNewPatient}
                                  disabled={!billingNewName.trim()}
                                  style={{
                                    flex: 1, padding: '0.45rem', border: 'none',
                                    borderRadius: '0.5rem', background: 'var(--primary)', cursor: 'pointer',
                                    fontWeight: 700, fontSize: '0.8rem', color: 'white',
                                    opacity: billingNewName.trim() ? 1 : 0.5,
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

                {/* Line Items */}
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--on-surface-variant)', marginBottom: '0.75rem', display: 'block' }}>Line Items</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {manualItems.map((item, idx) => (
                      <div key={idx} style={{ 
                        position: 'relative',
                        display: 'flex', 
                        gap: '0.75rem', 
                        alignItems: 'center',
                        padding: manualItems.length > 1 ? '0.75rem' : '0',
                        paddingRight: manualItems.length > 1 ? '2.75rem' : '0',
                        background: manualItems.length > 1 ? 'var(--surface-container-low, #f8fafc)' : 'transparent',
                        borderRadius: manualItems.length > 1 ? '0.875rem' : '0',
                        border: manualItems.length > 1 ? '1px solid var(--outline-variant, rgba(0,0,0,0.06))' : 'none',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            className="form-input"
                            placeholder="Description (e.g. Dental Cleaning)"
                            value={item.description}
                            onChange={e => updateManualItem(idx, 'description', e.target.value)}
                            required
                            style={{ borderRadius: '0.75rem', border: '1.5px solid var(--outline-variant)' }}
                          />
                        </div>
                        <div style={{ width: '100px', flexShrink: 0 }}>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>₹</span>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              placeholder="0"
                              value={item.amount || ''}
                              onChange={e => updateManualItem(idx, 'amount', e.target.value)}
                              required
                              style={{ paddingLeft: '1.6rem', paddingRight: '0.5rem', borderRadius: '0.75rem', border: '1.5px solid var(--outline-variant)' }}
                            />
                          </div>
                        </div>
                        {manualItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeManualItem(idx)}
                            title="Remove this item"
                            style={{ 
                              position: 'absolute',
                              top: '50%',
                              right: '0.5rem',
                              transform: 'translateY(-50%)',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#fee2e2',
                              border: '1.5px solid #fca5a5',
                              borderRadius: '50%', 
                              color: '#dc2626',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              padding: 0,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.borderColor = '#f87171'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={addManualItem}
                    style={{ 
                      marginTop: '1rem', 
                      background: 'var(--info-bg)', 
                      color: 'var(--primary)', 
                      fontSize: '0.8rem', 
                      fontWeight: 700,
                      borderRadius: '0.75rem',
                      padding: '0.5rem 1rem',
                      border: '1.5px solid var(--primary-opacity, rgba(14, 165, 233, 0.2))'
                    }}
                  >
                    <Plus size={16} /> Add Another Service
                  </button>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--on-surface-variant)' }}>Notes (optional)</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Any internal notes for this invoice..."
                    value={manualNotes}
                    onChange={e => setManualNotes(e.target.value)}
                    style={{ borderRadius: '0.875rem', border: '1.5px solid var(--outline-variant)', padding: '0.875rem' }}
                  />
                </div>

                {/* Summary Panel */}
                <div style={{ 
                  margin: '1.5rem 0', 
                  padding: '1.25rem', 
                  background: 'var(--surface-container-lowest)', 
                  borderRadius: '1.25rem', 
                  border: '1.5px solid var(--outline-variant)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
                }}>
                  <div className="grid grid-2 gap-6" style={{ marginBottom: '1.25rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700 }}>Discount (%)</label>
                      <input type="number" min="0" max="100" className="form-input" value={manualDiscount} onChange={e => setManualDiscount(Number(e.target.value))} style={{ borderRadius: '0.6rem' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 700 }}>Tax (%)</label>
                      <input type="number" min="0" className="form-input" value={manualTax} onChange={e => setManualTax(Number(e.target.value))} style={{ borderRadius: '0.6rem' }} />
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--outline-variant)', margin: '1rem 0' }} />

                  <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--on-surface-variant)', fontWeight: 500 }}>Subtotal ({manualItems.filter(i => i.amount > 0).length} items)</span>
                    <strong style={{ fontWeight: 600 }}>₹{manualSubtotal.toLocaleString()}</strong>
                  </div>
                  {manualDiscount > 0 && (
                    <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>Discount ({manualDiscount}%)</span>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>-₹{manualDiscountAmt.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="invoice-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>Tax ({manualTax}%)</span>
                    <span style={{ fontWeight: 600 }}>+₹{manualTaxAmt.toFixed(2)}</span>
                  </div>

                  <div className="invoice-row" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', 
                    color: 'white', 
                    padding: '1.125rem', 
                    borderRadius: '1rem',
                    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.25)'
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>Final Amount</span>
                    <span style={{ fontWeight: 800, fontSize: '1.4rem' }}>₹{manualFinal.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button" className="btn" onClick={resetModal} style={{ borderRadius: '0.75rem', fontWeight: 600, padding: '0.75rem 1.5rem' }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ background: '#8b5cf6', borderRadius: '0.75rem', fontWeight: 700, padding: '0.75rem 2rem' }}>
                    Generate Manual Invoice
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

