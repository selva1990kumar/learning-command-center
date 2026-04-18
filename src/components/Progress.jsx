import React from 'react';
import { useAppState } from '../context/StateContext';
import { PILLARS, CURRICULUM } from '../data/curriculum';
import { BADGES_DEF } from '../data/constants';

function XP_PER_LEVEL(lvl) { return Math.floor(100 * Math.pow(1.3, lvl - 1)); }

export default function Progress() {
  const { S, todayStr, currentDay } = useAppState();

  let lvl = 1, rem = S.xp;
  while (rem >= XP_PER_LEVEL(lvl)) { rem -= XP_PER_LEVEL(lvl); lvl++; }
  const xpNeeded = XP_PER_LEVEL(lvl);
  const xpPct = Math.round((rem / xpNeeded) * 100);

  const streakDays = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(new Date(todayStr).getTime() - (i * 86400000)).toISOString().split('T')[0];
    let className = 'streak-day';
    if (d === todayStr) className += ' today';
    if (S.completedDays[d]) className += ' done full';
    else if (S.dayData[d] && Object.keys(S.dayData[d].tasks || {}).some(k => S.dayData[d].tasks[k])) className += ' done';
    streakDays.push({ d, className });
  }

  const td = S.dayData[todayStr] || {};
  const tasks = td.tasks || {};

  return (
    <section className="tab-panel active">
      <div className="section-header">
        <div className="section-title">Learning Progress</div>
        <div className="section-sub">Your 30-day journey at a glance</div>
      </div>

      <div className="progress-charts">
        <div className="chart-card">
          <div className="chart-title">📆 30-Day Streak Calendar</div>
          <div style={{display:'grid', gridTemplateColumns: 'repeat(7,1fr)', gap:'3px', marginBottom:'8px'}}>
            {['S','M','T','W','T','F','S'].map((day, i) => <div key={i} className="streak-day-label">{day}</div>)}
          </div>
          <div className="streak-grid">
            {streakDays.map((sd, i) => <div key={i} className={sd.className} title={sd.d} />)}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">🎯 Pillar Progress (Day <span>{currentDay}</span>)</div>
          <div className="pillar-progress-list">
            {PILLARS.map(p => {
              const curr = (CURRICULUM[p.id] || [])[currentDay - 1] || { tasks: [] };
              const done = curr.tasks.filter((_, i) => !!tasks[`${todayStr}_${p.id}_${i}`]).length;
              const total = curr.tasks.length || 1;
              const pct = Math.round((done / total) * 100);
              return (
                <div key={p.id} className="pp-item" style={{"--pc": p.color}}>
                  <div className="pp-header">
                    <div className="pp-name">{p.icon} {p.name}</div>
                    <div className="pp-stats">{done}/{total} tasks · {pct}%</div>
                  </div>
                  <div className="pp-bar-wrap">
                    <div className="pp-bar" style={{width: `${pct}%`, background: p.color, boxShadow: `0 0 8px ${p.color}`}}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="xp-section">
        <div className="section-header" style={{marginBottom:'16px'}}>
          <div>
            <div className="section-title">⭐ XP & Badges</div>
            <div className="section-sub">Level <span>{lvl}</span> · <span>{xpNeeded - rem}</span> XP to next level</div>
          </div>
          <div style={{fontFamily:"'Outfit',sans-serif", fontSize:'32px', fontWeight:800, background:'linear-gradient(90deg,#e879f9,#facc15)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>{S.xp} XP</div>
        </div>
        <div className="xp-bar-label">
          <span>Level <span>{lvl}</span></span>
          <span>Level <span>{lvl + 1}</span></span>
        </div>
        <div className="xp-bar-wrap">
          <div className="xp-bar-fill" style={{width: `${xpPct}%`}}></div>
        </div>
        <div className="badges-grid">
          {BADGES_DEF.map(b => {
             const earned = S.badges.includes(b.id);
             return (
               <div key={b.id} className={`badge ${earned ? 'earned' : ''}`} title={earned ? `${b.name} — Earned!` : `${b.name} — Not yet earned`}>
                 <div className="badge-icon">{b.icon}</div>
                 <div className="badge-name">{b.name}</div>
               </div>
             );
          })}
        </div>
      </div>
    </section>
  );
}
