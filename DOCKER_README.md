# Errorlytic Docker Setup

This document explains how to run the entire Errorlytic application (frontend + backend + database) using Docker.

## Architecture

The application consists of 4 main services:

1. **Frontend** - React application served by Nginx (Port 3001)
2. **Backend** - Node.js/Express API server (Port 3000)
3. **MongoDB** - Database (Port 27017)
4. **Mongo Express** - Database admin interface (Port 9090)

## Prerequisites

- Docker Desktop installed and running
- At least 4GB of available RAM
- Ports 3000, 3001, 27017, and 9090 available

## Quick Start

### 1. Clone and Navigate

```bash
cd Errorlytic
```

### 2. Set Environment Variables (Optional)

```bash
cp docker.env.example .env
# Edit .env file with your configuration
```

### 3. Build and Start All Services

```bash
docker-compose up -d --build
```

### 4. Access the Application

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Mongo Express**: http://localhost:9090
- **Health Check**: http://localhost:3000/health

## Service Details

### Frontend Service

- **Port**: 3001 (mapped to container port 80)
- **Technology**: React + TypeScript + Tailwind CSS
- **Web Server**: Nginx
- **Build Process**: Multi-stage Docker build
- **Features**:
  - Client-side routing support
  - Static asset caching
  - Gzip compression
  - Security headers

### Backend Service

- **Port**: 3000
- **Technology**: Node.js + Express + MongoDB
- **Features**:
  - JWT authentication
  - File upload handling
  - Rate limiting
  - CORS configuration
  - Error handling middleware

### MongoDB Service

- **Port**: 27017
- **Version**: 6.0
- **Authentication**: Enabled (admin/password123)
- **Database**: Errorlytic_saas
- **Persistence**: Docker volume (mongodb_data)

### Mongo Express Service

- **Port**: 9090
- **Purpose**: Web-based MongoDB admin interface
- **Access**: http://localhost:9090 (admin/password123)

## Docker Commands

### Start Services

```bash
# Start all services in background
docker-compose up -d

# Start with rebuild
docker-compose up -d --build

# Start specific service
docker-compose up -d frontend
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop specific service
docker-compose stop frontend
```

### View Logs

```bash
# All services
docker-compose logs

# Specific service
docker-compose logs frontend
docker-compose logs app
docker-compose logs mongo

# Follow logs
docker-compose logs -f frontend
```

### Service Status

```bash
# Check running containers
docker-compose ps

# Check container health
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

### Rebuild Services

```bash
# Rebuild all services
docker-compose build --no-cache

# Rebuild specific service
docker-compose build --no-cache frontend
```

## Development Workflow

### 1. Make Code Changes

- Edit frontend code in `frontend/` directory
- Edit backend code in root directory

### 2. Rebuild and Restart

```bash
# Rebuild and restart specific service
docker-compose up -d --build frontend

# Or rebuild and restart all
docker-compose up -d --build
```

### 3. View Changes

- Frontend changes are immediately available after rebuild
- Backend changes require service restart

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Check what's using a port
lsof -i :3000

# Kill process using port
kill -9 <PID>
```

#### Container Won't Start

```bash
# Check container logs
docker-compose logs <service-name>

# Check container status
docker-compose ps
```

#### Frontend Can't Connect to Backend

- Verify both services are running: `docker-compose ps`
- Check CORS configuration in `server.js`
- Ensure frontend is using correct API URL

#### Database Connection Issues

```bash
# Check MongoDB logs
docker-compose logs mongo

# Verify MongoDB is accessible
docker exec Errorlytic-mongo-1 mongosh --eval "db.adminCommand('ping')"
```

### Reset Everything

```bash
# Stop all services and remove everything
docker-compose down -v --remove-orphans

# Remove all images
docker system prune -a

# Start fresh
docker-compose up -d --build
```

## Production Considerations

### Environment Variables

- Update `JWT_SECRET` with a strong, unique key
- Set `NODE_ENV=production`
- Configure proper `MONGODB_URI` for production database
- Set `OPENAI_API_KEY` if using AI features

### Security

- Change default MongoDB credentials
- Use environment variables for sensitive data
- Consider using Docker secrets for production
- Enable HTTPS in production

### Performance

- Frontend is served by Nginx with caching
- Backend has rate limiting enabled
- MongoDB data is persisted in Docker volumes
- Consider adding Redis for session management

### Monitoring

- Health check endpoint: `/health`
- Logs are available via `docker-compose logs`
- Consider adding monitoring tools (Prometheus, Grafana)

## File Structure

```
Errorlytic/
├── docker-compose.yml          # Main Docker orchestration
├── Dockerfile                  # Backend Docker configuration
├── frontend/
│   ├── Dockerfile             # Frontend Docker configuration
│   ├── nginx.conf             # Nginx configuration
│   └── .dockerignore          # Frontend build exclusions
├── docker.env.example          # Environment variables template
└── DOCKER_README.md           # This file
```

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify all services are running: `docker-compose ps`
3. Check port availability
4. Ensure Docker has sufficient resources
5. Try rebuilding: `docker-compose up -d --build`
