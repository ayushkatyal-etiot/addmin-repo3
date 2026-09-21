import { emailSender } from "wasp/server/email";

// Thin wrapper, reused by every notification-firing job from Build Step 06
// onward. Deliberately doesn't touch NotificationLog itself -- callers write
// that (the dedup key/type is job-specific), this only owns "how to send an
// email." Per 04-architecture.md's failure-mode note: a send failure must
// never block the underlying obligation state transition, so callers should
// await this after the state change commits, and treat a thrown error here
// as log-and-continue, not a reason to roll back.
export async function sendNotificationEmail(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  await emailSender.send(params);
}
