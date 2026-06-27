import React, { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, Truck } from 'lucide-react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import './Terminal.css'; // Re-use the HUD terminal styles

// Dark mode map style matching the HUD theme
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

// Component to handle programmatic map movements based on global events
const MapEffectHandler = ({ vehicles, setSelectedVehicle }) => {
  const map = useMap();
  
  useEffect(() => {
    const handleFocus = (event) => {
      const vehicleNum = event.detail.id;
      const vehicle = vehicles.find(v => v.id.toUpperCase() === vehicleNum.toUpperCase());
      if (vehicle && map) {
        // Smoothly pan to the vehicle and zoom in
        map.panTo(vehicle.position);
        map.setZoom(12);
        
        // Auto-open the InfoWindow for this vehicle
        setSelectedVehicle(vehicle);
      }
    };
    
    window.addEventListener('focus-vehicle', handleFocus);
    return () => window.removeEventListener('focus-vehicle', handleFocus);
  }, [map, vehicles, setSelectedVehicle]);

  return null;
};

const MapTerminal = () => {
  const containerRef = useRef(null);
  
  // Load position from local storage or use defaults
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('mapTerminalPosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved map terminal position", e);
      }
    }
    // Default position (top right area)
    return { x: window.innerWidth - 450, y: 100 };
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
      localStorage.setItem('mapTerminalPosition', JSON.stringify(positionRef.current));
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

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const response = await fetch('https://countrywidelogistics.in/api/v1/vehicle/gps/location');
        const data = await response.json();
        
        if (data.success && data.data && data.data.gps_list) {
          const formattedVehicles = data.data.gps_list.map(v => ({
            id: v.vehicle_number,
            position: { lat: parseFloat(v.lat), lng: parseFloat(v.long) },
            details: v
          }));
          setVehicles(formattedVehicles);
        }
      } catch (error) {
        console.error("Failed to fetch vehicle locations:", error);
      }
    };

    // Fetch immediately on load
    fetchVehicles();

    // Set interval for every 5 minutes (300000 ms)
    const intervalId = setInterval(fetchVehicles, 5 * 60 * 1000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
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
        zIndex: 999,
        height: '350px', // Map terminal needs to be taller than text terminal
        width: '400px'
      }}
    >
      <div
        className="hud-terminal-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      >
        <MapIcon size={14} className="terminal-icon" />
        <span>SYSTEM.TRACKING_MODULE.MAP</span>
        <div className="terminal-status-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div className="hud-terminal-body" style={{ padding: 0, overflow: 'hidden' }}>
        {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <Map
              mapId="hud_tracking_map"
              defaultZoom={5}
              defaultCenter={{ lat: 22.0, lng: 79.0 }}
              disableDefaultUI={true}
              styles={darkMapStyle}
              style={{ width: '100%', height: '100%' }}
            >
              <MapEffectHandler vehicles={vehicles} setSelectedVehicle={setSelectedVehicle} />
              
              {vehicles.map(vehicle => (
                <AdvancedMarker 
                  key={vehicle.id} 
                  position={vehicle.position}
                  onClick={() => setSelectedVehicle(vehicle)}
                >
                  <div style={{
                    backgroundColor: 'rgba(4, 8, 20, 0.9)',
                    border: '1px solid #00ffe1',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(0, 255, 225, 0.5)',
                    cursor: 'pointer'
                  }}>
                    <Truck size={18} color="#00ffe1" />
                  </div>
                </AdvancedMarker>
              ))}

              {selectedVehicle && (
                <InfoWindow
                  position={selectedVehicle.position}
                  onCloseClick={() => setSelectedVehicle(null)}
                >
                  <div style={{ color: '#000', padding: '4px', maxWidth: '220px', fontFamily: 'sans-serif' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0044ff', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
                      {selectedVehicle.id}
                    </h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', lineHeight: '1.4' }}>
                      {selectedVehicle.details.address}
                    </p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#666' }}>
                      <strong>Updated:</strong> {selectedVehicle.details.last_received_at}
                    </p>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '20px', color: '#ff4444' }}>
            <p>ERROR: GOOGLE MAPS API KEY NOT FOUND</p>
            <p style={{ marginTop: '10px', fontSize: '12px', color: '#a0fcfc' }}>
              Please add VITE_GOOGLE_MAPS_API_KEY to your .env file to enable tracking module.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapTerminal;
