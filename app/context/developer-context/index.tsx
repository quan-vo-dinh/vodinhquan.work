"use client";
import {
  createContext,
  useContext,
  useState,
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
  const current = data?.data ?? initialData;
  return (
    <Context.Provider
      value={{
        data: current,
        activities: data?.activities ?? [],
        syncProgress: data?.sync ?? [],
        error,
        isValidating,
        days,
        setDays,
        githubAccount,
        setGithubAccount,
        reload: () => { void mutate(); },
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
      <p role="status" className="border-b bg-muted px-4 py-2 text-sm text-muted-foreground">
        Tự đồng bộ GitHub đã tạm ngừng. Thông tin hiển thị từ lần đồng bộ trước.
      </p>
      {children}
    </Context.Provider>
  );
}
export function useDeveloper() {
  const value = useContext(Context);
  if (!value) throw new Error("DeveloperProvider missing");
  return value;
}
