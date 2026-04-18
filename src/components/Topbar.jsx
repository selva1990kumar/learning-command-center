import React, { useEffect, useState } from 'react';
import { useAppState } from '../context/StateContext';
import { PILLARS } from '../data/curriculum';

export default function Topbar() {
  const { S, currentDay, todayStr } = useAppState();
  const [nowStr, setNowStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setNowStr(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const intv = setInterval(updateTime, 60000);
    return () => clearInterval(intv);
  }, []);

  // Compute hours done today
  const td = S.dayData[todayStr] || {};
  const timers = td.timers || {};
  const totalSec = PILLARS.reduce((sum, p) => sum + (timers[p.id] || 0), 0);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);

  return (
    <header id="topbar" role="banner">
      <div className="topbar-brand">
        <div className="brand-icon" aria-hidden="true">🧠</div>
        <div className="brand-text">
          <h1>Learning Command Center</h1>
          <span>8 Hours · 5 Pillars · 30 Days</span>
        </div>
      </div>
      <div className="topbar-stats">
        <div className="stat-pill" id="stat-day">
          <span className="icon">📅</span>
          <span>Day</span>
          <span className="value">{currentDay}</span>
        </div>
        <div className="stat-pill" id="stat-streak">
          <span className="icon">🔥</span>
          <span>Streak</span>
          <span className="value">{S.streak}</span>
        </div>
        <div className="stat-pill" id="stat-xp">
          <span className="icon">⭐</span>
          <span>XP</span>
          <span className="value">{S.xp}</span>
        </div>
        <div className="stat-pill">
          <span className="icon">⏱️</span>
          <span>Today</span>
          <span className="value">{h}h{m > 0 ? ` ${m}m` : ''}</span>
        </div>
      </div>
      <div className="topbar-date">{nowStr}</div>
    </header>
  );
}
