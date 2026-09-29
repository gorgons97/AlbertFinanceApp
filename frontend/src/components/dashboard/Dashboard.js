import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import supabase from '../../supabase';
import Sidebar from './Sidebar';
import Categorie from './Categorie';
import Portafogli from './Portafogli';
import Transazioni from './Transazioni';
import Report from './Report';
import Impostazioni from './Impostazioni';
import Notifiche from './Notifiche';
import './Dashboard.css';

const PAGE_TITLES = {
    dashboard: 'Dashboard', 
    transazioni: 'Transazioni',
    portafogli: 'Portafogli', 
    categorie: 'Categorie', 
    report: 'Report',
    impostazioni: 'Impostazioni', 
    notifiche: 'Notifiche',
};

const TIPI_ICONE = { spesa: '💸', guadagno: '💰', trasferimento: '🔄' };

const Dashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [activePage, setActivePage] = useState('dashboard');
    const [nonLette, setNonLette] = useState(0);
    const [authReady, setAuthReady] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                // 1. Controlla prima se c'è un token legacy nel localStorage
                 // const legacyToken = localStorage.getItem('access_token');
                
                // 2. Attendi un momento se c'è un parametro OAuth nell'URL (per dare tempo a Supabase di elaborarlo)
                const isOAuthCallback = window.location.hash.includes('access_token') || window.location.search.includes('code=');
                
                let session = null;
                
                if (isOAuthCallback) {
                    // Attendi che Supabase completi lo scambio del codice PKCE o l'estrazione dell'hash
                    session = await new Promise(resolve => {
                        const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
                            if (sess?.access_token) {
                                sub?.subscription?.unsubscribe();
                                resolve(sess);
                            }
                        });
                        // Fallback: controlla getSession() direttamente dopo un breve ritardo se l'evento è già scattato
                        setTimeout(async () => {
                            sub?.subscription?.unsubscribe();
                            const { data } = await supabase.auth.getSession();
                            resolve(data.session);
                        }, 2500);
                    });
                } else {
                    const { data } = await supabase.auth.getSession();
                    session = data.session;
                }

                let activeToken = session?.access_token;

                // Se c'è una sessione Supabase attiva, ESSA HA SEMPRE LA PRECEDENZA!
                if (activeToken) {
                    localStorage.setItem('access_token', activeToken);
                    await api.get('/api/auth/me');
                    if (window.location.hash) {
                        window.history.replaceState(null, '', window.location.pathname);
                    }
                    if (isMounted) setAuthReady(true);
                    return;
                }

                // 2. Solo se NON c'è alcuna sessione Supabase attiva, controlla eventuale token salvato in localStorage
                const token = localStorage.getItem('access_token');
                if (token) {
                    try {
                        await api.get('/api/auth/me');
                        if (isMounted) setAuthReady(true);
                        return;
                    } catch {
                        localStorage.removeItem('access_token');
                    }
                }

                // Nessuna sessione valida
                navigate('/login', { replace: true });
            } catch (err) {
                console.error("Errore autenticazione dashboard:", err);
                localStorage.removeItem('access_token');
                navigate('/login', { replace: true });
            }
        };

        checkAuth();
        return () => { isMounted = false; };
    }, [navigate]);

    // Carica il numero di notifiche non lette solo quando l'autenticazione è confermata
    const caricaNonLette = useCallback(async () => {
        if (!authReady) return;
        try {
            const res = await api.get('/api/notifiche/');
            setNonLette(res.data.non_lette || 0);
        } catch {}
    }, [authReady]);

    useEffect(() => {
        if (authReady) {
            caricaNonLette();
        }
    }, [authReady, caricaNonLette]);

    useEffect(() => {
        const h = () => { if (window.innerWidth < 768) setSidebarCollapsed(true); };
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const handleMenuClick = (id) => {
        setActivePage(id);
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch {}
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
            case 'report':        return <Report />;
            case 'impostazioni':  return <Impostazioni onLogout={handleLogout} />;
            case 'notifiche':     return <Notifiche onCambio={setNonLette} />;
            case 'dashboard':
            default:              return <DashboardHome />;
        }
    };

    // Schermata di caricamento finché la sessione e l'utente non sono agganciati con certezza
    if (!authReady) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                <div style={{ width: '42px', height: '42px', border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                <p style={{ marginTop: '16px', color: '#64748b', fontSize: '1rem', fontWeight: '500' }}>{t('Caricamento sessione...')}</p>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

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
                        <h2>{t(PAGE_TITLES[activePage] || 'Dashboard')}</h2>
                    </div>
                    <span className="dashboard-month">
                        {new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                    </span>
                    <button className="notif-bell" onClick={() => setActivePage('notifiche')} title={t('Notifiche')}>
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
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [portafogli, setPortafogli] = useState([]);
    const [categorie, setCategorie] = useState([]);
    const [tipo, setTipo] = useState('spesa');
    const [pfId, setPfId] = useState('');
    const [pfIdDest, setPfIdDest] = useState('');   // portafoglio destinazione (solo per trasferimenti)
    const [catId, setCatId] = useState('');
    const [importo, setImporto] = useState('');
    const [data, setData] = useState(() => new Date().toISOString().split('T')[0]);
    const [desc, setDesc] = useState('');
    const [msg, setMsg] = useState('');

    const apri = async () => {
        try {
            const [rpf, rcat] = await Promise.all([
                api.get('/api/portafogli/'),
                api.get('/api/categorie/'),
            ]);
            setPortafogli(rpf.data);
            setCategorie(rcat.data);
            if (rpf.data.length > 0) {
                setPfId(String(rpf.data[0].id_portafoglio));
                // Per destinazione, se c'è un secondo portafoglio lo usiamo, altrimenti ripetiamo il primo
                const dest = rpf.data.length > 1 ? rpf.data[1] : rpf.data[0];
                setPfIdDest(String(dest.id_portafoglio));
            }
            // Imposta categoria predefinita in base al tipo
            const catF = rcat.data.filter(c => c.tipo === 'spesa');
            if (catF.length > 0) setCatId(String(catF[0].id_categoria));
            setOpen(true);
        } catch { setMsg(t('Errore caricamento dati')); }
    };

    const chiudi = () => { setOpen(false); setMsg(''); setImporto(''); setData(''); setDesc(''); };

    const invia = async (e) => {
        e.preventDefault();
        if (!pfId || !importo) return;

        // Per i trasferimenti gestiamo due transazioni
        if (tipo === 'trasferimento') {
            if (!pfIdDest) {
                setMsg(t('Seleziona il portafoglio di destinazione'));
                return;
            }
            // Cerchiamo una categoria di spesa e una di guadagno
            const catSpesa = categorie.find(c => c.tipo === 'spesa');
            const catGuadagno = categorie.find(c => c.tipo === 'guadagno');
            if (!catSpesa || !catGuadagno) {
                setMsg(t('Categorie per trasferimento non trovate'));
                return;
            }
            try {
                // Crea la transazione di trasferimento 
                await api.post('/api/transazioni/trasferimento', {
                    id_portafoglio_origine: parseInt(pfId),
                    id_portafoglio_destinazione: parseInt(pfIdDest),
                    importo: parseFloat(importo),
                    data_transazione: data,  
                    descrizione: desc.trim() || t('Trasferimento'),
                });
                chiudi();
                window.location.reload();
            } catch (err) {
                setMsg(err.response?.data?.detail || t('Errore durante il trasferimento'));
            }
            return;
        }

        // Per spesa/guadagno normale
        if (!catId) return;
        try {
            await api.post('/api/transazioni/', {
                id_portafoglio: parseInt(pfId),
                id_categoria: parseInt(catId),
                tipo,
                importo: parseFloat(importo),
                data_transazione: data,  
                descrizione: desc.trim(),
            });
            chiudi();
            window.location.reload();
        } catch (err) {
            setMsg(err.response?.data?.detail || t('Errore'));
        }
    };

    const catFiltrate = categorie.filter(c => c.tipo === tipo);

    return (
        <>
            <button className="fab" onClick={apri} title={t('Nuova Transazione')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
            </button>
            {open && (
                <div className="modal-overlay" onClick={chiudi}>
                    <div className="quickadd-modal" onClick={e => e.stopPropagation()}>
                        <h3>{t('Nuova Transazione')}</h3>
                        <form onSubmit={invia} className="quickadd-form">
                            <div className="quickadd-tabs">
                                {['spesa','guadagno','trasferimento'].map(tipoItem => (
                                    <button key={tipoItem} type="button"
                                        className={`quickadd-tab ${tipo===tipoItem?'active':''}`}
                                        onClick={() => {
                                            setTipo(tipoItem);
                                            // Quando cambio tipo, resetta i selettori se necessario
                                            if (tipoItem === 'trasferimento') {
                                                // Non serve categoria, ma manteniamo i portafogli
                                            } else {
                                                // Ripristina categoria filtrata
                                                const cf = categorie.filter(c => c.tipo === tipoItem);
                                                if (cf.length) setCatId(String(cf[0].id_categoria));
                                            }
                                        }}>
                                        {TIPI_ICONE[tipoItem] || '💳'} {tipoItem==='spesa' ? t('Spesa') : tipoItem==='guadagno' ? t('Guadagno') : t('Trasferimento')}
                                    </button>
                                ))}
                            </div>

                            {/* Selezioni portafogli */}
                            {tipo === 'trasferimento' ? (
                                <>
                                    <select value={pfId} onChange={e => setPfId(e.target.value)} required>
                                        {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                                    </select>
                                    <select value={pfIdDest} onChange={e => setPfIdDest(e.target.value)} required>
                                        {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                                    </select>
                                </>
                            ) : (
                                <select value={pfId} onChange={e => setPfId(e.target.value)} required>
                                    {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                                </select>
                            )}

                            {/* Selezione categoria (solo per spesa/guadagno) */}
                            {tipo !== 'trasferimento' && (
                                <select value={catId} onChange={e => setCatId(e.target.value)} required>
                                    {catFiltrate.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nome}</option>)}
                                </select>
                            )}

                            <input type="number" placeholder={t('Importo')} value={importo}
                                onChange={e => setImporto(e.target.value)} step="0.01" min="0.01" required />
                            <input type="date" className="transazioni-input transazioni-input-data"
                                   value={data} onChange={e => setData(e.target.value)} />
                            <input type="text" placeholder={t('Descrizione (opzionale)')} value={desc}
                                onChange={e => setDesc(e.target.value)} maxLength={200} />
                            <div className="quickadd-actions">
                                <button type="button" className="modal-btn modal-btn-cancel" onClick={chiudi}>{t('Annulla')}</button>
                                <button type="submit" className="modal-btn modal-btn-primary">{t('Aggiungi')}</button>
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
    const { t } = useTranslation();
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

    const spese = transazioni.filter(tr => tr.tipo === 'spesa').reduce((a, tr) => a + tr.importo, 0);
    const entrate = transazioni.filter(tr => tr.tipo === 'guadagno').reduce((a, tr) => a + tr.importo, 0);

    // Raggruppa per data
    const grouped = transazioni.reduce((acc, tr) => {
        const date = tr.data_transazione; // formato "YYYY-MM-DD"
        if (!acc[date]) acc[date] = [];
        acc[date].push(tr);
        return acc;
    }, {});
    // Ordina le date dalla più recente
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    if (loading) return <p className="dash-loading">{t('Caricamento...')}</p>;

    return (
        <>
            <div className="summary-cards">
                <div className="summary-card">
                    <span className="summary-label">{t('Spese del mese')}</span>
                    <span className="summary-value expense">{spese.toFixed(2)} €</span>
                </div>
                <div className="summary-card">
                    <span className="summary-label">{t('Entrate del mese')}</span>
                    <span className="summary-value income">{entrate.toFixed(2)} €</span>
                </div>
                <div className="summary-card saldo-card">
                    <span className="summary-label">{t('Saldo')}</span>
                    <span className={`summary-value ${(saldo||0) >= 0 ? 'income' : 'expense'}`}>
                        {saldo !== null ? saldo.toFixed(2) : '--'} €
                    </span>
                </div>
            </div>
            {transazioni.length === 0 ? (
                <div className="dashboard-placeholder">
                    <div className="placeholder-icon">📊</div>
                    <p>{t('Nessuna transazione a')} {new Date().toLocaleString('it-IT', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}.</p>
                    <p className="placeholder-hint">{t('Usa il pulsante')} <strong>+</strong> {t('per aggiungerne una.')}</p>
                </div>
            ) : (
                <div className="transazioni-list dash-trans-list">
                    {sortedDates.map(date => {
                        const items = grouped[date];
                        const dateObj = new Date(date + 'T00:00:00');
                        const formattedDate = dateObj.toLocaleDateString('it-IT', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        }).replace(/^\w/, c => c.toUpperCase());
                        return (
                            <div key={date} className="transazioni-group">
                                <div className="transazioni-group-header">{formattedDate}</div>
                                {items.map(tr => (
                                    <li key={tr.id_transazione} className="transazioni-item">
                                        <span className="tr-icon">{TIPI_ICONE[tr.tipo] || '💳'}</span>
                                        <div className="tr-info">
                                            <span className="tr-desc">{tr.descrizione || (tr.tipo === 'spesa' ? t('Spesa') : t('Guadagno'))}</span>
                                            <span className="tr-meta">{tr.nome_portafoglio} · {tr.nome_categoria} · {tr.data_transazione} </span>
                                        </div>
                                        <span className={`tr-importo ${Number(tr.direzione)===2?'tr-importo-positivo':'tr-importo-negativo'}`}>
                                            {Number(tr.direzione)===2?'+':'-'}{parseFloat(tr.importo).toFixed(2)} €
                                        </span>
                                    </li>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default Dashboard;