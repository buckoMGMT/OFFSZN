import React from "react";
import BrandMark from "@/components/BrandMark";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 stadium-light"
         style={{ background: 'var(--surface-0)', paddingTop: 'calc(3rem + env(safe-area-inset-top))', paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <BrandMark size="lg" />
          </div>
          {title && (
            <h1 className="font-anton text-4xl uppercase" style={{ color: 'var(--text-primary)' }}>{title}</h1>
          )}
          <div className="mx-auto my-3" style={{ width: 48, height: 3, background: 'var(--accent)', borderRadius: 'var(--r-full)' }} />
          {subtitle && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
          )}
        </div>

        {/* Card */}
        <div className="card-base p-6">
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-secondary)' }}>{footer}</p>
        )}

        <p className="text-center eyebrow mt-8">It's not the off-season. It's OFFSZN.</p>
      </div>
    </div>
  );
}