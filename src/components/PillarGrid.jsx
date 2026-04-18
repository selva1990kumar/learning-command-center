import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../context/StateContext';
import { PILLARS, CURRICULUM } from '../data/curriculum';

const POMODORO_SECS = 25 * 60;

function formatTimer(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function PillarGrid() {
  const { S, updateState, addXP, todayStr, currentDay, syncNotion } = useAppState();
  
  // Timer state
  const [activeTimer, setActiveTimer] = useState(null);
  const [remaining, setRemaining] = useState(POMODORO_SECS);
  const elapsedRef = useRef(0);

  useEffect(() => {
    let intv;
    if (activeTimer) {
      intv = setInterval(() => {
        setRemaining(r => r - 1);
        elapsedRef.current += 1;
        
        // Sync every 10s to state (not Notion yet)
        if (elapsedRef.current % 10 === 0) {
          updateState(prev => {
            const copy = { ...prev };
            if (!copy.dayData[todayStr]) copy.dayData[todayStr] = {};
            if (!copy.dayData[todayStr].timers) copy.dayData[todayStr].timers = {};
            copy.dayData[todayStr].timers[activeTimer] = (copy.dayData[todayStr].timers[activeTimer] || 0) + 10;
            return copy;
          });
        }
      }, 1000);
    }
    return () => clearInterval(intv);
  }, [activeTimer, updateState, todayStr]);

  // Handle timer completion
  useEffect(() => {
    if (remaining <= 0 && activeTimer) {
      const pId = activeTimer;
      const elap = elapsedRef.current;
      setActiveTimer(null);
      setRemaining(POMODORO_SECS);
      elapsedRef.current = 0;
      
      updateState(prev => {
        const copy = { ...prev };
        if (!copy.dayData[todayStr]) copy.dayData[todayStr] = {};
        if (!copy.dayData[todayStr].timers) copy.dayData[todayStr].timers = {};
        copy.dayData[todayStr].timers[pId] = (copy.dayData[todayStr].timers[pId] || 0) + elap;
        return copy;
      });
      
      addXP(50);
      
      syncNotion('log_session', {
        pillar: pId,
        hours: parseFloat((elap / 3600).toFixed(2)),
        day: currentDay
      });
      
      // In a real app we'd dispatch a toast
      console.log(`🎉 Pomodoro complete!`);
    }
  }, [remaining, activeTimer, addXP, syncNotion, updateState, todayStr, currentDay]);

  const toggleTimer = (pId) => {
    if (activeTimer === pId) {
      setActiveTimer(null);
    } else {
      setActiveTimer(pId);
      setRemaining(POMODORO_SECS);
      elapsedRef.current = 0;
    }
  };

  const resetTimer = (pId) => {
    if (activeTimer === pId) setActiveTimer(null);
    setRemaining(POMODORO_SECS);
  };

  const markDayComplete = () => {
    updateState(prev => {
      const copy = { ...prev };
      copy.completedDays[todayStr] = true;
      const yesterday = new Date(new Date(todayStr).getTime() - 86400000).toISOString().split('T')[0];
      if (copy.lastCompletedDate === yesterday) copy.streak++;
      else if (copy.lastCompletedDate !== todayStr) copy.streak = 1;
      copy.lastCompletedDate = todayStr;
      return copy;
    });
    addXP(100);
    syncNotion('complete_day', { day: currentDay });
  };

  // Compute Overall Progress
  const td = S.dayData[todayStr] || {};
  const tasks = td.tasks || {};
  let totalTasks = 0, doneTasks = 0;
  PILLARS.forEach(p => {
    const curr = (CURRICULUM[p.id] || [])[currentDay - 1] || { tasks: [] };
    totalTasks += curr.tasks.length;
    doneTasks += curr.tasks.filter((_, i) => tasks[`${todayStr}_${p.id}_${i}`]).length;
  });
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const timers = td.timers || {};
  const totalSec = PILLARS.reduce((sum, p) => sum + (timers[p.id] || 0), 0);
  const h  = Math.floor(totalSec / 3600);
  const m  = Math.floor((totalSec % 3600) / 60);

  return (
    <section className="tab-panel active">
      <div className="overall-progress-card">
        <div className="section-header">
          <div>
            <div className="section-title">Today's Overall Progress</div>
            <div className="section-sub">
              {pct === 0 ? 'Start your first session to track progress' : pct === 100 ? '🎉 Day complete! Amazing work!' : `${pct}% through today's plan`}
            </div>
          </div>
          <div className="progress-stats">
            <div className="pstat"><div className="pstat-value">{pct}%</div><div className="pstat-label">Complete</div></div>
            <div className="pstat"><div className="pstat-value">{doneTasks}/{totalTasks}</div><div className="pstat-label">Tasks Done</div></div>
            <div className="pstat"><div className="pstat-value">{h}h {m}m</div><div className="pstat-label">Time Focused</div></div>
          </div>
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }}></div>
        </div>
      </div>

      <div className="section-header">
        <div>
          <div className="section-title">Your 5 Learning Pillars</div>
          <div className="section-sub">Click a pillar card to start a Pomodoro timer</div>
        </div>
        <button className="btn-primary" onClick={markDayComplete}>✅ Mark Day Complete</button>
      </div>

      <div className="pillars-grid">
        {PILLARS.map(p => {
          const curr = (CURRICULUM[p.id] || [])[currentDay - 1] || { topic: 'Free study day', tasks: [] };
          const pDone = curr.tasks.filter((_, i) => tasks[`${todayStr}_${p.id}_${i}`]).length;
          const pTotal = curr.tasks.length || 1;
          const pPct = Math.round((pDone / pTotal) * 100);
          const offset = 138.23 - (pPct / 100) * 138.23;
          const isRunning = activeTimer === p.id;
          const dispTime = isRunning ? remaining : ((td.timers || {})[p.id] || 0);

          return (
            <div key={p.id} className="pillar-card" style={{"--pc": p.color}}>
              <div className="pillar-card-top">
                <div className="pillar-icon-wrap" style={{"--pc": p.color}}>{p.icon}</div>
                <div className="ring-container" title={`${pPct}% complete`}>
                  <svg className="ring-svg" viewBox="0 0 52 52">
                    <circle className="ring-bg" cx="26" cy="26" r="22"/>
                    <circle className="ring-fg" cx="26" cy="26" r="22" style={{stroke: p.color, strokeDashoffset: offset}}/>
                  </svg>
                  <div className="ring-pct" style={{color: p.color}}>{pPct}%</div>
                </div>
              </div>
              <div className="pillar-name">{p.icon} {p.name}</div>
              <div className="pillar-topic">{curr.topic}</div>
              <div className="pillar-hours">⏰ {p.dailyHours}h/day · {pDone}/{pTotal} tasks</div>
              <div className="pillar-timer">
                <div className="timer-display">{formatTimer(dispTime)}</div>
                <div className="timer-controls">
                  <button className="timer-btn" onClick={() => toggleTimer(p.id)}>{isRunning ? '⏸' : '▶'}</button>
                  <button className="timer-btn" onClick={() => resetTimer(p.id)}>↺</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
