const { Client } = require('@notionhq/client');

/**
 * Vercel Serverless Function — Notion API Bridge
 * Safe proxy for interacting with Notion from the public web dashboard.
 */
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const PILLAR_MAP = {
  articulation: { name: 'Articulation & Confidence', icon: '🗣️', xpPerHour: 30 },
  databricks:   { name: 'Databricks',                icon: '🧱', xpPerHour: 50 },
  mean:         { name: 'MEAN Stack',                icon: '⚙️', xpPerHour: 50 },
  ai:           { name: 'AI Learning',               icon: '🤖', xpPerHour: 40 },
  project:      { name: 'Own Project',               icon: '🚀', xpPerHour: 60 },
};

function resolvePillar(pillar) {
  return { id: pillar, ...PILLAR_MAP[pillar] };
}

const richText = (str) => [{ type: 'text', text: { content: str ?? '' } }];
const todayStr = () => new Date().toISOString().split('T')[0];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, payload, ids } = req.body;
    
    if (!process.env.NOTION_TOKEN) {
        // If deployed without token, gracefully allow the client to continue 
        // without failing the local UI interactions.
        console.warn("NOTION_TOKEN not set, skipping Notion sync.");
        return res.status(200).json({ success: true, fake: true });
    }

    if (action === 'log_session') {
      const { pillar, hours, notes, day } = payload;
      const p = resolvePillar(pillar);
      const xp = Math.round(hours * p.xpPerHour);
      const title = `${todayStr()} | ${p.icon} ${p.name}`;

      await notion.pages.create({
        parent: { database_id: ids.progressDbId },
        icon: { type: 'emoji', emoji: p.icon },
        properties: {
          'Session':    { title: richText(title) },
          'Date':       { date: { start: todayStr() } },
          'Pillar':     { select: { name: p.name } },
          'Hours':      { number: hours },
          'Tasks Done': { number: 0 },
          'XP Earned':  { number: xp },
          'Day Number': { number: day },
          'Notes':      { rich_text: richText(notes || 'Logged via Dashboard UI') },
        },
      });
      return res.status(200).json({ success: true });
    }

    if (action === 'mark_task_done') {
      const { pillar, day, status } = payload;
      const p = resolvePillar(pillar);

      const results = await notion.databases.query({
        database_id: ids.curriculumDbId,
        filter: {
          and: [
            { property: 'Day', number: { equals: day } },
            { property: 'Pillar', select: { equals: p.name } },
          ],
        },
      });

      if (results.results.length > 0) {
        await notion.pages.update({ 
          page_id: results.results[0].id, 
          properties: { 'Status': { select: { name: status } } } 
        });
      }
      return res.status(200).json({ success: true });
    }

    if (action === 'complete_day') {
      const { day } = payload;
      const results = await notion.databases.query({
        database_id: ids.curriculumDbId,
        filter: { property: 'Day', number: { equals: day } },
      });

      for (const page of results.results) {
        await notion.pages.update({ 
          page_id: page.id, 
          properties: { 'Status': { select: { name: 'Completed' } } } 
        });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error('Notion API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
