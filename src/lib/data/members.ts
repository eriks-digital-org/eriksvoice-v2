import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site";
import { sendMail } from "@/lib/notify/mail";

/**
 * Client users. A new user gets a temporary password by email (Hebrew, through Utobo);
 * at the first sign-in they must choose their own (app_metadata.must_change_password,
 * enforced in src/proxy.ts and cleared in /set-password).
 */

export type MemberResult = { ok: true; tempPassword?: string; emailed: boolean } | { ok: false; error: string };

/** 12 characters without look-alikes (no 0/O, 1/l/I). */
export function tempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[randomInt(chars.length)];
  // Always a digit and both cases, so any password rule in Supabase accepts it.
  return `${p.slice(0, 9)}${randomInt(2, 10)}a${"ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)]}`;
}

async function clientName(clientId: string) {
  const { data } = await createAdminClient().from("clients").select("name").eq("id", clientId).maybeSingle();
  return (data?.name as string | undefined) ?? "";
}

function passwordMail(email: string, password: string, business: string, origin: string, reset: boolean, name = "") {
  const subject = reset ? "סיסמה זמנית חדשה ל־EriksVoice" : `הוזמנת ל־EriksVoice${business ? ` של ${business}` : ""}`;
  const text = [
    name ? `שלום ${name},` : "שלום,",
    "",
    reset
      ? "הסיסמה שלך ל־EriksVoice אופסה."
      : `נפתח לך חשבון ב־EriksVoice${business ? `, מערכת הסוכנים הקוליים של ${business}` : ""}.`,
    "",
    `כתובת הכניסה: ${origin}/login`,
    `אימייל: ${email}`,
    `סיסמה זמנית: ${password}`,
    "",
    "בכניסה הראשונה תתבקש/י לבחור סיסמה קבועה משלך.",
    "אם לא ציפית למייל הזה, אפשר להתעלם ממנו.",
  ].join("\n");
  return sendMail([email], subject, text, `${origin}/login`, "כניסה למערכת");
}

/** Adds a user to a client: a new address gets an account with a temporary password. */
export async function inviteMember(clientId: string, email: string, fullName: string): Promise<MemberResult> {
  const db = createAdminClient();
  const address = email.trim().toLowerCase();
  const name = fullName.trim().slice(0, 120);
  const [origin, business] = await Promise.all([siteOrigin(), clientName(clientId)]);

  const { data: existing } = await db.from("profiles").select("id, full_name").eq("email", address).maybeSingle();
  if (existing) {
    if (name && !existing.full_name) await db.from("profiles").update({ full_name: name }).eq("id", existing.id);
    const { error } = await db.from("client_members").upsert({ client_id: clientId, user_id: existing.id });
    if (error) return { ok: false, error: "שיוך המשתמש ללקוח נכשל" };
    const emailed = await sendMail(
      [address],
      `נוספת ל־${business || "לקוח"} ב־EriksVoice`,
      `שלום,\n\nהחשבון שלך ב־EriksVoice קיבל גישה גם ל־${business || "לקוח נוסף"}.\nנכנסים עם האימייל והסיסמה הרגילים.`,
      `${origin}/login`,
      "כניסה למערכת",
    );
    return { ok: true, emailed };
  }

  const password = tempPassword();
  const { data, error } = await db.auth.admin.createUser({
    email: address,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: { must_change_password: true },
  });
  if (error || !data.user) {
    console.error("createUser", error?.code, error?.message);
    return { ok: false, error: error?.code === "email_exists" ? "המייל כבר רשום במערכת" : "יצירת המשתמש נכשלה" };
  }
  const { error: linkError } = await db.from("client_members").upsert({ client_id: clientId, user_id: data.user.id });
  if (linkError) {
    await db.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: "שיוך המשתמש ללקוח נכשל" };
  }
  // The profile row is made by a trigger; the name is set here too in case it ran first.
  if (name) await db.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  const emailed = await passwordMail(address, password, business, origin, false, name);
  return { ok: true, tempPassword: password, emailed };
}

/** A new temporary password for a user (they must change it at the next sign-in). */
export async function resetMemberPassword(userId: string): Promise<MemberResult> {
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("email, full_name, is_admin").eq("id", userId).maybeSingle();
  if (!profile) return { ok: false, error: "המשתמש לא נמצא" };
  if (profile.is_admin) return { ok: false, error: "סיסמה של מנהל מערכת לא מאפסים מכאן" };
  const password = tempPassword();
  const { error } = await db.auth.admin.updateUserById(userId, { password, app_metadata: { must_change_password: true } });
  if (error) return { ok: false, error: "איפוס הסיסמה נכשל" };
  const emailed = await passwordMail(profile.email as string, password, "", await siteOrigin(), true, (profile.full_name as string) ?? "");
  return { ok: true, tempPassword: password, emailed };
}

/** Changes a user's display name ("שלום <שם>"). */
export async function renameMember(userId: string, fullName: string): Promise<MemberResult> {
  const name = fullName.trim().slice(0, 120);
  if (name.length < 2) return { ok: false, error: "שם קצר מדי" };
  const db = createAdminClient();
  const { error } = await db.from("profiles").update({ full_name: name }).eq("id", userId);
  if (error) return { ok: false, error: "שמירת השם נכשלה" };
  await db.auth.admin.updateUserById(userId, { user_metadata: { full_name: name } });
  return { ok: true, emailed: false };
}

/** Takes a user out of one client (the account stays). */
export async function removeMember(clientId: string, userId: string): Promise<MemberResult> {
  const { error } = await createAdminClient().from("client_members").delete().eq("client_id", clientId).eq("user_id", userId);
  return error ? { ok: false, error: "ההסרה נכשלה" } : { ok: true, emailed: false };
}

/** Deletes the account itself (all clients). Never a system admin. */
export async function deleteUser(userId: string): Promise<MemberResult> {
  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (profile?.is_admin) return { ok: false, error: "מנהל מערכת לא נמחק מכאן" };
  const { error } = await db.auth.admin.deleteUser(userId);
  return error ? { ok: false, error: "מחיקת המשתמש נכשלה" } : { ok: true, emailed: false };
}

/** The Hebrew password-reset email for "שכחתי סיסמה" (instead of Supabase's English one). */
export async function sendResetLink(email: string): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) return; // unknown address: same answer to the user
  const origin = await siteOrigin();
  const link = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/set-password`;
  await sendMail(
    [email],
    "בחירת סיסמה חדשה ל־EriksVoice",
    "שלום,\n\nביקשת לבחור סיסמה חדשה ל־EriksVoice. הקישור למטה תקף לזמן קצר.\nאם לא ביקשת, אפשר להתעלם מהמייל.",
    link,
    "לבחירת סיסמה חדשה",
  );
}
