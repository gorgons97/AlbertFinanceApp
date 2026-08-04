import React, { useState, useEffect } from 'react';
import api from '../../api';
import ConfirmModal from './ConfirmModal';
import './Portafogli.css';

const TIPI_ICONE = {
    contanti: '💵',
    conti: '🏦',
    'carta di credito': '💳',
    risparmi: '🐖',
};

const TIPI_LABELS = {
    contanti: 'Contanti',
    conti: 'Conti',
    'carta di credito': 'Carta di credito',
    risparmi: 'Risparmi',
};

const Portafogli = () => {
    const [portafogli, setPortafogli] = useState([]);
    const [nuovo, setNuovo] = useState('');
    const [importo, setImporto] = useState('');
    const [tipo, setTipo] = useState('conti');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editNome, setEditNome] = useState('');
    const [editImporto, setEditImporto] = useState('');
    const [editTipo, setEditTipo] = useState('conti');

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => { caricaPortafogli(); }, []);

    const caricaPortafogli = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/portafogli/');
            setPortafogli(res.data);
        } catch (err) {
            setError('Errore nel caricamento dei portafogli');
        } finally {
            setLoading(false);
        }
    };

    const aggiungiPortafoglio = async (e) => {
        e.preventDefault();
        if (!nuovo.trim()) return;
        const importoFloat = parseFloat(importo) || 0;
        try {
            setError('');
            const res = await api.post('/api/portafogli/', {
                nome: nuovo.trim(),
                importo: importoFloat,
                tipo: tipo,
            });
            setPortafogli([...portafogli, res.data]);
            setNuovo('');
            setImporto('');
            setTipo('conti');
            setSuccess(`"${res.data.nome}" aggiunto!`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || "Errore durante l'aggiunta");
        }
    };

    const iniziaModifica = (pf) => {
        setEditingId(pf.id_portafoglio);
        setEditNome(pf.nome);
        setEditImporto(pf.valore.toString());
        setEditTipo(pf.tipo || 'conti');
    };

    const annullaModifica = () => {
        setEditingId(null);
    };

    const salvaModifica = async (pfId) => {
        if (!editNome.trim()) return;
        try {
            setError('');
            const res = await api.put(`/api/portafogli/${pfId}`, {
                nome: editNome.trim(),
                importo: parseFloat(editImporto) || 0,
                tipo: editTipo,
            });
            setPortafogli(portafogli.map(p =>
                p.id_portafoglio === pfId ? res.data : p
            ));
            setEditingId(null);
            setSuccess(`"${res.data.nome}" aggiornato!`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || "Errore durante la modifica");
        }
    };

    const confermaElimina = (pf) => {
        setDeleteTarget(pf);
    };

    const eseguiElimina = async () => {
        if (!deleteTarget) return;
        try {
            setError('');
            await api.delete(`/api/portafogli/${deleteTarget.id_portafoglio}`);
            setPortafogli(portafogli.filter(p => p.id_portafoglio !== deleteTarget.id_portafoglio));
            setSuccess(`"${deleteTarget.nome}" rimosso`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore durante la rimozione');
        } finally {
            setDeleteTarget(null);
        }
    };

    const tipoIcona = (t) => TIPI_ICONE[t] || '👛';

    if (loading) {
        return <div className="portafogli-page"><p className="portafogli-loading">Caricamento portafogli...</p></div>;
    }

    return (
        <div className="portafogli-page">
            <h2>I tuoi Portafogli</h2>

            <form onSubmit={aggiungiPortafoglio} className="portafogli-form">
                <input
                    type="text"
                    className="portafogli-input portafogli-input-nome"
                    placeholder="Nuovo portafoglio..."
                    value={nuovo}
                    onChange={e => setNuovo(e.target.value)}
                    maxLength={50}
                    required
                />
                <input
                    type="number"
                    className="portafogli-input portafogli-input-importo"
                    placeholder="0.00"
                    value={importo}
                    onChange={(e) => setImporto(e.target.value)}
                    step="0.01"
                    min="0"
                    max="99999999.99"
                />
                <select
                    className="portafogli-input portafogli-input-tipo"
                    value={tipo}
                    onChange={e => setTipo(e.target.value)}
                >
                    {Object.entries(TIPI_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{TIPI_ICONE[val]} {label}</option>
                    ))}
                </select>
                <button type="submit" className="portafogli-add-btn" title="Aggiungi portafoglio">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                </button>
            </form>

            {error && <div className="portafogli-message error">{error}</div>}
            {success && <div className="portafogli-message success">{success}</div>}

            {portafogli.length === 0 ? (
                <div className="portafogli-empty">
                    <span className="empty-icon">👛</span>
                    <p>Nessun portafoglio creato.</p>
                    <p className="empty-hint">Usa il campo sopra per aggiungerne uno.</p>
                </div>
            ) : (
                <ul className="portafogli-list">
                    {portafogli.map(pf => (
                        <li key={pf.id_portafoglio} className="portafogli-item">
                            {editingId === pf.id_portafoglio ? (
                                /* ---- Modalità modifica inline ---- */
                                <div className="portafogli-edit-row">
                                    <input
                                        type="text"
                                        className="portafogli-edit-input"
                                        value={editNome}
                                        onChange={e => setEditNome(e.target.value)}
                                        maxLength={50}
                                    />
                                    <input
                                        type="number"
                                        className="portafogli-edit-input portafogli-edit-importo"
                                        value={editImporto}
                                        onChange={e => setEditImporto(e.target.value)}
                                        step="0.01"
                                        min="0"
                                    />
                                    <select
                                        className="portafogli-edit-input portafogli-edit-tipo"
                                        value={editTipo}
                                        onChange={e => setEditTipo(e.target.value)}
                                    >
                                        {Object.entries(TIPI_LABELS).map(([val, label]) => (
                                            <option key={val} value={val}>{TIPI_ICONE[val]} {label}</option>
                                        ))}
                                    </select>
                                    <div className="portafogli-edit-actions">
                                        <button
                                            className="portafogli-edit-save"
                                            onClick={() => salvaModifica(pf.id_portafoglio)}
                                            title="Salva"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M5 13l4 4L19 7"/>
                                            </svg>
                                        </button>
                                        <button
                                            className="portafogli-edit-cancel"
                                            onClick={annullaModifica}
                                            title="Annulla"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M18 6L6 18M6 6l12 12"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ---- Modalità visualizzazione ---- */
                                <>
                                    <span className="pf-icon">{tipoIcona(pf.tipo)}</span>
                                    <span className="pf-name">{pf.nome}</span>
                                    <span className="pf-tipo-label">{TIPI_LABELS[pf.tipo] || pf.tipo}</span>
                                    <span className="pf-valore">
                                        {parseFloat(pf.valore).toFixed(2)} €
                                    </span>
                                    <button
                                        className="pf-edit-btn"
                                        onClick={() => iniziaModifica(pf)}
                                        title={`Modifica ${pf.nome}`}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                    </button>
                                    <button
                                        className="pf-delete-btn"
                                        onClick={() => confermaElimina(pf)}
                                        title={`Elimina ${pf.nome}`}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        </svg>
                                    </button>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {/* Modal di conferma eliminazione */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                title="Elimina portafoglio"
                message={`Sei sicuro di voler eliminare "${deleteTarget?.nome}"? Questa azione non può essere annullata.`}
                onConfirm={eseguiElimina}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
};

export default Portafogli;