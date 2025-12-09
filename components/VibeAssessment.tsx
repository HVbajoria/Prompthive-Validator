
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

const MAX_SKIPS = 1;

const VibeAssessment: React.FC<VibeAssessmentProps> = ({ config, candidate, onComplete }) => {
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
    const score = Math.round((passedCount / config.questions.length) * 100);
    onComplete({ score, answers: finalState.answers });
  };

  const handleSkip = () => {
    if (skipsUsed >= MAX_SKIPS) return;

    const currentQ = config.questions[state.currentQuestionIndex];
    
    // Create a failed answer for the skipped question
    const skippedAnswer: AssessmentAnswer = {
        questionId: currentQ.id,
        userPrompt: "PROTOCOL_OVERRIDE // SKIPPED",
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
        prompt: "PROTOCOL SKIPPED",
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
                            <div className="relative w-full h-full">
                                <img src={lastAttemptImage} className="absolute inset-0 w-full h-full object-contain" alt="Base" />
                                <img 
                                    src={currentQuestion.targetImageUrl} 
                                    className="absolute inset-0 w-full h-full object-contain"
                                    style={{ 
                                        mixBlendMode: 'difference',
                                        animation: 'difference-pulse 2s ease-in-out infinite'
                                    }}
                                    alt="Diff" 
                                />
                                <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                                    <span className="bg-black/80 text-red-400 px-4 py-2 rounded-full text-xs font-bold border border-red-500/30 backdrop-blur-md">
                                        Scan Active: Mismatches Highlighted
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Overlay Controls */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md rounded-full p-1 flex gap-1 border border-white/10 shadow-lg">
                        <Tooltip content="Show goal image">
                            <button 
                                onClick={() => setViewMode('TARGET')}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${viewMode === 'TARGET' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                            >
                                Target
                            </button>
                        </Tooltip>
                        <Tooltip content="Show your generated result">
                            <button 
                                onClick={() => lastAttemptImage && setViewMode('GENERATED')}
                                disabled={!lastAttemptImage}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${viewMode === 'GENERATED' ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-white disabled:opacity-30'}`}
                            >
                                Attempt
                            </button>
                        </Tooltip>
                        <Tooltip content="Highlight pixel differences">
                            <button 
                                onClick={() => lastAttemptImage && setViewMode('DIFF')}
                                disabled={!lastAttemptImage}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${viewMode === 'DIFF' ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-400 hover:text-white disabled:opacity-30'}`}
                            >
                                Diff
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </div>

            {/* Context Hint */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-start gap-3 text-sm text-zinc-400">
                <Info className="w-5 h-5 text-indigo-400 shrink-0" />
                <p>
                    <span className="text-zinc-200 font-semibold block mb-1">Analyst Note</span>
                    This challenge is rated <span className="text-amber-500 font-bold">{currentQuestion.difficulty}</span>. 
                    You must achieve a match score of <span className="text-amber-500 font-bold">{currentQuestion.passingThreshold}%</span> to proceed.
                </p>
            </div>
        </div>

        {/* Right: Interaction (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full gap-4">
            
            {/* Feedback Status */}
            {lastEvaluation && !lastEvaluation.passed && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 animate-fade-in flex flex-col gap-3">
                    <div className="flex gap-3">
                        <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <strong className="block text-red-400 mb-1">Alignment Failure</strong>
                            <p className="text-red-200/80 leading-relaxed text-xs">{lastEvaluation.feedback}</p>
                        </div>
                    </div>
                    
                    {/* Granular Metrics */}
                    <div className="grid grid-cols-3 gap-2 mt-1">
                         <div className="bg-black/20 rounded p-2 border border-red-500/10">
                            <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Visuals</div>
                            <div className={`text-sm font-mono font-bold ${lastEvaluation.metrics.accuracy < 70 ? 'text-red-400' : 'text-green-400'}`}>
                                {lastEvaluation.metrics.accuracy}
                            </div>
                         </div>
                         <div className="bg-black/20 rounded p-2 border border-red-500/10">
                            <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Syntax</div>
                            <div className={`text-sm font-mono font-bold ${lastEvaluation.metrics.promptEngineering < 70 ? 'text-red-400' : 'text-green-400'}`}>
                                {lastEvaluation.metrics.promptEngineering}
                            </div>
                         </div>
                         <div className="bg-black/20 rounded p-2 border border-red-500/10">
                            <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Concept</div>
                            <div className={`text-sm font-mono font-bold ${lastEvaluation.metrics.creativity < 70 ? 'text-red-400' : 'text-green-400'}`}>
                                {lastEvaluation.metrics.creativity}
                            </div>
                         </div>
                    </div>
                </div>
            )}

            {/* Code Editor / Input */}
            <div className={`flex-1 bg-zinc-900 border rounded-2xl flex flex-col shadow-inner transition-colors duration-300 overflow-hidden ${isSuccess ? 'border-green-500/50 ring-1 ring-green-500/20' : 'border-zinc-800'}`}>
                <div className="bg-zinc-950 border-b border-zinc-800 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
                        <Terminal className="w-4 h-4" />
                        <span>prompt_entry.txt</span>
                    </div>
                    {skipsUsed < MAX_SKIPS && (
                        <Tooltip content="Skip this challenge (Limited use!)" position="left">
                            <button 
                                onClick={handleSkip}
                                disabled={state.isGenerating || isSuccess}
                                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition"
                            >
                                Skip Level <SkipForward className="w-3 h-3" />
                            </button>
                        </Tooltip>
                    )}
                </div>
                
                <Tooltip content="Type a prompt to recreate the target image" fullWidth className="flex-1">
                    <textarea 
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        disabled={state.isGenerating || isSuccess}
                        placeholder="// Enter your prompt generation sequence here..."
                        className="flex-1 w-full bg-zinc-900 p-4 text-zinc-100 font-mono text-sm outline-none resize-none placeholder:text-zinc-700"
                        spellCheck={false}
                        onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (!state.isGenerating && promptInput) handleGenerateAndCheck();
                        }
                        }}
                    />
                </Tooltip>
                
                <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
                     <div className="text-xs text-zinc-500 font-mono">
                        {state.isGenerating ? (
                            <span className="flex items-center gap-2 text-indigo-400">
                                <RefreshCw className="w-3 h-3 animate-spin" /> Processing...
                            </span>
                        ) : (
                            <span>Ready to execute</span>
                        )}
                     </div>

                     <Tooltip content="Submit prompt to AI Judge" position="left">
                        <button 
                            onClick={handleGenerateAndCheck}
                            disabled={state.isGenerating || !promptInput || isSuccess}
                            className={`px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                                ${isSuccess 
                                    ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20' 
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'}`}
                        >
                            {isSuccess ? (
                                <> <CheckCircle className="w-4 h-4" /> Success </>
                            ) : (
                                <> <Send className="w-4 h-4" /> Run Protocol </>
                            )}
                        </button>
                     </Tooltip>
                </div>
            </div>

            {/* History Feed */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-48">
                <div className="bg-zinc-950 p-3 text-xs font-semibold text-zinc-400 border-b border-zinc-800 flex items-center gap-2">
                    <History className="w-3 h-3" /> Execution Log
                </div>
                <div className="overflow-y-auto p-2 space-y-1">
                    {history.length === 0 && (
                        <div className="text-center text-zinc-600 text-xs py-4 italic">No commands executed yet.</div>
                    )}
                    {history.map((entry, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-zinc-800/50 transition text-xs font-mono border-b border-zinc-800/50 last:border-0">
                            <span className="text-zinc-600 shrink-0">{entry.timestamp}</span>
                            <span className={`shrink-0 font-bold ${
                                entry.status === 'SUCCESS' ? 'text-green-400' : 
                                entry.status === 'SKIPPED' ? 'text-zinc-400' : 'text-red-400'
                            }`}>
                                {entry.status}
                            </span>
                            <Tooltip content={entry.prompt} position="top" className="flex-1 min-w-0">
                                <span className="text-zinc-400 truncate w-full block">{entry.prompt}</span>
                            </Tooltip>
                        </div>
                    ))}
                </div>
            </div>

        </div>

      </main>
    </div>
  );
};

export default VibeAssessment;
