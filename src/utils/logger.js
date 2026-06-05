const winston = require('winston');
const path = require('path');
const picocolors = require('picocolors');

// Custom level coloring function using picocolors (supports CJS/ESM, safe and lightweight)
const colorize = (level, text) => {
  switch (level) {
    case 'error':
      return picocolors.red(text);
    case 'warn':
      return picocolors.yellow(text);
    case 'info':
      return picocolors.cyan(text);
    case 'debug':
      return picocolors.magenta(text);
    default:
      return text;
  }
};

// Console formatting: neat, readable, with timestamp and colors
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const colorLevel = colorize(level, `[${level.toUpperCase()}]`);
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${colorLevel}: ${message}${metaStr}`;
  })
);

// File formatting: JSON format for structured log analysis in production
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: fileFormat
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: fileFormat
    })
  ]
});

module.exports = logger;
