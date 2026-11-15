"use client";
import {
  createContext,
  useContext,
  useState,
  useRef,
  type ReactNode,
} from "react";
import useSWR from "swr";
import { toast } from "@/components/ui/toast";
import type { DeveloperData } from "@/lib/developer/model";
import type { LiveSnapshot } from "@/lib/developer/live/types";
export async function developerFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.code ?? "unavailable");
  return body;
}
const Context = createContext<{
  data: DeveloperData;
  activities: LiveSnapshot["activities"];
  syncProgress: NonNullable<LiveSnapshot["sync"]>;
  error: Error | undefined;
  isValidating: boolean;
  reload: () => void;
  refresh: () => void;
  days: number;
  setDays: (n: number) => void;
  githubAccount: string;
  setGithubAccount: (id: string) => void;
  readIds: string[];
  toggleRead: (id: string) => void;
} | null>(null);
export function DeveloperProvider({
  initialData,
  children,
}: {
  initialData: DeveloperData;
  children: ReactNode;
}) {
  const { data, error, isValidating, mutate } = useSWR<LiveSnapshot, Error>(
    "/api/developer",
    developerFetch,
    {
      fallbackData: { data: initialData, activities: [], coverage: [] },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  const [githubAccount, setGithubAccount] = useState("all");
  const [days, setDays] = useState(30);
  const [syncing, setSyncing] = useState(false);
  const syncInFlight = useRef(false);
  async function sync() {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setSyncing(true);
    try {
      const connections = (await developerFetch("/api/developer/connections")) as { id: string; paused: boolean }[];
      const active = connections.filter((c) => !c.paused);
      if (!active.length) throw new Error("Không có kết nối GitHub đang hoạt động để đồng bộ.");
      const results = await Promise.allSettled(active.map(async (c) => {
        let activityDone = false, historyDone = false;
        for (let step = 0; step < 10000 && (!activityDone || !historyDone); step++) {
          for (const mode of ["history", "activity"] as const) {
            if (mode === "history" ? historyDone : activityDone) continue;
            const result = await developerFetch("/api/developer/sync", {
              method: "POST",
              headers: { "X-Developer-Manual-Sync": "1" },
              body: JSON.stringify({ id: c.id, mode }),
            });
            if (result.retryAfter) throw new Error(`Chưa thể đồng bộ. Thử lại sau ${result.retryAfter} giây.`);
            if (mode === "history") historyDone = !!result.done;
            else activityDone = !!result.done;
          }
        }
        if (!activityDone || !historyDone) throw new Error("Đồng bộ chưa hoàn tất; hãy thử lại.");
      }));
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      toast.add({ title: "Đồng bộ GitHub hoàn tất", type: "success" });
    } catch (cause) {
      toast.add({ title: cause instanceof Error ? cause.message : "unavailable", type: "error" });
    } finally {
      try { await mutate(); } finally {
        syncInFlight.current = false;
        setSyncing(false);
      }
    }
  }
  const current = data?.data ?? initialData;
  return (
    <Context.Provider
      value={{
        data: current,
        activities: data?.activities ?? [],
        syncProgress: data?.sync ?? [],
        error,
        isValidating: isValidating || syncing,
        days,
        setDays,
        githubAccount,
        setGithubAccount,
        reload: () => { void sync(); },
        refresh: () => { void mutate(); },
        readIds: current.notifications.filter((n) => n.read).map((n) => n.id),
        toggleRead: (id) => {
          void developerFetch("/api/developer/inbox", {
            method: "PATCH",
            body: JSON.stringify({ id }),
          })
            .then(() => mutate())
            .catch((cause) => toast.add({ title: String(cause.message), type: "error" }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDeveloper() {
  const value = useContext(Context);
  if (!value) throw new Error("DeveloperProvider missing");
  return value;
}
