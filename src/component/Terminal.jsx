import './Terminal.css';
import { Terminal as TerminalIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const Terminal = ({ messages, interimText }) => {
  const terminalRef = useRef(null);
  const containerRef = useRef(null);

  // Load position from local storage or use defaults
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('terminalPosition');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved terminal position", e);
      }
    }
    // Default position (centered at bottom)
    return { x: window.innerWidth / 2 - 400, y: window.innerHeight - 140 };
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
      localStorage.setItem('terminalPosition', JSON.stringify(positionRef.current));
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [messages, interimText]);

  return (
    <div
      className="hud-terminal-container"
      ref={containerRef}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        position: 'fixed',
        transform: 'none',
        zIndex: 1000
      }}
    >
      <div
        className="hud-terminal-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' }}
      >
        <TerminalIcon size={14} className="terminal-icon" />
        <span>SYSTEM.VOICE.RECOGNITION_MODULE</span>
        <div className="terminal-status-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div className="hud-terminal-body" ref={terminalRef}>
        {messages && messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div key={index} className={`terminal-message ${isUser ? 'user' : 'assistant'}`}>
              <span className="prompt-arrow" style={{ color: isUser ? '#00ffe1' : '#ff00ff' }}>
                {isUser ? 'USER >' : 'Lyra>'}
              </span>
              <span className="terminal-text" style={{ color: isUser ? '#a0fcfc' : '#fca0fc', marginLeft: '8px' }}>
                {msg.text}
              </span>
            </div>
          );
        })}

        {interimText && (
          <div className="terminal-prompt">
            <span className="prompt-arrow" style={{ color: '#00ffe1' }}>&gt;</span>
            <span className="terminal-text" style={{ color: '#a0fcfc', marginLeft: '8px' }}>{interimText}</span>
            <span className="terminal-cursor" style={{ color: '#00ffe1' }}>_</span>
          </div>
        )}

        {!interimText && (
          <div className="terminal-prompt">
            <span className="prompt-arrow" style={{ color: '#00ffe1' }}>&gt;</span>
            <span className="terminal-text" style={{ color: '#a0fcfc', marginLeft: '8px' }}>Awaiting voice input...</span>
            <span className="terminal-cursor" style={{ color: '#00ffe1' }}>_</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
