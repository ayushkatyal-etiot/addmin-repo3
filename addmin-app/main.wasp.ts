import { app, api, action, page, query, route } from "@wasp.sh/spec";
import { App } from "./src/App" with { type: "ref" };
import { EmailVerificationPage } from "./src/auth/email/EmailVerificationPage" with { type: "ref" };
import { LoginPage } from "./src/auth/email/LoginPage" with { type: "ref" };
import { PasswordResetPage } from "./src/auth/email/PasswordResetPage" with { type: "ref" };
import { RequestPasswordResetPage } from "./src/auth/email/RequestPasswordResetPage" with { type: "ref" };
import { SignupPage } from "./src/auth/email/SignupPage" with { type: "ref" };
import { userSignupFields } from "./src/auth/email/userSignupFields" with { type: "ref" };
import { MfaSetupPage } from "./src/auth/mfa/MfaSetupPage" with { type: "ref" };
import { MfaVerifyPage } from "./src/auth/mfa/MfaVerifyPage" with { type: "ref" };
import { PlatformSigninPage } from "./src/platform/PlatformSigninPage" with { type: "ref" };
import { HomePage } from "./src/HomePage" with { type: "ref" };
import { seedDevData } from "./src/server/seed" with { type: "ref" };
import {
  getMfaStatus,
  enrollMfa,
  confirmMfaEnrollment,
  verifyMfaLogin,
} from "./src/server/auth/operations" with { type: "ref" };
import { inviteUser } from "./src/server/admin/invites" with { type: "ref" };
import {
  platformLogin,
  platformLogout,
  platformMe,
} from "./src/server/platform/platformAuth" with { type: "ref" };

// Build Step 01/02/03 (planmysaas-blueprint/08-build-playbook.md): repo bootstrap,
// data layer, auth/RBAC/Platform Operator identity. Domain query/action/job
// declarations for each remaining module land here in later steps, grouped by
// module in the same order as 04-architecture.md's API surface table.

export default app({
  name: "addminApp",
  wasp: { version: "^0.25.0" },
  title: "AddMin",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  db: {
    seeds: [seedDevData],
  },
  auth: {
    userEntity: "User",
    methods: {
      email: {
        fromField: {
          name: "AddMin",
          email: "ayush.katyal@etiot.in",
        },
        userSignupFields,
        emailVerification: {
          clientRoute: "EmailVerificationRoute",
        },
        passwordReset: {
          clientRoute: "PasswordResetRoute",
        },
      },
    },
    onAuthSucceededRedirectTo: "/",
    onAuthFailedRedirectTo: "/login",
  },
  emailSender: {
    provider: "SendGrid",
    defaultFrom: {
      name: "AddMin",
      email: "ayush.katyal@etiot.in",
    },
  },
  client: {
    rootComponent: App,
  },
  spec: [
    route("HomeRoute", "/", page(HomePage, { authRequired: true })),
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),
    route(
      "RequestPasswordResetRoute",
      "/request-password-reset",
      page(RequestPasswordResetPage),
    ),
    route("PasswordResetRoute", "/password-reset", page(PasswordResetPage)),
    route(
      "EmailVerificationRoute",
      "/email-verification",
      page(EmailVerificationPage),
    ),
    route("MfaSetupRoute", "/mfa-setup", page(MfaSetupPage, { authRequired: true })),
    route("MfaVerifyRoute", "/mfa-verify", page(MfaVerifyPage, { authRequired: true })),

    // Identity & Access Module (04-architecture.md) -- MFA + invites.
    query(getMfaStatus, { entities: ["User"] }),
    action(enrollMfa, { entities: ["User"] }),
    action(confirmMfaEnrollment, { entities: ["User"] }),
    action(verifyMfaLogin, { entities: ["User"] }),
    action(inviteUser, { entities: ["User", "Invite", "AuditLog"] }),

    // Platform Operations Module (04-architecture.md, F-20) -- deliberately
    // raw api routes, not typed operations: PlatformOperator never flows
    // through Wasp's auth `context.user`. See src/server/platform/platformAuth.ts.
    route("PlatformSigninRoute", "/platform/signin", page(PlatformSigninPage)),
    api("POST", "/platform/login", platformLogin, {
      entities: ["PlatformOperator"],
      auth: false,
    }),
    api("POST", "/platform/logout", platformLogout, { auth: false }),
    api("GET", "/platform/me", platformMe, {
      entities: ["PlatformOperator"],
      auth: false,
    }),
  ],
});
