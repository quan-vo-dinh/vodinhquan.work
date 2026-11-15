import { withOwner } from "@/lib/auth/api";
import { syncRequest } from "@/lib/developer/live/service";

export const POST = withOwner(async (request) => {
  if (request.headers.get("X-Developer-Manual-Sync") !== "1") {
    return Response.json({ code: "manual_sync_required" }, { status: 403 });
  }
  return syncRequest(request);
});
