import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/StateContext';
import { PILLARS, CURRICULUM } from '../data/curriculum';

export default function KanbanBoard() {
  const { S, updateState, addXP, computeCurrentDay } = useAppState();
  const [activePillar, setActivePillar] = useState('all');
  const [draggedId, setDraggedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({ title: '', sub: '', pillar: 'articulation', priority: 'med', col: 'todo' });

  // Seed default cards on load if empty
  useEffect(() => {
    if (Object.keys(S.kanban.cards).length === 0) {
      const dayN = computeCurrentDay();
      updateState(prev => {
        const copy = { ...prev };
        let nextId = copy.kanban.nextId;
        PILLARS.forEach(p => {
          const curr = (CURRICULUM[p.id] || [])[dayN - 1] || { topic: '', tasks: [] };
          curr.tasks.slice(0, 3).forEach((t, i) => {
             const id = `card_${nextId++}`;
             copy.kanban.cards[id] = { title: t, sub: curr.topic, pillar: p.id, priority: i===0?'high':'med', col: 'todo' };
          });
        });
        copy.kanban.nextId = nextId;
        return copy;
      });
    }
  }, [S.kanban.cards, computeCurrentDay, updateState]);

  const handleDragStart = (id) => setDraggedId(id);
  const handleDrop = (e, col) => {
    e.preventDefault();
    if (!draggedId) return;
    updateState(prev => {
      const copy = { ...prev };
      copy.kanban.cards[draggedId].col = col;
      return copy;
    });
    if (col === 'done') {
      addXP(15);
      console.log('Task moved to Done! +15 XP');
    }
    setDraggedId(null);
  };

  const markDone = (id) => {
    updateState(prev => {
      const copy = { ...prev };
      copy.kanban.cards[id].col = 'done';
      return copy;
    });
    addXP(15);
  };

  const openModal = (col) => {
    setModalForm({ title: '', sub: '', pillar: 'articulation', priority: 'med', col: col || 'todo' });
    setIsModalOpen(true);
  };

  const saveCard = () => {
    if (!modalForm.title) return alert('Please enter a task title');
    updateState(prev => {
      const copy = { ...prev };
      const id = `card_${copy.kanban.nextId++}`;
      copy.kanban.cards[id] = { ...modalForm };
      return copy;
    });
    setIsModalOpen(false);
  };

  const renderCol = (colId, label, color) => {
    const cards = Object.entries(S.kanban.cards).filter(([, c]) => c.col === colId && (activePillar === 'all' || c.pillar === activePillar));
    return (
      <div 
        className="kanban-col" 
        onDragOver={(e) => e.preventDefault()} 
        onDrop={(e) => handleDrop(e, colId)}>
        <div className="col-header">
          <div className="col-title"><div className="col-dot" style={{background: color}}></div> {label}</div>
          <div className="col-count">{cards.length}</div>
        </div>
        <div className="kanban-cards">
          {cards.map(([id, c]) => {
            const p = PILLARS.find(x => x.id === c.pillar) || PILLARS[0];
            return (
              <div key={id} className={`kanban-card ${draggedId === id ? 'dragging' : ''}`} style={{"--pc": p.color}} draggable onDragStart={() => handleDragStart(id)} onDragEnd={() => setDraggedId(null)}>
                <div className={`kc-priority ${c.priority}`}>{c.priority === 'high' ? '🔴 High' : c.priority === 'med' ? '🔵 Med' : '🟢 Low'}</div>
                <div className="kc-title">{c.title}</div>
                {c.sub && <div className="kc-sub">{p.icon} {c.sub}</div>}
                <div className="kc-footer">
                  <div className="kc-day">{p.name}</div>
                  {c.col !== 'done' && <div className="kc-check" onClick={() => markDone(id)}>✓</div>}
                </div>
              </div>
            );
          })}
        </div>
        <button className="add-card-btn" onClick={() => openModal(colId)}>+ Add task</button>
      </div>
    );
  };

  return (
    <section className="tab-panel active">
      <div className="section-header">
        <div>
          <div className="section-title">Kanban Board</div>
          <div className="section-sub">Drag tasks between columns · Click + to add a custom task</div>
        </div>
        <button className="btn-primary" onClick={() => openModal('todo')}>+ Add Task</button>
      </div>

      <div className="kanban-pillar-tabs">
        <button className={`kp-tab ${activePillar === 'all' ? 'active' : ''}`} style={{"--pc": "#e879f9"}} onClick={() => setActivePillar('all')}>🌐 All</button>
        {PILLARS.map(p => (
           <button key={p.id} className={`kp-tab ${activePillar === p.id ? 'active' : ''}`} style={{"--pc": p.color}} onClick={() => setActivePillar(p.id)}>{p.icon} {p.name}</button>
        ))}
      </div>

      <div className="kanban-board">
        {renderCol('todo', 'To Do', '#fb923c')}
        {renderCol('inprogress', 'In Progress', '#60a5fa')}
        {renderCol('done', 'Done', '#34d399')}
      </div>

      {isModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if(e.target.className.includes('modal-overlay')) setIsModalOpen(false); }}>
          <div className="modal">
            <div className="modal-title">Add Task</div>
            <input className="modal-input" placeholder="Task title…" value={modalForm.title} onChange={e => setModalForm({...modalForm, title: e.target.value})} />
            <input className="modal-input" placeholder="Description (optional)…" value={modalForm.sub} onChange={e => setModalForm({...modalForm, sub: e.target.value})} />
            <select className="modal-select" value={modalForm.pillar} onChange={e => setModalForm({...modalForm, pillar: e.target.value})}>
              <option value="articulation">🗣️ Articulation & Confidence</option>
              <option value="databricks">🧱 Databricks</option>
              <option value="mean">⚙️ MEAN Stack</option>
              <option value="ai">🤖 AI Learning</option>
              <option value="project">🚀 Own Project</option>
            </select>
            <select className="modal-select" value={modalForm.priority} onChange={e => setModalForm({...modalForm, priority: e.target.value})}>
              <option value="high">🔴 High Priority</option>
              <option value="med">🔵 Medium Priority</option>
              <option value="low">🟢 Low Priority</option>
            </select>
            <select className="modal-select" value={modalForm.col} onChange={e => setModalForm({...modalForm, col: e.target.value})}>
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveCard}>Add Task</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
