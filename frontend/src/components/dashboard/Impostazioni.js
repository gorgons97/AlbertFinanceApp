import React, { useState, useRef } from 'react';
import api from '../../api';
import './Impostazioni.css';

const Impostazioni = () => {
    const fileRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

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
        </div>
    );
};

export default Impostazioni;