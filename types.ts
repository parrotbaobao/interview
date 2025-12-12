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

// Web Speech API Type Definitions
export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}