import React, { useState, useEffect } from 'react';
import api from '../../api';
import './Portafogli.css';

const Portafogli = () => {
    const [portafogli, setPortafogli] = useState([]);
    const [nuovo, setNuovo] = useState('');
    const [importo, setImporto] = useState(''); // Stato per il float
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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
        // Converti il valore in float (se vuoi puoi usare parseFloat)
        const importoFloat = parseFloat(importo);
        if (isNaN(importoFloat)) {
          importoFloat = 0;
        }
        try {
            setError('');
            const res = await api.post('/api/portafogli/', { nome: nuovo.trim() });
            setPortafogli([...portafogli, res.data]);
            setNuovo('');
            setImporto('');
            setSuccess(`"${res.data.nome}" aggiunto!`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || "Errore durante l'aggiunta");
        }
    };

    const rimuoviPortafoglio = async (cat) => {
        try {
            setError('');
            await api.delete(`/api/portafogli/${cat.id_portafoglio}`);
            setPortafogli(portafogli.filter(c => c.id_portafoglio !== cat.id_portafoglio));
            setSuccess(`"${cat.nome}" rimosso`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore durante la rimozione');
        }
    };

    if (loading) {
        return <div className="portafogli-page"><p className="portafogli-loading">Caricamento portafogli...</p></div>;
    }

    return (
        <div className="portafogli-page">
            <h2>I tuoi Portafogli</h2>

            <form onSubmit={aggiungiPortafoglio} className="portafogli-form">
                <input
                    type="text"
                    className="portafogli-input"
                    placeholder="Nuovo portafoglio..."
                    value={nuovo}
                    onChange={e => setNuovo(e.target.value)}
                    maxLength={50}
                    required              // se vuoi renderlo obbligatorio
                />
                {/* Nuovo campo per l'importo float */}
                <input
                    type="number"
                    className="portafogli-input" // puoi usare una classe specifica
                    placeholder="0.00"
                    value={importo}
                    onChange={(e) => setImporto(e.target.value)}
                    step="0.01"           // consente due decimali
                    min="0"               // se deve essere positivo
                    max="99999999.99"     // per rispettare il limite 10,2 (8 interi + 2 decimali)
                />
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
                    {portafogli.map(cat => (
                        <li key={cat.id_portafoglio} className="portafogli-item">
                            <span className="cat-icon">👛</span>
                            <span className="cat-name">{cat.nome}</span>
                            <span className="cat-valore">{cat.valore} €</span>
                            <button
                                className="cat-delete-btn"
                                onClick={() => rimuoviPortafoglio(cat)}
                                title={`Rimuovi ${cat.nome}`}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14"/>
                                </svg>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Portafogli;
