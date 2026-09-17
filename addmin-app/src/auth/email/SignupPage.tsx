import { Link, useSearchParams } from "react-router";
import { SignupForm } from "wasp/client/auth";
import { AuthLayout } from "../AuthLayout";

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";

  return (
    <AuthLayout>
      {inviteToken && (
        <p className="mb-4 text-sm text-neutral-600">
          You've been invited to join an organization on AddMin. Sign up with
          the same email address the invite was sent to.
        </p>
      )}
      <SignupForm
        additionalFields={[
          // Invisible: carries the invite token (if any) from the URL into
          // the signup payload, where userSignupFields.ts reads it as
          // `data.inviteToken`. Not a User column, so it isn't declared as
          // a real field getter -- see userSignupFields.ts's file comment.
          (hookForm) => {
            hookForm.setValue("inviteToken" as never, inviteToken as never);
            return null;
          },
        ]}
      />
      <br />
      <span className="text-sm font-medium text-neutral-900">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold underline">
          Go to login
        </Link>
        .
      </span>
    </AuthLayout>
  );
}
