"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/* ─── Get current authenticated user ──────────────────────────────────── */
async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) redirect("/");
  return session.user.id;
}

/* ─── Validation helpers ───────────────────────────────────────────────── */
function getString(formData: FormData, key: string): string {
  const val = formData.get(key);
  return typeof val === "string" ? val.trim() : "";
}

function getOptionalString(formData: FormData, key: string): string | null {
  const val = getString(formData, key);
  return val.length > 0 ? val : null;
}

/* ─── createSetup ──────────────────────────────────────────────────────── */
export async function createSetup(formData: FormData): Promise<void> {
  const userId = await requireUserId();

  const name = getString(formData, "name");
  const description = getOptionalString(formData, "description");
  const entryRules = getOptionalString(formData, "entryRules");
  const exitRules = getOptionalString(formData, "exitRules");
  const riskRules = getOptionalString(formData, "riskRules");
  const notes = getOptionalString(formData, "notes");
  const isActive = formData.get("isActive") === "on";

  // ── Validation ──────────────────────────────────────────────────────────
  if (name.length === 0) {
    throw new Error("Setup name is required.");
  }
  if (name.length > 100) {
    throw new Error("Setup name must be 100 characters or fewer.");
  }
  if (description && description.length > 500) {
    throw new Error("Description must be 500 characters or fewer.");
  }

  // ── Persist ─────────────────────────────────────────────────────────────
  await prisma.setup.create({
    data: {
      userId,
      name,
      description,
      entryRules,
      exitRules,
      riskRules,
      notes,
      isActive,
    },
  });

  redirect("/setups");
}
