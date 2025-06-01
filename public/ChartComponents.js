
// Function to create a new chart for a device
function createChart(parent, deviceKey, nodeId, endpoint) {
    // Create canvas element
    const container = document.createElement('div');
    container.className = 'chart-container';
    const canvas = document.createElement('canvas');
    container.className = 'chart-container';
    canvas.id = `chart_${deviceKey}`;
    container.appendChild(canvas);
    parent.appendChild(container);

    // Initialize Chart.js
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: "",
                data: [],
                borderColor: getNextColor(),
                backgroundColor: 'transparent', // Remove fill for cleaner look
                borderWidth: 2, // Slightly thicker line for visibility
                pointRadius: 0, // Remove points to reduce clutter
                tension: 0.2 // Less curve for simpler appearance
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow stretching to fit container
            scales: {
                x: {
                    title: { display: false }, // Hide x-axis title to save space
                    ticks: {
                        maxTicksLimit: 5, // Limit x-axis ticks
                        font: { size: 10 } // Smaller font for ticks
                    },
                    grid: { display: false } // Hide x-axis grid lines
                },
                y: {
                    title: { display: false }, // Hide y-axis title
                    ticks: {
                        maxTicksLimit: 4, // Limit y-axis ticks
                        font: { size: 10 }, // Smaller font
                        callback: function (value) {return Number(value).toFixed(0)} // Round 
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.1)' } // Lighten grid lines
                }
            },
            plugins: {
                legend: { display: false }, // Hide legend to save space
                tooltip: {
                    enabled: true,
                    mode: 'nearest',
                    intersect: false,
                    titleFont: { size: 10 },
                    bodyFont: { size: 10 },
                    callbacks: {
                        label: function (context) {
                            return `${context.parsed.y}°F`; // Simplified tooltip
                        }
                    }
                }
            },
            animation: false // Disable animations for performance
        }
    });

    return chart;
}

function updateChart(deviceKey, temperature, timestamp = null) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    sensorDataByDevice[deviceKey].readings.push({ time, temperature: temperature });

    if (sensorDataByDevice[deviceKey].readings.length > 180) sensorDataByDevice[deviceKey].readings.shift();
    const chart = sensorDataByDevice[deviceKey].chart;
    chart.data.labels = sensorDataByDevice[deviceKey].readings.map(data => data.time);
    chart.data.datasets[0].data = sensorDataByDevice[deviceKey].readings.map(data => data.temperature);
    chart.update();
}

// Generate distinct colors for each device
const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6b7280', '#84cc16'
];
let colorIndex = 0;

function getNextColor() {
    const color = colors[colorIndex % colors.length];
    colorIndex++;
    return color;
}


