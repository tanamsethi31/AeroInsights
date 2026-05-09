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

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth0();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("none");
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);

  const resolveOrg = useCallback(async (userId: string) => {
    setIsLoadingOrg(true);
    try {
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id")
        .eq("user_id", userId)
        .single();
      // PGRST116 = "row not found" — expected when user has no org (demo mode)
      if (error && error.code !== "PGRST116") {
        console.error("[DataContext] resolveOrg error:", error.message);
      }
      if (data?.org_id) setOrgId(data.org_id);
    } catch {
      // No org found — app runs in demo mode
    } finally {
      setIsLoadingOrg(false);
    }
  }, []);

  const fetchUploadStatus = useCallback(async () => {
    if (!orgId) return;
    try {
      const { data, error } = await supabase
        .from("uploads")
        .select("status")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      // PGRST116 = no rows — org has no uploads yet, that's fine
      if (error && error.code !== "PGRST116") {
        console.error("[DataContext] fetchUploadStatus error:", error.message);
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
