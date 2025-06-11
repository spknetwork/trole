# Multi-stage build for optimization
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Add metadata
LABEL maintainer="SPK Network"
LABEL description="Trole - Role-based IPFS bridge controller"
LABEL version="1.0.0"

# Create non-root user
RUN addgroup -g 1001 -S trole && \
    adduser -S trole -u 1001 -G trole

# Set working directory
WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=trole:trole . .

# Create necessary directories
RUN mkdir -p /app/db && chown -R trole:trole /app

# Switch to non-root user
USER trole

# Expose port
EXPOSE 5050

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start application
CMD ["node", "index.js"]