import React from 'react'
import MainLayout from './components/Layout/MainLayout'
import MapComponent from './components/Map/MapContainer'
import { RFProvider } from './context/RFContext'


import OfflineIndicator from './components/Common/OfflineIndicator'
import UpdatePrompt from './components/Common/UpdatePrompt'

function App() {
  return (
    <RFProvider>
      <MainLayout>
        <MapComponent />
      </MainLayout>
      <OfflineIndicator />
      <UpdatePrompt />
    </RFProvider>
  )
}

export default App
