import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export interface VerifyEmailProps {
  verifyUrl: string;
  siteName?: string;
  siteUrl?: string;
}

export function VerifyEmail({ verifyUrl, siteName, siteUrl }: VerifyEmailProps) {
  const brand = siteName ?? "Our App";
  return (
    <EmailLayout
      previewText={`Verify your email for ${brand}`}
      siteName={siteName}
      siteUrl={siteUrl}
    >
      <Text style={styles.heading}>Confirm your email</Text>
      <Text style={styles.paragraph}>
        Welcome to {brand}. Click the button below to confirm this email
        address. The link is valid for 1 hour.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={verifyUrl} style={styles.button}>
          Verify email
        </Button>
      </Section>
      <Text style={styles.muted}>
        If the button doesn&apos;t work, paste this link into your browser:
      </Text>
      <Text style={styles.mono}>{verifyUrl}</Text>
      <Text style={styles.muted}>
        Didn&apos;t create an account? You can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default VerifyEmail;
