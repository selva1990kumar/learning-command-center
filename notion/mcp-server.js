#!/usr/bin/env node
/**
 * Learning Command Center — MCP Server for OpenClaw
 * 
 * This MCP server exposes Notion update tools to OpenClaw so you can:
 *   - Message via Telegram: "Log 2 hours of Databricks today"
 *   - OpenClaw calls this MCP server
 *   - Notion gets updated automatically
 * 
 * Start: node mcp-server.js
 * Add to OpenClaw config (see README for instructions)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@notionhq/client';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IDS_FILE  = join(__dirname, 'notion-ids.json');
const notion    = new Client({ auth: process.env.NOTION_TOKEN });

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadIds() {
  if (!existsSync(IDS_FILE)) throw new Error('notion-ids.json not found. Run: npm run setup');
  return JSON.parse(readFileSync(IDS_FILE, 'utf8'));
}

const PILLAR_MAP = {
  articulation: { name: 'Articulation & Confidence', icon: '🗣️', xpPerHour: 30 },
  databricks:   { name: 'Databricks',                icon: '🧱', xpPerHour: 50 },
  mean:         { name: 'MEAN Stack',                icon: '⚙️', xpPerHour: 50 },
  ai:           { name: 'AI Learning',               icon: '🤖', xpPerHour: 40 },
  project:      { name: 'Own Project',               icon: '🚀', xpPerHour: 60 },
};

function resolvePillar(input) {
  const lower = input.toLowerCase();
  if (PILLAR_MAP[lower]) return { id: lower, ...PILLAR_MAP[lower] };
  for (const [id, p] of Object.entries(PILLAR_MAP)) {
    if (p.name.toLowerCase().includes(lower) || lower.includes(id)) return { id, ...p };
  }
  return null;
}

const richText = (str) => [{ type: 'text', text: { content: str ?? '' } }];
const todayStr = () => new Date().toISOString().split('T')[0];
const sleep    = (ms) => new Promise(r => setTimeout(r, ms));

// ── MCP Server ────────────────────────────────────────────────────────────────
const server = new McpServer({
  name:    'learning-command-center',
  version: '1.0.0',
});

// ── TOOL: log_session ─────────────────────────────────────────────────────────
server.tool(
  'log_session',
  'Log a learning session to the Progress Log in Notion. Call this when the user says they studied, learned, or worked on a pillar.',
  {
    pillar:     z.string().describe('Pillar ID: articulation, databricks, mean, ai, or project'),
    hours:      z.number().describe('Number of hours spent studying (e.g. 1.5)'),
    tasks_done: z.number().optional().describe('Number of tasks completed'),
    notes:      z.string().optional().describe('What was studied or accomplished'),
    day:        z.number().optional().describe('Day number in the 30-day plan (default: today)'),
  },
  async ({ pillar, hours, tasks_done = 0, notes = '', day = 1 }) => {
    const ids    = loadIds();
    const p      = resolvePillar(pillar);
    if (!p) return { content: [{ type: 'text', text: `❌ Unknown pillar: ${pillar}. Use: articulation, databricks, mean, ai, project` }] };

    const xp    = Math.round(hours * p.xpPerHour) + (tasks_done * 10);
    const title = `${todayStr()} | ${p.icon} ${p.name}`;

    await notion.pages.create({
      parent: { database_id: ids.progressDbId },
      icon:   { type: 'emoji', emoji: p.icon },
      properties: {
        'Session':    { title: richText(title) },
        'Date':       { date: { start: todayStr() } },
        'Pillar':     { select: { name: p.name } },
        'Hours':      { number: hours },
        'Tasks Done': { number: tasks_done },
        'XP Earned':  { number: xp },
        'Day Number': { number: day },
        'Notes':      { rich_text: richText(notes) },
      },
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Session logged in Notion!\n${p.icon} ${p.name} · ${hours}h · ${tasks_done} tasks · +${xp} XP earned\n${notes ? `📝 ${notes}` : ''}`
      }]
    };
  }
);

// ── TOOL: mark_task_done ──────────────────────────────────────────────────────
server.tool(
  'mark_task_done',
  'Mark a specific curriculum entry as Completed in Notion. Call this when user says they finished or completed a topic.',
  {
    pillar: z.string().describe('Pillar: articulation, databricks, mean, ai, project'),
    day:    z.number().describe('Day number (1-30)'),
    status: z.string().optional().describe('Status to set: Completed, In Progress, or Not Started'),
  },
  async ({ pillar, day, status = 'Completed' }) => {
    const ids = loadIds();
    const p   = resolvePillar(pillar);
    if (!p) return { content: [{ type: 'text', text: `❌ Unknown pillar: ${pillar}` }] };

    const results = await notion.databases.query({
      database_id: ids.curriculumDbId,
      filter: {
        and: [
          { property: 'Day',    number: { equals: day } },
          { property: 'Pillar', select: { equals: p.name } },
        ],
      },
    });

    if (results.results.length === 0) {
      return { content: [{ type: 'text', text: `❌ No entry found for Day ${day} | ${p.name}` }] };
    }

    await notion.pages.update({ page_id: results.results[0].id, properties: { 'Status': { select: { name: status } } } });
    return { content: [{ type: 'text', text: `✅ Updated: Day ${day} | ${p.icon} ${p.name} → ${status}` }] };
  }
);

// ── TOOL: complete_day ────────────────────────────────────────────────────────
server.tool(
  'complete_day',
  'Mark ALL 5 pillars for a given day as Completed. Call this when user says they finished their day or completed all sessions.',
  {
    day: z.number().describe('Day number to mark complete (1-30)'),
  },
  async ({ day }) => {
    const ids = loadIds();

    const results = await notion.databases.query({
      database_id: ids.curriculumDbId,
      filter: { property: 'Day', number: { equals: day } },
    });

    for (const page of results.results) {
      await notion.pages.update({ page_id: page.id, properties: { 'Status': { select: { name: 'Completed' } } } });
      await sleep(300);
    }

    return {
      content: [{
        type: 'text',
        text: `🎉 Day ${day} COMPLETE! All ${results.results.length} pillars marked done.\n🔥 Streak extended! +100 XP bonus earned!`
      }]
    };
  }
);

// ── TOOL: check_progress ──────────────────────────────────────────────────────
server.tool(
  'check_progress',
  'Get a summary of learning progress from Notion. Call this when user asks about their progress, stats, or how they are doing.',
  {},
  async () => {
    const ids = loadIds();

    const [sessions, completed] = await Promise.all([
      notion.databases.query({ database_id: ids.progressDbId }),
      notion.databases.query({ database_id: ids.curriculumDbId, filter: { property: 'Status', select: { equals: 'Completed' } } }),
    ]);

    let totalHours = 0, totalXP = 0, totalTasks = 0;
    const byPillar = {};

    for (const page of sessions.results) {
      const props  = page.properties;
      const pName  = props['Pillar']?.select?.name || 'Unknown';
      const hours  = props['Hours']?.number || 0;
      const xp     = props['XP Earned']?.number || 0;
      const tasks  = props['Tasks Done']?.number || 0;
      totalHours  += hours;
      totalXP     += xp;
      totalTasks  += tasks;
      if (!byPillar[pName]) byPillar[pName] = { hours: 0, xp: 0 };
      byPillar[pName].hours += hours;
      byPillar[pName].xp   += xp;
    }

    const pct     = Math.round((completed.results.length / 150) * 100);
    const lines   = [`📊 Learning Progress Summary`, ``, `Overall: ${pct}% complete (${completed.results.length}/150 entries)`, `Total Time: ${totalHours.toFixed(1)} hours`, `Total Tasks: ${totalTasks}`, `Total XP: ${totalXP}`, `Sessions: ${sessions.results.length}`, ``];
    
    for (const [name, stats] of Object.entries(byPillar)) {
      const icon = Object.values(PILLAR_MAP).find(p => p.name === name)?.icon || '📌';
      lines.push(`${icon} ${name}: ${stats.hours.toFixed(1)}h · ${stats.xp} XP`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

// ── TOOL: add_task ────────────────────────────────────────────────────────────
server.tool(
  'add_task',
  'Add a new custom task to the Curriculum database in Notion.',
  {
    title:  z.string().describe('Title or description of the task'),
    pillar: z.string().describe('Which pillar: articulation, databricks, mean, ai, project'),
    day:    z.number().optional().describe('Day number to assign the task to'),
  },
  async ({ title, pillar, day = 1 }) => {
    const ids = loadIds();
    const p   = resolvePillar(pillar);
    if (!p) return { content: [{ type: 'text', text: `❌ Unknown pillar: ${pillar}` }] };

    await notion.pages.create({
      parent: { database_id: ids.curriculumDbId },
      icon:   { type: 'emoji', emoji: p.icon },
      properties: {
        'Topic':  { title: richText(`Day ${day} | ${title}`) },
        'Day':    { number: day },
        'Pillar': { select: { name: p.name } },
        'Status': { select: { name: 'Not Started' } },
        'Task 1': { rich_text: richText(title) },
      },
    });

    return { content: [{ type: 'text', text: `✅ Task added: "${title}"\n${p.icon} ${p.name} · Day ${day}` }] };
  }
);

// ── TOOL: get_today_plan ──────────────────────────────────────────────────────
server.tool(
  'get_today_plan',
  "Get today's learning plan from the Notion curriculum. Call this when user asks what to study today or what's on the plan.",
  {
    day: z.number().describe('Day number (1-30)'),
  },
  async ({ day }) => {
    const ids = loadIds();

    const results = await notion.databases.query({
      database_id: ids.curriculumDbId,
      filter: { property: 'Day', number: { equals: day } },
    });

    const SCHEDULE = {
      'Articulation & Confidence': '09:00–10:00',
      'Databricks': '10:15–12:15',
      'MEAN Stack': '12:30–14:30',
      'AI Learning': '14:45–16:15',
      'Own Project': '16:30–18:00',
    };

    const lines = [`📅 Day ${day} — Your 8-Hour Learning Plan\n`];
    for (const page of results.results) {
      const props  = page.properties;
      const pName  = props['Pillar']?.select?.name || '—';
      const topic  = props['Topic']?.title?.[0]?.plain_text?.replace(`Day ${day} | `, '') || '—';
      const status = props['Status']?.select?.name || '—';
      const time   = SCHEDULE[pName] || '—';
      const icon   = Object.values(PILLAR_MAP).find(p => p.name === pName)?.icon || '📌';
      const check  = status === 'Completed' ? '✅' : status === 'In Progress' ? '🔵' : '⬜';
      lines.push(`${time}  ${check} ${icon} ${pName}\n  └ ${topic}\n`);
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }
);

// ── Start server ──────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
