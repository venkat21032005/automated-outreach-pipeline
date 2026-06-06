const fs = require('fs');
const path = require('path');
const winston = require('winston');

const logsDir = path.resolve(process.cwd(), 'output');
fs.mkdirSync(logsDir, { recursive: true });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: path.join(logsDir, 'pipeline.log') })
  ]
});

module.exports = logger;
