import { supabase } from "@/lib/supabase";

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  completed: boolean;
  progress_seconds: number;
  completed_at: string | null;
}

class LmsProgressService {
  /**
   * Fetch all progress rows for a user in a given course.
   * Returns a map keyed by lesson_id for quick lookup.
   */
  async getCourseProgress(
    userId: string,
    courseId: string
  ): Promise<Map<string, LessonProgress>> {
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("id, user_id, lesson_id, course_id, completed, progress_seconds, completed_at")
      .eq("user_id", userId)
      .eq("course_id", courseId);

    if (error) throw error;

    const map = new Map<string, LessonProgress>();
    for (const row of (data ?? []) as LessonProgress[]) {
      map.set(row.lesson_id, row);
    }
    return map;
  }

  /**
   * Mark a lesson as completed (upsert).
   */
  async markCompleted(
    userId: string,
    lessonId: string,
    courseId: string,
    progressSeconds?: number
  ): Promise<void> {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          course_id: courseId,
          completed: true,
          completed_at: new Date().toISOString(),
          ...(progressSeconds !== undefined && { progress_seconds: progressSeconds }),
        },
        { onConflict: "user_id,lesson_id" }
      );

    if (error) throw error;
  }

  /**
   * Save video playback position (upsert without marking completed).
   */
  async saveProgress(
    userId: string,
    lessonId: string,
    courseId: string,
    progressSeconds: number
  ): Promise<void> {
    const { error } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: lessonId,
          course_id: courseId,
          progress_seconds: progressSeconds,
        },
        { onConflict: "user_id,lesson_id" }
      );

    if (error) throw error;
  }
}

export const lmsProgressService = new LmsProgressService();
