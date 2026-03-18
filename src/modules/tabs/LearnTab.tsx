"use client";
import { useEffect, useMemo, useState } from "react";
import { Block } from "konsta/react";
import AppNavbar from "@/components/AppNavbar";
import MessageIcon from "@/components/icons/MessageIcon";
import {
  lmsService,
  type LmsCourse,
  type LmsLesson,
  type LmsModuleWithLessons,
} from "@/services/LmsService";
import { useAuthStore } from "@/stores/authStore";
import { userService } from "@/services/UserService";

type LearnView = "catalog" | "course" | "lesson";

const localeToLanguage: Record<string, LmsCourse["language"]> = {
  es: "es",
  en: "en",
  pt: "pt",
};

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

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        let userLanguage: LmsCourse["language"] = "es";
        if (user?.uid) {
          const profile = await userService.getUserProfile(user.uid);
          const loc = (profile.userData.locale as string) ?? "es";
          userLanguage = localeToLanguage[loc] ?? "es";
        }

        const data = await lmsService.getPublishedCourses();
        if (!active) return;
        setCourses(data.filter((c) => c.language === userLanguage));
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
  }, [user?.uid]);

  const lessonCount = useMemo(
    () => modules.reduce((sum, module) => sum + module.lessons.length, 0),
    [modules]
  );

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
    }
  };

  const openCourse = async (course: LmsCourse) => {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setView("course");
    setLoading(true);
    setError(null);
    try {
      const content = await lmsService.getCourseContent(course.id);
      setModules(content);
      setExpandedModules(new Set(content.map((module) => module.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el curso");
    } finally {
      setLoading(false);
    }
  };

  const openLesson = (lesson: LmsLesson) => {
    setSelectedLesson(lesson);
    setView("lesson");
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const renderCatalog = () => (
    <Block className="pt-2 pb-24">
      {loading && <p className="text-zinc-400 text-sm">Loading courses...</p>}
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {!loading && !error && courses.length === 0 && (
        <p className="text-zinc-400 text-sm">No published courses yet.</p>
      )}

      <div className="space-y-3">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => void openCourse(course)}
            className="w-full text-left bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden flex flex-col landscape:flex-row"
          >
            <div className="aspect-video landscape:aspect-auto landscape:w-48 landscape:min-h-[7rem] shrink-0 bg-zinc-800">
              {course.thumbnail_url ? (
                <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">No thumbnail</div>
              )}
            </div>
            <div className="p-3 landscape:flex landscape:flex-col landscape:justify-center min-w-0">
              <h3 className="text-white font-semibold landscape:text-sm">{course.title}</h3>
              {course.description && (
                <p className="text-zinc-400 text-xs mt-1 line-clamp-2">{course.description}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </Block>
  );

  const renderCourse = () => (
    <Block className="pt-2 pb-24">
      {selectedCourse && (
        <div className="mb-4">
          <p className="text-zinc-300 text-sm">{selectedCourse.description || "No description"}</p>
          <p className="text-zinc-500 text-xs mt-1">
            {moduleCount} modules • {lessonCount} lessons
          </p>
        </div>
      )}

      {loading && <p className="text-zinc-400 text-sm">Loading course content...</p>}
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {!loading && modules.length === 0 && (
        <p className="text-zinc-400 text-sm">This course has no published lessons.</p>
      )}

      <div className="space-y-3">
        {modules.map((module) => {
          const isOpen = expandedModules.has(module.id);
          return (
            <div key={module.id} className="bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden">
              <button
                className="w-full px-3 py-3 text-left flex items-center justify-between"
                onClick={() => toggleModule(module.id)}
              >
                <div>
                  <p className="text-white font-medium">{module.title}</p>
                  <p className="text-zinc-500 text-xs">{module.lessons.length} lessons</p>
                </div>
                <span className="text-zinc-400 text-xs">{isOpen ? "Hide" : "Show"}</span>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800">
                  {module.lessons.length === 0 ? (
                    <p className="px-3 py-3 text-zinc-500 text-xs">No lessons in this module.</p>
                  ) : (
                    module.lessons.map((lesson) => {
                      const thumb = getLessonThumbnail(lesson);
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => openLesson(lesson)}
                          className="w-full px-3 py-3 text-left border-b border-zinc-800 last:border-b-0 flex items-center gap-3"
                        >
                          <div className="w-16 h-10 shrink-0 rounded-md overflow-hidden bg-zinc-800">
                            {thumb ? (
                              <img src={thumb} alt={lesson.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[10px]">
                                {lesson.content_type === "video" ? "▶" : "📄"}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-zinc-100 text-sm">{lesson.title}</p>
                            <p className="text-zinc-500 text-xs">
                              {lesson.content_type.toUpperCase()}
                              {lesson.duration_minutes ? ` • ${lesson.duration_minutes} min` : ""}
                              {lesson.is_free ? " • Free" : ""}
                            </p>
                          </div>
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

    return (
      <Block className="pt-2 pb-24">
        <div className="mb-4">
          <p className="text-zinc-400 text-xs">
            {selectedLesson.content_type.toUpperCase()}
            {selectedLesson.duration_minutes ? ` • ${selectedLesson.duration_minutes} min` : ""}
          </p>
        </div>

        {videoUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border border-zinc-800 bg-black">
            <video src={videoUrl} controls poster={poster ?? undefined} className="w-full aspect-video object-contain" />
          </div>
        )}

        {textContent ? (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3">
            <p className="text-zinc-200 text-sm whitespace-pre-wrap">{textContent}</p>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No text content for this lesson.</p>
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
