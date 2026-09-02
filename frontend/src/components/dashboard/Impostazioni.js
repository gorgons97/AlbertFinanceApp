import React, { useState, useRef, useEffect } from 'react';
import api from '../../api';
import './Impostazioni.css';

const TIPI = [
    { valore: 'spesa', etichetta: 'Spese' },
    { valore: 'guadagno', etichetta: 'Guadagni' },
    { valore: 'trasferimento', etichetta: 'Trasferimenti' },
];

// Pannello filtri riusabile (per export ed eliminazione transazioni)
const FiltriTransazioni = ({
    mode, setMode,
    tipi, setTipi,
    categorieDisponibili, categorie, setCategorie,
    portafogliDisponibili, portafogli, setPortafogli,
    dal, setDal, al, setAl,
}) => {
    const toggle = (list, setList, v) =>
        setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

    return (
        <div className="filtri-panel">
            <div className="filtri-mode">
                <button
                    type="button"
                    className={`filtri-mode-btn ${mode === 'tutto' ? 'active' : ''}`}
                    onClick={() => setMode('tutto')}>
                    Tutto
                </button>
                <button
                    type="button"
                    className={`filtri-mode-btn ${mode === 'filtra' ? 'active' : ''}`}
                    onClick={() => setMode('filtra')}>
                    Filtra
                </button>
            </div>

            {mode === 'filtra' && (
                <div className="filtri-body">
                    <div className="filtri-gruppo">
                        <span className="filtri-label">Tipo</span>
                        <div className="filtri-chips">
                            {TIPI.map(t => (
                                <label key={t.valore} className="chip">
                                    <input type="checkbox"
                                        checked={tipi.includes(t.valore)}
                                        onChange={() => toggle(tipi, setTipi, t.valore)} />
                                    {t.etichetta}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filtri-gruppo">
                        <span className="filtri-label">Categorie</span>
                        <div className="filtri-chips">
                            {categorieDisponibili.length === 0 && <span className="filtri-vuoto">Nessuna categoria</span>}
                            {categorieDisponibili.map(c => (
                                <label key={c.id_categoria} className="chip">
                                    <input type="checkbox"
                                        checked={categorie.includes(c.id_categoria)}
                                        onChange={() => toggle(categorie, setCategorie, c.id_categoria)} />
                                    {c.nome}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filtri-gruppo">
                        <span className="filtri-label">Portafogli</span>
                        <div className="filtri-chips">
                            {portafogliDisponibili.length === 0 && <span className="filtri-vuoto">Nessun portafoglio</span>}
                            {portafogliDisponibili.map(p => (
                                <label key={p.id_portafoglio} className="chip">
                                    <input type="checkbox"
                                        checked={portafogli.includes(p.id_portafoglio)}
                                        onChange={() => toggle(portafogli, setPortafogli, p.id_portafoglio)} />
                                    {p.nome}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filtri-gruppo filtri-date">
                        <span className="filtri-label">Periodo</span>
                        <div className="filtri-date-row">
                            <label>Da
                                <input type="date" value={dal} onChange={e => setDal(e.target.value)} />
                            </label>
                            <label>A
                                <input type="date" value={al} onChange={e => setAl(e.target.value)} />
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Impostazioni = ({ onLogout }) => {
    const fileRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Liste disponibili per i filtri
    const [categorie, setCategorie] = useState([]);
    const [portafogli, setPortafogli] = useState([]);

    // Cambio password
    const [pwAttuale, setPwAttuale] = useState('');
    const [pwNuova, setPwNuova] = useState('');
    const [pwConferma, setPwConferma] = useState('');
    const [pwMsg, setPwMsg] = useState('');
    const [pwOk, setPwOk] = useState(false);

    // Eliminazione dati (azioni semplici: portafogli/categorie/utente)
    const [elimModal, setElimModal] = useState(null); // { tipo, titolo, descrizione }
    const [elimPw, setElimPw] = useState('');
    const [elimMsg, setElimMsg] = useState('');
    const [elimBusy, setElimBusy] = useState(false);

    // Eliminazione transazioni smart
    const [elimTransOpen, setElimTransOpen] = useState(false);
    const [elimTransMode, setElimTransMode] = useState('tutto');
    const [elimTransTipi, setElimTransTipi] = useState([]);
    const [elimTransCategorie, setElimTransCategorie] = useState([]);
    const [elimTransPortafogli, setElimTransPortafogli] = useState([]);
    const [elimTransDal, setElimTransDal] = useState('');
    const [elimTransAl, setElimTransAl] = useState('');
    const [elimTransPw, setElimTransPw] = useState('');
    const [elimTransMsg, setElimTransMsg] = useState('');
    const [elimTransBusy, setElimTransBusy] = useState(false);

    // Export smart
    const [exportOpen, setExportOpen] = useState(false);
    const [exportMode, setExportMode] = useState('tutto');
    const [exportTipi, setExportTipi] = useState([]);
    const [exportCategorie, setExportCategorie] = useState([]);
    const [exportPortafogli, setExportPortafogli] = useState([]);
    const [exportDal, setExportDal] = useState('');
    const [exportAl, setExportAl] = useState('');
    const [exportBusy, setExportBusy] = useState(false);

    // Accordion delle macrocategorie (una sezione aperta alla volta)
    const [aperta, setAperta] = useState(null);
    const toggleSezione = (k) => setAperta(prev => (prev === k ? null : k));

    useEffect(() => {
        api.get('/api/categorie/').then(r => setCategorie(r.data)).catch(() => {});
        api.get('/api/portafogli/').then(r => setPortafogli(r.data)).catch(() => {});
    }, []);

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true); setError(''); setResult(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/api/backup/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore durante l\'import');
        } finally {
            setImporting(false);
        }
    };

    const apriExport = () => {
        setExportOpen(true);
        setExportMode('tutto');
        setExportTipi([]); setExportCategorie([]); setExportPortafogli([]);
        setExportDal(''); setExportAl('');
    };

    const eseguiExport = async () => {
        setExportBusy(true); setError('');
        try {
            const params = {};
            if (exportMode === 'filtra') {
                if (exportTipi.length) params.tipi = exportTipi.join(',');
                if (exportCategorie.length) params.id_categorie = exportCategorie.join(',');
                if (exportPortafogli.length) params.id_portafogli = exportPortafogli.join(',');
                if (exportDal) params.dal = exportDal;
                if (exportAl) params.al = exportAl;
            }
            const res = await api.get('/api/backup/export', { responseType: 'blob', params });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'albert_backup.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            setExportOpen(false);
        } catch (err) {
            setError('Errore durante l\'export');
        } finally {
            setExportBusy(false);
        }
    };

    const cambiaPassword = async (e) => {
        e.preventDefault();
        setPwMsg(''); setPwOk(false);
        if (!pwAttuale || !pwNuova || !pwConferma) {
            setPwMsg('Compila tutti i campi');
            return;
        }
        if (pwNuova.length < 8) {
            setPwMsg('La nuova password deve avere almeno 8 caratteri');
            return;
        }
        if (pwNuova !== pwConferma) {
            setPwMsg('Le password non coincidono');
            return;
        }
        try {
            const res = await api.post('/api/auth/change-password', {
                password_attuale: pwAttuale,
                nuova_password: pwNuova,
            });
            setPwMsg(res.data.message || 'Password aggiornata');
            setPwOk(true);
            setPwAttuale(''); setPwNuova(''); setPwConferma('');
        } catch (err) {
            setPwMsg(err.response?.data?.detail || 'Errore durante il cambio password');
        }
    };

    // ----- Azioni di eliminazione dati (semplici) -----
    const apriModalElim = (tipo) => {
        const definizioni = {
            portafogli: {
                titolo: 'Elimina tutti i portafogli',
                descrizione: 'Verranno rimossi i tuoi portafogli e le transazioni ad essi collegate. Se un portafoglio è condiviso, la proprietà passa al cointestatario più anziano.',
            },
            categorie: {
                titolo: 'Elimina tutte le categorie',
                descrizione: 'Verranno rimosse le tue categorie e le transazioni ad esse collegate.',
            },
            utente: {
                titolo: 'Elimina account',
                descrizione: 'Verranno rimossi definitivamente il tuo account e tutti i dati ad esso collegati. Azione irreversibile.',
            },
        };
        setElimModal({ tipo, ...definizioni[tipo] });
        setElimPw(''); setElimMsg('');
    };

    const chiudiModalElim = () => {
        if (elimBusy) return;
        setElimModal(null); setElimPw(''); setElimMsg('');
    };

    const confermaEliminazione = async () => {
        if (!elimPw) { setElimMsg('Inserisci la password per confermare'); return; }
        setElimBusy(true); setElimMsg('');
        try {
            const res = await api.post(`/api/eliminazione/${elimModal.tipo}`, { password: elimPw });
            setElimMsg(res.data.message || 'Operazione completata');
            if (elimModal.tipo === 'utente' && onLogout) {
                setTimeout(() => onLogout(), 1200);
            }
        } catch (err) {
            setElimMsg(err.response?.data?.detail || 'Errore durante l\'eliminazione');
        } finally {
            setElimBusy(false);
        }
    };

    // ----- Eliminazione transazioni smart -----
    const apriElimTrans = () => {
        setElimTransOpen(true);
        setElimTransMode('tutto');
        setElimTransTipi([]); setElimTransCategorie([]); setElimTransPortafogli([]);
        setElimTransDal(''); setElimTransAl('');
        setElimTransPw(''); setElimTransMsg('');
    };

    const confermaElimTrans = async () => {
        if (!elimTransPw) { setElimTransMsg('Inserisci la password per confermare'); return; }
        setElimTransBusy(true); setElimTransMsg('');
        try {
            const body = { password: elimTransPw, tutto: elimTransMode === 'tutto' };
            if (elimTransMode === 'filtra') {
                body.tipi = elimTransTipi;
                body.id_categorie = elimTransCategorie;
                body.id_portafogli = elimTransPortafogli;
                body.dal = elimTransDal || undefined;
                body.al = elimTransAl || undefined;
            }
            const res = await api.post('/api/eliminazione/transazioni/filtrate', body);
            setElimTransMsg(res.data.message || 'Operazione completata');
        } catch (err) {
            setElimTransMsg(err.response?.data?.detail || 'Errore durante l\'eliminazione');
        } finally {
            setElimTransBusy(false);
        }
    };

    const azioniEliminazione = [
            { tipo: 'transazioni', icona: '💸', titolo: 'Transazioni', descrizione: 'Elimina tutte le tue transazioni, oppure solo quelle che corrispondono a filtri specifici.' },
            { tipo: 'portafogli', icona: '👛', titolo: 'Portafogli', descrizione: 'Elimina tutti i portafogli (escluso Generale) e le transazioni collegate.' },
            { tipo: 'categorie', icona: '🏷', titolo: 'Categorie', descrizione: 'Elimina tutte le categorie e le transazioni collegate.' },
            { tipo: 'utente', icona: '🗑', titolo: 'Account', descrizione: 'Elimina definitivamente account e tutti i dati collegati.' },
        ];

        const SEZIONI = [
            { chiave: 'backup', icona: '💾', titolo: 'Backup e Ripristino', sottotitolo: 'Esporta il tuo archivio o importa un backup da file' },
            { chiave: 'password', icona: '🔑', titolo: 'Cambia Password', sottotitolo: 'Aggiorna la password del tuo account' },
            { chiave: 'eliminazione', icona: '🗑', titolo: 'Eliminazione Dati', sottotitolo: 'Azioni irreversibili, richiedono la password' },
        ];

        return (
            <div className="impostazioni-page">
                <h2>Impostazioni</h2>

                <div className="acc-container">
                    {SEZIONI.map(s => (
                        <div key={s.chiave} className={`acc-item ${aperta === s.chiave ? 'open' : ''}`}>
                            <button
                                type="button"
                                className="acc-head"
                                onClick={() => toggleSezione(s.chiave)}
                                aria-expanded={aperta === s.chiave}>
                                <span className="acc-icon">{s.icona}</span>
                                <span className="acc-testi">
                                    <span className="acc-titolo">{s.titolo}</span>
                                    <span className="acc-sottotitolo">{s.sottotitolo}</span>
                                </span>
                                <span className="acc-freccia">{aperta === s.chiave ? '▴' : '▾'}</span>
                            </button>

                            {aperta === s.chiave && (
                                <div className="acc-body">
                                    {s.chiave === 'backup' && (
                                        <>
                                            <p className="impostazioni-desc">
                                                Esporta le tue transazioni in un file CSV (tutte o filtrate), o importa un backup da file XLSX/CSV.
                                            </p>

                                            <div className="backup-actions">
                                                <div className="backup-card">
                                                    <span className="backup-icon">📤</span>
                                                    <h4>Esporta dati</h4>
                                                    <p>Scarica un file CSV con tutte le transazioni, oppure seleziona filtri (tipo, categorie, portafogli, periodo).</p>
                                                    <button className="backup-btn backup-btn-export" onClick={apriExport}>
                                                        Esporta CSV
                                                    </button>
                                                </div>

                                                <div className="backup-card">
                                                    <span className="backup-icon">📥</span>
                                                    <h4>Importa backup</h4>
                                                    <p>Carica un file XLSX o CSV. Verranno creati automaticamente portafogli, categorie e transazioni mancanti.</p>
                                                    <input type="file" ref={fileRef} onChange={handleImport}
                                                        accept=".xlsx,.xls,.csv" style={{ display: 'none' }} />
                                                    <button className="backup-btn backup-btn-import"
                                                        onClick={() => fileRef.current?.click()}
                                                        disabled={importing}>
                                                        {importing ? 'Importazione in corso...' : 'Carica file'}
                                                    </button>
                                                </div>
                                            </div>

                                            {error && <div className="impostazioni-message error">{error}</div>}

                                            {result && (
                                                <div className="impostazioni-message success">
                                                    <strong>Import completato!</strong>
                                                    <ul>
                                                        <li>{result.portafogli_creati} portafogli creati</li>
                                                        <li>{result.categorie_create} categorie create</li>
                                                        <li>{result.transazioni_importate} transazioni importate</li>
                                                        <li>{result.totale_righe} righe processate</li>
                                                    </ul>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {s.chiave === 'password' && (
                                        <>
                                            <p className="impostazioni-desc">
                                                Aggiorna la password del tuo account.
                                            </p>
                                            <form onSubmit={cambiaPassword} className="password-form">
                                                <input type="password" placeholder="Password attuale"
                                                    value={pwAttuale} onChange={e => setPwAttuale(e.target.value)} />
                                                <input type="password" placeholder="Nuova password (min 8 caratteri)"
                                                    value={pwNuova} onChange={e => setPwNuova(e.target.value)} />
                                                <input type="password" placeholder="Conferma nuova password"
                                                    value={pwConferma} onChange={e => setPwConferma(e.target.value)} />
                                                <button type="submit" className="backup-btn backup-btn-export">Aggiorna Password</button>
                                            </form>
                                            {pwMsg && (
                                                <div className={`impostazioni-message ${pwOk ? 'success' : 'error'}`}>{pwMsg}</div>
                                            )}
                                        </>
                                    )}

                                    {s.chiave === 'eliminazione' && (
                                        <>
                                            <p className="impostazioni-desc">
                                                Azioni irreversibili. Per ciascuna operazione verrai invitato a confermare inserendo la tua password. Il portafoglio "Generale" non è mai eliminabile.
                                            </p>

                                            <div className="elim-actions">
                                                {azioniEliminazione.map(a => (
                                                    <div key={a.tipo} className={`elim-card ${a.tipo === 'utente' ? 'elim-card-danger' : ''}`}>
                                                        <span className="elim-icon">{a.icona}</span>
                                                        <h4>Elimina {a.titolo}</h4>
                                                        <p>{a.descrizione}</p>
                                                        <button
                                                            className={`backup-btn elim-btn ${a.tipo === 'utente' ? 'elim-btn-danger' : ''}`}
                                                            onClick={() => a.tipo === 'transazioni' ? apriElimTrans() : apriModalElim(a.tipo)}>
                                                            Elimina {a.titolo}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

            {/* Modal eliminazione semplice (portafogli/categorie/utente) */}
            {elimModal && (
                <div className="modal-overlay" onClick={chiudiModalElim}>
                    <div className="modal-content elim-modal" onClick={e => e.stopPropagation()}>
                        <h3>{elimModal.titolo}</h3>
                        <p className="elim-modal-desc">{elimModal.descrizione}</p>
                        <input
                            type="password"
                            className="elim-password-input"
                            placeholder="Inserisci la password"
                            value={elimPw}
                            onChange={e => setElimPw(e.target.value)}
                            disabled={elimBusy}
                        />
                        {elimMsg && <div className={`impostazioni-message ${elimMsg.includes('completata') || elimMsg === 'Operazione completata' ? 'success' : 'error'}`}>{elimMsg}</div>}
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={chiudiModalElim} disabled={elimBusy}>Annulla</button>
                            <button className="modal-btn modal-btn-danger" onClick={confermaEliminazione} disabled={elimBusy}>
                                {elimBusy ? 'Eliminazione...' : 'Conferma eliminazione'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal eliminazione transazioni smart */}
            {elimTransOpen && (
                <div className="modal-overlay" onClick={() => !elimTransBusy && setElimTransOpen(false)}>
                    <div className="modal-content elim-modal elim-modal-wide" onClick={e => e.stopPropagation()}>
                        <h3>Elimina transazioni</h3>
                        <p className="elim-modal-desc">
                            Scegli se eliminare tutte le transazioni o solo quelle che corrispondono ai filtri selezionati.
                        </p>
                        <FiltriTransazioni
                            mode={elimTransMode} setMode={setElimTransMode}
                            tipi={elimTransTipi} setTipi={setElimTransTipi}
                            categorieDisponibili={categorie} categorie={elimTransCategorie} setCategorie={setElimTransCategorie}
                            portafogliDisponibili={portafogli} portafogli={elimTransPortafogli} setPortafogli={setElimTransPortafogli}
                            dal={elimTransDal} setDal={setElimTransDal}
                            al={elimTransAl} setAl={setElimTransAl}
                        />
                        <input
                            type="password"
                            className="elim-password-input"
                            placeholder="Inserisci la password per confermare"
                            value={elimTransPw}
                            onChange={e => setElimTransPw(e.target.value)}
                            disabled={elimTransBusy}
                        />
                        {elimTransMsg && <div className={`impostazioni-message ${elimTransMsg.includes('eliminate') || elimTransMsg === 'Operazione completata' ? 'success' : 'error'}`}>{elimTransMsg}</div>}
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={() => setElimTransOpen(false)} disabled={elimTransBusy}>Annulla</button>
                            <button className="modal-btn modal-btn-danger" onClick={confermaElimTrans} disabled={elimTransBusy}>
                                {elimTransBusy ? 'Eliminazione...' : 'Conferma eliminazione'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal export smart */}
            {exportOpen && (
                <div className="modal-overlay" onClick={() => !exportBusy && setExportOpen(false)}>
                    <div className="modal-content elim-modal elim-modal-wide" onClick={e => e.stopPropagation()}>
                        <h3>Esporta transazioni</h3>
                        <p className="elim-modal-desc">
                            Scegli se esportare tutte le transazioni o solo quelle che corrispondono ai filtri selezionati.
                        </p>
                        <FiltriTransazioni
                            mode={exportMode} setMode={setExportMode}
                            tipi={exportTipi} setTipi={setExportTipi}
                            categorieDisponibili={categorie} categorie={exportCategorie} setCategorie={setExportCategorie}
                            portafogliDisponibili={portafogli} portafogli={exportPortafogli} setPortafogli={setExportPortafogli}
                            dal={exportDal} setDal={setExportDal}
                            al={exportAl} setAl={setExportAl}
                        />
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={() => setExportOpen(false)} disabled={exportBusy}>Annulla</button>
                            <button className="modal-btn modal-btn-primary" onClick={eseguiExport} disabled={exportBusy}>
                                {exportBusy ? 'Esportazione...' : 'Scarica CSV'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Impostazioni;
