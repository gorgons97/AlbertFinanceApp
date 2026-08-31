import React, { useState, useRef } from 'react';
import api from '../../api';
import './Impostazioni.css';

const Impostazioni = ({ onLogout }) => {
    const fileRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // Cambio password
    const [pwAttuale, setPwAttuale] = useState('');
    const [pwNuova, setPwNuova] = useState('');
    const [pwConferma, setPwConferma] = useState('');
    const [pwMsg, setPwMsg] = useState('');
    const [pwOk, setPwOk] = useState(false);

    // Eliminazione dati
    const [elimModal, setElimModal] = useState(null); // { tipo, titolo, descrizione }
    const [elimPw, setElimPw] = useState('');
    const [elimMsg, setElimMsg] = useState('');
    const [elimBusy, setElimBusy] = useState(false);

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

    const handleExport = async () => {
        try {
            const res = await api.get('/api/backup/export', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'albert_backup.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('Errore durante l\'export');
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

    // ----- Azioni di eliminazione dati -----
    const apriModalElim = (tipo) => {
        const definizioni = {
            transazioni: {
                titolo: 'Elimina tutte le transazioni',
                descrizione: 'Verranno rimosse tutte le tue transazioni. Portafogli e categorie resteranno invariate.',
            },
            portafogli: {
                titolo: 'Elimina tutti i portafogli',
                descrizione: 'Verranno rimossi i tuoi portafogli (escluso il "Generale") e le transazioni ad essi collegate.',
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
            // Se è stata eliminata l'account, effettua il logout
            if (elimModal.tipo === 'utente' && onLogout) {
                setTimeout(() => onLogout(), 1200);
            }
        } catch (err) {
            setElimMsg(err.response?.data?.detail || 'Errore durante l\'eliminazione');
        } finally {
            setElimBusy(false);
        }
    };

    const azioniEliminazione = [
        { tipo: 'transazioni', icona: '💸', titolo: 'Transazioni', descrizione: 'Elimina tutte le tue transazioni.' },
        { tipo: 'portafogli', icona: '👛', titolo: 'Portafogli', descrizione: 'Elimina tutti i portafogli (escluso Generale) e le transazioni collegate.' },
        { tipo: 'categorie', icona: '🏷️', titolo: 'Categorie', descrizione: 'Elimina tutte le categorie e le transazioni collegate.' },
        { tipo: 'utente', icona: '🗑️', titolo: 'Account', descrizione: 'Elimina definitivamente account e tutti i dati collegati.' },
    ];

    return (
        <div className="impostazioni-page">
            <h2>Impostazioni</h2>

            <div className="impostazioni-section">
                <h3>Backup e Ripristino</h3>
                <p className="impostazioni-desc">
                    Esporta tutte le tue transazioni in un file CSV, o importa un backup da file XLSX/CSV.
                </p>

                <div className="backup-actions">
                    <div className="backup-card">
                        <span className="backup-icon">📤</span>
                        <h4>Esporta dati</h4>
                        <p>Scarica un file CSV con tutte le transazioni, conti e categorie.</p>
                        <button className="backup-btn backup-btn-export" onClick={handleExport}>
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
            </div>

            <div className="impostazioni-section">
                <h3>Cambia Password</h3>
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
            </div>

            <div className="impostazioni-section elim-section">
                <h3>Eliminazione Dati</h3>
                <p className="impostazioni-desc">
                    Azioni irreversibili. Per ciascuna operazione verrai invitato a confermare inserendo la tua password.
                </p>

                <div className="elim-actions">
                    {azioniEliminazione.map(a => (
                        <div key={a.tipo} className={`elim-card ${a.tipo === 'utente' ? 'elim-card-danger' : ''}`}>
                            <span className="elim-icon">{a.icona}</span>
                            <h4>Elimina {a.titolo}</h4>
                            <p>{a.descrizione}</p>
                            <button
                                className={`backup-btn elim-btn ${a.tipo === 'utente' ? 'elim-btn-danger' : ''}`}
                                onClick={() => apriModalElim(a.tipo)}>
                                Elimina {a.titolo}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal di conferma con password */}
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
        </div>
    );
};

export default Impostazioni;
