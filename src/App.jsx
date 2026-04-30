import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QUESTION_BOX_UNLOCKED } from "./config/questionBoxSettings";
import { sparkPrompts } from "./data/sparkPrompts";
import { audioManager } from "./lib/audioManager";
import { hasSupabaseConfig, supabase } from "./lib/supabase";

const QUESTION_CATEGORIES = [
  {
    value: "self",
    label: "About Ourselves",
    shortLabel: "Self",
    description: "Feelings, dreams, habits, and things that are usually hard to open up.",
  },
  {
    value: "relationship",
    label: "About Our Relationship",
    shortLabel: "Us",
    description: "How we love, argue, repair, and grow together.",
  },
];

const starSeeds = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 11) % 100}%`,
  top: `${(index * 53 + 7) % 100}%`,
  size: 1.5 + (index % 4),
  delay: `${(index % 8) * 0.7}s`,
  duration: `${7 + (index % 6)}s`,
}));

function shuffleQuestions(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeQuestion(question, fallbackCategory = "relationship") {
  const categoryValues = QUESTION_CATEGORIES.map((category) => category.value);

  return {
    ...question,
    category: categoryValues.includes(question.category) ? question.category : fallbackCategory,
    is_opened: Boolean(question.is_opened),
    source: question.source ?? "supabase",
  };
}

function isMissingCategoryColumn(error) {
  return error?.message?.toLowerCase().includes("category");
}

function App() {
  const [hasBegun, setHasBegun] = useState(false);
  const [muted, setMuted] = useState(false);
  const [view, setView] = useState(QUESTION_BOX_UNLOCKED ? "box" : "write");
  const [questions, setQuestions] = useState([]);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const beginExperience = async () => {
    await audioManager.begin();
    audioManager.play("click");
    setHasBegun(true);
  };

  const changeView = (nextView) => {
    if (nextView === "box" && !QUESTION_BOX_UNLOCKED) {
      audioManager.play("locked");
      setView("write");
      return;
    }

    audioManager.play("click");
    setView(nextView);
  };

  const toggleMuted = () => {
    const nextMuted = !muted;
    if (!nextMuted) {
      setMuted(nextMuted);
      audioManager.setMuted(nextMuted);
      window.setTimeout(() => audioManager.play("click"), 40);
      return;
    }

    audioManager.play("click");
    setMuted(nextMuted);
    audioManager.setMuted(nextMuted);
  };

  const loadQuestions = useCallback(async () => {
    setError("");

    if (!hasSupabaseConfig) {
      setQuestions((current) => shuffleQuestions(current.filter((question) => question.source === "local")));
      return;
    }

    setIsLoading(true);

    const withCategory = await supabase
      .from("questions")
      .select("id, text, category, is_opened, created_at")
      .order("created_at", { ascending: false });

    if (!withCategory.error) {
      setQuestions(shuffleQuestions((withCategory.data ?? []).map((question) => normalizeQuestion(question))));
      setIsLoading(false);
      return;
    }

    if (!isMissingCategoryColumn(withCategory.error)) {
      setError("Question Box belum bisa terhubung ke Supabase. Cek keys dan table policy.");
      setIsLoading(false);
      return;
    }

    const withoutCategory = await supabase
      .from("questions")
      .select("id, text, is_opened, created_at")
      .order("created_at", { ascending: false });

    if (withoutCategory.error) {
      setError("Question Box belum bisa terhubung ke Supabase. Cek keys dan table policy.");
      setIsLoading(false);
      return;
    }

    setQuestions(
      shuffleQuestions(
        (withoutCategory.data ?? []).map((question) => normalizeQuestion(question, "relationship")),
      ),
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (hasBegun) {
      void loadQuestions();
    }
  }, [hasBegun, loadQuestions]);

  const clearSuccess = useCallback(() => setSuccess(""), []);

  const addQuestion = async ({ text, category }) => {
    const trimmedText = text.trim();

    if (!trimmedText || !category) return false;

    audioManager.play("submit");
    setError("");

    if (!hasSupabaseConfig) {
      setQuestions((current) =>
        shuffleQuestions([
          normalizeQuestion({
            id: `local-${Date.now()}`,
            text: trimmedText,
            category,
            is_opened: false,
            source: "local",
          }),
          ...current,
        ]),
      );
      setSuccess("Saved. Question count increased by one.");
      return true;
    }

    const payload = { text: trimmedText, category, is_opened: false };
    const inserted = await supabase
      .from("questions")
      .insert(payload)
      .select("id, text, category, is_opened, created_at")
      .single();

    if (!inserted.error) {
      setQuestions((current) =>
        shuffleQuestions([normalizeQuestion(inserted.data), ...current]),
      );
      setSuccess("Saved. Question count increased by one.");
      return true;
    }

    if (!isMissingCategoryColumn(inserted.error)) {
      setError("That question could not be saved yet. Supabase may need insert permission.");
      return false;
    }

    const fallbackInsert = await supabase
      .from("questions")
      .insert({ text: trimmedText, is_opened: false })
      .select("id, text, is_opened, created_at")
      .single();

    if (fallbackInsert.error) {
      setError("That question could not be saved yet. Supabase may need insert permission.");
      return false;
    }

    setQuestions((current) =>
      shuffleQuestions([normalizeQuestion(fallbackInsert.data, category), ...current]),
    );
    setSuccess("Saved. Add the category column in Supabase so the category persists too.");
    return true;
  };

  const openQuestion = (question) => {
    if (!QUESTION_BOX_UNLOCKED) {
      audioManager.play("locked");
      return;
    }

    audioManager.play("open");
    setActiveQuestion(question);
  };

  const drawQuestion = () => {
    if (!QUESTION_BOX_UNLOCKED) {
      audioManager.play("locked");
      return;
    }

    const unopenedQuestions = questions.filter((question) => !question.is_opened);
    const candidates = unopenedQuestions.length ? unopenedQuestions : questions;

    if (!candidates.length) {
      audioManager.play("locked");
      setError("Add a question first, then you can draw one later.");
      return;
    }

    audioManager.play("draw");
    setActiveQuestion(pickRandom(candidates));
  };

  const markQuestionOpened = async (questionId) => {
    const selectedQuestion = questions.find((question) => question.id === questionId);

    setQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? { ...question, is_opened: true } : question,
      ),
    );

    if (!hasSupabaseConfig || selectedQuestion?.source !== "supabase") return;

    const { error: updateError } = await supabase
      .from("questions")
      .update({ is_opened: true })
      .eq("id", questionId);

    if (updateError) {
      setError("It opened here, but Supabase could not mark it as opened yet.");
    }
  };

  const closeActiveQuestion = async () => {
    audioManager.play("click");

    if (activeQuestion) {
      await markQuestionOpened(activeQuestion.id);
    }

    setActiveQuestion(null);
  };

  const openNextQuestion = async () => {
    if (!activeQuestion) return;

    await markQuestionOpened(activeQuestion.id);

    const nextCandidates = questions.filter(
      (question) => question.id !== activeQuestion.id && !question.is_opened,
    );

    if (!nextCandidates.length) {
      audioManager.play("click");
      setActiveQuestion(null);
      return;
    }

    audioManager.play("open");
    setActiveQuestion(pickRandom(nextCandidates));
  };

  if (!hasBegun) {
    return <LandingScreen onBegin={beginExperience} />;
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#050716] text-stone-50">
      <CosmicBackdrop />

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 pb-24 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
        <TopBar
          muted={muted}
          view={view}
          onChangeView={changeView}
          onToggleMuted={toggleMuted}
        />

        <AnimatePresence mode="wait">
          {view === "write" ? (
            <WriteView
              key="write"
              error={error}
              isLoading={isLoading}
              questionCount={questions.length}
              success={success}
              onSubmit={addQuestion}
              onSuccessSettled={clearSuccess}
              onSwitchView={() => changeView("box")}
            />
          ) : (
            <QuestionBoxView
              key="box"
              activeQuestion={activeQuestion}
              error={error}
              isLoading={isLoading}
              questions={questions}
              onClose={closeActiveQuestion}
              onDraw={drawQuestion}
              onNext={openNextQuestion}
              onOpenQuestion={openQuestion}
              onReload={loadQuestions}
              onSwitchView={() => changeView("write")}
            />
          )}
        </AnimatePresence>

        {QUESTION_BOX_UNLOCKED && <MobileDock view={view} onChangeView={changeView} />}
      </main>
    </div>
  );
}

function LandingScreen({ onBegin }) {
  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden bg-[#030513] px-5 text-stone-50">
      <CosmicBackdrop />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col justify-end pb-10 pt-16 sm:justify-center sm:pb-16"
      >
        <p className="mb-4 max-w-fit border-b border-sky-100/20 pb-3 text-xs uppercase tracking-[0.34em] text-sky-100/65 sm:tracking-[0.48em]">
          Private question box
        </p>
        <h1 className="max-w-4xl font-serif text-6xl font-semibold leading-none text-stone-50 sm:text-8xl">
          Our Deep Talk
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-base leading-8 text-blue-100/72 sm:text-xl sm:leading-9">
          Write the questions first, collect them slowly, then open the Question Box when the time feels right.
        </p>
        <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBegin}
            className="rounded-full border border-sky-100/25 bg-sky-100 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-slate-950 shadow-aurora transition hover:bg-white"
          >
            Begin
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function TopBar({ muted, view, onChangeView, onToggleMuted }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-blue-100/50 sm:tracking-[0.38em]">
          Twilight Ritual
        </p>
        <h1 className="mt-2 font-serif text-3xl text-stone-50 sm:text-4xl">
          Question Box
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {QUESTION_BOX_UNLOCKED && (
          <div className="hidden sm:block">
            <ModeSwitch view={view} onChangeView={onChangeView} />
          </div>
        )}
        <button
          aria-label={muted ? "Unmute audio" : "Mute audio"}
          onClick={onToggleMuted}
          className="icon-button"
        >
          {muted ? <MutedIcon /> : <SoundIcon />}
        </button>
      </div>
    </header>
  );
}

function ModeSwitch({ view, onChangeView }) {
  return (
    <nav className="mode-switch" aria-label="Mode switch">
      {["write", "box"].map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChangeView(mode)}
          className={view === mode ? "is-active" : ""}
        >
          {mode === "write" ? "Write" : "Question Box"}
        </button>
      ))}
    </nav>
  );
}

function MobileDock({ view, onChangeView }) {
  return (
    <div className="mobile-dock sm:hidden">
      <ModeSwitch view={view} onChangeView={onChangeView} />
    </div>
  );
}

function WriteView({
  error,
  isLoading,
  questionCount,
  success,
  onSubmit,
  onSuccessSettled,
  onSwitchView,
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sparkPage, setSparkPage] = useState(0);
  const textareaRef = useRef(null);
  const visibleSparks = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const sparkIndex = (sparkPage + index) % sparkPrompts.length;
        return sparkPrompts[sparkIndex];
      }),
    [sparkPage],
  );

  useEffect(() => {
    if (!success) return;

    const timer = window.setTimeout(onSuccessSettled, 2600);
    return () => window.clearTimeout(timer);
  }, [success, onSuccessSettled]);

  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  const handleTextChange = (event) => {
    setText(event.target.value);
    window.requestAnimationFrame(resizeTextarea);
  };

  const chooseCategory = (nextCategory) => {
    audioManager.play("click");
    setCategory(nextCategory);
  };

  const borrowSpark = (prompt) => {
    audioManager.play("click");
    setText(prompt);
    window.requestAnimationFrame(resizeTextarea);
  };

  const shuffleSparks = () => {
    audioManager.play("draw");
    setSparkPage((current) => (current + 4) % sparkPrompts.length);
  };

  const submitQuestion = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    const saved = await onSubmit({ text, category });
    setIsSaving(false);

    if (saved) {
      setText("");
      setCategory("");
      window.requestAnimationFrame(resizeTextarea);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="grid flex-1 place-items-start py-8 lg:py-12"
    >
      <motion.form
        onSubmit={submitQuestion}
        className="glass-card w-full max-w-4xl p-5 sm:p-7"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-blue-100/48">
              Add Question
            </p>
            <h2 className="mt-2 font-serif text-4xl leading-none text-stone-50 sm:text-5xl">
              Write one question.
            </h2>
          </div>
          <QuestionCountBadge count={questionCount} isLoading={isLoading} />
        </div>

        <CategoryPicker category={category} onChooseCategory={chooseCategory} />

        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/20 p-3 shadow-inner shadow-sky-950/30 sm:p-5">
          <label htmlFor="question" className="sr-only">
            Write a deep talk question
          </label>
          <textarea
            id="question"
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            placeholder="Write the question here..."
            className="cosmic-textarea min-h-52 w-full resize-none rounded-[1.15rem] border border-sky-200/10 bg-white/[0.04] p-5 font-serif text-3xl leading-tight text-stone-50 outline-none transition placeholder:text-blue-100/30 focus:border-sky-200/40 focus:bg-white/[0.07] sm:min-h-60 sm:p-7 sm:text-5xl"
          />
        </div>

        <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-blue-100/50">
              Borrow A Spark
            </p>
            <button
              type="button"
              onClick={shuffleSparks}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/70 transition hover:text-amber-50"
            >
              Shuffle
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {visibleSparks.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => borrowSpark(prompt)}
                className="spark-button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <StatusLine
            category={category}
            error={error}
            success={success}
            text={text}
          />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isSaving || !text.trim() || !category}
            className="rounded-full bg-gradient-to-r from-sky-100 via-blue-100 to-amber-100 px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-950 shadow-aurora transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? "Sending..." : "Add Star"}
          </motion.button>
        </div>

        {QUESTION_BOX_UNLOCKED ? (
          <div className="mt-7 flex justify-center border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={onSwitchView}
              className="group text-sm uppercase tracking-[0.22em] text-blue-100/55 transition hover:text-blue-50"
            >
              Open Question Box
              <span className="mx-auto mt-2 block h-px w-10 bg-blue-100/30 transition group-hover:w-full group-hover:bg-blue-50/70" />
            </button>
          </div>
        ) : (
          <div className="mt-7 rounded-[1.25rem] border border-amber-100/15 bg-amber-100/[0.07] px-4 py-3 text-sm leading-6 text-amber-50/72">
            The Question Box is locked. For now, the flow only collects questions
            and lets you watch the count grow.
          </div>
        )}
      </motion.form>
    </motion.section>
  );
}

function CategoryPicker({ category, onChooseCategory }) {
  return (
    <div className="category-picker" role="radiogroup" aria-label="Question category">
      {QUESTION_CATEGORIES.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChooseCategory(item.value)}
          className={category === item.value ? "is-active" : ""}
          role="radio"
          aria-checked={category === item.value}
        >
          <span>{item.label}</span>
          <small>{item.description}</small>
        </button>
      ))}
    </div>
  );
}

function QuestionCountBadge({ count, isLoading }) {
  return (
    <div className="question-count">
      <span>{isLoading ? "Loading" : "Number of Questions :"}</span>
      <strong>{isLoading ? "..." : count}</strong>
    </div>
  );
}

function StatusLine({ category, error, success, text }) {
  return (
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
        ) : !category ? (
          <motion.p key="category" className="text-blue-100/45">
            Choose a category first.
          </motion.p>
        ) : !text.trim() ? (
          <motion.p key="text" className="text-blue-100/45">
            Then write the question.
          </motion.p>
        ) : (
          <motion.p key="ready" className="text-blue-100/45">
            Ready to add to the Question Box.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuestionBoxView({
  activeQuestion,
  error,
  isLoading,
  questions,
  onClose,
  onDraw,
  onNext,
  onOpenQuestion,
  onReload,
  onSwitchView,
}) {
  if (!QUESTION_BOX_UNLOCKED) {
    return <LockedQuestionBox questionCount={questions.length} onSwitchView={onSwitchView} />;
  }

  const unopenedCount = questions.filter((question) => !question.is_opened).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex-1 py-8 lg:py-10"
    >
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="mt-2 max-w-3xl font-serif text-4xl leading-none text-stone-50 sm:text-6xl">
            Draw a question.
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-blue-100/60">
            {unopenedCount} unopened from {questions.length} total.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            disabled={isLoading || !questions.length}
            onClick={onDraw}
            className="rounded-full bg-sky-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-aurora transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Draw A Question
          </button>
          <button
            onClick={() => {
              audioManager.play("click");
              onReload();
            }}
            className="soft-button"
          >
            Refresh
          </button>
          <button
            onClick={onSwitchView}
            className="rounded-full border border-amber-100/20 bg-amber-100/10 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-50/85 transition hover:border-amber-100/40 hover:bg-amber-100/15"
          >
            Write More
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-rose-200/15 bg-rose-300/[0.07] px-5 py-4 text-sm text-rose-100/80">
          {error}
        </div>
      )}

      {isLoading ? (
        <LoadingBox />
      ) : questions.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <EmptyBox onSwitchView={onSwitchView} />
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

function LockedQuestionBox({ questionCount, onSwitchView }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
      className="grid flex-1 place-items-center py-12"
    >
      <div className="glass-card max-w-xl p-7 text-center sm:p-10">
        <p className="text-xs uppercase tracking-[0.32em] text-amber-100/55">
          Locked
        </p>
        <h2 className="mt-4 font-serif text-5xl leading-none text-stone-50">
          Question Box is closed.
        </h2>
        <p className="mt-5 leading-7 text-blue-100/62">
          There are {questionCount} questions saved. For now, opening questions is
          turned off in the config.
        </p>
        <button
          onClick={onSwitchView}
          className="mt-7 rounded-full bg-sky-100 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950"
        >
          Back To Write
        </button>
      </div>
    </motion.section>
  );
}

function QuestionCard({ index, question, onClick }) {
  const isOpened = Boolean(question.is_opened);
  const category = QUESTION_CATEGORIES.find((item) => item.value === question.category);

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className={`question-card ${isOpened ? "question-card-opened" : "question-card-unopened"}`}
    >
      <span className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.24em] text-blue-100/45">
          Star {String(index + 1).padStart(2, "0")}
        </span>
        <span className="category-chip">{category?.shortLabel ?? "Question"}</span>
      </span>
      <span className="relative z-10 mt-auto line-clamp-4 font-serif text-2xl leading-tight text-stone-50">
        {isOpened ? question.text : "Mystery question"}
      </span>
      <span className="relative z-10 mt-4 h-px w-16 bg-gradient-to-r from-transparent via-blue-100/50 to-transparent" />
    </motion.button>
  );
}

function QuestionModal({ question, onClose, onNext }) {
  const [finished, setFinished] = useState(false);
  const category = QUESTION_CATEGORIES.find((item) => item.value === question.category);

  const handleComplete = useCallback(() => {
    setFinished(true);
  }, []);

  useEffect(() => {
    setFinished(false);
  }, [question.id]);

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
        className="glass-card relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-5 sm:p-7"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="rounded-[1.5rem] border border-white/10 bg-[#080b1d]/72 p-6 shadow-inner shadow-black/35 sm:p-10">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
            className="text-xs uppercase tracking-[0.32em] text-sky-100/45"
          >
            {category?.label ?? "Question"}
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45, ease: "easeOut" }}
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
          <button onClick={onClose} className="soft-button">
            Close
          </button>
          <button
            onClick={onNext}
            className="rounded-full bg-gradient-to-r from-sky-100 via-blue-100 to-amber-100 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 shadow-aurora transition hover:shadow-ember"
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
  const lastWarningSecond = useRef(null);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = 1 - remaining / duration;
  const offset = circumference * (1 - progress);
  const timerColor = mixColor([130, 224, 255], [245, 179, 91], progress);

  useEffect(() => {
    const startedAt = Date.now();
    completed.current = false;
    lastWarningSecond.current = null;
    setRemaining(duration);

    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const nextRemaining = Math.max(duration - elapsed, 0);

      setRemaining(nextRemaining);

      if (
        nextRemaining <= 5 &&
        nextRemaining > 0 &&
        lastWarningSecond.current !== nextRemaining
      ) {
        lastWarningSecond.current = nextRemaining;
        audioManager.play("timerWarning");
      }

      if (nextRemaining === 0 && !completed.current) {
        completed.current = true;
        audioManager.play("timerComplete");
        onComplete();
        window.clearInterval(interval);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-28 w-28 place-items-center">
        <svg className="-rotate-90 block" width="112" height="112" viewBox="0 0 112 112">
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
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-sans text-3xl leading-none text-stone-50">
          {remaining}
        </span>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-blue-100/45">
          60 seconds
        </p>
        <p className="mt-2 max-w-48 text-sm leading-6 text-blue-100/60">
          Let the answer breathe before the next star opens.
        </p>
      </div>
    </div>
  );
}

function LoadingBox() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="min-h-44 animate-pulse rounded-[1.5rem] border border-white/10 bg-white/[0.04]"
        />
      ))}
    </div>
  );
}

function EmptyBox({ onSwitchView }) {
  return (
    <div className="glass-card mx-auto mt-16 max-w-xl p-8 text-center">
      <p className="font-serif text-4xl text-stone-50">Question Box is empty.</p>
      <p className="mt-4 leading-7 text-blue-100/60">
        Add the first question, then come back when the box is unlocked.
      </p>
      <button onClick={onSwitchView} className="mt-7 rounded-full bg-sky-100 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950">
        Write One
      </button>
    </div>
  );
}

function CosmicBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[linear-gradient(135deg,#02030b_0%,#071126_48%,#241426_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(77,190,219,0.18),transparent_30%),radial-gradient(circle_at_86%_16%,rgba(255,205,151,0.12),transparent_28%),radial-gradient(circle_at_64%_82%,rgba(198,88,132,0.13),transparent_34%)]" />
      <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200/5 blur-3xl" />
      {starSeeds.map((star) => (
        <span
          key={star.id}
          className="twinkle-star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            animationDuration: star.duration,
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
