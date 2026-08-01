import React, { useState, useEffect } from 'react';
import api from '../../api';
import './Categorie.css';

const Categorie = () => {
    const [categorie, setCategorie] = useState([]);
    const [nuova, setNuova] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => { caricaCategorie(); }, []);

    const caricaCategorie = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/categorie/');
            setCategorie(res.data);
        } catch (err) {
            setError('Errore nel caricamento delle categorie');
        } finally {
            setLoading(false);
        }
    };

    const aggiungiCategoria = async (e) => {
        e.preventDefault();
        if (!nuova.trim()) return;
        try {
            setError('');
            const res = await api.post('/api/categorie/', { nome: nuova.trim() });
            setCategorie([...categorie, res.data]);
            setNuova('');
            setSuccess(`"${res.data.nome}" aggiunta!`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || "Errore durante l'aggiunta");
        }
    };

    const rimuoviCategoria = async (cat) => {
        try {
            setError('');
            await api.delete(`/api/categorie/${cat.id_categoria}`);
            setCategorie(categorie.filter(c => c.id_categoria !== cat.id_categoria));
            setSuccess(`"${cat.nome}" rimossa`);
            setTimeout(() => setSuccess(''), 2500);
        } catch (err) {
            setError(err.response?.data?.detail || 'Errore durante la rimozione');
        }
    };

    if (loading) {
        return <div className="categorie-page"><p className="categorie-loading">Caricamento categorie...</p></div>;
    }

    return (
        <div className="categorie-page">
            <h2>Le tue Categorie</h2>

            <form onSubmit={aggiungiCategoria} className="categorie-form">
                <input
                    type="text"
                    className="categorie-input"
                    placeholder="Nuova categoria..."
                    value={nuova}
                    onChange={e => setNuova(e.target.value)}
                    maxLength={50}
                />
                <button type="submit" className="categorie-add-btn" title="Aggiungi categoria">
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
                    <p>Nessuna categoria creata.</p>
                    <p className="empty-hint">Usa il campo sopra per aggiungerne una.</p>
                </div>
            ) : (
                <ul className="categorie-list">
                    {categorie.map(cat => (
                        <li key={cat.id_categoria} className="categorie-item">
                            <span className="cat-icon">🏷️</span>
                            <span className="cat-name">{cat.nome}</span>
                            <button
                                className="cat-delete-btn"
                                onClick={() => rimuoviCategoria(cat)}
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

export default Categorie;
