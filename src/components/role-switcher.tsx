"use client";

import { useTransition } from "react";
import { switchLocalRole } from "@/actions/role-actions";
import { toast } from "sonner";
import { Shield, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

interface RoleSwitcherProps {
  currentRole: string | null;
}

export function RoleSwitcher({ currentRole }: RoleSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const role = currentRole === "OWNER" ? "OWNER" : "ADMIN";

  const handleToggle = () => {
    const nextRole = role === "ADMIN" ? "OWNER" : "ADMIN";
    startTransition(async () => {
      await switchLocalRole(nextRole);
      toast.success(`Active Role Switched to: ${nextRole}`);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-muted/60 border rounded-lg p-1 text-xs">
      <span className="text-[10px] text-muted-foreground font-semibold px-1 hidden sm:inline">
        ROLE:
      </span>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-all shadow-xs ${
          role === "OWNER"
            ? "bg-amber-500 text-amber-950 hover:bg-amber-400"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        title="Click to switch between ADMIN and OWNER view"
      >
        {role === "OWNER" ? (
          <ShieldAlert className="h-3 w-3" />
        ) : (
          <Shield className="h-3 w-3" />
        )}
        <span>{role}</span>
        <span className="text-[9px] opacity-75 font-normal ml-0.5">
          (click to switch)
        </span>
      </button>
    </div>
  );
}
