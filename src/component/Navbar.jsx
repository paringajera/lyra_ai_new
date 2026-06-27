import './Navbar.css';
import { Home, Rocket, Zap, Settings, Search, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';

const Navbar = ({ blobConfig, setBlobConfig }) => {
  const [scrolled, setScrolled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Add scroll event listener to change style on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar-container ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-glass">
        <div className="hud-bg"></div>
        {/* Logo Section */}
        <div className="navbar-brand">
          <div className="logo-icon-wrapper">
            <Zap className="logo-icon" size={24} />
          </div>
          <span className="logo-text">Countrywide</span>
        </div>

        {/* Navigation Links */}
        <div className="navbar-links">
          <a href="#home" className="nav-link active">
            <Home size={18} />
            <span>Dashboard</span>
          </a>
          <a href="#missions" className="nav-link">
            <Rocket size={18} />
            <span>Missions</span>
          </a>
          <div className="nav-link settings-dropdown" style={{ position: 'relative', overflow: 'visible' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={18} />
              <span>System</span>
            </div>

            {showSettings && (
              <div className="settings-panel">
                <div className="settings-panel-inner">
                  <div className="setting-row">
                    <label>Blob Color</label>
                    <input
                      type="color"
                      value={blobConfig?.color || '#00ffe1'}
                      onChange={(e) => setBlobConfig({ ...blobConfig, color: e.target.value })}
                    />
                  </div>

                  <div className="setting-row">
                    <label>Size ({blobConfig?.size || 180}px)</label>
                    <input
                      type="range"
                      min="50" max="400"
                      value={blobConfig?.size || 180}
                      onChange={(e) => setBlobConfig({ ...blobConfig, size: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="setting-row">
                    <label>Sensitivity ({blobConfig?.sensitivity ?? 2.2}x)</label>
                    <input
                      type="range"
                      min="0.0" max="5.0" step="0.1"
                      value={blobConfig?.sensitivity ?? 2.2}
                      onChange={(e) => setBlobConfig({ ...blobConfig, sensitivity: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="setting-row" style={{ marginTop: '12px' }}>
                    <button
                      className="reposition-btn"
                      onClick={() => setBlobConfig({ ...blobConfig, isDraggingMode: !(blobConfig?.isDraggingMode) })}
                    >
                      {blobConfig?.isDraggingMode ? 'Save Position' : 'Reposition Blob'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="navbar-actions">
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input type="text" placeholder="Query system..." className="search-input" />
          </div>
          <button className="menu-btn">
            <Menu size={24} />
          </button>
          <div className="profile-indicator">
            <div className="pulse-ring"></div>
            <div className="profile-avatar"></div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
