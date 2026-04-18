import React from 'react';
import { RESOURCES } from '../data/constants';
import { PILLARS } from '../data/curriculum';

export default function Resources() {
  return (
    <section className="tab-panel active">
      <div className="section-header">
        <div className="section-title">📚 Curated Resources</div>
        <div className="section-sub">Handpicked links for each pillar</div>
      </div>

      <div className="resources-grid">
        {RESOURCES.map((r, i) => {
          const p = PILLARS.find(x => x.id === r.pillar) || PILLARS[0];
          return (
            <div key={i} className="resource-card" style={{"--pc": p.color}}>
              <div className="res-tag" style={{"--pc": p.color}}>{p.icon} {p.name}</div>
              <div className="res-title">{r.title}</div>
              <div className="res-desc">{r.desc}</div>
              <a className="res-link" href={r.url} target="_blank" rel="noopener noreferrer" style={{color: p.color}}>
                {r.label}
              </a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
