import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';
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
            setMsg('Errore nel caricamento delle notifiche');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carica();     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const accetta = async (id) => {
        try {
            await api.post(`/api/notifiche/inviti/${id}/accetta`);
            setMsg('Invito accettato!');
            carica();
        } catch (err) {
            setMsg(err.response?.data?.detail || 'Errore');
        }
    };

    const rifiuta = async (id) => {
        try {
            await api.post(`/api/notifiche/inviti/${id}/rifiuta`);
            setMsg('Invito rifiutato');
            carica();
        } catch (err) {
            setMsg(err.response?.data?.detail || 'Errore');
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
            setMsg(err.response?.data?.detail || 'Errore durante l\'eliminazione');
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
                    <p>Nessuna notifica.</p>
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
                                    {n.mittente ? `Da: ${n.mittente} · ` : ''}{n.data_creazione?.slice(0, 10)}
                                </span>
                            </div>
                            <div className="notifica-azioni">
                                {n.tipo === 'invito_portafoglio' && (
                                    <>
                                        <button className="notifica-btn accetta"
                                            onClick={() => accetta(n.riferimento_id)}>Accetta</button>
                                        <button className="notifica-btn rifiuta"
                                            onClick={() => rifiuta(n.riferimento_id)}>Rifiuta</button>
                                    </>
                                )}
                                {!n.letto && n.tipo !== 'invito_portafoglio' && (
                                    <button className="notifica-btn segna" onClick={() => segnaLetta(n.id_notifica)}>
                                        Segna letta
                                    </button>
                                )}
                                <button className="notifica-btn elimina"
                                    onClick={() => elimina(n.id_notifica)} title="Elimina notifica">🗑️</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Notifiche;