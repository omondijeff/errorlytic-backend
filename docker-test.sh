#!/bin/bash

echo "🐳 Errorlytic SaaS API - Docker Testing Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_status "Docker is running"

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker Compose is available"

echo ""
echo "🚀 Starting Errorlytic SaaS Services..."
echo "====================================="

# Stop any existing containers
print_info "Stopping existing containers..."
docker-compose down

# Build and start services
print_info "Building and starting services..."
docker-compose up --build -d

# Wait for services to start
print_info "Waiting for services to start..."
sleep 10

echo ""
echo "🔍 Service Status Check:"
echo "========================"

# Check MongoDB
if docker-compose exec mongo mongosh --eval "db.runCommand('ping')" > /dev/null 2>&1; then
    print_status "MongoDB is running"
else
    print_warning "MongoDB might still be starting..."
fi

# Check Redis
if docker-compose exec redis redis-cli ping > /dev/null 2>&1; then
    print_status "Redis is running"
else
    print_warning "Redis might still be starting..."
fi

# Check MinIO
if curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
    print_status "MinIO is running"
else
    print_warning "MinIO might still be starting..."
fi

# Check API
sleep 5
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    print_status "API is running"
else
    print_warning "API might still be starting..."
fi

echo ""
echo "🌐 Service URLs:"
echo "================"
echo "📖 API:                    http://localhost:3000"
echo "📚 Swagger Documentation:  http://localhost:3000/api-docs"
echo "❤️  Health Check:          http://localhost:3000/health"
echo "🗄️  MongoDB:               mongodb://admin:password123@localhost:27017"
echo "🔴 Redis:                  redis://localhost:6379"
echo "📦 MinIO Console:          http://localhost:9001 (minioadmin/minioadmin123)"
echo "🗄️  Mongo Express:         http://localhost:9090 (admin/password123)"
echo "🎨 Frontend:               http://localhost:3001"

echo ""
echo "📋 Testing Instructions:"
echo "======================="
echo "1. Import the Postman collection: Errorlytic_SaaS_API.postman_collection.json"
echo "2. Start with the 'Complete Workflow' folder in Postman"
echo "3. Or test individual endpoints using the organized folders"
echo "4. Use the Swagger UI for interactive testing: http://localhost:3000/api-docs"

echo ""
echo "🔧 Useful Commands:"
echo "==================="
echo "View logs:           docker-compose logs -f"
echo "Stop services:       docker-compose down"
echo "Restart services:    docker-compose restart"
echo "Rebuild services:    docker-compose up --build -d"
echo "Clean up:           docker-compose down -v"

echo ""
echo "📊 Service Health Check:"
echo "========================"

# Final health check
sleep 5
if curl -s http://localhost:3000/health | jq -r '.status' 2>/dev/null | grep -q "OK"; then
    print_status "All services are healthy and ready for testing!"
else
    print_warning "Some services might still be starting. Check logs with: docker-compose logs"
fi

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. Open Postman and import: Errorlytic_SaaS_API.postman_collection.json"
echo "2. Visit Swagger UI: http://localhost:3000/api-docs"
echo "3. Start testing the complete workflow!"
echo "4. Check service logs if needed: docker-compose logs -f"

echo ""
echo "✨ Errorlytic SaaS API is ready for testing in Docker! 🚀"
