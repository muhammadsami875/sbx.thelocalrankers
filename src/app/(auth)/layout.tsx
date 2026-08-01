import Image from "next/image";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <BrandLogo className="mb-10 h-11" priority />
          {children}
        </div>
      </div>

      {/* Brand side — hidden on small screens where it would just push content */}
      <div className="relative hidden overflow-hidden bg-brand-navy lg:block">
        <Image
          src="/images/brand-hero-glow.png"
          alt=""
          aria-hidden
          fill
          priority
          className="object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-12">
          <h2 className="font-display text-3xl font-semibold leading-tight text-white">
            Every client, campaign and invoice
            <span className="brand-gradient-text"> in one place.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            The operations platform behind Local Rankers LLC — local SEO,
            Google Ads, web design and social, tracked end to end.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/15 pt-8">
            {[
              { value: "500+", label: "Businesses ranked" },
              { value: "5.0", label: "Average rating" },
              { value: "12", label: "Team roles" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="font-display text-2xl font-semibold text-white">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-xs text-white/60">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
