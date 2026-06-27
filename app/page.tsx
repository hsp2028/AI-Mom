'use client';

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Circle, 
  Trash2, 
  Plus, 
  Calendar, 
  Sparkles, 
  Clock, 
  LogOut, 
  Volume2, 
  User, 
  UserCheck, 
  Flame, 
  BookOpen, 
  AlertTriangle,
  Lock,
  AlertCircle,
  UploadCloud,
  ShieldAlert,
  Phone,
  X,
  Pencil,
  Save,
  Mic,
  Settings,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Definitions
type RoleType = 'Student' | 'Professional' | 'Entrepreneur';

interface Task {
  id?: string;
  userId?: string;
  title: string;
  dueDate: string;
  category: string;
  status: 'pending' | 'completed';
  createdAt?: any;
  role?: RoleType;
  estimatedEffort?: number;
}

interface UserProfile {
  name: string;
  role: RoleType;
  createdAt: any;
  emergencyName?: string;
  emergencyPhone?: string;
}

interface AIMomState {
  message: string;
  urgency: 'GREEN' | 'AMBER' | 'RED';
  actionItems: string[];
}

function useMomVoice() {
  const [isSpeaking, setIsSpeaking] = React.useState(false);
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const speak = React.useCallback((text: string, forceInterrupt = false) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (forceInterrupt || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    if (utteranceRef.current) {
      utteranceRef.current.onstart = null;
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }

    // Strip out emojis and quotes for cleaner speech synthesis delivery
    const cleanText = text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '').replace(/["'“”‘’]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;

    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(voice => 
      (voice.name.toLowerCase().includes('female') || 
       voice.name.toLowerCase().includes('google') ||
       voice.name.toLowerCase().includes('zira') ||
       voice.name.toLowerCase().includes('samantha') ||
       voice.name.toLowerCase().includes('hazel') ||
       voice.name.toLowerCase().includes('heera') ||
       voice.name.toLowerCase().includes('veena') ||
       voice.lang.toLowerCase().includes('en-in') ||
       voice.lang.startsWith('en')) && 
      !voice.name.toLowerCase().includes('male') &&
      !voice.name.toLowerCase().includes('david') &&
      !voice.name.toLowerCase().includes('mark')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.pitch = 1.1;
    utterance.rate = 1.05;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    window.speechSynthesis.getVoices();
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', handleVoicesChanged);
    };
  }, []);

  return { speak, stop, isSpeaking };
}

export default function Home() {
  // Speech Voice Engine
  const { speak, stop, isSpeaking } = useMomVoice();

  // Auth & Profile State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  
  // Onboarding Form
  const [onboardName, setOnboardName] = useState('Vineet');
  const [onboardRole, setOnboardRole] = useState<RoleType>('Student');
  const [savingOnboard, setSavingOnboard] = useState(false);

  // App State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleType>('Student');
  const [nagScores, setNagScores] = useState<Record<string, number>>({});

  // AI Mom State
  const [aiMomState, setAiMomState] = useState<AIMomState>({
    message: "Aiyoo, beta! Start studying or Sharma ji's son will get 100/100 and you will be sitting here with your face in that phone!",
    urgency: 'GREEN',
    actionItems: ["Put your phone in another room", "Sit straight on your chair", "Drink a glass of water"]
  });
  const [loadingAI, setLoadingAI] = useState(false);

  // New Task Form Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Education');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('17:00');
  const [newEstimatedEffort, setNewEstimatedEffort] = useState(1);

  // CRUD, Filter & Interaction States
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('17:00');
  const [editCategory, setEditCategory] = useState('Education');
  const [editEstimatedEffort, setEditEstimatedEffort] = useState(1);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Lockdown & Verification State
  const [simulateRedAlert, setSimulateRedAlert] = useState(false);
  const [textProof, setTextProof] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [verifyingProof, setVerifyingProof] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Postpone / Skip Task Escape Hatch State
  const [isExcusePanelOpen, setIsExcusePanelOpen] = useState(false);
  const [excuseAction, setExcuseAction] = useState<'Postpone' | 'Cancel'>('Postpone');
  const [excuseText, setExcuseText] = useState('');
  const [evaluatingExcuse, setEvaluatingExcuse] = useState(false);
  const [excuseFeedback, setExcuseFeedback] = useState<string | null>(null);
  const [isRefusingSimply, setIsRefusingSimply] = useState(false);
  const [isDisappointed, setIsDisappointed] = useState(false);
  const [approvalPenalty, setApprovalPenalty] = useState(0);

  // Google Calendar Integration State
  const [isCalendarSynced, setIsCalendarSynced] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStep, setSyncStep] = useState(0); // 0: Select account, 1: Request permissions, 2: Spinner, 3: Success
  const [selectedSyncEmail, setSelectedSyncEmail] = useState('');

  // Emergency Contact & Device Unreachable State
  const [emergencyName, setEmergencyName] = useState('Rahul (Roommate)');
  const [emergencyPhone, setEmergencyPhone] = useState('+91 98765 43210');
  const [simulateDeviceOff, setSimulateDeviceOff] = useState(false);
  const [escalationTimeout, setEscalationTimeout] = useState(30); // seconds countdown simulation
  const [isEscalated, setIsEscalated] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);

  // New automation & rating states
  const [isListening, setIsListening] = useState(false);
  const [completionStreak, setCompletionStreak] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('onTimeStreak');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  const [macroGoal, setMacroGoal] = useState('');
  const [planningTasks, setPlanningTasks] = useState(false);

  // Profile Settings States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsRole, setSettingsRole] = useState<RoleType>('Student');
  const [settingsEmergencyName, setSettingsEmergencyName] = useState('');
  const [settingsEmergencyPhone, setSettingsEmergencyPhone] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Load emergency contact from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('emergencyName');
      const savedPhone = localStorage.getItem('emergencyPhone');
      if (savedName) setEmergencyName(savedName);
      if (savedPhone) setEmergencyPhone(savedPhone);
    }
  }, []);

  // Memoized user's tasks matching active role
  const roleTasks = React.useMemo(() => {
    return tasks.filter(task => !task.role || task.role === activeRole);
  }, [tasks, activeRole]);

  // Determine if we have an active critical task under 30 minutes
  const isTaskUnder30Mins = React.useMemo(() => {
    const pending = roleTasks.filter(t => t.status === 'pending');
    if (simulateRedAlert) return true; // Simulated alert starts in the red tier (< 30m)

    const now = Date.now();
    for (const t of pending) {
      const diffMs = new Date(t.dueDate).getTime() - now;
      const diffMins = diffMs / (1000 * 60);
      if (diffMins > -120 && diffMins <= 30) {
        return true;
      }
    }
    return false;
  }, [roleTasks, simulateRedAlert]);

  // Countdown timer for Backup Contact Escalation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTaskUnder30Mins && !isEscalated && !simulateDeviceOff) {
      setIsCountingDown(true);
      timer = setInterval(() => {
        setEscalationTimeout((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsEscalated(true);
            setIsCountingDown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (!isTaskUnder30Mins) {
        setIsEscalated(false);
        setEscalationTimeout(30); // reset
      }
      setIsCountingDown(false);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isTaskUnder30Mins, isEscalated, simulateDeviceOff]);

  // Memoized sorted tasks based on server nag index scores
  const sortedTasks = React.useMemo(() => {
    return [...roleTasks].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'completed' ? 1 : -1;
      }
      
      // Both are pending or both are completed
      if (a.status === 'pending') {
        const scoreA = nagScores[a.id || ''] || 1;
        const scoreB = nagScores[b.id || ''] || 1;
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Descending order of nag index score
        }
      }
      
      // If score is same or completed, sort by due date
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [roleTasks, nagScores]);

  // Memoized filtered tasks based on selected toggle filter (All, Pending, Completed)
  const filteredTasks = React.useMemo(() => {
    return sortedTasks.filter((task) => {
      if (taskFilter === 'pending') return task.status === 'pending';
      if (taskFilter === 'completed') return task.status === 'completed';
      return true;
    });
  }, [sortedTasks, taskFilter]);

  // Memoized Mom's Approval Score based on unresolved tasks in AMBER or RED zones
  const approvalScore = React.useMemo(() => {
    let score = 100;
    const now = new Date();
    
    const pending = roleTasks.filter(t => t.status === 'pending');
    
    let amberCount = 0;
    let redCount = 0;
    
    for (const t of pending) {
      const diffMs = new Date(t.dueDate).getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours < 2) {
        redCount++;
      } else if (diffHours < 24) {
        amberCount++;
      }
    }
    
    score -= amberCount * 15;
    score -= redCount * 30;
    score -= approvalPenalty;
    
    return Math.max(0, Math.min(100, score));
  }, [roleTasks, approvalPenalty]);

  // Memoized critical task for lockdown (any task with < 2 hours remaining or if simulated)
  const criticalTask = React.useMemo(() => {
    const pending = roleTasks.filter(t => t.status === 'pending');
    if (simulateRedAlert) {
      if (pending.length > 0) {
        return pending[0];
      }
      return {
        id: 'simulated-critical-task',
        title: activeRole === 'Student' ? 'Submit Chemistry Lab Assignment' : activeRole === 'Professional' ? 'Wrap Up Quarterly Business Presentation' : 'Refine Pitch Deck for Seed Round VC Meeting',
        dueDate: new Date(Date.now() + 1800000).toISOString(), // 30 mins from now
        category: activeRole === 'Student' ? 'Education' : 'Strategy',
        status: 'pending' as const
      };
    }

    const now = new Date();
    for (const t of pending) {
      const diffMs = new Date(t.dueDate).getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours < 2) {
        return t;
      }
    }
    return null;
  }, [roleTasks, simulateRedAlert, activeRole]);

  // Memoized mood banner state based on the closest upcoming task's deadline
  const moodBannerState = React.useMemo(() => {
    if (criticalTask && (isEscalated || simulateDeviceOff)) {
      return {
        tier: 'RED' as const,
        mood: 'Escalating to Backup Contact 🚨☎️',
        bgColor: 'bg-[#FFF5F5] animate-pulse',
        borderColor: 'border-red-500',
        textColor: 'text-red-700',
        accentColor: 'bg-red-500',
        shadowColor: 'shadow-[6px_6px_0px_0px_#FF6B6B]',
        message: `Vineet's device is unresponsive. Sending critical SMS/WhatsApp alert to ${emergencyName} (${emergencyPhone}) immediately to wake them up!`,
        details: 'Escalating to Backup Contact'
      };
    }

    if (simulateRedAlert) {
      return {
        tier: 'RED' as const,
        mood: 'Furious & Overwhelmed 😡❤️',
        bgColor: 'bg-[#FFECEC] animate-pulse',
        borderColor: 'border-[#FF6B6B]',
        textColor: 'text-[#900C3F]',
        accentColor: 'bg-[#FF6B6B]',
        shadowColor: 'shadow-[6px_6px_0px_0px_#FF6B6B]',
        message: activeRole === 'Student'
          ? `Bacha, this is critical! "Submit Chemistry Lab Assignment" is due in less than 2 hours! Stop everything else and send me proof of submission right now!`
          : activeRole === 'Professional'
            ? `Beta! Your meeting/presentation "Wrap Up Quarterly Business Presentation" is starting in less than two hours! Stop slacking and upload proof of action immediately!`
            : `Beta! Your pitch deck "Refine Pitch Deck for Seed Round VC Meeting" is starting in less than two hours! Upload proof now or the business is dead!`,
        details: `Simulated RED Alert - High Alert!`
      };
    }

    const pendingTasks = roleTasks.filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) {
      return {
        tier: 'GREEN' as const,
        mood: 'Proud & Caring 👵🏽💚',
        bgColor: 'bg-[#E8F8F5]',
        borderColor: 'border-[#4ECDC4]',
        textColor: 'text-[#117A65]',
        accentColor: 'bg-[#4ECDC4]',
        shadowColor: 'shadow-[6px_6px_0px_0px_#4ECDC4]',
        message: activeRole === 'Student' 
          ? "Beta, all your focus tasks are completed! I am so proud of you! Go eat some soaked almonds and rest your eyes."
          : "Beta, you have cleared your desk! Excellent work. Take a deep breath, stretch, and maintain a healthy work-life balance.",
        details: "No pending focus tasks! Mom is extremely pleased."
      };
    }

    // Find the closest upcoming task
    const now = new Date();
    let closestTask: Task | null = null;
    let minDiffMs = Infinity;

    pendingTasks.forEach(task => {
      const due = new Date(task.dueDate);
      const diffMs = due.getTime() - now.getTime();
      if (diffMs < minDiffMs) {
        minDiffMs = diffMs;
        closestTask = task;
      }
    });

    if (!closestTask) {
      return {
        tier: 'GREEN' as const,
        mood: 'Proud & Caring 👵🏽💚',
        bgColor: 'bg-[#E8F8F5]',
        borderColor: 'border-[#4ECDC4]',
        textColor: 'text-[#117A65]',
        accentColor: 'bg-[#4ECDC4]',
        shadowColor: 'shadow-[6px_6px_0px_0px_#4ECDC4]',
        message: "Everything is under control, beta!",
        details: "No immediate deadlines."
      };
    }

    const diffHours = minDiffMs / (1000 * 60 * 60);

    if (diffHours < 2) {
      // RED TIER
      return {
        tier: 'RED' as const,
        mood: 'Furious & Overwhelmed 😡❤️',
        bgColor: 'bg-[#FFECEC] animate-pulse',
        borderColor: 'border-[#FF6B6B]',
        textColor: 'text-[#900C3F]',
        accentColor: 'bg-[#FF6B6B]',
        shadowColor: 'shadow-[6px_6px_0px_0px_#FF6B6B]',
        message: activeRole === 'Student'
          ? `Bacha, this is critical! "${(closestTask as Task).title}" is due in less than 2 hours! Stop everything else and send me proof of submission right now!`
          : `Beta! Your meeting/presentation "${(closestTask as Task).title}" is starting in less than two hours! Stop slacking and upload proof of action immediately!`,
        details: diffHours < 0 
          ? `OVERDUE by ${Math.abs(Math.round(diffHours * 10) / 10)} hours! Mom's anger is off the charts!`
          : `Due in only ${(Math.round(diffHours * 10) / 10)} hours! High Alert!`
      };
    } else if (diffHours <= 6) {
      // AMBER TIER
      return {
        tier: 'AMBER' as const,
        mood: 'Stressed & Nagging 🤨💛',
        bgColor: 'bg-[#FFF9E6]',
        borderColor: 'border-[#FFD93D]',
        textColor: 'text-[#B7950B]',
        accentColor: 'bg-[#FFD93D]',
        shadowColor: 'shadow-[6px_6px_0px_0px_#FFD93D]',
        message: activeRole === 'Student'
          ? `Sharma ji's son completed his work hours ago! Stop procrastinating and complete "${(closestTask as Task).title}" immediately!`
          : `Your core task "${(closestTask as Task).title}" is approaching fast, beta! Sit straight and finish your preparation before the meeting!`,
        details: `Due in ${Math.round(diffHours * 10) / 10} hours.`
      };
    } else {
      // GREEN TIER
      return {
        tier: 'GREEN' as const,
        mood: 'Proud & Caring 👵🏽💚',
        bgColor: 'bg-[#E8F8F5]',
        borderColor: 'border-[#4ECDC4]',
        textColor: 'text-[#117A65]',
        accentColor: 'bg-[#4ECDC4]',
        shadowColor: 'shadow-[6px_6px_0px_0px_#4ECDC4]',
        message: activeRole === 'Student'
          ? `Beta, did you eat your food? Don't stress too much about "${(closestTask as Task).title}", sleep on time and pace yourself.`
          : `Beta, take a deep breath. Remember to maintain work-life balance while working on "${(closestTask as Task).title}" and rest your eyes.`,
        details: `Due in ${Math.round(diffHours)} hours. You have ample time, pace yourself.`
      };
    }
  }, [roleTasks, activeRole, simulateRedAlert, criticalTask, isEscalated, simulateDeviceOff, emergencyName, emergencyPhone]);

  // Track previous mood tier for sound notifications
  const prevTierRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!moodBannerState) return;
    const currentTier = moodBannerState.tier;
    const message = moodBannerState.message;

    if (prevTierRef.current !== null && prevTierRef.current !== currentTier) {
      if (currentTier === 'AMBER') {
        speak(message, false);
      } else if (currentTier === 'RED') {
        speak(message, true);
      }
    }
    prevTierRef.current = currentTier;
  }, [moodBannerState, speak]);

  // Toast / Status Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sound feedback toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Trigger Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Play a simple synthesized audio tone for Mom's notification
  const playMomTone = (type: 'green' | 'amber' | 'red') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'red') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330, ctx.currentTime);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'amber') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(392, ctx.currentTime);
        osc.frequency.setValueAtTime(523, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      // Audio context may not be allowed on first gesture
    }
  };

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoadingAuth(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        await loadUserProfile(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
        setTasks([]);
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Google Calendar state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const synced = localStorage.getItem('isCalendarSynced') === 'true';
      setIsCalendarSynced(synced);
      if (synced) {
        setSelectedSyncEmail(localStorage.getItem('calendarSyncedEmail') || 'harshitsinghp8@gmail.com');
      }
    }
  }, []);

  // Simulate Google Calendar Sync Flow
  const handleCalendarSync = async () => {
    if (isCalendarSynced) {
      const confirmDisconnect = window.confirm(
        `Your Google Calendar is already synchronized as ${selectedSyncEmail}. Do you want to disconnect your calendar?`
      );
      if (confirmDisconnect) {
        setIsCalendarSynced(false);
        setSelectedSyncEmail('');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('isCalendarSynced');
          localStorage.removeItem('calendarSyncedEmail');
        }
        showToast("Google Calendar disconnected successfully.");
      }
      return;
    }

    setSyncStep(0);
    setIsSyncModalOpen(true);
  };

  // Perform the 2-second simulation once the user selects an account & grants permissions
  const startSyncSimulation = async (email: string) => {
    setSelectedSyncEmail(email);
    setSyncStep(2); // Go to loader page (spinner)

    // Wait 2 seconds to simulate calendar.events.readonly permission fetching
    setTimeout(async () => {
      setSyncStep(3); // Go to success page

      setIsCalendarSynced(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('isCalendarSynced', 'true');
        localStorage.setItem('calendarSyncedEmail', email);
      }

      if (!user) return;

      try {
        let newTask: Omit<Task, 'id'>;

        if (activeRole === 'Student') {
          newTask = {
            userId: user.uid,
            title: "Data Structures Lab Exam",
            category: "Education",
            dueDate: new Date(Date.now() + 90 * 60 * 1000).toISOString(), // 90 mins from now (triggers RED ALERT)
            status: 'pending',
            createdAt: serverTimestamp(),
            role: 'Student',
            estimatedEffort: 3
          };
        } else if (activeRole === 'Professional') {
          newTask = {
            userId: user.uid,
            title: "Q2 Sprint Code Review",
            category: "Work",
            dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now (triggers AMBER alert)
            status: 'pending',
            createdAt: serverTimestamp(),
            role: 'Professional',
            estimatedEffort: 2
          };
        } else {
          newTask = {
            userId: user.uid,
            title: "Investor Pitch Deck Submission",
            category: "Investor Relations",
            dueDate: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), // 20 hours from now (triggers GREEN alert)
            status: 'pending',
            createdAt: serverTimestamp(),
            role: 'Entrepreneur',
            estimatedEffort: 4
          };
        }

        // Add to Firestore database
        await addDoc(collection(db, 'tasks'), newTask);
        showToast(`Successfully synchronized! Pulled "${newTask.title}" from your calendar.`);
      } catch (err) {
        console.error('Failed to save calendar task:', err);
        showToast('Aiyoo, synced calendar but couldn\'t add the task to Firestore. Try again!');
      }
    }, 2000);
  };

  // Load User Profile from Firestore
  const loadUserProfile = async (firebaseUser: FirebaseUser) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data() as UserProfile;
        setProfile(data);
        setActiveRole(data.role);
        
        // Initialize settings fields
        setSettingsName(data.name || 'Vineet');
        setSettingsRole(data.role || 'Student');
        
        const backupName = data.emergencyName || 'Rahul (Roommate)';
        const backupPhone = data.emergencyPhone || '+91 98765 43210';
        setSettingsEmergencyName(backupName);
        setSettingsEmergencyPhone(backupPhone);
        setEmergencyName(backupName);
        setEmergencyPhone(backupPhone);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('emergencyName', backupName);
          localStorage.setItem('emergencyPhone', backupPhone);
        }

        // Start listening to real-time tasks for this user and role
        setupTasksListener(firebaseUser.uid, data.role);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoadingAuth(false);
    }
  };

  // Fetch Nag scores from server
  const fetchNagScores = async (currentTasks: Task[], currentRole: RoleType) => {
    if (currentTasks.length === 0) {
      setNagScores({});
      return;
    }
    try {
      const res = await fetch('/api/nag-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: currentTasks, role: currentRole })
      });
      if (res.ok) {
        const data = await res.json();
        setNagScores(data.scores || {});
      }
    } catch (e) {
      console.error('Failed to fetch nag scores:', e);
    }
  };

  // Listen to Tasks in Real-time
  const setupTasksListener = (uid: string, role: RoleType) => {
    setLoadingTasks(true);
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((doc) => {
        tasksData.push({ id: doc.id, ...doc.data() } as Task);
      });
      
      // Sort: Completed tasks at the bottom, then by due date
      tasksData.sort((a, b) => {
        if (a.status === b.status) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return a.status === 'completed' ? 1 : -1;
      });

      setTasks(tasksData);
      setLoadingTasks(false);
      
      // Filter tasks by active role for the AI calculations
      const roleSpecificTasks = tasksData.filter(task => !task.role || task.role === role);
      
      // Fetch nag scores from server for role-specific tasks
      fetchNagScores(roleSpecificTasks, role);
      // Trigger Mom nudge on load or change for role-specific tasks
      triggerMomNudge(roleSpecificTasks, role);
    }, (err) => {
      console.error('Error fetching tasks:', err);
      setLoadingTasks(false);
    });

    return unsubscribe;
  };

  // Google Login
  const handleLogin = async () => {
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Login failed:', err);
      showToast('Aiyoo, log in failed bacha! Try again.');
    } finally {
      setSigningIn(false);
    }
  };

  // Sign Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Logged out! Bye bacha, eat your meals on time!');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Onboard User with standard starter tasks
  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingOnboard(true);
    try {
      const profileData: UserProfile = {
        name: onboardName.trim() || 'Vineet',
        role: onboardRole,
        createdAt: serverTimestamp(),
        emergencyName: 'Rahul (Roommate)',
        emergencyPhone: '+91 98765 43210'
      };

      setSettingsName(profileData.name);
      setSettingsRole(profileData.role);
      setSettingsEmergencyName('Rahul (Roommate)');
      setSettingsEmergencyPhone('+91 98765 43210');
      setEmergencyName('Rahul (Roommate)');
      setEmergencyPhone('+91 98765 43210');

      if (typeof window !== 'undefined') {
        localStorage.setItem('emergencyName', 'Rahul (Roommate)');
        localStorage.setItem('emergencyPhone', '+91 98765 43210');
      }

      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, profileData);
      setProfile(profileData);
      setActiveRole(onboardRole);

      // Pre-populate with beautiful, thematic starter tasks based on role
      const starterTasks: Omit<Task, 'id'>[] = [];
      const today = new Date();
      
      const formatTime = (hours: number, mins: number = 0) => {
        const d = new Date();
        d.setHours(hours, mins, 0, 0);
        return d.toISOString();
      };

      if (onboardRole === 'Student') {
        starterTasks.push(
          {
            userId: user.uid,
            title: "Complete Organic Chem Lab Report",
            category: "Education",
            dueDate: formatTime(17, 0), // Today, 5:00 PM
            status: "pending",
            createdAt: serverTimestamp(),
            role: 'Student',
            estimatedEffort: 3
          },
          {
            userId: user.uid,
            title: "Study for Calculus Midterm",
            category: "Education",
            dueDate: formatTime(9, 0), // Tomorrow, 9:00 AM
            status: "pending",
            createdAt: serverTimestamp(),
            role: 'Student',
            estimatedEffort: 5
          },
          {
            userId: user.uid,
            title: "Submit Literature Review Assignment",
            category: "Writing",
            dueDate: formatTime(23, 59), // Tonight, 11:59 PM
            status: "pending",
            createdAt: serverTimestamp(),
            role: 'Student',
            estimatedEffort: 2
          }
        );
      } else if (onboardRole === 'Professional') {
        starterTasks.push(
          {
            userId: user.uid,
            title: "Review Q4 Budget Allocation Excel",
            category: "Finance",
            dueDate: formatTime(15, 0), // Today, 3:00 PM
            status: "pending",
            createdAt: serverTimestamp(),
            role: 'Professional',
            estimatedEffort: 4
          },
          {
            userId: user.uid,
            title: "Submit Client Project Deck Slides",
            category: "Work",
            dueDate: formatTime(18, 0), // Today, 6:00 PM
            status: "pending",
            createdAt: serverTimestamp(),
            role: 'Professional',
            estimatedEffort: 3
          }
        );
      } else {
        starterTasks.push(
          {
            userId: user.uid,
            title: "Finalize Series A Pitch Deck draft",
            category: "Strategy",
            dueDate: formatTime(12, 0), // Today, 12:00 PM
            status: "pending",
            createdAt: serverTimestamp(),
            role: 'Entrepreneur',
            estimatedEffort: 4
          },
          {
            userId: user.uid,
            title: "Email Q3 Updates to Existing Investors",
            category: "Investor Relations",
            dueDate: formatTime(10, 0), // Tomorrow, 10:00 AM
            status: "pending",
            createdAt: serverTimestamp(),
            role: 'Entrepreneur',
            estimatedEffort: 1
          }
        );
      }

      // Add starter tasks sequentially to Firestore
      for (const t of starterTasks) {
        await addDoc(collection(db, 'tasks'), t);
      }

      showToast(`Welcome bacha! AI-Mom has pre-populated ${starterTasks.length} tasks!`);
      setupTasksListener(user.uid, onboardRole);

    } catch (err) {
      console.error('Onboarding failed:', err);
      showToast('Aiyoo, couldn\'t save your profile. Try again!');
    } finally {
      setSavingOnboard(false);
    }
  };

  // Get dynamic Mom's nag/nudge from server AI-Mom route
  const triggerMomNudge = async (currentTasks: Task[], currentRole: RoleType) => {
    setLoadingAI(true);
    try {
      const response = await fetch('/api/ai-mom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: currentTasks,
          activeRole: currentRole,
          name: profile?.name || 'Vineet'
        })
      });
      const data = await response.json();
      setAiMomState(data);
      playMomTone(data.urgency.toLowerCase());
    } catch (err) {
      console.error('Failed to nudge:', err);
    } finally {
      setLoadingAI(false);
    }
  };

  // Switch role profile manually to see different vibes
  const handleRoleChange = async (newRole: RoleType) => {
    if (!user || !profile) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { role: newRole });
      setProfile({ ...profile, role: newRole });
      setActiveRole(newRole);
      showToast(`Vibe changed to ${newRole}! Mom is adjusting her stance...`);
      setupTasksListener(user.uid, newRole);
    } catch (err) {
      console.error('Failed to change role:', err);
    }
  };

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim() || !newDueDate) return;

    try {
      // Merge date and time
      const datetimeStr = `${newDueDate}T${newDueTime || '17:00'}:00`;
      const dateObj = new Date(datetimeStr);

      const taskData: Omit<Task, 'id'> = {
        userId: user.uid,
        title: newTitle.trim(),
        category: newCategory,
        dueDate: dateObj.toISOString(),
        status: 'pending',
        createdAt: serverTimestamp(),
        role: activeRole,
        estimatedEffort: newEstimatedEffort
      };

      await addDoc(collection(db, 'tasks'), taskData);
      
      // Reset form & close modal
      setNewTitle('');
      setNewCategory('Education');
      setNewDueDate('');
      setNewDueTime('17:00');
      setNewEstimatedEffort(1);
      setIsAddModalOpen(false);
      showToast('Task added bacha! Better start working on it!');
    } catch (err) {
      console.error('Add task failed:', err);
      showToast('Aiyoo, couldn\'t add the task. Try again!');
    }
  };

  // Toggle Task Completed
  const handleToggleTask = async (id: string, currentStatus: 'pending' | 'completed') => {
    try {
      const taskRef = doc(db, 'tasks', id);
      const nextStatus = currentStatus === 'pending' ? 'completed' : 'pending';
      await updateDoc(taskRef, { status: nextStatus });
      
      if (nextStatus === 'completed') {
        const taskObj = tasks.find(t => t.id === id);
        if (taskObj) {
          const diffMs = new Date(taskObj.dueDate).getTime() - Date.now();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours >= 2) {
            setCompletionStreak(prev => {
              const next = prev + 1;
              if (typeof window !== 'undefined') {
                localStorage.setItem('onTimeStreak', String(next));
              }
              return next;
            });
            showToast('Very good beta! I knew you could do it! Streak increased bacha!');
          } else {
            showToast('Very good, but you completed it in RED alert zone! No streak increase,Sharma ji wants on-time submittals!');
          }
        } else {
          showToast('Very good beta! I knew you could do it! Proud of you!');
        }
      } else {
        setCompletionStreak(prev => {
          const next = Math.max(0, prev - 1);
          if (typeof window !== 'undefined') {
            localStorage.setItem('onTimeStreak', String(next));
          }
          return next;
        });
        showToast('What?! Why did you unmark it? Sharma ji will hear about this!');
      }
    } catch (err) {
      console.error('Toggle task failed:', err);
    }
  };

  // Verify lockdown proof with Gemini
  const handleVerifyLockdownProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!criticalTask) return;
    setVerifyingProof(true);
    setVerificationFeedback(null);

    try {
      const res = await fetch('/api/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textProof: textProof,
          fileName: proofFileName || null,
          role: activeRole,
          taskTitle: criticalTask.title
        })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.verified) {
          // If it is a real task in Firestore, update it to completed
          if (criticalTask.id && criticalTask.id !== 'simulated-critical-task') {
            const taskRef = doc(db, 'tasks', criticalTask.id);
            await updateDoc(taskRef, { status: 'completed' });
          } else {
            // Simulated critical task: complete first pending task or just clear simulation
            const pending = roleTasks.filter(t => t.status === 'pending');
            if (pending.length > 0 && pending[0].id) {
              const taskRef = doc(db, 'tasks', pending[0].id);
              await updateDoc(taskRef, { status: 'completed' });
            }
          }

          // Complete verification
          showToast(result.feedback || 'Excellent work beta! I am proud of you!');
          setTextProof('');
          setProofFileName('');
          setSimulateRedAlert(false);
        } else {
          setVerificationFeedback(result.feedback || "Mom knows you are cutting corners! Try again with a genuine proof description.");
        }
      } else {
        setVerificationFeedback("Beta, there was an issue communicating with my thoughts. Do not try to cheat, rewrite and submit again!");
      }
    } catch (err) {
      console.error('Proof verification failed:', err);
      setVerificationFeedback("Aiyoo, network error. Mom's connection is loose! Try again, beta.");
    } finally {
      setVerifyingProof(false);
    }
  };

  // Submit excuse for evaluation
  const handleEvaluateExcuse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!criticalTask) return;

    if (isRefusingSimply) {
      setEvaluatingExcuse(true);
      setExcuseFeedback(null);
      try {
        // Drop approval rating by 25% and set disappointing state
        setApprovalPenalty(prev => prev + 25);
        setIsDisappointed(true);

        // Guilt-trip speech
        const guiltTrip = activeRole === 'Student'
          ? "Fine! Don't do your study tasks. See what happens when your friends clear the placement rounds and you are left sitting at home!"
          : "Fine, give up! Your peers are out there building empires while you can't even finish a simple checklist item. Do whatever you want, I'm done talking!";

        speak(guiltTrip, true);

        // Update task in Firestore
        if (criticalTask.id && criticalTask.id !== 'simulated-critical-task') {
          const taskRef = doc(db, 'tasks', criticalTask.id);
          await updateDoc(taskRef, { status: 'completed', refused: true, notes: `Simply refused by user.` });
        } else {
          // Simulated critical task or pending first
          const pending = roleTasks.filter(t => t.status === 'pending');
          if (pending.length > 0 && pending[0].id) {
            const taskRef = doc(db, 'tasks', pending[0].id);
            await updateDoc(taskRef, { status: 'completed', refused: true, notes: `Simply refused by user.` });
          }
        }

        // Clear states & lockdown
        setExcuseText('');
        setIsRefusingSimply(false);
        setIsExcusePanelOpen(false);
        setSimulateRedAlert(false);
        showToast("Task simply refused.");
      } catch (err) {
        console.error('Refusal failed:', err);
        const errorMsg = "Aiyoo, network error. Mom's connection is loose! Try again, beta.";
        setExcuseFeedback(errorMsg);
        speak(errorMsg, true);
      } finally {
        setEvaluatingExcuse(false);
      }
      return;
    }

    if (excuseText.trim().length < 25) {
      const errorMsg = "That is a terrible excuse! I did not raise a slacker. Back to work! Make sure your explanation is at least 25 characters long!";
      setExcuseFeedback(errorMsg);
      speak(errorMsg, true);
      return;
    }
    setEvaluatingExcuse(true);
    setExcuseFeedback(null);

    try {
      const res = await fetch('/api/ai-mom/evaluate-excuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excuse: excuseText,
          action: excuseAction,
          taskTitle: criticalTask.title,
          name: profile?.name || 'Vineet',
          role: activeRole,
        })
      });

      if (res.ok) {
        const result = await res.json();
        if (result.approved) {
          // Speak approval
          speak(result.feedback || 'Fine, your health comes first. Rest up, but we finish this tomorrow.', true);
          showToast(result.feedback || 'Excuse Approved!');

          // Update task in Firestore
          if (criticalTask.id && criticalTask.id !== 'simulated-critical-task') {
            const taskRef = doc(db, 'tasks', criticalTask.id);
            if (excuseAction === 'Postpone') {
              // Automatically push deadline forward by exactly 24 hours
              const currentDueDate = new Date(criticalTask.dueDate);
              const newDueDate = new Date(currentDueDate.getTime() + 24 * 60 * 60 * 1000);
              await updateDoc(taskRef, { dueDate: newDueDate.toISOString() });
            } else {
              // Cancel: Change task status to completed (or archived with a note)
              await updateDoc(taskRef, { status: 'completed', notes: `Cancelled by user. Excuse: ${excuseText}` });
            }
          } else {
            // Simulated critical task: complete first pending task or just clear simulation
            const pending = roleTasks.filter(t => t.status === 'pending');
            if (pending.length > 0 && pending[0].id) {
              const taskRef = doc(db, 'tasks', pending[0].id);
              if (excuseAction === 'Postpone') {
                const currentDueDate = new Date(pending[0].dueDate);
                const newDueDate = new Date(currentDueDate.getTime() + 24 * 60 * 60 * 1000);
                await updateDoc(taskRef, { dueDate: newDueDate.toISOString() });
              } else {
                await updateDoc(taskRef, { status: 'completed', notes: `Cancelled by user. Excuse: ${excuseText}` });
              }
            }
          }

          // Clear states & lockdown
          setExcuseText('');
          setIsExcusePanelOpen(false);
          setSimulateRedAlert(false);
        } else {
          setExcuseFeedback(result.feedback || "That is a terrible excuse! I did not raise a slacker. Back to work!");
          speak(result.feedback || "That is a terrible excuse! I did not raise a slacker. Back to work!", true);
        }
      } else {
        const errorMsg = "That is a terrible excuse! I did not raise a slacker. Back to work!";
        setExcuseFeedback(errorMsg);
        speak(errorMsg, true);
      }
    } catch (err) {
      console.error('Excuse evaluation failed:', err);
      const errorMsg = "Aiyoo, network error. Mom's connection is loose! Try again, beta.";
      setExcuseFeedback(errorMsg);
      speak(errorMsg, true);
    } finally {
      setEvaluatingExcuse(false);
    }
  };

  // Autonomous Planner: Call server-side Gemini to break goal into exactly 4 subtasks
  const handleMomPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!macroGoal.trim()) {
      showToast("Beta, write a proper goal! Don't submit blank paper!");
      return;
    }
    if (!user) {
      showToast("Please sign in first bacha!");
      return;
    }

    setPlanningTasks(true);
    showToast("Mom is carefully analyzing your study goal... Get ready!");

    try {
      const res = await fetch('/api/ai-mom/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          macroGoal: macroGoal.trim(),
          role: activeRole,
          name: profile?.name || onboardName || 'Vineet'
        })
      });

      if (!res.ok) {
        throw new Error("Failed to plan goals");
      }

      const data = await res.json();
      const subtasks = data.subtasks;
      
      if (!subtasks || !Array.isArray(subtasks)) {
        throw new Error("Invalid subtasks received");
      }

      // Inject tasks into Firestore sequentially
      for (const st of subtasks) {
        const targetDate = new Date(Date.now() + st.dueDateOffsetHours * 60 * 60 * 1000);
        
        const taskData = {
          userId: user.uid,
          title: st.title,
          category: st.category || 'Education',
          dueDate: targetDate.toISOString(),
          status: 'pending',
          createdAt: serverTimestamp(),
          role: activeRole,
          estimatedEffort: st.estimatedEffort || 2
        };

        await addDoc(collection(db, 'tasks'), taskData);
      }

      setMacroGoal('');
      showToast("Decree written! Exactly 4 assignments added to your schedule. No excuses!");
    } catch (err) {
      console.error("Failed to plan:", err);
      showToast("Aiyoo, couldn't reach Mom's planning desk!");
    } finally {
      setPlanningTasks(false);
    }
  };

  // Voice Assistance Simulator: execute preset command
  const executeVoiceCommand = async (commandKey: string) => {
    if (!user) {
      showToast("Bacha, sign in first!");
      return;
    }
    
    setIsListening(true);
    showToast("Parsing natural command... Please wait, bacha!");
    
    // Simulate natural speaking delay
    await new Promise((resolve) => setTimeout(resolve, 1200));

    try {
      if (commandKey === 'add-meeting') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const taskData = {
          userId: user.uid,
          title: "Team alignment meeting (No sleeping!)",
          category: "Work",
          dueDate: tomorrow.toISOString(),
          status: 'pending',
          createdAt: serverTimestamp(),
          role: activeRole,
          estimatedEffort: 2
        };
        await addDoc(collection(db, 'tasks'), taskData);
        showToast("🎙️ Command executed: Team meeting added for tomorrow 10:00 AM!");
      } 
      else if (commandKey === 'complete-layout') {
        const pending = roleTasks.filter(t => t.status === 'pending');
        const match = pending.find(t => t.title.toLowerCase().includes('project') || t.title.toLowerCase().includes('layout')) || pending[0];
        
        if (match && match.id) {
          const taskRef = doc(db, 'tasks', match.id);
          await updateDoc(taskRef, { status: 'completed' });
          
          // Trigger completion streak update
          const diffMs = new Date(match.dueDate).getTime() - Date.now();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours >= 2) {
            setCompletionStreak(prev => {
              const next = prev + 1;
              if (typeof window !== 'undefined') {
                localStorage.setItem('onTimeStreak', String(next));
              }
              return next;
            });
          }
          showToast(`🎙️ Command executed: Completed "${match.title}"!`);
        } else {
          showToast("🎙️ Mom couldn't find any pending task to complete!");
        }
      }
      else if (commandKey === 'add-physics') {
        const tonight = new Date();
        tonight.setHours(21, 0, 0, 0);

        const taskData = {
          userId: user.uid,
          title: "Physics exam practice - Solve previous 3 papers!",
          category: "Education",
          dueDate: tonight.toISOString(),
          status: 'pending',
          createdAt: serverTimestamp(),
          role: activeRole,
          estimatedEffort: 3
        };
        await addDoc(collection(db, 'tasks'), taskData);
        showToast("🎙️ Command executed: Physics exam practice added for tonight 9:00 PM!");
      }
      else if (commandKey === 'add-milk') {
        const today = new Date();
        today.setHours(17, 0, 0, 0);

        const taskData = {
          userId: user.uid,
          title: "Buy milk and bread - Don't forget, bacha!",
          category: "Personal",
          dueDate: today.toISOString(),
          status: 'pending',
          createdAt: serverTimestamp(),
          role: activeRole,
          estimatedEffort: 1
        };
        await addDoc(collection(db, 'tasks'), taskData);
        showToast("🎙️ Command executed: Buy milk added for today 5:00 PM!");
      }
    } catch (err) {
      console.error("Voice command execution failed:", err);
      showToast("Aiyoo, voice parsing failed!");
    } finally {
      setIsListening(false);
    }
  };

  // Save Settings Changes & Recalculate
  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!settingsName.trim()) {
      showToast("Beta, name cannot be blank!");
      return;
    }
    if (!settingsEmergencyName.trim() || !settingsEmergencyPhone.trim()) {
      showToast("Beta, backup contact details are required for your own safety!");
      return;
    }

    setSavingSettings(true);
    showToast("Updating Mom's records...");

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: settingsName.trim(),
        role: settingsRole,
        emergencyName: settingsEmergencyName.trim(),
        emergencyPhone: settingsEmergencyPhone.trim()
      });

      // Update local profile state
      setProfile({
        ...profile,
        name: settingsName.trim(),
        role: settingsRole,
        emergencyName: settingsEmergencyName.trim(),
        emergencyPhone: settingsEmergencyPhone.trim()
      });

      // Update emergency local states
      setEmergencyName(settingsEmergencyName.trim());
      setEmergencyPhone(settingsEmergencyPhone.trim());
      if (typeof window !== 'undefined') {
        localStorage.setItem('emergencyName', settingsEmergencyName.trim());
        localStorage.setItem('emergencyPhone', settingsEmergencyPhone.trim());
      }

      // If Active Persona Role changed, trigger refresh of task grid & context
      if (settingsRole !== activeRole) {
        setActiveRole(settingsRole);
        setupTasksListener(user.uid, settingsRole);
        showToast("Vibe changed! Mom is adjusting her stance & task list...");
      }

      showToast("Profile updated successfully!");
      setIsSettingsOpen(false);
    } catch (err) {
      console.error("Failed to save settings:", err);
      showToast("Aiyoo, couldn't update profile in Firestore!");
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Inline Edited Task
  const handleSaveEdit = async (taskId: string) => {
    if (!editTitle.trim() || !editDueDate) {
      showToast("Bacha, enter a title and select a date!");
      return;
    }
    try {
      const datetimeStr = `${editDueDate}T${editDueTime || '17:00'}:00`;
      const dateObj = new Date(datetimeStr);
      
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        title: editTitle.trim(),
        category: editCategory,
        dueDate: dateObj.toISOString(),
        estimatedEffort: editEstimatedEffort,
        updatedAt: serverTimestamp()
      });
      
      setEditingTaskId(null);
      showToast("Task updated bacha! Mom's sharp eye is watching...");
    } catch (err) {
      console.error("Failed to update task:", err);
      showToast("Aiyoo, couldn't save edits!");
    }
  };

  // Delete Task
  const handleDeleteTask = async (id: string) => {
    try {
      const taskRef = doc(db, 'tasks', id);
      await deleteDoc(taskRef);
      showToast('Task removed. Don\'t think you can escape your duties though!');
    } catch (err) {
      console.error('Delete task failed:', err);
    }
  };

  // Helper: Format due dates into beautiful human strings
  const getDueLabel = (dueDateStr: string) => {
    try {
      const date = new Date(dueDateStr);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      const formatTimeOnly = (d: Date) => {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      };

      if (diffHours < 0) {
        return { label: `Overdue! (${Math.abs(Math.round(diffHours))}h ago)`, urgent: true };
      }

      const isToday = date.toDateString() === now.toDateString();
      const isTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();

      if (isToday) {
        return { label: `Today at ${formatTimeOnly(date)}`, urgent: diffHours < 2 };
      } else if (isTomorrow) {
        return { label: `Tomorrow at ${formatTimeOnly(date)}`, urgent: false };
      } else {
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
        return { label: date.toLocaleDateString([], options), urgent: false };
      }
    } catch (e) {
      return { label: dueDateStr, urgent: false };
    }
  };

  // Loading Screen
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-[#FFFAF2] flex flex-col items-center justify-center p-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="w-16 h-16 border-4 border-[#FF6B6B] border-t-transparent rounded-full shadow-lg"
        />
        <p className="mt-6 text-xl font-black text-[#2D3436] tracking-tight">AI-Mom is gathering her thoughts...</p>
      </div>
    );
  }

  // Auth/Login View
  if (!user) {
    return (
      <div className="min-h-screen bg-[#FFFAF2] flex flex-col items-center justify-center p-6">
        <div id="login-card" className="w-full max-w-md bg-white border-4 border-[#2D3436] rounded-[2.5rem] shadow-[12px_12px_0px_0px_#2D3436] overflow-hidden">
          <div className="bg-[#2D3436] px-8 py-8 text-center border-b-4 border-[#2D3436]">
            <div className="w-20 h-20 bg-[#FF6B6B] rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-lg mx-auto border-2 border-white mb-4">
              AI
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight">
              AI-<span className="text-[#FF6B6B]">MOM</span>
            </h1>
            <p className="text-[#FFEAA7] text-sm font-bold uppercase tracking-wider mt-2">
              Deeply Caring & Strict Accountability
            </p>
          </div>

          <div className="p-8 space-y-6 text-center">
            <p className="text-slate-700 font-medium leading-relaxed">
              Bacha! Have you been ignoring deadlines? Getting distracted by your phone? 
              I am here to ensure you sit at your desk, study hard, and submit assignments on time. 
              No excuses, sign in with Google now!
            </p>

            <button
              id="google-signin-btn"
              onClick={handleLogin}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-4 py-4 px-6 bg-[#FFEAA7] text-[#2D3436] border-4 border-[#2D3436] rounded-2xl shadow-[6px_6px_0px_0px_#2D3436] hover:translate-y-0.5 active:translate-y-1 transition-all text-xl font-black disabled:opacity-50"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {signingIn ? 'KNOCKING ON THE GATE...' : 'SIGN IN WITH GOOGLE'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding Profile Creation View
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#FFFAF2] flex flex-col items-center justify-center p-6">
        <div id="onboard-card" className="w-full max-w-lg bg-white border-4 border-[#2D3436] rounded-[2.5rem] shadow-[12px_12px_0px_0px_#2D3436] overflow-hidden">
          <div className="bg-[#2D3436] px-8 py-6 border-b-4 border-[#2D3436] text-center">
            <h2 className="text-3xl font-black text-white tracking-tight">MOM&apos;S ONBOARDING REGISTRY</h2>
            <p className="text-[#FFEAA7] text-xs font-black uppercase tracking-widest mt-1">First step of accountability</p>
          </div>

          <form onSubmit={handleOnboard} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-lg font-black text-[#2D3436] uppercase tracking-wide flex items-center gap-2">
                <User className="w-5 h-5 text-[#FF6B6B]" />
                What should I call you, beta?
              </label>
              <input
                id="onboard-name-input"
                type="text"
                value={onboardName}
                onChange={(e) => setOnboardName(e.target.value)}
                required
                placeholder="Vineet"
                className="w-full p-4 border-4 border-[#2D3436] rounded-2xl bg-[#FFFAF2] text-xl font-black focus:outline-none focus:shadow-[4px_4px_0px_0px_#2D3436] transition-all"
              />
            </div>

            <div className="space-y-3">
              <label className="text-lg font-black text-[#2D3436] uppercase tracking-wide flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#4ECDC4]" />
                Choose Your Life Vibe (Role)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setOnboardRole('Student')}
                  className={`flex flex-col items-center justify-center p-4 border-4 rounded-2xl transition-all ${
                    onboardRole === 'Student' 
                      ? 'bg-[#FFEAA7] border-[#FF6B6B] shadow-[4px_4px_0px_0px_#FF6B6B]' 
                      : 'bg-white border-[#2D3436]'
                  }`}
                >
                  <span className="text-3xl">🎓</span>
                  <span className="font-black text-sm mt-1 text-[#2D3436]">Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOnboardRole('Professional')}
                  className={`flex flex-col items-center justify-center p-4 border-4 rounded-2xl transition-all ${
                    onboardRole === 'Professional' 
                      ? 'bg-[#E8F8F5] border-[#4ECDC4] shadow-[4px_4px_0px_0px_#4ECDC4]' 
                      : 'bg-white border-[#2D3436]'
                  }`}
                >
                  <span className="text-3xl">💼</span>
                  <span className="font-black text-sm mt-1 text-[#2D3436]">Professional</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOnboardRole('Entrepreneur')}
                  className={`flex flex-col items-center justify-center p-4 border-4 rounded-2xl transition-all ${
                    onboardRole === 'Entrepreneur' 
                      ? 'bg-[#FFF9E6] border-[#FFD93D] shadow-[4px_4px_0px_0px_#FFD93D]' 
                      : 'bg-white border-[#2D3436]'
                  }`}
                >
                  <span className="text-3xl">🚀</span>
                  <span className="font-black text-sm mt-1 text-[#2D3436]">Entrepreneur</span>
                </button>
              </div>
            </div>

            <button
              id="submit-onboard-btn"
              type="submit"
              disabled={savingOnboard}
              className="w-full py-4 px-6 bg-[#FF6B6B] text-white border-4 border-[#2D3436] rounded-2xl shadow-[6px_6px_0px_0px_#2D3436] hover:translate-y-0.5 active:translate-y-1 transition-all text-xl font-black disabled:opacity-50"
            >
              {savingOnboard ? 'REGISTERING IN MOM\'S LOG...' : 'START NAGGING ME!'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active styles based on urgency
  const getUrgencyStyles = (level: 'GREEN' | 'AMBER' | 'RED') => {
    switch (level) {
      case 'RED':
        return {
          bg: 'bg-[#FFECEC]',
          border: 'border-[#FF6B6B]',
          text: 'text-[#FF6B6B]',
          bubbleBg: 'bg-white border-[#FF6B6B] shadow-[4px_4px_0px_0px_#FF6B6B]',
          indicator: '🔴 RED ALERT'
        };
      case 'AMBER':
        return {
          bg: 'bg-[#FFF9E6]',
          border: 'border-[#FFD93D]',
          text: 'text-[#F9CA24]',
          bubbleBg: 'bg-white border-[#FFD93D] shadow-[4px_4px_0px_0px_#FFD93D]',
          indicator: '🟡 NAGGING LEVEL: HIGH'
        };
      default:
        return {
          bg: 'bg-[#F2FBF9]',
          border: 'border-[#4ECDC4]',
          text: 'text-[#4ECDC4]',
          bubbleBg: 'bg-white border-[#4ECDC4] shadow-[4px_4px_0px_0px_#4ECDC4]',
          indicator: '🟢 ALL GOOD FOR NOW'
        };
    }
  };

  const currentStyles = getUrgencyStyles(aiMomState.urgency);

  return (
    <div className="min-h-screen bg-[#FFFAF2] font-sans pb-16 flex flex-col">
      {/* Header Section */}
      <header id="app-header" className="flex items-center justify-between px-6 md:px-10 py-6 bg-white border-b-4 border-[#FF6B6B] shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 md:w-14 md:h-14 bg-[#FF6B6B] rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl font-bold shadow-lg border-2 border-[#2D3436]">
            AI
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-[#2D3436]">
            AI-<span className="text-[#FF6B6B]">MOM</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-black text-[#636E72] uppercase tracking-wider">Welcome Back, beta</p>
            <p className="text-lg font-black text-[#2D3436]">{profile.name}</p>
          </div>
          <div className="w-12 h-12 bg-[#FFEAA7] rounded-full border-4 border-[#2D3436] flex items-center justify-center font-bold text-xl text-[#2D3436] shadow-sm overflow-hidden">
            {profile.name[0].toUpperCase()}
          </div>
          
          {/* Header Google Calendar Sync Button */}
          <div className="flex items-center gap-2">
            {!isCalendarSynced ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                Calendar Not Connected
              </span>
            ) : (
              <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border-2 border-[#4ECDC4] bg-[#E8F8F5] text-[#117A65]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ECDC4] animate-pulse"></span>
                Connected
              </span>
            )}
            <button
              id="header-sync-calendar-btn"
              onClick={handleCalendarSync}
              className={`flex items-center gap-1.5 px-3 py-2 border-2 border-[#2D3436] rounded-xl transition-all shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none font-black text-xs uppercase tracking-wide ${
                isCalendarSynced 
                  ? 'bg-[#E8F8F5] text-[#117A65] border-[#117A65]' 
                  : 'bg-white hover:bg-slate-50 text-[#2D3436]'
              }`}
            >
              <svg className="w-4 h-4 shrink-0 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-7-7h5v5h-5z"/>
              </svg>
              <span>{isCalendarSynced ? 'Synced' : 'Sync'}</span>
            </button>
          </div>

          <button
            id="manage-profile-btn"
            onClick={() => {
              setSettingsName(profile?.name || '');
              setSettingsRole(activeRole);
              setSettingsEmergencyName(emergencyName);
              setSettingsEmergencyPhone(emergencyPhone);
              setIsSettingsOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 border-2 border-[#2D3436] bg-[#FFEAA7] text-[#2D3436] rounded-xl hover:bg-[#ffe285] transition-all shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none font-black text-xs uppercase tracking-wide cursor-pointer"
            title="Manage Profile & Settings"
          >
            <Settings className="w-4 h-4 shrink-0 text-[#2D3436]" />
            <span className="hidden sm:inline">Profile</span>
          </button>

          <button 
            id="signout-btn"
            onClick={handleSignOut}
            className="p-2 border-2 border-[#2D3436] bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-[2px_2px_0px_0px_#2D3436]"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-6xl w-full mx-auto px-4 md:px-8 mt-10 space-y-10 flex-grow">
        
        {/* Mom's Current Mood & Alert Status Banner */}
        <section 
          id="mom-mood-banner" 
          className={`p-6 md:p-8 border-4 border-[#2D3436] rounded-[2.5rem] transition-all ${moodBannerState.bgColor} ${moodBannerState.borderColor} ${moodBannerState.shadowColor}`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border-2 border-[#2D3436] text-white ${moodBannerState.accentColor}`}>
                  {moodBannerState.mood}
                </span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/60 px-2 py-1 rounded-lg border-2 border-slate-200">
                  {moodBannerState.details}
                </span>

                <button
                  type="button"
                  id="listen-to-mom-btn"
                  onClick={() => {
                    if (isSpeaking) {
                      stop();
                    } else {
                      speak(moodBannerState.message, true);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-[#2D3436] text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    isSpeaking 
                      ? 'bg-[#FF7675] text-white animate-pulse shadow-[1px_1px_0px_0px_#2D3436]' 
                      : 'bg-[#FFEAA7] text-[#2D3436] hover:bg-[#ffe285] shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none'
                  } cursor-pointer`}
                  title={isSpeaking ? "Mute Mom" : "Listen to Mom"}
                >
                  {isSpeaking ? (
                    <VolumeX className="w-3.5 h-3.5 text-[#2D3436]" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#2D3436]" />
                  )}
                  <span>{isSpeaking ? "Mute Mom" : "Listen to Mom"}</span>
                  
                  {isSpeaking && (
                    <span className="flex gap-0.5 items-end h-3 ml-1">
                      <span className="w-0.5 h-full bg-[#2D3436] rounded-full animate-bounce [animation-delay:0.1s]"></span>
                      <span className="w-0.5 h-2/3 bg-[#2D3436] rounded-full animate-bounce [animation-delay:0.3s]"></span>
                      <span className="w-0.5 h-full bg-[#2D3436] rounded-full animate-bounce [animation-delay:0.5s]"></span>
                    </span>
                  )}
                </button>
              </div>
              <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${moodBannerState.textColor}`}>
                Mom&apos;s Current Mood & Alert Status
              </h2>
              <p className="text-sm md:text-base font-bold text-slate-700 leading-relaxed max-w-3xl">
                &ldquo;{moodBannerState.message}&rdquo;
              </p>
            </div>
            
            <div className="shrink-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl border-4 border-[#2D3436] bg-white flex items-center justify-center text-3xl shadow-md">
                {moodBannerState.tier === 'RED' ? '😡' : moodBannerState.tier === 'AMBER' ? '🤨' : '👵🏽'}
              </div>
            </div>
          </div>
        </section>
        
        {/* Profile Selector Area */}
        <section id="vibe-selector" className="bg-white p-6 md:p-8 border-4 border-[#2D3436] rounded-[2rem] shadow-[6px_6px_0px_0px_#2D3436]">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-xs md:text-sm font-black text-[#FF6B6B] uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Choose Your Active Vibe
            </span>
            <div className="flex-grow h-1 bg-[#FF6B6B]/10 rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <button 
              onClick={() => handleRoleChange('Student')}
              className={`flex items-center justify-center gap-4 p-5 md:p-6 bg-white border-4 rounded-[2rem] transition-all transform ${
                activeRole === 'Student' 
                  ? 'border-[#FF6B6B] shadow-[6px_6px_0px_0px_#FF6B6B]' 
                  : 'border-slate-200 opacity-60 hover:opacity-80'
              }`}
            >
              <span className="text-3xl">🎓</span>
              <span className="text-lg font-black text-[#2D3436]">Student</span>
            </button>
            <button 
              onClick={() => handleRoleChange('Professional')}
              className={`flex items-center justify-center gap-4 p-5 md:p-6 bg-white border-4 rounded-[2rem] transition-all transform ${
                activeRole === 'Professional' 
                  ? 'border-[#4ECDC4] shadow-[6px_6px_0px_0px_#4ECDC4]' 
                  : 'border-slate-200 opacity-60 hover:opacity-80'
              }`}
            >
              <span className="text-3xl">💼</span>
              <span className="text-lg font-black text-[#2D3436]">Professional</span>
            </button>
            <button 
              onClick={() => handleRoleChange('Entrepreneur')}
              className={`flex items-center justify-center gap-4 p-5 md:p-6 bg-white border-4 rounded-[2rem] transition-all transform ${
                activeRole === 'Entrepreneur' 
                  ? 'border-[#FFD93D] shadow-[6px_6px_0px_0px_#FFD93D]' 
                  : 'border-slate-200 opacity-60 hover:opacity-80'
              }`}
            >
              <span className="text-3xl">🚀</span>
              <span className="text-lg font-black text-[#2D3436]">Entrepreneur</span>
            </button>
          </div>

          {/* Google Calendar Sync Integration Area */}
          <div className="mt-6 pt-6 border-t-4 border-dashed border-[#2D3436]/15 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4285F4]/10 flex items-center justify-center border-2 border-[#4285F4]/20 text-[#4285F4]">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-7-7h5v5h-5z"/>
                </svg>
              </div>
              <div className="text-left">
                <h4 className="text-sm font-black text-[#2D3436] flex items-center gap-2">
                  <span>Google Calendar Integration</span>
                  {!isCalendarSynced ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                      Not Connected
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[#E8F8F5] text-[#117A65] border border-[#4ECDC4]">
                      Connected
                    </span>
                  )}
                </h4>
                <p className="text-xs font-bold text-slate-500">
                  {!isCalendarSynced 
                    ? "Sync your calendar to auto-load deadlines, exam routines, and reviews directly into Mom's nagging engine."
                    : `Your calendar (${selectedSyncEmail}) is synchronized! Active tasks are continuously analyzed.`}
                </p>
              </div>
            </div>
            <button
              id="vibe-sync-calendar-btn"
              onClick={handleCalendarSync}
              className={`w-full md:w-auto px-5 py-3 border-4 border-[#2D3436] rounded-2xl font-black text-sm uppercase tracking-wide shadow-[4px_4px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 ${
                isCalendarSynced 
                  ? 'bg-[#E8F8F5] text-[#117A65] border-[#117A65] hover:bg-[#d1f2eb]' 
                  : 'bg-[#FFEAA7] text-[#2D3436] hover:bg-[#ffd653]'
              }`}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-7-7h5v5h-5z"/>
              </svg>
              <span>{isCalendarSynced ? 'Connected & Active' : 'Sync Google Calendar'}</span>
            </button>
          </div>

          {/* Mom's Backup Contacts Section */}
          <div className="mt-6 pt-6 border-t-4 border-dashed border-[#2D3436]/15 text-left">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF6B6B]/10 flex items-center justify-center border-2 border-[#FF6B6B]/20 text-[#FF6B6B]">
                  <Phone className="w-5 h-5 shrink-0" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#2D3436] flex items-center gap-2">
                    <span>Mom&apos;s Backup Contacts</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-600 border border-rose-200">
                      Failsafe Protocol
                    </span>
                  </h4>
                  <p className="text-xs font-bold text-slate-500">
                    If your primary device is unresponsive during critical RED deadlines, Mom will escalate to your backup contact.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                  Backup Contact Name
                </label>
                <input
                  type="text"
                  id="backup-contact-name-input"
                  value={emergencyName}
                  onChange={(e) => {
                    setEmergencyName(e.target.value);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('emergencyName', e.target.value);
                    }
                  }}
                  placeholder="e.g. Rahul (Roommate)"
                  className="w-full px-4 py-3 border-4 border-[#2D3436] rounded-2xl bg-white font-bold text-sm text-[#2D3436] focus:outline-none focus:ring-0 placeholder-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                  Mobile Number / WhatsApp ID
                </label>
                <input
                  type="text"
                  id="backup-contact-phone-input"
                  value={emergencyPhone}
                  onChange={(e) => {
                    setEmergencyPhone(e.target.value);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('emergencyPhone', e.target.value);
                    }
                  }}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-4 py-3 border-4 border-[#2D3436] rounded-2xl bg-white font-bold text-sm text-[#2D3436] focus:outline-none focus:ring-0 placeholder-slate-400"
                />
              </div>
            </div>
          </div>
        </section>

        {/* AI-Mom Dashboard & Task Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* AI-Mom Box (Left 5 Columns) */}
          <section id="ai-mom-box" className="lg:col-span-5 space-y-6">
            <div className={`border-4 border-[#2D3436] rounded-[2.5rem] shadow-[8px_8px_0px_0px_#2D3436] overflow-hidden bg-white`}>
              {/* Box Header */}
              <div className="bg-[#2D3436] px-6 py-4 flex items-center justify-between">
                <span className="text-white font-black text-lg tracking-wider uppercase flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#FFD93D]" />
                  Mom&apos;s Status
                </span>
                <span className="bg-white text-[#2D3436] border-2 border-[#2D3436] px-3 py-1 rounded-full text-xs font-black">
                  {currentStyles.indicator}
                </span>
              </div>

              {/* Box Body */}
              <div className="p-6 space-y-6 flex flex-col items-center">
                {/* Mom Illustration */}
                <div className="relative">
                  <div className={`w-32 h-32 rounded-full border-4 border-[#2D3436] flex items-center justify-center text-6xl shadow-inner ${
                    aiMomState.urgency === 'RED' ? 'bg-[#FFECEC]' : aiMomState.urgency === 'AMBER' ? 'bg-[#FFF9E6]' : 'bg-[#F2FBF9]'
                  }`}>
                    {aiMomState.urgency === 'RED' ? '😡' : aiMomState.urgency === 'AMBER' ? '🤨' : '👵🏽'}
                  </div>
                  {loadingAI && (
                    <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center border-4 border-transparent border-t-[#FF6B6B] animate-spin">
                    </div>
                  )}
                </div>

                {/* Mom's Nudge Bubble */}
                <div className={`w-full p-5 rounded-3xl relative text-sm font-black text-[#2D3436] leading-relaxed border-4 border-[#2D3436] shadow-[4px_4px_0px_0px_#2D3436] ${
                  aiMomState.urgency === 'RED' ? 'bg-[#FFECEC]' : aiMomState.urgency === 'AMBER' ? 'bg-[#FFF9E6]' : 'bg-[#F2FBF9]'
                }`}>
                  <p className="italic">&ldquo;{aiMomState.message}&rdquo;</p>
                </div>

                {/* Immediate Action Items */}
                <div className="w-full space-y-3">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Mom&apos;s Direct Orders
                  </h4>
                  <ul className="space-y-2">
                    {aiMomState.actionItems.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border-2 border-slate-200">
                        <span className="text-[#FF6B6B] font-black">#{index + 1}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sound Control & Manual Refresh */}
                <div className="w-full pt-4 border-t-2 border-slate-100 flex items-center justify-between gap-4">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#2D3436] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#2D3436] transition-all ${
                      soundEnabled ? 'bg-[#FFEAA7]' : 'bg-white text-slate-400'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {soundEnabled ? 'SOUND ON' : 'MUTED'}
                  </button>

                  <button
                    onClick={() => triggerMomNudge(tasks, activeRole)}
                    disabled={loadingAI}
                    className="flex-1 py-2 px-4 bg-[#FFEAA7] hover:bg-[#ffe285] text-[#2D3436] border-2 border-[#2D3436] rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#2D3436] hover:translate-y-0.5 active:translate-y-1 transition-all text-center disabled:opacity-50"
                  >
                    {loadingAI ? 'HEARING MOM...' : 'ASK FOR NUDGE 👵🏽'}
                  </button>
                </div>

              </div>
            </div>

            {/* Mom's Approval Rating Widget */}
            <div className="border-4 border-[#2D3436] rounded-[2.5rem] shadow-[8px_8px_0px_0px_#2D3436] overflow-hidden bg-white">
              {/* Widget Header */}
              <div className="bg-[#4ECDC4] px-6 py-4 flex items-center justify-between border-b-4 border-[#2D3436]">
                <span className="text-white font-black text-lg tracking-wider uppercase flex items-center gap-2">
                  <Flame className="w-5 h-5 text-white animate-pulse" />
                  Mom&apos;s Approval Rating
                </span>
                <span className="bg-white text-[#2D3436] border-2 border-[#2D3436] px-3 py-1 rounded-full text-xs font-black">
                  {approvalScore >= 80 ? 'PROUD' : approvalScore >= 50 ? 'WORRIED' : 'Furious!'}
                </span>
              </div>

              {/* Widget Body */}
              <div className="p-6 space-y-4 flex flex-col items-center">
                <div className="flex items-center justify-between w-full gap-4">
                  
                  {/* Circular Progress Ring */}
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="38"
                        className="stroke-slate-100"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="38"
                        className="transition-all duration-500 ease-out"
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 38}
                        strokeDashoffset={2 * Math.PI * 38 - (approvalScore / 100) * 2 * Math.PI * 38}
                        strokeLinecap="round"
                        stroke={approvalScore >= 80 ? '#4ECDC4' : approvalScore >= 50 ? '#FFEAA7' : '#FF6B6B'}
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-black text-lg text-[#2D3436] leading-none">{approvalScore}%</span>
                      <span className="text-[9px] font-bold text-slate-400 leading-none mt-1">APPROVAL</span>
                    </div>
                  </div>

                  {/* Character Avatar Beside It */}
                  <div className="flex-1 flex flex-col items-center bg-slate-50 border-2 border-[#2D3436] p-3 rounded-2xl">
                    <div className="text-4xl">
                      {isDisappointed ? '😢💔' : approvalScore >= 80 ? '👵🏽💖' : approvalScore >= 50 ? '🤨📱' : '😡🩴'}
                    </div>
                    <span className={`text-[10px] font-black uppercase mt-1 tracking-wider ${
                      isDisappointed ? 'text-red-600' : approvalScore >= 80 ? 'text-[#117A65]' : approvalScore >= 50 ? 'text-[#B7950B]' : 'text-[#FF6B6B]'
                    }`}>
                      {isDisappointed ? 'DISAPPOINTED / HURT' : approvalScore >= 80 ? 'PROUD MOMMY' : approvalScore >= 50 ? 'SUSPECTING MOM' : 'FLYING CHAPPAL ALERT'}
                    </span>
                  </div>

                </div>

                {/* Subtext and Streak */}
                <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ON-TIME STREAK</span>
                    <span className="text-xl font-black text-[#2D3436] flex items-center gap-1.5">
                      <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                      {completionStreak} Tasks
                    </span>
                  </div>
                  <div className="text-right text-xs font-black text-slate-500 max-w-[120px]">
                    {completionStreak > 0 ? "Bacha is studying on time! Good job!" : "Hurry up beta, complete on time!"}
                  </div>
                </div>

                <div className="text-[11px] font-bold text-slate-500 italic text-center w-full">
                  {isDisappointed
                    ? activeRole === 'Student'
                      ? '"Fine! Don\'t do your study tasks. See what happens when your friends clear the placement rounds and you are left sitting at home!"'
                      : '"Fine, give up! Your peers are out there building empires while you can\'t even finish a simple checklist item. Do whatever you want, I\'m done talking!"'
                    : approvalScore >= 80 
                      ? '"Beta, you are doing so well! Put on a sweater, don\'t catch a cold!"'
                      : approvalScore >= 50
                        ? '"Bacha, Sharma ji\'s son has 100% score! Why is your focus so low today?"'
                        : '"Mobile phone, mobile phone, mobile phone! All day on that device! Study right now!"'
                  }
                </div>
              </div>
            </div>

            {/* Autonomous Task Planner Widget */}
            <div className="border-4 border-[#2D3436] rounded-[2.5rem] shadow-[8px_8px_0px_0px_#2D3436] overflow-hidden bg-white">
              <div className="bg-[#FF6B6B] px-6 py-4 flex items-center justify-between border-b-4 border-[#2D3436]">
                <span className="text-white font-black text-lg tracking-wider uppercase flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-white animate-spin-slow" />
                  Autonomous Task Planner
                </span>
                <span className="bg-white text-[#2D3436] border-2 border-[#2D3436] px-3 py-1 rounded-full text-xs font-black">
                  AI-POWERED
                </span>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                  Have an intimidating macro-goal like a final exam, marketing launch, or client pitch? Let AI-Mom instantly break it into <strong className="text-[#FF6B6B]">exactly 4 sequential sub-tasks</strong> with staggered deadlines and push them to your board.
                </p>

                <form onSubmit={handleMomPlan} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      Enter Your Overarching Goal:
                    </label>
                    <textarea
                      value={macroGoal}
                      onChange={(e) => setMacroGoal(e.target.value)}
                      placeholder={
                        activeRole === 'Student' 
                          ? 'e.g., Prepare for final OS exam next week' 
                          : activeRole === 'Professional' 
                            ? 'e.g., Launch the corporate marketing campaign' 
                            : 'e.g., Submit final pitch deck to investors'
                      }
                      rows={3}
                      disabled={planningTasks}
                      className="w-full p-3 border-4 border-[#2D3436] rounded-2xl bg-[#FFFDF9] font-bold text-sm text-[#2D3436] focus:outline-none placeholder:text-slate-400 shadow-[3px_3px_0px_0px_#2D3436]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={planningTasks || !macroGoal.trim()}
                    className="w-full py-3 bg-[#FFEAA7] hover:bg-[#ffd653] text-[#2D3436] border-4 border-[#2D3436] rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-[4px_4px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {planningTasks ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>MOM IS SCHEDULING...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-[#2D3436]" />
                        <span>ASK MOM TO PLAN IT 👵🏽✨</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* Tasks Column (Right 7 Columns) */}
          <section id="tasks-box" className="lg:col-span-7 flex flex-col">
            <div className="bg-white border-4 border-[#2D3436] rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden min-h-[480px]">
              
              {/* Header with Title and Toggle Filter */}
              <div className="bg-[#2D3436] px-6 md:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-4 border-[#2D3436] gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-white font-black text-xl md:text-2xl tracking-tight">Focus Assignments</h2>
                  <span className="bg-[#FF6B6B] text-white px-3 py-1 rounded-full text-xs font-black border-2 border-white shrink-0">
                    {roleTasks.filter(t => t.status === 'pending').length} Left
                  </span>
                </div>
                
                {/* Subtle Toggle Filter */}
                <div className="flex bg-[#2D3436] p-1 border-2 border-white rounded-xl text-xs font-black select-none shrink-0">
                  <button
                    onClick={() => setTaskFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      taskFilter === 'all' 
                        ? 'bg-[#FFEAA7] text-[#2D3436]' 
                        : 'text-white hover:text-[#FFEAA7]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setTaskFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      taskFilter === 'pending' 
                        ? 'bg-[#FFEAA7] text-[#2D3436]' 
                        : 'text-white hover:text-[#FFEAA7]'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setTaskFilter('completed')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      taskFilter === 'completed' 
                        ? 'bg-[#FFEAA7] text-[#2D3436]' 
                        : 'text-white hover:text-[#FFEAA7]'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>

              {/* Enhanced Inline Task Creation Bar */}
              <div className="bg-[#FFFDF9] border-b-4 border-[#2D3436] p-4 md:p-6 space-y-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        id="inline-task-title"
                        type="text"
                        placeholder="What is your next focus task, beta? Write here..."
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="flex-grow p-3 border-4 border-[#2D3436] rounded-xl bg-white font-black text-sm focus:outline-none placeholder:text-slate-400 shadow-[3px_3px_0px_0px_#2D3436]"
                      />
                      
                      {/* Sleek Microphone Button */}
                      <button
                        type="button"
                        onClick={() => setIsListening(!isListening)}
                        className={`p-3 border-4 border-[#2D3436] rounded-xl flex items-center justify-center transition-all shadow-[2px_2px_0px_0px_#2D3436] cursor-pointer hover:translate-y-0.5 active:translate-y-1 ${
                          isListening 
                            ? 'bg-red-500 text-white animate-pulse shadow-none' 
                            : 'bg-[#FFEAA7] text-[#2D3436] hover:bg-[#ffe285]'
                        }`}
                        title="Voice-Enabled Assistant"
                      >
                        <Mic className={`w-5 h-5 ${isListening ? 'scale-110' : ''}`} />
                      </button>

                      {/* Demo Preset Selector */}
                      <select
                        id="voice-preset-select"
                        onChange={async (e) => {
                          const val = e.target.value;
                          if (val) {
                            await executeVoiceCommand(val);
                            e.target.value = ""; // Reset
                          }
                        }}
                        className="p-2 border-4 border-[#2D3436] rounded-xl bg-[#F2FBF9] font-black text-xs text-[#2D3436] shadow-[2px_2px_0px_0px_#2D3436] focus:outline-none cursor-pointer max-w-[130px] sm:max-w-xs md:max-w-[150px] truncate"
                      >
                        <option value="">🎙️ Voice Demo</option>
                        <option value="add-meeting">"Add team meeting tomorrow at 10 AM"</option>
                        <option value="complete-layout">"Mark the project layout complete"</option>
                        <option value="add-physics">"Add physics exam practice tonight at 9 PM"</option>
                        <option value="add-milk">"Add buy milk today at 5 PM"</option>
                      </select>
                    </div>

                    {/* On-screen pulsing status indicator when active */}
                    {isListening && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFECEC] border-2 border-[#FF6B6B] rounded-xl text-xs font-black text-[#FF6B6B] animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                        <span>Listening for Mom&apos;s commands... Select a demo command above!</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
                    <div className="w-[140px] shrink-0">
                      <input
                        id="inline-task-date"
                        type="date"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="w-full p-2.5 border-4 border-[#2D3436] rounded-xl bg-white font-black text-xs focus:outline-none shadow-[2px_2px_0px_0px_#2D3436]"
                      />
                    </div>
                    
                    <div className="w-[100px] shrink-0">
                      <input
                        id="inline-task-time"
                        type="time"
                        value={newDueTime}
                        onChange={(e) => setNewDueTime(e.target.value)}
                        className="w-full p-2.5 border-4 border-[#2D3436] rounded-xl bg-white font-black text-xs focus:outline-none shadow-[2px_2px_0px_0px_#2D3436]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center pt-1">
                  {/* Slider & Category */}
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full sm:w-auto">
                    {/* Category Select */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-500">Category:</span>
                      <select
                        id="inline-task-category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="p-1.5 border-2 border-[#2D3436] rounded-lg bg-white font-black text-xs focus:outline-none"
                      >
                        <option value="Education">Education</option>
                        <option value="Finance">Finance</option>
                        <option value="Work">Work</option>
                        <option value="Strategy">Strategy</option>
                        <option value="Personal">Personal</option>
                        <option value="Health">Health</option>
                      </select>
                    </div>

                    {/* Slider for Effort */}
                    <div className="flex items-center gap-3 bg-slate-50 border-2 border-slate-200 px-3 py-1.5 rounded-xl shrink-0">
                      <span className="text-[10px] font-black uppercase text-slate-500 whitespace-nowrap">
                        ⌛ Effort: {newEstimatedEffort}h
                      </span>
                      <input
                        id="inline-task-effort-slider"
                        type="range"
                        min="1"
                        max="5"
                        value={newEstimatedEffort}
                        onChange={(e) => setNewEstimatedEffort(Number(e.target.value))}
                        className="w-20 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FF6B6B]"
                      />
                    </div>
                  </div>

                  <button
                    id="inline-add-task-btn"
                    onClick={handleAddTask}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#4ECDC4] hover:bg-[#3ebcb4] text-white border-4 border-[#2D3436] rounded-xl font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_0px_#2D3436] hover:translate-y-0.5 active:translate-y-1 active:shadow-none transition-all text-center"
                  >
                    ADD DECREE 👵🏽
                  </button>
                </div>
              </div>

              {/* Tasks List Container */}
              <div className="flex-grow p-4 md:p-6 space-y-4 max-h-[500px] overflow-y-auto bg-slate-50">
                {loadingTasks ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-10 h-10 border-4 border-[#4ECDC4] border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-xs font-black text-slate-500">Checking task status...</p>
                  </div>
                ) : roleTasks.length === 0 ? (
                  <div id="no-tasks-state" className="text-center py-16 px-4">
                    <span className="text-5xl block">📭</span>
                    <h4 className="font-black text-[#2D3436] mt-4 text-lg">No focus tasks found!</h4>
                    <p className="text-xs font-bold text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      All clean! But don&apos;t let AI-Mom catch you celebrating too early. She knows you should be studying!
                    </p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-12 px-4 border-4 border-dashed border-slate-300 rounded-2xl">
                    <span className="text-3xl block">🔍</span>
                    <h4 className="font-black text-[#2D3436] mt-2 text-sm uppercase">No tasks match filter!</h4>
                    <p className="text-[11px] font-bold text-slate-400 mt-1">
                      No assignments found with status &quot;{taskFilter}&quot; for the active role.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTasks.map((task) => {
                      const due = getDueLabel(task.dueDate);
                      const isEditing = editingTaskId === task.id;

                      if (isEditing) {
                        return (
                          <div 
                            key={task.id}
                            className="bg-[#FFFDF9] border-4 border-[#2D3436] rounded-2xl p-4 shadow-[4px_4px_0px_0px_#2D3436] space-y-3"
                          >
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block">
                              👵🏽 EDITING ASSIGNMENT:
                            </span>
                            
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full p-2.5 border-2 border-[#2D3436] rounded-lg bg-white font-black text-sm focus:outline-none"
                              placeholder="Task Title"
                            />
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Due Date</label>
                                <input
                                  type="date"
                                  value={editDueDate}
                                  onChange={(e) => setEditDueDate(e.target.value)}
                                  className="w-full p-2 border-2 border-[#2D3436] rounded-lg bg-white font-black text-xs focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Due Time</label>
                                <input
                                  type="time"
                                  value={editDueTime}
                                  onChange={(e) => setEditDueTime(e.target.value)}
                                  className="w-full p-2 border-2 border-[#2D3436] rounded-lg bg-white font-black text-xs focus:outline-none"
                                />
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t-2 border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Category:</span>
                                <select
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value)}
                                  className="p-1 border-2 border-[#2D3436] rounded-lg bg-white font-black text-[11px] focus:outline-none"
                                >
                                  <option value="Education">Education</option>
                                  <option value="Finance">Finance</option>
                                  <option value="Work">Work</option>
                                  <option value="Strategy">Strategy</option>
                                  <option value="Personal">Personal</option>
                                  <option value="Health">Health</option>
                                </select>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase">Effort: {editEstimatedEffort}h</span>
                                <input
                                  type="range"
                                  min="1"
                                  max="5"
                                  value={editEstimatedEffort}
                                  onChange={(e) => setEditEstimatedEffort(Number(e.target.value))}
                                  className="w-16 h-1.5 bg-slate-200 rounded-lg cursor-pointer accent-[#FF6B6B]"
                                />
                              </div>
                            </div>
                            
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleSaveEdit(task.id!)}
                                className="flex-1 py-1.5 bg-[#4ECDC4] hover:bg-[#3ebcb4] text-white border-2 border-[#2D3436] rounded-lg font-black text-xs uppercase shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none transition-all text-center cursor-pointer"
                              >
                                SAVE
                              </button>
                              <button
                                onClick={() => setEditingTaskId(null)}
                                className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#2D3436] border-2 border-[#2D3436] rounded-lg font-black text-xs uppercase shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none transition-all text-center cursor-pointer"
                              >
                                CANCEL
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={task.id}
                          className={`flex items-center justify-between p-4 border-4 border-[#2D3436] rounded-2xl transition-all shadow-[4px_4px_0px_0px_#2D3436] hover:translate-y-0.5 ${
                            task.status === 'completed' 
                              ? 'bg-slate-100 opacity-60' 
                              : due.urgent 
                                ? 'bg-[#FFECEC]' 
                                : 'bg-[#F2FBF9]'
                          }`}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Checkbox button */}
                            <button
                              onClick={() => handleToggleTask(task.id!, task.status)}
                              className="focus:outline-none shrink-0"
                            >
                              {task.status === 'completed' ? (
                                <CheckCircle className="w-8 h-8 text-[#4ECDC4] fill-white border-2 border-transparent rounded-full" />
                              ) : (
                                <Circle className={`w-8 h-8 ${due.urgent ? 'text-[#FF6B6B]' : 'text-slate-400'} hover:text-slate-600`} />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <h3 className={`text-base md:text-lg font-black text-[#2D3436] truncate leading-tight ${
                                task.status === 'completed' ? 'line-through opacity-55' : ''
                              }`}>
                                {task.title}
                              </h3>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide border-2 border-[#2D3436] ${
                                  task.status === 'completed' 
                                    ? 'bg-slate-200 text-slate-500' 
                                    : due.urgent 
                                      ? 'bg-white text-[#FF6B6B]' 
                                      : 'bg-white text-[#4ECDC4]'
                                }`}>
                                  {task.category}
                                </span>
                                {task.status !== 'completed' && (
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide border-2 border-[#2D3436] ${
                                    (nagScores[task.id || ''] || 1) >= 8
                                      ? 'bg-[#FFECEC] text-[#FF6B6B] animate-pulse'
                                      : (nagScores[task.id || ''] || 1) >= 5
                                        ? 'bg-[#FFF9E6] text-[#B7950B]'
                                        : 'bg-[#F2FBF9] text-[#117A65]'
                                  }`}>
                                    ⚡ Nag Index: {nagScores[task.id || ''] || 1}/10
                                  </span>
                                )}
                                {task.estimatedEffort && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-white text-slate-600 uppercase tracking-wide border-2 border-[#2D3436]">
                                    ⏳ {task.estimatedEffort}h Effort
                                  </span>
                                )}
                                <span className={`text-[10px] font-black flex items-center gap-1 ${
                                  task.status === 'completed' 
                                    ? 'text-slate-400' 
                                    : due.urgent 
                                      ? 'text-[#FF6B6B]' 
                                      : 'text-slate-500'
                                }`}>
                                  <Clock className="w-3 h-3" />
                                  {due.label}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Edit and Delete */}
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {/* Inline Edit Pencil Button */}
                            <button
                              onClick={() => {
                                setEditingTaskId(task.id!);
                                setEditTitle(task.title);
                                setEditCategory(task.category);
                                setEditEstimatedEffort(task.estimatedEffort || 1);
                                
                                // Extract date/time from task.dueDate ISO string
                                try {
                                  const d = new Date(task.dueDate);
                                  const y = d.getFullYear();
                                  const m = String(d.getMonth() + 1).padStart(2, '0');
                                  const dayVal = String(d.getDate()).padStart(2, '0');
                                  const h = String(d.getHours()).padStart(2, '0');
                                  const minVal = String(d.getMinutes()).padStart(2, '0');
                                  setEditDueDate(`${y}-${m}-${dayVal}`);
                                  setEditDueTime(`${h}:${minVal}`);
                                } catch (e) {
                                  setEditDueDate('');
                                  setEditDueTime('17:00');
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-[#4ECDC4] hover:bg-slate-50 border-2 border-transparent hover:border-[#2D3436] rounded-xl transition-all cursor-pointer"
                              title="Edit Task"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Delete Button with 2-step confirmation */}
                            {deletingTaskId === task.id ? (
                              <button
                                onClick={() => {
                                  handleDeleteTask(task.id!);
                                  setDeletingTaskId(null);
                                }}
                                className="px-2 py-1 bg-[#FF6B6B] text-white border-2 border-[#2D3436] rounded-xl text-[9px] font-black uppercase shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                                title="Confirm Delete"
                              >
                                Sure? ❌
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setDeletingTaskId(task.id!);
                                  // Reset confirmation after 3 seconds
                                  setTimeout(() => {
                                    setDeletingTaskId(current => current === task.id ? null : current);
                                  }, 3000);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 border-2 border-transparent hover:border-[#2D3436] rounded-xl transition-all cursor-pointer"
                                title="Delete Task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Button Area (Triggers Popup as fallback) */}
              <div className="p-4 bg-[#F1F2F6] border-t-4 border-[#2D3436] flex justify-center">
                <button 
                  id="add-task-trigger"
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-[#FFEAA7] hover:bg-[#ffe285] text-[#2D3436] px-6 py-2 border-4 border-[#2D3436] rounded-full text-xs font-black shadow-[3px_3px_0px_0px_#2D3436] active:shadow-none active:translate-y-0.5 transition-all cursor-pointer"
                >
                  👵🏽 ACTIVATE MOM&apos;S NEW DECREE MODAL
                </button>
              </div>

            </div>
          </section>

        </div>

      </div>

      {/* Add Task Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white border-4 border-[#2D3436] rounded-[2.5rem] shadow-[10px_10px_0px_0px_#2D3436] overflow-hidden"
            >
              <div className="bg-[#2D3436] px-6 py-4 flex justify-between items-center text-white border-b-4 border-[#2D3436]">
                <h3 className="text-xl font-black tracking-wider uppercase flex items-center gap-2">
                  <Plus className="w-6 h-6" />
                  MOM&apos;S NEW TASK DECREE
                </h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 text-white hover:text-[#FFEAA7]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide">
                    Task Title / Assignment Name
                  </label>
                  <input
                    id="new-task-title-input"
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Complete lab report, study for exam..."
                    className="w-full p-3 border-4 border-[#2D3436] rounded-xl bg-[#FFFAF2] font-black text-sm focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide">
                      Category
                    </label>
                    <select
                      id="new-task-category-select"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full p-3 border-4 border-[#2D3436] rounded-xl bg-[#FFFAF2] font-black text-sm focus:outline-none"
                    >
                      <option value="Education">Education</option>
                      <option value="Finance">Finance</option>
                      <option value="Work">Work</option>
                      <option value="Strategy">Strategy</option>
                      <option value="Personal">Personal</option>
                      <option value="Health">Health</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide">
                      Due Time
                    </label>
                    <input
                      id="new-task-time-input"
                      type="time"
                      value={newDueTime}
                      onChange={(e) => setNewDueTime(e.target.value)}
                      className="w-full p-3 border-4 border-[#2D3436] rounded-xl bg-[#FFFAF2] font-black text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide">
                    Due Date
                  </label>
                  <input
                    id="new-task-date-input"
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full p-3 border-4 border-[#2D3436] rounded-xl bg-[#FFFAF2] font-black text-sm focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide">
                      Estimated Effort
                    </label>
                    <span className="text-xs font-black text-[#FF6B6B]">
                      ⏳ {newEstimatedEffort} Hour{newEstimatedEffort > 1 ? 's' : ''}
                    </span>
                  </div>
                  <input
                    id="modal-task-effort-slider"
                    type="range"
                    min="1"
                    max="5"
                    value={newEstimatedEffort}
                    onChange={(e) => setNewEstimatedEffort(Number(e.target.value))}
                    className="w-full h-3 bg-slate-100 border-4 border-[#2D3436] rounded-xl appearance-none cursor-pointer accent-[#FF6B6B]"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 border-4 border-[#2D3436] bg-slate-100 text-[#2D3436] rounded-xl font-black text-sm hover:bg-slate-200 transition-all shadow-[2px_2px_0px_0px_#2D3436]"
                  >
                    CANCEL
                  </button>
                  <button
                    id="save-task-btn"
                    type="submit"
                    className="flex-1 py-3 bg-[#FFEAA7] text-[#2D3436] border-4 border-[#2D3436] rounded-xl font-black text-sm hover:bg-[#ffe285] transition-all shadow-[2px_2px_0px_0px_#2D3436]"
                  >
                    ADD TO LIST!
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Google Calendar Sync Simulation Modal */}
      <AnimatePresence>
        {isSyncModalOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white border-4 border-[#2D3436] rounded-[2rem] shadow-[12px_12px_0px_0px_#2D3436] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-[#2D3436] px-6 py-4 flex justify-between items-center text-white border-b-4 border-[#2D3436]">
                <h3 className="text-md font-black tracking-wider uppercase flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#4285F4] fill-current" viewBox="0 0 24 24">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-7-7h5v5h-5z"/>
                  </svg>
                  GOOGLE SIGN-IN SIMULATION
                </h3>
                <button
                  onClick={() => setIsSyncModalOpen(false)}
                  className="p-1 text-white hover:text-[#FFEAA7]"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {/* STEP 0: Account Chooser */}
                {syncStep === 0 && (
                  <div className="space-y-6 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="w-10 h-10 mb-2" viewBox="0 0 24 24" fill="none">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <h4 className="text-xl font-bold text-[#2D3436]">Sign in with Google</h4>
                      <p className="text-xs text-slate-500 mt-1">to continue to AI-Mom Calendar Sync</p>
                    </div>

                    <div className="space-y-2 text-left">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Choose an Account</p>
                      
                      {/* Active student account */}
                      <button
                        onClick={() => setSyncStep(1)}
                        className="w-full flex items-center justify-between p-3.5 border-2 border-slate-200 rounded-xl hover:border-[#4285F4] hover:bg-slate-50 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#4285F4] text-white flex items-center justify-center font-bold text-sm">
                            V
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">Vineet</p>
                            <p className="text-xs text-slate-500">harshitsinghp8@gmail.com</p>
                          </div>
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                          Active User
                        </span>
                      </button>

                      {/* Add other account button */}
                      <button
                        onClick={() => startSyncSimulation('vineet.student@gmail.com')}
                        className="w-full flex items-center gap-3 p-3.5 border-2 border-dashed border-slate-200 rounded-xl hover:border-[#4285F4] hover:bg-slate-50 transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-lg">
                          +
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-600">Use another account</p>
                          <p className="text-xs text-slate-400">Simulate guest credentials</p>
                        </div>
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 text-left leading-relaxed">
                      To continue, Google will share your name, email address, language preference, and profile picture with AI-Mom. Before using this app, you can review AI-Mom&apos;s privacy policy and terms of service.
                    </p>
                  </div>
                )}

                {/* STEP 1: Grant Permissions Consent */}
                {syncStep === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-8 h-8 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <div>
                        <h4 className="text-lg font-black text-slate-800 leading-tight">AI-Mom wants to access your Google Account</h4>
                        <p className="text-xs text-slate-500 mt-1">harshitsinghp8@gmail.com</p>
                      </div>
                    </div>

                    <div className="border-y-2 border-slate-100 py-4 space-y-3">
                      <p className="text-xs font-black text-slate-700 uppercase tracking-wide">This will allow AI-Mom to:</p>
                      
                      <div className="flex items-start gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          className="w-4 h-4 text-[#4285F4] border-slate-300 rounded mt-0.5 focus:ring-[#4285F4]"
                        />
                        <div>
                          <p className="text-sm font-bold text-slate-800">See and read your Google Calendar events</p>
                          <p className="text-xs text-slate-500">Permission: <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-500 font-mono font-bold">calendar.events.readonly</code></p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        By clicking Allow, you permit AI-Mom to safely fetch and register calendar deadlines into your schedule dashboard. No data is stored outside of your personal database.
                      </p>

                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setSyncStep(0)}
                          className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => startSyncSimulation('harshitsinghp8@gmail.com')}
                          className="px-5 py-2 text-sm font-black text-white bg-[#4285F4] hover:bg-[#357ae8] rounded-lg transition-all shadow-md"
                        >
                          Allow
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Loading Simulator */}
                {syncStep === 2 && (
                  <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-slate-100 border-t-[#4285F4] rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-xl">
                        📅
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-black text-slate-800">Connecting Google API...</h4>
                      <p className="text-xs font-mono font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 inline-block animate-pulse">
                        Requesting Google API Permissions (calendar.events.readonly)...
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 3: Success Notification */}
                {syncStep === 3 && (
                  <div className="space-y-6 text-center py-4">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 bg-[#E8F8F5] border-4 border-[#4ECDC4] rounded-full flex items-center justify-center text-[#117A65] text-3xl shadow-md mb-3 animate-bounce">
                        ✓
                      </div>
                      <h4 className="text-2xl font-black text-slate-800">Calendar Synchronized!</h4>
                      <p className="text-xs font-bold text-[#117A65] uppercase tracking-widest bg-[#E8F8F5] px-3 py-1 rounded-full border border-[#4ECDC4] mt-1.5 inline-block">
                        Calendar Synchronized Successfully!
                      </p>
                    </div>

                    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 text-left space-y-1.5">
                      <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Newly Ingested Calendar Event</p>
                      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div>
                          <p className="font-black text-sm text-slate-800">
                            {activeRole === 'Student' ? 'Data Structures Lab Exam' : activeRole === 'Professional' ? 'Q2 Sprint Code Review' : 'Investor Pitch Deck Submission'}
                          </p>
                          <p className="text-xs text-slate-500 font-bold">
                            Due: {activeRole === 'Student' ? 'In 90 minutes (RED)' : activeRole === 'Professional' ? 'In 4 hours (AMBER)' : 'Tomorrow morning (GREEN)'}
                          </p>
                        </div>
                        <span className="text-xs font-black text-[#4285F4] bg-[#4285F4]/10 px-2 py-1 rounded-lg border border-[#4285F4]/20">
                          Google Event
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsSyncModalOpen(false)}
                      className="w-full py-3.5 bg-[#4ECDC4] text-white border-4 border-[#2D3436] rounded-xl font-black text-sm hover:bg-[#3ebcb4] transition-all shadow-[4px_4px_0px_0px_#2D3436]"
                    >
                      LET&apos;S GET BACK TO WORK!
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Status Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 bg-[#2D3436] text-[#FFEAA7] px-6 py-4 border-4 border-[#FF6B6B] rounded-2xl shadow-lg z-50 font-black text-sm flex items-center gap-2 max-w-sm"
          >
            <span className="text-lg">👵🏽</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strict Lockout Overlay */}
      <AnimatePresence>
        {criticalTask && !(simulateDeviceOff || isEscalated) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#FFECEC] z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          >
            <div className="w-full max-w-2xl bg-[#FFE5E5] border-8 border-[#2D3436] rounded-[3rem] shadow-[15px_15px_0px_0px_#2D3436] overflow-hidden my-auto p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-4 border-b-4 border-[#2D3436] pb-4">
                <div className="w-16 h-16 rounded-full bg-[#FF6B6B] border-4 border-[#2D3436] flex items-center justify-center text-4xl animate-bounce shrink-0">
                  😡
                </div>
                <div className="text-left">
                  <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase bg-[#FF6B6B] text-white border-2 border-[#2D3436] tracking-wider">
                    MOM&apos;S STRICT LOCKDOWN
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-[#900C3F] tracking-tight uppercase mt-1 leading-none">
                    ⚠️ LOCKDOWN ACTIVATED ⚠️
                  </h2>
                </div>
              </div>

              {/* Secondary Timeout Countdown to Backup Escalation */}
              {isCountingDown && (
                <div className="bg-[#FFEAA7] border-4 border-[#2D3436] p-4 rounded-2xl flex items-center justify-between shadow-[4px_4px_0px_0px_#2D3436] animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⏳</span>
                    <div className="text-left">
                      <p className="text-xs font-black text-[#2D3436] uppercase tracking-wide">Backup Contact Escalation Countdown</p>
                      <p className="text-[11px] font-bold text-slate-700">Mom is preparing to escalate to {emergencyName} in case your phone is silent.</p>
                    </div>
                  </div>
                  <div className="bg-red-600 border-2 border-[#2D3436] text-white px-3 py-1.5 rounded-xl font-black text-sm shrink-0">
                    {escalationTimeout}s
                  </div>
                </div>
              )}

              {/* Mother's Furious Dialogue based on Role */}
              <div className="bg-white p-5 border-4 border-[#2D3436] rounded-2xl space-y-2 text-left">
                <span className="text-xs font-black text-red-500 uppercase tracking-widest block">
                  MOM IS FURIOUS & OVERWHELMED:
                </span>
                <p className="text-sm md:text-base font-black text-slate-800 italic leading-relaxed">
                  {activeRole === 'Student' ? (
                    `"Padhai Likhai Kar Ke IAS Bano, but no! You are ignoring assignments! Sharma ji's son is already hired as VP of engineering and you can't even submit on time! Complete \"${criticalTask.title}\" right now or no dinner tonight!"`
                  ) : activeRole === 'Professional' ? (
                    `"Beta, do you want to get fired from your job?! I did not raise you to procrastinate on important presentations like \"${criticalTask.title}\"! Finish it immediately before the managers call!"`
                  ) : (
                    `"Your startup seed funding will vanish, beta! No venture capitalist will invest in a founder who delays strategic reviews! Open your eyes and complete \"${criticalTask.title}\" immediately!"`
                  )}
                </p>
              </div>

              {/* Critical Task Info */}
              <div className="bg-[#FF6B6B] text-white p-5 border-4 border-[#2D3436] rounded-2xl flex items-center justify-between text-left">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-pink-100 block">
                    CRITICAL URGENT TASK
                  </span>
                  <h3 className="text-base md:text-lg font-black uppercase">
                    {criticalTask.title}
                  </h3>
                </div>
                <div className="bg-white text-red-600 border-2 border-[#2D3436] font-black text-xs uppercase px-3 py-1 rounded-lg shrink-0">
                  🚨 DUE NOW
                </div>
              </div>

              {/* Multi-modal Proof form */}
              <form onSubmit={handleVerifyLockdownProof} className="space-y-4">
                {verificationFeedback && (
                  <div className="bg-[#FFF3CD] border-4 border-[#856404] p-4 rounded-xl text-xs md:text-sm font-black text-[#856404] flex gap-2 items-center">
                    <span>👵🏽</span>
                    <span>{verificationFeedback}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide block">
                    Step 1: Text Proof (Detailed explanation of completion)
                  </label>
                  <textarea
                    required
                    value={textProof}
                    onChange={(e) => setTextProof(e.target.value)}
                    placeholder="Provide a detailed, honest summary of what was completed... (Minimum 15 characters, no generic text)"
                    rows={3}
                    className="w-full p-4 border-4 border-[#2D3436] rounded-2xl bg-white font-bold text-sm focus:outline-none text-[#2D3436]"
                  />
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase px-1">
                    <span>Characters: {textProof.length}</span>
                    <span>Required: 15+</span>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide block">
                    Step 2: Visual Proof (Screenshot / File Attachment)
                  </label>
                  
                  {/* Mock file upload drop area */}
                  <div 
                    onClick={() => {
                      const fakeFiles = [
                        "submission_screenshot.png",
                        "final_report_draft.pdf",
                        "commit_log_proof.png",
                        "presentation_slide_1.jpg"
                      ];
                      const chosen = fakeFiles[Math.floor(Math.random() * fakeFiles.length)];
                      setProofFileName(chosen);
                      showToast(`Attached proof: ${chosen}`);
                    }}
                    className="border-4 border-dashed border-[#2D3436] bg-white hover:bg-slate-50 p-6 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all space-y-2 text-center"
                  >
                    <UploadCloud className="w-10 h-10 text-slate-500" />
                    <div>
                      <p className="text-sm font-black text-[#2D3436]">
                        {proofFileName ? `Selected: ${proofFileName}` : "Drag & drop or Click to attach proof"}
                      </p>
                      <p className="text-xs font-bold text-slate-400 mt-1">
                        Screenshot, Document, or Zip files accepted (Max 10MB)
                      </p>
                    </div>
                  </div>

                  {/* Easy Hackathon Judge presets */}
                  <div className="flex flex-wrap gap-2 justify-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProofFileName("submission_approved.png");
                        setTextProof("I have completed and compiled all required chemical lab reports and safely uploaded them to the college portal.");
                        showToast("Demo preset 1 loaded!");
                      }}
                      className="bg-white/60 hover:bg-white text-[11px] font-black text-slate-600 px-3 py-1.5 border-2 border-[#2D3436] rounded-xl transition-all"
                    >
                      🧪 [Preset] Chemistry Lab Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFileName("quarterly_report_slide.png");
                        setTextProof("The business presentation deck has been updated with financial projections and shared with leadership.");
                        showToast("Demo preset 2 loaded!");
                      }}
                      className="bg-white/60 hover:bg-white text-[11px] font-black text-slate-600 px-3 py-1.5 border-2 border-[#2D3436] rounded-xl transition-all"
                    >
                      📊 [Preset] Pitch Deck Shared
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={verifyingProof}
                    className="w-full bg-[#FF6B6B] text-white py-4 border-4 border-[#2D3436] rounded-2xl text-lg font-black shadow-[0px_6px_0px_0px_#2D3436] active:shadow-none active:translate-y-1 hover:bg-[#ff5656] disabled:bg-slate-400 transition-all flex items-center justify-center gap-2"
                  >
                    {verifyingProof ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        <span>Mom is evaluating your proof with her third eye...</span>
                      </>
                    ) : (
                      <>
                        <span>VERIFY WITH MOM & UNLOCK</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Escape Hatch Option */}
              <div className="pt-4 border-t-4 border-dashed border-slate-200 text-center">
                <button
                  type="button"
                  id="postpone-or-drop-btn"
                  onClick={() => {
                    setIsExcusePanelOpen(!isExcusePanelOpen);
                    setExcuseFeedback(null);
                  }}
                  className="px-6 py-3 bg-[#00CEC9] text-[#2D3436] border-4 border-[#2D3436] rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-[#00b2ae] shadow-[4px_4px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  Postpone or Drop Task
                </button>
              </div>

              {/* Submit Excuse Inner Dialogue Panel */}
              <AnimatePresence>
                {isExcusePanelOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <form 
                      onSubmit={handleEvaluateExcuse}
                      className="bg-[#FFF9F2] p-5 border-4 border-[#2D3436] rounded-2xl space-y-4 text-left mt-4"
                    >
                      <h4 className="text-sm font-black text-[#E17055] uppercase tracking-wider flex items-center gap-2">
                        👵🏽 <span>Submit Your Excuse to Mom</span>
                      </h4>

                      {excuseFeedback && (
                        <div className="bg-[#FFE3E3] border-4 border-[#D63031] p-4 rounded-xl text-xs md:text-sm font-black text-[#D63031]">
                          {excuseFeedback}
                        </div>
                      )}

                       {/* Simply Refuse Toggle Row */}
                      <div className="p-3 bg-red-50 border-4 border-[#2D3436] rounded-xl flex items-center justify-between gap-3">
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-black text-red-600 uppercase tracking-wide">Simply Refuse Task</span>
                          <span className="text-[10px] text-slate-500 font-bold leading-tight">No explanations. I won&apos;t do it.</span>
                        </div>
                        <button
                          type="button"
                          id="refuse-simply-toggle"
                          onClick={() => {
                            setIsRefusingSimply(!isRefusingSimply);
                            setExcuseFeedback(null);
                          }}
                          className={`px-4 py-2 border-4 border-[#2D3436] rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            isRefusingSimply 
                              ? 'bg-[#FF6B6B] text-white shadow-[2px_2px_0px_0px_#2D3436]' 
                              : 'bg-white text-[#2D3436] hover:bg-slate-50'
                          }`}
                        >
                          {isRefusingSimply ? "Enabled" : "Disabled"}
                        </button>
                      </div>

                      {!isRefusingSimply ? (
                        <>
                          <div className="space-y-1">
                            <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide block">
                              Select Action
                            </label>
                            <select
                              value={excuseAction}
                              onChange={(e) => setExcuseAction(e.target.value as 'Postpone' | 'Cancel')}
                              className="w-full p-3 border-4 border-[#2D3436] rounded-xl bg-white font-bold text-sm focus:outline-none text-[#2D3436]"
                            >
                              <option value="Postpone">Postpone Deadline (Push 24 Hours)</option>
                              <option value="Cancel">Cancel Task Completely</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-black text-[#2D3436] uppercase tracking-wide block">
                              Why are you changing your plans? (Mandatory)
                            </label>
                            <textarea
                              required={!isRefusingSimply}
                              value={excuseText}
                              onChange={(e) => setExcuseText(e.target.value)}
                              placeholder="Provide a valid, realistic reason (e.g. medical emergency, client delay)... (Minimum 25 characters)"
                              rows={3}
                              className="w-full p-4 border-4 border-[#2D3436] rounded-xl bg-white font-bold text-sm focus:outline-none text-[#2D3436]"
                            />
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase px-1">
                              <span>Characters: {excuseText.length}</span>
                              <span>Required: 25+</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div id="simply-refuse-warning" className="bg-[#FFE3E3] border-4 border-[#D63031] p-4 rounded-xl text-xs md:text-sm font-black text-[#D63031]">
                          ⚠️ Warning: Simply refusing a task will severely damage Mom&apos;s Approval Rating and trigger an immediate maternal lecture.
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          type="submit"
                          id="submit-excuse-or-refuse-btn"
                          disabled={evaluatingExcuse}
                          className={`flex-1 py-3 border-4 border-[#2D3436] rounded-xl text-xs md:text-sm font-black shadow-[3px_3px_0px_0px_#2D3436] active:shadow-none active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isRefusingSimply
                              ? 'bg-[#FF6B6B] text-white hover:bg-red-600'
                              : 'bg-[#E17055] text-white hover:bg-[#d15f43]'
                          } disabled:bg-slate-400`}
                        >
                          {evaluatingExcuse ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                              <span>{isRefusingSimply ? "Processing Refusal..." : "Mom is analyzing your excuses..."}</span>
                            </>
                          ) : (
                            <span>{isRefusingSimply ? "CONFIRM REFUSAL" : "SUBMIT EXCUSE"}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsExcusePanelOpen(false);
                            setExcuseFeedback(null);
                          }}
                          className="px-4 py-3 bg-white text-[#2D3436] border-4 border-[#2D3436] rounded-xl text-xs md:text-sm font-black hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          CANCEL
                        </button>
                      </div>

                      {/* Hackathon preset options */}
                      {!isRefusingSimply && (
                        <div className="flex flex-wrap gap-2 justify-center pt-2 border-t-2 border-dashed border-slate-300">
                          <button
                            type="button"
                            onClick={() => {
                              setExcuseText("I have a high fever, 102 degrees, and need to see a general physician immediately.");
                              showToast("Preset excuse loaded!");
                            }}
                            className="bg-white/60 hover:bg-white text-[10px] font-black text-slate-600 px-2 py-1 border-2 border-[#2D3436] rounded-lg transition-all"
                          >
                            🤒 [Preset] Sickness/Fever
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExcuseText("The server is completely down due to a major hosting provider outage.");
                              showToast("Preset excuse loaded!");
                            }}
                            className="bg-white/60 hover:bg-white text-[10px] font-black text-slate-600 px-2 py-1 border-2 border-[#2D3436] rounded-lg transition-all"
                          >
                            🌐 [Preset] Server Outage
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setExcuseText("I don't care, I will do it later.");
                              showToast("Preset lazy excuse loaded!");
                            }}
                            className="bg-white/60 hover:bg-white text-[10px] font-black text-red-600 px-2 py-1 border-2 border-red-400 rounded-lg transition-all"
                          >
                            🥱 [Preset] Lazy Excuse
                          </button>
                        </div>
                      )}
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Contact Dispatched Screen Layout */}
      <AnimatePresence>
        {criticalTask && (simulateDeviceOff || isEscalated) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#FFF5F5] z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          >
            <div className="w-full max-w-2xl bg-white border-8 border-red-600 rounded-[3rem] shadow-[15px_15px_0px_0px_#2D3436] overflow-hidden my-auto p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-4 border-b-4 border-red-600 pb-4">
                <div className="w-16 h-16 rounded-full bg-red-600 border-4 border-[#2D3436] flex items-center justify-center text-4xl animate-bounce shrink-0">
                  📢
                </div>
                <div className="text-left">
                  <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase bg-red-600 text-white border-2 border-[#2D3436] tracking-wider">
                    DEVICE UNREACHABLE PROTOCOL
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-red-700 tracking-tight uppercase mt-1 leading-none">
                    Escalating to Backup Contact!
                  </h2>
                </div>
              </div>

              {/* Status Alert block */}
              <div className="bg-[#FFF5F5] border-4 border-red-500 p-5 rounded-2xl space-y-3 text-left">
                <p className="text-sm md:text-base font-black text-red-600 leading-relaxed">
                  ⚠️ Vineet&apos;s device is unresponsive. Sending critical SMS/WhatsApp alert to <span className="underline font-black">{emergencyName} ({emergencyPhone})</span> immediately to wake him up!
                </p>
              </div>

              {/* Automated Mom Message */}
              <div className="bg-slate-50 border-4 border-[#2D3436] p-5 rounded-2xl space-y-2 text-left">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                  AUTOMATED MESSAGE SENT BY MOM:
                </span>
                <div className="p-4 bg-white border-2 border-[#2D3436] rounded-xl font-mono text-xs md:text-sm text-slate-700 italic relative">
                  &ldquo;Hello {emergencyName}, this is Vineet&apos;s AI-Mom. Vineet is missing a critical deadline in 15 minutes and his phone seems to be off. Please wake him up right now to submit his work!&rdquo;
                  <span className="absolute bottom-2 right-3 text-[9px] font-black uppercase text-red-500 tracking-widest animate-pulse">
                    [SENT]
                  </span>
                </div>
              </div>

              {/* Interactive Recovery Action */}
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button
                  id="device-back-online-btn"
                  onClick={() => {
                    setSimulateDeviceOff(false);
                    setIsEscalated(false);
                    setEscalationTimeout(30);
                    showToast("Device reported back online! Lockout restored.");
                  }}
                  className="flex-1 py-3.5 bg-[#FFEAA7] text-[#2D3436] border-4 border-[#2D3436] rounded-xl font-black text-xs uppercase tracking-wider hover:bg-[#ffd653] transition-all shadow-[4px_4px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none text-center"
                >
                  🔋 Device Back Online
                </button>
                <button
                  id="backup-complete-btn"
                  onClick={async () => {
                    // Complete simulated task or standard task
                    try {
                      if (criticalTask.id && criticalTask.id !== 'simulated-critical-task' && criticalTask.id !== 'simulated-red-30') {
                        const taskRef = doc(db, 'tasks', criticalTask.id);
                        await updateDoc(taskRef, { status: 'completed' });
                      }
                      setSimulateDeviceOff(false);
                      setIsEscalated(false);
                      setEscalationTimeout(30);
                      showToast("Task marked as completed! Mom's anger has subsided.");
                    } catch (err) {
                      console.error("Failed to complete task:", err);
                      showToast("Couldn't submit. Try again!");
                    }
                  }}
                  className="flex-1 py-3.5 bg-[#4ECDC4] text-white border-4 border-[#2D3436] rounded-xl font-black text-xs uppercase tracking-wider hover:bg-[#3ebcb4] transition-all shadow-[4px_4px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none text-center"
                >
                  ✓ Submit Proof & Complete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account & Failsafe Configuration Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#FFFDF9] border-4 border-[#2D3436] rounded-[2rem] shadow-[12px_12px_0px_0px_#2D3436] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-[#FF6B6B] px-6 py-4 flex justify-between items-center text-white border-b-4 border-[#2D3436]">
                <h3 className="text-md font-black tracking-wider uppercase flex items-center gap-2">
                  <Settings className="w-5 h-5 text-white animate-spin-slow" />
                  Account & Failsafe Configuration
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 text-white hover:text-[#FFEAA7] cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveProfileSettings} className="p-6 space-y-4">
                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label htmlFor="settings-name" className="block text-xs font-black text-[#2D3436] uppercase tracking-widest mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="settings-name"
                      type="text"
                      required
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      placeholder="e.g., Vineet"
                      className="w-full p-3 border-4 border-[#2D3436] rounded-xl bg-white font-bold text-sm focus:outline-none placeholder:text-slate-400 shadow-[3px_3px_0px_0px_#2D3436]"
                    />
                  </div>

                  {/* Active Persona Role Selector */}
                  <div>
                    <label htmlFor="settings-role" className="block text-xs font-black text-[#2D3436] uppercase tracking-widest mb-1.5">
                      Active Persona Role (Mom&apos;s Mood Context)
                    </label>
                    <select
                      id="settings-role"
                      value={settingsRole}
                      onChange={(e) => setSettingsRole(e.target.value as RoleType)}
                      className="w-full p-3 border-4 border-[#2D3436] rounded-xl bg-white font-bold text-sm focus:outline-none shadow-[3px_3px_0px_0px_#2D3436]"
                    >
                      <option value="Student">🎓 Student (Vibrant, high pressure academic nagging)</option>
                      <option value="Professional">💼 Professional (Firm, corporate schedule, career-oriented)</option>
                      <option value="Entrepreneur">🚀 Entrepreneur (High stakes, investor & hustle pressure)</option>
                    </select>
                  </div>

                  {/* Backup Contact Section */}
                  <div className="bg-slate-50 border-4 border-[#2D3436] rounded-2xl p-4 space-y-4 shadow-[4px_4px_0px_0px_#2D3436]">
                    <div className="flex items-center gap-2 text-xs font-black text-[#FF6B6B] uppercase tracking-widest">
                      <Phone className="w-4 h-4 text-[#FF6B6B]" />
                      Backup Contact (Emergency Escapes)
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Backup Contact Name */}
                      <div>
                        <label htmlFor="settings-emergency-name" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          Contact Name
                        </label>
                        <input
                          id="settings-emergency-name"
                          type="text"
                          required
                          value={settingsEmergencyName}
                          onChange={(e) => setSettingsEmergencyName(e.target.value)}
                          placeholder="e.g., Rahul (Roommate)"
                          className="w-full p-2 border-2 border-[#2D3436] rounded-lg bg-white font-bold text-xs focus:outline-none"
                        />
                      </div>

                      {/* Backup Contact Phone Number */}
                      <div>
                        <label htmlFor="settings-emergency-phone" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                          WhatsApp / Mobile Number
                        </label>
                        <input
                          id="settings-emergency-phone"
                          type="text"
                          required
                          value={settingsEmergencyPhone}
                          onChange={(e) => setSettingsEmergencyPhone(e.target.value)}
                          placeholder="+91 XXXXX XXXXX"
                          className="w-full p-2 border-2 border-[#2D3436] rounded-lg bg-white font-bold text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-50 border-2 border-[#2D3436] rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-5 py-2.5 bg-[#4ECDC4] hover:bg-[#3dbbb2] text-white border-2 border-[#2D3436] rounded-xl font-black text-xs uppercase tracking-widest shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {savingSettings ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expanded Judge Control Panel */}
      <div className="fixed bottom-6 left-6 z-40 bg-white border-4 border-[#2D3436] rounded-[2rem] p-4 shadow-[6px_6px_0px_0px_#2D3436] space-y-3 max-w-xs transition-all text-left">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b-2 border-slate-100 pb-1.5">
          <span>🛠️</span> Judge Control Panel
        </h4>
        <div className="flex flex-col gap-2.5">
          <button
            id="simulate-red-btn"
            onClick={() => {
              setSimulateRedAlert(prev => !prev);
              showToast(!simulateRedAlert ? "⚠️ Simulated Lockdown Triggered! Welcome to RED Alert!" : "Lockdown simulation cleared.");
            }}
            className={`w-full ${
              simulateRedAlert 
                ? 'bg-[#FF6B6B] text-white hover:bg-[#ff5656]' 
                : 'bg-[#FFEAA7] text-[#2D3436] hover:bg-[#ffe285]'
            } border-2 border-[#2D3436] px-3 py-2 rounded-xl text-xs font-black shadow-[2px_2px_0px_0px_#2D3436] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5`}
          >
            <span>🚨</span>
            <span>{simulateRedAlert ? "CLEAR SIMULATION" : "SIMULATE RED ALERT"}</span>
          </button>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 border-2 border-slate-200 hover:border-[#2D3436] p-2 rounded-xl transition-all">
            <input
              type="checkbox"
              id="simulate-device-off-toggle"
              checked={simulateDeviceOff}
              onChange={(e) => {
                setSimulateDeviceOff(e.target.checked);
                if (e.target.checked) {
                  showToast("🔋 Simulated: Device powered off / Dead Battery!");
                } else {
                  showToast("🔋 Simulated: Device powered back on!");
                }
              }}
              className="w-4 h-4 text-[#FF6B6B] focus:ring-[#FF6B6B] border-slate-300 rounded"
            />
            <div>
              <p className="text-[10px] font-black text-[#2D3436] uppercase leading-none">Simulate Device Off</p>
              <p className="text-[9px] font-bold text-slate-500 mt-0.5">Bypasses to emergency failsafe</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
