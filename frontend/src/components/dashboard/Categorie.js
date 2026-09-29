import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import ConfirmModal from './ConfirmModal';
import './Categorie.css';

const TIPI_ICONE = { spesa: '💸', guadagno: '💰', trasferimento: '🔄' };
const TIPI_LABELS = { spesa: 'Spesa', guadagno: 'Guadagno', trasferimento: 'Trasferimento' };
const TIPI_LIST = ['spesa', 'guadagno', 'trasferimento'];

const Categorie = () => {
    const { t } = useTranslation();
    const [categorie, setCategorie] = useState([]);
    const [nuova, setNuova] = useState('');
    const [tipoCat, setTipoCat] = useState('spesa');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [editNome, setEditNome] = useState('');
    const [editTipo, setEditTipo] = useState('spesa');

    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => { caricaCategorie();     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const caricaCategorie = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/categorie/');
            setCategorie(res.data);
        } catch (err) {
            setError(t('Errore nel caricamento delle categorie'));
        } finally {
            setLoading(false);
        }
    };

    const aggiungiCategoria = async (e) => {
        e.preventDefault();
        if (!nuova.trim()) return;
        try {
            setError('');
            const res = await api.post('/api/categorie/', { nome: nuova.trim(), tipo: tipoCat });
            setCategorie([...categorie, res.data]);
            setNuova('');
            setTipoCat('spesa');
            setSuccess(`"${res.data.nome}" ${t('aggiunta!')}`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || t("Errore durante l'aggiunta"));
        }
    };

    const iniziaModifica = (cat) => {
        setEditingId(cat.id_categoria);
        setEditNome(cat.nome);
        setEditTipo(cat.tipo || 'spesa');
    };

    const annullaModifica = () => setEditingId(null);

    const salvaModifica = async (catId) => {
        if (!editNome.trim()) return;
        try {
            setError('');
            const res = await api.put(`/api/categorie/${catId}`, { nome: editNome.trim(), tipo: editTipo });
            setCategorie(categorie.map(c => c.id_categoria === catId ? res.data : c));
            setEditingId(null);
            setSuccess(`"${res.data.nome}" ${t('aggiornata!')}`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || t('Errore durante la modifica'));
        }
    };

    const confermaElimina = (cat) => setDeleteTarget(cat);

    const eseguiElimina = async () => {
        if (!deleteTarget) return;
        try {
            setError('');
            await api.delete(`/api/categorie/${deleteTarget.id_categoria}`);
            setCategorie(categorie.filter(c => c.id_categoria !== deleteTarget.id_categoria));
            setSuccess(`"${deleteTarget.nome}" ${t('rimossa')}`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || t('Errore durante la rimozione'));
        } finally {
            setDeleteTarget(null);
        }
    };

    if (loading) {
        return <div className="categorie-page"><p className="categorie-loading">{t('Caricamento categorie...')}</p></div>;
    }

    return (
        <div className="categorie-page">
            <h2>{t("Le tue Categorie")}</h2>

            <form onSubmit={aggiungiCategoria} className="categorie-form">
                <input type="text" className="categorie-input" placeholder={t("Nuova categoria...")}
                    value={nuova} onChange={e => setNuova(e.target.value)} maxLength={50} />
                <select className="categorie-input categorie-input-tipo"
                    value={tipoCat} onChange={e => setTipoCat(e.target.value)}>
                    {TIPI_LIST.map(tipo => (
                        <option key={tipo} value={tipo}>{TIPI_ICONE[tipo]} {t(TIPI_LABELS[tipo])}</option>
                    ))}
                </select>
                <button type="submit" className="categorie-add-btn" title={t("Aggiungi categoria")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                </button>
            </form>

            {error && <div className="categorie-message error">{error}</div>}
            {success && <div className="categorie-message success">{success}</div>}

            {categorie.length === 0 ? (
                <div className="categorie-empty">
                    <span className="empty-icon">🏷️</span>
                    <p>{t("Nessuna categoria creata.")}</p>
                    <p className="empty-hint">{t("Usa il campo sopra per aggiungerne una.")}</p>
                </div>
            ) : (
                <ul className="categorie-list">
                    {categorie.map(cat => (
                        <li key={cat.id_categoria} className="categorie-item">
                            {editingId === cat.id_categoria ? (
                                <div className="categorie-edit-row">
                                    <input type="text" className="categorie-edit-input"
                                        value={editNome} onChange={e => setEditNome(e.target.value)}
                                        maxLength={50} autoFocus />
                                    <select className="categorie-edit-input categorie-edit-tipo"
                                        value={editTipo} onChange={e => setEditTipo(e.target.value)}>
                                        {TIPI_LIST.map(tipo => (
                                            <option key={tipo} value={tipo}>{TIPI_ICONE[tipo]} {t(TIPI_LABELS[tipo])}</option>
                                        ))}
                                    </select>
                                    <button className="categorie-edit-save"
                                        onClick={() => salvaModifica(cat.id_categoria)} title={t("Salva")}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M5 13l4 4L19 7"/>
                                        </svg>
                                    </button>
                                    <button className="categorie-edit-cancel" onClick={annullaModifica} title={t("Annulla")}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M18 6L6 18M6 6l12 12"/>
                                        </svg>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="cat-icon">{TIPI_ICONE[cat.tipo] || '🏷️'}</span>
                                    <span className="cat-name">{cat.nome}</span>
                                    <span className="cat-tipo-label-badge">{t(TIPI_LABELS[cat.tipo] || cat.tipo)}</span>
                                    <button className="cat-edit-btn"
                                        onClick={() => iniziaModifica(cat)} title={`${t("Modifica")} ${cat.nome}`}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                    </button>
                                    <button className="cat-delete-btn"
                                        onClick={() => confermaElimina(cat)} title={`${t("Elimina")} ${cat.nome}`}>
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

            <ConfirmModal isOpen={!!deleteTarget} title={t("Elimina categoria")}
                message={`${t('Sei sicuro di voler eliminare')} "${deleteTarget?.nome}"? ${t('Questa azione non può essere annullata.')}`}
                onConfirm={eseguiElimina} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
};

export default Categorie;