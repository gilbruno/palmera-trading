"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

export function NewSetupButton() {
  const router = useRouter();
  return (
    <PrimaryButton onClick={() => router.push("/setups/new")}>
      <Plus size={13} strokeWidth={2.5} style={{ flexShrink: 0, letterSpacing: 0 }} />
      <span style={{ letterSpacing: "0.2em" }}>New Setup</span>
    </PrimaryButton>
  );
}
