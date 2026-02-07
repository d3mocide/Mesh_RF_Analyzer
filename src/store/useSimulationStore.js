import { create } from 'zustand';

const useSimulationStore = create((set, get) => ({
  // --- State ---
  nodes: [], // List of candidate nodes: { id, lat, lon, height, name }
  results: null, // Results from batch scan
  compositeOverlay: null, // { image, bounds } for union of visibility
  isScanning: false,
  scanProgress: 0,
  taskId: null,
  
  // --- Actions ---
  addNode: (node) => set((state) => ({ 
    nodes: [...state.nodes, { ...node, id: crypto.randomUUID() }] 
  })),
  
  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== id)
  })),
  
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map((n) => n.id === id ? { ...n, ...updates } : n)
  })),

  setNodes: (nodes) => set({ 
    nodes: nodes.map(n => ({ ...n, id: n.id || crypto.randomUUID() })),
    results: null,
    compositeOverlay: null
  }),
  
  clearNodes: () => set({ nodes: [] }),
  
  reset: () => set({
    nodes: [],
    results: null,
    compositeOverlay: null,
    isScanning: false,
    scanProgress: 0,
    taskId: null
  }),
  
  startScan: async (optimizeN = null) => {
    const { nodes } = get();
    if (nodes.length === 0) return;
    
    set({ isScanning: true, scanProgress: 0, results: null, compositeOverlay: null });
    
    try {
      const API_TARGET = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      
      // 1. Trigger Scan
      const response = await fetch(`${API_TARGET}/scan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, optimize_n: optimizeN }),
      });
      
      const data = await response.json();
      if (data.status === 'started') {
        set({ taskId: data.task_id });
        get().listenToProgress(data.task_id);
      } else {
        console.error('Scan failed to start:', data);
        set({ isScanning: false });
      }
    } catch (error) {
      console.error('Scan error:', error);
      set({ isScanning: false });
    }
  },
  
  listenToProgress: (taskId) => {
    const API_TARGET = import.meta.env.VITE_API_URL || 'http://localhost:5001';
    const eventSource = new EventSource(`${API_TARGET}/task_status/${taskId}`);
    
    eventSource.onmessage = (event) => {
      let payload;
      try {
          payload = JSON.parse(event.data);
      } catch (e) {
          console.error("Failed to parse SSE data", event.data);
          return;
      }
      if (payload.event === 'progress') {
        const progressVal = payload.data?.progress || 0;
        set({ scanProgress: progressVal });
      } else if (payload.event === 'complete') {
        const actualResults = payload.data?.results || [];
        const composite = payload.data?.composite || null;
        set({ 
          isScanning: false, 
          scanProgress: 100, 
          results: actualResults,
          compositeOverlay: composite 
        });
        eventSource.close();
      } else if (payload.event === 'error') {
        console.error('Task error:', payload.data);
        set({ isScanning: false });
        eventSource.close();
      }
    };
    
    eventSource.onerror = (err) => {
      // Check if it's a normal closure (readyState 0 or 2)
      if (eventSource.readyState === 2) {
         // Connection closed, not necessarily an error if we are done
         // But usually 'complete' event handles the close.
         // If we get here without complete, it might be a drop.
         console.log('SSE Connection closed');
      } else {
         console.error('SSE Error:', err);
         set({ isScanning: false });
      }
      eventSource.close();
    };

    eventSource.onopen = () => {
        console.log("SSE Connected");
    };
  }
}));

export default useSimulationStore;
