'use client';

import React from 'react';

// Universal Numbering System
export const TOOTH_DATA = {
  upperRight: ['1','2','3','4','5','6','7','8'],
  upperLeft:  ['9','10','11','12','13','14','15','16'],
  lowerLeft:  ['24','23','22','21','20','19','18','17'], // Screen right
  lowerRight: ['32','31','30','29','28','27','26','25'], // Screen left
};

const molars = ['1','2','3','14','15','16','17','18','19','30','31','32'];
const premolars = ['4','5','12','13','20','21','28','29'];

function getDots(num: string) {
  if (molars.includes(num)) return 3;
  if (premolars.includes(num)) return 1;
  return 0;
}

function isUpper(num: string) {
  return parseInt(num) >= 1 && parseInt(num) <= 16;
}

function ToothSVG({ num, selected }: { num: string; selected: boolean }) {
  const upper = isUpper(num);
  const dots = getDots(num);
  
  const w = 32;
  const h = 48;

  // The simplified robust egg shape
  const eggPath = "M 16 3 C 30 3, 32 20, 26 36 C 22 46, 10 46, 6 36 C 0 20, 2 3, 16 3 Z";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={`tooth-svg-new ${selected ? 'is-selected' : ''}`}>
      {/* If it's a lower tooth, flip vertically exactly inside the bounding box */}
      <g transform={upper ? '' : `translate(0, ${h}) scale(1, -1)`}>
        <path className="tooth-egg" d={eggPath} />
        {dots === 3 && (
          <>
            <path className="tooth-line" d="M 16 22 L 11.5 19 M 16 22 L 20.5 19 M 16 22 L 16 28" />
            <circle cx="10" cy="18" r="2.2" className="tooth-dot" />
            <circle cx="22" cy="18" r="2.2" className="tooth-dot" />
            <circle cx="16" cy="30" r="2.2" className="tooth-dot" />
          </>
        )}
        {dots === 1 && (
          <circle cx="16" cy="24" r="2.2" className="tooth-dot" />
        )}
      </g>
    </svg>
  );
}

interface ToothSelectorProps {
  selectedTeeth?: string[];
  onSelect: (num: string) => void;
}

export default function ToothSelector({ selectedTeeth = [], onSelect }: ToothSelectorProps) {

  const renderTooth = (num: string) => {
    const isSelected = selectedTeeth.includes(num);
    const upper = isUpper(num);
    
    return (
      <button
        key={num}
        type="button"
        className={`tooth-sel-btn-new ${upper ? 'upper' : 'lower'} ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(num)}
        title={`Tooth ${num}`}
      >
        <span className="tooth-sel-num">{num}</span>
        <ToothSVG num={num} selected={isSelected} />
      </button>
    );
  };

  return (
    <div className="tooth-sel-wrap">
      <style>{`
        .tooth-sel-wrap {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }
        .tooth-svg-new {
          overflow: visible;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          filter: drop-shadow(0 2px 5px rgba(0,0,0,0.03));
        }
        .tooth-svg-new.is-selected {
          filter: drop-shadow(0 8px 16px rgba(14, 165, 233, 0.3));
          transform: translateY(-2px);
        }
        .tooth-svg-new .tooth-egg {
          fill: var(--surface-container-lowest, #ffffff);
          stroke: var(--outline-variant, #cbd5e1);
          stroke-width: 1.8;
          transition: all 0.2s;
        }
        :root[data-theme="dark"] .tooth-svg-new .tooth-egg,
        .dark .tooth-svg-new .tooth-egg {
          fill: rgba(30, 41, 59, 0.5);   /* Dark mode transparent fill */
          stroke: rgba(255, 255, 255, 0.2); 
        }
        .tooth-svg-new.is-selected .tooth-egg {
          fill: var(--primary);
          stroke: var(--primary);
        }
        .tooth-svg-new .tooth-dot {
          fill: transparent;
          stroke: var(--outline-variant, #cbd5e1);
          stroke-width: 1.5;
          transition: all 0.2s;
        }
        :root[data-theme="dark"] .tooth-svg-new .tooth-dot,
        .dark .tooth-svg-new .tooth-dot {
          stroke: rgba(255, 255, 255, 0.2);
        }
        .tooth-svg-new.is-selected .tooth-dot {
          fill: #ffffff;
          stroke: #ffffff;
        }

        .tooth-svg-new .tooth-line {
          fill: transparent;
          stroke: var(--outline-variant, #cbd5e1);
          stroke-width: 1.5;
          stroke-linecap: round;
          transition: all 0.2s;
        }
        :root[data-theme="dark"] .tooth-svg-new .tooth-line,
        .dark .tooth-svg-new .tooth-line {
          stroke: rgba(255, 255, 255, 0.2);
        }
        .tooth-svg-new.is-selected .tooth-line {
          opacity: 0;
        }

        .tooth-sel-btn-new {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px 4px;
          transition: opacity 0.2s;
        }
        .tooth-sel-btn-new:not(.selected):hover {
          opacity: 0.8;
        }
        .tooth-sel-btn-new.upper {
          flex-direction: column;
        }
        .tooth-sel-btn-new.lower {
          flex-direction: column-reverse;
        }
        .tooth-sel-btn-new .tooth-sel-num {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--on-surface-variant, #94a3b8);
          transition: color 0.2s;
        }
        .tooth-sel-btn-new.selected .tooth-sel-num {
          color: var(--primary);
        }
        
        .row-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          flex-wrap: wrap;
        }
        .flex-quad {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
          justify-content: center;
        }
      `}</style>

      {/* Upper Jaw Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--on-surface-variant)', letterSpacing: '0.05em' }}>UPPER</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--outline-variant, #e2e8f0)' }} />
      </div>

      <div className="row-group">
        <div className="flex-quad">
          {TOOTH_DATA.upperRight.map(renderTooth)}
        </div>
        <div className="flex-quad">
          {TOOTH_DATA.upperLeft.map(renderTooth)}
        </div>
      </div>

      {/* R  L labels */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--on-surface-variant)' }}>R</span>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--on-surface-variant)' }}>L</span>
      </div>

      <div className="row-group">
        <div className="flex-quad">
          {TOOTH_DATA.lowerRight.map(renderTooth)}
        </div>
        <div className="flex-quad">
          {TOOTH_DATA.lowerLeft.map(renderTooth)}
        </div>
      </div>

      {/* Lower Jaw Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--on-surface-variant)', letterSpacing: '0.05em' }}>LOWER</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--outline-variant, #e2e8f0)' }} />
      </div>
    </div>
  );
}
