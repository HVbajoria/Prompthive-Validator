import React, { useState, useEffect, useCallback } from 'react';
import { AssessmentConfig, AssessmentState, Candidate, Question, AssessmentAnswer, ValidationResult } from '../types';
import { generateImage, evaluateSimilarity } from '../services/geminiService';
import { Loader2, Terminal, RefreshCw, Send, CheckCircle, XCircle, Timer, Info, HelpCircle, History, ScanEye, Eye, Image as ImageIcon, Layers, SkipForward, ChevronRight, AlertOctagon } from 'lucide-react';
import Tooltip from './Tooltip';

interface VibeAssessmentProps {
  config: AssessmentConfig;
  candidate: Candidate;
  onComplete: (results: { score: number, answers: AssessmentAnswer[] }) => void;
}

interface HistoryEntry {
    timestamp: string;
    prompt: string;
    status: 'SUCCESS' | 'FAILURE' | 'SKIPPED';
    level: number;
}

const VibeAssessment: React.FC<VibeAssessmentProps> = ({ config, candidate, onComplete }) => {
  // Config
  const MAX_SKIPS = config.questions.length; // Allow skipping all questions if needed

  // Game State
  const [state, setState] = useState<AssessmentState>({
    currentQuestionIndex: 0,
    answers: [],
    timeLeft: config.durationMinutes * 60,
    isGenerating: false,
    error: null
  });

  const [promptInput, setPromptInput] = useState('');
  const [lastEvaluation, setLastEvaluation] = useState<ValidationResult | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [skipsUsed, setSkipsUsed] = useState(0);
  
  // Visual Analysis State
  const [lastAttemptImage, setLastAttemptImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'TARGET' | 'GENERATED' | 'DIFF'>('TARGET');

  // Timer
  useEffect(() => {
    if (showInstructions) return;

    const timer = setInterval(() => {
      setState(prev => {
        if (prev.timeLeft <= 0) {
          clearInterval(timer);
          finishAssessment(prev);
          return prev;
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInstructions]);

  const finishAssessment = (finalState: AssessmentState) => {
    const passedCount = finalState.answers.filter(a => a.passed).length;
    const score = config.questions.length > 0 ? Math.round((passedCount / config.questions.length) * 100) : 0;
    onComplete({ score, answers: finalState.answers });
  };

  const handleSkip = () => {
    if (skipsUsed >= MAX_SKIPS) return;

    const currentQ = config.questions[state.currentQuestionIndex];
    
    // Create a failed answer for the skipped question
    const skippedAnswer: AssessmentAnswer = {
        questionId: currentQ.id,
        userPrompt: "SKIPPED",
        generatedImageUrl: "", 
        similarityScore: 0,
        metrics: { accuracy: 0, promptEngineering: 0, creativity: 0 },
        passed: false,
        feedback: "Level skipped by candidate override.",
        reasoning: "Candidate chose to skip this challenge."
    };

    // Record History
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory(prev => [{
        timestamp,
        prompt: "SKIPPED BY USER",
        status: 'SKIPPED',
        level: state.currentQuestionIndex + 1
    }, ...prev]);

    const nextIndex = state.currentQuestionIndex + 1;
    const isFinished = nextIndex >= config.questions.length;

    const nextState = {
        ...state,
        currentQuestionIndex: isFinished ? state.currentQuestionIndex : nextIndex,
        answers: [...state.answers, skippedAnswer],
        isGenerating: false,
        error: null
    };

    setState(nextState);
    setSkipsUsed(prev => prev + 1);
    setPromptInput('');
    setLastAttemptImage(null);
    setViewMode('TARGET');
    setLastEvaluation(null);

    if (isFinished) {
        finishAssessment(nextState);
    }
  };

  const handleGenerateAndCheck = async () => {
    if (!promptInput.trim()) return;

    setIsButtonPressed(true);
    setTimeout(() => setIsButtonPressed(false), 200);

    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    setLastEvaluation(null);
    setLastAttemptImage(null); 
    setViewMode('GENERATED'); // Switch to view generated image when it arrives

    try {
      const currentQ = config.questions[state.currentQuestionIndex];

      // 1. Generate User Image
      const generatedImage = await generateImage(promptInput);
      setLastAttemptImage(generatedImage);

      // 2. Evaluate Match
      const evaluation = await evaluateSimilarity(
        currentQ.targetImageUrl,
        generatedImage,
        currentQ.hiddenPrompt,
        promptInput,
        currentQ.passingThreshold // Pass the specific threshold
      );

      const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory(prev => [{
          timestamp,
          prompt: promptInput,
          status: evaluation.passed ? 'SUCCESS' : 'FAILURE',
          level: state.currentQuestionIndex + 1
      }, ...prev]);

      setLastEvaluation(evaluation);

      // 3. Update State
      if (evaluation.passed) {
        setIsSuccess(true);

        const newAnswer: AssessmentAnswer = {
          questionId: currentQ.id,
          userPrompt: promptInput,
          generatedImageUrl: generatedImage,
          similarityScore: evaluation.score,
          metrics: evaluation.metrics,
          passed: true,
          feedback: evaluation.feedback,
          reasoning: evaluation.reasoning
        };

        // Delay to show success animation
        setTimeout(() => {
            setState(prev => {
                const nextIndex = prev.currentQuestionIndex + 1;
                const isFinished = nextIndex >= config.questions.length;

                const nextState = {
                    ...prev,
                    currentQuestionIndex: isFinished ? prev.currentQuestionIndex : nextIndex,
                    answers: [...prev.answers, newAnswer],
                    isGenerating: false,
                };

                if (isFinished) {
                    finishAssessment(nextState);
                }
                return nextState;
            });

            setPromptInput('');
            setLastAttemptImage(null);
            setViewMode('TARGET');
            setIsSuccess(false);
            setLastEvaluation(null);
        }, 1500);

      } else {
        setState(prev => ({ ...prev, isGenerating: false }));
        setViewMode('DIFF'); 
      }

    } catch (err) {
      setState(prev => ({ ...prev, isGenerating: false, error: "System jam. Try again." }));
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = config.questions[state.currentQuestionIndex];
  const progressPercent = ((state.currentQuestionIndex) / config.questions.length) * 100;

  // Handle case where questions might be empty or index out of bounds
  if (!currentQuestion) {
      return <div className="p-8 text-center text-zinc-500">No questions available.</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      
      {/* CSS for Diff Animation */}
      <style>{`
        @keyframes difference-pulse {
            0%, 100% { filter: brightness(1) saturate(100%); }
            50% { filter: brightness(2.0) saturate(300%); }
        }
      `}</style>

      {/* Instructions Overlay */}
      {showInstructions && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 p-8 max-w-2xl w-full rounded-2xl shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-zinc-800 rounded-xl">
                        <ScanEye className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Assessment Briefing</h2>
                        <p className="text-zinc-400 text-sm">GenAI Prompt Engineering Evaluation</p>
                    </div>
                </div>
                
                <div className="space-y-6 text-zinc-300">
                    <div className="space-y-2">
                        <strong className="text-white block">Objective</strong>
                        <p>Reverse-engineer the prompts used to generate the displayed Target Images. Your goal is to recreate the visual style, composition, and subject matter.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <strong className="block text-indigo-400 mb-2">1. Analyze</strong>
                            Observe lighting, style (e.g., photorealistic, 3D render), and key elements.
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <strong className="block text-indigo-400 mb-2">2. Iterate</strong>
                            Input your prompt. The AI Judge will evaluate accuracy, technique, and creativity.
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <strong className="block text-indigo-400 mb-2">3. Refine</strong>
                            If you fail, use the feedback to adjust your parameters and try again.
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => setShowInstructions(false)}
                    className="mt-8 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-lg transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                    Start Assessment <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4">
             <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Terminal className="w-4 h-4 text-white" />
             </div>
             <div>
                <h1 className="text-sm font-bold text-white tracking-wide">{config.name}</h1>
                <span className="text-xs text-zinc-500">{candidate.email}</span>
             </div>
        </div>
        
        <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
                <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Time Remaining</div>
                <Tooltip content="Time until assessment auto-submits">
                    <div className={`font-mono text-lg font-bold ${state.timeLeft < 300 ? 'text-red-400 animate-pulse' : 'text-zinc-200'}`}>
                        {formatTime(state.timeLeft)}
                    </div>
                </Tooltip>
            </div>
            <Tooltip content="View Instructions" position="left">
                <button onClick={() => setShowInstructions(true)} className="p-2 hover:bg-zinc-800 rounded-full transition text-zinc-400">
                    <HelpCircle className="w-5 h-5" />
                </button>
            </Tooltip>
        </div>
      </header>
      
      {/* Progress Bar */}
      <div className="w-full bg-zinc-900 h-1">
        <div className="h-full bg-indigo-500 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div>
      </div>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Visualization (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 flex flex-col h-[500px] lg:h-[600px] relative shadow-xl">
                {/* Image Viewport */}
                <div className="flex-1 bg-zinc-950 rounded-xl overflow-hidden relative border border-zinc-800/50">
                    <div className="absolute inset-0 flex items-center justify-center">
                        {viewMode === 'TARGET' && (
                            <img src={currentQuestion.targetImageUrl} alt="Target" className="w-full h-full object-contain" />
                        )}
                        {viewMode === 'GENERATED' && lastAttemptImage && (
                            <img src={lastAttemptImage} alt="Attempt" className="w-full h-full object-contain" />
                        )}
                        {viewMode === 'DIFF' && lastAttemptImage && (
                             <div className="w-full h-full relative">
                                <img src={lastAttemptImage} className="absolute inset-0 w-full h-full object-contain" alt="Gen" />
                                <img 
                                    src={currentQuestion.targetImageUrl} 
                                    className="absolute inset-0 w-full h-full object-contain" 
                                    style={{ mixBlendMode: 'difference', animation: 'difference-pulse 2s infinite' }}
                                    alt="Target" 
                                />
                             </div>
                        )}
                         {!lastAttemptImage && viewMode !== 'TARGET' && (
                             <div className="text-zinc-600 flex flex-col items-center">
                                 <AlertOctagon className="w-12 h-12 mb-2 opacity-50" />
                                 <p>No image generated yet</p>
                             </div>
                         )}
                    </div>

                    {/* Image Controls */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur border border-zinc-700 rounded-full p-1 flex gap-1 z-10 shadow-lg">
                        <Tooltip content="Show Target">
                            <button 
                                onClick={() => setViewMode('TARGET')}
                                className={`p-2 rounded-full transition ${viewMode === 'TARGET' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="Show Generated">
                            <button 
                                onClick={() => setViewMode('GENERATED')}
                                disabled={!lastAttemptImage}
                                className={`p-2 rounded-full transition ${viewMode === 'GENERATED' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white disabled:opacity-30'}`}
                            >
                                <ImageIcon className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip content="Show Difference">
                            <button 
                                onClick={() => setViewMode('DIFF')}
                                disabled={!lastAttemptImage}
                                className={`p-2 rounded-full transition ${viewMode === 'DIFF' ? 'bg-zinc-700 text-red-400' : 'text-zinc-400 hover:text-white disabled:opacity-30'}`}
                            >
                                <Layers className="w-4 h-4" />
                            </button>
                        </Tooltip>
                    </div>

                    {/* Success Overlay */}
                    {isSuccess && (
                        <div className="absolute inset-0 bg-green-900/20 backdrop-blur-sm flex items-center justify-center animate-fade-in z-20">
                            <div className="bg-green-500 text-white p-6 rounded-full shadow-2xl transform scale-125">
                                <CheckCircle className="w-16 h-16" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Right: Controls (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-[500px] lg:h-[600px]">
            
            {/* Level Info */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex justify-between items-center">
                <div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Current Level</h3>
                    <div className="text-xl font-bold text-white flex items-center gap-2">
                        Level {state.currentQuestionIndex + 1}
                        <span className="text-sm font-normal text-zinc-600">/ {config.questions.length}</span>
                    </div>
                </div>
                <div className="text-right">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Difficulty</h3>
                     <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                         currentQuestion.difficulty === 'EXPERT' ? 'bg-purple-900/30 text-purple-400' : 
                         currentQuestion.difficulty === 'HARD' ? 'bg-red-900/30 text-red-400' : 
                         'bg-amber-900/30 text-amber-400'
                     }`}>
                         {currentQuestion.difficulty}
                     </span>
                </div>
            </div>

            {/* Prompt Input */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex-1 flex flex-col relative group focus-within:border-indigo-500/50 transition-colors">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 opacity-0 group-focus-within:opacity-100 transition-opacity rounded-t-xl"></div>
                 <textarea 
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    disabled={state.isGenerating || isSuccess}
                    placeholder="Describe the image to reverse-engineer it..."
                    className="w-full h-full bg-zinc-950/50 rounded-lg p-4 text-zinc-200 placeholder:text-zinc-600 resize-none outline-none font-mono text-sm leading-relaxed"
                 />
                 
                 {/* Action Bar */}
                 <div className="p-3 flex justify-between items-center border-t border-zinc-800">
                     <Tooltip content="Skip to next level (Penalty applied)">
                        <button 
                            onClick={handleSkip}
                            disabled={state.isGenerating || skipsUsed >= MAX_SKIPS}
                            className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-medium px-2 py-1 rounded hover:bg-zinc-800 transition"
                        >
                            <SkipForward className="w-3 h-3" /> Skip ({skipsUsed}/{MAX_SKIPS})
                        </button>
                     </Tooltip>

                     <button 
                        onClick={handleGenerateAndCheck}
                        disabled={state.isGenerating || !promptInput.trim() || isSuccess}
                        className={`
                            relative overflow-hidden px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-all transform active:scale-95 flex items-center gap-2
                            ${!promptInput.trim() ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'}
                        `}
                     >
                        {state.isGenerating ? (
                            <> <Loader2 className="animate-spin w-4 h-4" /> Processing </>
                        ) : (
                            <> <Send className="w-4 h-4" /> Submit Prompt </>
                        )}
                     </button>
                 </div>
            </div>

            {/* Console / Feedback */}
            <div className="bg-black border border-zinc-800 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs shadow-inner">
                {lastEvaluation ? (
                    <div className="space-y-3 animate-fade-in">
                        <div className={`flex items-center gap-2 font-bold ${lastEvaluation.passed ? 'text-green-400' : 'text-red-400'}`}>
                            {lastEvaluation.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span>{lastEvaluation.passed ? 'TARGET ACQUIRED' : 'MISMATCH DETECTED'}</span>
                            <span className="ml-auto opacity-75">{lastEvaluation.score}% Match</span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed border-l-2 border-zinc-700 pl-2">
                            {lastEvaluation.feedback}
                        </p>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <div className="bg-zinc-900 p-2 rounded text-center">
                                <div className="text-zinc-500 text-[10px] uppercase">Accuracy</div>
                                <div className="text-zinc-200 font-bold">{lastEvaluation.metrics.accuracy}</div>
                            </div>
                            <div className="bg-zinc-900 p-2 rounded text-center">
                                <div className="text-zinc-500 text-[10px] uppercase">Tech</div>
                                <div className="text-zinc-200 font-bold">{lastEvaluation.metrics.promptEngineering}</div>
                            </div>
                            <div className="bg-zinc-900 p-2 rounded text-center">
                                <div className="text-zinc-500 text-[10px] uppercase">Vibe</div>
                                <div className="text-zinc-200 font-bold">{lastEvaluation.metrics.creativity}</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="text-zinc-500 mb-2">// System Log</div>
                        {history.map((entry, i) => (
                            <div key={i} className="flex gap-2 opacity-70 hover:opacity-100 transition-opacity">
                                <span className="text-zinc-600">[{entry.timestamp}]</span>
                                <span className={
                                    entry.status === 'SUCCESS' ? 'text-green-500' : 
                                    entry.status === 'SKIPPED' ? 'text-amber-500' :
                                    'text-red-500'
                                }>
                                    {entry.status}
                                </span>
                                <span className="text-zinc-400 truncate max-w-[150px]">L{entry.level}: {entry.prompt}</span>
                            </div>
                        ))}
                        {history.length === 0 && (
                            <div className="text-zinc-700 italic">Waiting for input...</div>
                        )}
                    </div>
                )}
            </div>

        </div>
      </main>
    </div>
  );
};

export default VibeAssessment;