"use server";
import { requireAdmin } from "@/lib/data/auth";
import { flushCatalogIfDue } from "@/lib/data/invalidate";

export async function flushCatalogAction(): Promise<boolean> {
  await requireAdmin();
  return flushCatalogIfDue();
}
