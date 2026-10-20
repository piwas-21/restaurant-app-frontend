import { HandPlatter, ReceiptText, Truck, Percent } from 'lucide-react';

export default function BillChargeIcon({ chargeKey }: Readonly<{ chargeKey: string }>) {
  let Icon = ReceiptText;
  if (chargeKey === 'service_fee') Icon = HandPlatter;
  else if (chargeKey === 'delivery_fee') Icon = Truck;
  else if (chargeKey === 'discount') Icon = Percent;
  return <Icon size={19} aria-hidden="true" />;
}
