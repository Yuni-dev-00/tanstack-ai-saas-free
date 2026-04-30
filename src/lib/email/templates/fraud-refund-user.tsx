import { Heading, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export default function FraudRefundUserEmail({
  userName,
  amount,
}: {
  userName: string;
  amount: string;
}) {
  return (
    <EmailLayout previewText="您的付款已退还">
      <Heading>付款已退还</Heading>
      <Text>您好 {userName}，</Text>
      <Text>
        因我们的风控系统检测到异常，您的付款 {amount}{" "}
        已全额退还到原支付渠道（3-5 个工作日到账）。
      </Text>
      <Text>如有疑问请回复此邮件。</Text>
    </EmailLayout>
  );
}
