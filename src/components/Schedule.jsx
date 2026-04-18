import React, { useState } from 'react';
import { useAppState } from '../context/StateContext';
import { PILLARS, CURRICULUM } from '../data/curriculum';
import { SCHEDULE_CONFIG } from '../data/constants';

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

export default function Schedule() {
  const { S, updateState, addXP, syncNotion, computeCurrentDay } = useAppState();
  const [viewDay, setViewDay] = useState(S.currentViewDay || computeCurrentDay());

  const handlePrev = () => { if (viewDay > 1) { setViewDay(v => v - 1); updateState(s => ({...s, currentViewDay: viewDay - 1})); } };
  const handleNext = () => { if (viewDay < 30) { setViewDay(v => v + 1); updateState(s => ({...s, currentViewDay: viewDay + 1})); } };

  const targetDate = addDays(S.startDate, viewDay - 1);
  const td = S.dayData[targetDate] || {};
  const tasks = td.tasks || {};

  const toggleTask = (pId, idx) => {
    const key = `${targetDate}_${pId}_${idx}`;
    const wasTrue = !!tasks[key];
    
    updateState(prev => {
      const copy = { ...prev };
      if (!copy.dayData[targetDate]) copy.dayData[targetDate] = {};
      if (!copy.dayData[targetDate].tasks) copy.dayData[targetDate].tasks = {};
      copy.dayData[targetDate].tasks[key] = !wasTrue;
      return copy;
    });

    if (!wasTrue) addXP(10);
    
    syncNotion('mark_task_done', { 
      pillar: pId, 
      day: viewDay, 
      status: !wasTrue ? 'Completed' : 'In Progress' 
    });
  };

  return (
    <section className="tab-panel active">
      <div className="schedule-day-select">
        <button className="day-nav-btn" onClick={handlePrev}>‹</button>
        <div className="day-label">Day {viewDay}</div>
        <button className="day-nav-btn" onClick={handleNext}>›</button>
        <div style={{flex: 1}}></div>
        <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>
          {new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div className="schedule-grid">
        {SCHEDULE_CONFIG.map(sc => {
          const p = PILLARS.find(x => x.id === sc.pillar);
          const curr = (CURRICULUM[sc.pillar] || [])[viewDay - 1] || { topic: 'Free study day', tasks: [] };
          const allDone = curr.tasks.length > 0 && curr.tasks.every((_, i) => !!tasks[`${targetDate}_${sc.pillar}_${i}`]);

          return (
            <div key={sc.pillar} className="schedule-block">
              <div className="schedule-time">
                <div className="schedule-time-text">{sc.start}</div>
                <div className="schedule-break-text">{sc.duration}</div>
              </div>
              <div className={`schedule-card ${allDone ? 'completed' : ''}`} style={{"--pc": p.color}}>
                <div className="sc-top">
                  <span className="sc-pillar-badge" style={{"--pc": p.color}}>{p.icon} {p.name}</span>
                  <span className="sc-duration">{sc.duration}</span>
                </div>
                <div className="sc-topic">{curr.topic}</div>
                <ul className="sc-tasks">
                  {curr.tasks.map((t, i) => {
                    const done = !!tasks[`${targetDate}_${sc.pillar}_${i}`];
                    return (
                      <li key={i} className={`sc-task ${done ? 'done' : ''}`} onClick={() => toggleTask(sc.pillar, i)}>
                        <div className="sc-task-check">{done ? '✓' : ''}</div>
                        <span className="sc-task-text">{t}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
