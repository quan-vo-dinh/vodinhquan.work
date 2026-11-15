export function POST() {
  return Response.json({ code: "developer_sync_paused" }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}
