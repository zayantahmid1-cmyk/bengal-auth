# Bengal Auth Widget

A small, embeddable email one-time-code (OTP) verification UI. It is loaded as a regular JavaScript file and can be styled with a few options.

> **Important:** This repository hosts the browser widget only. The widget needs a separately hosted backend that implements `POST /api/send-code` and `POST /api/verify-code`. A CDN URL by itself does not send email or verify codes.

## CDN

After the repository has a version tag such as `v1.0.0`, embed the pinned file:

```html
<div id="my-login"></div>

<script src="https://cdn.jsdelivr.net/gh/zayantahmid1-cmyk/bengal-auth@v1.0.0/auth-widget.js"></script>
<script>
  BengalAuth.init({
    container: "#my-login",
    name: "My Website",
    logo: "M",
    title: "Welcome to My Website",
    primaryColor: "#7c3aed",
    backgroundColor: "#f8fafc",
    apiUrl: "https://YOUR-BACKEND-DOMAIN.example",
    onVerified: function (data) {
      console.log("Verification response received");
      // Continue your app flow here after your server confirms verification.
    }
  });
</script>
```

Replace `https://YOUR-BACKEND-DOMAIN.example` with your deployed backend's HTTPS origin. Do not use `localhost` for a public website.

For a quick test before tagging a release, jsDelivr can serve the default branch:
`https://cdn.jsdelivr.net/gh/zayantahmid1-cmyk/bengal-auth/auth-widget.js`
Version-pinned URLs are recommended for production.

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `container` | `"#bengal-auth"` | CSS selector or DOM element where the widget is rendered |
| `name` | `"BENGAL"` | Brand name |
| `logo` | `"B"` | Text shown inside the logo tile |
| `title` | `"Verify your email"` | First screen heading |
| `primaryColor` | `"#2563eb"` | Main button/logo color |
| `backgroundColor` | `"#ffffff"` | Widget card background color |
| `apiUrl` | `""` | Backend origin, without a trailing slash |
| `onVerified` | none | Optional callback called with the verification API response |

## Backend contract

The widget expects JSON endpoints:

- `POST /api/send-code` with `{"email":"person@example.com"}`
- `POST /api/verify-code` with `{"email":"person@example.com","code":"123456"}`

Successful responses should be JSON. On errors, return a non-2xx status and optionally a safe `message` or `error` string. Configure CORS on the backend to allow the website origins that will use the widget.

## Security notes

- Never put SMTP passwords, OTP pepper/secrets, API private keys, or `.env` files in this public repository or in browser JavaScript.
- Configure the sender name/address and email provider on the backend only. Do not accept sender details from widget options. With the provided Node.js backend, set `MAIL_FROM_NAME` and `MAIL_FROM_ADDRESS` in the server environment; `MAIL_FROM_ADDRESS` must be permitted by your email provider (Gmail generally requires your authenticated Gmail address or a verified “Send mail as” alias).
- Use HTTPS in production, rate-limit code sending and verification, expire codes, and store only a secure hash of codes where appropriate.
- Return generic responses from the backend where appropriate to reduce email-enumeration risks.
- This widget displays the verification UI and calls your API; it does not create user accounts or sessions by itself. Your backend must enforce verification before granting access.
- The backend should validate input, implement abuse protections, and use persistent storage appropriate for production. In-memory code storage is suitable only for basic development/testing.

## License

No license has been added yet. Before others reuse or redistribute this code, add a license file (for example, MIT) if that is what you intend.
