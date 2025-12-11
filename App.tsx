import React, { useState, useEffect } from 'react';
import { AppView, AssessmentConfig, Candidate, AssessmentAnswer, Question, SkillMetrics } from './types';
import AdminPanel from './components/AdminPanel';
import VibeAssessment from './components/VibeAssessment';
import { saveConfigToDB, getAllConfigsFromDB } from './services/storage';
import { LayoutGrid, Play, ShieldCheck, User, CheckCircle, ArrowRight, Lock, XCircle, AlertOctagon, ScanEye, Layers, Columns, Eye, Maximize2, FileText, Activity, BrainCircuit, Hexagon, LogOut, Settings, Users, BarChart3, Menu, X, Copy, Check, Plus, FolderOpen, Search } from 'lucide-react';
import Tooltip from './components/Tooltip';

const STORAGE_KEY = 'vibe_check_config'; // Kept for backwards compatibility reference, but now we use IDs

// --- Custom Logo Component ---
const HiveLogo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 115" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer Hexagon - Neon Yellow */}
    <path 
      d="M50 5 L93.3013 30 V80 L50 105 L6.69873 80 V30 L50 5Z" 
      stroke="currentColor" 
      strokeWidth="5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
    />
    {/* Inner Hexagon - Cyan/Blue Accent */}
    <path 
      d="M50 18 L81.1769 36 V74 L50 92 L18.8231 74 V36 L50 18Z" 
      stroke="#06b6d4" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="opacity-70 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]"
    />
    {/* Target Circle */}
    <circle cx="50" cy="55" r="20" stroke="currentColor" strokeWidth="3" className="text-amber-500" />
    
    {/* Crosshair Lines */}
    <line x1="50" y1="25" x2="50" y2="42" stroke="currentColor" strokeWidth="3" className="text-amber-500" />
    <line x1="50" y1="68" x2="50" y2="85" stroke="currentColor" strokeWidth="3" className="text-amber-500" />
    <line x1="20" y1="55" x2="37" y2="55" stroke="currentColor" strokeWidth="3" className="text-amber-500" />
    <line x1="63" y1="55" x2="80" y2="55" stroke="currentColor" strokeWidth="3" className="text-amber-500" />
  </svg>
);

// --- Spider Chart Component ---
const SpiderChart: React.FC<{ metrics: SkillMetrics }> = ({ metrics }) => {
    // Normalize metrics 0-100
    const data = {
        Accuracy: metrics.accuracy,
        Engineering: metrics.promptEngineering,
        Creativity: metrics.creativity,
    };
    
    // SVG Config
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const axes = Object.keys(data);
    const totalAxes = axes.length;
    
    // Helper to calculate coordinates
    const getCoordinates = (value: number, index: number) => {
        const angle = (Math.PI * 2 * index) / totalAxes - Math.PI / 2;
        const x = center + (radius * (value / 100)) * Math.cos(angle);
        const y = center + (radius * (value / 100)) * Math.sin(angle);
        return { x, y };
    };

    // Generate Points string for polygon
    const points = axes.map((key, i) => {
        const { x, y } = getCoordinates(data[key as keyof typeof data], i);
        return `${x},${y}`;
    }).join(" ");

    // Generate Grid Lines (25%, 50%, 75%, 100%)
    const levels = [25, 50, 75, 100];

    return (
        <div className="flex flex-col items-center">
            <svg width={size} height={size} className="overflow-visible">
                {/* Grid Polygons */}
                {levels.map(level => (
                    <polygon 
                        key={level}
                        points={axes.map((_, i) => {
                            const { x, y } = getCoordinates(level, i);
                            return `${x},${y}`;
                        }).join(" ")}
                        fill="none"
                        stroke="#475569" // slate-600
                        strokeWidth="1"
                        strokeDasharray={level < 100 ? "4 4" : ""}
                        className="opacity-50"
                    />
                ))}

                {/* Axes Lines */}
                {axes.map((_, i) => {
                    const { x, y } = getCoordinates(100, i);
                    return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#475569" strokeWidth="1" />;
                })}

                {/* Data Polygon */}
                <polygon 
                    points={points}
                    fill="rgba(245, 158, 11, 0.2)" // Amber-500
                    stroke="#f59e0b"
                    strokeWidth="2"
                />

                {/* Data Points */}
                {axes.map((key, i) => {
                    const { x, y } = getCoordinates(data[key as keyof typeof data], i);
                    return <circle key={i} cx={x} cy={y} r="4" fill="#f59e0b" stroke="white" strokeWidth="1" />;
                })}

                {/* Labels */}
                {axes.map((label, i) => {
                    const { x, y } = getCoordinates(115, i);
                    return (
                        <text 
                            key={i} 
                            x={x} 
                            y={y} 
                            textAnchor="middle" 
                            dominantBaseline="middle" 
                            className="text-[10px] fill-slate-400 font-mono uppercase"
                        >
                            {label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
};

// --- Result Card Component ---
const ResultCard: React.FC<{ question: Question; answer?: AssessmentAnswer; index: number }> = ({ question, answer, index }) => {
  const [viewMode, setViewMode] = useState<'SIDE_BY_SIDE' | 'DIFF' | 'OVERLAY'>('SIDE_BY_SIDE');
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const isPassed = !!answer;

  return (
    <div className={`bg-white dark:bg-slate-900 border ${isPassed ? 'border-slate-200 dark:border-slate-800' : 'border-red-200 dark:border-red-900/30'} rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md relative`}>
      
      {/* Zoom Modal */}
      {zoomedImage && (
        <div 
            className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
            onClick={() => setZoomedImage(null)}
        >
             <img 
                src={zoomedImage} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                alt="Full screen" 
             />
        </div>
      )}

      {/* Header */}
      <div className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b ${isPassed ? 'border-slate-100 dark:border-slate-800' : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30'}`}>
        <div className="flex items-center gap-3">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isPassed ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
                {index + 1}
            </span>
            <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Challenge Level {index + 1}</h3>
                <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${isPassed ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {isPassed ? `PASSED (${answer?.similarityScore}%)` : 'SIGNAL LOST'}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500 font-mono">Difficulty: {question.difficulty}</span>
                </div>
            </div>
        </div>

        {isPassed && (
             <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-800">
                <Tooltip content="Side-by-side comparison">
                    <button 
                    onClick={() => setViewMode('SIDE_BY_SIDE')}
                    className={`p-1.5 rounded-md transition ${viewMode === 'SIDE_BY_SIDE' ? 'bg-white dark:bg-slate-800 shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                    <Columns className="w-4 h-4" />
                    </button>
                </Tooltip>
                <Tooltip content="Overlay opacity slider">
                    <button 
                    onClick={() => setViewMode('OVERLAY')}
                    className={`p-1.5 rounded-md transition ${viewMode === 'OVERLAY' ? 'bg-white dark:bg-slate-800 shadow-sm text-amber-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                    <Layers className="w-4 h-4" />
                    </button>
                </Tooltip>
                <Tooltip content="Diff pulse view">
                    <button 
                    onClick={() => setViewMode('DIFF')}
                    className={`p-1.5 rounded-md transition ${viewMode === 'DIFF' ? 'bg-white dark:bg-slate-800 shadow-sm text-red-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                    <ScanEye className="w-4 h-4" />
                    </button>
                </Tooltip>
             </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Visuals */}
        <div className="space-y-4">
             {/* Main Image Area */}
             <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-2 flex items-center justify-center min-h-[300px]">
                {!isPassed ? (
                    <div className="text-center space-y-2 opacity-50">
                        <AlertOctagon className="w-10 h-10 mx-auto text-slate-400" />
                        <span className="text-sm text-slate-500">Visualization Not Available</span>
                    </div>
                ) : (
                    <>
                        {viewMode === 'SIDE_BY_SIDE' && (
                             <div className="grid grid-cols-2 gap-2 w-full h-full">
                                <div className="space-y-1 cursor-zoom-in" onClick={() => setZoomedImage(question.targetImageUrl)}>
                                    <span className="text-[10px] uppercase text-slate-500 font-semibold pl-1">Target</span>
                                    <img src={question.targetImageUrl} className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-800" alt="Target" />
                                </div>
                                <div className="space-y-1 cursor-zoom-in" onClick={() => setZoomedImage(answer.generatedImageUrl)}>
                                    <span className="text-[10px] uppercase text-slate-500 font-semibold pl-1">Generated</span>
                                    <img src={answer.generatedImageUrl} className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-800" alt="Gen" />
                                </div>
                             </div>
                        )}
                        {viewMode === 'OVERLAY' && (
                            <div className="relative w-full h-full aspect-square max-w-[300px] overflow-hidden rounded-lg">
                                <img src={answer.generatedImageUrl} className="absolute inset-0 w-full h-full object-cover" alt="Gen" />
                                <img 
                                    src={question.targetImageUrl} 
                                    className="absolute inset-0 w-full h-full object-cover will-change-[opacity]" 
                                    style={{ opacity: overlayOpacity / 100 }}
                                    alt="Target" 
                                />
                                <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur rounded-full px-3 py-1 flex items-center gap-2">
                                    <span className="text-[10px] text-white font-mono">GEN</span>
                                    <input 
                                        type="range" min="0" max="100" 
                                        value={overlayOpacity} onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                    <span className="text-[10px] text-white font-mono">TGT</span>
                                </div>
                            </div>
                        )}
                        {viewMode === 'DIFF' && (
                            <div className="relative w-full h-full aspect-square max-w-[300px] overflow-hidden rounded-lg border-2 border-red-500/20 bg-black">
                                <div className="absolute inset-0 w-full h-full" style={{ animation: 'difference-pulse 2s infinite' }}>
                                    <img src={answer.generatedImageUrl} className="absolute inset-0 w-full h-full object-cover" alt="Gen" />
                                    <img 
                                        src={question.targetImageUrl} 
                                        className="absolute inset-0 w-full h-full object-cover" 
                                        style={{ mixBlendMode: 'difference' }}
                                        alt="Target" 
                                    />
                                </div>
                                <div className="absolute bottom-2 left-0 right-0 text-center">
                                    <span className="text-[10px] bg-red-950/80 text-red-400 px-2 py-1 rounded border border-red-500/30">
                                        Active Difference Pulse
                                    </span>
                                </div>
                            </div>
                        )}
                    </>
                )}
             </div>
        </div>

        {/* Analytics */}
        <div className="flex flex-col gap-6">
            {isPassed ? (
                <>
                    {/* Spider Chart + Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                            {answer.metrics && <SpiderChart metrics={answer.metrics} />}
                        </div>
                        <div className="space-y-3 py-2">
                            <Tooltip content="Similarity of composition, color, and subject" fullWidth>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Visual Accuracy</span>
                                        <span>{answer.metrics?.accuracy || 0}/100</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${answer.metrics?.accuracy || 0}%` }}></div>
                                    </div>
                                </div>
                            </Tooltip>
                            <Tooltip content="Effective use of keywords and structure" fullWidth>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Prompt Tech</span>
                                        <span>{answer.metrics?.promptEngineering || 0}/100</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${answer.metrics?.promptEngineering || 0}%` }}></div>
                                    </div>
                                </div>
                            </Tooltip>
                            <Tooltip content="Understanding of concept and vibe" fullWidth>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Creativity</span>
                                        <span>{answer.metrics?.creativity || 0}/100</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${answer.metrics?.creativity || 0}%` }}></div>
                                    </div>
                                </div>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Reasoning */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <BrainCircuit className="w-3 h-3" /> AI Analysis
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {answer.reasoning || answer.feedback}
                        </div>
                    </div>

                    {/* Code Snippet */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <FileText className="w-3 h-3" /> Submitted Prompt
                        </h4>
                        <code className="block bg-slate-900 text-slate-300 p-3 rounded-lg text-xs font-mono break-words border border-slate-800">
                            {answer.userPrompt}
                        </code>
                    </div>
                </>
            ) : (
                <div className="h-full flex flex-col justify-center items-center text-center p-8 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                        This challenge was not successfully completed. No detailed analytics are available for failed attempts.
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// --- Navbar Component ---
const Navbar: React.FC<{ 
    currentUser: { email: string, isAdmin: boolean } | null, 
    onLoginClick: () => void, 
    onLogout: () => void 
}> = ({ currentUser, onLoginClick, onLogout }) => {
    return (
        <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-3">
                        <HiveLogo className="w-10 h-10" />
                        <span className="text-xl font-bold text-slate-100 tracking-tight">PromptHive <span className="text-amber-500">Validator</span></span>
                    </div>
                    <div>
                        {currentUser ? (
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-400 hidden sm:block">{currentUser.email}</span>
                                <Tooltip content="Sign out of your account" position="bottom">
                                    <button 
                                        onClick={onLogout}
                                        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                                    >
                                        <LogOut className="w-4 h-4" /> Logout
                                    </button>
                                </Tooltip>
                            </div>
                        ) : (
                            <Tooltip content="Access admin panel or user dashboard" position="bottom">
                                <button 
                                    onClick={onLoginClick}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg transition text-sm"
                                >
                                    <User className="w-4 h-4" /> Login
                                </button>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};


// --- Main App Component ---
const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [adminTab, setAdminTab] = useState<'CONFIG' | 'CANDIDATES' | 'ANALYTICS'>('CONFIG');
  
  // Data State
  const [assessments, setAssessments] = useState<AssessmentConfig[]>([]);
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [assessmentSearch, setAssessmentSearch] = useState('');
  const [isEditingNew, setIsEditingNew] = useState(false);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<{ email: string, isAdmin: boolean } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');

  // Assessment State
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [finalResults, setFinalResults] = useState<{ score: number, answers: AssessmentAnswer[] } | null>(null);

  // Load all assessments on mount
  useEffect(() => {
    const loadData = async () => {
        const configs = await getAllConfigsFromDB();
        setAssessments(configs);
    };
    loadData();
  }, []);

  // Sync activeAssessmentId with active config
  useEffect(() => {
    if (activeAssessmentId) {
        setIsEditingNew(false);
        const found = assessments.find(a => a.id === activeAssessmentId);
        setConfig(found || null);
    } else {
        setConfig(null); // Creating new
    }
  }, [activeAssessmentId, assessments]);

  const handleAdminSave = async (newConfig: AssessmentConfig) => {
    try {
        await saveConfigToDB(newConfig.id, newConfig);
        
        // Update local list
        setAssessments(prev => {
            const exists = prev.find(a => a.id === newConfig.id);
            if (exists) {
                return prev.map(a => a.id === newConfig.id ? newConfig : a);
            }
            return [...prev, newConfig];
        });
        
        setActiveAssessmentId(newConfig.id);
        alert(`Assessment Saved! ID: ${newConfig.id.substring(0, 8)}`);
    } catch (e) {
        console.error("Storage Error", e);
        alert("Failed to save assessment to IndexedDB.");
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const email = loginEmail.trim().toLowerCase();
    
    if (email === 'admin@prompthive.com') {
        setCurrentUser({ email, isAdmin: true });
        setView(AppView.ADMIN);
        setIsLoginModalOpen(false);
    } else {
        // Simple User Login (Mock)
        setCurrentUser({ email, isAdmin: false });
        setIsLoginModalOpen(false);
        setView(AppView.LANDING);
    }
    setLoginEmail('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView(AppView.LANDING);
    setFinalResults(null);
    setConfig(null);
    setAssessmentSearch(''); // Clear search on logout
    setIsEditingNew(false);
  };

  const handleCandidateAccess = () => {
    // 1. Search ALL assessments for this candidate
    let foundConfig: AssessmentConfig | undefined;
    let foundCandidate: Candidate | undefined;

    for (const assessment of assessments) {
        const c = assessment.candidates.find(cand => cand.accessCode === accessCodeInput.trim() || cand.email === accessCodeInput.trim());
        if (c) {
            foundConfig = assessment;
            foundCandidate = c;
            break;
        }
    }

    if (!foundConfig || !foundCandidate) {
        alert("Invalid Access Code or Email. No matching assessment found.");
        return;
    }

    // 2. Validate Time
    const now = new Date();
    const start = new Date(foundConfig.validFrom);
    const end = new Date(foundConfig.validTo);

    if (now < start) {
        alert(`Assessment "${foundConfig.name}" has not started yet.`);
        return;
    }
    if (now > end) {
        alert(`Assessment "${foundConfig.name}" has expired.`);
        return;
    }

    // 3. Start
    setConfig(foundConfig);
    setCurrentUser({ email: foundCandidate.email, isAdmin: false });
    setView(AppView.ASSESSMENT);
  };

  const handleAssessmentComplete = async (results: { score: number, answers: AssessmentAnswer[] }) => {
    setFinalResults(results);
    setView(AppView.RESULTS);

    // Save results back to config/DB for analytics
    if (config && currentUser) {
        const updatedConfig = { ...config };
        const candidateIndex = updatedConfig.candidates.findIndex(c => c.email === currentUser.email);
        if (candidateIndex >= 0) {
            updatedConfig.candidates[candidateIndex].status = 'COMPLETED';
            updatedConfig.candidates[candidateIndex].score = results.score;
            
            try {
                await saveConfigToDB(updatedConfig.id, updatedConfig);
                // Update lists
                setAssessments(prev => prev.map(a => a.id === updatedConfig.id ? updatedConfig : a));
                setConfig(updatedConfig);
            } catch (e) {
                console.error("Failed to persist results", e);
            }
        }
    }
  };

  // --- Views ---

  const renderLoginModal = () => {
      if (!isLoginModalOpen) return null;
      return (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
                  <button onClick={() => setIsLoginModalOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                      <X className="w-5 h-5" />
                  </button>
                  <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mx-auto mb-4 text-amber-500">
                          <User className="w-6 h-6" />
                      </div>
                      <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
                      <p className="text-slate-400 text-sm mt-1">Enter your credentials to access the platform</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Email Address</label>
                          <input 
                            type="email" 
                            required
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-lg p-3 text-white outline-none transition"
                            placeholder="name@company.com"
                          />
                      </div>
                      <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-lg transition">
                          Sign In
                      </button>
                  </form>
                  <div className="mt-4 text-center text-xs text-slate-500">
                      Use <strong>admin@prompthive.com</strong> for admin access.
                  </div>
              </div>
          </div>
      )
  };

  const renderLanding = () => (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-100 honeycomb-bg">
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/10 to-slate-950 z-0 pointer-events-none"></div>
      
      <div className="z-10 w-full max-w-md space-y-8 bg-slate-900/80 backdrop-blur-xl p-8 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center space-y-4">
          <div className="inline-flex p-6 rounded-2xl bg-slate-950 border border-slate-800 shadow-lg mb-2 relative group">
             <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-75 transition"></div>
             <HiveLogo className="w-20 h-20 text-amber-500 relative z-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">PromptHive Validator</h1>
            <p className="text-slate-500 text-sm font-medium uppercase tracking-wide mt-2">Professional AI Assessment Suite</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Candidate Access Code</label>
            <Tooltip content="Enter your provided access code or email" fullWidth>
                <input 
                type="text" 
                value={accessCodeInput}
                onChange={(e) => setAccessCodeInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg p-3 text-white outline-none transition placeholder:text-slate-700"
                placeholder="Enter code provided by recruiter"
                />
            </Tooltip>
          </div>
          
          <button 
            onClick={handleCandidateAccess}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-lg transition shadow-lg shadow-indigo-500/20 flex justify-center items-center gap-2"
          >
            Start Assessment <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {assessments.length > 0 && (
            <div className="mt-4 p-3 bg-slate-800/50 text-slate-500 text-xs rounded-lg border border-slate-700 text-center">
                <span>{assessments.length} Active Assessments Detected</span>
            </div>
        )}
      </div>
    </div>
  );

  const renderCandidateList = () => {
    if (!config) return null;
    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
             <div className="border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-bold text-white">Candidate Registry</h2>
                <p className="text-slate-400 mt-2">Managing access for: <strong className="text-amber-500">{config.name}</strong></p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-slate-200 uppercase font-semibold">
                        <tr>
                            <th className="p-4">Email</th>
                            <th className="p-4">Access Code</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-right">Score</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {config.candidates.length === 0 && (
                             <tr><td colSpan={4} className="p-4 text-center italic">No candidates found in this protocol.</td></tr>
                        )}
                        {config.candidates.map((c, i) => (
                            <tr key={i} className="hover:bg-slate-800/50 transition">
                                <td className="p-4 text-white font-medium">{c.email}</td>
                                <td className="p-4 font-mono text-amber-500">
                                    <Tooltip content="Click to copy" position="top">
                                        <button className="flex items-center gap-2 hover:underline" onClick={() => navigator.clipboard.writeText(c.accessCode)}>
                                            {c.accessCode} <Copy className="w-3 h-3" />
                                        </button>
                                    </Tooltip>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                        c.status === 'COMPLETED' ? 'bg-green-900/30 text-green-400' :
                                        c.status === 'PENDING' ? 'bg-amber-900/30 text-amber-400' : 'bg-red-900/30 text-red-400'
                                    }`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right text-white">
                                    {c.score !== undefined ? `${c.score}%` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
  };

  const renderAnalytics = () => {
    if (!config) return null;
    
    const completed = config.candidates.filter(c => c.status === 'COMPLETED');
    const total = config.candidates.length;
    const avgScore = completed.length > 0 
        ? Math.round(completed.reduce((acc, c) => acc + (c.score || 0), 0) / completed.length) 
        : 0;
    
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
             <div className="border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-bold text-white">Performance Analytics</h2>
                <p className="text-slate-400 mt-2">Aggregate metrics for <strong className="text-amber-500">"{config.name}"</strong>.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-xs uppercase font-bold mb-2">Completion Rate</div>
                    <div className="text-3xl font-bold text-white">{completed.length} <span className="text-slate-500 text-lg">/ {total}</span></div>
                    <div className="w-full bg-slate-800 h-1.5 mt-4 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${total > 0 ? (completed.length / total) * 100 : 0}%` }}></div>
                    </div>
                </div>
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-xs uppercase font-bold mb-2">Average Score</div>
                    <div className="text-3xl font-bold text-white">{avgScore}%</div>
                    <div className="text-xs text-slate-500 mt-2">Across {completed.length} candidates</div>
                </div>
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <div className="text-slate-400 text-xs uppercase font-bold mb-2">Levels Configured</div>
                    <div className="text-3xl font-bold text-white">{config.questions.length}</div>
                    <div className="text-xs text-slate-500 mt-2">Difficulty: Mixed</div>
                </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4">Score Distribution</h3>
                {completed.length === 0 ? (
                    <div className="text-center text-slate-500 py-8 italic">No completion data available yet.</div>
                ) : (
                    <div className="space-y-2">
                        {completed.map((c, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="w-24 text-xs text-slate-400 truncate">{c.email}</div>
                                <div className="flex-1 bg-slate-800 h-6 rounded overflow-hidden relative">
                                    <div 
                                        className={`h-full ${ (c.score || 0) >= 70 ? 'bg-green-500' : 'bg-amber-500' }`} 
                                        style={{ width: `${c.score}%` }}
                                    ></div>
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white drop-shadow">
                                        {c.score}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderAdminDashboard = () => (
    <div className="max-w-5xl mx-auto p-6 space-y-6 animate-fade-in">
         <div className="flex items-center justify-between">
            <div>
                <h2 className="text-2xl font-bold text-white">Assessment Dashboard</h2>
                <p className="text-slate-400 mt-1">Manage validation protocols and review results.</p>
            </div>
            <button 
                onClick={() => { setActiveAssessmentId(null); setConfig(null); setIsEditingNew(true); }}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg transition"
            >
                <Plus className="w-5 h-5" /> New Assessment
            </button>
         </div>

         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
                type="text" 
                placeholder="Search assessments..." 
                value={assessmentSearch}
                onChange={e => setAssessmentSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-white outline-none focus:border-amber-500 transition"
            />
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assessments
                .filter(a => a.name.toLowerCase().includes(assessmentSearch.toLowerCase()))
                .map(a => (
                <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-amber-500/50 transition cursor-pointer group flex flex-col justify-between" onClick={() => setActiveAssessmentId(a.id)}>
                    <div className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-amber-500/20 group-hover:text-amber-500 transition-colors text-slate-400">
                                <Hexagon className="w-6 h-6" />
                            </div>
                            {a.candidates.some(c => c.status === 'COMPLETED') && (
                                <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-green-900/30 text-green-400 px-2 py-1 rounded-full">
                                    <Activity className="w-3 h-3" /> Active
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-white truncate">{a.name}</h3>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                <Users className="w-3 h-3" /> {a.candidates.length} Candidates
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
                        <span>{new Date(a.validFrom).toLocaleDateString()}</span>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-amber-500" />
                    </div>
                </div>
            ))}
         </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/30">
        {renderLoginModal()}
        
        <Navbar 
            currentUser={currentUser} 
            onLoginClick={() => setIsLoginModalOpen(true)} 
            onLogout={handleLogout} 
        />

        {view === AppView.LANDING && renderLanding()}
        
        {view === AppView.ADMIN && (
             <div className="min-h-[calc(100vh-64px)] bg-slate-950">
                {!config && !isEditingNew ? renderAdminDashboard() : (
                    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-6">
                        {/* Admin Nav Back */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <button onClick={() => { setActiveAssessmentId(null); setIsEditingNew(false); }} className="flex items-center gap-2 text-slate-400 hover:text-white transition text-sm">
                                <ArrowRight className="w-4 h-4 rotate-180" /> Back to Dashboard
                            </button>
                            
                            {!isEditingNew && (
                                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                                    <button 
                                        onClick={() => setAdminTab('CONFIG')}
                                        className={`px-4 py-1.5 rounded text-sm font-medium transition ${adminTab === 'CONFIG' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Config
                                    </button>
                                    <button 
                                        onClick={() => setAdminTab('CANDIDATES')}
                                        className={`px-4 py-1.5 rounded text-sm font-medium transition ${adminTab === 'CANDIDATES' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Candidates
                                    </button>
                                    <button 
                                        onClick={() => setAdminTab('ANALYTICS')}
                                        className={`px-4 py-1.5 rounded text-sm font-medium transition ${adminTab === 'ANALYTICS' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Analytics
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Admin Content */}
                        {adminTab === 'CONFIG' && (
                            <AdminPanel 
                                initialConfig={isEditingNew ? null : config} 
                                onSave={handleAdminSave} 
                            />
                        )}
                        {adminTab === 'CANDIDATES' && renderCandidateList()}
                        {adminTab === 'ANALYTICS' && renderAnalytics()}
                    </div>
                )}
             </div>
        )}

        {view === AppView.ASSESSMENT && config && (
            <VibeAssessment 
                config={config} 
                candidate={config.candidates.find(c => c.email === currentUser?.email) || { email: 'unknown', accessCode: '', status: 'PENDING' }}
                onComplete={handleAssessmentComplete}
            />
        )}

        {view === AppView.RESULTS && finalResults && config && (
             <div className="max-w-5xl mx-auto p-6 space-y-8 animate-fade-in">
                <div className="text-center space-y-2 py-8">
                    <div className="inline-flex p-4 rounded-full bg-slate-900 border border-slate-800 shadow-xl mb-4">
                        <span className="text-4xl font-bold text-white">{finalResults.score}%</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white">Assessment Complete</h1>
                    <p className="text-slate-400">Here is your detailed breakdown for <strong className="text-amber-500">{config.name}</strong></p>
                </div>
                
                <div className="space-y-6">
                    {config.questions.map((q, i) => {
                        const ans = finalResults.answers.find(a => a.questionId === q.id);
                        return <ResultCard key={q.id} question={q} answer={ans} index={i} />;
                    })}
                </div>
                
                <div className="flex justify-center pt-8">
                    <button onClick={handleLogout} className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition font-medium">
                        <LogOut className="w-4 h-4" /> Return to Home
                    </button>
                </div>
             </div>
        )}
    </div>
  );
};

export default App;