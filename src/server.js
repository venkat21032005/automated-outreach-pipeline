const express = require('express');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

const DATA_DIR = path.join(__dirname, '../data');

/**
 * Initializes and starts the Express dashboard server.
 * 
 * @param {number} port - Port number.
 * @returns {Object} Express listener server instance.
 */
function startServer(port = 3000) {
  const app = express();

  app.use(express.json());

  // Helper to read JSON safely from data folder
  const readJsonFile = (filePath) => {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        logger.error(`[Express] Failed to parse JSON file at ${filePath}: ${e.message}`);
        return { error: 'Failed to parse JSON file' };
      }
    }
    return [];
  };

  // API Endpoints for stages and live tracking
  app.get('/api/state', (req, res) => {
    const stateFile = path.join(DATA_DIR, 'pipelineState.json');
    if (fs.existsSync(stateFile)) {
      const state = readJsonFile(stateFile);
      res.json({ active: true, ...state });
    } else {
      res.json({ active: false, message: 'No active pipeline run' });
    }
  });

  app.get('/api/companies', (req, res) => {
    res.json(readJsonFile(path.join(DATA_DIR, 'similarCompanies.json')));
  });

  app.get('/api/contacts', (req, res) => {
    res.json(readJsonFile(path.join(DATA_DIR, 'contacts.json')));
  });

  app.get('/api/emails', (req, res) => {
    res.json(readJsonFile(path.join(DATA_DIR, 'verifiedEmails.json')));
  });

  app.get('/api/summary', (req, res) => {
    res.json(readJsonFile(path.join(DATA_DIR, 'emailSummary.json')));
  });

  // Serve static dashboard page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
  });

  // 404 Route handling
  app.use((req, res) => {
    res.status(404).send('Not Found');
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    logger.error(`[Express Error] ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  const server = app.listen(port, () => {
    logger.info(`[Express] Dashboard server successfully running at http://localhost:${port}`);
    logger.info(`[Express] Open this link in your browser to monitor pipeline execution.`);
  });

  return server;
}

module.exports = { startServer };
