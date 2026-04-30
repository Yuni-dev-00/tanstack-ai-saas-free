import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// Brand-neutral template shell used by all transactional mails. A product
// spawned from this template can replace the palette / logo via
// EmailLayoutProps or (simpler) fork this file once the brand is locked in.
// [BRAND TODO] Logo, accent color, footer signature.

export interface EmailLayoutProps {
  previewText: string;
  children: ReactNode;
  // Absolute URL of the sender product so footer links resolve even in
  // Gmail's clipped view. Defaults to a safe placeholder.
  siteUrl?: string;
  siteName?: string;
  unsubscribeUrl?: string;
}

const main: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif",
  margin: 0,
  padding: "40px 0",
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #e4e4e7",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "40px 32px",
};

const footer: React.CSSProperties = {
  color: "#71717a",
  fontSize: "12px",
  lineHeight: "18px",
  marginTop: "32px",
  textAlign: "center" as const,
};

export function EmailLayout({
  previewText,
  children,
  siteUrl,
  siteName,
  unsubscribeUrl,
}: EmailLayoutProps) {
  const resolvedSite = siteName ?? "Our App";
  const resolvedUrl = siteUrl ?? "https://example.com";
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {children}
          <Hr style={{ borderTop: "1px solid #e4e4e7", margin: "32px 0 0 0" }} />
          <Section>
            <Text style={footer}>
              {resolvedSite} · {resolvedUrl.replace(/^https?:\/\//, "")}
            </Text>
            {unsubscribeUrl && (
              <Text style={{ ...footer, marginTop: "8px" }}>
                不想再收到邮件？<a href={unsubscribeUrl} style={{ color: "#71717a" }}>点此退订</a>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Shared button/text styles so templates don't each re-declare the palette.
export const styles = {
  heading: {
    color: "#18181b",
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: "32px",
    margin: "0 0 16px 0",
  } satisfies React.CSSProperties,
  paragraph: {
    color: "#3f3f46",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "0 0 16px 0",
  } satisfies React.CSSProperties,
  button: {
    backgroundColor: "#18181b",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 24px",
    textDecoration: "none",
  } satisfies React.CSSProperties,
  mono: {
    backgroundColor: "#f4f4f5",
    border: "1px solid #e4e4e7",
    borderRadius: "4px",
    color: "#18181b",
    display: "inline-block",
    fontFamily:
      "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace",
    fontSize: "13px",
    padding: "8px 12px",
    wordBreak: "break-all" as const,
  } satisfies React.CSSProperties,
  muted: {
    color: "#71717a",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "16px 0 0 0",
  } satisfies React.CSSProperties,
};
