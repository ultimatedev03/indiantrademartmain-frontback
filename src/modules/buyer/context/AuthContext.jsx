import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/customSupabaseClient";

const BuyerAuthContext = createContext(null);

export const useBuyerAuth = () => {
  const context = useContext(BuyerAuthContext);
  if (!context) {
    throw new Error("useBuyerAuth must be used within a BuyerAuthProvider");
  }
  return context;
};

async function fetchBuyerRow({ userId, email }) {
  // 1) best: buyers.user_id == auth user.id
  if (userId) {
    const res1 = await supabase
      .from("buyers")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!res1.error && res1.data) return res1.data;
  }

  // 2) fallback: buyers.id == userId
  if (userId) {
    const res2 = await supabase
      .from("buyers")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!res2.error && res2.data) return res2.data;
  }

  // 3) fallback: buyers.email == email
  if (email) {
    const res3 = await supabase
      .from("buyers")
      .select("*")
      .ilike("email", String(email))
      .maybeSingle();

    if (!res3.error && res3.data) return res3.data;
  }

  return null;
}

export const BuyerAuthProvider = ({ children }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [buyer, setBuyer] = useState(null);
  const [buyerLoading, setBuyerLoading] = useState(true);

  const inFlightRef = useRef(false);
  const lastKeyRef = useRef("");

  /**
   * ✅ refreshBuyer supports silent mode:
   * - silent=true => NO loading blink
   * - silent=false => show loading (only initial / forced situations)
   */
  const refreshBuyer = useCallback(
    async ({ force = false, silent = false } = {}) => {
      const userId = user?.id || "";
      const email = user?.email || "";
      const key = `${userId}|${email}`;

      if (!userId && !email) {
        lastKeyRef.current = "";
        setBuyer(null);
        setBuyerLoading(false);
        return;
      }

      // already fresh, avoid extra queries
      if (!force && lastKeyRef.current === key && buyer) {
        if (!silent) setBuyerLoading(false);
        return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      // IMPORTANT: no UI blink in silent mode
      if (!silent) setBuyerLoading(true);

      try {
        const buyerRow = await fetchBuyerRow({ userId, email });

        // debug
        // eslint-disable-next-line no-console
        console.log("[BuyerAuth] refresh key:", key, "silent:", silent);
        // eslint-disable-next-line no-console
        console.log("[BuyerAuth] buyerRow:", buyerRow);

        setBuyer(buyerRow);
        lastKeyRef.current = key;
      } catch (e) {
        console.error("[BuyerAuth] refreshBuyer error:", e);
      } finally {
        inFlightRef.current = false;
        if (!silent) setBuyerLoading(false);
      }
    },
    [user?.id, user?.email, buyer]
  );

  // ✅ Initial load / user identity change (show loader once)
  useEffect(() => {
    setBuyerLoading(true);
    refreshBuyer({ force: true, silent: false }).finally(() => setBuyerLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email]);

  // ✅ REALTIME: status change push (best case)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`buyer-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buyers",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload?.new) {
            // eslint-disable-next-line no-console
            console.log("[BuyerAuth] realtime payload:", payload);
            setBuyer(payload.new);
          } else {
            refreshBuyer({ force: true, silent: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshBuyer]);

  // ✅ SILENT POLLING fallback (NO blink) so terminate/activate reflects quickly
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      // silent refresh so UI doesn't blink
      refreshBuyer({ force: true, silent: true });
    }, 8000); // 8 sec (you can set 5000-10000)

    return () => clearInterval(interval);
  }, [user?.id, refreshBuyer]);

  const isBuyerActive = useMemo(() => {
    // buyer row missing => treat suspended for safety
    if (!buyer) return false;

    if (typeof buyer.is_active === "boolean") return buyer.is_active;

    if (typeof buyer.status === "string") {
      return buyer.status.toUpperCase() === "ACTIVE";
    }

    if (buyer.terminated_at) return false;

    return true;
  }, [buyer]);

  const logout = useCallback(async () => {
    try {
      await signOut();
      navigate("/buyer/login", { replace: true });
    } catch (error) {
      console.error("Logout failed", error);
    }
  }, [signOut, navigate]);

  const value = {
    user,
    isAuthenticated: !!user,

    buyer,
    buyerLoading,

    isBuyerActive,
    isBuyerSuspended: !isBuyerActive,

    refreshBuyer,
    logout,
  };

  return (
    <BuyerAuthContext.Provider value={value}>
      {children}
    </BuyerAuthContext.Provider>
  );
};