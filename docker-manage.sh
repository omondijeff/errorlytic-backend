#!/bin/bash

# Errorlytic Docker Management Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
}

# Function to show service status
show_status() {
    print_status "Checking service status..."
    docker-compose ps
}

# Function to start all services
start_services() {
    print_status "Starting all services..."
    docker-compose up -d
    if [ $? -eq 0 ]; then
        print_success "All services started successfully!"
        show_status
    else
        print_error "Failed to start services"
        exit 1
    fi
}

# Function to stop all services
stop_services() {
    print_status "Stopping all services..."
    docker-compose down
    if [ $? -eq 0 ]; then
        print_success "All services stopped successfully!"
    else
        print_error "Failed to stop services"
        exit 1
    fi
}

# Function to restart all services
restart_services() {
    print_status "Restarting all services..."
    docker-compose down
    docker-compose up -d
    if [ $? -eq 0 ]; then
        print_success "All services restarted successfully!"
        show_status
    else
        print_error "Failed to restart services"
        exit 1
    fi
}

# Function to rebuild and start services
rebuild_services() {
    print_status "Rebuilding and starting all services..."
    docker-compose down
    docker-compose up -d --build
    if [ $? -eq 0 ]; then
        print_success "All services rebuilt and started successfully!"
        show_status
    else
        print_error "Failed to rebuild services"
        exit 1
    fi
}

# Function to show logs
show_logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        print_status "Showing logs for all services..."
        docker-compose logs
    else
        print_status "Showing logs for $service service..."
        docker-compose logs $service
    fi
}

# Function to follow logs
follow_logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        print_status "Following logs for all services..."
        docker-compose logs -f
    else
        print_status "Following logs for $service service..."
        docker-compose logs -f $service
    fi
}

# Function to clean up everything
cleanup() {
    print_warning "This will remove all containers, networks, and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up everything..."
        docker-compose down -v --remove-orphans
        docker system prune -af
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Function to show application URLs
show_urls() {
    print_status "Application URLs:"
    echo -e "  ${GREEN}Frontend:${NC} http://localhost:3001"
    echo -e "  ${GREEN}Backend API:${NC} http://localhost:3000"
    echo -e "  ${GREEN}Health Check:${NC} http://localhost:3000/health"
    echo -e "  ${GREEN}Mongo Express:${NC} http://localhost:9090"
    echo -e "  ${GREEN}MongoDB:${NC} localhost:27017"
}

# Function to show help
show_help() {
    echo "Errorlytic Docker Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  rebuild     Rebuild and start all services"
    echo "  status      Show service status"
    echo "  logs        Show logs for all services"
    echo "  logs [SERVICE] Show logs for specific service"
    echo "  follow      Follow logs for all services"
    echo "  follow [SERVICE] Follow logs for specific service"
    echo "  urls        Show application URLs"
    echo "  cleanup     Remove all containers, networks, and volumes"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 logs frontend"
    echo "  $0 follow app"
    echo "  $0 rebuild"
}

# Main script logic
main() {
    check_docker
    
    case "${1:-help}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        rebuild)
            rebuild_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        follow)
            follow_logs "$2"
            ;;
        urls)
            show_urls
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
