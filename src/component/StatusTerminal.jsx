import React, { useEffect, useRef, useState } from 'react';
import { Activity, Cpu, HardDrive, Wifi, Zap } from 'lucide-react';
import './Terminal.css'; // Re-use the HUD terminal styles

const StatusTerminal = () => {
  const containerRef = useRef(null);
  
  // Load position from local storage or use defaults
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('statusTerminalPosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved status terminal position", e);
      }
    }
    // Default position (top left area)
    return { x: 50, y: 100 };
  });

  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Handle window resize so terminal doesn't get lost off-screen
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 100),
        y: Math.min(prev.y, window.innerHeight - 50)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;
    
    if (containerRef.current) {
      // Prevent dragging off screen
      const maxX = window.innerWidth - containerRef.current.offsetWidth;
      const maxY = window.innerHeight - containerRef.current.offsetHeight;
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('statusTerminalPosition', JSON.stringify(positionRef.current));
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // System Metrics Simulation
  const [metrics, setMetrics] = useState({
    cpu: 34,
    ram: 68,
    netUp: 1.2,
    netDown: 8.5,
    temp: 45
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(10, Math.min(99, prev.cpu + (Math.random() * 20 - 10))),
        ram: Math.max(40, Math.min(90, prev.ram + (Math.random() * 5 - 2.5))),
        netUp: Math.max(0.1, prev.netUp + (Math.random() * 2 - 1)),
        netDown: Math.max(1.0, prev.netDown + (Math.random() * 10 - 5)),
        temp: Math.max(30, Math.min(80, prev.temp + (Math.random() * 4 - 2)))
      }));
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="hud-terminal-container"
      ref={containerRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: 'auto',
        position: 'fixed',
        transform: 'none',
        zIndex: 998,
        height: 'auto',
        minHeight: '250px',
        width: '320px',
        pointerEvents: 'auto'
      }}
    >
      <div
        className="hud-terminal-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      >
        <Activity size={14} className="terminal-icon" />
        <span>SYSTEM.VITALS.MONITOR</span>
        <div className="terminal-status-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div className="hud-terminal-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Global Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#00ffe1', boxShadow: '0 0 10px #00ffe1', animation: 'blink 2s infinite' }}></div>
          <span style={{ color: '#00ffe1', fontWeight: 'bold', letterSpacing: '2px', fontSize: '14px' }}>SYSTEM OPTIMAL</span>
        </div>

        {/* CPU */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Cpu size={14} /> CPU CORE_01</span>
            <span>{metrics.cpu.toFixed(1)}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(0, 255, 225, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${metrics.cpu}%`, height: '100%', backgroundColor: metrics.cpu > 80 ? '#ff4444' : '#00ffe1', transition: 'width 0.5s ease' }}></div>
          </div>
        </div>

        {/* RAM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><HardDrive size={14} /> MEM_ALLOC</span>
            <span>{metrics.ram.toFixed(1)}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(0, 255, 225, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${metrics.ram}%`, height: '100%', backgroundColor: '#00ffe1', transition: 'width 0.5s ease' }}></div>
          </div>
        </div>

        {/* NETWORK */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Wifi size={14} /> UPLINK_NET</span>
            <span style={{ fontSize: '10px' }}>▼ {metrics.netDown.toFixed(1)} ▲ {metrics.netUp.toFixed(1)} MB/s</span>
          </div>
          <div style={{ display: 'flex', gap: '2px', height: '12px', alignItems: 'flex-end' }}>
            {[...Array(20)].map((_, i) => (
              <div key={i} style={{ 
                flex: 1, 
                backgroundColor: '#00ffe1', 
                height: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5 + 0.2,
                animation: `blink ${Math.random() * 2 + 1}s infinite`
              }}></div>
            ))}
          </div>
        </div>

        {/* THERMALS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '4px', padding: '8px', backgroundColor: 'rgba(0, 255, 225, 0.05)', border: '1px solid rgba(0, 255, 225, 0.1)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={14} /> THERMALS</span>
          <span style={{ color: metrics.temp > 70 ? '#ff4444' : '#00ffe1' }}>{metrics.temp.toFixed(1)} °C</span>
        </div>

      </div>
    </div>
  );
};

export default StatusTerminal;
