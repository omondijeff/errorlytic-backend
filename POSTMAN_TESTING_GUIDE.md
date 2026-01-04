# Errorlytic SaaS API - Postman Collection Testing Guide

## 🚀 Quick Start

### 1. Import the Collection

- Open Postman
- Click "Import" button
- Select `Errorlytic_SaaS_API_Collection.json`
- The collection will be imported with all endpoints and variables

### 2. Set Up Environment Variables

The collection uses these variables (automatically set during testing):

- `baseUrl`: http://localhost:3000
- `accessToken`: Auto-populated after login
- `refreshToken`: Auto-populated after login
- `userId`: Auto-populated after registration/login
- `subscriptionId`: Auto-populated after subscription creation
- `invoiceId`: Auto-populated after invoice generation

## 📋 Testing Workflow

### Step 1: Authentication

1. **Register User** - Creates a new user account
2. **Login User** - Authenticates and gets tokens
3. **Get Profile** - Verify authentication works

### Step 2: Billing System Testing

1. **Get Available Plans** - View pricing tiers
2. **Create Subscription** - Subscribe to Pro plan
3. **Get Billing Dashboard** - View comprehensive dashboard
4. **Get Billing Usage** - Check usage statistics
5. **Generate Invoice** - Create invoice for subscription
6. **Download Invoice PDF** - Test PDF generation
7. **Send Invoice Email** - Test email delivery

### Step 3: Fraud Detection Testing

1. **Analyze User for Fraud** - Run fraud analysis
2. **Get Fraud Detection Rules** - View detection rules (admin only)

### Step 4: Complete Workflow Testing

1. **Upload VCDS File** - Upload diagnostic file
2. **Process Analysis** - Generate analysis
3. **Generate Walkthrough** - Create repair guide
4. **Generate Quotation** - Create quotation
5. **Export Quotation PDF** - Download quotation PDF

## 🔧 Collection Features

### Auto-Token Management

- Tokens are automatically saved after login/registration
- Access tokens are automatically included in requests
- Refresh tokens are used for token renewal

### Auto-ID Capture

- Upload IDs are saved after file upload
- Analysis IDs are saved after processing
- Quotation IDs are saved after generation
- Subscription IDs are saved after creation
- Invoice IDs are saved after generation

### Error Handling

- Global error logging for failed requests
- Automatic response validation
- Token refresh handling

## 📊 New Billing Endpoints

### Dashboard & Analytics

- `GET /api/v1/billing/dashboard` - Comprehensive dashboard
- `GET /api/v1/billing/usage` - Usage statistics
- `GET /api/v1/billing/payments` - Payment history
- `GET /api/v1/billing/invoices` - Invoice history

### Subscription Management

- `POST /api/v1/billing/subscribe` - Create subscription
- `POST /api/v1/billing/subscription/{id}/cancel` - Cancel subscription
- `POST /api/v1/billing/subscription/{id}/invoice` - Generate invoice

### Invoice Management

- `GET /api/v1/billing/invoice/{id}/pdf` - Download PDF
- `POST /api/v1/billing/invoice/{id}/email` - Send via email

### Fraud Detection

- `POST /api/v1/billing/fraud/analyze` - Analyze user behavior
- `GET /api/v1/billing/fraud/rules` - Get detection rules

### Webhooks

- `POST /api/v1/billing/webhooks/stripe` - Stripe webhook handler

## 🧪 Testing Scenarios

### Scenario 1: New User Onboarding

1. Register → Login → Get Plans → Create Subscription → Dashboard

### Scenario 2: Complete Diagnostic Workflow

1. Login → Upload File → Process Analysis → Generate Walkthrough → Generate Quotation → Export PDF

### Scenario 3: Billing Management

1. Login → Dashboard → Generate Invoice → Download PDF → Send Email

### Scenario 4: Fraud Detection

1. Login → Analyze Fraud → View Rules (if admin)

### Scenario 5: Webhook Testing

1. Send Stripe webhook event → Verify processing

## 🔍 Response Examples

### Successful Login Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "...", "email": "..." },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Billing Dashboard Response

```json
{
  "type": "dashboard_data_retrieved",
  "title": "Dashboard Data Retrieved Successfully",
  "data": {
    "subscription": { "hasSubscription": true, ... },
    "usageStats": { "totalCalls": 0, ... },
    "paymentStats": { "totalPayments": 0, ... },
    "alerts": []
  }
}
```

### Fraud Analysis Response

```json
{
  "type": "fraud_analysis_completed",
  "data": {
    "overallScore": 0,
    "riskLevel": "low",
    "scores": { "apiUsage": 0, ... },
    "recommendations": []
  }
}
```

## ⚠️ Important Notes

1. **Authentication Required**: Most endpoints require valid JWT tokens
2. **File Upload**: Use actual VCDS files for realistic testing
3. **Environment**: Ensure Docker services are running (MongoDB, Redis, MinIO)
4. **Stripe Webhooks**: Requires proper signature validation
5. **Email Testing**: Configure SMTP settings for invoice email testing

## 🐛 Troubleshooting

### Common Issues

- **401 Unauthorized**: Token expired, try refreshing
- **404 Not Found**: Check if IDs are properly set
- **500 Internal Error**: Check server logs for details
- **File Upload Fails**: Ensure file is valid VCDS format

### Debug Tips

- Check Postman console for auto-saved variables
- Verify baseUrl is correct
- Ensure all required services are running
- Check server logs for detailed error messages

## 📈 Performance Testing

The collection supports:

- Concurrent request testing
- Load testing with multiple users
- Stress testing billing endpoints
- Fraud detection performance analysis

Happy Testing! 🎉
