export type AssessmentConfig = {
  id: string;
  slug: string;
  category: "Technology" | "Writing" | "Design" | "Business" | "Data" | "Operations" | "Science";
  level: "Foundations" | "Intermediate" | "Advanced";
  title: string;
  rubricId: string;
  passThreshold: number;
  taskDescription: string;
  instructions: string;
  inputType: "code" | "text" | "file";
  inputPlaceholder: string;
  graded_on: { name: string; points: number }[];
  gradingPrompt: string;
  estimatedMinutes: number;
};

const strictJsonInstruction =
  'Return strict JSON in this shape: `{ scores: {<category>: {points: number, max: number, comment: string, suggestion: string}}, total: number, passed: boolean, flagged_for_review: boolean, flag_reason: string | null }`. No prose outside the JSON.';

export const assessments: AssessmentConfig[] = [
  // ── Technology ──────────────────────────────────────────────────────────────
  {
    id: "web-dev-html-001",
    slug: "web-dev-frontend",
    category: "Technology",
    level: "Foundations",
    title: "Frontend Web Development",
    rubricId: "web-dev-html-001",
    passThreshold: 70,
    taskDescription: "Build a semantic, accessible, responsive HTML/CSS landing page.",
    instructions: "Work at your own pace. Time is not scored.",
    inputType: "code",
    inputPlaceholder: "<!-- Paste your HTML and CSS here -->",
    graded_on: [
      { name: "Semantic HTML", points: 20 },
      { name: "CSS Quality", points: 20 },
      { name: "Responsiveness", points: 25 },
      { name: "Accessibility", points: 15 },
      { name: "Correctness", points: 20 },
    ],
    gradingPrompt: `You are grading a frontend web development submission. Score against the rubric. ${strictJsonInstruction}`,
    estimatedMinutes: 90,
  },
  {
    id: "backend-api-001",
    slug: "backend-api",
    category: "Technology",
    level: "Foundations",
    title: "Backend Development",
    rubricId: "backend-api-001",
    passThreshold: 70,
    taskDescription: "Build a small REST API for a task tracker with CRUD endpoints.",
    instructions: "Work at your own pace. Time is not scored.",
    inputType: "code",
    inputPlaceholder: "// Paste your complete API code here",
    graded_on: [
      { name: "API correctness", points: 30 },
      { name: "Input validation & error handling", points: 20 },
      { name: "Status code accuracy", points: 15 },
      { name: "Code quality", points: 20 },
      { name: "Documentation", points: 15 },
    ],
    gradingPrompt: `You are grading a backend API submission. Score against the rubric. Do not run the code; reason about it from reading. If the submission is empty, unrelated, or AI-generated without modification, score zero with a flag for human review. ${strictJsonInstruction}`,
    estimatedMinutes: 90,
  },

  // ── Writing ──────────────────────────────────────────────────────────────────
  {
    id: "copy-en-001",
    slug: "copywriting-en",
    category: "Writing",
    level: "Foundations",
    title: "Copywriting (English)",
    rubricId: "copy-en-001",
    passThreshold: 70,
    taskDescription: "Write landing-page copy for FarmConnect, a mobile app for Nigerian farmers.",
    instructions: "Write for the farmer, not the investor. Clear, specific, no jargon.",
    inputType: "text",
    inputPlaceholder: "Paste your FarmConnect landing-page copy here...",
    graded_on: [
      { name: "Clarity", points: 20 },
      { name: "Specificity", points: 25 },
      { name: "Audience fit", points: 20 },
      { name: "Structure", points: 15 },
      { name: "Persuasiveness", points: 20 },
    ],
    gradingPrompt: `You are grading landing-page copy. Score against the rubric. Penalize patronizing tone, abstract MBA-speak, or tech jargon. ${strictJsonInstruction}`,
    estimatedMinutes: 45,
  },
  {
    id: "translate-yo-en-001",
    slug: "translation-yo-en",
    category: "Writing",
    level: "Foundations",
    title: "Local Language Translation (Yoruba)",
    rubricId: "translate-yo-en-001",
    passThreshold: 75,
    taskDescription: "Translate three English passages into natural, register-appropriate Yoruba.",
    instructions: "Passing submissions require human translator review within 48 hours before credentials are issued.",
    inputType: "text",
    inputPlaceholder: "Paste your clearly labeled Yoruba translations and translator note here...",
    graded_on: [
      { name: "Accuracy of meaning", points: 30 },
      { name: "Register & tone", points: 25 },
      { name: "Natural Yoruba", points: 25 },
      { name: "Translator's note", points: 20 },
    ],
    gradingPrompt: `You are grading an English-to-Yoruba translation. Use a Yoruba-fluent reasoning approach. Every passing submission on this rubric should be flagged for human review by default. ${strictJsonInstruction}`,
    estimatedMinutes: 45,
  },

  // ── Design ───────────────────────────────────────────────────────────────────
  {
    id: "ux-design-001",
    slug: "ux-design-foundations",
    category: "Design",
    level: "Foundations",
    title: "UI/UX Design Foundations",
    rubricId: "ux-design-001",
    passThreshold: 70,
    taskDescription:
      "You're designing the main screen of a mobile money app for first-time smartphone users in rural Nigeria. Describe your screen layout, navigation, and key UX decisions. Include: what appears above the fold, how a user completes their first transaction, and how you've designed for low literacy and low bandwidth.",
    instructions: "Write as if handing off to a developer. Be specific about layout, labels, and interactions.",
    inputType: "text",
    inputPlaceholder: "Describe your screen design and UX decisions here...",
    graded_on: [
      { name: "Visual Hierarchy", points: 20 },
      { name: "Simplicity & Accessibility", points: 25 },
      { name: "User Flow", points: 25 },
      { name: "Feedback & Error States", points: 15 },
      { name: "Rationale Quality", points: 15 },
    ],
    gradingPrompt: `You are grading a UI/UX design description. The target user is a first-time smartphone user in rural Nigeria using a mobile money app. Reward specific, user-centered decisions. Penalize generic design patterns that ignore the target context. ${strictJsonInstruction}`,
    estimatedMinutes: 60,
  },

  // ── Business ─────────────────────────────────────────────────────────────────
  {
    id: "business-analysis-001",
    slug: "business-analysis",
    category: "Business",
    level: "Foundations",
    title: "Business Analysis",
    rubricId: "business-analysis-001",
    passThreshold: 70,
    taskDescription:
      "Analyze the opportunity for a \"buy now, pay later\" (BNPL) product targeting market traders in Lagos. Write a structured business analysis covering: the core problem, who the customer is, the proposed solution, key risks, and one key metric to track success in the first 90 days.",
    instructions: "Be specific. Avoid generic frameworks without applying them. Cite real context where possible.",
    inputType: "text",
    inputPlaceholder: "Write your business analysis here...",
    graded_on: [
      { name: "Problem Clarity", points: 20 },
      { name: "Customer Understanding", points: 25 },
      { name: "Solution Design", points: 25 },
      { name: "Risk Identification", points: 15 },
      { name: "Analytical Rigor", points: 15 },
    ],
    gradingPrompt: `You are grading a business analysis submission. Reward specific, evidence-based reasoning grounded in the African market context. Penalize generic MBA frameworks applied without adaptation, or solutions that ignore the reality of informal markets. ${strictJsonInstruction}`,
    estimatedMinutes: 60,
  },

  // ── Data ─────────────────────────────────────────────────────────────────────
  {
    id: "data-analysis-001",
    slug: "data-analysis",
    category: "Data",
    level: "Foundations",
    title: "Data Analysis & Storytelling",
    rubricId: "data-analysis-001",
    passThreshold: 70,
    taskDescription:
      "You have data from EdGrow, a fictional e-learning platform: monthly active users have grown 40% YoY but course completion rate is 18%, average session is 7 minutes, and 60% of dropouts happen at lesson 3. Write an analysis answering: (1) What is the biggest retention problem? (2) What would you investigate next? (3) What single product change would you recommend first, and why?",
    instructions: "Show your reasoning. A recommendation without logic scores low.",
    inputType: "text",
    inputPlaceholder: "Write your data analysis here...",
    graded_on: [
      { name: "Insight Quality", points: 30 },
      { name: "Analytical Reasoning", points: 25 },
      { name: "Problem Prioritisation", points: 20 },
      { name: "Recommendation Clarity", points: 15 },
      { name: "Communication", points: 10 },
    ],
    gradingPrompt: `You are grading a data analysis narrative. Reward non-obvious insights derived from the specific numbers given. Penalize vague conclusions like "users need more engagement" without a causal chain. The recommendation must be specific and testable. ${strictJsonInstruction}`,
    estimatedMinutes: 60,
  },

  // ── Operations ───────────────────────────────────────────────────────────────
  {
    id: "ops-process-001",
    slug: "ops-process-design",
    category: "Operations",
    level: "Foundations",
    title: "Operations & Process Design",
    rubricId: "ops-process-001",
    passThreshold: 70,
    taskDescription:
      "You're the first Operations hire at a 15-person startup. Write a Standard Operating Procedure (SOP) for handling a customer refund request end-to-end — from receipt to resolution. Include: trigger conditions, responsible parties, step-by-step process, decision points, escalation path, and definition of done.",
    instructions: "Write for a 3-person support team. Avoid corporate bureaucracy — keep it lean and usable.",
    inputType: "text",
    inputPlaceholder: "Write your SOP here...",
    graded_on: [
      { name: "Completeness", points: 25 },
      { name: "Clarity & Specificity", points: 25 },
      { name: "Decision Handling", points: 20 },
      { name: "Format & Scannability", points: 15 },
      { name: "Practical Realism", points: 15 },
    ],
    gradingPrompt: `You are grading an operations SOP submission. Reward lean, practical procedures appropriate for a small team. Penalize vague steps, missing decision points, or over-engineered corporate language. The SOP must be actionable without asking follow-up questions. ${strictJsonInstruction}`,
    estimatedMinutes: 45,
  },

  // ── Science ──────────────────────────────────────────────────────────────────
  {
    id: "science-comm-001",
    slug: "science-communication",
    category: "Science",
    level: "Foundations",
    title: "Science Communication",
    rubricId: "science-comm-001",
    passThreshold: 70,
    taskDescription:
      "Explain how mRNA vaccines work to a worried parent with a secondary school education. Your explanation must be scientifically accurate, jargon-free, and directly address the three most common concerns hesitant parents have: (1) the vaccine changes your DNA, (2) it was developed too fast to be safe, (3) the side effects are worse than the disease.",
    instructions: "Accuracy and clarity must both score well. Getting one right without the other is not enough.",
    inputType: "text",
    inputPlaceholder: "Write your explanation here...",
    graded_on: [
      { name: "Scientific Accuracy", points: 30 },
      { name: "Clarity & Accessibility", points: 25 },
      { name: "Concern Addressal", points: 25 },
      { name: "Trust-Building Tone", points: 10 },
      { name: "Structure", points: 10 },
    ],
    gradingPrompt: `You are grading a science communication submission explaining mRNA vaccines to a concerned parent. Check: (1) Is the mechanism scientifically accurate? (2) Is it genuinely accessible at secondary-school level? (3) Are all three named concerns (DNA, speed, side effects) directly and accurately addressed? Penalize condescension, inaccuracy, or dismissal of concerns. ${strictJsonInstruction}`,
    estimatedMinutes: 45,
  },
];

export const assessmentSlugs = new Set(assessments.map((assessment) => assessment.slug));
