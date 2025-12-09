
export enum AppView {
  LANDING = 'LANDING',
  ADMIN = 'ADMIN',
  ASSESSMENT = 'ASSESSMENT',
  RESULTS = 'RESULTS'
}

export type DifficultyLevel = 'NOVICE' | 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export interface Candidate {
  email: string;
  accessCode: string; // Derived from email hash for simplicity
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED';
  score?: number;
}

export interface Question {
  id: string;
  hiddenPrompt: string; // The prompt used to generate the target
  targetImageUrl: string;
  difficulty: DifficultyLevel;
  passingThreshold: number; // 0-100
}

export interface AssessmentConfig {
  id: string;
  name: string;
  validFrom: string; // ISO Date
  validTo: string; // ISO Date
  durationMinutes: number;
  candidates: Candidate[];
  questions: Question[];
}

export interface SkillMetrics {
  accuracy: number;        // Visual closeness
  promptEngineering: number; // Structure, keyword usage, parameter knowledge
  creativity: number;      // Problem solving approach
}

export interface AssessmentAnswer {
  questionId: string;
  userPrompt: string;
  generatedImageUrl: string;
  similarityScore: number;
  metrics: SkillMetrics; // Detailed breakdown
  passed: boolean;
  feedback?: string;
  reasoning?: string; // Detailed explanation from AI
}

export interface AssessmentState {
  currentQuestionIndex: number;
  answers: AssessmentAnswer[];
  timeLeft: number;
  isGenerating: boolean;
  error: string | null;
}

export interface ValidationResult {
  score: number; // 0-100
  metrics: SkillMetrics;
  feedback: string;
  passed: boolean;
  reasoning: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault?: boolean;
}
