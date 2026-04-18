#!/usr/bin/env node
/**
 * Learning Command Center — Notion Tool (CLI)
 * 
 * Usage:
 *   node notion-tool.js log-session --pillar databricks --hours 2 --notes "Delta Lake"
 *   node notion-tool.js complete-day [--day 1]
 *   node notion-tool.js check-progress
 *   node notion-tool.js add-task --title "Study Spark" --pillar databricks --priority high
 *   node notion-tool.js update-curriculum --pillar databricks --day 1 --status "Completed"
 *   node notion-tool.js get-today-plan
 */

import { Client } from '@notionhq/client';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IDS_FILE  = join(__dirname, 'notion-ids.json');

// ── Notion client ─────────────────────────────────────────────────────────────
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── Load IDs ──────────────────────────────────────────────────────────────────
function loadIds() {
  if (!existsSync(IDS_FILE)) {
    console.error('❌ notion-ids.json not found. Run: npm run setup');
    process.exit(1);
  }
  return JSON.parse(readFileSync(IDS_FILE, 'utf8'));
}

// ── Pillar mapping ────────────────────────────────────────────────────────────
const PILLAR_MAP = {
  articulation: { name: 'Articulation & Confidence', icon: '🗣️', xpPerHour: 30 },
  databricks:   { name: 'Databricks',                icon: '🧱', xpPerHour: 50 },
  mean:         { name: 'MEAN Stack',                icon: '⚙️', xpPerHour: 50 },
  ai:           { name: 'AI Learning',               icon: '🤖', xpPerHour: 40 },
  project:      { name: 'Own Project',               icon: '🚀', xpPerHour: 60 },
};

function resolvePillar(input) {
  if (!input) return null;
  const lower = input.toLowerCase();
  if (PILLAR_MAP[lower]) return { id: lower, ...PILLAR_MAP[lower] };
  // Fuzzy match
  for (const [id, p] of Object.entries(PILLAR_MAP)) {
    if (p.name.toLowerCase().includes(lower) || lower.includes(id)) return { id, ...p };
  }
  return null;
}

// ── Parse CLI args ────────────────────────────────────────────────────────────
function parseArgs() {
  const args   = process.argv.slice(2);
  const command = args[0];
  const opts   = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    }
  }
  return { command, opts };
}

// ── Rich text helper ──────────────────────────────────────────────────────────
const richText = (str) => [{ type: 'text', text: { content: str ?? '' } }];
const today    = () => new Date().toISOString().split('T')[0];
const dayNum   = () => {
  // Try to compute day number from first progress log entry or return 1
  return 1; // Will enhance with state tracking later
};

// ── COMMANDS ──────────────────────────────────────────────────────────────────

/**
 * log-session: Record a study session in the Progress Log
 * Options: --pillar, --hours, --notes, --tasks, --day
 */
async function logSession(opts) {
  const ids    = loadIds();
  const pillar = resolvePillar(opts.pillar);
  
  if (!pillar) {
    console.error('❌ Invalid pillar. Use: articulation, databricks, mean, ai, project');
    process.exit(1);
  }

  const hours    = parseFloat(opts.hours || 1);
  const tasks    = parseInt(opts.tasks || 0);
  const notes    = opts.notes || '';
  const day      = parseInt(opts.day || 1);
  const xp       = Math.round(hours * pillar.xpPerHour) + (tasks * 10);
  const dateStr  = opts.date || today();
  const title    = `${dateStr} | ${pillar.icon} ${pillar.name}`;

  const page = await notion.pages.create({
    parent: { database_id: ids.progressDbId },
    icon:   { type: 'emoji', emoji: pillar.icon },
    properties: {
      'Session':    { title: richText(title) },
      'Date':       { date: { start: dateStr } },
      'Pillar':     { select: { name: pillar.name } },
      'Hours':      { number: hours },
      'Tasks Done': { number: tasks },
      'XP Earned':  { number: xp },
      'Day Number': { number: day },
      'Notes':      { rich_text: richText(notes) },
    },
  });

  console.log(`✅ Session logged!`);
  console.log(`   ${pillar.icon} ${pillar.name} · ${hours}h · ${tasks} tasks · +${xp} XP`);
  console.log(`   📅 Date: ${dateStr}`);
  if (notes) console.log(`   📝 Notes: ${notes}`);
  console.log(`   🔗 ${page.url}`);
}

/**
 * update-curriculum: Update status of a curriculum entry
 * Options: --pillar, --day, --status (Completed|In Progress|Not Started)
 */
async function updateCurriculum(opts) {
  const ids    = loadIds();
  const pillar = resolvePillar(opts.pillar);
  const day    = parseInt(opts.day || 1);
  const status = opts.status || 'Completed';

  console.log(`🔍 Finding Day ${day} | ${pillar?.name || opts.pillar}…`);

  const results = await notion.databases.query({
    database_id: ids.curriculumDbId,
    filter: {
      and: [
        { property: 'Day',    number:  { equals: day } },
        { property: 'Pillar', select:  { equals: pillar?.name || opts.pillar } },
      ],
    },
  });

  if (results.results.length === 0) {
    console.error(`❌ No curriculum entry found for Day ${day} | ${pillar?.name}`);
    process.exit(1);
  }

  const pageId = results.results[0].id;
  await notion.pages.update({
    page_id: pageId,
    properties: {
      'Status': { select: { name: status } },
    },
  });

  console.log(`✅ Updated: Day ${day} | ${pillar?.icon} ${pillar?.name} → ${status}`);
}

/**
 * complete-day: Mark ALL curriculum entries for a day as Completed
 * Options: --day
 */
async function completeDay(opts) {
  const ids = loadIds();
  const day = parseInt(opts.day || 1);
  
  console.log(`🔍 Marking all Day ${day} curriculum entries as Completed…`);

  const results = await notion.databases.query({
    database_id: ids.curriculumDbId,
    filter: { property: 'Day', number: { equals: day } },
  });

  for (const page of results.results) {
    await notion.pages.update({
      page_id: page.id,
      properties: { 'Status': { select: { name: 'Completed' } } },
    });
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`✅ Day ${day} marked complete! (${results.results.length} entries updated)`);
  console.log(`   +100 XP bonus for completing a full day! 🎉`);
}

/**
 * check-progress: Show progress summary from Progress Log
 */
async function checkProgress(opts) {
  const ids = loadIds();
  console.log('📊 Fetching your progress...\n');

  // Total sessions
  const allSessions = await notion.databases.query({ database_id: ids.progressDbId });
  
  if (allSessions.results.length === 0) {
    console.log('  No sessions logged yet. Start learning and log your first session!\n');
    console.log('  node notion-tool.js log-session --pillar databricks --hours 2');
    return;
  }

  let totalHours = 0, totalXP = 0, totalTasks = 0;
  const pillarStats = {};

  for (const page of allSessions.results) {
    const props    = page.properties;
    const pillarName = props['Pillar']?.select?.name || 'Unknown';
    const hours    = props['Hours']?.number || 0;
    const xp       = props['XP Earned']?.number || 0;
    const tasks    = props['Tasks Done']?.number || 0;

    totalHours += hours;
    totalXP    += xp;
    totalTasks += tasks;

    if (!pillarStats[pillarName]) pillarStats[pillarName] = { hours: 0, xp: 0, sessions: 0 };
    pillarStats[pillarName].hours    += hours;
    pillarStats[pillarName].xp       += xp;
    pillarStats[pillarName].sessions += 1;
  }

  // Curriculum completion
  const compResult = await notion.databases.query({
    database_id: ids.curriculumDbId,
    filter: { property: 'Status', select: { equals: 'Completed' } },
  });

  const totalEntries    = 150; // 30 days × 5 pillars
  const completedCount  = compResult.results.length;
  const completionPct   = Math.round((completedCount / totalEntries) * 100);

  console.log('═══════════════════════════════════════════');
  console.log('  🧠 Learning Command Center — Progress');
  console.log('═══════════════════════════════════════════');
  console.log(`  📊 Overall Completion:  ${completionPct}% (${completedCount}/${totalEntries} entries)`);
  console.log(`  ⏱️  Total Time:          ${totalHours.toFixed(1)} hours`);
  console.log(`  ✅ Total Tasks Done:    ${totalTasks}`);
  console.log(`  ⭐ Total XP Earned:     ${totalXP} XP`);
  console.log(`  📝 Total Sessions:      ${allSessions.results.length}`);
  console.log('\n  ── By Pillar ────────────────────────────');
  
  for (const [name, stats] of Object.entries(pillarStats)) {
    const icon = Object.values(PILLAR_MAP).find(p => p.name === name)?.icon || '📌';
    console.log(`  ${icon} ${name.padEnd(28)} ${stats.hours.toFixed(1)}h · ${stats.xp} XP · ${stats.sessions} sessions`);
  }
  console.log('═══════════════════════════════════════════\n');
}

/**
 * add-task: Add a task to the Curriculum DB as a custom entry
 * Options: --title, --pillar, --day, --priority
 */
async function addTask(opts) {
  const ids    = loadIds();
  const pillar = resolvePillar(opts.pillar);
  const day    = parseInt(opts.day || 1);
  const title  = opts.title || 'Custom Task';

  if (!pillar) {
    console.error('❌ Invalid pillar. Use: articulation, databricks, mean, ai, project');
    process.exit(1);
  }

  const page = await notion.pages.create({
    parent: { database_id: ids.curriculumDbId },
    icon:   { type: 'emoji', emoji: pillar.icon },
    properties: {
      'Topic':  { title: richText(`Day ${day} | ${title}`) },
      'Day':    { number: day },
      'Pillar': { select: { name: pillar.name } },
      'Status': { select: { name: 'Not Started' } },
      'Task 1': { rich_text: richText(title) },
    },
  });

  console.log(`✅ Task added: "${title}"`);
  console.log(`   ${pillar.icon} ${pillar.name} · Day ${day}`);
  console.log(`   🔗 ${page.url}`);
}

/**
 * get-today-plan: Show today's curriculum entries
 * Options: --day
 */
async function getTodayPlan(opts) {
  const ids = loadIds();
  const day = parseInt(opts.day || 1);
  
  console.log(`📅 Day ${day} Plan\n`);

  const results = await notion.databases.query({
    database_id: ids.curriculumDbId,
    filter: { property: 'Day', number: { equals: day } },
    sorts: [{ property: 'Pillar', direction: 'ascending' }],
  });

  const SCHEDULE = {
    'Articulation & Confidence': '09:00–10:00',
    'Databricks':                '10:15–12:15',
    'MEAN Stack':                '12:30–14:30',
    'AI Learning':               '14:45–16:15',
    'Own Project':               '16:30–18:00',
  };

  console.log('  Time           Pillar                   Topic');
  console.log('  ' + '─'.repeat(75));
  for (const page of results.results) {
    const props   = page.properties;
    const pillar  = props['Pillar']?.select?.name || '—';
    const topic   = props['Topic']?.title?.[0]?.plain_text?.replace(`Day ${day} | `, '') || '—';
    const status  = props['Status']?.select?.name || '—';
    const time    = SCHEDULE[pillar] || '—';
    const icon    = Object.values(PILLAR_MAP).find(p => p.name === pillar)?.icon || '📌';
    const check   = status === 'Completed' ? '✅' : status === 'In Progress' ? '🔵' : '⬜';
    console.log(`  ${time.padEnd(15)} ${check} ${icon} ${pillar.padEnd(25)} ${topic.slice(0, 40)}`);
  }
  console.log();
}

// ── Router ────────────────────────────────────────────────────────────────────
const COMMANDS = {
  'log-session':        logSession,
  'update-curriculum':  updateCurriculum,
  'complete-day':       completeDay,
  'check-progress':     checkProgress,
  'add-task':           addTask,
  'get-today-plan':     getTodayPlan,
};

async function main() {
  const { command, opts } = parseArgs();

  if (!command || command === 'help') {
    console.log('\n🧠 Learning Command Center — Notion Tool\n');
    console.log('Commands:');
    console.log('  log-session        --pillar <id> --hours <n> --notes "<text>" --tasks <n>');
    console.log('  update-curriculum  --pillar <id> --day <n> --status <Completed|In Progress>');
    console.log('  complete-day       --day <n>');
    console.log('  check-progress');
    console.log('  add-task           --title "<text>" --pillar <id> --day <n>');
    console.log('  get-today-plan     --day <n>');
    console.log('\nPillar IDs: articulation, databricks, mean, ai, project\n');
    return;
  }

  const fn = COMMANDS[command];
  if (!fn) {
    console.error(`❌ Unknown command: ${command}`);
    console.log('   Run: node notion-tool.js help');
    process.exit(1);
  }

  try {
    await fn(opts);
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.body) console.error('   Notion API:', JSON.stringify(err.body, null, 2));
    process.exit(1);
  }
}

main();
