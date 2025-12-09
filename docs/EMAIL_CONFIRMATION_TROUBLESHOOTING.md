# Email Confirmation Troubleshooting

If users are not receiving confirmation emails after signup, check the following:

## 1. Verify Email Confirmation is Enabled

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Ensure **"Confirm email"** toggle is **ON**
4. Save changes

## 2. Check Redirect URL Whitelist

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Under **"Redirect URLs"**, ensure your domain is whitelisted:
   - For local development: `http://localhost:3000`
   - For production: `https://yourdomain.com`
   - Add: `http://localhost:3000/auth/callback` and `https://yourdomain.com/auth/callback`

## 3. Default Email Service Limitations

Supabase's default email service has **low rate limits** and is intended for development only. If emails aren't being sent:

- **Check Auth Logs**: Go to **Authentication** → **Logs** to see if emails are being attempted
- **Rate Limits**: Default service allows ~3 emails per hour per project
- **Solution**: Configure a custom SMTP provider for production

## 4. Configure Custom SMTP (Recommended for Production)

1. Go to **Project Settings** → **Auth** → **SMTP Settings**
2. Configure your SMTP provider (Gmail, SendGrid, Mailgun, etc.)
3. Test the configuration

### Example SMTP Providers:
- **SendGrid**: Free tier: 100 emails/day
- **Mailgun**: Free tier: 5,000 emails/month
- **Gmail**: Requires app password (not recommended for production)

## 5. Check Email Templates

1. Go to **Authentication** → **Email Templates**
2. Verify the **"Confirm signup"** template exists and is enabled
3. Ensure the template includes the confirmation link: `{{ .ConfirmationURL }}`

## 6. Cookie Security Settings

The cookie security settings we added (`httpOnly`, `secure`, `sameSite`) **do not affect email sending**. However, they ensure the confirmation link works properly when clicked.

If users click the confirmation link and it doesn't work:
- Ensure they're using the **same browser** (cookies are browser-specific)
- Check that `secure: true` is only enabled in production (HTTPS)
- Verify `sameSite: 'lax'` allows the redirect to work

## 7. Testing Checklist

- [ ] Email confirmation is enabled in Supabase
- [ ] Redirect URLs are whitelisted
- [ ] SMTP is configured (or using default with rate limits in mind)
- [ ] Email templates are configured
- [ ] Check Auth logs for errors
- [ ] Test with different email providers (Gmail, Outlook, etc.)
- [ ] Verify spam folder

## Common Issues

### "Email not received"
- Check spam folder
- Verify email confirmation is enabled
- Check Auth logs for delivery errors
- Rate limit may have been hit (wait 1 hour or configure SMTP)

### "Confirmation link doesn't work"
- Ensure redirect URL is whitelisted
- Check that user is using same browser
- Verify cookie settings match environment (secure only for HTTPS)

### "User created but no email sent"
- Email confirmation might be disabled
- Check Auth logs
- Verify SMTP configuration (if using custom SMTP)

## Related Files

- Signup component: `src/components/auth-card.tsx`
- Auth callback handler: `src/app/auth/callback/route.ts`
- Browser client: `src/lib/supabase/browser-client.ts`
