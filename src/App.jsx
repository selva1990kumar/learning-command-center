import React, { useState } from 'react';
import Topbar from './components/Topbar';
import PillarGrid from './components/PillarGrid';
import Schedule from './components/Schedule';
import KanbanBoard from './components/KanbanBoard';
import Progress from './components/Progress';
import ResourcesComponent from './components/Resources';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <>
      <Topbar />
      
      <nav id="nav" role="navigation" aria-label="Main navigation">
        <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          🏠 Dashboard
        </button>
        <button className={`nav-tab ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>
          📅 Today's Plan
        </button>
        <button className={`nav-tab ${activeTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveTab('kanban')}>
          🗂️ Kanban Board
        </button>
        <button className={`nav-tab ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
          📈 Progress
        </button>
        <button className={`nav-tab ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>
          📚 Resources
        </button>
      </nav>

      <main id="main" role="main">
        {activeTab === 'dashboard' && <PillarGrid />}
        {activeTab === 'plan' && <Schedule />}
        {activeTab === 'kanban' && <KanbanBoard />}
        {activeTab === 'progress' && <Progress />}
        {activeTab === 'resources' && <ResourcesComponent />}
      </main>

      <div id="toast-container" aria-live="polite"></div>
    </>
  );
}
