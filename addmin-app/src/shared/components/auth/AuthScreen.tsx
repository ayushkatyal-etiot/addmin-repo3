import { ReactNode } from "react";
import { Link } from "wasp/client/router";
import Logo from "../../../assets/addmin-logo.png";
import Background from "../../../assets/background.jpg";

// Full-bleed backdrop shared by every screen in the auth/onboarding flow
// (sign in, sign up, MFA, password reset, email verification, add office,
// onboarding wizard, setup review) -- see Login Flow.dc.html. Concentric
// rings + gradient stand in for the design's stock background photo.
export function AuthScreen({
  children,
  topRight,
  center = true,
}: {
  children: ReactNode;
  topRight?: ReactNode;
  // false for the wide wizard screens (add office, onboarding, setup review)
  // -- they flow top-down under the logo instead of centering a single card.
  center?: boolean;
}) {
  return (
    <div
      className="auth-screen"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(247,248,248,0.55) 0%, rgba(247,248,248,0.76) 55%, rgba(247,248,248,0.92) 100%), url(${Background})`,
      }}
    >
      <div className="auth-screen-rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={`relative z-10 flex w-full items-center justify-between gap-4 ${center ? "" : "mb-8"}`}>
        <Link to="/" className="auth-screen-logo">
          <img src={Logo} alt="AddMin" />
        </Link>
        {topRight}
      </div>
      {center ? (
        <div className="relative z-10 flex w-full flex-1 items-center justify-center py-8">{children}</div>
      ) : (
        <div className="relative z-10 w-full flex-1 pb-8">{children}</div>
      )}
    </div>
  );
}
