import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TechSelect } from './components/TechSelect';
import { QuestionCard } from './components/QuestionCard';
import { TechStack, InterviewQuestion, GeneratorState, InterviewSession, FollowUp } from './types';
import { generateQuestions, generateAnswer, generateFollowUp } from './services/geminiService';
import { SparklesIcon, LoaderIcon, HistoryIcon, XIcon, TrashIcon, ArrowLeftIcon, ArrowRightIcon, RefreshIcon } from './components/Icons';

type ViewMode = 'setup' | 'interview';

function App() {
  const [state, setState] = useState<GeneratorState>({
    selectedStacks: [],
    projectDescription: '',
    questions: [],
    isGenerating: false,
    error: null,
    history: [],
    isHistoryOpen: false,
    questionCount: 5,
    currentSessionId: undefined,
  });

  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<TechStack | 'All'>('All');

  // Load history from local storage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('interview-copilot-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setState(prev => ({ ...prev, history: parsed }));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Persist history to local storage whenever it changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
        if (state.history.length > 0) {
            localStorage.setItem('interview-copilot-history', JSON.stringify(state.history));
        }
    }, 1000); // Debounce for 1 second to avoid excessive writes
    return () => clearTimeout(timeoutId);
  }, [state.history]);

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => ({ 
        ...prev, 
        history: prev.history.filter(h => h.id !== id) 
    }));
  };

  const loadHistoryItem = (session: InterviewSession) => {
      setState(prev => ({
          ...prev,
          selectedStacks: session.selectedStacks,
          projectDescription: session.projectDescription,
          questions: session.questions,
          isHistoryOpen: false,
          currentSessionId: session.id
      }));
      // Start interview mode immediately with loaded questions
      setCurrentQuestionIndex(0);
      setViewMode('interview');
  };

  const handleToggleStack = (stack: TechStack) => {
    setState(prev => {
      const exists = prev.selectedStacks.includes(stack);
      const newStacks = exists 
        ? prev.selectedStacks.filter(s => s !== stack)
        : [...prev.selectedStacks, stack];
      return { ...prev, selectedStacks: newStacks };
    });
  };

  const handleGenerate = async () => {
    // Relaxed validation
    if (state.selectedStacks.length === 0 && state.projectDescription.trim().length < 5) {
      setState(prev => ({ ...prev, error: "请选择技术栈或填写项目描述。" }));
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null, questions: [] }));

    try {
      const questions = await generateQuestions(
        state.selectedStacks, 
        state.projectDescription,
        state.questionCount
      );
      
      const newSession: InterviewSession = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          selectedStacks: state.selectedStacks,
          projectDescription: state.projectDescription,
          questions: questions
      };

      setState(prev => ({ 
          ...prev, 
          questions, 
          isGenerating: false, 
          currentSessionId: newSession.id,
          history: [newSession, ...prev.history]
      }));
      
      setCurrentQuestionIndex(0);
      setViewMode('interview');

    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        error: "生成题目失败，请检查网络连接或重试。" 
      }));
    }
  };

  const syncWithHistory = (prev: GeneratorState, updatedQuestions: InterviewQuestion[]) => {
      let updatedHistory = prev.history;
      if (prev.currentSessionId) {
          updatedHistory = prev.history.map(session => 
              session.id === prev.currentSessionId 
                  ? { ...session, questions: updatedQuestions }
                  : session
          );
      }
      return { ...prev, questions: updatedQuestions, history: updatedHistory };
  };

  const handleUpdateUserAnswer = (questionId: string, text: string) => {
      setState(prev => {
          const updatedQuestions = prev.questions.map(q => 
              q.id === questionId ? { ...q, userAnswer: text } : q
          );
          return syncWithHistory(prev, updatedQuestions);
      });
  };

  const handleGetAnswer = async (questionId: string, userAnswer: string) => {
    const questionObj = state.questions.find(q => q.id === questionId);
    if (!questionObj) return;

    setState(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, isAnswerLoading: true } : q
      )
    }));

    try {
      const answer = await generateAnswer(
        questionObj.question,
        state.selectedStacks,
        state.projectDescription,
        userAnswer
      );

      setState(prev => {
        const updatedQuestions = prev.questions.map(q => 
            q.id === questionId ? { ...q, answer, isAnswerLoading: false } : q
        );
        return syncWithHistory(prev, updatedQuestions);
      });

    } catch (err) {
      setState(prev => ({
        ...prev,
        questions: prev.questions.map(q => 
          q.id === questionId ? { ...q, isAnswerLoading: false } : q
        )
      }));
    }
  };

  const handleAskFollowUp = async (questionId: string, followUpQuestion: string) => {
      const questionObj = state.questions.find(q => q.id === questionId);
      if (!questionObj) return;

      // Set loading state for follow up
      setState(prev => ({
          ...prev,
          questions: prev.questions.map(q =>
              q.id === questionId ? { ...q, isFollowUpLoading: true } : q
          )
      }));

      try {
          const followUpAnswer = await generateFollowUp(
              questionObj.question,
              state.selectedStacks,
              state.projectDescription,
              questionObj.userAnswer,
              questionObj.answer,
              followUpQuestion,
              questionObj.followUps || []
          );

          const newFollowUp: FollowUp = {
              id: Date.now().toString(),
              question: followUpQuestion,
              answer: followUpAnswer,
              timestamp: Date.now()
          };

          setState(prev => {
              const updatedQuestions = prev.questions.map(q => 
                  q.id === questionId ? { 
                      ...q, 
                      isFollowUpLoading: false,
                      followUps: [...(q.followUps || []), newFollowUp]
                  } : q
              );
              return syncWithHistory(prev, updatedQuestions);
          });

      } catch (err) {
          setState(prev => ({
              ...prev,
              questions: prev.questions.map(q =>
                  q.id === questionId ? { ...q, isFollowUpLoading: false } : q
              )
          }));
          alert("追问失败，请重试。");
      }
  };

  // Filter history
  const filteredHistory = useMemo(() => {
      if (historyFilter === 'All') return state.history;
      return state.history.filter(h => h.selectedStacks.includes(historyFilter));
  }, [state.history, historyFilter]);

  const historyStacks = useMemo(() => {
      const stacks = new Set<TechStack>();
      state.history.forEach(h => h.selectedStacks.forEach(s => stacks.add(s)));
      return Array.from(stacks);
  }, [state.history]);

  // Navigation Logic
  const handleNext = () => {
    if (currentQuestionIndex < state.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleExitInterview = () => {
      // Direct exit without confirmation dialog to ensure reliability
      setViewMode('setup');
  };

  return (
    <div className="h-dvh bg-slate-50 flex flex-col font-sans overflow-hidden">
      
      {/* Container for mobile-app feel: Centered max-width on desktop, full on mobile */}
      <div className="flex flex-col h-full w-full max-w-lg mx-auto bg-white shadow-2xl overflow-hidden relative">

        {/* Header */}
        <header className="flex-none bg-white border-b border-slate-100 px-4 h-14 flex items-center justify-between z-10">
          {viewMode === 'setup' ? (
             <>
                <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-md">
                    <SparklesIcon className="w-4 h-4 text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-slate-800">
                    前端 Copilot
                    </h1>
                </div>
                <button
                    onClick={() => setState(prev => ({ ...prev, isHistoryOpen: true }))}
                    className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-all"
                >
                    <HistoryIcon className="w-5 h-5" />
                </button>
             </>
          ) : (
            <>
                <div className="flex-1 flex justify-start">
                    <button 
                        onClick={handleExitInterview}
                        className="flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium p-2 -ml-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> 退出
                    </button>
                </div>
                <div className="text-sm font-bold text-slate-800 flex-none">
                    题目 {currentQuestionIndex + 1} / {state.questions.length}
                </div>
                <div className="flex-1"></div> {/* Spacer for center alignment */}
            </>
          )}
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto relative bg-slate-50">
          
          {viewMode === 'setup' ? (
              <div className="p-5 pb-24 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Setup Form */}
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-6">
                    <TechSelect 
                        selected={state.selectedStacks} 
                        onToggle={handleToggleStack} 
                    />

                    <div>
                        <div className="flex justify-between items-center mb-3">
                             <label className="text-sm font-semibold text-slate-700">
                                2. 题目数量
                            </label>
                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                                {state.questionCount} 题
                            </span>
                        </div>
                        <input 
                            type="range" 
                            min="3" 
                            max="10" 
                            value={state.questionCount} 
                            onChange={(e) => setState(prev => ({ ...prev, questionCount: parseInt(e.target.value) }))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                            3. 项目背景 <span className="text-slate-400 font-normal text-xs">(可选)</span>
                        </label>
                        <textarea
                            value={state.projectDescription}
                            onChange={(e) => setState(prev => ({ ...prev, projectDescription: e.target.value }))}
                            placeholder="描述你的项目难点，例如：'后台管理系统，百万级数据渲染性能优化...'"
                            className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-slate-700 placeholder-slate-400 text-sm"
                        />
                    </div>
                  </div>

                   {state.error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        {state.error}
                        </div>
                    )}
              </div>
          ) : (
              <div className="h-full p-4 flex flex-col">
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 h-1 rounded-full mb-4 overflow-hidden flex-none">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300 ease-out"
                        style={{ width: `${((currentQuestionIndex + 1) / state.questions.length) * 100}%` }}
                      />
                  </div>
                  
                  {/* Current Question Card */}
                  <QuestionCard 
                    key={state.questions[currentQuestionIndex].id}
                    question={state.questions[currentQuestionIndex]}
                    onGetAnswer={handleGetAnswer}
                    onUpdateUserAnswer={handleUpdateUserAnswer}
                    onAskFollowUp={handleAskFollowUp}
                    className="flex-1"
                  />
              </div>
          )}
        </main>

        {/* Footer / Controls */}
        <div className="flex-none bg-white border-t border-slate-100 p-4 pb-6 z-20">
             {viewMode === 'setup' ? (
                 <button
                    onClick={handleGenerate}
                    disabled={state.isGenerating}
                    className={`
                    w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 text-lg
                    transition-all duration-200 flex items-center justify-center gap-2
                    ${state.isGenerating 
                        ? 'bg-indigo-400 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'
                    }
                    `}
                >
                    {state.isGenerating ? (
                    <>
                        <LoaderIcon className="w-5 h-5 animate-spin" />
                        生成中...
                    </>
                    ) : (
                    <>
                        <SparklesIcon className="w-5 h-5" />
                        开始模拟面试
                    </>
                    )}
                </button>
             ) : (
                 <div className="grid grid-cols-2 gap-4">
                     <button 
                        onClick={handlePrev}
                        disabled={currentQuestionIndex === 0}
                        className="py-3 rounded-xl font-semibold border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center justify-center gap-2"
                     >
                         <ArrowLeftIcon className="w-5 h-5" /> 上一题
                     </button>
                     <button 
                        onClick={handleNext}
                        disabled={currentQuestionIndex === state.questions.length - 1}
                        className="py-3 rounded-xl font-semibold bg-indigo-600 text-white shadow-md shadow-indigo-100 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none hover:bg-indigo-700 flex items-center justify-center gap-2"
                     >
                         下一题 <ArrowRightIcon className="w-5 h-5" />
                     </button>
                 </div>
             )}
        </div>

        {/* History Modal (Overlay) */}
        {state.isHistoryOpen && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col animate-in slide-in-from-right duration-300">
                 <div className="flex-none p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                        <HistoryIcon className="w-5 h-5 text-indigo-600" />
                        面试记录
                    </h2>
                    <button 
                        onClick={() => setState(prev => ({ ...prev, isHistoryOpen: false }))}
                        className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                    >
                        <XIcon className="w-5 h-5 text-slate-600" />
                    </button>
                </div>
                 
                 {/* Filter Bar */}
                 {historyStacks.length > 0 && (
                    <div className="flex-none p-3 border-b border-slate-50 flex gap-2 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => setHistoryFilter('All')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-colors ${
                                historyFilter === 'All' 
                                ? 'bg-slate-800 text-white border-slate-800' 
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                        >
                            全部
                        </button>
                        {historyStacks.map(stack => (
                            <button
                                key={stack}
                                onClick={() => setHistoryFilter(stack)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border transition-colors ${
                                    historyFilter === stack 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}
                            >
                                {stack}
                            </button>
                        ))}
                    </div>
                 )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                     {filteredHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                             <HistoryIcon className="w-12 h-12 mb-3 opacity-20" />
                             <p>暂无相关记录</p>
                        </div>
                     ) : (
                        filteredHistory.map((session) => (
                            <div 
                                key={session.id}
                                onClick={() => loadHistoryItem(session)}
                                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-medium text-slate-400">
                                        {new Date(session.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <button
                                        onClick={(e) => deleteHistoryItem(session.id, e)}
                                        className="text-slate-300 hover:text-red-500 p-1 -mr-1"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-2">
                                    {session.selectedStacks.slice(0, 3).map(s => (
                                        <span key={s} className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 font-medium">
                                            {s}
                                        </span>
                                    ))}
                                     {session.selectedStacks.length > 3 && (
                                       <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">+{session.selectedStacks.length - 3}</span>
                                     )}
                                </div>
                                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                    {session.projectDescription || "无项目描述"}
                                </p>
                                <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
                                    <span>{session.questions.length} 道题目</span>
                                    <span className="text-indigo-600 font-medium flex items-center gap-1">
                                        继续练习 <ArrowRightIcon className="w-3 h-3" />
                                    </span>
                                </div>
                            </div>
                        ))
                     )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

export default App;