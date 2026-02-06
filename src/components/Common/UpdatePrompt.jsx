import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdatePrompt = () => {
  // Defensive destructuring to prevent crash if hook returns unexpected structure
  const sw = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  // Defensive extraction
  const offlineReadyState = sw && Array.isArray(sw.offlineReady) ? sw.offlineReady : [false, () => {}];
  const needUpdateState = sw && Array.isArray(sw.needUpdate) ? sw.needUpdate : [false, () => {}];
  
  const [offlineReady, setOfflineReady] = offlineReadyState;
  const [needUpdate, setNeedUpdate] = needUpdateState;
  const updateServiceWorker = sw?.updateServiceWorker;

  const close = () => {
    if (typeof setOfflineReady === 'function') setOfflineReady(false);
    if (typeof setNeedUpdate === 'function') setNeedUpdate(false);
  };

  if (!offlineReady && !needUpdate) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'calc(var(--safe-area-top, 0px) + 20px)',
      right: '20px',
      backgroundColor: '#1a1a2e',
      border: '1px solid #00f2ff',
      color: 'white',
      padding: '16px',
      borderRadius: '12px',
      zIndex: 10000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      maxWidth: '300px',
      animation: 'slideIn 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
      backdropFilter: 'blur(10px)'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#00f2ff', fontSize: '16px' }}>
        {needUpdate ? 'Update Available' : 'Ready for Offline'}
      </h4>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.4', opacity: 0.8 }}>
        {needUpdate 
          ? 'An update is available for MeshRF. Refresh for the latest features.' 
          : 'MeshRF is now ready to work offline.'}
      </p>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        {needUpdate && (
          <button 
            onClick={() => updateServiceWorker(true)}
            style={{
              flex: 1,
              backgroundColor: '#00f2ff',
              color: '#0a0a0f',
              border: 'none',
              padding: '8px',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Refresh Now
          </button>
        )}
        <button 
          onClick={close}
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Dismiss
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default UpdatePrompt;
