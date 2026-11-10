import Link from "next/link";
import { characters } from "@/components/agents/characters";

/** The calm sign-in card with the four characters peeking over it. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const crew = [characters.leads, characters.sales, characters.service, characters.support];
  return (
    <main
      className="relative flex min-h-screen flex-col items-center px-5 sm:justify-center sm:px-10 sm:py-10"
      style={{
        paddingTop: "calc(36px + env(safe-area-inset-top))",
        paddingBottom: "calc(28px + env(safe-area-inset-bottom))",
      }}
    >
      <div className="calm-blobs" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="relative z-[1] flex w-full flex-col items-center">
        <Link href="/" aria-label="EriksVoice, דף הבית">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/eriksvoice-logo.webp" alt="EriksVoice" width={215} height={40} className="mb-[26px] h-8 w-auto sm:mb-[34px] sm:h-10" />
        </Link>
        <div className="relative z-[2] -mb-[26px] flex gap-0.5 sm:-mb-[34px] sm:gap-1.5" aria-hidden>
          {crew.map((c) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={c.key} src={c.smile} alt="" width={104} height={104} className="size-[76px] object-contain sm:size-[104px]" />
          ))}
        </div>
        <section className="calm-card relative z-[1] w-full max-w-[520px] px-[22px] pb-7 pt-11 text-center sm:px-[52px] sm:pb-11 sm:pt-[66px]">
          <h1 className="text-[32px] font-medium leading-[1.15] text-ink sm:text-[44px]">{title}</h1>
          <p className="mb-[26px] mt-2 text-[17px] text-ink-muted sm:mb-[34px] sm:mt-2.5 sm:text-xl">{subtitle}</p>
          {children}
        </section>
      </div>
    </main>
  );
}

export const authInputCls = "h-[58px] rounded-[18px] px-[18px] text-[17px] sm:h-16 sm:px-[22px] sm:text-xl";
