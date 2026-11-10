"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ds/kit";
import { authInputCls } from "@/components/auth/AuthCard";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { sendReset, type FormState } from "../login/actions";

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(sendReset, {});
  return (
    <>
      {state.notice ? (
        <p className="rounded-[18px] bg-success-soft p-4 text-[17px] text-success">{state.notice}</p>
      ) : (
        <form action={action} className="space-y-4 text-start sm:space-y-5">
          <Field label="אימייל">
            <Input name="email" type="email" dir="ltr" className={`${authInputCls} text-end`} required autoComplete="email" inputMode="email" />
          </Field>
          {state.error && (
            <p role="alert" className="rounded-[18px] bg-destructive-soft p-3.5 text-[16px] text-destructive">
              {state.error}
            </p>
          )}
          <SubmitButton>שליחת קישור</SubmitButton>
        </form>
      )}
      <div className="mt-4 flex justify-center text-[17px] sm:mt-[26px]">
        <Link href="/login" className="flex min-h-12 items-center font-medium text-violet">
          חזרה לכניסה
        </Link>
      </div>
    </>
  );
}
