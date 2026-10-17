import { HandPlatter, ReceiptText, Truck } from 'lucide-react';

export default function BillChargeIcon({ chargeKey }: Readonly<{ chargeKey: string }>) {
  const Icon = chargeKey === 'service_fee' ? HandPlatter : chargeKey === 'delivery_fee' ? Truck : ReceiptText;
  return <Icon size={19} aria-hidden="true" />;
}
