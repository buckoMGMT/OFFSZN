import React from "react";

export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#0D0D0F' }}>
      {/* Binder rings decoration */}
      <div className="fixed left-0 top-0 bottom-0 w-8 hidden sm:flex flex-col items-center justify-center gap-8 py-12" style={{ borderRight: '1px solid #272729' }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="w-4 h-4 rounded-full border-2" style={{ borderColor: '#5E646B', background: '#0D0D0F' }} />
        ))}
      </div>

      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-block mb-3">
            <span className="font-elite text-xs uppercase tracking-widest" style={{ color: '#5A5D63' }}>PG. 00</span>
          </div>
          <h1 className="font-anton text-4xl uppercase tracking-wide mb-1" style={{ color: '#EDEEF0' }}>
            The Playbook
          </h1>
          <div className="mx-auto my-2" style={{ width: 48, height: 2, background: '#D7263D' }} />
          {title && (
            <p className="font-anton text-lg uppercase tracking-widest mt-3" style={{ color: '#9BA3AC' }}>{title}</p>
          )}
          {subtitle && (
            <p className="font-work text-sm mt-1" style={{ color: '#5A5D63' }}>{subtitle}</p>
          )}
        </div>

        {/* Card */}
        <div className="rounded border p-6" style={{ background: '#1B1B1D', borderColor: '#272729' }}>
          {children}
        </div>

        {footer && (
          <p className="text-center text-sm font-work mt-6" style={{ color: '#5A5D63' }}>{footer}</p>
        )}

        <p className="text-center font-elite text-xs uppercase tracking-widest mt-8" style={{ color: '#272729' }}>
          Playbook Pro · Athletic Performance
        </p>
      </div>
    </div>
  );
}