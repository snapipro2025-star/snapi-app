/**
 * Convert E.164 phone number (+17177521571)
 * into user-dialable format (717-752-1571)
 */
export function formatDialNumber(e164?: string | null): string {
  if (!e164) return "";

  // Remove US country code
  const digits = e164.replace(/^\+1/, "");

  // Format XXX-XXX-XXXX
  return digits.replace(
    /(\d{3})(\d{3})(\d{4})/,
    "$1-$2-$3"
  );
}
