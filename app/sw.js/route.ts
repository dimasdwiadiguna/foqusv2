import { workerSource } from "./worker";

/** Built once per deploy, so the version changes with every build. */
export const dynamic = "force-static";

const VERSION = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? `build-${Date.now()}`;

export function GET() {
  return new Response(workerSource(VERSION), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
