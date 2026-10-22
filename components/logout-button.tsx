"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ destination = "/login", label = "Log out" }: { destination?: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("LOGOUT_FAILED");
      router.replace(destination);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return <button className="button ghost" type="button" onClick={logout} disabled={busy}><LogOut size={18}/>{busy ? "Signing out…" : label}</button>;
}
