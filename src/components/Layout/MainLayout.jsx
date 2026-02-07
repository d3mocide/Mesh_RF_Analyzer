import React from 'react';
import Sidebar from './Sidebar';

const MainLayout = ({ children }) => {
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{ flex: 1, position: 'relative' }}>
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
