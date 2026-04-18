import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BADGES_DEF } from '../data/constants';

const STATE_KEY = 'lcc_v1';

const StateContext = createContext(null);

function dateKey(d = new Date()) {
  return d.toISOString().split('T')[0];
}

function defaultState() {
  return {
    startDate: dateKey(),
    currentViewDay: 1,
    xp: 0,
    streak: 0,
    lastCompletedDate: null,
    completedDays: {},
    dayData: {},
    kanban: { cards: {}, nextId: 1 },
    badges: [],
  };
}

export function StateProvider({ children }) {
  const [S, setS] = useState(() => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch { return defaultState(); }
  });

  // Auto-save
  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(S));
  }, [S]);

  const todayStr = dateKey();
  
  const computeCurrentDay = useCallback(() => {
    const start  = new Date(S.startDate);
    const target = new Date(todayStr);
    return Math.floor((target - start) / 86400000) + 1;
  }, [S.startDate, todayStr]);

  const currentDay = computeCurrentDay();

  // Notion Sync
  const syncNotion = async (action, payload) => {
    try {
      const idsRes = await fetch('/notion/notion-ids.json');
      if (!idsRes.ok) return;
      const ids = await idsRes.json();
      await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, ids })
      });
    } catch (err) {
      console.debug('Dashboard Notion Sync Skipped/Failed', err);
    }
  };

  const checkBadges = useCallback((currentState) => {
    let changed = false;
    const newBadges = [...currentState.badges];
    BADGES_DEF.forEach(b => {
      if (!newBadges.includes(b.id) && b.check(currentState, todayStr, currentDay)) {
        newBadges.push(b.id);
        changed = true;
        // In a real app we'd trigger a toast here
        console.log(`Badge unlocked: ${b.icon} ${b.name}`);
      }
    });
    if (changed) return newBadges;
    return null;
  }, [todayStr, currentDay]);

  const addXP = useCallback((pts) => {
    setS(prev => {
      const nextState = { ...prev, xp: prev.xp + pts };
      const newBadges = checkBadges(nextState);
      if (newBadges) nextState.badges = newBadges;
      return nextState;
    });
  }, [checkBadges]);

  const updateState = useCallback((updater) => {
    setS(prev => {
      const nextState = updater(prev);
      return nextState;
    });
  }, []);

  return (
    <StateContext.Provider value={{
      S, updateState, addXP, todayStr, currentDay, syncNotion, computeCurrentDay
    }}>
      {children}
    </StateContext.Provider>
  );
}

export const useAppState = () => useContext(StateContext);
