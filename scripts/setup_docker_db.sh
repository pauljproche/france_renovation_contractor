#!/bin/bash
# Setup script for PostgreSQL Docker container
# Usage: ./scripts/setup_docker_db.sh [start|stop|remove|status]

CONTAINER_NAME="france-renovation-db"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-france_renovation}"
POSTGRES_VERSION="15"

case "${1:-start}" in
  start)
    echo "Starting PostgreSQL container..."
    # Check if container already exists
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "Container ${CONTAINER_NAME} already exists. Starting it..."
      docker start "${CONTAINER_NAME}"
    else
      echo "Creating new container ${CONTAINER_NAME}..."
      docker run --name "${CONTAINER_NAME}" \
        -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
        -e POSTGRES_DB="${POSTGRES_DB}" \
        -e POSTGRES_USER="${POSTGRES_USER}" \
        -p 5432:5432 \
        -v france-renovation-data:/var/lib/postgresql/data \
        -d "postgres:${POSTGRES_VERSION}"
      echo "Container created and started!"
    fi
    
    echo "Waiting for PostgreSQL to be ready..."
    sleep 3
    
    # Check if container is running
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "✅ PostgreSQL container is running!"
      echo ""
      echo "Connection details:"
      echo "  Host: localhost"
      echo "  Port: 5432"
      echo "  Database: ${POSTGRES_DB}"
      echo "  User: ${POSTGRES_USER}"
      echo "  Password: ${POSTGRES_PASSWORD}"
      echo ""
      echo "Add to backend/.env:"
      echo "  DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
    else
      echo "❌ Container failed to start. Check logs: docker logs ${CONTAINER_NAME}"
      exit 1
    fi
    ;;
    
  stop)
    echo "Stopping PostgreSQL container..."
    docker stop "${CONTAINER_NAME}" 2>/dev/null || echo "Container not running"
    echo "✅ Container stopped"
    ;;
    
  remove)
    echo "⚠️  WARNING: This will delete the container and all data!"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      docker stop "${CONTAINER_NAME}" 2>/dev/null
      docker rm -v "${CONTAINER_NAME}" 2>/dev/null
      echo "✅ Container removed"
    else
      echo "Cancelled"
    fi
    ;;
    
  status)
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "✅ Container is running"
      docker ps --filter name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    elif docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
      echo "⏸️  Container exists but is stopped"
      docker ps -a --filter name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
      echo "❌ Container does not exist"
    fi
    ;;
    
  *)
    echo "Usage: $0 [start|stop|remove|status]"
    echo ""
    echo "Commands:"
    echo "  start   - Start or create PostgreSQL container"
    echo "  stop    - Stop PostgreSQL container"
    echo "  remove  - Remove container and data (WARNING: destructive)"
    echo "  status  - Check container status"
    exit 1
    ;;
esac
