"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ds/kit";
import { authInputCls } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { createClient } from "@/lib/supabase/client";
import { changePasswordAction } from "./actions";

/**
 * Choose a password: at the first sign-in with a temporary password (required, see
 * src/proxy.ts), or after a reset link. The link opens a session (/auth/confirm), or
 * brings it in the address fragment (#access_token=…); all end here.
 */
export function SetPasswordForm({ signedIn }: { signedIn: boolean }) {
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">(signedIn ? "ok" : "checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (signedIn) return;
    // Only an old-style link brings the session in the address (#access_token=…).
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    const supabase = createClient();
    (async () => {
      if (!access_token || !refresh_token) return setReady("no-session");
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      history.replaceState(null, "", window.location.pathname);
      // From here the server owns the session; a refresh in this tab would race it.
      await supabase.auth.stopAutoRefresh();
      setReady(error ? "no-session" : "ok");
    })();
  }, [signedIn]);

  async function submit(form: FormData) {
    const password = String(form.get("password") ?? "");
    const again = String(form.get("again") ?? "");
    setError(null);
    if (password.length < 8) return setError("הסיסמה צריכה להכיל לפחות 8 תווים.");
    if (password !== again) return setError("הסיסמאות לא זהות.");
    setBusy(true);
    // On success the action redirects to the user's home.
    const { error } = await changePasswordAction(password);
    setBusy(false);
    if (error) setError(error);
  }

  if (ready === "checking") return <p className="text-[17px] text-ink-muted">רגע…</p>;
  if (ready === "no-session")
    return (
      <div className="space-y-4">
        <p className="rounded-[18px] bg-warning-soft p-4 text-[17px] text-warning">הקישור כבר לא בתוקף, או שנפתח בדפדפן אחר.</p>
        <Link href="/forgot-password" className="flex min-h-12 items-center justify-center font-medium text-violet">
          לבקשת קישור חדש
        </Link>
      </div>
    );
  return (
    <form action={submit} className="space-y-4 text-start sm:space-y-5">
      <Field label="סיסמה חדשה" hint="לפחות 8 תווים">
        <Input name="password" type="password" dir="ltr" className={`${authInputCls} text-end`} required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="שוב, לאימות">
        <Input name="again" type="password" dir="ltr" className={`${authInputCls} text-end`} required minLength={8} autoComplete="new-password" />
      </Field>
      {error && (
        <p role="alert" className="rounded-[18px] bg-destructive-soft p-3.5 text-[16px] text-destructive">
          {error}
        </p>
      )}
      <SubmitButton pending={busy}>שמירה וכניסה</SubmitButton>
    </form>
  );
}
