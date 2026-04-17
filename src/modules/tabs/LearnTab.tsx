"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Block, BlockTitle, Button, Card, List, ListItem } from "konsta/react";
import { motion, AnimatePresence } from "framer-motion";
import AppNavbar from "@/components/AppNavbar";
import MessageIcon from "@/components/icons/MessageIcon";
import GroupAvatarIcon from "@/components/icons/GroupAvatarIcon";
import {
  lmsService,
  type LmsCourse,
  type LmsLesson,
  type LmsModuleWithLessons,
} from "@/services/LmsService";
import {
  lmsProgressService,
  type LessonProgress,
  type CourseProgressSummary,
} from "@/services/LmsProgressService";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";
import { useUserPrefsStore } from "@/stores/userPrefsStore";
import { chatService, type ChatRoom, type ChatMessage, type AttachmentResult } from "@/services/ChatService";
import MediaPreviewScreen from "@/components/chat/MediaPreviewScreen";

// ---------------------------------------------------------------------------
// Route parsing
// ---------------------------------------------------------------------------

interface LearnRouteState {
  view: "catalog" | "course" | "module" | "lesson" | "chat";
  courseId: string | null;
  moduleId: string | null;
  lessonId: string | null;
}

function parseLearnRoute(pathname: string): LearnRouteState {
  const normalized = pathname.replace(/\/+$/, "");

  // /learn/chat
  if (normalized === "/learn/chat") {
    return { view: "chat", courseId: null, moduleId: null, lessonId: null };
  }

  // /learn/:courseId/module/:moduleId
  const moduleMatch = normalized.match(/^\/learn\/([^/]+)\/module\/([^/]+)$/);
  if (moduleMatch) {
    return {
      view: "module",
      courseId: decodeURIComponent(moduleMatch[1]),
      moduleId: decodeURIComponent(moduleMatch[2]),
      lessonId: null,
    };
  }

  // /learn/:courseId/:lessonId
  const lessonMatch = normalized.match(/^\/learn\/([^/]+)\/([^/]+)$/);
  if (lessonMatch) {
    return {
      view: "lesson",
      courseId: decodeURIComponent(lessonMatch[1]),
      moduleId: null,
      lessonId: decodeURIComponent(lessonMatch[2]),
    };
  }

  // /learn/:courseId
  const courseMatch = normalized.match(/^\/learn\/([^/]+)$/);
  if (courseMatch) {
    return {
      view: "course",
      courseId: decodeURIComponent(courseMatch[1]),
      moduleId: null,
      lessonId: null,
    };
  }

  // /learn
  return { view: "catalog", courseId: null, moduleId: null, lessonId: null };
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const localeToLanguage: Record<string, LmsCourse["language"]> = {
  es: "es",
  en: "en",
  pt: "pt",
};

const NEAR_END_THRESHOLD = 15;

const cardColors = {
  bgIos: "bg-transparent",
  bgMaterial: "bg-transparent",
  outlineIos: "border-white/8",
  outlineMaterial: "border-white/8",
};

const listColors = {
  strongBgIos: "bg-transparent",
  strongBgMaterial: "bg-transparent",
  outlineIos: "border-white/8",
  outlineMaterial: "border-white/8",
};

function ProgressRing({ completed, total, size = 96 }: { completed: number; total: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);
  const isComplete = total > 0 && completed === total;
  const gradientId = "progress-ring-gradient";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="currentColor" className="text-white/5"
          strokeWidth={strokeWidth}
        />
        {pct > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={isComplete ? "#34d399" : `url(#${gradientId})`}
            strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        {pct === 0 ? (
          <>
            <span className="text-lg font-bold text-zinc-400">
              0/{total}
            </span>
            <span className="text-[9px] text-zinc-500">
              lecciones
            </span>
          </>
        ) : (
          <>
            <span className={`text-xl font-bold ${isComplete ? "text-emerald-400" : "text-white"}`}>
              {Math.round(pct * 100)}%
            </span>
            <span className="text-[9px] text-zinc-500">
              {completed}/{total}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressPie({ completed, total, size = 36 }: { completed: number; total: number; size?: number }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);
  const isComplete = total > 0 && completed === total;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-zinc-800" strokeWidth={3} />
        {pct > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
            className={isComplete ? "text-emerald-400" : "text-emerald-500/70"}
            strokeWidth={3} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        )}
      </svg>
      <span className={`absolute text-[9px] font-bold ${isComplete ? "text-emerald-400" : "text-zinc-400"}`}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

function getMuxStreamUrl(muxId: string): string {
  return `https://stream.mux.com/${muxId}.m3u8`;
}

function getLessonThumbnail(lesson: LmsLesson): string | null {
  if (lesson.thumbnail_url) return lesson.thumbnail_url;
  if (lesson.mux_id) return `https://image.mux.com/${lesson.mux_id}/thumbnail.jpg?width=240`;
  return null;
}

function getLessonVideoUrl(lesson: LmsLesson): string | null {
  if (lesson.mux_id) return getMuxStreamUrl(lesson.mux_id);
  const content = lesson.content ?? {};
  const candidates = [content.url, content.video_url, content.videoUrl, content.stream_url, content.streamUrl];
  const direct = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return (direct as string | undefined) ?? null;
}

function getLessonTextContent(lesson: LmsLesson): string {
  const content = lesson.content ?? {};
  const candidates = [content.text, content.body, content.markdown, content.description, content.content];
  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return (value as string | undefined) ?? "";
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LearnTab() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = useMemo(() => parseLearnRoute(location.pathname), [location.pathname]);

  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [catalogModulesByCourse, setCatalogModulesByCourse] = useState<Map<string, LmsModuleWithLessons[]>>(new Map());
  const [catalogProgressByCourse, setCatalogProgressByCourse] = useState<Map<string, Map<string, LessonProgress>>>(new Map());
  const [modules, setModules] = useState<LmsModuleWithLessons[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<LmsCourse | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const storeLocale = useUserPrefsStore((state) => state.locale);
  const setStoreLocale = useUserPrefsStore((state) => state.setLocale);

  // Chat rooms state
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [chatRoomsLoading, setChatRoomsLoading] = useState(false);
  const [chatRoomsError, setChatRoomsError] = useState<string | null>(null);

  // Progress state
  const [progressMap, setProgressMap] = useState<Map<string, LessonProgress>>(new Map());
  const [courseSummaries, setCourseSummaries] = useState<Map<string, CourseProgressSummary>>(new Map());
  const videoRef = useRef<HTMLVideoElement>(null);
  const markedCompleteRef = useRef(false);

  // Track which courseId we've loaded modules for
  const loadedCourseIdRef = useRef<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived state from route
  // ---------------------------------------------------------------------------

  const { view, courseId, moduleId, lessonId } = routeState;

  // Flat ordered list of all lessons across modules
  const allLessons = useMemo(() => modules.flatMap((mod) => mod.lessons), [modules]);

  // Find selected lesson from route
  const selectedLesson = useMemo(
    () => (lessonId ? allLessons.find((l) => l.id === lessonId) ?? null : null),
    [allLessons, lessonId]
  );

  const selectedModule = useMemo(
    () => (moduleId ? modules.find((mod) => mod.id === moduleId) ?? null : null),
    [modules, moduleId]
  );

  const currentLessonIndex = useMemo(
    () => (selectedLesson ? allLessons.findIndex((l) => l.id === selectedLesson.id) : -1),
    [allLessons, selectedLesson]
  );

  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;

  // ---------------------------------------------------------------------------
  // Reset when locale changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (view !== "catalog") {
      navigate("/learn", { replace: true });
      setSelectedCourse(null);
      setCatalogModulesByCourse(new Map());
      setCatalogProgressByCourse(new Map());
      setModules([]);
      setExpandedModules(new Set());
      setProgressMap(new Map());
      loadedCourseIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeLocale]);

  // ---------------------------------------------------------------------------
  // Fetch courses (catalog)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        if (user?.uid) {
          const profile = await userService.getUserProfile(user.uid);
          if (!active) return;
          const loc = (profile.userData.locale as string) ?? "es";
          const resolved = localeToLanguage[loc] ?? "es";
          if (resolved !== storeLocale) {
            setStoreLocale(resolved);
            return;
          }
        }

        const [data, summaries] = await Promise.all([
          lmsService.getPublishedCourses(),
          user?.uid
            ? lmsProgressService.getCourseSummaries(user.uid)
            : Promise.resolve(new Map<string, CourseProgressSummary>()),
        ]);
        if (!active) return;
        const filteredCourses = data.filter((c) => c.language === storeLocale);
        const catalogContent = await Promise.all(
          filteredCourses.map(async (course) => {
            const [content, progress] = await Promise.all([
              lmsService.getCourseContent(course.id),
              user?.uid
                ? lmsProgressService.getCourseProgress(user.uid, course.id)
                : Promise.resolve(new Map<string, LessonProgress>()),
            ]);
            return { courseId: course.id, content, progress };
          })
        );
        if (!active) return;
        setCourses(filteredCourses);
        setCourseSummaries(summaries);
        setCatalogModulesByCourse(new Map(catalogContent.map((item) => [item.courseId, item.content])));
        setCatalogProgressByCourse(new Map(catalogContent.map((item) => [item.courseId, item.progress])));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar los cursos");
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => { active = false; };
  }, [user?.uid, storeLocale, setStoreLocale]);

  // ---------------------------------------------------------------------------
  // Fetch course content when courseId changes in route
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!courseId || courseId === loadedCourseIdRef.current) return;

    let active = true;

    const run = async () => {
      // Find course from already-loaded list, or fetch it
      let course = courses.find((c) => c.id === courseId) ?? null;
      if (!course) {
        // Course might not be in the list yet (direct link)
        // We still load the content; selectedCourse might stay null until courses load
        course = courses.find((c) => c.id === courseId) ?? null;
      }
      setSelectedCourse(course);
      setLoading(true);
      setError(null);

      try {
        const [content, progress] = await Promise.all([
          lmsService.getCourseContent(courseId),
          user?.uid
            ? lmsProgressService.getCourseProgress(user.uid, courseId)
            : Promise.resolve(new Map<string, LessonProgress>()),
        ]);
        if (!active) return;
        setModules(content);
        setProgressMap(progress);
        setExpandedModules(new Set(content.map((m) => m.id)));
        loadedCourseIdRef.current = courseId;
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el curso");
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => { active = false; };
  }, [courseId, courses, user?.uid]);

  // Update selectedCourse when courses list loads (for direct link)
  useEffect(() => {
    if (courseId && !selectedCourse && courses.length > 0) {
      const found = courses.find((c) => c.id === courseId) ?? null;
      if (found) setSelectedCourse(found);
    }
  }, [courseId, selectedCourse, courses]);

  // Save/restore scroll position for course view; scroll to top for lessons
  const courseScrollRef = useRef(0);
  const prevViewRef = useRef(view);

  const getScrollContainer = useCallback(() => {
    return document.querySelector(".k-page") as HTMLElement | null;
  }, []);

  useEffect(() => {
    const container = getScrollContainer();

    // If leaving course view, save scroll position
    if (prevViewRef.current === "course" && view !== "course") {
      courseScrollRef.current = container?.scrollTop ?? window.scrollY;
    }

    if (view === "lesson") {
      // Always scroll to top when entering a lesson
      const scrollToTop = () => {
        const el = getScrollContainer();
        if (el) el.scrollTop = 0;
        window.scrollTo({ top: 0 });
      };
      scrollToTop();
      // Retry after animation frame and after transition
      requestAnimationFrame(scrollToTop);
      const t1 = setTimeout(scrollToTop, 100);
      const t2 = setTimeout(scrollToTop, 250);
      prevViewRef.current = view;
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }

    if (view === "course" && prevViewRef.current === "lesson") {
      // Restore scroll position when coming back from a lesson
      const restore = () => {
        const el = getScrollContainer();
        if (el) el.scrollTop = courseScrollRef.current;
        else window.scrollTo({ top: courseScrollRef.current });
      };
      restore();
      requestAnimationFrame(restore);
      const timer = setTimeout(restore, 100);
      prevViewRef.current = view;
      return () => clearTimeout(timer);
    }

    prevViewRef.current = view;
  }, [view, lessonId, getScrollContainer]);

  // Auto-mark text lessons as completed
  useEffect(() => {
    if (view === "lesson" && selectedLesson) {
      markedCompleteRef.current = false;
      if (selectedLesson.content_type === "text") {
        void markLessonComplete(selectedLesson);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, lessonId]);

  // Clear course state when going back to catalog
  useEffect(() => {
    if (view === "catalog") {
      setSelectedCourse(null);
      setModules([]);
      setExpandedModules(new Set());
      setProgressMap(new Map());
      loadedCourseIdRef.current = null;
    }
  }, [view]);

  // ---------------------------------------------------------------------------
  // Fetch chat rooms
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (view !== "chat") return;
    let active = true;

    const run = async () => {
      setChatRoomsLoading(true);
      setChatRoomsError(null);
      try {
        const rooms = await chatService.getRooms();
        if (!active) return;
        setChatRooms(rooms);
      } catch (err) {
        if (!active) return;
        setChatRoomsError(err instanceof Error ? err.message : "Could not load chat rooms");
      } finally {
        if (active) setChatRoomsLoading(false);
      }
    };

    void run();
    return () => { active = false; };
  }, [view]);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const lessonCount = useMemo(
    () => modules.reduce((sum, module) => sum + module.lessons.length, 0),
    [modules]
  );

  const completedCount = useMemo(() => {
    let count = 0;
    for (const [, p] of progressMap) {
      if (p.completed) count++;
    }
    return count;
  }, [progressMap]);

  const moduleCount = modules.length;

  const navbarTitle =
    view === "catalog"
      ? "Learn"
      : view === "chat"
        ? "Chat"
        : view === "module"
          ? selectedModule?.title ?? "Module"
          : view === "course"
          ? selectedCourse?.title ?? "Course"
          : "Lesson";

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handleBack = () => {
    if (view === "chat") {
      navigate("/learn");
    } else if (view === "lesson" && courseId) {
      const parentModule = modules.find((mod) => mod.lessons.some((lesson) => lesson.id === lessonId));
      if (parentModule) {
        navigate(`/learn/${courseId}/module/${parentModule.id}`);
      } else {
        navigate(`/learn/${courseId}`);
      }
    } else if (view === "module") {
      navigate("/learn");
    } else if (view === "course") {
      navigate("/learn");
    }
  };

  const openCourse = (course: LmsCourse) => {
    navigate(`/learn/${course.id}`);
  };

  const openModule = (course: LmsCourse, module: LmsModuleWithLessons) => {
    navigate(`/learn/${course.id}/module/${module.id}`);
  };

  const openLesson = (lesson: LmsLesson) => {
    if (!courseId) return;
    navigate(`/learn/${courseId}/${lesson.id}`);
  };

  const navigateToLesson = (lesson: LmsLesson) => {
    if (!courseId) return;
    navigate(`/learn/${courseId}/${lesson.id}`);
  };

  // ---------------------------------------------------------------------------
  // Progress
  // ---------------------------------------------------------------------------

  const markLessonComplete = useCallback(
    async (lesson: LmsLesson, progressSeconds?: number) => {
      if (!user?.uid || !courseId) return;
      if (progressMap.get(lesson.id)?.completed) return;

      try {
        await lmsProgressService.markCompleted(user.uid, lesson.id, courseId, progressSeconds);
        setProgressMap((prev) => {
          const next = new Map(prev);
          const completedProgress = {
            id: prev.get(lesson.id)?.id ?? "",
            user_id: user.uid,
            lesson_id: lesson.id,
            course_id: courseId,
            completed: true,
            progress_seconds: progressSeconds ?? prev.get(lesson.id)?.progress_seconds ?? 0,
            completed_at: new Date().toISOString(),
          };
          next.set(lesson.id, completedProgress);
          return next;
        });
        setCatalogProgressByCourse((prev) => {
          const next = new Map(prev);
          const courseProgress = new Map(next.get(courseId) ?? new Map<string, LessonProgress>());
          courseProgress.set(lesson.id, {
            id: courseProgress.get(lesson.id)?.id ?? "",
            user_id: user.uid,
            lesson_id: lesson.id,
            course_id: courseId,
            completed: true,
            progress_seconds: progressSeconds ?? courseProgress.get(lesson.id)?.progress_seconds ?? 0,
            completed_at: new Date().toISOString(),
          });
          next.set(courseId, courseProgress);
          return next;
        });
        setCourseSummaries((prev) => {
          const next = new Map(prev);
          const existing = next.get(courseId);
          if (existing) {
            next.set(courseId, { ...existing, completed: existing.completed + 1 });
          }
          return next;
        });
      } catch {
        // silent fail
      }
    },
    [user?.uid, courseId, progressMap]
  );

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !selectedLesson || markedCompleteRef.current) return;
    const { currentTime, duration } = video;
    if (!duration || !isFinite(duration)) return;
    if (duration - currentTime <= NEAR_END_THRESHOLD) {
      markedCompleteRef.current = true;
      void markLessonComplete(selectedLesson, Math.floor(currentTime));
    }
  }, [selectedLesson, markLessonComplete]);

  const handleVideoEnded = useCallback(() => {
    if (!selectedLesson || markedCompleteRef.current) return;
    markedCompleteRef.current = true;
    const duration = videoRef.current?.duration;
    void markLessonComplete(selectedLesson, duration ? Math.floor(duration) : undefined);
  }, [selectedLesson, markLessonComplete]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const getModuleProgress = (mod: LmsModuleWithLessons, source: Map<string, LessonProgress> = progressMap) => {
    let done = 0;
    for (const lesson of mod.lessons) {
      if (source.get(lesson.id)?.completed) done++;
    }
    return done;
  };

  const getModuleThumbnail = (course: LmsCourse, mod: LmsModuleWithLessons, index?: number) => {
    const lessonThumbnails = mod.lessons.map(getLessonThumbnail).filter(Boolean) as string[];
    const lessonThumb = index === 3 || index === 4
      ? lessonThumbnails[1] ?? lessonThumbnails[lessonThumbnails.length - 1] ?? null
      : lessonThumbnails[0] ?? null;
    return lessonThumb ?? course.thumbnail_url;
  };

  const getModuleDuration = (mod: LmsModuleWithLessons) => (
    mod.lessons.reduce((sum, lesson) => sum + (lesson.duration_minutes ?? 0), 0)
  );

  const getModuleTeaser = (mod: LmsModuleWithLessons) => {
    const title = mod.title.toLowerCase();
    if (title.includes("introdu")) return "Bienvenido: empieza con las bases.";
    if (title.includes("nivel 1")) return "Da tu primer paso con claridad.";
    if (title.includes("nivel 2")) return "Avanza con nuevas herramientas.";
    if (title.includes("nivel 3")) return "Profundiza y fortalece tu lectura del mercado.";
    if (title.includes("nivel 4")) return "Refina tu criterio y toma mejores decisiones.";
    if (title.includes("nivel 5")) return "Lleva tu practica mas lejos.";
    return "Entra y continua tu aprendizaje.";
  };

  const getModuleImageClass = (mod: LmsModuleWithLessons, index: number) => {
    const title = mod.title.toLowerCase();
    const base = "absolute inset-0 w-full h-full object-cover";
    if (title.includes("nivel 3") || index === 3) return `${base} object-center`;
    if (title.includes("nivel 4") || index === 4) return `${base} object-center`;
    return `${base} object-cover object-top`;
  };

  const catalogModuleCards = useMemo(
    () => courses.flatMap((course) => (
      (catalogModulesByCourse.get(course.id) ?? []).map((module) => ({ course, module }))
    )),
    [courses, catalogModulesByCourse]
  );

  // ---------------------------------------------------------------------------
  // Render: Catalog
  // ---------------------------------------------------------------------------

  const renderCatalogSkeleton = () => (
    <div className="pb-24 px-4">
      <div className="rounded-lg overflow-hidden bg-zinc-900/90 border border-white/8 shadow-lg shadow-black/20">
        <div className="h-40 bg-white/[0.04] animate-pulse" />
        <div className="p-4">
          <div className="h-5 w-3/5 bg-white/[0.06] rounded-full animate-pulse" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full bg-white/[0.03] rounded-full animate-pulse" />
            <div className="h-3 w-4/5 bg-white/[0.03] rounded-full animate-pulse" />
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 landscape:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg overflow-hidden bg-zinc-900/80 border border-white/8">
            <div className="h-24 bg-white/[0.03] animate-pulse" />
            <div className="p-3">
              <div className="h-3.5 w-2/3 bg-white/[0.06] rounded-full animate-pulse" />
              <div className="mt-3 h-1.5 w-full bg-white/[0.04] rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCatalogHero = () => {
    return (
      <div className="px-4 pt-2">
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-lg shadow-black/25">
          <img
            src="/img/learn-hero.webp"
            alt=""
            className="w-full aspect-[2.15/1] object-cover"
          />
        </div>
      </div>
    );
  };

  const renderCatalog = () => (
    <div className="pb-24">
      {loading && renderCatalogSkeleton()}
      {error && <Block><p className="text-red-400 text-sm">{error}</p></Block>}
      {!loading && !error && courses.length === 0 && (
        <Block><p className="text-zinc-400 text-sm">No hay cursos publicados todavia.</p></Block>
      )}
      {!loading && !error && courses.length > 0 && (
        <>
          {renderCatalogHero()}

          <div className="px-3 mt-6">
            <div className="flex items-end justify-between gap-4 mb-3">
              <div>
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-normal">
                  Cursos de trading
                </p>
                <h3 className="text-white text-lg font-semibold mt-1">
                  Modulos disponibles
                </h3>
              </div>
              <span className="text-zinc-500 text-xs shrink-0">
                {catalogModuleCards.length} modulos
              </span>
            </div>

            {catalogModuleCards.length === 0 ? (
              <p className="text-zinc-400 text-sm">Este curso aun no tiene modulos publicados.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 landscape:grid-cols-3 landscape:max-w-5xl landscape:mx-auto">
                {catalogModuleCards.map(({ course, module }, index) => {
                  const progress = catalogProgressByCourse.get(course.id) ?? new Map<string, LessonProgress>();
                  const completed = getModuleProgress(module, progress);
                  const total = module.lessons.length;
                  const thumb = getModuleThumbnail(course, module, index);

                  return (
                    <button
                      key={module.id}
                      onClick={() => openModule(course, module)}
                      className="text-left overflow-hidden rounded-lg bg-transparent border border-white/10 shadow-lg shadow-black/10 active:scale-[0.98] active:border-white/15 transition-all"
                    >
                      <div className="relative h-[88px] overflow-hidden bg-zinc-900">
                        {thumb ? (
                          <img src={thumb} alt={module.title} className={getModuleImageClass(module, index)} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs bg-zinc-900">
                            Sin imagen
                          </div>
                        )}
                        <div className="absolute right-2 bottom-2 bg-black/70 rounded-full p-0.5">
                          <ProgressPie completed={completed} total={total} size={30} />
                        </div>
                      </div>

                      <div className="px-2.5 pt-1.5 pb-2">
                        <h4 className="text-white font-semibold text-sm leading-tight line-clamp-2">
                          {module.title}
                        </h4>
                        <p className="text-zinc-400 text-[11px] mt-1 line-clamp-2 leading-snug">
                          {getModuleTeaser(module)}
                        </p>
                        <p className={completed === total && total > 0 ? "text-emerald-400 text-[11px] mt-1" : "text-zinc-500 text-[11px] mt-1"}>
                          {completed} de {total}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Course
  // ---------------------------------------------------------------------------

  const renderCourseSkeleton = () => (
    <div className="pb-24">
      {/* Progress ring + info card */}
      <Card outline colors={cardColors}>
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <div className="w-24 h-24 rounded-full border-[5px] border-white/5 animate-pulse" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 bg-white/8 rounded-full animate-pulse" />
            <div className="h-3 w-1/2 bg-white/5 rounded-full animate-pulse" />
          </div>
        </div>
      </Card>

      {/* Module sections */}
      {[0, 1].map((i) => (
        <div key={i}>
          <BlockTitle>
            <div className="flex items-center justify-between w-full">
              <div className="h-4 w-28 bg-white/8 rounded-full animate-pulse" />
              <div className="h-3 w-12 bg-white/5 rounded-full animate-pulse" />
            </div>
          </BlockTitle>
          <List strong inset outline colors={listColors}>
            {[0, 1, 2].map((j) => (
              <ListItem
                key={j}
                link
                chevron={false}
                media={<div className="w-14 h-9 rounded-md bg-white/5 animate-pulse" />}
                title={<div className="h-3.5 w-3/4 bg-white/8 rounded-full animate-pulse" />}
                subtitle={<div className="h-2.5 w-1/3 bg-white/5 rounded-full animate-pulse mt-1" />}
                after={j === 0 ? <div className="h-3 w-8 bg-white/5 rounded-full animate-pulse" /> : undefined}
              />
            ))}
          </List>
        </div>
      ))}
    </div>
  );

  const renderCourse = () => (
    <div className="pb-24">
      {selectedCourse && !loading && (
        <Card outline colors={cardColors}>
          <div className="flex items-center gap-4">
            {lessonCount > 0 && (
              <div className="shrink-0">
                <ProgressRing completed={completedCount} total={lessonCount} size={96} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-base">
                {lessonCount > 0
                  ? completedCount === 0
                    ? "Comienza tu camino"
                    : completedCount === lessonCount
                      ? "¡Completado!"
                      : completedCount / lessonCount <= 0.25
                        ? "Buen inicio"
                        : completedCount / lessonCount <= 0.5
                          ? "Vas por buen camino"
                          : completedCount / lessonCount <= 0.75
                            ? "Ya falta poco"
                            : "Casi lo logras"
                  : selectedCourse.title}
              </p>
              <p className="text-zinc-500 text-xs mt-1">
                {moduleCount} modules &middot; {lessonCount} lessons
              </p>
            </div>
          </div>
        </Card>
      )}

      {loading && renderCourseSkeleton()}
      {error && <Block><p className="text-red-400 text-sm">{error}</p></Block>}

      {!loading && !error && modules.length === 0 && (
        <Block><p className="text-zinc-400 text-sm">This course has no published lessons.</p></Block>
      )}

      {!loading && modules.map((module) => {
        const isOpen = expandedModules.has(module.id);
        const modDone = getModuleProgress(module);
        const modTotal = module.lessons.length;
        return (
          <div key={module.id}>
            <BlockTitle
              className="cursor-pointer flex items-center justify-between"
              onClick={() => toggleModule(module.id)}
            >
              <span>{module.title}</span>
              <span className="text-zinc-500 text-xs font-normal ml-2">
                {modTotal > 0 && (
                  <span className={modDone === modTotal ? "text-emerald-400" : ""}>
                    {modDone}/{modTotal}
                  </span>
                )}
                {" "}{isOpen ? "▴" : "▾"}
              </span>
            </BlockTitle>

            {isOpen && (
              <List strong inset outline colors={listColors}>
                {module.lessons.length === 0 ? (
                  <ListItem title={<span className="text-zinc-500 text-xs">No lessons in this module.</span>} />
                ) : (
                  module.lessons.map((lesson) => {
                    const thumb = getLessonThumbnail(lesson);
                    const isCompleted = progressMap.get(lesson.id)?.completed === true;
                    return (
                      <ListItem
                        key={lesson.id}
                        link
                        chevron={false}
                        onClick={() => openLesson(lesson)}
                        title={
                          <span className={isCompleted ? "text-zinc-400" : "text-zinc-100"}>
                            {lesson.title}
                          </span>
                        }
                        subtitle={
                          <span className="text-zinc-500">
                            {lesson.content_type.toUpperCase()}
                            {lesson.duration_minutes ? ` · ${lesson.duration_minutes} min` : ""}
                            {lesson.is_free ? " · Free" : ""}
                          </span>
                        }
                        media={
                          <div className="w-14 h-9 shrink-0 rounded-md overflow-hidden bg-zinc-800 relative">
                            {thumb ? (
                              <img src={thumb} alt={lesson.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[10px]">
                                {lesson.content_type === "video" ? "▶" : "📄"}
                              </div>
                            )}
                            {isCompleted && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        }
                        after={
                          isCompleted ? (
                            <span className="text-emerald-400 text-xs font-medium">Done</span>
                          ) : undefined
                        }
                      />
                    );
                  })
                )}
              </List>
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Module
  // ---------------------------------------------------------------------------

  const renderModule = () => {
    if (!selectedModule) {
      if (loading) return renderCourseSkeleton();
      return (
        <Block className="pt-8 text-center">
          <p className="text-zinc-400 text-sm">Modulo no encontrado.</p>
        </Block>
      );
    }

    const completed = getModuleProgress(selectedModule);
    const total = selectedModule.lessons.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const duration = getModuleDuration(selectedModule);
    const thumbnail = selectedCourse ? getModuleThumbnail(selectedCourse, selectedModule) : null;

    return (
      <div className="pb-24">
        <div className="px-4 pt-2">
          <div className="relative overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-lg shadow-black/25">
            {thumbnail ? (
              <img src={thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />
            ) : (
              <div className="absolute inset-0 bg-zinc-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/75 to-zinc-950/20" />
            <div className="relative min-h-44 p-5 flex flex-col justify-end">
              <p className="text-emerald-300 text-xs font-semibold uppercase tracking-normal">
                {selectedCourse?.title ?? "Trading"}
              </p>
              <h2 className="text-white text-2xl font-bold mt-2 leading-tight">
                {selectedModule.title}
              </h2>
              {(selectedModule.description || selectedCourse?.description) && (
                <p className="text-zinc-300 text-sm mt-2 leading-snug line-clamp-3">
                  {selectedModule.description || selectedCourse?.description}
                </p>
              )}

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">
                    {completed}/{total} lecciones{duration > 0 ? ` · ${duration} min` : ""}
                  </span>
                  <span className="text-emerald-300 font-semibold">{pct}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-lg font-semibold">Lecciones</h3>
            <span className="text-zinc-500 text-xs">{total} total</span>
          </div>

          {selectedModule.lessons.length === 0 ? (
            <p className="text-zinc-400 text-sm">Este modulo aun no tiene lecciones publicadas.</p>
          ) : (
            <div className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-3 landscape:space-y-0 landscape:max-w-5xl landscape:mx-auto">
              {selectedModule.lessons.map((lesson, index) => {
                const thumb = getLessonThumbnail(lesson);
                const isCompleted = progressMap.get(lesson.id)?.completed === true;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => openLesson(lesson)}
                    className="w-full text-left rounded-lg bg-zinc-900/90 border border-white/8 p-3 flex items-center gap-3 shadow-lg shadow-black/15 active:scale-[0.98] active:bg-zinc-800/90 transition-all"
                  >
                    <div className="w-20 h-14 shrink-0 rounded-lg overflow-hidden bg-zinc-800 relative">
                      {thumb ? (
                        <img src={thumb} alt={lesson.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[11px]">
                          {lesson.content_type === "video" ? "Video" : "Texto"}
                        </div>
                      )}
                      {isCompleted && (
                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-500 text-[11px]">
                        Leccion {index + 1}
                      </p>
                      <h4 className={isCompleted ? "text-zinc-400 font-semibold text-sm line-clamp-2" : "text-white font-semibold text-sm line-clamp-2"}>
                        {lesson.title}
                      </h4>
                      <p className="text-zinc-500 text-[11px] mt-1">
                        {lesson.content_type.toUpperCase()}
                        {lesson.duration_minutes ? ` · ${lesson.duration_minutes} min` : ""}
                        {lesson.is_free ? " · Free" : ""}
                      </p>
                    </div>

                    <svg className="w-4 h-4 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Lesson
  // ---------------------------------------------------------------------------

  const renderLesson = () => {
    if (!selectedLesson) {
      // Lesson not found (modules still loading or bad ID)
      if (loading) return null;
      return (
        <Block className="pt-8 text-center">
          <p className="text-zinc-400 text-sm">Lesson not found.</p>
        </Block>
      );
    }

    const videoUrl = getLessonVideoUrl(selectedLesson);
    const textContent = getLessonTextContent(selectedLesson);
    const poster = getLessonThumbnail(selectedLesson);
    const isCompleted = progressMap.get(selectedLesson.id)?.completed === true;
    const lessonPosition = currentLessonIndex >= 0 ? `${currentLessonIndex + 1}/${allLessons.length}` : "";

    return (
      <div className="pb-24 landscape:pb-4 landscape:max-w-2xl landscape:mx-auto landscape:min-h-[calc(100dvh-56px)] landscape:flex landscape:flex-col">
        {videoUrl && (
          <Card outline colors={cardColors} contentWrapPadding="p-0" className="overflow-hidden">
            <video
              key={selectedLesson.id}
              ref={videoRef}
              src={videoUrl}
              controls
              poster={poster ?? undefined}
              className="w-full aspect-video object-contain bg-black"
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
            />
          </Card>
        )}

        <Card outline colors={cardColors}
          header={
            <div>
              <h3 className="text-white font-semibold text-xl">{selectedLesson.title}</h3>
              <span className="text-zinc-500 text-xs">
                {lessonPosition && <span className="text-zinc-400 mr-1.5">{lessonPosition}</span>}
                {selectedLesson.content_type.toUpperCase()}
                {selectedLesson.duration_minutes ? ` · ${selectedLesson.duration_minutes} min` : ""}
              </span>
            </div>
          }
          headerDivider
        >
          {textContent ? (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-zinc-100 prose-headings:text-base prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h4:text-sm prose-p:text-zinc-300 prose-p:text-sm prose-strong:text-zinc-100 prose-li:text-zinc-300 prose-li:text-sm prose-ul:my-1 prose-ol:my-1">
              <ReactMarkdown>{textContent}</ReactMarkdown>
            </div>
          ) : (
            !videoUrl && <p className="text-zinc-500 text-sm">No text content for this lesson.</p>
          )}
        </Card>

        {/* Prev / Next navigation */}
        {(prevLesson || nextLesson) && (
          <div className="flex gap-3 px-4 mt-4 landscape:mt-auto landscape:pb-2">
            {prevLesson ? (
              <Button
                tonal
                rounded
                className="flex-1 min-w-0"
                onClick={() => navigateToLesson(prevLesson)}
                colors={{
                  tonalBgIos: "bg-white/8 active:bg-white/15",
                  tonalBgMaterial: "bg-white/8 active:bg-white/15",
                  tonalTextIos: "text-zinc-300",
                  tonalTextMaterial: "text-zinc-300",
                }}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Anterior
                </span>
              </Button>
            ) : (
              <div className="flex-1" />
            )}
            {nextLesson ? (
              <Button
                tonal
                rounded
                className="flex-1 min-w-0"
                onClick={() => navigateToLesson(nextLesson)}
                colors={{
                  tonalBgIos: "bg-white/8 active:bg-white/15",
                  tonalBgMaterial: "bg-white/8 active:bg-white/15",
                  tonalTextIos: "text-zinc-300",
                  tonalTextMaterial: "text-zinc-300",
                }}
              >
                <span className="flex items-center gap-1.5">
                  Siguiente
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Button>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render: Chat
  // ---------------------------------------------------------------------------

  const renderChatRoomsSkeleton = () => (
    <div className="space-y-3 px-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 p-4 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-zinc-800 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-zinc-800 rounded-full animate-pulse" />
            <div className="h-3 w-44 bg-zinc-800/50 rounded-full animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderChat = () => (
    <Block className="pt-2 pb-24 !px-0">
      {chatRoomsLoading && renderChatRoomsSkeleton()}
      {chatRoomsError && (
        <p className="text-red-400 text-sm px-4 mb-3">{chatRoomsError}</p>
      )}
      {!chatRoomsLoading && !chatRoomsError && chatRooms.length === 0 && (
        <p className="text-zinc-400 text-sm px-4">No hay salas de chat disponibles.</p>
      )}
      {!chatRoomsLoading && chatRooms.length > 0 && (
        <div className="space-y-3 px-4">
          {chatRooms.map((room) => (
            <button
              key={room.id}
              onClick={() => navigate(`/learn/chat/${room.id}`)}
              className="w-full text-left rounded-2xl bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50 p-4 flex items-center gap-4 active:scale-[0.98] active:bg-zinc-800/80 transition-all duration-150"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 shrink-0 flex items-center justify-center overflow-hidden shadow-lg shadow-black/20">
                {(room.icon_thumb_url || room.icon_url) ? (
                  <img
                    src={room.icon_thumb_url ?? room.icon_url!}
                    alt={room.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GroupAvatarIcon />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-white font-semibold text-[15px] leading-tight">{room.name}</h3>
                {room.description && (
                  <p className="text-zinc-400 text-[13px] mt-1 line-clamp-2 leading-snug">{room.description}</p>
                )}
              </div>
              <svg className="w-5 h-5 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </Block>
  );

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  const lessonCompleted = selectedLesson ? progressMap.get(selectedLesson.id)?.completed === true : false;

  return (
    <>
      <AppNavbar
        left={
          <button
            className="w-10 h-10 flex items-center justify-center text-zinc-200"
            onClick={view === "catalog" ? () => navigate("/learn/chat") : handleBack}
          >
            {view === "catalog" ? <MessageIcon /> : <span className="text-xl">‹</span>}
          </button>
        }
        title={navbarTitle}
        right={
          view === "lesson" ? (
            <button
              className="w-10 h-10 flex items-center justify-center"
              onClick={
                !lessonCompleted && selectedLesson
                  ? () => void markLessonComplete(selectedLesson)
                  : undefined
              }
            >
              <svg
                className={`w-6 h-6 transition-colors duration-300 ${lessonCompleted ? "text-emerald-400" : "text-zinc-600"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          ) : undefined
        }
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={view + (courseId ?? "") + (moduleId ?? "") + (lessonId ?? "")}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {view === "catalog" && renderCatalog()}
          {view === "chat" && renderChat()}
          {view === "course" && renderCourse()}
          {view === "module" && renderModule()}
          {view === "lesson" && renderLesson()}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
