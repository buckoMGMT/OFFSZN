import { Link } from 'react-router-dom';
import PlayDiagram from '@/components/ui/PlayDiagram';
import BrandMark from '@/components/BrandMark';

// Branded dead-route screen. No platform references — this is OFFSZN's house.
export default function PageNotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
            style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}>

            <BrandMark size="lg" className="mb-8 opacity-80" />

            <PlayDiagram size={160} className="mb-6" />

            <h1 className="font-anton text-6xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>404</h1>
            <p className="font-anton text-xl uppercase mb-1" style={{ color: 'var(--accent)' }}>
                Wrong Route.
            </p>
            <p className="font-work text-sm max-w-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                This play isn't on the depth chart.
            </p>
            <p className="font-elite text-xs uppercase tracking-widest mb-8" style={{ color: 'var(--text-tertiary)' }}>
                While they scroll, you work.
            </p>

            <Link to="/" className="btn-primary">
                Back to The Field
            </Link>

            <p className="font-elite text-[9px] uppercase tracking-widest mt-10" style={{ color: 'var(--text-tertiary)' }}>
                Made in the OFFSZN.
            </p>
        </div>
    );
}