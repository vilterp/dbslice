import { Request, Response } from 'express';
import logger from './logger';

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: Function) {
  const startTime = Date.now();
  
  logger.info(`${req.method} ${req.path} - Request started`);
  
  // Override res.end to capture when the response finishes
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any): any {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    
    // Call the original end method with proper arguments
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
}

// Timeout middleware - 1 minute timeout for all routes
export function timeoutMiddleware(req: Request, res: Response, next: Function) {
  // Set timeout to 60 seconds (60000 milliseconds)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      logger.error(`Request timeout: ${req.method} ${req.path}`);
      res.status(408).json({ error: 'Request timeout - operation took longer than 60 seconds' });
    }
  }, 60000);
  
  // Clear timeout when response finishes
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  
  res.on('close', () => {
    clearTimeout(timeout);
  });
  
  next();
}