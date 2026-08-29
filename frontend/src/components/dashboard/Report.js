import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import './Report.css';

// Palette colori per i grafici (riusabile per entrate/spese)
const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7', '#06b6d4', '#f43f5e'];

const TIPI_ICONE = { spesa: '💸', guadagno: '💰', trasferimento: '🔄' };

/* ── Grafico a ciambella (donut) in SVG puro ── */
const Donut = ({ data, size = 180, thickness = 26 }) => {
    const tot = data.reduce((a, d) => a + d.importo, 0);
    if (tot <= 0) {
        return (
            <div className="report-donut-empty">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                    <circle cx={size / 2} cy={size / 2} r={(size - thickness) / 2}
                        fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
                </svg>
                <span className="report-empty-label">Nessun dato</span>
            </div>
        );
    }
    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const arcs = data.map((d, i) => {
        const frac = d.importo / tot;
        const arc = { ...d, color: COLORS[i % COLORS.length], len: frac * c, offset };
        offset += frac * c;
        return arc;
    });
    return (
        <div className="report-donut" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
                {arcs.map((a, i) => (
                    <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                        stroke={a.color} strokeWidth={thickness}
                        strokeDasharray={`${Math.max(a.len - 1.5, 0.5)} ${c - Math.max(a.len - 1.5, 0.5)}`}
                        strokeDashoffset={-a.offset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{ transition: 'stroke-dasharray 400ms' }} />
                ))}
            </svg>
            <div className="report-donut-center">
                <span className="report-donut-total">{(tot).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
            </div>
        </div>
    );
};

/* ── Legenda: colore, nome, percentuale di peso e valore effettivo ── */
const Legend = ({ data }) => {
    const tot = data.reduce((a, d) => a + d.importo, 0);
    return (
        <ul className="report-legend">
            {data.map((d, i) => (
                <li key={i} className="report-legend-item">
                    <span className="report-legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="report-legend-name">{d.nome}</span>
                    <span className="report-legend-value">
                        {d.importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                    <span className="report-legend-pct">{tot > 0 ? ((d.importo / tot) * 100).toFixed(1) : 0.0}%</span>
                </li>
            ))}
        </ul>
    );
};

/* ── Grafico a barre per mese (trend) ── */
const BarChartMesi = ({ data }) => {
    if (!data.length) return <p className="report-empty">Nessun dato per il periodo.</p>;
    const max = Math.max(...data.map(d => Math.max(d.spese, d.entrate)), 1);
    return (
        <div className="report-bars">
            {data.map((d, i) => (
                <div key={i} className="report-bar-col">
                    <div className="report-bar-track">
                        <div className="report-bar report-bar-spese" style={{ height: `${(d.spese / max) * 100}%` }}
                            title={`Spese ${d.spese.toLocaleString('it-IT')} €`} />
                        <div className="report-bar report-bar-entrate" style={{ height: `${(d.entrate / max) * 100}%` }}
                            title={`Entrate ${d.entrate.toLocaleString('it-IT')} €`} />
                    </div>
                    <span className="report-bar-label">{d.mese.slice(5)}</span>
                </div>
            ))}
            <div className="report-bars-legend">
                <span><i className="report-legend-dot" style={{ background: '#ef4444' }} /> Spese</span>
                <span><i className="report-legend-dot" style={{ background: '#10b981' }} /> Entrate</span>
            </div>
        </div>
    );
};

/* ── Barre orizzontali per portafoglio ── */
const BarChartPortafogli = ({ data }) => {
    if (!data.length) return <p className="report-empty">Nessun dato per il periodo.</p>;
    const max = Math.max(...data.map(d => Math.max(d.spese, d.entrate)), 1);
    return (
        <div className="report-hbars">
            {data.map((d, i) => (
                <div key={i} className="report-hbar-row">
                    <span className="report-hbar-name">{d.nome}</span>
                    <div className="report-hbar-track">
                        <div className="report-hbar report-hbar-spese" style={{ width: `${(d.spese / max) * 100}%` }}
                            title={`Spese ${d.spese.toLocaleString('it-IT')} €`} />
                    </div>
                    <span className="report-hbar-val spese">-{d.spese.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                    <div className="report-hbar-track">
                        <div className="report-hbar report-hbar-entrate" style={{ width: `${(d.entrate / max) * 100}%` }}
                            title={`Entrate ${d.entrate.toLocaleString('it-IT')} €`} />
                    </div>
                    <span className="report-hbar-val entrate">+{d.entrate.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                </div>
            ))}
        </div>
    );
};

const Report = () => {
    // Filtro standard: mese corrente
    const meseCorrente = new Date().toISOString().slice(0, 7);
    const [mese, setMese] = useState(meseCorrente);
    const [dataInizio, setDataInizio] = useState('');
    const [dataFine, setDataFine] = useState('');
    const [idPortafoglio, setIdPortafoglio] = useState('');
    const [idCategoria, setIdCategoria] = useState('');

    const [portafogli, setPortafogli] = useState([]);
    const [categorie, setCategorie] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Carica portafogli e categorie una volta
    useEffect(() => {
        (async () => {
            try {
                const [rPf, rCat] = await Promise.all([
                    api.get('/api/portafogli/'),
                    api.get('/api/categorie/'),
                ]);
                setPortafogli(rPf.data);
                setCategorie(rCat.data);
            } catch {}
        })();
    }, []);

    const carica = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const params = {};
            if (mese) params.mese = mese;
            if (dataInizio) params.data_inizio = dataInizio;
            if (dataFine) params.data_fine = dataFine;
            if (idPortafoglio) params.id_portafoglio = idPortafoglio;
            if (idCategoria) params.id_categoria = idCategoria;
            const res = await api.get('/api/transazioni/report', { params });
            setReport(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore caricamento report');
        } finally { setLoading(false); }
    }, [mese, dataInizio, dataFine, idPortafoglio, idCategoria]);

    useEffect(() => { carica(); }, [carica]);

    const reset = () => {
        setMese(meseCorrente);
        setDataInizio(''); setDataFine('');
        setIdPortafoglio(''); setIdCategoria('');
    };

    const entrate = report?.per_categoria?.filter(c => c.tipo === 'guadagno') || [];
    const spese = report?.per_categoria?.filter(c => c.tipo === 'spesa') || [];
    const totali = report?.totali || { spese: 0, entrate: 0, saldo: 0 };

    return (
        <div className="report-page">
            <h2>Report</h2>

            {/* Filtri */}
            <div className="report-filtri">
                <div className="report-filter-header">
                    <span className="report-filter-title">🔍 Filtri</span>
                    <button className="report-reset" onClick={reset} title="Azzera filtri">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                        </svg>
                        Azzera
                    </button>
                </div>
                <div className="report-filter-grid">
                    <label className="report-filter">
                        <span className="report-filter-label">Mese</span>
                        <input type="month" value={mese} onChange={e => setMese(e.target.value)} />
                    </label>
                    <label className="report-filter">
                        <span className="report-filter-label">Portafoglio</span>
                        <select value={idPortafoglio} onChange={e => setIdPortafoglio(e.target.value)}>
                            <option value="">Tutti</option>
                            {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                        </select>
                    </label>
                    <label className="report-filter">
                        <span className="report-filter-label">Dal</span>
                        <input type="date" value={dataInizio} onChange={e => setDataInizio(e.target.value)} />
                    </label>
                    <label className="report-filter">
                        <span className="report-filter-label">Al</span>
                        <input type="date" value={dataFine} onChange={e => setDataFine(e.target.value)} />
                    </label>
                    <label className="report-filter">
                        <span className="report-filter-label">Categoria</span>
                        <select value={idCategoria} onChange={e => setIdCategoria(e.target.value)}>
                            <option value="">Tutte</option>
                            {categorie.map(c => <option key={c.id_categoria} value={c.id_categoria}>{TIPI_ICONE[c.tipo] || ''} {c.nome}</option>)}
                        </select>
                    </label>
                </div>
            </div>

            {error && <div className="report-message error">{error}</div>}
            {loading ? <p className="report-loading">Caricamento...</p> : (
                <>
                    {/* Cards riassuntive */}
                    <div className="report-cards">
                        <div className="report-card">
                            <span className="report-card-label">Spese</span>
                            <span className="report-card-value expense">-{totali.spese.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="report-card">
                            <span className="report-card-label">Entrate</span>
                            <span className="report-card-value income">+{totali.entrate.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                        </div>
                        <div className="report-card">
                            <span className="report-card-label">Saldo</span>
                            <span className={`report-card-value ${totali.saldo >= 0 ? 'income' : 'expense'}`}>
                                {totali.saldo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                        </div>
                    </div>

                    {/* Grafici a torta: entrate e uscite per categoria */}
                    <div className="report-charts-row">
                        <div className="report-chart-card">
                            <h3>💰 Entrate per categoria</h3>
                            <Donut data={entrate} />
                            <Legend data={entrate} />
                        </div>
                        <div className="report-chart-card">
                            <h3>💸 Uscite per categoria</h3>
                            <Donut data={spese} />
                            <Legend data={spese} />
                        </div>
                    </div>

                    {/* Trend mensile */}
                    <div className="report-chart-card report-chart-full">
                        <h3>📈 Andamento mensile (spese vs entrate)</h3>
                        <BarChartMesi data={report?.per_mese || []} />
                    </div>

                    {/* Per portafoglio */}
                    <div className="report-chart-card report-chart-full">
                        <h3>👛 Spese ed entrate per portafoglio</h3>
                        <BarChartPortafogli data={report?.per_portafoglio || []} />
                    </div>
                </>
            )}
        </div>
    );
};

export default Report;
