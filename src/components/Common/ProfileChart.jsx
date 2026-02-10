
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ProfileChart = ({ data }) => {
    if (!data || !data.terrain_profile) return null;

    const terrain = data.terrain_profile;
    const los = data.los_profile;
    const fresnel = data.fresnel_profile;
    const dist = data.dist_km;
    
    // Create labels (distance markers)
    const labels = terrain.map((_, i) => {
        return (i / (terrain.length - 1) * dist).toFixed(1);
    });

    // Fresnel Bounds
    const fresnelTop = los.map((h, i) => h + fresnel[i]);
    const fresnelBottom = los.map((h, i) => h - fresnel[i]);

    const chartData = {
        labels,
        datasets: [
            {
                label: 'Terrain',
                data: terrain,
                borderColor: '#8B4513',
                backgroundColor: 'rgba(139, 69, 19, 0.6)',
                fill: true,
                pointRadius: 0,
                borderWidth: 2,
                tension: 0.1, // Slight smoothing for terrain
            },
            {
                label: 'Line of Sight',
                data: los,
                borderColor: data.min_clearance_ratio >= 0.6 ? '#00ff41' : (data.min_clearance_ratio >= 0 ? '#eeff00' : '#ff0000'),
                borderWidth: 2,
                pointRadius: 0,
                borderDash: [5, 5],
                fill: false,
            },
            {
                label: 'Fresnel Zone',
                data: fresnelTop,
                borderColor: 'rgba(0, 242, 255, 0.3)',
                backgroundColor: 'rgba(0, 242, 255, 0.1)',
                borderWidth: 1,
                pointRadius: 0,
                fill: '+1', // Fill to next dataset (fresnelBottom)
            },
            {
                label: 'Fresnel Bottom',
                data: fresnelBottom,
                borderColor: 'rgba(0, 242, 255, 0.3)',
                borderWidth: 1,
                pointRadius: 0,
                fill: false,
                hidden: true, // Hide from legend
            }
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#ccc' }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
            title: {
                display: true,
                text: `Link Profile (${dist.toFixed(2)} km)`,
                color: '#fff'
            },
        },
        scales: {
            x: {
                title: { display: true, text: 'Distance (km)', color: '#888' },
                ticks: { color: '#888', maxTicksLimit: 10 },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
                title: { display: true, text: 'Elevation (m)', color: '#888' },
                ticks: { color: '#888' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        },
        maintainAspectRatio: false,
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    return (
        <div style={{ height: '300px', width: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
            <Line data={chartData} options={options} />
        </div>
    );
};

export default ProfileChart;
