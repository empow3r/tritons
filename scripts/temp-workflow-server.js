const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'task-workflow-visualizer.html'));
});

const server = app.listen(8085, () => {
    console.log('🔄 Task Workflow Visualizer: http://localhost:8085');
    console.log('📊 Main TRITONS Dashboard: http://localhost:8080');
    console.log('');
    console.log('Features:');
    console.log('  • Real-time task processing visualization');
    console.log('  • Step-by-step workflow tracking');
    console.log('  • Live task status updates');
    console.log('  • Easy task submission interface');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🧹 Shutting down workflow visualizer...');
    server.close(() => {
        process.exit(0);
    });
});
