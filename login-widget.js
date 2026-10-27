(function (global) {
  "use strict";

  const defaults = {
    container: "#bengal-auth",
    name: "BENGAL",
    logo: "B",
    title: "Welcome to BENGAL",
    primaryColor: "#2563eb",
    backgroundColor: "#ffffff",
    apiUrl: ""
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function init(options) {
    const settings = Object.assign({}, defaults, options || {});
    const container = typeof settings.container === "string"
      ? document.querySelector(settings.container)
      : settings.container;

    if (!container) {
      console.error("BengalAuth: container element was not found.");
      return;
    }

    const apiUrl = String(settings.apiUrl || "").replace(/\/$/, "");
    const primaryColor = /^#[0-9a-f]{3,8}$/i.test(settings.primaryColor)
      ? settings.primaryColor
      : defaults.primaryColor;
    const backgroundColor = /^#[0-9a-f]{3,8}$/i.test(settings.backgroundColor)
      ? settings.backgroundColor
      : defaults.backgroundColor;

    container.innerHTML = `
      <div class="bengal-auth-widget">
        <style>
          .bengal-auth-widget{font-family:Inter,Arial,sans-serif;color:#172033;max-width:420px;width:100%;margin:0 auto}
          .bengal-auth-widget *{box-sizing:border-box}
          .bengal-auth-widget .ba-tabs,.bengal-auth-widget .ba-auth-signup{display:none!important}
          .bengal-auth-widget .ba-card{background:${backgroundColor};border:1px solid #e7eaf0;border-radius:18px;padding:28px;box-shadow:0 12px 36px rgba(20,35,70,.08)}
          .bengal-auth-widget .ba-brand{display:flex;align-items:center;gap:11px;margin-bottom:24px}
          .bengal-auth-widget .ba-logo{width:42px;height:42px;border-radius:12px;background:${primaryColor};color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800}
          .bengal-auth-widget .ba-brand-name{font-size:15px;font-weight:750;overflow-wrap:anywhere}
          .bengal-auth-widget .ba-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;background:#f2f4f7;border-radius:11px;margin-bottom:22px}
          .bengal-auth-widget .ba-tab{border:0;border-radius:8px;padding:10px;background:transparent;color:#667085;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
          .bengal-auth-widget .ba-tab[aria-selected="true"]{background:#fff;color:#172033;box-shadow:0 1px 3px rgba(16,24,40,.12)}
          .bengal-auth-widget .ba-form[hidden],.bengal-auth-widget section[hidden]{display:none!important}
          .bengal-auth-widget h2{font-size:24px;line-height:1.25;margin:0 0 8px}
          .bengal-auth-widget .ba-subtitle{font-size:14px;color:#667085;line-height:1.55;margin:0 0 22px}
          .bengal-auth-widget label{display:block;font-size:13px;font-weight:650;margin:0 0 7px}
          .bengal-auth-widget input{width:100%;padding:12px 13px;border:1px solid #d5dbe5;border-radius:10px;font:inherit;font-size:14px;outline:none;margin-bottom:15px}
          .bengal-auth-widget input:focus{border-color:${primaryColor};box-shadow:0 0 0 3px color-mix(in srgb,${primaryColor} 16%,transparent)}
          .bengal-auth-widget .ba-button{width:100%;border:0;border-radius:10px;padding:12px 14px;background:${primaryColor};color:#fff;font:inherit;font-weight:700;cursor:pointer}
          .bengal-auth-widget .ba-button:disabled{opacity:.6;cursor:wait}
          .bengal-auth-widget .ba-secondary{background:transparent;color:${primaryColor};margin-top:12px}
          .bengal-auth-widget .ba-message{font-size:13px;line-height:1.45;margin:13px 0 0;min-height:18px;color:#b42318;overflow-wrap:anywhere}
          .bengal-auth-widget .ba-message[data-kind="success"]{color:#067647}
          .bengal-auth-widget [hidden]{display:none!important}
          @media(max-width:480px){.bengal-auth-widget .ba-card{padding:22px;border-radius:14px}.bengal-auth-widget h2{font-size:22px}}
        </style>
        <div class="ba-card">
          <div class="ba-brand">
            <div class="ba-logo" aria-hidden="true">${escapeHtml(settings.logo)}</div>
            <div class="ba-brand-name">${escapeHtml(settings.name)}</div>
          </div>
          <div class="ba-tabs" role="tablist" aria-label="Account options">
            <button class="ba-tab" type="button" role="tab" aria-selected="true" data-tab="signup">Sign Up</button>
            <button class="ba-tab" type="button" role="tab" aria-selected="false" data-tab="login">Log In</button>
          </div>
          <section class="ba-auth-signup">
            <h2>${escapeHtml(settings.title)}</h2>
            <p class="ba-subtitle">Create your account to get started.</p>
            <form class="ba-form ba-signup-form">
              <label for="ba-signup-name">Full name</label>
              <input id="ba-signup-name" name="name" type="text" autocomplete="name" maxlength="100" placeholder="Your name" required>
              <label for="ba-signup-email">Email address</label>
              <input id="ba-signup-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
              <label for="ba-signup-password">Password</label>
              <input id="ba-signup-password" name="password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>
              <button class="ba-button" type="submit">Create account</button>
            </form>
          </section>
          <section class="ba-auth-login" hidden>
            <h2>Welcome back</h2>
            <p class="ba-subtitle">Log in to your BENGAL account.</p>
            <form class="ba-form ba-login-form">
              <label for="ba-login-email">Email address</label>
              <input id="ba-login-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
              <label for="ba-login-password">Password</label>
              <input id="ba-login-password" name="password" type="password" autocomplete="current-password" required>
              <button class="ba-button" type="submit">Log In</button>
            </form>
          </section>
          <section class="ba-step-email" hidden>
            <h2>Verify your email</h2>
            <p class="ba-subtitle">Enter your email and we’ll send you a one-time verification code.</p>
            <form class="ba-email-form">
              <label for="ba-email">Email address</label>
              <input id="ba-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
              <button class="ba-button" type="submit">Send verification code</button>
            </form>
          </section>
          <section class="ba-step-code" hidden>
            <h2>Check your inbox</h2>
            <p class="ba-subtitle">Enter the verification code sent to your email address.</p>
            <form class="ba-code-form">
              <label for="ba-code">Verification code</label>
              <input id="ba-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="Enter your code" required>
              <button class="ba-button" type="submit">Verify email</button>
            </form>
            <button class="ba-button ba-secondary ba-resend" type="button" disabled>Resend code (60s)</button>
            <button class="ba-button ba-secondary ba-back" type="button">Use a different email</button>
          </section>
          <p class="ba-message" role="status" aria-live="polite"></p>
        </div>
      </div>`;

    const root = container.querySelector(".bengal-auth-widget");
    const emailForm = root.querySelector(".ba-email-form");
    const signupForm = root.querySelector(".ba-signup-form");
    const loginForm = root.querySelector(".ba-login-form");
    const signupStep = root.querySelector(".ba-auth-signup");
    const loginStep = root.querySelector(".ba-auth-login");
    const tabs = Array.from(root.querySelectorAll(".ba-tab"));
    const codeForm = root.querySelector(".ba-code-form");
    const emailStep = root.querySelector(".ba-step-email");
    const codeStep = root.querySelector(".ba-step-code");
    const emailInput = root.querySelector("#ba-email");
    const codeInput = root.querySelector("#ba-code");
    const message = root.querySelector(".ba-message");
    const resendButton = root.querySelector(".ba-resend");
    let currentEmail = "";
    let countdown = 0;
    let countdownTimer = null;

    function setMessage(text, kind) {
      message.textContent = text || "";
      message.dataset.kind = kind || "error";
    }

    async function post(path, body) {
      const response = await fetch(apiUrl + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(data.message || data.error || "Request failed. Please try again.");
      return data;
    }

    function showTab(tabName) {
      signupStep.hidden = tabName !== "signup";
      loginStep.hidden = tabName !== "login";
      emailStep.hidden = true;
      codeStep.hidden = true;
      tabs.forEach(function (tab) {
        tab.setAttribute("aria-selected", String(tab.dataset.tab === tabName));
      });
      setMessage("", "");
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { showTab(tab.dataset.tab); });
    });

    async function submitAuthForm(form, endpoint, successText, callbackName) {
      const button = form.querySelector("button[type=submit]");
      const values = Object.fromEntries(new FormData(form).entries());
      if (values.email) values.email = values.email.trim().toLowerCase();
      button.disabled = true;
      setMessage("Please wait…", "info");
      try {
        const data = await post(endpoint, values);
        setMessage(data.message || successText, "success");
        if (callbackName && typeof settings[callbackName] === "function") settings[callbackName](data);
        if (data.token) {
          try { root.dispatchEvent(new CustomEvent("bengalauth:authenticated", { detail: data })); } catch (_) {}
        }
        if (data.requiresVerification) {
          currentEmail = values.email || "";
          emailInput.value = currentEmail;
          signupStep.hidden = true;
          loginStep.hidden = true;
          emailStep.hidden = false;
          codeStep.hidden = true;
          root.querySelector(".ba-tabs").hidden = true;
        }
      } catch (error) {
        setMessage(error.message);
      } finally {
        button.disabled = false;
      }
    }

    signupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitAuthForm(signupForm, "/api/signup", "Account created successfully!", "onSignedUp");
    });

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      submitAuthForm(loginForm, "/api/login", "Logged in successfully!", "onLoggedIn");
    });

    function startCountdown(seconds) {
      if (countdownTimer) clearInterval(countdownTimer);
      countdown = seconds;
      resendButton.disabled = true;
      const update = function () {
        resendButton.textContent = countdown > 0 ? "Resend code (" + countdown + "s)" : "Resend verification code";
        resendButton.disabled = countdown > 0;
        if (countdown <= 0 && countdownTimer) {
          clearInterval(countdownTimer);
          countdownTimer = null;
        }
        countdown -= 1;
      };
      update();
      countdownTimer = setInterval(update, 1000);
    }

    emailForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      currentEmail = emailInput.value.trim();
      if (!currentEmail) return;
      const button = emailForm.querySelector("button");
      button.disabled = true;
      setMessage("Sending verification code…", "info");
      try {
        const data = await post("/api/send-code", { email: currentEmail });
        emailStep.hidden = true;
        codeStep.hidden = false;
        setMessage(data.message || "If the address is valid, a verification code has been sent.", "success");
        startCountdown(60);
        codeInput.focus();
      } catch (error) {
        setMessage(error.message);
      } finally {
        button.disabled = false;
      }
    });

    codeForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const code = codeInput.value.trim();
      if (!code) return;
      const button = codeForm.querySelector("button");
      button.disabled = true;
      setMessage("Verifying code…", "info");
      try {
        const data = await post("/api/verify-code", { email: currentEmail, code: code });
        setMessage(data.message || "Email verified successfully!", "success");
        codeForm.hidden = true;
        resendButton.hidden = true;
        root.querySelector(".ba-back").hidden = true;
        if (typeof settings.onVerified === "function") settings.onVerified(data);
        root.querySelector(".ba-tabs").hidden = false;
        showTab("login");
      } catch (error) {
        setMessage(error.message);
      } finally {
        button.disabled = false;
      }
    });

    resendButton.addEventListener("click", async function () {
      if (countdown > 0) return;
      resendButton.disabled = true;
      setMessage("Sending a new code…", "info");
      try {
        const data = await post("/api/send-code", { email: currentEmail });
        setMessage(data.message || "If the address is valid, a new code has been sent.", "success");
        startCountdown(60);
      } catch (error) {
        setMessage(error.message);
        resendButton.disabled = false;
      }
    });

    showTab("login");

    root.querySelector(".ba-back").addEventListener("click", function () {
      if (countdownTimer) clearInterval(countdownTimer);
      emailStep.hidden = true;
      codeStep.hidden = true;
      root.querySelector(".ba-tabs").hidden = false;
      codeForm.reset();
      showTab("signup");
    });
  }

  global.BengalAuth = { init: init };
})(window);
