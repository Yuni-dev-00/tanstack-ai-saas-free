import { Heading, Section, Text, Button } from "@react-email/components";
import { EmailLayout } from "./_layout";

export default function InvoicePaymentFailedEmail({
  userName,
  invoiceAmount,
  invoiceUrl,
  retryUrl,
}: {
  userName: string;
  invoiceAmount: string;
  invoiceUrl: string;
  retryUrl: string;
}) {
  return (
    <EmailLayout previewText="您的订阅付款失败">
      <Heading>付款失败</Heading>
      <Text>您好 {userName}，</Text>
      <Text>
        我们在扣款 {invoiceAmount} 时遇到问题。请更新付款方式以保持订阅。
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={retryUrl} style={btn}>
          重新付款
        </Button>
      </Section>
      <Text style={muted}>查看发票：{invoiceUrl}</Text>
    </EmailLayout>
  );
}
const btn = {
  background: "#000",
  color: "#fff",
  padding: "12px 24px",
  borderRadius: 6,
};
const muted = { color: "#666", fontSize: 14 };
