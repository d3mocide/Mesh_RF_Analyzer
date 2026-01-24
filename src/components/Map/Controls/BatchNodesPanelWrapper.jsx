import React from 'react';
import { useMap } from 'react-leaflet';
import BatchNodesPanel from '../BatchNodesPanel';

// Wrapper component to access map instance for BatchNodesPanel
const BatchNodesPanelWrapper = ({ nodes, selectedNodes, onClear, onNodeSelect, forceMinimized = false }) => {
  const map = useMap();
  
  const handleCenter = (node) => {
    map.flyTo([node.lat, node.lng], 15, { duration: 1.5 });
  };

  const handleNodeSelect = (node) => {
    handleCenter(node);
    if (onNodeSelect) onNodeSelect(node);
  };
  
  return <BatchNodesPanel nodes={nodes} selectedNodes={selectedNodes} onCenter={handleCenter} onClear={onClear} onNodeSelect={handleNodeSelect} forceMinimized={forceMinimized} />;
};

export default BatchNodesPanelWrapper;
