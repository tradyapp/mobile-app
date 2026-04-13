"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Block, BlockTitle } from "konsta/react";
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
  view: "catalog" | "course" | "lesson" | "chat";
  courseId: string | null;
  lessonId: string | null;
}

function parseLearnRoute(pathname: string): LearnRouteState {
  const normalized = pathname.replace(/\/+$/, "");

  // /learn/chat
  if (normalized === "/learn/chat") {
    return { view: "chat", courseId: null, lessonId: null };
  }

  // /learn/:courseId/:lessonId
  const lessonMatch = normalized.match(/^\/learn\/([^/]+)\/([^/]+)$/);
  if (lessonMatch) {
    return {
      view: "lesson",
      courseId: decodeURIComponent(lessonMatch[1]),
      lessonId: decodeURIComponent(lessonMatch[2]),
    };
  }

  // /learn/:courseId
  const courseMatch = normalized.match(/^\/learn\/([^/]+)$/);
  if (courseMatch) {
    return {
      view: "course",
      courseId: decodeURIComponent(courseMatch[1]),
      lessonId: null,
    };
  }

  // /learn
  return { view: "catalog", courseId: null, lessonId: null };
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

function NavLessonTitle({ title, align = "left" }: { title: string; align?: "left" | "right" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const check = () => {
      const container = containerRef.current;
      const span = textRef.current;
      if (!container || !span) return;
      const isOverflowing = span.scrollWidth > container.clientWidth;
      setOverflows(isOverflowing);
      if (isOverflowing) {
        container.style.setProperty("--marquee-container-width", `${container.clientWidth}px`);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [title]);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {overflows && (
        <>
          <div className={`absolute top-0 bottom-0 w-4 z-10 pointer-events-none ${align === "right" ? "right-0 bg-gradient-to-l" : "left-0 bg-gradient-to-r"} from-zinc-950 to-transparent`} />
          {align === "left" && <div className="absolute right-0 top-0 bottom-0 w-4 z-10 pointer-events-none bg-gradient-to-l from-zinc-950 to-transparent" />}
          {align === "right" && <div className="absolute left-0 top-0 bottom-0 w-4 z-10 pointer-events-none bg-gradient-to-r from-zinc-950 to-transparent" />}
        </>
      )}
      <span
        ref={textRef}
        className={`inline-block whitespace-nowrap text-xs text-zinc-300 ${overflows ? "animate-marquee" : ""} ${align === "right" && !overflows ? "w-full text-right" : ""}`}
      >
        {title}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function LearnTab() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = useMemo(() => parseLearnRoute(location.pathname), [location.pathname]);

  const [courses, setCourses] = useState<LmsCourse[]>([]);
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

  const { view, courseId, lessonId } = routeState;

  // Flat ordered list of all lessons across modules
  const allLessons = useMemo(() => modules.flatMap((mod) => mod.lessons), [modules]);

  // Find selected lesson from route
  const selectedLesson = useMemo(
    () => (lessonId ? allLessons.find((l) => l.id === lessonId) ?? null : null),
    [allLessons, lessonId]
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
        setCourses(data.filter((c) => c.language === storeLocale));
        setCourseSummaries(summaries);
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

  // Scroll to top whenever we enter a lesson (or the lesson changes)
  useEffect(() => {
    if (view === "lesson") {
      // Konsta Page uses .page-content as scroll container, not window
      const pageContent = document.querySelector(".page-content");
      if (pageContent) {
        pageContent.scrollTop = 0;
      }
      window.scrollTo({ top: 0 });
    }
  }, [view, lessonId]);

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
        : view === "course"
          ? selectedCourse?.title ?? "Course"
          : selectedLesson?.title ?? "Lesson";

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handleBack = () => {
    if (view === "chat") {
      navigate("/learn");
    } else if (view === "lesson" && courseId) {
      navigate(`/learn/${courseId}`);
    } else if (view === "course") {
      navigate("/learn");
    }
  };

  const openCourse = (course: LmsCourse) => {
    navigate(`/learn/${course.id}`);
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
          next.set(lesson.id, {
            id: prev.get(lesson.id)?.id ?? "",
            user_id: user.uid,
            lesson_id: lesson.id,
            course_id: courseId,
            completed: true,
            progress_seconds: progressSeconds ?? prev.get(lesson.id)?.progress_seconds ?? 0,
            completed_at: new Date().toISOString(),
          });
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

  const getModuleProgress = (mod: LmsModuleWithLessons) => {
    let done = 0;
    for (const lesson of mod.lessons) {
      if (progressMap.get(lesson.id)?.completed) done++;
    }
    return done;
  };

  // ---------------------------------------------------------------------------
  // Render: Catalog
  // ---------------------------------------------------------------------------

  const renderCatalogSkeleton = () => (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden flex flex-col landscape:flex-row">
          <div className="aspect-video landscape:aspect-auto landscape:w-48 landscape:min-h-[7rem] shrink-0 bg-zinc-800 animate-pulse" />
          <div className="p-3 space-y-2 flex-1">
            <div className="h-4 w-3/4 bg-zinc-800 rounded animate-pulse" />
            <div className="h-3 w-full bg-zinc-800/60 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-zinc-800/60 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderCatalog = () => (
    <>
      <BlockTitle className="mt-2">Training</BlockTitle>
      <Block strong inset className="pb-24">
        {loading && renderCatalogSkeleton()}
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {!loading && !error && courses.length === 0 && (
          <p className="text-zinc-400 text-sm">No published courses yet.</p>
        )}
        <div className="space-y-3">
          {courses.map((course) => {
            const summary = courseSummaries.get(course.id);
            return (
              <button
                key={course.id}
                onClick={() => openCourse(course)}
                className="w-full text-left bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden flex flex-col landscape:flex-row"
              >
                <div className="aspect-video landscape:aspect-auto landscape:w-48 landscape:min-h-[7rem] shrink-0 bg-zinc-800 relative">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">No thumbnail</div>
                  )}
                  {summary && summary.total > 0 && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/70 rounded-full p-0.5">
                      <ProgressPie completed={summary.completed} total={summary.total} size={32} />
                    </div>
                  )}
                </div>
                <div className="p-3 landscape:flex landscape:flex-col landscape:justify-center min-w-0">
                  <h3 className="text-white font-semibold landscape:text-sm">{course.title}</h3>
                  {course.description && (
                    <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{course.description}</p>
                  )}
                  {summary && summary.total > 0 && (
                    <p className={`text-xs mt-1 ${summary.completed === summary.total ? "text-emerald-400" : "text-zinc-500"}`}>
                      {summary.completed}/{summary.total} lessons completed
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Block>
    </>
  );

  // ---------------------------------------------------------------------------
  // Render: Course
  // ---------------------------------------------------------------------------

  const renderCourseSkeleton = () => (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-3 py-3 space-y-2">
            <div className="h-4 w-1/2 bg-zinc-800 rounded animate-pulse" />
            <div className="h-3 w-1/4 bg-zinc-800/60 rounded animate-pulse" />
          </div>
          <div className="border-t border-zinc-800">
            {[0, 1, 2].map((j) => (
              <div key={j} className="px-3 py-3 border-b border-zinc-800 last:border-b-0 flex items-center gap-3">
                <div className="w-16 h-10 shrink-0 rounded-md bg-zinc-800 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-2.5 w-1/3 bg-zinc-800/60 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCourse = () => (
    <>
      {selectedCourse && (
        <>
          <BlockTitle className="mt-2">{selectedCourse.title}</BlockTitle>
          <Block strong inset>
            <p className="text-zinc-300 text-sm">{selectedCourse.description || "No description"}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-zinc-500 text-xs">
                {moduleCount} modules • {lessonCount} lessons
              </p>
              {lessonCount > 0 && (
                <span className="text-emerald-400 text-xs font-medium">
                  {completedCount}/{lessonCount} completed
                </span>
              )}
            </div>
            {lessonCount > 0 && (
              <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((completedCount / lessonCount) * 100)}%` }}
                />
              </div>
            )}
          </Block>
        </>
      )}

      <Block strong inset className="pb-24">
        {loading && renderCourseSkeleton()}
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {!loading && modules.length === 0 && (
          <p className="text-zinc-400 text-sm">This course has no published lessons.</p>
        )}

        <div className="space-y-3">
          {modules.map((module) => {
          const isOpen = expandedModules.has(module.id);
          const modDone = getModuleProgress(module);
          const modTotal = module.lessons.length;
          return (
            <div key={module.id} className="bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden">
              <button
                className="w-full px-3 py-3 text-left flex items-center justify-between"
                onClick={() => toggleModule(module.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium">{module.title}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-zinc-500 text-xs">{modTotal} lessons</p>
                    {modTotal > 0 && (
                      <span className={`text-xs font-medium ${modDone === modTotal ? "text-emerald-400" : "text-zinc-500"}`}>
                        {modDone}/{modTotal}
                      </span>
                    )}
                  </div>
                  {modTotal > 0 && (
                    <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${modDone === modTotal ? "bg-emerald-500" : "bg-emerald-500/70"}`}
                        style={{ width: `${Math.round((modDone / modTotal) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="text-zinc-400 text-xs ml-2 shrink-0">{isOpen ? "Hide" : "Show"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800">
                  {module.lessons.length === 0 ? (
                    <p className="px-3 py-3 text-zinc-500 text-xs">No lessons in this module.</p>
                  ) : (
                    module.lessons.map((lesson) => {
                      const thumb = getLessonThumbnail(lesson);
                      const isCompleted = progressMap.get(lesson.id)?.completed === true;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => openLesson(lesson)}
                          className="w-full px-3 py-3 text-left border-b border-zinc-800 last:border-b-0 flex items-center gap-3"
                        >
                          <div className="w-16 h-10 shrink-0 rounded-md overflow-hidden bg-zinc-800 relative">
                            {thumb ? (
                              <img src={thumb} alt={lesson.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[10px]">
                                {lesson.content_type === "video" ? "▶" : "📄"}
                              </div>
                            )}
                            {isCompleted && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${isCompleted ? "text-zinc-400" : "text-zinc-100"}`}>
                              {lesson.title}
                            </p>
                            <p className="text-zinc-500 text-xs">
                              {lesson.content_type.toUpperCase()}
                              {lesson.duration_minutes ? ` • ${lesson.duration_minutes} min` : ""}
                              {lesson.is_free ? " • Free" : ""}
                            </p>
                          </div>
                          {isCompleted && (
                            <span className="text-emerald-400 text-xs font-medium shrink-0">Done</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </Block>
    </>
  );

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
      <>
        <BlockTitle className="mt-2">{selectedLesson.title}</BlockTitle>
        <Block strong inset className="pb-32 landscape:max-w-2xl landscape:mx-auto">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-zinc-500 text-xs">
              {lessonPosition && <span className="text-zinc-400 mr-1.5">{lessonPosition}</span>}
              {selectedLesson.content_type.toUpperCase()}
              {selectedLesson.duration_minutes ? ` • ${selectedLesson.duration_minutes} min` : ""}
            </p>
          </div>

          {videoUrl && (
            <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-black">
              <video
                key={selectedLesson.id}
                ref={videoRef}
                src={videoUrl}
                controls
                poster={poster ?? undefined}
                className="w-full aspect-video object-contain"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnded}
              />
            </div>
          )}

          {textContent ? (
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 prose prose-invert prose-sm max-w-none prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-strong:text-zinc-100 prose-li:text-zinc-300 prose-ul:my-1 prose-ol:my-1">
              <ReactMarkdown>{textContent}</ReactMarkdown>
            </div>
          ) : (
            !videoUrl && <p className="text-zinc-500 text-sm">No text content for this lesson.</p>
          )}

          {/* Prev / Next navigation bar + dark fill to bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="bg-zinc-950" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 56px)" }}>
            <div className="border-t border-zinc-800 flex" style={{ paddingLeft: "env(safe-area-inset-left, 0px)", paddingRight: "env(safe-area-inset-right, 0px)" }}>
              <button
                onClick={prevLesson ? () => navigateToLesson(prevLesson) : undefined}
                disabled={!prevLesson}
                className={`w-1/2 flex items-center gap-2 pl-4 pr-3 py-2.5 transition-colors ${prevLesson ? "active:bg-zinc-900" : "opacity-30"}`}
              >
                <span className="text-zinc-400 text-lg shrink-0">‹</span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Anterior</p>
                  <NavLessonTitle title={prevLesson?.title ?? "—"} />
                </div>
              </button>
              <div className="w-px bg-zinc-800 shrink-0 my-2" />
              <button
                onClick={nextLesson ? () => navigateToLesson(nextLesson) : undefined}
                disabled={!nextLesson}
                className={`w-1/2 flex items-center gap-2 pl-3 pr-4 py-2.5 transition-colors ${nextLesson ? "active:bg-zinc-900" : "opacity-30"}`}
              >
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Siguiente</p>
                  <NavLessonTitle title={nextLesson?.title ?? "—"} align="right" />
                </div>
                <span className="text-zinc-400 text-lg shrink-0">›</span>
              </button>
            </div>
          </div>
        </div>
        </Block>
      </>
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
      {view === "catalog" && renderCatalog()}
      {view === "chat" && renderChat()}
      {view === "course" && renderCourse()}
      {view === "lesson" && renderLesson()}
    </>
  );
}
