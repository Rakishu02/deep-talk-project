import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { audioManager } from "./lib/audioManager";
import { hasSupabaseConfig, supabase } from "./lib/supabase";

const demoQuestions = [
  {
    id: 1,
    text: "What is a tiny moment with me that you still replay in your mind?",
    is_opened: false,
  },
  {
    id: 2,
    text: "When do you feel the most emotionally safe with us?",
    is_opened: false,
  },
  {
    id: 3,
    text: "What dream have you been quietly carrying that you want me to know about?",
    is_opened: false,
  },
  {
    id: 4,
    text: "What is one way I can love you more gently this season?",
    is_opened: false,
  },
  {
    id: 5,
    text: "What part of our story feels most like magic to you?",
    is_opened: true,
  },
];

const starSeeds = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: 2 + Math.random() * 5,
  delay: Math.random() * 8,
  duration: 7 + Math.random() * 10,
  drift: 8 + Math.random() * 28,
}));

function App() {
  const [hasBegun, setHasBegun] = useState(false);
  const [muted, setMuted] = useState(false);
  const [view, setView] = useState("write");
  const [questions, setQuestions] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const beginExperience = async () => {
    await audioManager.begin();
    setHasBegun(true);
  };

  const toggleMuted = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    audioManager.setMuted(nextMuted);
  };

  const loadQuestions = useCallback(async () => {
    setError("");

    if (!hasSupabaseConfig) {
      setQuestions((current) => (current.length ? current : demoQuestions));
      return;
    }

    setIsLoading(true);
    const { data, error: loadError } = await supabase
      .from("questions")
      .select("id, text, is_opened, created_at")
      .order("id", { ascending: true });

    setIsLoading(false);

    if (loadError) {
      setError("The vault could not reach Supabase. Check your keys and table policy.");
      return;
    }

    setQuestions(data ?? []);
  }, []);

  useEffect(() => {
    if (view === "vault") {
      void loadQuestions();
    }
  }, [loadQuestions, view]);

  const clearSuccess = useCallback(() => setSuccess(""), []);

  const addQuestion = async (text) => {
    const trimmedText = text.trim();

    if (!trimmedText) return false;

    audioManager.play("submit");
    setError("");

    if (!hasSupabaseConfig) {
      setQuestions((current) => [
        ...current,
        {
          id: Date.now(),
          text: trimmedText,
          is_opened: false,
        },
      ]);
      setSuccess("Added to the stars");
      return true;
    }

    const { data, error: insertError } = await supabase
      .from("questions")
      .insert({ text: trimmedText, is_opened: false })
      .select("id, text, is_opened, created_at")
      .single();

    if (insertError) {
      setError("That thought could not be saved yet. Supabase may need insert permission.");
      return false;
    }

    setQuestions((current) => [...current, data]);
    setSuccess("Added to the stars");
    return true;
  };

  const openQuestion = (question) => {
    audioManager.play("open");
    setActiveQuestion(question);
  };

  const markQuestionOpened = async (questionId) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? { ...question, is_opened: true } : question,
      ),
    );

    if (!hasSupabaseConfig) return;

    const { error: updateError } = await supabase
      .from("questions")
      .update({ is_opened: true })
      .eq("id", questionId);

    if (updateError) {
      setError("The card opened locally, but Supabase could not mark it as opened.");
    }
  };

  const closeActiveQuestion = async () => {
    if (activeQuestion) {
      await markQuestionOpened(activeQuestion.id);
    }

    setActiveQuestion(null);
  };

  const openNextQuestion = async () => {
    if (!activeQuestion) return;

    const nextQuestion = questions.find(
      (question) => question.id !== activeQuestion.id && !question.is_opened,
    );

    await markQuestionOpened(activeQuestion.id);

    if (!nextQuestion) {
      setActiveQuestion(null);
      return;
    }

    audioManager.play("open");
    setActiveQuestion(nextQuestion);
  };

  if (!hasBegun) {
    return <LandingScreen onBegin={beginExperience} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050716] text-stone-50">
      <CosmicBackdrop />

      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,134,255,0.18),transparent_38%),radial-gradient(circle_at_12%_80%,rgba(255,180,126,0.10),transparent_28%)]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
        <TopBar muted={muted} onToggleMuted={toggleMuted} />

        <LayoutGroup>
          <AnimatePresence mode="wait">
            {view === "write" ? (
              <WriteView
                key="write"
                error={error}
                success={success}
                onSubmit={addQuestion}
                onSuccessSettled={clearSuccess}
                onSwitchView={() => setView("vault")}
              />
            ) : (
              <VaultView
                key="vault"
                activeQuestion={activeQuestion}
                error={error}
                isLoading={isLoading}
                questions={questions}
                onClose={closeActiveQuestion}
                onNext={openNextQuestion}
                onOpenQuestion={openQuestion}
                onReload={loadQuestions}
                onSwitchView={() => setView("write")}
              />
            )}
          </AnimatePresence>
        </LayoutGroup>
      </main>
    </div>
  );
}

function LandingScreen({ onBegin }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030513] px-5 text-stone-50">
      <CosmicBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card relative z-10 max-w-2xl px-7 py-10 text-center sm:px-12 sm:py-14"
      >
        <p className="mb-4 text-xs uppercase tracking-[0.55em] text-sky-100/65">
          Deep Talk Vault
        </p>
        <h1 className="font-serif text-5xl font-semibold leading-none text-stone-50 sm:text-7xl">
          A softer place for the two of you.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-8 text-blue-100/72 sm:text-lg">
          Open the night together, write what matters, and let each question become
          a small star you can return to.
        </p>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBegin}
          className="mt-9 rounded-full border border-sky-100/25 bg-sky-100 px-8 py-3 text-sm font-semibold uppercase tracking-[0.28em] text-slate-950 shadow-aurora transition hover:bg-white"
        >
          Begin
        </motion.button>
        <p className="mt-6 text-xs text-blue-100/45">
          Audio begins after this tap, because browsers prefer consent before enchantment.
        </p>
      </motion.div>
    </div>
  );
}

function TopBar({ muted, onToggleMuted }) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.42em] text-blue-100/50">
          Twilight Ritual
        </p>
        <h1 className="mt-2 font-serif text-3xl text-stone-50 sm:text-4xl">
          Deep Talk Vault
        </h1>
      </div>

      <button
        aria-label={muted ? "Unmute audio" : "Mute audio"}
        onClick={onToggleMuted}
        className="rounded-full border border-white/10 bg-white/[0.07] p-3 text-blue-50 shadow-glass backdrop-blur-md transition hover:border-white/25 hover:bg-white/[0.12]"
      >
        {muted ? <MutedIcon /> : <SoundIcon />}
      </button>
    </header>
  );
}

function WriteView({ error, success, onSubmit, onSuccessSettled, onSwitchView }) {
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!success) return;

    const timer = window.setTimeout(onSuccessSettled, 2400);
    return () => window.clearTimeout(timer);
  }, [success, onSuccessSettled]);

  const handleTextChange = (event) => {
    setText(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const submitQuestion = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    const saved = await onSubmit(text);
    setIsSaving(false);

    if (saved) {
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="grid flex-1 place-items-center py-12"
    >
      <motion.form
        onSubmit={submitQuestion}
        className="glass-card w-full max-w-3xl p-5 sm:p-7"
        initial={{ rotateX: 8, opacity: 0 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/20 p-4 shadow-inner shadow-sky-950/40 sm:p-6">
          <label htmlFor="question" className="sr-only">
            Write a deep talk question
          </label>
          <textarea
            id="question"
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder="What's on your mind?..."
            className="cosmic-textarea min-h-64 w-full resize-none rounded-[1.5rem] border border-sky-200/10 bg-white/[0.04] p-5 font-serif text-3xl leading-tight text-stone-50 outline-none transition placeholder:text-blue-100/30 focus:border-sky-200/40 focus:bg-white/[0.07] sm:p-7 sm:text-5xl"
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-7 text-sm">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.p
                  key="success"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-amber-100/85"
                >
                  {success}
                </motion.p>
              ) : error ? (
                <motion.p
                  key="error"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-rose-200/85"
                >
                  {error}
                </motion.p>
              ) : (
                <motion.p
                  key="hint"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-blue-100/45"
                >
                  One question. One honest minute. No rush.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            disabled={isSaving || !text.trim()}
            className="rounded-full bg-gradient-to-r from-sky-100 via-blue-100 to-amber-100 px-7 py-3 text-sm font-semibold uppercase tracking-[0.25em] text-slate-950 shadow-aurora transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Sending..." : "Add Star"}
          </motion.button>
        </div>

        <div className="mt-7 flex justify-center border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={onSwitchView}
            className="group text-sm uppercase tracking-[0.28em] text-blue-100/55 transition hover:text-blue-50"
          >
            Enter The Vault
            <span className="mx-auto mt-2 block h-px w-10 bg-blue-100/30 transition group-hover:w-full group-hover:bg-blue-50/70" />
          </button>
        </div>
      </motion.form>
    </motion.section>
  );
}

function VaultView({
  activeQuestion,
  error,
  isLoading,
  questions,
  onClose,
  onNext,
  onOpenQuestion,
  onReload,
  onSwitchView,
}) {
  const unopenedCount = questions.filter((question) => !question.is_opened).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex-1 py-10"
    >
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-amber-100/50">
            The Vault
          </p>
          <h2 className="mt-2 font-serif text-4xl text-stone-50 sm:text-6xl">
            Choose a star, then stay.
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-blue-100/60">
            {unopenedCount} unopened {unopenedCount === 1 ? "question" : "questions"} waiting
            in the dark.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onReload}
            className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-blue-50/75 transition hover:border-white/25 hover:bg-white/[0.1]"
          >
            Refresh
          </button>
          <button
            onClick={onSwitchView}
            className="rounded-full border border-amber-100/20 bg-amber-100/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-amber-50/85 transition hover:border-amber-100/40 hover:bg-amber-100/15"
          >
            Write More
          </button>
        </div>
      </div>

      {!hasSupabaseConfig && (
        <div className="mb-5 rounded-3xl border border-sky-100/10 bg-sky-100/[0.06] px-5 py-4 text-sm leading-6 text-blue-50/65">
          Supabase is not configured yet, so the vault is using demo stars. Add
          `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env` when you are ready.
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-3xl border border-rose-200/15 bg-rose-300/[0.07] px-5 py-4 text-sm text-rose-100/80">
          {error}
        </div>
      )}

      {isLoading ? (
        <LoadingVault />
      ) : questions.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              index={index}
              question={question}
              onClick={() => onOpenQuestion(question)}
            />
          ))}
        </div>
      ) : (
        <EmptyVault onSwitchView={onSwitchView} />
      )}

      <AnimatePresence>
        {activeQuestion && (
          <QuestionModal
            key={activeQuestion.id}
            question={activeQuestion}
            onClose={onClose}
            onNext={onNext}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function QuestionCard({ index, question, onClick }) {
  const isOpened = Boolean(question.is_opened);
  const heightClass = ["min-h-44", "min-h-52", "min-h-48", "min-h-60"][index % 4];
  const stateClass = isOpened ? "question-card-opened" : "unopened-glow";

  return (
    <motion.button
      layoutId={`question-card-${question.id}`}
      onClick={onClick}
      whileHover={{ y: -8, rotate: index % 2 ? -1 : 1 }}
      whileTap={{ scale: 0.98 }}
      className={`question-card ${heightClass} ${stateClass}`}
    >
      <span className="absolute right-5 top-5 h-12 w-12 rounded-full bg-sky-200/10 blur-xl" />
      <span className="absolute -bottom-5 -left-5 h-24 w-24 rounded-full bg-amber-200/10 blur-2xl" />
      <span className="relative z-10 text-xs uppercase tracking-[0.38em] text-blue-100/45">
        Star {String(index + 1).padStart(2, "0")}
      </span>
      <span className="relative z-10 mt-auto font-serif text-2xl leading-tight text-stone-50">
        {isOpened ? "Opened" : "Mystery question"}
      </span>
      <span className="relative z-10 mt-4 h-px w-16 bg-gradient-to-r from-transparent via-blue-100/50 to-transparent" />
    </motion.button>
  );
}

function QuestionModal({ question, onClose, onNext }) {
  const [finished, setFinished] = useState(false);

  const handleComplete = useCallback(() => {
    audioManager.play("timer");
    setFinished(true);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-[#02030b]/85 backdrop-blur-xl"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.article
        layoutId={`question-card-${question.id}`}
        className="glass-card relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-5 sm:p-7"
      >
        <div className="rounded-[2rem] border border-white/10 bg-[#080b1d]/72 p-6 shadow-inner shadow-black/40 sm:p-10">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55 }}
            className="text-xs uppercase tracking-[0.42em] text-sky-100/45"
          >
            Open question
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-h-72 overflow-y-auto pr-1 font-serif text-4xl leading-tight text-stone-50 sm:text-6xl"
          >
            {question.text || "A quiet question is waiting here."}
          </motion.h3>

          <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:justify-between">
            <CountdownTimer duration={60} onComplete={handleComplete} />
            <AnimatePresence>
              {finished && (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="font-serif text-3xl text-amber-100"
                >
                  Time to share
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.06] px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-blue-50/75 transition hover:border-white/25 hover:bg-white/[0.1]"
          >
            Close
          </button>
          <button
            onClick={onNext}
            className="rounded-full bg-gradient-to-r from-sky-100 via-blue-100 to-amber-100 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-aurora transition hover:shadow-ember"
          >
            Next
          </button>
        </div>
      </motion.article>
    </motion.div>
  );
}

function CountdownTimer({ duration, onComplete }) {
  const [remaining, setRemaining] = useState(duration);
  const completed = useRef(false);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = 1 - remaining / duration;
  const offset = circumference * (1 - progress);
  const timerColor = mixColor([130, 224, 255], [245, 179, 91], progress);

  useEffect(() => {
    const startedAt = Date.now();
    completed.current = false;
    setRemaining(duration);

    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const nextRemaining = Math.max(duration - elapsed, 0);

      setRemaining(nextRemaining);

      if (nextRemaining === 0 && !completed.current) {
        completed.current = true;
        onComplete();
        window.clearInterval(interval);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-28 w-28 place-items-center">
        <svg className="-rotate-90" width="112" height="112" viewBox="0 0 112 112">
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
          />
          <motion.circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke={timerColor}
            strokeLinecap="round"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </svg>
        <span className="absolute font-serif text-3xl text-stone-50">{remaining}</span>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-blue-100/45">One minute</p>
        <p className="mt-2 max-w-48 text-sm leading-6 text-blue-100/60">
          Let the answer breathe before the next star opens.
        </p>
      </div>
    </div>
  );
}

function LoadingVault() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          key={index}
          className="min-h-48 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function EmptyVault({ onSwitchView }) {
  return (
    <div className="glass-card mx-auto mt-20 max-w-xl p-8 text-center">
      <p className="font-serif text-4xl text-stone-50">The sky is quiet.</p>
      <p className="mt-4 leading-7 text-blue-100/60">
        Add the first question and give this little universe something to glow about.
      </p>
      <button
        onClick={onSwitchView}
        className="mt-7 rounded-full bg-sky-100 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-950"
      >
        Write One
      </button>
    </div>
  );
}

function CosmicBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[linear-gradient(135deg,#02030b_0%,#071126_42%,#1b1230_75%,#070512_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(97,170,255,0.22),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(255,205,151,0.12),transparent_26%),radial-gradient(circle_at_60%_84%,rgba(129,95,255,0.16),transparent_32%)]" />
      <div className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/5 blur-3xl" />
      {starSeeds.map((star) => (
        <motion.span
          key={star.id}
          className="absolute rounded-full bg-sky-100"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            boxShadow: "0 0 18px rgba(191, 226, 255, 0.85)",
          }}
          animate={{
            y: [0, -star.drift, star.drift * 0.25, 0],
            opacity: [0.2, 0.92, 0.36, 0.2],
            scale: [1, 1.45, 0.9, 1],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function SoundIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10v4h4l5 4V6l-5 4H4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 9.5a4 4 0 0 1 0 5M18.6 7a7.5 7.5 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MutedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10v4h4l5 4V6l-5 4H4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m18 9-4 6M14 9l4 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function mixColor(start, end, amount) {
  const clampedAmount = Math.max(0, Math.min(1, amount));
  const [r, g, b] = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * clampedAmount),
  );

  return `rgb(${r}, ${g}, ${b})`;
}

export default App;
