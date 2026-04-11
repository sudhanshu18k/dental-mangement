'use client';

import React, { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { IndianRupee, FileDown, Plus, X, Receipt } from 'lucide-react';
import { Invoice } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export default function BillingPage() {
  const { patients, appointments, invoices, addInvoice, updateInvoice } = useStore();
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [selectedApptId, setSelectedApptId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(18);

  const billableAppointments = useMemo(() => 
    appointments.filter(a => a.status === 'Completed' && !invoices.some(i => i.appointmentId === a.id)),
    [appointments, invoices]
  );

  const selectedAppt = appointments.find(a => a.id === selectedApptId);
  const treatmentCost = selectedAppt?.treatments.reduce((acc, t) => acc + t.cost, 0) || 0;
  const discountAmount = treatmentCost * discount / 100;
  const taxAmount = (treatmentCost - discountAmount) * tax / 100;
  const finalAmount = treatmentCost - discountAmount + taxAmount;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppt) return;
    // eslint-disable-next-line react-hooks/purity
    const currentId = 'inv' + Date.now();
    addInvoice({
      id: currentId,
      appointmentId: selectedAppt.id,
      patientId: selectedAppt.patientId,
      treatmentCost,
      discount,
      tax,
      finalAmount,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
    });
    setInvoiceModal(false);
    setSelectedApptId('');
    setDiscount(0);
    setTax(18);
  };

  const handleDownloadPDF = async (inv: Invoice) => {
    const patient = patients.find(p => p.id === inv.patientId);
    const appt = appointments.find(a => a.id === inv.appointmentId);
    
    const doc = new jsPDF();
    
    // ======== HEADER ========
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
    const tableData = appt?.treatments.map((t, index) => [
      index + 1,
      `Tooth #${t.toothNumber} - ${t.notes}`, 
      `₹${t.cost.toLocaleString('en-IN')}`
    ]) || [[1, 'General Dental Treatment', `₹${inv.treatmentCost.toLocaleString('en-IN')}`]];

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
    // Left side notes
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('Thank you for choosing SmileSync Dental Care.', 14, finalY + 5);
    doc.text('Please feel free to contact us for any queries regarding this invoice.', 14, finalY + 10);

    // Right side amounts
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    
    let currentY = finalY;
    
    doc.text('Subtotal:', 135, currentY);
    doc.text(`₹${inv.treatmentCost.toLocaleString('en-IN')}`, 195, currentY, { align: 'right' });
    currentY += 8;
    
    if (inv.discount > 0) {
      const discountAmount = (inv.treatmentCost * inv.discount) / 100;
      doc.text(`Discount (${inv.discount}%):`, 135, currentY);
      doc.setTextColor(16, 185, 129);
      doc.text(`- ₹${discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 195, currentY, { align: 'right' });
      doc.setTextColor(15, 23, 42);
      currentY += 8;
    }
    
    if (inv.tax > 0) {
      const taxableAmount = inv.treatmentCost - ((inv.treatmentCost * inv.discount) / 100);
      const taxAmount = (taxableAmount * inv.tax) / 100;
      doc.text(`Taxes (${inv.tax}%):`, 135, currentY);
      doc.text(`+ ₹${taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 195, currentY, { align: 'right' });
      currentY += 8;
    }
    
    // Final Amount Highlight Box
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
    
    // UPI payment string - replace 'merchant@upi' with your real UPI ID
    const upiId = 'smilesync@upi';
    const upiName = 'SmileSync Dental';
    const upiAmount = inv.finalAmount.toFixed(2);
    const upiTxnNote = `Invoice INV-${inv.id.slice(-6).toUpperCase()}`;
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent(upiTxnNote)}`;

    try {
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 200,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });

      // QR Code Section Background
      const qrBoxY = currentY;
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, qrBoxY, 85, 72, 3, 3, 'FD');
      
      // UPI Logo area
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Scan to Pay', 56.5, qrBoxY + 8, { align: 'center' });
      
      // QR Code Image
      doc.addImage(qrDataUrl, 'PNG', 32, qrBoxY + 12, 48, 48);
      
      // UPI ID text below QR
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`UPI: ${upiId}`, 56.5, qrBoxY + 66, { align: 'center' });
      
      // Payment instructions on the right of QR
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
      doc.text('+91 98765 43210 | hello@smilesync.clinic', instructionX, qrBoxY + 62);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      // QR generation failed - add fallback text
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
    doc.text('SmileSync Dental Care Management - Owner Edition', 105, 287, { align: 'center' });

    doc.save(`SmileSync_Invoice_${inv.id.slice(-6).toUpperCase()}.pdf`);
  };

  // Summary stats
  const totalRevenue = invoices.filter(i => i.status === 'Paid').reduce((a, i) => a + i.finalAmount, 0);
  const totalPending = invoices.filter(i => i.status === 'Pending').reduce((a, i) => a + i.finalAmount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing & Invoices</h1>
          <p className="page-subtitle">{invoices.length} invoices generated</p>
        </div>
        <button className="btn btn-primary" onClick={() => setInvoiceModal(true)}>
          <Plus size={18} /> Generate Invoice
        </button>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-3 gap-5" style={{ marginBottom: '1.75rem' }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
            <IndianRupee size={26} />
          </div>
          <div>
            <p className="stat-label">Total Revenue</p>
            <h3 className="stat-value">₹{totalRevenue.toLocaleString()}</h3>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>
            <Receipt size={26} />
          </div>
          <div>
            <p className="stat-label">Pending Amount</p>
            <h3 className="stat-value">₹{totalPending.toLocaleString()}</h3>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--primary)' }}>
            <FileDown size={26} />
          </div>
          <div>
            <p className="stat-label">Total Invoices</p>
            <h3 className="stat-value">{invoices.length}</h3>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Date</th>
                <th>Patient</th>
                <th>Treatment Cost</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No invoices generated yet. Complete an appointment and generate your first invoice.</td></tr>
              ) : (
                [...invoices].sort((a, b) => b.date.localeCompare(a.date)).map(inv => {
                  const patient = patients.find(p => p.id === inv.patientId);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>#{inv.id.slice(-6)}</td>
                      <td>{inv.date}</td>
                      <td>{patient?.name || 'Unknown'}</td>
                      <td>₹{inv.treatmentCost.toLocaleString()}</td>
                      <td>{inv.discount}%</td>
                      <td>{inv.tax}%</td>
                      <td style={{ fontWeight: 700 }}>₹{inv.finalAmount.toLocaleString()}</td>
                      <td>
                        <select
                          className="status-select"
                          style={{
                            background: inv.status === 'Paid' ? 'var(--success-bg)' : 'var(--warning-bg)',
                            color: inv.status === 'Paid' ? 'var(--success)' : 'var(--warning)',
                          }}
                          value={inv.status}
                          onChange={e => updateInvoice(inv.id, { status: e.target.value as Invoice['status'] })}
                        >
                          <option value="Paid">Paid</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => handleDownloadPDF(inv)}>
                          <FileDown size={14} /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Invoice Modal */}
      {invoiceModal && (
        <div className="modal-overlay" onClick={() => setInvoiceModal(false)}>
          <div className="modal-content" style={{ width: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title"><IndianRupee size={22} color="var(--primary)" /> Generate Invoice</h2>
              <button className="btn btn-icon" onClick={() => { setInvoiceModal(false); setSelectedApptId(''); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label className="form-label">Select Completed Appointment</label>
                <select required className="form-select" value={selectedApptId} onChange={e => setSelectedApptId(e.target.value)}>
                  <option value="">Choose an appointment...</option>
                  {billableAppointments.map(a => {
                    const patient = patients.find(p => p.id === a.patientId);
                    return <option key={a.id} value={a.id}>{a.date} — {patient?.name} ({a.treatmentType})</option>;
                  })}
                </select>
              </div>

              {selectedAppt && (
                <>
                  <div className="invoice-summary" style={{ margin: '1.25rem 0' }}>
                    <div className="invoice-row">
                      <span style={{ color: 'var(--text-muted)' }}>Treatments ({selectedAppt.treatments.length})</span>
                      <strong>₹{treatmentCost.toLocaleString()}</strong>
                    </div>

                    <div className="grid grid-2 gap-4" style={{ margin: '1rem 0' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Discount (%)</label>
                        <input type="number" min="0" max="100" className="form-input" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Tax (%)</label>
                        <input type="number" min="0" className="form-input" value={tax} onChange={e => setTax(Number(e.target.value))} />
                      </div>
                    </div>

                    {discount > 0 && (
                      <div className="invoice-row">
                        <span style={{ color: 'var(--text-muted)' }}>Discount ({discount}%)</span>
                        <span style={{ color: 'var(--success)' }}>-₹{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="invoice-row">
                      <span style={{ color: 'var(--text-muted)' }}>Tax ({tax}%)</span>
                      <span>+₹{taxAmount.toFixed(2)}</span>
                    </div>

                    <hr className="invoice-divider" />
                    <div className="invoice-row">
                      <span className="invoice-total">Final Amount</span>
                      <span className="invoice-amount">₹{finalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" className="btn" onClick={() => { setInvoiceModal(false); setSelectedApptId(''); }}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Create Invoice</button>
                  </div>
                </>
              )}

              {!selectedAppt && billableAppointments.length === 0 && (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  No completed appointments available for billing. Mark appointments as &quot;Completed&quot; first.
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
