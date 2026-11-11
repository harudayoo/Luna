import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { ocsRef, type OcsEffect } from "@/lib/ocs"
import { cn } from "@/lib/utils"

/*
 * Orchid City buttons (resources/ocs/guides/Button.md): solid, square, no outline.
 * shadcn's variant names are kept so existing callers work:
 *   default     -> .ocs-btn-primary   (one per view)       magnetic squish
 *   secondary   -> .ocs-btn-secondary                      wave squish
 *   outline     -> same as secondary (there are no outlines in the kit)
 *   code        -> .ocs-btn-code      (Run, Sync, Export)  decode squish
 *   accent      -> .ocs-btn-accent    (rare brand moments) squish
 *   destructive -> danger fill                             squish
 *   ghost, link -> plain, no effects (menus, inline links)
 */
const buttonVariants = cva(
  "ocs-btn whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 aria-invalid:text-danger",
  {
    variants: {
      variant: {
        default: "ocs-btn-primary",
        secondary: "ocs-btn-secondary",
        outline: "ocs-btn-secondary",
        code: "ocs-btn-code",
        accent: "ocs-btn-accent",
        destructive: "bg-danger text-bg hover:bg-danger/90",
        ghost: "bg-transparent text-ink hover:bg-surface-hover hover:shadow-none focus-visible:shadow-none focus-visible:bg-surface-hover",
        link: "min-h-0 bg-transparent p-0 text-primary underline-offset-4 hover:underline hover:shadow-none",
      },
      // Every size keeps the 40px tap target from the kit.
      size: {
        default: "",
        sm: "px-3",
        lg: "px-6",
        icon: "ocs-icon-btn",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type Variant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

const EFFECTS: Record<Variant, OcsEffect[]> = {
  default: ["magnetic", "squish"],
  secondary: ["wave", "squish"],
  outline: ["wave", "squish"],
  code: ["decode", "squish"],
  accent: ["squish"],
  destructive: ["squish"],
  ghost: [],
  link: [],
}

// wave and decode rewrite the label's text, so they only run on a fixed plain-text label.
const TEXT_EFFECTS: OcsEffect[] = ["wave", "decode"]

function Button({
  className,
  variant,
  size,
  asChild = false,
  fx,
  children,
  ref,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Override the kit effects for this button; [] turns them off. */
    fx?: OcsEffect[]
  }) {
  const Comp = asChild ? Slot : "button"
  const plainText = typeof children === "string"
  const effects = (fx ?? EFFECTS[variant ?? "default"]).filter((e) =>
    // asChild renders the caller's element (e.g. a Link) whose children we don't own:
    // only the press effect, which touches nothing inside it.
    asChild ? e === "squish" : plainText || !TEXT_EFFECTS.includes(e)
  )
  const attach = ocsRef(effects)

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      ref={(el: HTMLButtonElement | null) => {
        attach(el)
        if (typeof ref === "function") ref(el)
        else if (ref) ref.current = el
      }}
    >
      {/* The kit animates .ocs-btn-label; rendering it here keeps the kit from moving React's nodes.
          The gap is only for icon + text: wave splits a plain-text label into one span per letter. */}
      {asChild ? children : (
        <span className={plainText ? "ocs-btn-label" : "ocs-btn-label items-center gap-2"}>{children}</span>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
