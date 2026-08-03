import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Categorie from './Categorie';
import Portafogli from './Portafogli';
import './Dashboard.css';

const PAGE_TITLES = {
    dashboard: 'Dashboard',
    transazioni: 'Transazioni',
    portafogli: 'Portafogli',
    categorie: 'Categorie',
    report: 'Report',
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activePage, setActivePage] = useState('dashboard');

    // Controllo autenticazione
    useEffect(() => {
        if (!localStorage.getItem('access_token')) {
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    // Adatta sidebar a resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) setSidebarCollapsed(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleMenuClick = (id) => {
        setActivePage(id);
        console.log(`hai premuto il pulsante ${PAGE_TITLES[id] || id}`);
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('rememberEmail');
        navigate('/login', { replace: true });
    };

    const toggleSidebar = () => {
        if (window.innerWidth < 768) {
            setMobileOpen(!mobileOpen);
        } else {
            setSidebarCollapsed(!sidebarCollapsed);
        }
    };

    const renderPage = () => {
        switch (activePage) {
            case 'categorie':  return <Categorie />;
            case 'portafogli': return <Portafogli />;
            case 'transazioni': // fallthrough: non ancora implementate
            case 'report':
            case 'dashboard':
            default:
                return <DashboardHome />;
        }
    };

    return (
        <div className="dashboard-layout">
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={toggleSidebar}
                onMenuClick={handleMenuClick}
                onLogout={handleLogout}
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
                activePage={activePage}
            />

            <main className={`dashboard-main ${sidebarCollapsed && !mobileOpen ? 'expanded' : ''}`}>
                <header className="dashboard-header">
                    <div className="header-left">
                        {window.innerWidth < 768 && (
                            <button className="hamburger-btn" onClick={() => setMobileOpen(true)}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 12h18M3 6h18M3 18h18"/>
                                </svg>
                            </button>
                        )}
                        <h2>{PAGE_TITLES[activePage] || 'Dashboard'}</h2>
                    </div>
                    <span className="dashboard-month">
                        {new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' })
                            .replace(/^\w/, c => c.toUpperCase())}
                    </span>
                </header>

                <div className="dashboard-content">
                    {renderPage()}
                </div>
            </main>

            {/* FAB visibile solo su Dashboard e Transazioni */}
            {(activePage === 'dashboard' || activePage === 'transazioni') && (
                <button className="fab" onClick={() => alert('hai premuto il pulsante Nuova Transazione')} title="Nuova Transazione">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                </button>
            )}
        </div>
    );
};

/* Componente Home Dashboard (quella originale) */
const DashboardHome = () => {
    const mese = new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' })
        .replace(/^\w/, c => c.toUpperCase());
    return (
        <>
            <div className="summary-cards">
                <div className="summary-card">
                    <span className="summary-label">Spese del mese</span>
                    <span className="summary-value">-- €</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">Entrate del mese</span>
                    <span className="summary-value">-- €</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">Saldo</span>
                    <span className="summary-value">-- €</span>
                </div>
            </div>
            <div className="dashboard-placeholder">
                <div className="placeholder-icon">📊</div>
                <p>Le transazioni di {mese} appariranno qui.</p>
                <p className="placeholder-hint">
                    Usa il pulsante <strong>+</strong> in basso a destra per aggiungere una nuova spesa.
                </p>
            </div>
        </>
    );
};

export default Dashboard;
