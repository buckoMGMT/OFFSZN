import { useLocation, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PlayDiagram from '@/components/ui/PlayDiagram';
import BrandMark from '@/components/BrandMark';

export default function PageNotFound() {
    const location = useLocation();
    const pageName = location.pathname.substring(1);

    const { data: authData, isFetched } = useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            try {
                const user = await base44.auth.me();
                return { user, isAuthenticated: true };
            } catch {
                return { user: null, isAuthenticated: false };
            }
        }
    });

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
            style={{ background: '#0A0B0D', color: '#F5F5F0' }}>

            <BrandMark size="lg" className="mb-8 opacity-80" />

            <PlayDiagram size={160} className="mb-6" />

            <h1 className="font-anton text-6xl uppercase mb-2" style={{ color: '#F5F5F0' }}>404</h1>
            <p className="font-anton text-xl uppercase mb-1" style={{ color: '#00C853' }}>
                Wrong Route.
            </p>
            <p className="font-work text-sm max-w-xs mb-2" style={{ color: '#848A8F' }}>
                The page <span style={{ color: '#F5F5F0' }}>"{pageName || 'this'}"</span> isn't on the depth chart.
            </p>
            <p className="font-elite text-xs uppercase tracking-widest mb-8" style={{ color: '#848A8F' }}>
                While they scroll, you work.
            </p>

            {isFetched && authData?.isAuthenticated && authData?.user?.role === 'admin' && (
                <div className="mb-6 p-4 rounded border text-left max-w-xs w-full"
                    style={{ background: '#181A1C', borderColor: '#2C2F33' }}>
                    <p className="font-elite text-[9px] uppercase tracking-widest mb-1" style={{ color: '#00C853' }}>Admin Note</p>
                    <p className="font-work text-xs" style={{ color: '#848A8F' }}>
                        This page hasn't been built yet. Ask Base44 to implement it in the chat.
                    </p>
                </div>
            )}

            <Link to="/"
                className="btn-stamp"
                style={{ fontFamily: 'Anton, sans-serif' }}>
                Back to The Field
            </Link>

            <p className="font-elite text-[9px] uppercase tracking-widest mt-10" style={{ color: '#4C5258' }}>
                Made in the OFFSZN.
            </p>
        </div>
    );
}