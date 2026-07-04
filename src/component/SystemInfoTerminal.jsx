import React, { useEffect, useRef, useState } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog, MapPin } from 'lucide-react';
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

  // Live Location and Weather State
  const [locationName, setLocationName] = useState("Locating...");
  const [weather, setWeather] = useState({ temp: 30, condition: "CLEAR" });

  useEffect(() => {
    const getPositionAndWeather = async () => {
      let lat = 22.3143; // Default Khambhāt/India coords
      let lng = 72.6256;
      let city = "Bengaluru";
      let ipData = null;

      // 1. Fetch IP-based location first as a reliable baseline
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
          ipData = await ipRes.json();
          if (ipData && ipData.city) {
            city = ipData.city;
            lat = ipData.latitude;
            lng = ipData.longitude;
            setLocationName(city);
          }
        }
      } catch (err) {
        console.error("IP Geolocation failed:", err);
      }

      // 2. Try Browser Geolocation
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const browserLat = position.coords.latitude;
              const browserLng = position.coords.longitude;

              // Check if browser location is wildly different from IP location (e.g. different country/continent)
              // Marrakesh is lat ~31.6, lng ~-8.0. If IP is India (lat ~22, lng ~72), they are ~8000km apart.
              // If the distance is > 1000km, and we have a valid IP location, we suspect the browser location might be incorrect/mocked.
              const isBrowserLocationSuspicious = ipData && 
                (ipData.country_code === "IN" && (browserLng < 60 || browserLng > 100)); // India longitude is roughly 68 to 97

              if (isBrowserLocationSuspicious) {
                console.warn("Browser geolocation returned suspicious coordinates (e.g. Marrakesh). Sticking with IP-based location:", city);
                await fetchWeather(lat, lng);
                return;
              }

              // Otherwise, use browser location and geocode it
              const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
              if (!apiKey) {
                console.warn("No Google Maps API Key found for reverse geocoding.");
                if (!ipData) setLocationName("Location Found");
                await fetchWeather(browserLat, browserLng);
                return;
              }

              const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${browserLat},${browserLng}&key=${apiKey}`);
              const data = await response.json();
              
              if (data.status === "OK" && data.results.length > 0) {
                let browserCity = "";
                const addressComponents = data.results[0].address_components;
                
                const localityInfo = addressComponents.find(c => c.types.includes("locality"));
                if (localityInfo) {
                  browserCity = localityInfo.long_name;
                } else {
                  const adminInfo = addressComponents.find(c => c.types.includes("administrative_area_level_1"));
                  if (adminInfo) {
                    browserCity = adminInfo.long_name;
                  }
                }
                
                if (browserCity) {
                  // Double check if the geocoded city is Marrakesh but IP is India
                  if (browserCity.toLowerCase() === "marrakesh" && ipData && ipData.country_code === "IN") {
                    console.warn("Geocoding returned Marrakesh but IP is India. Using IP city.");
                    setLocationName(city);
                    await fetchWeather(lat, lng);
                  } else {
                    setLocationName(browserCity);
                    await fetchWeather(browserLat, browserLng);
                  }
                } else {
                  if (!ipData) setLocationName("Location Found");
                  await fetchWeather(browserLat, browserLng);
                }
              } else {
                if (!ipData) setLocationName("Unknown");
                await fetchWeather(browserLat, browserLng);
              }
            } catch (error) {
              console.error("Error fetching location details:", error);
              if (!ipData) setLocationName("Error");
              await fetchWeather(lat, lng);
            }
          },
          async (error) => {
            console.error("Geolocation error:", error);
            if (ipData) {
              setLocationName(city);
              await fetchWeather(lat, lng);
            } else {
              setLocationName("Bengaluru");
              await fetchWeather(12.9716, 77.5946);
            }
          }
        );
      } else {
        if (ipData) {
          setLocationName(city);
          await fetchWeather(lat, lng);
        } else {
          setLocationName("Bengaluru");
          await fetchWeather(12.9716, 77.5946);
        }
      }
    };

    const fetchWeather = async (latitude, longitude) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`);
        if (response.ok) {
          const data = await response.json();
          if (data && data.current) {
            const temp = Math.round(data.current.temperature_2m);
            const code = data.current.weather_code;
            
            // Map WMO weather code to condition string
            let condition = "CLEAR";
            if (code === 0) condition = "CLEAR";
            else if (code >= 1 && code <= 3) condition = "CLOUDY";
            else if (code === 45 || code === 48) condition = "FOGGY";
            else if (code >= 51 && code <= 55) condition = "DRIZZLE";
            else if (code >= 61 && code <= 65) condition = "RAINY";
            else if (code >= 71 && code <= 75) condition = "SNOWY";
            else if (code >= 80 && code <= 82) condition = "SHOWERS";
            else if (code >= 95) condition = "THUNDERSTORM";

            setWeather({ temp, condition });
          }
        }
      } catch (err) {
        console.error("Weather fetch failed:", err);
      }
    };

    getPositionAndWeather();
  }, []);

  const getWeatherIcon = (condition) => {
    const size = 36;
    switch (condition) {
      case "CLEAR":
        return <Sun size={size} color="#ffcc00" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 204, 0, 0.6))' }} />;
      case "CLOUDY":
        return <Cloud size={size} color="#a0aec0" style={{ filter: 'drop-shadow(0 0 10px rgba(160, 174, 192, 0.6))' }} />;
      case "FOGGY":
        return <CloudFog size={size} color="#cbd5e0" style={{ filter: 'drop-shadow(0 0 10px rgba(203, 213, 224, 0.6))' }} />;
      case "DRIZZLE":
        return <CloudDrizzle size={size} color="#a0c0ff" style={{ filter: 'drop-shadow(0 0 10px rgba(160, 192, 255, 0.6))' }} />;
      case "RAINY":
      case "SHOWERS":
        return <CloudRain size={size} color="#63b3ed" style={{ filter: 'drop-shadow(0 0 10px rgba(99, 179, 237, 0.6))' }} />;
      case "SNOWY":
        return <CloudSnow size={size} color="#ebf8ff" style={{ filter: 'drop-shadow(0 0 10px rgba(235, 248, 255, 0.6))' }} />;
      case "THUNDERSTORM":
        return <CloudLightning size={size} color="#f6e05e" style={{ filter: 'drop-shadow(0 0 10px rgba(246, 224, 94, 0.6))' }} />;
      default:
        return <Sun size={size} color="#ffcc00" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 204, 0, 0.6))' }} />;
    }
  };

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
          {getWeatherIcon(weather.condition)}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span className="glow-text-cyan" style={{ fontSize: '32px', fontWeight: 'bold', lineHeight: '1' }}>{weather.temp}°C</span>
            <span className="glow-text-cyan-dim" style={{ fontSize: '10px', letterSpacing: '2px', marginTop: '4px' }}>{weather.condition}</span>
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
