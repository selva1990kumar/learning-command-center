import { PILLARS, CURRICULUM } from './curriculum.js';

export const BADGES_DEF = [
  { id: 'first_task',   icon: '🌱', name: 'First Step',    check: (S, todayStr) => S.xp >= 10 },
  { id: 'day1_done',    icon: '🏆', name: 'Day 1 Hero',    check: (S, todayStr) => S.completedDays && Object.keys(S.completedDays).length >= 1 },
  { id: 'streak3',      icon: '🔥', name: '3-Day Streak',  check: (S, todayStr) => S.streak >= 3 },
  { id: 'streak7',      icon: '⚡', name: 'Week Warrior',  check: (S, todayStr) => S.streak >= 7 },
  { id: 'xp100',        icon: '💎', name: '100 XP',        check: (S, todayStr) => S.xp >= 100 },
  { id: 'xp500',        icon: '👑', name: '500 XP',        check: (S, todayStr) => S.xp >= 500 },
  { id: 'all5pillars',  icon: '🌟', name: 'All 5 Active',  check: (S, todayStr) => {
    const td = S.dayData[todayStr];
    if (!td) return false;
    return PILLARS.every(p => (td.timers || {})[p.id] > 0);
  }},
  { id: 'day30',        icon: '🎓', name: '30-Day Grad',   check: (S, todayStr, currentDay) => currentDay >= 30 },
];

export const SCHEDULE_CONFIG = [
  { pillar: 'articulation', start: '09:00', duration: '1h 00m' },
  { pillar: 'databricks',   start: '10:15', duration: '2h 00m' },
  { pillar: 'mean',         start: '12:30', duration: '2h 00m' },
  { pillar: 'ai',           start: '14:45', duration: '1h 30m' },
  { pillar: 'project',      start: '16:30', duration: '1h 30m' },
];

export const RESOURCES = [
  // Articulation
  { pillar: 'articulation', title: 'Toastmasters International', desc: 'World\'s largest public speaking organization. Find a club near you or attend online.', url: 'https://www.toastmasters.org', label: 'Visit →' },
  { pillar: 'articulation', title: 'Speeko — Public Speaking App', desc: 'Guided daily speaking exercises on your phone. Great for building speaking habits.', url: 'https://speeko.co', label: 'Visit →' },
  { pillar: 'articulation', title: 'TED Talks — Communication Playlist', desc: '20 best TED talks on communication, confidence and storytelling.', url: 'https://www.ted.com/topics/communication', label: 'Watch →' },
  // Databricks
  { pillar: 'databricks', title: 'Databricks Academy', desc: 'Official free training: Apache Spark, Delta Lake, MLflow, and certification prep.', url: 'https://www.databricks.com/learn/training', label: 'Learn →' },
  { pillar: 'databricks', title: 'Databricks Community Edition', desc: 'Free cloud Databricks workspace — perfect for all exercises in this curriculum.', url: 'https://community.cloud.databricks.com', label: 'Sign Up →' },
  { pillar: 'databricks', title: 'Delta Lake Documentation', desc: 'Official Delta Lake docs: ACID transactions, Time Travel, OPTIMIZE, and ZORDER.', url: 'https://docs.delta.io', label: 'Read →' },
  // MEAN
  { pillar: 'mean', title: 'MongoDB University', desc: 'Free official courses on MongoDB CRUD, aggregation, Mongoose, and more.', url: 'https://university.mongodb.com', label: 'Enroll →' },
  { pillar: 'mean', title: 'Angular Official Docs', desc: 'Official Angular docs with tutorials on components, routing, forms, and NgRx.', url: 'https://angular.dev', label: 'Read →' },
  { pillar: 'mean', title: 'Node.js Best Practices', desc: 'goldbergyoni\'s comprehensive Node.js best practices guide on GitHub.', url: 'https://github.com/goldbergyoni/nodebestpractices', label: 'Read →' },
  // AI
  { pillar: 'ai', title: 'DeepLearning.AI Short Courses', desc: 'Free 1-2 hour courses on RAG, Agents, Prompt Engineering, LangChain and more.', url: 'https://www.deeplearning.ai/short-courses/', label: 'Learn →' },
  { pillar: 'ai', title: 'LangChain Documentation', desc: 'Official docs for building LLM applications, agents, and RAG pipelines.', url: 'https://python.langchain.com/docs/', label: 'Read →' },
  { pillar: 'ai', title: 'Hugging Face — Model Hub', desc: 'Access 300,000+ open source AI models: LLMs, embeddings, vision, and more.', url: 'https://huggingface.co', label: 'Explore →' },
  // Project
  { pillar: 'project', title: 'Product Hunt', desc: 'Launch your project here to get early users and feedback from the tech community.', url: 'https://www.producthunt.com', label: 'Visit →' },
  { pillar: 'project', title: 'Render — Free Hosting', desc: 'Deploy Node.js apps, PostgreSQL, Redis for free. Perfect for side projects.', url: 'https://render.com', label: 'Deploy →' },
  { pillar: 'project', title: 'Vercel — Frontend Hosting', desc: 'One-click deployment for your Angular/React frontend with CI/CD from GitHub.', url: 'https://vercel.com', label: 'Deploy →' },
];
