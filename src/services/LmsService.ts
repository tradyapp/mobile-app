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
  private async getLatestUpdatedAt(
    table: "courses" | "course_modules" | "course_lessons",
    filters?: Array<{ column: string; value: string }>
  ): Promise<string> {
    let query = supabase
      .from(table)
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);

    for (const filter of filters ?? []) {
      query = query.eq(filter.column, filter.value);
    }

    const { data, error } = await query.single();
    if (error && error.code !== "PGRST116") {
      throw error;
    }
    return (data as { updated_at?: string } | null)?.updated_at ?? "0";
  }

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

  async getCatalogVersion(): Promise<string> {
    const [coursesUpdatedAt, modulesUpdatedAt, lessonsUpdatedAt] = await Promise.all([
      this.getLatestUpdatedAt("courses"),
      this.getLatestUpdatedAt("course_modules"),
      this.getLatestUpdatedAt("course_lessons"),
    ]);

    return [coursesUpdatedAt, modulesUpdatedAt, lessonsUpdatedAt].sort().at(-1) ?? "0";
  }

  async getCourseContentVersion(courseId: string): Promise<string> {
    const modulesUpdatedAt = await this.getLatestUpdatedAt("course_modules", [{ column: "course_id", value: courseId }]);
    const { data: modules, error } = await supabase
      .from("course_modules")
      .select("id")
      .eq("course_id", courseId);

    if (error) {
      throw error;
    }

    const moduleIds = (modules ?? []).map((module) => String(module.id)).filter(Boolean);
    let lessonsUpdatedAt = "0";
    if (moduleIds.length > 0) {
      const { data: lessons, error: lessonsError } = await supabase
        .from("course_lessons")
        .select("updated_at")
        .in("module_id", moduleIds)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (lessonsError && lessonsError.code !== "PGRST116") {
        throw lessonsError;
      }
      lessonsUpdatedAt = (lessons as { updated_at?: string } | null)?.updated_at ?? "0";
    }

    return [modulesUpdatedAt, lessonsUpdatedAt].sort().at(-1) ?? "0";
  }
}

export const lmsService = new LmsService();
