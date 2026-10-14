"use client";
import type { ComponentProps } from "react";

/** Değiştiğinde bulunduğu formu hemen gönderen select ("Filtrele"ye basmaya gerek kalmaz). */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
