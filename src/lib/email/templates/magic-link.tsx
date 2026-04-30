import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./_layout";

export interface MagicLinkEmailProps {
  magicLinkUrl: string;
  siteName?: string;
  siteUrl?: string;
}

export function MagicLinkEmail({ magicLinkUrl, siteName, siteUrl }: MagicLinkEmailProps) {
  const brand = siteName ?? "Our App";
  return (
    <EmailLayout
      previewText={`Sign in to ${brand}`}
      siteName={siteName}
      siteUrl={siteUrl}
    >
      <Text style={styles.heading}>Sign in to {brand}</Text>
      <Text style={styles.paragraph}>
        Click the button below to sign in. The link is valid for 5
        minutes and only works once — request a new one if it expires.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={magicLinkUrl} style={styles.button}>
          Sign in
        </Button>
      </Section>
      <Text style={styles.muted}>
        If the button doesn&apos;t work, paste this link into your browser:
      </Text>
      <Text style={{ ...styles.muted, wordBreak: "break-all" }}>{magicLinkUrl}</Text>
      <Text style={styles.muted}>
        Didn&apos;t request this? You can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}
