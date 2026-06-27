import React from 'react';
import fallbackImage from '../images/backgroundimage.jpg';

const Background = () => {
  const bgType = import.meta.env.VITE_BG_TYPE;

  // We're switching to native video playback for much better performance
  // instead of embedding a heavy YouTube iframe.
  const videoUrl = '/bg_video_h264.mp4';

  // Use the env variable if provided, otherwise use the imported fallback image
  const imageUrl = import.meta.env.VITE_BG_IMAGE_URL || fallbackImage;

  if (bgType === 'youtube') {
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        zIndex: -1, overflow: 'hidden', pointerEvents: 'none',
        backgroundColor: '#000'
      }}>
        <video
          autoPlay
          muted
          loop
          playsInline
          src={videoUrl}
          type="video/mp4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        {/* Overlay to dim the video to make text readable */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(4, 8, 20, 0.6)'
        }} />
      </div>
    );
  }

  // Fallback / Image background
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100vh',
      zIndex: -1, pointerEvents: 'none',
      backgroundImage: `url(${imageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#16171d'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(4, 8, 20, 0.4)'
      }} />
    </div>
  );
};

export default Background;
