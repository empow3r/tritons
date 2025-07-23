#!/usr/bin/env node
// Simple workflow visualizer server
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8085;

// Serve static files
app.use(express.static(__dirname));

// Main route
app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'task-workflow-visualizer.html');
    
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.status(404).send('Workflow visualizer not found');
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', port: PORT });
});

const server = app.listen(PORT, () => {
    console.log(`🔄 Task Workflow Visualizer running on http://localhost:${PORT}`);
    console.log(`📊 Main TRITONS Dashboard: http://localhost:8080`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🧹 Shutting down workflow visualizer...');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🧹 Shutting down workflow visualizer...');
    server.close(() => {
        process.exit(0);
    });
});