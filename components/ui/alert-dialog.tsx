"use client";

import type { ComponentProps } from "react";
import { AlertDialog as Dialog } from "radix-ui";
import { twMerge } from "tailwind-merge";

export const AlertDialog = Dialog.Root;
export const AlertDialogTrigger = Dialog.Trigger;

export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content
        className={twMerge(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-border bg-background p-6 text-foreground shadow-lg",
          className
        )}
        {...props}
      />
    </Dialog.Portal>
  );
}

export function AlertDialogHeader({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={twMerge("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={twMerge(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={twMerge("text-lg font-semibold", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof Dialog.Description>) {
  return (
    <Dialog.Description
      className={twMerge("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

const buttonStyle =
  "inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

export function AlertDialogAction({
  className,
  ...props
}: ComponentProps<typeof Dialog.Action>) {
  return (
    <Dialog.Action
      className={twMerge(
        buttonStyle,
        "bg-primary text-primary-foreground hover:bg-primary/90",
        className
      )}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof Dialog.Cancel>) {
  return (
    <Dialog.Cancel
      className={twMerge(
        buttonStyle,
        "border border-input bg-background hover:bg-accent",
        className
      )}
      {...props}
    />
  );
}
