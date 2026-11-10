"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ds/kit";
import { authInputCls } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { signIn, type FormState } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, { error: initialError });
  return (
    <>
      <form action={action} className="space-y-4 text-start sm:space-y-5">
        <input type="hidden" name="next" value={next} />
        <Field label="אימייל">
          <Input name="email" type="email" dir="ltr" className={`${authInputCls} text-end`} required autoComplete="email" inputMode="email" />
        </Field>
        <Field label="סיסמה">
          <Input name="password" type="password" dir="ltr" className={`${authInputCls} text-end`} required autoComplete="current-password" />
        </Field>
        {state.error && (
          <p role="alert" className="rounded-[18px] bg-destructive-soft p-3.5 text-[16px] text-destructive">
            {state.error}
          </p>
        )}
        <SubmitButton>כניסה</SubmitButton>
      </form>
      <div className="mt-4 flex justify-center text-[17px] sm:mt-[26px]">
        <Link href="/forgot-password" className="flex min-h-12 items-center font-medium text-violet">
          שכחתי סיסמה
        </Link>
      </div>
    </>
  );
}
