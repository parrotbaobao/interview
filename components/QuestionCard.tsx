import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { InterviewQuestion, SpeechRecognition, SpeechRecognitionEvent } from '../types';
import { BrainIcon, LoaderIcon, MicIcon, StopIcon, SendIcon, ChevronDownIcon, CodeIcon } from './Icons';

// Custom wrapper for code blocks to make them collapsible
const CollapsiblePre = ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => {
  return (
    <details className="my-4 group bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-sm">
      <summary className="px-4 py-2.5 bg-slate-800 text-slate-300 text-xs font-mono uppercase cursor-pointer hover:bg-slate-700 flex items-center justify-between select-none transition-colors">
        <div className="flex items-center gap-2">
            <CodeIcon className="w-4 h-4 text-indigo-400" />
            <span>查看代码示例 / View Code</span>
        </div>
        <div className="group-open:rotate-180 transition-transform duration-200">
             <ChevronDownIcon className="w-4 h-4" />
        </div>
      </summary>
      <div className="p-4 overflow-x-auto bg-[#0d1117] text-gray-100">
         <pre {...props} className="!bg-transparent !p-0 !m-0 !font-mono text-sm">
            {children}
         </pre>
      </div>
    </details>
  );
};

// Markdown components mapping
const markdownComponents = {
    pre: CollapsiblePre
};

// Sub-component for Typewriter Effect
const TypewriterMarkdown = ({ text, onScroll }: { text: string, onScroll: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let currentIndex = 0;
    // Faster typing speed for better UX (approx 30-40ms per chunk)
    const intervalId = setInterval(() => {
      if (currentIndex >= text.length) {
        clearInterval(intervalId);
        return;
      }
      
      // Reveal 2-3 characters at a time to prevent it from being too slow on long text
      const step = 3; 
      currentIndex = Math.min(currentIndex + step, text.length);
      setDisplayedText(text.slice(0, currentIndex));
      onScroll();
    }, 20);

    return () => clearInterval(intervalId);
  }, [text, onScroll]);

  return <ReactMarkdown components={markdownComponents}>{displayedText}</ReactMarkdown>;
};

interface QuestionCardProps {
  question: InterviewQuestion;
  onGetAnswer: (id: string, userAnswer: string) => void;
  onUpdateUserAnswer: (id: string, text: string) => void;
  onAskFollowUp: (id: string, followUp: string) => void;
  className?: string;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, onGetAnswer, onUpdateUserAnswer, onAskFollowUp, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  
  // Track initial follow-ups to avoid animating history
  // When component mounts, we capture existing IDs. Any ID not in this set is "new" and will be animated.
  const initialFollowUpIds = useRef(new Set(question.followUps?.map(f => f.id) || []));

  const difficultyColors = {
    'Junior': 'bg-green-100 text-green-700 border-green-200',
    'Mid': 'bg-blue-100 text-blue-700 border-blue-200',
    'Senior': 'bg-orange-100 text-orange-700 border-orange-200',
    'Expert': 'bg-red-100 text-red-700 border-red-200',
  };

  const sourceBadge = question.source === 'tech' 
    ? 'bg-blue-50 text-blue-600 border-blue-100' 
    : 'bg-purple-50 text-purple-600 border-purple-100';

  const sourceText = question.source === 'tech' ? '技术栈考察' : '项目实战';

  // Open feedback automatically if answer exists
  useEffect(() => {
    if (question.answer) {
      setIsOpen(true);
    } else {
        setIsOpen(false);
    }
  }, [question.answer, question.id]);

  useEffect(() => {
    // Cleanup recognition on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Use useCallback to maintain reference stability for TypewriterMarkdown dependency
  const scrollToBottom = useCallback(() => {
    // Use 'smooth' for better visuals, or 'auto' for strict sticking
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  // Initial scroll when opening answered question
  useEffect(() => {
      if (question.followUps && question.followUps.length > 0) {
          scrollToBottom();
      }
  }, [question.followUps?.length, scrollToBottom]); 

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("您的浏览器不支持语音识别，请使用 Chrome 或 Edge。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        onUpdateUserAnswer(question.id, (question.userAnswer || '') + finalTranscript);
      }
    };

    recognition.onerror = (event: Event) => {
      console.error("Speech recognition error", event);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleGetFeedback = () => {
     if (isOpen && question.answer && !question.followUps?.length) {
       setIsOpen(false);
       return;
     }

     if (!question.answer && !question.isAnswerLoading) {
        onGetAnswer(question.id, question.userAnswer || '');
      }
      
      if (question.answer) {
          setIsOpen(!isOpen);
      }
  };

  const handleSendFollowUp = () => {
      if (!followUpText.trim()) return;
      onAskFollowUp(question.id, followUpText);
      setFollowUpText('');
      // Force scroll to bottom immediately to show user's question
      setTimeout(scrollToBottom, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendFollowUp();
      }
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scroll-smooth">
        
        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${difficultyColors[question.difficulty]}`}>
            {question.difficulty}
          </span>
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${sourceBadge}`}>
            {sourceText}
          </span>
          <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full border border-slate-200">
            {question.category}
          </span>
        </div>

        {/* Question Title */}
        <h3 className="text-xl font-bold text-slate-900 leading-snug mb-6">
          {question.question}
        </h3>

        {/* User Answer Display (Post-submission) */}
        {question.answer && (
            <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-1">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    我的回答
                </h4>
                <div className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">
                    {question.userAnswer ? question.userAnswer : <span className="text-slate-400 italic">（未提供回答，仅查看解析）</span>}
                </div>
            </div>
        )}

        {/* AI Answer Section */}
        {isOpen && question.answer && (
          <div className="mb-6 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-300">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                <BrainIcon className="w-4 h-4" /> AI 建议与点评
            </h4>
            <div className="prose prose-sm prose-indigo text-slate-700 max-w-none">
              <ReactMarkdown components={markdownComponents}>{question.answer}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Input Area (Only show if not answered yet) */}
        {!question.answer && (
            <div className="relative mb-2">
                <textarea 
                    value={question.userAnswer || ''}
                    onChange={(e) => onUpdateUserAnswer(question.id, e.target.value)}
                    placeholder="在此输入您的回答 (支持语音输入)..."
                    className="w-full p-4 pb-12 text-base border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[160px] bg-slate-50 text-slate-800 placeholder:text-slate-400 resize-none"
                />
                <button 
                    type="button"
                    onClick={toggleListening}
                    className={`absolute bottom-3 right-3 p-3 rounded-full transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600'}`}
                    title={isListening ? "停止录音" : "开始语音回答"}
                >
                    {isListening ? <StopIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
                </button>
            </div>
        )}
        
        {/* Action Button (Analyze) - Hide if already answered */}
        {!question.answer && (
            <button
                type="button"
                onClick={handleGetFeedback}
                disabled={question.isAnswerLoading}
                className={`w-full py-3.5 rounded-xl font-semibold text-white shadow-md transition-all flex items-center justify-center gap-2 mb-2
                    ${question.isAnswerLoading 
                        ? 'bg-indigo-300 cursor-wait' 
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }
                `}
            >
                {question.isAnswerLoading ? (
                <>
                    <LoaderIcon className="w-5 h-5 animate-spin" />
                    正在分析...
                </>
                ) : (
                <>
                    <BrainIcon className="w-5 h-5" />
                    提交回答并分析
                </>
                )}
            </button>
        )}

        {/* Follow Up Section */}
        {question.answer && isOpen && (
            <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    追问 / 深入探讨
                </h4>
                
                {/* Chat History */}
                <div className="space-y-6 mb-4">
                    {/* Follow Ups */}
                    {question.followUps?.map((fp) => {
                        const isHistory = initialFollowUpIds.current.has(fp.id);
                        return (
                          <React.Fragment key={fp.id}>
                               <div className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-2">
                                  <div className="bg-slate-100 text-slate-800 px-4 py-2 rounded-2xl rounded-tr-none max-w-[90%] text-sm">
                                      {fp.question}
                                  </div>
                              </div>
                              <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2">
                                  <div className="bg-indigo-50 text-slate-800 px-4 py-3 rounded-2xl rounded-tl-none max-w-[95%] text-sm prose prose-sm prose-indigo">
                                      {isHistory ? (
                                        <ReactMarkdown components={markdownComponents}>{fp.answer}</ReactMarkdown>
                                      ) : (
                                        <TypewriterMarkdown text={fp.answer} onScroll={scrollToBottom} />
                                      )}
                                  </div>
                              </div>
                          </React.Fragment>
                        );
                    })}
                     
                     {question.isFollowUpLoading && (
                         <div className="flex flex-col items-start animate-pulse">
                            <div className="bg-indigo-50/50 px-4 py-3 rounded-2xl rounded-tl-none w-24 h-10 flex items-center justify-center">
                                <div className="flex space-x-1">
                                    <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                         </div>
                     )}
                     <div ref={scrollEndRef} />
                </div>

                {/* Input for Follow Up */}
                <div className="flex items-center gap-2 mt-4">
                    <input 
                        type="text" 
                        value={followUpText}
                        onChange={(e) => setFollowUpText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="继续追问..."
                        className="flex-1 px-4 py-3 rounded-full border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 text-sm outline-none"
                    />
                    <button 
                        type="button"
                        onClick={handleSendFollowUp}
                        disabled={question.isFollowUpLoading || !followUpText.trim()}
                        className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-md transition-colors"
                    >
                        <SendIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};