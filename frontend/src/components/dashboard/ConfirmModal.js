import React from 'react';
import { useTranslation } from 'react-i18next';
import './ConfirmModal.css';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="modal-actions">
                    <button className="modal-btn modal-btn-cancel" onClick={onCancel}>{t('Annulla')}</button>
                    <button className="modal-btn modal-btn-danger" onClick={onConfirm}>{t('Elimina')}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
