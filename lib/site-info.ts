export type SitePolicyLink = { label: string; href: string };

const businessDefaults = {
  name: "투나잇아트",
  representative: "김태승",
  registrationNumber: "103-47-00982",
  mailOrderNumber: "제 2023-경기파주-3071 호",
  address: "경기도 파주시 청석로 272, 1004-F190호(동패동, 센타프라자1, 공유오피스)",
  supportEmail: "kimts827@gmail.com",
} as const;

export function moliveSiteInfo() {
  return {
    business: {
      name: process.env.MOLIVE_BUSINESS_NAME?.trim() || businessDefaults.name,
      representative: process.env.MOLIVE_REPRESENTATIVE?.trim() || businessDefaults.representative,
      registrationNumber: process.env.MOLIVE_BUSINESS_REGISTRATION_NUMBER?.trim() || businessDefaults.registrationNumber,
      mailOrderNumber: process.env.MOLIVE_MAIL_ORDER_NUMBER?.trim() || businessDefaults.mailOrderNumber,
      address: process.env.MOLIVE_BUSINESS_ADDRESS?.trim() || businessDefaults.address,
      supportEmail: process.env.MOLIVE_SUPPORT_EMAIL?.trim() || businessDefaults.supportEmail,
    },
    policies: [
      { label: "이용약관", href: "/terms" },
      { label: "개인정보처리방침", href: "/privacy" },
      { label: "결제/환불 안내", href: "/refund" },
    ] satisfies SitePolicyLink[],
  };
}
