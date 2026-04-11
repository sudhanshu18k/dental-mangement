'use client';

import React from 'react';

// FDI notation: Quadrants 1-4, teeth 1-8
export const TOOTH_DATA = {
  upperRight: ['18','17','16','15','14','13','12','11'],
  upperLeft:  ['21','22','23','24','25','26','27','28'],
  lowerLeft:  ['31','32','33','34','35','36','37','38'],
  lowerRight: ['48','47','46','45','44','43','42','41'],
};

// Tooth type by last digit in FDI notation
function getToothType(num: string): 'molar' | 'premolar' | 'canine' | 'incisor' {
  const d = parseInt(num.slice(-1));
  if (d >= 6) return 'molar';
  if (d >= 4) return 'premolar';
  if (d === 3) return 'canine';
  return 'incisor';
}

function isUpper(num: string) {
  return num.startsWith('1') || num.startsWith('2');
}

// SVG tooth shapes — simplified anatomical silhouettes
function ToothSVG({ num, selected }: { num: string; selected: boolean }) {
  const type = getToothType(num);
  const upper = isUpper(num);
  const fill = selected ? 'url(#toothGrad)' : '#e2e8f0';
  const stroke = selected ? 'var(--secondary)' : '#cbd5e1';
  const rootColor = selected ? 'rgba(168,85,247,0.35)' : '#d1d5db';

  const w = type === 'molar' ? 28 : type === 'premolar' ? 24 : type === 'canine' ? 20 : 18;
  const h = 44;

  // Crown + root shapes per tooth type
  const shapes: Record<string, { crown: string; root: string }> = {
    molar: {
      crown: upper 
        ? 'M4,20 Q4,6 8,4 Q12,2 14,2 Q16,2 20,4 Q24,6 24,20 Z'
        : 'M4,24 Q4,38 8,40 Q12,42 14,42 Q16,42 20,40 Q24,38 24,24 Z',
      root: upper
        ? 'M8,20 L6,34 Q7,36 9,34 L11,26 L14,36 Q15,38 16,36 L18,26 L20,34 Q21,36 22,34 L20,20'
        : 'M8,24 L6,10 Q7,8 9,10 L11,18 L14,8 Q15,6 16,8 L18,18 L20,10 Q21,8 22,10 L20,24',
    },
    premolar: {
      crown: upper
        ? 'M4,20 Q4,8 7,5 Q10,3 12,3 Q14,3 17,5 Q20,8 20,20 Z'
        : 'M4,24 Q4,36 7,39 Q10,41 12,41 Q14,41 17,39 Q20,36 20,24 Z',
      root: upper
        ? 'M9,20 L7,36 Q8,38 10,36 L12,28 L14,36 Q15,38 17,36 L15,20'
        : 'M9,24 L7,8 Q8,6 10,8 L12,16 L14,8 Q15,6 17,8 L15,24',
    },
    canine: {
      crown: upper
        ? 'M4,20 Q4,10 6,6 Q8,3 10,2 Q12,3 14,6 Q16,10 16,20 Z'
        : 'M4,24 Q4,34 6,38 Q8,41 10,42 Q12,41 14,38 Q16,34 16,24 Z',
      root: upper
        ? 'M8,20 L7,38 Q9,42 11,38 L12,20'
        : 'M8,24 L7,6 Q9,2 11,6 L12,24',
    },
    incisor: {
      crown: upper
        ? 'M4,20 Q4,10 5,7 Q7,4 9,3 Q11,4 13,7 Q14,10 14,20 Z'
        : 'M4,24 Q4,34 5,37 Q7,40 9,41 Q11,40 13,37 Q14,34 14,24 Z',
      root: upper
        ? 'M7,20 L6,37 Q8,40 10,37 L11,20'
        : 'M7,24 L6,7 Q8,4 10,7 L11,24',
    },
  };

  const s = shapes[type];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${type === 'molar' ? 28 : type === 'premolar' ? 24 : type === 'canine' ? 20 : 18} 44`} className="tooth-svg">
      <defs>
        <linearGradient id="toothGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(168,85,247,0.3)" />
          <stop offset="100%" stopColor="rgba(14,165,233,0.3)" />
        </linearGradient>
      </defs>
      {/* Root (behind crown) */}
      <path d={s.root} fill={rootColor} stroke="none" opacity={0.7} />
      {/* Crown */}
      <path d={s.crown} fill={fill} stroke={stroke} strokeWidth={1.2} />
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
    
    return (
      <button
        key={num}
        type="button"
        className={`tooth-sel-btn ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect(num)}
        title={`Tooth ${num}`}
      >
        <ToothSVG num={num} selected={isSelected} />
        <span className="tooth-sel-num">{num}</span>
      </button>
    );
  };

  return (
    <div className="tooth-sel-wrap">
      {/* Upper Jaw */}
      <div className="jaw-hdr">
        <div className="jaw-hdr-line" />
        <span className="jaw-hdr-title">UPPER JAW</span>
        <div className="jaw-hdr-line" />
      </div>

      <div className="tooth-sel-row">
        <div className="tooth-sel-quad">
          {TOOTH_DATA.upperRight.map(renderTooth)}
        </div>
        <div className="tooth-sel-mid" />
        <div className="tooth-sel-quad">
          {TOOTH_DATA.upperLeft.map(renderTooth)}
        </div>
      </div>

      {/* R / L labels */}
      <div className="tooth-sel-rl">
        <span>R</span>
        <div className="tooth-sel-rl-line" />
        <span>L</span>
      </div>

      {/* Lower Jaw */}
      <div className="tooth-sel-row">
        <div className="tooth-sel-quad">
          {TOOTH_DATA.lowerRight.map(renderTooth)}
        </div>
        <div className="tooth-sel-mid" />
        <div className="tooth-sel-quad">
          {TOOTH_DATA.lowerLeft.map(renderTooth)}
        </div>
      </div>

      <div className="jaw-hdr" style={{ marginTop: '0.5rem' }}>
        <div className="jaw-hdr-line" />
        <span className="jaw-hdr-title">LOWER JAW</span>
        <div className="jaw-hdr-line" />
      </div>
    </div>
  );
}
