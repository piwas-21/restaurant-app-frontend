# Netlify to Kubernetes Migration Guide

## 🚨 Current Issue
You're seeing "Netlify Internal ID" on your domain because DNS is still pointing to Netlify servers even though you've disabled the deployment.

## 📋 Step-by-Step Migration

### 1. **Deploy to Kubernetes First**
Make sure your app is running on Kubernetes:

```bash
# Deploy your app
./deploy.sh full

# Verify it's running
kubectl get pods -l app=rumi-restaurant-web
kubectl get svc rumi-restaurant-web-service
kubectl get ingress rumi-restaurant-web-ingress
```

### 2. **Get Your Kubernetes External IP**

```bash
# Check your DNS transition status
./check-dns-transition.sh

# Or manually check ingress controller:
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

The EXTERNAL-IP is what you need for DNS.

### 3. **Update DNS Records**

Go to your domain registrar (where you bought rumirestaurant.ch) and:

#### **Remove Old Netlify Records:**
```
Type: CNAME
Name: @ (or www)
Value: *.netlify.app  ← DELETE THIS
```

#### **Add New Kubernetes Records:**
```
Type: A
Name: @
Value: YOUR_K8S_EXTERNAL_IP

Type: A  
Name: www
Value: YOUR_K8S_EXTERNAL_IP
```

### 4. **Completely Remove Domain from Netlify**

1. Go to Netlify Dashboard
2. Go to your site settings
3. **Domain management** → **Custom domains**
4. **Remove** rumirestaurant.ch completely
5. Delete the entire site if no longer needed

### 5. **Clear CDN/Proxy Cache**

If using Cloudflare or similar:
- Go to Cloudflare dashboard
- **Caching** → **Purge Cache** → **Purge Everything**

### 6. **Test the Migration**

```bash
# Check DNS propagation
dig rumirestaurant.ch

# Test direct connection (replace with your actual IP)
curl -H "Host: rumirestaurant.ch" http://YOUR_K8S_EXTERNAL_IP

# Check from different locations
https://www.whatsmydns.net/#A/rumirestaurant.ch
```

## 🕐 **Timeline Expectations**

- **Immediate**: Kubernetes deployment ready
- **5-10 minutes**: DNS propagation starts
- **2-24 hours**: Full global DNS propagation
- **Up to 48 hours**: Complete cache clearing

## 🔧 **Troubleshooting**

### Still seeing Netlify?
1. **Clear browser cache** (Ctrl+Shift+R)
2. **Try incognito/private browsing**
3. **Use different device/network**
4. **Check DNS from multiple locations**

### DNS not updating?
1. **Verify you're updating the correct registrar**
2. **Check for multiple DNS providers** (some domains use separate DNS hosting)
3. **Look for CNAME flattening** settings
4. **Contact domain registrar support**

### Kubernetes not accessible?
1. **Check ingress controller is running**:
   ```bash
   kubectl get pods -n ingress-nginx
   ```
2. **Verify LoadBalancer has external IP**:
   ```bash
   kubectl get svc -n ingress-nginx
   ```
3. **Check firewall rules** on your cluster

## 🎯 **Quick Commands**

```bash
# Check everything is working
kubectl get all -l app=rumi-restaurant-web

# View app logs
kubectl logs -l app=rumi-restaurant-web -f

# Check ingress status
kubectl describe ingress rumi-restaurant-web-ingress

# Test health endpoint
curl http://YOUR_K8S_EXTERNAL_IP/api/health
```

## 🔒 **SSL Certificate**

Once DNS is pointing to Kubernetes:

1. **cert-manager** will automatically request SSL certificate
2. **Monitor certificate status**:
   ```bash
   kubectl get certificates
   kubectl describe certificate rumi-restaurant-web-tls
   ```

## ✅ **Verification Checklist**

- [ ] Kubernetes deployment is running
- [ ] External IP is available
- [ ] DNS A records updated to K8s IP
- [ ] All Netlify CNAME records removed
- [ ] Domain removed from Netlify dashboard
- [ ] CDN cache purged (if applicable)
- [ ] SSL certificate issued
- [ ] Website loads from new infrastructure

---

**Need Help?** Run `./check-dns-transition.sh` to see current status and next steps.
