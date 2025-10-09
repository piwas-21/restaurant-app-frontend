#!/bin/bash

# Script to help transition from Netlify to Kubernetes
echo "🔍 Checking DNS and Kubernetes setup for domain transition..."

echo ""
echo "1️⃣  Current DNS Records:"
echo "========================"
if command -v dig &> /dev/null; then
    echo "A Records:"
    dig +short rumirestaurant.ch
    echo ""
    echo "CNAME Records:"
    dig +short rumirestaurant.ch CNAME
    echo ""
    echo "Full DNS Info:"
    dig rumirestaurant.ch
else
    echo "dig not available, use: nslookup rumirestaurant.ch"
fi

echo ""
echo "2️⃣  Kubernetes Ingress External IP:"
echo "===================================="
if command -v kubectl &> /dev/null; then
    echo "Checking for LoadBalancer services:"
    kubectl get svc -A | grep LoadBalancer
    echo ""
    echo "Checking Ingress controllers:"
    kubectl get svc -n ingress-nginx
    echo ""
    echo "Checking your app ingress:"
    kubectl get ingress rumi-restaurant-web-ingress -o wide 2>/dev/null || echo "Ingress not found - make sure to deploy first"
else
    echo "kubectl not available"
fi

echo ""
echo "3️⃣  What you need to do:"
echo "========================"
echo "1. Get your Kubernetes cluster's external IP (usually from ingress-nginx LoadBalancer)"
echo "2. Update DNS A record: @ -> YOUR_K8S_EXTERNAL_IP"
echo "3. Remove any Netlify CNAME records"
echo "4. Wait for DNS propagation (up to 48 hours)"
echo ""
echo "4️⃣  Test when ready:"
echo "==================="
echo "curl -H 'Host: rumirestaurant.ch' http://YOUR_K8S_EXTERNAL_IP"
