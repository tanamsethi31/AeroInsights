// src/app/contexts/DataContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";

type UploadStatus = "none" | "pending" | "processing" | "complete" | "error";

interface DataContextValue {
  orgId: string | null;
  hasUpload: boolean;
  uploadStatus: UploadStatus;
  isLoadingOrg: boolean;
  refetchUploadStatus: () => Promise<void>;
}

const DataContext = createContext<DataContextValue>({
  orgId: null,
  hasUpload: false,
  uploadStatus: "none",
  isLoadingOrg: false,
  refetchUploadStatus: async () => {},
});

// T-4.2 — endpoint that swaps an Auth0 token for a Supabase-signed JWT
// carrying the `org_id` custom claim. Same VITE_API_BASE_URL pattern as
// the other API calls; falls back to a local dev origin.
const RAW_API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").trim();
// Treat localhost URLs the same as "missing" — they're build-time leftovers
// from local dev and just produce noisy 404s in production. Real backends
// have a non-localhost URL.
const API_BASE = RAW_API_BASE.includes("localhost") ? "" : RAW_API_BASE;
const TOKEN_REFRESH_BUFFER_SECONDS = 60; // refresh 1 min before expiry

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("none");
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);

  // T-4.2 — Exchange the Auth0 token for a Supabase JWT and install it on
  // the supabase client. RLS policies then see `org_id` via auth.jwt().
  // Returns the resolved orgId from the exchange response, or null.
  const exchangeAndSetSession = useCallback(async (): Promise<string | null> => {
    if (!API_BASE) {
      // No API base configured — skip exchange and rely on permissive demo
      // mode (anon JWT). RLS-tightened tables will return empty for the
      // browser. Documented in docs/SECURITY.md.
      return null;
    }
    try {
      const auth0Token = await getAccessTokenSilently();
      const res = await fetch(`${API_BASE.replace(/\/$/, "")}/auth/supabase-token`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth0Token}` },
      });
      if (!res.ok) {
        console.warn("[DataContext] supabase-token exchange failed:", res.status);
        return null;
      }
      const { access_token, org_id } = (await res.json()) as {
        access_token: string;
        org_id: string | null;
        expires_in: number;
      };
      // setSession requires both tokens; we don't issue refresh tokens, so
      // we pass the access token twice and let the next exchange handle
      // renewal explicitly.
      await supabase.auth.setSession({
        access_token,
        refresh_token: access_token,
      });
      return org_id;
    } catch (err) {
      console.warn("[DataContext] supabase-token exchange threw:", err);
      return null;
    }
  }, [getAccessTokenSilently]);

  const resolveOrg = useCallback(async (userId: string) => {
    setIsLoadingOrg(true);
    try {
      // First try the JWT-exchange path. If it resolves org_id, we're done
      // and the supabase client is also authenticated.
      const exchangedOrgId = await exchangeAndSetSession();
      if (exchangedOrgId) {
        setOrgId(exchangedOrgId);
        return;
      }
      // Fall back to a SECURITY DEFINER RPC that returns the user's most
      // recent org_id. Direct selects on org_members are blocked by RLS
      // until the JWT carries an org_id claim, which is exactly what we're
      // trying to establish — chicken-and-egg without the RPC.
      const { data: rpcOrgId, error: rpcErr } = await supabase.rpc(
        "get_my_latest_org_id",
        { p_user_id: userId },
      );
      if (rpcErr) {
        console.error("[DataContext] get_my_latest_org_id error:", rpcErr.message);
      }
      if (rpcOrgId) setOrgId(rpcOrgId as string);
    } catch {
      // No org found — app runs in demo mode
    } finally {
      setIsLoadingOrg(false);
    }
  }, [exchangeAndSetSession]);

  // Schedule a refresh ~1 min before the 1-hour Supabase JWT expires so
  // long-lived sessions don't see RLS suddenly return empty.
  useEffect(() => {
    if (!isAuthenticated) return;
    const intervalMs = ((60 * 60) - TOKEN_REFRESH_BUFFER_SECONDS) * 1000;
    const id = setInterval(() => { void exchangeAndSetSession(); }, intervalMs);
    return () => clearInterval(id);
  }, [isAuthenticated, exchangeAndSetSession]);

  const fetchUploadStatus = useCallback(async () => {
    if (!orgId) return;
    // Skip when there's no JWT-exchange backend configured. Without it,
    // the anon JWT cannot satisfy RLS on uploads → query returns HTTP 401,
    // which the browser auto-logs as a red console error JS cannot
    // suppress. Falls back to uploadStatus = "none" silently.
    if (!API_BASE) {
      setUploadStatus("none");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("uploads")
        .select("status")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error) {
        // PGRST116 = no rows — org has no uploads yet, that's fine.
        // 42501 / "permission denied" = RLS gating the anon JWT; expected
        // when there's no Supabase session (e.g. JWT exchange backend is
        // not wired up). Falls back to "none" silently — no noisy log.
        const code = (error as { code?: string }).code;
        const msg  = String((error as { message?: string }).message ?? "");
        const isRls = code === "42501" || /permission denied/i.test(msg);
        if (code !== "PGRST116" && !isRls) {
          console.error("[DataContext] fetchUploadStatus error:", error.message);
        }
      }
      setUploadStatus((data?.status as UploadStatus) ?? "none");
    } catch {
      setUploadStatus("none");
    }
  }, [orgId]);

  useEffect(() => {
    if (isAuthenticated && user?.sub) {
      resolveOrg(user.sub);
    } else if (!isAuthenticated) {
      setOrgId(null);
      setUploadStatus("none");
    }
  }, [isAuthenticated, user?.sub, resolveOrg]);

  useEffect(() => {
    if (orgId) fetchUploadStatus();
  }, [orgId, fetchUploadStatus]);

  return (
    <DataContext.Provider
      value={{
        orgId,
        hasUpload: uploadStatus === "complete",
        uploadStatus,
        isLoadingOrg,
        refetchUploadStatus: fetchUploadStatus,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
