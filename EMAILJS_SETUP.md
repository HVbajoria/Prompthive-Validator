# EmailJS Setup Instructions

## 1. Create EmailJS Account
1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Sign up for a free account
3. Verify your email address

## 2. Create Email Service
1. In EmailJS dashboard, go to "Email Services"
2. Click "Add New Service"
3. Choose your email provider (Gmail, Outlook, etc.)
4. Follow the setup instructions
5. Note down your **Service ID** (e.g., `service_prompthive`)

## 3. Create Email Template
1. Go to "Email Templates"
2. Click "Create New Template"
3. Use this template:

```
Subject: {{subject}}

To: {{to_email}}
From: {{from_name}}

{{message}}
```

4. Save and note down your **Template ID** (e.g., `template_assessment`)

## 4. Get Public Key
1. Go to "Account" → "General"
2. Copy your **Public Key**

## 5. Update Configuration
In `services/emailService.ts`, replace:
```typescript
const EMAILJS_SERVICE_ID = 'your_service_id_here';
const EMAILJS_TEMPLATE_ID = 'your_template_id_here';
const EMAILJS_PUBLIC_KEY = 'your_public_key_here';
```

## 6. Test Email Sending
- The app will automatically try EmailJS first
- If it fails, it falls back to opening the default mail client
- Success/error messages will appear in the UI

## Free Tier Limits
- 200 emails per month
- Perfect for testing and small assessments
- Upgrade for higher limits if needed