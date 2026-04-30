import { Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export interface OtpCodeEmailProps {
  code: string;
  // What the OTP unlocks. BetterAuth's emailOTP plugin fires this for
  // signup verification, sign-in, password reset, AND email-change
  // confirmation; the body wording shifts to match.
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
  expiresInMinutes?: number;
  siteName?: string;
  siteUrl?: string;
}

const PURPOSE_TEXT: Record<OtpCodeEmailProps["type"], string> = {
  "sign-in": "to finish signing in",
  "email-verification": "to verify your email",
  "forget-password": "to reset your password",
  "change-email": "to confirm your new email address",
};

export function OtpCodeEmail({
  code,
  type,
  expiresInMinutes = 5,
  siteName,
  siteUrl,
}: OtpCodeEmailProps) {
  const brand = siteName ?? "Our App";
  return (
    <EmailLayout
      previewText={`Your ${brand} code: ${code}`}
      siteName={siteName}
      siteUrl={siteUrl}
    >
      <Text style={styles.heading}>Your verification code</Text>
      <Text style={styles.paragraph}>
        Use the code below {PURPOSE_TEXT[type]}. It expires in {expiresInMinutes}{" "}
        minutes.
      </Text>
      <Section style={{ margin: "24px 0", textAlign: "center" as const }}>
        <Text
          style={{
            display: "inline-block",
            fontSize: "32px",
            fontWeight: 700,
            letterSpacing: "8px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            background: "#f5f5f5",
            padding: "16px 24px",
            borderRadius: "6px",
          }}
        >
          {code}
        </Text>
      </Section>
      <Text style={styles.muted}>
        Didn&apos;t request this? You can safely ignore this email — your
        account stays untouched.
      </Text>
    </EmailLayout>
  );
}
