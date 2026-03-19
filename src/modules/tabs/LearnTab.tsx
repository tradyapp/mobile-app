"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Block } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import MessageIcon from "@/components/icons/MessageIcon";
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

type LearnView = "catalog" | "course" | "lesson";

const localeToLanguage: Record<string, LmsCourse["language"]> = {
  es: "es",
  en: "en",
  pt: "pt",
};

const NEAR_END_THRESHOLD = 15; // seconds before end to mark as completed

/** Small SVG donut chart for course progress */
function ProgressPie({ completed, total, size = 36 }: { completed: number; total: number; size?: number }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);
  const isComplete = total > 0 && completed === total;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-zinc-800"
          strokeWidth={3}
        />
        {/* Progress arc */}
        {pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className={isComplete ? "text-emerald-400" : "text-emerald-500/70"}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
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
  const candidates = [
    content.url,
    content.video_url,
    content.videoUrl,
    content.stream_url,
    content.streamUrl,
  ];
  const direct = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return (direct as string | undefined) ?? null;
}

function getLessonTextContent(lesson: LmsLesson): string {
  const content = lesson.content ?? {};
  const candidates = [content.text, content.body, content.markdown, content.description, content.content];
  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return (value as string | undefined) ?? "";
}

export default function LearnTab() {
  const [view, setView] = useState<LearnView>("catalog");
  const [courses, setCourses] = useState<LmsCourse[]>([]);
  const [modules, setModules] = useState<LmsModuleWithLessons[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<LmsCourse | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LmsLesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const storeLocale = useUserPrefsStore((state) => state.locale);
  const setStoreLocale = useUserPrefsStore((state) => state.setLocale);

  // Progress state
  const [progressMap, setProgressMap] = useState<Map<string, LessonProgress>>(new Map());
  const [courseSummaries, setCourseSummaries] = useState<Map<string, CourseProgressSummary>>(new Map());
  const videoRef = useRef<HTMLVideoElement>(null);
  const markedCompleteRef = useRef(false);

  // Reset to catalog when locale changes
  useEffect(() => {
    if (view !== "catalog") {
      setView("catalog");
      setSelectedCourse(null);
      setSelectedLesson(null);
      setModules([]);
      setExpandedModules(new Set());
      setProgressMap(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeLocale]);

  // Fetch courses filtered by locale
  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        // On first load, sync store locale from profile
        if (user?.uid) {
          const profile = await userService.getUserProfile(user.uid);
          if (!active) return;
          const loc = (profile.userData.locale as string) ?? "es";
          const resolved = localeToLanguage[loc] ?? "es";
          if (resolved !== storeLocale) {
            setStoreLocale(resolved);
            return; // will re-run via storeLocale change
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

    return () => {
      active = false;
    };
  }, [user?.uid, storeLocale, setStoreLocale]);

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
    view === "catalog" ? "Learn" : view === "course" ? selectedCourse?.title ?? "Course" : selectedLesson?.title ?? "Lesson";

  const handleBack = () => {
    if (view === "lesson") {
      setView("course");
      return;
    }
    if (view === "course") {
      setView("catalog");
      setSelectedCourse(null);
      setSelectedLesson(null);
      setModules([]);
      setExpandedModules(new Set());
      setProgressMap(new Map());
    }
  };

  const openCourse = async (course: LmsCourse) => {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setView("course");
    setLoading(true);
    setError(null);
    try {
      const [content, progress] = await Promise.all([
        lmsService.getCourseContent(course.id),
        user?.uid
          ? lmsProgressService.getCourseProgress(user.uid, course.id)
          : Promise.resolve(new Map<string, LessonProgress>()),
      ]);
      setModules(content);
      setProgressMap(progress);
      setExpandedModules(new Set(content.map((module) => module.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el curso");
    } finally {
      setLoading(false);
    }
  };

  const markLessonComplete = useCallback(
    async (lesson: LmsLesson, progressSeconds?: number) => {
      if (!user?.uid || !selectedCourse) return;
      if (progressMap.get(lesson.id)?.completed) return;

      try {
        await lmsProgressService.markCompleted(user.uid, lesson.id, selectedCourse.id, progressSeconds);
        setProgressMap((prev) => {
          const next = new Map(prev);
          next.set(lesson.id, {
            id: prev.get(lesson.id)?.id ?? "",
            user_id: user.uid,
            lesson_id: lesson.id,
            course_id: selectedCourse.id,
            completed: true,
            progress_seconds: progressSeconds ?? prev.get(lesson.id)?.progress_seconds ?? 0,
            completed_at: new Date().toISOString(),
          });
          return next;
        });
        // Update catalog summary optimistically
        setCourseSummaries((prev) => {
          const next = new Map(prev);
          const existing = next.get(selectedCourse.id);
          if (existing) {
            next.set(selectedCourse.id, { ...existing, completed: existing.completed + 1 });
          }
          return next;
        });
      } catch {
        // silent fail — progress is non-critical
      }
    },
    [user?.uid, selectedCourse, progressMap]
  );

  const openLesson = (lesson: LmsLesson) => {
    setSelectedLesson(lesson);
    setView("lesson");
    markedCompleteRef.current = false;

    // Auto-mark text lessons as completed on open
    if (lesson.content_type === "text") {
      void markLessonComplete(lesson);
    }
  };

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

  // Helper: count completed lessons in a module
  const getModuleProgress = (mod: LmsModuleWithLessons) => {
    let done = 0;
    for (const lesson of mod.lessons) {
      if (progressMap.get(lesson.id)?.completed) done++;
    }
    return done;
  };

  const renderCatalogSkeleton = () => (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden flex flex-col landscape:flex-row"
        >
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
              onClick={() => void openCourse(course)}
              className="w-full text-left bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden flex flex-col landscape:flex-row"
            >
              <div className="aspect-video landscape:aspect-auto landscape:w-48 landscape:min-h-[7rem] shrink-0 bg-zinc-800 relative">
                {course.thumbnail_url ? (
                  <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">No thumbnail</div>
                )}
                {/* Pie chart overlay */}
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
          {/* Course progress bar */}
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
                  {/* Module progress bar */}
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
                          {/* Thumbnail with completed overlay */}
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
                          {/* Completed checkmark next to title */}
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

  const renderLesson = () => {
    if (!selectedLesson) return null;
    const videoUrl = getLessonVideoUrl(selectedLesson);
    const textContent = getLessonTextContent(selectedLesson);
    const poster = getLessonThumbnail(selectedLesson);
    const isCompleted = progressMap.get(selectedLesson.id)?.completed === true;

    return (
      <Block className="pt-2 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-zinc-400 text-xs">
            {selectedLesson.content_type.toUpperCase()}
            {selectedLesson.duration_minutes ? ` • ${selectedLesson.duration_minutes} min` : ""}
          </p>
          {isCompleted && (
            <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Completed
            </span>
          )}
        </div>

        {videoUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-black">
            <video
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
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
            <p className="text-zinc-200 text-sm whitespace-pre-wrap">{textContent}</p>
          </div>
        ) : (
          !videoUrl && <p className="text-zinc-500 text-sm">No text content for this lesson.</p>
        )}

        {/* Manual mark complete button for video lessons not yet completed */}
        {!isCompleted && selectedLesson.content_type === "video" && (
          <button
            onClick={() => void markLessonComplete(selectedLesson)}
            className="mt-4 w-full py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 text-sm font-medium active:bg-zinc-700 transition-colors"
          >
            Mark as completed
          </button>
        )}
      </Block>
    );
  };

  return (
    <>
      <AppNavbar
        left={
          <button
            className="w-10 h-10 flex items-center justify-center text-zinc-200"
            onClick={view === "catalog" ? undefined : handleBack}
          >
            {view === "catalog" ? <MessageIcon /> : <span className="text-xl">‹</span>}
          </button>
        }
        title={navbarTitle}
      />
      {view === "catalog" && renderCatalog()}
      {view === "course" && renderCourse()}
      {view === "lesson" && renderLesson()}
    </>
  );
}
