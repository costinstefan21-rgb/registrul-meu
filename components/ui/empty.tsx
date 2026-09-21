import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export function Empty({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={twMerge(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-border p-6 text-center md:p-12",
        className
      )}
      {...props}
    />
  );
}

export function EmptyHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={twMerge(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className
      )}
      {...props}
    />
  );
}

export function EmptyMedia({
  className,
  variant = "default",
  ...props
}: ComponentProps<"div"> & {
  variant?: "default" | "icon";
}) {
  return (
    <div
      className={twMerge(
        "mb-2 flex shrink-0 items-center justify-center",
        variant === "icon" &&
          "size-12 rounded-lg bg-muted text-foreground [&_svg]:size-6",
        className
      )}
      {...props}
    />
  );
}

export function EmptyTitle({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={twMerge("text-lg font-medium tracking-tight", className)}
      {...props}
    />
  );
}

export function EmptyDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={twMerge(
        "text-sm leading-relaxed text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function EmptyContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={twMerge(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm",
        className
      )}
      {...props}
    />
  );
}
