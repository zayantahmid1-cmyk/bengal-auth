# Bengal Auth Widget

A small, embeddable email one-time-code (OTP) verification UI. It is loaded as a regular JavaScript file and can be styled with a few options.

> **Important:** The CDN widget cannot create files on a visitor's computer or send email by itself. Use the local setup generator to create a Node.js backend and private environment file.

## Generate the backend and environment file

1. Download or clone this repository to your computer.
2. Install Node.js 18 or newer.
3. Open a terminal in the repository folder and run:

   ```bash
   node create-bengal-auth.js
   ```

4. The generator asks where to create the backend files. Enter a folder path, or press Enter to use `./backend` inside the current folder. You can enter an absolute path such as `C:\\Users\\YourName\\Documents\\my-backend`, or a relative path such as `../my-backend`. This lets your website and backend live in separate folders.
5. It creates `server.js`, `.env`, `.gitignore`, and `README.md` in the selected folder. Existing files are skipped rather than overwritten.
6. Open the generated `.env` and replace the example values with your own SMTP settings and a long random `OTP_PEPPER`.
7. Open a terminal in the chosen backend folder and run:

   ```bash
   npm init -y
   npm install express nodemailer dotenv
   node server.js
   ```

The generated `.env` is for local development only. Keep it private and never upload it to GitHub. When deploying the backend, set the same variables in your hosting provider's environment-variable settings. The starter stores OTPs and rate limits in memory, so it is for testing, not production use without additional storage and abuse protection.

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

The generated backend implements these routes. It verifies email addresses only; it does not create accounts or login sessions.

## Security notes

- Never put SMTP passwords, OTP pepper/secrets, API private keys, or `.env` files in this public repository or in browser JavaScript.
- Configure the sender name/address and email provider on the backend only. `MAIL_FROM_ADDRESS` must be permitted by your email provider. Gmail generally requires your authenticated Gmail address or a verified “Send mail as” alias.
- Use HTTPS in production. The generated starter uses in-memory OTP storage and basic per-email rate limits; add persistent storage, robust abuse protection, and monitoring before production.
- Set `FRONTEND_ORIGINS` in the backend environment to your website origin(s). Do not leave a wildcard origin for a public production deployment.
- This widget displays the verification UI and calls your API; it does not create user accounts or sessions by itself.

## License

No license has been added yet. Before others reuse or redistribute this code, add a license file (for example, MIT) if that is what you intend.
