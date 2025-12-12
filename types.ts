export interface FollowUp {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
}

export interface InterviewQuestion {
  id: string;
  category: string;
  question: string;
  difficulty: 'Junior' | 'Mid' | 'Senior' | 'Expert';
  source: 'tech' | 'project'; // Distinguish question source
  answer?: string; // AI generated feedback/answer
  userAnswer?: string; // User's input
  isAnswerLoading?: boolean;
  followUps?: FollowUp[];
  isFollowUpLoading?: boolean;
}

export interface InterviewSession {
  id: string;
  timestamp: number;
  selectedStacks: TechStack[];
  projectDescription: string;
  questions: InterviewQuestion[];
}

export enum TechStack {
  JavaScript = 'JavaScript',
  TypeScript = 'TypeScript',
  React = 'React',
  Vue = 'Vue',
  Angular = 'Angular',
  NextJS = 'Next.js',
  NodeJS = 'Node.js',
  CSS_HTML = 'CSS/HTML',
  Performance = 'Web Performance',
  Security = 'Web Security'
}

export interface GeneratorState {
  selectedStacks: TechStack[];
  projectDescription: string;
  questions: InterviewQuestion[];
  isGenerating: boolean;
  error: string | null;
  history: InterviewSession[];
  isHistoryOpen: boolean;
  questionCount: number;
  currentSessionId?: string;
}