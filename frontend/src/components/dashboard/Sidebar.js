import React from 'react';
import './Sidebar.css';

const menuItems = [
    { id: 'dashboard',    icon: '📊', label: 'Dashboard' },
    { id: 'transazioni',  icon: '💳', label: 'Transazioni' },
    { id: 'portafogli',   icon: '👛', label: 'Portafogli' },
    { id: 'categorie',    icon: '🏷️',  label: 'Categorie' },
    //{ id: 'report',       icon: '📈', label: 'Report' },
];

const bottomItems = [
    { id: 'impostazioni', icon: '⚙️',  label: 'Impostazioni' },
    { id: 'logout',       icon: '🚪', label: 'Esci' },
];

const Sidebar = ({ collapsed, onToggle, onMenuClick, onLogout, mobileOpen, onMobileClose, activePage }) => {
    const handleClick = (id, label) => {
        if (id === 'logout') {
            onLogout && onLogout();
            return;
        }
        onMenuClick && onMenuClick(id);
        console.log(`hai premuto il pulsante ${label}`);
        if (mobileOpen) onMobileClose && onMobileClose();
    };

    const sidebarClasses = [
        'sidebar',
        collapsed && !mobileOpen ? 'collapsed' : '',
        mobileOpen ? 'mobile-open' : '',
    ].filter(Boolean).join(' ');

    return (
        <>
            {/* Overlay scuro su mobile quando sidebar e' aperta */}
            {mobileOpen && <div className="sidebar-overlay" onClick={onMobileClose}></div>}

            <aside className={sidebarClasses}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <span className="logo-text">{collapsed && !mobileOpen ? 'A' : 'Albert'}</span>
                    </div>
                    <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? 'Espandi menu' : 'Riduci menu'}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            {collapsed
                                ? <path d="M9 18l6-6-6-6"/>
                                : <path d="M15 18l-6-6 6-6"/>
                            }
                        </svg>
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <ul className="sidebar-menu">
                        {menuItems.map(item => (
                            <li key={item.id}>
                                <button
                                    className={`sidebar-item ${item.id === activePage ? 'active' : ''}`}
                                    onClick={() => handleClick(item.id, item.label)}
                                    title={collapsed && !mobileOpen ? item.label : ''}
                                >
                                    <span className="sidebar-icon">{item.icon}</span>
                                    {!(collapsed && !mobileOpen) && <span className="sidebar-label">{item.label}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>

                    <ul className="sidebar-menu sidebar-bottom">
                        {bottomItems.map(item => (
                            <li key={item.id}>
                                <button
                                    className={`sidebar-item ${item.id === 'logout' ? 'logout-item' : ''}`}
                                    onClick={() => handleClick(item.id, item.label)}
                                    title={collapsed && !mobileOpen ? item.label : ''}
                                >
                                    <span className="sidebar-icon">{item.icon}</span>
                                    {!(collapsed && !mobileOpen) && <span className="sidebar-label">{item.label}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;
