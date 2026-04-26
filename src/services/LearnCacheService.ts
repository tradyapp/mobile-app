import { clientCacheService } from "@/services/cache/ClientCacheService";
import type { LmsCourse, LmsLesson, LmsModuleWithLessons } from "@/services/LmsService";

interface LearnCatalogSnapshot {
  courses: LmsCourse[];
  modulesByCourse: Array<[string, LmsModuleWithLessons[]]>;
}

interface LearnCourseSnapshot {
  modules: LmsModuleWithLessons[];
}

class LearnCacheService {
  private catalogKey(locale: string): string {
    return `learn:catalog:${locale}`;
  }

  private courseKey(courseId: string): string {
    return `learn:course:${courseId}`;
  }

  private assetKey(url: string): string {
    return `asset:${url}`;
  }

  async getCatalogSnapshot(locale: string): Promise<LearnCatalogSnapshot | null> {
    return clientCacheService.getPayload<LearnCatalogSnapshot>(this.catalogKey(locale));
  }

  async setCatalogSnapshot(locale: string, snapshot: LearnCatalogSnapshot, version: string | null): Promise<void> {
    await clientCacheService.setPayload(this.catalogKey(locale), snapshot);
    clientCacheService.writeMeta(this.catalogKey(locale), version);
  }

  getCatalogVersion(locale: string): string | null {
    return clientCacheService.readMeta(this.catalogKey(locale))?.version ?? null;
  }

  async getCourseSnapshot(courseId: string): Promise<LearnCourseSnapshot | null> {
    return clientCacheService.getPayload<LearnCourseSnapshot>(this.courseKey(courseId));
  }

  async setCourseSnapshot(courseId: string, snapshot: LearnCourseSnapshot, version: string | null): Promise<void> {
    await clientCacheService.setPayload(this.courseKey(courseId), snapshot);
    clientCacheService.writeMeta(this.courseKey(courseId), version);
  }

  getCourseVersion(courseId: string): string | null {
    return clientCacheService.readMeta(this.courseKey(courseId))?.version ?? null;
  }

  async primeCatalogAssets(snapshot: LearnCatalogSnapshot): Promise<void> {
    const urls = new Set<string>();
    for (const course of snapshot.courses) {
      if (course.thumbnail_url) urls.add(course.thumbnail_url);
    }
    for (const [, modules] of snapshot.modulesByCourse) {
      this.collectModuleAssetUrls(modules, urls);
    }
    await this.cacheUrls(urls);
  }

  async primeCourseAssets(snapshot: LearnCourseSnapshot): Promise<void> {
    const urls = new Set<string>();
    this.collectModuleAssetUrls(snapshot.modules, urls);
    await this.cacheUrls(urls);
  }

  async hydrateCatalogAssets(snapshot: LearnCatalogSnapshot): Promise<LearnCatalogSnapshot> {
    const courses = await Promise.all(snapshot.courses.map(async (course) => ({
      ...course,
      thumbnail_url: course.thumbnail_url
        ? (await this.getCachedAssetUrl(course.thumbnail_url)) ?? course.thumbnail_url
        : null,
    })));

    const modulesByCourse = await Promise.all(
      snapshot.modulesByCourse.map(async ([courseId, modules]) => [
        courseId,
        await this.hydrateModules(modules),
      ] as [string, LmsModuleWithLessons[]]),
    );

    return { courses, modulesByCourse };
  }

  async hydrateCourseAssets(snapshot: LearnCourseSnapshot): Promise<LearnCourseSnapshot> {
    return {
      modules: await this.hydrateModules(snapshot.modules),
    };
  }

  private async hydrateModules(modules: LmsModuleWithLessons[]): Promise<LmsModuleWithLessons[]> {
    return Promise.all(
      modules.map(async (module) => ({
        ...module,
        lessons: await Promise.all(
          module.lessons.map(async (lesson) => ({
            ...lesson,
            thumbnail_url: lesson.thumbnail_url
              ? (await this.getCachedAssetUrl(lesson.thumbnail_url)) ?? lesson.thumbnail_url
              : null,
          })),
        ),
      })),
    );
  }

  private collectModuleAssetUrls(modules: LmsModuleWithLessons[], urls: Set<string>): void {
    for (const module of modules) {
      for (const lesson of module.lessons) {
        if (lesson.thumbnail_url) {
          urls.add(lesson.thumbnail_url);
        }
        if (lesson.mux_id) {
          urls.add(`https://image.mux.com/${lesson.mux_id}/thumbnail.jpg?width=240`);
        }
      }
    }
  }

  private async cacheUrls(urls: Set<string>): Promise<void> {
    await Promise.all(
      Array.from(urls).map(async (url) => {
        const key = this.assetKey(url);
        try {
          const exists = await clientCacheService.hasAsset(key);
          if (exists) return;
          await clientCacheService.cacheAssetFromUrl(key, url);
        } catch {
          // Ignore individual asset failures.
        }
      }),
    );
  }

  private async getCachedAssetUrl(url: string): Promise<string | null> {
    return clientCacheService.getAssetObjectUrl(this.assetKey(url));
  }
}

export const learnCacheService = new LearnCacheService();
