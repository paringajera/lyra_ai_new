import React, { useEffect, useRef, useState } from 'react';
import { Sun, MapPin } from 'lucide-react';
import './Terminal.css'; // Re-use the HUD terminal styles

const SystemInfoTerminal = () => {
  const containerRef = useRef(null);
  
  // Load position from local storage or use defaults
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('systemInfoTerminalPosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved system info terminal position", e);
      }
    }
    // Default position (top right area, below map)
    return { x: window.innerWidth - 300, y: 480 };
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
      localStorage.setItem('systemInfoTerminalPosition', JSON.stringify(positionRef.current));
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

  // Live Clock State
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live Location State
  const [locationName, setLocationName] = useState("Locating...");

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
            
            if (!apiKey) {
              console.warn("No Google Maps API Key found for reverse geocoding.");
              setLocationName("Unknown");
              return;
            }

            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);
            const data = await response.json();
            
            if (data.status === "OK" && data.results.length > 0) {
              // Try to find a locality (city) or administrative area (state)
              let city = "";
              const addressComponents = data.results[0].address_components;
              
              const localityInfo = addressComponents.find(c => c.types.includes("locality"));
              if (localityInfo) {
                city = localityInfo.long_name;
              } else {
                const adminInfo = addressComponents.find(c => c.types.includes("administrative_area_level_1"));
                if (adminInfo) {
                  city = adminInfo.long_name;
                }
              }
              
              if (city) {
                setLocationName(city);
              } else {
                setLocationName("Location Found");
              }
            } else {
              setLocationName("Unknown");
            }
          } catch (error) {
            console.error("Error fetching location details:", error);
            setLocationName("Error");
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationName("Bengaluru"); // Fallback if permission denied
        }
      );
    } else {
      setLocationName("Bengaluru"); // Fallback if not supported
    }
  }, []);

  const formatTime = (date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return { hours, minutes, seconds };
  };

  const formatDate = (date) => {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const { hours, minutes, seconds } = formatTime(time);

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
        zIndex: 997,
        height: 'auto',
        width: '260px',
        pointerEvents: 'auto',
        backgroundColor: 'rgba(4, 10, 16, 0.85)' // Slightly darker background for this specific terminal
      }}
    >
      <div
        className="hud-terminal-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', background: 'transparent', borderBottom: 'none', padding: '12px 16px' }}
      >
        <span className="glow-text-cyan-dim" style={{ fontSize: '13px', letterSpacing: '2px' }}>SYSTEM_INFO</span>
        <div style={{ marginLeft: 'auto', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#00ffe1', boxShadow: '0 0 10px #00ffe1' }}></div>
      </div>

      <div style={{ padding: '0 20px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Clock Section */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', marginTop: '10px' }}>
          <span className="glow-text-cyan" style={{ fontSize: '48px', fontWeight: 'bold', lineHeight: '1' }}>
            {hours}:{minutes}
          </span>
          <span className="glow-text-cyan-dim" style={{ fontSize: '20px', marginLeft: '4px' }}>
            :{seconds}
          </span>
        </div>
        <div className="glow-text-cyan-dim" style={{ fontSize: '12px', letterSpacing: '2px', marginTop: '8px' }}>
          {formatDate(time)}
        </div>

        <div className="sys-divider" style={{ width: '100%' }}></div>

        {/* Weather Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', width: '100%' }}>
          <Sun size={36} color="#ffcc00" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 204, 0, 0.6))' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="glow-text-cyan" style={{ fontSize: '32px', fontWeight: 'bold', lineHeight: '1' }}>30°C</span>
            <span className="glow-text-cyan-dim" style={{ fontSize: '10px', letterSpacing: '2px', marginTop: '4px' }}>CLEAR</span>
          </div>
        </div>

        <div className="sys-divider" style={{ width: '100%' }}></div>

        {/* Location Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '12px 0', backgroundColor: 'rgba(0, 255, 225, 0.05)', borderRadius: '8px' }}>
          <MapPin size={18} color="#ff4444" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 68, 68, 0.6))' }} />
          <span className="glow-text-cyan" style={{ fontSize: '16px', letterSpacing: '1px' }}>{locationName}</span>
        </div>

        <div className="sys-divider" style={{ width: '100%' }}></div>

        {/* Stats Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(0, 255, 225, 0.5)', letterSpacing: '1px' }}>UPTIME</span>
            <span className="glow-text-cyan" style={{ fontSize: '20px', fontWeight: 'bold' }}>10h</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(0, 255, 225, 0.5)', letterSpacing: '1px' }}>COMMANDS</span>
            <span className="glow-text-cyan" style={{ fontSize: '20px', fontWeight: 'bold' }}>3</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SystemInfoTerminal;
