#!/bin/bash

# Rumi Restaurant Web - Kubernetes Deployment Script
set -euo pipefail

# Configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
IMAGE_NAME="${IMAGE_NAME:-rumi-restaurant-web}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="${NAMESPACE:-default}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    log_info "kubectl found: $(kubectl version --client --short)"
}

# Check if docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed or not in PATH"
        exit 1
    fi
    log_info "docker found: $(docker --version)"
}

# Build Docker image
build_image() {
    log_info "Building Docker image..."
    docker build -t "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}" .
    log_info "Docker image built successfully: ${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
}

# Push Docker image to registry
push_image() {
    log_info "Pushing Docker image to registry..."
    docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
    log_info "Docker image pushed successfully"
}

# Create namespace if it doesn't exist
create_namespace() {
    if kubectl get namespace "${NAMESPACE}" &> /dev/null; then
        log_info "Namespace '${NAMESPACE}' already exists"
    else
        log_info "Creating namespace '${NAMESPACE}'"
        kubectl create namespace "${NAMESPACE}"
    fi
}

# Deploy to Kubernetes
deploy() {
    log_info "Deploying to Kubernetes (Environment: ${ENVIRONMENT}, Namespace: ${NAMESPACE})"

    if [[ -d "k8s/overlays/${ENVIRONMENT}" ]]; then
        log_info "Using kustomize overlay for ${ENVIRONMENT}"
        kubectl apply -k "k8s/overlays/${ENVIRONMENT}"
    else
        log_info "Using base kustomize configuration"
        kubectl apply -k "k8s/"
    fi

    log_info "Deployment completed"
}

# Wait for deployment to be ready
wait_for_deployment() {
    log_info "Waiting for deployment to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/rumi-restaurant-web -n "${NAMESPACE}"
    log_info "Deployment is ready"
}

# Get deployment status
get_status() {
    log_info "Getting deployment status..."
    kubectl get pods -l app=rumi-restaurant-web -n "${NAMESPACE}"
    kubectl get svc -l app=rumi-restaurant-web -n "${NAMESPACE}"
    kubectl get ingress -l app=rumi-restaurant-web -n "${NAMESPACE}"
}

# Main deployment function
main() {
    log_info "Starting Rumi Restaurant Web deployment..."

    check_kubectl
    check_docker

    # Parse command line arguments
    case "${1:-deploy}" in
        "build")
            build_image
            ;;
        "push")
            build_image
            push_image
            ;;
        "deploy")
            create_namespace
            deploy
            wait_for_deployment
            get_status
            ;;
        "status")
            get_status
            ;;
        "full")
            build_image
            push_image
            create_namespace
            deploy
            wait_for_deployment
            get_status
            ;;
        *)
            echo "Usage: $0 {build|push|deploy|status|full}"
            echo "  build  - Build Docker image"
            echo "  push   - Build and push Docker image"
            echo "  deploy - Deploy to Kubernetes"
            echo "  status - Get deployment status"
            echo "  full   - Build, push, and deploy"
            exit 1
            ;;
    esac

    log_info "Operation completed successfully!"
}

# Run main function with all arguments
main "$@"
