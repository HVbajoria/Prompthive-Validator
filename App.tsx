
import React, { useState, useEffect } from 'react';
import { AppView, AssessmentConfig, Candidate, AssessmentAnswer, Question, SkillMetrics } from './types';
import AdminPanel from './components/AdminPanel';
import VibeAssessment from './components/VibeAssessment';
import { saveConfigToDB, getAllConfigsFromDB } from './services/storage';
import { LayoutGrid, Play, ShieldCheck, User, CheckCircle, ArrowRight, Lock, XCircle, AlertOctagon, ScanEye, Layers, Columns, Eye, Maximize2, FileText, Activity, BrainCircuit, Hexagon, LogOut, Settings, Users, BarChart3, Menu, X, Copy, Check, Plus, FolderOpen, Search } from 'lucide-react';
import Tooltip from './components/Tooltip';

const STORAGE_KEY = 'vibe_check_config'; // Kept for backwards compatibility reference, but now we use IDs

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
                        <Hexagon className="w-8 h-8 text-amber-500 fill-amber-500/20" />
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden text-slate-100 honeycomb-bg">
      <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/10 to-slate-950 z-0 pointer-events-none"></div>
      
      <div className="z-10 w-full max-w-md space-y-8 bg-slate-900/80 backdrop-blur-xl p-8 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-lg mb-2">
             <BrainCircuit className="w-12 h-12 text-amber-500" />
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
                <span>{assessments.length} Active Protocols Detected</span>
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
                <p className="text-slate-400 mt-2">Aggregate metrics for assessment <strong className="text-amber-500">"{config.name}"</strong>.</p>
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

  const renderAdminLayout = () => {
      const filteredAssessments = assessments.filter(a => 
          a.name.toLowerCase().includes(assessmentSearch.toLowerCase())
      );

      return (
          <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-950">
              {/* Sidebar */}
              <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col">
                  <div className="p-6 border-b border-slate-800">
                      <div className="flex flex-col items-center mb-6">
                            <img 
                                src="data:image/jpeg;base64,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" 
                                alt="Admin Profile" 
                                className="w-16 h-16 rounded-full border-2 border-amber-500 mb-3 object-cover shadow-lg shadow-amber-500/20"
                            />
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Admin Console</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold">AD</div>
                        <div>
                            <div className="text-sm font-bold text-white">Admin User</div>
                            <div className="text-xs text-slate-400">admin@prompthive.com</div>
                        </div>
                      </div>
                  </div>

                  {/* Assessment List */}
                  <div className="flex-1 overflow-y-auto">
                     <div className="p-4 space-y-2">
                        <Tooltip content="Create a new assessment protocol" fullWidth>
                            <button 
                                onClick={() => {
                                    setActiveAssessmentId(null);
                                    setConfig(null);
                                    setAdminTab('CONFIG');
                                    setAssessmentSearch(''); // Clear search
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-bold rounded border border-dashed transition ${!activeAssessmentId ? 'border-amber-500 text-amber-500 bg-amber-500/10' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                            >
                                <Plus className="w-4 h-4" /> New Assessment
                            </button>
                        </Tooltip>

                        {/* Search Bar */}
                        <div className="relative mb-2 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                            <Tooltip content="Filter protocols by name" fullWidth>
                                <input 
                                    type="text" 
                                    placeholder="Filter protocols..." 
                                    value={assessmentSearch}
                                    onChange={(e) => setAssessmentSearch(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-md py-2 pl-8 pr-7 text-xs text-slate-300 placeholder:text-slate-600 focus:border-amber-500/50 outline-none transition"
                                />
                            </Tooltip>
                            {assessmentSearch && (
                                <button 
                                    onClick={() => setAssessmentSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        <div className="pt-2">
                            <label className="text-[10px] font-bold text-slate-600 uppercase mb-2 block px-1">Your Protocols</label>
                            {assessments.length === 0 ? (
                                <p className="text-xs text-slate-600 px-1 italic">No assessments yet.</p>
                            ) : filteredAssessments.length === 0 ? (
                                <p className="text-xs text-slate-600 px-1 italic">No matches found.</p>
                            ) : (
                                filteredAssessments.map(a => (
                                    <Tooltip key={a.id} content={a.name} position="right" fullWidth>
                                        <button 
                                            onClick={() => {
                                                setActiveAssessmentId(a.id);
                                                setAdminTab('CONFIG');
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded text-sm mb-1 truncate transition ${activeAssessmentId === a.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FolderOpen className="w-3 h-3 shrink-0" />
                                                <span className="truncate">{a.name}</span>
                                            </div>
                                        </button>
                                    </Tooltip>
                                ))
                            )}
                        </div>
                     </div>
                  </div>
                  
                  {/* Contextual Tabs (Only if Assessment Selected) */}
                  {config && (
                    <div className="p-4 border-t border-slate-800 bg-slate-950/30">
                        <label className="text-[10px] font-bold text-slate-600 uppercase mb-2 block px-1">Current Protocol</label>
                        <nav className="space-y-1">
                            <button 
                                onClick={() => setAdminTab('CONFIG')}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${adminTab === 'CONFIG' ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
                            >
                                <Settings className="w-4 h-4" /> Config
                            </button>
                            <button 
                                onClick={() => setAdminTab('CANDIDATES')}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${adminTab === 'CANDIDATES' ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
                            >
                                <Users className="w-4 h-4" /> Candidates
                            </button>
                            <button 
                                onClick={() => setAdminTab('ANALYTICS')}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${adminTab === 'ANALYTICS' ? 'bg-slate-800 text-amber-500' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
                            >
                                <BarChart3 className="w-4 h-4" /> Analytics
                            </button>
                        </nav>
                    </div>
                  )}

                  <div className="p-4 border-t border-slate-800">
                      <div className="bg-slate-950 p-3 rounded text-xs text-slate-500">
                          v2.5.0 Multi-Tenant
                      </div>
                  </div>
              </aside>

              {/* Main Content */}
              <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
                  {adminTab === 'CONFIG' && (
                      <AdminPanel onSave={handleAdminSave} initialConfig={config} />
                  )}
                  {adminTab === 'CANDIDATES' && config ? renderCandidateList() : null}
                  {adminTab === 'ANALYTICS' && config ? renderAnalytics() : null}
                  
                  {/* Empty state if tabs clicked without config */}
                  {(!config && adminTab !== 'CONFIG') && (
                       <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <FolderOpen className="w-12 h-12 mb-4 opacity-20" />
                            <p>Select an assessment from the sidebar to view details.</p>
                       </div>
                  )}
              </main>
          </div>
      )
  };

  const renderResults = () => {
    if (!finalResults || !config) return null;
    const { score, answers } = finalResults;

    // Calculate Averages for Summary
    const passedAnswers = answers.filter(a => a.passed);
    const avgAccuracy = passedAnswers.length ? Math.round(passedAnswers.reduce((acc, curr) => acc + (curr.metrics?.accuracy || 0), 0) / passedAnswers.length) : 0;
    const avgTech = passedAnswers.length ? Math.round(passedAnswers.reduce((acc, curr) => acc + (curr.metrics?.promptEngineering || 0), 0) / passedAnswers.length) : 0;
    const avgCreativity = passedAnswers.length ? Math.round(passedAnswers.reduce((acc, curr) => acc + (curr.metrics?.creativity || 0), 0) / passedAnswers.length) : 0;

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-24">
        
        {/* Report Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-sm">
            <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-500 p-2 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold leading-none">Validation Report</h2>
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Candidate: {currentUser?.email || 'Guest'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                        <div className="text-xs text-slate-500 uppercase font-semibold">Overall Grade</div>
                        <div className={`text-xl font-bold ${score >= 70 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {score >= 70 ? 'PROFICIENT' : 'NEEDS IMPROVEMENT'}
                        </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-slate-100 dark:border-slate-800 flex items-center justify-center font-bold text-sm relative">
                        {score}%
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path
                                className={`${score >= 70 ? 'text-green-500' : 'text-red-500'}`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeDasharray={`${score}, 100`}
                            />
                        </svg>
                    </div>
                </div>
            </div>
        </div>

        <div className="max-w-5xl mx-auto p-6 space-y-8">
            
            {/* Executive Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Skill Analysis
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-8 items-center justify-center">
                        <SpiderChart metrics={{ accuracy: avgAccuracy, promptEngineering: avgTech, creativity: avgCreativity }} />
                        <div className="space-y-6 flex-1 w-full">
                            <div>
                                <div className="flex justify-between mb-1 text-sm font-medium">
                                    <span>Visual Accuracy</span>
                                    <span className="text-slate-500">{avgAccuracy}/100</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${avgAccuracy}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-sm font-medium">
                                    <span>Prompt Engineering</span>
                                    <span className="text-slate-500">{avgTech}/100</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                    <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${avgTech}%` }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-1 text-sm font-medium">
                                    <span>Creativity & Logic</span>
                                    <span className="text-slate-500">{avgCreativity}/100</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                    <div className="bg-pink-500 h-2 rounded-full" style={{ width: `${avgCreativity}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-500 rounded-2xl p-6 text-black flex flex-col justify-between shadow-lg shadow-amber-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div>
                        <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide mb-2">Recommendation</h3>
                        <p className="text-2xl font-bold mb-4">
                            {score >= 85 ? 'Highly Recommended' : score >= 70 ? 'Qualified' : 'Not Recommended'}
                        </p>
                        <p className="text-sm text-amber-950 opacity-90 leading-relaxed font-medium">
                            {score >= 70 
                             ? "Candidate demonstrates strong command of generative AI tools. Effective translation of visual requirements."
                             : "Candidate shows potential gaps in prompt structure and visual analysis."}
                        </p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-amber-800/20 flex justify-between items-center">
                        <div className="text-xs font-mono opacity-75">ID: {config.id.substring(0,8)}</div>
                        <CheckCircle className="w-6 h-6 opacity-75" />
                    </div>
                </div>
            </div>

            {/* Metric Definitions with Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Accuracy */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                         <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase">Visual Accuracy</h4>
                         <span className="text-sm font-bold text-slate-900 dark:text-white">{avgAccuracy}/100</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mb-3">
                         <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${avgAccuracy}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Evaluates fidelity to the target image's composition, color palette, lighting, and overall aesthetic style.
                    </p>
                </div>

                {/* Engineering */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                         <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Prompt Engineering</h4>
                         <span className="text-sm font-bold text-slate-900 dark:text-white">{avgTech}/100</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mb-3">
                         <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${avgTech}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Assesses the technical structure, keyword usage, parameter application, and clarity of the written prompt.
                    </p>
                </div>

                {/* Creativity */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-start mb-2">
                         <h4 className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase">Creativity & Logic</h4>
                         <span className="text-sm font-bold text-slate-900 dark:text-white">{avgCreativity}/100</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 mb-3">
                         <div className="bg-pink-500 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${avgCreativity}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Measures the ability to capture the core "vibe" and subject concept, even if specific details vary.
                    </p>
                </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" /> Challenge Breakdown
                </h3>
                {config.questions.map((question, index) => {
                    const answer = answers.find(a => a.questionId === question.id);
                    return (
                        <ResultCard 
                            key={question.id} 
                            question={question} 
                            answer={answer} 
                            index={index} 
                        />
                    );
                })}
            </div>

            <div className="flex justify-center pt-8">
                <button 
                    onClick={() => {
                        setView(AppView.LANDING);
                        setAccessCodeInput('');
                        setFinalResults(null);
                        setCurrentUser(null);
                    }}
                    className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition font-medium shadow-sm"
                >
                    Return to Portal
                </button>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-200 font-sans selection:bg-amber-500 selection:text-white flex flex-col">
      <Navbar 
        currentUser={currentUser} 
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {renderLoginModal()}

      <div className="flex-1">
        {view === AppView.LANDING && renderLanding()}
        {view === AppView.ADMIN && renderAdminLayout()}
        {view === AppView.ASSESSMENT && config && currentUser && (
            <VibeAssessment 
                config={config} 
                candidate={{ email: currentUser.email, accessCode: '', status: 'PENDING' }} 
                onComplete={handleAssessmentComplete} 
            />
        )}
        {view === AppView.RESULTS && renderResults()}
      </div>
    </div>
  );
};

export default App;
