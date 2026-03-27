"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Block } from "konsta/react";
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
  view: "catalog" | "course" | "lesson" | "chat" | "chatRoom";
  courseId: string | null;
  lessonId: string | null;
  roomId: string | null;
}

function parseLearnRoute(pathname: string): LearnRouteState {
  const normalized = pathname.replace(/\/+$/, "");

  // /learn/chat/:roomId
  const chatRoomMatch = normalized.match(/^\/learn\/chat\/([^/]+)$/);
  if (chatRoomMatch) {
    return { view: "chatRoom", courseId: null, lessonId: null, roomId: decodeURIComponent(chatRoomMatch[1]) };
  }

  // /learn/chat
  if (normalized === "/learn/chat") {
    return { view: "chat", courseId: null, lessonId: null, roomId: null };
  }

  // /learn/:courseId/:lessonId
  const lessonMatch = normalized.match(/^\/learn\/([^/]+)\/([^/]+)$/);
  if (lessonMatch) {
    return {
      view: "lesson",
      courseId: decodeURIComponent(lessonMatch[1]),
      lessonId: decodeURIComponent(lessonMatch[2]),
      roomId: null,
    };
  }

  // /learn/:courseId
  const courseMatch = normalized.match(/^\/learn\/([^/]+)$/);
  if (courseMatch) {
    return {
      view: "course",
      courseId: decodeURIComponent(courseMatch[1]),
      lessonId: null,
      roomId: null,
    };
  }

  // /learn
  return { view: "catalog", courseId: null, lessonId: null, roomId: null };
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

function ProgressiveImage({ src, thumbnail, alt }: { src: string; thumbnail: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative rounded-lg overflow-hidden mb-1.5">
      {thumbnail && !loaded && (
        <img src={thumbnail} alt="" className="w-full rounded-lg blur-sm scale-105" />
      )}
      <img
        src={src}
        alt={alt}
        className={`rounded-lg max-w-full ${thumbnail && !loaded ? "absolute inset-0 w-full h-full object-cover opacity-0" : ""}`}
        onLoad={() => setLoaded(true)}
      />
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

  const { view, courseId, lessonId, roomId } = routeState;

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
    if (view !== "chat" && view !== "chatRoom") return;
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

  const currentRoom = useMemo(
    () => (roomId ? chatRooms.find((r) => r.id === roomId) ?? null : null),
    [chatRooms, roomId]
  );

  const navbarTitle =
    view === "catalog"
      ? "Learn"
      : view === "chat"
        ? "Chat"
        : view === "chatRoom"
          ? currentRoom?.name ?? "Chat"
          : view === "course"
            ? selectedCourse?.title ?? "Course"
            : selectedLesson?.title ?? "Lesson";

  // ---------------------------------------------------------------------------
  // Navigation handlers
  // ---------------------------------------------------------------------------

  const handleBack = () => {
    if (view === "chatRoom") {
      navigate("/learn/chat");
    } else if (view === "chat") {
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
    <Block className="pt-2 pb-24">
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
    <Block className="pt-2 pb-24">
      {selectedCourse && (
        <div className="mb-4">
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
        </div>
      )}

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
      <Block className="pt-2 pb-32 landscape:max-w-2xl landscape:mx-auto">
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
  // Chat Room state
  // ---------------------------------------------------------------------------

  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMessagesLoading, setChatMessagesLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const initialScrollDone = useRef(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  // Resolve display names for a set of user IDs (skips already resolved)
  const resolveUserNames = useCallback(async (msgs: ChatMessage[]) => {
    const unknownIds = [...new Set(msgs.map((m) => m.user_id))].filter((id) => !userNames[id]);
    if (unknownIds.length === 0) return;
    try {
      const profiles = await userService.listPublicProfiles(unknownIds);
      setUserNames((prev) => {
        const next = { ...prev };
        for (const p of profiles) next[p.id] = p.displayName;
        return next;
      });
    } catch {
      // silent fail
    }
  }, [userNames]);

  // Fetch last 15 messages + subscribe to realtime when entering a chat room
  useEffect(() => {
    if (view !== "chatRoom" || !roomId) return;
    let active = true;
    initialScrollDone.current = false;
    setHasMoreMessages(true);

    setChatMessagesLoading(true);
    setChatMessages([]);

    const run = async () => {
      try {
        const msgs = await chatService.getMessages(roomId, 15);
        if (!active) return;
        setChatMessages(msgs);
        if (msgs.length < 15) setHasMoreMessages(false);
        void resolveUserNames(msgs);
      } catch {
        // silent fail
      } finally {
        if (active) setChatMessagesLoading(false);
      }
    };

    void run();

    const channel = chatService.subscribeToRoom(roomId, (newMsg) => {
      if (!active) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      void resolveUserNames([newMsg]);
    });

    return () => {
      active = false;
      chatService.unsubscribe(channel);
    };
  }, [view, roomId]);

  // Load older messages when scrolling to top
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMoreMessages || !roomId || chatMessages.length === 0) return;
    const oldest = chatMessages[0];
    if (!oldest) return;

    setLoadingOlder(true);
    const scrollEl = chatScrollRef.current;
    const prevHeight = scrollEl?.scrollHeight ?? 0;

    try {
      const older = await chatService.getOlderMessages(roomId, oldest.created_at, 5);
      if (older.length < 5) setHasMoreMessages(false);
      if (older.length > 0) {
        setChatMessages((prev) => [...older, ...prev]);
        void resolveUserNames(older);
        // Restore scroll position so it doesn't jump
        requestAnimationFrame(() => {
          if (scrollEl) {
            scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight;
          }
        });
      }
    } catch {
      // silent fail
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMoreMessages, roomId, chatMessages]);

  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (el.scrollTop < 80 && hasMoreMessages && !loadingOlder) {
      void loadOlderMessages();
    }
  }, [loadOlderMessages, hasMoreMessages, loadingOlder]);

  // Clear pending file when leaving chat room
  useEffect(() => {
    if (view !== "chatRoom") {
      setPendingFile(null);
    }
  }, [view]);

  const handleSendMessage = async () => {
    const text = chatMessage.trim();
    if (!text || !user || !roomId || sending) return;

    setChatMessage("");
    if (chatInputRef.current) {
      chatInputRef.current.style.height = "auto";
    }

    setSending(true);
    try {
      await chatService.sendMessage(roomId, user.uid, user.email ?? "User", text);
    } catch {
      setChatMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatMessage(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const [showMediaPreview, setShowMediaPreview] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setShowMediaPreview(true);
    }
    e.target.value = "";
  };

  const handleMediaSend = async (file: File, caption: string) => {
    if (!user || !roomId || sending) return;
    setShowMediaPreview(false);
    setPendingFile(null);
    setSending(true);
    try {
      setUploading(true);
      const attachment = await chatService.uploadAttachment(roomId, file);
      setUploading(false);
      await chatService.sendMessage(roomId, user.uid, user.email ?? "User", caption, attachment);
    } catch {
      // silent fail
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleMediaCancel = () => {
    setShowMediaPreview(false);
    setPendingFile(null);
  };

  // Scroll to bottom: instant on first load, smooth for new messages
  useEffect(() => {
    if (chatMessages.length === 0) return;
    if (!initialScrollDone.current) {
      // First load — jump to bottom instantly
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "instant" });
      });
    } else if (!loadingOlder) {
      // New message arrived — smooth scroll only if near bottom
      const el = chatScrollRef.current;
      if (el) {
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        if (nearBottom) {
          chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [chatMessages, loadingOlder]);

  // ---------------------------------------------------------------------------
  // Component: Chat Video Preview (thumbnail → inline player)
  // ---------------------------------------------------------------------------

  function ChatVideoPreview({ videoUrl, thumbnailUrl }: { videoUrl: string; thumbnailUrl: string | null }) {
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handlePlay = () => {
      setLoading(true);
      setLoaded(true);
    };

    const handleCanPlay = () => {
      setLoading(false);
      videoRef.current?.play();
    };

    if (loaded) {
      return (
        <div className="relative rounded-lg overflow-hidden mb-1.5">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            playsInline
            onCanPlay={handleCanPlay}
            className="rounded-lg max-w-full"
            poster={thumbnailUrl ?? undefined}
          />
        </div>
      );
    }

    return (
      <button
        onClick={handlePlay}
        className="relative rounded-lg overflow-hidden mb-1.5 block w-full text-left"
      >
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="Video" className="w-full rounded-lg" />
        ) : (
          <div className="w-full aspect-video bg-zinc-900 rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Chat Room (fullscreen)
  // ---------------------------------------------------------------------------

  const renderChatRoom = () => (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 border-b border-zinc-800 shrink-0" style={{ paddingTop: "env(safe-area-inset-top, 0px)", minHeight: "3.5rem" }}>
        <button
          className="w-8 h-8 flex items-center justify-center text-zinc-200"
          onClick={handleBack}
        >
          <span className="text-xl">‹</span>
        </button>
        <h1 className="text-white font-medium text-sm truncate flex-1">
          {currentRoom?.name ?? "Chat"}
        </h1>
      </div>

      {/* Messages area */}
      <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-4 py-3">
        {chatMessagesLoading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-600 text-sm">Cargando mensajes...</p>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-600 text-sm">No hay mensajes aun. Inicia la conversacion.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
              </div>
            )}
            {chatMessages.map((msg) => {
              const isOwn = msg.user_id === user?.uid;
              const time = new Date(msg.created_at);
              return (
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${isOwn ? "bg-emerald-600 text-white rounded-br-md" : "bg-zinc-800 text-zinc-100 rounded-bl-md"}`}>
                    {!isOwn && (
                      <p className="text-[10px] font-medium text-emerald-400 mb-0.5">{userNames[msg.user_id] || "User"}</p>
                    )}
                    {msg.attachment_url && msg.attachment_type === "image" && (
                      <ProgressiveImage src={msg.attachment_url} thumbnail={msg.thumbnail_url} alt={msg.attachment_name ?? "image"} />
                    )}
                    {msg.attachment_url && msg.attachment_type === "video" && (
                      <ChatVideoPreview
                        videoUrl={msg.attachment_url}
                        thumbnailUrl={msg.thumbnail_url}
                      />
                    )}
                    {msg.attachment_url && msg.attachment_type === "document" && (
                      <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1.5 ${isOwn ? "bg-emerald-700/50" : "bg-zinc-700/50"}`}>
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-xs truncate">{msg.attachment_name ?? "Documento"}</span>
                      </a>
                    )}
                    {msg.text && <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>}
                    <p className={`text-[10px] mt-1 text-right ${isOwn ? "text-emerald-200/60" : "text-zinc-500"}`}>
                      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Media Preview Screen */}
      {showMediaPreview && pendingFile && (
        <MediaPreviewScreen
          file={pendingFile}
          onSend={handleMediaSend}
          onCancel={handleMediaCancel}
        />
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-end gap-2 px-3 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="w-10 h-10 flex items-center justify-center text-zinc-400 active:text-zinc-200 shrink-0 disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
          </button>
          <textarea
            ref={chatInputRef}
            value={chatMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={uploading ? "Subiendo archivo..." : "Escribe un mensaje..."}
            rows={1}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500 max-h-[120px]"
          />
          <button
            onClick={() => void handleSendMessage()}
            disabled={!chatMessage.trim() || sending}
            className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center shrink-0 disabled:opacity-30 active:bg-emerald-700 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  if (view === "chatRoom") {
    return renderChatRoom();
  }

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
