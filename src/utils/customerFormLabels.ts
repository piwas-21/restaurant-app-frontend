import type { TFunction } from 'i18next';

/**
 * Translated display names for the admin "Customer forms" page. Keyed by the
 * backend registry's formKey/fieldKey identifiers (`FormFieldRegistry.cs`);
 * an unknown key (e.g. a field added backend-side before this map catches up)
 * falls back to the raw key so the page still renders.
 */

const FORM_TITLES: Record<string, { key: string; fallback: string }> = {
  reservation: { key: 'customer_forms_form_reservation', fallback: 'Reservation form' },
  checkout_contact: { key: 'customer_forms_form_checkout_contact', fallback: 'Checkout contact' },
  delivery_address: { key: 'customer_forms_form_delivery_address', fallback: 'Delivery address' },
};

const FIELD_LABELS: Record<string, { key: string; fallback: string }> = {
  customerName: { key: 'customer_forms_field_customer_name', fallback: 'Name' },
  customerEmail: { key: 'customer_forms_field_customer_email', fallback: 'Email' },
  customerPhone: { key: 'customer_forms_field_customer_phone', fallback: 'Phone' },
  specialRequests: { key: 'customer_forms_field_special_requests', fallback: 'Special requests' },
  name: { key: 'customer_forms_field_name', fallback: 'Name' },
  email: { key: 'customer_forms_field_email', fallback: 'Email' },
  phone: { key: 'customer_forms_field_phone', fallback: 'Phone' },
  street: { key: 'customer_forms_field_street', fallback: 'Street' },
  postalCode: { key: 'customer_forms_field_postal_code', fallback: 'Postal code' },
  city: { key: 'customer_forms_field_city', fallback: 'City' },
  country: { key: 'customer_forms_field_country', fallback: 'Country' },
  additionalInfo: { key: 'customer_forms_field_additional_info', fallback: 'Additional information' },
};

export function customerFormTitle(t: TFunction, formKey: string): string {
  const entry = FORM_TITLES[formKey];
  return entry ? t(entry.key, entry.fallback) : formKey;
}

export function customerFormFieldLabel(t: TFunction, fieldKey: string): string {
  const entry = FIELD_LABELS[fieldKey];
  return entry ? t(entry.key, entry.fallback) : fieldKey;
}
