import React, { useState, useRef } from 'react';
import api from '../../api';
import './Impostazioni.css';

const Impostazioni = () => {
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
        </div>
    );
};

export default Impostazioni;