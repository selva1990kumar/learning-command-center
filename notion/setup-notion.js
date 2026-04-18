#!/usr/bin/env node
/**
 * Learning Command Center — Notion Workspace Setup
 * Automatically creates your full Notion workspace:
 *   🧠 Root page
 *   📅 Curriculum Database (30 days × 5 pillars)
 *   📈 Progress Log Database
 *   📚 Resources Database
 *   📊 Dashboard Page
 */

import { Client } from '@notionhq/client';
import { createRequire } from 'module';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IDS_FILE  = join(__dirname, 'notion-ids.json');

// ── Curriculum Data ────────────────────────────────────────────────────────────
const require  = createRequire(import.meta.url);

const PILLARS = [
  { id: 'articulation', name: 'Articulation & Confidence', icon: '🗣️', color: 'purple', dailyHours: 1 },
  { id: 'databricks',   name: 'Databricks',                icon: '🧱', color: 'orange', dailyHours: 2 },
  { id: 'mean',         name: 'MEAN Stack',                icon: '⚙️', color: 'green',  dailyHours: 2 },
  { id: 'ai',           name: 'AI Learning',               icon: '🤖', color: 'blue',   dailyHours: 1.5 },
  { id: 'project',      name: 'Own Project',               icon: '🚀', color: 'yellow', dailyHours: 1.5 },
];

// Import curriculum from parent data folder
const curriculumPath = join(__dirname, '..', 'data', 'curriculum.js');
// We parse it as CommonJS since it has module.exports
const rawCurriculum = readFileSync(curriculumPath, 'utf8');
// Execute in a sandboxed way
const mod = { exports: {} };
const fn = new Function('module', 'exports', rawCurriculum + '\nif(typeof PILLARS !== "undefined") module.exports = { PILLARS, CURRICULUM };');
fn(mod, mod.exports);
const CURRICULUM = mod.exports.CURRICULUM;

const RESOURCES = [
  { pillar: 'articulation', title: 'Toastmasters International',      url: 'https://www.toastmasters.org',                       desc: 'World\'s largest public speaking org. Find a club or attend online.' },
  { pillar: 'articulation', title: 'Speeko — Public Speaking App',    url: 'https://speeko.co',                                  desc: 'Guided daily speaking exercises on your phone.' },
  { pillar: 'articulation', title: 'TED Talks — Communication',       url: 'https://www.ted.com/topics/communication',            desc: 'Best TED talks on communication, confidence, storytelling.' },
  { pillar: 'databricks',   title: 'Databricks Academy',             url: 'https://www.databricks.com/learn/training',           desc: 'Official free training: Spark, Delta Lake, MLflow, cert prep.' },
  { pillar: 'databricks',   title: 'Databricks Community Edition',   url: 'https://community.cloud.databricks.com',             desc: 'Free cloud Databricks workspace for all exercises.' },
  { pillar: 'databricks',   title: 'Delta Lake Documentation',       url: 'https://docs.delta.io',                              desc: 'ACID transactions, Time Travel, OPTIMIZE, ZORDER.' },
  { pillar: 'mean',         title: 'MongoDB University',             url: 'https://university.mongodb.com',                     desc: 'Free official courses: CRUD, aggregation, Mongoose.' },
  { pillar: 'mean',         title: 'Angular Official Docs',          url: 'https://angular.dev',                                desc: 'Components, routing, forms, NgRx tutorials.' },
  { pillar: 'mean',         title: 'Node.js Best Practices',         url: 'https://github.com/goldbergyoni/nodebestpractices',  desc: 'Comprehensive Node.js best practices guide.' },
  { pillar: 'ai',           title: 'DeepLearning.AI Short Courses',  url: 'https://www.deeplearning.ai/short-courses/',         desc: 'Free 1-2 hr courses on RAG, Agents, LangChain.' },
  { pillar: 'ai',           title: 'LangChain Documentation',        url: 'https://python.langchain.com/docs/',                 desc: 'Official docs for LLM apps, agents, and RAG.' },
  { pillar: 'ai',           title: 'Hugging Face — Model Hub',       url: 'https://huggingface.co',                             desc: '300,000+ open source AI models.' },
  { pillar: 'project',      title: 'Product Hunt',                   url: 'https://www.producthunt.com',                        desc: 'Launch your project and get early users.' },
  { pillar: 'project',      title: 'Render — Free Hosting',          url: 'https://render.com',                                 desc: 'Deploy Node.js apps and PostgreSQL for free.' },
  { pillar: 'project',      title: 'Vercel — Frontend Hosting',      url: 'https://vercel.com',                                 desc: 'One-click Angular/React deployment from GitHub.' },
];

// ── Notion Client ──────────────────────────────────────────────────────────────
const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ── Helpers ────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function richText(str) {
  return [{ type: 'text', text: { content: str ?? '' } }];
}

function titleProp(str) {
  return { title: richText(str) };
}

let step = 0;
function log(msg, symbol = '→') {
  step++;
  console.log(`  ${symbol} [${step}] ${msg}`);
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function header(msg) { console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`); }

// ── Step 1: Find or create root page ──────────────────────────────────────────
async function findOrCreateRootPage() {
  // Use env var if provided (fastest path)
  if (process.env.NOTION_PARENT_PAGE_ID) {
    log(`Using page ID from .env: ${process.env.NOTION_PARENT_PAGE_ID}`);
    ok('Parent page ready.');
    return process.env.NOTION_PARENT_PAGE_ID;
  }

  // Try searching for an existing "Learning Command Center" page
  log('Searching for accessible Notion pages…');
  const results = await notion.search({ query: 'Learning Command Center', filter: { value: 'page', property: 'object' } });
  
  if (results.results.length > 0) {
    const match = results.results.find(p => {
      const titleArr = p.properties?.title?.title || p.properties?.Name?.title || [];
      const text = titleArr.map(t => t.plain_text).join('');
      return text.includes('Learning Command Center');
    });
    if (match) {
      ok(`Found existing page: ${match.id}`);
      return match.id;
    }
    ok(`Using first accessible page as parent: ${results.results[0].id}`);
    return results.results[0].id;
  }

  // Try to create at workspace root
  log('No accessible pages found — creating at workspace root…');
  try {
    const root = await notion.pages.create({
      parent: { type: 'workspace', workspace: true },
      icon:   { type: 'emoji', emoji: '🧠' },
      properties: { title: titleProp('🧠 Learning Command Center') },
    });
    ok(`Created root page: ${root.id}`);
    return root.id;
  } catch (e) {
    console.error('\n❌ Could not create a workspace-level page.');
    console.error('   Please do the following in Notion:\n');
    console.error('   1. Create a new page (e.g. "Learning Command Center")');
    console.error('   2. Click Share → search "Learning Command Center" integration → Invite');
    console.error('   3. Re-run: npm run setup\n');
    process.exit(1);
  }
}

// ── Step 2: Create Curriculum Database ────────────────────────────────────────
async function createCurriculumDB(parentId) {
  log('Creating Curriculum database…');
  const db = await notion.databases.create({
    parent:  { type: 'page_id', page_id: parentId },
    icon:    { type: 'emoji', emoji: '📅' },
    title:   richText('📅 Curriculum — 30-Day Plan'),
    properties: {
      'Topic':       { title: {} },
      'Day':         { number: { format: 'number' } },
      'Pillar':      { select: { options: PILLARS.map(p => ({ name: p.name, color: p.color })) } },
      'Status':      { select: { options: [
        { name: 'Not Started', color: 'gray' },
        { name: 'In Progress', color: 'blue' },
        { name: 'Completed',   color: 'green' },
      ]}},
      'Task 1':      { rich_text: {} },
      'Task 2':      { rich_text: {} },
      'Task 3':      { rich_text: {} },
      'Hours':       { number: { format: 'number' } },
      'Study Date':  { date: {} },
      'Notes':       { rich_text: {} },
    },
  });
  ok(`Curriculum DB created: ${db.id}`);
  return db.id;
}

// ── Step 3: Populate Curriculum ────────────────────────────────────────────────
async function populateCurriculum(dbId) {
  log('Populating curriculum (30 days × 5 pillars = 150 entries)…');
  console.log('     This takes ~2 minutes. Grab a coffee! ☕\n');
  
  let count = 0;
  const total = 30 * PILLARS.length;

  for (let day = 1; day <= 30; day++) {
    for (const pillar of PILLARS) {
      const entry  = (CURRICULUM[pillar.id] || [])[day - 1] || { topic: 'Free study day', tasks: [] };
      const tasks  = entry.tasks || [];
      
      await notion.pages.create({
        parent: { database_id: dbId },
        icon:   { type: 'emoji', emoji: pillar.icon },
        properties: {
          'Topic':   titleProp(`Day ${day} | ${entry.topic}`),
          'Day':     { number: day },
          'Pillar':  { select: { name: pillar.name } },
          'Status':  { select: { name: 'Not Started' } },
          'Task 1':  { rich_text: richText(tasks[0] || '') },
          'Task 2':  { rich_text: richText(tasks[1] || '') },
          'Task 3':  { rich_text: richText(tasks[2] || '') },
          'Hours':   { number: pillar.dailyHours },
        },
      });

      count++;
      process.stdout.write(`\r     Progress: ${count}/${total} (${Math.round(count/total*100)}%)   `);
      await sleep(350); // Respect Notion rate limits
    }
  }
  console.log('\n');
  ok(`All ${total} curriculum entries created!`);
}

// ── Step 4: Create Progress Log Database ──────────────────────────────────────
async function createProgressDB(parentId) {
  log('Creating Progress Log database…');
  const db = await notion.databases.create({
    parent:  { type: 'page_id', page_id: parentId },
    icon:    { type: 'emoji', emoji: '📈' },
    title:   richText('📈 Progress Log'),
    properties: {
      'Session':      { title: {} },
      'Date':         { date: {} },
      'Pillar':       { select: { options: PILLARS.map(p => ({ name: p.name, color: p.color })) } },
      'Hours':        { number: { format: 'number' } },
      'Tasks Done':   { number: { format: 'number' } },
      'XP Earned':    { number: { format: 'number' } },
      'Day Number':   { number: { format: 'number' } },
      'Notes':        { rich_text: {} },
    },
  });
  ok(`Progress Log DB created: ${db.id}`);
  return db.id;
}

// ── Step 5: Create Resources Database ─────────────────────────────────────────
async function createResourcesDB(parentId) {
  log('Creating Resources database…');
  const db = await notion.databases.create({
    parent:  { type: 'page_id', page_id: parentId },
    icon:    { type: 'emoji', emoji: '📚' },
    title:   richText('📚 Resources'),
    properties: {
      'Title':       { title: {} },
      'Pillar':      { select: { options: PILLARS.map(p => ({ name: p.name, color: p.color })) } },
      'URL':         { url: {} },
      'Description': { rich_text: {} },
    },
  });
  ok(`Resources DB created: ${db.id}`);

  log('Populating resources…');
  for (const r of RESOURCES) {
    const pillar = PILLARS.find(p => p.id === r.pillar);
    await notion.pages.create({
      parent: { database_id: db.id },
      icon:   { type: 'emoji', emoji: pillar.icon },
      properties: {
        'Title':       titleProp(r.title),
        'Pillar':      { select: { name: pillar.name } },
        'URL':         { url: r.url },
        'Description': { rich_text: richText(r.desc) },
      },
    });
    await sleep(350);
  }
  ok(`${RESOURCES.length} resources added!`);
  return db.id;
}

// ── Step 6: Create Dashboard Page ─────────────────────────────────────────────
async function createDashboardPage(parentId, ids) {
  log('Creating Dashboard overview page…');
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const page = await notion.pages.create({
    parent: { type: 'page_id', page_id: parentId },
    icon:   { type: 'emoji', emoji: '📊' },
    properties: { title: titleProp('📊 Dashboard') },
    children: [
      { object: 'block', type: 'heading_1', heading_1: { rich_text: richText('🧠 Learning Command Center') } },
      { object: 'block', type: 'paragraph', paragraph: { rich_text: richText(`Started: ${today} · 8 hours/day · 5 pillars · 30 days`) } },
      { object: 'block', type: 'divider', divider: {} },
      { object: 'block', type: 'heading_2', heading_2: { rich_text: richText('⏱️ Daily Schedule') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('09:00 – 10:00  🗣️ Articulation & Confidence (1 hr)') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('10:15 – 12:15  🧱 Databricks (2 hrs)') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('12:30 – 14:30  ⚙️ MEAN Stack (2 hrs)') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('14:45 – 16:15  🤖 AI Learning (1.5 hrs)') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('16:30 – 18:00  🚀 Own Project (1.5 hrs)') } },
      { object: 'block', type: 'divider', divider: {} },
      { object: 'block', type: 'heading_2', heading_2: { rich_text: richText('🗂️ Quick Links') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: '📅 Curriculum DB ID: ', }, }, { type: 'text', text: { content: ids.curriculumDbId } }] } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: '📈 Progress Log DB ID: ', }, }, { type: 'text', text: { content: ids.progressDbId } }] } },
      { object: 'block', type: 'divider', divider: {} },
      { object: 'block', type: 'heading_2', heading_2: { rich_text: richText('📲 Update via OpenClaw / Terminal') } },
      { object: 'block', type: 'code', code: { language: 'bash', rich_text: richText('# Log a session\nnode notion-tool.js log-session --pillar databricks --hours 2 --notes "Delta Lake basics" --tasks 3\n\n# Mark a day complete\nnode notion-tool.js complete-day\n\n# Check your progress\nnode notion-tool.js check-progress') } },
      { object: 'block', type: 'heading_2', heading_2: { rich_text: richText('💬 OpenClaw Telegram Commands') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('→ "Log 2 hours of Databricks today"') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('→ "Mark my Day 1 complete"') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('→ "Check my learning progress"') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: richText('→ "Add task: Study Spark joins → Databricks"') } },
    ],
  });
  ok(`Dashboard page created!`);
  return page.id;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  header('🧠 Learning Command Center — Notion Setup');
  console.log('  Setting up your complete Notion workspace...\n');

  // Check if already set up
  if (existsSync(IDS_FILE)) {
    const existing = JSON.parse(readFileSync(IDS_FILE, 'utf8'));
    console.log('  ⚠️  Setup already run! Existing IDs:');
    console.log(`     Root Page:    ${existing.rootPageId}`);
    console.log(`     Curriculum:   ${existing.curriculumDbId}`);
    console.log(`     Progress Log: ${existing.progressDbId}`);
    console.log('\n  To re-run setup, delete notion-ids.json and run again.\n');
    return;
  }

  try {
    // Step 1: Root page
    header('Step 1/6 — Root Page');
    const rootPageId = await findOrCreateRootPage();

    // Step 2: Create curriculum DB
    header('Step 2/6 — Curriculum Database');
    const curriculumDbId = await createCurriculumDB(rootPageId);

    // Step 3: Populate curriculum
    header('Step 3/6 — Populating 30-Day Curriculum');
    await populateCurriculum(curriculumDbId);

    // Step 4: Progress log
    header('Step 4/6 — Progress Log Database');
    const progressDbId = await createProgressDB(rootPageId);

    // Step 5: Resources
    header('Step 5/6 — Resources Database');
    const resourcesDbId = await createResourcesDB(rootPageId);

    // Step 6: Dashboard
    header('Step 6/6 — Dashboard Page');
    const dashboardPageId = await createDashboardPage(rootPageId, { curriculumDbId, progressDbId });

    // Save IDs for notion-tool.js
    const ids = { rootPageId, curriculumDbId, progressDbId, resourcesDbId, dashboardPageId };
    writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));

    header('🎉 Setup Complete!');
    console.log(`\n  Your Notion workspace is live!\n`);
    console.log(`  🔗 Open in Notion:`);
    console.log(`     https://notion.so/${rootPageId.replace(/-/g, '')}\n`);
    console.log(`  💬 Test the CLI tool:`);
    console.log(`     node notion-tool.js check-progress\n`);
    console.log(`  💾 IDs saved to: notion-ids.json\n`);

  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    if (err.code === 'unauthorized') {
      console.error('   Your NOTION_TOKEN may be invalid. Double-check it in .env');
    }
    process.exit(1);
  }
}

main();
