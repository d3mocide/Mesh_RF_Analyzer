import React, { useState, useEffect } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
    viable:   '#00f2ff',
    degraded: '#ffd700',
    blocked:  '#ff4444',
    unknown:  '#888',
};

const STATUS_LABELS = {
    viable:   'Viable',
    degraded: 'Degraded',
    blocked:  'Blocked',
    unknown:  'Unknown',
};

function statusBadge(status) {
    const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;
    return (
        <span style={{
            fontSize: '0.7em',
            fontWeight: 700,
            color,
            border: `1px solid ${color}44`,
            background: `${color}18`,
            borderRadius: '4px',
            padding: '2px 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
        }}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}

/** Build adjacency list and find all viable multi-hop paths between every pair */
function findMeshPaths(results, interNodeLinks) {
    if (!results || !interNodeLinks) return [];
    const n = results.length;
    // adjacency: node_idx -> list of {neighbor, status}
    const adj = Array.from({ length: n }, () => []);
    for (const link of interNodeLinks) {
        if (link.status === 'viable' || link.status === 'degraded') {
            adj[link.node_a_idx].push({ neighbor: link.node_b_idx, status: link.status });
            adj[link.node_b_idx].push({ neighbor: link.node_a_idx, status: link.status });
        }
    }

    const paths = [];
    // BFS shortest path for all pairs
    for (let src = 0; src < n; src++) {
        for (let dst = src + 1; dst < n; dst++) {
            // BFS
            const visited = new Array(n).fill(false);
            const queue = [{ node: src, path: [src], worstStatus: 'viable' }];
            visited[src] = true;
            let found = null;
            while (queue.length > 0 && !found) {
                const { node, path, worstStatus } = queue.shift();
                for (const { neighbor, status } of adj[node]) {
                    if (!visited[neighbor]) {
                        const newWorst = (worstStatus === 'degraded' || status === 'degraded') ? 'degraded' : 'viable';
                        const newPath = [...path, neighbor];
                        if (neighbor === dst) {
                            found = { path: newPath, status: newWorst };
                        } else {
                            visited[neighbor] = true;
                            queue.push({ node: neighbor, path: newPath, worstStatus: newWorst });
                        }
                    }
                }
            }
            if (found) {
                paths.push({
                    src,
                    dst,
                    path: found.path,
                    status: found.status,
                    hops: found.path.length - 1
                });
            } else {
                paths.push({ src, dst, path: [src, dst], status: 'blocked', hops: 1 });
            }
        }
    }
    return paths;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function SitesTab({ results, units, onCenter }) {
    return (
        <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
            {results.map((res, index) => {
                const connScore = res.connectivity_score ?? 0;
                const connMax = results.length - 1;
                const connColor = connMax === 0 ? '#888'
                    : connScore === connMax ? '#00f2ff'
                    : connScore > 0 ? '#ffd700'
                    : '#ff4444';

                const uniquePct = res.unique_coverage_pct ?? 100;
                const uniqueColor = uniquePct >= 70 ? '#00f2ff'
                    : uniquePct >= 30 ? '#ffd700'
                    : '#ff4444';

                return (
                    <div
                        key={index}
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => onCenter(res)}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(0,242,255,0.08)';
                            e.currentTarget.style.borderColor = 'rgba(0,242,255,0.2)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>
                                {res.name || `Site ${index + 1}`}
                            </span>
                            <span style={{ color: '#00f2ff', fontSize: '0.75em', fontFamily: 'monospace' }}>
                                {res.lat.toFixed(4)}, {res.lon.toFixed(4)}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                                <div style={{ fontSize: '0.65em', color: '#888', textTransform: 'uppercase' }}>Elevation</div>
                                <div style={{ color: '#00f2ff', fontWeight: 'bold', fontSize: '1.0em' }}>
                                    {units === 'imperial'
                                        ? `${(res.elevation * 3.28084).toFixed(1)} ft`
                                        : `${res.elevation} m`}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.65em', color: '#888', textTransform: 'uppercase' }}>Coverage Area</div>
                                <div style={{ color: '#00f2ff', fontWeight: 'bold', fontSize: '1.0em' }}>
                                    {units === 'imperial'
                                        ? `${(res.coverage_area_km2 * 0.386102).toFixed(2)} mi²`
                                        : `${res.coverage_area_km2} km²`}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.65em', color: '#888', textTransform: 'uppercase' }}>Unique Coverage</div>
                                <div style={{ color: uniqueColor, fontWeight: 'bold', fontSize: '1.0em' }}>
                                    {uniquePct.toFixed(0)}%
                                    <span style={{ fontSize: '0.75em', color: '#666', marginLeft: '4px' }}>
                                        ({units === 'imperial'
                                            ? `${((res.marginal_coverage_km2 || 0) * 0.386102).toFixed(2)} mi²`
                                            : `${(res.marginal_coverage_km2 || 0).toFixed(2)} km²`})
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.65em', color: '#888', textTransform: 'uppercase' }}>Links</div>
                                <div style={{ color: connColor, fontWeight: 'bold', fontSize: '1.0em' }}>
                                    {connScore}/{connMax} nodes
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function LinksTab({ results, interNodeLinks, units }) {
    if (!interNodeLinks || interNodeLinks.length === 0) {
        return (
            <div style={{ color: '#666', textAlign: 'center', padding: '24px', fontSize: '0.9em' }}>
                {results.length < 2
                    ? 'Add at least 2 sites to see link analysis.'
                    : 'No link data available.'}
            </div>
        );
    }

    const sortedLinks = [...interNodeLinks].sort((a, b) => {
        const order = { viable: 0, degraded: 1, blocked: 2, unknown: 3 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

    return (
        <div style={{ overflowY: 'auto', flexGrow: 1 }}>
            <div style={{ fontSize: '0.75em', color: '#666', marginBottom: '10px' }}>
                {interNodeLinks.length} link{interNodeLinks.length !== 1 ? 's' : ''} between {results.length} sites
            </div>
            {sortedLinks.map((link, i) => {
                const color = STATUS_COLORS[link.status] || '#888';
                return (
                    <div
                        key={i}
                        style={{
                            background: `${color}08`,
                            border: `1px solid ${color}25`,
                            borderLeft: `3px solid ${color}`,
                            borderRadius: '6px',
                            padding: '10px 12px',
                            marginBottom: '8px',
                            fontSize: '0.88em'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ color: '#fff', fontWeight: 600 }}>
                                {link.node_a_name} → {link.node_b_name}
                            </span>
                            {statusBadge(link.status)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', color: '#aaa', fontSize: '0.9em' }}>
                            <div>
                                <div style={{ color: '#555', fontSize: '0.8em', textTransform: 'uppercase' }}>Distance</div>
                                <div style={{ color: '#ccc' }}>
                                    {units === 'imperial'
                                        ? `${(link.dist_km * 0.621371).toFixed(2)} mi`
                                        : `${link.dist_km.toFixed(2)} km`}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: '#555', fontSize: '0.8em', textTransform: 'uppercase' }}>Path Loss</div>
                                <div style={{ color: '#ccc' }}>{link.path_loss_db} dB</div>
                            </div>
                            <div>
                                <div style={{ color: '#555', fontSize: '0.8em', textTransform: 'uppercase' }}>Fresnel</div>
                                <div style={{ color: link.min_clearance_ratio >= 0.6 ? '#00f2ff' : link.min_clearance_ratio >= 0 ? '#ffd700' : '#ff4444' }}>
                                    {link.min_clearance_ratio > 50 ? 'Clear' : `${(link.min_clearance_ratio * 100).toFixed(0)}%`}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TopologyTab({ results, interNodeLinks }) {
    const paths = findMeshPaths(results, interNodeLinks);

    const viableDirect = (interNodeLinks || []).filter(l => l.status === 'viable').length;
    const degradedDirect = (interNodeLinks || []).filter(l => l.status === 'degraded').length;
    const blockedDirect = (interNodeLinks || []).filter(l => l.status === 'blocked').length;

    const multihopViable = paths.filter(p => p.status !== 'blocked' && p.hops > 1).length;
    const totalPairs = paths.length;
    const reachable = paths.filter(p => p.status !== 'blocked').length;

    const meshScore = totalPairs > 0 ? Math.round((reachable / totalPairs) * 100) : 0;
    const meshScoreColor = meshScore >= 80 ? '#00f2ff' : meshScore >= 50 ? '#ffd700' : '#ff4444';

    return (
        <div style={{ overflowY: 'auto', flexGrow: 1 }}>
            {/* Mesh health summary */}
            <div style={{
                background: 'rgba(0,242,255,0.05)',
                border: '1px solid rgba(0,242,255,0.15)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px'
            }}>
                <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Mesh Connectivity Score
                </div>
                <div style={{ fontSize: '1.8em', fontWeight: 700, color: meshScoreColor, marginBottom: '4px' }}>
                    {meshScore}%
                </div>
                <div style={{ fontSize: '0.78em', color: '#666' }}>
                    {reachable} of {totalPairs} node pair{totalPairs !== 1 ? 's' : ''} reachable (direct or multi-hop)
                </div>
            </div>

            {/* Direct link summary */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '8px',
                marginBottom: '12px'
            }}>
                {[
                    { label: 'Viable', count: viableDirect, color: '#00f2ff' },
                    { label: 'Degraded', count: degradedDirect, color: '#ffd700' },
                    { label: 'Blocked', count: blockedDirect, color: '#ff4444' }
                ].map(({ label, count, color }) => (
                    <div key={label} style={{
                        background: `${color}0c`,
                        border: `1px solid ${color}30`,
                        borderRadius: '6px',
                        padding: '8px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.4em', fontWeight: 700, color }}>{count}</div>
                        <div style={{ fontSize: '0.65em', color: '#666', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                ))}
            </div>

            {multihopViable > 0 && (
                <div style={{
                    background: 'rgba(255,215,0,0.05)',
                    border: '1px solid rgba(255,215,0,0.15)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    marginBottom: '12px',
                    fontSize: '0.8em',
                    color: '#ffd700'
                }}>
                    {multihopViable} blocked pair{multihopViable !== 1 ? 's' : ''} reachable via multi-hop relay
                </div>
            )}

            {/* Path table */}
            {paths.length > 0 && (
                <>
                    <div style={{ fontSize: '0.7em', color: '#555', textTransform: 'uppercase', marginBottom: '6px' }}>
                        All Paths
                    </div>
                    {paths.map((p, i) => {
                        const color = STATUS_COLORS[p.status] || '#888';
                        const pathStr = p.path.map(idx => results[idx]?.name || `Site ${idx + 1}`).join(' → ');
                        return (
                            <div key={i} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 8px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                fontSize: '0.82em'
                            }}>
                                <span style={{ color: '#bbb', flex: 1, marginRight: '8px', wordBreak: 'break-word' }}>
                                    {pathStr}
                                </span>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                    {p.hops > 1 && (
                                        <span style={{ fontSize: '0.75em', color: '#666' }}>{p.hops} hops</span>
                                    )}
                                    {statusBadge(p.status)}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

const TABS = ['Sites', 'Links', 'Topology'];

const SiteAnalysisResultsPanel = ({
    results,
    interNodeLinks,
    totalUniqueCoverageKm2,
    onClose,
    onCenter,
    onClear,
    onRunNew,
    units
}) => {
    const [isMinimized, setIsMinimized] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [activeTab, setActiveTab] = useState('Sites');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const panelStyle = {
        position: 'absolute',
        top: isMobile ? 'auto' : '25px',
        bottom: isMobile ? '0' : 'auto',
        right: isMobile ? '0' : '25px',
        left: isMobile ? '0' : 'auto',
        width: isMobile ? '100%' : '380px',
        maxHeight: isMinimized ? '60px' : (isMobile ? '85dvh' : '680px'),
        background: 'rgba(10, 10, 15, 0.98)',
        backdropFilter: 'blur(15px)',
        border: isMobile ? 'none' : '1px solid #00f2ff33',
        borderTop: '1px solid #00f2ff33',
        borderRadius: isMobile ? '20px 20px 0 0' : '12px',
        padding: '16px',
        paddingBottom: isMobile ? 'calc(32px + env(safe-area-inset-bottom))' : '16px',
        color: '#eee',
        zIndex: 2500,
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden'
    };

    const helpItems = {
        Sites: [
            { term: 'Elevation', def: 'Ground elevation at this location. Higher sites generally improve LOS coverage.' },
            { term: 'Coverage Area', def: 'Total terrain area visible from this site within the scan radius.' },
            { term: 'Unique Coverage', def: 'Percentage of this node\'s coverage area that is not covered by any other selected site. Low % = redundant placement.' },
            { term: 'Links', def: 'Number of other selected sites this node has a viable or degraded RF link to.' }
        ],
        Links: [
            { term: 'Viable', def: 'Fresnel zone ≥60% clear. Full link budget margin expected.' },
            { term: 'Degraded', def: 'Fresnel zone 0–60% clear. Link may work but with reduced margin.' },
            { term: 'Blocked', def: 'Terrain obstructs the direct LOS path. Link unlikely without relay.' },
            { term: 'Path Loss', def: 'Estimated Bullington diffraction + free-space path loss (dB). Compare to your link budget.' },
            { term: 'Fresnel', def: 'Fresnel zone clearance ratio at the most obstructed point. ≥60% is the target.' }
        ],
        Topology: [
            { term: 'Mesh Score', def: 'Percentage of all node pairs that can communicate (directly or via relay). 100% = fully connected mesh.' },
            { term: 'Multi-hop relay', def: 'A path with ≥2 hops means nodes that cannot reach each other directly can still pass traffic through an intermediate node.' }
        ]
    };

    return (
        <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600, color: '#00f2ff' }}>
                        Site Analysis Results
                    </h3>
                    <div style={{ fontSize: '0.75em', color: '#666' }}>
                        {results.length} site{results.length !== 1 ? 's' : ''}
                        {totalUniqueCoverageKm2 != null && (
                            <span> · {units === 'imperial'
                                ? `${(totalUniqueCoverageKm2 * 0.386102).toFixed(2)} mi²`
                                : `${totalUniqueCoverageKm2.toFixed(2)} km²`} combined
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ color: '#00f2ff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                        onClick={(e) => { e.stopPropagation(); setShowHelp(!showHelp); }}
                        style={{
                            cursor: 'pointer',
                            color: '#00f2ff',
                            fontSize: '14px',
                            padding: '4px 8px',
                            background: showHelp ? 'rgba(0,242,255,0.15)' : 'rgba(0,242,255,0.05)',
                            borderRadius: '4px',
                            border: '1px solid rgba(0,242,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>Help</span>
                    </div>
                    {isMinimized ? '▲' : '▼'}
                </div>
            </div>

            {/* Help Overlay */}
            {showHelp && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(10,10,15,0.98)',
                    backdropFilter: 'blur(15px)',
                    border: '1px solid #00f2ff44',
                    borderRadius: isMobile ? '20px 20px 0 0' : '12px',
                    padding: '24px',
                    zIndex: 3000,
                    display: 'flex',
                    flexDirection: 'column',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    animation: 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                    <div style={{ color: '#00f2ff', fontWeight: 'bold', marginBottom: '12px', fontSize: '1.1em' }}>
                        {activeTab} — Field Guide
                    </div>
                    <div style={{ overflowY: 'auto', flexGrow: 1 }}>
                        {(helpItems[activeTab] || []).map(({ term, def }) => (
                            <div key={term} style={{ marginBottom: '12px' }}>
                                <div style={{ color: '#00f2ff', fontWeight: 600 }}>{term}</div>
                                <div style={{ color: '#aaa', fontSize: '0.9em' }}>{def}</div>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowHelp(false)}
                        style={{
                            marginTop: '12px', width: '100%',
                            background: 'rgba(0,242,255,0.1)', border: '1px solid #00f2ff66',
                            color: '#00f2ff', padding: '12px', borderRadius: '8px',
                            cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                        }}
                        onMouseOver={e => e.target.style.background = 'rgba(0,242,255,0.2)'}
                        onMouseOut={e => e.target.style.background = 'rgba(0,242,255,0.1)'}
                    >
                        Got it
                    </button>
                    <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }`}</style>
                </div>
            )}

            {/* Content */}
            {!isMinimized && (
                <>
                    {/* Tab bar */}
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        marginBottom: '12px',
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        padding: '3px'
                    }}>
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    flex: 1,
                                    padding: '6px 0',
                                    background: activeTab === tab ? 'rgba(0,242,255,0.15)' : 'transparent',
                                    border: activeTab === tab ? '1px solid rgba(0,242,255,0.3)' : '1px solid transparent',
                                    borderRadius: '6px',
                                    color: activeTab === tab ? '#00f2ff' : '#666',
                                    fontSize: '0.82em',
                                    fontWeight: activeTab === tab ? 700 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minHeight: 0 }}>
                        {activeTab === 'Sites' && (
                            <SitesTab results={results} units={units} onCenter={onCenter} />
                        )}
                        {activeTab === 'Links' && (
                            <LinksTab results={results} interNodeLinks={interNodeLinks} units={units} />
                        )}
                        {activeTab === 'Topology' && (
                            <TopologyTab results={results} interNodeLinks={interNodeLinks} />
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                            onClick={onRunNew}
                            style={{
                                padding: '10px',
                                background: 'rgba(0,242,255,0.15)',
                                color: '#00f2ff',
                                border: '1px solid rgba(0,242,255,0.3)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={e => e.target.style.background = 'rgba(0,242,255,0.25)'}
                            onMouseOut={e => e.target.style.background = 'rgba(0,242,255,0.15)'}
                        >
                            Run New Analysis
                        </button>
                        <button
                            onClick={onClear}
                            style={{
                                padding: '10px',
                                background: 'rgba(255,50,50,0.1)',
                                color: '#ff4444',
                                border: '1px solid rgba(255,50,50,0.2)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.9em'
                            }}
                            onMouseOver={e => e.target.style.background = 'rgba(255,50,50,0.2)'}
                            onMouseOut={e => e.target.style.background = 'rgba(255,50,50,0.1)'}
                        >
                            Clear Results
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default SiteAnalysisResultsPanel;
