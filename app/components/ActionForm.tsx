"use client";
import { useRef, useState, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

export function ActionForm({
  action,
  children,
  confirm,
  success,
  className,
  onSuccess,
}: {
  action: (
    form: FormData,
  ) => Promise<void | { error?: string; message?: string; status?: string }>;
  children: ReactNode;
  confirm?: string;
  success?: string;
  className?: string;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const [error, setError] = useState("");
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(event) => {
        if (confirm && !confirmed.current) {
          event.preventDefault();
          dialog.current?.showModal();
        }
      }}
      action={async (form) => {
        setError("");
        try {
          const result = await action(form);
          const problem =
            result?.error ||
            (result?.status === "error" ? result.message : undefined);
          if (problem) {
            setError(problem);
            toast({
              title: "Couldn’t save changes",
              description: problem,
              variant: "destructive",
            });
            return;
          }
          const details = ref.current?.closest("details");
          if (details && !details.classList.contains("thread"))
            details.open = false;
          if (result?.message || success)
            toast({ title: result?.message || success });
          onSuccess?.();
        } catch (error) {
          unstable_rethrow(error);
          setError(
            "Check your input and access, then try again. Your draft is kept.",
          );
          toast({
            title: "Couldn’t save changes",
            description:
              "Check your input and access, then try again. Your draft is kept.",
            variant: "destructive",
          });
        } finally {
          confirmed.current = false;
        }
      }}
    >
      {children}
      {error && (
        <p
          role="alert"
          className="mt-2 max-w-sm rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive dark:text-red-300"
        >
          {error}
        </p>
      )}
      {confirm && (
        <dialog
          ref={dialog}
          aria-label="Confirm action"
          className="max-w-sm rounded border bg-background p-5 text-foreground backdrop:bg-black/60"
        >
          <p>{confirm}</p>
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded bg-destructive px-3 py-2 text-destructive-foreground"
              onClick={() => {
                confirmed.current = true;
                dialog.current?.close();
                ref.current?.requestSubmit();
              }}
            >
              Confirm
            </button>
          </div>
        </dialog>
      )}
    </form>
  );
}
