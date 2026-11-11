import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * Orchid City input: a solid shade, no border (2px corners allowed for inputs).
 * surface-hover reads on both the page (bg) and panels/dialogs (surface).
 * Focus lifts it with the kit's shadow; errors tint it with danger.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-ink placeholder:text-muted selection:bg-primary selection:text-on-primary flex h-10 w-full min-w-0 rounded-sm bg-surface-hover text-ink px-3 py-1 text-base transition-[background-color,box-shadow] duration-(--dur-fast) outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:bg-surface focus-visible:shadow-lift",
        "aria-invalid:bg-danger/10 aria-invalid:text-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
