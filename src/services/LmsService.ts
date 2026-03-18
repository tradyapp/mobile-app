import { supabase } from "@/lib/supabase";

export interface LmsCourse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  language: "es" | "en" | "pt";
  level: "beginner" | "intermediate" | "advanced";
  status: "draft" | "published" | "archived";
  sort_order: number;
}

export interface LmsModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface LmsLesson {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  content_type: "video" | "text" | "quiz";
  content: Record<string, unknown>;
  duration_minutes: number | null;
  sort_order: number;
  is_free: boolean;
  status: "draft" | "published";
  mux_id: string | null;
  thumbnail_url: string | null;
  access_tier_keys: string[];
}

export interface LmsModuleWithLessons extends LmsModule {
  lessons: LmsLesson[];
}

class LmsService {
  async getPublishedCourses(): Promise<LmsCourse[]> {
    const { data, error } = await supabase
      .from("courses")
      .select("id, slug, title, description, thumbnail_url, language, level, status, sort_order")
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as LmsCourse[];
  }

  async getCourseContent(courseId: string): Promise<LmsModuleWithLessons[]> {
    const { data: modules, error: modulesError } = await supabase
      .from("course_modules")
      .select("id, course_id, title, description, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });

    if (modulesError) {
      throw modulesError;
    }

    const moduleRows = (modules ?? []) as LmsModule[];
    if (moduleRows.length === 0) {
      return [];
    }

    const moduleIds = moduleRows.map((m) => m.id);

    const { data: lessons, error: lessonsError } = await supabase
      .from("course_lessons")
      .select(
        "id, module_id, title, slug, content_type, content, duration_minutes, sort_order, is_free, status, mux_id, thumbnail_url, access_tier_keys"
      )
      .in("module_id", moduleIds)
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (lessonsError) {
      throw lessonsError;
    }

    const lessonRows = (lessons ?? []) as LmsLesson[];

    return moduleRows.map((module) => ({
      ...module,
      lessons: lessonRows.filter((lesson) => lesson.module_id === module.id),
    }));
  }
}

export const lmsService = new LmsService();
