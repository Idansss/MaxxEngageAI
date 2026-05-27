export type AssessmentConfig = {
  id: string;
  slug: string;
  category: "Technology" | "Writing";
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
    title: "Local Language Translation",
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
];

export const assessmentSlugs = new Set(assessments.map((assessment) => assessment.slug));
