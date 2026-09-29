*🇮🇹 [Leggi la guida alla configurazione SMTP in Italiano](CONFIGURAZIONE_EMAIL_SMTP_it.md)*

# Email Service (SMTP) Configuration Guide for Albert

This guide details the step-by-step procedure to configure the sending of system emails (password recovery, authentication links, and notifications) via **GoTrue (Supabase Auth)**.

---

## 📌 Index
1. [What the email service is for](#1-what-the-email-service-is-for)
2. [Option A: Create a dedicated Gmail account (Google App Password)](#2-option-a-create-a-dedicated-gmail-account)
3. [Option B: Use a transactional SMTP provider (Recommended for Production - Brevo)](#3-option-b-use-a-transactional-smtp-provider-brevo)
4. [Configuring the `.env` files](#4-configuring-the-env-files)
5. [Applying changes with Docker](#5-applying-changes-with-docker)
6. [How to test and verify delivery](#6-how-to-test-and-verify-delivery)
7. [Common problems resolution (Troubleshooting)](#7-common-problems-resolution)

---

## 1. What the email service is for

Within the Albert ecosystem, the **GoTrue** authentication engine directly manages:
- **Password Reset**: sending the secure link with a temporary token (requested by `/forgot`).
- **Email address verification**: sending the confirmation link when registering new users (if enabled).
- **Magic Link**: one-click login via link sent by email (if enabled in the future).

Without a configured SMTP server, GoTrue registers requests internally but cannot deliver emails to the actual inboxes of the recipients.

---

## 2. Option A: Create a dedicated Gmail account

If you wish to use a Gmail address (e.g., `albertapp.noreply@gmail.com` or `albert.gestionale@gmail.com`), follow these steps.

> [!IMPORTANT]
> Google has discontinued "Less secure app access". **It is not possible to use the normal Google account password** within the application. It is mandatory to generate a 16-character **App Password**.

### Step 1: Creating the Google account
1. Go to [accounts.google.com/signup](https://accounts.google.com/signup) and register the new account (e.g., `albert.noreply@gmail.com`).

### Step 2: Activating Two-Step Verification (2FA)
*The generation of the "App Password" is only available if two-step verification is active.*
1. Access account management: [myaccount.google.com/security](https://myaccount.google.com/security).
2. In the **How you sign in to Google** section, select **2-Step Verification**.
3. Follow the instructions to associate your phone number or an authenticator app and activate it.

### Step 3: Creating the "App Password"
1. Visit the link directly: **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**  
   *(or search for it in the Google account settings search bar by typing "App passwords")*.
2. In the **App name** field, write: `Albert App` (or `Albert GoTrue`).
3. Click on **Create**.
4. A window will appear with a randomly generated 16-letter password (e.g., `abcd efgh ijkl mnop`).
5. **Copy this password** (you can write it without spaces: `abcdefghijklmnop`). It will not be shown again.

---

## 3. Option B: Use a transactional SMTP provider (Brevo)

For a production environment (VPS), using a dedicated transactional SMTP service like **Brevo** (formerly Sendinblue) is often preferable to Gmail because:
- It is **100% free forever** for up to 300 emails per day (more than enough for personal/family use).
- It doesn't risk sudden blocks by Google's anti-abuse filters.
- It has a higher deliverability reputation (emails don't end up in Spam).
- It does not require associating personal phone numbers with a service Gmail account.

### Procedure with Brevo:
1. Register for free on [brevo.com](https://www.brevo.com/).
2. In the top right menu, click on your profile and select **SMTP & API**.
3. In the **SMTP** tab, you will find:
   - **Host**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: your Brevo login email
4. Click on **Generate a new SMTP key**, assign a name (e.g., `Albert Prod`) and copy the generated key. That will be your `SMTP_PASS`.

---

## 4. Configuring the `.env` files

Open the `.env` file (locally) or `.env-vps` (on the VPS) and fill in the dedicated SMTP section:

### Configuration with Gmail:
```env
# SMTP configuration for real email delivery (GoTrue)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=albert.noreply@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_ADMIN_EMAIL=albert.noreply@gmail.com
```

### Configuration with Brevo:
```env
# SMTP configuration for real email delivery (GoTrue)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=yourlogin@brevo.com
SMTP_PASS=xkeysib-your-long-smtp-key
SMTP_ADMIN_EMAIL=noreply@albertapp.duckdns.org
```

---

## 5. Applying changes with Docker

Once the `.env` file is saved, restart the **GoTrue** container so that it picks up the new environment variables:

### Locally:
```bash
docker compose up -d gotrue
```

### In Production on the VPS:
```bash
docker compose -f docker-compose.prod.yml up -d gotrue
```

To verify that the container started correctly and without errors:
```bash
docker logs -n 20 albert_gotrue
```

---

## 6. How to test and verify delivery

### Test 1: From the graphical interface
1. Open the Albert login page (`http://localhost:3001/login` or `https://albertapp.duckdns.org/login`).
2. Click on **"Forgot password?"**.
3. Enter a valid email address you have access to.
4. Click on **"Send Recovery Link"**.
5. Check the inbox of the entered address (also check the **Spam/Junk** folder).
6. Click on the received link: the Albert page will open to set and confirm the new password.

### Test 2: From command line (curl)
You can verify the call directly from the terminal with:
```bash
curl -i -X POST http://localhost:9999/auth/v1/recover \
  -H "Content-Type: application/json" \
  -d '{"email":"yourmail@example.com"}'
```
If the configuration is correct, you will receive an HTTP `200 OK` (`{}`) response.

### Test 3: Verifying delivery logs
You can monitor the delivery in real-time by watching the GoTrue logs:
```bash
docker logs -f albert_gotrue
```
Upon sending the request, you will see the event `method: POST`, `path: /recover` appear, along with any delivery confirmation via the mailer.

---

## 7. Common problems resolution (Troubleshooting)

| Error / Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `535-5.7.8 Username and Password not accepted` (Gmail) | The normal Google account password was used instead of the App Password. | Enable 2FA and generate a 16-character [App Password](https://myaccount.google.com/apppasswords). |
| No on-screen error but the email does not arrive | The email ended up in the Spam folder or the sender is not verified. | Check Spam. If using Brevo, verify the domain or sender address in the Brevo Senders settings. |
| SMTP connection timeout (port 587) | Outbound port 587 is blocked by the firewall or cloud provider. | Check the server's outbound firewall rules or try the alternative port `465` (SSL). |
| `400: User not found` | The entered email is not registered in the Albert database. | Register with that email first or verify that the address is correct. |
