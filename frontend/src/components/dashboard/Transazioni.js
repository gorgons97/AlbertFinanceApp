import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import ConfirmModal from './ConfirmModal';
import './Transazioni.css';

const TIPI_ICONE = { spesa: '💸', guadagno: '💰', trasferimento: '🔄' };
const TIPO_LABEL = { spesa: 'Spesa', guadagno: 'Guadagno', trasferimento: 'Trasferimento' };

const Transazioni = () => {
    const { t } = useTranslation();
    const [transazioni, setTransazioni] = useState([]);
    const [portafogli, setPortafogli] = useState([]);
    const [categorie, setCategorie] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formTipo, setFormTipo] = useState('spesa');
    const [formPortafoglio, setFormPortafoglio] = useState('');
    const [formData, setFormData] = useState(() => new Date().toISOString().split('T')[0]);
    const [formCategoria, setFormCategoria] = useState('');
    const [formImporto, setFormImporto] = useState('');
    const [formDescrizione, setFormDescrizione] = useState('');

    // Trasferimento
    const [formOrigine, setFormOrigine] = useState('');
    const [formDestinazione, setFormDestinazione] = useState('');

    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editTipo, setEditTipo] = useState('spesa');
    const [editPfId, setEditPfId] = useState('');
    const [editCatId, setEditCatId] = useState('');
    const [editImporto, setEditImporto] = useState('');
    const [editDesc, setEditDesc] = useState('');

    const [deleteTarget, setDeleteTarget] = useState(null);

    // Filtri
    const meseCorrente = new Date().toISOString().slice(0, 7);
    const [filterTipo, setFilterTipo] = useState('');
    const [filterPortafoglio, setFilterPortafoglio] = useState('');
    const [filterCategoria, setFilterCategoria] = useState('');
    const [filterDataInizio, setFilterDataInizio] = useState('');
    const [filterDataFine, setFilterDataFine] = useState('');
    const [filterMese, setMese] = useState(meseCorrente);

    useEffect(() => { caricaDati(); }, []);

    const caricaDati = async () => {
        try {
            setLoading(true);
            const [rPf, rCat] = await Promise.all([
                api.get('/api/portafogli/'),
                api.get('/api/categorie/'),
            ]);
            setPortafogli(rPf.data);
            setCategorie(rCat.data);
            if (rPf.data.length > 0) {
                setFormPortafoglio(String(rPf.data[0].id_portafoglio));
                setFormOrigine(String(rPf.data[0].id_portafoglio));
                setFormDestinazione(String(rPf.data.length > 1 ? rPf.data[1].id_portafoglio : rPf.data[0].id_portafoglio));
            }
            const cf = rCat.data.filter(c => c.tipo === 'spesa');
            if (cf.length > 0) setFormCategoria(String(cf[0].id_categoria));
            await caricaTransazioni();
        } catch { setError(t('Errore nel caricamento dati')); }
        finally { setLoading(false); }
    };

    const caricaTransazioni = async (filtri = {}) => {
        const params = new URLSearchParams();
        const f = {
            tipo: filtri.tipo !== undefined ? filtri.tipo : filterTipo,
            id_portafoglio: filtri.id_portafoglio !== undefined ? filtri.id_portafoglio : filterPortafoglio,
            id_categoria: filtri.id_categoria !== undefined ? filtri.id_categoria : filterCategoria,
            data_inizio: filtri.data_inizio !== undefined ? filtri.data_inizio : filterDataInizio,
            data_fine: filtri.data_fine !== undefined ? filtri.data_fine : filterDataFine,
            mese: filtri.mese !== undefined ? filtri.mese : filterMese
        };
        if (f.tipo) params.append('tipo', f.tipo);
        if (f.id_portafoglio) params.append('id_portafoglio', f.id_portafoglio);
        if (f.id_categoria) params.append('id_categoria', f.id_categoria);
        if (f.data_inizio) params.append('data_inizio', f.data_inizio);
        if (f.data_fine) params.append('data_fine', f.data_fine);
        if (f.mese) params.append('mese', f.mese);
        params.append('limit', '500');
        const res = await api.get(`/api/transazioni/?${params.toString()}`);
        setTransazioni(res.data);
    };

    const resetFiltri = () => {
        setFilterTipo('');
        setFilterPortafoglio('');
        setFilterCategoria('');
        setFilterDataInizio('');
        setFilterDataFine('');
        setMese(meseCorrente);
        caricaTransazioni({ tipo: '', id_portafoglio: '', data_inizio: '', data_fine: '' });
    };

    const catDisp = categorie.filter(c => c.tipo === formTipo);
    const editCatDisp = categorie.filter(c => c.tipo === editTipo);

    const handleTipoChange = (tipo) => {
        setFormTipo(tipo);
        const cf = categorie.filter(c => c.tipo === tipo);
        setFormCategoria(cf.length > 0 ? String(cf[0].id_categoria) : '');
    };

    const aggiungi = async (e) => {
        e.preventDefault();
        if (!formPortafoglio || !formCategoria || !formImporto) return;
        try {
            setError('');
            const res = await api.post('/api/transazioni/', {
                id_portafoglio: parseInt(formPortafoglio), 
                id_categoria: parseInt(formCategoria),
                tipo: formTipo, 
                importo: parseFloat(formImporto), 
                descrizione: formDescrizione.trim(), 
                data_transazione: formData, 
            });
            setTransazioni(prev => {
                const nuovaLista = [res.data, ...prev];
                return nuovaLista.sort((a, b) => new Date(b.data_transazione) - new Date(a.data_transazione));
            });
            setFormImporto(''); 
            setFormDescrizione('');
            setFormData(new Date().toISOString().split('T')[0]); 
            setSuccess(t('Transazione aggiunta!'));
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) { setError(err.response?.data?.detail || t("Errore")); }
    };

    const inviaTrasferimento = async (e) => {
        e.preventDefault();
        if (!formOrigine || !formDestinazione || !formImporto) return;
        if (formOrigine === formDestinazione) {
            setError(t('Origine e destinazione devono essere diversi'));
            return;
        }
        try {
            setError('');
            await api.post('/api/transazioni/trasferimento', {
                id_portafoglio_origine: parseInt(formOrigine),
                id_portafoglio_destinazione: parseInt(formDestinazione),
                importo: parseFloat(formImporto),
                descrizione: formDescrizione.trim(),
                data_transazione: formData,  
            });
            setFormImporto(''); setFormDescrizione('');
            setFormData(new Date().toISOString().split('T')[0]); 
            setSuccess(t('Trasferimento creato!'));
            setTimeout(() => setSuccess(''), 2500);
            caricaTransazioni();
        } catch (err) { setError(err.response?.data?.detail || t('Errore trasferimento')); }
    };

    const iniziaModifica = (tr) => {
        setEditingId(tr.id_transazione);
        setEditTipo(tr.tipo); setEditPfId(String(tr.id_portafoglio));
        setEditCatId(String(tr.id_categoria)); setEditImporto(tr.importo.toString());
        setEditDesc(tr.descrizione || '');
    };

    const annullaModifica = () => setEditingId(null);

    const salvaModifica = async (id) => {
        if (!editPfId || !editCatId || !editImporto) return;
        try {
            setError('');
            const res = await api.put(`/api/transazioni/${id}`, {
                id_portafoglio: parseInt(editPfId), id_categoria: parseInt(editCatId),
                tipo: editTipo, importo: parseFloat(editImporto), descrizione: editDesc.trim(),
            });
            setTransazioni(prev => {
                const aggiornate = prev.map(t => t.id_transazione === id ? res.data : t);
                return aggiornate.sort((a, b) => new Date(b.data_transazione) - new Date(a.data_transazione));
                });
            setEditingId(null);
            setSuccess(t('Transazione aggiornata!'));
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) { setError(err.response?.data?.detail || t('Errore modifica')); }
    };

    const eseguiElimina = async () => {
        if (!deleteTarget) return;
        try {
            setError('');
            await api.delete(`/api/transazioni/${deleteTarget.id_transazione}`);
            setTransazioni(transazioni.filter(t => t.id_transazione !== deleteTarget.id_transazione));
            setSuccess(t('Transazione eliminata'));
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) { setError(err.response?.data?.detail || t('Errore')); }
        finally { setDeleteTarget(null); }
    };

    if (loading) return <div className="transazioni-page"><p className="transazioni-loading">{t("Caricamento...")}</p></div>;

    return (
        <div className="transazioni-page">
            <h2>{t("Transazioni")}</h2>

            <form onSubmit={formTipo === 'trasferimento' ? inviaTrasferimento : aggiungi} className="transazioni-form">
                <div className="transazioni-tabs">
                    {['spesa', 'guadagno', 'trasferimento'].map(tipo => (
                        <button key={tipo} type="button"
                            className={`transazioni-tab ${formTipo === tipo ? 'active' : ''}`}
                            onClick={() => handleTipoChange(tipo)}>
                            {TIPI_ICONE[tipo]} {t(TIPO_LABEL[tipo])}
                        </button>
                    ))}
                </div>

                {formTipo === 'trasferimento' ? (
                    <>
                        <div className="transazioni-form-row">
                            <select className="transazioni-input transazioni-input-portafoglio" value={formOrigine}
                                onChange={e => setFormOrigine(e.target.value)}>
                                {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{t('Da')}: {p.nome}</option>)}
                            </select>
                            <select className="transazioni-input transazioni-input-portafoglio" value={formDestinazione}
                                onChange={e => setFormDestinazione(e.target.value)}>
                                {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{t('A')}: {p.nome}</option>)}
                            </select>
                            <input type="number" className="transazioni-input transazioni-input-importo" placeholder="0.00"
                                value={formImporto} onChange={e => setFormImporto(e.target.value)} step="0.01" min="0.01" required />
                        </div>
                        <div className="transazioni-form-row">
                            <input type="date" className="transazioni-input transazioni-input-data"
                                   value={formData} onChange={e => setFormData(e.target.value)} />
                            <input type="text" className="transazioni-input transazioni-input-descrizione" placeholder={t("Descrizione")}
                                value={formDescrizione} onChange={e => setFormDescrizione(e.target.value)} maxLength={200} />
                            <button type="submit" className="transazioni-add-btn" title={t("Crea trasferimento")}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="transazioni-form-row">
                            <select className="transazioni-input transazioni-input-portafoglio" value={formPortafoglio}
                                onChange={e => setFormPortafoglio(e.target.value)}>
                                {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                            </select>
                            <input type="number" className="transazioni-input transazioni-input-importo" placeholder="0.00"
                                value={formImporto} onChange={e => setFormImporto(e.target.value)} step="0.01" min="0.01" required />
                            <input type="date" className="transazioni-input transazioni-input-data"
                                   value={formData} onChange={e => setFormData(e.target.value)} />
                        </div>
                        <div className="transazioni-form-row">
                            <select className="transazioni-input transazioni-input-categoria" value={formCategoria}
                                onChange={e => setFormCategoria(e.target.value)}>
                                {catDisp.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nome}</option>)}
                            </select>
                            <input type="text" className="transazioni-input transazioni-input-descrizione" placeholder={t("Descrizione")}
                                value={formDescrizione} onChange={e => setFormDescrizione(e.target.value)} maxLength={200} />
                            <button type="submit" className="transazioni-add-btn" title={t("Aggiungi")}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            </button>
                        </div>
                    </>
                )}
            </form>

            <div className="transazioni-filtri">
                <div className="transazioni-filtri-header">
                    <span className="transazioni-filtri-title">🔍 {t("Filtri")}</span>
                    <button className="transazioni-filter-reset" onClick={resetFiltri} title={t("Azzera filtri")}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                        </svg>
                        {t("Azzera")}
                    </button>
                </div>
                <div className="transazioni-filtri-grid">
                    <label className="transazioni-filter-field">
                        <span className="transazioni-filter-label">{t("Tipo")}</span>
                        <select className="transazioni-filter-input" value={filterTipo}
                            onChange={e => { setFilterTipo(e.target.value); caricaTransazioni({ tipo: e.target.value }); }}>
                            <option value="">{t("Tutti i tipi")}</option>
                            <option value="spesa">💸 {t("Spese")}</option>
                            <option value="guadagno">💰 {t("Guadagni")}</option>
                            <option value="trasferimento">🔄 {t("Trasferimenti")}</option>
                        </select>
                    </label>
                    <label className="transazioni-filter-field">
                        <span className="transazioni-filter-label">{t("Portafoglio")}</span>
                        <select className="transazioni-filter-input" value={filterPortafoglio}
                            onChange={e => { setFilterPortafoglio(e.target.value); caricaTransazioni({ id_portafoglio: e.target.value }); }}>
                            <option value="">{t("Tutti")}</option>
                            {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                        </select>
                    </label>
                    <label className="transazioni-filter-field">
                        <span className="transazioni-filter-label">{t("Categoria")}</span>
                        <select className="transazioni-filter-input" value={filterCategoria}
                            onChange={e => { setFilterCategoria(e.target.value); caricaTransazioni({ id_categoria: e.target.value }); }}>
                            <option value="">{t("Tutte")}</option>
                            {categorie.map(c => <option key={c.id_categoria} value={c.id_categoria}>{TIPI_ICONE[c.tipo] || ''} {c.nome}</option>)}
                        </select>
                    </label>
                    <label className="transazioni-filter-field">
                        <span className="transazioni-filter-label">{t("Mese")}</span>
                        <input type="month" className="transazioni-filter-input" value={filterMese}
                            onChange={e => { setMese(e.target.value); caricaTransazioni({ mese: e.target.value }); }} />
                    </label>
                    <label className="transazioni-filter-field">
                        <span className="transazioni-filter-label">{t("Dal")}</span>
                        <input type="date" className="transazioni-filter-input" value={filterDataInizio}
                            onChange={e => { setFilterDataInizio(e.target.value); setMese(''); caricaTransazioni({ data_inizio: e.target.value }); }} />
                    </label>
                    <label className="transazioni-filter-field">
                        <span className="transazioni-filter-label">{t("Al")}</span>
                        <input type="date" className="transazioni-filter-input" value={filterDataFine}
                            onChange={e => { setFilterDataFine(e.target.value); setMese(''); caricaTransazioni({ data_fine: e.target.value }); }} />
                    </label>
                </div>
            </div>

            {error && <div className="transazioni-message error">{error}</div>}
            {success && <div className="transazioni-message success">{success}</div>}

            {transazioni.length === 0 ? (
                <div className="transazioni-empty"><span className="empty-icon">📋</span><p>{t("Nessuna transazione.")}</p></div>
            ) : (
                <ul className="transazioni-list">
                    {transazioni.map(tr => (
                        <li key={tr.id_transazione} className="transazioni-item">
                            {editingId === tr.id_transazione ? (
                                <div className="transazioni-edit-row">
                                    <select value={editTipo} onChange={e => { setEditTipo(e.target.value); const cf=categorie.filter(c=>c.tipo===e.target.value); if(cf.length)setEditCatId(String(cf[0].id_categoria)); }}>
                                        <option value="spesa">💸 {t("Spesa")}</option>
                                        <option value="guadagno">💰 {t("Guadagno")}</option>
                                    </select>
                                    <select value={editPfId} onChange={e => setEditPfId(e.target.value)}>
                                        {portafogli.map(p => <option key={p.id_portafoglio} value={p.id_portafoglio}>{p.nome}</option>)}
                                    </select>
                                    <select value={editCatId} onChange={e => setEditCatId(e.target.value)}>
                                        {editCatDisp.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nome}</option>)}
                                    </select>
                                    <input type="number" value={editImporto} onChange={e => setEditImporto(e.target.value)} step="0.01" min="0.01" />
                                    <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder={t("Descrizione")} maxLength={200} />
                                    <div className="transazioni-edit-actions">
                                        <button className="portafogli-edit-save" onClick={() => salvaModifica(tr.id_transazione)} title={t("Salva")}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                                        </button>
                                        <button className="portafogli-edit-cancel" onClick={annullaModifica} title={t("Annulla")}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span className="tr-icon">{TIPI_ICONE[tr.tipo] || '💳'}</span>
                                    <div className="tr-info">
                                        <span className="tr-desc">{tr.descrizione || t(TIPO_LABEL[tr.tipo])}</span>
                                        <span className="tr-meta">{tr.nome_portafoglio} · {tr.nome_categoria} · {tr.data_transazione}</span>
                                    </div>
                                    <span className={`tr-importo ${Number(tr.direzione)===2?'tr-importo-positivo':'tr-importo-negativo'}`}>
                                        {Number(tr.direzione)===2?'+':'-'}{parseFloat(tr.importo).toFixed(2)} €
                                    </span>
                                    {!tr.nome_utente ? (
                                    <div className='tr-coda'>
                                        <button className="pf-edit-btn" onClick={() => iniziaModifica(tr)} title={t("Modifica")}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                            </svg>
                                        </button>
                                        <button className="pf-delete-btn" onClick={() => setDeleteTarget(tr)} title={t("Elimina")}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            </svg>
                                        </button>
                                    </div>
                                    ) :  <span className="tr-nome-utente">{tr.nome_utente}</span>}
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <ConfirmModal isOpen={!!deleteTarget} title={t("Elimina transazione")}
                message={t("Sei sicuro di voler eliminare questa transazione?")}
                onConfirm={eseguiElimina} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
};

export default Transazioni;