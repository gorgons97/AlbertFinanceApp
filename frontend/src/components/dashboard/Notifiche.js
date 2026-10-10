import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
import { trd } from '../../i18n';
import api from '../../api';
import './Notifiche.css';

const Notifiche = ({ onCambio }) => {
    const { t } = useTranslation();
    const [notifiche, setNotifiche] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');

    const carica = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/notifiche/');
            setNotifiche(res.data.notifiche || []);
            if (onCambio) onCambio(res.data.non_lette || 0);
        } catch {
            setMsg(t('Errore nel caricamento delle notifiche'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carica();     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const accetta = async (id) => {
        try {
            await api.post(`/api/notifiche/inviti/${id}/accetta`);
            setMsg(t('Invito accettato!'));
            carica();
        } catch (err) {
            setMsg(trd(err.response?.data?.detail) || t('Errore'));
        }
    };

    const rifiuta = async (id) => {
        try {
            await api.post(`/api/notifiche/inviti/${id}/rifiuta`);
            setMsg(t('Invito rifiutato'));
            carica();
        } catch (err) {
            setMsg(trd(err.response?.data?.detail) || t('Errore'));
        }
    };

    const segnaLetta = async (id) => {
        try {
            await api.post(`/api/notifiche/${id}/letta`);
            carica();
        } catch {}
    };

    const elimina = async (id) => {
        try {
            await api.delete(`/api/notifiche/${id}`);
            carica();
        } catch (err) {
            setMsg(trd(err.response?.data?.detail) || t("Errore durante l'eliminazione"));
        }
    };

    if (loading) return <div className="notifiche-page"><p className="notifiche-loading">{t("Caricamento...")}</p></div>;

    return (
        <div className="notifiche-page">
            <h2>{t("Notifiche")}</h2>
            {msg && <div className="notifiche-message">{msg}</div>}

            {notifiche.length === 0 ? (
                <div className="notifiche-empty">
                    <span className="empty-icon">🔔</span>
                    <p>{t('Nessuna notifica.')}</p>
                </div>
            ) : (
                <ul className="notifiche-list">
                    {notifiche.map(n => (
                        <li key={n.id_notifica} className={`notifica-item ${n.letto ? '' : 'non-letta'}`}>
                            <span className="notifica-icon">
                                {n.tipo === 'invito_portafoglio' ? '👥' : 'ℹ️'}
                            </span>
                            <div className="notifica-body">
                                <span className="notifica-titolo">{n.titolo}</span>
                                <span className="notifica-messaggio">{n.messaggio}</span>
                                <span className="notifica-meta">
                                    {n.mittente ? `${t('Da')}: ${n.mittente} · ` : ''}{n.data_creazione?.slice(0, 10)}
                                </span>
                            </div>
                            <div className="notifica-azioni">
                                {n.tipo === 'invito_portafoglio' && (
                                    <>
                                        <button className="notifica-btn accetta"
                                            onClick={() => accetta(n.riferimento_id)}>{t('Accetta')}</button>
                                        <button className="notifica-btn rifiuta"
                                            onClick={() => rifiuta(n.riferimento_id)}>{t('Rifiuta')}</button>
                                    </>
                                )}
                                {!n.letto && n.tipo !== 'invito_portafoglio' && (
                                    <button className="notifica-btn segna" onClick={() => segnaLetta(n.id_notifica)}>
                                        {t('Segna letta')}
                                    </button>
                                )}
                                <button className="notifica-btn elimina"
                                    onClick={() => elimina(n.id_notifica)} title={t('Elimina notifica')}>🗑️</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Notifiche;