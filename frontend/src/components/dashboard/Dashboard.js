import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import Sidebar from './Sidebar';
import Categorie from './Categorie';
import Portafogli from './Portafogli';
import Transazioni from './Transazioni';
import Impostazioni from './Impostazioni';
import Notifiche from './Notifiche';
import './Dashboard.css';

const PAGE_TITLES = {
    dashboard: 'Dashboard', transazioni: 'Transazioni',
    portafogli: 'Portafogli', categorie: 'Categorie', report: 'Report',
    impostazioni: 'Impostazioni', notifiche: 'Notifiche',
};

const TIPI_ICONE = { spesa: '💸', guadagno: '💰', trasferimento: '🔄' };

const Dashboard = () => {
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activePage, setActivePage] = useState('dashboard');
    const [nonLette, setNonLette] = useState(0);

    useEffect(() => {
        if (!localStorage.getItem('access_token')) navigate('/login', { replace: true });
    }, [navigate]);

    // Carica il numero di notifiche non lette
    const caricaNonLette = useCallback(async () => {
        try {
            const res = await api.get('/api/notifiche/');
            setNonLette(res.data.non_lette || 0);
        } catch {}
    }, []);

    useEffect(() => { caricaNonLette(); }, [caricaNonLette]);

    useEffect(() => {
        const h = () => { if (window.innerWidth < 768) setSidebarCollapsed(true); };
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
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
        if (window.innerWidth < 768) setMobileOpen(!mobileOpen);
        else setSidebarCollapsed(!sidebarCollapsed);
    };

    const renderPage = () => {
        switch (activePage) {
            case 'categorie':     return <Categorie />;
            case 'portafogli':    return <Portafogli />;
            case 'transazioni':   return <Transazioni />;
            case 'impostazioni':  return <Impostazioni />;
            case 'notifiche':     return <Notifiche onCambio={setNonLette} />;
            case 'dashboard':
            default:              return <DashboardHome />;
        }
    };

    return (
        <div className="dashboard-layout">
            <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar}
                onMenuClick={handleMenuClick} onLogout={handleLogout}
                mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)}
                activePage={activePage} />
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
                        {new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                    </span>
                    <button className="notif-bell" onClick={() => setActivePage('notifiche')} title="Notifiche">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                        {nonLette > 0 && <span className="notif-badge">{nonLette > 9 ? '9+' : nonLette}</span>}
                    </button>
                </header>
                <div className="dashboard-content">{renderPage()}</div>
            </main>
            {activePage === 'dashboard' && <QuickAddFAB />}
        </div>
    );
};

/* Quick Add FAB + Modal */
const QuickAddFAB = () => {
    const [open, setOpen] = useState(false);
    const [portafogli, setPortafogli] = useState([]);
    const [categorie, setCategorie] = useState([]);
    const [tipo, setTipo] = useState('spesa');
    const [pfId, setPfId] = useState('');
    const [catId, setCatId] = useState('');
    const [importo, setImporto] = useState('');
    const [desc, setDesc] = useState('');
    const [msg, setMsg] = useState('');

    const apri = async () => {
        try {
            const [rpf, rcat] = await Promise.all([
                api.get('/api/portafogli/'), api.get('/api/categorie/'),
            ]);
            setPortafogli(rpf.data); setCategorie(rcat.data);
            if (rpf.data.length > 0) setPfId(String(rpf.data[0].id_portafoglio));
            const catF = rcat.data.filter(c => c.tipo === 'spesa');
            if (catF.length > 0) setCatId(String(catF[0].id_categoria));
            setOpen(true);
        } catch { setMsg('Errore caricamento dati'); }
    };

    const chiudi = () => { setOpen(false); setMsg(''); setImporto(''); setDesc(''); };

    const invia = async (e) => {
        e.preventDefault();
        if (!pfId || !catId || !importo) return;
        try {
            await api.post('/api/transazioni/', {
                id_portafoglio: parseInt(pfId), id_categoria: parseInt(catId),
                tipo, importo: parseFloat(importo), descrizione: desc.trim(),
            });
            chiudi(); window.location.reload();
        } catch (err) { setMsg(err.response?.data?.detail || 'Errore'); }
    };

    const catFiltrate = categorie.filter(c => c.tipo === tipo);

    return (
        <>
            <button className="fab" onClick={apri} title="Nuova Transazione">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
            </button>
            {open && (
                <div className="modal-overlay" onClick={chiudi}>
                    <div className="quickadd-modal" onClick={e => e.stopPropagation()}>
                        <h3>Nuova Transazione</h3>
                        <form onSubmit={invia} className="quickadd-form">
                            <div className="quickadd-tabs">
                                {['spesa','guadagno'].map(t => (
                                    <button key={t} type="button"
                                        className={`quickadd-tab ${tipo===t?'active':''}`}
                                        onClick={() => { setTipo(t); const cf=categorie.filter(c=>c.tipo===t); if(cf.length)setCatId(String(cf[0].id_categoria)); }}>
                                        {TIPI_ICONE[t]} {t==='spesa'?'Spesa':'Guadagno'}
                                    </button>
                                ))}
                            </div>
                            <select value={pfId} onChange={e => setPfId(e.target.value)} required>
                                {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                            </select>
                            <select value={catId} onChange={e => setCatId(e.target.value)} required>
                                {catFiltrate.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nome}</option>)}
                            </select>
                            <input type="number" placeholder="Importo" value={importo}
                                onChange={e => setImporto(e.target.value)} step="0.01" min="0.01" required />
                            <input type="text" placeholder="Descrizione (opzionale)" value={desc}
                                onChange={e => setDesc(e.target.value)} maxLength={200} />
                            <div className="quickadd-actions">
                                <button type="button" className="modal-btn modal-btn-cancel" onClick={chiudi}>Annulla</button>
                                <button type="submit" className="modal-btn modal-btn-primary">Aggiungi</button>
                            </div>
                            {msg && <p className="quickadd-msg">{msg}</p>}
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

/* Dashboard Home */
const DashboardHome = () => {
    const [saldo, setSaldo] = useState(null);
    const [transazioni, setTransazioni] = useState([]);
    const [loading, setLoading] = useState(true);
    const meseCorrente = new Date().toISOString().slice(0, 7);

    const carica = useCallback(async () => {
        try {
            const [rSaldo, rTrans] = await Promise.all([
                api.get('/api/portafogli/saldo'),
                api.get(`/api/transazioni/?mese=${meseCorrente}&limit=200`),
            ]);
            setSaldo(rSaldo.data.saldo);
            setTransazioni(rTrans.data);
        } catch {} finally { setLoading(false); }
    }, [meseCorrente]);

    useEffect(() => { carica(); }, [carica]);

    const spese = transazioni.filter(t => t.tipo === 'spesa').reduce((a,t) => a + t.importo, 0);
    const entrate = transazioni.filter(t => t.tipo === 'guadagno').reduce((a,t) => a + t.importo, 0);

    if (loading) return <p className="dash-loading">Caricamento...</p>;

    return (
        <>
            <div className="summary-cards">
                <div className="summary-card">
                    <span className="summary-label">Spese del mese</span>
                    <span className="summary-value expense">{spese.toFixed(2)} €</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">Entrate del mese</span>
                    <span className="summary-value income">{entrate.toFixed(2)} €</span>
                </div>
                <div className="summary-card saldo-card">
                    <span className="summary-label">Saldo</span>
                    <span className={`summary-value ${(saldo||0) >= 0 ? 'income' : 'expense'}`}>
                        {saldo !== null ? saldo.toFixed(2) : '--'} €
                    </span>
                </div>
            </div>
            {transazioni.length === 0 ? (
                <div className="dashboard-placeholder">
                    <div className="placeholder-icon">📊</div>
                    <p>Nessuna transazione a {new Date().toLocaleString('it-IT', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}.</p>
                    <p className="placeholder-hint">Usa il pulsante <strong>+</strong> per aggiungerne una.</p>
                </div>
            ) : (
                <ul className="transazioni-list dash-trans-list">
                    {transazioni.map(t => (
                        <li key={t.id_transazione} className="transazioni-item">
                            <span className="tr-icon">{TIPI_ICONE[t.tipo] || '💳'}</span>
                            <div className="tr-info">
                                <span className="tr-desc">{t.descrizione || (t.tipo==='spesa'?'Spesa':'Guadagno')}</span>
                                <span className="tr-meta">{t.nome_portafoglio} · {t.nome_categoria}</span>
                            </div>
                            <span className={`tr-importo ${t.tipo==='guadagno'?'tr-importo-positivo':'tr-importo-negativo'}`}>
                                {t.tipo==='guadagno'?'+':'-'}{parseFloat(t.importo).toFixed(2)} €
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
};

export default Dashboard;