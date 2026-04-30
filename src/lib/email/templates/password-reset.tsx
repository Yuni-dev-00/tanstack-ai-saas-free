import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export interface PasswordResetProps {
  resetUrl: string;
  siteName?: string;
  siteUrl?: string;
}

export function PasswordReset({ resetUrl, siteName, siteUrl }: PasswordResetProps) {
  const brand = siteName ?? "Our App";
  return (
    <EmailLayout
      previewText={`Reset your ${brand} password`}
      siteName={siteName}
      siteUrl={siteUrl}
    >
      <Text style={styles.heading}>Reset your password</Text>
      <Text style={styles.paragraph}>
        Someone requested a password reset for your {brand} account. Click
        below to choose a new password. The link expires in 1 hour.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={resetUrl} style={styles.button}>
          Reset password
        </Button>
      </Section>
      <Text style={styles.muted}>
        If the button doesn&apos;t work, paste this link into your browser:
      </Text>
      <Text style={styles.mono}>{resetUrl}</Text>
      <Text style={styles.muted}>
        If you didn&apos;t request this, you can safely ignore this email —
        your password will stay unchanged.
      </Text>
    </EmailLayout>
  );
}

export default PasswordReset;
