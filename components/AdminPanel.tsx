import React, { useState, useRef, useEffect } from 'react';
import { Upload, Calendar, Clock, Loader2, Play, AlertTriangle, Settings, Users, BrainCircuit, ArrowRight, ArrowLeft, FileText, Sparkles, Sliders, Mail, MessageSquare, Plus, Trash2, Edit2, Check, Send, ChevronDown, Eye, X, ShieldCheck } from 'lucide-react';
import { AssessmentConfig, Candidate, Question, DifficultyLevel, EmailTemplate } from '../types';
import { generateRandomPromptQuestion } from '../services/geminiService';
import { saveTemplateToDB, deleteTemplateFromDB, getAllTemplatesFromDB } from '../services/storage';
import { DEFAULT_TEMPLATE, parseEmail, openMailClient } from '../services/emailService';
import Tooltip from './Tooltip';
import VibeAssessment from './VibeAssessment';

interface AdminPanelProps {
  onSave: (config: AssessmentConfig) => void;
  initialConfig?: AssessmentConfig | null;
}

// Robust ID generator that works in all contexts (secure/non-secure)
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if crypto.randomUUID fails
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onSave, initialConfig }) => {
  // Helper to set default dates to Now and Tomorrow
  const getLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const [activeTab, setActiveTab] = useState<'DETAILS' | 'CANDIDATES' | 'CHALLENGES' | 'COMMUNICATIONS'>('DETAILS');

  // Config State
  const [name, setName] = useState('Frontend Engineering Validation');
  const [validFrom, setValidFrom] = useState(getLocalISOString(new Date()));
  const [validTo, setValidTo] = useState(getLocalISOString(new Date(Date.now() + 86400000))); // +24h
  const [duration, setDuration] = useState(45);
  const [emailText, setEmailText] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numQuestionsToGen, setNumQuestionsToGen] = useState(3);
  const [genDifficulty, setGenDifficulty] = useState<DifficultyLevel>('MEDIUM');
  const [genInstructions, setGenInstructions] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Template State
  const [templates, setTemplates] = useState<EmailTemplate[]>([DEFAULT_TEMPLATE]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('default');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Preview & Confirm State
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isConfirmDeployOpen, setIsConfirmDeployOpen] = useState(false);

  const errorRef = useRef<HTMLDivElement>(null);

  // Initialize from existing config
  useEffect(() => {
    if (initialConfig) {
        setName(initialConfig.name);
        setValidFrom(initialConfig.validFrom);
        setValidTo(initialConfig.validTo);
        setDuration(initialConfig.durationMinutes);
        setCandidates(initialConfig.candidates);
        setQuestions(initialConfig.questions);
        setEmailText(initialConfig.candidates.map(c => c.email).join('\n'));
    } else {
        setName('New Assessment');
        setValidFrom(getLocalISOString(new Date()));
        setValidTo(getLocalISOString(new Date(Date.now() + 86400000)));
        setDuration(45);
        setCandidates([]);
        setQuestions([]);
        setEmailText('');
    }
  }, [initialConfig]);

  // Load Templates
  useEffect(() => {
    const loadTemplates = async () => {
        const stored = await getAllTemplatesFromDB();
        setTemplates(stored.length > 0 ? stored : [DEFAULT_TEMPLATE]);
    };
    loadTemplates();
  }, []);

  // Scroll to error if it appears
  useEffect(() => {
    if (errorMsg && errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errorMsg]);

  // Clear success msg after 3s
  useEffect(() => {
    if (successMsg) {
        const timer = setTimeout(() => setSuccessMsg(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        // Simple CSV parser (assumes email is first column)
        const emails = text.split(/\r?\n/).map(line => line.split(',')[0].trim()).filter(e => e.length > 0);
        processEmails(emails);
      };
      reader.readAsText(file);
    }
  };

  const processEmails = (rawLines: string[]) => {
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];

    rawLines.forEach(line => {
        // Basic cleanup
        const email = line.replace(/['"]/g, '').trim();
        if (!email) return;

        if (isValidEmail(email)) {
            validEmails.push(email);
        } else {
            invalidEmails.push(email);
        }
    });

    const newCandidates: Candidate[] = validEmails.map(email => ({
      email,
      accessCode: btoa(email).substring(0, 8).toUpperCase(), // Simple mock code
      status: 'PENDING'
    }));
    
    setCandidates(newCandidates);
    setEmailText(validEmails.join('\n'));
    
    if (invalidEmails.length > 0) {
        setErrorMsg(`Found ${invalidEmails.length} invalid email(s) in file: ${invalidEmails.slice(0, 3).join(', ')}${invalidEmails.length > 3 ? '...' : ''}`);
    } else {
        setErrorMsg(null);
    }
  };

  const handleManualEmailChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEmailText(val);
    
    const lines = val.split(/\n/).map(s => s.trim()).filter(s => s.length > 0);
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];

    lines.forEach(line => {
        if (isValidEmail(line)) {
            validEmails.push(line);
        } else {
            invalidEmails.push(line);
        }
    });

    const newCandidates: Candidate[] = validEmails.map(email => ({
      email,
      accessCode: btoa(email).substring(0, 8).toUpperCase(),
      status: 'PENDING'
    }));
    setCandidates(newCandidates);
    
    if (invalidEmails.length > 0) {
        setErrorMsg(`Invalid email format detected: ${invalidEmails.slice(0, 3).join(', ')}${invalidEmails.length > 3 ? '...' : ''}`);
    } else {
        setErrorMsg(null);
    }
  };

  const generateAssets = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    const newQuestions: Question[] = [];
    
    try {
      for (let i = 0; i < numQuestionsToGen; i++) {
        const { prompt, image } = await generateRandomPromptQuestion(genDifficulty, genInstructions);
        newQuestions.push({
          id: generateId(),
          hiddenPrompt: prompt,
          targetImageUrl: image,
          difficulty: genDifficulty,
          passingThreshold: 70
        });
      }
      setQuestions(prev => [...prev, ...newQuestions]);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to generate assets. Ensure API Key is set and valid.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDifficultyChange = (id: string, newDifficulty: DifficultyLevel) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, difficulty: newDifficulty } : q
    ));
  };

  const handleThresholdChange = (id: string, newThreshold: number) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, passingThreshold: newThreshold } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handlePreview = () => {
    if (questions.length === 0) {
        setActiveTab('CHALLENGES');
        setErrorMsg("Cannot preview without questions. Please generate challenges first.");
        return;
    }
    setErrorMsg(null);
    setIsPreviewMode(true);
  };

  const validateConfig = (): boolean => {
    setErrorMsg(null);
    
    // 1. Validate Details
    if (!name.trim()) {
        setActiveTab('DETAILS');
        setErrorMsg("Assessment Name is required.");
        return false;
    }
    if (!validFrom || !validTo) {
        setActiveTab('DETAILS');
        setErrorMsg("Start and End dates are required.");
        return false;
    }
    // 2. Validate Candidates
    if (candidates.length === 0) {
        setActiveTab('CANDIDATES');
        setErrorMsg("At least one valid candidate email must be added.");
        return false;
    }
    // 3. Validate Questions
    if (questions.length === 0) {
        setActiveTab('CHALLENGES');
        setErrorMsg("At least one challenge question must be generated.");
        return false;
    }
    return true;
  };

  const handleDeployClick = () => {
    if (validateConfig()) {
        setIsConfirmDeployOpen(true);
    }
  };

  const handleSaveConfig = () => {
    try {
        const config: AssessmentConfig = {
          id: initialConfig?.id || generateId(),
          name,
          validFrom,
          validTo,
          durationMinutes: duration,
          candidates,
          questions
        };
        onSave(config);
        setIsConfirmDeployOpen(false);
    } catch (err) {
        console.error("Save error:", err);
        setErrorMsg("Failed to save configuration. Please try again.");
    }
  };

  // --- Email Template Handlers ---

  const handleCreateTemplate = () => {
      setEditingTemplate({
          id: generateId(),
          name: 'New Template',
          subject: 'Invitation to Assessment: {assessmentName}',
          body: `Hi {name},\n\nHere is your access code: {accessCode}\n\nGood luck!`,
      });
  };

  const handleSaveTemplate = async () => {
      if (!editingTemplate) return;
      if (!editingTemplate.name) { alert("Template Name required"); return; }

      await saveTemplateToDB(editingTemplate);
      
      setTemplates(prev => {
          const exists = prev.find(t => t.id === editingTemplate.id);
          if (exists) return prev.map(t => t.id === editingTemplate.id ? editingTemplate : t);
          return [...prev, editingTemplate];
      });
      setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (id: string) => {
      if (confirm('Are you sure you want to delete this template?')) {
          await deleteTemplateFromDB(id);
          setTemplates(prev => prev.filter(t => t.id !== id));
          if (activeTemplateId === id) setActiveTemplateId(templates[0]?.id || '');
      }
  };

  const handleSendEmail = (candidate: Candidate) => {
      try {
          const template = templates.find(t => t.id === activeTemplateId) || DEFAULT_TEMPLATE;
          
          // Temporary config object for preview/send if not yet saved, otherwise use saved logic
          const currentConfigStub: AssessmentConfig = {
              id: initialConfig?.id || 'preview',
              name: name,
              validFrom,
              validTo,
              durationMinutes: duration,
              candidates,
              questions
          };
    
          const { subject, body } = parseEmail(template, candidate, currentConfigStub);
          openMailClient(candidate.email, subject, body);
          setSuccessMsg(`Opening mail client for ${candidate.email}...`);
      } catch (e) {
          console.error(e);
          setErrorMsg("Failed to open email client.");
      }
  };

  // --- Render Preview Overlay ---
  if (isPreviewMode) {
      const mockCandidate: Candidate = {
          email: 'admin-preview@prompthive.com',
          accessCode: 'PREVIEW',
          status: 'PENDING'
      };
      
      const previewConfig: AssessmentConfig = {
          id: 'preview-mode',
          name: `[PREVIEW] ${name}`,
          validFrom,
          validTo,
          durationMinutes: duration,
          candidates: [mockCandidate],
          questions: questions
      };

      return (
          <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
              {/* Preview Banner */}
              <div className="bg-amber-500 text-black px-4 py-2 font-bold flex items-center justify-between shadow-lg z-[110]">
                  <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      <span>ADMIN PREVIEW MODE</span>
                      <span className="text-xs font-normal bg-black/10 px-2 py-0.5 rounded ml-2">Data will not be saved</span>
                  </div>
                  <button 
                    onClick={() => setIsPreviewMode(false)}
                    className="flex items-center gap-1 bg-black/20 hover:bg-black/30 px-3 py-1 rounded text-sm transition"
                  >
                      <X className="w-4 h-4" /> Exit Preview
                  </button>
              </div>
              
              {/* Assessment Component */}
              <div className="flex-1 overflow-auto">
                <VibeAssessment 
                    config={previewConfig}
                    candidate={mockCandidate}
                    onComplete={() => {
                        alert("Preview Complete! Returning to editor.");
                        setIsPreviewMode(false);
                    }}
                />
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-full animate-fade-in relative">
      
      {/* Toast Notification */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-[70] bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-bounce-in">
            <Check className="w-5 h-5" />
            <span>{successMsg}</span>
        </div>
      )}

      {/* Deployment Confirmation Modal */}
      {isConfirmDeployOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4 relative">
                <div className="flex items-center gap-3 text-amber-500 mb-2">
                    <ShieldCheck className="w-8 h-8" />
                    <h3 className="text-xl font-bold text-white">Confirm Deployment</h3>
                </div>
                <p className="text-slate-300">
                    You are about to deploy <strong>{name}</strong>.
                </p>
                <div className="bg-slate-950 p-4 rounded border border-slate-800 text-sm space-y-2">
                   <div className="flex justify-between">
                       <span className="text-slate-500">Candidates:</span>
                       <span className="text-white font-mono">{candidates.length}</span>
                   </div>
                   <div className="flex justify-between">
                       <span className="text-slate-500">Challenges:</span>
                       <span className="text-white font-mono">{questions.length}</span>
                   </div>
                   <div className="flex justify-between">
                       <span className="text-slate-500">Duration:</span>
                       <span className="text-white font-mono">{duration} mins</span>
                   </div>
                </div>
                <p className="text-xs text-slate-500">
                    Once deployed, candidates with valid emails will be able to access the assessment using their generated codes.
                </p>
                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={() => setIsConfirmDeployOpen(false)}
                        className="flex-1 px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveConfig}
                        className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition shadow-lg shadow-indigo-500/20"
                    >
                        Confirm & Deploy
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-800 pb-4 mb-6 flex items-start justify-between">
        <div>
            <h2 className="text-2xl font-bold text-white">{initialConfig ? 'Edit Assessment' : 'New Assessment'}</h2>
            <p className="text-slate-400 mt-2">Configure validation parameters and generate target vectors.</p>
        </div>
        <Tooltip content="Simulate assessment as a candidate">
            <button 
                onClick={handlePreview}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg transition text-sm font-medium"
            >
                <Eye className="w-4 h-4" /> Preview
            </button>
        </Tooltip>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-slate-800 overflow-x-auto">
        <Tooltip content="Set name, dates, and duration">
            <button 
                onClick={() => setActiveTab('DETAILS')}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'DETAILS' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
            >
                <Settings className="w-4 h-4" /> General Details
            </button>
        </Tooltip>
        <Tooltip content="Manage authorized candidates">
            <button 
                onClick={() => setActiveTab('CANDIDATES')}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'CANDIDATES' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
            >
                <Users className="w-4 h-4" /> Candidates
                {candidates.length > 0 && <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full">{candidates.length}</span>}
            </button>
        </Tooltip>
        <Tooltip content="Configure AI challenges">
            <button 
                onClick={() => setActiveTab('CHALLENGES')}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'CHALLENGES' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
            >
                <BrainCircuit className="w-4 h-4" /> Challenges
                {questions.length > 0 && <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full">{questions.length}</span>}
            </button>
        </Tooltip>
        <Tooltip content="Setup email invitations">
            <button 
                onClick={() => setActiveTab('COMMUNICATIONS')}
                className={`flex items-center gap-2 px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === 'COMMUNICATIONS' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}`}
            >
                <Mail className="w-4 h-4" /> Communications
            </button>
        </Tooltip>
      </div>

      {/* Global Error Message Display */}
      {errorMsg && (
        <div ref={errorRef} className="mb-6 bg-red-900/20 border border-red-500 text-red-200 p-4 rounded flex items-center gap-3 animate-pulse">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
        </div>
      )}

      {/* Content Area */}
      <div className="space-y-6 pb-20">
        
        {/* --- DETAILS TAB --- */}
        {activeTab === 'DETAILS' && (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 space-y-4 max-w-2xl">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                        <FileText className="w-5 h-5 text-amber-500" /> Assessment Logistics
                    </h3>
                    
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Assessment Name</label>
                        <Tooltip content="A descriptive title for this assessment visible to candidates" fullWidth>
                            <input 
                            type="text" 
                            value={name} 
                            onChange={e => { setName(e.target.value); setErrorMsg(null); }}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-2 focus:border-amber-500 outline-none text-white"
                            placeholder="e.g. Q3 Prompt Engineering Validation"
                            />
                        </Tooltip>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-sm text-slate-400 mb-1">Valid From</label>
                        <Tooltip content="When candidates can start accessing the link" fullWidth>
                            <input 
                                type="datetime-local" 
                                value={validFrom} 
                                onChange={e => setValidFrom(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm focus:border-amber-500 outline-none text-white color-scheme-dark" 
                            />
                        </Tooltip>
                        </div>
                        <div>
                        <label className="block text-sm text-slate-400 mb-1">Valid To</label>
                        <Tooltip content="When the link expires" fullWidth>
                            <input 
                                type="datetime-local" 
                                value={validTo} 
                                onChange={e => setValidTo(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm focus:border-amber-500 outline-none text-white color-scheme-dark" 
                            />
                        </Tooltip>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Time Limit (Minutes)</label>
                        <Tooltip content="Total duration allowed for the assessment" fullWidth>
                            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded p-2 focus-within:border-amber-500 w-full md:w-1/2">
                                <Clock className="w-4 h-4 text-slate-500" />
                                <input 
                                type="number" 
                                value={duration} 
                                onChange={e => setDuration(Number(e.target.value))}
                                className="bg-transparent outline-none w-full text-white"
                                />
                            </div>
                        </Tooltip>
                    </div>
                </div>
                
                <div className="flex justify-end max-w-2xl">
                    <button 
                        onClick={() => setActiveTab('CANDIDATES')}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium transition"
                    >
                        Next: Add Candidates <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        {/* --- CANDIDATES TAB --- */}
        {activeTab === 'CANDIDATES' && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                            <Upload className="w-5 h-5 text-amber-500" /> Bulk Import
                        </h3>
                        
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Upload CSV</label>
                            <Tooltip content="Upload a CSV file containing email addresses in the first column" fullWidth>
                                <input 
                                type="file" 
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-800 file:text-amber-500 hover:file:bg-slate-700"
                                />
                            </Tooltip>
                            <p className="text-xs text-slate-500 mt-2">First column should contain email addresses.</p>
                        </div>

                        <div className="pt-4 border-t border-slate-800">
                            <label className="block text-sm text-slate-400 mb-2">Or Paste Emails</label>
                            <Tooltip content="Paste a list of emails, one per line" fullWidth>
                                <textarea 
                                    placeholder="candidate1@example.com&#10;candidate2@example.com" 
                                    value={emailText}
                                    onChange={handleManualEmailChange}
                                    className="w-full h-40 bg-slate-950 border border-slate-800 rounded p-3 text-sm outline-none resize-none font-mono focus:border-amber-500 text-white placeholder:text-slate-700"
                                />
                            </Tooltip>
                        </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 flex flex-col">
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                                    <Users className="w-5 h-5 text-amber-500" /> Access List
                                </h3>
                                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-full">{candidates.length} valid</span>
                            </div>
                            
                            {/* Quick Template Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Template:</span>
                                <Tooltip content="Select email template for invitations">
                                    <select 
                                        value={activeTemplateId}
                                        onChange={(e) => setActiveTemplateId(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 text-xs text-white rounded px-2 py-1 outline-none focus:border-amber-500"
                                    >
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </Tooltip>
                            </div>
                         </div>

                         <div className="flex-1 bg-slate-950 rounded border border-slate-800 p-2 overflow-y-auto max-h-[300px]">
                            {candidates.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm italic">
                                    No candidates added yet.
                                </div>
                            ) : (
                                <ul className="space-y-1">
                                    {candidates.map((c, i) => (
                                        <li key={i} className="text-sm text-slate-400 p-2 hover:bg-slate-900 rounded flex justify-between items-center group">
                                            <div className="flex flex-col">
                                                <span className="text-slate-200">{c.email}</span>
                                                <span className="font-mono text-xs text-slate-600">Code: {c.accessCode}</span>
                                            </div>
                                            <Tooltip content="Send invitation email now" position="left">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleSendEmail(c); }}
                                                    className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded transition shadow-sm"
                                                >
                                                    <Send className="w-3 h-3" /> Invite
                                                </button>
                                            </Tooltip>
                                        </li>
                                    ))}
                                </ul>
                            )}
                         </div>
                         {candidates.length > 0 && (
                             <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                                 <AlertTriangle className="w-3 h-3" />
                                 <span>Click 'Invite' to open your default mail client with the selected template.</span>
                             </div>
                         )}
                    </div>
                </div>

                <div className="flex justify-between">
                    <button 
                        onClick={() => setActiveTab('DETAILS')}
                        className="flex items-center gap-2 px-6 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded font-medium transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back: Details
                    </button>
                    <button 
                        onClick={() => setActiveTab('CHALLENGES')}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium transition"
                    >
                        Next: Configure Challenges <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        {/* --- CHALLENGES TAB --- */}
        {activeTab === 'CHALLENGES' && (
            <div className="space-y-6 animate-fade-in">
                 <div className="bg-slate-900 p-6 rounded-lg border border-slate-800 space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                            <Play className="w-5 h-5 text-amber-500" /> Assessment Content Generation
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Configure parameters to generate new "Target Images" using AI.
                        </p>
                    </div>
                    
                    {/* Generation Controls */}
                    <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-2">
                             <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Batch Size</label>
                             <Tooltip content="Number of questions to generate" fullWidth>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="10" 
                                    value={numQuestionsToGen} 
                                    onChange={e => setNumQuestionsToGen(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:border-amber-500 outline-none"
                                />
                             </Tooltip>
                        </div>
                        <div className="md:col-span-3">
                            <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Target Difficulty</label>
                            <Tooltip content="Complexity of the generated images" fullWidth>
                                <select 
                                    value={genDifficulty}
                                    onChange={(e) => setGenDifficulty(e.target.value as DifficultyLevel)}
                                    className="w-full bg-slate-900 border border-slate-700 text-sm text-white p-2 rounded focus:border-amber-500 outline-none cursor-pointer hover:bg-slate-800"
                                >
                                    <option value="NOVICE">NOVICE</option>
                                    <option value="EASY">EASY</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="HARD">HARD</option>
                                    <option value="EXPERT">EXPERT</option>
                                </select>
                            </Tooltip>
                        </div>
                        <div className="md:col-span-5">
                            <label className="text-xs text-slate-400 font-bold uppercase mb-2 block flex items-center gap-1">
                                Custom Context/Style <span className="text-slate-600 font-normal normal-case">(Optional)</span>
                            </label>
                            <Tooltip content="e.g. 'Cyberpunk', 'Watercolor', 'Minimalist'" fullWidth>
                                <input 
                                    type="text"
                                    placeholder="e.g. 'Cyberpunk only' or 'Use watercolor style'"
                                    value={genInstructions}
                                    onChange={e => setGenInstructions(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-500 outline-none placeholder:text-slate-700"
                                />
                            </Tooltip>
                        </div>
                        <div className="md:col-span-2">
                            <Tooltip content="Generate new questions using AI" fullWidth>
                                <button 
                                    onClick={generateAssets}
                                    disabled={isGenerating}
                                    className="w-full flex items-center justify-center gap-2 bg-amber-500 text-black px-4 py-2 rounded font-bold hover:bg-amber-400 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : (
                                        <> <Sparkles className="w-4 h-4" /> Generate </>
                                    )}
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Question List */}
                    {questions.length === 0 && !isGenerating && (
                        <div className="py-12 border-2 border-dashed border-slate-800 rounded-xl text-center flex flex-col items-center justify-center bg-slate-900/50">
                            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <BrainCircuit className="w-6 h-6 text-slate-500" />
                            </div>
                            <p className="text-slate-500 font-medium">No challenges configured.</p>
                            <p className="text-xs text-slate-600 mt-1">Set parameters above and click "Generate".</p>
                        </div>
                    )}

                    {questions.length > 0 && (
                        <div className="space-y-4">
                             <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wide border-b border-slate-800 pb-2">Active Challenge Set</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                {questions.map((q, idx) => (
                                <div key={q.id} className="relative bg-black border border-slate-800 rounded-lg overflow-hidden flex flex-col hover:border-amber-500 transition-colors group">
                                    {/* Remove Button */}
                                    <Tooltip content="Delete this question" position="left" className="absolute top-2 right-2 z-20">
                                        <button 
                                            onClick={() => removeQuestion(q.id)}
                                            className="bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition hover:scale-110"
                                        >
                                            <div className="w-3 h-3 flex items-center justify-center">
                                                <div className="h-0.5 w-2 bg-white rotate-45 absolute"></div>
                                                <div className="h-0.5 w-2 bg-white -rotate-45 absolute"></div>
                                            </div>
                                        </button>
                                    </Tooltip>

                                    {/* Image Container */}
                                    <div className="relative h-48 bg-slate-900">
                                        <img src={q.targetImageUrl} alt="Target" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                                        <div className="absolute top-2 left-2 bg-amber-500 text-black text-xs font-extrabold px-2 py-0.5 rounded shadow">
                                            LEVEL {idx + 1}
                                        </div>
                                        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[10px] text-slate-300 line-clamp-2 bg-black/50 backdrop-blur p-1 rounded border border-white/10">
                                                {q.hiddenPrompt}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Controls */}
                                    <div className="p-3 border-t border-slate-800 bg-slate-900/50 space-y-3">
                                        <div>
                                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1 flex items-center gap-1">
                                                <Sliders className="w-3 h-3" /> Difficulty
                                            </label>
                                            <Tooltip content="Adjust difficulty for this specific question" fullWidth>
                                                <select 
                                                    value={q.difficulty}
                                                    onChange={(e) => handleDifficultyChange(q.id, e.target.value as DifficultyLevel)}
                                                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white p-2 rounded focus:border-amber-500 outline-none font-mono cursor-pointer hover:bg-slate-800 transition"
                                                >
                                                    <option value="NOVICE">NOVICE</option>
                                                    <option value="EASY">EASY</option>
                                                    <option value="MEDIUM">MEDIUM</option>
                                                    <option value="HARD">HARD</option>
                                                    <option value="EXPERT">EXPERT</option>
                                                </select>
                                            </Tooltip>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] uppercase text-slate-500 font-bold block">Passing Threshold</label>
                                                <span className={`text-[10px] font-mono font-bold ${q.passingThreshold >= 80 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                    {q.passingThreshold}%
                                                </span>
                                            </div>
                                            <Tooltip content="Minimum visual similarity score required to pass" fullWidth>
                                                <input 
                                                    type="range" 
                                                    min="50" 
                                                    max="95" 
                                                    step="5"
                                                    value={q.passingThreshold}
                                                    onChange={(e) => handleThresholdChange(q.id, Number(e.target.value))}
                                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                            </Tooltip>
                                        </div>
                                    </div>
                                </div>
                                ))}
                            </div>
                        </div>
                    )}
                 </div>

                 <div className="flex justify-between pt-4 border-t border-slate-800">
                    <button 
                        onClick={() => setActiveTab('CANDIDATES')}
                        className="flex items-center gap-2 px-6 py-2 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded font-medium transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back: Candidates
                    </button>
                    <button 
                        onClick={() => setActiveTab('COMMUNICATIONS')}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-medium transition"
                    >
                        Next: Communications <ArrowRight className="w-4 h-4" />
                    </button>
                 </div>
            </div>
        )}

        {/* --- COMMUNICATIONS TAB --- */}
        {activeTab === 'COMMUNICATIONS' && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Left: Template List */}
                    <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col h-[500px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-amber-500" /> Templates
                            </h3>
                            <Tooltip content="Create new template">
                                <button onClick={handleCreateTemplate} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </Tooltip>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {templates.map(t => (
                                <div 
                                    key={t.id} 
                                    onClick={() => { setActiveTemplateId(t.id); setEditingTemplate(null); }}
                                    className={`p-3 rounded-lg cursor-pointer border transition flex items-center justify-between group ${activeTemplateId === t.id ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-600'}`}
                                >
                                    <div>
                                        <div className={`text-sm font-medium ${activeTemplateId === t.id ? 'text-amber-500' : 'text-slate-300'}`}>
                                            {t.name}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate w-32">{t.subject}</div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                        <Tooltip content="Edit">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingTemplate(t); }} 
                                                className="p-1 hover:text-indigo-400 text-slate-500"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                        </Tooltip>
                                        {!t.isDefault && (
                                            <Tooltip content="Delete">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} 
                                                    className="p-1 hover:text-red-400 text-slate-500"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Preview or Edit */}
                    <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-6 flex flex-col h-[500px]">
                        {editingTemplate ? (
                            // --- EDIT MODE ---
                            <div className="flex flex-col h-full space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-slate-200">Edit Template</h3>
                                    <button onClick={() => setEditingTemplate(null)} className="text-xs text-slate-500 hover:text-white">Cancel</button>
                                </div>
                                <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase font-bold">Template Name</label>
                                        <Tooltip content="Internal name for this template" fullWidth>
                                            <input 
                                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-amber-500 outline-none" 
                                                value={editingTemplate.name}
                                                onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})}
                                            />
                                        </Tooltip>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 uppercase font-bold">Subject Line</label>
                                        <Tooltip content="Email subject line" fullWidth>
                                            <input 
                                                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white text-sm focus:border-amber-500 outline-none" 
                                                value={editingTemplate.subject}
                                                onChange={e => setEditingTemplate({...editingTemplate, subject: e.target.value})}
                                            />
                                        </Tooltip>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <label className="text-xs text-slate-500 uppercase font-bold mb-1">Email Body</label>
                                        <Tooltip content="Body of the email. Use variables like {name}" fullWidth className="flex-1">
                                            <textarea 
                                                className="flex-1 w-full bg-slate-950 border border-slate-800 rounded p-3 text-white text-sm font-mono focus:border-amber-500 outline-none resize-none"
                                                value={editingTemplate.body}
                                                onChange={e => setEditingTemplate({...editingTemplate, body: e.target.value})}
                                            />
                                        </Tooltip>
                                    </div>
                                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] text-slate-400">
                                        <span className="font-bold text-slate-300">Variables: </span>
                                        {'{name}, {email}, {accessCode}, {assessmentName}, {duration}, {link}'}
                                    </div>
                                </div>
                                <Tooltip content="Save template changes" fullWidth>
                                    <button 
                                        onClick={handleSaveTemplate}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" /> Save Template
                                    </button>
                                </Tooltip>
                            </div>
                        ) : (
                            // --- PREVIEW MODE ---
                            <div className="flex flex-col h-full space-y-4">
                                {templates.find(t => t.id === activeTemplateId) ? (
                                    <>
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                            <span className="text-xs font-bold text-amber-500 uppercase tracking-wide">Live Preview</span>
                                            <div className="flex gap-2">
                                                <Tooltip content="Edit this template">
                                                    <button 
                                                        onClick={() => setEditingTemplate(templates.find(t => t.id === activeTemplateId) || null)}
                                                        className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded"
                                                    >
                                                        Edit Template
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 space-y-4 overflow-y-auto">
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Subject</label>
                                                <div className="text-sm text-white font-medium border-b border-slate-800 pb-2">
                                                    {parseEmail(templates.find(t => t.id === activeTemplateId)!, { email: 'candidate@example.com', accessCode: 'A1B2C3D4', status: 'PENDING' }, { name: name || 'Assessment Name', durationMinutes: duration } as any).subject}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Body</label>
                                                <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-950 p-4 rounded border border-slate-800">
                                                    {parseEmail(templates.find(t => t.id === activeTemplateId)!, { email: 'candidate@example.com', accessCode: 'A1B2C3D4', status: 'PENDING' }, { name: name || 'Assessment Name', durationMinutes: duration } as any).body}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-center text-xs text-slate-500 pt-2">
                                            This template is currently selected for candidate invitations.
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-500">
                                        Select a template to view details
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-800">
                     <button 
                        onClick={() => setActiveTab('CHALLENGES')}
                        className="flex items-center gap-2 px-6 py-3 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded font-medium transition"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back: Challenges
                    </button>
                    <Tooltip content="Save and activate this assessment">
                        <button 
                            onClick={handleDeployClick}
                            disabled={isGenerating}
                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="animate-spin w-5 h-5" /> : 'Deploy Configuration'}
                        </button>
                    </Tooltip>
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;