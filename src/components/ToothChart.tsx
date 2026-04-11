'use client';

import React, { useState, useMemo } from 'react';

type ToothStatus = 'Completed' | 'Scheduled' | 'Cancelled';

interface ToothTreatment {
  toothNumber: string;
  notes: string;
  cost: number;
  date?: string;
  status?: ToothStatus;
}

interface ToothChartProps {
  /** All treatments across all appointments for this patient */
  treatments: ToothTreatment[];
  /** Optional: allow clicking a tooth to select it (for adding treatments) */
  onToothClick?: (toothNumber: string) => void;
  /** Compact mode for smaller display */
  compact?: boolean;
  /** Controlled selected tooth (overrides internal state) */
  selectedToothOverride?: string | null;
  /** Hide legend and details panel (useful for select-only mode) */
  hideDetails?: boolean;
}

// FDI notation: Quadrants 1-4, teeth 1-8
const TOOTH_DATA = {
  upperRight: ['18','17','16','15','14','13','12','11'],
  upperLeft:  ['21','22','23','24','25','26','27','28'],
  lowerLeft:  ['31','32','33','34','35','36','37','38'],
  lowerRight: ['48','47','46','45','44','43','42','41'],
};

const TOOTH_NAMES: Record<string, string> = {
  '18': '3rd Molar', '17': '2nd Molar', '16': '1st Molar', '15': '2nd Premolar',
  '14': '1st Premolar', '13': 'Canine', '12': 'Lateral Incisor', '11': 'Central Incisor',
  '21': 'Central Incisor', '22': 'Lateral Incisor', '23': 'Canine', '24': '1st Premolar',
  '25': '2nd Premolar', '26': '1st Molar', '27': '2nd Molar', '28': '3rd Molar',
  '31': '3rd Molar', '32': '2nd Molar', '33': '1st Molar', '34': '2nd Premolar',
  '35': '1st Premolar', '36': 'Canine', '37': 'Lateral Incisor', '38': 'Central Incisor',
  '41': 'Central Incisor', '42': 'Lateral Incisor', '43': 'Canine', '44': '1st Premolar',
  '45': '2nd Premolar', '46': '1st Molar', '47': '2nd Molar', '48': '3rd Molar',
};

function getToothWidth(num: string): number {
  const lastDigit = parseInt(num.slice(-1));
  if (lastDigit >= 6) return 38;
  if (lastDigit >= 4) return 32;
  if (lastDigit === 3) return 28;
  return 26;
}

function getToothHeight(num: string): number {
  const lastDigit = parseInt(num.slice(-1));
  if (lastDigit >= 6) return 34;
  if (lastDigit >= 4) return 36;
  if (lastDigit === 3) return 40;
  return 36;
}

// Priority: Completed > Scheduled > Cancelled
function getDominantStatus(treatments: ToothTreatment[]): ToothStatus {
  if (treatments.some(t => t.status === 'Completed')) return 'Completed';
  if (treatments.some(t => t.status === 'Scheduled')) return 'Scheduled';
  return 'Cancelled';
}

export default function ToothChart({ treatments, onToothClick, compact = false, selectedToothOverride, hideDetails = false }: ToothChartProps) {
  const [hoveredTooth, setHoveredTooth] = useState<string | null>(null);
  const [internalSelectedTooth, setInternalSelectedTooth] = useState<string | null>(null);
  const selectedTooth = selectedToothOverride !== undefined ? selectedToothOverride : internalSelectedTooth;

  // Map tooth numbers to their treatments
  const treatedTeeth = useMemo(() => {
    const map: Record<string, ToothTreatment[]> = {};
    treatments.forEach(t => {
      const num = t.toothNumber.toString().trim();
      if (!map[num]) map[num] = [];
      map[num].push(t);
    });
    return map;
  }, [treatments]);

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = { completed: 0, scheduled: 0, cancelled: 0 };
    Object.values(treatedTeeth).forEach(tList => {
      const status = getDominantStatus(tList);
      if (status === 'Completed') counts.completed++;
      else if (status === 'Scheduled') counts.scheduled++;
      else counts.cancelled++;
    });
    return counts;
  }, [treatedTeeth]);

  const treatedCount = Object.keys(treatedTeeth).length;

  const handleToothClick = (num: string) => {
    if (onToothClick) {
      onToothClick(num);
    } else if (selectedToothOverride === undefined) {
      setInternalSelectedTooth(internalSelectedTooth === num ? null : num);
    }
  };

  const renderTooth = (num: string) => {
    const toothTreatments = treatedTeeth[num];
    const isTreated = !!toothTreatments;
    const isHovered = hoveredTooth === num;
    const isSelected = selectedTooth === num;
    const treatmentCount = toothTreatments?.length || 0;
    const dominantStatus = isTreated ? getDominantStatus(toothTreatments) : null;
    const statusClass = dominantStatus
      ? `crown-${dominantStatus.toLowerCase()}`
      : '';
    const badgeClass = dominantStatus
      ? `tooth-count-${dominantStatus.toLowerCase()}`
      : '';

    const w = compact ? getToothWidth(num) * 0.75 : getToothWidth(num);
    const h = compact ? getToothHeight(num) * 0.75 : getToothHeight(num);
    const isUpper = num.startsWith('1') || num.startsWith('2');

    return (
      <div
        key={num}
        className={`tooth ${isTreated ? 'tooth-treated' : ''} ${isHovered ? 'tooth-hovered' : ''} ${isSelected ? 'tooth-selected' : ''}`}
        style={{ width: w, cursor: 'pointer' }}
        onMouseEnter={() => setHoveredTooth(num)}
        onMouseLeave={() => setHoveredTooth(null)}
        onClick={() => handleToothClick(num)}
      >
        {!isUpper && !compact && (
          <span className="tooth-number">{num}</span>
        )}
        <div className={`tooth-shape ${isUpper ? 'tooth-upper' : 'tooth-lower'}`} style={{ width: w, height: h }}>
          <div className={`tooth-root ${isUpper ? 'root-upper' : 'root-lower'}`} />
          <div className={`tooth-crown ${statusClass}`}>
            {treatmentCount > 0 && (
              <span className={`tooth-treatment-count ${badgeClass}`}>{treatmentCount}</span>
            )}
          </div>
        </div>
        {isUpper && !compact && (
          <span className="tooth-number">{num}</span>
        )}
      </div>
    );
  };

  const selectedToothTreatments = selectedTooth ? treatedTeeth[selectedTooth] : null;
  const selectedDominantStatus = selectedToothTreatments ? getDominantStatus(selectedToothTreatments) : null;

  const statusLabel = (s: ToothStatus | null) => {
    if (s === 'Completed') return 'badge badge-success';
    if (s === 'Scheduled') return 'badge badge-primary';
    if (s === 'Cancelled') return 'badge badge-danger';
    return 'badge';
  };

  return (
    <div className={`tooth-chart-container ${compact ? 'tooth-chart-compact' : ''}`}>
      {/* Legend */}
      {!hideDetails && (
        <div className="tooth-chart-legend">
          <div className="tooth-chart-title">
            🦷 Dental Chart <span className="tooth-chart-subtitle">FDI Notation</span>
          </div>
          <div className="tooth-legend-items">
            <span className="legend-item">
              <span className="legend-dot legend-healthy" /> Healthy ({32 - treatedCount})
            </span>
            {statusCounts.completed > 0 && (
              <span className="legend-item">
                <span className="legend-dot legend-completed" /> Completed ({statusCounts.completed})
              </span>
            )}
            {statusCounts.scheduled > 0 && (
              <span className="legend-item">
                <span className="legend-dot legend-scheduled" /> Scheduled ({statusCounts.scheduled})
              </span>
            )}
            {statusCounts.cancelled > 0 && (
              <span className="legend-item">
                <span className="legend-dot legend-cancelled" /> Cancelled ({statusCounts.cancelled})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="tooth-chart">
        {/* Upper jaw */}
        <div className="jaw-section upper-jaw">
          <div className="jaw-label">Upper Jaw</div>
          <div className="tooth-row">
            <div className="quadrant quadrant-right">
              {TOOTH_DATA.upperRight.map(renderTooth)}
            </div>
            <div className="jaw-midline" />
            <div className="quadrant quadrant-left">
              {TOOTH_DATA.upperLeft.map(renderTooth)}
            </div>
          </div>
        </div>

        {/* Midline divider */}
        <div className="jaw-divider">
          <span className="jaw-divider-label">R</span>
          <div className="jaw-divider-line" />
          <span className="jaw-divider-label">L</span>
        </div>

        {/* Lower jaw */}
        <div className="jaw-section lower-jaw">
          <div className="tooth-row">
            <div className="quadrant quadrant-right">
              {TOOTH_DATA.lowerRight.map(renderTooth)}
            </div>
            <div className="jaw-midline" />
            <div className="quadrant quadrant-left">
              {TOOTH_DATA.lowerLeft.map(renderTooth)}
            </div>
          </div>
          <div className="jaw-label">Lower Jaw</div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredTooth && (!selectedTooth || hideDetails) && (
        <div className="tooth-tooltip">
          <strong>Tooth #{hoveredTooth}</strong> — {TOOTH_NAMES[hoveredTooth] || 'Unknown'}
          {treatedTeeth[hoveredTooth] && (() => {
            const st = getDominantStatus(treatedTeeth[hoveredTooth]);
            return (
              <span className={`tooltip-status tooltip-status-${st.toLowerCase()}`}>
                {' '} • {treatedTeeth[hoveredTooth].length} treatment(s) — {st}
              </span>
            );
          })()}
        </div>
      )}

      {/* Selected tooth detail panel */}
      {selectedTooth && !hideDetails && (
        <div className="tooth-detail-panel">
          <div className="tooth-detail-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <strong>Tooth #{selectedTooth}</strong>
              <span className="tooth-detail-name">{TOOTH_NAMES[selectedTooth]}</span>
              {selectedDominantStatus && (
                <span className={statusLabel(selectedDominantStatus)} style={{ fontSize: '0.7rem' }}>
                  {selectedDominantStatus}
                </span>
              )}
            </div>
            <button className="btn btn-icon" onClick={() => {
              if (onToothClick) onToothClick(selectedTooth);
              else setInternalSelectedTooth(null);
            }} style={{ padding: '0.25rem' }}>✕</button>
          </div>
          {selectedToothTreatments && selectedToothTreatments.length > 0 ? (
            <div className="tooth-detail-treatments">
              {selectedToothTreatments.map((t, idx) => (
                <div key={idx} className="tooth-detail-treatment">
                  <div className="tooth-detail-row">
                    <span className="tooth-detail-notes">{t.notes}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {t.status && (
                        <span className={statusLabel(t.status)} style={{ fontSize: '0.68rem' }}>
                          {t.status}
                        </span>
                      )}
                      <span className="treatment-cost-tag">₹{t.cost.toLocaleString()}</span>
                    </div>
                  </div>
                  {t.date && <span className="tooth-detail-date">{t.date}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="tooth-detail-empty">No treatments recorded for this tooth.</p>
          )}
        </div>
      )}
    </div>
  );
}
